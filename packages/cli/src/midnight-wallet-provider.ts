import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import {
  type CoinPublicKey,
  DustSecretKey,
  type EncPublicKey,
  type FinalizedTransaction,
  LedgerParameters,
  nativeToken,
  unshieldedToken,
  ZswapSecretKeys,
} from '@midnight-ntwrk/ledger-v8';
import { type MidnightProvider, type UnboundTransaction, type WalletProvider } from '@midnight-ntwrk/midnight-js-types';
import { ttlOneHour } from '@midnight-ntwrk/midnight-js-utils';
import {
  WalletFacade,
  WalletEntrySchema,
  type DefaultConfiguration,
} from '@midnightntwrk/wallet-sdk-facade';
import { ShieldedWallet } from '@midnightntwrk/wallet-sdk-shielded';
import { DustWallet } from '@midnightntwrk/wallet-sdk-dust-wallet';
import {
  PublicKey,
  UnshieldedWallet,
  createKeystore,
} from '@midnightntwrk/wallet-sdk-unshielded-wallet';
import { InMemoryTransactionHistoryStorage } from '@midnightntwrk/wallet-sdk-abstractions';
import type { Logger } from 'pino';
import { WalletSeeds, type DustWalletOptions, type EnvironmentConfiguration } from '@midnight-ntwrk/testkit-js';

import { getInitialShieldedState } from './wallet-utils.js';

type UnshieldedKeystore = {
  getPublicKey(): unknown;
  signData(payload: Uint8Array): string;
};

type WalletStateCache = {
  savedAt: string;
  networkId: string;
  shielded: string;
  unshielded: string;
  dust: string;
};

const safeCacheSegment = (value: string): string =>
  value.replace(/[^a-zA-Z0-9._-]/g, '_');

const getWalletStateCachePath = (networkId: string): string =>
  path.resolve(
    process.cwd(),
    '.wallet-cache',
    `cli-wallet-state-${safeCacheSegment(networkId)}.json`,
  );

const readWalletStateCache = (logger: Logger, networkId: string): WalletStateCache | undefined => {
  const cachePath = getWalletStateCachePath(networkId);
  if (!fs.existsSync(cachePath)) return undefined;

  try {
    const cache = JSON.parse(fs.readFileSync(cachePath, 'utf8')) as Partial<WalletStateCache>;
    if (cache.networkId !== networkId) {
      logger.warn(
        `Ignoring CLI wallet state cache for ${cache.networkId ?? 'unknown'}; active network is ${networkId}`,
      );
      return undefined;
    }

    if (
      typeof cache.shielded !== 'string' ||
      typeof cache.unshielded !== 'string' ||
      typeof cache.dust !== 'string'
    ) {
      logger.warn('Ignoring incomplete CLI wallet state cache');
      return undefined;
    }

    logger.info(`Loaded CLI wallet state cache: ${cachePath}`);
    return cache as WalletStateCache;
  } catch (error) {
    logger.warn({ error }, 'Failed to load CLI wallet state cache; starting from seed');
    return undefined;
  }
};

type TokenKind = 'shielded' | 'unshielded' | 'dust';
type TokenKindsToBalance = 'all' | TokenKind[];

export class MidnightWalletProvider implements MidnightProvider, WalletProvider {
  readonly logger: Logger;
  readonly env: EnvironmentConfiguration;
  readonly wallet: WalletFacade;
  readonly unshieldedKeystore: UnshieldedKeystore;
  readonly zswapSecretKeys: ZswapSecretKeys;
  readonly dustSecretKey: DustSecretKey;
  private tokenKindsToBalanceOverride?: TokenKindsToBalance;
  private cacheTimer?: NodeJS.Timeout;

  private constructor(
    logger: Logger,
    environmentConfiguration: EnvironmentConfiguration,
    wallet: WalletFacade,
    zswapSecretKeys: ZswapSecretKeys,
    dustSecretKey: DustSecretKey,
    unshieldedKeystore: UnshieldedKeystore,
  ) {
    this.logger = logger;
    this.env = environmentConfiguration;
    this.wallet = wallet;
    this.zswapSecretKeys = zswapSecretKeys;
    this.dustSecretKey = dustSecretKey;
    this.unshieldedKeystore = unshieldedKeystore;
  }

  getCoinPublicKey(): CoinPublicKey {
    return this.zswapSecretKeys.coinPublicKey;
  }

  getEncryptionPublicKey(): EncPublicKey {
    return this.zswapSecretKeys.encryptionPublicKey;
  }

  private async logFeeLiquidity(context: string): Promise<void> {
    const state = await this.wallet.waitForSyncedState();
    const dustBalance = state.dust.balance(new Date());
    const shieldedNight = state.shielded.balances[nativeToken().raw] ?? 0n;
    const unshieldedNight = state.unshielded.balances[unshieldedToken().raw] ?? 0n;

    this.logger.info(
      `${context} fee liquidity | dust=${dustBalance.toString()} | shieldedNight=${shieldedNight.toString()} | unshieldedNight=${unshieldedNight.toString()}`,
    );
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

  async balanceTx(tx: UnboundTransaction, ttl: Date = ttlOneHour()): Promise<FinalizedTransaction> {
    const secretKeys = { shieldedSecretKeys: this.zswapSecretKeys, dustSecretKey: this.dustSecretKey };
    await this.logFeeLiquidity('Before balanceTx');
    const tokenKindsToBalance = this.tokenKindsToBalanceOverride ?? 'all';
    try {
      const recipe = await this.wallet.balanceUnboundTransaction(tx, secretKeys, { ttl, tokenKindsToBalance });
      const signedRecipe = await this.wallet.signRecipe(recipe, (payload: Uint8Array) => this.unshieldedKeystore.signData(payload));
      return this.wallet.finalizeRecipe(signedRecipe);
    } catch (error) {
      const maybeError = error as { tokenType?: unknown; amount?: unknown; message?: unknown };
      this.logger.error(
        {
          tokenKindsToBalance,
          tokenType: maybeError?.tokenType,
          amount: maybeError?.amount,
          message: maybeError?.message,
        },
        'balanceTx failed',
      );
      throw error;
    }
  }

  submitTx(tx: FinalizedTransaction): Promise<string> {
    return this.wallet.submitTransaction(tx);
  }

  async start(): Promise<void> {
    this.logger.info('Starting wallet...');
    await this.wallet.start(this.zswapSecretKeys, this.dustSecretKey);
  }

  private async saveWalletStateCache(): Promise<void> {
    const cachePath = getWalletStateCachePath(this.env.walletNetworkId);
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
          shielded,
          unshielded,
          dust,
        },
        null,
        2,
      ),
    );

    this.logger.info(`Saved CLI wallet state cache: ${cachePath}`);
  }

  startWalletStateCache(): void {
    this.cacheTimer = setInterval(() => {
      this.saveWalletStateCache().catch((error) => {
        this.logger.warn({ error }, 'Failed to save CLI wallet state cache');
      });
    }, 30_000);
  }

  async stop(): Promise<void> {
    if (this.cacheTimer) clearInterval(this.cacheTimer);
    await this.saveWalletStateCache().catch((error) => {
      this.logger.warn({ error }, 'Failed to save CLI wallet state cache during shutdown');
    });
    return this.wallet.stop();
  }

  static async build(logger: Logger, env: EnvironmentConfiguration, seed?: string): Promise<MidnightWalletProvider> {
    const dustOptions: DustWalletOptions = {
      ledgerParams: LedgerParameters.initialParameters(),
      additionalFeeOverhead: env.walletNetworkId === 'undeployed' ? 500_000_000_000_000_000n : 1_000n,
      feeBlocksMargin: 5,
    };

    const seeds = WalletSeeds.fromMasterSeed(seed ?? Buffer.from(randomBytes(32)).toString('hex'));
    const keystore = createKeystore(seeds.unshielded, env.walletNetworkId);
    const config = {
      indexerClientConnection: {
        indexerHttpUrl: env.indexer,
        indexerWsUrl: env.indexerWS,
      },
      provingServerUrl: new URL(env.proofServer),
      networkId: env.walletNetworkId,
      relayURL: new URL(env.nodeWS),
      txHistoryStorage: new InMemoryTransactionHistoryStorage(WalletEntrySchema),
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

    const cache = seed ? readWalletStateCache(logger, env.walletNetworkId) : undefined;
    const shieldedWallet = cache
      ? ShieldedWallet(config).restore(cache.shielded)
      : ShieldedWallet(config).startWithSeed(seeds.shielded);
    const unshieldedWallet = cache
      ? UnshieldedWallet(config).restore(cache.unshielded)
      : UnshieldedWallet(config).startWithPublicKey(PublicKey.fromKeyStore(keystore));
    const dustWallet = cache
      ? DustWallet(dustConfig).restore(cache.dust)
      : DustWallet(dustConfig).startWithSeed(seeds.dust, dustOptions.ledgerParams.dust);

    const wallet = await WalletFacade.init({
      configuration: config,
      shielded: () => shieldedWallet,
      unshielded: () => unshieldedWallet,
      dust: () => dustWallet,
    });

    const initialState = await getInitialShieldedState(logger, wallet.shielded);
    logger.info(`Wallet seed: ${seeds.masterSeed} | address: ${initialState.address.coinPublicKeyString()}`);

    return new MidnightWalletProvider(
      logger,
      env,
      wallet,
      ZswapSecretKeys.fromSeed(seeds.shielded),
      DustSecretKey.fromSeed(seeds.dust),
      keystore,
    );
  }
}
