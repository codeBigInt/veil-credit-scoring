export interface ChainRpcConfig {
  rpcUrl: string;
  chainId?: number;
}

export interface VeilConfig {
  /** Midnight indexer HTTP URL. Defaults to the public network endpoint when omitted. */
  midnightRpc?: string;
  /** Address of the deployed Veil contract on the Midnight network. */
  contractAddress: string;
  /** Midnight proof server URL (Rust ZK prover Docker container). Default: http://localhost:6300 */
  proofServerUrl?: string;
  /** Veil fee-sponsor service URL for DUST sponsorship. */
  feeSponsorUrl?: string;
  chains: {
    ethereum?: ChainRpcConfig;
    arbitrum?: ChainRpcConfig;
    base?: ChainRpcConfig;
    optimism?: ChainRpcConfig;
    ckb?: ChainRpcConfig;
    [key: string]: ChainRpcConfig | undefined;
  };
  network: 'preview' | 'preprod' | 'mainnet';

  // ── Fields used by createDerivedProvider ──────────────────────────────────

  /**
   * WebSocket URL for the Midnight indexer.
   * Defaults to the standard wss:// endpoint for the selected network.
   * Example: "wss://indexer.preprod.midnight.network/api/v4/graphql/ws"
   */
  midnightIndexerWsUrl?: string;

  /**
   * WebSocket URL for the Midnight relay node (used for tx submission).
   * Defaults to the standard wss:// endpoint for the selected network.
   * Example: "wss://rpc.preprod.midnight.network"
   */
  midnightNodeWsUrl?: string;

  /**
   * Base URL where compiled Veil ZK artifacts are hosted.
   * Required for createDerivedProvider. The provider fetches:
   *   {zkArtifactsBaseUrl}/keys/{circuitId}.prover
   *   {zkArtifactsBaseUrl}/keys/{circuitId}.verifier
   *   {zkArtifactsBaseUrl}/zkir/{circuitId}.bzkir
   * Example: "https://zk.veil.network/preprod/veil-protocol"
   */
  zkArtifactsBaseUrl?: string;
}

// proofServerUrl in VeilConfig is passed to the nite-api provider constructor by the integrator.
// The SDK itself never calls the proof server — nite-api handles that internally via callTx.
export const DEFAULT_FEE_SPONSOR = 'https://sponsor.veil.network';
