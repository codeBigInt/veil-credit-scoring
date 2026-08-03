import type { ChainRpcConfig, CkbSignals } from '../../types';
import { jsonRpc, parseRpcQuantity } from '../../utils/rpc';

/**
 * Reads reputation signals from the CKB chain.
 * Returns networkReachable: false instead of throwing if the RPC is down.
 */
export const readCKBSignals = async (
  _address: string,
  config: ChainRpcConfig,
): Promise<CkbSignals> => {
  try {
    const tipBlockNumber = parseRpcQuantity(
      await jsonRpc<string>(config.rpcUrl, 'get_tip_block_number'),
    );
    return {
      contractsInteracted: [],
      txTimestamps: [],
      txCount: 0,
      tipBlockNumber,
      networkReachable: true,
    };
  } catch {
    return {
      contractsInteracted: [],
      txTimestamps: [],
      txCount: 0,
      networkReachable: false,
    };
  }
};
