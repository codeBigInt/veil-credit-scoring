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
} from "@midnight-ntwrk/wallet-sdk-facade";
import {
  ShieldedWallet,
  type ShieldedWalletAPI,
  type ShieldedWalletState,
} from "@midnight-ntwrk/wallet-sdk-shielded";
import { DustWallet } from "@midnight-ntwrk/wallet-sdk-dust-wallet";
import {
  InMemoryTransactionHistoryStorage,
  PublicKey,
  UnshieldedWallet,
  createKeystore,
  type UnshieldedKeystore,
} from "@midnight-ntwrk/wallet-sdk-unshielded-wallet";
import type { EnvironmentConfiguration } from "@midnight-ntwrk/testkit-js";
import {
  WalletSeeds,
  type DustWalletOptions,
} from "@midnight-ntwrk/testkit-js";
import type { Logger } from "pino";
import * as Rx from "rxjs";

const getInitialShieldedState = async (
  wallet: ShieldedWalletAPI,
): Promise<ShieldedWalletState> => Rx.firstValueFrom(wallet.state);

type WalletStateCache = {
  savedAt: string;
  shielded: string;
  unshielded: string;
  dust: string;
};

const getWalletStateCachePath = (): string =>
  path.resolve(process.cwd(), ".wallet-cache", "backend-wallet-state.json");

const readWalletStateCache = (logger: Logger): WalletStateCache | undefined => {
  const cachePath = getWalletStateCachePath();

  if (!fs.existsSync(cachePath)) return undefined;

  try {
    const cache = JSON.parse(
      fs.readFileSync(cachePath, "utf8"),
    ) as WalletStateCache;

    logger.info(`Loaded backend wallet state cache: ${cachePath}`);
    return cache;
  } catch (error) {
    logger.warn(
      { error },
      "Failed to load backend wallet state cache; starting from seed",
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
  ) {}

  private cacheTimer?: NodeJS.Timeout;

  private async saveWalletStateCache(): Promise<void> {
    const cachePath = getWalletStateCachePath();

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
          shielded,
          unshielded,
          dust,
        },
        null,
        2,
      ),
    );

    this.logger.info(`Saved backend wallet state cache: ${cachePath}`);
  }

  startWalletStateCache(): void {
    this.cacheTimer = setInterval(() => {
      this.saveWalletStateCache().catch((error) => {
        this.logger.warn(
          { error },
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
        { error },
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

    this.logger.info(`Generating dust from ${utxos.length} NIGHT UTXO(s)`);

    const recipe = await this.wallet.registerNightUtxosForDustGeneration(
      utxos,
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

  async waitForReadyFunds(): Promise<void> {
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
      `Backend wallet synced | dust=${dustBalance.toString()} | shieldedNight=${shieldedNight.toString()} | unshieldedNight=${unshieldedNight.toString()}`,
    );

    if (dustBalance === 0n && unshieldedNight > 0n) {
      const generatedDustBalance = await this.generateDustFromUnshieldedNight();

      if (generatedDustBalance === 0n) {
        throw new Error(
          "Backend wallet has NIGHT but could not generate dust yet. Wait for dust registration to sync, then restart.",
        );
      }

      return;
    }

    if (dustBalance === 0n && shieldedNight === 0n && unshieldedNight === 0n) {
      throw new Error(
        `Backend wallet has no funds. Fund this wallet before starting backend: ${this.getCoinPublicKey().toString()}`,
      );
    }
  }

  static async build(
    logger: Logger,
    env: EnvironmentConfiguration,
    seed: string,
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
      txHistoryStorage: new InMemoryTransactionHistoryStorage(),
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

    const cache = readWalletStateCache(logger);

    const shieldedWallet = cache
      ? ShieldedWallet(config).restore(cache.shielded)
      : ShieldedWallet(config).startWithSeed(seeds.shielded);

    const unshieldedWallet = cache
      ? UnshieldedWallet(config).restore(cache.unshielded)
      : UnshieldedWallet(config).startWithPublicKey(
          PublicKey.fromKeyStore(keystore),
        );

    logger.info(
      `Creating dust wallet with params: ${JSON.stringify(dustConfig)}`,
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
      `Backend wallet address: ${initialState.address.coinPublicKeyString()}`,
    );

    return new BackendWalletProvider(
      logger,
      env,
      wallet,
      ZswapSecretKeys.fromSeed(seeds.shielded),
      DustSecretKey.fromSeed(seeds.dust),
      keystore,
      seeds.masterSeed,
    );
  }
}
