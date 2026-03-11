import { ReactNode, useEffect, useRef } from "react";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { useUserContext, UserLevel, LEVEL_ORDER } from "@/hooks/useUserContext";
import { useSubscription, TierId } from "@/hooks/useSubscription";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { trackConversion } from "@/lib/trackConversion";

interface FeatureGateProps {
  featureFlag?: string;
  minLevel?: UserLevel;
  requireCheckIn?: boolean;
  requireDnaComplete?: number;
  requiredTier?: TierId;
  children: ReactNode;
  teaser?: ReactNode;
  fallback?: ReactNode;
}

function DefaultTeaser({ reason, cta, ctaLink }: { reason: string; cta?: string; ctaLink?: string }) {
  const navigate = useNavigate();
  return (
    <Card className="border-border/50 bg-muted/30">
      <CardContent className="p-4 flex items-center gap-3">
        <Lock className="w-5 h-5 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-muted-foreground">{reason}</p>
        </div>
        {cta && ctaLink && (
          <Button size="sm" variant="outline" className="shrink-0 text-xs" onClick={() => navigate(ctaLink)}>
            {cta}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

const LEVEL_SESSIONS: Record<UserLevel, number> = {
  new_user: 0,
  explorer: 1,
  regular: 3,
  core: 6,
  power_user: 11,
};

export function FeatureGate({
  featureFlag,
  minLevel,
  requireCheckIn,
  requireDnaComplete,
  requiredTier,
  children,
  teaser,
  fallback,
}: FeatureGateProps) {
  const { isEnabled, loading: flagsLoading } = useFeatureFlags();
  const { level, currentState, dnaComplete, loading: contextLoading } = useUserContext();
  const { tierOrder, allTiers, loading: subLoading } = useSubscription();
  const trackedRef = useRef(false);

  // Determine if gated
  const isLoading = flagsLoading || contextLoading || subLoading;

  const isGated = !isLoading && (
    (featureFlag && !isEnabled(featureFlag)) ||
    (requiredTier && (() => {
      const requiredTierInfo = allTiers.find((t) => t.id === requiredTier);
      return requiredTierInfo && tierOrder < requiredTierInfo.sort_order;
    })()) ||
    (minLevel && LEVEL_ORDER[level] < LEVEL_ORDER[minLevel]) ||
    (requireCheckIn && currentState === "offline") ||
    (requireDnaComplete !== undefined && dnaComplete < requireDnaComplete)
  );

  useEffect(() => {
    if (isGated && !trackedRef.current) {
      trackedRef.current = true;
      const feature = requiredTier || featureFlag || "unknown";
      trackConversion("saw_gate", { feature });
      sessionStorage.setItem("last_gate_feature", String(feature));
    }
  }, [isGated, requiredTier, featureFlag]);

  if (isLoading) {
    return fallback ? <>{fallback}</> : null;
  }

  // Check feature flag
  if (featureFlag && !isEnabled(featureFlag)) {
    return teaser ? <>{teaser}</> : null;
  }

  // Check required tier
  if (requiredTier) {
    const requiredTierInfo = allTiers.find((t) => t.id === requiredTier);
    if (requiredTierInfo && tierOrder < requiredTierInfo.sort_order) {
      return teaser ? <>{teaser}</> : (
        <DefaultTeaser
          reason={`Upgrade to ${requiredTierInfo.name} to unlock this`}
          cta="See plans"
          ctaLink="/pricing"
        />
      );
    }
  }

  // Check min level
  if (minLevel && LEVEL_ORDER[level] < LEVEL_ORDER[minLevel]) {
    const sessionsNeeded = LEVEL_SESSIONS[minLevel] - LEVEL_SESSIONS[level];
    return teaser ? <>{teaser}</> : (
      <DefaultTeaser
        reason={`Attend ${sessionsNeeded} more session${sessionsNeeded > 1 ? "s" : ""} to unlock this`}
        cta="Browse sessions"
        ctaLink="/events"
      />
    );
  }

  // Check check-in
  if (requireCheckIn && currentState === "offline") {
    return teaser ? <>{teaser}</> : (
      <DefaultTeaser reason="Check in to see this" cta="Check in" ctaLink="/home" />
    );
  }

  // Check DNA completion
  if (requireDnaComplete && dnaComplete < requireDnaComplete) {
    return teaser ? <>{teaser}</> : (
      <DefaultTeaser
        reason="Complete your DNA profile to unlock this"
        cta="Build your DNA"
        ctaLink="/me/dna"
      />
    );
  }

  return <>{children}</>;
}
