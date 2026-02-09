// Notification Service Abstraction
// MVP: in-app only. Later: WhatsApp via Cloud API, email via Resend

import type { Notification } from "./types"

export type NotificationType =
  | "booking_confirmed"
  | "reminder_24h"
  | "group_reveal"
  | "checkin_reminder"
  | "feedback_prompt"
  | "streak_at_risk"
  | "referral_used"
  | "subscription_expiring"

interface NotificationTemplate {
  title: string
  body: string
}

const TEMPLATES: Record<NotificationType, (data: Record<string, string>) => NotificationTemplate> = {
  booking_confirmed: (data) => ({
    title: "Booking Confirmed!",
    body: `Your session at ${data.venue} on ${data.date} is confirmed. See you there!`,
  }),
  reminder_24h: (data) => ({
    title: "Session Tomorrow!",
    body: `Your coworking session at ${data.venue} is tomorrow at ${data.time}. Get ready!`,
  }),
  group_reveal: (data) => ({
    title: "Your Group is Ready!",
    body: `Meet your coworking group for today's session at ${data.venue}. Check the app!`,
  }),
  checkin_reminder: (data) => ({
    title: "Time to Check In",
    body: `Your session at ${data.venue} has started. Check in now to unlock full profiles!`,
  }),
  feedback_prompt: (data) => ({
    title: "How Was Your Session?",
    body: `Rate your coworking session at ${data.venue}. Your feedback helps improve future matches.`,
  }),
  streak_at_risk: (data) => ({
    title: "Streak at Risk!",
    body: `You have a ${data.streak}-week streak. Book a session this week to keep it going!`,
  }),
  referral_used: (data) => ({
    title: "Referral Bonus!",
    body: `${data.name} joined using your referral code. You earned a credit!`,
  }),
  subscription_expiring: (data) => ({
    title: "Subscription Expiring Soon",
    body: `Your ${data.plan} plan expires on ${data.date}. Renew to keep your benefits.`,
  }),
}

/**
 * Create a notification record (in-app for MVP)
 */
export function buildNotification(
  userId: string,
  type: NotificationType,
  data: Record<string, string>,
  payload: Record<string, unknown> = {}
): Omit<Notification, "id" | "sent_at" | "read_at" | "created_at"> {
  const template = TEMPLATES[type](data)
  return {
    user_id: userId,
    type,
    channel: "in_app" as const,
    title: template.title,
    body: template.body,
    payload,
  }
}
