import path from "node:path";
import { access } from "node:fs/promises";
import {
  type CompiledContract,
  type Contract as CompactContract,
} from "@midnight-ntwrk/compact-js";
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
} from "@veil-reputation-protocol/contract";

import type { BackendConfig } from "../config.js";
import {
  BackendWalletProvider,
  type SponsorCapacity,
  type SponsorPoolSplitResult,
  type SponsorshipResult,
} from "./wallet-service.js";
import { MongoPrivateStateProvider } from "./mongo-private-state-provider.js";

const PRIVATE_STATE_ID = "veil_ps";
const GOVERNANCE_TIMELOCK_EPOCHS = 10n;

type VeilContract = VeilContractClass<VeilPrivateState, VeilWitnesses<VeilPrivateState>>;

const FULL_CONTRACT_CIRCUITS = [
  "Identity_register",
  "Identity_assertActive",
  "Reputation_prove",
  "Reputation_check",
  "Governance_proposeScoreConfig",
  "Governance_applyScoreConfig",
  "Governance_cancelScoreConfig",
  "Governance_addSupportedChainNamespace",
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

const DEFAULT_GOVERNANCE_GUARDIAN_SET_HASH = new Uint8Array([
  1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1,
]);
const DEFAULT_GOVERNANCE_GUARDIAN_THRESHOLD = 3n;
const DEFAULT_GOVERNANCE_CONTROLLER_VERSION = 1n;

const padStringToBytes32 = (value: string): Uint8Array => {
  const bytes = new TextEncoder().encode(value);
  if (bytes.length > 32) throw new Error(`Value exceeds Bytes<32>: ${value}`);
  const padded = new Uint8Array(32);
  padded.set(bytes);
  return padded;
};

const DEFAULT_SUPPORTED_CHAIN_NAMESPACES = [
  padStringToBytes32("evm"),
  padStringToBytes32("ckb"),
  padStringToBytes32("solana"),
  padStringToBytes32("cardano"),
  padStringToBytes32("bitcoin"),
];

// Must match the SDK's DEFAULT_READER_POLICY_HASH — the built-in reader stamps
// this same value into every proof, so it has to be registered at genesis or
// the SDK's default reader can never produce an accepted proof.
const DEFAULT_SUPPORTED_READER_POLICIES = [padStringToBytes32("veil.default-rpc.v1")];

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
  readonly reclaimAttempts?: number;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  readonly updatedAt: Date;
};

type SponsorRateLimitRecord = {
  readonly key: string;
  readonly count: number;
  readonly resetAt: Date;
  readonly updatedAt: Date;
};

type SponsorScope = "Identity_register" | "Reputation_prove";

const SPONSOR_SCOPES = new Set<SponsorScope>(["Identity_register", "Reputation_prove"]);

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
        "Run `bun --filter @veil-reputation-protocol/contract compile && bun --filter @veil-reputation-protocol/contract build` before deploying.",
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
  private readonly sponsorRateLimits: Collection<SponsorRateLimitRecord>;
  private reclaimTimer?: NodeJS.Timeout;
  private sponsorMaintenancePromise?: Promise<void>;
  private sponsorAllocationQueue: Promise<void> = Promise.resolve();

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
    this.sponsorRateLimits = db.collection<SponsorRateLimitRecord>("veil_sponsor_rate_limits");
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
    await service.initSponsorRateLimits();
    service.startSponsorshipReclaimer();
    void service.runSponsorMaintenance("startup").catch((error) => {
      logger.warn({ err: error }, "Startup sponsor maintenance failed");
    });
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
  async sponsorDust(
    dustAddress: string,
    requiredDust?: bigint,
    options: { scope?: string; ip?: string } = {},
  ): Promise<SponsorshipResult | null> {
    this.assertSponsorScope(options.scope);
    await this.assertSponsorRateLimit(dustAddress, options.ip);
    return this.withSponsorAllocationLock(() => this.sponsorDustLocked(dustAddress, requiredDust));
  }

  private async sponsorDustLocked(
    dustAddress: string,
    requiredDust?: bigint,
  ): Promise<SponsorshipResult | null> {
    const now = new Date();
    const existing = await this.dustSponsorships.findOne(
      {
        dustAddress,
        status: "active",
      },
      { sort: { createdAt: -1 } },
    );
    if (existing) {
      const expiresAt = existing.expiresAt > now
        ? existing.expiresAt
        : new Date(now.getTime() + this.config.sponsorAllocationTtlMs);
      if (expiresAt !== existing.expiresAt) {
        await this.dustSponsorships.updateOne(
          { txId: existing.txId },
          { $set: { expiresAt, updatedAt: now } },
        );
      }
      return {
        txId: existing.txId,
        selectedUtxos: existing.utxoIds.length,
        utxoIds: existing.utxoIds,
        requiredDust: existing.requiredDust,
        estimatedGeneratedDust: existing.estimatedGeneratedDust,
        registrationFee: existing.registrationFee,
        expiresAt: expiresAt.toISOString(),
        reused: true,
      };
    }

    await this.reclaimExpiredSponsorships(25);
    await this.maintainSponsorPool();

    let sponsorship = await this.sponsorWalletProvider.sponsorDustFor(dustAddress, this.env.walletNetworkId, {
      requiredDust: requiredDust ?? this.config.sponsorDefaultRequiredDust,
    });
    if (sponsorship == null) {
      await this.reclaimExpiredSponsorships(25);
      await this.maintainSponsorPool();
      sponsorship = await this.sponsorWalletProvider.sponsorDustFor(dustAddress, this.env.walletNetworkId, {
        requiredDust: requiredDust ?? this.config.sponsorDefaultRequiredDust,
      });

      if (sponsorship == null) return null;
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

  private async withSponsorAllocationLock<T>(work: () => Promise<T>): Promise<T> {
    const previous = this.sponsorAllocationQueue;
    let release: () => void = () => {};
    this.sponsorAllocationQueue = new Promise<void>((resolve) => {
      release = resolve;
    });

    await previous.catch(() => undefined);
    try {
      return await work();
    } finally {
      release();
    }
  }

  async sponsorStatus(): Promise<{
    available: boolean;
    allocationTtlMs: number;
    reclaimIntervalMs: number;
    capacity: SponsorCapacity;
    activeAllocations: number;
    expiringSoon: number;
    expiredAllocations: number;
    reclaimingAllocations: number;
    failedReclaimAllocations: number;
  }> {
    const now = new Date();
    const soon = new Date(now.getTime() + this.config.sponsorAllocationTtlMs);
    const [
      capacity,
      activeAllocations,
      expiringSoon,
      expiredAllocations,
      reclaimingAllocations,
      failedReclaimAllocations,
    ] = await Promise.all([
      this.sponsorWalletProvider.sponsorCapacity(),
      this.dustSponsorships.countDocuments({ status: "active", expiresAt: { $gt: now } }),
      this.dustSponsorships.countDocuments({ status: "active", expiresAt: { $gt: now, $lte: soon } }),
      this.dustSponsorships.countDocuments({ status: "active", expiresAt: { $lte: now } }),
      this.dustSponsorships.countDocuments({ status: "reclaiming" }),
      this.dustSponsorships.countDocuments({ status: "reclaim_failed" }),
    ]);

    return {
      available: capacity.freeNightUtxos > 0,
      allocationTtlMs: this.config.sponsorAllocationTtlMs,
      reclaimIntervalMs: this.config.sponsorReclaimIntervalMs,
      capacity,
      activeAllocations,
      expiringSoon,
      expiredAllocations,
      reclaimingAllocations,
      failedReclaimAllocations,
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

  private async initSponsorRateLimits(): Promise<void> {
    await this.sponsorRateLimits.createIndex({ key: 1 }, { unique: true });
    await this.sponsorRateLimits.createIndex({ resetAt: 1 }, { expireAfterSeconds: 0 });
  }

  private assertSponsorScope(scope: string | undefined): asserts scope is SponsorScope | undefined {
    if (scope == null || scope === "") return;
    if (!SPONSOR_SCOPES.has(scope as SponsorScope)) {
      throw new Error("DUST sponsorship is only available for identity registration and first band proof.");
    }
  }

  private async assertSponsorRateLimit(dustAddress: string, ip: string | undefined): Promise<void> {
    const checks = [
      { key: `dust:${dustAddress}`, max: this.config.sponsorRateLimitMaxPerDustAddress },
      ...(ip ? [{ key: `ip:${ip}`, max: this.config.sponsorRateLimitMaxPerIp }] : []),
    ];
    const now = new Date();

    for (const check of checks) {
      if (check.max <= 0) continue;
      const existing = await this.sponsorRateLimits.findOne({ key: check.key });
      const resetAt = existing && existing.resetAt > now
        ? existing.resetAt
        : new Date(now.getTime() + this.config.sponsorRateLimitWindowMs);
      const count = existing && existing.resetAt > now ? existing.count + 1 : 1;
      if (count > check.max) {
        throw new Error("Free DUST sponsorship rate limit reached. Please try again later or use your own DUST.");
      }

      await this.sponsorRateLimits.updateOne(
        { key: check.key },
        {
          $set: { count, resetAt, updatedAt: now },
        },
        { upsert: true },
      );
    }
  }

  private async maintainSponsorPool(): Promise<SponsorPoolSplitResult | undefined> {
    if (this.config.sponsorPoolTargetFreeUtxos <= 0 || this.config.sponsorPoolSplitAmount <= 0n) {
      return undefined;
    }

    try {
      const result = await this.sponsorWalletProvider.splitSponsorNightPool({
        targetFreeUtxos: this.config.sponsorPoolTargetFreeUtxos,
        splitAmount: this.config.sponsorPoolSplitAmount,
        maxOutputs: this.config.sponsorPoolMaxSplitOutputs,
      });
      if (result.outputsCreated > 0) {
        this.logger.info(
          `Sponsor NIGHT pool maintenance submitted split tx ${result.txId}; outputs=${result.outputsCreated}`,
        );
      } else if (result.skippedReason) {
        this.logger.info(
          `Sponsor NIGHT pool maintenance skipped: ${result.skippedReason} | free=${result.freeNightUtxosBefore} | registered=${result.registeredUtxosBefore}`,
        );
      }
      return result;
    } catch (error) {
      this.logger.warn({ err: error }, "Sponsor NIGHT pool maintenance failed");
      return undefined;
    }
  }

  private async runSponsorMaintenance(reason: string): Promise<void> {
    if (this.sponsorMaintenancePromise) return this.sponsorMaintenancePromise;

    this.sponsorMaintenancePromise = (async () => {
      this.logger.info(`Running sponsor maintenance: ${reason}`);
      await this.reclaimExpiredSponsorships(10);
      await this.maintainSponsorPool();
    })().finally(() => {
      this.sponsorMaintenancePromise = undefined;
    });

    return this.sponsorMaintenancePromise;
  }

  private startSponsorshipReclaimer(): void {
    if (this.config.sponsorReclaimIntervalMs <= 0) return;

    const reclaimExpired = async (): Promise<void> => {
      await this.runSponsorMaintenance("interval");
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
    const staleReclaimingBefore = new Date(now.getTime() - Math.max(this.config.sponsorReclaimIntervalMs, 60_000));
    const expired = await this.dustSponsorships
      .find({
        $and: [
          { expiresAt: { $lte: now } },
          {
            $or: [
              { status: "active" },
              { status: "reclaim_failed" },
              { status: "reclaiming", updatedAt: { $lte: staleReclaimingBefore } },
            ],
          },
          {
            $or: [
              { reclaimAttempts: { $exists: false } },
              { reclaimAttempts: { $lt: this.config.sponsorReclaimMaxAttempts } },
            ],
          },
        ],
      })
      .limit(limit)
      .toArray();

    for (const record of expired) {
      await this.dustSponsorships.updateOne(
        { txId: record.txId, status: { $in: ["active", "reclaim_failed", "reclaiming"] } },
        {
          $set: { status: "reclaiming", updatedAt: new Date() },
          $inc: { reclaimAttempts: 1 },
        },
      );

      try {
        const reclaimTxId = await this.sponsorWalletProvider.reclaimDustForUtxoIds(record.utxoIds);
        if (!reclaimTxId) {
          await this.dustSponsorships.updateOne(
            { txId: record.txId },
            {
              $set: {
                status: "reclaim_failed",
                updatedAt: new Date(),
              },
            },
          );
          continue;
        }

        await this.dustSponsorships.updateOne(
          { txId: record.txId },
          {
            $set: {
              status: "reclaimed",
              reclaimTxId,
              updatedAt: new Date(),
            },
          },
        );
      } catch (error) {
        this.logger.warn({ err: error }, `Failed to reclaim expired DUST sponsorship ${record.txId}`);
        await this.dustSponsorships.updateOne(
          { txId: record.txId },
          {
            $set: {
              status: "reclaim_failed",
              updatedAt: new Date(),
            },
          },
        );
      }
    }
  }

  private async deployAndJoin(): Promise<string> {
    await assertZkArtifacts(
      this.config.zkConfigPath,
      FULL_CONTRACT_CIRCUITS,
      "Veil contract",
    );

    const providers = await this.providers(this.config.zkConfigPath);
    const api = await DynamicContractAPI.deploy<VeilContract, typeof PRIVATE_STATE_ID>({
      providers,
      compiledContract: this.compiledContract(),
      privateStateId: PRIVATE_STATE_ID,
      initialPrivateState: createVeilPrivateState(),
      args: [
        DEFAULT_SCORE_CONFIG,
        DEFAULT_GOVERNANCE_GUARDIAN_SET_HASH,
        DEFAULT_GOVERNANCE_GUARDIAN_THRESHOLD,
        DEFAULT_GOVERNANCE_CONTROLLER_VERSION,
        GOVERNANCE_TIMELOCK_EPOCHS,
        DEFAULT_SUPPORTED_CHAIN_NAMESPACES,
        DEFAULT_SUPPORTED_READER_POLICIES,
      ],
      logger: this.logger,
    });

    const contractAddress = api.deployedContractAddress;
    this.logger.info({ contractAddress }, "Veil contract deployed");

    providers.privateStateProvider.setContractAddress(contractAddress);
    await this.saveDeployment(contractAddress, "backend-deploy");
    this.activeContractAddress = contractAddress;
    return contractAddress;
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
