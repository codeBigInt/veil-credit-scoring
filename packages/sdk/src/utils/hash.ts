import { bytesToHex } from './bytes';

export const randomBytes32 = (): Uint8Array => {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
};

export const sha256Bytes32 = async (value: string | Uint8Array): Promise<Uint8Array> => {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : new Uint8Array(value);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return new Uint8Array(digest);
};

const stableStringify = (value: unknown): string => {
  if (value instanceof Uint8Array) return JSON.stringify(bytesToHex(value));
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'undefined';
};

export const hashChainState = async (value: unknown): Promise<string> =>
  bytesToHex(await sha256Bytes32(stableStringify(value)));
