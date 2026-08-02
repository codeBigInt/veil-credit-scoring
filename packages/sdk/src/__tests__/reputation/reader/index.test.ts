import { describe, it, expect } from 'vitest';
import { collectReputationWitnessFromAddresses } from '../../../reputation/reader';
import { DEFAULT_READER_POLICY_HASH } from '../../../contract';
import { bytesToHex } from '../../../utils/bytes';
import { VeilError } from '../../../types';
import type { VeilConfig } from '../../../config';
import type { EthereumSignals, CkbSignals } from '../../../types';

const config: VeilConfig = {
  contractAddress: '0x' + '00'.repeat(32),
  network: 'preprod',
  chains: {},
};

const emptyEthSignals: EthereumSignals = {
  firstTxTimestamp: 0,
  contractsInteracted: [],
  governanceVotes: [],
  lpPositions: [],
  txTimestamps: [],
  transactionCount: 0,
  activeChains: 0,
};

const emptyCkbSignals: CkbSignals = {
  contractsInteracted: [],
  txTimestamps: [],
  txCount: 0,
  networkReachable: true,
};

describe('collectReputationWitnessFromAddresses — reader policy provenance', () => {
  it('stamps the built-in default reader policy hash when no custom reader is supplied', async () => {
    const witness = await collectReputationWitnessFromAddresses('0xabc', '0xdef', config);
    expect(witness.readerPolicyHash).toBe(bytesToHex(DEFAULT_READER_POLICY_HASH));
  });

  it('throws if a custom reader is supplied without a readerPolicyHash', async () => {
    await expect(
      collectReputationWitnessFromAddresses('0xabc', '0xdef', config, {
        ethereumReader: async () => emptyEthSignals,
      }),
    ).rejects.toThrow(VeilError);
  });

  it('carries the caller-supplied readerPolicyHash when a custom reader is used', async () => {
    const customPolicyHash = new Uint8Array(32).fill(7);
    const witness = await collectReputationWitnessFromAddresses('0xabc', '0xdef', config, {
      ethereumReader: async () => emptyEthSignals,
      ckbReader: async () => emptyCkbSignals,
      readerPolicyHash: customPolicyHash,
    });
    expect(witness.readerPolicyHash).toBe(bytesToHex(customPolicyHash));
  });
});
