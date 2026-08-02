import {
  FULL_CONTRACT_CIRCUITS,
  PRIVATE_STATE_ID,
  makeFullCompiledContract,
  witness,
  type VeilPrivateState,
} from '@veil-reputation-protocol/sdk';

export type { VeilPrivateState };
export { makeFullCompiledContract, witness };

export type PrivateStateId = typeof PRIVATE_STATE_ID;
export { PRIVATE_STATE_ID };

export const FULL_CIRCUITS = FULL_CONTRACT_CIRCUITS;
