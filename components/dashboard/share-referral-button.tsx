"use client"

import { Button } from "@/components/ui/button"
import { Share2 } from "lucide-react"

export function ShareReferralButton({ code }: { code: string }) {
  const shareText = `Join me on donedonadone! Use my referral code ${code} to get started. Group coworking in HSR Layout, Bangalore.`
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join donedonadone",
          text: shareText,
        })
        return
      } catch {
        // User cancelled or share failed, fall through to WhatsApp
      }
    }
    window.open(whatsappUrl, "_blank")
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleShare}>
      <Share2 className="mr-1 h-3 w-3" />
      Share
    </Button>
  )
}
