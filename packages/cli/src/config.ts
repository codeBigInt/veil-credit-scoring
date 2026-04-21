import path from 'node:path';
import axios from 'axios';
import {
  EnvironmentConfiguration,
  getTestEnvironment,
  RemoteTestEnvironment,
  TestEnvironment,
} from '@midnight-ntwrk/testkit-js';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { Logger } from 'pino';

const HEALTH_CHECK_TIMEOUT_MS = 15_000;

const checkUrl = async (url: string, logger: { warn: (msg: string) => void }): Promise<void> => {
  try {
    await axios.get(url, { timeout: HEALTH_CHECK_TIMEOUT_MS });
  } catch (e) {
    logger.warn(`Health check warning for ${url}: ${e instanceof Error ? e.message : String(e)}`);
  }
};

export interface Config {
  readonly privateStateStoreName: string;
  readonly logDir: string;
  readonly zkConfigPath: string;
  getEnvironment(logger: Logger): TestEnvironment;
  readonly requestFaucetTokens: boolean;
  readonly generateDust: boolean;
}

export const currentDir = path.resolve(new URL(import.meta.url).pathname, '..');

const contractZkPath = path.resolve(currentDir, '..', '..', 'contract', 'src', 'managed', 'veil-protocol');

export class StandaloneConfig implements Config {
  privateStateStoreName = 'veil-credit-private-state';
  logDir = path.resolve(currentDir, '..', 'logs', 'standalone', `${new Date().toISOString()}.log`);
  zkConfigPath = contractZkPath;
  requestFaucetTokens = false;
  generateDust = false;

  getEnvironment(logger: Logger): TestEnvironment {
    return getTestEnvironment(logger) as TestEnvironment;
  }
}

export class PreviewConfig implements Config {
  privateStateStoreName = 'veil-credit-private-state';
  logDir = path.resolve(currentDir, '..', 'logs', 'preview-remote', `${new Date().toISOString()}.log`);
  zkConfigPath = contractZkPath;
  requestFaucetTokens = false;
  generateDust = true;

  getEnvironment(logger: Logger): TestEnvironment {
    setNetworkId('preview');
    return new PreviewTestEnvironment(logger);
  }
}

export class PreProdConfig implements Config {
  privateStateStoreName = 'veil-credit-private-state';
  logDir = path.resolve(currentDir, '..', 'logs', 'preprod-remote', `${new Date().toISOString()}.log`);
  zkConfigPath = contractZkPath;
  requestFaucetTokens = false;
  generateDust = true;

  getEnvironment(logger: Logger): TestEnvironment {
    setNetworkId('preprod');
    return new PreprodTestEnvironment(logger);
  }
}

export class PreviewTestEnvironment extends RemoteTestEnvironment {
  constructor(logger: Logger) {
    super(logger);
  }

  private getProofServerUrl(): string {
    const self = this as unknown as { proofServerContainer?: { getUrl(): string } };
    const container = self.proofServerContainer;
    if (!container) {
      throw new Error('Proof server container is not available.');
    }
    return container.getUrl();
  }

  getEnvironmentConfiguration(): EnvironmentConfiguration {
    return {
      walletNetworkId: 'preview',
      networkId: 'preview',
      indexer: 'https://indexer.preview.midnight.network/api/v3/graphql',
      indexerWS: 'wss://indexer.preview.midnight.network/api/v3/graphql/ws',
      node: 'https://rpc.preview.midnight.network',
      nodeWS: 'wss://rpc.preview.midnight.network',
      faucet: 'https://faucet.preview.midnight.network/api/request-tokens',
      proofServer: this.getProofServerUrl(),
    };
  }
}

export class PreprodTestEnvironment extends RemoteTestEnvironment {
  constructor(logger: Logger) {
    super(logger);
  }

  private getProofServerUrl(): string {
    const self = this as unknown as { proofServerContainer?: { getUrl(): string } };
    const container = self.proofServerContainer;
    if (!container) {
      throw new Error('Proof server container is not available.');
    }
    return container.getUrl();
  }

  getEnvironmentConfiguration(): EnvironmentConfiguration {
    return {
      walletNetworkId: 'preprod',
      networkId: 'preprod',
      indexer: 'https://indexer.preprod.midnight.network/api/v3/graphql',
      indexerWS: 'wss://indexer.preprod.midnight.network/api/v3/graphql/ws',
      node: 'https://rpc.preprod.midnight.network',
      nodeWS: 'wss://rpc.preprod.midnight.network',
      faucet: 'https://faucet.preprod.midnight.network/api/request-tokens',
      proofServer: this.getProofServerUrl(),
    };
  }

  healthCheck = async (): Promise<void> => {
    const logger = (this as unknown as { logger: Logger }).logger;
    logger.info('Performing env health check (timeout: 15s)');
    const cfg = this.getEnvironmentConfiguration();
    await checkUrl(`${cfg.node}/health`, logger);
    await checkUrl(`${cfg.indexer.replace('/graphql', '/health')}`, logger);
    await checkUrl(`${cfg.proofServer}/health`, logger);
    if (cfg.faucet) {
      await checkUrl(`${cfg.faucet.replace('/api/request-tokens', '/api/health')}`, logger);
    }
  };
}
