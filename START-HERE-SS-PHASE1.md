# PrintFlow — S&S Activewear Phase 1

1. Upload this project over the current GitHub repository.
2. In Vercel, add `PRINTFLOW_ENCRYPTION_KEY` with a long random value and redeploy.
3. Run `supabase/migrations/20260716_ss_activewear_phase1.sql` once in Supabase SQL Editor.
4. Open Dashboard → Integrations and connect the shop's S&S account number and API key.
5. Keep Order mode set to Test orders while setting up.
6. Enter the print shop's blank-order delivery address and save.
7. Open Dashboard → Products → Import from S&S.
8. Search a style, select colors, and import it.
9. Set customer package prices and checkout URLs on the imported product.
10. Test the public designer and a paid-order blank submission.

See `SS-ACTIVEWEAR-SETUP.md` for credential and ordering details.
