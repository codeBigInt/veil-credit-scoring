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
  readonly sponsorWalletSeed: string;
  readonly sponsorDefaultRequiredDust: bigint;
  readonly sponsorAllocationTtlMs: number;
  readonly sponsorReclaimIntervalMs: number;
  readonly sponsorReclaimMaxAttempts: number;
  readonly sponsorRateLimitWindowMs: number;
  readonly sponsorRateLimitMaxPerDustAddress: number;
  readonly sponsorRateLimitMaxPerIp: number;
  readonly sponsorPoolTargetFreeUtxos: number;
  readonly sponsorPoolSplitAmount: bigint;
  readonly sponsorPoolMaxSplitOutputs: number;
  readonly contractAddress?: string;
  readonly autoDeploy: boolean;
  readonly proofServer: string;
  readonly zkConfigPath: string;
  readonly privateStateId: 'veil_ps';
};

export type EnvironmentConfig = {}

export const getConfig = (): BackendConfig => {
  const contractZkPath = path.resolve(currentDir, '..', '..', 'contract', 'dist', 'managed', 'veil-protocol');

  return {
    port: optionalNumber('PORT', 3001),
    mongoUri: required('MONGODB_URI'),
    mongoDbName: process.env.MONGODB_DB_NAME ?? 'veil_backend',
    walletSeed: required('VEIL_BACKEND_WALLET_SEED'),
    sponsorWalletSeed: process.env.VEIL_SPONSOR_WALLET_SEED ?? required('VEIL_BACKEND_WALLET_SEED'),
    sponsorDefaultRequiredDust: BigInt(process.env.VEIL_SPONSOR_DEFAULT_REQUIRED_DUST ?? '0'),
    sponsorAllocationTtlMs: optionalNumber('VEIL_SPONSOR_ALLOCATION_TTL_MS', 10 * 60 * 1000),
    sponsorReclaimIntervalMs: optionalNumber('VEIL_SPONSOR_RECLAIM_INTERVAL_MS', 60 * 1000),
    sponsorReclaimMaxAttempts: optionalNumber('VEIL_SPONSOR_RECLAIM_MAX_ATTEMPTS', 20),
    sponsorRateLimitWindowMs: optionalNumber('VEIL_SPONSOR_RATE_LIMIT_WINDOW_MS', 10 * 60 * 1000),
    sponsorRateLimitMaxPerDustAddress: optionalNumber('VEIL_SPONSOR_RATE_LIMIT_MAX_PER_DUST_ADDRESS', 2),
    sponsorRateLimitMaxPerIp: optionalNumber('VEIL_SPONSOR_RATE_LIMIT_MAX_PER_IP', 30),
    sponsorPoolTargetFreeUtxos: optionalNumber('VEIL_SPONSOR_POOL_TARGET_FREE_UTXOS', 0),
    sponsorPoolSplitAmount: BigInt(process.env.VEIL_SPONSOR_POOL_SPLIT_AMOUNT ?? '0'),
    sponsorPoolMaxSplitOutputs: optionalNumber('VEIL_SPONSOR_POOL_MAX_SPLIT_OUTPUTS', 25),
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
