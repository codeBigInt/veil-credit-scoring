import { CompactTypeBytes, CompactTypeVector, persistentHash, toHex } from '@midnight-ntwrk/compact-runtime';

const bytes32 = new CompactTypeBytes(32);
const userPkDescriptor = new CompactTypeVector(3, bytes32);
const userPkDomain = new Uint8Array(32);
new TextEncoder().encodeInto('veil:user', userPkDomain);

function hexToBytes(hex: string): Uint8Array {
  const h = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (h.length !== 64) throw new Error(`Expected 32-byte hex value, received ${h.length / 2} bytes`);
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < h.length; i += 2) out[i / 2] = parseInt(h.slice(i, i + 2), 16);
  return out;
}

interface WorkerInput {
  secreteKeyHex: string;
  contractAddress: string;
}

interface WorkerOutput {
  pk?: string;
  error?: string;
}

// Keep Veil ID derivation in the browser: secret key never leaves the user's machine.
// This mirrors Utils.generateUserPk(sk) in Compact:
// persistentHash([pad(32, "veil:user"), sk, kernel.self().bytes])
self.onmessage = (e: MessageEvent<WorkerInput>) => {
  const { secreteKeyHex, contractAddress } = e.data;
  try {
    const pkBytes = persistentHash(userPkDescriptor, [
      userPkDomain,
      hexToBytes(secreteKeyHex),
      hexToBytes(contractAddress),
    ]);
    const response: WorkerOutput = { pk: toHex(pkBytes) };
    (self as any).postMessage(response);
  } catch (err) {
    const response: WorkerOutput = { error: err instanceof Error ? err.message : String(err) };
    (self as any).postMessage(response);
  }
};
