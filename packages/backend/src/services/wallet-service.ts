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
import type { MidnightProvider, UnboundTransaction, WalletProvider } from '@midnight-ntwrk/midnight-js-types';
import { ttlOneHour } from '@midnight-ntwrk/midnight-js-utils';
import type { WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import type { ShieldedWalletAPI, ShieldedWalletState } from '@midnight-ntwrk/wallet-sdk-shielded';
import type { EnvironmentConfiguration } from '@midnight-ntwrk/testkit-js';
import { FluentWalletBuilder, type DustWalletOptions } from '@midnight-ntwrk/testkit-js';
import type { Logger } from 'pino';
import * as Rx from 'rxjs';

type UnshieldedKeystore = {
  getPublicKey(): unknown;
  signData(payload: Uint8Array): string;
};

const getInitialShieldedState = async (wallet: ShieldedWalletAPI): Promise<ShieldedWalletState> =>
  Rx.firstValueFrom(wallet.state);

type TokenKind = 'shielded' | 'unshielded' | 'dust';
type TokenKindsToBalance = 'all' | TokenKind[];

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

  getCoinPublicKey(): CoinPublicKey {
    return this.zswapSecretKeys.coinPublicKey;
  }

  getEncryptionPublicKey(): EncPublicKey {
    return this.zswapSecretKeys.encryptionPublicKey;
  }

  async balanceTx(tx: UnboundTransaction, ttl: Date = ttlOneHour()): Promise<FinalizedTransaction> {
    const secretKeys = { shieldedSecretKeys: this.zswapSecretKeys, dustSecretKey: this.dustSecretKey };
    await this.logFeeLiquidity('Before balanceTx');
    const tokenKindsToBalance = this.tokenKindsToBalanceOverride ?? 'all';
    const recipe = await this.wallet.balanceUnboundTransaction(tx, secretKeys, { ttl, tokenKindsToBalance });
    const signedRecipe = await this.wallet.signRecipe(recipe, (payload: Uint8Array) =>
      this.unshieldedKeystore.signData(payload),
    );
    return this.wallet.finalizeRecipe(signedRecipe);
  }

  submitTx(tx: FinalizedTransaction): Promise<string> {
    return this.wallet.submitTransaction(tx);
  }

  withTokenKindsToBalance<T>(tokenKindsToBalance: TokenKindsToBalance, fn: () => Promise<T>): Promise<T> {
    const previous = this.tokenKindsToBalanceOverride;
    this.tokenKindsToBalanceOverride = tokenKindsToBalance;
    return fn().finally(() => {
      this.tokenKindsToBalanceOverride = previous;
    });
  }

  async start(): Promise<void> {
    this.logger.info('Starting backend wallet');
    await this.wallet.start(this.zswapSecretKeys, this.dustSecretKey);
  }

  async stop(): Promise<void> {
    await this.wallet.stop();
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

  static async build(logger: Logger, env: EnvironmentConfiguration, seed: string): Promise<BackendWalletProvider> {
    const dustOptions: DustWalletOptions = {
      ledgerParams: LedgerParameters.initialParameters(),
      additionalFeeOverhead: 1_000n,
      feeBlocksMargin: 5,
    };

    const buildResult = (await FluentWalletBuilder.forEnvironment(env)
      .withDustOptions(dustOptions)
      .withSeed(seed)
      .buildWithoutStarting()) as unknown as {
      wallet: WalletFacade;
      seeds: { masterSeed: string; shielded: Uint8Array; dust: Uint8Array };
      keystore: UnshieldedKeystore;
    };

    const initialState = await getInitialShieldedState(buildResult.wallet.shielded);
    logger.info(`Backend wallet address: ${initialState.address.coinPublicKeyString()}`);

    return new BackendWalletProvider(
      logger,
      env,
      buildResult.wallet,
      ZswapSecretKeys.fromSeed(buildResult.seeds.shielded),
      DustSecretKey.fromSeed(buildResult.seeds.dust),
      buildResult.keystore,
      buildResult.seeds.masterSeed,
    );
  }
}
