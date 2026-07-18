# PrintFlow Production Readiness + Guided Setup v8.3

This release fixes storefront preview failures, preserves product editing when visiting global pricing, adds contextual dashboard help, and improves unpublished storefront behavior.

## Install

1. Replace the existing GitHub project with the contents of this folder.
2. Do not upload `node_modules`, `.next`, `package-lock.json`, `tsconfig.tsbuildinfo`, or `.env.local`.
3. Commit to the branch connected to Vercel.
4. No Supabase migration is required.
5. No new Vercel environment variables are required.

## Verify

- Open Dashboard → Shop setup → Preview storefront.
- Preview must work whether Storefront active is on or off.
- An inactive public `/s/SHOP-SLUG` URL should show a professional preparation page, not a load error.
- Open Dashboard → Products → Cost basis → Save & open production pricing.
- Publish pricing and confirm PrintFlow returns to the same product and Cost basis tab.
- Open Setup help from each dashboard category and confirm the guide changes with the page.
