import { createInterface, Interface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import path from 'node:path';
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
import { type WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import { DynamicContractAPI, DynamicProviders, utils } from 'nite-api';
import * as dotenv from 'dotenv';

import { type Config, StandaloneConfig } from './config.js';
import { MidnightWalletProvider } from './midnight-wallet-provider.js';
import { generateDust } from './generate-dust.js';
import { syncWallet, waitForUnshieldedFunds } from './wallet-utils.js';
import { createVeilPrivateState, type VeilPrivateState, witness } from '../../contract/dist';

import {
  Contract as VeilContractClass,
  ledger,
  type Ledger,
  type Witnesses as VeilWitnesses,
  type CustomStructs_ProtocolConfig,
  type CustomStructs_ScoreConfig,
  type ShieldedCoinInfo,
  type CustomStructs_TokenImageUris,
  type CustomStructs_TokenMarkers,
  pureCircuits,
} from '../../contract/src/managed/veil-protocol/contract/index.js';

(globalThis as unknown as { WebSocket: unknown }).WebSocket = WebSocket;

const currentDir = path.resolve(new URL(import.meta.url).pathname, '..');
dotenv.config({ path: path.resolve(currentDir, '..', '.env') });

const PRIVATE_STATE_ID = 'veil_ps';

type VeilContract = VeilContractClass<VeilPrivateState, VeilWitnesses<VeilPrivateState>>;
type VeilAPI = DynamicContractAPI<VeilContract, typeof PRIVATE_STATE_ID>;

const randomBytes = (length: number): Uint8Array => new Uint8Array(nodeRandomBytes(length));

const DEFAULT_TOKEN_IMAGE_URIS: CustomStructs_TokenImageUris = {
  unranked: 'ipfs://veil/unranked',
  bronze: 'ipfs://veil/bronze',
  silver: 'ipfs://veil/silver',
  gold: 'ipfs://veil/gold',
  platinum: 'ipfs://veil/platinum',
};

const DEFAULT_PROTOCOL_CONFIG: CustomStructs_ProtocolConfig = {
  unranked: 0n,
  bronzeThreshold: 20n,
  silverThreshold: 40n,
  goldThreshold: 60n,
  platinumThreshold: 80n,
  maxLiquidationsAllowed: 3n,
  nftEpochValidity: 12n,
};

const DEFAULT_TOKEN_MARKERS: CustomStructs_TokenMarkers = {
  unranked: 'UNRANKED',
  bronze: randomBytes(32),
  silver: randomBytes(32),
  gold: randomBytes(32),
  platinum: randomBytes(32),
};

const DEFAULT_SCORE_CONFIG: CustomStructs_ScoreConfig = {
  baseScore: 300n,
  maxScore: 900n,
  scale: 100n,
  repaymentWeight: 2n,
  protocolWeight: 10n,
  tenureWeight: 1n,
  liquidationWeight: 3n,
  activeDebtPenalty: 5n,
  riskBandWeight: 5n,
  maxScoreDeltaPerEpoch: 50n,
};

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

const configureProviders = async (
  config: Config,
  walletProvider: MidnightWalletProvider,
  env: EnvironmentConfiguration,
): Promise<DynamicProviders<VeilContract, typeof PRIVATE_STATE_ID>> => {
  const zkConfigProvider = new NodeZkConfigProvider<CompactContract.ProvableCircuitId<VeilContract>>(config.zkConfigPath);
  const accountId = (await walletProvider.wallet.unshielded.getAddress()).hexString;
  return {
    privateStateProvider: levelPrivateStateProvider<typeof PRIVATE_STATE_ID>({
      privateStateStoreName: config.privateStateStoreName,
        signingKeyStoreName: `${config.privateStateStoreName}-signing-keys`,
        privateStoragePasswordProvider: () => {
          return 'veil-credit-Test-2026!';
        },
        accountId,
    }),
    publicDataProvider: indexerPublicDataProvider(env.indexer, env.indexerWS),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(env.proofServer, zkConfigProvider),
    walletProvider,
    midnightProvider: walletProvider,
  };
};

const prompt = async (rli: Interface, question: string): Promise<string> => (await rli.question(question)).trim();

const deployOrJoin = async (
  providers: DynamicProviders<VeilContract, typeof PRIVATE_STATE_ID>,
  config: Config,
  rli: Interface,
  logger: Logger,
): Promise<VeilAPI | null> => {
  while (true) {
    const choice = await prompt(
      rli,
      '\n1. Deploy new Veil contract\n2. Join deployed Veil contract\n3. Exit\nChoose: ',
    );

    if (choice === '1') {
      const api = await DynamicContractAPI.deploy<VeilContract, typeof PRIVATE_STATE_ID>({
        providers,
        compiledContract: compiledVeilContract(config.zkConfigPath),
        privateStateId: PRIVATE_STATE_ID,
        initialPrivateState: createVeilPrivateState(randomBytes(32)),
        args: [
          randomBytes(32),
          BigInt(Date.now())
        ],
        logger,
      });

      logger.info(`Deployed contract at ${api.deployedContractAddress}`);
      return api;
    }

    if (choice === '2') {
      const address = await prompt(rli, 'Enter deployed contract address: ');
      try {
        const api = await DynamicContractAPI.join<VeilContract, typeof PRIVATE_STATE_ID>({
          providers,
          compiledContract: compiledVeilContract(config.zkConfigPath),
          contractAddress: address,
          privateStateId: PRIVATE_STATE_ID,
          initialPrivateState: createVeilPrivateState(randomBytes(32)),
          logger,
        });
        logger.info(`Joined contract at ${api.deployedContractAddress}`);
        return api;
      } catch (error) {
        logger.error(error instanceof Error ? error.message : String(error));
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

const getAnyIssuerPk = async (api: VeilAPI): Promise<Uint8Array | null> => {
  const state = await getContractLedgerState(api);
  if (!state) return null;

  for (const [pk] of state.LedgerStates_issuers) {
    return pk;
  }

  return null;
};

const resolveUserPkFromPrivateState = async (api: VeilAPI): Promise<Uint8Array | null> => {
  const ps = await getPrivateState(api);
  if (!ps) return null;

  const keys = Object.keys(ps.creditScores);
  if (keys.length === 0) return null;
  return fromHex(keys[0] as string);
};

const askHexBytes = async (rli: Interface, label: string, fallback?: Uint8Array): Promise<Uint8Array> => {
  const entry = await prompt(rli, `${label}${fallback ? ` [default: ${toHex(fallback)}]` : ''}: `);
  if (entry === '' && fallback) return fallback;
  return fromHex(entry);
};

const askBigInt = async (rli: Interface, label: string, fallback: bigint): Promise<bigint> => {
  const entry = await prompt(rli, `${label} [default: ${fallback.toString()}]: `);
  if (entry === '') return fallback;
  return BigInt(entry);
};

const askShieldedCoinInfo = async (rli: Interface): Promise<ShieldedCoinInfo> => {
  const nonce = await askHexBytes(rli, 'token nonce (hex)');
  const color = await askHexBytes(rli, 'token color (hex)');
  const value = await askBigInt(rli, 'token value', 1n);

  return { nonce, color, value };
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

const menuLoop = async (api: VeilAPI, rli: Interface, logger: Logger): Promise<void> => {
  let cachedIssuerPk: Uint8Array | null = null;

  while (true) {
    const choice = await prompt(
      rli,
      '\n1. Add issuer (admin)\n2. Initialize contract config (admin)\n3. Create score entry (self)\n4. Submit repayment event\n5. Submit liquidation event\n6. Submit protocol usage event\n7. Recompute score\n8. Mint PoT NFT\n9. Renew PoT NFT\n10. Verify PoT NFT\n11. Show ledger state\n12. Show private state\n13. Exit\nChoose: ',
    );

    try {
      if (choice === '1') {
        const protocolName = await prompt(rli, 'Protocol name [default: Aave]: ');
        await api.callTx("Admin_addIssuer", protocolName || 'Aave', { bytes: randomBytes(32) });
        const issuerPk = await getAnyIssuerPk(api);
        if (!issuerPk) {
          logger.info('Issuer transaction submitted, but no issuer key could be resolved from ledger yet.');
          continue;
        }
        cachedIssuerPk = issuerPk;
        logger.info(`Issuer added: ${toHex(issuerPk)}`);
        continue;
      }

      if (choice === '2') {
        const tokenName = await prompt(rli, 'Token name [default: Veil]: ');
        await api.callTx(
          'Utils_initializeContractConfigurations',
          DEFAULT_TOKEN_IMAGE_URIS,
          tokenName || 'Veil',
          DEFAULT_PROTOCOL_CONFIG,
          DEFAULT_SCORE_CONFIG,
          DEFAULT_TOKEN_MARKERS,
        );
        logger.info('Contract configuration initialized');
        continue;
      }

      if (choice === '3') {
        await api.callTx("createScoreEntry");
        const userPk = await resolveUserPkFromPrivateState(api);
        logger.info(`Score entry created. userPk=${userPk ? toHex(userPk) : 'unknown'}`);
        continue;
      }

      if (choice === '4') {
        const userPk = await askHexBytes(rli, 'userPk (hex)', (await resolveUserPkFromPrivateState(api)) ?? undefined);
        const issuerPk = await askHexBytes(rli, 'issuerPk (hex)', cachedIssuerPk ?? undefined);
        const paidOnTime = await askBigInt(rli, 'paidOnTimeFlag (0|1)', 1n);
        const amountWeight = await askBigInt(rli, 'amountWeight', 100n);
        const epoch = await askBigInt(rli, 'eventEpoch', 0n);
        await api.callTx(
          "submitRepaymentEvent",
          userPk,
          issuerPk,
          paidOnTime,
          amountWeight,
          epoch,
          randomBytes(32),
        );
        logger.info('Repayment event submitted');
        continue;
      }

      if (choice === '5') {
        const userPk = await askHexBytes(rli, 'userPk (hex)', (await resolveUserPkFromPrivateState(api)) ?? undefined);
        const issuerPk = await askHexBytes(rli, 'issuerPk (hex)', cachedIssuerPk ?? undefined);
        const severity = await askBigInt(rli, 'severity (1..3)', 2n);
        const epoch = await askBigInt(rli, 'eventEpoch', 0n);
        await api.callTx(
          "submitLiquidationEvent",
          userPk,
          issuerPk,
          severity,
          epoch,
          randomBytes(32),
        );
        logger.info('Liquidation event submitted');
        continue;
      }

      if (choice === '6') {
        const userPk = await askHexBytes(rli, 'userPk (hex)', (await resolveUserPkFromPrivateState(api)) ?? undefined);
        const issuerPk = await askHexBytes(rli, 'issuerPk (hex)', cachedIssuerPk ?? undefined);
        const epoch = await askBigInt(rli, 'eventEpoch', 0n);
        await api.callTx("submitProtocolUsageEvent", userPk, issuerPk, randomBytes(32), epoch);
        logger.info('Protocol usage event submitted');
        continue;
      }

      // if (choice === '6') {
      //   const userPk = await askHexBytes(rli, 'userPk (hex)', (await resolveUserPkFromPrivateState(api)) ?? undefined);
      //   const issuerPk = await askHexBytes(rli, 'issuerPk (hex)', cachedIssuerPk ?? undefined);
      //   const activeDebt = await askBigInt(rli, 'activeDebtFlag (0|1)', 0n);
      //   const riskBand = await askBigInt(rli, 'riskBand (0..3)', 1n);
      //   const epoch = await askBigInt(rli, 'eventEpoch', 0n);
      //   await api.callTx(
      //     'Scoring_submitDebtStateEvent',
      //     userPk,
      //     issuerPk,
      //     activeDebt,
      //     riskBand,
      //     epoch,
      //     randomBytes(32),
      //   );
      //   logger.info('Debt state event submitted');
      //   continue;
      // }

      if (choice === '7') {
        const userPk = await askHexBytes(rli, 'userPk (hex)', (await resolveUserPkFromPrivateState(api)) ?? undefined);
        const issuerPk = await askHexBytes(rli, 'issuerPk (hex)', cachedIssuerPk ?? undefined);
        await api.callTx("recomputeAndReturnScore", userPk, issuerPk);
        logger.info('Recompute score transaction submitted. Check private/ledger state for updates.');
        continue;
      }

      if (choice === '8') {
        await api.callTx('NFT_mintPoTNFT');
        logger.info('PoT NFT minted');
        continue;
      }

      if (choice === '9') {
        const token = await askShieldedCoinInfo(rli);
        await api.callTx('NFT_renewPoTNFT', token);
        logger.info('PoT NFT renewed');
        continue;
      }

      if (choice === '10') {
        const issuerPk = await askHexBytes(rli, 'issuerPk (hex)', cachedIssuerPk ?? undefined);
        await api.callTx('NFT_verifyPoTNFT', issuerPk);
        logger.info('Verify PoTNFT transaction submitted.');
        continue;
      }


      if (choice === '11') {
        await printLedger(api);
        continue;
      }

      if (choice === '12') {
        await printPrivateState(api);
        continue;
      }

      if (choice === '13') return;
    } catch (error) {
      logger.error(error instanceof Error ? error.message : String(error));
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
      const tx = await generateDust(logger, seed, unshieldedState, walletFacade);
      if (tx) {
        logger.info(`Dust tx submitted: ${tx}`);
        await syncWallet(logger, walletFacade);
      }
    }

    const providers = await configureProviders(config, walletProvider, envConfiguration);
    const api = await deployOrJoin(providers, config, rli, logger);
    if (!api) return;

    await menuLoop(api, rli, logger);
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
