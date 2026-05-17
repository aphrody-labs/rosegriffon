-- Table pour les horaires de stream (planning hebdomadaire)
CREATE TABLE IF NOT EXISTS stream_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time time,
  end_time time,
  title text NOT NULL,
  description text,
  game text,
  is_recurring boolean DEFAULT true,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Créer un index sur day_of_week pour les requêtes par jour
CREATE INDEX IF NOT EXISTS idx_stream_schedules_day ON stream_schedules(day_of_week);

-- Créer un index sur user_id pour les requêtes par utilisateur
CREATE INDEX IF NOT EXISTS idx_stream_schedules_user ON stream_schedules(user_id);

-- Enable RLS
ALTER TABLE stream_schedules ENABLE ROW LEVEL SECURITY;

-- Policy pour lecture publique
CREATE POLICY IF NOT EXISTS "Stream schedules are viewable by everyone"
  ON stream_schedules FOR SELECT
  USING (true);

-- Policy pour création (utilisateurs authentifiés)
CREATE POLICY IF NOT EXISTS "Users can create their own stream schedules"
  ON stream_schedules FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy pour mise à jour (propriétaire seulement)
CREATE POLICY IF NOT EXISTS "Users can update their own stream schedules"
  ON stream_schedules FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy pour suppression (propriétaire seulement)
CREATE POLICY IF NOT EXISTS "Users can delete their own stream schedules"
  ON stream_schedules FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Fonction pour mettre à jour automatiquement updated_at
CREATE OR REPLACE FUNCTION update_stream_schedules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour mettre à jour updated_at
DROP TRIGGER IF EXISTS stream_schedules_updated_at ON stream_schedules;
CREATE TRIGGER stream_schedules_updated_at
  BEFORE UPDATE ON stream_schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_stream_schedules_updated_at();
