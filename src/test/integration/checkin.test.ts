import { describe, it, expect } from 'vitest';
import { haversineDistance } from '@/hooks/useGeolocation';

// Test the check-in logic without Supabase
describe('Check-in logic', () => {
  const venueCoords = { lat: 12.9141, lng: 77.6389 }; // HSR Layout
  const radius = 200; // meters

  it('allows check-in within radius', () => {
    // ~50m away
    const userCoords = { lat: 12.9145, lng: 77.6389 };
    const distance = haversineDistance(userCoords.lat, userCoords.lng, venueCoords.lat, venueCoords.lng);
    expect(distance).toBeLessThan(radius);
  });

  it('rejects check-in outside radius', () => {
    // ~1km away
    const userCoords = { lat: 12.9241, lng: 77.6389 };
    const distance = haversineDistance(userCoords.lat, userCoords.lng, venueCoords.lat, venueCoords.lng);
    expect(distance).toBeGreaterThan(radius);
  });

  it('allows check-in at exact venue location', () => {
    const distance = haversineDistance(venueCoords.lat, venueCoords.lng, venueCoords.lat, venueCoords.lng);
    expect(distance).toBe(0);
  });

  it('handles boundary case (exactly at radius)', () => {
    // Calculate a point exactly ~200m north
    const latOffset = 200 / 111320; // ~0.001797 degrees
    const userCoords = { lat: venueCoords.lat + latOffset, lng: venueCoords.lng };
    const distance = haversineDistance(userCoords.lat, userCoords.lng, venueCoords.lat, venueCoords.lng);
    expect(distance).toBeCloseTo(200, -1); // within 10m tolerance
  });
});
