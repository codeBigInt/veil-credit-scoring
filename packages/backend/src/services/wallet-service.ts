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

type SponsorDustOptions = {
  requiredDust?: bigint;
  waitTimeoutMs?: number;
};

type WaitForReadyFundsOptions = {
  generateOperatingDust?: boolean;
  requireFunds?: boolean;
};

const utxoId = (coin: { utxo: { intentHash: string; outputNo: number } }): string =>
  `${coin.utxo.intentHash}#${coin.utxo.outputNo}`;

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
      (coin) => !coin.meta.registeredForDustGeneration,
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
      return {
        txId,
        selectedUtxos: selected.length,
        utxoIds: selected.map(utxoId),
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

    this.logger.info(`Reclaiming ${reclaimable.length} expired sponsor UTXO(s)`);
    const recipe = await this.wallet.deregisterFromDustGeneration(
      reclaimable,
      this.unshieldedKeystore.getPublicKey(),
      (payload: Uint8Array) => this.unshieldedKeystore.signData(payload),
    );
    const transaction = await this.wallet.finalizeRecipe(recipe);
    const txId = await this.wallet.submitTransaction(transaction);
    this.logger.info(`Sponsor UTXO reclaim tx submitted: ${txId}`);
    return txId;
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
