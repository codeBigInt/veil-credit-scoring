import cors from 'cors';
import express, { type Express, type Request, type Response } from 'express';

import { buildRouter } from './routes.js';
import type { ContractService } from './services/contract-service.js';
import type { TxQueue } from './services/tx-queue.js';

export const apiVersion = '/api/v1';

export const createApp = (contract: ContractService, txQueue: TxQueue): Express => {
  const app = express();

  app.use(express.json({ limit: '1mb' }));
  app.use(cors());

  app.get(apiVersion, (_req: Request, res: Response) => {
    res.status(200).send(`Welcome to Veil backend API: ${apiVersion}`);
  });

  app.use(apiVersion, buildRouter(contract, txQueue));

  return app;
};
