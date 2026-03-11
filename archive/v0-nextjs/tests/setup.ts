// Global test setup — runs before every test file
import { vi } from "vitest"

// Stub environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321"
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key"
process.env.CRON_SECRET = "test-cron-secret-that-is-long-enough"
process.env.NEXT_PUBLIC_UPI_VPA = "test@upi"
process.env.NEXT_PUBLIC_UPI_PAYEE_NAME = "TestPayee"

// Mock Supabase server client globally
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}))
