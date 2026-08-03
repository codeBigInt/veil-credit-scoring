import { fromHex, toHex } from '@midnight-ntwrk/compact-runtime';
import type { Bytes32, BytesLike } from '../types';
import { VeilError } from '../types';

const stripPrefix = (hex: string): string =>
  hex.startsWith('0x') || hex.startsWith('0X') ? hex.slice(2) : hex;

// compact-runtime's fromHex may return a Node.js Buffer; normalize to plain Uint8Array
// so downstream toEqual checks and instanceof checks behave consistently.
const decodeHex = (hex: string): Uint8Array => {
  const result = fromHex(stripPrefix(hex));
  return result.constructor === Uint8Array ? result : Uint8Array.from(result);
};

export const bytesToHex = (bytes: Uint8Array): string => toHex(bytes);

export const hexToBytes = (hex: string): Uint8Array => decodeHex(hex);

export const toBytes = (value: BytesLike, label = 'value'): Uint8Array => {
  if (value instanceof Uint8Array) return value;
  if (typeof value === 'string') return decodeHex(value);
  throw new VeilError(`${label} must be a Uint8Array or hex string.`, 'INVALID_CONFIG');
};

export const assertBytes32 = (value: Uint8Array, label = 'value'): Uint8Array => {
  if (value.length !== 32) {
    throw new VeilError(`${label} must be exactly 32 bytes; received ${value.length}.`, 'INVALID_CONFIG');
  }
  return value;
};

export const toBytes32 = (value: BytesLike, label = 'value'): Bytes32 =>
  assertBytes32(toBytes(value, label), label);

export const padStringToBytes32 = (value: string): Uint8Array => {
  const encoded = new TextEncoder().encode(value);
  const padded = new Uint8Array(32);
  padded.set(encoded.subarray(0, 32));
  return padded;
};

export const extractCircuitResult = <T>(value: unknown, circuitName: string): T => {
  if (value && typeof value === 'object') {
    const result = (value as { result?: unknown }).result;
    if (result !== undefined) return result as T;

    const privateResult = (value as { private?: { result?: unknown } }).private?.result;
    if (privateResult !== undefined) return privateResult as T;
  }

  if (value !== undefined) return value as T;
  throw new VeilError(`${circuitName} did not return a circuit result.`, 'MIDNIGHT_RPC_ERROR');
};
