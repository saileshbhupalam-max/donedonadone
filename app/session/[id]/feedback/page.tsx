import { FeedbackForm } from "@/components/session/feedback-form"
import { Coffee } from "lucide-react"
import Link from "next/link"

export default async function FeedbackPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <div className="min-h-svh bg-background">
      <header className="border-b border-border bg-card px-4 py-3">
        <Link href="/dashboard/bookings" className="flex items-center gap-2">
          <Coffee className="h-5 w-5 text-primary" />
          <span className="text-lg font-bold text-foreground">donedonadone</span>
        </Link>
      </header>
      <main className="mx-auto max-w-lg px-4 py-6">
        <h1 className="mb-6 text-2xl font-bold text-foreground">Rate Session</h1>
        <FeedbackForm sessionId={id} />
      </main>
    </div>
  )
}
