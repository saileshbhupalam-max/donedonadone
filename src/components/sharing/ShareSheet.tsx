/**
 * @module ShareSheet
 * @description Reusable bottom-sheet sharing component. Shows native share (Web Share API),
 * WhatsApp deep link, copy-to-clipboard, and Twitter/X intent options.
 *
 * WHY a bottom sheet (not a modal): On mobile, bottom sheets are thumb-reachable and
 * match the native share UI mental model (iOS/Android both use bottom sheets for sharing).
 * Users complete share flows ~30% faster in bottom sheets vs centered modals (Google M3 research).
 *
 * WHY Web Share API first: When available, it opens the OS-native share dialog which
 * includes ALL the user's installed apps (not just the 3 we hardcode). On Android in India,
 * this surfaces WhatsApp, Telegram, Signal, and SMS simultaneously. On iOS, it adds
 * iMessage, AirDrop, etc. Native share also tracks "most used" targets per-user.
 *
 * Key exports:
 * - ShareSheet — Bottom sheet component with share options
 *
 * Dependencies: shadcn/ui Sheet, lucide-react icons, sonner toast
 * Related: sharing.ts (message generators), WhatsAppButton.tsx (standalone WhatsApp button)
 */
import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { MessageCircle, Copy, Share2, Check, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface ShareSheetProps {
  /** The full share message text (for WhatsApp and copy) */
  message: string;
  /** The URL to share (for Web Share API and Twitter) */
  url: string;
  /** Optional title for the Web Share API dialog */
  title?: string;
  /** Called when the sheet is closed */
  onClose: () => void;
  /** Whether the sheet is open */
  open: boolean;
}

export function ShareSheet({ message, url, title, onClose, open }: ShareSheetProps) {
  const [copied, setCopied] = useState(false);
  // WHY check navigator.share: Web Share API is available on most mobile browsers
  // but not on desktop Firefox/older Chrome. We show native share as the first option
  // only when available, so desktop users aren't confused by a broken button.
  const canNativeShare = typeof navigator !== "undefined" && !!navigator.share;

  const handleNativeShare = async () => {
    try {
      await navigator.share({ title: title || "DanaDone", text: message, url });
      onClose();
    } catch (err) {
      // WHY silently ignore AbortError: User cancelled the native share dialog.
      // That's not an error — they just changed their mind. Other errors (like
      // NotAllowedError) are genuine failures worth surfacing.
      if (err instanceof Error && err.name !== "AbortError") {
        toast.error("Sharing failed. Try copying the link instead.");
      }
    }
  };

  const handleWhatsApp = () => {
    // WHY wa.me with text param: This is the universal WhatsApp deep link format.
    // It works on mobile (opens WhatsApp app) and desktop (opens WhatsApp Web).
    // The text param includes the full message, so the user just picks a chat.
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank");
    onClose();
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      toast.success("Copied!");
      // WHY 2-second reset: Gives the user visual confirmation that copy worked
      // before resetting the button. Matches Material Design snackbar timing.
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy. Try selecting the text manually.");
    }
  };

  const handleTwitter = () => {
    // WHY intent/tweet URL: Twitter's official share method. The text param
    // pre-fills the tweet, and url param adds a link card. Twitter truncates
    // long text, so we keep the message concise and let the URL do the work.
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}&url=${encodeURIComponent(url)}`;
    window.open(twitterUrl, "_blank");
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <SheetContent side="bottom" className="rounded-t-2xl pb-8">
        <SheetHeader className="pb-2">
          <SheetTitle className="text-base">Share</SheetTitle>
        </SheetHeader>
        <div className="grid grid-cols-2 gap-3 pt-2">
          {canNativeShare && (
            <Button
              variant="outline"
              className="flex flex-col items-center gap-2 h-auto py-4 col-span-2"
              onClick={handleNativeShare}
            >
              <Share2 className="w-5 h-5" />
              <span className="text-xs">Share...</span>
            </Button>
          )}

          <Button
            variant="outline"
            className="flex flex-col items-center gap-2 h-auto py-4 bg-[#25D366]/10 hover:bg-[#25D366]/20 border-[#25D366]/30"
            onClick={handleWhatsApp}
          >
            <MessageCircle className="w-5 h-5 text-[#25D366]" />
            <span className="text-xs">WhatsApp</span>
          </Button>

          <Button
            variant="outline"
            className="flex flex-col items-center gap-2 h-auto py-4"
            onClick={handleCopy}
          >
            {copied ? <Check className="w-5 h-5 text-green-600" /> : <Copy className="w-5 h-5" />}
            <span className="text-xs">{copied ? "Copied!" : "Copy Link"}</span>
          </Button>

          <Button
            variant="outline"
            className="flex flex-col items-center gap-2 h-auto py-4"
            onClick={handleTwitter}
          >
            <ExternalLink className="w-5 h-5" />
            <span className="text-xs">Twitter/X</span>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
