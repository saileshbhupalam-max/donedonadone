'use client'

import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import Link from 'next/link'
import { useState } from 'react'
import { Coffee, Mail, RefreshCw } from 'lucide-react'

export default function VerifyEmailPage() {
  const [resent, setResent] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleResend = async () => {
    setIsLoading(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.email) {
        await supabase.auth.resend({
          type: 'signup',
          email: user.email,
        })
        setResent(true)
      }
    } finally {
      setIsLoading(false)
    }
  }

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
              <CardTitle className="text-2xl">Verify your email</CardTitle>
              <CardDescription>
                We sent a verification link to your email. Please check your inbox and click the link to continue.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              {resent ? (
                <p className="text-sm text-green-600">Verification email resent! Check your inbox.</p>
              ) : (
                <Button
                  variant="outline"
                  onClick={handleResend}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Resend verification email
                </Button>
              )}
              <p className="text-xs text-muted-foreground">
                Already verified?{' '}
                <Link
                  href="/dashboard"
                  className="text-primary underline underline-offset-4"
                >
                  Go to dashboard
                </Link>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
