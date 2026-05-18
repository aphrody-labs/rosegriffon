"use client";

import { Input } from "@rosegriffon/ui";
import React from "react";

import { Eye, EyeOff } from "@/lib/icons-config";
import { cn } from "@/lib/utils";

interface PasswordStrength {
  score: number;
  level: "very-weak" | "weak" | "fair" | "good" | "strong" | "very-strong";
  meetsRequirements: {
    minLength: boolean;
    hasUpperCase: boolean;
    hasLowerCase: boolean;
    hasNumber: boolean;
    hasSpecialChar: boolean;
  };
}

interface EnhancedPasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  showStrength?: boolean;
  strength?: PasswordStrength | null;
  showToggle?: boolean;
  isVisible?: boolean;
  onToggleVisibility?: () => void;
}

const strengthColors = {
  "very-weak": "bg-red-600",
  weak: "bg-red-500",
  fair: "bg-yellow-500",
  good: "bg-blue-500",
  strong: "bg-green-500",
  "very-strong": "bg-green-600",
};

const strengthLabels = {
  "very-weak": "Très faible",
  weak: "Faible",
  fair: "Acceptable",
  good: "Bon",
  strong: "Fort",
  "very-strong": "Très fort",
};

/**
 * Composant Input personnalisé pour les mots de passe
 * avec indicateur de force et toggle show/hide
 */
export const EnhancedPasswordInput = React.forwardRef<HTMLInputElement, EnhancedPasswordInputProps>(
  (
    {
      label,
      error,
      showStrength = false,
      strength,
      showToggle = true,
      isVisible = false,
      onToggleVisibility,
      className,
      ...props
    },
    ref
  ) => {
    return (
      <div className="space-y-2">
        {label && (
          <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
            {label}
          </label>
        )}

        <div className="relative">
          <Input
            ref={ref}
            type={isVisible ? "text" : "password"}
            className={cn("pr-10", error && "border-red-500 focus:ring-red-500", className)}
            {...props}
          />

          {showToggle && onToggleVisibility && (
            <button
              type="button"
              onClick={onToggleVisibility}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              aria-label={isVisible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            >
              {isVisible ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
            </button>
          )}
        </div>

        {/* Indicateur de force */}
        {showStrength && strength && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                Force du mot de passe
              </span>
              <span
                className={cn(
                  "text-xs font-semibold",
                  strengthColors[strength.level].replace("bg-", "text-")
                )}
              >
                {strengthLabels[strength.level]}
              </span>
            </div>

            {/* Barre de progression */}
            <div className="h-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full transition-all duration-300 rounded-full",
                  strengthColors[strength.level]
                )}
                style={{ width: `${strength.score}%` }}
              />
            </div>

            {/* Critères */}
            {strength.score < 80 && (
              <div className="space-y-1">
                <p className="text-xs text-gray-600 dark:text-gray-400">Critères manquants :</p>
                <ul className="space-y-1">
                  {!strength.meetsRequirements.minLength && (
                    <li className="text-xs text-gray-500 dark:text-gray-500">
                      • Au moins 8 caractères
                    </li>
                  )}
                  {!strength.meetsRequirements.hasUpperCase && (
                    <li className="text-xs text-gray-500 dark:text-gray-500">
                      • Une lettre majuscule (A-Z)
                    </li>
                  )}
                  {!strength.meetsRequirements.hasLowerCase && (
                    <li className="text-xs text-gray-500 dark:text-gray-500">
                      • Une lettre minuscule (a-z)
                    </li>
                  )}
                  {!strength.meetsRequirements.hasNumber && (
                    <li className="text-xs text-gray-500 dark:text-gray-500">• Un chiffre (0-9)</li>
                  )}
                  {!strength.meetsRequirements.hasSpecialChar && (
                    <li className="text-xs text-gray-500 dark:text-gray-500">
                      • Un caractère spécial (!@#$%^&* etc.)
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Message d'erreur */}
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>
    );
  }
);

EnhancedPasswordInput.displayName = "EnhancedPasswordInput";