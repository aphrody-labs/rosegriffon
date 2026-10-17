"use client";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@rosegriffon/ui";
import { useCallback, useRef, useState, type ReactNode } from "react";

import { AlertTriangle } from "@/lib/icons-config";

interface ConfirmationDialogProps {
  open: boolean;
  title: string;
  description?: string;
  message: string;
  danger?: boolean;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function ConfirmationDialog({
  open,
  title,
  description,
  message,
  danger = false,
  confirmText = "Confirmer",
  cancelText = "Annuler",
  onConfirm,
  onCancel,
  isLoading = false,
}: ConfirmationDialogProps) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  };

  const dangerColor = danger ? "destructive" : "default";

  return (
    <Dialog open={open} onOpenChange={newOpen => !newOpen && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-2">
            {danger && <AlertTriangle className="size-5 text-destructive" />}
            <DialogTitle>{title}</DialogTitle>
          </div>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <p className="text-muted-foreground py-4">{message}</p>

        <DialogFooter className="gap-3">
          <Button variant="outline" onClick={onCancel} disabled={loading || isLoading}>
            {cancelText}
          </Button>
          <Button
            variant={dangerColor}
            onClick={handleConfirm}
            disabled={loading || isLoading}
          >
            {loading || isLoading ? "Chargement…" : confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  danger?: boolean;
}

/**
 * Remplace `window.confirm` : renvoie `confirm(options)` (promesse de booléen)
 * et l'élément `dialog` à rendre une fois dans le composant.
 */
export function useConfirm(): {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  dialog: ReactNode;
} {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((next: ConfirmOptions) => {
    setOptions(next);
    return new Promise<boolean>(resolve => {
      resolver.current = resolve;
    });
  }, []);

  const settle = (value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setOptions(null);
  };

  const dialog = (
    <ConfirmationDialog
      open={options !== null}
      title={options?.title ?? ""}
      message={options?.message ?? ""}
      confirmText={options?.confirmText}
      danger={options?.danger}
      onConfirm={() => settle(true)}
      onCancel={() => settle(false)}
    />
  );

  return { confirm, dialog };
}
