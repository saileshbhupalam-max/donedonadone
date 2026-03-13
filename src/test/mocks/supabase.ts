import { vi } from 'vitest';

export const mockSupabaseClient = {
  auth: {
    getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user-id', email: 'test@example.com' } }, error: null }),
    getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'test-token' } }, error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
  },
  from: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  }),
  rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  channel: vi.fn().mockReturnValue({
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
  }),
  removeChannel: vi.fn(),
};

vi.mock('@/integrations/supabase/client', () => ({
  supabase: mockSupabaseClient,
}));
