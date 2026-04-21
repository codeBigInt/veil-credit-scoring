import { Contract, Witnesses } from "../../contract/src/managed/veil-protocol/contract";
import { VeilPrivateState } from "../../contract/dist";

export type VeilContract = Contract<VeilPrivateState, Witnesses<VeilPrivateState>>