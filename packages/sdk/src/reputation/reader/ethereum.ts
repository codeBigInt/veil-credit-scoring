import type { ChainRpcConfig, EthereumSignals, GovernanceVote, LPPosition } from '../../types';
import { VeilError } from '../../types';
import { jsonRpc, parseRpcQuantity } from '../../utils/rpc';

const emptyEthereumSignals = (): EthereumSignals => ({
  firstTxTimestamp: Date.now(),
  contractsInteracted: [],
  governanceVotes: [],
  lpPositions: [],
  txTimestamps: [],
  transactionCount: 0,
  activeChains: 0,
});

const readSingleChain = async (address: string, config: ChainRpcConfig): Promise<EthereumSignals> => {
  const transactionCount = parseRpcQuantity(
    await jsonRpc<string>(config.rpcUrl, 'eth_getTransactionCount', [address, 'latest']),
  );
  const now = Date.now();
  return {
    ...emptyEthereumSignals(),
    txTimestamps: transactionCount > 0 ? [now] : [],
    transactionCount,
    activeChains: transactionCount > 0 ? 1 : 0,
  };
};

/**
 * Reads reputation signals from Ethereum and EVM-compatible chains.
 * All data is public — no auth, no API keys from Veil.
 * Integrators provide their own RPC URLs in VeilConfig.
 *
 * A failed chain does not break the whole read — settled results are merged.
 */
export const readEthereumSignals = async (
  address: string,
  configs: ChainRpcConfig[],
): Promise<EthereumSignals> => {
  if (configs.length === 0) return emptyEthereumSignals();

  const settled = await Promise.allSettled(configs.map((config) => readSingleChain(address, config)));

  return settled.reduce<EthereumSignals>((acc, result) => {
    if (result.status === 'rejected') return acc;
    const value = result.value;
    return {
      firstTxTimestamp: Math.min(acc.firstTxTimestamp, value.firstTxTimestamp),
      contractsInteracted: [...new Set([...acc.contractsInteracted, ...value.contractsInteracted])],
      governanceVotes: [...acc.governanceVotes, ...value.governanceVotes],
      lpPositions: [...acc.lpPositions, ...value.lpPositions],
      txTimestamps: [...acc.txTimestamps, ...value.txTimestamps].sort((a, b) => a - b),
      transactionCount: acc.transactionCount + value.transactionCount,
      activeChains: acc.activeChains + value.activeChains,
    };
  }, emptyEthereumSignals());
};

/**
 * Measures regularity of on-chain activity over 90 days.
 * A real user has a natural spread; a script has burst patterns.
 * Returns 0–100 based on distinct active weeks out of 13.
 */
export const computeConsistencyScore = (txTimestamps: number[], now = Date.now()): number => {
  if (txTimestamps.length < 3) return 0;
  const ninetyDaysAgo = now - 90 * 24 * 60 * 60 * 1000;
  const recent = txTimestamps.filter((t) => t >= ninetyDaysAgo);
  if (recent.length < 3) return 0;
  const weeks = new Set(recent.map((t) => Math.floor(t / (7 * 24 * 60 * 60 * 1000))));
  return Math.min(100, Math.round((weeks.size / 13) * 100));
};
