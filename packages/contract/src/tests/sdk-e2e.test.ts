/**
 * SDK × Contract E2E tests
 *
 * These tests run the SDK's high-level functions (registerIdentity,
 * checkReputation, etc.) against the in-process VeilScoreSimulator, with no
 * running Midnight node or proof server required.
 *
 * SimulatorProvider adapts VeilMidnightProvider's callTx dispatch
 * to the simulator's typed methods, giving full circuit coverage.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { randomBytes } from './utils';
import { VeilScoreSimulator, defaultReaderPolicyHash } from './veil-score-setup';
import {
  buildIdentityRegistrationArgs,
  buildReputationCheckArgs,
  buildReputationProofArgs,
  checkReputation,
  batchCheckReputation,
  padStringToBytes32,
  bytesToHex,
} from '@veil-reputation-protocol/sdk';
import type { VeilMidnightProvider, VeilConfig } from '@veil-reputation-protocol/sdk';

// ─── SimulatorProvider ────────────────────────────────────────────────────────

class SimulatorProvider implements VeilMidnightProvider {
  constructor(private readonly sim: VeilScoreSimulator) {}

  async callTx(circuit: string, ...args: unknown[]): Promise<unknown> {
    switch (circuit) {
      case 'Identity_register':
        return this.sim.registerIdentity(
          args[0] as Uint8Array,
          args[1] as Uint8Array,
          args[2] as Uint8Array,
          args[3] as Uint8Array,
        );

      case 'Identity_assertActive': {
        const ok = this.sim.assertIdentityActive(args[0] as Uint8Array);
        if (!ok) throw new Error('Identity not found or inactive');
        return ok;
      }

      case 'Reputation_prove':
        // buildReputationProofArgs order:
        // [veilId, age, protocols, votes, lp, crossChain, consistency,
        //  chainNamespace, chainCommitment, readerPolicyHash, salt, proofNonce]
        return this.sim.proveReputation(args[0] as Uint8Array, {
          walletAgeInDays:   args[1] as bigint,
          distinctProtocols: args[2] as bigint,
          daoVoteCount:      args[3] as bigint,
          lpTenureInDays:    args[4] as bigint,
          crossChainCount:   args[5] as bigint,
          txConsistencyScore: args[6] as bigint,
          chainNamespace:     args[7] as Uint8Array,
          chainCommitment:    args[8] as Uint8Array,
          readerPolicyHash:  args[9] as Uint8Array,
          witnessSalt:       args[10] as Uint8Array,
          proofNonce:        args[11] as Uint8Array,
        });

      case 'Reputation_check':
        // buildReputationCheckArgs order:
        // [veilId, requesterHash, purposeHash, minimumBand]
        return this.sim.checkReputation(
          args[0] as Uint8Array, // veilIdHash
          args[3] as bigint,     // minimumBand
          args[2] as Uint8Array, // purposeHash
          args[1] as Uint8Array, // requesterAddressHash
        );

      default:
        throw new Error(`SimulatorProvider: unhandled circuit "${circuit}"`);
    }
  }
}

// ─── Test config ──────────────────────────────────────────────────────────────

const config: VeilConfig = {
  midnightRpc: 'unused-in-simulator',
  contractAddress: '0x' + '00'.repeat(32),
  network: 'preprod',
  chains: {},
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SDK × Contract E2E', () => {
  let sim: VeilScoreSimulator;
  let provider: SimulatorProvider;
  let veilIdHash: Uint8Array;

  beforeEach(() => {
    sim = VeilScoreSimulator.deploy();
    provider = new SimulatorProvider(sim);
    veilIdHash = randomBytes(32);
  });

  describe('identity registration', () => {
    it('registers successfully and resolves as active', async () => {
      const chainNamespace = padStringToBytes32('evm');
      const lockHashCommitment = randomBytes(32);
      const walletSignatureHash = randomBytes(32);

      await provider.callTx(
        'Identity_register',
        ...buildIdentityRegistrationArgs({
          veilIdHash,
          chainNamespace,
          publicKeyOrLockHashCommitment: lockHashCommitment,
          walletSignatureHash,
        }),
      );

      // Assert active — should not throw
      await expect(
        provider.callTx('Identity_assertActive', veilIdHash),
      ).resolves.toBeTruthy();

      // Ledger state reflects the registration
      const record = sim.getIdentityRecord(veilIdHash);
      expect(record.status).toBe(1n);
    });

    it('rejects duplicate registration', async () => {
      const ns = padStringToBytes32('evm');
      const lock = randomBytes(32);
      const sig = randomBytes(32);

      await provider.callTx(
        'Identity_register',
        ...buildIdentityRegistrationArgs({ veilIdHash, chainNamespace: ns, publicKeyOrLockHashCommitment: lock, walletSignatureHash: sig }),
      );

      await expect(
        provider.callTx(
          'Identity_register',
          ...buildIdentityRegistrationArgs({ veilIdHash, chainNamespace: ns, publicKeyOrLockHashCommitment: lock, walletSignatureHash: sig }),
        ),
      ).rejects.toThrow(/already registered/i);
    });
  });

  describe('reputation proof and check', () => {
    // Score = 300 (base) + 50*3 + 5*15 + 3*20 + 10*10 + 1*25 + 10*5
    //       = 300 + 150 + 75 + 60 + 100 + 25 + 50 = 760  (gold: 700–819)
    const signals = {
      walletAgeInDays:    50n,
      distinctProtocols:  5n,
      daoVoteCount:       3n,
      lpTenureInDays:     10n,
      crossChainCount:    1n,
      txConsistencyScore: 10n,
      readerPolicyHash: defaultReaderPolicyHash,
      // Score = 760 → gold, derived by the contract from these signals.
    };

    beforeEach(async () => {
      // Register first
      const ns = padStringToBytes32('evm');
      const lock = randomBytes(32);
      const sig = randomBytes(32);
      await provider.callTx(
        'Identity_register',
        ...buildIdentityRegistrationArgs({ veilIdHash, chainNamespace: ns, publicKeyOrLockHashCommitment: lock, walletSignatureHash: sig }),
      );
    });

    it('proves reputation and stores band commitment on-chain', async () => {
      const chainNamespace = padStringToBytes32('evm');
      const chainCommitment = randomBytes(32);
      const witnessSalt   = randomBytes(32);
      const proofNonce    = randomBytes(32);

      const band = await provider.callTx(
        'Reputation_prove',
        ...buildReputationProofArgs({
          veilIdHash,
          ...signals,
          chainNamespace,
          chainCommitment,
          witnessSalt,
          proofNonce,
        }),
      );

      expect(band).toBe(3n); // gold
      expect(sim.getLedgerState().LedgerStates_reputationCommitments.firstFree()).toBe(1n);
    });

    it('rejects a proof built with an unregistered reader policy', async () => {
      const chainNamespace = padStringToBytes32('evm');
      const chainCommitment = randomBytes(32);
      const witnessSalt = randomBytes(32);
      const proofNonce = randomBytes(32);

      await expect(
        provider.callTx(
          'Reputation_prove',
          ...buildReputationProofArgs({
            veilIdHash,
            ...signals,
            readerPolicyHash: randomBytes(32), // never registered via governance
            chainNamespace,
            chainCommitment,
            witnessSalt,
            proofNonce,
          }),
        ),
      ).rejects.toThrow(/Untrusted reader policy/);
    });

    it('checkReputation SDK function correctly interprets a gold decision', async () => {
      // Prove first
      const chainNamespace = padStringToBytes32('evm');
      const chainCommitment = randomBytes(32);
      const salt = randomBytes(32);
      const nonce = randomBytes(32);
      await provider.callTx('Reputation_prove', ...buildReputationProofArgs({ veilIdHash, ...signals, chainNamespace, chainCommitment, witnessSalt: salt, proofNonce: nonce }));

      // Now check via SDK
      const decision = await checkReputation(bytesToHex(veilIdHash), {
        minimumBand: 'silver',
        purpose: 'governance',
        midnightProvider: provider,
        config,
      });

      expect(decision.band).toBe('gold');
      expect(decision.meetsThreshold).toBe(true);
      expect(decision.communityWeight).toBe(1.5);
      expect(decision.accessTier).toBe(3);
    });

    it('fails check for a higher band requirement', async () => {
      const chainNamespace = padStringToBytes32('evm');
      const chainCommitment = randomBytes(32);
      const salt = randomBytes(32);
      const nonce = randomBytes(32);
      await provider.callTx('Reputation_prove', ...buildReputationProofArgs({ veilIdHash, ...signals, chainNamespace, chainCommitment, witnessSalt: salt, proofNonce: nonce }));

      const decision = await checkReputation(bytesToHex(veilIdHash), {
        minimumBand: 'platinum',
        purpose: 'airdrop',
        midnightProvider: provider,
        config,
      });

      expect(decision.band).toBe('gold');
      expect(decision.meetsThreshold).toBe(false);
    });
  });

  describe('batchCheckReputation', () => {
    it('returns correct decisions for multiple registered users', async () => {
      const ids = [randomBytes(32), randomBytes(32)];

      for (const id of ids) {
        const ns = padStringToBytes32('evm');
        const lock = randomBytes(32);
        const sig = randomBytes(32);
        await provider.callTx('Identity_register', ...buildIdentityRegistrationArgs({ veilIdHash: id, chainNamespace: ns, publicKeyOrLockHashCommitment: lock, walletSignatureHash: sig }));

        const chainNamespace = padStringToBytes32('evm');
        const chainCommitment = randomBytes(32);
        const salt = randomBytes(32);
        const nonce = randomBytes(32);
        await provider.callTx('Reputation_prove', ...buildReputationProofArgs({ veilIdHash: id, walletAgeInDays: 50n, distinctProtocols: 5n, daoVoteCount: 3n, lpTenureInDays: 10n, crossChainCount: 1n, txConsistencyScore: 10n, chainNamespace, chainCommitment, readerPolicyHash: defaultReaderPolicyHash, witnessSalt: salt, proofNonce: nonce }));
      }

      const map = await batchCheckReputation(
        ids.map(bytesToHex),
        {
          minimumBand: 'silver',
          purpose: 'governance',
          midnightProvider: provider,
          config,
        },
      );

      expect(map.size).toBe(2);
      for (const decision of map.values()) {
        expect(decision.band).toBe('gold');
        expect(decision.meetsThreshold).toBe(true);
      }
    });
  });
});
