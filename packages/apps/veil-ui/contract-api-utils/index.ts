import { utils } from 'nite-api';
import {
  Contract as VeilContractClass,
  witness,
  type VeilPrivateState,
} from '@veil/veil-contract';
import { Contract as VeilBootstrapContractClass } from '@veil/veil-contract/bootstrap';

export type { VeilPrivateState };
export { witness };

export const PRIVATE_STATE_ID = 'veil_ps' as const;
export type PrivateStateId = typeof PRIVATE_STATE_ID;

export const BOOTSTRAP_CIRCUITS = [
  'Utils_generateUserPk',
  'Utils_initializeContractConfigurations',
  'Admin_addIssuer',
] as const;

export const FULL_CIRCUITS = [
  'Utils_generateUserPk',
  'Utils_initializeContractConfigurations',
  'NFT_verifyPoTNFT',
  'NFT_mintPoTNFT',
  'NFT_renewPoTNFT',
  'Scoring_submitRepaymentEvent',
  'Scoring_submitLiquidationEvent',
  'Scoring_submitProtocolUsageEvent',
  'Scoring_submitDebtStateEvent',
  'Scoring_createScoreEntry',
  'Admin_addIssuer',
  'Admin_removeIssuer',
  'Admin_updateTokenUris',
  'Admin_addAdmin',
  'Admin_removeAdmin',
  'Admin_updatedProtocolConfig',
  'Admin_updatedScoreConfig',
] as const;

export const makeBootstrapCompiledContract = (zkConfigPath: string): any =>
  utils.createCompiledContract(
    'veil-protocol-bootstrap',
    VeilBootstrapContractClass as any,
    witness as any,
    zkConfigPath,
  );

export const makeFullCompiledContract = (zkConfigPath: string): any =>
  utils.createCompiledContract(
    'veil-protocol',
    VeilContractClass as any,
    witness as any,
    zkConfigPath,
  );
