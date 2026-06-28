import { describe, it, expect, vi, beforeAll } from 'vitest';

// Hoist mock before any imports so module-level code in derive.ts gets the mock
vi.mock('@midnight-ntwrk/compact-runtime', () => {
  const fakeHash = new Uint8Array(32).fill(0xab);
  return {
    CompactTypeBytes: class CompactTypeBytes { constructor(_n: number) {} },
    CompactTypeVector: class CompactTypeVector { constructor(_n: number, _t: unknown) {} },
    persistentHash: vi.fn(() => fakeHash),
    toHex: (b: Uint8Array) => Buffer.from(b).toString('hex'),
    fromHex: (hex: string) => Uint8Array.from(Buffer.from(hex.replace(/^0x/, ''), 'hex')),
  };
});

import { deriveVeilId, detectSourceChain, buildIdentityFromSigner } from '../../identity/derive';
import { VeilError } from '../../types';

describe('detectSourceChain', () => {
  it('returns "evm" for MetaMask-named signers', () => {
    class MetaMaskSigner {}
    expect(detectSourceChain(new MetaMaskSigner())).toBe('evm');
  });

  it('returns "passkey" for JoyID signers', () => {
    class JoyIdSigner {}
    expect(detectSourceChain(new JoyIdSigner())).toBe('passkey');
  });

  it('returns "btc" for UniSat signers', () => {
    class UnisatSigner {}
    expect(detectSourceChain(new UnisatSigner())).toBe('btc');
  });

  it('returns "solana" for Phantom signers', () => {
    class PhantomSigner {}
    expect(detectSourceChain(new PhantomSigner())).toBe('solana');
  });

  it('returns "ckb" as default', () => {
    expect(detectSourceChain({})).toBe('ckb');
    expect(detectSourceChain(null)).toBe('ckb');
  });
});

describe('deriveVeilId', () => {
  it('returns a hex string', () => {
    const lockHash = new Uint8Array(32).fill(0x01);
    const veilId = deriveVeilId(lockHash);
    expect(typeof veilId).toBe('string');
    expect(veilId.length).toBeGreaterThan(0);
  });

  it('is deterministic for the same lock hash', () => {
    const lockHash = new Uint8Array(32).fill(0x55);
    expect(deriveVeilId(lockHash)).toBe(deriveVeilId(lockHash));
  });

  it('throws for input shorter than 32 bytes', () => {
    expect(() => deriveVeilId(new Uint8Array(16))).toThrow(VeilError);
  });
});

describe('buildIdentityFromSigner', () => {
  const mockSigner = {
    getRecommendedAddress: vi.fn().mockResolvedValue('ckb1qtest...'),
    signMessage: vi.fn(),
  };

  it('throws INVALID_CONFIG without a deriveLockHashFromAddress adapter', async () => {
    await expect(buildIdentityFromSigner(mockSigner)).rejects.toThrow(VeilError);
  });

  it('builds an identity when adapter is provided', async () => {
    const lockHash = new Uint8Array(32).fill(0x07);
    const identity = await buildIdentityFromSigner(mockSigner, {
      deriveLockHashFromAddress: () => lockHash,
    });
    expect(identity.ckbAddress).toBe('ckb1qtest...');
    expect(typeof identity.veilId).toBe('string');
    expect(identity.sourceChain).toBe('ckb');
  });
});
