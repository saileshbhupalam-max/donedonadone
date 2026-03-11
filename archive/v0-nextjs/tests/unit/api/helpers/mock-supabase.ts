// Chainable Supabase mock for API route testing
import { vi } from "vitest"

type MockResult = { data: unknown; error: unknown }

/**
 * Creates a chainable Supabase query builder mock.
 * Usage:
 *   const { supabase, mockQuery } = createMockSupabase()
 *   mockQuery("bookings", { data: [{ id: "1" }], error: null })
 */
export function createMockSupabase() {
  const queryResults = new Map<string, MockResult>()
  const rpcResults = new Map<string, MockResult>()
  let authUser: { id: string; email?: string } | null = null

  function setAuthUser(user: { id: string; email?: string } | null) {
    authUser = user
  }

  function mockQuery(table: string, result: MockResult) {
    queryResults.set(table, result)
  }

  function mockRpc(name: string, result: MockResult) {
    rpcResults.set(name, result)
  }

  function createChain(table: string) {
    const result = queryResults.get(table) || { data: null, error: null }
    const chain: Record<string, unknown> = {}

    const methods = [
      "select", "insert", "update", "delete", "upsert",
      "eq", "neq", "in", "is", "gt", "gte", "lt", "lte",
      "like", "ilike", "or", "not", "filter",
      "order", "limit", "range", "count",
    ]

    for (const method of methods) {
      chain[method] = vi.fn().mockReturnValue(chain)
    }

    // Terminal methods resolve the mock data
    chain.single = vi.fn().mockResolvedValue(result)
    chain.maybeSingle = vi.fn().mockResolvedValue(result)
    chain.then = (resolve: (val: MockResult) => void) => resolve(result)

    // Make the chain itself thenable (for `await supabase.from(...).select(...)`)
    Object.defineProperty(chain, "then", {
      value: (resolve: (val: MockResult) => void) => {
        Promise.resolve(result).then(resolve)
      },
      writable: true,
      configurable: true,
    })

    return chain
  }

  const supabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: authUser },
      }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    from: vi.fn((table: string) => createChain(table)),
    rpc: vi.fn((name: string, params?: Record<string, unknown>) => {
      const result = rpcResults.get(name) || { data: null, error: null }
      return Promise.resolve(result)
    }),
  }

  // Dynamic auth.getUser — re-reads authUser each call
  supabase.auth.getUser = vi.fn(async () => ({
    data: { user: authUser },
  }))

  return {
    supabase,
    setAuthUser,
    mockQuery,
    mockRpc,
  }
}

/**
 * Creates a NextRequest-like object for testing API routes.
 */
export function createMockRequest(options: {
  method?: string
  body?: unknown
  headers?: Record<string, string>
  url?: string
} = {}) {
  const { method = "GET", body, headers = {}, url = "http://localhost:3000" } = options

  return new Request(url, {
    method,
    headers: new Headers(headers),
    body: body ? JSON.stringify(body) : undefined,
  })
}
