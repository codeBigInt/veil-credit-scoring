import { describe, it, expect } from 'vitest';
import { normalizeBand, deriveCommunityWeight } from '../../reputation/band';

describe('normalizeBand', () => {
  it('passes through valid string band values', () => {
    expect(normalizeBand('unranked')).toBe('unranked');
    expect(normalizeBand('bronze')).toBe('bronze');
    expect(normalizeBand('silver')).toBe('silver');
    expect(normalizeBand('gold')).toBe('gold');
    expect(normalizeBand('platinum')).toBe('platinum');
  });

  it('converts bigint ordinal to band name', () => {
    expect(normalizeBand(0n)).toBe('unranked');
    expect(normalizeBand(1n)).toBe('bronze');
    expect(normalizeBand(2n)).toBe('silver');
    expect(normalizeBand(3n)).toBe('gold');
    expect(normalizeBand(4n)).toBe('platinum');
  });

  it('converts number ordinal to band name', () => {
    expect(normalizeBand(3)).toBe('gold');
  });

  it('defaults to "unranked" for out-of-range values', () => {
    expect(normalizeBand(99n)).toBe('unranked');
    expect(normalizeBand('invalid')).toBe('unranked');
    expect(normalizeBand(null)).toBe('unranked');
  });
});

describe('deriveCommunityWeight', () => {
  it('returns 1.0 for unranked', () => expect(deriveCommunityWeight('unranked')).toBe(1));
  it('returns 1.0 for bronze', () => expect(deriveCommunityWeight('bronze')).toBe(1));
  it('returns 1.25 for silver', () => expect(deriveCommunityWeight('silver')).toBe(1.25));
  it('returns 1.5 for gold', () => expect(deriveCommunityWeight('gold')).toBe(1.5));
  it('returns 2.0 for platinum', () => expect(deriveCommunityWeight('platinum')).toBe(2));
});
