import { type WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import { createKeystore } from '@midnight-ntwrk/wallet-sdk-unshielded-wallet';
import { Logger } from 'pino';
import { HDWallet, Roles } from '@midnight-ntwrk/wallet-sdk-hd';
import { getNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import * as rx from 'rxjs';

const getUnshieldedSeed = (seed: string): Uint8Array<ArrayBufferLike> => {
  const seedBuffer = Buffer.from(seed, 'hex');
  const hdWalletResult = HDWallet.fromSeed(seedBuffer);
  const { hdWallet } = hdWalletResult as { type: 'seedOk'; hdWallet: HDWallet };
  const derivationResult = hdWallet.selectAccount(0).selectRole(Roles.NightExternal).deriveKeyAt(0);
  if (derivationResult.type === 'keyOutOfBounds') {
    throw new Error('Key derivation out of bounds');
  }
  return derivationResult.key;
};

export const generateDust = async (
  logger: Logger,
  walletSeed: string,
  walletFacade: WalletFacade,
) => {
  const facadeState = await walletFacade.waitForSyncedState();
  const dustState = facadeState.dust;
  const previousDustBalance = dustState.balance(new Date());
  const networkId = getNetworkId();
  const unshieldedKeystore = createKeystore(getUnshieldedSeed(walletSeed), networkId);
  const utxos = facadeState.unshielded.availableCoins.filter((coin) => {
    return !coin.meta.registeredForDustGeneration;
  });

  if (utxos.length === 0) {
    logger.info(
      `No unregistered UTXOs found for dust generation. Current dust balance: ${previousDustBalance.toString()}`,
    );
    return;
  }

  const recipe = await walletFacade.registerNightUtxosForDustGeneration(
    utxos,
    unshieldedKeystore.getPublicKey(),
    (payload: Uint8Array) => unshieldedKeystore.signData(payload),
    dustState.address,
  );

  const transaction = await walletFacade.finalizeRecipe(recipe);
  const txId = await walletFacade.submitTransaction(transaction);

  let dustBalance = previousDustBalance;
  try {
    dustBalance = await rx.firstValueFrom(
      walletFacade.state().pipe(
        rx.map((s: any) => s.dust.balance(new Date())),
        rx.filter((balance: bigint) => balance > previousDustBalance),
        rx.timeout({ first: 120_000 }),
      ),
    );
  } catch {
    // Dust registration is submitted; balance increase can lag behind chain/indexer sync.
    dustBalance = (await walletFacade.waitForSyncedState()).dust.balance(new Date());
  }

  logger.info(`Dust generation tx submitted: ${txId}; dust balance: ${dustBalance}`);
  return txId;
};
