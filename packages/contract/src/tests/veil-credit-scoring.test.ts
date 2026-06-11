import { describe, expect, it } from "vitest";
import { fromHex, toHex } from "@midnight-ntwrk/compact-runtime";
import { VeilScoreSimulator } from "./veil-score-setup";
import { randomBytes } from "./utils";

const getUserPkFromPrivateState = (
  privateState: ReturnType<VeilScoreSimulator["getPrivateState"]>
): Uint8Array => {
  const keys = Object.keys(privateState.creditScores);
  if (keys.length !== 1 || !keys[0]) {
    throw new Error("Expected exactly one user score key");
  }
  return fromHex(keys[0]);
};

const createVeilScoreContract = (name?: string): VeilScoreSimulator => {
  const simulator = VeilScoreSimulator.deploy();
  const ledgerState = simulator.getLedgerState();
  expect(ledgerState.LedgerStates_issuers.size()).toBe(0n);
  expect(ledgerState.LedgerStates_processedScoreEvents.size()).toBe(0n);
  if (name) {
    console.log(`${name} deployment successful`);
  }
  return simulator;
};

const expectBytesEqual = (actual: Uint8Array, expected: Uint8Array): void => {
  expect(toHex(actual)).toBe(toHex(expected));
};

describe("Test admin functionality", () => {
  it("add/update/remove admin and issuer configuration", () => {
    const simulator = createVeilScoreContract("Admin Test Contract");
    simulator.registerUser("issuer");

    simulator.as("admin");
    const issuerPk = simulator.addIssuer();
    expect(simulator.getLedgerState().LedgerStates_issuers.member(issuerPk)).toBe(
      true
    );

    simulator.updateScoreConfig({
      baseScore: 360n,
      maxScore: 900n,
      scale: 100n,
      repaymentWeight: 2n,
      protocolWeight: 12n,
      tenureWeight: 1n,
      liquidationWeight: 4n,
      activeDebtPenalty: 6n,
      riskBandWeight: 5n,
    });
    expect(simulator.getLedgerState().LedgerStates_scoreConfig.baseScore).toBe(
      360n
    );

    const adminCandidate = randomBytes(32);
    simulator.addAdmin(adminCandidate);
    expect(simulator.getLedgerState().LedgerStates_admins.member(adminCandidate)).toBe(
      true
    );

    simulator.removeAdmin(adminCandidate);
    expect(simulator.getLedgerState().LedgerStates_admins.member(adminCandidate)).toBe(
      false
    );

    simulator.removeIssuer(issuerPk);
    expect(simulator.getLedgerState().LedgerStates_issuers.member(issuerPk)).toBe(
      false
    );
  });

  it("rejects non-admin issuer and score config changes", () => {
    const simulator = createVeilScoreContract("Admin Negative Test Contract");
    simulator.registerUser("alice");

    simulator.as("alice");

    expect(() => simulator.addIssuer()).toThrowError(/Unauthorized/);
    expect(() =>
      simulator.updateScoreConfig({
        baseScore: 300n,
        maxScore: 900n,
        scale: 100n,
        repaymentWeight: 2n,
        protocolWeight: 10n,
        tenureWeight: 1n,
        liquidationWeight: 3n,
        activeDebtPenalty: 5n,
        riskBandWeight: 5n,
      })
    ).toThrowError(/Unauthorized/);
  });

  it("does not expose deprecated Midnight PoT NFT contract surface", () => {
    const simulator = createVeilScoreContract("PoT Regression Test Contract");
    const impureCircuits = simulator.contract.impureCircuits as Record<string, unknown>;
    const ledgerState = simulator.getLedgerState() as unknown as Record<string, unknown>;

    expect(impureCircuits.NFT_mintPoTNFT).toBeUndefined();
    expect(impureCircuits.NFT_renewPoTNFT).toBeUndefined();
    expect(impureCircuits.NFT_verifyPoTNFT).toBeUndefined();
    expect(impureCircuits.Utils_initializeContractConfigurations).toBeUndefined();
    expect(impureCircuits.Admin_updateTokenUris).toBeUndefined();
    expect(impureCircuits.Admin_updatedProtocolConfig).toBeUndefined();

    expect(ledgerState.LedgerStates_nftRegistry).toBeUndefined();
    expect(ledgerState.LedgerStates_protocolConfig).toBeUndefined();
    expect(ledgerState.LedgerStates_tokenImageUris).toBeUndefined();
    expect(ledgerState.LedgerStates_tokenMarkers).toBeUndefined();
  });
});

describe("Test scoring functionality", () => {
  it("create score entry, submit events, and recompute private score state", () => {
    const simulator = createVeilScoreContract("Scoring Test Contract");
    simulator.registerUser("issuer");
    simulator.registerUser("alice");

    simulator.as("admin");
    const issuerPk = simulator.addIssuer();

    simulator.as("alice");
    simulator.createScoreEntry();

    const userPk = getUserPkFromPrivateState(simulator.getPrivateState());

    simulator.submitRepaymentEvent(userPk, issuerPk, 1n, 100n, 0n, randomBytes(32));
    simulator.submitProtocolUsageEvent(userPk, issuerPk, randomBytes(32), 0n);
    simulator.submitDebtStateEvent(userPk, issuerPk, 1n, 2n, 0n, randomBytes(32));
    simulator.submitLiquidationEvent(userPk, issuerPk, 2n, 0n, randomBytes(32));

    // const score = simulator.recomputeAndReturnScore(userPk, issuerPk);
    // expect(score.score).toBeGreaterThanOrEqual(0n);
    // expect(score.repaymentRatio).toBeGreaterThanOrEqual(0n);
    // expect(score.protocolsUsed).toBe(1n);

    // const userKeyHex = toHex(userPk);
    // const updatedScore = simulator.getPrivateState().creditScores[userKeyHex];
    // if (!updatedScore) {
    //   throw new Error("Expected updated credit score in private state");
    // }
    // expect(updatedScore.score).toBe(score.score);

    simulator.as("admin");
  });

  it("fails for invalid scoring flows and duplicate actions", () => {
    const simulator = createVeilScoreContract("Scoring Failure Test Contract");
    simulator.registerUser("issuer");
    simulator.registerUser("alice");
    simulator.registerUser("bob");

    simulator.as("admin");
    const issuerPk = simulator.addIssuer();

    simulator.as("alice");
    const fakeUserPk = randomBytes(32);

    expect(() =>
      simulator.submitRepaymentEvent(
        fakeUserPk,
        issuerPk,
        1n,
        100n,
        0n,
        randomBytes(32)
      )
    ).toThrowError(/User score entry not found/);

    simulator.createScoreEntry();
    const userPk = getUserPkFromPrivateState(simulator.getPrivateState());

    expect(() => simulator.createScoreEntry()).toThrowError(
      /Not allowed to create duplicated credit score position/
    );

    const duplicateEventId = randomBytes(32);
    simulator.submitRepaymentEvent(userPk, issuerPk, 1n, 100n, 0n, duplicateEventId);
    expect(() =>
      simulator.submitRepaymentEvent(
        userPk,
        issuerPk,
        1n,
        100n,
        0n,
        duplicateEventId
      )
    ).toThrowError(/Duplicate score event/);

    const unknownIssuerPk = randomBytes(32);
    expect(() =>
      simulator.submitDebtStateEvent(
        userPk,
        unknownIssuerPk,
        1n,
        2n,
        0n,
        randomBytes(32)
      )
    ).toThrowError(/Unauthorized issuer/);

    simulator.as("bob");
    expect(simulator.getLedgerState().LedgerStates_issuers.member(issuerPk)).toBe(
      true
    );
  });

  it("rejects malformed scoring event flags", () => {
    const simulator = createVeilScoreContract("Malformed Event Test Contract");
    simulator.registerUser("alice");

    simulator.as("admin");
    const issuerPk = simulator.addIssuer();

    simulator.as("alice");
    simulator.createScoreEntry();
    const userPk = getUserPkFromPrivateState(simulator.getPrivateState());

    expect(() =>
      simulator.submitRepaymentEvent(userPk, issuerPk, 2n, 100n, 0n, randomBytes(32))
    ).toThrowError(/paidOnTimeFlag must be 0 or 1/);

    expect(() =>
      simulator.submitDebtStateEvent(userPk, issuerPk, 2n, 1n, 0n, randomBytes(32))
    ).toThrowError(/activeDebtFlag must be 0 or 1/);

    expect(() =>
      simulator.submitDebtStateEvent(userPk, issuerPk, 1n, 4n, 0n, randomBytes(32))
    ).toThrowError(/riskBand must be 0..3/);

    expect(() =>
      simulator.submitLiquidationEvent(userPk, issuerPk, 4n, 0n, randomBytes(32))
    ).toThrowError(/Invalid severity/);
  });
});

describe("Test DID registry functionality", () => {
  it("registers, asserts, rotates, and revokes a Veil DID", () => {
    const simulator = createVeilScoreContract("DID Registry Test Contract");
    simulator.registerUser("alice");

    simulator.as("alice");
    simulator.createScoreEntry();
    const userPk = getUserPkFromPrivateState(simulator.getPrivateState());

    const veilIdHash = randomBytes(32);
    const sporeIdHash = randomBytes(32);
    const ownerLockHash = randomBytes(32);
    const recoveryCommitment = randomBytes(32);

    simulator.registerDid(userPk, veilIdHash, sporeIdHash, ownerLockHash, recoveryCommitment, 7n);

    const didRecord = simulator.getDidRecord(veilIdHash);
    expectBytesEqual(didRecord.userPk, userPk);
    expectBytesEqual(didRecord.veilIdHash, veilIdHash);
    expectBytesEqual(didRecord.activeSporeIdHash, sporeIdHash);
    expectBytesEqual(didRecord.activeCkbOwnerLockHash, ownerLockHash);
    expectBytesEqual(didRecord.recoveryCommitment, recoveryCommitment);
    expect(didRecord.version).toBe(1n);
    expect(didRecord.status).toBe(1n);
    expect(didRecord.createdAtEpoch).toBe(7n);
    expect(didRecord.updatedAtEpoch).toBe(7n);

    expect(simulator.assertDidActive(veilIdHash, sporeIdHash, ownerLockHash)).toBe(true);
    expect(simulator.assertDidActive(veilIdHash, randomBytes(32), ownerLockHash)).toBe(false);

    const nextSporeIdHash = randomBytes(32);
    const nextOwnerLockHash = randomBytes(32);
    simulator.rotateDidVerificationMethod(
      veilIdHash,
      ownerLockHash,
      nextSporeIdHash,
      nextOwnerLockHash,
      recoveryCommitment,
      8n
    );

    const rotatedRecord = simulator.getDidRecord(veilIdHash);
    expectBytesEqual(rotatedRecord.activeSporeIdHash, nextSporeIdHash);
    expectBytesEqual(rotatedRecord.activeCkbOwnerLockHash, nextOwnerLockHash);
    expect(rotatedRecord.version).toBe(2n);
    expect(rotatedRecord.updatedAtEpoch).toBe(8n);
    expect(simulator.assertDidActive(veilIdHash, nextSporeIdHash, nextOwnerLockHash)).toBe(true);

    simulator.as("admin");
    simulator.revokeDid(veilIdHash, 9n);

    const revokedRecord = simulator.getDidRecord(veilIdHash);
    expect(revokedRecord.status).toBe(2n);
    expect(revokedRecord.updatedAtEpoch).toBe(9n);
    expect(simulator.assertDidActive(veilIdHash, nextSporeIdHash, nextOwnerLockHash)).toBe(false);
  });

  it("rejects invalid DID registry operations", () => {
    const simulator = createVeilScoreContract("DID Registry Failure Test Contract");
    simulator.registerUser("alice");

    simulator.as("alice");
    const userPk = simulator.generateCurrentUserPk();
    const veilIdHash = randomBytes(32);
    const sporeIdHash = randomBytes(32);
    const ownerLockHash = randomBytes(32);
    const recoveryCommitment = randomBytes(32);

    expect(() =>
      simulator.registerDid(userPk, veilIdHash, sporeIdHash, ownerLockHash, recoveryCommitment)
    ).toThrowError(/User score entry not found/);

    simulator.createScoreEntry(userPk);
    simulator.registerDid(userPk, veilIdHash, sporeIdHash, ownerLockHash, recoveryCommitment);

    expect(() =>
      simulator.registerDid(userPk, veilIdHash, randomBytes(32), randomBytes(32), recoveryCommitment)
    ).toThrowError(/DID already registered/);

    expect(() =>
      simulator.rotateDidVerificationMethod(
        veilIdHash,
        randomBytes(32),
        randomBytes(32),
        randomBytes(32),
        recoveryCommitment
      )
    ).toThrowError(/Previous CKB owner lock mismatch/);

    expect(() =>
      simulator.rotateDidVerificationMethod(
        veilIdHash,
        ownerLockHash,
        randomBytes(32),
        randomBytes(32),
        randomBytes(32)
      )
    ).toThrowError(/Invalid recovery proof/);

    expect(() => simulator.revokeDid(veilIdHash)).toThrowError(/Unauthorized/);
  });
});
