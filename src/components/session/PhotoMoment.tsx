import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Camera } from "lucide-react";
import { toast } from "sonner";
import { ERROR_STATES, CONFIRMATIONS } from "@/lib/personality";
import { motion } from "framer-motion";

interface Props {
  eventId: string;
}

export function PhotoMoment({ eventId }: Props) {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${eventId}/${user.id}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("session-photos")
        .upload(path, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("session-photos")
        .getPublicUrl(path);

      await supabase.from("session_photos").insert({
        event_id: eventId,
        user_id: user.id,
        photo_url: publicUrl,
      });

      setDone(true);
      toast.success(CONFIRMATIONS.photoUploaded);
    } catch (err) {
      console.error("[PhotoUpload]", err);
      toast.error(ERROR_STATES.generic);
    } finally {
      setUploading(false);
    }
  };

  if (done) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <Card className="border-secondary/20 bg-secondary/5">
          <CardContent className="p-4 text-center">
            <p className="text-sm text-foreground">📸 Photo saved to Memories!</p>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="border-primary/20">
        <CardContent className="p-4 text-center space-y-3">
          <p className="text-2xl">📸</p>
          <p className="font-serif text-sm text-foreground">Group Photo Time!</p>
          <p className="text-xs text-muted-foreground">Capture this moment with your table</p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleCapture}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            <Camera className="w-4 h-4 mr-1" />
            {uploading ? "Uploading..." : "Open Camera"}
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}
