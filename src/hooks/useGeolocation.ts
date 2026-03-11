import { useState, useCallback } from 'react';

export type GeoStatus = 'idle' | 'loading' | 'success' | 'denied' | 'unavailable' | 'timeout' | 'error';

interface GeoPosition {
  latitude: number;
  longitude: number;
  accuracy: number;
}

interface UseGeolocationReturn {
  status: GeoStatus;
  position: GeoPosition | null;
  error: string | null;
  requestPosition: () => Promise<GeoPosition | null>;
}

export function useGeolocation(): UseGeolocationReturn {
  const [status, setStatus] = useState<GeoStatus>('idle');
  const [position, setPosition] = useState<GeoPosition | null>(null);
  const [error, setError] = useState<string | null>(null);

  const requestPosition = useCallback((): Promise<GeoPosition | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        setStatus('unavailable');
        setError('Geolocation is not supported by your browser');
        resolve(null);
        return;
      }

      setStatus('loading');
      setError(null);

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const geoPos: GeoPosition = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          };
          setPosition(geoPos);
          setStatus('success');
          resolve(geoPos);
        },
        (err) => {
          switch (err.code) {
            case err.PERMISSION_DENIED:
              setStatus('denied');
              setError('Location access denied. Please enable location in your browser settings.');
              break;
            case err.POSITION_UNAVAILABLE:
              setStatus('unavailable');
              setError('Location unavailable. Please try again.');
              break;
            case err.TIMEOUT:
              setStatus('timeout');
              setError('Location request timed out. Please try again.');
              break;
            default:
              setStatus('error');
              setError('Could not determine your location.');
          }
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000,
        }
      );
    });
  }, []);

  return { status, position, error, requestPosition };
}

// Haversine distance calculation (meters)
export function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}
