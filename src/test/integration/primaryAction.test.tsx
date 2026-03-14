import { describe, it, expect, vi, beforeEach } from 'vitest';
import '../mocks/supabase';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { PrimaryActionCard } from '@/components/home/PrimaryActionCard';

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock AddToCalendarButton since it has complex dropdown logic
vi.mock('@/components/session/AddToCalendarButton', () => ({
  AddToCalendarButton: () => <button>Add to Calendar</button>,
}));

function renderWithRouter(ui: React.ReactElement) {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
}

describe('PrimaryActionCard', () => {
  const baseMeetup = {
    id: 'session-1',
    title: 'Morning Focus',
    date: '2025-06-15',
    start_time: '10:00',
    end_time: '12:00',
    venue_name: 'Cafe Mocha',
    goingCount: 3,
  };

  it('returns null for feedback type (handled elsewhere)', () => {
    const pendingFeedback = [{ id: 'fb-1', title: 'Past Session', date: '2025-06-10' }];
    const { container } = renderWithRouter(
      <PrimaryActionCard
        nextMeetup={baseMeetup}
        pendingFeedback={pendingFeedback}
        upcomingEvent={null}
      />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders active session card when session is in progress', () => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    // Session started 30 minutes ago
    const startHour = now.getHours();
    const startMin = now.getMinutes() > 30 ? now.getMinutes() - 30 : 0;
    const start_time = `${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}`;

    const activeMeetup = {
      ...baseMeetup,
      date: today,
      start_time,
    };

    renderWithRouter(
      <PrimaryActionCard
        nextMeetup={activeMeetup}
        pendingFeedback={[]}
        upcomingEvent={null}
      />
    );

    expect(screen.getByText('Session is live!')).toBeInTheDocument();
    expect(screen.getByText('Morning Focus')).toBeInTheDocument();
    expect(screen.getByText(/Check in/)).toBeInTheDocument();
  });

  it('renders today card when session is today but not yet active', () => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    // Session starts in 2 hours
    const futureHour = (now.getHours() + 2) % 24;
    const start_time = `${String(futureHour).padStart(2, '0')}:00`;

    const todayMeetup = {
      ...baseMeetup,
      date: today,
      start_time,
    };

    renderWithRouter(
      <PrimaryActionCard
        nextMeetup={todayMeetup}
        pendingFeedback={[]}
        upcomingEvent={null}
      />
    );

    expect(screen.getByText('Today!')).toBeInTheDocument();
    expect(screen.getByText('Morning Focus')).toBeInTheDocument();
  });

  it('renders upcoming card when next session is in the future', () => {
    const futureMeetup = {
      ...baseMeetup,
      date: '2099-12-25',
      start_time: '10:00',
    };

    renderWithRouter(
      <PrimaryActionCard
        nextMeetup={futureMeetup}
        pendingFeedback={[]}
        upcomingEvent={null}
      />
    );

    expect(screen.getByText('Your next session')).toBeInTheDocument();
    expect(screen.getByText('Morning Focus')).toBeInTheDocument();
  });

  it('renders find session card when no nextMeetup and upcomingEvent exists', () => {
    const upcomingEvent = { id: 'evt-1', title: 'Friday Cowork', goingCount: 5 };

    renderWithRouter(
      <PrimaryActionCard
        nextMeetup={null}
        pendingFeedback={[]}
        upcomingEvent={upcomingEvent}
      />
    );

    expect(screen.getByText("Don't miss out")).toBeInTheDocument();
    expect(screen.getByText('Friday Cowork')).toBeInTheDocument();
    expect(screen.getByText('5 going')).toBeInTheDocument();
  });

  it('renders browse sessions when no nextMeetup and no upcomingEvent', () => {
    renderWithRouter(
      <PrimaryActionCard
        nextMeetup={null}
        pendingFeedback={[]}
        upcomingEvent={null}
      />
    );

    expect(screen.getByText("You haven't booked yet this week")).toBeInTheDocument();
    expect(screen.getByText(/Find your table/)).toBeInTheDocument();
  });
});
