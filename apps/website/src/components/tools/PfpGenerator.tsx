"use client";

import { Download, Image as ImageIcon, User as UserIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { updateUserAvatar } from "@/app/dashboard/account/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useSidebarAuth } from "@/hooks/useSidebarAuth";
import { createClient } from "@/lib/supabase/client";
import { InstagramIcon as Instagram } from "@/shared/icons/instagram";

// Icons
const XIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const DiscordIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037 26.153 26.153 0 0 0-1.638 3.369 17.572 17.572 0 0 0-5.516 0 26.26 26.26 0 0 0-1.64-3.369.077.077 0 0 0-.079-.037 19.736 19.736 0 0 0-4.885 1.515.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.086 2.157 2.419 0 1.334-.956 2.419-2.157 2.419zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.086 2.157 2.419 0 1.334-.946 2.419-2.157 2.419z" />
  </svg>
);

export default function PfpGenerator() {
  const [image, setImage] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedOverlay, setSelectedOverlay] = useState<string>("/overlay.webp");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useSidebarAuth();
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setImage(url);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const resetImage = () => {
    setImage(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  useEffect(() => {
    const generatePfp = async () => {
      if (!image || !canvasRef.current) return;
      setIsGenerating(true);

      const ctx = canvasRef.current.getContext("2d");
      if (!ctx) return;

      const userImg = new Image();
      const overlayImg = new Image();

      userImg.crossOrigin = "anonymous";
      overlayImg.crossOrigin = "anonymous";

      userImg.src = image;
      overlayImg.src = selectedOverlay;

      try {
        await Promise.all([
          new Promise((resolve, reject) => {
            userImg.onload = resolve;
            userImg.onerror = reject;
          }),
          new Promise((resolve, reject) => {
            overlayImg.onload = resolve;
            overlayImg.onerror = reject;
          }),
        ]);

        // Set canvas to overlay dimensions
        canvasRef.current.width = overlayImg.width;
        canvasRef.current.height = overlayImg.height;

        // Draw user image (cover fit)
        // Calculate scaling to cover the square
        const scale = Math.max(
          canvasRef.current.width / userImg.width,
          canvasRef.current.height / userImg.height
        );
        const x = (canvasRef.current.width - userImg.width * scale) / 2;
        const y = (canvasRef.current.height - userImg.height * scale) / 2;

        // Clear canvas
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

        // Draw user image centered and scaled
        ctx.drawImage(userImg, x, y, userImg.width * scale, userImg.height * scale);

        // Draw overlay
        ctx.drawImage(overlayImg, 0, 0);

        setPreviewUrl(canvasRef.current.toDataURL("image/png"));
      } catch (error) {
        console.error("Error generating PFP:", error);
        toast.error("Erreur lors de la génération de l'image");
      } finally {
        setIsGenerating(false);
      }
    };

    if (image) {
      generatePfp();
    }
  }, [image, selectedOverlay]);

  const downloadPfp = () => {
    if (!previewUrl) return;
    const link = document.createElement("a");
    link.download = "rose-griffon-pfp.png";
    link.href = previewUrl;
    link.click();
  };

  const handleUpdateProfile = async () => {
    if (!user || !canvasRef.current) return;
    setIsUpdatingProfile(true);
    try {
      // 1. Convert Canvas to Blob
      const blob = await new Promise<Blob | null>((resolve) =>
        canvasRef.current?.toBlob(resolve, "image/png")
      );
      if (!blob) throw new Error("Erreur lors de la génération de l'image");

      // 2. Upload to Supabase Storage
      const supabase = createClient();
      const filePath = `${user.id}/avatar.png`; // Overwrite existing avatar
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, blob, { upsert: true });

      if (uploadError) throw uploadError;

      // 3. Get Public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(filePath);

      // 4. Update Profile in DB
      // Note: We need to pass a timestamp query param to force cache refresh on the client side
      const avatarUrlWithTimestamp = `${publicUrl}?t=${Date.now()}`;
      await updateUserAvatar(user.id, avatarUrlWithTimestamp);

      toast.success("Photo de profil mise à jour avec succès !");
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Erreur lors de la mise à jour du profil");
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const shareUrl = typeof window !== "undefined" ? window.location.href : "";

  const shareOnX = () => {
    const text = encodeURIComponent("Je viens de personnaliser mon avatar Rose Griffon ! 🎨✨");
    const url = encodeURIComponent(shareUrl);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, "_blank");
  };

  const copyLink = (platform: string) => {
    navigator.clipboard.writeText(shareUrl);
    toast.success(`Lien copié pour ${platform} !`);
  };

  return (
    <div className="max-w-xl mx-auto w-full">
      <Card className="border-2 border-primary/10 shadow-2xl bg-transparent overflow-hidden">
        <div className="h-2 w-full bg-linear-to-r from-primary via-accent to-primary animate-gradient-x" />
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-2xl font-bold bg-linear-to-br from-primary to-primary/70 bg-clip-text text-transparent">
            Avatar RG
          </CardTitle>
          <CardDescription>Ajoutez le cadre officiel</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8 pt-6">
          <div className="flex flex-col items-center justify-center gap-6">
            <canvas ref={canvasRef} className="hidden" />

            <div className="relative group">
              {previewUrl ? (
                <div className="relative rounded-full overflow-hidden shadow-2xl border-[6px] border-background ring-4 ring-primary/20 transition-transform hover:scale-105 duration-500">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={previewUrl} alt="Aperçu" className="w-64 h-64 object-cover" />
                </div>
              ) : (
                <div
                  onClick={triggerFileInput}
                  className="w-64 h-64 rounded-full bg-muted/30 border-4 border-dashed border-primary/20 flex flex-col items-center justify-center text-muted-foreground gap-3 transition-all hover:bg-primary/5 hover:border-primary/50 relative overflow-hidden cursor-pointer group-hover:scale-105 duration-300"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={selectedOverlay}
                    alt="Cadre"
                    className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:opacity-60 transition-opacity duration-300"
                  />
                  <div className="relative z-10 flex flex-col items-center justify-center gap-2 bg-background/80 p-4 rounded-xl backdrop-blur-sm shadow-sm">
                    <ImageIcon className="w-8 h-8 text-primary" />
                    <span className="text-sm font-bold text-primary">Cliquez pour ajouter</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            {/* Overlay Selection */}
            <div className="flex justify-center gap-4">
              <button
                onClick={() => setSelectedOverlay("/overlay.webp")}
                className={`relative w-16 h-16 rounded-full overflow-hidden border-2 transition-all ${
                  selectedOverlay === "/overlay.webp"
                    ? "border-primary ring-2 ring-primary/30 scale-110"
                    : "border-transparent opacity-70 hover:opacity-100"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/overlay.webp" alt="Overlay 1" className="w-full h-full object-cover" />
              </button>
              <button
                onClick={() => setSelectedOverlay("/overlay2.webp")}
                className={`relative w-16 h-16 rounded-full overflow-hidden border-2 transition-all ${
                  selectedOverlay === "/overlay2.webp"
                    ? "border-primary ring-2 ring-primary/30 scale-110"
                    : "border-transparent opacity-70 hover:opacity-100"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/overlay2.webp" alt="Overlay 2" className="w-full h-full object-cover" />
              </button>
            </div>

            <Input
              ref={fileInputRef}
              id="picture"
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />

            <div className="flex flex-col sm:flex-row gap-3 justify-center flex-wrap">
              {!previewUrl ? (
                <Button
                  onClick={triggerFileInput}
                  size="lg"
                  className="w-full sm:w-auto min-w-[200px] font-bold shadow-lg hover:shadow-primary/25 transition-all"
                >
                  <ImageIcon className="mr-2 h-5 w-5" />
                  Choisir une image
                </Button>
              ) : (
                <>
                  <Button
                    onClick={resetImage}
                    variant="outline"
                    size="lg"
                    className="w-full sm:w-auto font-semibold border-primary/20 hover:bg-primary/5 hover:text-primary"
                  >
                    Changer d'image
                  </Button>

                  {user && (
                    <Button
                      onClick={handleUpdateProfile}
                      disabled={isUpdatingProfile}
                      variant="secondary"
                      size="lg"
                      className="w-full sm:w-auto font-bold shadow-md hover:shadow-lg transition-all"
                    >
                      {isUpdatingProfile ? (
                        "Mise à jour..."
                      ) : (
                        <>
                          <UserIcon className="mr-2 h-5 w-5" />
                          Mettre en profil
                        </>
                      )}
                    </Button>
                  )}

                  <Button
                    onClick={downloadPfp}
                    disabled={isGenerating}
                    size="lg"
                    className="w-full sm:w-auto min-w-[200px] font-bold shadow-lg hover:shadow-primary/25 transition-all bg-linear-to-r from-primary to-primary/90 hover:to-primary"
                  >
                    {isGenerating ? (
                      "Génération..."
                    ) : (
                      <>
                        <Download className="mr-2 h-5 w-5" />
                        Télécharger
                      </>
                    )}
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4 border-t border-primary/10 pt-6">
          <span className="text-sm text-muted-foreground font-medium">Partager l'outil :</span>
          <div className="flex gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={shareOnX}
              className="hover:text-primary hover:bg-primary/10 hover:border-primary/50 transition-colors"
              title="Partager sur X"
            >
              <XIcon className="w-5 h-5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => copyLink("Discord")}
              className="hover:text-[#5865F2] hover:bg-[#5865F2]/10 hover:border-[#5865F2]/50 transition-colors"
              title="Copier le lien pour Discord"
            >
              <DiscordIcon className="w-5 h-5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => copyLink("Instagram")}
              className="hover:text-[#E1306C] hover:bg-[#E1306C]/10 hover:border-[#E1306C]/50 transition-colors"
              title="Copier le lien pour Instagram"
            >
              <Instagram className="w-5 h-5" />
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
