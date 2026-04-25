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
import { type WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import type { Logger } from 'pino';
import { type DustWalletOptions, type EnvironmentConfiguration, FluentWalletBuilder } from '@midnight-ntwrk/testkit-js';

import { getInitialShieldedState } from './wallet-utils.js';

type UnshieldedKeystore = {
  getPublicKey(): unknown;
  signData(payload: Uint8Array): string;
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

  async stop(): Promise<void> {
    return this.wallet.stop();
  }

  static async build(logger: Logger, env: EnvironmentConfiguration, seed?: string): Promise<MidnightWalletProvider> {
    const dustOptions: DustWalletOptions = {
      ledgerParams: LedgerParameters.initialParameters(),
      additionalFeeOverhead: env.walletNetworkId === 'undeployed' ? 500_000_000_000_000_000n : 1_000n,
      feeBlocksMargin: 5,
    };

    const builder = FluentWalletBuilder.forEnvironment(env).withDustOptions(dustOptions);
    const buildResult = seed
      ? await builder.withSeed(seed).buildWithoutStarting()
      : await builder.withRandomSeed().buildWithoutStarting();

    const { wallet, seeds, keystore } = buildResult as unknown as {
      wallet: WalletFacade;
      seeds: { masterSeed: string; shielded: Uint8Array; dust: Uint8Array };
      keystore: UnshieldedKeystore;
    };

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
