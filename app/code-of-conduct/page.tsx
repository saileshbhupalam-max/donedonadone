import Link from "next/link"
import { Coffee, ArrowLeft } from "lucide-react"

export default function CodeOfConductPage() {
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

      <h1 className="text-3xl font-bold text-foreground">Code of Conduct</h1>
      <p className="mt-2 text-sm text-muted-foreground">For all donedonadone coworking sessions</p>

      <div className="mt-8 flex flex-col gap-6 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">Our Pledge</h2>
          <p>
            donedonadone is a community of solo workers who come together to be more productive. We are
            committed to providing a welcoming, safe, and respectful environment for everyone regardless of
            background, gender, orientation, disability, appearance, or identity.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">Expected Behavior</h2>
          <ul className="list-inside list-disc space-y-1">
            <li>Be respectful and considerate of your group members</li>
            <li>Keep noise levels appropriate for the agreed session vibe</li>
            <li>Show up on time for your booked sessions</li>
            <li>Respect personal boundaries and workspace</li>
            <li>Order from the venue (they are our partners)</li>
            <li>Leave the space tidy when you leave</li>
            <li>Give honest, constructive feedback</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">Unacceptable Behavior</h2>
          <ul className="list-inside list-disc space-y-1">
            <li>Harassment, intimidation, or discrimination of any kind</li>
            <li>Unwanted physical contact or sexual attention</li>
            <li>Disrupting others who are trying to work</li>
            <li>Taking photos or recordings without consent</li>
            <li>Soliciting personal information (phone, email) to bypass the platform</li>
            <li>Hate speech, slurs, or offensive language</li>
            <li>Damage to venue property</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">Reporting</h2>
          <p>
            If you experience or witness unacceptable behavior, please report it through the app (via the
            session feedback form or the report button on member profiles). All reports are reviewed by our
            team within 24 hours. Reports are confidential.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">Consequences</h2>
          <ul className="list-inside list-disc space-y-1">
            <li><strong>First offense:</strong> Warning via email</li>
            <li><strong>Second offense:</strong> Temporary suspension (1-4 weeks)</li>
            <li><strong>Severe/repeated violations:</strong> Permanent ban</li>
          </ul>
          <p className="mt-2">
            Severe violations (harassment, threats, violence) will result in immediate permanent ban.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">Contact</h2>
          <p>
            For questions about the code of conduct, reach us at{" "}
            <a href="mailto:safety@donedonadone.com" className="text-primary underline">
              safety@donedonadone.com
            </a>
          </p>
        </section>
      </div>
    </div>
  )
}
