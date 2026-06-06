-- Migration : table `inagle_rag_edges` — graphe de liens RAG (additif, zéro-clobber).
-- À appliquer côté Supabase via SQL editor, `supabase db push`, ou le script
-- `scripts/rag-build-edges.ts` (qui applique ce DDL programmatiquement via Bun SQL).
--
-- Conception :
--   - Graphe orienté reliant entrées de jeu (cfg.bin/lua), assets, modèles et
--     textures. Une arête = (src, dst, relation) avec poids + métadonnées jsonb.
--   - Sources de construction : asset-cross-reference.json (références),
--     character-model/face-manifest (has_face), item-image-manifest (has_icon),
--     miximax-icon-manifest (has_miximax_icon). Voir le script pour les règles.
--   - Idempotent : UPSERT sur la clé primaire (src, dst, relation).
--   - Espaces de noms des nœuds : `entry:<file>`, `lua:<file>`, `asset:<path>`,
--     `texture:<path>`, `model:<code>`, `face:<code>`, `item:<id>`,
--     `character:<code>`, `miximax:<code>`.

CREATE TABLE IF NOT EXISTS public.inagle_rag_edges (
  src        text        NOT NULL,
  dst        text        NOT NULL,
  relation   text        NOT NULL,
  weight     real        NOT NULL DEFAULT 1,
  meta       jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (src, dst, relation)
);

CREATE INDEX IF NOT EXISTS inagle_rag_edges_src_idx      ON public.inagle_rag_edges (src);
CREATE INDEX IF NOT EXISTS inagle_rag_edges_dst_idx      ON public.inagle_rag_edges (dst);
CREATE INDEX IF NOT EXISTS inagle_rag_edges_relation_idx ON public.inagle_rag_edges (relation);
CREATE INDEX IF NOT EXISTS inagle_rag_edges_meta_idx     ON public.inagle_rag_edges USING gin (meta jsonb_path_ops);
