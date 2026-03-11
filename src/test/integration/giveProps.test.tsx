import { describe, it, expect, vi, beforeEach } from 'vitest';
import '../mocks/supabase';
import { mockSupabaseClient } from '../mocks/supabase';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mock AuthContext
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'current-user' },
    profile: null,
    refreshProfile: vi.fn(),
  }),
}));

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock sonner
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// Mock haptics
vi.mock('@/lib/haptics', () => ({
  hapticLight: vi.fn(),
}));

// Mock badges
vi.mock('@/lib/badges', () => ({
  checkAndAwardBadges: vi.fn().mockResolvedValue(undefined),
}));

// Mock growth
vi.mock('@/lib/growth', () => ({
  trackAnalyticsEvent: vi.fn().mockResolvedValue(undefined),
}));

// Mock personality
vi.mock('@/lib/personality', () => ({
  ERROR_STATES: { generic: 'Something went wrong' },
  CONFIRMATIONS: { propsSent: 'Props sent!' },
}));

// Mock canvas-confetti
vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

import { GivePropsFlow, PROP_TYPES } from '@/components/session/GivePropsFlow';

const mockAttendees = [
  { id: 'user-1', display_name: 'Alice Test', avatar_url: null },
  { id: 'user-2', display_name: 'Bob Test', avatar_url: null },
  { id: 'user-3', display_name: 'Carol Test', avatar_url: null },
];

describe('GivePropsFlow', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup chained mock for supabase queries
    // First call: event_rsvps query
    // Second call: profiles query
    let callCount = 0;
    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'event_rsvps') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [
                  { user_id: 'current-user' },
                  { user_id: 'user-1' },
                  { user_id: 'user-2' },
                  { user_id: 'user-3' },
                ],
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: mockAttendees,
              error: null,
            }),
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { display_name: 'Current User' },
                error: null,
              }),
            }),
          }),
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { display_name: 'Current User' },
              error: null,
            }),
          }),
        };
      }
      if (table === 'peer_props') {
        return {
          insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }
      // Default fallback
      return {
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({ data: [], error: null }),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    });

    mockSupabaseClient.rpc.mockResolvedValue({ data: null, error: null });
  });

  it('renders attendees after loading and shows 6 prop types', async () => {
    const onDone = vi.fn();
    render(<GivePropsFlow eventId="evt-1" onDone={onDone} />);

    // Wait for attendees to load
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });

    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Carol')).toBeInTheDocument();

    // Click on Alice to show prop types
    const aliceButton = screen.getByText('Alice').closest('button')!;
    fireEvent.click(aliceButton);

    // All 6 prop types should be visible
    await waitFor(() => {
      PROP_TYPES.forEach(pt => {
        expect(screen.getByText(pt.label)).toBeInTheDocument();
      });
    });

    expect(PROP_TYPES).toHaveLength(6);
  });

  it('enforces max 5 props limit', async () => {
    const onDone = vi.fn();
    render(<GivePropsFlow eventId="evt-1" onDone={onDone} />);

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });

    // Select Alice and give 5 props
    const aliceButton = screen.getByText('Alice').closest('button')!;
    fireEvent.click(aliceButton);

    await waitFor(() => {
      expect(screen.getByText('Great energy')).toBeInTheDocument();
    });

    // Click 5 prop types
    const propLabels = PROP_TYPES.slice(0, 5).map(p => p.label);
    for (const label of propLabels) {
      fireEvent.click(screen.getByText(label).closest('button')!);
    }

    // The 6th prop type button should be disabled (remaining is 0)
    const sixthPropButton = screen.getByText(PROP_TYPES[5].label).closest('button')!;
    expect(sixthPropButton).toBeDisabled();

    // Counter should show 0/5 remaining
    expect(screen.getByText('0/5 remaining')).toBeInTheDocument();
  });
});
