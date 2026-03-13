import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MapPin, Loader2, ShieldCheck, KeyRound, AlertTriangle } from 'lucide-react';
import { useGeolocation } from '@/hooks/useGeolocation';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ERROR_STATES, CONFIRMATIONS } from '@/lib/personality';
import { hapticSuccess } from '@/lib/haptics';
import { SessionBoostBanner } from '@/components/session/SessionBoostBanner';

interface CheckInButtonProps {
  eventId: string;
  userId: string;
  onCheckedIn: () => void;
  hasVenueCoords: boolean;
}

export function CheckInButton({ eventId, userId, onCheckedIn, hasVenueCoords }: CheckInButtonProps) {
  const { status: geoStatus, error: geoError, requestPosition } = useGeolocation();
  const [checking, setChecking] = useState(false);
  const [showBoostBanner, setShowBoostBanner] = useState(false);
  const [showPinFallback, setShowPinFallback] = useState(false);
  const [pin, setPin] = useState('');
  const [checkResult, setCheckResult] = useState<{ success: boolean; message?: string; distance?: number } | null>(null);

  const handleGeoCheckin = async () => {
    setChecking(true);
    setCheckResult(null);

    const pos = await requestPosition();
    if (!pos) {
      setChecking(false);
      setShowPinFallback(true);
      return;
    }

    try {
      // TODO: fix type — RPC returns JSON object {success, distance_meters, radius}, not boolean
      const { data, error } = await supabase.rpc('checkin_with_location', {
        p_event_id: eventId,
        p_user_id: userId,
        p_latitude: pos.latitude,
        p_longitude: pos.longitude,
      }) as any;

      if (error) throw error;

      const result = data as { success: boolean; distance_meters?: number; radius?: number };
      if (result.success) {
        hapticSuccess();
        toast.success(CONFIRMATIONS.checkedIn);
        setShowBoostBanner(true);
        onCheckedIn();
      } else {
        setCheckResult({
          success: false,
          message: `You're ${Math.round(result.distance_meters ?? 0)}m away. Need to be within ${result.radius ?? 0}m of the venue.`,
          distance: result.distance_meters,
        });
        setShowPinFallback(true);
      }
    } catch (err) {
      toast.error(ERROR_STATES.generic);
      setShowPinFallback(true);
    } finally {
      setChecking(false);
    }
  };

  const handlePinCheckin = async () => {
    if (!pin.trim()) return;
    setChecking(true);

    try {
      // TODO: fix type — RPC returns JSON object {success}, not boolean
      const { data, error } = await supabase.rpc('checkin_with_pin', {
        p_event_id: eventId,
        p_user_id: userId,
        p_pin: pin.trim(),
      }) as any;

      if (error) throw error;

      const result = data as { success: boolean };
      if (result.success) {
        hapticSuccess();
        toast.success(CONFIRMATIONS.checkedIn);
        setShowBoostBanner(true);
        onCheckedIn();
      } else {
        toast.error('Invalid PIN. Ask your table captain or the venue staff.');
      }
    } catch (err) {
      toast.error(ERROR_STATES.generic);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Session Boost Banner */}
      {showBoostBanner && <SessionBoostBanner />}

      {/* Primary: Geolocation check-in */}
      <Button
        onClick={handleGeoCheckin}
        disabled={checking}
        className="w-full h-12 text-base"
        size="lg"
      >
        {checking ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Verifying location...
          </>
        ) : (
          <>
            <MapPin className="mr-2 h-5 w-5" />
            Check In at Venue
          </>
        )}
      </Button>

      {/* Geo error feedback */}
      {geoError && geoStatus === 'denied' && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {geoError}
          </AlertDescription>
        </Alert>
      )}

      {/* Distance too far */}
      {checkResult && !checkResult.success && (
        <Alert>
          <MapPin className="h-4 w-4" />
          <AlertDescription>
            {checkResult.message}
          </AlertDescription>
        </Alert>
      )}

      {/* Fallback: PIN check-in */}
      {showPinFallback && (
        <div className="border rounded-lg p-3 space-y-2 bg-muted/50">
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <KeyRound className="h-3.5 w-3.5" />
            Can't use location? Enter the venue PIN:
          </p>
          <div className="flex gap-2">
            <Input
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="4-digit PIN"
              maxLength={6}
              className="font-mono text-center tracking-widest"
            />
            <Button onClick={handlePinCheckin} disabled={checking || !pin.trim()}>
              {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Ask venue staff or your table captain for the PIN.
          </p>
        </div>
      )}
    </div>
  );
}
