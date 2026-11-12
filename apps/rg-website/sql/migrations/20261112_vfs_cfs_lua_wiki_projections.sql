-- Migration: 20261112_vfs_cfs_lua_wiki_projections.sql
-- Unified VFS, CFS Binaries, Lua 5.2.4 Bytecode & Fast Wiki SQL Projections
-- Conforms strictly to Level-5 / Criware and Rose Griffon 2026 database architecture.

-- 1. Create Schema `nie`
CREATE SCHEMA IF NOT EXISTS nie;

CREATE TABLE IF NOT EXISTS nie.schema_version (
    version    integer PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Cfg.bin Decoded Binary Tables
CREATE TABLE IF NOT EXISTS nie.cfgbin_file (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    path        text        NOT NULL UNIQUE,
    format      text        NOT NULL CHECK (format IN ('rdbn', 't2b')),
    sha256      bytea       NOT NULL CHECK (octet_length(sha256) = 32),
    byte_size   integer     NOT NULL CHECK (byte_size >= 0),
    imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nie.rdbn_list (
    id        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    file_id   bigint  NOT NULL REFERENCES nie.cfgbin_file (id) ON DELETE CASCADE,
    ord       integer NOT NULL,
    name      text    NOT NULL,
    type_name text    NOT NULL,
    UNIQUE (file_id, ord)
);

CREATE TABLE IF NOT EXISTS nie.rdbn_value (
    list_id    bigint   NOT NULL REFERENCES nie.rdbn_list (id) ON DELETE CASCADE,
    row_idx    integer  NOT NULL,
    field_idx  smallint NOT NULL,
    field_name text     NOT NULL,
    kind       smallint NOT NULL,
    v_int      bigint,
    v_real     double precision,
    v_text     text,
    v_vec      real[],
    v_bytes    bytea,
    PRIMARY KEY (list_id, row_idx, field_idx)
);

CREATE INDEX IF NOT EXISTS rdbn_value_field_name ON nie.rdbn_value (field_name);

CREATE TABLE IF NOT EXISTS nie.t2b_entry (
    file_id    bigint   NOT NULL REFERENCES nie.cfgbin_file (id) ON DELETE CASCADE,
    idx        integer  NOT NULL,
    parent_idx integer,
    depth      smallint NOT NULL,
    name       text     NOT NULL,
    PRIMARY KEY (file_id, idx)
);

CREATE INDEX IF NOT EXISTS t2b_entry_name ON nie.t2b_entry (name);

CREATE TABLE IF NOT EXISTS nie.t2b_var (
    file_id   bigint   NOT NULL,
    entry_idx integer  NOT NULL,
    ord       smallint NOT NULL,
    kind      smallint NOT NULL CHECK (kind IN (0, 1, 2)),
    v_int     integer,
    v_real    real,
    v_text    text,
    PRIMARY KEY (file_id, entry_idx, ord),
    FOREIGN KEY (file_id, entry_idx) REFERENCES nie.t2b_entry (file_id, idx) ON DELETE CASCADE
);

-- 3. VFS & CFS Binary Assets
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

-- 4. Lua 5.2.4 Bytecode & Scripts
CREATE TABLE IF NOT EXISTS nie.lua_script (
    id              text        PRIMARY KEY,
    vfs_file_id     bigint      REFERENCES nie.vfs_file(id) ON DELETE SET NULL,
    path            text        NOT NULL UNIQUE,
    name            text        NOT NULL,
    category        text        NOT NULL DEFAULT 'script',
    lua_version     text        NOT NULL DEFAULT '5.2.4',
    is_compiled     boolean     NOT NULL DEFAULT true,
    sha256          bytea       CHECK (sha256 IS NULL OR octet_length(sha256) = 32),
    byte_size       integer     NOT NULL DEFAULT 0,
    num_functions   integer     NOT NULL DEFAULT 0,
    num_upvalues    integer     NOT NULL DEFAULT 0,
    num_constants   integer     NOT NULL DEFAULT 0,
    source_code     text,
    ast             jsonb       NOT NULL DEFAULT '{}'::jsonb,
    header_meta     jsonb       NOT NULL DEFAULT '{}'::jsonb,
    event_hooks     text[]      NOT NULL DEFAULT '{}'::text[],
    crc32_tokens    text[]      NOT NULL DEFAULT '{}'::text[],
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lua_script_name_idx ON nie.lua_script (lower(name));
CREATE INDEX IF NOT EXISTS lua_script_category_idx ON nie.lua_script (category);
CREATE INDEX IF NOT EXISTS lua_script_hooks_gin_idx ON nie.lua_script USING gin (event_hooks);
CREATE INDEX IF NOT EXISTS lua_script_crc32_gin_idx ON nie.lua_script USING gin (crc32_tokens);

CREATE TABLE IF NOT EXISTS nie.lua_function (
    id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    script_id         text        NOT NULL REFERENCES nie.lua_script(id) ON DELETE CASCADE,
    proto_idx         integer     NOT NULL,
    name              text,
    line_start        integer     NOT NULL DEFAULT 0,
    line_end          integer     NOT NULL DEFAULT 0,
    param_count       smallint    NOT NULL DEFAULT 0,
    is_vararg         boolean     NOT NULL DEFAULT false,
    max_stack_size    smallint    NOT NULL DEFAULT 0,
    instruction_count integer     NOT NULL DEFAULT 0,
    upvalue_count     smallint    NOT NULL DEFAULT 0,
    disassembly       jsonb       NOT NULL DEFAULT '[]'::jsonb,
    constants         jsonb       NOT NULL DEFAULT '[]'::jsonb,
    local_vars        jsonb       NOT NULL DEFAULT '[]'::jsonb,
    UNIQUE (script_id, proto_idx)
);

CREATE INDEX IF NOT EXISTS lua_function_script_id_idx ON nie.lua_function (script_id);
CREATE INDEX IF NOT EXISTS lua_function_name_idx ON nie.lua_function (name) WHERE name IS NOT NULL;

CREATE TABLE IF NOT EXISTS nie.lua_string_ref (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    script_id   text        NOT NULL REFERENCES nie.lua_script(id) ON DELETE CASCADE,
    value       text        NOT NULL,
    kind        text        NOT NULL DEFAULT 'literal' CHECK (kind IN ('literal', 'global_call', 'table_key', 'identifier')),
    occurrences integer     NOT NULL DEFAULT 1,
    UNIQUE (script_id, value, kind)
);

CREATE INDEX IF NOT EXISTS lua_string_ref_val_idx ON nie.lua_string_ref (value);
CREATE INDEX IF NOT EXISTS lua_string_ref_script_id_idx ON nie.lua_string_ref (script_id);

-- 5. Fast Wiki Projections & Views
CREATE OR REPLACE VIEW nie.v_wiki_chara_sheet AS
SELECT
    c.id,
    c.chara_id,
    c.internal_code,
    c.name_fr,
    c.name_en,
    c.name_ja,
    c.description_fr,
    c.description_en,
    c.rarity,
    c.rarity_code,
    c.element,
    c.position,
    c.gender,
    c.image_url,
    c.series,
    c.slug,
    c.team_id,
    c.stat_frappe,
    c.stat_controle,
    c.stat_technique,
    c.stat_pression,
    c.stat_physique,
    c.stat_agilite,
    c.stat_intelligence,
    c.stat_total,
    c.model_id,
    vf_model.path  AS vfs_model_path,
    vf_model.cdn_url AS cdn_model_url,
    vf_tex.path    AS vfs_texture_path,
    vf_tex.cdn_url AS cdn_texture_url,
    c.stats,
    c.skills,
    c.teams,
    c.created_at
FROM public.inagle_characters c
LEFT JOIN nie.vfs_file vf_model
    ON vf_model.format_kind = 'model'
    AND c.model_id IS NOT NULL
    AND vf_model.filename LIKE '%' || c.model_id || '%'
LEFT JOIN nie.vfs_file vf_tex
    ON vf_tex.format_kind = 'texture'
    AND c.model_id IS NOT NULL
    AND vf_tex.filename LIKE '%' || c.model_id || '%';

CREATE OR REPLACE VIEW nie.v_wiki_skill_sheet AS
SELECT
    s.id,
    s.name_fr,
    s.name_en,
    s.name_ja,
    s.description_fr,
    s.description_en,
    s.category,
    s.element,
    s.power_min,
    s.power_max,
    s.tp_cost,
    s.tension_cost,
    s.image_url,
    ci.event_id_name AS cutin_event_name,
    cia.data         AS cutin_asset_data,
    lua.id           AS lua_script_id,
    lua.category     AS lua_category,
    vf_anim.path     AS vfs_anim_path,
    vf_anim.cdn_url  AS cdn_anim_url,
    s.data,
    s.updated_at
FROM public.inagle_skills s
LEFT JOIN public.inagle_skill_cutins ci
    ON ci.skill_id = s.id
LEFT JOIN public.inagle_skill_cutin_assets cia
    ON cia.event_id_name = ci.event_id_name
LEFT JOIN nie.lua_script lua
    ON lua.name LIKE '%' || lower(replace(s.id, '-', '_')) || '%'
LEFT JOIN nie.vfs_file vf_anim
    ON vf_anim.format_kind = 'animation'
    AND ci.event_id_name IS NOT NULL
    AND vf_anim.filename LIKE '%' || ci.event_id_name || '%';

CREATE OR REPLACE VIEW nie.v_wiki_item_sheet AS
SELECT
    i.id,
    i.name_fr,
    i.name_en,
    i.name_ja,
    i.description_fr,
    i.description_en,
    i.category,
    i.rarity,
    i.buy_price,
    i.sell_price,
    i.boost_type,
    i.effect_value,
    i.image_url,
    vf_ico.path    AS vfs_icon_path,
    vf_ico.cdn_url AS cdn_icon_url,
    i.data,
    i.updated_at
FROM public.inagle_items i
LEFT JOIN nie.vfs_file vf_ico
    ON vf_ico.format_kind = 'texture'
    AND vf_ico.filename LIKE '%' || lower(replace(i.id, '-', '_')) || '%';

CREATE OR REPLACE VIEW nie.v_vfs_explorer AS
SELECT
    f.id,
    f.path,
    f.parent_dir,
    f.filename,
    f.extension,
    f.format_kind,
    f.byte_size,
    f.compressed_size,
    f.compression_codec,
    f.mime_type,
    f.cdn_url,
    a.name AS archive_name,
    a.kind AS archive_kind,
    f.indexed_at
FROM nie.vfs_file f
LEFT JOIN nie.vfs_archive a ON a.id = f.archive_id;

CREATE OR REPLACE VIEW nie.v_lua_catalog AS
SELECT
    s.id,
    s.name,
    s.category,
    s.lua_version,
    s.num_functions,
    s.num_constants,
    s.event_hooks,
    s.header_meta,
    f.vfs_path,
    f.cdn_url
FROM nie.lua_script s
LEFT JOIN (
    SELECT id, path AS vfs_path, cdn_url FROM nie.vfs_file
) f ON f.id = s.vfs_file_id;

-- 6. Role & Permissions
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nie_reader') THEN
        CREATE ROLE nie_reader NOLOGIN;
    END IF;
END
$$;

GRANT USAGE ON SCHEMA nie TO nie_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA nie TO nie_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA nie GRANT SELECT ON TABLES TO nie_reader;

INSERT INTO nie.schema_version (version) VALUES (1), (2), (3), (4) ON CONFLICT DO NOTHING;
