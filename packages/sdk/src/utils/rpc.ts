import { VeilError } from '../types';

export const jsonRpc = async <T>(rpcUrl: string, method: string, params: unknown[] = []): Promise<T> => {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (!response.ok) {
    throw new VeilError(`Chain RPC request failed: ${method}`, 'CHAIN_RPC_ERROR', {
      status: response.status,
      statusText: response.statusText,
    });
  }
  const payload = (await response.json()) as { result?: T; error?: unknown };
  if (payload.error) {
    throw new VeilError(`Chain RPC returned an error: ${method}`, 'CHAIN_RPC_ERROR', payload.error);
  }
  return payload.result as T;
};

export const parseRpcQuantity = (value: unknown): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, value.startsWith('0x') ? 16 : 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};
