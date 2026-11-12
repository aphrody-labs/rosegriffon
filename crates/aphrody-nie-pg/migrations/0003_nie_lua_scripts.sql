-- Schema `nie` (Part 3): Lua 5.2.4 Bytecode, Decompiled Source, AST & Hooks Catalog
-- Conforms strictly to Lua 5.2.4 specifications and Level-5 Inazuma Eleven .lua.bin specs.

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

-- Synchronizer from public.inagle_lua_scripts to nie.lua_*
CREATE OR REPLACE PROCEDURE nie.sync_lua_from_inagle() AS $$
BEGIN
    -- 1. Sync Scripts
    INSERT INTO nie.lua_script (
        id, path, name, category,
        num_functions,
        header_meta,
        updated_at
    )
    SELECT
        s.id,
        COALESCE(v.path, 'script/' || s.name || '.lua.bin') AS path,
        s.name,
        COALESCE(s.category, 'script') AS category,
        COALESCE(jsonb_array_length(s.functions), 0)::integer AS num_functions,
        jsonb_build_object(
            'version', s.version,
            'hash', s.hash,
            'calls', s.calls
        ) AS header_meta,
        COALESCE(s.updated_at, now())
    FROM public.inagle_lua_scripts s
    LEFT JOIN nie.vfs_file v ON v.filename = s.name || '.lua.bin' OR v.filename = s.name
    ON CONFLICT (id) DO UPDATE
    SET name          = EXCLUDED.name,
        category      = EXCLUDED.category,
        num_functions = EXCLUDED.num_functions,
        header_meta   = EXCLUDED.header_meta,
        updated_at    = EXCLUDED.updated_at;

    -- 2. Extract string literals into nie.lua_string_ref
    INSERT INTO nie.lua_string_ref (script_id, value, kind, occurrences)
    SELECT
        s.id AS script_id,
        elem.value::text AS value,
        'literal' AS kind,
        1 AS occurrences
    FROM public.inagle_lua_scripts s,
    LATERAL jsonb_array_elements_text(s.strings) AS elem(value)
    WHERE elem.value IS NOT NULL AND length(elem.value) > 0
    ON CONFLICT (script_id, value, kind) DO UPDATE
    SET occurrences = nie.lua_string_ref.occurrences + 1;
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

INSERT INTO nie.schema_version (version) VALUES (3) ON CONFLICT DO NOTHING;
