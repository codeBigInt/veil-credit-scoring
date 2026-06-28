import React, { createContext, useContext, useMemo } from 'react';
import { VeilClient } from '@veil-protocol/sdk';
import type { VeilConfig, VeilMidnightProvider } from '@veil-protocol/sdk';

interface VeilContextValue {
  client: VeilClient | null;
  config: VeilConfig;
}

const VeilContext = createContext<VeilContextValue | null>(null);

export interface VeilProviderProps {
  config: VeilConfig;
  /**
   * The Midnight provider that routes circuit calls to the deployed contract.
   * Create this with nite-api or the Midnight DApp connector in your app.
   * When absent, client is null and hooks return idle state.
   */
  midnightProvider?: VeilMidnightProvider;
  children: React.ReactNode;
}

/**
 * Wraps your app (or a page) to provide VeilClient + config context.
 * Must sit inside your CCC provider if you use CCC for wallet connection.
 *
 * @example
 * <ccc.Provider>
 *   <VeilProvider config={veilConfig} midnightProvider={provider}>
 *     <App />
 *   </VeilProvider>
 * </ccc.Provider>
 */
export function VeilProvider({ config, midnightProvider, children }: VeilProviderProps) {
  const client = useMemo(
    () => (midnightProvider ? new VeilClient(config, midnightProvider) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [midnightProvider, config.contractAddress, config.network],
  );

  return <VeilContext.Provider value={{ client, config }}>{children}</VeilContext.Provider>;
}

export function useVeilContext(): VeilContextValue {
  const ctx = useContext(VeilContext);
  if (!ctx) throw new Error('useVeilContext must be used inside <VeilProvider>');
  return ctx;
}
