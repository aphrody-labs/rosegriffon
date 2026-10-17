-- Avatar `chara_edit` du jeu sur le profil : code de partage (69 caractères)
-- de l'avatar dont l'instantané est posé dans `profiles.avatar_url`.
-- Le portrait de la banque de personnages n'a pas besoin de colonne : son URL
-- CDN est directement enregistrée dans `avatar_url`.
--
-- Appliquer :
--   supabase db query --linked --project-ref xzwfnxzkxtcpgmtqulbh -f apps/rg-website/sql/migrations/20261017_profiles_game_avatar.sql

begin;

alter table public.profiles add column if not exists game_avatar text;

alter table public.profiles drop constraint if exists profiles_game_avatar_format;
alter table public.profiles
	add constraint profiles_game_avatar_format
	check (game_avatar is null or char_length(game_avatar) = 69);

comment on column public.profiles.game_avatar is
	'Code de partage chara_edit (69 car.) de l''avatar du jeu choisi ; null si la photo vient d''un téléversement ou d''un portrait de la banque.';

commit;
