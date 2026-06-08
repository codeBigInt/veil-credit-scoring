import { utils } from 'nite-api';
import {
  Contract as VeilContractClass,
  witness,
  type VeilPrivateState,
} from '@veil/veil-contract';

export type { VeilPrivateState };
export { witness };

export const PRIVATE_STATE_ID = 'veil_ps' as const;
export type PrivateStateId = typeof PRIVATE_STATE_ID;

export const FULL_CIRCUITS = [
  'Utils_generateUserPk',
  'Scoring_submitRepaymentEvent',
  'Scoring_submitLiquidationEvent',
  'Scoring_submitProtocolUsageEvent',
  'Scoring_submitDebtStateEvent',
  'Scoring_createScoreEntry',
  'Admin_addIssuer',
  'Admin_removeIssuer',
  'Admin_addAdmin',
  'Admin_removeAdmin',
  'Admin_updatedScoreConfig',
] as const;

export const makeFullCompiledContract = (zkConfigPath: string): any =>
  utils.createCompiledContract(
    'veil-protocol',
    VeilContractClass as any,
    witness as any,
    zkConfigPath,
  );
