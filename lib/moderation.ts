// Simple content moderation filter for user-generated text
// This is a basic blocklist — replace with an AI-based filter in production

const BLOCKED_PATTERNS = [
  // Slurs and hate speech patterns (keeping it minimal and generic)
  /\b(fuck|shit|ass|damn|bitch|dick|cock|pussy|cunt|fag|retard|nigger|kike|chink|spic)\b/gi,
  // Contact info in feedback/bios (prevent disintermediation)
  /\b\d{10,}\b/, // phone numbers
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i, // email addresses
  // URLs
  /https?:\/\/\S+/gi,
  // WhatsApp/Telegram links
  /wa\.me|t\.me|chat\.whatsapp/gi,
]

export function moderateText(text: string): { clean: boolean; reason?: string } {
  if (!text || text.trim().length === 0) {
    return { clean: true }
  }

  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(text)) {
      // Reset regex lastIndex for global patterns
      pattern.lastIndex = 0
      return { clean: false, reason: "Content contains prohibited words or patterns" }
    }
  }

  return { clean: true }
}

export function sanitizeDisplayName(name: string): string {
  // Remove any HTML tags
  return name.replace(/<[^>]*>/g, "").trim().slice(0, 50)
}
