import express, { type Request, type Response, type Router } from 'express';
import type { Collection, Db } from 'mongodb';
import { MidnightBech32m } from '@midnightntwrk/wallet-sdk-address-format';

import type { ContractService } from './services/contract-service.js';
import { publicErrorMessage } from './logging.js';

type BackupKind = 'private_state' | 'wallet_metadata' | 'wallet_export';

type BackupRecord = {
  readonly owner: string;
  readonly backupId: string;
  readonly kind: BackupKind;
  readonly payload: unknown;
  readonly metadata?: Record<string, unknown>;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

const errorMessage = (error: unknown): string => publicErrorMessage(error);

const sendError = (res: Response, status: number, message: string): void => {
  res.status(status).json({ success: false, message });
};

const requiredString = (record: Record<string, unknown>, key: string): string => {
  const value = record[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${key} is required`);
  }
  return value.trim();
};

const optionalKind = (value: unknown): BackupKind => {
  if (value === 'private_state' || value === 'wallet_metadata' || value === 'wallet_export') return value;
  return 'private_state';
};

const optionalMetadata = (value: unknown): Record<string, unknown> | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
};

const optionalBigIntString = (value: unknown, key: string): bigint | undefined => {
  if (value == null || value === '') return undefined;
  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'bigint') {
    throw new Error(`${key} must be a decimal string`);
  }

  const text = String(value);
  if (!/^\d+$/.test(text)) throw new Error(`${key} must be a decimal string`);
  return BigInt(text);
};

const requireEncryptedPayload = (body: Record<string, unknown>): unknown => {
  const payload = body.payload;
  if (payload == null) {
    throw new Error('payload is required');
  }
  return payload;
};

const isDustAddress = (value: string): boolean => {
  try {
    return MidnightBech32m.parse(value).type === 'dust';
  } catch {
    return false;
  }
};

export const buildRouter = (contract: ContractService, db: Db): Router => {
  const router = express.Router();
  const backups: Collection<BackupRecord> = db.collection<BackupRecord>('veil_client_backups');

  void backups.createIndex({ owner: 1, backupId: 1 }, { unique: true });
  void backups.createIndex({ owner: 1, updatedAt: -1 });

  router.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      service: 'veil-backend',
      version: 'v2',
      scope: ['contract_deployment', 'dust_sponsorship', 'client_backup'],
    });
  });

  router.get('/contract', (_req: Request, res: Response) => {
    try {
      res.status(200).json({
        success: true,
        contractAddress: contract.contractAddress() ?? null,
        backendRole: 'contract-deployer-dust-sponsor-and-backup',
        deploymentEnabled: contract.deploymentEnabled(),
      });
    } catch (error) {
      sendError(res, 500, errorMessage(error));
    }
  });

  router.post('/contract/deploy', async (_req: Request, res: Response) => {
    if (!contract.deploymentEnabled()) {
      sendError(res, 403, 'Backend contract deployment is disabled. Set VEIL_AUTO_DEPLOY=true to enable it.');
      return;
    }

    try {
      const contractAddress = await contract.deployContract();
      res.status(200).json({
        success: true,
        contractAddress,
        deployed: true,
      });
    } catch (error) {
      sendError(res, 500, errorMessage(error));
    }
  });

  router.get('/sponsor/status', async (_req: Request, res: Response) => {
    try {
      res.status(200).json({
        success: true,
        sponsor: await contract.sponsorStatus(),
      });
    } catch (error) {
      sendError(res, 500, errorMessage(error));
    }
  });

  const sponsorDust = async (req: Request, res: Response): Promise<void> => {
    try {
      const body = req.body as Record<string, unknown>;
      const dustAddress = requiredString(body, 'dustAddress');
      if (!isDustAddress(dustAddress)) {
        sendError(res, 400, 'dustAddress must be a valid Midnight bech32m dust address (mn_dust...).');
        return;
      }

      const sponsorship = await contract.sponsorDust(
        dustAddress,
        optionalBigIntString(body.requiredDust, 'requiredDust'),
      );
      if (sponsorship == null) {
        res.status(200).json({
          success: true,
          sponsored: false,
          reason: 'Free DUST sponsorship is temporarily unavailable. Please try again shortly.',
          retryable: true,
          sponsor: await contract.sponsorStatus(),
        });
        return;
      }

      res.status(200).json({ success: true, sponsored: true, ...sponsorship });
    } catch (error) {
      sendError(res, 500, errorMessage(error));
    }
  };

  router.post('/sponsor/dust', sponsorDust);
  router.post('/dust-sponsor', sponsorDust);

  router.put('/backups/:backupId', async (req: Request, res: Response) => {
    try {
      const body = req.body as Record<string, unknown>;
      const owner = requiredString(body, 'owner');
      const backupId = req.params.backupId;
      if (typeof backupId !== 'string' || backupId.trim() === '') {
        sendError(res, 400, 'backupId is required');
        return;
      }

      const now = new Date();
      await backups.updateOne(
        { owner, backupId },
        {
          $setOnInsert: {
            owner,
            backupId,
            createdAt: now,
          },
          $set: {
            kind: optionalKind(body.kind),
            payload: requireEncryptedPayload(body),
            metadata: optionalMetadata(body.metadata),
            version: typeof body.version === 'number' ? body.version : 1,
            updatedAt: now,
          },
        },
        { upsert: true },
      );

      res.status(200).json({ success: true, owner, backupId, updatedAt: now.toISOString() });
    } catch (error) {
      sendError(res, 400, errorMessage(error));
    }
  });

  router.get('/backups/:backupId', async (req: Request, res: Response) => {
    try {
      const owner = typeof req.query.owner === 'string' ? req.query.owner : '';
      const backupId = req.params.backupId;
      if (!owner || typeof backupId !== 'string') {
        sendError(res, 400, 'owner query parameter and backupId are required');
        return;
      }

      const backup = await backups.findOne({ owner, backupId }, { projection: { _id: 0 } });
      if (!backup) {
        sendError(res, 404, 'Backup not found');
        return;
      }

      res.status(200).json({ success: true, backup });
    } catch (error) {
      sendError(res, 500, errorMessage(error));
    }
  });

  router.get('/backups', async (req: Request, res: Response) => {
    try {
      const owner = typeof req.query.owner === 'string' ? req.query.owner : '';
      if (!owner) {
        sendError(res, 400, 'owner query parameter is required');
        return;
      }

      const rows = await backups
        .find({ owner }, { projection: { _id: 0, payload: 0 } })
        .sort({ updatedAt: -1 })
        .toArray();
      res.status(200).json({ success: true, backups: rows });
    } catch (error) {
      sendError(res, 500, errorMessage(error));
    }
  });

  router.delete('/backups/:backupId', async (req: Request, res: Response) => {
    try {
      const owner = typeof req.query.owner === 'string' ? req.query.owner : '';
      const backupId = req.params.backupId;
      if (!owner || typeof backupId !== 'string') {
        sendError(res, 400, 'owner query parameter and backupId are required');
        return;
      }

      const result = await backups.deleteOne({ owner, backupId });
      res.status(200).json({ success: true, deleted: result.deletedCount > 0 });
    } catch (error) {
      sendError(res, 500, errorMessage(error));
    }
  });

  return router;
};
