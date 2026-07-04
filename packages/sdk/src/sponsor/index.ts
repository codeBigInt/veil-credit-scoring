import { VeilError, type SponsoredFee } from '../types';

/**
 * Requests DUST generation from the Veil backend sponsor service.
 * The backend only accepts a user DUST address; it does not accept veilIds,
 * transaction intents, or reputation data.
 *
 * This is optional and non-critical. Callers should catch and handle
 * SPONSOR_UNAVAILABLE gracefully (fall back to user-paid fee).
 */
export const requestSponsorship = async (
  dustAddress: string,
  sponsorUrl: string,
  options: { requiredDust?: bigint | string; scope?: string } = {},
): Promise<SponsoredFee> => {
  const endpoint = `${sponsorUrl.replace(/\/$/, '')}/sponsor/dust`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dustAddress,
      ...(options.requiredDust != null ? { requiredDust: options.requiredDust.toString() } : {}),
      ...(options.scope ? { scope: options.scope } : {}),
    }),
  });
  if (!response.ok) {
    const details = await response.text().catch(() => '');
    throw new VeilError(
      `Fee sponsor unavailable at ${endpoint}: HTTP ${response.status} ${response.statusText}${details ? ` - ${details}` : ''}`,
      'SPONSOR_UNAVAILABLE',
      {
        details,
        status: response.status,
        statusText: response.statusText,
      },
    );
  }
  return response.json() as Promise<SponsoredFee>;
};
