import type {
  CkbSignals,
  ReputationReaderOptions,
  ReputationSignalReader,
  ReputationWitness,
  VeilIdentity,
} from '../../types';
import type { ChainRpcConfig, VeilConfig } from '../../config';
import { hashChainState, randomBytes32 } from '../../utils/hash';
import { readEthereumSignals, computeConsistencyScore } from './ethereum';
import { readCKBSignals } from './ckb';

const emptyCkbSignals = (): CkbSignals => ({
  contractsInteracted: [],
  txTimestamps: [],
  txCount: 0,
  networkReachable: false,
});

const configuredEvmChains = (config: VeilConfig): ChainRpcConfig[] =>
  Object.entries(config.chains).reduce<ChainRpcConfig[]>((chains, [name, chain]) => {
    if (name !== 'ckb' && chain) chains.push(chain);
    return chains;
  }, []);

/**
 * Collects public on-chain data and builds a ReputationWitness.
 *
 * The witness is private input to the ZK circuit.
 * It is sent to the proof server and immediately discarded — never stored.
 */
export const collectReputationWitnessFromAddresses = async (
  evmAddress: string,
  ckbAddress: string,
  config: VeilConfig,
  readers: ReputationReaderOptions = {},
): Promise<ReputationWitness> => {
  const evmChains = configuredEvmChains(config);

  const [ethSignals, ckbSignals] = await Promise.all([
    (readers.ethereumReader ?? readEthereumSignals)(evmAddress, evmChains),
    config.chains.ckb
      ? (readers.ckbReader ?? readCKBSignals)(ckbAddress, config.chains.ckb)
      : Promise.resolve<CkbSignals>(emptyCkbSignals()),
  ]);

  const distinctProtocols = new Set([
    ...ethSignals.contractsInteracted,
    ...ckbSignals.contractsInteracted,
  ]).size;

  const oldestLpTimestamp =
    ethSignals.lpPositions.length > 0
      ? Math.min(...ethSignals.lpPositions.map((p) => p.createdAt))
      : 0;

  const allTimestamps = [...ethSignals.txTimestamps, ...ckbSignals.txTimestamps];
  const firstActivityTimestamp =
    allTimestamps.length > 0 ? Math.min(...allTimestamps) : ethSignals.firstTxTimestamp;

  const activeChains = ethSignals.activeChains + (ckbSignals.txCount > 0 ? 1 : 0);

  return {
    walletAgeInDays: Math.max(0, Math.floor((Date.now() - firstActivityTimestamp) / 86_400_000)),
    distinctProtocols,
    daoVoteCount: ethSignals.governanceVotes.length,
    lpTenureInDays:
      oldestLpTimestamp > 0
        ? Math.max(0, Math.floor((Date.now() - oldestLpTimestamp) / 86_400_000))
        : 0,
    crossChainCount: activeChains,
    txConsistencyScore: computeConsistencyScore(allTimestamps),
    ethChainCommitment: await hashChainState(ethSignals),
    ckbChainCommitment: await hashChainState(ckbSignals),
    salt: randomBytes32(),
  };
};

/**
 * Collects a ReputationWitness for a VeilIdentity.
 * Accepts an optional custom reader to replace the default chain reads
 * (useful for testing or when the consumer has their own indexer).
 */
export const collectReputationWitness = async (
  identity: VeilIdentity,
  config: VeilConfig,
  reader?: ReputationSignalReader,
): Promise<ReputationWitness> => {
  if (reader) return reader(identity, config);
  return collectReputationWitnessFromAddresses(identity.ckbAddress, identity.ckbAddress, config);
};
