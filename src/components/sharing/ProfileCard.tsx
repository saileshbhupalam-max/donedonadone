import { useRef, useState, useCallback } from "react";
import { Tables } from "@/integrations/supabase/types";
import { getRankForHours } from "@/lib/ranks";
import { PROP_TYPES } from "@/components/session/GivePropsFlow";
import { toast } from "sonner";
import { ERROR_STATES } from "@/lib/personality";

type Profile = Tables<"profiles">;

interface ProfileCardProps {
  profile: Profile;
  propCounts?: Record<string, number>;
  streak?: number;
  recommendedBy?: string;
}

function ProfileCardCanvas({ profile, propCounts = {}, streak = 0, recommendedBy }: ProfileCardProps) {
  const rank = getRankForHours(Number(profile.focus_hours ?? 0));
  const vibeLabels: Record<string, string> = { deep_focus: "🎯 Deep Focus", casual_social: "☕ Casual Social", balanced: "⚖️ Balanced" };
  
  const topProps = Object.entries(propCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([type]) => PROP_TYPES.find(p => p.type === type))
    .filter(Boolean);

  return (
    <div
      className="profile-card-render"
      style={{
        width: 1080,
        height: 1080,
        background: "linear-gradient(135deg, #F5F0EB 0%, #F0D5C5 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 80,
        fontFamily: "'DM Serif Display', serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Subtle pattern overlay */}
      <div style={{ position: "absolute", inset: 0, opacity: 0.03, background: "repeating-linear-gradient(45deg, #000 0, #000 1px, transparent 1px, transparent 20px)" }} />
      
      {/* Avatar */}
      <div style={{
        width: 200, height: 200, borderRadius: "50%",
        border: "6px solid #C4745A",
        overflow: "hidden",
        marginBottom: 32,
        background: "#E8DDD5",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 64,
        color: "#C4745A",
      }}>
        {profile.avatar_url ? (
          <img src={profile.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} crossOrigin="anonymous" loading="lazy" />
        ) : (
          <span>{(profile.display_name || "?")[0]}</span>
        )}
      </div>

      {/* Name */}
      <div style={{ fontSize: 48, color: "#2D2D2D", textAlign: "center", lineHeight: 1.2 }}>
        {profile.display_name}
      </div>

      {/* Tagline */}
      {profile.tagline && (
        <div style={{ fontSize: 22, color: "#7A7A7A", textAlign: "center", marginTop: 8, fontFamily: "Inter, sans-serif", maxWidth: 700 }}>
          {profile.tagline}
        </div>
      )}

      {/* Rank */}
      <div style={{ fontSize: 18, color: "#C4745A", marginTop: 16, fontFamily: "Inter, sans-serif", fontWeight: 600 }}>
        {rank.emoji} {rank.name}
      </div>

      {/* Work Vibe */}
      {profile.work_vibe && (
        <div style={{
          marginTop: 20, padding: "8px 24px", borderRadius: 999,
          background: "rgba(196,116,90,0.15)", color: "#C4745A",
          fontSize: 18, fontFamily: "Inter, sans-serif", fontWeight: 500,
        }}>
          {vibeLabels[profile.work_vibe] || profile.work_vibe}
        </div>
      )}

      {/* Tags */}
      <div style={{ display: "flex", gap: 12, marginTop: 24, flexWrap: "wrap", justifyContent: "center", maxWidth: 800 }}>
        {(profile.looking_for ?? []).slice(0, 3).map(t => (
          <span key={t} style={{
            padding: "6px 18px", borderRadius: 999, fontSize: 16,
            background: "rgba(196,116,90,0.2)", color: "#C4745A",
            fontFamily: "Inter, sans-serif",
          }}>{t}</span>
        ))}
        {(profile.can_offer ?? []).slice(0, 3).map(t => (
          <span key={t} style={{
            padding: "6px 18px", borderRadius: 999, fontSize: 16,
            background: "rgba(143,164,133,0.25)", color: "#5A7A4F",
            fontFamily: "Inter, sans-serif",
          }}>{t}</span>
        ))}
      </div>

      {/* Props / Streak */}
      <div style={{ display: "flex", gap: 16, marginTop: 24, alignItems: "center" }}>
        {topProps.map(pt => pt && (
          <span key={pt.type} style={{ fontSize: 20, fontFamily: "Inter, sans-serif", color: "#2D2D2D" }}>
            {pt.emoji} {pt.label.split(" ").pop()}
          </span>
        ))}
        {streak > 0 && (
          <span style={{ fontSize: 20, fontFamily: "Inter, sans-serif", color: "#C4745A", fontWeight: 600 }}>
            🔥 {streak} session streak
          </span>
        )}
      </div>

      {/* CTA */}
      <div style={{
        marginTop: 40, fontSize: 20, color: "#C4745A",
        fontFamily: "Inter, sans-serif", fontWeight: 600,
        letterSpacing: 0.5,
      }}>
        Find me on donedonadone
      </div>

      {/* Bottom bar */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        background: "rgba(196,116,90,0.1)",
        padding: "20px 60px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}>
        <span style={{ fontSize: 18, color: "#C4745A", fontFamily: "Inter, sans-serif", fontWeight: 600 }}>
          focusclub.app
        </span>
        <span style={{ fontSize: 16, color: "#7A7A7A", fontFamily: "Inter, sans-serif" }}>
          Find your people. Focus together.
        </span>
      </div>

      {/* Recommended by */}
      {recommendedBy && (
        <div style={{
          position: "absolute", top: 40, right: 60,
          fontSize: 16, color: "#7A7A7A", fontFamily: "Inter, sans-serif",
        }}>
          Recommended by {recommendedBy}
        </div>
      )}

      {/* Logo watermark */}
      <div style={{
        position: "absolute", bottom: 70, right: 60,
        fontSize: 14, color: "rgba(196,116,90,0.3)",
        fontFamily: "'DM Serif Display', serif",
      }}>
        donedonadone
      </div>
    </div>
  );
}

export function useProfileCardGenerator() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);

  const generateCard = useCallback(async (props: ProfileCardProps): Promise<Blob | null> => {
    setGenerating(true);
    
    // Create a temporary container off-screen
    const container = document.createElement("div");
    container.style.position = "fixed";
    container.style.left = "-9999px";
    container.style.top = "0";
    document.body.appendChild(container);

    // Render to DOM
    const { createRoot } = await import("react-dom/client");
    const root = createRoot(container);
    
    return new Promise((resolve) => {
      root.render(<ProfileCardCanvas {...props} />);
      
      setTimeout(async () => {
        try {
          const element = container.querySelector(".profile-card-render") as HTMLElement;
          if (!element) { resolve(null); return; }
          
          const html2canvas = (await import("html2canvas")).default;
          const canvas = await html2canvas(element, {
            width: 1080,
            height: 1080,
            scale: 1,
            useCORS: true,
            backgroundColor: null,
          });
          
          canvas.toBlob((blob) => {
            root.unmount();
            document.body.removeChild(container);
            setGenerating(false);
            resolve(blob);
          }, "image/png");
        } catch (err) {
          console.error("[ProfileCard]", err);
          root.unmount();
          document.body.removeChild(container);
          setGenerating(false);
          resolve(null);
        }
      }, 500);
    });
  }, []);

  return { generateCard, generating, containerRef };
}

export function ShareProfileCard({ profile, propCounts, streak, referralCode, recommendedBy }: ProfileCardProps & { referralCode?: string | null }) {
  const { generateCard, generating } = useProfileCardGenerator();
  const appUrl = typeof window !== "undefined" ? window.location.origin : "";
  const profileLink = `${appUrl}/profile/${profile.id}${referralCode ? `?ref=${referralCode}` : ""}`;

  const handleGenerate = async () => {
    const blob = await generateCard({ profile, propCounts, streak, recommendedBy });
    if (!blob) {
      toast.error(ERROR_STATES.generic);
      return null;
    }
    return blob;
  };

  const handleShare = async () => {
    const blob = await handleGenerate();
    if (!blob) return;
    
    const file = new File([blob], `focusclub-${profile.display_name?.replace(/\s+/g, "-").toLowerCase()}.png`, { type: "image/png" });
    
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: `${profile.display_name} on donedonadone` });
        return;
      } catch { /* fallback below */ }
    }
    
    // Download fallback
    downloadBlob(blob, file.name);
  };

  const handleWhatsApp = async () => {
    const blob = await handleGenerate();
    if (blob) downloadBlob(blob, "focusclub-card.png");
    
    const msg = recommendedBy
      ? `Check out ${profile.display_name} on donedonadone${profile.tagline ? ` — ${profile.tagline}` : ""}. Join us: ${profileLink}`
      : `Hey! I'm on donedonadone — a community for people who cowork in Bangalore. Check out my profile and join: ${profileLink}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(profileLink);
    toast.success("Link copied!");
  };

  const handleDownload = async () => {
    const blob = await handleGenerate();
    if (blob) {
      downloadBlob(blob, `focusclub-${profile.display_name?.replace(/\s+/g, "-").toLowerCase() || "card"}.png`);
      toast.success("Card downloaded!");
    }
  };

  return { handleShare, handleWhatsApp, handleCopy, handleDownload, generating };
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
