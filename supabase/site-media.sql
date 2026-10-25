-- Isolated public media for agi1.app/memes, uploaded by the signed owner at /owner.
-- Downloads are public. Upload/delete/update require the server's Storage service key
-- or its one-file signed upload token. No browser INSERT/UPDATE/DELETE policy is added.
-- Free plan global limit is 50 MB; this does not change plans or global limits.
begin;
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('agi1-owner-media', 'agi1-owner-media', true, 50000000,
  array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm'])
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
commit;
select id, public, file_size_limit, allowed_mime_types from storage.buckets where id = 'agi1-owner-media';
