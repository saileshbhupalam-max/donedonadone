import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useGeolocation } from "@/hooks/useGeolocation";
import { Navigation } from "lucide-react";

// Fix Leaflet icon
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Leaflet private API workaround
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

interface Props {
  latitude?: number | null;
  longitude?: number | null;
  radiusKm?: number;
  onLocationChange: (lat: number, lng: number) => void;
  onRadiusChange?: (radius: number) => void;
  showRadius?: boolean;
  height?: string;
}

function ClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export function LocationPicker({ latitude, longitude, radiusKm = 5, onLocationChange, onRadiusChange, showRadius = true, height = "200px" }: Props) {
  const { position, requestPosition, status } = useGeolocation();
  const [lat, setLat] = useState(latitude || 12.9141);
  const [lng, setLng] = useState(longitude || 77.6389);

  useEffect(() => {
    if (latitude && longitude) {
      setLat(latitude);
      setLng(longitude);
    }
  }, [latitude, longitude]);

  const handleUseMyLocation = async () => {
    const pos = await requestPosition();
    if (pos) {
      setLat(pos.latitude);
      setLng(pos.longitude);
      onLocationChange(pos.latitude, pos.longitude);
    }
  };

  const handleClick = (newLat: number, newLng: number) => {
    setLat(newLat);
    setLng(newLng);
    onLocationChange(newLat, newLng);
  };

  const isDark = document.documentElement.classList.contains("dark");

  return (
    <div className="space-y-2">
      <div className="rounded-xl overflow-hidden border border-border" style={{ height }}>
        <MapContainer center={[lat, lng]} zoom={13} className="w-full h-full" zoomControl={false}>
          <TileLayer
            url={isDark
              ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"}
          />
          <Marker position={[lat, lng]} />
          <ClickHandler onClick={handleClick} />
        </MapContainer>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={handleUseMyLocation}
          disabled={status === "loading"}>
          <Navigation className="w-3.5 h-3.5" />
          {status === "loading" ? "Locating..." : "Use my location"}
        </Button>
        <span className="text-[10px] text-muted-foreground">or tap the map</span>
      </div>
      {showRadius && onRadiusChange && (
        <div>
          <label className="text-xs text-muted-foreground">How far will you travel? {radiusKm}km</label>
          <Slider value={[radiusKm]} onValueChange={([v]) => onRadiusChange(v)} min={1} max={10} step={1} className="mt-1" />
        </div>
      )}
    </div>
  );
}
