-- Migration 0005: PostgreSQL Trigram Acceleration for VFS & Lua Lookups
-- Enables sub-millisecond LIKE/ILIKE pattern matching across 255,000+ files and 600+ scripts.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS vfs_file_filename_trgm_idx ON nie.vfs_file USING gin (filename gin_trgm_ops);
CREATE INDEX IF NOT EXISTS vfs_file_path_trgm_idx ON nie.vfs_file USING gin (path gin_trgm_ops);
CREATE INDEX IF NOT EXISTS lua_script_name_trgm_idx ON nie.lua_script USING gin (name gin_trgm_ops);

INSERT INTO nie.schema_version (version) VALUES (5) ON CONFLICT DO NOTHING;
