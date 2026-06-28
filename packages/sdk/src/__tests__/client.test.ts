import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @midnight-ntwrk/compact-runtime before importing anything that uses it
vi.mock('@midnight-ntwrk/compact-runtime', () => ({
  CompactTypeBytes: class CompactTypeBytes { constructor(_n: number) {} },
  CompactTypeVector: class CompactTypeVector { constructor(_n: number, _t: unknown) {} },
  persistentHash: vi.fn(() => new Uint8Array(32).fill(0xde)),
  toHex: (b: Uint8Array) => Buffer.from(b).toString('hex'),
  fromHex: (hex: string) => Uint8Array.from(Buffer.from(hex.replace(/^0x/, ''), 'hex')),
}));

// Mock @veil/veil-contract to avoid loading WASM in unit tests
vi.mock('@veil/veil-contract', () => ({
  pureCircuits: {
    Utils_deriveReputationWitnessCommitment: vi.fn(() => new Uint8Array(32).fill(0xef)),
  },
  witness: {},
  createVeilPrivateState: vi.fn(() => ({})),
  Contract: vi.fn(),
}));
vi.mock('@veil/veil-contract/bootstrap', () => ({ Contract: vi.fn() }));
vi.mock('nite-api', () => ({ utils: { createCompiledContract: vi.fn() } }));

import { VeilClient } from '../client';
import type { VeilConfig, VeilMidnightProvider } from '../types';

const config: VeilConfig = {
  midnightRpc: 'https://rpc.test',
  contractAddress: '0x' + '11'.repeat(32),
  network: 'preprod',
  chains: { ethereum: { rpcUrl: 'https://eth.test', chainId: 1 } },
};

const mockProvider: VeilMidnightProvider = {
  callTx: vi.fn(),
};

const mockSigner = {
  getRecommendedAddress: vi.fn().mockResolvedValue('ckb1test'),
  signMessage: vi.fn().mockResolvedValue('0xsignature'),
  getEvmAddress: vi.fn().mockResolvedValue('0xevmAddr'),
};

const lockHash = new Uint8Array(32).fill(0x07);
const deriveLockHashFromAddress = () => lockHash;

describe('VeilClient.resolveIdentityState', () => {
  it('delegates to the provider via Identity_assertActive', async () => {
    (mockProvider.callTx as ReturnType<typeof vi.fn>).mockResolvedValueOnce(true);
    const client = new VeilClient(config, mockProvider, { deriveLockHashFromAddress });
    const state = await client.resolveIdentityState('0x' + 'aa'.repeat(32));
    expect(state?.registered).toBe(true);
  });
});

describe('VeilClient.checkReputation', () => {
  it('delegates to checkReputation and returns a ReputationDecision', async () => {
    const mockResult = {
      band: 2n,
      meetsThreshold: true,
      communityWeightBps: 12_500n,
      accessTier: 2n,
      validAtEpoch: 10n,
      proofHash: new Uint8Array(32),
    };
    (mockProvider.callTx as ReturnType<typeof vi.fn>).mockResolvedValue({ result: mockResult });

    const client = new VeilClient(config, mockProvider, { deriveLockHashFromAddress });
    const decision = await client.checkReputation('0x' + 'aa'.repeat(32), {
      minimumBand: 'silver',
      purpose: 'airdrop',
    });

    expect(decision.band).toBe('silver');
    expect(decision.meetsThreshold).toBe(true);
    expect(decision.communityWeight).toBe(1.25);
  });
});

describe('VeilClient.batchCheck', () => {
  it('returns a Map keyed by veilId', async () => {
    const mockResult = {
      band: 1n,
      meetsThreshold: true,
      communityWeightBps: 10_000n,
      accessTier: 1n,
      validAtEpoch: 1n,
      proofHash: new Uint8Array(32),
    };
    (mockProvider.callTx as ReturnType<typeof vi.fn>).mockResolvedValue({ result: mockResult });

    const client = new VeilClient(config, mockProvider, { deriveLockHashFromAddress });
    const ids = ['0x' + 'aa'.repeat(32), '0x' + 'bb'.repeat(32)];
    const map = await client.batchCheck(ids, { minimumBand: 'bronze', purpose: 'airdrop' });

    expect(map.size).toBe(2);
    ids.forEach((id) => expect(map.get(id)?.band).toBe('bronze'));
  });
});
