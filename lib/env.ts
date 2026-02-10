// Runtime environment variable validation
// Validates required env vars at startup to fail fast

const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
] as const

const optional = [
  "CRON_SECRET",
  "NEXT_PUBLIC_UPI_VPA",
  "NEXT_PUBLIC_UPI_PAYEE_NAME",
  "NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL",
] as const

type RequiredKey = (typeof required)[number]
type OptionalKey = (typeof optional)[number]

function getEnv(key: RequiredKey): string {
  const value = process.env[key]
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return value
}

function getOptionalEnv(key: OptionalKey, fallback: string = ""): string {
  return process.env[key] || fallback
}

export const env = {
  SUPABASE_URL: getEnv("NEXT_PUBLIC_SUPABASE_URL"),
  SUPABASE_ANON_KEY: getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  CRON_SECRET: getOptionalEnv("CRON_SECRET"),
  UPI_VPA: getOptionalEnv("NEXT_PUBLIC_UPI_VPA", "donedonadone@upi"),
  UPI_PAYEE_NAME: getOptionalEnv("NEXT_PUBLIC_UPI_PAYEE_NAME", "donedonadone"),
} as const
