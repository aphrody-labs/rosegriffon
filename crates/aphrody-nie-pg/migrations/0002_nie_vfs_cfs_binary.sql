-- Schema `nie` (Part 2): VFS & CFS Binary Assets Catalog
-- Conforms strictly to Level-5 Criware CPK, CFS and Binary Specs.

CREATE TABLE IF NOT EXISTS nie.vfs_archive (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name        text        NOT NULL UNIQUE,
    kind        text        NOT NULL DEFAULT 'cpk' CHECK (kind IN ('cpk', 'cfs', 'zip', 'tar', 'criware', 'loose')),
    file_count  integer     NOT NULL DEFAULT 0,
    total_bytes bigint      NOT NULL DEFAULT 0,
    toc_offset  bigint      NOT NULL DEFAULT 0,
    header_meta jsonb       NOT NULL DEFAULT '{}'::jsonb,
    indexed_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nie.vfs_file (
    id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    archive_id        bigint REFERENCES nie.vfs_archive(id) ON DELETE CASCADE,
    path              text        NOT NULL UNIQUE,
    parent_dir        text        NOT NULL,
    filename          text        NOT NULL,
    extension         text        NOT NULL DEFAULT '',
    format_kind       text        NOT NULL DEFAULT 'generic' CHECK (
        format_kind IN (
            'cfgbin', 'lua', 'texture', 'model', 'animation', 'audio',
            'video', 'vfx', 'collision', 'cfs_bin', 'archive', 'text', 'font', 'shader', 'generic'
        )
    ),
    byte_size         bigint      NOT NULL DEFAULT 0,
    compressed_size   bigint,
    compression_codec text CHECK (compression_codec IS NULL OR compression_codec IN ('crilayla', 'zlib', 'lz4', 'gzip', 'none')),
    sha256            bytea CHECK (sha256 IS NULL OR octet_length(sha256) = 32),
    crc32             text,
    mime_type         text        NOT NULL DEFAULT 'application/octet-stream',
    cdn_url           text,
    metadata          jsonb       NOT NULL DEFAULT '{}'::jsonb,
    indexed_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vfs_file_parent_dir_idx ON nie.vfs_file (parent_dir);
CREATE INDEX IF NOT EXISTS vfs_file_filename_idx ON nie.vfs_file (lower(filename));
CREATE INDEX IF NOT EXISTS vfs_file_extension_idx ON nie.vfs_file (extension);
CREATE INDEX IF NOT EXISTS vfs_file_format_kind_idx ON nie.vfs_file (format_kind);
CREATE INDEX IF NOT EXISTS vfs_file_archive_id_idx ON nie.vfs_file (archive_id);

CREATE TABLE IF NOT EXISTS nie.cfs_binary (
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    vfs_file_id   bigint      NOT NULL REFERENCES nie.vfs_file(id) ON DELETE CASCADE,
    magic         text        NOT NULL,
    format_name   text        NOT NULL,
    endianness    text        NOT NULL DEFAULT 'little' CHECK (endianness IN ('little', 'big')),
    version       integer     NOT NULL DEFAULT 1,
    header_size   integer     NOT NULL DEFAULT 0,
    payload_size  integer     NOT NULL DEFAULT 0,
    section_count integer     NOT NULL DEFAULT 0,
    sections      jsonb       NOT NULL DEFAULT '[]'::jsonb,
    symbols       jsonb       NOT NULL DEFAULT '[]'::jsonb,
    attributes    jsonb       NOT NULL DEFAULT '{}'::jsonb,
    parsed_at     timestamptz NOT NULL DEFAULT now(),
    UNIQUE (vfs_file_id, magic)
);

CREATE INDEX IF NOT EXISTS cfs_binary_magic_idx ON nie.cfs_binary (magic);
CREATE INDEX IF NOT EXISTS cfs_binary_format_idx ON nie.cfs_binary (format_name);

-- Helper function to classify VFS files into format kinds and MIME types
CREATE OR REPLACE FUNCTION nie.classify_vfs_entry(p_name text, p_ext text)
RETURNS TABLE(format_kind text, mime_type text) AS $$
BEGIN
    IF p_name LIKE '%.lua.bin' OR p_ext = 'lua' THEN
        RETURN QUERY SELECT 'lua'::text, 'application/x-lua-bytecode'::text;
    ELSIF p_name LIKE '%.cfg.bin' OR p_ext = 'rdbn' OR p_ext = 't2b' THEN
        RETURN QUERY SELECT 'cfgbin'::text, 'application/x-level5-cfgbin'::text;
    ELSIF p_ext IN ('g4tx', 'png', 'jpg', 'webp', 'dds', 'tga') THEN
        RETURN QUERY SELECT 'texture'::text, 'image/x-level5-g4tx'::text;
    ELSIF p_ext IN ('g4md', 'objbin', 'g4sk', 'g4nv') THEN
        RETURN QUERY SELECT 'model'::text, 'model/x-level5-g4md'::text;
    ELSIF p_ext IN ('g4mg', 'g4pkm', 'g4cm', 'p3lip') THEN
        RETURN QUERY SELECT 'animation'::text, 'application/x-level5-motion'::text;
    ELSIF p_ext IN ('acb', 'awb', 'adx', 'hca', 'sbnk', 'csb', 'wav') THEN
        RETURN QUERY SELECT 'audio'::text, 'audio/x-criware'::text;
    ELSIF p_ext IN ('usm', 'mp4') THEN
        RETURN QUERY SELECT 'video'::text, 'video/x-sofdec'::text;
    ELSIF p_ext IN ('vfxo', 'pfxo', 'ptlb', 'fxbin') THEN
        RETURN QUERY SELECT 'vfx'::text, 'application/x-level5-vfx'::text;
    ELSIF p_ext IN ('col') THEN
        RETURN QUERY SELECT 'collision'::text, 'application/x-level5-collision'::text;
    ELSIF p_ext IN ('g4pk', 'cpk', 'cfs', 'zip', 'tar') THEN
        RETURN QUERY SELECT 'archive'::text, 'application/x-level5-package'::text;
    ELSIF p_ext IN ('mevbin', 'bin') THEN
        RETURN QUERY SELECT 'cfs_bin'::text, 'application/octet-stream'::text;
    ELSE
        RETURN QUERY SELECT 'generic'::text, 'application/octet-stream'::text;
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Incremental Synchronizer from public.inagle_cpk_index to nie.vfs_*
CREATE OR REPLACE PROCEDURE nie.sync_vfs_from_cpk_index() AS $$
BEGIN
    -- 1. Sync Archives
    INSERT INTO nie.vfs_archive (name, kind, file_count)
    SELECT cpk, 'cpk', count(*)::integer
    FROM public.inagle_cpk_index
    GROUP BY cpk
    ON CONFLICT (name) DO UPDATE
    SET file_count = EXCLUDED.file_count,
        indexed_at = now();

    -- 2. Sync Files
    INSERT INTO nie.vfs_file (
        archive_id, path, parent_dir, filename, extension,
        format_kind, mime_type, cdn_url
    )
    SELECT
        a.id AS archive_id,
        c.path,
        c.dir AS parent_dir,
        c.name AS filename,
        c.ext AS extension,
        k.format_kind,
        k.mime_type,
        'https://assets.rosegriffon.fr/vfs/' || encode(digest(c.path, 'sha256'), 'hex') || '/' || c.name AS cdn_url
    FROM public.inagle_cpk_index c
    JOIN nie.vfs_archive a ON a.name = c.cpk
    CROSS JOIN LATERAL nie.classify_vfs_entry(c.name, c.ext) k
    ON CONFLICT (path) DO UPDATE
    SET archive_id  = EXCLUDED.archive_id,
        parent_dir  = EXCLUDED.parent_dir,
        filename    = EXCLUDED.filename,
        extension   = EXCLUDED.extension,
        format_kind = EXCLUDED.format_kind,
        mime_type   = EXCLUDED.mime_type,
        cdn_url     = EXCLUDED.cdn_url,
        indexed_at  = now();
END;
$$ LANGUAGE plpgsql;

-- Permissions
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nie_reader') THEN
        GRANT SELECT ON ALL TABLES IN SCHEMA nie TO nie_reader;
    END IF;
END
$$;

INSERT INTO nie.schema_version (version) VALUES (2) ON CONFLICT DO NOTHING;
