const TX_ID_KEYS = new Set([
  'txId',
  'txID',
  'transactionId',
  'transactionID',
  'txHash',
  'transactionHash',
  'hash',
  'id',
]);

const HEX_32_BYTES = /^(?:0x)?[0-9a-fA-F]{64}$/;

export const normalizeTxId = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!HEX_32_BYTES.test(trimmed)) return null;
    return trimmed.startsWith('0x') || trimmed.startsWith('0X') ? trimmed.slice(2) : trimmed;
  }

  return null;
};

export const extractTxId = (
  value: unknown,
  seen: Set<unknown> = new Set(),
  depth = 0,
): string | null => {
  const direct = normalizeTxId(value);
  if (direct) return direct;

  if (!value || typeof value !== 'object' || depth > 6 || seen.has(value)) return null;
  seen.add(value);

  if (Array.isArray(value)) {
    for (const item of value) {
      const txId = extractTxId(item, seen, depth + 1);
      if (txId) return txId;
    }
    return null;
  }

  const record = value as Record<string, unknown>;
  for (const key of TX_ID_KEYS) {
    const txId = normalizeTxId(record[key]);
    if (txId) return txId;
  }

  for (const nested of Object.values(record)) {
    const txId = extractTxId(nested, seen, depth + 1);
    if (txId) return txId;
  }

  return null;
};
