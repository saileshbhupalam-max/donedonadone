import { useEffect, useState, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useGeolocation, haversineDistance } from "@/hooks/useGeolocation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useNavigate, useSearchParams } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { Navigation, Filter, MapPin, X } from "lucide-react";
import { AddToCalendarButton } from "@/components/session/AddToCalendarButton";

// Fix Leaflet default icon
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Leaflet private API workaround
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const DEFAULT_CENTER: [number, number] = [12.9141, 77.6389]; // HSR Layout

// Custom icons
function createIcon(color: string, size: number = 12) {
  return L.divIcon({
    className: "custom-marker",
    html: `<div style="width:${size * 2}px;height:${size * 2}px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div>`,
    iconSize: [size * 2, size * 2],
    iconAnchor: [size, size],
  });
}

function createUserIcon() {
  return L.divIcon({
    className: "user-marker",
    html: `<div style="width:16px;height:16px;border-radius:50%;background:#3b82f6;border:3px solid white;box-shadow:0 0 0 4px rgba(59,130,246,0.3);animation:pulse 2s infinite;"></div>
    <style>@keyframes pulse{0%,100%{box-shadow:0 0 0 4px rgba(59,130,246,0.3)}50%{box-shadow:0 0 0 8px rgba(59,130,246,0.1)}}</style>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

function getSessionColor(going: number, maxSpots: number | null): string {
  if (!maxSpots) return "hsl(142, 71%, 45%)"; // green
  const ratio = going / maxSpots;
  if (ratio >= 1) return "hsl(0, 84%, 60%)"; // red
  if (ratio >= 0.8) return "hsl(38, 92%, 50%)"; // amber
  return "hsl(142, 71%, 45%)"; // green
}

interface VenueMarker {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address?: string;
  /** locations table id — used for /venue/:id link */
  locationId?: string;
}

interface SessionMarker {
  id: string;
  title: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  venue_name: string | null;
  venue_address: string | null;
  lat: number;
  lng: number;
  max_spots: number | null;
  rsvp_count: number | null;
  going: number;
  session_format: string | null;
}

// Sub-component to recenter map
function MapRecenter({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

interface Props {
  focusEventId?: string | null;
}

export function SessionMap({ focusEventId }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { position, requestPosition } = useGeolocation();
  const [sessions, setSessions] = useState<SessionMarker[]>([]);
  const [venues, setVenues] = useState<VenueMarker[]>([]);
  const [radiusKm, setRadiusKm] = useState(5);
  const [showFilters, setShowFilters] = useState(false);
  const [vibeFilter, setVibeFilter] = useState("all");
  const [center, setCenter] = useState<[number, number]>(DEFAULT_CENTER);
  const [zoom, setZoom] = useState(13);
  const isDark = document.documentElement.classList.contains("dark");

  useEffect(() => {
    requestPosition();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (position) {
      setCenter([position.latitude, position.longitude]);
    }
  }, [position]);

  // Fetch data
  useEffect(() => {
    (async () => {
      const today = new Date().toISOString().split("T")[0];
      const [eventsRes, venuesRes, locationsRes, rsvpsRes] = await Promise.all([
        supabase.from("events").select("*").gte("date", today).not("venue_latitude", "is", null),
        supabase.from("venue_partners").select("id, venue_name, latitude, longitude, venue_address").eq("status", "active").not("latitude", "is", null),
        supabase.from("locations").select("id, name, latitude, longitude, location_type, neighborhood").eq("verified", true).not("latitude", "is", null),
        supabase.from("event_rsvps").select("event_id, status"),
      ]);

      const rsvpCounts: Record<string, number> = {};
      (rsvpsRes.data || []).forEach(r => {
        if (r.status === "going") rsvpCounts[r.event_id] = (rsvpCounts[r.event_id] || 0) + 1;
      });

      setSessions((eventsRes.data || []).filter(e => e.venue_latitude && e.venue_longitude).map(e => ({
        id: e.id,
        title: e.title,
        date: e.date,
        start_time: e.start_time,
        end_time: e.end_time,
        venue_name: e.venue_name,
        venue_address: e.venue_address,
        lat: e.venue_latitude!,
        lng: e.venue_longitude!,
        max_spots: e.max_spots,
        rsvp_count: e.rsvp_count,
        going: rsvpCounts[e.id] || 0,
        session_format: e.session_format,
      })));

      // Merge venue_partners + locations, dedup by name
      const seen = new Set<string>();
      const merged: VenueMarker[] = [];
      // Locations first (they have locationId for /venue/:id links)
      (locationsRes.data || []).filter(l => l.latitude && l.longitude).forEach(l => {
        const key = l.name.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          merged.push({ id: l.id, name: l.name, lat: l.latitude!, lng: l.longitude!, locationId: l.id });
        }
      });
      // Then venue_partners (only if not already covered by locations)
      (venuesRes.data || []).filter(v => v.latitude && v.longitude).forEach(v => {
        const key = v.venue_name.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          merged.push({ id: v.id, name: v.venue_name, lat: v.latitude!, lng: v.longitude!, address: v.venue_address ?? undefined });
        }
      });
      setVenues(merged);
    })();
  }, []);

  // Focus on specific event
  useEffect(() => {
    if (focusEventId && sessions.length > 0) {
      const s = sessions.find(s => s.id === focusEventId);
      if (s) {
        setCenter([s.lat, s.lng]);
        setZoom(16);
      }
    }
  }, [focusEventId, sessions]);

  const filteredSessions = useMemo(() => {
    let filtered = sessions;
    if (vibeFilter !== "all") {
      filtered = filtered.filter(s => {
        if (vibeFilter === "casual") return !s.session_format || s.session_format === "casual";
        if (vibeFilter === "structured") return s.session_format && s.session_format !== "casual";
        return true;
      });
    }
    if (position) {
      filtered = filtered.filter(s => {
        const dist = haversineDistance(position.latitude, position.longitude, s.lat, s.lng);
        return dist <= radiusKm * 1000;
      });
    }
    return filtered;
  }, [sessions, vibeFilter, radiusKm, position]);

  const getDistance = (lat: number, lng: number) => {
    if (!position) return null;
    const m = haversineDistance(position.latitude, position.longitude, lat, lng);
    return m < 1000 ? `${Math.round(m)}m` : `${(m / 1000).toFixed(1)}km`;
  };

  const tileUrl = isDark
    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

  return (
    <div className="relative w-full h-full">
      {/* Filter controls */}
      <div className="absolute top-3 left-3 right-3 z-[1000] flex gap-2">
        <Button size="sm" variant="secondary" className="shadow-md gap-1.5" onClick={() => setShowFilters(!showFilters)}>
          <Filter className="w-3.5 h-3.5" />
          Filters
        </Button>
        <Button size="sm" variant="secondary" className="shadow-md gap-1.5" onClick={() => {
          if (position) setCenter([position.latitude, position.longitude]);
          else requestPosition();
        }}>
          <Navigation className="w-3.5 h-3.5" />
          Near me
        </Button>
        <Badge variant="secondary" className="shadow-md self-center text-xs">
          {filteredSessions.length} session{filteredSessions.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      {showFilters && (
        <div className="absolute top-14 left-3 right-3 z-[1000] bg-background border border-border rounded-xl p-4 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Filters</span>
            <button onClick={() => setShowFilters(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Distance: {radiusKm}km</label>
            <Slider value={[radiusKm]} onValueChange={([v]) => setRadiusKm(v)} min={1} max={10} step={1} className="mt-1" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Vibe</label>
            <Select value={vibeFilter} onValueChange={setVibeFilter}>
              <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All vibes</SelectItem>
                <SelectItem value="casual">☕ Casual</SelectItem>
                <SelectItem value="structured">⏱️ Structured</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <MapContainer center={center} zoom={zoom} className="w-full h-full" zoomControl={false}
        style={{ background: isDark ? "#1a1a2e" : "#f0f0f0" }}>
        <MapRecenter center={center} zoom={zoom} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url={tileUrl}
        />

        {/* User location */}
        {position && (
          <>
            <Marker position={[position.latitude, position.longitude]} icon={createUserIcon()}>
              <Popup>You are here</Popup>
            </Marker>
            <Circle center={[position.latitude, position.longitude]} radius={radiusKm * 1000}
              pathOptions={{ color: "hsl(var(--primary))", fillOpacity: 0.05, weight: 1 }} />
          </>
        )}

        {/* Venue markers */}
        {venues.map(v => (
          <Marker key={`v-${v.id}`} position={[v.lat, v.lng]} icon={createIcon("hsl(30, 80%, 50%)", 8)}>
            <Popup>
              <div className="text-sm space-y-1 min-w-[160px]">
                <p className="font-medium">☕ {v.name}</p>
                {v.address && <p className="text-xs text-muted-foreground">{v.address}</p>}
                {getDistance(v.lat, v.lng) && <p className="text-xs text-primary">{getDistance(v.lat, v.lng)} away</p>}
                {v.locationId && (
                  <button
                    onClick={() => navigate(`/venue/${v.locationId}`)}
                    className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground mt-1"
                  >
                    View venue
                  </button>
                )}
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Session markers */}
        {filteredSessions.map(s => (
          <Marker key={`s-${s.id}`} position={[s.lat, s.lng]} icon={createIcon(getSessionColor(s.going, s.max_spots), 14)}>
            <Popup>
              <div className="text-sm space-y-1.5 min-w-[200px]">
                <p className="font-semibold">{s.title}</p>
                <p className="text-xs">{format(parseISO(s.date), "EEE, MMM d")}{s.start_time ? ` · ${s.start_time}` : ""}</p>
                {s.venue_name && <p className="text-xs">{s.venue_name}</p>}
                {getDistance(s.lat, s.lng) && <p className="text-xs font-medium" style={{ color: "hsl(var(--primary))" }}>{getDistance(s.lat, s.lng)} away</p>}
                <p className="text-xs">{s.going}{s.max_spots ? ` / ${s.max_spots}` : ""} going</p>
                <div className="flex gap-1 pt-1">
                  <button
                    onClick={() => navigate(`/events/${s.id}`)}
                    className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground"
                  >
                    View Details
                  </button>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
