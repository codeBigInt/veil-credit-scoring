import path from "node:path";
import { access } from "node:fs/promises";
import {
  type CompiledContract,
  type Contract as CompactContract,
} from "@midnight-ntwrk/compact-js";
import { createCircuitMaintenanceTxInterface } from "@midnight-ntwrk/midnight-js-contracts";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { NodeZkConfigProvider } from "@midnight-ntwrk/midnight-js-node-zk-config-provider";
import { httpClientProofProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import type { EnvironmentConfiguration } from "@midnight-ntwrk/testkit-js";
import { DynamicContractAPI, type DynamicProviders, utils } from "nite-api";
import type { Collection, Db } from "mongodb";
import type { Logger } from "pino";
import {
  Contract as VeilContractClass,
  createVeilPrivateState,
  witness,
  type CustomStructs_ScoreConfig,
  type VeilPrivateState,
  type Witnesses as VeilWitnesses,
} from "@veil/veil-contract";
import {
  Contract as VeilBootstrapContractClass,
  type Witnesses as VeilBootstrapWitnesses,
} from "@veil/veil-contract/bootstrap";

import type { BackendConfig } from "../config.js";
import { BackendWalletProvider, type SponsorCapacity, type SponsorshipResult } from "./wallet-service.js";
import { MongoPrivateStateProvider } from "./mongo-private-state-provider.js";

const PRIVATE_STATE_ID = "veil_ps";
const GOVERNANCE_TIMELOCK_EPOCHS = 10n;

type VeilContract = VeilContractClass<VeilPrivateState, VeilWitnesses<VeilPrivateState>>;
type VeilBootstrapContract = VeilBootstrapContractClass<
  VeilPrivateState,
  VeilBootstrapWitnesses<VeilPrivateState>
>;

const FULL_CONTRACT_CIRCUITS = [
  "Utils_deriveVeilId",
  "Utils_deriveIdentityProofHash",
  "Utils_deriveScoreConfigHash",
  "Utils_deriveScoreConfigHashFor",
  "Utils_deriveReputationProofHash",
  "Utils_deriveGovernanceActionHash",
  "Utils_deriveGovernanceProofHash",
  "Utils_deriveBand",
  "Identity_register",
  "Identity_assertActive",
  "Reputation_prove",
  "Reputation_check",
  "Governance_proposeScoreConfig",
  "Governance_applyScoreConfig",
  "Governance_cancelScoreConfig",
] as const;

const BOOTSTRAP_CONTRACT_CIRCUITS = [
  "Utils_deriveVeilId",
  "Utils_deriveIdentityProofHash",
  "Identity_register",
  "Identity_assertActive",
  "Reputation_prove",
  "Reputation_check",
  "Governance_proposeScoreConfig",
  "Governance_applyScoreConfig",
  "Governance_cancelScoreConfig",
] as const;

const POST_BOOTSTRAP_CONTRACT_CIRCUITS = [
  "Utils_deriveScoreConfigHash",
  "Utils_deriveScoreConfigHashFor",
  "Utils_deriveReputationProofHash",
  "Utils_deriveGovernanceActionHash",
  "Utils_deriveGovernanceProofHash",
  "Utils_deriveBand",
] as const;

const DEFAULT_SCORE_CONFIG: CustomStructs_ScoreConfig = {
  baseScore: 300n,
  maxScore: 900n,
  walletAgeWeight: 3n,
  protocolWeight: 15n,
  daoWeight: 20n,
  lpWeight: 10n,
  crossChainWeight: 25n,
  consistencyWeight: 5n,
  bronzeThreshold: 400n,
  silverThreshold: 550n,
  goldThreshold: 700n,
  platinumThreshold: 820n,
};

const DEFAULT_GOVERNANCE_CONTROLLER_COMMITMENT = new Uint8Array([
  1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1,
]);

type ContractDeploymentRecord = {
  readonly key: "active";
  readonly contractAddress: string;
  readonly deployedBy: "backend";
  readonly source: "env" | "mongo" | "backend-deploy";
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

type DustSponsorshipRecord = {
  readonly dustAddress: string;
  readonly txId: string;
  readonly utxoIds: string[];
  readonly requiredDust: string;
  readonly estimatedGeneratedDust: string;
  readonly registrationFee: string;
  readonly status: "active" | "reclaiming" | "reclaimed" | "reclaim_failed";
  readonly reclaimTxId?: string;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  readonly updatedAt: Date;
};

const assertZkArtifacts = async (
  zkConfigPath: string,
  circuitIds: readonly string[],
  label: string,
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
        `Missing ${label} ZK artifacts required for backend contract deployment.`,
        "Run `bun --filter @veil/veil-contract compile && bun --filter @veil/veil-contract build` before deploying.",
        "Do not use `test:compile` for deployable artifacts because it uses `--skip-zk`.",
        `Missing files:\n${missing.map((file) => `- ${file}`).join("\n")}`,
      ].join("\n"),
    );
  }
};

export class ContractService {
  private activeContractAddress?: string;
  private deploymentPromise?: Promise<string>;
  private readonly deployments: Collection<ContractDeploymentRecord>;
  private readonly dustSponsorships: Collection<DustSponsorshipRecord>;
  private reclaimTimer?: NodeJS.Timeout;

  private constructor(
    private readonly config: BackendConfig,
    private readonly env: EnvironmentConfiguration,
    private readonly db: Db,
    private readonly logger: Logger,
    private readonly walletProvider: BackendWalletProvider,
    private readonly sponsorWalletProvider: BackendWalletProvider,
  ) {
    this.deployments = db.collection<ContractDeploymentRecord>("veil_contract_deployments");
    this.dustSponsorships = db.collection<DustSponsorshipRecord>("veil_dust_sponsorships");
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
      "operating",
    );
    await walletProvider.start();
    walletProvider.startWalletStateCache();
    await walletProvider.waitForReadyFunds({ generateOperatingDust: true });

    const sponsorWalletProvider = await BackendWalletProvider.build(
      logger,
      env,
      config.sponsorWalletSeed,
      "sponsor",
    );
    await sponsorWalletProvider.start();
    sponsorWalletProvider.startWalletStateCache();
    await sponsorWalletProvider.waitForReadyFunds({
      generateOperatingDust: false,
      requireFunds: false,
    });

    const service = new ContractService(config, env, db, logger, walletProvider, sponsorWalletProvider);
    await service.initContractAddress();
    await service.initDustSponsorships();
    service.startSponsorshipReclaimer();
    return service;
  }

  async stop(): Promise<void> {
    await Promise.all([
      this.walletProvider.stop(),
      this.sponsorWalletProvider.stop(),
    ]);
    if (this.reclaimTimer) clearInterval(this.reclaimTimer);
  }

  /**
   * Delegates a user's DUST address to the backend wallet for DUST generation.
   * DUST cannot be transferred directly; sponsorship registers backend NIGHT
   * liquidity so generated DUST flows to the user's address.
   */
  async sponsorDust(dustAddress: string, requiredDust?: bigint): Promise<SponsorshipResult | null> {
    const now = new Date();
    const existing = await this.dustSponsorships.findOne({
      dustAddress,
      status: "active",
      expiresAt: { $gt: now },
    });
    if (existing) {
      return {
        txId: existing.txId,
        selectedUtxos: existing.utxoIds.length,
        utxoIds: existing.utxoIds,
        requiredDust: existing.requiredDust,
        estimatedGeneratedDust: existing.estimatedGeneratedDust,
        registrationFee: existing.registrationFee,
        expiresAt: existing.expiresAt.toISOString(),
        reused: true,
      };
    }

    await this.reclaimExpiredSponsorships(25);

    const sponsorship = await this.sponsorWalletProvider.sponsorDustFor(dustAddress, this.env.walletNetworkId, {
      requiredDust: requiredDust ?? this.config.sponsorDefaultRequiredDust,
    });
    if (sponsorship == null) {
      await this.reclaimExpiredSponsorships(25);
      return null;
    }

    const expiresAt = new Date(now.getTime() + this.config.sponsorAllocationTtlMs);
    await this.dustSponsorships.insertOne({
      dustAddress,
      txId: sponsorship.txId,
      utxoIds: sponsorship.utxoIds,
      requiredDust: sponsorship.requiredDust,
      estimatedGeneratedDust: sponsorship.estimatedGeneratedDust,
      registrationFee: sponsorship.registrationFee,
      status: "active",
      createdAt: now,
      expiresAt,
      updatedAt: now,
    });

    return {
      ...sponsorship,
      expiresAt: expiresAt.toISOString(),
      reused: false,
    };
  }

  async sponsorStatus(): Promise<{
    available: boolean;
    allocationTtlMs: number;
    reclaimIntervalMs: number;
    capacity: SponsorCapacity;
    activeAllocations: number;
    expiringSoon: number;
  }> {
    const now = new Date();
    const soon = new Date(now.getTime() + this.config.sponsorAllocationTtlMs);
    const [capacity, activeAllocations, expiringSoon] = await Promise.all([
      this.sponsorWalletProvider.sponsorCapacity(),
      this.dustSponsorships.countDocuments({ status: "active", expiresAt: { $gt: now } }),
      this.dustSponsorships.countDocuments({ status: "active", expiresAt: { $gt: now, $lte: soon } }),
    ]);

    return {
      available: capacity.freeNightUtxos > 0,
      allocationTtlMs: this.config.sponsorAllocationTtlMs,
      reclaimIntervalMs: this.config.sponsorReclaimIntervalMs,
      capacity,
      activeAllocations,
      expiringSoon,
    };
  }

  contractAddress(): string | undefined {
    return this.activeContractAddress;
  }

  deploymentEnabled(): boolean {
    return this.config.autoDeploy;
  }

  async deployContract(): Promise<string> {
    if (this.activeContractAddress) return this.activeContractAddress;
    this.deploymentPromise ??= this.deployAndJoin().finally(() => {
      this.deploymentPromise = undefined;
    });
    return this.deploymentPromise;
  }

  private async initContractAddress(): Promise<void> {
    await this.deployments.createIndex({ key: 1 }, { unique: true });

    if (this.config.contractAddress) {
      this.activeContractAddress = this.config.contractAddress;
      await this.saveDeployment(this.config.contractAddress, "env");
      return;
    }

    const saved = await this.deployments.findOne({ key: "active" });
    if (saved?.contractAddress) {
      this.activeContractAddress = saved.contractAddress;
      return;
    }

    if (this.config.autoDeploy) {
      this.activeContractAddress = await this.deployContract();
    }
  }

  private async initDustSponsorships(): Promise<void> {
    await this.dustSponsorships.createIndex({ status: 1, expiresAt: 1 });
    await this.dustSponsorships.createIndex({ txId: 1 }, { unique: true });
  }

  private startSponsorshipReclaimer(): void {
    if (this.config.sponsorReclaimIntervalMs <= 0) return;

    const reclaimExpired = async (): Promise<void> => {
      await this.reclaimExpiredSponsorships(10);
    };

    this.reclaimTimer = setInterval(() => {
      void reclaimExpired().catch((error) => {
        this.logger.warn({ err: error }, "Expired DUST sponsorship reclaim loop failed");
      });
    }, this.config.sponsorReclaimIntervalMs);
    void reclaimExpired().catch((error) => {
      this.logger.warn({ err: error }, "Initial expired DUST sponsorship reclaim failed");
    });
  }

  private async reclaimExpiredSponsorships(limit: number): Promise<void> {
    const now = new Date();
    const expired = await this.dustSponsorships
      .find({ status: "active", expiresAt: { $lte: now } })
      .limit(limit)
      .toArray();

    for (const record of expired) {
      await this.dustSponsorships.updateOne(
        { txId: record.txId, status: "active" },
        { $set: { status: "reclaiming", updatedAt: new Date() } },
      );

      try {
        const reclaimTxId = await this.sponsorWalletProvider.reclaimDustForUtxoIds(record.utxoIds);
        await this.dustSponsorships.updateOne(
          { txId: record.txId },
          {
            $set: {
              status: reclaimTxId ? "reclaimed" : "reclaim_failed",
              reclaimTxId: reclaimTxId ?? undefined,
              updatedAt: new Date(),
            },
          },
        );
      } catch (error) {
        this.logger.warn({ err: error }, `Failed to reclaim expired DUST sponsorship ${record.txId}`);
        await this.dustSponsorships.updateOne(
          { txId: record.txId },
          { $set: { status: "reclaim_failed", updatedAt: new Date() } },
        );
      }
    }
  }

  private async deployAndJoin(): Promise<string> {
    await assertZkArtifacts(
      this.config.bootstrapZkConfigPath,
      BOOTSTRAP_CONTRACT_CIRCUITS,
      "bootstrap contract",
    );
    await assertZkArtifacts(
      this.config.zkConfigPath,
      FULL_CONTRACT_CIRCUITS,
      "full contract",
    );

    const providers = await this.providers(this.config.zkConfigPath);
    const bootstrapProviders = await this.providers(this.config.bootstrapZkConfigPath);
    const fullCompiledContract = this.compiledContract();

    const bootstrapApi = await DynamicContractAPI.deploy<VeilBootstrapContract, typeof PRIVATE_STATE_ID>({
      providers: bootstrapProviders as unknown as DynamicProviders<VeilBootstrapContract, typeof PRIVATE_STATE_ID>,
      compiledContract: this.compiledBootstrapContract(),
      privateStateId: PRIVATE_STATE_ID,
      initialPrivateState: createVeilPrivateState(),
      args: [
        DEFAULT_SCORE_CONFIG,
        DEFAULT_GOVERNANCE_CONTROLLER_COMMITMENT,
        GOVERNANCE_TIMELOCK_EPOCHS,
      ],
      logger: this.logger,
    });

    const contractAddress = bootstrapApi.deployedContractAddress;
    this.logger.info({ contractAddress }, "Bootstrap Veil contract deployed");

    providers.privateStateProvider.setContractAddress(contractAddress);
    await this.installMissingVerifierKeys(providers, fullCompiledContract, contractAddress);
    await this.saveDeployment(contractAddress, "backend-deploy");
    this.activeContractAddress = contractAddress;
    return contractAddress;
  }

  private async installMissingVerifierKeys(
    providers: DynamicProviders<VeilContract, typeof PRIVATE_STATE_ID>,
    compiledContract: CompiledContract.CompiledContract<any, any>,
    contractAddress: string,
  ): Promise<void> {
    for (const circuitId of POST_BOOTSTRAP_CONTRACT_CIRCUITS) {
      const contractState = await providers.publicDataProvider.queryContractState(contractAddress);

      if (contractState?.operation(circuitId) != null) {
        this.logger.info({ circuitId }, "Verifier key already present; skipping");
        continue;
      }

      const [[, verifierKey]] = await providers.zkConfigProvider.getVerifierKeys([circuitId]);
      const maintenanceTx = createCircuitMaintenanceTxInterface(
        providers as any,
        circuitId as any,
        compiledContract,
        contractAddress,
      );

      this.logger.info({ circuitId }, "Installing missing verifier key");
      await maintenanceTx.insertVerifierKey(verifierKey);
    }
  }

  private async providers(
    zkConfigPath: string,
  ): Promise<DynamicProviders<VeilContract, typeof PRIVATE_STATE_ID>> {
    const zkConfigProvider = new NodeZkConfigProvider<CompactContract.ProvableCircuitId<VeilContract>>(
      zkConfigPath,
    );
    const privateStateProvider = new MongoPrivateStateProvider<typeof PRIVATE_STATE_ID, VeilPrivateState>({
      db: this.db,
      accountId: String(this.walletProvider.getCoinPublicKey()),
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
      "veil-protocol",
      VeilContractClass as any,
      witness as any,
      this.config.zkConfigPath,
    ) as any;
  }

  private compiledBootstrapContract(): CompiledContract.CompiledContract<any, any> {
    return utils.createCompiledContract<VeilBootstrapContract>(
      "veil-protocol-bootstrap",
      VeilBootstrapContractClass as any,
      witness as any,
      this.config.bootstrapZkConfigPath,
    ) as any;
  }

  private async saveDeployment(
    contractAddress: string,
    source: ContractDeploymentRecord["source"],
  ): Promise<void> {
    const now = new Date();
    await this.deployments.updateOne(
      { key: "active" },
      {
        $setOnInsert: {
          key: "active",
          createdAt: now,
        },
        $set: {
          contractAddress,
          deployedBy: "backend",
          source,
          updatedAt: now,
        },
      },
      { upsert: true },
    );
  }
}
