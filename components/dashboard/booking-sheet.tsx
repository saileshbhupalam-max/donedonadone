"use client"

import { useState } from "react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  CalendarDays,
  Clock,
  MapPin,
  Check,
  QrCode,
  ArrowLeft,
  Loader2,
} from "lucide-react"

const PLATFORM_FEE = 100

type Step = "confirm" | "payment" | "success"

interface BookingSheetProps {
  session: {
    id: string
    title: string
    description: string
    session_date: string
    start_time: string
    end_time: string
    max_participants: number
    current_participants: number
    vibe: string
    price: number
    venues: {
      name: string
      address: string
      city: string
    } | null
  }
  open: boolean
  onClose: () => void
  onConfirm: () => Promise<unknown>
}

export function BookingSheet({
  session,
  open,
  onClose,
  onConfirm,
}: BookingSheetProps) {
  const [step, setStep] = useState<Step>("confirm")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const price = Number(session.price)
  const venueFee = Math.max(price - PLATFORM_FEE, 0)

  const handleClose = () => {
    setStep("confirm")
    setError(null)
    setLoading(false)
    onClose()
  }

  const handleConfirm = async () => {
    setLoading(true)
    setError(null)
    try {
      await onConfirm()
      setStep("payment")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Booking failed")
    } finally {
      setLoading(false)
    }
  }

  const handleMarkPaid = () => {
    setStep("success")
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && handleClose()}>
      <SheetContent className="flex flex-col overflow-y-auto sm:max-w-md">
        {step === "confirm" && (
          <>
            <SheetHeader>
              <SheetTitle className="text-foreground">
                Confirm Booking
              </SheetTitle>
              <SheetDescription>
                Review the session details before booking
              </SheetDescription>
            </SheetHeader>

            <div className="mt-6 flex flex-1 flex-col gap-5">
              {/* Session info */}
              <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
                <h3 className="font-semibold text-foreground">
                  {session.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {session.description}
                </p>

                <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                  {session.venues && (
                    <span className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 shrink-0" />
                      <span>
                        {session.venues.name}, {session.venues.address}
                      </span>
                    </span>
                  )}
                  <span className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4" />
                    {new Date(session.session_date).toLocaleDateString(
                      "en-IN",
                      {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      }
                    )}
                  </span>
                  <span className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    {session.start_time?.slice(0, 5)} -{" "}
                    {session.end_time?.slice(0, 5)}
                  </span>
                </div>
              </div>

              {/* Price breakdown */}
              <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
                <h4 className="text-sm font-medium text-foreground">
                  Price Breakdown
                </h4>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Platform fee</span>
                  <span>{"₹"}{PLATFORM_FEE}</span>
                </div>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Venue charge</span>
                  <span>{"₹"}{venueFee.toFixed(0)}</span>
                </div>
                <div className="border-t border-border pt-2">
                  <div className="flex items-center justify-between font-semibold text-foreground">
                    <span>Total</span>
                    <span className="text-lg">{"₹"}{price.toFixed(0)}</span>
                  </div>
                </div>
              </div>

              {error && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              {/* Actions */}
              <div className="mt-auto flex flex-col gap-2 pt-4">
                <Button onClick={handleConfirm} disabled={loading}>
                  {loading && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Confirm & Proceed to Pay
                </Button>
                <Button variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
              </div>
            </div>
          </>
        )}

        {step === "payment" && (
          <>
            <SheetHeader>
              <SheetTitle className="text-foreground">
                Complete Payment
              </SheetTitle>
              <SheetDescription>
                Scan the UPI QR code to pay {"₹"}{price.toFixed(0)}
              </SheetDescription>
            </SheetHeader>

            <div className="mt-6 flex flex-1 flex-col items-center gap-6">
              {/* UPI QR mock */}
              <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card p-6">
                <div className="flex h-48 w-48 items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted">
                  <div className="flex flex-col items-center gap-2">
                    <QrCode className="h-16 w-16 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      UPI QR Code
                    </span>
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground">
                    {"₹"}{price.toFixed(0)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Pay to: donedonadone@upi
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-center gap-1 text-center">
                <p className="text-sm font-medium text-foreground">
                  Waiting for payment...
                </p>
                <p className="text-xs text-muted-foreground">
                  After scanning, click below to confirm
                </p>
              </div>

              <Badge variant="outline" className="border-border text-muted-foreground">
                Session: {session.title}
              </Badge>

              {/* Actions */}
              <div className="mt-auto flex w-full flex-col gap-2 pt-4">
                <Button onClick={handleMarkPaid} className="w-full">
                  I have paid
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setStep("confirm")}
                  className="text-muted-foreground"
                >
                  <ArrowLeft className="mr-1 h-3.5 w-3.5" />
                  Back
                </Button>
              </div>
            </div>
          </>
        )}

        {step === "success" && (
          <>
            <SheetHeader>
              <SheetTitle className="text-foreground">
                Booking Confirmed
              </SheetTitle>
              <SheetDescription>
                {"You're"} all set for your coworking session
              </SheetDescription>
            </SheetHeader>

            <div className="mt-6 flex flex-1 flex-col items-center gap-6">
              {/* Success icon */}
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-secondary/10">
                <Check className="h-10 w-10 text-secondary" />
              </div>

              <div className="text-center">
                <h3 className="text-lg font-semibold text-foreground">
                  See you there!
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Your seat at{" "}
                  <span className="font-medium text-foreground">
                    {session.venues?.name}
                  </span>{" "}
                  is confirmed for{" "}
                  <span className="font-medium text-foreground">
                    {new Date(session.session_date).toLocaleDateString(
                      "en-IN",
                      { weekday: "short", month: "short", day: "numeric" }
                    )}
                  </span>{" "}
                  at{" "}
                  <span className="font-medium text-foreground">
                    {session.start_time?.slice(0, 5)}
                  </span>
                  .
                </p>
              </div>

              <div className="rounded-lg border border-border bg-muted/50 p-4 text-center text-xs text-muted-foreground">
                A confirmation will be sent to your email. You can view your
                booking details in the My Bookings section.
              </div>

              <div className="mt-auto w-full pt-4">
                <Button onClick={handleClose} className="w-full">
                  Done
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
