import { describe, it, expect, vi } from 'vitest';
import { resolveIdentityState, checkIfRegistered } from '../../identity/resolve';
import type { VeilMidnightProvider } from '../../types';

const makeProvider = (behavior: 'active' | 'not-found' | 'network-error'): VeilMidnightProvider => ({
  callTx: vi.fn().mockImplementation(async () => {
    if (behavior === 'not-found') throw new Error('Identity not found');
    if (behavior === 'network-error') throw new Error('Connection refused');
    return true;
  }),
});

describe('resolveIdentityState', () => {
  it('returns { registered: true } when Identity_assertActive succeeds', async () => {
    const provider = makeProvider('active');
    const state = await resolveIdentityState('0x' + 'aa'.repeat(32), provider);
    expect(state).toEqual({ registered: true });
  });

  it('returns { registered: false } when the error is "not found"', async () => {
    const provider = makeProvider('not-found');
    const state = await resolveIdentityState('0x' + 'bb'.repeat(32), provider);
    expect(state).toEqual({ registered: false });
  });

  it('returns null for a network error that is not an identity error', async () => {
    const provider = makeProvider('network-error');
    const state = await resolveIdentityState('0x' + 'cc'.repeat(32), provider);
    expect(state).toBeNull();
  });

  it('calls Identity_assertActive with the correct veilId bytes', async () => {
    const provider = makeProvider('active');
    await resolveIdentityState('0x' + '01'.repeat(32), provider);
    expect(provider.callTx).toHaveBeenCalledWith(
      'Identity_assertActive',
      expect.any(Uint8Array),
    );
  });
});

describe('checkIfRegistered', () => {
  it('returns true when registered', async () => {
    expect(await checkIfRegistered('0x' + 'aa'.repeat(32), makeProvider('active'))).toBe(true);
  });

  it('returns false when not found', async () => {
    expect(await checkIfRegistered('0x' + 'bb'.repeat(32), makeProvider('not-found'))).toBe(false);
  });

  it('returns false on network error (null state → false)', async () => {
    expect(await checkIfRegistered('0x' + 'cc'.repeat(32), makeProvider('network-error'))).toBe(false);
  });
});
