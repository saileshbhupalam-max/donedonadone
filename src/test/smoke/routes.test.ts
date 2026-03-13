import { describe, it, expect, vi } from 'vitest';
import '../mocks/supabase';

// Mock leaflet and react-leaflet to avoid ESM/CJS compatibility issues in jsdom
vi.mock('leaflet', () => {
  const IconDefault = {
    prototype: {},
    mergeOptions: vi.fn(),
  };
  const leaflet = {
    Icon: { Default: IconDefault },
    icon: vi.fn(() => ({})),
    divIcon: vi.fn(() => ({})),
    latLngBounds: vi.fn(() => ({})),
    map: vi.fn(),
    marker: vi.fn(),
    circle: vi.fn(),
  };
  return { default: leaflet, ...leaflet };
});

vi.mock('react-leaflet', () => ({
  MapContainer: vi.fn(),
  TileLayer: vi.fn(),
  Marker: vi.fn(),
  Popup: vi.fn(),
  Circle: vi.fn(),
  useMap: vi.fn(),
}));

vi.mock('leaflet/dist/leaflet.css', () => ({}));

describe('Route modules load without errors', () => {
  const routes = [
    { name: 'Index', path: '../../pages/Index' },
    { name: 'Home', path: '../../pages/Home' },
    { name: 'Events', path: '../../pages/Events' },
    { name: 'EventDetail', path: '../../pages/EventDetail' },
    { name: 'Session', path: '../../pages/Session' },
    { name: 'Profile', path: '../../pages/Profile' },
    { name: 'ProfileView', path: '../../pages/ProfileView' },
    { name: 'Onboarding', path: '../../pages/Onboarding' },
    { name: 'Discover', path: '../../pages/Discover' },
    { name: 'Prompts', path: '../../pages/Prompts' },
    { name: 'Admin', path: '../../pages/Admin' },
    { name: 'Partners', path: '../../pages/Partners' },
    { name: 'MapView', path: '../../pages/MapView' },
    { name: 'Companies', path: '../../pages/Companies' },
    { name: 'Needs', path: '../../pages/Needs' },
    { name: 'SpaceInsights', path: '../../pages/SpaceInsights' },
    { name: 'NotFound', path: '../../pages/NotFound' },
  ];

  routes.forEach(({ name, path }) => {
    it(`${name} page module imports without error`, async () => {
      const mod = await import(path);
      expect(mod).toBeDefined();
      expect(mod.default).toBeDefined();
    }, 30000);
  });
});
