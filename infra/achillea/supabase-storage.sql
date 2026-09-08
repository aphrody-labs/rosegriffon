-- Configuration declarative du Storage Achillea.
-- A appliquer uniquement au projet Supabase Achillea dedie, apres sauvegarde.
-- Le backend utilise la cle service_role : aucun droit INSERT/UPDATE/DELETE
-- n'est accorde aux roles anon ou authenticated par ce fichier.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
	'images',
	'images',
	true,
	6291456,
	array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml']
)
on conflict (id) do update
set
	public = excluded.public,
	file_size_limit = excluded.file_size_limit,
	allowed_mime_types = excluded.allowed_mime_types;

-- Les preuves de litige ne sont jamais publiques. Le backend persiste une
-- reference opaque et produit une URL signee de courte duree a la lecture.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
	'ranked-proofs',
	'ranked-proofs',
	false,
	6291456,
	array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set
	public = excluded.public,
	file_size_limit = excluded.file_size_limit,
	allowed_mime_types = excluded.allowed_mime_types;

-- Defense en profondeur : seuls les appels backend service_role ecrivent.
revoke insert, update, delete on table storage.objects from anon, authenticated;

-- Nettoyage des anciennes politiques Achillea connues. Le REVOKE ci-dessus
-- reste la barriere globale meme si une politique portant un autre nom existe.
drop policy if exists "achillea images anon insert" on storage.objects;
drop policy if exists "achillea images authenticated insert" on storage.objects;
drop policy if exists "achillea images anon update" on storage.objects;
drop policy if exists "achillea images authenticated update" on storage.objects;
drop policy if exists "achillea images anon delete" on storage.objects;
drop policy if exists "achillea images authenticated delete" on storage.objects;
