import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { collectReputationWitnessFromAddresses } from '../../../../reputation/reader';
import {
  readerTestVectors,
  type RpcMock,
} from '../../../../reputation/reader/policies/veil.default-rpc.v1/test-vectors';

/**
 * Runs the SPEC.md-documented conformance vectors for `veil.default-rpc.v1`
 * against the real reader implementation. A failure here means either the
 * reader's behavior drifted from what's documented, or the vectors are
 * stale — in either case, resolve it by updating SPEC.md and test-vectors.ts
 * together, per the "Conformance" section of the spec.
 */
describe('reader policy veil.default-rpc.v1 — conformance', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockResponseFor = (mock: RpcMock | undefined) =>
    mock
      ? Promise.resolve(
          new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: mock.result }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      : Promise.reject(new Error('simulated unreachable RPC endpoint'));

  for (const vector of readerTestVectors) {
    it(`${vector.name} — ${vector.description}`, async () => {
      mockFetch.mockImplementation((url: string) => mockResponseFor(vector.rpcMocks[url]));

      const witness = await collectReputationWitnessFromAddresses('0xevmaddress', 'ckbaddress', vector.config);

      expect(witness.walletAgeInDays).toBe(vector.expected.walletAgeInDays);
      expect(witness.distinctProtocols).toBe(vector.expected.distinctProtocols);
      expect(witness.daoVoteCount).toBe(vector.expected.daoVoteCount);
      expect(witness.lpTenureInDays).toBe(vector.expected.lpTenureInDays);
      expect(witness.crossChainCount).toBe(vector.expected.crossChainCount);
      expect(witness.txConsistencyScore).toBe(vector.expected.txConsistencyScore);
    });
  }
});
