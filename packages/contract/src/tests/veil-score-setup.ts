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
  CustomStructs_CreditScore,
  CustomStructs_ScoreAccumulators,
  CustomStructs_ScoreConfig,
  Ledger,
  ledger,
  Witnesses,
} from "../managed/veil-protocol/contract";
import { createVeilPrivateState, VeilPrivateState, witness } from "../witness";
import { randomBytes } from "./utils";

const defaultScoreConfig: CustomStructs_ScoreConfig = {
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
        defaultScoreConfig
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
      admin: this.circuitContext.currentPrivateState,
    };
    this.updateUserPrivateState = () => {};
  }

  static deploy(): VeilScoreSimulator {
    return new VeilScoreSimulator(createVeilPrivateState(randomBytes(32)));
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
    this.userPrivateStates[name] = createVeilPrivateState(randomBytes(32));
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

  addIssuer(): Uint8Array {
    const result = this.contract.impureCircuits.Admin_addIssuer(
      this.circuitContext,
      "Aave",
      { bytes: randomBytes(32) },
      BigInt(Date.now())
    );
    return this.updateStateAndGetResult(result);
  }

  removeIssuer(issuerPk: Uint8Array): void {
    const result = this.contract.impureCircuits.Admin_removeIssuer(
      this.circuitContext,
      issuerPk
    );
    this.updateStateAndGetResult(result);
  }

  addAdmin(adminPk: Uint8Array): void {
    const result = this.contract.impureCircuits.Admin_addAdmin(
      this.circuitContext,
      adminPk
    );
    this.updateStateAndGetResult(result);
  }

  removeAdmin(adminPk: Uint8Array): void {
    const result = this.contract.impureCircuits.Admin_removeAdmin(
      this.circuitContext,
      adminPk
    );
    this.updateStateAndGetResult(result);
  }

  updateScoreConfig(updatedScoreConfig: CustomStructs_ScoreConfig): void {
    const result = this.contract.impureCircuits.Admin_updatedScoreConfig(
      this.circuitContext,
      updatedScoreConfig
    );
    this.updateStateAndGetResult(result);
  }

  generateCurrentUserPk(): Uint8Array {
    const result = this.contract.circuits.Utils_generateUserPk(
      this.circuitContext,
      this.circuitContext.currentPrivateState.secreteKey
    );
    return this.updateStateAndGetResult(result);
  }

  createScoreEntry(userPk = this.generateCurrentUserPk()): void {
    const result = this.contract.impureCircuits.Scoring_createScoreEntry(
      this.circuitContext,
      userPk
    );
    this.updateStateAndGetResult(result);
  }

  submitRepaymentEvent(
    userPk: Uint8Array,
    issuerPk: Uint8Array,
    paidOnTimeFlag: bigint,
    amountWeight: bigint,
    eventEpoch: bigint,
    eventId: Uint8Array
  ): void {
    const result = this.contract.impureCircuits.Scoring_submitRepaymentEvent(
      this.circuitContext,
      userPk,
      issuerPk,
      paidOnTimeFlag,
      amountWeight,
      eventEpoch,
      eventId
    );
    this.updateStateAndGetResult(result);
  }

  submitLiquidationEvent(
    userPk: Uint8Array,
    issuerPk: Uint8Array,
    severity: bigint,
    eventEpoch: bigint,
    eventId: Uint8Array
  ): void {
    const result = this.contract.impureCircuits.Scoring_submitLiquidationEvent(
      this.circuitContext,
      userPk,
      issuerPk,
      severity,
      eventEpoch,
      eventId
    );
    this.updateStateAndGetResult(result);
  }

  submitProtocolUsageEvent(
    userPk: Uint8Array,
    issuerPk: Uint8Array,
    protocolId: Uint8Array,
    eventEpoch: bigint
  ): void {
    const result = this.contract.impureCircuits.Scoring_submitProtocolUsageEvent(
      this.circuitContext,
      userPk,
      issuerPk,
      protocolId,
      eventEpoch
    );
    this.updateStateAndGetResult(result);
  }

  submitDebtStateEvent(
    userPk: Uint8Array,
    issuerPk: Uint8Array,
    activeDebtFlag: bigint,
    riskBand: bigint,
    eventEpoch: bigint,
    eventId: Uint8Array
  ): void {
    const result = this.contract.impureCircuits.Scoring_submitDebtStateEvent(
      this.circuitContext,
      userPk,
      issuerPk,
      activeDebtFlag,
      riskBand,
      eventEpoch,
      eventId
    );
    this.updateStateAndGetResult(result);
  }


  getUserAccumulator(userPk: Uint8Array): CustomStructs_ScoreAccumulators {
    const key = toHex(userPk);
    const value = this.circuitContext.currentPrivateState.scoreAmmulations[key];
    if (!value) {
      throw new Error("User accumulation does not exist");
    }
    return value;
  }
}
