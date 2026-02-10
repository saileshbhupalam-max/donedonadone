import Link from "next/link"
import { Coffee, ArrowLeft } from "lucide-react"

export default function TermsPage() {
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

      <h1 className="text-3xl font-bold text-foreground">Terms of Service</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: February 2026</p>

      <div className="mt-8 flex flex-col gap-6 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">1. Acceptance of Terms</h2>
          <p>
            By accessing or using the donedonadone platform (&quot;Service&quot;), you agree to be bound by these
            Terms of Service. If you do not agree, do not use the Service. You must be at least 18 years old
            to use this Service.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">2. Service Description</h2>
          <p>
            donedonadone is a group coworking platform that matches solo workers into small groups (3-5 people)
            at partner cafes and coworking spaces. We facilitate session bookings, group matching, and
            venue coordination.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">3. User Accounts</h2>
          <p>
            You are responsible for maintaining the confidentiality of your account credentials. You must provide
            accurate information and keep it up to date. You may not create multiple accounts or impersonate
            others.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">4. Bookings & Payments</h2>
          <p>
            All session prices are displayed inclusive of applicable taxes (GST at 18%). Payments are processed
            via UPI. Bookings are confirmed only after successful payment. Refund eligibility depends on the
            cancellation time — cancellations more than 2 hours before a session start time are eligible for a
            full refund; later cancellations may not be refunded.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">5. Code of Conduct</h2>
          <p>
            Users must behave respectfully toward other coworkers and venue staff. Harassment, discrimination,
            or disruptive behavior will result in account suspension. You agree not to use the platform for any
            illegal purposes.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">6. Venue Policies</h2>
          <p>
            Each partner venue may have its own house rules regarding noise levels, food orders, and workspace
            usage. Users must comply with venue-specific policies during their sessions.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">7. Intellectual Property</h2>
          <p>
            The donedonadone name, logo, and platform content are our property. Your content (reviews, feedback)
            may be used on the platform. You retain ownership of your work done during coworking sessions.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">8. Limitation of Liability</h2>
          <p>
            donedonadone facilitates coworking connections but is not responsible for interactions between
            users, venue conditions, or personal belongings. We are not liable for indirect, incidental, or
            consequential damages arising from use of the Service.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">9. Changes to Terms</h2>
          <p>
            We may update these terms from time to time. Continued use of the Service after changes constitutes
            acceptance of the updated terms. We will notify users of material changes via email.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">10. Contact</h2>
          <p>
            For questions about these terms, contact us at{" "}
            <a href="mailto:hello@donedonadone.com" className="text-primary underline">
              hello@donedonadone.com
            </a>
          </p>
        </section>
      </div>
    </div>
  )
}
