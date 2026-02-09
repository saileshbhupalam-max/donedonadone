// Shared TypeScript interfaces — single source of truth for all entity types.
// Mirrors the Supabase schema from scripts/001_schema.sql.

export interface Profile {
  id: string
  display_name: string
  phone: string | null
  avatar_url: string | null
  user_type: "coworker" | "partner" | "admin"
  work_type: string | null
  industry: string | null
  created_at: string
  updated_at: string
}

export interface CoworkerPreferences {
  id: string
  user_id: string
  work_vibe: "deep_focus" | "casual_social" | "balanced" | null
  noise_preference: "silent" | "ambient" | "lively" | null
  break_frequency: "pomodoro" | "hourly" | "deep_stretch" | "flexible" | null
  productive_times: string[]
  social_goals: string[]
  introvert_extrovert: number | null
  communication_style: "minimal" | "moderate" | "chatty" | null
  bio: string | null
  onboarding_completed: boolean
  created_at: string
  updated_at: string
}

export interface Venue {
  id: string
  partner_id: string
  name: string
  address: string
  area: string
  lat: number | null
  lng: number | null
  venue_type: "cafe" | "coworking_space" | "other"
  amenities: string[]
  included_in_cover: string | null
  venue_rules: string | null
  max_capacity: number
  photos: string[]
  status: "pending" | "active" | "inactive"
  created_at: string
  updated_at: string
}

export interface Session {
  id: string
  venue_id: string
  date: string
  start_time: string
  end_time: string
  duration_hours: number
  platform_fee: number
  venue_price: number
  total_price: number
  max_spots: number
  spots_filled: number
  group_size: number
  status: "upcoming" | "in_progress" | "completed" | "cancelled"
  created_at: string
  updated_at: string
  // Joined
  venues?: Venue | null
}

export interface Booking {
  id: string
  user_id: string
  session_id: string
  group_id: string | null
  payment_amount: number
  payment_status: "pending" | "payment_pending" | "paid" | "confirmed" | "refunded" | "cancelled"
  payment_reference: string | null
  checked_in: boolean
  checked_in_at: string | null
  cancelled_at: string | null
  created_at: string
  // Joined
  sessions?: Session | null
  profiles?: Profile | null
}

export interface Group {
  id: string
  session_id: string
  group_number: number
  table_assignment: string | null
  created_at: string
  // Joined
  group_members?: GroupMember[]
}

export interface GroupMember {
  group_id: string
  user_id: string
  // Joined
  profiles?: Profile | null
  coworker_preferences?: CoworkerPreferences | null
}

export interface SessionFeedback {
  id: string
  booking_id: string
  user_id: string
  session_id: string
  overall_rating: number
  tags: string[]
  comment: string | null
  created_at: string
}

export interface MemberRating {
  id: string
  from_user: string
  to_user: string
  session_id: string
  would_cowork_again: boolean
  tags: string[]
  energy_match: number | null
  created_at: string
}

// Limited profile shown before check-in (information asymmetry)
export interface LimitedProfile {
  display_name: string  // First name only
  work_vibe: string | null
  avatar_url: string | null
}

// User stats (non-portable value)
export interface UserStats {
  sessions_completed: number
  unique_coworkers: number
  venues_visited: number
  avg_rating_received: number
  hours_focused: number
  member_since: string
}

// Streak tracking
export interface UserStreak {
  user_id: string
  current_streak: number
  longest_streak: number
  last_session_week: string | null
  streak_frozen: boolean
  updated_at: string
}

// Session goals (accountability hook)
export interface SessionGoal {
  id: string
  booking_id: string
  user_id: string
  session_id: string
  goal_text: string
  completed: boolean
  created_at: string
}

// Reputation / Coworker Score
export interface UserReputation {
  score: number
  attendance: number
  cowork_again_rate: number
  avg_energy: number
  session_score: number
  streak_score: number
  feedback_score: number
  total_ratings: number
  sessions_completed: number
}

// Subscription plans
export interface SubscriptionPlan {
  id: string
  name: string
  price: number
  sessions_per_month: number | null
  features: {
    priority_matching: boolean
    streak_freezes: number
    exclusive_venues: boolean
  }
  active: boolean
  created_at: string
}

export interface UserSubscription {
  id: string
  user_id: string
  plan_id: string
  status: "active" | "paused" | "cancelled" | "expired"
  current_period_start: string
  current_period_end: string
  sessions_used: number
  created_at: string
  updated_at: string
  // Joined
  subscription_plans?: SubscriptionPlan | null
}

// Referrals
export interface ReferralCode {
  id: string
  user_id: string
  code: string
  uses: number
  created_at: string
}

export interface ReferralEvent {
  id: string
  referrer_id: string
  referred_id: string
  code: string
  credit_amount: number
  created_at: string
}

// Favorites
export interface FavoriteCoworker {
  id: string
  user_id: string
  favorite_user_id: string
  created_at: string
  // Joined
  profiles?: Profile | null
}

// Notifications
export interface Notification {
  id: string
  user_id: string
  type: string
  channel: "in_app" | "whatsapp" | "email"
  title: string
  body: string | null
  payload: Record<string, unknown>
  sent_at: string | null
  read_at: string | null
  created_at: string
}

// Venue quality score
export interface VenueScore {
  score: number
  wifi: number
  ambiance: number
  fnb: number
  service: number
  power: number
  noise: number
  cleanliness: number
  total_reviews: number
}
