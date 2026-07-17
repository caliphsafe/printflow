-- PrintFlow Mockup & Upload UX v4
-- Raises customer production artwork uploads to 100 MB and hardens product image storage.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  26214400,
  array['image/png','image/jpeg','image/webp','image/svg+xml']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 26214400,
  allowed_mime_types = array['image/png','image/jpeg','image/webp','image/svg+xml'];

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'artwork',
  'artwork',
  false,
  104857600,
  array['image/png','image/jpeg','image/webp','image/svg+xml']
)
on conflict (id) do update set
  public = false,
  file_size_limit = 104857600,
  allowed_mime_types = array['image/png','image/jpeg','image/webp','image/svg+xml'];

update public.shops
set settings = jsonb_set(
  coalesce(settings, '{}'::jsonb),
  '{upload}',
  coalesce(settings->'upload', '{}'::jsonb) || jsonb_build_object(
    'maxBytes', 104857600,
    'acceptedTypes', jsonb_build_array('image/png','image/jpeg','image/webp','image/svg+xml')
  ),
  true
);

notify pgrst, 'reload schema';
