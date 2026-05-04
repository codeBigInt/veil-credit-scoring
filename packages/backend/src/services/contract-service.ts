import { randomBytes as nodeRandomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  type CompiledContract,
  type Contract as CompactContract,
} from "@midnight-ntwrk/compact-js";
import { encodeContractAddress, fromHex } from "@midnight-ntwrk/compact-runtime";
import { createCircuitMaintenanceTxInterface } from "@midnight-ntwrk/midnight-js-contracts";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { NodeZkConfigProvider } from "@midnight-ntwrk/midnight-js-node-zk-config-provider";
import { httpClientProofProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import type { EnvironmentConfiguration } from "@midnight-ntwrk/testkit-js";
import { DynamicContractAPI, type DynamicProviders, utils } from "nite-api";
import type { Logger } from "pino";
import type { Db } from "mongodb";
import {
  Contract as VeilContractClass,
  createVeilPrivateState,
  witness,
  type Witnesses as VeilWitnesses,
  type VeilPrivateState,
} from "../contract-build/index.js";
import {
  Contract as VeilBootstrapContractClass,
  type Witnesses as VeilBootstrapWitnesses,
} from "../contract-build/managed/veil-protocol-bootstrap/contract/index.js";

import type { BackendConfig } from "../config.js";
import { BackendWalletProvider } from "./wallet-service.js";
import { MongoPrivateStateProvider } from "./mongo-private-state-provider.js";

type VeilContract = VeilContractClass<
  VeilPrivateState,
  VeilWitnesses<VeilPrivateState>
>;
type VeilAPI = DynamicContractAPI<VeilContract, "veil_ps">;
type VeilBootstrapContract = VeilBootstrapContractClass<
  VeilPrivateState,
  VeilBootstrapWitnesses<VeilPrivateState>
>;

const FULL_CONTRACT_CIRCUITS = [
  "Utils_generateUserPk",
  "Utils_initializeContractConfigurations",
  "NFT_verifyPoTNFT",
  "NFT_mintPoTNFT",
  "NFT_renewPoTNFT",
  "Scoring_submitRepaymentEvent",
  "Scoring_submitLiquidationEvent",
  "Scoring_submitProtocolUsageEvent",
  "Scoring_submitDebtStateEvent",
  "Scoring_createScoreEntry",
  "Admin_addIssuer",
  "Admin_removeIssuer",
  "Admin_updateTokenUris",
  "Admin_addAdmin",
  "Admin_removeAdmin",
  "Admin_updatedProtocolConfig",
  "Admin_updatedScoreConfig",
] as const;

const BOOTSTRAP_CONTRACT_CIRCUITS = [
  "Utils_generateUserPk",
  "Utils_initializeContractConfigurations",
  "Admin_addIssuer",
] as const;

const randomBytes32 = (): Uint8Array => new Uint8Array(nodeRandomBytes(32));

export type ContractCallResult = {
  readonly circuit: string;
  readonly txHash?: string;
  readonly contractAddress: string;
  readonly circuitResult?: unknown;
  readonly raw: unknown;
};

export type StagedDeploymentResult = {
  readonly contractAddress: string;
  readonly installedCircuits: readonly string[];
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
    const walletProvider = await BackendWalletProvider.build(
      logger,
      env,
      config.walletSeed,
    );
    await walletProvider.start();
    walletProvider.startWalletStateCache();
    await walletProvider.waitForReadyFunds();

    const service = new ContractService(
      config,
      env,
      db,
      logger,
      walletProvider,
    );
    if (config.contractAddress) {
      await service.join(config.contractAddress);
    } else {
      logger.warn(
        "VEIL_CONTRACT_ADDRESS is not set; backend will start without joining a contract. Use the deployment endpoint first.",
      );
    }
    return service;
  }

  async stop(): Promise<void> {
    await this.walletProvider.stop();
  }

  getContractAddress(): string | undefined {
    return this.api?.deployedContractAddress ?? this.config.contractAddress;
  }

  async createScoreEntry(userPk: Uint8Array): Promise<ContractCallResult> {
    return this.call("Scoring_createScoreEntry", userPk);
  }

  async addIssuer(input: {
    protocolName: string;
    contractAddress: string;
  }): Promise<ContractCallResult> {
    return this.call("Admin_addIssuer", input.protocolName, {
      bytes: encodeContractAddress(input.contractAddress),
    });
  }

  async deployStagedContract(input?: {
    nonce?: Uint8Array;
    currentTime?: bigint;
  }): Promise<StagedDeploymentResult> {
    await this.assertZkArtifacts(
      this.config.bootstrapZkConfigPath,
      BOOTSTRAP_CONTRACT_CIRCUITS,
      "bootstrap contract",
    );
    await this.assertZkArtifacts(
      this.config.zkConfigPath,
      FULL_CONTRACT_CIRCUITS,
      "full contract",
    );

    const bootstrapProviders = await this.providers(
      this.config.bootstrapZkConfigPath,
    );
    const fullProviders = await this.providers(this.config.zkConfigPath);
    const fullCompiledContract = this.compiledContract();

    const bootstrapApi = await DynamicContractAPI.deploy<
      VeilBootstrapContract,
      "veil_ps"
    >({
      providers: bootstrapProviders as any,
      compiledContract: this.bootstrapCompiledContract(),
      privateStateId: this.config.privateStateId,
      initialPrivateState: createVeilPrivateState(fromHex(this.config.walletSeed)),
      args: [input?.nonce ?? randomBytes32(), input?.currentTime ?? BigInt(Date.now())],
      logger: this.logger,
    });

    const contractAddress = bootstrapApi.deployedContractAddress;
    this.logger.info(
      { contractAddress },
      "Bootstrap contract deployed; installing full verifier keys",
    );

    const installedCircuits = await this.installFullContractVerifierKeys(
      fullProviders,
      fullCompiledContract,
      contractAddress,
    );

    this.api = await DynamicContractAPI.join<VeilContract, "veil_ps">({
      providers: fullProviders,
      compiledContract: fullCompiledContract,
      contractAddress,
      privateStateId: this.config.privateStateId,
      logger: this.logger,
    });

    this.logger.info({ contractAddress }, "Staged contract deployment complete");

    return {
      contractAddress,
      installedCircuits,
    };
  }

  async verifyPoTNFT(input: {
    issuerPk: Uint8Array;
    userPk: Uint8Array;
    challenge: Uint8Array;
    challengeExpiresAt: bigint;
    ownershipSecret: Uint8Array;
  }): Promise<ContractCallResult> {
    return this.call(
      "NFT_verifyPoTNFT",
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
      "Scoring_submitRepaymentEvent",
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
      "Scoring_submitLiquidationEvent",
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
      "Scoring_submitProtocolUsageEvent",
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
      "Scoring_submitDebtStateEvent",
      input.userPk,
      input.issuerPk,
      input.activeDebtFlag,
      input.riskBand,
      input.eventEpoch,
      input.eventId,
    );
  }

  private async join(contractAddress: string): Promise<void> {
    const compiledContract = this.compiledContract();
    const providers = await this.providers();

    this.api = await DynamicContractAPI.join<VeilContract, "veil_ps">({
      providers,
      compiledContract,
      contractAddress,
      privateStateId: this.config.privateStateId,
      initialPrivateState: createVeilPrivateState(
        fromHex(this.config.walletSeed),
      ),
      logger: this.logger,
    });
  }

  private async providers(
    zkConfigPath = this.config.zkConfigPath,
  ): Promise<
    DynamicProviders<VeilContract, "veil_ps">
  > {
    const zkConfigProvider = new NodeZkConfigProvider<
      CompactContract.ProvableCircuitId<VeilContract>
    >(zkConfigPath);
    const accountId = (await this.walletProvider.wallet.unshielded.getAddress())
      .hexString;
    const privateStateProvider = new MongoPrivateStateProvider<
      "veil_ps",
      VeilPrivateState
    >({
      db: this.db,
      accountId,
      privateStateCollectionName: "veil_private_states",
      signingKeyCollectionName: "veil_signing_keys",
    });
    await privateStateProvider.init();

    return {
      privateStateProvider,
      publicDataProvider: indexerPublicDataProvider(
        this.env.indexer,
        this.env.indexerWS,
      ),
      zkConfigProvider,
      proofProvider: httpClientProofProvider(
        this.env.proofServer,
        zkConfigProvider,
      ),
      walletProvider: this.walletProvider,
      midnightProvider: this.walletProvider,
    };
  }

  private compiledContract(): CompiledContract.CompiledContract<any, any> {
    return utils.createCompiledContract<VeilContract>(
      "veil-protocol",
      VeilContractClass,
      witness as any,
      this.config.zkConfigPath,
    ) as CompiledContract.CompiledContract<any, any>;
  }

  private bootstrapCompiledContract(): CompiledContract.CompiledContract<
    any,
    any
  > {
    return utils.createCompiledContract<VeilBootstrapContract>(
      "veil-protocol-bootstrap",
      VeilBootstrapContractClass,
      witness as any,
      this.config.bootstrapZkConfigPath,
    ) as CompiledContract.CompiledContract<any, any>;
  }

  private async installFullContractVerifierKeys(
    providers: DynamicProviders<VeilContract, "veil_ps">,
    compiledContract: CompiledContract.CompiledContract<any, any>,
    contractAddress: string,
  ): Promise<string[]> {
    const installedCircuits: string[] = [];

    for (const circuitId of FULL_CONTRACT_CIRCUITS) {
      const [[, verifierKey]] = await providers.zkConfigProvider.getVerifierKeys([
        circuitId as never,
      ]);
      const contractState =
        await providers.publicDataProvider.queryContractState(contractAddress);
      const maintenanceTx = createCircuitMaintenanceTxInterface(
        providers as any,
        circuitId as any,
        compiledContract,
        contractAddress,
      );

      if (contractState?.operation(circuitId) != null) {
        this.logger.info({ circuitId }, "Replacing verifier key");
        await maintenanceTx.removeVerifierKey();
      }

      this.logger.info({ circuitId }, "Installing verifier key");
      await maintenanceTx.insertVerifierKey(verifierKey);
      installedCircuits.push(circuitId);
    }

    return installedCircuits;
  }

  private async assertZkArtifacts(
    zkConfigPath: string,
    circuitIds: readonly string[],
    label: string,
  ): Promise<void> {
    const missing: string[] = [];

    for (const circuitId of circuitIds) {
      const expectedFiles = [
        path.join(zkConfigPath, "keys", `${circuitId}.prover`),
        path.join(zkConfigPath, "keys", `${circuitId}.verifier`),
        path.join(zkConfigPath, "zkir", `${circuitId}.bzkir`),
      ];

      for (const file of expectedFiles) {
        if (!fs.existsSync(file)) {
          missing.push(path.relative(process.cwd(), file));
        }
      }
    }

    if (missing.length > 0) {
      throw new Error(
        [
          `Missing ${label} ZK artifacts required for deployment.`,
          "Run `bun --filter @veil/veil-contract compile` before deploying.",
          "Do not use `test:compile` for deployable artifacts because it uses `--skip-zk`.",
          `Missing files:\n${missing.map((file) => `- ${file}`).join("\n")}`,
        ].join("\n"),
      );
    }
  }

  private async call(
    circuit: string,
    ...args: unknown[]
  ): Promise<ContractCallResult> {
    if (!this.api) {
      throw new Error(
        "Contract service has not joined the deployed contract yet.",
      );
    }

    this.logger.info({ circuit }, "Submitting contract transaction");
    const raw = await this.api.callTx(circuit as never, ...(args as never[]));
    return {
      circuit,
      contractAddress: this.api.deployedContractAddress,
      txHash: extractTxHash(raw),
      circuitResult: extractCircuitResult(raw),
      raw,
    };
  }
}

const extractTxHash = (raw: unknown): string | undefined => {
  if (!raw || typeof raw !== "object") return undefined;
  const record = raw as Record<string, unknown>;
  const direct = record.txHash;
  if (typeof direct === "string") return direct;
  const publicData = record.public;
  if (publicData && typeof publicData === "object") {
    const publicTxHash = (publicData as Record<string, unknown>).txHash;
    if (typeof publicTxHash === "string") return publicTxHash;
  }
  return undefined;
};

const extractCircuitResult = (raw: unknown): unknown | undefined => {
  if (!raw || typeof raw !== "object") return undefined;
  const record = raw as Record<string, unknown>;
  const privateData = record.private;
  if (privateData && typeof privateData === "object") {
    return (privateData as Record<string, unknown>).result;
  }
  return record.result;
};
