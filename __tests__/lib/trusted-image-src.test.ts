import { describe, expect, it } from 'vitest';
import { trustedImageSrc } from '@/lib/trusted-image-src';

describe('trustedImageSrc', () => {
  it('accepts covers from known Steam hosts', () => {
    const src = 'https://cdn.akamai.steamstatic.com/steam/apps/620/header.jpg';
    expect(trustedImageSrc(src)).toBe(src);
  });

  it('accepts paths of the app itself', () => {
    expect(trustedImageSrc('/logo.png')).toBe('/logo.png');
  });

  it.each([
    ['unknown host', 'https://tracker.example/pixel.png'],
    ['known host over http', 'http://cdn.akamai.steamstatic.com/a.jpg'],
    ['look-alike host', 'https://cdn.akamai.steamstatic.com.evil.example/a.jpg'],
    ['protocol-relative', '//tracker.example/pixel.png'],
    ['backslash protocol-relative', '/\\tracker.example/pixel.png'],
    ['javascript url', 'javascript:alert(1)'],
  ])('rejects %s', (_, src) => {
    expect(trustedImageSrc(src)).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(trustedImageSrc(null)).toBeNull();
    expect(trustedImageSrc('')).toBeNull();
  });
});
