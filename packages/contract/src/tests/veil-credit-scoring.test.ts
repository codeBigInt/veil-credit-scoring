import { describe, expect, it } from "vitest";
import { fromHex, toHex } from "@midnight-ntwrk/compact-runtime";
import { CustomStructs_TokenImageUris } from "../managed/veil-protocol/contract";
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
  expect(ledgerState.LedgerStates_nftRegistry.size()).toBe(0n);
  expect(ledgerState.LedgerStates_processedScoreEvents.size()).toBe(0n);
  if (name) {
    console.log(`${name} deployment successful`);
  }
  return simulator;
};

describe("Test admin functionality", () => {
  it("add/update/remove admin and issuer configuration", () => {
    const simulator = createVeilScoreContract("Admin Test Contract");
    simulator.registerUser("issuer");
    const adminCandidateAddress = randomBytes(32);

    simulator.as("admin");
    const issuerPk = simulator.addIssuer();
    expect(simulator.getLedgerState().LedgerStates_issuers.member(issuerPk)).toBe(
      true
    );

    const newTokenUris: CustomStructs_TokenImageUris = {
      unranked: "ipfs://veil/new-unranked",
      bronze: "ipfs://veil/new-bronze",
      silver: "ipfs://veil/new-silver",
      gold: "ipfs://veil/new-gold",
      platinum: "ipfs://veil/new-platinum",
    };
    simulator.updateTokenUris(newTokenUris);
    expect(simulator.getLedgerState().LedgerStates_tokenImageUris.unranked).toBe(
      newTokenUris.unranked
    );

    simulator.updateProtocolConfig(
      {
        unranked: 0n,
        bronzeThreshold: 25n,
        silverThreshold: 45n,
        goldThreshold: 65n,
        platinumThreshold: 85n,
        maxLiquidationsAllowed: 2n,
        nftEpochValidity: 10n,
      }
    );
    expect(
      simulator.getLedgerState().LedgerStates_protocolConfig.bronzeThreshold
    ).toBe(25n);

    simulator.updateScoreConfig(
      {
        baseScore: 350n,
        maxScore: 900n,
        scale: 100n,
        repaymentWeight: 2n,
        protocolWeight: 12n,
        tenureWeight: 1n,
        liquidationWeight: 4n,
        activeDebtPenalty: 6n,
        riskBandWeight: 5n,
        maxScoreDeltaPerEpoch: 40n,
      }
    );
    expect(simulator.getLedgerState().LedgerStates_scoreConfig.baseScore).toBe(
      350n
    );

    simulator.addAdmin(adminCandidateAddress);
    const adminSet = Array.from(simulator.getLedgerState().LedgerStates_admins);
    expect(adminSet.length).toBeGreaterThan(0);

    const adminPk = adminSet[0];
    if (!adminPk) {
      throw new Error("Expected admin key to exist");
    }
    simulator.removeAdmin(adminPk);

    simulator.removeIssuer(issuerPk);
    expect(simulator.getLedgerState().LedgerStates_issuers.member(issuerPk)).toBe(
      false
    );
  });
});

describe("Test scoring and PoTNFT functionality", () => {
  it("create score entry, submit events, recompute score, mint/verify/remint/revoke nft", () => {
    const simulator = createVeilScoreContract("Scoring & NFT Test Contract");
    simulator.registerUser("issuer");
    simulator.registerUser("alice");

    simulator.as("admin");
    const adminPk = simulator.getPrivateState().secreteKey;
    const issuerPk = simulator.addIssuer();

    simulator.as("alice");
    simulator.createScoreEntry();

    const userPk = getUserPkFromPrivateState(simulator.getPrivateState());

    simulator.submitRepaymentEvent(userPk, issuerPk, 1n, 100n, 0n, randomBytes(32));
    simulator.submitProtocolUsageEvent(userPk, issuerPk, randomBytes(32), 0n);
    simulator.submitDebtStateEvent(userPk, issuerPk, 1n, 2n, 0n, randomBytes(32));
    simulator.submitLiquidationEvent(userPk, issuerPk, 2n, 0n, randomBytes(32));

    const score = simulator.recomputeAndReturnScore(userPk, issuerPk);
    expect(score.score).toBeGreaterThanOrEqual(0n);
    expect(score.repaymentRatio).toBeGreaterThanOrEqual(0n);
    expect(score.protocolsUsed).toBe(1n);

    const userKeyHex = toHex(userPk);
    const updatedScore = simulator.getPrivateState().creditScores[userKeyHex];
    if (!updatedScore) {
      throw new Error("Expected updated credit score in private state");
    }
    expect(updatedScore.score).toBe(score.score);

    simulator.mintPoTNFT();
    expect(simulator.getLedgerState().LedgerStates_nftRegistry.member(userPk)).toBe(
      true
    );

    const verifyStatus = simulator.verifyPoTNFT(issuerPk);
    expect(verifyStatus).toBe(true);

    const mintedCoin = simulator.getLastOutputCoin();
    simulator.remintPoTNFT(mintedCoin);

    simulator.as("admin");
    simulator.revokePoTNFT(userPk, adminPk);
    const revokedMetadata =
      simulator.getLedgerState().LedgerStates_nftRegistry.lookup(userPk);
    expect(revokedMetadata.isRevoked).toBe(true);
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
    expect(() => simulator.mintPoTNFT()).toThrowError(
      /You are not eligible to mint PoT NFT/
    );

    expect(() => simulator.verifyPoTNFT(issuerPk)).toThrowError(
      /PoTNFT for specified user does not exist/
    );
  });
});
