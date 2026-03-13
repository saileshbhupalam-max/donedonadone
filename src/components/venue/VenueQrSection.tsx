import { useRef, lazy, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Download, Copy } from "lucide-react";

const QRCodeSVG = lazy(() => import("qrcode.react").then(m => ({ default: m.QRCodeSVG })));

const APP_URL = typeof window !== "undefined" ? window.location.origin : "https://focusclub.app";

function getQrLink(venueId: string) {
  return `${APP_URL}/?venue=${venueId}&utm_source=qr&utm_medium=table_tent`;
}

interface VenueQrSectionProps {
  venueId: string;
  venueName: string;
}

export function VenueQrSection({ venueId, venueName }: VenueQrSectionProps) {
  const qrRef = useRef<HTMLDivElement>(null);
  const tableTentRef = useRef<HTMLDivElement>(null);
  const qrLink = getQrLink(venueId);

  const slug = venueName.replace(/\s+/g, "-").toLowerCase();

  const downloadQR = () => {
    const svg = qrRef.current?.querySelector("svg");
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      ctx?.drawImage(img, 0, 0, 512, 512);
      const a = document.createElement("a");
      a.download = `qr-${slug}.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  };

  const downloadTableTent = () => {
    const el = tableTentRef.current;
    if (!el) return;
    import("html2canvas").then(({ default: html2canvas }) => {
      html2canvas(el, { scale: 2, backgroundColor: null }).then(canvas => {
        const a = document.createElement("a");
        a.download = `table-tent-${slug}.png`;
        a.href = canvas.toDataURL("image/png");
        a.click();
      });
    });
  };

  return (
    <div className="space-y-3">
      <div ref={qrRef} className="flex justify-center">
        <Suspense fallback={<div className="w-32 h-32 bg-muted animate-pulse rounded" />}>
          <QRCodeSVG
            value={qrLink}
            size={180}
            fgColor="hsl(18, 46%, 56%)"
            bgColor="transparent"
            level="M"
          />
        </Suspense>
      </div>

      {/* Hidden table tent for download */}
      <div className="overflow-hidden h-0">
        <div ref={tableTentRef} style={{ width: 420, padding: 32, background: "linear-gradient(135deg, #F5F0EB, #F0D5C5)", fontFamily: "Inter, sans-serif", textAlign: "center" }}>
          <div style={{ fontSize: 28, fontFamily: "DM Serif Display, serif", marginBottom: 8 }}>
            <span>Focus</span><span style={{ fontWeight: 300 }}>Club</span>
          </div>
          <p style={{ fontSize: 13, color: "#666", marginBottom: 20 }}>Find your people. Focus together.</p>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
            <Suspense fallback={<div className="w-32 h-32 bg-muted animate-pulse rounded" />}>
              <QRCodeSVG value={qrLink} size={200} fgColor="#C17B50" bgColor="transparent" level="M" />
            </Suspense>
          </div>
          <p style={{ fontSize: 15, fontWeight: 600, color: "#2D2D2D", marginBottom: 6 }}>Scan to join the coworking community</p>
          <p style={{ fontSize: 11, color: "#888" }}>Free to join · {venueName} is a FocusClub partner</p>
          <div style={{ borderTop: "1px solid #ddd", marginTop: 16, paddingTop: 12 }}>
            <p style={{ fontSize: 10, color: "#999" }}>focusclub.app</p>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={downloadQR}>
          <Download className="w-3 h-3" /> QR Code
        </Button>
        <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={downloadTableTent}>
          <Download className="w-3 h-3" /> Table Tent
        </Button>
        <Button size="sm" variant="outline" className="text-xs" onClick={() => { navigator.clipboard.writeText(qrLink); toast.success("Link copied!"); }}>
          <Copy className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}
