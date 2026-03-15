import { useEffect, useCallback, useState } from "react";
import { X, ChevronLeft, ChevronRight, Download } from "lucide-react";

interface Props {
  images: string[];
  initialIndex?: number;
  onClose: () => void;
  alt?: string;
}

export function PhotoLightbox({ images, initialIndex = 0, onClose, alt = "Photo" }: Props) {
  const [index, setIndex] = useState(initialIndex);
  const [touchStart, setTouchStart] = useState<number | null>(null);

  const hasPrev = index > 0;
  const hasNext = index < images.length - 1;

  const prev = useCallback(() => { if (hasPrev) setIndex(i => i - 1); }, [hasPrev]);
  const next = useCallback(() => { if (hasNext) setIndex(i => i + 1); }, [hasNext]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose, prev, next]);

  const handleTouchStart = (e: React.TouchEvent) => setTouchStart(e.touches[0].clientX);
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const diff = e.changedTouches[0].clientX - touchStart;
    if (diff > 60) prev();
    else if (diff < -60) next();
    setTouchStart(null);
  };

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center"
      onClick={onClose}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Top controls */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4 z-10">
        {images.length > 1 && (
          <span className="text-white/70 text-sm">{index + 1} / {images.length}</span>
        )}
        <div className="ml-auto flex gap-2">
          <a
            href={images[index]}
            download
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="w-10 h-10 rounded-full bg-white/10 backdrop-blur flex items-center justify-center hover:bg-white/20 transition-colors"
          >
            <Download className="w-5 h-5 text-white" />
          </a>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/10 backdrop-blur flex items-center justify-center hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>

      {/* Image */}
      <img
        src={images[index]}
        alt={alt}
        className="max-w-[95vw] max-h-[85vh] object-contain select-none"
        onClick={e => e.stopPropagation()}
        draggable={false}
      />

      {/* Navigation arrows (desktop) */}
      {hasPrev && (
        <button
          onClick={e => { e.stopPropagation(); prev(); }}
          className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 backdrop-blur flex items-center justify-center hover:bg-white/20 transition-colors hidden sm:flex"
        >
          <ChevronLeft className="w-6 h-6 text-white" />
        </button>
      )}
      {hasNext && (
        <button
          onClick={e => { e.stopPropagation(); next(); }}
          className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 backdrop-blur flex items-center justify-center hover:bg-white/20 transition-colors hidden sm:flex"
        >
          <ChevronRight className="w-6 h-6 text-white" />
        </button>
      )}
    </div>
  );
}
