import Link from "next/link"
import { Coffee, ArrowLeft } from "lucide-react"

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="mb-8 flex items-center gap-4">
        <Link href="/" className="flex items-center gap-2 text-foreground">
          <Coffee className="h-5 w-5 text-primary" />
          <span className="text-lg font-bold tracking-tight">donedonadone</span>
        </Link>
      </div>

      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" />
        Back to home
      </Link>

      <h1 className="text-3xl font-bold text-foreground">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: February 2026</p>

      <div className="mt-8 flex flex-col gap-6 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">1. Information We Collect</h2>
          <p>We collect the following types of information:</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li><strong>Account info:</strong> Name, email, phone number, work type, industry</li>
            <li><strong>Preferences:</strong> Work vibe, noise preference, communication style, social goals</li>
            <li><strong>Booking data:</strong> Sessions booked, payment history, attendance</li>
            <li><strong>Feedback:</strong> Ratings, reviews, and member ratings you submit</li>
            <li><strong>Usage data:</strong> Pages visited, feature usage for improving the product</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">2. How We Use Your Data</h2>
          <ul className="list-inside list-disc space-y-1">
            <li>Match you with compatible coworking groups</li>
            <li>Process payments and manage bookings</li>
            <li>Send session reminders and notifications</li>
            <li>Improve matching algorithms and platform quality</li>
            <li>Calculate reputation scores and streaks</li>
            <li>Communicate about your account and the Service</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">3. Data Sharing</h2>
          <p>We share limited information with:</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li><strong>Group members:</strong> Display name, work type, vibe (visible after group reveal)</li>
            <li><strong>Venue partners:</strong> Booking counts and aggregated feedback (no individual data)</li>
            <li><strong>Payment processors:</strong> Transaction details required for payment processing</li>
          </ul>
          <p className="mt-2">
            We never sell your personal data to third parties. We do not share your email, phone number,
            or detailed preferences with other users.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">4. Data Storage & Security</h2>
          <p>
            Your data is stored securely using Supabase (hosted on AWS). We use row-level security policies
            to ensure users can only access their own data. All connections are encrypted with TLS.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">5. Your Rights</h2>
          <ul className="list-inside list-disc space-y-1">
            <li><strong>Access:</strong> Request a copy of your data</li>
            <li><strong>Correction:</strong> Update inaccurate information via your profile</li>
            <li><strong>Deletion:</strong> Request account deletion (we will remove your data within 30 days)</li>
            <li><strong>Portability:</strong> Request your data in a machine-readable format</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">6. Cookies</h2>
          <p>
            We use essential cookies for authentication and session management. We do not use third-party
            tracking cookies or advertising cookies.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">7. Data Retention</h2>
          <p>
            We retain your account data as long as your account is active. After account deletion, we retain
            anonymized aggregated data (e.g., session counts) for analytics but delete all personally
            identifiable information within 30 days.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">8. Changes to This Policy</h2>
          <p>
            We may update this policy periodically. We will notify users of material changes via email.
            Continued use after changes constitutes acceptance.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">9. Contact</h2>
          <p>
            For privacy-related questions or data requests, contact us at{" "}
            <a href="mailto:privacy@donedonadone.com" className="text-primary underline">
              privacy@donedonadone.com
            </a>
          </p>
        </section>
      </div>
    </div>
  )
}
