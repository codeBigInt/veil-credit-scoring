import { createInterface, Interface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import path from 'node:path';
import { access } from 'node:fs/promises';
import { randomBytes as nodeRandomBytes } from 'node:crypto';
import { WebSocket } from 'ws';
import { Logger } from 'pino';
import { Contract as CompactContract, CompiledContract } from '@midnight-ntwrk/compact-js';
import { fromHex, toHex, type ContractState } from '@midnight-ntwrk/compact-runtime';
import { nativeToken, unshieldedToken } from '@midnight-ntwrk/ledger-v8';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { TestEnvironment, type EnvironmentConfiguration } from '@midnight-ntwrk/testkit-js';
import { type WalletFacade } from '@midnightntwrk/wallet-sdk-facade';
import { DynamicContractAPI, DynamicProviders, utils } from 'nite-api';
import * as dotenv from 'dotenv';

import { type Config, StandaloneConfig } from './config.js';
import { MidnightWalletProvider } from './midnight-wallet-provider.js';
import { generateDust } from './generate-dust.js';
import { pad, syncWallet, waitForUnshieldedFunds } from './wallet-utils.js';
import { createVeilPrivateState, type VeilPrivateState, witness } from '../../contract/dist';

import {
  Contract as VeilContractClass,
  ledger,
  type Ledger,
  type Witnesses as VeilWitnesses,
  type CustomStructs_ScoreConfig,
} from '../../contract/src/managed/veil-protocol/contract/index.js';

(globalThis as unknown as { WebSocket: unknown }).WebSocket = WebSocket;

const currentDir = path.resolve(new URL(import.meta.url).pathname, '..');
dotenv.config({ path: path.resolve(currentDir, '..', '.env') });

const PRIVATE_STATE_ID = 'veil_ps';
const LEVEL_DB_LOCK_RETRY_DELAYS_MS = [250, 500, 1_000, 2_000, 4_000] as const;
const GOVERNANCE_TIMELOCK_EPOCHS = 10n;

type VeilContract = VeilContractClass<VeilPrivateState, VeilWitnesses<VeilPrivateState>>;
type VeilAPI = DynamicContractAPI<VeilContract, typeof PRIVATE_STATE_ID>;

const randomBytes = (length: number): Uint8Array => new Uint8Array(nodeRandomBytes(length));

const DEFAULT_SCORE_CONFIG: CustomStructs_ScoreConfig = {
  baseScore: 300n,
  maxScore: 900n,
  walletAgeWeight: 3n,
  protocolWeight: 15n,
  daoWeight: 20n,
  lpWeight: 10n,
  crossChainWeight: 25n,
  consistencyWeight: 5n,
  bronzeThreshold: 400n,
  silverThreshold: 550n,
  goldThreshold: 700n,
  platinumThreshold: 820n,
};

const DEFAULT_GOVERNANCE_GUARDIAN_SET_HASH = new Uint8Array([
  1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1,
]);
const DEFAULT_GOVERNANCE_GUARDIAN_THRESHOLD = 3n;
const DEFAULT_GOVERNANCE_CONTROLLER_VERSION = 1n;
const DEFAULT_SUPPORTED_CHAIN_NAMESPACES = [
  pad('evm', 32),
  pad('ckb', 32),
  pad('solana', 32),
  pad('cardano', 32),
  pad('bitcoin', 32),
];

// Must match the SDK's DEFAULT_READER_POLICY_HASH.
const DEFAULT_SUPPORTED_READER_POLICIES = [pad('veil.default-rpc.v1', 32)];

const isIterable = (value: unknown): value is Iterable<unknown> =>
  value != null && typeof value === 'object' && Symbol.iterator in value;

const isEntryTuple = (value: unknown): value is [unknown, unknown] => Array.isArray(value) && value.length === 2;

const formatIterableState = (value: Iterable<unknown>): unknown =>
  Array.from(value, (entry) => {
    if (isEntryTuple(entry)) {
      return { key: formatContractState(entry[0]), value: formatContractState(entry[1]) };
    }
    return formatContractState(entry);
  });

const formatContractState = (value: unknown): unknown => {
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Uint8Array) return toHex(value);
  if (Array.isArray(value)) return value.map(formatContractState);
  if (isIterable(value)) return formatIterableState(value);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, formatContractState(v)]));
  }
  return value;
};

const compiledVeilContract = (zkConfigPath: string): CompiledContract.CompiledContract<any, any> =>
  utils.createCompiledContract<VeilContract>('veil-protocol', VeilContractClass as any, witness as any, zkConfigPath) as any;

const serializePrivateStateProvider = <T extends Record<string, any>>(provider: T, logger: Logger): T => {
  let queue: Promise<unknown> = Promise.resolve();

  const runExclusive = async <R>(operation: string, thunk: () => Promise<R>): Promise<R> => {
    const run = queue
      .catch(() => undefined)
      .then(() => withLevelDbLockRetry(operation, logger, thunk));
    queue = run.catch(() => undefined);
    return run;
  };

  return {
    ...provider,
    setContractAddress(address: unknown): void {
      provider.setContractAddress(address);
    },
    get(privateStateId: unknown): Promise<unknown> {
      return runExclusive(`Reading private state ${String(privateStateId)}`, () => provider.get(privateStateId));
    },
    set(privateStateId: unknown, state: unknown): Promise<void> {
      return runExclusive(`Writing private state ${String(privateStateId)}`, () => provider.set(privateStateId, state));
    },
    remove(privateStateId: unknown): Promise<void> {
      return runExclusive(`Removing private state ${String(privateStateId)}`, () => provider.remove(privateStateId));
    },
    clear(): Promise<void> {
      return runExclusive('Clearing private state', () => provider.clear());
    },
    getSigningKey(address: unknown): Promise<unknown> {
      return runExclusive(`Reading signing key ${String(address)}`, () => provider.getSigningKey(address));
    },
    setSigningKey(address: unknown, signingKey: unknown): Promise<void> {
      return runExclusive(`Writing signing key ${String(address)}`, () => provider.setSigningKey(address, signingKey));
    },
    removeSigningKey(address: unknown): Promise<void> {
      return runExclusive(`Removing signing key ${String(address)}`, () => provider.removeSigningKey(address));
    },
    clearSigningKeys(): Promise<void> {
      return runExclusive('Clearing signing keys', () => provider.clearSigningKeys());
    },
  } as T;
};

const configureProviders = async (
  config: Config,
  walletProvider: MidnightWalletProvider,
  env: EnvironmentConfiguration,
): Promise<DynamicProviders<VeilContract, typeof PRIVATE_STATE_ID>> => {
  const zkConfigProvider = new NodeZkConfigProvider<CompactContract.ProvableCircuitId<VeilContract>>(config.zkConfigPath);
  const accountId = String(walletProvider.getCoinPublicKey());
  const privateStateProvider = levelPrivateStateProvider<typeof PRIVATE_STATE_ID>({
    midnightDbName: config.midnightDbName,
    privateStateStoreName: `${config.privateStateStoreName}-${PRIVATE_STATE_ID}-v2`,
    signingKeyStoreName: `${config.privateStateStoreName}-signing-keys`,
    privateStoragePasswordProvider: () => {
      return config.privateStatePassword;
    },
    accountId,
  });
  return {
    privateStateProvider: serializePrivateStateProvider(privateStateProvider, walletProvider.logger),
    publicDataProvider: indexerPublicDataProvider(env.indexer, env.indexerWS),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(env.proofServer, zkConfigProvider),
    walletProvider,
    midnightProvider: walletProvider,
  };
};

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const collectErrorValues = (error: unknown, values: string[] = [], seen = new Set<unknown>()): string[] => {
  if (error == null || seen.has(error)) return values;
  seen.add(error);

  if (typeof error === 'string') {
    values.push(error);
    return values;
  }

  if (error instanceof Error) {
    values.push(error.name, error.message);
    const errorRecord = error as unknown as Record<string, unknown>;
    for (const key of ['code', 'cause']) {
      collectErrorValues(errorRecord[key], values, seen);
    }
    return values;
  }

  if (Array.isArray(error)) {
    for (const item of error) collectErrorValues(item, values, seen);
    return values;
  }

  if (typeof error === 'object') {
    const errorRecord = error as Record<string, unknown>;
    for (const key of ['name', 'message', 'code', 'cause']) {
      collectErrorValues(errorRecord[key], values, seen);
    }
  }

  return values;
};

const isLevelDbLockedError = (error: unknown): boolean => {
  const text = collectErrorValues(error).join('\n');
  return (
    text.includes('LEVEL_LOCKED') ||
    text.includes('LEVEL_DATABASE_NOT_OPEN') ||
    text.includes('Database failed to open') ||
    (text.includes('LOCK') && text.includes('already held by process'))
  );
};

const withLevelDbLockRetry = async <T>(
  operation: string,
  logger: Logger,
  thunk: () => Promise<T>,
): Promise<T> => {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await thunk();
    } catch (error) {
      if (!isLevelDbLockedError(error) || attempt >= LEVEL_DB_LOCK_RETRY_DELAYS_MS.length) {
        throw error;
      }

      const delayMs = LEVEL_DB_LOCK_RETRY_DELAYS_MS[attempt];
      logger.warn(`${operation} hit a local LevelDB lock; retrying in ${delayMs}ms`);
      await sleep(delayMs);
    }
  }
};

const logLevelDbLockRecovery = (logger: Logger, config: Config, error: unknown): void => {
  logger.error(
    {
      error: serializeError(error),
      midnightDbName: config.midnightDbName,
    },
    [
      `Local Midnight private-state database is locked: ${config.midnightDbName}`,
      'Close any other running CLI/process using this database and retry.',
      'Deployment stores the contract maintenance signing key in this database.',
      'For a brand-new independent deployment only, choose a different database with VEIL_MIDNIGHT_DB_NAME.',
    ].join(' '),
  );
};

class CliInputClosedError extends Error {
  constructor() {
    super('CLI input closed');
    this.name = 'CliInputClosedError';
  }
}

const isReadlineClosedError = (error: unknown): boolean =>
  error instanceof Error &&
  ((error as NodeJS.ErrnoException).code === 'ERR_USE_AFTER_CLOSE' ||
    error.message.includes('readline was closed'));

const prompt = async (rli: Interface, question: string): Promise<string> => {
  try {
    return (await rli.question(question)).trim();
  } catch (error) {
    if (isReadlineClosedError(error)) {
      throw new CliInputClosedError();
    }
    throw error;
  }
};

const FULL_CONTRACT_CIRCUITS = [
  'Identity_register',
  'Identity_assertActive',
  'Reputation_prove',
  'Reputation_check',
  'Governance_proposeScoreConfig',
  'Governance_applyScoreConfig',
  'Governance_cancelScoreConfig',
  'Governance_addSupportedChainNamespace',
] as const;

const assertZkArtifacts = async (
  zkConfigPath: string,
  circuitIds: readonly string[],
  label: string,
): Promise<void> => {
  const missing: string[] = [];

  for (const circuitId of circuitIds) {
    const expectedFiles = [
      path.join(zkConfigPath, 'keys', `${circuitId}.prover`),
      path.join(zkConfigPath, 'keys', `${circuitId}.verifier`),
      path.join(zkConfigPath, 'zkir', `${circuitId}.bzkir`),
    ];

    for (const file of expectedFiles) {
      try {
        await access(file);
      } catch {
        missing.push(path.relative(process.cwd(), file));
      }
    }
  }

  if (missing.length > 0) {
    throw new Error(
      [
        `Missing ${label} ZK artifacts required for deployment.`,
        'Run `bun --filter @veil-reputation-protocol/contract compile` before deploying.',
        'Do not use `test:compile` for deployable artifacts because it uses `--skip-zk`.',
        `Missing files:\n${missing.map((file) => `- ${file}`).join('\n')}`,
      ].join('\n'),
    );
  }
};

const deployVeilContract = async (
  providers: DynamicProviders<VeilContract, typeof PRIVATE_STATE_ID>,
  config: Config,
  logger: Logger,
): Promise<string> => {
  const api = await DynamicContractAPI.deploy<VeilContract, typeof PRIVATE_STATE_ID>({
    providers,
    compiledContract: compiledVeilContract(config.zkConfigPath),
    privateStateId: PRIVATE_STATE_ID,
    initialPrivateState: createVeilPrivateState(),
    args: [
      DEFAULT_SCORE_CONFIG,
      DEFAULT_GOVERNANCE_GUARDIAN_SET_HASH,
      DEFAULT_GOVERNANCE_GUARDIAN_THRESHOLD,
      DEFAULT_GOVERNANCE_CONTROLLER_VERSION,
      GOVERNANCE_TIMELOCK_EPOCHS,
      DEFAULT_SUPPORTED_CHAIN_NAMESPACES,
      DEFAULT_SUPPORTED_READER_POLICIES,
    ],
    logger,
  });

  logger.info(`Veil contract deployed at ${api.deployedContractAddress}`);
  return api.deployedContractAddress;
};

const joinVeilContract = async (
  providers: DynamicProviders<VeilContract, typeof PRIVATE_STATE_ID>,
  config: Config,
  contractAddress: string,
  logger: Logger,
): Promise<VeilAPI> => {
  providers.privateStateProvider.setContractAddress(contractAddress);
  const existingPrivateState = await providers.privateStateProvider.get(PRIVATE_STATE_ID);

  if (existingPrivateState != null) {
    logger.info('Loaded existing Veil private state from local private state store.');
  }

  return DynamicContractAPI.join<VeilContract, typeof PRIVATE_STATE_ID>({
    providers,
    compiledContract: compiledVeilContract(config.zkConfigPath),
    contractAddress,
    privateStateId: PRIVATE_STATE_ID,
    ...(existingPrivateState == null ? { initialPrivateState: createVeilPrivateState() } : {}),
    logger,
  });
};

const deployOrJoin = async (
  providers: DynamicProviders<VeilContract, typeof PRIVATE_STATE_ID>,
  config: Config,
  _env: EnvironmentConfiguration,
  rli: Interface,
  logger: Logger,
): Promise<VeilAPI | null> => {
  while (true) {
    const choice = await prompt(
      rli,
      '\n1. Deploy Veil contract\n2. Join deployed Veil contract\n3. Exit\nChoose: ',
    );

    if (choice === '1') {
      await assertZkArtifacts(config.zkConfigPath, FULL_CONTRACT_CIRCUITS, 'Veil contract');
      const contractAddress = await deployVeilContract(providers, config, logger);
      logger.info(`Deploy complete. Join this contract when ready: ${contractAddress}`);
      console.log(`\nContract deployed: ${contractAddress}\nChoose "Join deployed Veil contract" to interact with it.\n`);
      continue;
    }

    if (choice === '2') {
      const address = await prompt(rli, 'Enter deployed contract address: ');
      try {
        const api = await joinVeilContract(providers, config, address, logger);
        logger.info(`Joined contract at ${api.deployedContractAddress}`);
        return api;
      } catch (error) {
        logDeepError(logger, 'Failed to join deployed contract', error);
      }
    }

    if (choice === '3') return null;
  }
};

const getContractLedgerState = async (api: VeilAPI): Promise<Ledger | null> => {
  const contractState = await api.providers.publicDataProvider.queryContractState(api.deployedContractAddress);
  return contractState != null ? ledger(contractState.data) : null;
};

const getPrivateState = async (api: VeilAPI): Promise<VeilPrivateState | null> =>
  (await api.providers.privateStateProvider.get(PRIVATE_STATE_ID)) as VeilPrivateState | null;

const askHexBytes = async (rli: Interface, label: string, fallback?: Uint8Array): Promise<Uint8Array> => {
  const entry = await prompt(rli, `${label}${fallback ? ` [default: ${toHex(fallback)}]` : ''}: `);
  if (entry === '' && fallback) return fallback;
  return fromHex(entry);
};

const assertBytes32 = (value: Uint8Array, label: string): Uint8Array => {
  if (value.length !== 32) {
    throw new Error(`${label} must be exactly 32 bytes (${value.length} bytes received).`);
  }
  return value;
};

const askBytes32 = async (rli: Interface, label: string, fallback?: Uint8Array): Promise<Uint8Array> =>
  assertBytes32(await askHexBytes(rli, label, fallback), label);

const askBigInt = async (rli: Interface, label: string, fallback: bigint): Promise<bigint> => {
  const entry = await prompt(rli, `${label} [default: ${fallback.toString()}]: `);
  if (entry === '') return fallback;
  return BigInt(entry);
};

const callTx = async <T = unknown>(api: VeilAPI, circuitName: string, ...args: unknown[]): Promise<T> =>
  (await (api.callTx as unknown as (name: string, ...args: unknown[]) => Promise<T>)(circuitName, ...args)) as T;

const askOptionalHexBytes = async (rli: Interface, label: string): Promise<Uint8Array | undefined> => {
  const entry = await prompt(rli, `${label} [blank: generate]: `);
  return entry === '' ? undefined : fromHex(entry);
};

const askBytesOrRandom = async (rli: Interface, label: string): Promise<Uint8Array> =>
  (await askOptionalHexBytes(rli, label)) ?? randomBytes(32);

const askOptionalBytes32 = async (rli: Interface, label: string): Promise<Uint8Array | undefined> => {
  const value = await askOptionalHexBytes(rli, label);
  return value == null ? undefined : assertBytes32(value, label);
};

const askBytes32OrRandom = async (rli: Interface, label: string): Promise<Uint8Array> =>
  (await askOptionalBytes32(rli, label)) ?? randomBytes(32);

const resolveVeilIdFromPrivateState = async (api: VeilAPI): Promise<Uint8Array | null> => {
  const ps = await getPrivateState(api);
  if (!ps) return null;

  const keys = Object.keys(ps.reputationScores);
  if (keys.length === 0) return null;
  return fromHex(keys[0] as string);
};

const tryResolveVeilIdFromPrivateState = async (api: VeilAPI, logger: Logger): Promise<Uint8Array | null> => {
  try {
    return await resolveVeilIdFromPrivateState(api);
  } catch (error) {
    if (isLevelDbLockedError(error)) {
      logger.warn(
        {
          error: serializeError(error),
        },
        'Could not preload cached Veil ID because the local private-state database is locked. Continuing without a cached Veil ID.',
      );
      return null;
    }

    logger.warn(
      {
        error: serializeError(error),
      },
      'Could not preload cached Veil ID from private state. Continuing without a cached Veil ID.',
    );
    return null;
  }
};

const printLedger = async (api: VeilAPI): Promise<void> => {
  const state = await api.providers.publicDataProvider.queryContractState(api.deployedContractAddress);
  if (!state) {
    console.log('No public state found for the contract');
    return;
  }

  const decoded = ledger((state as ContractState).data);
  console.dir(formatContractState(decoded), { depth: null, colors: true });
};

const printPrivateState = async (api: VeilAPI): Promise<void> => {
  const ps = await getPrivateState(api);
  if (!ps) {
    console.log('No private state found');
    return;
  }

  console.dir(formatContractState(ps), { depth: null, colors: true });
};

const serializeError = (error: unknown, depth = 0, maxDepth = 5): unknown => {
  if (depth > maxDepth) return '[max-depth-reached]';

  if (error instanceof Error) {
    const base: Record<string, unknown> = {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };

    const knownFields = ['reason', 'statusCode', 'json', 'details', 'code'];
    const errorRecord = error as unknown as Record<string, unknown>;
    for (const field of knownFields) {
      const value = errorRecord[field];
      if (value !== undefined) {
        base[field] = serializeError(value, depth + 1, maxDepth);
      }
    }

    const cause = (error as { cause?: unknown }).cause;
    if (cause !== undefined) {
      base.cause = serializeError(cause, depth + 1, maxDepth);
    }

    return base;
  }

  if (Array.isArray(error)) {
    return error.map((item) => serializeError(item, depth + 1, maxDepth));
  }

  if (error && typeof error === 'object') {
    const entries = Object.entries(error as Record<string, unknown>).map(([key, value]) => [
      key,
      serializeError(value, depth + 1, maxDepth),
    ]);
    return Object.fromEntries(entries);
  }

  return error;
};

const logDeepError = (logger: Logger, context: string, error: unknown): void => {
  logger.error(
    {
      context,
      error: serializeError(error),
    },
    context,
  );
};

const isInsufficientFundsError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('Wallet.InsufficientFunds') || message.includes('Insufficient funds');
};

const getDustBalance = async (walletFacade: WalletFacade): Promise<bigint> => {
  const state = await walletFacade.waitForSyncedState();
  return state.dust.balance(new Date());
};

const menuLoop = async (
  api: VeilAPI,
  rli: Interface,
  logger: Logger,
  walletProvider: MidnightWalletProvider,
  walletFacade: WalletFacade,
  seed: string,
): Promise<void> => {
  void walletProvider;
  void walletFacade;
  void seed;
  let cachedVeilIdHash: Uint8Array | null = await tryResolveVeilIdFromPrivateState(api, logger);

  while (true) {
      const choice = await prompt(
        rli,
      '\n1. Register identity\n2. Prove reputation\n3. Check reputation\n4. Propose score config\n5. Apply score config\n6. Add supported chain namespace\n7. Add supported reader policy\n8. Show ledger state\n9. Show private state\n10. Exit\nChoose: ',
      );

    try {
      if (choice === '1') {
        const veilIdHash = await askBytes32OrRandom(rli, 'veilIdHash (hex)');
        const chainNamespace = (await askOptionalBytes32(rli, 'chain namespace bytes32 (hex)')) ?? pad('ckb', 32);
        const publicKeyOrLockHashCommitment = await askBytes32OrRandom(rli, 'public key / lock hash commitment (hex)');
        const walletSignatureHash = await askBytes32OrRandom(rli, 'wallet signature hash (hex)');

        await callTx(
          api,
          'Identity_register',
          veilIdHash,
          chainNamespace,
          publicKeyOrLockHashCommitment,
          walletSignatureHash,
        );

        cachedVeilIdHash = veilIdHash;
        logger.info(`Identity registered. veilIdHash=${toHex(veilIdHash)}`);
        continue;
      }

      if (choice === '2') {
        const veilIdHash = await askBytes32(rli, 'veilIdHash (hex)', cachedVeilIdHash ?? undefined);
        const walletAgeInDays = await askBigInt(rli, 'walletAgeInDays', 50n);
        const distinctProtocols = await askBigInt(rli, 'distinctProtocols', 5n);
        const daoVoteCount = await askBigInt(rli, 'daoVoteCount', 2n);
        const lpTenureInDays = await askBigInt(rli, 'lpTenureInDays', 10n);
        const crossChainCount = await askBigInt(rli, 'crossChainCount', 1n);
        const txConsistencyScore = await askBigInt(rli, 'txConsistencyScore', 2n);
        const chainNamespace = (await askOptionalBytes32(rli, 'evidence chain namespace bytes32 (hex)')) ?? pad('evm', 32);
        const chainCommitment = await askBytes32OrRandom(rli, 'chain commitment (hex)');
        const readerPolicyHash =
          (await askOptionalBytes32(rli, 'reader policy hash bytes32 (hex)')) ?? DEFAULT_SUPPORTED_READER_POLICIES[0];
        const witnessSalt = await askBytes32OrRandom(rli, 'witness salt (hex)');
        const proofNonce = await askBytes32OrRandom(rli, 'proof nonce (hex)');

        const band = await callTx<bigint>(
          api,
          'Reputation_prove',
          veilIdHash,
          walletAgeInDays,
          distinctProtocols,
          daoVoteCount,
          lpTenureInDays,
          crossChainCount,
          txConsistencyScore,
          chainNamespace,
          chainCommitment,
          readerPolicyHash,
          witnessSalt,
          proofNonce,
        );

        cachedVeilIdHash = veilIdHash;
        logger.info(`Reputation proof accepted. band=${band.toString()}`);
        continue;
      }

      if (choice === '3') {
        const veilIdHash = await askBytes32(rli, 'veilIdHash (hex)', cachedVeilIdHash ?? undefined);
        const requesterAddressHash = await askBytes32OrRandom(rli, 'requester address hash (hex)');
        const purposeHash = (await askOptionalBytes32(rli, 'purpose hash (hex)')) ?? pad('cli-check', 32);
        const minimumBand = await askBigInt(rli, 'minimumBand (0..4)', 2n);

        const decision = await callTx(
          api,
          'Reputation_check',
          veilIdHash,
          requesterAddressHash,
          purposeHash,
          minimumBand,
        );

        logger.info({ decision: formatContractState(decision) }, 'Reputation decision');
        continue;
      }

      if (choice === '4') {
        const nextConfig: CustomStructs_ScoreConfig = {
          ...DEFAULT_SCORE_CONFIG,
          baseScore: await askBigInt(rli, 'new baseScore', 320n),
          bronzeThreshold: await askBigInt(rli, 'new bronzeThreshold', 410n),
          silverThreshold: await askBigInt(rli, 'new silverThreshold', 560n),
          goldThreshold: await askBigInt(rli, 'new goldThreshold', 710n),
          platinumThreshold: await askBigInt(rli, 'new platinumThreshold', 830n),
        };
        const operationId = await askBytes32OrRandom(rli, 'guardian operation id (hex)');
        const signatureBundleHash = await askBytes32OrRandom(rli, 'guardian signature bundle hash (hex)');
        const governanceNonce = await askBytes32OrRandom(rli, 'governance nonce (hex)');

        await callTx(
          api,
          'Governance_proposeScoreConfig',
          nextConfig,
          operationId,
          signatureBundleHash,
          governanceNonce,
        );
        logger.info(`Score config proposed. Timelock duration=${GOVERNANCE_TIMELOCK_EPOCHS.toString()} seconds`);
        continue;
      }

      if (choice === '5') {
        await callTx(api, 'Governance_applyScoreConfig');
        logger.info('Pending score config applied');
        continue;
      }

      if (choice === '6') {
        const chainNamespace = (await askOptionalBytes32(rli, 'chain namespace bytes32 (hex)')) ?? pad('evm', 32);
        const operationId = await askBytes32OrRandom(rli, 'guardian operation id (hex)');
        const signatureBundleHash = await askBytes32OrRandom(rli, 'guardian signature bundle hash (hex)');
        const governanceNonce = await askBytes32OrRandom(rli, 'governance nonce (hex)');

        await callTx(
          api,
          'Governance_addSupportedChainNamespace',
          chainNamespace,
          operationId,
          signatureBundleHash,
          governanceNonce,
        );
        logger.info(`Supported chain namespace added: ${toHex(chainNamespace)}`);
        continue;
      }

      if (choice === '7') {
        const readerPolicyHash =
          (await askOptionalBytes32(rli, 'reader policy hash bytes32 (hex)')) ?? DEFAULT_SUPPORTED_READER_POLICIES[0];
        const operationId = await askBytes32OrRandom(rli, 'guardian operation id (hex)');
        const signatureBundleHash = await askBytes32OrRandom(rli, 'guardian signature bundle hash (hex)');
        const governanceNonce = await askBytes32OrRandom(rli, 'governance nonce (hex)');

        await callTx(
          api,
          'Governance_addSupportedReaderPolicy',
          readerPolicyHash,
          operationId,
          signatureBundleHash,
          governanceNonce,
        );
        logger.info(`Supported reader policy added: ${toHex(readerPolicyHash)}`);
        continue;
      }

      if (choice === '8') {
        await printLedger(api);
        continue;
      }

      if (choice === '9') {
        await printPrivateState(api);
        continue;
      }

      if (choice === '10') return;
    } catch (error) {
      logDeepError(logger, 'Menu action failed', error);
    }
  }
};

const GENESIS_MINT_WALLET_SEED = '0000000000000000000000000000000000000000000000000000000000000001';

const buildWalletSeed = async (config: Config, rli: Interface, logger: Logger): Promise<string | undefined> => {
  if (config instanceof StandaloneConfig) {
    return GENESIS_MINT_WALLET_SEED;
  }

  while (true) {
    const choice = await prompt(rli, '\n1. Create fresh wallet\n2. Restore from seed\n3. Exit\nChoose: ');
    if (choice === '1') return toHex(randomBytes(32));
    if (choice === '2') return await prompt(rli, 'Enter wallet seed: ');
    if (choice === '3') {
      logger.info('Exiting...');
      return undefined;
    }
  }
};

export const run = async (config: Config, testEnv: TestEnvironment, logger: Logger): Promise<void> => {
  const rli = createInterface({ input, output, terminal: true });
  const providersToStop: MidnightWalletProvider[] = [];

  try {
    const envConfiguration = await testEnv.start();
    logger.info(`Environment started: ${JSON.stringify(envConfiguration)}`);

    const seed = await buildWalletSeed(config, rli, logger);
    if (seed == null) return;

    const walletProvider = await MidnightWalletProvider.build(logger, envConfiguration, seed);
    providersToStop.push(walletProvider);
    const walletFacade: WalletFacade = walletProvider.wallet;

    await walletProvider.start();
    walletProvider.startWalletStateCache();

    const unshieldedState = await waitForUnshieldedFunds(
      logger,
      walletFacade,
      envConfiguration,
      unshieldedToken(),
      config.requestFaucetTokens,
    );

    const nightBalance = unshieldedState.balances[unshieldedToken().raw];
    logger.info(`NIGHT balance: ${nightBalance ?? 0n}`);

    if (config.generateDust) {
      const tx = await generateDust(logger, seed, walletFacade);
      if (tx) {
        logger.info(`Dust tx submitted: ${tx}`);
      }
      await syncWallet(logger, walletFacade);
    }

    const providers = await configureProviders(config, walletProvider, envConfiguration);
    const api = await deployOrJoin(providers, config, envConfiguration, rli, logger);
    if (!api) return;

    await menuLoop(api, rli, logger, walletProvider, walletFacade, seed);
  } catch (error) {
    if (error instanceof CliInputClosedError) {
      logger.info('CLI input closed; exiting.');
      return;
    }

    if (isLevelDbLockedError(error)) {
      logLevelDbLockRecovery(logger, config, error);
      return;
    }

    throw error;
  } finally {
    for (const provider of providersToStop) {
      await provider.stop();
    }
    const envAny = testEnv as any;
    if (typeof envAny.cleanup === 'function') {
      await envAny.cleanup();
    } else if (typeof envAny.stop === 'function') {
      await envAny.stop();
    }
    rli.close();
  }
};
