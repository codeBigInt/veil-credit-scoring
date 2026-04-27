import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { syncNetworkId } from '@/utils/network-id';

const NETWORK_ID = 'preprod';

type ConnectedWalletApi = {
  getShieldedAddresses: () => Promise<{ shieldedCoinPublicKey: string; shieldedEncryptionPublicKey: string }>;
  getUnshieldedAddress: () => Promise<{ unshieldedAddress: string }>;
  getConfiguration: () => Promise<{ proverServerUri: string; indexerUri: string; indexerWsUri: string }>;
  balanceUnsealedTransaction: (tx: string) => Promise<{ tx: string }>;
  submitTransaction: (tx: string) => Promise<void>;
};

interface WalletContextType {
  isConnecting: boolean;
  isConnected: boolean;
  walletAddress: string | null;
  walletApi: ConnectedWalletApi | undefined;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

const SESSION_KEY = 'veil_wallet_connected';

const pollForWallet = (timeoutMs = 5_000): Promise<any> =>
  new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const tick = () => {
      const midnight = (window as any).midnight;
      if (midnight) {
        const found = Object.values(midnight as Record<string, unknown>).find(
          (w): w is any => w != null && typeof w === 'object' && 'apiVersion' in w,
        );
        if (found) return resolve(found);
      }
      if (Date.now() >= deadline) {
        return reject(new Error('Midnight Lace wallet not found. Is the extension installed and enabled?'));
      }
      setTimeout(tick, 100);
    };
    tick();
  });

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [walletApi, setWalletApi] = useState<ConnectedWalletApi | undefined>();
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.sessionStorage.getItem(SESSION_KEY) === 'true';
  });

  const connect = useCallback(async () => {
    if (isConnected && walletApi) {
      syncNetworkId(NETWORK_ID);
      return;
    }

    setIsConnecting(true);
    try {
      syncNetworkId(NETWORK_ID);
      const initialApi = await pollForWallet();
      const connectedApi: ConnectedWalletApi = await initialApi.connect(NETWORK_ID);
      const { unshieldedAddress } = await connectedApi.getUnshieldedAddress();
      setWalletApi(connectedApi);
      setWalletAddress(unshieldedAddress);
      setIsConnected(true);
      window.sessionStorage.setItem(SESSION_KEY, 'true');
    } finally {
      setIsConnecting(false);
    }
  }, [isConnected, walletApi]);

  const disconnect = useCallback(() => {
    setWalletApi(undefined);
    setWalletAddress(null);
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
    <WalletContext.Provider value={{ isConnecting, isConnected, walletAddress, walletApi, connect, disconnect }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used inside WalletProvider');
  return ctx;
}
