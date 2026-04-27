import type { Request, Response, Router } from 'express';
import { Router as createRouter } from 'express';
import { toHex } from '@midnight-ntwrk/compact-runtime';

import type { ContractService } from './services/contract-service.js';
import { formatJob, type TxQueue } from './services/tx-queue.js';
import {
  optionalBigInt,
  optionalBytes,
  randomBytes32,
  requiredBigInt,
  requiredBytes,
  toJsonSafe,
} from './http-utils.js';

type AsyncHandler = (req: Request, res: Response) => Promise<void>;

const asyncHandler =
  (handler: AsyncHandler) =>
  (req: Request, res: Response): void => {
    handler(req, res).catch((error) => {
      res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
    });
  };

const enqueueResponse = async (
  res: Response,
  queue: TxQueue,
  name: string,
  run: () => Promise<unknown>,
): Promise<void> => {
  const job = await queue.enqueue(name, run);
  res.status(202).json(toJsonSafe(formatJob(job)));
};

export const buildRouter = (contract: ContractService, queue: TxQueue): Router => {
  const router = createRouter();

  router.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  router.get(
    '/jobs/:id',
    asyncHandler(async (req, res) => {
      const id = req.params.id;
      if (typeof id !== 'string') {
        res.status(400).json({ error: 'Job id is required' });
        return;
      }

      const job = await queue.get(id);
      if (!job) {
        res.status(404).json({ error: 'Job not found' });
        return;
      }
      res.json(toJsonSafe(formatJob(job)));
    }),
  );

  router.post(
    '/score-entry',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const userPk = requiredBytes(body, 'userPk');
      await enqueueResponse(res, queue, 'Scoring_createScoreEntry', () => contract.createScoreEntry(userPk));
    }),
  );

  router.post(
    '/verify-pot-nft',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const challenge = optionalBytes(body, 'challenge', randomBytes32());
      const challengeExpiresAt = optionalBigInt(body, 'challengeExpiresAt', BigInt(Date.now() + 60_000));

      await enqueueResponse(res, queue, 'NFT_verifyPoTNFT', () =>
        contract.verifyPoTNFT({
          issuerPk: requiredBytes(body, 'issuerPk'),
          userPk: requiredBytes(body, 'userPk'),
          challenge,
          challengeExpiresAt,
          ownershipSecret: requiredBytes(body, 'ownershipSecret'),
        }),
      );
    }),
  );

  router.post(
    '/events/repayment',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      await enqueueResponse(res, queue, 'Scoring_submitRepaymentEvent', () =>
        contract.submitRepaymentEvent({
          userPk: requiredBytes(body, 'userPk'),
          issuerPk: requiredBytes(body, 'issuerPk'),
          paidOnTimeFlag: requiredBigInt(body, 'paidOnTimeFlag'),
          amountWeight: requiredBigInt(body, 'amountWeight'),
          eventEpoch: requiredBigInt(body, 'eventEpoch'),
          eventId: optionalBytes(body, 'eventId', randomBytes32()),
        }),
      );
    }),
  );

  router.post(
    '/events/liquidation',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      await enqueueResponse(res, queue, 'Scoring_submitLiquidationEvent', () =>
        contract.submitLiquidationEvent({
          userPk: requiredBytes(body, 'userPk'),
          issuerPk: requiredBytes(body, 'issuerPk'),
          severity: requiredBigInt(body, 'severity'),
          eventEpoch: requiredBigInt(body, 'eventEpoch'),
          eventId: optionalBytes(body, 'eventId', randomBytes32()),
        }),
      );
    }),
  );

  router.post(
    '/events/protocol-usage',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      await enqueueResponse(res, queue, 'Scoring_submitProtocolUsageEvent', () =>
        contract.submitProtocolUsageEvent({
          userPk: requiredBytes(body, 'userPk'),
          issuerPk: requiredBytes(body, 'issuerPk'),
          protocolId: requiredBytes(body, 'protocolId'),
          eventEpoch: requiredBigInt(body, 'eventEpoch'),
        }),
      );
    }),
  );

  router.post(
    '/events/debt-state',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      await enqueueResponse(res, queue, 'Scoring_submitDebtStateEvent', () =>
        contract.submitDebtStateEvent({
          userPk: requiredBytes(body, 'userPk'),
          issuerPk: requiredBytes(body, 'issuerPk'),
          activeDebtFlag: requiredBigInt(body, 'activeDebtFlag'),
          riskBand: requiredBigInt(body, 'riskBand'),
          eventEpoch: requiredBigInt(body, 'eventEpoch'),
          eventId: optionalBytes(body, 'eventId', randomBytes32()),
        }),
      );
    }),
  );

  router.post(
    '/challenge',
    asyncHandler(async (_req, res) => {
      const challenge = randomBytes32();
      const challengeExpiresAt = BigInt(Date.now() + 60_000);
      res.json(toJsonSafe({ challenge: toHex(challenge), challengeExpiresAt }));
    }),
  );

  return router;
};
