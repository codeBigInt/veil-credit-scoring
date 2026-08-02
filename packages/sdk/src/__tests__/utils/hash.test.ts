import { describe, it, expect } from 'vitest';
import { sha256Bytes32, hashChainState, randomBytes32 } from '../../utils/hash';

describe('sha256Bytes32', () => {
  it('returns exactly 32 bytes', async () => {
    const result = await sha256Bytes32('hello');
    expect(result).toHaveLength(32);
  });

  it('is deterministic', async () => {
    const a = await sha256Bytes32('same-input');
    const b = await sha256Bytes32('same-input');
    expect(a).toEqual(b);
  });

  it('produces different output for different input', async () => {
    const a = await sha256Bytes32('foo');
    const b = await sha256Bytes32('bar');
    expect(a).not.toEqual(b);
  });

  it('accepts a Uint8Array input', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const result = await sha256Bytes32(bytes);
    expect(result).toHaveLength(32);
  });
});

describe('hashChainState', () => {
  it('returns a hex string', async () => {
    const result = await hashChainState({ foo: 'bar' });
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('is deterministic for the same input', async () => {
    const obj = { a: 1, b: [2, 3] };
    const a = await hashChainState(obj);
    const b = await hashChainState(obj);
    expect(a).toBe(b);
  });

  it('is insensitive to key ordering', async () => {
    const a = await hashChainState({ x: 1, y: 2 });
    const b = await hashChainState({ y: 2, x: 1 });
    expect(a).toBe(b);
  });

  it('produces different hashes for different objects', async () => {
    const a = await hashChainState({ walletAge: 100 });
    const b = await hashChainState({ walletAge: 200 });
    expect(a).not.toBe(b);
  });

  it('handles Uint8Array values in objects', async () => {
    const a = await hashChainState({ data: new Uint8Array([1, 2]) });
    const b = await hashChainState({ data: new Uint8Array([1, 2]) });
    expect(a).toBe(b);
  });
});

describe('randomBytes32', () => {
  it('returns exactly 32 bytes', () => {
    expect(randomBytes32()).toHaveLength(32);
  });

  it('returns different values on each call', () => {
    const a = randomBytes32();
    const b = randomBytes32();
    expect(a).not.toEqual(b);
  });
});
