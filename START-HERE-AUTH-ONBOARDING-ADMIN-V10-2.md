# Start Here — PrintFlow v10.2

## GitHub

Replace the existing project with the contents of this release folder.

Do not upload:

- node_modules
- .next
- .env.local
- build logs

## Supabase SQL

No new SQL migration is required for this release.

The existing platform administration tables from v10 must already be installed.

## Supabase Authentication

Complete the steps in GOOGLE-AUTH-EMAIL-SETUP.md.

Required production changes:

- Add /auth/callback to Redirect URLs
- Enable Google provider
- Configure Google Client ID and Client Secret
- Configure custom SMTP for email signup and platform invitations

## Vercel

No new environment variable is required.

Keep the existing variables:

- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- NEXT_PUBLIC_SITE_URL
- NEXT_PUBLIC_APP_URL
- PRINTFLOW_ENCRYPTION_KEY
- PRINTFLOW_BILLING_STRIPE_SECRET_KEY

Redeploy after replacing the project files.

## Testing

1. Test Google signup.
2. Test Google login for an existing user.
3. Test email signup and confirmation.
4. Test confirmation resend.
5. Complete every onboarding section.
6. Skip one section and confirm it can be completed later.
7. Open Integrations and review credential instructions.
8. Open Suppliers and review S&S credential instructions.
9. Sign in as caliph.safe@gmail.com.
10. Create a shop account from User management.
11. Accept the invitation and create a password.
12. Review Growth intelligence and download the cadence report.
13. Delete a temporary test account using typed confirmation.
