import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { syncNetworkId } from '@/utils/network-id';

const NETWORK_ID = 'preview';
const COMPATIBLE_CONNECTOR_API_MAJOR = 4;

type ConnectedWalletApi = {
  getShieldedAddresses: () => Promise<{ shieldedCoinPublicKey: string; shieldedEncryptionPublicKey: string }>;
  getUnshieldedAddress: () => Promise<{ unshieldedAddress: string }>;
  getConfiguration: () => Promise<{ proverServerUri: string; indexerUri: string; indexerWsUri: string }>;
  balanceUnsealedTransaction: (tx: string) => Promise<{ tx: string }>;
  submitTransaction: (tx: string) => Promise<void>;
};

type InitialWalletApi = {
  apiVersion: string;   
  connect: (networkId: string) => Promise<ConnectedWalletApi>;
};

export type MidnightWalletId = '1am' | 'mnLace';

export const MidnightWalletOptions: Array<{
  id: MidnightWalletId;
  name: string;
  shortName: string;
  description: string;
}> = [
  {
    id: '1am',
    name: '1AM Wallet',
    shortName: '1AM',
    description: 'Preferred Midnight wallet for Veil.',
  },
  {
    id: 'mnLace',
    name: 'Lace',
    shortName: 'Lace',
    description: 'Use Midnight Lace if you already have it set up.',
  },
];

interface WalletContextType {
  isConnecting: boolean;
  isConnected: boolean;
  walletAddress: string | null;
  walletName: string | null;
  selectedWalletId: MidnightWalletId;
  walletApi: ConnectedWalletApi | undefined;
  connect: (walletId?: MidnightWalletId) => Promise<ConnectedWalletApi>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

const SESSION_KEY = 'veil_wallet_connected';
const WALLET_SELECTION_KEY = 'veil_midnight_wallet_selection';

type MidnightWindow = Window &
  typeof globalThis & {
    midnight?: Partial<Record<MidnightWalletId, InitialWalletApi>> & Record<string, InitialWalletApi | undefined>;
  };

const getMidnightWallets = () => {
  if (typeof window === 'undefined') return undefined;
  return (window as MidnightWindow).midnight;
};

const getWalletOption = (walletId: MidnightWalletId) =>
  MidnightWalletOptions.find((wallet) => wallet.id === walletId) ?? MidnightWalletOptions[0];

const isCompatibleWallet = (wallet: InitialWalletApi | undefined): wallet is InitialWalletApi => {
  if (!wallet || typeof wallet !== 'object' || typeof wallet.connect !== 'function') return false;
  if (typeof wallet.apiVersion !== 'string') return false;
  const major = Number.parseInt(wallet.apiVersion.split('.')[0] ?? '', 10);
  return Number.isNaN(major) || major <= COMPATIBLE_CONNECTOR_API_MAJOR;
};

const getCompatibleWallet = (walletId: MidnightWalletId): InitialWalletApi | undefined => {
  const wallets = getMidnightWallets();
  if (!wallets) return undefined;
  const wallet = wallets[walletId];
  return isCompatibleWallet(wallet) ? wallet : undefined;
};

const findAnyCompatibleWallet = (): InitialWalletApi | undefined => {
  const wallets = getMidnightWallets();
  if (!wallets) return undefined;
  for (const option of MidnightWalletOptions) {
    const wallet = getCompatibleWallet(option.id);
    if (wallet) return wallet;
  }
  return Object.values(wallets).find(isCompatibleWallet);
};

const getPersistedWalletId = (): MidnightWalletId | undefined => {
  if (typeof window === 'undefined') return undefined;
  const walletId = window.sessionStorage.getItem(WALLET_SELECTION_KEY);
  return MidnightWalletOptions.some((wallet) => wallet.id === walletId) ? (walletId as MidnightWalletId) : undefined;
};

const getFallbackWalletId = (): MidnightWalletId => getPersistedWalletId() ?? '1am';

const pollForWallet = (walletId: MidnightWalletId, timeoutMs = 10_000): Promise<InitialWalletApi> =>
  new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const walletOption = getWalletOption(walletId);
    const tick = () => {
      const found = getCompatibleWallet(walletId) ?? findAnyCompatibleWallet();
      if (found) return resolve(found);
      if (Date.now() >= deadline) {
        const wallets = getMidnightWallets();
        const keys = wallets ? Object.keys(wallets) : [];
        const detail = keys.length > 0
          ? `Detected Midnight wallet keys: [${keys.join(', ')}].`
          : 'No Midnight wallet connector was injected into window.midnight.';
        return reject(new Error(`${walletOption.name} not found. ${detail} Install/unlock 1AM or Lace and try again.`));
      }
      setTimeout(tick, 100);
    };
    tick();
  });

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [walletApi, setWalletApi] = useState<ConnectedWalletApi | undefined>();
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletName, setWalletName] = useState<string | null>(null);
  const [selectedWalletId, setSelectedWalletId] = useState<MidnightWalletId>(() => getFallbackWalletId());
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.sessionStorage.getItem(SESSION_KEY) === 'true';
  });

  const connect = useCallback(async (walletId: MidnightWalletId = getFallbackWalletId()) => {
    const walletOption = getWalletOption(walletId);
    setSelectedWalletId(walletId);
    if (isConnected && walletApi) {
      syncNetworkId(NETWORK_ID);
      setWalletName(walletOption.name);
      return walletApi;
    }

    setIsConnecting(true);
    try {
      syncNetworkId(NETWORK_ID);
      const initialApi = await pollForWallet(walletId);
      const connectedApi: ConnectedWalletApi = await initialApi.connect(NETWORK_ID);
      const { unshieldedAddress } = await connectedApi.getUnshieldedAddress();
      setWalletApi(connectedApi);
      setWalletAddress(unshieldedAddress);
      setWalletName(walletOption.name);
      setIsConnected(true);
      window.sessionStorage.setItem(SESSION_KEY, 'true');
      window.sessionStorage.setItem(WALLET_SELECTION_KEY, walletId);
      return connectedApi;
    } finally {
      setIsConnecting(false);
    }
  }, [isConnected, walletApi]);

  const disconnect = useCallback(() => {
    setWalletApi(undefined);
    setWalletAddress(null);
    setWalletName(null);
    setIsConnected(false);
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(SESSION_KEY);
    }
  }, []);

  useEffect(() => {
    if (isConnected && !walletApi) {
      void connect();
    }
  }, []);

  return (
    <WalletContext.Provider value={{ isConnecting, isConnected, walletAddress, walletName, selectedWalletId, walletApi, connect, disconnect }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used inside WalletProvider');
  return ctx;
}
