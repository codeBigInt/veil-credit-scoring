import path from 'node:path';
import * as dotenv from 'dotenv';

const currentDir = path.resolve(new URL(import.meta.url).pathname, '..');
dotenv.config({ path: path.resolve(currentDir, '..', '.env') });
dotenv.config({ path: path.resolve(currentDir, '..', '..', '..', '.env') });

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
};

const optionalNumber = (name: string, fallback: number): number => {
  const value = process.env[name];
  return value ? Number(value) : fallback;
};

export type BackendConfig = {
  readonly port: number;
  readonly mongoUri: string;
  readonly mongoDbName: string;
  readonly walletSeed: string;
  readonly contractAddress?: string;
  readonly autoDeploy: boolean;
  readonly proofServer: string;
  readonly zkConfigPath: string;
  readonly privateStateId: 'veil_ps';
};

export type EnvironmentConfig = {}

export const getConfig = (): BackendConfig => {
  const contractZkPath = path.resolve(currentDir, 'contract-build', 'managed', 'veil-protocol');

  return {
    port: optionalNumber('PORT', 3001),
    mongoUri: required('MONGODB_URI'),
    mongoDbName: process.env.MONGODB_DB_NAME ?? 'veil_backend',
    walletSeed: required('VEIL_BACKEND_WALLET_SEED'),
    contractAddress: process.env.VEIL_CONTRACT_ADDRESS || undefined,
    autoDeploy: process.env.VEIL_AUTO_DEPLOY === 'true',
    proofServer: required('VEIL_PROOF_SERVER_URL'),
    zkConfigPath: process.env.VEIL_ZK_CONFIG_PATH ?? contractZkPath,
    privateStateId: 'veil_ps',
  };
};

export const preprod = {
  walletNetworkId: 'preprod',
  networkId: 'preprod',
  indexer: 'https://indexer.preprod.midnight.network/api/v4/graphql',
  indexerWS: 'wss://indexer.preprod.midnight.network/api/v4/graphql/ws',
  node: 'https://rpc.preprod.midnight.network',
  nodeWS: 'wss://rpc.preprod.midnight.network',
  faucet: 'https://faucet.preprod.midnight.network/api/request-tokens'
};

export const preview = {
  walletNetworkId: 'preview',
  networkId: 'preview',
  indexer: 'https://indexer.preview.midnight.network/api/v4/graphql',
  indexerWS: 'wss://indexer.preview.midnight.network/api/v4/graphql/ws',
  node: 'https://rpc.preview.midnight.network',
  nodeWS: 'wss://rpc.preview.midnight.network',
  faucet: 'https://faucet.preview.midnight.network/api/request-tokens'
};

export const mainnet = {
  walletNetworkId: 'mainnet',
  networkId: 'mainnet',
  indexer: 'https://indexer.mainnet.midnight.network/api/v4/graphql',
  indexerWS: 'wss://indexer.mainnet.midnight.network/api/v4/graphql/ws',
  node: 'https://rpc.mainnet.midnight.network',
  nodeWS: 'wss://rpc.mainnet.midnight.network',
  faucet: 'https://faucet.mainnet.midnight.network/api/request-tokens'
};

export type MIDNIGHT_NETWORK_MODES = "preprod" | "preview" | "mainnet";

export const configureEnvironment = (proofServer: string, networkId: MIDNIGHT_NETWORK_MODES) => {
  const config = networkId == "preview" ? preview : networkId == "preprod" ? preprod : mainnet
  return {
    ...config,
    proofServer
  }
};
