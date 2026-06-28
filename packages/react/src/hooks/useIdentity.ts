import { useState, useEffect, useCallback } from 'react';
import { ccc } from '@ckb-ccc/connector-react';
import type { RegistrationResult, VeilIdentity } from '@veil-protocol/sdk';
import { useVeilContext } from '../context/VeilProvider';

export type IdentityStatus =
  | 'idle'          // no wallet connected
  | 'deriving'      // computing veilId from wallet key (local, instant)
  | 'unregistered'  // veilId derived, not yet on Midnight
  | 'registering'   // registration tx in flight
  | 'registered'    // on-chain and ready
  | 'error';

export interface UseIdentityReturn {
  identity: VeilIdentity | null;
  status: IdentityStatus;
  error: string | null;
  /** Prompts one wallet signature and registers the identity on Midnight. */
  register: () => Promise<RegistrationResult | null>;
}

/**
 * Manages the full user identity lifecycle:
 * - Derives veilId from the connected wallet (no tx, instant)
 * - Checks on-chain registration status
 * - Exposes register() to trigger the registration tx
 */
export function useIdentity(): UseIdentityReturn {
  const { client } = useVeilContext();
  const signer = ccc.useSigner();

  const [identity, setIdentity] = useState<VeilIdentity | null>(null);
  const [status, setStatus] = useState<IdentityStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!signer || !client) {
      setIdentity(null);
      setStatus('idle');
      return;
    }

    let cancelled = false;
    setStatus('deriving');
    setError(null);

    client
      .deriveIdentity(signer)
      .then(async (id) => {
        if (cancelled) return;
        setIdentity(id);

        const state = await client.resolveIdentityState(id.veilId);
        if (cancelled) return;
        setStatus(state?.registered === true ? 'registered' : 'unregistered');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to derive identity');
        setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [signer, client]);

  const register = useCallback(async (): Promise<RegistrationResult | null> => {
    if (!client || !signer || !identity) return null;

    setStatus('registering');
    setError(null);

    try {
      const result = await client.register(signer);
      setStatus('registered');
      return result;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed');
      setStatus('error');
      return null;
    }
  }, [client, signer, identity]);

  return { identity, status, error, register };
}
