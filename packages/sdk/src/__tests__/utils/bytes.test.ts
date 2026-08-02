import { describe, it, expect } from 'vitest';
import {
  toBytes,
  toBytes32,
  assertBytes32,
  padStringToBytes32,
  bytesToHex,
  hexToBytes,
  extractCircuitResult,
} from '../../utils/bytes';
import { VeilError } from '../../types';

describe('toBytes', () => {
  it('passes through a Uint8Array unchanged', () => {
    const arr = new Uint8Array([1, 2, 3]);
    expect(toBytes(arr)).toBe(arr);
  });

  it('decodes a hex string', () => {
    const result = toBytes('0xdeadbeef');
    expect(result).toEqual(new Uint8Array([0xde, 0xad, 0xbe, 0xef]));
  });

  it('throws INVALID_CONFIG for unsupported types', () => {
    expect(() => toBytes(42 as never, 'label'))
      .toThrow(VeilError);
  });
});

describe('assertBytes32', () => {
  it('passes through a 32-byte array', () => {
    const arr = new Uint8Array(32);
    expect(assertBytes32(arr)).toBe(arr);
  });

  it('throws VeilError for wrong length', () => {
    expect(() => assertBytes32(new Uint8Array(16), 'myField'))
      .toThrowError(/myField must be exactly 32 bytes/);
  });
});

describe('toBytes32', () => {
  it('accepts a 32-byte Uint8Array', () => {
    const arr = new Uint8Array(32).fill(0xaa);
    expect(toBytes32(arr)).toBe(arr);
  });

  it('decodes a 64-char hex string to 32 bytes', () => {
    const hex = '0x' + 'ab'.repeat(32);
    const result = toBytes32(hex, 'test');
    expect(result).toHaveLength(32);
    expect(result.every((b) => b === 0xab)).toBe(true);
  });

  it('throws for hex shorter than 32 bytes', () => {
    expect(() => toBytes32('0x1234', 'short')).toThrow(VeilError);
  });
});

describe('padStringToBytes32', () => {
  it('right-pads a short string with zeros', () => {
    const result = padStringToBytes32('evm');
    expect(result).toHaveLength(32);
    const text = new TextDecoder().decode(result.slice(0, 3));
    expect(text).toBe('evm');
    expect(result.slice(3).every((b) => b === 0)).toBe(true);
  });

  it('truncates strings longer than 32 bytes', () => {
    const long = 'a'.repeat(64);
    const result = padStringToBytes32(long);
    expect(result).toHaveLength(32);
  });

  it('handles an empty string', () => {
    const result = padStringToBytes32('');
    expect(result).toHaveLength(32);
    expect(result.every((b) => b === 0)).toBe(true);
  });
});

describe('bytesToHex / hexToBytes round-trip', () => {
  it('round-trips random bytes', () => {
    const original = new Uint8Array(32).fill(0x5a);
    const hex = bytesToHex(original);
    const back = hexToBytes(hex);
    expect(back).toEqual(original);
  });
});

describe('extractCircuitResult', () => {
  it('extracts from { result: value }', () => {
    expect(extractCircuitResult<number>({ result: 42 }, 'Circuit')).toBe(42);
  });

  it('extracts from { private: { result: value } }', () => {
    expect(extractCircuitResult<string>({ private: { result: 'ok' } }, 'Circuit')).toBe('ok');
  });

  it('returns raw value when there is no wrapper', () => {
    expect(extractCircuitResult<boolean>(true, 'Circuit')).toBe(true);
  });

  it('returns 0 (falsy but defined) as a valid result', () => {
    expect(extractCircuitResult<number>(0, 'Circuit')).toBe(0);
  });

  it('throws MIDNIGHT_RPC_ERROR for undefined', () => {
    expect(() => extractCircuitResult(undefined, 'MyCircuit'))
      .toThrowError(/MyCircuit did not return/);
  });
});
