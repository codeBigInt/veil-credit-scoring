export function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

export const padStringToBytes32 = (value: string): Uint8Array => {
  const encoded = new TextEncoder().encode(value);
  const padded = new Uint8Array(32);
  padded.set(encoded.slice(0, 32));
  return padded;
};

export const nextEpoch = (epoch: bigint, step: bigint = 1n): bigint => epoch + step;

