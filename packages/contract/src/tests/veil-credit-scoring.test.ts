import { describe, expect, it } from "vitest";
import { toHex } from "@midnight-ntwrk/compact-runtime";
import {
  defaultGovernanceControllerCommitment,
  VeilScoreSimulator,
} from "./veil-score-setup";
import { randomBytes } from "./utils";

const expectBytesEqual = (actual: Uint8Array, expected: Uint8Array): void => {
  expect(toHex(actual)).toBe(toHex(expected));
};

const createVeilScoreContract = (): VeilScoreSimulator => {
  const simulator = VeilScoreSimulator.deploy();
  const ledgerState = simulator.getLedgerState() as unknown as Record<string, unknown>;
  expect(ledgerState.LedgerStates_processedProofs).toBeDefined();
  expect(ledgerState.LedgerStates_identityRecords).toBeDefined();
  expect(ledgerState.LedgerStates_reputationCommitments).toBeDefined();
  return simulator;
};

describe("Veil v2 architecture", () => {
  it("does not expose v1 admin, issuer, credit-event, or Spore DID surfaces", () => {
    const simulator = createVeilScoreContract();
    const impureCircuits = simulator.contract.impureCircuits as Record<string, unknown>;
    const ledgerState = simulator.getLedgerState() as unknown as Record<string, unknown>;

    expect(impureCircuits.Admin_addIssuer).toBeUndefined();
    expect(impureCircuits.Admin_removeIssuer).toBeUndefined();
    expect(impureCircuits.Admin_updatedScoreConfig).toBeUndefined();
    expect(impureCircuits.Scoring_submitRepaymentEvent).toBeUndefined();
    expect(impureCircuits.Scoring_submitLiquidationEvent).toBeUndefined();
    expect(impureCircuits.Scoring_submitProtocolUsageEvent).toBeUndefined();
    expect(impureCircuits.Scoring_submitDebtStateEvent).toBeUndefined();
    expect(impureCircuits.DIDRegistry_register).toBeUndefined();
    expect(impureCircuits.DIDRegistry_revoke).toBeUndefined();

    expect(ledgerState.LedgerStates_issuers).toBeUndefined();
    expect(ledgerState.LedgerStates_admins).toBeUndefined();
    expect(ledgerState.LedgerStates_superAdmin).toBeUndefined();
    expect(ledgerState.LedgerStates_didRecords).toBeUndefined();
  });

  it("registers a permissionless identity without a Spore DOB", () => {
    const simulator = createVeilScoreContract();
    const veilIdHash = randomBytes(32);
    const chainNamespace = randomBytes(32);
    const lockHashCommitment = randomBytes(32);
    const walletSignatureHash = randomBytes(32);
    const chainProofHash = simulator.deriveIdentityProofHash(
      veilIdHash,
      chainNamespace,
      lockHashCommitment,
      walletSignatureHash
    );

    const record = simulator.registerIdentity(
      veilIdHash,
      chainNamespace,
      lockHashCommitment,
      walletSignatureHash,
      chainProofHash,
      7n
    );

    expectBytesEqual(record.veilIdHash, veilIdHash);
    expectBytesEqual(record.chainNamespace, chainNamespace);
    expectBytesEqual(record.publicKeyOrLockHashCommitment, lockHashCommitment);
    expectBytesEqual(record.walletSignatureHash, walletSignatureHash);
    expectBytesEqual(record.chainProofHash, chainProofHash);
    expect(record.status).toBe(1n);
    expect(record.version).toBe(1n);
    expect(record.createdAtEpoch).toBe(7n);
    expect(simulator.assertIdentityActive(veilIdHash)).toBe(true);

    expect(() => simulator.registerIdentity(veilIdHash)).toThrowError(
      /Identity already registered/
    );
  });

  it("stores self-proven reputation privately and checks public band thresholds", () => {
    const simulator = createVeilScoreContract();
    const veilIdHash = randomBytes(32);
    const proofNonce = randomBytes(32);
    const purposeHash = randomBytes(32);

    simulator.registerIdentity(veilIdHash);
    const band = simulator.proveReputation(veilIdHash, {
      walletAgeInDays: 50n,
      distinctProtocols: 5n,
      daoVoteCount: 2n,
      lpTenureInDays: 10n,
      crossChainCount: 1n,
      txConsistencyScore: 2n,
      claimedBand: 3n,
      proofNonce,
      currentEpoch: 11n,
    });

    expect(band).toBe(3n);
    const privateScore = simulator.getReputationScore(veilIdHash);
    expect(privateScore.score).toBeGreaterThan(300n);
    expect(privateScore.band).toBe(3n);
    expect(privateScore.lastUpdatedEpoch).toBe(11n);
    expect(simulator.getLedgerState().LedgerStates_reputationCommitments.firstFree()).toBe(1n);

    const goldDecision = simulator.checkReputation(veilIdHash, 3n, purposeHash);
    expect(goldDecision.meetsThreshold).toBe(true);
    expect(goldDecision.band).toBe(3n);
    expect(goldDecision.communityWeightBps).toBe(15000n);
    expect(goldDecision.accessTier).toBe(3n);
    expectBytesEqual(goldDecision.purposeHash, purposeHash);

    const platinumDecision = simulator.checkReputation(veilIdHash, 4n);
    expect(platinumDecision.meetsThreshold).toBe(false);

    expect(() =>
      simulator.proveReputation(veilIdHash, {
        walletAgeInDays: 50n,
        distinctProtocols: 5n,
        daoVoteCount: 2n,
        lpTenureInDays: 10n,
        crossChainCount: 1n,
        txConsistencyScore: 2n,
        claimedBand: 3n,
        proofNonce,
      })
    ).toThrowError(/Reputation proof already used/);
  });

  it("rejects malformed v2 flows", () => {
    const simulator = createVeilScoreContract();
    const veilIdHash = randomBytes(32);

    expect(() =>
      simulator.proveReputation(veilIdHash, {
        walletAgeInDays: 1n,
        distinctProtocols: 0n,
        daoVoteCount: 0n,
        lpTenureInDays: 0n,
        crossChainCount: 0n,
        txConsistencyScore: 0n,
        claimedBand: 0n,
      })
    ).toThrowError(/Identity not registered/);

    simulator.registerIdentity(veilIdHash);

    expect(() =>
      simulator.proveReputation(veilIdHash, {
        walletAgeInDays: 1n,
        distinctProtocols: 0n,
        daoVoteCount: 0n,
        lpTenureInDays: 0n,
        crossChainCount: 0n,
        txConsistencyScore: 0n,
        claimedBand: 5n,
      })
    ).toThrowError(/Invalid claimed band/);

    expect(() => simulator.checkReputation(veilIdHash, 1n)).toThrowError(
      /Reputation not found/
    );
  });

  it("rejects malicious cheat attempts without mutating contract state", () => {
    const simulator = createVeilScoreContract();
    const zeroBytes = new Uint8Array(32);
    const veilIdHash = randomBytes(32);
    const replayedProofHash = randomBytes(32);
    const replayedNonce = randomBytes(32);

    expect(() =>
      simulator.registerIdentity(zeroBytes, randomBytes(32), randomBytes(32), randomBytes(32))
    ).toThrowError(/Invalid Veil ID hash/);

    expect(() =>
      simulator.registerIdentity(randomBytes(32), randomBytes(32), randomBytes(32), zeroBytes)
    ).toThrowError(/Invalid wallet signature/);

    simulator.registerIdentity(
      veilIdHash,
      randomBytes(32),
      randomBytes(32),
      replayedProofHash
    );
    expect(simulator.getLedgerState().LedgerStates_identityCommitments.firstFree()).toBe(1n);

    expect(() =>
      simulator.registerIdentity(
        veilIdHash,
        randomBytes(32),
        randomBytes(32),
        replayedProofHash
      )
    ).toThrowError(/Identity already registered/);
    expect(simulator.getLedgerState().LedgerStates_identityCommitments.firstFree()).toBe(1n);

    expect(() =>
      simulator.proveReputation(veilIdHash, {
        walletAgeInDays: 80n,
        distinctProtocols: 6n,
        daoVoteCount: 2n,
        lpTenureInDays: 12n,
        crossChainCount: 2n,
        txConsistencyScore: 4n,
        claimedBand: 4n,
        ethChainCommitment: zeroBytes,
        ckbChainCommitment: zeroBytes,
      })
    ).toThrowError(/Missing chain data commitment/);
    expect(simulator.getLedgerState().LedgerStates_reputationCommitments.firstFree()).toBe(0n);

    simulator.proveReputation(veilIdHash, {
      walletAgeInDays: 80n,
      distinctProtocols: 6n,
      daoVoteCount: 2n,
      lpTenureInDays: 12n,
      crossChainCount: 2n,
      txConsistencyScore: 4n,
      claimedBand: 4n,
      proofNonce: replayedNonce,
    });
    expect(simulator.getLedgerState().LedgerStates_reputationCommitments.firstFree()).toBe(1n);

    expect(() =>
      simulator.proveReputation(veilIdHash, {
        walletAgeInDays: 80n,
        distinctProtocols: 6n,
        daoVoteCount: 2n,
        lpTenureInDays: 12n,
        crossChainCount: 2n,
        txConsistencyScore: 4n,
        claimedBand: 4n,
        proofNonce: replayedNonce,
      })
    ).toThrowError(/Reputation proof already used/);
    expect(simulator.getLedgerState().LedgerStates_reputationCommitments.firstFree()).toBe(1n);

    expect(() =>
      simulator.checkReputation(veilIdHash, 5n, randomBytes(32), randomBytes(32))
    ).toThrowError(/Invalid minimum band/);

    expect(() =>
      simulator.checkReputation(veilIdHash, 1n, randomBytes(32), zeroBytes)
    ).toThrowError(/Invalid requester/);
  });

  it("rejects forged reputation proof bindings and incorrect claimed bands", () => {
    const simulator = createVeilScoreContract();
    const veilIdHash = randomBytes(32);
    const witnessSalt = randomBytes(32);
    const proofNonce = randomBytes(32);
    const ethChainCommitment = randomBytes(32);
    const ckbChainCommitment = new Uint8Array(32);

    simulator.registerIdentity(veilIdHash);

    const witnessCommitment = simulator.deriveReputationWitnessCommitment({
      veilIdHash,
      walletAgeInDays: 50n,
      distinctProtocols: 5n,
      daoVoteCount: 2n,
      lpTenureInDays: 10n,
      crossChainCount: 1n,
      txConsistencyScore: 2n,
      ethChainCommitment,
      ckbChainCommitment,
      witnessSalt,
    });
    const proofHash = simulator.deriveReputationProofHash(
      veilIdHash,
      witnessCommitment,
      3n,
      proofNonce
    );

    expect(() =>
      simulator.proveReputation(veilIdHash, {
        walletAgeInDays: 50n,
        distinctProtocols: 5n,
        daoVoteCount: 2n,
        lpTenureInDays: 10n,
        crossChainCount: 1n,
        txConsistencyScore: 3n,
        claimedBand: 3n,
        ethChainCommitment,
        ckbChainCommitment,
        witnessSalt,
        witnessCommitment,
        proofNonce,
        proofHash,
      })
    ).toThrowError(/Invalid witness commitment/);

    expect(() =>
      simulator.proveReputation(veilIdHash, {
        walletAgeInDays: 50n,
        distinctProtocols: 5n,
        daoVoteCount: 2n,
        lpTenureInDays: 10n,
        crossChainCount: 1n,
        txConsistencyScore: 2n,
        claimedBand: 4n,
        ethChainCommitment,
        ckbChainCommitment,
        witnessSalt,
      })
    ).toThrowError(/Claimed band does not match score/);

    expect(() =>
      simulator.proveReputation(veilIdHash, {
        walletAgeInDays: 50n,
        distinctProtocols: 5n,
        daoVoteCount: 2n,
        lpTenureInDays: 10n,
        crossChainCount: 1n,
        txConsistencyScore: 2n,
        claimedBand: 3n,
        ethChainCommitment,
        ckbChainCommitment,
        witnessSalt,
        witnessCommitment,
        proofNonce,
        proofHash: randomBytes(32),
      })
    ).toThrowError(/Invalid proof binding/);
  });

  it("applies score config changes only after the governance timelock", () => {
    const simulator = createVeilScoreContract();
    const nextConfig = {
      baseScore: 320n,
      maxScore: 900n,
      walletAgeWeight: 3n,
      protocolWeight: 15n,
      daoWeight: 20n,
      lpWeight: 10n,
      crossChainWeight: 25n,
      consistencyWeight: 5n,
      bronzeThreshold: 410n,
      silverThreshold: 560n,
      goldThreshold: 710n,
      platinumThreshold: 830n,
    };

    simulator.proposeScoreConfig(nextConfig, 100n);
    expect(simulator.getLedgerState().LedgerStates_hasPendingScoreConfig).toBe(true);
    expect(() => simulator.applyScoreConfig(109n)).toThrowError(/Score config timelock active/);

    simulator.applyScoreConfig(110n);
    expect(simulator.getLedgerState().LedgerStates_scoreConfig.baseScore).toBe(320n);
    expect(simulator.getLedgerState().LedgerStates_hasPendingScoreConfig).toBe(false);
  });

  it("rejects governance from callers without the configured DAO controller proof", () => {
    const simulator = createVeilScoreContract();
    const nextConfig = {
      baseScore: 320n,
      maxScore: 900n,
      walletAgeWeight: 3n,
      protocolWeight: 15n,
      daoWeight: 20n,
      lpWeight: 10n,
      crossChainWeight: 25n,
      consistencyWeight: 5n,
      bronzeThreshold: 410n,
      silverThreshold: 560n,
      goldThreshold: 710n,
      platinumThreshold: 830n,
    };
    const nonce = randomBytes(32);
    const scoreConfigHash = simulator.deriveScoreConfigCommitment(nextConfig);
    const actionHash = simulator.deriveGovernanceActionHash(
      new TextEncoder().encode("score-config".padEnd(32, "\0")).slice(0, 32),
      scoreConfigHash,
      100n
    );
    const forgedProofHash = simulator.deriveGovernanceProofHash(
      randomBytes(32),
      actionHash,
      nonce
    );

    expect(
      (simulator.getLedgerState() as unknown as Record<string, unknown>)
        .LedgerStates_governanceAuthority
    ).toBeUndefined();
    expectBytesEqual(
      simulator.getLedgerState().LedgerStates_governanceControllerCommitment,
      defaultGovernanceControllerCommitment
    );

    expect(() =>
      simulator.contract.impureCircuits.Governance_proposeScoreConfig(
        simulator.circuitContext,
        nextConfig,
        100n,
        actionHash,
        forgedProofHash,
        nonce
      )
    ).toThrowError(/Invalid governance proof/);
    expect(simulator.getLedgerState().LedgerStates_hasPendingScoreConfig).toBe(false);
  });
});
