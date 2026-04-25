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
  CustomStructs_ProtocolConfig,
  CustomStructs_ScoreAccumulators,
  CustomStructs_ScoreConfig,
  CustomStructs_TokenImageUris,
  CustomStructs_TokenMarkers,
  Ledger,
  ShieldedCoinInfo,
  ledger,
  Witnesses,
} from "../managed/veil-protocol/contract";
import { createVeilPrivateState, VeilPrivateState, witness } from "../witness";
import { randomBytes } from "./utils";

const defaultTokenImageUris: CustomStructs_TokenImageUris = {
  unranked: "ipfs://veil/unranked",
  bronze: "ipfs://veil/bronze",
  silver: "ipfs://veil/silver",
  gold: "ipfs://veil/gold",
  platinum: "ipfs://veil/platinum",
};

const defaultProtocolConfig: CustomStructs_ProtocolConfig = {
  unranked: 0n,
  bronzeThreshold: 20n,
  silverThreshold: 40n,
  goldThreshold: 60n,
  platinumThreshold: 80n,
  maxLiquidationsAllowed: 3n,
  nftEpochValidity: 12n,
};

const defaultTokenMarkers: CustomStructs_TokenMarkers = {
  unranked: "UNRANKED",
  bronze: randomBytes(32),
  silver: randomBytes(32),
  gold: randomBytes(32),
  platinum: randomBytes(32),
};

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
  maxScoreDeltaPerEpoch: 50n,
};

export class VeilScoreSimulator {
  readonly contract: Contract<VeilPrivateState>;
  readonly contractAddress: ContractAddress;
  circuitContext: CircuitContext<VeilPrivateState>;
  userPrivateStates: Record<string, VeilPrivateState>;
  updateUserPrivateState: (newPrivateState: VeilPrivateState) => void;

  constructor(privateState: VeilPrivateState) {
    const initialTime = BigInt(Date.now());
    const testWitnesses: Witnesses<VeilPrivateState> = {
      ...witness,
      getCurrentTime: ({ privateState: ps }) => [
        ps,
        [initialTime, initialTime / 1000n],
      ],
    };
    this.contract = new Contract<VeilPrivateState>(testWitnesses);
    this.contractAddress = sampleContractAddress();

    const { currentContractState, currentPrivateState, currentZswapLocalState } =
      this.contract.initialState(
        createConstructorContext(privateState, { bytes: randomBytes(32) }),
        randomBytes(32),
        initialTime
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

    const initResult =
      this.contract.impureCircuits.Utils_initializeContractConfigurations(
        this.circuitContext,
        defaultTokenImageUris,
        "Veil PoT",
        defaultProtocolConfig,
        defaultScoreConfig,
        defaultTokenMarkers
      );
    this.circuitContext = initResult.context;

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
      { bytes: randomBytes(32) }
    );
    return this.updateStateAndGetResult(result);
  }

  // removeIssuer(issuerPk: Uint8Array): void {
  //   const result = this.contract.impureCircuits.Admin_removeIssuer(
  //     this.circuitContext,
  //     issuerPk
  //   );
  //   this.updateStateAndGetResult(result);
  // }

  // updateTokenUris(tokenImageUris: CustomStructs_TokenImageUris): void {
  //   const result = this.contract.impureCircuits.Admin_updateTokenUris(
  //     this.circuitContext,
  //     tokenImageUris
  //   );
  //   this.updateStateAndGetResult(result);
  // }

  // addAdmin(adminPk: Uint8Array): void {
  //   const result = this.contract.impureCircuits.Admin_addAdmin(
  //     this.circuitContext,
  //     adminPk
  //   );
  //   this.updateStateAndGetResult(result);
  // }

  // removeAdmin(adminPk: Uint8Array): void {
  //   const result = this.contract.impureCircuits.Admin_removeAdmin(
  //     this.circuitContext,
  //     adminPk
  //   );
  //   this.updateStateAndGetResult(result);
  // }

  // updateProtocolConfig(updatedConfig: CustomStructs_ProtocolConfig): void {
  //   const result = this.contract.impureCircuits.Admin_updatedProtocolConfig(
  //     this.circuitContext,
  //     updatedConfig
  //   );
  //   this.updateStateAndGetResult(result);
  // }

  // updateScoreConfig(updatedScoreConfig: CustomStructs_ScoreConfig): void {
  //   const result = this.contract.impureCircuits.Admin_updatedScoreConfig(
  //     this.circuitContext,
  //     updatedScoreConfig
  //   );
  //   this.updateStateAndGetResult(result);
  // }

  generateCurrentUserPk(): Uint8Array {
    const result = this.contract.impureCircuits.Utils_generateUserPk(
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


  mintPoTNFT(): void {
    const result = this.contract.impureCircuits.NFT_mintPoTNFT(this.circuitContext);
    this.updateStateAndGetResult(result);
  }

  renewPoTNFT(token: ShieldedCoinInfo): void {
    const result = this.contract.impureCircuits.NFT_renewPoTNFT(
      this.circuitContext,
      token
    );
    this.updateStateAndGetResult(result);
  }

  verifyPoTNFT(
    issuerPk: Uint8Array,
    userPk: Uint8Array,
    challenge = randomBytes(32),
    challengeExpiresAt = this.getLedgerState().LedgerStates_epochLastUpdateTimeStamp + 1_000n,
    ownershipSecret = this.circuitContext.currentPrivateState.ownershipSecret
  ): boolean {
    const result = this.contract.impureCircuits.NFT_verifyPoTNFT(
      this.circuitContext,
      issuerPk,
      userPk,
      challenge,
      challengeExpiresAt,
      ownershipSecret
    );
    return this.updateStateAndGetResult(result);
  }

  // revokePoTNFT(userPk: Uint8Array, adminPk: Uint8Array): void {
  //   const result = this.contract.impureCircuits.NFT_revokePoTNFT(
  //     this.circuitContext,
  //     userPk,
  //     adminPk
  //   );
  //   this.updateStateAndGetResult(result);
  // }

  getUserAccumulator(userPk: Uint8Array): CustomStructs_ScoreAccumulators {
    const key = toHex(userPk);
    const value = this.circuitContext.currentPrivateState.scoreAmmulations[key];
    if (!value) {
      throw new Error("User accumulation does not exist");
    }
    return value;
  }

  getUserPoTNFTMetadata(userPk: Uint8Array) {
    const registry = this.circuitContext.currentQueryContext.state
      ? ledger(this.circuitContext.currentQueryContext.state).LedgerStates_nftRegistry
      : null;
    if (!registry || !registry.member(userPk)) {
      throw new Error("User PoTNFT metadata does not exist");
    }
    return registry.lookup(userPk);
  }

  getLastOutputCoin(): ShieldedCoinInfo {
    const outputs = this.circuitContext.currentZswapLocalState.outputs;
    if (outputs.length === 0) {
      throw new Error("No output coin found");
    }
    const coinInfo = outputs[outputs.length - 1]?.coinInfo;
    if (!coinInfo) {
      throw new Error("No output coin info found");
    }
    return {
      nonce: coinInfo.nonce,
      color: coinInfo.color,
      value: coinInfo.value,
    };
  }
}
