import { randomBytes } from 'node:crypto';
import { fromHex, toHex } from '@midnight-ntwrk/compact-runtime';

export const toJsonSafe = (value: unknown): unknown => {
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Uint8Array) return toHex(value);
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(toJsonSafe);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, toJsonSafe(entry)]));
  }
  return value;
};

export const requiredString = (body: Record<string, unknown>, field: string): string => {
  const value = body[field];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${field} is required`);
  }
  return value;
};

export const optionalString = (body: Record<string, unknown>, field: string): string | undefined => {
  const value = body[field];
  if (value == null || value === '') return undefined;
  if (typeof value !== 'string') {
    throw new Error(`${field} must be a string`);
  }
  return value;
};

export const requiredBytes = (body: Record<string, unknown>, field: string): Uint8Array =>
  fromHex(requiredString(body, field));

export const optionalBytes = (body: Record<string, unknown>, field: string, fallback?: Uint8Array): Uint8Array => {
  const value = optionalString(body, field);
  if (value == null) {
    if (fallback) return fallback;
    throw new Error(`${field} is required`);
  }
  return fromHex(value);
};

export const requiredBigInt = (body: Record<string, unknown>, field: string): bigint => {
  const value = body[field];
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isInteger(value)) return BigInt(value);
  if (typeof value === 'string' && value.trim() !== '') return BigInt(value);
  throw new Error(`${field} is required`);
};

export const optionalBigInt = (body: Record<string, unknown>, field: string, fallback: bigint): bigint => {
  const value = body[field];
  if (value == null || value === '') return fallback;
  return requiredBigInt(body, field);
};

export const randomBytes32 = (): Uint8Array => new Uint8Array(randomBytes(32));
