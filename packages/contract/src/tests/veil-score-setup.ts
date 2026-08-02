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
  pureCircuits,
  Witnesses,
} from "../managed/veil-protocol/contract";
import { createVeilPrivateState, VeilPrivateState, witness } from "../witness";
import { padStringToBytes32, randomBytes } from "./utils";

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
export const defaultSupportedChainNamespaces = [
  padStringToBytes32("evm"),
  padStringToBytes32("ckb"),
  padStringToBytes32("solana"),
  padStringToBytes32("cardano"),
  padStringToBytes32("bitcoin"),
];
export const defaultReaderPolicyHash = padStringToBytes32("veil.default-rpc.v1");
export const defaultSupportedReaderPolicies = [defaultReaderPolicyHash];

export class VeilScoreSimulator {
  readonly contract: Contract<VeilPrivateState>;
  readonly contractAddress: ContractAddress;
  circuitContext: CircuitContext<VeilPrivateState>;
  userPrivateStates: Record<string, VeilPrivateState>;
  updateUserPrivateState: (newPrivateState: VeilPrivateState) => void;

  constructor(privateState: VeilPrivateState) {
    const testWitnesses: Witnesses<VeilPrivateState> = {
      ...witness,
      getCurrentTime: ({ privateState }) => [
        privateState,
        [0n, 0n, 9_999_999_999n],
      ],
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
        0n,
        defaultSupportedChainNamespaces,
        defaultSupportedReaderPolicies
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
    return pureCircuits.Utils_deriveVeilId(
      publicKeyOrLockHash,
      chainNamespace,
      salt,
      this.contractAddress
    );
  }

  registerIdentity(
    veilIdHash: Uint8Array,
    chainNamespace = padStringToBytes32("ckb"),
    publicKeyOrLockHashCommitment = randomBytes(32),
    walletSignatureHash = randomBytes(32)
  ): CustomStructs_VeilIdentityRecord {
    const result = this.contract.impureCircuits.Identity_register(
      this.circuitContext,
      veilIdHash,
      chainNamespace,
      publicKeyOrLockHashCommitment,
      walletSignatureHash
    );
    return this.updateStateAndGetResult(result);
  }

  deriveIdentityProofHash(
    veilIdHash: Uint8Array,
    chainNamespace: Uint8Array,
    publicKeyOrLockHashCommitment: Uint8Array,
    walletSignatureHash: Uint8Array
  ): Uint8Array {
    return pureCircuits.Utils_deriveIdentityProofHash(
      veilIdHash,
      chainNamespace,
      publicKeyOrLockHashCommitment,
      walletSignatureHash,
      this.contractAddress.bytes
    );
  }

  deriveReputationWitnessCommitment(args: {
    veilIdHash: Uint8Array;
    walletAgeInDays: bigint;
    distinctProtocols: bigint;
    daoVoteCount: bigint;
    lpTenureInDays: bigint;
    crossChainCount: bigint;
    txConsistencyScore: bigint;
    chainNamespace: Uint8Array;
    chainCommitment: Uint8Array;
    readerPolicyHash: Uint8Array;
    witnessSalt: Uint8Array;
  }): Uint8Array {
    return pureCircuits.Utils_deriveReputationWitnessCommitment(
      args.veilIdHash,
      args.walletAgeInDays,
      args.distinctProtocols,
      args.daoVoteCount,
      args.lpTenureInDays,
      args.crossChainCount,
      args.txConsistencyScore,
      args.chainNamespace,
      args.chainCommitment,
      args.readerPolicyHash,
      args.witnessSalt
    );
  }

  deriveReputationProofHash(
    veilIdHash: Uint8Array,
    witnessCommitment: Uint8Array,
    claimedBand: bigint,
    proofNonce: Uint8Array
  ): Uint8Array {
    return pureCircuits.Utils_deriveReputationProofHash(
      veilIdHash,
      witnessCommitment,
      claimedBand,
      proofNonce,
      this.deriveScoreConfigCommitment(defaultScoreConfig)
    );
  }

  deriveGovernanceActionHash(
    actionTag: Uint8Array,
    payloadHash: Uint8Array,
    operationId: Uint8Array,
    effectiveEpoch: bigint
  ): Uint8Array {
    return pureCircuits.Utils_deriveGovernanceActionHash(
      actionTag,
      payloadHash,
      operationId,
      effectiveEpoch,
      this.contractAddress.bytes
    );
  }

  deriveGuardianControllerCommitment(
    guardianSetHash = defaultGovernanceGuardianSetHash,
    threshold = defaultGovernanceGuardianThreshold,
    controllerVersion = defaultGovernanceControllerVersion
  ): Uint8Array {
    return pureCircuits.Utils_deriveGuardianControllerCommitment(
      guardianSetHash,
      threshold,
      controllerVersion
    );
  }

  deriveGovernanceProofHash(
    controllerCommitment: Uint8Array,
    actionHash: Uint8Array,
    operationId: Uint8Array,
    signatureBundleHash: Uint8Array,
    nonce: Uint8Array
  ): Uint8Array {
    return pureCircuits.Utils_deriveGovernanceProofHash(
      controllerCommitment,
      actionHash,
      operationId,
      signatureBundleHash,
      nonce,
      this.contractAddress.bytes
    );
  }

  deriveScoreConfigCommitment(config: CustomStructs_ScoreConfig): Uint8Array {
    return pureCircuits.Utils_deriveScoreConfigHashFor(
      config,
      this.contractAddress.bytes
    );
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
      chainNamespace?: Uint8Array;
      chainCommitment?: Uint8Array;
      readerPolicyHash?: Uint8Array;
      witnessSalt?: Uint8Array;
      proofNonce?: Uint8Array;
    }
  ): bigint {
    const chainNamespace = signals.chainNamespace ?? padStringToBytes32("evm");
    const chainCommitment = signals.chainCommitment ?? randomBytes(32);
    const readerPolicyHash = signals.readerPolicyHash ?? defaultReaderPolicyHash;
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
      chainNamespace,
      chainCommitment,
      readerPolicyHash,
      witnessSalt,
      proofNonce
    );
    return this.updateStateAndGetResult(result);
  }

  checkReputation(
    veilIdHash: Uint8Array,
    minimumBand: bigint,
    purposeHash = randomBytes(32),
    requesterHash = randomBytes(32)
  ): CustomStructs_ReputationDecision {
    const result = this.contract.impureCircuits.Reputation_check(
      this.circuitContext,
      veilIdHash,
      requesterHash,
      purposeHash,
      minimumBand
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

  proposeScoreConfig(config: CustomStructs_ScoreConfig): void {
    const operationId = randomBytes(32);
    const signatureBundleHash = randomBytes(32);
    const nonce = randomBytes(32);
    const result = this.contract.impureCircuits.Governance_proposeScoreConfig(
      this.circuitContext,
      config,
      operationId,
      signatureBundleHash,
      nonce
    );
    this.updateStateAndGetResult(result);
  }

  applyScoreConfig(): void {
    const result = this.contract.impureCircuits.Governance_applyScoreConfig(
      this.circuitContext
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

  addSupportedChainNamespace(chainNamespace = padStringToBytes32("evm")): void {
    const operationId = randomBytes(32);
    const signatureBundleHash = randomBytes(32);
    const nonce = randomBytes(32);
    const result = this.contract.impureCircuits.Governance_addSupportedChainNamespace(
      this.circuitContext,
      chainNamespace,
      operationId,
      signatureBundleHash,
      nonce
    );
    this.updateStateAndGetResult(result);
  }

  addSupportedReaderPolicy(readerPolicyHash = randomBytes(32)): void {
    const operationId = randomBytes(32);
    const signatureBundleHash = randomBytes(32);
    const nonce = randomBytes(32);
    const result = this.contract.impureCircuits.Governance_addSupportedReaderPolicy(
      this.circuitContext,
      readerPolicyHash,
      operationId,
      signatureBundleHash,
      nonce
    );
    this.updateStateAndGetResult(result);
  }
}
