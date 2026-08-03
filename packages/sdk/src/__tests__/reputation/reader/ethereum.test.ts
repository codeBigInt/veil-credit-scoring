import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readEthereumSignals, computeConsistencyScore } from '../../../reputation/reader/ethereum';
import type { ChainRpcConfig } from '../../../config';

const makeRpcResponse = (transactionCount: number) =>
  Promise.resolve(
    new Response(
      JSON.stringify({ jsonrpc: '2.0', id: 1, result: `0x${transactionCount.toString(16)}` }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ),
  );

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
});

const chain: ChainRpcConfig = { rpcUrl: 'https://rpc.test', chainId: 1 };

describe('readEthereumSignals', () => {
  it('returns empty signals when no chains are configured', async () => {
    const signals = await readEthereumSignals('0xabc', []);
    expect(signals.transactionCount).toBe(0);
    expect(signals.contractsInteracted).toHaveLength(0);
  });

  it('reads transaction count from a single chain', async () => {
    mockFetch.mockResolvedValueOnce(makeRpcResponse(42));
    const signals = await readEthereumSignals('0xabc', [chain]);
    expect(signals.transactionCount).toBe(42);
    expect(signals.activeChains).toBe(1);
  });

  it('skips a failed chain gracefully', async () => {
    mockFetch
      .mockResolvedValueOnce(makeRpcResponse(5))
      .mockRejectedValueOnce(new Error('Network error'));
    const [good, bad]: ChainRpcConfig[] = [
      { rpcUrl: 'https://good.rpc' },
      { rpcUrl: 'https://bad.rpc' },
    ];
    const signals = await readEthereumSignals('0xabc', [good, bad]);
    expect(signals.transactionCount).toBe(5);
    expect(signals.activeChains).toBe(1);
  });

  it('marks activeChains as 0 for a wallet with no transactions', async () => {
    mockFetch.mockResolvedValueOnce(makeRpcResponse(0));
    const signals = await readEthereumSignals('0xabc', [chain]);
    expect(signals.activeChains).toBe(0);
    expect(signals.txTimestamps).toHaveLength(0);
  });
});

describe('computeConsistencyScore', () => {
  it('returns 0 for fewer than 3 timestamps', () => {
    expect(computeConsistencyScore([])).toBe(0);
    expect(computeConsistencyScore([Date.now()])).toBe(0);
    expect(computeConsistencyScore([Date.now(), Date.now()])).toBe(0);
  });

  it('returns 0 when all 3 timestamps are older than 90 days', () => {
    const old = Date.now() - 100 * 24 * 60 * 60 * 1000;
    expect(computeConsistencyScore([old, old, old])).toBe(0);
  });

  it('returns a higher score for spread-out activity', () => {
    const now = Date.now();
    // One tx per week for 13 weeks → 13 distinct weeks → score 100
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    const timestamps = Array.from({ length: 13 }, (_, i) => now - i * weekMs);
    expect(computeConsistencyScore(timestamps, now)).toBe(100);
  });

  it('returns a lower score for burst activity in a single week', () => {
    const now = Date.now();
    // 10 txs all in the same week
    const timestamps = Array.from({ length: 10 }, () => now - 3 * 24 * 60 * 60 * 1000);
    const score = computeConsistencyScore(timestamps, now);
    expect(score).toBeLessThan(50);
  });

  it('caps at 100', () => {
    const now = Date.now();
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    // More weeks than max — still capped at 100
    const timestamps = Array.from({ length: 100 }, (_, i) => now - i * weekMs * 0.5);
    expect(computeConsistencyScore(timestamps, now)).toBe(100);
  });
});
