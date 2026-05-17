-- Migration pour corriger la contrainte NOT NULL sur start_time
-- Permettre les horaires aléatoires ou indéterminés

-- Créer une nouvelle table temporaire
ALTER TABLE stream_schedules DROP CONSTRAINT stream_schedules_pkey;

-- Recréer la table sans la contrainte NOT NULL sur start_time
CREATE TABLE stream_schedules_new (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_week INT NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  streamer_name VARCHAR(255) NOT NULL,
  start_time TIME,
  end_time TIME,
  category VARCHAR(255) DEFAULT 'Gameplay',
  status VARCHAR(50) DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Copier les données
INSERT INTO stream_schedules_new SELECT * FROM stream_schedules;

-- Supprimer l'ancienne table
DROP TABLE stream_schedules;

-- Renommer la nouvelle table
ALTER TABLE stream_schedules_new RENAME TO stream_schedules;

-- Recréer les index et triggers
CREATE INDEX idx_stream_schedules_day ON stream_schedules(day_of_week);

CREATE OR REPLACE FUNCTION update_stream_schedules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_stream_schedules_updated_at
BEFORE UPDATE ON stream_schedules
FOR EACH ROW
EXECUTE FUNCTION update_stream_schedules_updated_at();

-- Réactiver RLS
ALTER TABLE stream_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access" ON stream_schedules
FOR SELECT USING (true);

CREATE POLICY "Allow admin updates" ON stream_schedules
FOR UPDATE USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);
