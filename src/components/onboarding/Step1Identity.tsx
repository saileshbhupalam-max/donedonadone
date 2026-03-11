import type { OnboardingData } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Camera } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRef, useState } from "react";

interface Props {
  data: OnboardingData;
  updateData: (d: Partial<OnboardingData>) => void;
  userId: string;
}

export function Step1Identity({ data, updateData, userId }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${userId}/avatar.${ext}`;
      
      await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      updateData({ avatar_url: `${urlData.publicUrl}?t=${Date.now()}` });
    } catch (err) {
      console.error("Upload error:", err);
    } finally {
      setUploading(false);
    }
  };

  const initials = data.display_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex flex-col items-center pt-8 gap-6">
      <div className="text-center space-y-2">
        <h1 className="font-serif text-3xl text-foreground">First things first.</h1>
        <p className="text-muted-foreground text-sm">What do people call you?</p>
      </div>

      {/* Avatar */}
      <div className="relative group">
        <Avatar className="w-24 h-24 ring-4 ring-primary/20">
          <AvatarImage src={data.avatar_url || undefined} />
          <AvatarFallback className="text-xl font-medium bg-primary/10 text-primary">
            {initials || "?"}
          </AvatarFallback>
        </Avatar>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="absolute inset-0 flex items-center justify-center bg-foreground/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Camera className="w-6 h-6 text-background" />
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
      </div>
      <button
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="text-sm text-primary font-medium hover:underline"
      >
        {uploading ? "Uploading..." : "Show us your face"}
      </button>

      {/* Display name */}
      <div className="w-full max-w-sm space-y-2">
        <label className="text-sm font-medium text-foreground">Display Name *</label>
        <Input
          value={data.display_name}
          onChange={(e) => updateData({ display_name: e.target.value })}
          placeholder="The name your friends use"
          className="rounded-xl"
        />
      </div>

      {/* Tagline */}
      <div className="w-full max-w-sm space-y-2">
        <div className="flex justify-between items-baseline">
          <label className="text-sm font-medium text-foreground">Tagline</label>
          <span className="text-xs text-muted-foreground">{data.tagline.length}/140</span>
        </div>
        <Input
          value={data.tagline}
          onChange={(e) => {
            if (e.target.value.length <= 140) updateData({ tagline: e.target.value });
          }}
          placeholder="Designer by day, guitarist by night"
          className="rounded-xl"
        />
      </div>
    </div>
  );
}
