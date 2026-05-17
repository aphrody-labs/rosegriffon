"use client";

import {
  AlertTriangle,
  AtSign,
  Bell,
  Globe,
  Link2,
  Loader2,
  LogOut,
  Mail,
  Monitor,
  Moon,
  Palette,
  Save,
  Shield,
  Smartphone,
  Trash2,
  User,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { updateProfile } from "@/app/settings/actions";
import { AvatarUpload } from "@/components/settings/AvatarUpload";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { authClient } from "@/lib/auth-client";

interface SettingsClientProps {
  profile: any;
  userEmail?: string;
  initialSessions?: any[];
  currentSessionToken?: string;
  linkedAccounts?: any[];
}

function parseUserAgent(ua?: string | null): { device: string; browser: string } {
  if (!ua) return { device: "Inconnu", browser: "Inconnu" };
  const isMobile = /Mobile|Android|iPhone/i.test(ua);
  const device = isMobile ? "Mobile" : "Desktop";
  let browser = "Navigateur inconnu";
  if (ua.includes("Firefox")) browser = "Firefox";
  else if (ua.includes("Edg")) browser = "Edge";
  else if (ua.includes("Chrome")) browser = "Chrome";
  else if (ua.includes("Safari")) browser = "Safari";
  return { device, browser };
}

function formatDate(date: string | Date | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const PROVIDER_LABELS: Record<string, string> = {
  discord: "Discord",
  google: "Google",
  credential: "Email / Mot de passe",
};

export function SettingsClient({
  profile,
  userEmail,
  initialSessions = [],
  currentSessionToken,
  linkedAccounts = [],
}: SettingsClientProps) {
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Profile State
  const [username, setUsername] = useState(profile.username || "");
  const [fullName, setFullName] = useState(profile.full_name || "");
  const [bio, setBio] = useState(profile.bio || "");
  const [website, setWebsite] = useState(profile.website || "");

  // Email Change State
  const [newEmail, setNewEmail] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);

  // Password Change State
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  // App Settings State
  const [notifications, setNotifications] = useState(() => {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem("azalee_notifications");
    return stored !== null ? stored === "true" : true;
  });

  // Sessions State
  const [sessions, setSessions] = useState<any[]>(initialSessions);
  const [sessionLoading, setSessionLoading] = useState<string | null>(null);
  const [revokeAllLoading, setRevokeAllLoading] = useState(false);

  // Delete Account State
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    localStorage.setItem("azalee_notifications", String(notifications));
  }, [notifications]);

  const handleSaveProfile = async () => {
    setLoading(true);
    const formData = new FormData();
    formData.append("username", username);
    formData.append("full_name", fullName);
    formData.append("bio", bio);
    formData.append("website", website);

    const result = await updateProfile(formData);
    if (result.success) {
      toast.success("Profil mis à jour !");
    } else {
      toast.error(result.error || "Erreur lors de la mise à jour");
    }
    setLoading(false);
  };

  const handleChangeEmail = async () => {
    if (!newEmail) return;
    setEmailLoading(true);
    try {
      const { error } = await authClient.changeEmail({ newEmail });
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Vérifie ta nouvelle boîte mail !");
        setNewEmail("");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
    setEmailLoading(false);
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error("Les mots de passe ne correspondent pas");
      return;
    }
    setPasswordLoading(true);
    try {
      const { error } = await authClient.changePassword({
        newPassword,
        currentPassword: "",
      });
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Mot de passe mis à jour !");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
    setPasswordLoading(false);
  };

  const handleRevokeSession = async (sessionToken: string) => {
    setSessionLoading(sessionToken);
    try {
      await authClient.revokeSession({ token: sessionToken });
      setSessions((prev) => prev.filter((s) => s.token !== sessionToken));
      toast.success("Session révoquée");
    } catch {
      toast.error("Impossible de révoquer cette session");
    }
    setSessionLoading(null);
  };

  const handleRevokeAllOtherSessions = async () => {
    setRevokeAllLoading(true);
    try {
      await authClient.revokeSessions();
      setSessions((prev) => prev.filter((s) => s.token === currentSessionToken));
      toast.success("Toutes les autres sessions ont été révoquées");
    } catch {
      toast.error("Erreur lors de la révocation");
    }
    setRevokeAllLoading(false);
  };

  const handleLinkProvider = async (provider: "discord" | "google") => {
    try {
      await authClient.linkSocial({ provider, callbackURL: "/settings" });
    } catch {
      toast.error(`Impossible de lier ${PROVIDER_LABELS[provider]}`);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== "SUPPRIMER") return;
    setDeleteLoading(true);
    try {
      await authClient.deleteUser();
      toast.success("Compte supprimé. Au revoir !");
      router.push("/");
    } catch {
      toast.error("Erreur lors de la suppression du compte");
    }
    setDeleteLoading(false);
  };

  const otherSessions = sessions.filter((s) => s.token !== currentSessionToken);

  return (
    <div className="w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between px-1">
        <div className="space-y-1">
          <h1 className="text-3xl sm:text-4xl font-black font-sans tracking-tighter uppercase text-on-surface">
            Paramètres
          </h1>
          <p className="text-on-surface-variant font-medium max-w-lg text-sm sm:text-base">
            Gère ton identité, tes préférences visuelles et la sécurité de ton compte Azalée.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Avatar & Quick Settings (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Avatar Card */}
          <Card className="rounded-[32px] border-none shadow-sm bg-surface-container-lowest overflow-hidden">
            <CardContent className="p-8 flex flex-col items-center">
              <AvatarUpload
                currentAvatarUrl={profile.avatar_url}
                username={profile.username}
                userId={profile.id}
              />
              <div className="mt-8 text-center space-y-1 w-full">
                <p className="font-black text-xl text-on-surface uppercase tracking-tight truncate px-4">
                  {username || "Utilisateur"}
                </p>
                <div className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-surface-container-high">
                  <span className="text-xs font-bold text-on-surface-variant/70 uppercase tracking-wider">
                    {profile.role || "Membre"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Preferences Card */}
          <Card className="rounded-[32px] border-none shadow-sm bg-surface-container-lowest overflow-hidden">
            <CardHeader className="bg-surface-container-low/50 px-6 py-4 border-b border-outline-variant/5">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-secondary-container text-on-secondary-container">
                  <Palette className="size-4" />
                </div>
                <CardTitle className="text-sm font-black uppercase tracking-widest text-on-surface">
                  Interface
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-outline-variant/10">
                <div className="flex items-center justify-between p-6 hover:bg-surface-container-low/30 transition-colors">
                  <div className="flex items-start gap-4">
                    <Moon className="size-5 text-on-surface-variant mt-0.5" />
                    <div className="space-y-0.5">
                      <Label className="text-sm font-bold text-on-surface cursor-pointer">
                        Mode Sombre
                      </Label>
                      <p className="text-xs text-on-surface-variant font-medium opacity-70">
                        Thème sombre pour la nuit
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={theme === "dark"}
                    onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
                    className="data-[state=checked]:bg-primary"
                  />
                </div>

                <div className="flex items-center justify-between p-6 hover:bg-surface-container-low/30 transition-colors">
                  <div className="flex items-start gap-4">
                    <Bell className="size-5 text-on-surface-variant mt-0.5" />
                    <div className="space-y-0.5">
                      <Label className="text-sm font-bold text-on-surface cursor-pointer">
                        Notifications
                      </Label>
                      <p className="text-xs text-on-surface-variant font-medium opacity-70">
                        Alertes importantes
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={notifications}
                    onCheckedChange={setNotifications}
                    className="data-[state=checked]:bg-primary"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Identity, Email, Password, Sessions, Linked, Danger (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Identity Section */}
          <Card className="rounded-[32px] border-none shadow-sm bg-surface-container-lowest overflow-hidden">
            <CardHeader className="bg-surface-container-low px-8 py-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary rounded-2xl text-on-primary shadow-lg shadow-primary/20 shrink-0">
                  <User className="size-6" strokeWidth={2.5} />
                </div>
                <div>
                  <CardTitle className="font-black font-sans text-xl uppercase tracking-tight">
                    Identité Publique
                  </CardTitle>
                  <CardDescription className="text-on-surface-variant/80 font-medium">
                    Informations visibles sur votre profil
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-8 space-y-8">
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-3">
                  <Label
                    htmlFor="username"
                    className="text-xs font-black uppercase tracking-widest text-on-surface-variant ml-1 flex items-center gap-2"
                  >
                    <AtSign className="size-3" /> Pseudonyme
                  </Label>
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="h-14 rounded-xl bg-surface-container-low/50 border-outline-variant/20 focus:bg-surface-container-low transition-all font-bold text-lg"
                    placeholder="Pseudo"
                  />
                </div>
                <div className="space-y-3">
                  <Label
                    htmlFor="fullname"
                    className="text-xs font-black uppercase tracking-widest text-on-surface-variant ml-1"
                  >
                    Nom complet
                  </Label>
                  <Input
                    id="fullname"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="h-14 rounded-xl bg-surface-container-low/50 border-outline-variant/20 focus:bg-surface-container-low transition-all font-bold text-lg"
                    placeholder="Prénom Nom"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <Label
                  htmlFor="website"
                  className="text-xs font-black uppercase tracking-widest text-on-surface-variant ml-1 flex items-center gap-2"
                >
                  <Globe className="size-3" /> Site Web / Réseaux
                </Label>
                <Input
                  id="website"
                  placeholder="https://twitter.com/..."
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  className="h-14 rounded-xl bg-surface-container-low/50 border-outline-variant/20 focus:bg-surface-container-low transition-all font-medium"
                />
              </div>

              <div className="space-y-3">
                <Label
                  htmlFor="bio"
                  className="text-xs font-black uppercase tracking-widest text-on-surface-variant ml-1"
                >
                  Biographie
                </Label>
                <Textarea
                  id="bio"
                  placeholder="Raconte-nous ton parcours de coach..."
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="min-h-[140px] rounded-xl bg-surface-container-low/50 border-outline-variant/20 focus:bg-surface-container-low transition-all font-medium resize-none text-base p-4"
                />
                <p className="text-xs text-on-surface-variant/60 text-right px-1">
                  {bio.length}/500
                </p>
              </div>

              <div className="pt-4 flex justify-end">
                <Button
                  onClick={handleSaveProfile}
                  disabled={loading}
                  size="lg"
                  className="rounded-full font-black uppercase tracking-widest text-xs bg-primary text-on-primary hover:bg-primary/90 shadow-xl shadow-primary/20 transition-all min-w-[160px]"
                >
                  {loading ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 size-4" />
                  )}
                  Sauvegarder
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Account Security Grid */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Email */}
            <Card className="rounded-[32px] border-none shadow-sm bg-surface-container-lowest overflow-hidden h-full">
              <CardHeader className="bg-surface-container-low/50 px-6 py-6 border-b border-outline-variant/5">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-tertiary/10 rounded-xl text-tertiary">
                    <Mail className="size-5" />
                  </div>
                  <CardTitle className="font-black font-sans text-lg uppercase tracking-tight">
                    Email
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant/10">
                  <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1">
                    Actuel
                  </p>
                  <p className="font-bold text-on-surface truncate" title={userEmail}>
                    {userEmail}
                  </p>
                </div>
                <div className="space-y-3">
                  <Label
                    htmlFor="new-email"
                    className="text-xs font-bold text-on-surface-variant ml-1"
                  >
                    Nouvelle adresse
                  </Label>
                  <Input
                    id="new-email"
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="exemple@email.com"
                    className="h-12 rounded-xl bg-surface-container-low/50 border-outline-variant/20"
                  />
                </div>
                <Button
                  onClick={handleChangeEmail}
                  disabled={emailLoading || !newEmail}
                  className="w-full rounded-full font-bold bg-tertiary text-on-tertiary hover:bg-tertiary/90"
                >
                  {emailLoading ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    "Modifier l'email"
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Password */}
            <Card className="rounded-[32px] border-none shadow-sm bg-surface-container-lowest overflow-hidden h-full">
              <CardHeader className="bg-surface-container-low/50 px-6 py-6 border-b border-outline-variant/5">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-error/10 rounded-xl text-error">
                    <Shield className="size-5" />
                  </div>
                  <CardTitle className="font-black font-sans text-lg uppercase tracking-tight">
                    Sécurité
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="space-y-3">
                  <Label
                    htmlFor="new-password"
                    className="text-xs font-bold text-on-surface-variant ml-1"
                  >
                    Nouveau mot de passe
                  </Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="h-12 rounded-xl bg-surface-container-low/50 border-outline-variant/20"
                  />
                </div>
                <div className="space-y-3">
                  <Label
                    htmlFor="confirm-password"
                    className="text-xs font-bold text-on-surface-variant ml-1"
                  >
                    Confirmer
                  </Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="h-12 rounded-xl bg-surface-container-low/50 border-outline-variant/20"
                  />
                </div>
                <Button
                  onClick={handleChangePassword}
                  disabled={passwordLoading || !newPassword || !confirmPassword}
                  className="w-full rounded-full font-bold bg-error text-on-error hover:bg-error/90"
                >
                  {passwordLoading ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    "Changer le mot de passe"
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Linked Accounts */}
          <Card className="rounded-[32px] border-none shadow-sm bg-surface-container-lowest overflow-hidden">
            <CardHeader className="bg-surface-container-low/50 px-6 py-6 border-b border-outline-variant/5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
                  <Link2 className="size-5" />
                </div>
                <div>
                  <CardTitle className="font-black font-sans text-lg uppercase tracking-tight">
                    Comptes liés
                  </CardTitle>
                  <CardDescription className="text-on-surface-variant/80 font-medium text-xs mt-1">
                    Connecte tes comptes Discord et Google pour te connecter plus facilement
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-outline-variant/10">
                {(["discord", "google"] as const).map((provider) => {
                  const linked = linkedAccounts.find((a) => a.provider_id === provider);
                  return (
                    <div
                      key={provider}
                      className="flex items-center justify-between p-6 hover:bg-surface-container-low/30 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`p-2.5 rounded-xl ${provider === "discord" ? "bg-[#5865F2]/10 text-[#5865F2]" : "bg-surface-container-high text-on-surface"}`}
                        >
                          {provider === "discord" ? (
                            <svg className="size-5" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z" />
                            </svg>
                          ) : (
                            <svg className="size-5" viewBox="0 0 48 48">
                              <path
                                fill="#EA4335"
                                d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                              />
                              <path
                                fill="#4285F4"
                                d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                              />
                              <path
                                fill="#FBBC05"
                                d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                              />
                              <path
                                fill="#34A853"
                                d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                              />
                            </svg>
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-on-surface text-sm">
                            {PROVIDER_LABELS[provider]}
                          </p>
                          <p className="text-xs text-on-surface-variant">
                            {linked ? `Lié le ${formatDate(linked.created_at)}` : "Non connecté"}
                          </p>
                        </div>
                      </div>
                      {!linked && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleLinkProvider(provider)}
                          className="rounded-full text-xs font-bold"
                        >
                          Lier
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Active Sessions */}
          <Card className="rounded-[32px] border-none shadow-sm bg-surface-container-lowest overflow-hidden">
            <CardHeader className="bg-surface-container-low/50 px-6 py-6 border-b border-outline-variant/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-secondary/10 rounded-xl text-secondary">
                    <Monitor className="size-5" />
                  </div>
                  <div>
                    <CardTitle className="font-black font-sans text-lg uppercase tracking-tight">
                      Sessions actives
                    </CardTitle>
                    <CardDescription className="text-on-surface-variant/80 font-medium text-xs mt-1">
                      {sessions.length} session{sessions.length !== 1 ? "s" : ""} active
                      {sessions.length !== 1 ? "s" : ""}
                    </CardDescription>
                  </div>
                </div>
                {otherSessions.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRevokeAllOtherSessions}
                    disabled={revokeAllLoading}
                    className="rounded-full text-xs font-bold text-error border-error/30 hover:bg-error/5"
                  >
                    {revokeAllLoading ? (
                      <Loader2 className="mr-1 size-3 animate-spin" />
                    ) : (
                      <LogOut className="mr-1 size-3" />
                    )}
                    Tout révoquer
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-outline-variant/10">
                {sessions.map((s) => {
                  const { device, browser } = parseUserAgent(s.userAgent);
                  const isCurrent = s.token === currentSessionToken;
                  return (
                    <div
                      key={s.token}
                      className="flex items-center justify-between p-6 hover:bg-surface-container-low/30 transition-colors"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <div
                          className={`p-2.5 rounded-xl shrink-0 ${isCurrent ? "bg-primary/10 text-primary" : "bg-surface-container-high text-on-surface-variant"}`}
                        >
                          {device === "Mobile" ? (
                            <Smartphone className="size-5" />
                          ) : (
                            <Monitor className="size-5" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-on-surface text-sm truncate">
                              {browser} — {device}
                            </p>
                            {isCurrent && (
                              <span className="shrink-0 text-[10px] font-black uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                                Actuelle
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-on-surface-variant truncate">
                            {s.ipAddress || "IP inconnue"} — {formatDate(s.createdAt)}
                          </p>
                        </div>
                      </div>
                      {!isCurrent && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRevokeSession(s.token)}
                          disabled={sessionLoading === s.token}
                          className="shrink-0 rounded-full text-error hover:bg-error/10 hover:text-error"
                        >
                          {sessionLoading === s.token ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <X className="size-4" />
                          )}
                        </Button>
                      )}
                    </div>
                  );
                })}
                {sessions.length === 0 && (
                  <div className="p-6 text-center text-on-surface-variant text-sm">
                    Aucune session trouvée
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="rounded-[32px] border-none shadow-sm bg-error-container/20 overflow-hidden">
            <CardHeader className="bg-error/5 px-6 py-6 border-b border-error/10">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-error/10 rounded-xl text-error">
                  <AlertTriangle className="size-5" />
                </div>
                <div>
                  <CardTitle className="font-black font-sans text-lg uppercase tracking-tight text-error">
                    Zone de danger
                  </CardTitle>
                  <CardDescription className="text-on-surface-variant/80 font-medium text-xs mt-1">
                    Actions irréversibles sur ton compte
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <p className="text-sm text-on-surface-variant">
                La suppression de ton compte est <strong className="text-error">définitive</strong>.
                Toutes tes données (profil, équipes, préférences) seront perdues.
              </p>
              <div className="space-y-3">
                <Label
                  htmlFor="delete-confirm"
                  className="text-xs font-bold text-on-surface-variant ml-1"
                >
                  Tape <span className="font-black text-error">SUPPRIMER</span> pour confirmer
                </Label>
                <Input
                  id="delete-confirm"
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  placeholder="SUPPRIMER"
                  className="h-12 rounded-xl bg-surface-container-lowest border-error/20 focus:border-error"
                />
              </div>
              <Button
                onClick={handleDeleteAccount}
                disabled={deleteLoading || deleteConfirm !== "SUPPRIMER"}
                className="w-full rounded-full font-bold bg-error text-on-error hover:bg-error/90"
              >
                {deleteLoading ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 size-4" />
                )}
                Supprimer définitivement mon compte
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
