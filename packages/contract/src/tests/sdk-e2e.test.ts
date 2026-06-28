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
import { VeilScoreSimulator } from './veil-score-setup';
import {
  buildIdentityRegistrationArgs,
  buildReputationCheckArgs,
  buildReputationProofArgs,
  deriveReputationWitnessCommitment,
  extractCircuitResult,
  BAND_ORDER,
  bandMeetsMinimum,
  checkReputation,
  batchCheckReputation,
  toBytes32,
  padStringToBytes32,
  bytesToHex,
} from '@veil-protocol/sdk';
import type { VeilMidnightProvider, VeilConfig } from '@veil-protocol/sdk';

// ─── SimulatorProvider ────────────────────────────────────────────────────────

class SimulatorProvider implements VeilMidnightProvider {
  constructor(private readonly sim: VeilScoreSimulator) {}

  async callTx(circuit: string, ...args: unknown[]): Promise<unknown> {
    switch (circuit) {
      case 'Utils_deriveIdentityProofHash':
        return this.sim.deriveIdentityProofHash(
          args[0] as Uint8Array,
          args[1] as Uint8Array,
          args[2] as Uint8Array,
          args[3] as Uint8Array,
        );

      case 'Identity_register':
        return this.sim.registerIdentity(
          args[0] as Uint8Array,
          args[1] as Uint8Array,
          args[2] as Uint8Array,
          args[3] as Uint8Array,
          args[4] as Uint8Array,
          args[5] as bigint,
        );

      case 'Identity_assertActive': {
        const ok = this.sim.assertIdentityActive(args[0] as Uint8Array);
        if (!ok) throw new Error('Identity not found or inactive');
        return ok;
      }

      case 'Utils_deriveReputationProofHash':
        return this.sim.deriveReputationProofHash(
          args[0] as Uint8Array,
          args[1] as Uint8Array,
          args[2] as bigint,
          args[3] as Uint8Array,
        );

      case 'Reputation_prove':
        // buildReputationProofArgs order:
        // [veilId, age, protocols, votes, lp, crossChain, consistency,
        //  claimedBand, ethCommitment, ckbCommitment, salt,
        //  witnessCommitment, proofNonce, proofHash, epoch]
        return this.sim.proveReputation(args[0] as Uint8Array, {
          walletAgeInDays:   args[1] as bigint,
          distinctProtocols: args[2] as bigint,
          daoVoteCount:      args[3] as bigint,
          lpTenureInDays:    args[4] as bigint,
          crossChainCount:   args[5] as bigint,
          txConsistencyScore: args[6] as bigint,
          claimedBand:       args[7] as bigint,
          ethChainCommitment: args[8] as Uint8Array,
          ckbChainCommitment: args[9] as Uint8Array,
          witnessSalt:       args[10] as Uint8Array,
          witnessCommitment: args[11] as Uint8Array,
          proofNonce:        args[12] as Uint8Array,
          proofHash:         args[13] as Uint8Array,
          currentEpoch:      args[14] as bigint,
        });

      case 'Reputation_check':
        // buildReputationCheckArgs order:
        // [veilId, requesterHash, purposeHash, minimumBand, epoch]
        return this.sim.checkReputation(
          args[0] as Uint8Array, // veilIdHash
          args[3] as bigint,     // minimumBand
          args[2] as Uint8Array, // purposeHash
          args[1] as Uint8Array, // requesterAddressHash
          args[4] as bigint,     // currentEpoch
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

      // Derive proof hash via the contract (as the SDK does internally)
      const chainProofHash = await provider.callTx(
        'Utils_deriveIdentityProofHash',
        veilIdHash,
        chainNamespace,
        lockHashCommitment,
        walletSignatureHash,
      ) as Uint8Array;

      await provider.callTx(
        'Identity_register',
        ...buildIdentityRegistrationArgs({
          veilIdHash,
          chainNamespace,
          publicKeyOrLockHashCommitment: lockHashCommitment,
          walletSignatureHash,
          chainProofHash,
          currentEpoch: 1n,
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
      const proofHash = await provider.callTx('Utils_deriveIdentityProofHash', veilIdHash, ns, lock, sig) as Uint8Array;

      await provider.callTx(
        'Identity_register',
        ...buildIdentityRegistrationArgs({ veilIdHash, chainNamespace: ns, publicKeyOrLockHashCommitment: lock, walletSignatureHash: sig, chainProofHash: proofHash, currentEpoch: 1n }),
      );

      await expect(
        provider.callTx(
          'Identity_register',
          ...buildIdentityRegistrationArgs({ veilIdHash, chainNamespace: ns, publicKeyOrLockHashCommitment: lock, walletSignatureHash: sig, chainProofHash: proofHash, currentEpoch: 2n }),
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
      claimedBand:        3n, // gold
    };

    beforeEach(async () => {
      // Register first
      const ns = padStringToBytes32('evm');
      const lock = randomBytes(32);
      const sig = randomBytes(32);
      const proofHash = await provider.callTx('Utils_deriveIdentityProofHash', veilIdHash, ns, lock, sig) as Uint8Array;
      await provider.callTx(
        'Identity_register',
        ...buildIdentityRegistrationArgs({ veilIdHash, chainNamespace: ns, publicKeyOrLockHashCommitment: lock, walletSignatureHash: sig, chainProofHash: proofHash, currentEpoch: 1n }),
      );
    });

    it('proves reputation and stores band commitment on-chain', async () => {
      const ethCommitment = randomBytes(32);
      const ckbCommitment = randomBytes(32);
      const witnessSalt   = randomBytes(32);
      const proofNonce    = randomBytes(32);

      const witnessCommitment = deriveReputationWitnessCommitment(
        veilIdHash,
        signals.walletAgeInDays,
        signals.distinctProtocols,
        signals.daoVoteCount,
        signals.lpTenureInDays,
        signals.crossChainCount,
        signals.txConsistencyScore,
        ethCommitment,
        ckbCommitment,
        witnessSalt,
      );

      const proofHash = await provider.callTx(
        'Utils_deriveReputationProofHash',
        veilIdHash,
        witnessCommitment,
        signals.claimedBand,
        proofNonce,
      ) as Uint8Array;

      const band = await provider.callTx(
        'Reputation_prove',
        ...buildReputationProofArgs({
          veilIdHash,
          ...signals,
          ethChainCommitment: ethCommitment,
          ckbChainCommitment: ckbCommitment,
          witnessSalt,
          witnessCommitment,
          proofNonce,
          proofHash,
          currentEpoch: 2n,
        }),
      );

      expect(band).toBe(3n); // gold
      expect(sim.getLedgerState().LedgerStates_reputationCommitments.firstFree()).toBe(1n);
    });

    it('checkReputation SDK function correctly interprets a gold decision', async () => {
      // Prove first
      const ethC = randomBytes(32);
      const ckbC = randomBytes(32);
      const salt = randomBytes(32);
      const nonce = randomBytes(32);
      const wc = deriveReputationWitnessCommitment(veilIdHash, signals.walletAgeInDays, signals.distinctProtocols, signals.daoVoteCount, signals.lpTenureInDays, signals.crossChainCount, signals.txConsistencyScore, ethC, ckbC, salt);
      const ph = await provider.callTx('Utils_deriveReputationProofHash', veilIdHash, wc, signals.claimedBand, nonce) as Uint8Array;
      await provider.callTx('Reputation_prove', ...buildReputationProofArgs({ veilIdHash, ...signals, ethChainCommitment: ethC, ckbChainCommitment: ckbC, witnessSalt: salt, witnessCommitment: wc, proofNonce: nonce, proofHash: ph, currentEpoch: 2n }));

      // Now check via SDK
      const decision = await checkReputation(bytesToHex(veilIdHash), {
        minimumBand: 'silver',
        purpose: 'governance',
        midnightProvider: provider,
        config,
        currentEpoch: 3n,
      });

      expect(decision.band).toBe('gold');
      expect(decision.meetsThreshold).toBe(true);
      expect(decision.communityWeight).toBe(1.5);
      expect(decision.accessTier).toBe(3);
    });

    it('fails check for a higher band requirement', async () => {
      const ethC = randomBytes(32);
      const ckbC = randomBytes(32);
      const salt = randomBytes(32);
      const nonce = randomBytes(32);
      const wc = deriveReputationWitnessCommitment(veilIdHash, signals.walletAgeInDays, signals.distinctProtocols, signals.daoVoteCount, signals.lpTenureInDays, signals.crossChainCount, signals.txConsistencyScore, ethC, ckbC, salt);
      const ph = await provider.callTx('Utils_deriveReputationProofHash', veilIdHash, wc, signals.claimedBand, nonce) as Uint8Array;
      await provider.callTx('Reputation_prove', ...buildReputationProofArgs({ veilIdHash, ...signals, ethChainCommitment: ethC, ckbChainCommitment: ckbC, witnessSalt: salt, witnessCommitment: wc, proofNonce: nonce, proofHash: ph, currentEpoch: 2n }));

      const decision = await checkReputation(bytesToHex(veilIdHash), {
        minimumBand: 'platinum',
        purpose: 'airdrop',
        midnightProvider: provider,
        config,
        currentEpoch: 3n,
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
        const ph = await provider.callTx('Utils_deriveIdentityProofHash', id, ns, lock, sig) as Uint8Array;
        await provider.callTx('Identity_register', ...buildIdentityRegistrationArgs({ veilIdHash: id, chainNamespace: ns, publicKeyOrLockHashCommitment: lock, walletSignatureHash: sig, chainProofHash: ph, currentEpoch: 1n }));

        const ethC = randomBytes(32);
        const ckbC = randomBytes(32);
        const salt = randomBytes(32);
        const nonce = randomBytes(32);
        const wc = deriveReputationWitnessCommitment(id, 50n, 5n, 3n, 10n, 1n, 10n, ethC, ckbC, salt);
        const proofHash = await provider.callTx('Utils_deriveReputationProofHash', id, wc, 3n, nonce) as Uint8Array;
        await provider.callTx('Reputation_prove', ...buildReputationProofArgs({ veilIdHash: id, walletAgeInDays: 50n, distinctProtocols: 5n, daoVoteCount: 3n, lpTenureInDays: 10n, crossChainCount: 1n, txConsistencyScore: 10n, claimedBand: 3n, ethChainCommitment: ethC, ckbChainCommitment: ckbC, witnessSalt: salt, witnessCommitment: wc, proofNonce: nonce, proofHash: proofHash, currentEpoch: 2n }));
      }

      const map = await batchCheckReputation(
        ids.map(bytesToHex),
        {
          minimumBand: 'silver',
          purpose: 'governance',
          midnightProvider: provider,
          config,
          currentEpoch: 3n,
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
