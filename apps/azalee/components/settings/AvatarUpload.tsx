"use client";

import { Camera, Loader2, Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { updateAvatar } from "@/app/settings/actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface AvatarUploadProps {
  currentAvatarUrl?: string;
  username?: string;
  userId: string;
}

export function AvatarUpload({ currentAvatarUrl, username, userId }: AvatarUploadProps) {
  const supabase = createClient();
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(currentAvatarUrl);
  const [isHovered, setIsHovered] = useState(false);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      if (!event.target.files || event.target.files.length === 0) return;

      const file = event.target.files[0];
      const fileExt = file.name.split(".").pop();
      const filePath = `${userId}/avatar-${Math.random()}.${fileExt}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(filePath);

      // Update Profile
      const result = await updateAvatar(publicUrl);
      if (result.error) throw new Error(result.error);

      setPreviewUrl(publicUrl);
      toast.success("Avatar mis à jour !");
    } catch (error: any) {
      console.error("Error uploading avatar:", error);
      toast.error("Erreur lors de l'envoi de l'image");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className="relative group cursor-pointer"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <Avatar className="size-32 sm:size-40 border-4 border-surface-container-high shadow-xl transition-all duration-300 group-hover:border-primary/50 group-hover:scale-[1.02]">
          <AvatarImage src={previewUrl} className="object-cover" />
          <AvatarFallback className="text-4xl font-black bg-primary-container text-on-primary-container uppercase select-none">
            {username?.[0] || "U"}
          </AvatarFallback>
        </Avatar>

        {/* Loading Overlay */}
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full backdrop-blur-sm z-20">
            <Loader2 className="size-10 text-white animate-spin" />
          </div>
        )}

        {/* Hover Overlay (Desktop) or Always Visible Button (Mobile) */}
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-[1px] transition-opacity duration-200 z-10",
            isHovered && !uploading ? "opacity-100" : "opacity-0",
          )}
        >
          <Camera className="size-10 text-white/90 drop-shadow-md" strokeWidth={1.5} />
        </div>

        <label
          htmlFor="avatar-input"
          className="absolute bottom-1 right-1 size-10 bg-primary text-on-primary rounded-full flex items-center justify-center shadow-lg cursor-pointer transition-transform hover:scale-110 active:scale-95 border-2 border-surface z-30"
          title="Changer d'avatar"
        >
          <Upload className="size-5" />
          <input
            id="avatar-input"
            type="file"
            className="hidden"
            accept="image/*"
            onChange={handleUpload}
            disabled={uploading}
          />
        </label>
      </div>

      <div className="text-center space-y-1">
        <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant/70">
          Photo de profil
        </p>
        <p className="text-[10px] text-on-surface-variant/50 font-medium">Recommandé : 400x400px</p>
      </div>
    </div>
  );
}
