import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Coffee, Mail } from 'lucide-react'
import Link from 'next/link'

export default function Page() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center bg-background p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col items-center gap-2">
            <Link href="/" className="flex items-center gap-2 text-foreground">
              <Coffee className="h-6 w-6 text-primary" />
              <span className="text-xl font-bold tracking-tight">donedonadone</span>
            </Link>
          </div>
          <Card className="border-border">
            <CardHeader className="text-center">
              <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Mail className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-2xl text-foreground">
                Check your email
              </CardTitle>
              <CardDescription>
                We sent you a confirmation link
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-center text-sm leading-relaxed text-muted-foreground">
                Click the link in your email to confirm your account, then come back and sign in to start coworking.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
