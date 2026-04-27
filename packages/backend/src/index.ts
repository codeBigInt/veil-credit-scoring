import http from 'node:http';
import cors from 'cors';
import express from 'express';
import { MongoClient } from 'mongodb';
import pino from 'pino';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';

import { getConfig, preprodEnvironment } from './config.js';
import { ContractService } from './services/contract-service.js';
import { TxQueue } from './services/tx-queue.js';
import { buildRouter } from './routes.js';

const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  transport: process.env.NODE_ENV === 'production' ? undefined : { target: 'pino-pretty' },
});

const main = async (): Promise<void> => {
  const config = getConfig();
  setNetworkId('preprod');

  const mongo = new MongoClient(config.mongoUri);
  await mongo.connect();
  const db = mongo.db(config.mongoDbName);

  const env = preprodEnvironment(config.proofServer);
  const contract = await ContractService.build(config, env, db, logger);
  const queue = new TxQueue(db, logger);
  await queue.init();

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use('/api', buildRouter(contract, queue));

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(config.port, resolve));
  logger.info(`Veil backend API listening on port ${config.port}`);

  const shutdown = async (): Promise<void> => {
    logger.info('Shutting down Veil backend API');
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
    await contract.stop();
    await mongo.close();
  };

  process.once('SIGINT', () => {
    shutdown().then(() => process.exit(0), (error) => {
      logger.error({ error }, 'Shutdown failed');
      process.exit(1);
    });
  });
  
  process.once('SIGTERM', () => {
    shutdown().then(() => process.exit(0), (error) => {
      logger.error({ error }, 'Shutdown failed');
      process.exit(1);
    });
  });
};

main().catch((error) => {
  logger.error({ error }, 'Backend startup failed');
  process.exit(1);
});
