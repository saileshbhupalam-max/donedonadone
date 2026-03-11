import { describe, it, expect, vi, beforeEach } from 'vitest';
import '../mocks/supabase';

// Mock AuthContext before importing the component
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user' },
    profile: null,
    refreshProfile: vi.fn(),
  }),
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// Mock personality module
vi.mock('@/lib/personality', () => ({
  CONFIRMATIONS: { profileSaved: 'Saved!' },
}));

// Mock lazy-loaded LocationPicker
vi.mock('@/components/map/LocationPicker', () => ({
  LocationPicker: () => <div data-testid="location-picker">Map</div>,
}));

// Mock TagInput
vi.mock('@/components/onboarding/TagInput', () => ({
  TagInput: () => <div data-testid="tag-input">Tags</div>,
}));

import { render, screen } from '@testing-library/react';

// We test the getPromptType logic by rendering the component with different profiles
// The component is tightly coupled to its internal logic, so we test via rendering

import { ProfilePromptCard } from '@/components/home/ProfilePromptCard';

function makeProfile(overrides: Record<string, any> = {}) {
  return {
    id: 'test-user',
    display_name: 'Test User',
    avatar_url: null,
    user_type: 'member',
    events_attended: 0,
    noise_preference: null,
    communication_style: null,
    preferred_latitude: null,
    preferred_longitude: null,
    preferred_radius_km: null,
    preferred_days: null,
    preferred_times: null,
    preferred_session_duration: null,
    interests: null,
    linkedin_url: null,
    instagram_handle: null,
    twitter_handle: null,
    phone: null,
    is_welcome_buddy: false,
    work_vibe: null,
    gender: null,
    onboarding_completed: true,
    created_at: '2025-01-01',
    updated_at: '2025-01-01',
    ...overrides,
  } as any;
}

describe('ProfilePromptCard', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when events_attended = 0', () => {
    const profile = makeProfile({ events_attended: 0 });
    const { container } = render(<ProfilePromptCard profile={profile} />);
    expect(container.innerHTML).toBe('');
  });

  it('shows work-style prompt after 1 session if noise_preference is null', () => {
    const profile = makeProfile({ events_attended: 1, noise_preference: null });
    render(<ProfilePromptCard profile={profile} />);
    expect(screen.getByText(/how do you like your workspace/i)).toBeInTheDocument();
    expect(screen.getByText('Noise preference')).toBeInTheDocument();
  });

  it('shows location prompt after 1 session if preferred_latitude is null and noise set', () => {
    const profile = makeProfile({
      events_attended: 1,
      noise_preference: 'low_hum',
      preferred_latitude: null,
    });
    render(<ProfilePromptCard profile={profile} />);
    expect(screen.getByText(/sessions near you/i)).toBeInTheDocument();
  });

  it('shows schedule prompt after 2 sessions if preferred_days is empty', () => {
    const profile = makeProfile({
      events_attended: 2,
      noise_preference: 'low_hum',
      preferred_latitude: 12.9,
      preferred_days: [],
    });
    render(<ProfilePromptCard profile={profile} />);
    expect(screen.getByText(/when do you like to work/i)).toBeInTheDocument();
  });

  it('shows buddy prompt after 3 sessions if is_welcome_buddy is false', () => {
    const profile = makeProfile({
      events_attended: 3,
      noise_preference: 'low_hum',
      preferred_latitude: 12.9,
      preferred_days: ['monday'],
      interests: ['coding'],
      linkedin_url: 'https://linkedin.com/in/test',
      is_welcome_buddy: false,
    });
    render(<ProfilePromptCard profile={profile} />);
    expect(screen.getByText(/welcome first-timers/i)).toBeInTheDocument();
  });
});
