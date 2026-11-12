-- Schema `nie` (Part 4): Fast Wiki, Website & Interface Normalized Projections
-- High-performance views bridging VFS, CFS binary formats, Lua scripts and public game entities.

-- 1. Full Character Sheet with VFS Assets, 3D Models & Cut-in Motions
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

-- 2. Full Skill / Hissatsu Sheet with VFS Animations, Cut-in Assets & Lua Logic
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

-- 3. Item Catalog with Drops, Source Battles and VFS Sprites
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

-- 4. VFS Hierarchical Explorer View for Studio & CDN proxy
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

-- 5. Lua API & Event Catalog for Community, Bots & Modding
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

-- Permissions
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nie_reader') THEN
        GRANT SELECT ON ALL TABLES IN SCHEMA nie TO nie_reader;
    END IF;
END
$$;

INSERT INTO nie.schema_version (version) VALUES (4) ON CONFLICT DO NOTHING;
