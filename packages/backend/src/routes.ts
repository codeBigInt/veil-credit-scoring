import express, { type Request, type Response, type Router } from 'express';
import { toHex } from '@midnight-ntwrk/compact-runtime';
import { ccc } from '@ckb-ccc/core';

import type { ContractService } from './services/contract-service.js';
import { formatJob, type TxQueue } from './services/tx-queue.js';
import type { VeilDobService } from './modules/ckb/index.js';
import {
  optionalBytes,
  optionalString,
  randomBytes32,
  requiredBigInt,
  requiredBytes,
  requiredString,
  toJsonSafe,
} from './http-utils.js';
import { publicErrorMessage } from './logging.js';
import { createVeilDid, parseVeilDid, type VeilDidDocument } from './did-utils.js';

/* ── Single-use challenge store ── */
const issuedChallenges = new Map<string, number>(); // hex → expiresAtMs

const registerChallenge = (challengeBytes: Uint8Array, expiresAtMs: number): void => {
  issuedChallenges.set(toHex(challengeBytes), expiresAtMs);
  const now = Date.now();
  for (const [k, exp] of issuedChallenges) {
    if (exp < now) issuedChallenges.delete(k);
  }
};

const consumeChallenge = (challengeHex: string): boolean => {
  const exp = issuedChallenges.get(challengeHex);
  if (exp == null) return false;
  issuedChallenges.delete(challengeHex);
  return exp >= Date.now();
};

const errorMessage = (error: unknown): string => publicErrorMessage(error);

const sendError = (res: Response, status: number, message: string): void => {
  res.status(status).json({ success: false, message });
};

type CreditDecisionAuthorization = {
  readonly signature: string;
  readonly identity: string;
  readonly signType: string;
  readonly verificationMethod?: string;
};

const requiredAuthorization = (body: Record<string, unknown>): CreditDecisionAuthorization => {
  const value = body.authorization;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('authorization is required');
  }
  const record = value as Record<string, unknown>;
  return {
    signature: requiredString(record, 'signature'),
    identity: requiredString(record, 'identity'),
    signType: requiredString(record, 'signType'),
    verificationMethod: optionalString(record, 'verificationMethod'),
  };
};

const buildCreditDecisionMessage = (input: {
  readonly challenge: string;
  readonly userPk: string;
  readonly veilIdHash: string;
  readonly sporeId: string;
}): string => [
  'Veil credit decision authorization',
  `challenge:${input.challenge}`,
  `userPk:${input.userPk}`,
  `veilIdHash:${input.veilIdHash}`,
  `sporeId:${input.sporeId}`,
].join('\n');

const buildDidCreditDecisionMessage = (input: {
  readonly did: string;
  readonly challenge: string;
  readonly verificationMethod: string;
  readonly registryVersion: number;
}): string => [
  'Veil credit decision authorization',
  `did:${input.did}`,
  `challenge:${input.challenge}`,
  `verificationMethod:${input.verificationMethod}`,
  `registryVersion:${input.registryVersion}`,
  'purpose:credit-decision',
].join('\n');

const verifyCreditDecisionAuthorization = async (
  message: string,
  authorization: CreditDecisionAuthorization,
): Promise<boolean> => {
  if (!Object.values(ccc.SignerSignType).includes(authorization.signType as ccc.SignerSignType)) {
    throw new Error(`Unsupported authorization signType ${authorization.signType}`);
  }

  return ccc.Signer.verifyMessage(
    message,
    new ccc.Signature(
      authorization.signature,
      authorization.identity,
      authorization.signType as ccc.SignerSignType,
    ),
  );
};

type TxRunner = () => Promise<unknown>;

const sendQueued = async (res: Response, txQueue: TxQueue, name: string, run: TxRunner): Promise<void> => {
  const job = await txQueue.enqueue(name, run);
  res.status(202).json(toJsonSafe({ success: true, job: formatJob(job) }));
};

const optionalQueryString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() !== '' ? value : undefined;

const absoluteApiUrl = (req: Request): string => {
  const forwardedProto = req.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const forwardedHost = req.get('x-forwarded-host')?.split(',')[0]?.trim();
  const protocol = forwardedProto || req.protocol;
  const host = forwardedHost || req.get('host') || 'localhost';
  return `${protocol}://${host}${req.baseUrl}`;
};

const buildDidDocument = (
  req: Request,
  dob: NonNullable<Awaited<ReturnType<VeilDobService['getVeilIdentityDOBRecord']>>>,
): VeilDidDocument => {
  const verificationMethodId = `${dob.did}#ckb-owner-1`;
  const apiBase = absoluteApiUrl(req);
  return {
    '@context': [
      'https://www.w3.org/ns/did/v1',
      'https://veil.id/contexts/veil-did/v1',
    ],
    id: dob.did,
    controller: dob.did,
    verificationMethod: [{
      id: verificationMethodId,
      type: 'CkbSecp256k1VerificationKey2026',
      controller: dob.did,
      blockchainAccountId: dob.userCkbAddress ? `ckb:${dob.userCkbAddress}` : undefined,
      publicKeyHash: dob.ckbOwnerLockHash,
    }],
    authentication: [verificationMethodId],
    assertionMethod: [verificationMethodId],
    service: [
      {
        id: `${dob.did}#credit-decision`,
        type: 'VeilCreditDecisionService',
        serviceEndpoint: `${apiBase}/credit-decisions`,
      },
      {
        id: `${dob.did}#identity-dob`,
        type: 'CkbSporeDobService',
        serviceEndpoint: `ckb:spore:${dob.sporeId}`,
      },
    ],
    veil: {
      veilIdHash: dob.veilIdHash,
      status: 'active',
      version: 1,
      sporeId: dob.sporeId,
      sporeIdHash: dob.sporeIdHash,
      ckbOwnerLockHash: dob.ckbOwnerLockHash,
      midnightRegistry: dob.didRegistryContractAddress ?? dob.midnightContractAddress,
      createdAt: dob.createdAt instanceof Date ? dob.createdAt.toISOString() : String(dob.createdAt),
    },
  };
};

export const buildRouter = (contract: ContractService, txQueue: TxQueue, veilDob: VeilDobService): Router => {
  const router = express.Router();

  router.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ success: true, service: 'veil-backend', version: 'v1' });
  });

  router.get('/contract', (_req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      contractAddress: contract.contractAddress(),
      superAdminSource: 'VEIL_BACKEND_WALLET_SEED',
    });
  });

  router.get('/dids/resolve', async (req: Request, res: Response) => {
    try {
      const did = optionalQueryString(req.query.did);
      if (!did) {
        sendError(res, 400, 'did query parameter is required');
        return;
      }

      const { veilIdHash } = parseVeilDid(did);
      const dob = await veilDob.getVeilIdentityDOBRecord(veilIdHash);
      if (!dob || dob.did !== did) {
        sendError(res, 404, 'Veil DID not found');
        return;
      }
      if (!dob.didRegistryTxHash) {
        sendError(res, 409, 'Veil DID has not been registered on Midnight yet');
        return;
      }

      try {
        const loadedDob = await veilDob.getVeilIdentityDOB(dob.sporeId);
        const verification = veilDob.verifyLoadedVeilIdentityDOB(loadedDob, veilIdHash);
        if (!verification.valid) {
          sendError(res, 409, 'Veil DID DOB anchor is invalid');
          return;
        }
      } catch (error) {
        if (
          dob.veilIdHash !== veilIdHash ||
          !dob.didRegistryTxHash ||
          !dob.sporeIdHash ||
          !dob.ckbOwnerLockHash
        ) {
          throw error;
        }
      }

      res.status(200).json(toJsonSafe({
        success: true,
        didDocument: buildDidDocument(req, dob),
      }));
    } catch (error) {
      const msg = errorMessage(error);
      sendError(res, msg.includes('Invalid did:veil') ? 400 : 500, msg);
    }
  });

  router.get('/score-entries/:userPk', async (req: Request, res: Response) => {
    try {
      const userPkHex = req.params.userPk;
      if (typeof userPkHex !== 'string') {
        sendError(res, 400, 'userPk is required');
        return;
      }

      const userPk = requiredBytes({ userPk: userPkHex }, 'userPk');
      const status = await contract.getScoreEntryStatus(userPk);
      const veilIdHash = optionalQueryString(req.query.veilIdHash) ?? veilDob.hashVeilId(userPk);
      const userCkbAddress = optionalQueryString(req.query.userCkbAddress);
      const existingDob = await veilDob.getVeilIdentityDOBRecord(veilIdHash);
      const ckbMintIntent = status.exists && userCkbAddress && !existingDob
        ? await veilDob.createVeilIdentityDOBMintIntent({
            veilIdHash,
            userCkbAddress,
            midnightContractAddress: veilDob.defaultMidnightContractAddress(),
            midnightNetwork: veilDob.defaultMidnightNetwork(),
          })
        : undefined;

      res.status(200).json(toJsonSafe({
        success: true,
        userPk: toHex(userPk),
        veilIdHash,
        scoreEntry: status,
        ckbDob: existingDob,
        ckbMintIntent,
      }));
    } catch (error) {
      sendError(res, 500, errorMessage(error));
    }
  });

  router.post('/score-entries', async (req: Request, res: Response) => {
    try {
      const body = req.body as Record<string, unknown>;
      const userPk = requiredBytes(body, 'userPk');
      const veilIdHash = typeof body.veilIdHash === 'string' ? requiredString(body, 'veilIdHash') : veilDob.hashVeilId(userPk);
      const did = createVeilDid(veilIdHash);
      const userCkbAddress = requiredString(body, 'userCkbAddress');
      const existingDob = await veilDob.getVeilIdentityDOBRecord(veilIdHash);
      const existing = await contract.getScoreEntryStatus(userPk);
      if (existing.exists) {
        const ckbMintIntent = existingDob ? undefined : await veilDob.createVeilIdentityDOBMintIntent({
            veilIdHash,
            userCkbAddress,
            midnightContractAddress: veilDob.defaultMidnightContractAddress(),
            midnightNetwork: veilDob.defaultMidnightNetwork(),
          });
        res.status(200).json(toJsonSafe({
          success: true,
          created: false,
          did,
          scoreEntry: existing,
          ckbDob: existingDob,
          ckbMintIntent,
        }));
        return;
      }

      await sendQueued(res, txQueue, 'Scoring_createScoreEntry+VeilIdentityDOBIntent', async () => {
        const queuedExisting = await contract.getScoreEntryStatus(userPk);
        if (queuedExisting.exists) {
          const queuedExistingDob = await veilDob.getVeilIdentityDOBRecord(veilIdHash);
          const ckbMintIntent = queuedExistingDob ? undefined : await veilDob.createVeilIdentityDOBMintIntent({
              veilIdHash,
              userCkbAddress,
              midnightContractAddress: veilDob.defaultMidnightContractAddress(),
              midnightNetwork: veilDob.defaultMidnightNetwork(),
            });
          return {
            created: false,
            did,
            scoreEntry: queuedExisting,
            ckbDob: queuedExistingDob,
            ckbMintIntent,
          };
        }

        const midnight = await contract.createScoreEntry(userPk);
        const ckbMintIntent = await veilDob.createVeilIdentityDOBMintIntent({
          veilIdHash,
          userCkbAddress,
          midnightContractAddress: veilDob.defaultMidnightContractAddress(),
          midnightNetwork: veilDob.defaultMidnightNetwork(),
        });
        return {
          created: true,
          did,
          scoreEntry: await contract.getScoreEntryStatus(userPk),
          midnight,
          ckbMintIntent,
        };
      });
    } catch (error) {
      sendError(res, 500, errorMessage(error));
    }
  });

  router.post('/ckb/veil-identity/mint-intent', async (req: Request, res: Response) => {
    try {
      const body = req.body as Record<string, unknown>;
      const veilIdHash = requiredString(body, 'veilIdHash');
      const existingDob = await veilDob.getVeilIdentityDOBRecord(veilIdHash);
      if (existingDob) {
        res.status(200).json({
          success: true,
          alreadyMinted: true,
          dob: existingDob,
        });
        return;
      }

      const intent = await veilDob.createVeilIdentityDOBMintIntent({
        veilIdHash,
        userCkbAddress: requiredString(body, 'userCkbAddress'),
        midnightContractAddress: veilDob.defaultMidnightContractAddress(),
        midnightNetwork: veilDob.defaultMidnightNetwork(),
      });
      res.status(200).json({
        success: true,
        intent,
      });
    } catch (error) {
      sendError(res, 500, errorMessage(error));
    }
  });

  router.post('/ckb/veil-identity/record', async (req: Request, res: Response) => {
    try {
      const body = req.body as Record<string, unknown>;
      const veilIdHash = requiredString(body, 'veilIdHash');
      const userPk = optionalString(body, 'userPk');
      const userCkbAddress = requiredString(body, 'userCkbAddress');
      let record = await veilDob.recordVeilIdentityDOBMint({
        veilIdHash,
        userPk,
        userCkbAddress,
        sporeId: requiredString(body, 'sporeId'),
        txHash: requiredString(body, 'txHash'),
        midnightContractAddress: veilDob.defaultMidnightContractAddress(),
      });

      let didRegistration: Awaited<ReturnType<ContractService['registerDid']>> | undefined;
      if (userPk && !record.didRegistryTxHash) {
        didRegistration = await contract.registerDid({
          userPk: requiredBytes({ userPk }, 'userPk'),
          veilIdHash: record.veilIdHash,
          sporeIdHash: record.ckbSporeIdHash,
          ckbOwnerLockHash: record.ckbOwnerLockHash,
        });
        record = await veilDob.recordVeilIdentityDOBMint({
          veilIdHash: record.veilIdHash,
          userPk,
          userCkbAddress,
          sporeId: record.ckbSporeId,
          txHash: record.ckbTxHash,
          midnightContractAddress: veilDob.defaultMidnightContractAddress(),
          didRegistration: {
            txHash: didRegistration.txHash,
            contractAddress: contract.contractAddress(),
          },
        });
      }
      res.status(201).json({
        success: true,
        did: record.did,
        sporeId: record.ckbSporeId,
        sporeIdHash: record.ckbSporeIdHash,
        txHash: record.ckbTxHash,
        veilIdHash: record.veilIdHash,
        ckbOwnerLockHash: record.ckbOwnerLockHash,
        didRegistryTxHash: record.didRegistryTxHash,
        didRegistration,
      });
    } catch (error) {
      sendError(res, 500, errorMessage(error));
    }
  });

  router.get('/ckb/veil-identity/:sporeId', async (req: Request, res: Response) => {
    try {
      const sporeId = req.params.sporeId;
      if (typeof sporeId !== 'string') {
        sendError(res, 400, 'Spore id is required');
        return;
      }

      const dob = await veilDob.getVeilIdentityDOB(sporeId);
      const veilIdHash = typeof dob.content.veilIdHash === 'string' ? dob.content.veilIdHash : '';
      const verification = veilIdHash
        ? await veilDob.verifyVeilIdentityDOB(sporeId, veilIdHash)
        : { valid: false };
      res.status(200).json({
        sporeId,
        content: dob.content,
        validVeilIdentity: verification.valid,
      });
    } catch (error) {
      sendError(res, 500, errorMessage(error));
    }
  });

  router.post('/scoring-events/repayments', async (req: Request, res: Response) => {
    try {
      const body = req.body as Record<string, unknown>;
      const input = {
        userPk: requiredBytes(body, 'userPk'),
        issuerPk: requiredBytes(body, 'issuerPk'),
        paidOnTimeFlag: requiredBigInt(body, 'paidOnTimeFlag'),
        amountWeight: requiredBigInt(body, 'amountWeight'),
        eventEpoch: requiredBigInt(body, 'eventEpoch'),
        eventId: optionalBytes(body, 'eventId', randomBytes32()),
      };
      await sendQueued(res, txQueue, 'Scoring_submitRepaymentEvent', () => contract.submitRepaymentEvent(input));
    } catch (error) {
      sendError(res, 500, errorMessage(error));
    }
  });

  router.post('/scoring-events/liquidations', async (req: Request, res: Response) => {
    try {
      const body = req.body as Record<string, unknown>;
      const input = {
        userPk: requiredBytes(body, 'userPk'),
        issuerPk: requiredBytes(body, 'issuerPk'),
        severity: requiredBigInt(body, 'severity'),
        eventEpoch: requiredBigInt(body, 'eventEpoch'),
        eventId: optionalBytes(body, 'eventId', randomBytes32()),
      };
      await sendQueued(res, txQueue, 'Scoring_submitLiquidationEvent', () => contract.submitLiquidationEvent(input));
    } catch (error) {
      sendError(res, 500, errorMessage(error));
    }
  });

  router.post('/scoring-events/protocol-usage', async (req: Request, res: Response) => {
    try {
      const body = req.body as Record<string, unknown>;
      const input = {
        userPk: requiredBytes(body, 'userPk'),
        issuerPk: requiredBytes(body, 'issuerPk'),
        protocolId: requiredBytes(body, 'protocolId'),
        eventEpoch: requiredBigInt(body, 'eventEpoch'),
      };
      await sendQueued(res, txQueue, 'Scoring_submitProtocolUsageEvent', () => contract.submitProtocolUsageEvent(input));
    } catch (error) {
      sendError(res, 500, errorMessage(error));
    }
  });

  router.post('/scoring-events/debt-states', async (req: Request, res: Response) => {
    try {
      const body = req.body as Record<string, unknown>;
      const input = {
        userPk: requiredBytes(body, 'userPk'),
        issuerPk: requiredBytes(body, 'issuerPk'),
        activeDebtFlag: requiredBigInt(body, 'activeDebtFlag'),
        riskBand: requiredBigInt(body, 'riskBand'),
        eventEpoch: requiredBigInt(body, 'eventEpoch'),
        eventId: optionalBytes(body, 'eventId', randomBytes32()),
      };
      await sendQueued(res, txQueue, 'Scoring_submitDebtStateEvent', () => contract.submitDebtStateEvent(input));
    } catch (error) {
      sendError(res, 500, errorMessage(error));
    }
  });

  router.get('/jobs/:id', async (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      if (typeof id !== 'string') {
        sendError(res, 400, 'Job id is required');
        return;
      }
      const job = await txQueue.get(id);
      if (!job) {
        sendError(res, 404, 'Job not found');
        return;
      }
      res.status(200).json(toJsonSafe({ success: true, job: formatJob(job) }));
    } catch (error) {
      sendError(res, 500, errorMessage(error));
    }
  });

  router.post('/challenges', (_req: Request, res: Response) => {
    const challenge = randomBytes32();
    const expiresAtMs = Date.now() + 60_000;
    registerChallenge(challenge, expiresAtMs);
    res.status(201).json(toJsonSafe({ challenge: toHex(challenge), challengeExpiresAt: BigInt(expiresAtMs) }));
  });

  router.post('/credit-decisions', async (req: Request, res: Response) => {
    try {
      const body = req.body as Record<string, unknown>;
      const challengeHex = requiredString(body, 'challenge');
      const authorization = requiredAuthorization(body);

      if (!consumeChallenge(challengeHex)) {
        sendError(res, 401, 'Invalid or expired challenge — request a new one from POST /challenges');
        return;
      }

      let userPk: Uint8Array;
      let userPkHex: string;
      let veilIdHash: string;
      let sporeId: string;
      let ownerCkbLockHash: string;
      let message: string;
      let resolvedDobRecord: NonNullable<Awaited<ReturnType<VeilDobService['getVeilIdentityDOBRecord']>>> | undefined;

      const didInput = optionalString(body, 'did');
      if (didInput) {
        const { veilIdHash: didVeilIdHash } = parseVeilDid(didInput);
        const dobRecord = await veilDob.getVeilIdentityDOBRecord(didVeilIdHash);
        if (!dobRecord || dobRecord.did !== didInput) {
          sendError(res, 404, 'Veil DID not found');
          return;
        }
        if (!dobRecord.didRegistryTxHash) {
          sendError(res, 409, 'Veil DID has not been registered on Midnight yet');
          return;
        }
        if (!dobRecord.userPk) {
          sendError(res, 409, 'Veil DID record does not contain the user public key required for score lookup');
          return;
        }
        resolvedDobRecord = dobRecord;

        userPk = requiredBytes({ userPk: dobRecord.userPk }, 'userPk');
        userPkHex = toHex(userPk);
        veilIdHash = dobRecord.veilIdHash;
        sporeId = dobRecord.sporeId;
        ownerCkbLockHash = dobRecord.ckbOwnerLockHash;

        message = buildDidCreditDecisionMessage({
          did: didInput,
          challenge: challengeHex,
          verificationMethod: authorization.verificationMethod ?? `${didInput}#ckb-owner-1`,
          registryVersion: 1,
        });
      } else {
        userPk = requiredBytes(body, 'userPk');
        userPkHex = toHex(userPk);
        veilIdHash = requiredString(body, 'veilIdHash').toLowerCase();
        sporeId = requiredString(body, 'sporeId').toLowerCase();
        const userCkbAddress = requiredString(body, 'userCkbAddress');
        ownerCkbLockHash = await veilDob.getOwnerCkbLockHash(userCkbAddress);

        message = buildCreditDecisionMessage({
          challenge: challengeHex,
          userPk: userPkHex,
          veilIdHash,
          sporeId,
        });
      }

      try {
        const dob = await veilDob.getVeilIdentityDOB(sporeId);
        if (dob.content.veilIdHash !== veilIdHash) {
          sendError(res, 401, 'Spore DOB does not match requested veilIdHash');
          return;
        }

        if (dob.content.ownerCkbLockHash !== ownerCkbLockHash) {
          sendError(res, 401, 'CKB address does not match the DOB owner lock hash');
          return;
        }

        const verification = veilDob.verifyLoadedVeilIdentityDOB(dob, veilIdHash);
        if (!verification.valid) {
          sendError(res, 401, 'Invalid Veil Identity DOB');
          return;
        }
      } catch (error) {
        if (
          !resolvedDobRecord ||
          !resolvedDobRecord.didRegistryTxHash ||
          resolvedDobRecord.veilIdHash !== veilIdHash ||
          resolvedDobRecord.sporeId.toLowerCase() !== sporeId.toLowerCase() ||
          resolvedDobRecord.ckbOwnerLockHash !== ownerCkbLockHash
        ) {
          throw error;
        }
      }

      const authorized = await verifyCreditDecisionAuthorization(message, authorization);
      if (!authorized) {
        sendError(res, 401, 'Invalid credit decision authorization signature');
        return;
      }

      if (authorization.signType === ccc.SignerSignType.CkbSecp256k1) {
        const signer = new ccc.SignerCkbPublicKey(veilDob.cccClient(), authorization.identity);
        const signerAddress = await signer.getRecommendedAddress();
        const signerLockHash = await veilDob.getOwnerCkbLockHash(signerAddress);
        if (signerLockHash !== ownerCkbLockHash) {
          sendError(res, 401, 'Authorization public key does not match the requested CKB address');
          return;
        }
      }

      const decision = await contract.createCreditDecision(userPk, veilIdHash);
      res.status(200).json(toJsonSafe({ success: true, ...decision }));
    } catch (error) {
      const msg = errorMessage(error);
      if (msg.includes('Unauthorized')) {
        sendError(res, 401, msg);
      } else {
        sendError(res, 500, msg);
      }
    }
  });

  return router;
};
