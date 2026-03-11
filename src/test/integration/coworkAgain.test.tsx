import { describe, it, expect, vi, beforeEach } from 'vitest';
import '../mocks/supabase';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CoworkAgainCard } from '@/components/session/CoworkAgainCard';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    button: ({ children, onClick, className, ...props }: any) => (
      <button onClick={onClick} className={className}>{children}</button>
    ),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock haptics
vi.mock('@/lib/haptics', () => ({
  hapticSuccess: vi.fn(),
}));

const groupMembers = [
  { user_id: 'self-id', display_name: 'Me', avatar_url: null },
  { user_id: 'user-2', display_name: 'Alice Johnson', avatar_url: null },
  { user_id: 'user-3', display_name: 'Bob Smith', avatar_url: null },
  { user_id: 'user-4', display_name: 'Carol White', avatar_url: null },
];

describe('CoworkAgainCard', () => {
  it('renders group members excluding self', () => {
    render(
      <CoworkAgainCard eventId="evt-1" userId="self-id" groupMembers={groupMembers} />
    );

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Carol')).toBeInTheDocument();
    // Self should not appear
    expect(screen.queryByText('Me')).not.toBeInTheDocument();
  });

  it('submit button is disabled until someone is selected', () => {
    render(
      <CoworkAgainCard eventId="evt-1" userId="self-id" groupMembers={groupMembers} />
    );

    const submitButton = screen.getByRole('button', { name: /Select someone/i });
    expect(submitButton).toBeDisabled();
  });

  it('clicking a member adds them to selection and enables submit', () => {
    render(
      <CoworkAgainCard eventId="evt-1" userId="self-id" groupMembers={groupMembers} />
    );

    // Click on Alice
    const aliceButton = screen.getByText('Alice').closest('button')!;
    fireEvent.click(aliceButton);

    // Submit button should now show count and be enabled
    const submitButton = screen.getByRole('button', { name: /Save \(1 selected\)/i });
    expect(submitButton).not.toBeDisabled();
  });

  it('after submit, shows confirmation message', async () => {
    const { mockSupabaseClient } = await import('../mocks/supabase');
    // Mock the insert chain to resolve successfully
    const insertMock = vi.fn().mockResolvedValue({ data: null, error: null });
    mockSupabaseClient.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      insert: insertMock,
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    render(
      <CoworkAgainCard eventId="evt-1" userId="self-id" groupMembers={groupMembers} />
    );

    // Select Alice
    const aliceButton = screen.getByText('Alice').closest('button')!;
    fireEvent.click(aliceButton);

    // Submit
    const submitButton = screen.getByRole('button', { name: /Save/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/We'll try to group you together next time/)).toBeInTheDocument();
    });
  });
});
