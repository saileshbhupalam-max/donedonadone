import { format } from "date-fns";
import { ShieldAlert, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SuspensionNoticeProps {
  suspendedUntil: string;
  reason?: string | null;
}

export function SuspensionNotice({ suspendedUntil, reason }: SuspensionNoticeProps) {
  const isPermanent = new Date(suspendedUntil).getFullYear() >= 2099;
  const endDate = new Date(suspendedUntil);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
      <ShieldAlert className="w-12 h-12 text-destructive mb-4" />
      <h1 className="text-2xl font-serif text-foreground mb-2">
        {isPermanent ? "Your account has been suspended" : "Your account is temporarily suspended"}
      </h1>

      {!isPermanent && (
        <p className="text-sm text-muted-foreground mb-2">
          Your suspension ends on <span className="font-medium text-foreground">{format(endDate, "MMMM d, yyyy 'at' h:mm a")}</span>
        </p>
      )}

      {reason && (
        <p className="text-sm text-muted-foreground mb-4 max-w-sm">
          Reason: {reason}
        </p>
      )}

      <p className="text-xs text-muted-foreground mb-6 max-w-sm">
        If you believe this is a mistake, please reach out to our support team.
      </p>

      <Button variant="outline" size="sm" asChild>
        <a href="mailto:support@focusclub.co">
          <Mail className="w-4 h-4 mr-2" /> Contact Support
        </a>
      </Button>
    </div>
  );
}
