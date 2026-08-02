import fs from "node:fs";
import path from "node:path";
import {
  type CoinPublicKey,
  DustSecretKey,
  type EncPublicKey,
  type FinalizedTransaction,
  LedgerParameters,
  nativeToken,
  unshieldedToken,
  ZswapSecretKeys,
} from "@midnight-ntwrk/ledger-v8";
import type {
  MidnightProvider,
  UnboundTransaction,
  WalletProvider,
} from "@midnight-ntwrk/midnight-js-types";
import { ttlOneHour } from "@midnight-ntwrk/midnight-js-utils";
import {
  WalletFacade,
  type DefaultConfiguration,
} from "@midnightntwrk/wallet-sdk-facade";
import {
  ShieldedWallet,
  type ShieldedWalletAPI,
  type ShieldedWalletState,
} from "@midnightntwrk/wallet-sdk-shielded";
import { DustWallet } from "@midnightntwrk/wallet-sdk-dust-wallet";
import {
  PublicKey,
  UnshieldedWallet,
  createKeystore,
  type UnshieldedKeystore,
} from "@midnightntwrk/wallet-sdk-unshielded-wallet";
import { NoOpTransactionHistoryStorage } from "@midnightntwrk/wallet-sdk-abstractions";
import { DustAddress, MidnightBech32m } from "@midnightntwrk/wallet-sdk-address-format";
import type { EnvironmentConfiguration } from "@midnight-ntwrk/testkit-js";
import {
  WalletSeeds,
  type DustWalletOptions,
} from "@midnight-ntwrk/testkit-js";
import type { Logger } from "pino";
import * as Rx from "rxjs";
import { toLoggableError } from "../logging.js";

const getInitialShieldedState = async (
  wallet: ShieldedWalletAPI,
): Promise<ShieldedWalletState> => Rx.firstValueFrom(wallet.state);

type WalletStateCache = {
  savedAt: string;
  networkId: string;
  role: WalletRole;
  shielded: string;
  unshielded: string;
  dust: string;
};

export type WalletRole = "operating" | "sponsor";

export type SponsorshipResult = {
  txId: string;
  selectedUtxos: number;
  utxoIds: string[];
  requiredDust: string;
  estimatedGeneratedDust: string;
  registrationFee: string;
  expiresAt?: string;
  reused?: boolean;
};

export type SponsorCapacity = {
  availableCoins: number;
  freeNightUtxos: number;
  registeredUtxos: number;
  skippedNonNightUtxos: number;
};

export type SponsorPoolSplitResult = {
  txId: string | null;
  skippedReason?: string;
  outputsCreated: number;
  splitAmount: string;
  freeNightUtxosBefore: number;
  registeredUtxosBefore: number;
};

type SponsorPoolSplitOptions = {
  targetFreeUtxos: number;
  splitAmount: bigint;
  maxOutputs: number;
};

type SponsorDustOptions = {
  requiredDust?: bigint;
  waitTimeoutMs?: number;
};

type WaitForReadyFundsOptions = {
  generateOperatingDust?: boolean;
  requireFunds?: boolean;
};

// Minimum backend DUST required before attempting a deregistration TX.
// The deregistration fee is paid from DUST; submitting with less will produce
// a BalanceCheckOverspend (error 138) from the Midnight node.
const MINIMUM_RECLAIM_DUST = 5_000n;

const utxoId = (coin: { utxo: { intentHash: string; outputNo: number } }): string =>
  `${coin.utxo.intentHash}#${coin.utxo.outputNo}`;

const registeredNativeUtxoIds = (coins: readonly {
  meta: { registeredForDustGeneration: boolean };
  utxo: { intentHash: string; outputNo: number; type: string };
}[]): string[] =>
  coins
    .filter((coin) => coin.meta.registeredForDustGeneration && coin.utxo.type === nativeToken().raw)
    .map(utxoId);

const parseDustAddress = (address: string, networkId: string): DustAddress =>
  DustAddress.codec.decode(networkId, MidnightBech32m.parse(address));

const safeCacheSegment = (value: string): string =>
  value.replace(/[^a-zA-Z0-9._-]/g, "_");

const getWalletStateCachePath = (networkId: string, role: WalletRole): string =>
  path.resolve(
    process.cwd(),
    ".wallet-cache",
    `backend-wallet-state-${safeCacheSegment(role)}-${safeCacheSegment(networkId)}.json`,
  );

const readWalletStateCache = (
  logger: Logger,
  networkId: string,
  role: WalletRole,
): WalletStateCache | undefined => {
  const cachePath = getWalletStateCachePath(networkId, role);

  if (!fs.existsSync(cachePath)) return undefined;

  try {
    const cache = JSON.parse(
      fs.readFileSync(cachePath, "utf8"),
    ) as WalletStateCache;

    if (cache.networkId !== networkId) {
      logger.warn(
        `Ignoring ${role} wallet state cache for ${cache.networkId}; active network is ${networkId}`,
      );
      return undefined;
    }

    logger.info(`Loaded ${role} wallet state cache: ${cachePath}`);
    return cache;
  } catch (error) {
    logger.warn(
      { err: toLoggableError(error) },
      `Failed to load ${role} wallet state cache; starting from seed`,
    );
    return undefined;
  }
};

type TokenKind = "shielded" | "unshielded" | "dust";
type TokenKindsToBalance = "all" | TokenKind[];

export class BackendWalletProvider implements MidnightProvider, WalletProvider {
  private tokenKindsToBalanceOverride?: TokenKindsToBalance;

  private constructor(
    readonly logger: Logger,
    readonly env: EnvironmentConfiguration,
    readonly wallet: WalletFacade,
    readonly zswapSecretKeys: ZswapSecretKeys,
    readonly dustSecretKey: DustSecretKey,
    readonly unshieldedKeystore: UnshieldedKeystore,
    readonly seed: string,
    readonly role: WalletRole,
  ) {}

  private cacheTimer?: NodeJS.Timeout;

  private async saveWalletStateCache(): Promise<void> {
    const cachePath = getWalletStateCachePath(this.env.walletNetworkId, this.role);

    fs.mkdirSync(path.dirname(cachePath), { recursive: true });

    const [shielded, unshielded, dust] = await Promise.all([
      this.wallet.shielded.serializeState(),
      this.wallet.unshielded.serializeState(),
      this.wallet.dust.serializeState(),
    ]);

    fs.writeFileSync(
      cachePath,
      JSON.stringify(
        {
          savedAt: new Date().toISOString(),
          networkId: this.env.walletNetworkId,
          role: this.role,
          shielded,
          unshielded,
          dust,
        },
        null,
        2,
      ),
    );

    this.logger.info(`Saved ${this.role} wallet state cache: ${cachePath}`);
  }

  startWalletStateCache(): void {
    this.cacheTimer = setInterval(() => {
      this.saveWalletStateCache().catch((error) => {
        this.logger.warn(
          { err: toLoggableError(error) },
          "Failed to save backend wallet state cache",
        );
      });
    }, 30_000);
  }

  getCoinPublicKey(): CoinPublicKey {
    return this.zswapSecretKeys.coinPublicKey;
  }

  getEncryptionPublicKey(): EncPublicKey {
    return this.zswapSecretKeys.encryptionPublicKey;
  }

  async balanceTx(
    tx: UnboundTransaction,
    ttl: Date = ttlOneHour(),
  ): Promise<FinalizedTransaction> {
    const secretKeys = {
      shieldedSecretKeys: this.zswapSecretKeys,
      dustSecretKey: this.dustSecretKey,
    };
    await this.logFeeLiquidity("Before balanceTx");
    const tokenKindsToBalance = this.tokenKindsToBalanceOverride ?? "all";
    const recipe = await this.wallet.balanceUnboundTransaction(tx, secretKeys, {
      ttl,
      tokenKindsToBalance,
    });
    const signedRecipe = await this.wallet.signRecipe(
      recipe,
      (payload: Uint8Array) => this.unshieldedKeystore.signData(payload),
    );
    return this.wallet.finalizeRecipe(signedRecipe);
  }

  submitTx(tx: FinalizedTransaction): Promise<string> {
    return this.wallet.submitTransaction(tx);
  }

  withTokenKindsToBalance<T>(
    tokenKindsToBalance: TokenKindsToBalance,
    fn: () => Promise<T>,
  ): Promise<T> {
    const previous = this.tokenKindsToBalanceOverride;
    this.tokenKindsToBalanceOverride = tokenKindsToBalance;
    return fn().finally(() => {
      this.tokenKindsToBalanceOverride = previous;
    });
  }

  async start(): Promise<void> {
    this.logger.info("Starting backend wallet");
    await this.wallet.start(this.zswapSecretKeys, this.dustSecretKey);
  }

  async stop(): Promise<void> {
    if (this.cacheTimer) clearInterval(this.cacheTimer);
    await this.saveWalletStateCache().catch((error) => {
      this.logger.warn(
        { err: toLoggableError(error) },
        "Failed to save backend wallet state cache during shutdown",
      );
    });
    await this.wallet.stop();
  }

  private async logFeeLiquidity(context: string): Promise<void> {
    const state = await this.wallet.waitForSyncedState();
    const dustBalance = state.dust.balance(new Date());
    const shieldedNight = state.shielded.balances[nativeToken().raw] ?? 0n;
    const unshieldedNight =
      state.unshielded.balances[unshieldedToken().raw] ?? 0n;

    this.logger.info(
      `${context} fee liquidity | dust=${dustBalance.toString()} | shieldedNight=${shieldedNight.toString()} | unshieldedNight=${unshieldedNight.toString()}`,
    );
  }

  private async generateDustFromUnshieldedNight(): Promise<bigint> {
    const state = await this.wallet.waitForSyncedState();
    const previousDustBalance = state.dust.balance(new Date());

    const utxos = state.unshielded.availableCoins.filter(
      (coin) => !coin.meta.registeredForDustGeneration && coin.utxo.type === nativeToken().raw,
    );

    if (utxos.length === 0) {
      this.logger.info(
        `No unregistered NIGHT UTXOs found for dust generation. Current dust balance: ${previousDustBalance.toString()}`,
      );
      return previousDustBalance;
    }

    const selfDustUtxos = utxos.slice(0, 1);
    const reservedSponsorUtxos = Math.max(0, utxos.length - selfDustUtxos.length);

    this.logger.info(
      `Generating backend operating DUST from ${selfDustUtxos.length} NIGHT UTxO(s); reserving ${reservedSponsorUtxos} UTxO(s) for user DUST sponsorship`,
    );

    const recipe = await this.wallet.registerNightUtxosForDustGeneration(
      selfDustUtxos,
      this.unshieldedKeystore.getPublicKey(),
      (payload: Uint8Array) => this.unshieldedKeystore.signData(payload),
      state.dust.address,
    );

    const transaction = await this.wallet.finalizeRecipe(recipe);
    const txId = await this.wallet.submitTransaction(transaction);

    let dustBalance = previousDustBalance;

    try {
      dustBalance = await Rx.firstValueFrom(
        this.wallet.state().pipe(
          Rx.map((walletState) => walletState.dust.balance(new Date())),
          Rx.filter((balance) => balance > previousDustBalance),
          Rx.timeout({ first: 120_000 }),
        ),
      );
    } catch {
      dustBalance = (await this.wallet.waitForSyncedState()).dust.balance(
        new Date(),
      );
    }

    this.logger.info(
      `Dust generation tx submitted: ${txId}; dust balance: ${dustBalance.toString()}`,
    );

    return dustBalance;
  }

  /**
   * Registers one of the backend's free NIGHT UTxOs to generate DUST flowing to
   * the given bech32m dust address. DUST is not transferable — this is the only
   * way to sponsor a user's DUST fees in V2 (mirrors how 1AM team does it).
   *
   * Returns the sponsorship transaction ID, or null if no free UTxOs are available.
   */
  async sponsorDustFor(
    dustAddressStr: string,
    networkId: string,
    options: SponsorDustOptions = {},
  ): Promise<SponsorshipResult | null> {
    try {
      const state = await this.wallet.waitForSyncedState();
      const availableCoins = state.unshielded.availableCoins;
      const beforeRegisteredIds = new Set(registeredNativeUtxoIds(availableCoins));
      const registeredUtxos = availableCoins.filter(
        (coin) => coin.meta.registeredForDustGeneration,
      );
      const utxos = availableCoins.filter(
        (coin) => !coin.meta.registeredForDustGeneration && coin.utxo.type === nativeToken().raw,
      );
      const skippedNonNightUtxos = availableCoins.filter(
        (coin) => !coin.meta.registeredForDustGeneration && coin.utxo.type !== nativeToken().raw,
      ).length;

      if (utxos.length === 0) {
        this.logger.info(
          `No free NIGHT UTXOs available for DUST sponsorship (${dustAddressStr}); available=${availableCoins.length}, alreadyRegistered=${registeredUtxos.length}, skippedNonNight=${skippedNonNightUtxos}`,
        );
        return null;
      }

      const requestedDust = options.requiredDust ?? 0n;
      const registrationEstimate = await this.wallet.estimateRegistration(utxos);
      const requiredDust = requestedDust > registrationEstimate.fee
        ? requestedDust
        : registrationEstimate.fee;
      const estimateByKey = new Map(
        registrationEstimate.dustGenerationEstimations.map((entry) => [
          `${entry.utxo.intentHash}#${entry.utxo.outputNo}`,
          entry,
        ]),
      );

      const rankedUtxos = [...utxos]
        .map((coin) => ({
          coin,
          estimate: estimateByKey.get(utxoId(coin)),
        }))
        .filter((entry): entry is { coin: (typeof utxos)[number]; estimate: NonNullable<typeof entry.estimate> } =>
          entry.estimate != null,
        )
        .sort((a, b) => Number(b.estimate.dust.generatedNow - a.estimate.dust.generatedNow));

      const selected: typeof utxos = [];
      const selectedEstimates: string[] = [];
      let estimatedGeneratedDust = 0n;

      for (const entry of rankedUtxos) {
        selected.push(entry.coin);
        estimatedGeneratedDust += entry.estimate.dust.generatedNow;
        selectedEstimates.push(`${utxoId(entry.coin)}:${entry.estimate.dust.generatedNow.toString()}`);
        if (requiredDust === 0n || estimatedGeneratedDust >= requiredDust) break;
      }

      if (selected.length === 0) {
        selected.push(utxos[0]);
      }

      if (requiredDust > 0n && estimatedGeneratedDust < requiredDust) {
        this.logger.info(
          `Waiting for sponsor NIGHT UTxO(s) to generate required DUST | required=${requiredDust.toString()} | currentlyEstimated=${estimatedGeneratedDust.toString()} | selected=${selected.length}`,
        );
        await this.wallet.waitForGeneratedDust(selected, requiredDust, {
          timeoutMs: options.waitTimeoutMs ?? 120_000,
        });
        estimatedGeneratedDust = requiredDust;
      }

      this.logger.info(
        `Sponsoring DUST for ${dustAddressStr} (networkId=${networkId}) | selectedUtxos=${selected.length} | requiredDust=${requiredDust.toString()} | requestedDust=${requestedDust.toString()} | estimatedGeneratedDust=${estimatedGeneratedDust.toString()} | registrationFee=${registrationEstimate.fee.toString()} | selected=${selectedEstimates.join(",")}`,
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const recipe = await this.wallet.registerNightUtxosForDustGeneration(
        selected,
        this.unshieldedKeystore.getPublicKey(),
        (payload: Uint8Array) => this.unshieldedKeystore.signData(payload),
        parseDustAddress(dustAddressStr, networkId),
      );

      const transaction = await this.wallet.finalizeRecipe(recipe);
      const txId = await this.wallet.submitTransaction(transaction);
      this.logger.info(`DUST sponsorship tx submitted: ${txId} → ${dustAddressStr}`);
      const registeredUtxoIds = await this.waitForRegisteredUtxoIds(
        beforeRegisteredIds,
        selected.length,
        options.waitTimeoutMs ?? 120_000,
      );
      return {
        txId,
        selectedUtxos: selected.length,
        utxoIds: registeredUtxoIds.length > 0 ? registeredUtxoIds : selected.map(utxoId),
        requiredDust: requiredDust.toString(),
        estimatedGeneratedDust: estimatedGeneratedDust.toString(),
        registrationFee: registrationEstimate.fee.toString(),
      };
    } catch (error) {
      this.logger.warn(
        { err: toLoggableError(error) },
        `DUST sponsorship failed for ${dustAddressStr}`,
      );
      return null;
    }
  }

  private async waitForRegisteredUtxoIds(
    beforeRegisteredIds: ReadonlySet<string>,
    expectedCount: number,
    timeoutMs: number,
  ): Promise<string[]> {
    const findNewRegisteredIds = (coins: readonly {
      meta: { registeredForDustGeneration: boolean };
      utxo: { intentHash: string; outputNo: number; type: string };
    }[]): string[] =>
      registeredNativeUtxoIds(coins).filter((id) => !beforeRegisteredIds.has(id));

    try {
      const ids = await Rx.firstValueFrom(
        this.wallet.state().pipe(
          Rx.map((state) => findNewRegisteredIds(state.unshielded.availableCoins)),
          Rx.filter((ids) => ids.length >= Math.max(1, expectedCount)),
          Rx.timeout({ first: timeoutMs }),
        ),
      );
      this.logger.info(`DUST sponsorship registered UTXO id(s): ${ids.join(",")}`);
      return ids;
    } catch {
      const state = await this.wallet.waitForSyncedState();
      const ids = findNewRegisteredIds(state.unshielded.availableCoins);
      if (ids.length > 0) {
        this.logger.info(`DUST sponsorship registered UTXO id(s) after sync: ${ids.join(",")}`);
      } else {
        this.logger.warn("DUST sponsorship submitted, but registered UTXO id was not visible before timeout; falling back to selected input id(s)");
      }
      return ids;
    }
  }

  async sponsorCapacity(): Promise<SponsorCapacity> {
    const state = await this.wallet.waitForSyncedState();
    const availableCoins = state.unshielded.availableCoins;
    const registeredUtxos = availableCoins.filter(
      (coin) => coin.meta.registeredForDustGeneration,
    );
    const freeNightUtxos = availableCoins.filter(
      (coin) => !coin.meta.registeredForDustGeneration && coin.utxo.type === nativeToken().raw,
    );
    const skippedNonNightUtxos = availableCoins.filter(
      (coin) => !coin.meta.registeredForDustGeneration && coin.utxo.type !== nativeToken().raw,
    );

    return {
      availableCoins: availableCoins.length,
      freeNightUtxos: freeNightUtxos.length,
      registeredUtxos: registeredUtxos.length,
      skippedNonNightUtxos: skippedNonNightUtxos.length,
    };
  }

  async splitSponsorNightPool(options: SponsorPoolSplitOptions): Promise<SponsorPoolSplitResult> {
    const state = await this.wallet.waitForSyncedState();
    const availableCoins = state.unshielded.availableCoins;
    const freeNightUtxos = availableCoins.filter(
      (coin) => !coin.meta.registeredForDustGeneration && coin.utxo.type === nativeToken().raw,
    );
    const registeredUtxos = availableCoins.filter(
      (coin) => coin.meta.registeredForDustGeneration,
    );
    const freeNightBalance = state.unshielded.balances[unshieldedToken().raw] ?? 0n;

    const baseResult = {
      txId: null,
      outputsCreated: 0,
      splitAmount: options.splitAmount.toString(),
      freeNightUtxosBefore: freeNightUtxos.length,
      registeredUtxosBefore: registeredUtxos.length,
    };

    if (options.targetFreeUtxos <= 0 || options.splitAmount <= 0n || options.maxOutputs <= 0) {
      return { ...baseResult, skippedReason: "pool splitting disabled" };
    }

    if (freeNightUtxos.length >= options.targetFreeUtxos) {
      return { ...baseResult, skippedReason: "target free UTXO count already satisfied" };
    }

    if (registeredUtxos.length > 0) {
      return {
        ...baseResult,
        skippedReason:
          "registered sponsor UTXOs are active; skipping split because wallet transfer coin selection cannot pin inputs",
      };
    }

    const maxFundedOutputs = Number(freeNightBalance / options.splitAmount);
    if (maxFundedOutputs <= 0) {
      return {
        ...baseResult,
        skippedReason: `insufficient free NIGHT for one split output; balance=${freeNightBalance.toString()}`,
      };
    }

    const outputsCreated = Math.min(
      options.maxOutputs,
      maxFundedOutputs,
      Math.max(0, options.targetFreeUtxos - freeNightUtxos.length),
    );
    if (outputsCreated === 0) return { ...baseResult, skippedReason: "no outputs needed" };

    const receiverAddress = await this.wallet.unshielded.getAddress();
    const outputs = Array.from({ length: outputsCreated }, () => ({
      type: nativeToken().raw,
      receiverAddress,
      amount: options.splitAmount,
    }));

    this.logger.info(
      `Splitting sponsor NIGHT pool | outputs=${outputsCreated} | splitAmount=${options.splitAmount.toString()} | freeBefore=${freeNightUtxos.length}`,
    );

    const recipe = await this.wallet.transferTransaction(
      [{ type: "unshielded", outputs }],
      {
        shieldedSecretKeys: this.zswapSecretKeys,
        dustSecretKey: this.dustSecretKey,
      },
      { ttl: ttlOneHour(), payFees: true },
    );
    const signedRecipe = await this.wallet.signRecipe(
      recipe,
      (payload: Uint8Array) => this.unshieldedKeystore.signData(payload),
    );
    const tx = await this.wallet.finalizeRecipe(signedRecipe);
    const txId = await this.wallet.submitTransaction(tx);
    this.logger.info(`Sponsor NIGHT pool split tx submitted: ${txId}`);

    return {
      ...baseResult,
      txId,
      outputsCreated,
    };
  }

  private isBalanceCheckOverspend(error: unknown): boolean {
    // The node error (Custom error: 138 / BalanceCheckOverspend) is wrapped by
    // FiberFailure → SubmissionError → RpcError. Walk the cause chain so we
    // detect it regardless of how many wrappers are present.
    let cur: unknown = error;
    for (let depth = 0; depth < 8 && cur != null; depth++) {
      const msg = typeof cur === 'object' && 'message' in cur
        ? String((cur as { message: unknown }).message)
        : String(cur);
      if (msg.includes('Custom error: 138') || msg.includes('BalanceCheckOverspend')) return true;
      cur = typeof cur === 'object' ? (cur as Record<string, unknown>).cause : undefined;
    }
    return false;
  }

  private async buildAndSubmitDeregister(
    reclaimable: Parameters<typeof this.wallet.deregisterFromDustGeneration>[0],
  ): Promise<string> {
    const recipe = await this.wallet.deregisterFromDustGeneration(
      reclaimable,
      this.unshieldedKeystore.getPublicKey(),
      (payload: Uint8Array) => this.unshieldedKeystore.signData(payload),
    );
    // deregisterFromDustGeneration returns an unbalanced recipe: the DUST fee
    // is declared but no DUST inputs are selected. Calling finalizeRecipe on it
    // directly causes error 138 (BalanceCheckOverspend). balanceUnprovenTransaction
    // with tokenKindsToBalance: ['dust'] selects actual DUST inputs from the
    // wallet's synced coin view before finalization.
    const balancedRecipe = await this.wallet.balanceUnprovenTransaction(
      recipe.transaction,
      { shieldedSecretKeys: this.zswapSecretKeys, dustSecretKey: this.dustSecretKey },
      { ttl: ttlOneHour(), tokenKindsToBalance: ['dust'] },
    );
    const transaction = await this.wallet.finalizeRecipe(balancedRecipe);
    return this.wallet.submitTransaction(transaction);
  }

  // Registers a fresh NIGHT UTXO for the backend's own DUST address and waits
  // for it to generate at least MINIMUM_RECLAIM_DUST. Returns true if DUST is
  // now available, false if we should defer to the next cycle.
  private async ensureFreshDustForReclaim(
    state: Awaited<ReturnType<typeof this.wallet.waitForSyncedState>>,
    idSet: Set<string>,
  ): Promise<boolean> {
    const freeNight = state.unshielded.availableCoins.filter(
      (c) => !c.meta.registeredForDustGeneration && c.utxo.type === nativeToken().raw,
    );
    if (freeNight.length === 0) {
      this.logger.warn(`No free NIGHT UTXOs to generate DUST for reclaim; deferring`);
      return false;
    }

    this.logger.info(`Generating fresh operating DUST before reclaim attempt`);
    const prevAvailableCount = state.dust.availableCoins.length;

    // Register a new NIGHT UTXO for the backend's own DUST address and wait
    // for it to generate at least MINIMUM_RECLAIM_DUST before proceeding.
    await this.generateDustFromUnshieldedNight();

    // Wait for a NEW DUST coin to appear in availableCoins (not just the
    // time-based balance to increase), then verify it has sufficient value.
    const freshState = await Rx.firstValueFrom(
      this.wallet.state().pipe(
        Rx.filter((s) => s.dust.availableCoins.length > prevAvailableCount),
        Rx.timeout({ first: 120_000 }),
      ),
    ).catch(async () => this.wallet.waitForSyncedState());

    const freshSpendable = this.spendableDust(freshState);
    this.logger.info(`Fresh DUST after generation: spendable=${freshSpendable.toString()} | newCoins=${freshState.dust.availableCoins.length - prevAvailableCount}`);

    if (freshSpendable < MINIMUM_RECLAIM_DUST) {
      this.logger.warn(`Fresh DUST (${freshSpendable.toString()}) still below minimum; deferring reclaim`);
      return false;
    }

    return true;
  }

  // Sum the generatedNow field across all available (unspent) DUST coins.
  // This is the actual spendable DUST — unlike dust.balance(new Date()) which
  // is a time-based projection that stays high even after all coins are spent.
  private spendableDust(state: Awaited<ReturnType<typeof this.wallet.waitForSyncedState>>): bigint {
    return state.dust.availableCoins.reduce((sum, c) => sum + c.generatedNow, 0n);
  }

  async reclaimDustForUtxoIds(utxoIds: readonly string[]): Promise<string | null> {
    const idSet = new Set(utxoIds);
    if (idSet.size === 0) return null;

    const state = await this.wallet.waitForSyncedState();
    const reclaimable = state.unshielded.availableCoins.filter(
      (coin) => coin.meta.registeredForDustGeneration && idSet.has(utxoId(coin)),
    );

    if (reclaimable.length === 0) {
      this.logger.info(`No reclaimable registered sponsor UTXOs found for ${Array.from(idSet).join(",")}`);
      return null;
    }

    const spendable = this.spendableDust(state);
    this.logger.info(`Reclaiming ${reclaimable.length} expired sponsor UTXO(s) | spendableDust=${spendable.toString()} | projectedDust=${state.dust.balance(new Date()).toString()}`);

    // If the wallet has no actually-spendable DUST coins, generate fresh ones
    // before attempting the deregistration TX (which pays its fee from DUST).
    if (spendable < MINIMUM_RECLAIM_DUST) {
      this.logger.info(`Spendable DUST (${spendable.toString()}) below minimum — generating fresh DUST before reclaim`);
      const canGenerate = await this.ensureFreshDustForReclaim(state, idSet);
      if (!canGenerate) return null;
      // Fall through: buildAndSubmitDeregister will use the fresh state.
    }

    try {
      const txId = await this.buildAndSubmitDeregister(reclaimable);
      this.logger.info(`Sponsor UTXO reclaim tx submitted: ${txId}`);
      return txId;
    } catch (firstError) {
      // Catch-all for error 138: the spendable-DUST pre-check above uses the
      // wallet's local view; the node may still reject if the wallet's coins are
      // stale (nullifiers not yet seen). Generate fresh DUST and retry once.
      if (!this.isBalanceCheckOverspend(firstError)) throw firstError;

      this.logger.warn(`Reclaim hit BalanceCheckOverspend (138) despite pre-check; refreshing DUST and retrying`);

      const canRetry = await this.ensureFreshDustForReclaim(state, idSet);
      if (!canRetry) return null;

      // canRetry means ensureFreshDustForReclaim already re-synced; retrieve the
      // fresh reclaimable set from inside that method via a second sync here.
      const freshState = await this.wallet.waitForSyncedState();
      const freshReclaimable = freshState.unshielded.availableCoins.filter(
        (coin) => coin.meta.registeredForDustGeneration && idSet.has(utxoId(coin)),
      );
      if (freshReclaimable.length === 0) {
        this.logger.warn(`Reclaimable UTXOs no longer visible after DUST refresh; will retry next cycle`);
        return null;
      }

      const txId = await this.buildAndSubmitDeregister(freshReclaimable);
      this.logger.info(`Sponsor UTXO reclaim tx submitted (retry): ${txId}`);
      return txId;
    }
  }

  async waitForReadyFunds(options: WaitForReadyFundsOptions = {}): Promise<void> {
    const generateOperatingDust = options.generateOperatingDust ?? true;
    const requireFunds = options.requireFunds ?? true;
    const timeoutMs = 3000 * 60_000;

    const syncPromise = Rx.firstValueFrom(
      this.wallet.state().pipe(
        Rx.throttleTime(5_000),
        Rx.tap((state) => {
          this.logger.info(
            `Wallet sync progress | synced=${state.isSynced} | shielded=${JSON.stringify(state.shielded.progress)} | unshielded=${JSON.stringify(state.unshielded.progress)} | dust=${JSON.stringify(state.dust.progress)}`,
          );
        }),
        Rx.filter((state) => state.isSynced),
      ),
    );

    const state = await Promise.race([
      syncPromise,
      new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                `Backend wallet did not sync within ${timeoutMs / 1000}s`,
              ),
            ),
          timeoutMs,
        ),
      ),
    ]);

    const dustBalance = state.dust.balance(new Date());
    const shieldedNight = state.shielded.balances[nativeToken().raw] ?? 0n;
    const unshieldedNight =
      state.unshielded.balances[unshieldedToken().raw] ?? 0n;

    this.logger.info(
      `Backend ${this.role} wallet synced | dust=${dustBalance.toString()} | shieldedNight=${shieldedNight.toString()} | unshieldedNight=${unshieldedNight.toString()}`,
    );

    if (generateOperatingDust && dustBalance === 0n && unshieldedNight > 0n) {
      const generatedDustBalance = await this.generateDustFromUnshieldedNight();

      if (generatedDustBalance === 0n) {
        throw new Error(
          "Backend wallet has NIGHT but could not generate dust yet. Wait for dust registration to sync, then restart.",
        );
      }

      return;
    }

    if (requireFunds && dustBalance === 0n && shieldedNight === 0n && unshieldedNight === 0n) {
      throw new Error(
        `Backend ${this.role} wallet has no funds. Fund this wallet before starting backend: ${this.getCoinPublicKey().toString()}`,
      );
    }
  }

  static async build(
    logger: Logger,
    env: EnvironmentConfiguration,
    seed: string,
    role: WalletRole,
  ): Promise<BackendWalletProvider> {
    const dustOptions: DustWalletOptions = {
      ledgerParams: LedgerParameters.initialParameters(),
      additionalFeeOverhead: 1_000n,
      feeBlocksMargin: 5,
    };

    const seeds = WalletSeeds.fromMasterSeed(seed);
    const keystore = createKeystore(seeds.unshielded, env.walletNetworkId);

    const config = {
      indexerClientConnection: {
        indexerHttpUrl: env.indexer,
        indexerWsUrl: env.indexerWS,
      },
      provingServerUrl: new URL(env.proofServer),
      networkId: env.walletNetworkId,
      relayURL: new URL(env.nodeWS),
      txHistoryStorage: new NoOpTransactionHistoryStorage(),
      costParameters: {
        additionalFeeOverhead: dustOptions.additionalFeeOverhead,
        feeBlocksMargin: dustOptions.feeBlocksMargin,
      },
    } satisfies DefaultConfiguration;

    const dustConfig = {
      ...config,
      costParameters: {
        ledgerParams: dustOptions.ledgerParams,
        additionalFeeOverhead: dustOptions.additionalFeeOverhead,
        feeBlocksMargin: dustOptions.feeBlocksMargin,
      },
    };

    const cache = readWalletStateCache(logger, env.walletNetworkId, role);

    const shieldedWallet = cache
      ? ShieldedWallet(config).restore(cache.shielded)
      : ShieldedWallet(config).startWithSeed(seeds.shielded);

    const unshieldedWallet = cache
      ? UnshieldedWallet(config).restore(cache.unshielded)
      : UnshieldedWallet(config).startWithPublicKey(
          PublicKey.fromKeyStore(keystore),
        );

    logger.info(
      {
        networkId: env.walletNetworkId,
        feeBlocksMargin: dustOptions.feeBlocksMargin,
        additionalFeeOverhead: dustOptions.additionalFeeOverhead.toString(),
        role,
      },
      "Creating backend wallet",
    );

    const dustWallet = cache
      ? DustWallet(dustConfig).restore(cache.dust)
      : DustWallet(dustConfig).startWithSeed(
          seeds.dust,
          dustOptions.ledgerParams.dust,
        );

    const wallet = await WalletFacade.init({
      configuration: config,
      shielded: () => shieldedWallet,
      unshielded: () => unshieldedWallet,
      dust: () => dustWallet,
    });

    const initialState = await getInitialShieldedState(wallet.shielded);
    logger.info(
      `Backend ${role} wallet address: ${initialState.address.coinPublicKeyString()}`,
    );

    return new BackendWalletProvider(
      logger,
      env,
      wallet,
      ZswapSecretKeys.fromSeed(seeds.shielded),
      DustSecretKey.fromSeed(seeds.dust),
      keystore,
      seeds.masterSeed,
      role,
    );
  }
}
