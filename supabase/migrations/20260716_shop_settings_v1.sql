-- PrintFlow visual shop settings / public logo storage.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'branding',
  'branding',
  true,
  5242880,
  array['image/png','image/jpeg','image/webp','image/svg+xml']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

update public.shops
set settings = jsonb_set(
  jsonb_set(
    coalesce(settings, '{}'::jsonb),
    '{business}',
    coalesce(settings->'business', '{"contactEmail":"","phone":"","address":""}'::jsonb),
    true
  ),
  '{customerExperience}',
  coalesce(settings->'customerExperience', '{
    "headline":"Design your custom shirts",
    "introduction":"Upload your artwork, position it on the shirt, assign the sizes, then continue to secure checkout.",
    "uploadInstructions":"Upload a high-resolution PNG, JPG, WEBP or SVG for the best print quality.",
    "turnaroundTime":"Standard turnaround is confirmed by the print shop after artwork review.",
    "artworkDisclaimer":"Your preview is a placement guide. Final print size and color may be adjusted for production quality.",
    "confirmationMessage":"Your design is attached and ready for checkout."
  }'::jsonb),
  true
)
where settings is not null;
