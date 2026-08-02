import { describe, it, expect, vi, beforeAll } from 'vitest';

// Hoist mock before any imports so module-level code in derive.ts gets the mock
vi.mock('@midnight-ntwrk/compact-runtime', () => {
  return {
    toHex: (b: Uint8Array) => Buffer.from(b).toString('hex'),
    fromHex: (hex: string) => Uint8Array.from(Buffer.from(hex.replace(/^0x/, ''), 'hex')),
  };
});

vi.mock('../../vendor/managed/veil-protocol/contract/index.js', () => ({
  pureCircuits: {
    Utils_deriveVeilId: vi.fn(() => new Uint8Array(32).fill(0xab)),
  },
  Contract: vi.fn(),
}));
vi.mock('../../vendor/witness', () => ({
  witness: {},
  createVeilPrivateState: vi.fn(() => ({})),
}));
vi.mock('nite-api', () => ({ utils: { createCompiledContract: vi.fn() } }));

import { deriveVeilId, detectSourceChain, buildIdentityFromSigner } from '../../identity/derive';
import { VeilError } from '../../types';

const contractAddress = '0x' + '11'.repeat(32);

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
    const veilId = deriveVeilId(lockHash, { contractAddress });
    expect(typeof veilId).toBe('string');
    expect(veilId.length).toBeGreaterThan(0);
  });

  it('is deterministic for the same lock hash', () => {
    const lockHash = new Uint8Array(32).fill(0x55);
    expect(deriveVeilId(lockHash, { contractAddress })).toBe(deriveVeilId(lockHash, { contractAddress }));
  });

  it('throws for input shorter than 32 bytes', () => {
    expect(() => deriveVeilId(new Uint8Array(16), { contractAddress })).toThrow(VeilError);
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
      contractAddress,
    });
    expect(identity.ckbAddress).toBe('ckb1qtest...');
    expect(typeof identity.veilId).toBe('string');
    expect(identity.sourceChain).toBe('ckb');
  });
});
