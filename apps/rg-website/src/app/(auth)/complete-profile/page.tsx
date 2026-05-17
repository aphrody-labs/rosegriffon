"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/auth-context";
import { AlertCircle, CheckCircle } from "@/lib/icons-config";

export default function CompleteProfilePage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Rediriger si pas d'utilisateur
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  const handleSkip = async () => {
    // Marquer le profil comme complété même si l'utilisateur passe
    try {
      await fetch("/api/auth/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: user?.name || user?.email?.split("@")[0],
          bio: "",
        }),
      });
    } catch (error) {
      console.error("Error marking profile as complete:", error);
    }
    router.push("/");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Sauvegarder le profil utilisateur via une route API
      const response = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: displayName || user?.name,
          bio,
        }),
      });

      if (!response.ok) {
        throw new Error("Erreur lors de la mise à jour du profil");
      }

      setSuccess(true);
      setTimeout(() => {
        router.push("/");
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-900/50">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader>
            <Skeleton className="h-8 w-3/4 mb-2" />
            <Skeleton className="h-4 w-2/3" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="w-full min-h-[calc(100vh-10rem)] flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-900/50">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Complétez votre profil</CardTitle>
          <CardDescription>
            {success ? "Profil mis à jour avec succès ! 🎉" : "Aidez-nous à mieux vous connaître"}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {success && (
            <Alert className="mb-4 border-green-500 text-green-700 dark:text-green-400">
              <CheckCircle className="size-4" />
              <AlertDescription>Bienvenue sur Rose Griffon !</AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="size-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email (lecture seule) */}
            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                Email
              </label>
              <Input
                type="email"
                value={user.email || ""}
                disabled
                className="bg-gray-100 dark:bg-gray-800"
              />
            </div>

            {/* Nom d'affichage */}
            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                Nom d'affichage
              </label>
              <Input
                type="text"
                placeholder="Comment voulez-vous être appelé ?"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={50}
                disabled={isLoading || success}
              />
              <p className="text-xs text-gray-500 mt-1">{displayName.length}/50 caractères</p>
            </div>

            {/* Bio */}
            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                Bio (optionnel)
              </label>
              <textarea
                placeholder="Dites-nous un peu sur vous..."
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={200}
                disabled={isLoading || success}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-hidden focus:ring-2 focus:ring-rose-500 dark:focus:ring-rose-400 resize-none"
                rows={4}
              />
              <p className="text-xs text-gray-500 mt-1">{bio.length}/200 caractères</p>
            </div>

            {/* Boutons */}
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleSkip}
                disabled={isLoading}
                className="flex-1"
              >
                Passer
              </Button>
              <Button type="submit" disabled={isLoading || success} className="flex-1 gap-2">
                {isLoading && <Loader2 className="size-4 animate-spin" />}
                {success ? "Redirection..." : "Continuer"}
              </Button>
            </div>

            <p className="text-xs text-gray-500 text-center">
              Vous pourrez modifier ces informations plus tard
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
