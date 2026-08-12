import { describe, expect, it } from 'vitest';
import { getHeaderBandGeometry } from '@/utils/insets';

describe('getHeaderBandGeometry (upstream readest #5303, fork 44px floor)', () => {
  it('is the classic strip below the safe area at the default margin', () => {
    // desktop: no grid inset, 44px margin
    expect(getHeaderBandGeometry(0, 44, 44)).toEqual({ top: 0, height: 44, bottom: 44 });
    // notched device: band starts below the inset
    expect(getHeaderBandGeometry(47, 44, 44)).toEqual({ top: 47, height: 44, bottom: 91 });
  });

  it('follows the margin when it grows, keeping the band glued to the content top', () => {
    const band = getHeaderBandGeometry(0, 64, 44);
    expect(band).toEqual({ top: 0, height: 64, bottom: 64 });
    // content top = max(inset + margin, 44) -> band bottom must match
    expect(getHeaderBandGeometry(24, 64, 44).bottom).toBe(88);
  });

  it('lifts into the notch on a smaller margin instead of shrinking below 44px', () => {
    const band = getHeaderBandGeometry(0, 20, 44);
    expect(band.height).toBe(44);
    expect(band.top).toBe(0);
    expect(band.bottom).toBe(44);

    // with an inset, the band slides up but never above the screen top
    const notched = getHeaderBandGeometry(47, 20, 44);
    expect(notched.height).toBe(44);
    expect(notched.top).toBe(23);
    expect(notched.bottom).toBe(67);
  });

  it('caps the lift at the screen top for negative margins', () => {
    const band = getHeaderBandGeometry(47, -20, 44);
    expect(band.top).toBe(0);
    expect(band.height).toBe(44);
  });

  it('keeps the upstream 16px floor as the default minHeight', () => {
    expect(getHeaderBandGeometry(45, 20)).toEqual({ top: 45, height: 20, bottom: 65 });
    expect(getHeaderBandGeometry(45, -20)).toEqual({ top: 9, height: 16, bottom: 25 });
  });
});
