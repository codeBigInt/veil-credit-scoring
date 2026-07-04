import {
  CircuitContext,
  CircuitResults,
  ContractAddress,
  CostModel,
  QueryContext,
  createConstructorContext,
  sampleContractAddress,
  toHex,
} from "@midnight-ntwrk/compact-runtime";
import {
  Contract,
  CustomStructs_ReputationDecision,
  CustomStructs_ReputationScore,
  CustomStructs_ScoreConfig,
  CustomStructs_VeilIdentityRecord,
  Ledger,
  ledger,
  Witnesses,
} from "../managed/veil-protocol/contract";
import { createVeilPrivateState, VeilPrivateState, witness } from "../witness";
import { randomBytes } from "./utils";

const defaultScoreConfig: CustomStructs_ScoreConfig = {
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

export const defaultGovernanceGuardianSetHash = new Uint8Array([
  1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1,
]);
export const defaultGovernanceGuardianThreshold = 3n;
export const defaultGovernanceControllerVersion = 1n;

export class VeilScoreSimulator {
  readonly contract: Contract<VeilPrivateState>;
  readonly contractAddress: ContractAddress;
  circuitContext: CircuitContext<VeilPrivateState>;
  userPrivateStates: Record<string, VeilPrivateState>;
  updateUserPrivateState: (newPrivateState: VeilPrivateState) => void;

  constructor(privateState: VeilPrivateState) {
    const testWitnesses: Witnesses<VeilPrivateState> = {
      ...witness,
    };
    this.contract = new Contract<VeilPrivateState>(testWitnesses);
    this.contractAddress = sampleContractAddress();

    const { currentContractState, currentPrivateState, currentZswapLocalState } =
      this.contract.initialState(
        createConstructorContext(privateState, { bytes: randomBytes(32) }),
        defaultScoreConfig,
        defaultGovernanceGuardianSetHash,
        defaultGovernanceGuardianThreshold,
        defaultGovernanceControllerVersion,
        10n
      );

    this.circuitContext = {
      currentPrivateState,
      currentZswapLocalState,
      currentQueryContext: new QueryContext(
        currentContractState.data,
        this.contractAddress
      ),
      costModel: CostModel.initialCostModel(),
    };

    this.userPrivateStates = {
      alice: this.circuitContext.currentPrivateState,
    };
    this.updateUserPrivateState = (newPrivateState: VeilPrivateState) => {
      this.userPrivateStates.alice = newPrivateState;
    };
  }

  static deploy(): VeilScoreSimulator {
    return new VeilScoreSimulator(createVeilPrivateState());
  }

  as(name: string): VeilScoreSimulator {
    const ps = this.userPrivateStates[name];
    if (!ps) {
      throw new Error(`No private state found for user '${name}'.`);
    }
    this.circuitContext = {
      ...this.circuitContext,
      currentPrivateState: ps,
    };
    this.updateUserPrivateState = (newPrivateState: VeilPrivateState) => {
      this.userPrivateStates[name] = newPrivateState;
    };
    return this;
  }

  registerUser(name: string): void {
    this.userPrivateStates[name] = createVeilPrivateState();
  }

  getLedgerState(): Ledger {
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  getPrivateState(): VeilPrivateState {
    return this.circuitContext.currentPrivateState;
  }

  private updateStateAndGetResult<T>(
    circuitResult: CircuitResults<VeilPrivateState, T>
  ): T {
    this.circuitContext = circuitResult.context;
    this.updateUserPrivateState(circuitResult.context.currentPrivateState);
    return circuitResult.result;
  }

  deriveVeilId(
    publicKeyOrLockHash: Uint8Array,
    chainNamespace: Uint8Array,
    salt: Uint8Array
  ): Uint8Array {
    const result = this.contract.circuits.Utils_deriveVeilId(
      this.circuitContext,
      publicKeyOrLockHash,
      chainNamespace,
      salt
    );
    return this.updateStateAndGetResult(result);
  }

  registerIdentity(
    veilIdHash: Uint8Array,
    chainNamespace = randomBytes(32),
    publicKeyOrLockHashCommitment = randomBytes(32),
    walletSignatureHash = randomBytes(32),
    currentEpoch = 1n
  ): CustomStructs_VeilIdentityRecord {
    const result = this.contract.impureCircuits.Identity_register(
      this.circuitContext,
      veilIdHash,
      chainNamespace,
      publicKeyOrLockHashCommitment,
      walletSignatureHash,
      currentEpoch
    );
    return this.updateStateAndGetResult(result);
  }

  deriveIdentityProofHash(
    veilIdHash: Uint8Array,
    chainNamespace: Uint8Array,
    publicKeyOrLockHashCommitment: Uint8Array,
    walletSignatureHash: Uint8Array
  ): Uint8Array {
    const result = this.contract.circuits.Utils_deriveIdentityProofHash(
      this.circuitContext,
      veilIdHash,
      chainNamespace,
      publicKeyOrLockHashCommitment,
      walletSignatureHash,
      this.contractAddress.bytes
    );
    return this.updateStateAndGetResult(result);
  }

  deriveReputationWitnessCommitment(args: {
    veilIdHash: Uint8Array;
    walletAgeInDays: bigint;
    distinctProtocols: bigint;
    daoVoteCount: bigint;
    lpTenureInDays: bigint;
    crossChainCount: bigint;
    txConsistencyScore: bigint;
    ethChainCommitment: Uint8Array;
    ckbChainCommitment: Uint8Array;
    witnessSalt: Uint8Array;
  }): Uint8Array {
    const result = this.contract.circuits.Utils_deriveReputationWitnessCommitment(
      this.circuitContext,
      args.veilIdHash,
      args.walletAgeInDays,
      args.distinctProtocols,
      args.daoVoteCount,
      args.lpTenureInDays,
      args.crossChainCount,
      args.txConsistencyScore,
      args.ethChainCommitment,
      args.ckbChainCommitment,
      args.witnessSalt
    );
    return this.updateStateAndGetResult(result);
  }

  deriveReputationProofHash(
    veilIdHash: Uint8Array,
    witnessCommitment: Uint8Array,
    claimedBand: bigint,
    proofNonce: Uint8Array
  ): Uint8Array {
    const result = this.contract.circuits.Utils_deriveReputationProofHash(
      this.circuitContext,
      veilIdHash,
      witnessCommitment,
      claimedBand,
      proofNonce,
      this.deriveScoreConfigCommitment(defaultScoreConfig)
    );
    return this.updateStateAndGetResult(result);
  }

  deriveGovernanceActionHash(
    actionTag: Uint8Array,
    scoreConfigHash: Uint8Array,
    operationId: Uint8Array,
    effectiveEpoch: bigint
  ): Uint8Array {
    const result = this.contract.circuits.Utils_deriveGovernanceActionHash(
      this.circuitContext,
      actionTag,
      scoreConfigHash,
      operationId,
      effectiveEpoch,
      this.contractAddress.bytes
    );
    return this.updateStateAndGetResult(result);
  }

  deriveGuardianControllerCommitment(
    guardianSetHash = defaultGovernanceGuardianSetHash,
    threshold = defaultGovernanceGuardianThreshold,
    controllerVersion = defaultGovernanceControllerVersion
  ): Uint8Array {
    const result = this.contract.circuits.Utils_deriveGuardianControllerCommitment(
      this.circuitContext,
      guardianSetHash,
      threshold,
      controllerVersion
    );
    return this.updateStateAndGetResult(result);
  }

  deriveGovernanceProofHash(
    controllerCommitment: Uint8Array,
    actionHash: Uint8Array,
    operationId: Uint8Array,
    signatureBundleHash: Uint8Array,
    nonce: Uint8Array
  ): Uint8Array {
    const result = this.contract.circuits.Utils_deriveGovernanceProofHash(
      this.circuitContext,
      controllerCommitment,
      actionHash,
      operationId,
      signatureBundleHash,
      nonce,
      this.contractAddress.bytes
    );
    return this.updateStateAndGetResult(result);
  }

  deriveScoreConfigCommitment(config: CustomStructs_ScoreConfig): Uint8Array {
    const result = this.contract.circuits.Utils_deriveScoreConfigHashFor(
      this.circuitContext,
      config,
      this.contractAddress.bytes
    );
    return this.updateStateAndGetResult(result);
  }

  assertIdentityActive(veilIdHash: Uint8Array): boolean {
    const result = this.contract.impureCircuits.Identity_assertActive(
      this.circuitContext,
      veilIdHash
    );
    return this.updateStateAndGetResult(result);
  }

  proveReputation(
    veilIdHash: Uint8Array,
    signals: {
      walletAgeInDays: bigint;
      distinctProtocols: bigint;
      daoVoteCount: bigint;
      lpTenureInDays: bigint;
      crossChainCount: bigint;
      txConsistencyScore: bigint;
      claimedBand: bigint;
      ethChainCommitment?: Uint8Array;
      ckbChainCommitment?: Uint8Array;
      witnessSalt?: Uint8Array;
      proofNonce?: Uint8Array;
      currentEpoch?: bigint;
    }
  ): bigint {
    const ethChainCommitment = signals.ethChainCommitment ?? randomBytes(32);
    const ckbChainCommitment = signals.ckbChainCommitment ?? new Uint8Array(32);
    const witnessSalt = signals.witnessSalt ?? randomBytes(32);
    const proofNonce = signals.proofNonce ?? randomBytes(32);
    const result = this.contract.impureCircuits.Reputation_prove(
      this.circuitContext,
      veilIdHash,
      signals.walletAgeInDays,
      signals.distinctProtocols,
      signals.daoVoteCount,
      signals.lpTenureInDays,
      signals.crossChainCount,
      signals.txConsistencyScore,
      signals.claimedBand,
      ethChainCommitment,
      ckbChainCommitment,
      witnessSalt,
      proofNonce,
      signals.currentEpoch ?? 2n
    );
    return this.updateStateAndGetResult(result);
  }

  checkReputation(
    veilIdHash: Uint8Array,
    minimumBand: bigint,
    purposeHash = randomBytes(32),
    requesterHash = randomBytes(32),
    currentEpoch = 3n
  ): CustomStructs_ReputationDecision {
    const result = this.contract.impureCircuits.Reputation_check(
      this.circuitContext,
      veilIdHash,
      requesterHash,
      purposeHash,
      minimumBand,
      currentEpoch
    );
    return this.updateStateAndGetResult(result);
  }

  getIdentityRecord(veilIdHash: Uint8Array): CustomStructs_VeilIdentityRecord {
    return this.getLedgerState().LedgerStates_identityRecords.lookup(veilIdHash);
  }

  getReputationScore(veilIdHash: Uint8Array): CustomStructs_ReputationScore {
    const key = toHex(veilIdHash);
    const value = this.circuitContext.currentPrivateState.reputationScores[key];
    if (!value) {
      throw new Error("Reputation score does not exist");
    }
    return value;
  }

  proposeScoreConfig(config: CustomStructs_ScoreConfig, currentEpoch = 10n): void {
    const operationId = randomBytes(32);
    const signatureBundleHash = randomBytes(32);
    const nonce = randomBytes(32);
    const result = this.contract.impureCircuits.Governance_proposeScoreConfig(
      this.circuitContext,
      config,
      currentEpoch,
      operationId,
      signatureBundleHash,
      nonce
    );
    this.updateStateAndGetResult(result);
  }

  applyScoreConfig(currentEpoch = 20n): void {
    const result = this.contract.impureCircuits.Governance_applyScoreConfig(
      this.circuitContext,
      currentEpoch
    );
    this.updateStateAndGetResult(result);
  }

  cancelScoreConfig(): void {
    const operationId = randomBytes(32);
    const signatureBundleHash = randomBytes(32);
    const nonce = randomBytes(32);
    const result = this.contract.impureCircuits.Governance_cancelScoreConfig(
      this.circuitContext,
      operationId,
      signatureBundleHash,
      nonce
    );
    this.updateStateAndGetResult(result);
  }
}
