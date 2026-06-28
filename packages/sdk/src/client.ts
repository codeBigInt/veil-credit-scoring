import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';

import type {
  CCCSigner,
  CheckOptions,
  RegistrationResult,
  ReputationDecision,
  ReputationProof,
  ReputationSignalReader,
  ReputationWitness,
  VeilIdentity,
  VeilMidnightProvider,
  BytesLike,
} from './types';
import type { VeilConfig } from './config';
import { buildIdentityFromSigner } from './identity/derive';
import { registerIdentity } from './identity/register';
import { resolveIdentityState, type IdentityState } from './identity/resolve';
import type { ReputationReaderOptions } from './types';
import { collectReputationWitness, collectReputationWitnessFromAddresses } from './reputation/reader';
import { proveReputation } from './reputation/prove';
import { checkReputation, batchCheckReputation } from './check';

export class VeilClient {
  constructor(
    private readonly config: VeilConfig,
    private readonly midnightProvider: VeilMidnightProvider,
    private readonly options: {
      deriveLockHashFromAddress?: (ckbAddress: string) => BytesLike;
      reputationReader?: ReputationSignalReader;
      reputationReaders?: ReputationReaderOptions;
    } = {},
  ) {
    setNetworkId(config.network);
  }

  /**
   * Derives a VeilIdentity from any CCC-compatible signer.
   * Does NOT submit anything — just derives the identity object locally.
   * Use this to show the user their veilId before they register.
   */
  deriveIdentity(signer: CCCSigner): Promise<VeilIdentity> {
    return buildIdentityFromSigner(signer, {
      deriveLockHashFromAddress: this.options.deriveLockHashFromAddress,
    });
  }

  /**
   * Checks on-chain whether a veilId is currently registered.
   * Read-only — no transaction submitted.
   */
  resolveIdentityState(veilId: string): Promise<IdentityState | null> {
    return resolveIdentityState(veilId, this.midnightProvider);
  }

  /**
   * Registers the user's identity on Midnight. Idempotent.
   * Prompts one wallet signature and submits the Identity_register circuit.
   */
  async register(signer: CCCSigner): Promise<RegistrationResult> {
    const identity = await this.deriveIdentity(signer);
    return registerIdentity(identity, signer, this.config, this.midnightProvider);
  }

  /**
   * Collects the user's on-chain reputation signals and submits a ZK proof to Midnight.
   * Updates the user's score commitment. Call this after register().
   */
  async proveReputation(signer: CCCSigner): Promise<ReputationProof> {
    const identity = await this.deriveIdentity(signer);

    const witness: ReputationWitness = this.options.reputationReader
      ? await collectReputationWitness(identity, this.config, this.options.reputationReader)
      : await collectReputationWitnessFromAddresses(
          (await signer.getEvmAddress?.()) ?? identity.ckbAddress,
          identity.ckbAddress,
          this.config,
          this.options.reputationReaders,
        );

    return proveReputation(identity, witness, this.config, this.midnightProvider);
  }

  /**
   * Checks a veilId's reputation against a threshold.
   * Direct Midnight read — no Veil backend involved.
   */
  checkReputation(
    veilId: string,
    options: Omit<CheckOptions, 'midnightProvider' | 'config'>,
  ): Promise<ReputationDecision> {
    return checkReputation(veilId, {
      ...options,
      midnightProvider: this.midnightProvider,
      config: this.config,
    });
  }

  /**
   * Batch check for multiple veilIds. Failed checks return "unranked".
   * Use for airdrop filtering.
   */
  batchCheck(
    veilIds: string[],
    options: Omit<CheckOptions, 'midnightProvider' | 'config'>,
  ): Promise<Map<string, ReputationDecision>> {
    return batchCheckReputation(veilIds, {
      ...options,
      midnightProvider: this.midnightProvider,
      config: this.config,
    });
  }
}
