"use client";

import { Loader2, Lock, Mail, Palette, Save, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Switch } from "@rosegriffon/ui";
import { useSupabase } from "@/hooks/use-supabase";
import { authClient } from "@/lib/auth-client";

interface SettingsFormProps {
  initialProfile: {
    id: string;
    username: string | null;
    full_name: string | null;
    bio: string | null;
  };
  userEmail?: string;
}

import { useTheme } from "next-themes";

export function SettingsForm({ initialProfile, userEmail }: SettingsFormProps) {
  const supabase = useSupabase();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const { theme, setTheme } = useTheme();

  // Profile State
  const [username, setUsername] = useState(initialProfile.username || "");
  const [fullName, setFullName] = useState(initialProfile.full_name || "");
  const [bio, setBio] = useState(initialProfile.bio || "");

  // Email Change State
  const [newEmail, setNewEmail] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);

  // Password Change State
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  // App Settings State (Local only for now)
  const [notifications, setNotifications] = useState(true);

  // Load settings from localStorage
  useEffect(() => {
    const storedNotifications = localStorage.getItem("azalee_notifications");
    if (storedNotifications !== null) {setNotifications(storedNotifications === "true");}
  }, []);

  // Save settings items
  useEffect(() => {
    localStorage.setItem("azalee_notifications", String(notifications));
  }, [notifications]);

  const handleSaveProfile = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          bio,
          full_name: fullName,
          updated_at: new Date().toISOString(),
          username,
        })
        .eq("id", initialProfile.id);

      if (error) {throw error;}

      toast.success("Profil mis à jour avec succès");
      router.refresh();
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Erreur lors de la mise à jour du profil");
    } finally {
      setLoading(false);
    }
  };

  const handleChangeEmail = async () => {
    if (!newEmail) {return;}

    setEmailLoading(true);
    try {
      const { error } = await authClient.changeEmail({ newEmail });
      if (error) {throw new Error(error.message);}
      toast.success("Un email de confirmation a été envoyé à ta nouvelle adresse.");
      setNewEmail("");
    } catch (error) {
      console.error("Error changing email:", error);
      const msg = error instanceof Error ? error.message : "Erreur lors du changement d'email";
      toast.error(msg);
    } finally {
      setEmailLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {return;}

    if (newPassword !== confirmPassword) {
      toast.error("Les mots de passe ne correspondent pas.");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }

    setPasswordLoading(true);
    try {
      const { error } = await authClient.changePassword({
        currentPassword: "",
        newPassword,
      });
      if (error) {throw new Error(error.message);}
      toast.success("Mot de passe modifié avec succès.");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      console.error("Error changing password:", error);
      const msg =
        error instanceof Error ? error.message : "Erreur lors du changement de mot de passe";
      toast.error(msg);
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="grid gap-6 sm:gap-10">
      {/* Profile Settings */}
      <Card className="rounded-[24px] sm:rounded-[32px] border-none shadow-sm bg-surface-container-lowest overflow-hidden">
        <CardHeader className="bg-surface-container-low px-4 sm:px-6 py-4 sm:py-6 transition-colors hover:bg-surface-container-low/80">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="p-2 sm:p-3 bg-primary rounded-xl text-on-primary shadow-md shadow-primary/20 shrink-0">
              <User className="size-4 sm:size-5" strokeWidth={3} />
            </div>
            <div>
              <CardTitle className="font-black font-sans text-base sm:text-lg uppercase tracking-tight">
                Identité
              </CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-8 space-y-6 sm:space-y-8">
          <div className="grid gap-6 sm:gap-8 sm:grid-cols-2">
            <div className="space-y-2 sm:space-y-3">
              <Label
                htmlFor="username"
                className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1"
              >
                Pseudonyme
              </Label>
              <Input
                id="username"
                placeholder="Pseudo"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="h-12 sm:h-14 rounded-2xl bg-surface-container-low border-none font-bold focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
            <div className="space-y-2 sm:space-y-3">
              <Label
                htmlFor="fullname"
                className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1"
              >
                Nom réel
              </Label>
              <Input
                id="fullname"
                placeholder="Nom Complet"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="h-12 sm:h-14 rounded-2xl bg-surface-container-low border-none font-bold focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
          </div>
          <div className="space-y-2 sm:space-y-3">
            <Label
              htmlFor="bio"
              className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1"
            >
              Biographie
            </Label>
            <Input
              id="bio"
              placeholder="Décrivez votre rôle dans la rédaction..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="h-12 sm:h-14 rounded-2xl bg-surface-container-low border-none font-bold focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>
          <div className="pt-2 sm:pt-4">
            <Button
              onClick={handleSaveProfile}
              disabled={loading}
              className="w-full sm:w-auto h-11 sm:h-12 px-6 sm:px-8 rounded-full font-black uppercase tracking-widest text-[10px] bg-primary text-on-primary hover:bg-primary/90 shadow-xl shadow-primary/20 transition-all"
            >
              {loading ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Save className="mr-2 size-4" />
              )}
              Enregistrer les modifications
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Email Change */}
      <Card className="rounded-[24px] sm:rounded-[32px] border-none shadow-sm bg-surface-container-lowest overflow-hidden">
        <CardHeader className="bg-surface-container-low px-4 sm:px-6 py-4 sm:py-6 transition-colors hover:bg-surface-container-low/80">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="p-2 sm:p-3 bg-tertiary rounded-xl text-on-tertiary shadow-md shadow-tertiary/20 shrink-0">
              <Mail className="size-4 sm:size-5" strokeWidth={3} />
            </div>
            <div>
              <CardTitle className="font-black font-sans text-base sm:text-lg uppercase tracking-tight">
                Adresse email
              </CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-8 space-y-6">
          {userEmail && (
            <div className="bg-surface-container-low p-4 rounded-2xl">
              <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1">
                Email actuel
              </p>
              <p className="type-body-large font-bold text-on-surface break-all">{userEmail}</p>
            </div>
          )}
          <div className="space-y-2 sm:space-y-3">
            <Label
              htmlFor="new-email"
              className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1"
            >
              Nouvel email
            </Label>
            <Input
              id="new-email"
              type="email"
              placeholder="nouvel-email@exemple.com"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="h-12 sm:h-14 rounded-2xl bg-surface-container-low border-none font-bold focus:ring-2 focus:ring-tertiary/20 transition-all"
            />
          </div>
          <p className="type-body-small text-on-surface-variant">
            Un email de confirmation sera envoyé à ta nouvelle adresse. Le changement ne sera
            effectif qu&apos;après confirmation.
          </p>
          <Button
            onClick={handleChangeEmail}
            disabled={emailLoading || !newEmail}
            className="w-full sm:w-auto h-11 sm:h-12 px-6 sm:px-8 rounded-full font-black uppercase tracking-widest text-[10px] bg-tertiary text-on-tertiary hover:bg-tertiary/90 shadow-xl shadow-tertiary/20 transition-all disabled:opacity-38"
          >
            {emailLoading ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Mail className="mr-2 size-4" />
            )}
            Changer l&apos;email
          </Button>
        </CardContent>
      </Card>

      {/* Password Change */}
      <Card className="rounded-[24px] sm:rounded-[32px] border-none shadow-sm bg-surface-container-lowest overflow-hidden">
        <CardHeader className="bg-surface-container-low px-4 sm:px-6 py-4 sm:py-6 transition-colors hover:bg-surface-container-low/80">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="p-2 sm:p-3 bg-error rounded-xl text-on-error shadow-md shadow-error/20 shrink-0">
              <Lock className="size-4 sm:size-5" strokeWidth={3} />
            </div>
            <div>
              <CardTitle className="font-black font-sans text-base sm:text-lg uppercase tracking-tight">
                Mot de passe
              </CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-8 space-y-6">
          <div className="grid gap-6 sm:gap-8 sm:grid-cols-2">
            <div className="space-y-2 sm:space-y-3">
              <Label
                htmlFor="new-password"
                className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1"
              >
                Nouveau mot de passe
              </Label>
              <Input
                id="new-password"
                type="password"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="h-12 sm:h-14 rounded-2xl bg-surface-container-low border-none font-bold focus:ring-2 focus:ring-error/20 transition-all"
              />
            </div>
            <div className="space-y-2 sm:space-y-3">
              <Label
                htmlFor="confirm-password"
                className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1"
              >
                Confirmer le mot de passe
              </Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="h-12 sm:h-14 rounded-2xl bg-surface-container-low border-none font-bold focus:ring-2 focus:ring-error/20 transition-all"
              />
            </div>
          </div>
          <p className="type-body-small text-on-surface-variant">
            Le mot de passe doit contenir au moins 6 caractères.
          </p>
          <Button
            onClick={handleChangePassword}
            disabled={passwordLoading || !newPassword || !confirmPassword}
            className="w-full sm:w-auto h-11 sm:h-12 px-6 sm:px-8 rounded-full font-black uppercase tracking-widest text-[10px] bg-error text-on-error hover:bg-error/90 shadow-xl shadow-error/20 transition-all disabled:opacity-38"
          >
            {passwordLoading ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Lock className="mr-2 size-4" />
            )}
            Modifier le mot de passe
          </Button>
        </CardContent>
      </Card>

      {/* System Settings */}
      <Card className="rounded-[24px] sm:rounded-[32px] border-none shadow-sm bg-surface-container-lowest overflow-hidden">
        <CardHeader className="bg-surface-container-low px-4 sm:px-6 py-4 sm:py-6 border-b border-outline-variant/10 transition-colors hover:bg-surface-container-low/80">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="p-2 sm:p-3 bg-secondary rounded-xl text-on-secondary shadow-md shadow-secondary/20 shrink-0">
              <Palette className="size-4 sm:size-5" strokeWidth={3} />
            </div>
            <div>
              <CardTitle className="font-black font-sans text-base sm:text-lg uppercase tracking-tight">
                Application
              </CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-8 space-y-4 sm:space-y-6">
          <div className="flex items-start sm:items-center justify-between gap-4 group">
            <div className="space-y-0.5 sm:space-y-1 min-w-0 flex-1">
              <Label className="text-sm sm:text-base font-bold text-on-surface">Mode Sombre</Label>
              <p className="text-xs sm:text-sm text-on-surface-variant font-medium opacity-70">
                Basculer entre les thèmes clair et sombre
              </p>
            </div>
            <Switch
              checked={theme === "dark"}
              onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
              className="data-[state=checked]:bg-primary shrink-0"
            />
          </div>
          <div className="w-full h-px bg-outline-variant/10" />
          <div className="flex items-start sm:items-center justify-between gap-4 group">
            <div className="space-y-0.5 sm:space-y-1 min-w-0 flex-1">
              <Label className="text-sm sm:text-base font-bold text-on-surface">
                Notifications de Rédaction
              </Label>
              <p className="text-xs sm:text-sm text-on-surface-variant font-medium opacity-70">
                Alertes temps réel sur les nouveaux brouillons
              </p>
            </div>
            <Switch
              checked={notifications}
              onCheckedChange={setNotifications}
              className="data-[state=checked]:bg-secondary shrink-0"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
