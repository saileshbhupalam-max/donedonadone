import { Button } from "@/components/ui/button";
import { MessageCircle, Copy, Share2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface WhatsAppShareProps {
  message: string;
  label?: string;
  size?: "sm" | "default" | "lg" | "icon";
  variant?: "whatsapp" | "outline" | "ghost";
  className?: string;
  fullWidth?: boolean;
}

export function WhatsAppShareButton({ message, label = "Share on WhatsApp", size = "sm", variant = "whatsapp", className, fullWidth }: WhatsAppShareProps) {
  return (
    <Button
      size={size}
      className={cn(
        "gap-2",
        variant === "whatsapp" && "bg-[#25D366] hover:bg-[#20BD5A] text-white",
        fullWidth && "w-full",
        className,
      )}
      variant={variant === "whatsapp" ? "default" : variant}
      onClick={(e) => {
        e.stopPropagation();
        window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank");
      }}
    >
      <MessageCircle className="w-4 h-4" />
      {label}
    </Button>
  );
}

export function CopyLinkButton({ link, label = "Copy Link", size = "sm", className }: { link: string; label?: string; size?: "sm" | "default" | "icon"; className?: string }) {
  return (
    <Button
      size={size}
      variant="outline"
      className={cn("gap-2", className)}
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(link);
        toast.success("Link copied!");
      }}
    >
      <Copy className="w-3.5 h-3.5" />
      {label}
    </Button>
  );
}

export function LinkedInShareButton({ url, text, label = "Post on LinkedIn", size = "sm", className }: { url: string; text?: string; label?: string; size?: "sm" | "default"; className?: string }) {
  return (
    <Button
      size={size}
      variant="outline"
      className={cn("gap-2", className)}
      onClick={(e) => {
        e.stopPropagation();
        const params = new URLSearchParams({ url });
        window.open(`https://www.linkedin.com/sharing/share-offsite/?${params.toString()}`, "_blank");
      }}
    >
      <Share2 className="w-3.5 h-3.5" />
      {label}
    </Button>
  );
}
