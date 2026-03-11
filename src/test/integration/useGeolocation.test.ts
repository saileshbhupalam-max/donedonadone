import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGeolocation } from '@/hooks/useGeolocation';

describe('useGeolocation', () => {
  let mockGetCurrentPosition: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockGetCurrentPosition = vi.fn();
    Object.defineProperty(navigator, 'geolocation', {
      value: {
        getCurrentPosition: mockGetCurrentPosition,
        watchPosition: vi.fn(),
        clearWatch: vi.fn(),
      },
      writable: true,
      configurable: true,
    });
  });

  it('initial status is "idle"', () => {
    const { result } = renderHook(() => useGeolocation());
    expect(result.current.status).toBe('idle');
    expect(result.current.position).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('returns "unavailable" when geolocation is not supported', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useGeolocation());

    await act(async () => {
      await result.current.requestPosition();
    });

    expect(result.current.status).toBe('unavailable');
    expect(result.current.error).toBe('Geolocation is not supported by your browser');
  });

  it('returns "denied" on permission denied error', async () => {
    mockGetCurrentPosition.mockImplementation((_success: any, error: any) => {
      error({ code: 1, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 });
    });

    const { result } = renderHook(() => useGeolocation());

    await act(async () => {
      await result.current.requestPosition();
    });

    expect(result.current.status).toBe('denied');
    expect(result.current.error).toContain('denied');
  });

  it('returns position on success', async () => {
    mockGetCurrentPosition.mockImplementation((success: any) => {
      success({
        coords: { latitude: 12.9716, longitude: 77.5946, accuracy: 10 },
      });
    });

    const { result } = renderHook(() => useGeolocation());

    let pos: any;
    await act(async () => {
      pos = await result.current.requestPosition();
    });

    expect(result.current.status).toBe('success');
    expect(result.current.position).toEqual({
      latitude: 12.9716,
      longitude: 77.5946,
      accuracy: 10,
    });
    expect(pos).toEqual({
      latitude: 12.9716,
      longitude: 77.5946,
      accuracy: 10,
    });
  });

  it('returns "timeout" on timeout error', async () => {
    mockGetCurrentPosition.mockImplementation((_success: any, error: any) => {
      error({ code: 3, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 });
    });

    const { result } = renderHook(() => useGeolocation());

    await act(async () => {
      await result.current.requestPosition();
    });

    expect(result.current.status).toBe('timeout');
    expect(result.current.error).toContain('timed out');
  });
});
