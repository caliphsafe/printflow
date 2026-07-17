# PrintFlow Mockup + Upload UX v4

This release fixes garment mockup uploads, raises customer production artwork uploads to 100 MB, adds customer mockup downloads, replaces print-area number steppers with typed inch fields, and improves responsive behavior across the dashboard and public designer.

## Required deployment order

1. Upload the complete ZIP contents to the existing GitHub repository, replacing matching files.
2. Run `supabase/migrations/20260719_mockup_upload_ux_v4.sql` once in Supabase SQL Editor.
3. Confirm the existing Vercel environment variables are still present.
4. Allow the GitHub commit to deploy automatically in Vercel.
5. Test one manual product image upload before editing the rest of the catalog.

## What the Supabase migration changes

- `product-images` bucket: public, 25 MB per garment image, PNG/JPG/WEBP/SVG.
- `artwork` bucket: private, 100 MB per customer production artwork file, PNG/JPG/WEBP/SVG.
- Every existing shop's artwork upload setting is updated to 100 MB.

## Product image upload behavior

Product images are no longer posted through the Next.js server as multipart files. The admin API validates the file and creates a signed Supabase upload URL. The browser then uploads directly to Supabase Storage. This avoids server upload body limits and makes errors visible.

JPEG files are recognized by both MIME type and `.jpg` / `.jpeg` extension.

After an image uploads, it previews immediately in the product editor. Click **Save product** to publish the new URL to the customer catalog.

## Customer mockup behavior

When a customer chooses a product and color, the selected color's saved front or back garment image is displayed in the design workspace.

After uploading artwork, the customer can click **Save mockup** to download the active side as a PNG. For front-and-back orders, switch sides and save each mockup separately. The same download buttons remain available on the completion screen.

## Artwork upload behavior

Customer artwork uses direct signed Supabase uploads. The original high-resolution file is stored separately from the 800 × 800 production mockup. Browser previews use object URLs rather than converting a 100 MB file into a large base64 string.

Accepted artwork types remain PNG, JPG/JPEG, WEBP, and SVG because those formats can be previewed accurately in the browser designer.
