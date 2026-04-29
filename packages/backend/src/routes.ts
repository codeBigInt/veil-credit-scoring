import express, { type Request, type Response, type Router } from 'express';
import { toHex } from '@midnight-ntwrk/compact-runtime';

import type { ContractService } from './services/contract-service.js';
import { formatJob, type TxQueue } from './services/tx-queue.js';
import {
  optionalBigInt,
  optionalBytes,
  randomBytes32,
  requiredBigInt,
  requiredBytes,
  requiredString,
  toJsonSafe,
} from './http-utils.js';

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

const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

const sendError = (res: Response, status: number, message: string): void => {
  res.status(status).json({ success: false, message });
};

type TxRunner = () => Promise<unknown>;

const sendQueued = async (res: Response, txQueue: TxQueue, name: string, run: TxRunner): Promise<void> => {
  const job = await txQueue.enqueue(name, run);
  res.status(202).json(toJsonSafe({ success: true, job: formatJob(job) }));
};

export const buildRouter = (contract: ContractService, txQueue: TxQueue): Router => {
  const router = express.Router();

  router.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ success: true, service: 'veil-backend', version: 'v1' });
  });

  router.post('/score-entries', async (req: Request, res: Response) => {
    try {
      const body = req.body as Record<string, unknown>;
      const userPk = requiredBytes(body, 'userPk');
      await sendQueued(res, txQueue, 'Scoring_createScoreEntry', () => contract.createScoreEntry(userPk));
    } catch (error) {
      sendError(res, 500, errorMessage(error));
    }
  });

  router.post('/pot-nft/verifications', async (req: Request, res: Response) => {
    try {
      const body = req.body as Record<string, unknown>;
      const challenge = optionalBytes(body, 'challenge', randomBytes32());
      const challengeExpiresAt = optionalBigInt(body, 'challengeExpiresAt', BigInt(Date.now() + 60_000));
      const input = {
        issuerPk: requiredBytes(body, 'issuerPk'),
        userPk: requiredBytes(body, 'userPk'),
        challenge,
        challengeExpiresAt,
        ownershipSecret: requiredBytes(body, 'ownershipSecret'),
      };
      await sendQueued(res, txQueue, 'NFT_verifyPoTNFT', () => contract.verifyPoTNFT(input));
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

  router.post('/user-data/query', async (req: Request, res: Response) => {
    try {
      const body = req.body as Record<string, unknown>;
      const claimedUserPk = requiredBytes(body, 'userPk');
      const challengeHex = requiredString(body, 'challenge');
      const userSecret = requiredBytes(
        body,
        typeof body.secreteKey === 'string' ? 'secreteKey' : 'ownershipSecret',
      );

      if (!consumeChallenge(challengeHex)) {
        sendError(res, 401, 'Invalid or expired challenge — request a new one from POST /challenges');
        return;
      }

      const data = await contract.readUserData(userSecret, claimedUserPk);
      res.status(200).json(toJsonSafe({ success: true, ...data }));
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
