// Browser-compatible ZKConfigProvider that fetches ZK artifacts from a remote URL.
// Replaces @midnight-ntwrk/midnight-js-node-zk-config-provider for browser contexts.
//
// The proof server (Midnight's Rust ZK prover at localhost:6300) uses these artifacts:
//   {baseUrl}/keys/{circuitId}.prover   — prover key for the circuit
//   {baseUrl}/keys/{circuitId}.verifier — verifier key for the circuit
//   {baseUrl}/zkir/{circuitId}.bzkir    — ZKIR bytecode for the circuit
//
// Veil hosts these at https://zk.veil.network/{network}/veil-protocol/
// Artifacts are cached in memory after the first fetch (they never change for a given deployment).

import {
  ZKConfigProvider,
  createProverKey,
  createVerifierKey,
  createZKIR,
  type ProverKey,
  type VerifierKey,
  type ZKIR,
} from '@midnight-ntwrk/midnight-js-types';

export class FetchZkConfigProvider<K extends string> extends ZKConfigProvider<K> {
  private readonly cache = new Map<string, Uint8Array>();

  constructor(private readonly baseUrl: string) {
    super();
    // Normalize: strip trailing slash
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async getProverKey(circuitId: K): Promise<ProverKey> {
    const data = await this.fetchArtifact(`keys/${circuitId}.prover`);
    return createProverKey(data);
  }

  async getVerifierKey(circuitId: K): Promise<VerifierKey> {
    const data = await this.fetchArtifact(`keys/${circuitId}.verifier`);
    return createVerifierKey(data);
  }

  async getZKIR(circuitId: K): Promise<ZKIR> {
    const data = await this.fetchArtifact(`zkir/${circuitId}.bzkir`);
    return createZKIR(data);
  }

  private async fetchArtifact(relativePath: string): Promise<Uint8Array> {
    const url = `${this.baseUrl}/${relativePath}`;
    const cached = this.cache.get(url);
    if (cached) return cached;

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(
        `Failed to fetch ZK artifact from ${url}: HTTP ${res.status} ${res.statusText}. ` +
          `Ensure zkArtifactsBaseUrl in VeilConfig points to a directory hosting the compiled ZK keys.`,
      );
    }

    const buffer = await res.arrayBuffer();
    const data = new Uint8Array(buffer);
    this.cache.set(url, data);
    return data;
  }
}
