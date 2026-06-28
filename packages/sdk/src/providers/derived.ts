/**
 * createDerivedProvider — browser-native Midnight provider derived from any CCC-compatible wallet.
 *
 * The user signs one deterministic derivation message with their existing wallet (MetaMask, JoyID,
 * UniSat, etc.). The signature is sha256-hashed locally to produce a Midnight master seed.  All
 * three Midnight sub-wallets (shielded NIGHT, unshielded NIGHT, DUST fees) are derived from that
 * seed — the user never installs a second wallet extension.
 *
 * Sync state is serialized to IndexedDB after every 30 s and on page unload, mirroring the CLI's
 * file-system cache.  On the next page load the wallet restores from the cache rather than
 * re-scanning from the deployment block, so subsequent loads are near-instant.
 *
 * DUST fee sponsorship via Veil's fee-sponsor service keeps the user from needing to acquire DUST
 * separately. The transaction gate waits until sponsored DUST is visible before balancing.
 */

import {
  LedgerParameters,
  ZswapSecretKeys,
  DustSecretKey,
  type FinalizedTransaction,
} from '@midnight-ntwrk/ledger-v8';
import {
  type MidnightProvider,
  type WalletProvider,
  type UnboundTransaction,
} from '@midnight-ntwrk/midnight-js-types';
import { ttlOneHour } from '@midnight-ntwrk/midnight-js-utils';
import {
  WalletFacade,
  WalletEntrySchema,
  type DefaultConfiguration,
} from '@midnightntwrk/wallet-sdk-facade';
import { ShieldedWallet } from '@midnightntwrk/wallet-sdk-shielded';
import { DustWallet } from '@midnightntwrk/wallet-sdk-dust-wallet';
import {
  PublicKey,
  UnshieldedWallet,
  createKeystore,
} from '@midnightntwrk/wallet-sdk-unshielded-wallet';
import { InMemoryTransactionHistoryStorage } from '@midnightntwrk/wallet-sdk-abstractions';
import { HDWallet, Roles, type Role } from '@midnightntwrk/wallet-sdk-hd';
import { DustAddress } from '@midnightntwrk/wallet-sdk-address-format';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { DynamicContractAPI, type DynamicProviders, utils } from 'nite-api';
import { Contract as VeilContractClass } from '@veil/veil-contract';

import type { VeilConfig } from '../config';
import type { CCCSigner, VeilMidnightProvider } from '../types';
import { hexToBytes } from '../utils/bytes';
import {
  type VeilContract,
  PRIVATE_STATE_ID,
  createVeilPrivateState,
  witness,
} from '../contract';

import { IdbPrivateStateProvider } from './idb-private-state';
import { FetchZkConfigProvider } from './fetch-zk-config';
import {
  loadIdbWalletCache,
  saveIdbWalletCache,
  type WalletStateCache,
} from './idb-wallet-cache';
import { requestSponsorship } from '../sponsor';

// ─── Network presets ──────────────────────────────────────────────────────────

const MIDNIGHT_PRESETS = {
  preview: {
    indexerUrl: 'https://indexer.preview.midnight.network/api/v4/graphql',
    indexerWsUrl: 'wss://indexer.preview.midnight.network/api/v4/graphql/ws',
    nodeWsUrl: 'wss://rpc.preview.midnight.network',
    networkId: 'preview',
  },
  preprod: {
    indexerUrl: 'https://indexer.preprod.midnight.network/api/v4/graphql',
    indexerWsUrl: 'wss://indexer.preprod.midnight.network/api/v4/graphql/ws',
    nodeWsUrl: 'wss://rpc.preprod.midnight.network',
    networkId: 'preprod',
  },
  mainnet: {
    indexerUrl: 'https://indexer.mainnet.midnight.network/api/v4/graphql',
    indexerWsUrl: 'wss://indexer.mainnet.midnight.network/api/v4/graphql/ws',
    nodeWsUrl: 'wss://rpc.mainnet.midnight.network',
    networkId: 'mainnet',
  },
} as const satisfies Record<
  string,
  { indexerUrl: string; indexerWsUrl: string; nodeWsUrl: string; networkId: string }
>;

// ─── Wallet options type ──────────────────────────────────────────────────────

type DustWalletOptions = {
  ledgerParams: ReturnType<typeof LedgerParameters.initialParameters>;
  additionalFeeOverhead: bigint;
  feeBlocksMargin: number;
};

type DustBalanceSource = {
  waitForSyncedState(): Promise<{ balance(time: Date): bigint }>;
};

const DUST_SPONSOR_TIMEOUT_MS = 300_000;
const DUST_EXISTING_BALANCE_CHECK_MS = 5_000;
const DUST_SPONSOR_POLL_MS = 3_000;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> => {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
};

const getSyncedDustBalance = async (dustWallet: DustBalanceSource, timeoutMs: number): Promise<bigint> => {
  const state = await withTimeout(
    dustWallet.waitForSyncedState(),
    timeoutMs,
    'Timed out waiting for the derived Midnight DUST wallet to sync before checking DUST.',
  );
  return state.balance(new Date());
};

const waitForSponsoredDust = async (
  dustWallet: DustBalanceSource,
  timeoutMs: number,
  requiredDust: bigint = 1n,
): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  let lastBalance = 0n;

  while (Date.now() < deadline) {
    const remaining = Math.max(1_000, deadline - Date.now());
    try {
      lastBalance = await getSyncedDustBalance(
        dustWallet,
        Math.min(DUST_SPONSOR_POLL_MS, remaining),
      );
      if (lastBalance >= requiredDust) return;
    } catch {
      // Keep polling until the overall sponsorship timeout expires. The dust
      // wallet can be momentarily behind the indexer after a fresh sponsorship.
    }
    await sleep(Math.min(DUST_SPONSOR_POLL_MS, Math.max(0, deadline - Date.now())));
  }

  throw new Error(
    `DUST sponsorship was requested, but the derived wallet did not see enough DUST before timeout. Required: ${requiredDust.toString()}. Last synced DUST balance: ${lastBalance.toString()}.`,
  );
};

const hasVisibleDust = async (
  dustWallet: DustBalanceSource,
  requiredDust: bigint = 1n,
): Promise<boolean> => {
  try {
    return (await getSyncedDustBalance(dustWallet, DUST_EXISTING_BALANCE_CHECK_MS)) >= requiredDust;
  } catch {
    return false;
  }
};

// ─── Key derivation ───────────────────────────────────────────────────────────

// Uses the same BIP-32 HD path as WalletSeeds.fromMasterSeed in @midnight-ntwrk/testkit-js
// (HDWallet from @midnightntwrk/wallet-sdk-hd is browser-native; testkit-js is Node-only).
const deriveWalletSeeds = (masterSeedHex: string) => {
  const seedBuffer = hexToBytes(masterSeedHex);
  const hdResult = HDWallet.fromSeed(seedBuffer);
  if (hdResult.type !== 'seedOk') throw new Error('Invalid master seed for Midnight wallet derivation');
  const derive = (role: Role): Uint8Array => {
    const result = hdResult.hdWallet.selectAccount(0).selectRole(role).deriveKeyAt(0);
    if (result.type === 'keyOutOfBounds') throw new Error(`Key derivation out of bounds for role ${role}`);
    return result.key;
  };
  return {
    masterSeed: masterSeedHex,
    shielded: derive(Roles.Zswap),
    unshielded: derive(Roles.NightExternal),
    dust: derive(Roles.Dust),
  };
};

// Deterministic message: identical across sessions so the same Midnight seed is
// always recovered from the same signing key.
const DERIVATION_MESSAGE =
  'Veil Network: derive Midnight private key v1.\n' +
  'This signature is used locally for key derivation and is never transmitted.';

const sha256Hex = async (data: Uint8Array): Promise<string> => {
  // Ensure a concrete ArrayBuffer (not SharedArrayBuffer) for SubtleCrypto
  const buf: ArrayBuffer = data.buffer instanceof ArrayBuffer
    ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
    : new Uint8Array(data).buffer;
  const hashBuf = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

// ─── Wallet provider adapter ──────────────────────────────────────────────────

type UnshieldedKeystore = { signData(payload: Uint8Array): string };

class BrowserWalletAdapter implements MidnightProvider, WalletProvider {
  constructor(
    private readonly wallet: WalletFacade,
    private readonly zswapKeys: ZswapSecretKeys,
    private readonly dustKey: DustSecretKey,
    private readonly keystore: UnshieldedKeystore,
    private readonly ensureDustReady?: (requiredDust?: bigint) => Promise<void>,
  ) {}

  getCoinPublicKey() { return this.zswapKeys.coinPublicKey; }
  getEncryptionPublicKey() { return this.zswapKeys.encryptionPublicKey; }

  async balanceTx(tx: UnboundTransaction, ttl: Date = ttlOneHour()): Promise<FinalizedTransaction> {
    let requiredDust: bigint | undefined;
    try {
      requiredDust = await this.wallet.estimateTransactionFee(tx as never, this.dustKey, { ttl });
    } catch {
      requiredDust = undefined;
    }

    if (this.ensureDustReady) {
      await this.ensureDustReady(requiredDust);
    }

    const secretKeys = { shieldedSecretKeys: this.zswapKeys, dustSecretKey: this.dustKey };
    const recipe = await this.wallet.balanceUnboundTransaction(tx, secretKeys, { ttl });
    const signedRecipe = await this.wallet.signRecipe(
      recipe,
      (payload: Uint8Array) => this.keystore.signData(payload),
    );
    return this.wallet.finalizeRecipe(signedRecipe);
  }

  submitTx(tx: FinalizedTransaction): Promise<string> {
    return this.wallet.submitTransaction(tx);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface DerivedProviderHandle extends VeilMidnightProvider {
  /**
   * Stops background sync and flushes wallet state to IndexedDB.
   * Call this on component unmount or SPA route teardown.
   * Page-close is handled automatically via the beforeunload listener.
   */
  stop(): Promise<void>;
}

/**
 * Creates a VeilMidnightProvider by deterministically deriving a Midnight wallet
 * from the user's existing CCC-compatible wallet.
 *
 * @param signer  Any CCC-compatible signer (MetaMask, JoyID, UniSat, passkey, …).
 * @param config  VeilConfig — requires `zkArtifactsBaseUrl`, optionally overrides
 *                `proofServerUrl`, `midnightNodeWsUrl`, `midnightIndexerWsUrl`.
 */
export const createDerivedProvider = async (
  signer: CCCSigner,
  config: VeilConfig,
): Promise<DerivedProviderHandle> => {
  setNetworkId(config.network);

  const { zkArtifactsBaseUrl } = config;
  if (!zkArtifactsBaseUrl) {
    throw new Error(
      'createDerivedProvider requires config.zkArtifactsBaseUrl. ' +
        'Point it to the base URL hosting your compiled Veil ZK keys, ' +
        'e.g. "https://zk.veil.network/preprod/veil-protocol".',
    );
  }

  // ── Step 1: sign derivation message ────────────────────────────────────────
  const sigResult = await signer.signMessage(DERIVATION_MESSAGE);
  const sigHex = typeof sigResult === 'string' ? sigResult : sigResult.signature;
  // Normalize to bare hex before decoding
  const normalizedHex = sigHex.startsWith('0x') || sigHex.startsWith('0X')
    ? sigHex.slice(2)
    : sigHex;
  const sigBytes = hexToBytes(normalizedHex);

  // ── Step 2: derive master seed ─────────────────────────────────────────────
  // sha256(signature) → 32-byte hex string used as WalletSeeds.fromMasterSeed input.
  // This stays entirely in the browser; the signature is never transmitted.
  const masterSeedHex = await sha256Hex(sigBytes);
  const seeds = deriveWalletSeeds(masterSeedHex);

  // ── Step 3: resolve network settings ───────────────────────────────────────
  const preset = MIDNIGHT_PRESETS[config.network];
  const networkId = preset.networkId;
  const indexerUrl = config.midnightRpc ?? preset.indexerUrl;
  const indexerWsUrl = config.midnightIndexerWsUrl ?? preset.indexerWsUrl;
  const nodeWsUrl = config.midnightNodeWsUrl ?? preset.nodeWsUrl;
  const proofServerUrl = config.proofServerUrl ?? 'http://localhost:6300';

  // ── Step 4: IDB cache key (stable, derived from address + network) ─────────
  const address = await signer.getRecommendedAddress();
  // Prefix with network so preview/preprod/mainnet caches never collide.
  const cacheKey = `${networkId}:${address.slice(0, 40)}`;
  const cache: WalletStateCache | null = await loadIdbWalletCache(cacheKey);

  // ── Step 5: wallet configuration ───────────────────────────────────────────
  const dustOptions: DustWalletOptions = {
    ledgerParams: LedgerParameters.initialParameters(),
    additionalFeeOverhead: 1_000n,
    feeBlocksMargin: 5,
  };

  const keystore = createKeystore(seeds.unshielded, networkId);

  const walletConfig = {
    indexerClientConnection: {
      indexerHttpUrl: indexerUrl,
      indexerWsUrl,
    },
    provingServerUrl: new URL(proofServerUrl),
    networkId,
    relayURL: new URL(nodeWsUrl),
    txHistoryStorage: new InMemoryTransactionHistoryStorage(WalletEntrySchema),
    costParameters: {
      additionalFeeOverhead: dustOptions.additionalFeeOverhead,
      feeBlocksMargin: dustOptions.feeBlocksMargin,
    },
  } satisfies DefaultConfiguration;

  const dustConfig = {
    ...walletConfig,
    costParameters: {
      ledgerParams: dustOptions.ledgerParams,
      additionalFeeOverhead: dustOptions.additionalFeeOverhead,
      feeBlocksMargin: dustOptions.feeBlocksMargin,
    },
  };

  // ── Step 6: construct sub-wallets ───────────────────────────────────────────
  // Cache hit → restore deserialized state (fast, no block scan needed).
  // Cache miss → start from seed; sync runs in the background.
  const shieldedWallet = cache
    ? ShieldedWallet(walletConfig).restore(cache.shielded)
    : ShieldedWallet(walletConfig).startWithSeed(seeds.shielded);

  const unshieldedWallet = cache
    ? UnshieldedWallet(walletConfig).restore(cache.unshielded)
    : UnshieldedWallet(walletConfig).startWithPublicKey(PublicKey.fromKeyStore(keystore));

  const dustWallet = cache
    ? DustWallet(dustConfig).restore(cache.dust)
    : DustWallet(dustConfig).startWithSeed(seeds.dust, dustOptions.ledgerParams.dust);

  // ── Step 7: initialise WalletFacade ────────────────────────────────────────
  const wallet = await WalletFacade.init({
    configuration: walletConfig,
    shielded: () => shieldedWallet,
    unshielded: () => unshieldedWallet,
    dust: () => dustWallet,
  });

  const zswapKeys = ZswapSecretKeys.fromSeed(seeds.shielded);
  const dustKey = DustSecretKey.fromSeed(seeds.dust);

  // Non-blocking: starts background sync; transactions can be signed immediately
  // because the signing keys are derived from seeds at construction time.
  await wallet.start(zswapKeys, dustKey);

  // ── Step 7½: DUST sponsorship gate ────────────────────────────────────────
  // DUST must be visible in the derived wallet before the Midnight wallet can
  // balance a transaction. The gate runs lazily on the first tx so read-only
  // joins remain fast, but write calls fail with a useful sponsor error.
  const ensureSponsoredDust = async (requiredDust?: bigint): Promise<void> => {
    if (await hasVisibleDust(dustWallet, requiredDust ?? 1n)) return;

    if (!config.feeSponsorUrl) {
      throw new Error(
        'The derived Midnight wallet has no DUST and no fee sponsor URL is configured. ' +
          'Set feeSponsorUrl/NEXT_PUBLIC_BACKEND_URL before submitting transactions.',
      );
    }

    const dustAddress = DustAddress.encodePublicKey(networkId, dustKey.publicKey);
    const sponsorship = await requestSponsorship(dustAddress, config.feeSponsorUrl, { requiredDust });
    if (sponsorship.sponsored === false) {
      throw new Error(
        typeof sponsorship.reason === 'string'
          ? `DUST sponsorship unavailable: ${sponsorship.reason}`
          : 'DUST sponsorship unavailable: sponsor did not allocate DUST for this wallet.',
      );
    }

    await waitForSponsoredDust(dustWallet, DUST_SPONSOR_TIMEOUT_MS, requiredDust ?? 1n);
  };

  // ── Step 8: assemble MidnightProviders ────────────────────────────────────
  const walletAdapter = new BrowserWalletAdapter(wallet, zswapKeys, dustKey, keystore, ensureSponsoredDust);
  const zkConfigProvider = new FetchZkConfigProvider(zkArtifactsBaseUrl);

  const privateStateProvider = new IdbPrivateStateProvider<typeof PRIVATE_STATE_ID, unknown>(
    `veil-ps-${networkId}`,
  );
  privateStateProvider.setContractAddress(config.contractAddress);

  const existingPs = await privateStateProvider.get(PRIVATE_STATE_ID);

  const providers: DynamicProviders<VeilContract, typeof PRIVATE_STATE_ID> = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    privateStateProvider: privateStateProvider as any,
    publicDataProvider: indexerPublicDataProvider(indexerUrl, indexerWsUrl),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    zkConfigProvider: zkConfigProvider as any,
    proofProvider: httpClientProofProvider(proofServerUrl, zkConfigProvider),
    walletProvider: walletAdapter,
    midnightProvider: walletAdapter,
  };

  // ── Step 9: join the deployed Veil contract ────────────────────────────────
  // assetsPath ('__browser__') is stored as metadata in the compiled contract but is
  // never read from the filesystem; ZK I/O goes through FetchZkConfigProvider above.
  const compiledContract = utils.createCompiledContract(
    'veil-protocol',
    VeilContractClass as never,
    witness as never,
    '__browser__',
  ) as never;

  const api = await DynamicContractAPI.join<VeilContract, typeof PRIVATE_STATE_ID>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    providers: providers as any,
    compiledContract,
    contractAddress: config.contractAddress,
    privateStateId: PRIVATE_STATE_ID,
    ...(existingPs == null ? { initialPrivateState: createVeilPrivateState() } : {}),
  });

  // ── Step 10: periodic cache flush + page-unload save ──────────────────────
  const flushCache = (): Promise<void> =>
    saveIdbWalletCache(cacheKey, wallet, networkId).catch(() => undefined);

  const cacheTimer = setInterval(() => { void flushCache(); }, 30_000);

  const beforeUnload = () => { void flushCache(); };
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', beforeUnload);
  }

  // ── Step 11: return provider handle ───────────────────────────────────────
  return {
    async callTx(circuit: string, ...args: unknown[]): Promise<unknown> {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (api as any).callTx(circuit, ...args);
    },
    async stop(): Promise<void> {
      clearInterval(cacheTimer);
      if (typeof window !== 'undefined') {
        window.removeEventListener('beforeunload', beforeUnload);
      }
      await flushCache();
      await wallet.stop();
    },
  };
};
