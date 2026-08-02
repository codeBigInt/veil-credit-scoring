import { describe, expect, it } from "vitest";
import { toHex } from "@midnight-ntwrk/compact-runtime";
import { VeilScoreSimulator } from "./veil-score-setup";
import { padStringToBytes32, randomBytes } from "./utils";

const expectBytesEqual = (actual: Uint8Array, expected: Uint8Array): void => {
  expect(toHex(actual)).toBe(toHex(expected));
};

const createVeilScoreContract = (): VeilScoreSimulator => {
  const simulator = VeilScoreSimulator.deploy();
  const ledgerState = simulator.getLedgerState() as unknown as Record<string, unknown>;
  expect(ledgerState.LedgerStates_processedProofs).toBeDefined();
  expect(ledgerState.LedgerStates_identityRecords).toBeDefined();
  expect(ledgerState.LedgerStates_reputationCommitments).toBeDefined();
  expect(ledgerState.LedgerStates_supportedChainNamespaces).toBeDefined();
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
    const chainNamespace = padStringToBytes32("ckb");
    const lockHashCommitment = randomBytes(32);
    const walletSignatureHash = randomBytes(32);

    const record = simulator.registerIdentity(
      veilIdHash,
      chainNamespace,
      lockHashCommitment,
      walletSignatureHash
    );

    expectBytesEqual(record.veilIdHash, veilIdHash);
    expectBytesEqual(record.chainNamespace, chainNamespace);
    expectBytesEqual(record.publicKeyOrLockHashCommitment, lockHashCommitment);
    expectBytesEqual(record.walletSignatureHash, walletSignatureHash);
    expect(toHex(record.chainProofHash)).not.toBe(toHex(new Uint8Array(32)));
    expect(record.status).toBe(1n);
    expect(record.version).toBe(1n);
    expect(record.createdAtEpoch).toBeGreaterThanOrEqual(0n);
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
      proofNonce,
    });

    expect(band).toBe(3n);
    const privateScore = simulator.getReputationScore(veilIdHash);
    expect(privateScore.score).toBeGreaterThan(300n);
    expect(privateScore.band).toBe(3n);
    expect(privateScore.lastUpdatedEpoch).toBeGreaterThanOrEqual(0n);
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
      })
    ).toThrowError(/Identity not registered/);

    simulator.registerIdentity(veilIdHash);

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
    ).toThrowError(/Unsupported chain namespace|Invalid Veil ID hash/);

    expect(() =>
      simulator.registerIdentity(randomBytes(32), randomBytes(32), randomBytes(32), zeroBytes)
    ).toThrowError(/Unsupported chain namespace/);

    simulator.registerIdentity(
      veilIdHash,
      padStringToBytes32("ckb"),
      randomBytes(32),
      replayedProofHash
    );
    expect(simulator.getLedgerState().LedgerStates_identityCommitments.firstFree()).toBe(1n);

    expect(() =>
      simulator.registerIdentity(
        veilIdHash,
        padStringToBytes32("evm"),
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
        chainCommitment: zeroBytes,
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

  it("derives the band from signals and rejects replayed reputation nonces", () => {
    const simulator = createVeilScoreContract();
    const veilIdHash = randomBytes(32);
    const witnessSalt = randomBytes(32);
    const proofNonce = randomBytes(32);
    const chainCommitment = randomBytes(32);

    simulator.registerIdentity(veilIdHash);

    const band = simulator.proveReputation(veilIdHash, {
      walletAgeInDays: 50n,
      distinctProtocols: 5n,
      daoVoteCount: 2n,
      lpTenureInDays: 10n,
      crossChainCount: 1n,
      txConsistencyScore: 2n,
      chainCommitment,
      witnessSalt,
      proofNonce,
    });
    expect(band).toBe(3n); // gold, derived from the signals above — not caller-supplied

    expect(() =>
      simulator.proveReputation(veilIdHash, {
        walletAgeInDays: 50n,
        distinctProtocols: 5n,
        daoVoteCount: 2n,
        lpTenureInDays: 10n,
        crossChainCount: 1n,
        txConsistencyScore: 2n,
        chainCommitment,
        witnessSalt,
        proofNonce,
      })
    ).toThrowError(/Reputation proof already used/);
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

    simulator.proposeScoreConfig(nextConfig);
    expect(simulator.getLedgerState().LedgerStates_hasPendingScoreConfig).toBe(true);

    simulator.applyScoreConfig();
    expect(simulator.getLedgerState().LedgerStates_scoreConfig.baseScore).toBe(320n);
    expect(simulator.getLedgerState().LedgerStates_hasPendingScoreConfig).toBe(false);
  });

  it("stores guardian controller evidence for score config proposals", () => {
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
    const operationId = randomBytes(32);
    const signatureBundleHash = randomBytes(32);

    expect(
      (simulator.getLedgerState() as unknown as Record<string, unknown>)
        .LedgerStates_governanceAuthority
    ).toBeUndefined();

    const proposalResult = simulator.contract.impureCircuits.Governance_proposeScoreConfig(
        simulator.circuitContext,
        nextConfig,
        operationId,
        signatureBundleHash,
        nonce
    );
    simulator.circuitContext = proposalResult.context;
    expect(simulator.getLedgerState().LedgerStates_hasPendingScoreConfig).toBe(true);
    expectBytesEqual(
      simulator.getLedgerState().LedgerStates_pendingScoreConfig.signatureBundleHash,
      signatureBundleHash
    );
  });
});
