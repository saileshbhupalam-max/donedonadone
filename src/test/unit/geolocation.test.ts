import { describe, it, expect } from 'vitest';
import { haversineDistance } from '@/hooks/useGeolocation';

describe('haversineDistance', () => {
  it('returns 0 for same coordinates', () => {
    expect(haversineDistance(12.9141, 77.6389, 12.9141, 77.6389)).toBe(0);
  });

  it('calculates correct distance for known points', () => {
    // HSR Layout to Koramangala (~2.5km)
    const distance = haversineDistance(12.9141, 77.6389, 12.9352, 77.6245);
    expect(distance).toBeGreaterThan(2000);
    expect(distance).toBeLessThan(3000);
  });

  it('calculates short distance correctly', () => {
    // Two points ~100m apart
    const distance = haversineDistance(12.9141, 77.6389, 12.9150, 77.6389);
    expect(distance).toBeGreaterThan(90);
    expect(distance).toBeLessThan(110);
  });

  it('handles antipodal points', () => {
    const distance = haversineDistance(0, 0, 0, 180);
    // Should be ~half circumference of Earth (~20015km)
    expect(distance).toBeGreaterThan(20000000);
    expect(distance).toBeLessThan(20100000);
  });

  it('is symmetric', () => {
    const d1 = haversineDistance(12.9141, 77.6389, 12.9352, 77.6245);
    const d2 = haversineDistance(12.9352, 77.6245, 12.9141, 77.6389);
    expect(Math.abs(d1 - d2)).toBeLessThan(0.01);
  });
});
