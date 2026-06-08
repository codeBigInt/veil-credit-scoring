import { MongoClient } from 'mongodb';
import pino from 'pino';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';

import { apiVersion, createApp } from './app.js';
import { configureEnvironment, getConfig, MIDNIGHT_NETWORK_MODES } from './config.js';
import { VeilDobService } from './modules/ckb/index.js';
import { ContractService } from './services/contract-service.js';
import { TxQueue } from './services/tx-queue.js';

const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  transport: process.env.NODE_ENV === 'production' ? undefined : { target: 'pino-pretty' },
});

const main = async (): Promise<void> => {
  const config = getConfig();
  setNetworkId(process.env.MIDNIGHT_NETWORK as MIDNIGHT_NETWORK_MODES);

  const mongo = new MongoClient(config.mongoUri);
  try {
    await mongo.connect();
  } catch (error) {
    throw new Error(
      `Could not connect to MongoDB at ${config.mongoUri}. Start MongoDB locally or update MONGODB_URI in packages/backend/.env.`,
      { cause: error },
    );
  }
  const db = mongo.db(config.mongoDbName);

  const env = configureEnvironment(config.proofServer, process.env.MIDNIGHT_NETWORK as MIDNIGHT_NETWORK_MODES ?? "preview");
  const contract = await ContractService.build(config, env, db, logger);
  process.env.MIDNIGHT_CONTRACT_ADDRESS ??= contract.contractAddress();
  const txQueue = new TxQueue(db, logger);
  await txQueue.init();
  const veilDob = new VeilDobService(db);

  const app = createApp(contract, txQueue, veilDob);

  const server = app.listen(config.port, () => {
    logger.info(`Veil backend API listening at http://localhost:${config.port}${apiVersion}`);
  });

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
      logger.error({ err: error }, 'Shutdown failed');
      process.exit(1);
    });
  });

  process.once('SIGTERM', () => {
    shutdown().then(() => process.exit(0), (error) => {
      logger.error({ err: error }, 'Shutdown failed');
      process.exit(1);
    });
  });
};

main().catch((error) => {
  logger.error({ err: error }, 'Backend startup failed');
  process.exit(1);
});
