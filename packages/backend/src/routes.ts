import express, { type Request, type Response, type Router } from 'express';
import { toHex } from '@midnight-ntwrk/compact-runtime';

import type { ContractService } from './services/contract-service.js';
import {
  optionalBigInt,
  optionalBytes,
  optionalString,
  randomBytes32,
  requiredBigInt,
  requiredBytes,
  toJsonSafe,
} from './http-utils.js';

const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

const sendError = (res: Response, status: number, message: string): void => {
  res.status(status).json({ success: false, message });
};

export const buildRouter = (contract: ContractService): Router => {
  const router = express.Router();

  router.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ success: true, service: 'veil-backend', version: 'v1' });
  });

  router.post('/deployments/staged', async (req: Request, res: Response) => {
    try {
      const body = req.body as Record<string, unknown>;
      const result = await contract.deployStagedContract({
        nonce: optionalBytes(body, 'nonce', randomBytes32()),
        currentTime: optionalBigInt(body, 'currentTime', BigInt(Date.now())),
      });
      res.status(201).json(toJsonSafe({ success: true, result }));
    } catch (error) {
      sendError(res, 500, errorMessage(error));
    }
  });

  router.post('/admin/issuers', async (req: Request, res: Response) => {
    try {
      const body = req.body as Record<string, unknown>;
      const protocolName = optionalString(body, 'protocolName') ?? 'Aave';
      const contractAddress = optionalString(body, 'contractAddress') ?? contract.getContractAddress();
      if (!contractAddress) {
        throw new Error('contractAddress is required because no Veil contract is joined yet');
      }

      const result = await contract.addIssuer({
        protocolName,
        contractAddress,
      });
      res.status(200).json(toJsonSafe({ success: true, result }));
    } catch (error) {
      sendError(res, 500, errorMessage(error));
    }
  });

  router.post('/score-entries', async (req: Request, res: Response) => {
    try {
      const body = req.body as Record<string, unknown>;
      const userPk = requiredBytes(body, 'userPk');
      const result = await contract.createScoreEntry(userPk);
      res.status(200).json(toJsonSafe({ success: true, result }));
    } catch (error) {
      sendError(res, 500, errorMessage(error));
    }
  });

  router.post('/pot-nft/verifications', async (req: Request, res: Response) => {
    try {
      const body = req.body as Record<string, unknown>;
      const challenge = optionalBytes(body, 'challenge', randomBytes32());
      const challengeExpiresAt = optionalBigInt(body, 'challengeExpiresAt', BigInt(Date.now() + 60_000));
      const result = await contract.verifyPoTNFT({
        issuerPk: requiredBytes(body, 'issuerPk'),
        userPk: requiredBytes(body, 'userPk'),
        challenge,
        challengeExpiresAt,
        ownershipSecret: requiredBytes(body, 'ownershipSecret'),
      });
      res.status(200).json(toJsonSafe({ success: true, result }));
    } catch (error) {
      sendError(res, 500, errorMessage(error));
    }
  });

  router.post('/scoring-events/repayments', async (req: Request, res: Response) => {
    try {
      const body = req.body as Record<string, unknown>;
      const result = await contract.submitRepaymentEvent({
        userPk: requiredBytes(body, 'userPk'),
        issuerPk: requiredBytes(body, 'issuerPk'),
        paidOnTimeFlag: requiredBigInt(body, 'paidOnTimeFlag'),
        amountWeight: requiredBigInt(body, 'amountWeight'),
        eventEpoch: requiredBigInt(body, 'eventEpoch'),
        eventId: optionalBytes(body, 'eventId', randomBytes32()),
      });
      res.status(200).json(toJsonSafe({ success: true, result }));
    } catch (error) {
      sendError(res, 500, errorMessage(error));
    }
  });

  router.post('/scoring-events/liquidations', async (req: Request, res: Response) => {
    try {
      const body = req.body as Record<string, unknown>;
      const result = await contract.submitLiquidationEvent({
        userPk: requiredBytes(body, 'userPk'),
        issuerPk: requiredBytes(body, 'issuerPk'),
        severity: requiredBigInt(body, 'severity'),
        eventEpoch: requiredBigInt(body, 'eventEpoch'),
        eventId: optionalBytes(body, 'eventId', randomBytes32()),
      });
      res.status(200).json(toJsonSafe({ success: true, result }));
    } catch (error) {
      sendError(res, 500, errorMessage(error));
    }
  });

  router.post('/scoring-events/protocol-usage', async (req: Request, res: Response) => {
    try {
      const body = req.body as Record<string, unknown>;
      const result = await contract.submitProtocolUsageEvent({
        userPk: requiredBytes(body, 'userPk'),
        issuerPk: requiredBytes(body, 'issuerPk'),
        protocolId: requiredBytes(body, 'protocolId'),
        eventEpoch: requiredBigInt(body, 'eventEpoch'),
      });
      res.status(200).json(toJsonSafe({ success: true, result }));
    } catch (error) {
      sendError(res, 500, errorMessage(error));
    }
  });

  router.post('/scoring-events/debt-states', async (req: Request, res: Response) => {
    try {
      const body = req.body as Record<string, unknown>;
      const result = await contract.submitDebtStateEvent({
        userPk: requiredBytes(body, 'userPk'),
        issuerPk: requiredBytes(body, 'issuerPk'),
        activeDebtFlag: requiredBigInt(body, 'activeDebtFlag'),
        riskBand: requiredBigInt(body, 'riskBand'),
        eventEpoch: requiredBigInt(body, 'eventEpoch'),
        eventId: optionalBytes(body, 'eventId', randomBytes32()),
      });
      res.status(200).json(toJsonSafe({ success: true, result }));
    } catch (error) {
      sendError(res, 500, errorMessage(error));
    }
  });

  router.post('/challenges', (_req: Request, res: Response) => {
    const challenge = randomBytes32();
    const challengeExpiresAt = BigInt(Date.now() + 60_000);
    res.status(201).json(toJsonSafe({ challenge: toHex(challenge), challengeExpiresAt }));
  });

  return router;
};
