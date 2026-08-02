import type { VeilConfig } from '../../../../config';

/**
 * A single canned JSON-RPC response, keyed by the exact RPC URL that should
 * receive it. The conformance test mocks `fetch` to return these instead of
 * making real network calls.
 */
export interface RpcMock {
  method: string;
  result?: unknown;
}

export interface ReaderTestVector {
  name: string;
  description: string;
  config: VeilConfig;
  /** Canned RPC response per configured RPC URL. Omit a URL to simulate an unreachable endpoint. */
  rpcMocks: Record<string, RpcMock>;
  expected: {
    walletAgeInDays: number;
    distinctProtocols: number;
    daoVoteCount: number;
    lpTenureInDays: number;
    crossChainCount: number;
    txConsistencyScore: number;
  };
}

const baseConfig = (chains: VeilConfig['chains']): VeilConfig => ({
  contractAddress: '0x' + '00'.repeat(32),
  network: 'preview',
  chains,
});

/**
 * Conformance vectors for reader policy `veil.default-rpc.v1`.
 * See SPEC.md in this directory before changing any of these — a change
 * here should mean the policy itself has changed, not just the test.
 */
export const readerTestVectors: ReaderTestVector[] = [
  {
    name: 'no chains configured',
    description: 'With nothing in VeilConfig.chains, every signal defaults to zero.',
    config: baseConfig({}),
    rpcMocks: {},
    expected: {
      walletAgeInDays: 0,
      distinctProtocols: 0,
      daoVoteCount: 0,
      lpTenureInDays: 0,
      crossChainCount: 0,
      txConsistencyScore: 0,
    },
  },
  {
    name: 'single EVM chain, wallet has sent transactions',
    description:
      'eth_getTransactionCount > 0 is the one condition the default reader actually measures — it sets crossChainCount to 1. Every other signal still reads zero, per SPEC.md.',
    config: baseConfig({ ethereum: { rpcUrl: 'https://eth.test', chainId: 1 } }),
    rpcMocks: {
      'https://eth.test': { method: 'eth_getTransactionCount', result: '0x5' },
    },
    expected: {
      walletAgeInDays: 0,
      distinctProtocols: 0,
      daoVoteCount: 0,
      lpTenureInDays: 0,
      crossChainCount: 1,
      txConsistencyScore: 0,
    },
  },
  {
    name: 'single EVM chain, wallet has never transacted',
    description: 'eth_getTransactionCount returns 0, so crossChainCount stays 0 too.',
    config: baseConfig({ ethereum: { rpcUrl: 'https://eth.test', chainId: 1 } }),
    rpcMocks: {
      'https://eth.test': { method: 'eth_getTransactionCount', result: '0x0' },
    },
    expected: {
      walletAgeInDays: 0,
      distinctProtocols: 0,
      daoVoteCount: 0,
      lpTenureInDays: 0,
      crossChainCount: 0,
      txConsistencyScore: 0,
    },
  },
  {
    name: 'two EVM chains, one unreachable',
    description:
      'A failed chain is dropped, not fatal — Promise.allSettled merges only the chains that succeeded. Only the reachable, active chain counts.',
    config: baseConfig({
      ethereum: { rpcUrl: 'https://eth.test', chainId: 1 },
      base: { rpcUrl: 'https://base.unreachable.test', chainId: 8453 },
    }),
    rpcMocks: {
      'https://eth.test': { method: 'eth_getTransactionCount', result: '0x2' },
      // 'https://base.unreachable.test' intentionally has no mock — the conformance
      // test makes this URL reject, simulating a down RPC endpoint.
    },
    expected: {
      walletAgeInDays: 0,
      distinctProtocols: 0,
      daoVoteCount: 0,
      lpTenureInDays: 0,
      crossChainCount: 1,
      txConsistencyScore: 0,
    },
  },
  {
    name: 'CKB configured alongside an active EVM chain — CKB never contributes',
    description:
      'readCKBSignals only checks the tip block number, never the address itself, so a reachable CKB RPC adds nothing to any signal. This vector exists specifically to pin that limitation down.',
    config: baseConfig({
      ethereum: { rpcUrl: 'https://eth.test', chainId: 1 },
      ckb: { rpcUrl: 'https://ckb.test' },
    }),
    rpcMocks: {
      'https://eth.test': { method: 'eth_getTransactionCount', result: '0x1' },
      'https://ckb.test': { method: 'get_tip_block_number', result: '0x64' },
    },
    expected: {
      walletAgeInDays: 0,
      distinctProtocols: 0,
      daoVoteCount: 0,
      lpTenureInDays: 0,
      crossChainCount: 1, // from ethereum only
      txConsistencyScore: 0,
    },
  },
];
