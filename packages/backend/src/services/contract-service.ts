import path from "node:path";
import { access } from "node:fs/promises";
import {
  type CompiledContract,
  type Contract as CompactContract,
} from "@midnight-ntwrk/compact-js";
import { fromHex, toHex } from "@midnight-ntwrk/compact-runtime";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { NodeZkConfigProvider } from "@midnight-ntwrk/midnight-js-node-zk-config-provider";
import { httpClientProofProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import type { EnvironmentConfiguration } from "@midnight-ntwrk/testkit-js";
import { DynamicContractAPI, type DynamicProviders, utils } from "nite-api";
import type { Logger } from "pino";
import type { Collection, Db } from "mongodb";
import {
  Contract as VeilContractClass,
  createVeilPrivateState,
  witness,
  type Witnesses as VeilWitnesses,
  type VeilPrivateState,
} from "../contract-build/index.js";

import type { BackendConfig } from "../config.js";
import { BackendWalletProvider } from "./wallet-service.js";
import { MongoPrivateStateProvider } from "./mongo-private-state-provider.js";

type VeilContract = VeilContractClass<
  VeilPrivateState,
  VeilWitnesses<VeilPrivateState>
>;
type VeilAPI = DynamicContractAPI<VeilContract, "veil_ps">;

const FULL_CONTRACT_CIRCUITS = [
  "Utils_generateUserPk",
  "Scoring_submitRepaymentEvent",
  "Scoring_submitLiquidationEvent",
  "Scoring_submitProtocolUsageEvent",
  "Scoring_submitDebtStateEvent",
  "Scoring_createScoreEntry",
  "Admin_addIssuer",
  "Admin_removeIssuer",
  "Admin_addAdmin",
  "Admin_removeAdmin",
  "Admin_updatedScoreConfig",
] as const;

const DEFAULT_SCORE_CONFIG = {
  baseScore: 350n,
  maxScore: 900n,
  scale: 100n,
  repaymentWeight: 2n,
  protocolWeight: 10n,
  tenureWeight: 1n,
  liquidationWeight: 3n,
  activeDebtPenalty: 5n,
  riskBandWeight: 5n,
};

export type ContractCallResult = {
  readonly circuit: string;
  readonly txHash?: string;
  readonly contractAddress: string;
  readonly raw: unknown;
};

export type CreditDecision = {
  readonly approved: boolean;
  readonly scoreBand: "unranked" | "bronze" | "silver" | "gold" | "platinum";
  readonly maxLtvBps: number;
  readonly riskPremiumBps: number;
  readonly hasCreditScore: boolean;
  readonly reason: string;
  readonly veilIdHash: string;
  readonly validAt: string;
};

export type ScoreEntryStatus = {
  readonly exists: boolean;
  readonly hasAccumulator: boolean;
  readonly hasCreditScore: boolean;
};

type ContractDeploymentRecord = {
  readonly key: "active";
  readonly contractAddress: string;
  readonly deployedBy: "backend";
  readonly superAdminSource: "VEIL_BACKEND_WALLET_SEED";
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export class ContractService {
  private api?: VeilAPI;
  private readonly deployments: Collection<ContractDeploymentRecord>;

  private constructor(
    private readonly config: BackendConfig,
    private readonly env: EnvironmentConfiguration,
    private readonly db: Db,
    private readonly logger: Logger,
    private readonly walletProvider: BackendWalletProvider,
  ) {
    this.deployments = db.collection<ContractDeploymentRecord>("veil_contract_deployments");
  }

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
    await service.initContractApi();
    return service;
  }

  async stop(): Promise<void> {
    await this.walletProvider.stop();
  }

  async createScoreEntry(userPk: Uint8Array): Promise<ContractCallResult> {
    return this.call("Scoring_createScoreEntry", userPk);
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

  async createCreditDecision(userPk: Uint8Array, veilIdHash: string): Promise<CreditDecision> {
    if (!this.api) {
      throw new Error('Contract service has not joined the deployed contract yet.');
    }

    const privateState = await this.api.providers.privateStateProvider.get(
      this.config.privateStateId,
    );
    if (!privateState) {
      throw new Error("No backend private state found for the Veil contract");
    }

    const score = privateState.creditScores[toHex(userPk)] ?? null;
    return decisionFromScore(score?.score, veilIdHash);
  }

  async getScoreEntryStatus(userPk: Uint8Array): Promise<ScoreEntryStatus> {
    if (!this.api) {
      throw new Error('Contract service has not joined the deployed contract yet.');
    }

    const privateState = await this.api.providers.privateStateProvider.get(
      this.config.privateStateId,
    );
    if (!privateState) {
      return {
        exists: false,
        hasAccumulator: false,
        hasCreditScore: false,
      };
    }

    const key = toHex(userPk);
    const hasAccumulator = privateState.scoreAmmulations?.[key] != null;
    const hasCreditScore = privateState.creditScores?.[key] != null;

    return {
      exists: hasAccumulator || hasCreditScore,
      hasAccumulator,
      hasCreditScore,
    };
  }

  contractAddress(): string {
    if (!this.api) {
      throw new Error("Contract service has not initialized the contract API yet.");
    }
    return this.api.deployedContractAddress;
  }

  private async initContractApi(): Promise<void> {
    const compiledContract = this.compiledContract();
    const providers = await this.providers();
    const contractAddress = await this.resolveContractAddress(providers, compiledContract);

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

  private async resolveContractAddress(
    providers: DynamicProviders<VeilContract, "veil_ps">,
    compiledContract: CompiledContract.CompiledContract<any, any>,
  ): Promise<string> {
    if (this.config.contractAddress) {
      await this.saveDeployment(this.config.contractAddress);
      this.logger.info(`Using configured Veil contract address ${this.config.contractAddress}`);
      return this.config.contractAddress;
    }

    const saved = await this.deployments.findOne({ key: "active" });
    if (saved?.contractAddress) {
      this.logger.info(`Using saved Veil contract address ${saved.contractAddress}`);
      return saved.contractAddress;
    }

    if (!this.config.autoDeploy) {
      throw new Error(
        "VEIL_CONTRACT_ADDRESS is not set and no saved backend deployment exists. Set VEIL_AUTO_DEPLOY=true to deploy from the backend wallet.",
      );
    }

    await assertZkArtifacts(this.config.zkConfigPath, FULL_CONTRACT_CIRCUITS);
    const api = await this.deployWithBackendSuperAdmin(providers, compiledContract);
    await this.saveDeployment(api.deployedContractAddress);
    return api.deployedContractAddress;
  }

  private async deployWithBackendSuperAdmin(
    providers: DynamicProviders<VeilContract, "veil_ps">,
    compiledContract: CompiledContract.CompiledContract<any, any>,
  ): Promise<VeilAPI> {
    // assertNoDeprecatedPotCircuits();
    this.logger.info("Deploying Veil contract from backend wallet. Backend wallet seed will derive the contract super admin.");
    const api = await DynamicContractAPI.deploy<VeilContract, "veil_ps">({
      providers,
      compiledContract,
      privateStateId: this.config.privateStateId,
      initialPrivateState: createVeilPrivateState(fromHex(this.config.walletSeed)),
      args: [DEFAULT_SCORE_CONFIG],
      logger: this.logger,
    });
    this.logger.info(`Deployed Veil contract at ${api.deployedContractAddress}`);
    return api;
  }

  private async saveDeployment(contractAddress: string): Promise<void> {
    const now = new Date();
    await this.deployments.updateOne(
      { key: "active" },
      {
        $setOnInsert: {
          key: "active",
          deployedBy: "backend",
          superAdminSource: "VEIL_BACKEND_WALLET_SEED",
          createdAt: now,
        },
        $set: {
          contractAddress,
          updatedAt: now,
        },
      },
      { upsert: true },
    );
  }

  private async providers(): Promise<
    DynamicProviders<VeilContract, "veil_ps">
  > {
    const zkConfigProvider = new NodeZkConfigProvider<
      CompactContract.ProvableCircuitId<VeilContract>
    >(this.config.zkConfigPath);
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

const assertNoDeprecatedPotCircuits = (): void => {
  const contract = new VeilContractClass(witness as any);
  const circuits = contract.impureCircuits as Record<string, unknown>;
  const deprecated = [
    "NFT_mintPoTNFT",
    "NFT_renewPoTNFT",
    "NFT_verifyPoTNFT",
  ].filter((name) => name in circuits);

  if (deprecated.length > 0) {
    throw new Error(
      [
        "Refusing to auto-deploy stale generated Veil contract artifacts.",
        `Deprecated PoT circuits are still present: ${deprecated.join(", ")}`,
        "Regenerate Compact artifacts after removing PoT exports, then rebuild the backend.",
        "Expected command: `bun --filter @veil/veil-contract compile` followed by rebuilding/copying backend contract artifacts.",
      ].join(" "),
    );
  }
};

const assertZkArtifacts = async (
  zkConfigPath: string,
  circuitIds: readonly string[],
): Promise<void> => {
  const missing: string[] = [];

  for (const circuitId of circuitIds) {
    const expectedFiles = [
      path.join(zkConfigPath, "keys", `${circuitId}.prover`),
      path.join(zkConfigPath, "keys", `${circuitId}.verifier`),
      path.join(zkConfigPath, "zkir", `${circuitId}.bzkir`),
    ];

    for (const file of expectedFiles) {
      try {
        await access(file);
      } catch {
        missing.push(path.relative(process.cwd(), file));
      }
    }
  }

  if (missing.length > 0) {
    throw new Error(
      [
        "Missing ZK artifacts required for backend contract deployment.",
        "Run `bun --filter @veil/veil-contract compile` before deploying from the backend.",
        "Do not use `test:compile` for deployable artifacts because it uses `--skip-zk`.",
        `Missing files:\n${missing.map((file) => `- ${file}`).join("\n")}`,
      ].join("\n"),
    );
  }
};

const decisionFromScore = (score: bigint | undefined, veilIdHash: string): CreditDecision => {
  const value = score == null ? undefined : Number(score);
  if (value == null || !Number.isFinite(value)) {
    return {
      approved: false,
      scoreBand: "unranked",
      maxLtvBps: 0,
      riskPremiumBps: 0,
      hasCreditScore: false,
      reason: "No computed credit score is available yet.",
      veilIdHash,
      validAt: new Date().toISOString(),
    };
  }

  if (value >= 800) {
    return {
      approved: true,
      scoreBand: "platinum",
      maxLtvBps: 7800,
      riskPremiumBps: 80,
      hasCreditScore: true,
      reason: "Credit score meets platinum risk policy.",
      veilIdHash,
      validAt: new Date().toISOString(),
    };
  }

  if (value >= 700) {
    return {
      approved: true,
      scoreBand: "gold",
      maxLtvBps: 7000,
      riskPremiumBps: 150,
      hasCreditScore: true,
      reason: "Credit score meets gold risk policy.",
      veilIdHash,
      validAt: new Date().toISOString(),
    };
  }

  if (value >= 600) {
    return {
      approved: true,
      scoreBand: "silver",
      maxLtvBps: 6000,
      riskPremiumBps: 300,
      hasCreditScore: true,
      reason: "Credit score meets silver risk policy.",
      veilIdHash,
      validAt: new Date().toISOString(),
    };
  }

  if (value >= 500) {
    return {
      approved: false,
      scoreBand: "bronze",
      maxLtvBps: 0,
      riskPremiumBps: 0,
      hasCreditScore: true,
      reason: "Credit score is below the current approval threshold.",
      veilIdHash,
      validAt: new Date().toISOString(),
    };
  }

  return {
    approved: false,
    scoreBand: "unranked",
    maxLtvBps: 0,
    riskPremiumBps: 0,
    hasCreditScore: true,
    reason: "Credit score is unranked under the current risk policy.",
    veilIdHash,
    validAt: new Date().toISOString(),
  };
};
