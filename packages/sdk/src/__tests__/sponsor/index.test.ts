import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { requestSponsorship } from '../../sponsor';
import { VeilError } from '../../types';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('requestSponsorship', () => {
  it('returns the parsed JSON body on success', async () => {
    const payload = { txFeeToken: 'dust', amount: 1 };
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify(payload), { status: 200 }),
    );

    const result = await requestSponsorship('tdust1user', 'https://sponsor.test');
    expect(result).toEqual(payload);
  });

  it('throws SPONSOR_UNAVAILABLE when the server returns non-2xx', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response('Service Unavailable', { status: 503 }),
    );

    await expect(
      requestSponsorship('tdust1user', 'https://sponsor.test'),
    ).rejects.toThrow(VeilError);

    try {
      await requestSponsorship('tdust1user', 'https://sponsor.test');
    } catch (err) {
      expect((err as VeilError).code).toBe('SPONSOR_UNAVAILABLE');
    }
  });

  it('POSTs to /sponsor/dust with the correct body', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    );

    await requestSponsorship('tdust1user', 'https://sponsor.test/');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://sponsor.test/sponsor/dust',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ dustAddress: 'tdust1user' }),
      }),
    );
  });

  it('sends requiredDust as a decimal string when provided', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    );

    await requestSponsorship('tdust1user', 'https://sponsor.test/', {
      requiredDust: 123n,
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://sponsor.test/sponsor/dust',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ dustAddress: 'tdust1user', requiredDust: '123' }),
      }),
    );
  });
});
