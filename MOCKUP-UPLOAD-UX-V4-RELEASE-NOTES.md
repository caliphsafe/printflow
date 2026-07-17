# Mockup + Upload UX v4 release notes

- Replaced the garment-image multipart endpoint with signed direct-to-Supabase uploads.
- Added extension-aware JPEG validation for browsers that report `image/jpg` or an empty MIME type.
- Added visible uploading, success, and error feedback for every front/back garment image.
- Increased the product garment-image bucket limit to 25 MB.
- Increased customer production artwork uploads to 100 MB.
- Updated existing shop upload settings to 100 MB through an additive migration.
- Switched large artwork previews from base64 FileReader data to memory-safer object URLs.
- Added customer **Save mockup** PNG downloads for front and back.
- Added completion-screen mockup download actions.
- Replaced print-area number steppers with typed decimal inch fields.
- Added responsive layout hardening for the product editor, color image cards, designer workspace, quantity controls, and narrow mobile screens.
- Corrected the customer completion request to use the existing `/api/designs/complete` route.
