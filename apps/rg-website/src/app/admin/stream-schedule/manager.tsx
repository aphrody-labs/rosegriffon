"use client";

import { Calendar, Edit2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AdminCard } from "@/components/admin/shared/AdminCard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { StreamSchedule } from "@/types/rg";

import { addSchedule, deleteSchedule, syncWithGoogleCalendar, updateSchedule } from "./actions";

const DAYS = [
  { value: "1", label: "Lundi" },
  { value: "2", label: "Mardi" },
  { value: "3", label: "Mercredi" },
  { value: "4", label: "Jeudi" },
  { value: "5", label: "Vendredi" },
  { value: "6", label: "Samedi" },
  { value: "0", label: "Dimanche" },
];

const STATUSES = [
  { value: "active", label: "Actif" },
  { value: "inactive", label: "Inactif" },
  { value: "coming_soon", label: "À venir" },
];

interface StreamScheduleManagerProps {
  initialSchedules: StreamSchedule[];
}

export function StreamScheduleManager({ initialSchedules }: StreamScheduleManagerProps) {
  const router = useRouter();
  const [schedules, setSchedules] = useState<StreamSchedule[]>(initialSchedules);
  const [syncing, setSyncing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    day_of_week: "1",
    streamer_name: "",
    start_time: "20:00",
    end_time: "23:00",
    category: "Gameplay",
    status: "active" as "active" | "inactive" | "coming_soon",
    notes: "",
  });

  // Update local state when props change
  useEffect(() => {
    setSchedules(initialSchedules);
  }, [initialSchedules]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await syncWithGoogleCalendar();
      if (result.success) {
        toast.success(`Synchronisation réussie (${result.count} événements)`);
        router.refresh();
      } else {
        toast.error(result.error || "Erreur de synchronisation");
      }
    } catch (error) {
      toast.error("Erreur inattendue");
      console.error(error);
    } finally {
      setSyncing(false);
    }
  };

  const handleAddOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.streamer_name.trim()) {
      toast.error("Entrez un nom de streamer");
      return;
    }

    try {
      if (editingId) {
        const result = await updateSchedule(editingId, {
          ...formData,
          day_of_week: parseInt(formData.day_of_week, 10),
        });
        if (result.success) {
          toast.success("Horaire mis à jour");
          router.refresh();
          setEditingId(null);
          resetForm();
        } else {
          toast.error(result.error || "Erreur lors de la mise à jour");
        }
      } else {
        const result = await addSchedule({
          ...formData,
          day_of_week: parseInt(formData.day_of_week, 10),
        });
        if (result.success) {
          toast.success("Horaire ajouté");
          router.refresh();
          resetForm();
        } else {
          toast.error(result.error || "Erreur lors de l'ajout");
        }
      }
    } catch (error) {
      toast.error("Erreur");
      console.error(error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cet horaire ?")) return;

    try {
      const result = await deleteSchedule(id);
      if (result.success) {
        toast.success("Horaire supprimé");
        router.refresh();
      } else {
        toast.error(result.error || "Erreur lors de la suppression");
      }
    } catch (error) {
      toast.error("Erreur");
      console.error(error);
    }
  };

  const handleEdit = (schedule: StreamSchedule) => {
    setFormData({
      day_of_week: String(schedule.day_of_week),
      streamer_name: schedule.streamer_name,
      start_time: schedule.start_time ? schedule.start_time.slice(0, 5) : "20:00",
      end_time: schedule.end_time ? schedule.end_time.slice(0, 5) : "23:00",
      category: schedule.category || "Gameplay",
      status: (schedule.status as "active" | "inactive" | "coming_soon") || "active",
      notes: schedule.notes || "",
    });
    setEditingId(schedule.id);
  };

  const resetForm = () => {
    setFormData({
      day_of_week: "1",
      streamer_name: "",
      start_time: "20:00",
      end_time: "23:00",
      category: "Gameplay",
      status: "active",
      notes: "",
    });
    setEditingId(null);
  };

  return (
    <div className="space-y-6">
      <Alert>
        <Calendar className="size-4" />
        <AlertTitle>Synchronisation Google Calendar</AlertTitle>
        <AlertDescription className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Le planning est synchronisé automatiquement avec le calendrier Google &quot;Rose Griffon
            TV&quot;. Les modifications manuelles ci-dessous seront écrasées lors de la prochaine
            synchronisation.
          </span>
          <Button
            onClick={handleSync}
            disabled={syncing}
            variant="outline"
            size="sm"
            className="shrink-0"
          >
            <RefreshCw className={`mr-2 size-4 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Synchro..." : "Forcer la synchro"}
          </Button>
        </AlertDescription>
      </Alert>

      {/* Formulaire */}
      <AdminCard
        title={editingId ? "Modifier un horaire" : "Ajouter un nouvel horaire"}
        icon={editingId ? <Edit2 className="size-5" /> : <Plus className="size-5" />}
      >
        <form onSubmit={handleAddOrUpdate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="day">Jour</Label>
              <Select
                value={formData.day_of_week}
                onValueChange={(value) => setFormData({ ...formData, day_of_week: value })}
              >
                <SelectTrigger id="day">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAYS.map((day) => (
                    <SelectItem key={day.value} value={day.value}>
                      {day.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="streamer">Streamer</Label>
              <Input
                id="streamer"
                value={formData.streamer_name}
                onChange={(e) => setFormData({ ...formData, streamer_name: e.target.value })}
                placeholder="Nom du streamer"
              />
            </div>

            <div>
              <Label htmlFor="start-time">Heure de début</Label>
              <Input
                id="start-time"
                type="time"
                value={formData.start_time}
                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="end-time">Heure de fin (optionnel)</Label>
              <Input
                id="end-time"
                type="time"
                value={formData.end_time}
                onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="category">Catégorie</Label>
              <Input
                id="category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="Ex: Gameplay, Art, Débat"
              />
            </div>

            <div>
              <Label htmlFor="status">Statut</Label>
              <Select
                value={formData.status}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    status: value as "active" | "inactive" | "coming_soon",
                  })
                }
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="notes">Notes (optionnel)</Label>
            <Input
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Ajouter des notes"
            />
          </div>

          <div className="flex gap-2">
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
              {editingId ? "Mettre à jour" : "Ajouter"}
            </Button>
            {editingId && (
              <Button type="button" variant="outline" onClick={resetForm}>
                Annuler
              </Button>
            )}
          </div>
        </form>
      </AdminCard>

      {/* Liste des horaires */}
      <AdminCard
        title={`Horaires existants (${schedules.length})`}
        icon={<Calendar className="size-5" />}
      >
        <div className="space-y-2">
          {schedules.length === 0 ? (
            <p className="text-muted-foreground">Aucun horaire</p>
          ) : (
            schedules.map((schedule) => (
              <div
                key={schedule.id}
                className="flex items-center justify-between p-3 border rounded-lg border-border"
              >
                <div className="flex-1">
                  <p className="font-semibold">
                    {DAYS.find((d) => d.value === String(schedule.day_of_week))?.label || "Inconnu"}{" "}
                    - {schedule.streamer_name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {schedule.start_time}
                    {schedule.end_time && ` - ${schedule.end_time}`} • {schedule.category} •{" "}
                    {schedule.status}
                  </p>
                  {schedule.notes && (
                    <p className="text-xs text-muted-foreground italic">Notes: {schedule.notes}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleEdit(schedule)}>
                    <Edit2 className="size-4" />
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => handleDelete(schedule.id)}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </AdminCard>
    </div>
  );
}
