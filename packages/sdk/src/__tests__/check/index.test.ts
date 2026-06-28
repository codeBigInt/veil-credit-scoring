import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkReputation, batchCheckReputation } from '../../check';
import type { CheckOptions } from '../../types';
import { VeilError } from '../../types';

// band=3 (gold), meetsThreshold=true, communityWeightBps=15000n, accessTier=3n
const mockDecisionRaw = {
  band: 3n,
  meetsThreshold: true,
  communityWeightBps: 15_000n,
  accessTier: 3n,
  validAtEpoch: 42n,
  proofHash: new Uint8Array(32).fill(0xcc),
};

const makeProvider = (resultOrThrow: unknown) => ({
  callTx: vi.fn().mockImplementation(async () => {
    if (resultOrThrow instanceof Error) throw resultOrThrow;
    return { result: resultOrThrow };
  }),
});

const baseOptions: Omit<CheckOptions, 'midnightProvider'> = {
  minimumBand: 'gold',
  purpose: 'governance',
  config: {
    midnightRpc: 'https://rpc.test',
    contractAddress: '0x' + '11'.repeat(32),
    network: 'preprod',
    chains: {},
  },
};

describe('checkReputation', () => {
  it('maps a gold decision correctly', async () => {
    const provider = makeProvider(mockDecisionRaw);
    const decision = await checkReputation('0x' + 'aa'.repeat(32), {
      ...baseOptions,
      midnightProvider: provider,
    });

    expect(decision.band).toBe('gold');
    expect(decision.meetsThreshold).toBe(true);
    expect(decision.communityWeight).toBe(1.5);   // 15000 / 10000
    expect(decision.accessTier).toBe(3);
    expect(decision.validAt).toBe(42);
    expect(decision.purpose).toBe('governance');
  });

  it('reflects meetsThreshold=false when band is below minimum', async () => {
    const provider = makeProvider({ ...mockDecisionRaw, band: 2n, meetsThreshold: false });
    const decision = await checkReputation('0x' + 'aa'.repeat(32), {
      ...baseOptions,
      minimumBand: 'gold',
      midnightProvider: provider,
    });
    expect(decision.meetsThreshold).toBe(false);
  });

  it('calls Reputation_check with the correct arguments', async () => {
    const provider = makeProvider(mockDecisionRaw);
    await checkReputation('0x' + 'bb'.repeat(32), {
      ...baseOptions,
      midnightProvider: provider,
    });
    expect(provider.callTx).toHaveBeenCalledWith(
      'Reputation_check',
      expect.any(Uint8Array), // veilIdHash
      expect.any(Uint8Array), // requesterAddressHash
      expect.any(Uint8Array), // purposeHash
      3n,                     // minimumBand (gold=3)
      expect.any(BigInt),     // currentEpoch
    );
  });
});

describe('batchCheckReputation', () => {
  it('returns decisions for all veilIds', async () => {
    const provider = makeProvider(mockDecisionRaw);
    const ids = ['0x' + 'aa'.repeat(32), '0x' + 'bb'.repeat(32)];
    const map = await batchCheckReputation(ids, { ...baseOptions, midnightProvider: provider });
    expect(map.size).toBe(2);
    expect(map.get(ids[0])?.band).toBe('gold');
  });

  it('returns unranked for failed individual checks', async () => {
    const provider = makeProvider(mockDecisionRaw);
    // Second call throws
    provider.callTx
      .mockResolvedValueOnce({ result: mockDecisionRaw })
      .mockRejectedValueOnce(new Error('not found'));

    const ids = ['0x' + 'aa'.repeat(32), '0x' + 'ff'.repeat(32)];
    const map = await batchCheckReputation(ids, { ...baseOptions, midnightProvider: provider });

    expect(map.get(ids[0])?.band).toBe('gold');
    expect(map.get(ids[1])?.band).toBe('unranked');
    expect(map.get(ids[1])?.meetsThreshold).toBe(false);
  });
});
