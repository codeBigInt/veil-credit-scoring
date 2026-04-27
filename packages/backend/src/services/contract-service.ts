import { type CompiledContract, type Contract as CompactContract } from '@midnight-ntwrk/compact-js';
import { fromHex } from '@midnight-ntwrk/compact-runtime';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import type { EnvironmentConfiguration } from '@midnight-ntwrk/testkit-js';
import { DynamicContractAPI, type DynamicProviders, utils } from 'nite-api';
import type { Logger } from 'pino';
import type { Db } from 'mongodb';
import {
  Contract as VeilContractClass,
  createVeilPrivateState,
  witness,
  type Witnesses as VeilWitnesses,
  type VeilPrivateState,
} from '../contract-build/index.js';

import type { BackendConfig } from '../config.js';
import { BackendWalletProvider } from './wallet-service.js';
import { MongoPrivateStateProvider } from './mongo-private-state-provider.js';

type VeilContract = VeilContractClass<VeilPrivateState, VeilWitnesses<VeilPrivateState>>;
type VeilAPI = DynamicContractAPI<VeilContract, 'veil_ps'>;

export type ContractCallResult = {
  readonly circuit: string;
  readonly txHash?: string;
  readonly contractAddress: string;
  readonly raw: unknown;
};

export class ContractService {
  private api?: VeilAPI;

  private constructor(
    private readonly config: BackendConfig,
    private readonly env: EnvironmentConfiguration,
    private readonly db: Db,
    private readonly logger: Logger,
    private readonly walletProvider: BackendWalletProvider,
  ) {}

  static async build(
    config: BackendConfig,
    env: EnvironmentConfiguration,
    db: Db,
    logger: Logger,
  ): Promise<ContractService> {
    const walletProvider = await BackendWalletProvider.build(logger, env, config.walletSeed);
    await walletProvider.start();
    await walletProvider.wallet.waitForSyncedState();

    const service = new ContractService(config, env, db, logger, walletProvider);
    await service.join();
    return service;
  }

  async stop(): Promise<void> {
    await this.walletProvider.stop();
  }

  async createScoreEntry(userPk: Uint8Array): Promise<ContractCallResult> {
    return this.call('Scoring_createScoreEntry', userPk);
  }

  async verifyPoTNFT(input: {
    issuerPk: Uint8Array;
    userPk: Uint8Array;
    challenge: Uint8Array;
    challengeExpiresAt: bigint;
    ownershipSecret: Uint8Array;
  }): Promise<ContractCallResult> {
    return this.call(
      'NFT_verifyPoTNFT',
      input.issuerPk,
      input.userPk,
      input.challenge,
      input.challengeExpiresAt,
      input.ownershipSecret,
    );
  }

  async submitRepaymentEvent(input: {
    userPk: Uint8Array;
    issuerPk: Uint8Array;
    paidOnTimeFlag: bigint;
    amountWeight: bigint;
    eventEpoch: bigint;
    eventId: Uint8Array;
  }): Promise<ContractCallResult> {
    return this.call(
      'Scoring_submitRepaymentEvent',
      input.userPk,
      input.issuerPk,
      input.paidOnTimeFlag,
      input.amountWeight,
      input.eventEpoch,
      input.eventId,
    );
  }

  async submitLiquidationEvent(input: {
    userPk: Uint8Array;
    issuerPk: Uint8Array;
    severity: bigint;
    eventEpoch: bigint;
    eventId: Uint8Array;
  }): Promise<ContractCallResult> {
    return this.call(
      'Scoring_submitLiquidationEvent',
      input.userPk,
      input.issuerPk,
      input.severity,
      input.eventEpoch,
      input.eventId,
    );
  }

  async submitProtocolUsageEvent(input: {
    userPk: Uint8Array;
    issuerPk: Uint8Array;
    protocolId: Uint8Array;
    eventEpoch: bigint;
  }): Promise<ContractCallResult> {
    return this.call(
      'Scoring_submitProtocolUsageEvent',
      input.userPk,
      input.issuerPk,
      input.protocolId,
      input.eventEpoch,
    );
  }

  async submitDebtStateEvent(input: {
    userPk: Uint8Array;
    issuerPk: Uint8Array;
    activeDebtFlag: bigint;
    riskBand: bigint;
    eventEpoch: bigint;
    eventId: Uint8Array;
  }): Promise<ContractCallResult> {
    return this.call(
      'Scoring_submitDebtStateEvent',
      input.userPk,
      input.issuerPk,
      input.activeDebtFlag,
      input.riskBand,
      input.eventEpoch,
      input.eventId,
    );
  }

  private async join(): Promise<void> {
    const compiledContract = this.compiledContract();
    const providers = await this.providers();

    this.api = await DynamicContractAPI.join<VeilContract, 'veil_ps'>({
      providers,
      compiledContract,
      contractAddress: this.config.contractAddress,
      privateStateId: this.config.privateStateId,
      initialPrivateState: createVeilPrivateState(fromHex(this.config.walletSeed)),
      logger: this.logger,
    });
  }

  private async providers(): Promise<DynamicProviders<VeilContract, 'veil_ps'>> {
    const zkConfigProvider = new NodeZkConfigProvider<CompactContract.ProvableCircuitId<VeilContract>>(
      this.config.zkConfigPath,
    );
    const accountId = (await this.walletProvider.wallet.unshielded.getAddress()).hexString;
    const privateStateProvider = new MongoPrivateStateProvider<'veil_ps', VeilPrivateState>({
      db: this.db,
      accountId,
      privateStateCollectionName: 'veil_private_states',
      signingKeyCollectionName: 'veil_signing_keys',
    });
    await privateStateProvider.init();

    return {
      privateStateProvider,
      publicDataProvider: indexerPublicDataProvider(this.env.indexer, this.env.indexerWS),
      zkConfigProvider,
      proofProvider: httpClientProofProvider(this.env.proofServer, zkConfigProvider),
      walletProvider: this.walletProvider,
      midnightProvider: this.walletProvider,
    };
  }

  private compiledContract(): CompiledContract.CompiledContract<any, any> {
    return utils.createCompiledContract<VeilContract>(
      'veil-protocol',
      VeilContractClass,
      witness as any,
      this.config.zkConfigPath,
    ) as CompiledContract.CompiledContract<any, any>;
  }

  private async call(circuit: string, ...args: unknown[]): Promise<ContractCallResult> {
    if (!this.api) {
      throw new Error('Contract service has not joined the deployed contract yet.');
    }

    this.logger.info({ circuit }, 'Submitting contract transaction');
    const raw = await this.api.callTx(circuit as never, ...(args as never[]));
    return {
      circuit,
      contractAddress: this.api.deployedContractAddress,
      txHash: extractTxHash(raw),
      raw,
    };
  }
}

const extractTxHash = (raw: unknown): string | undefined => {
  if (!raw || typeof raw !== 'object') return undefined;
  const record = raw as Record<string, unknown>;
  const direct = record.txHash;
  if (typeof direct === 'string') return direct;
  const publicData = record.public;
  if (publicData && typeof publicData === 'object') {
    const publicTxHash = (publicData as Record<string, unknown>).txHash;
    if (typeof publicTxHash === 'string') return publicTxHash;
  }
  return undefined;
};
