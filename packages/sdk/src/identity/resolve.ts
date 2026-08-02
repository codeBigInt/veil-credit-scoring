import type { VeilMidnightProvider } from '../types';
import { toBytes32 } from '../utils/bytes';
import { assertIdentityActive } from '../contract';

export interface IdentityState {
  registered: boolean;
  registrationTxHash?: string;
}

/**
 * Probes whether a veilId is registered on Midnight by calling Identity_assertActive.
 * Returns null if the network is unreachable (distinguishes "not registered" from "unknown").
 */
export const resolveIdentityState = async (
  veilId: string,
  provider: VeilMidnightProvider,
): Promise<IdentityState | null> => {
  try {
    await assertIdentityActive(provider, toBytes32(veilId, 'veilId'));
    return { registered: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (
      message.toLowerCase().includes('not found') ||
      message.toLowerCase().includes('not registered') ||
      message.toLowerCase().includes('inactive') ||
      message.toLowerCase().includes('identity')
    ) {
      return { registered: false };
    }
    // Network error or unexpected failure — can't determine state
    return null;
  }
};

export const checkIfRegistered = async (
  veilId: string,
  provider: VeilMidnightProvider,
): Promise<boolean> => {
  const state = await resolveIdentityState(veilId, provider);
  return state?.registered === true;
};
