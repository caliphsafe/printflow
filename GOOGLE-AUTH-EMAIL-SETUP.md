# PrintFlow Google Sign-In and Email Delivery Setup

## 1. Production application URLs

In Supabase, open Authentication → URL Configuration.

Set the Site URL to the exact production origin, for example:

https://printflow.example.com

Add these Redirect URLs:

- https://printflow.example.com/auth/callback
- https://printflow.example.com/onboarding
- https://printflow.example.com/account/setup-password

Use your real production domain and do not add a trailing slash.

## 2. Enable Google sign-in

### Google Cloud

1. Open Google Cloud and create or select the PrintFlow project.
2. Open Google Auth Platform.
3. Configure the application name, support email, audience, and branding.
4. Create an OAuth client.
5. Choose Web application.
6. Under Authorized JavaScript origins, add the PrintFlow production origin.
7. Under Authorized redirect URIs, add the Supabase callback URL shown on the Supabase Google provider page. It normally follows this format:

https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback

8. Save the Google Client ID and Client Secret.

### Supabase

1. Open Authentication → Sign In / Providers.
2. Open Google.
3. Enable the provider.
4. Paste the Google Client ID and Client Secret.
5. Save.

PrintFlow does not require an additional Vercel environment variable for Google sign-in. Supabase manages the provider credentials.

## 3. Configure production email delivery

Google sign-in avoids the email-confirmation step, but email/password signup and platform-admin invitations still require reliable email delivery.

In Supabase, open Authentication → Email → SMTP Settings.

Connect a production SMTP provider such as:

- Resend
- Postmark
- SendGrid
- Amazon SES
- Brevo

Enter the provider's:

- Sender name
- Sender email
- SMTP host
- SMTP port
- SMTP username
- SMTP password

Use a sender address on the PrintFlow domain, such as:

accounts@yourdomain.com

## 4. Review email templates

In Supabase, open Authentication → Email Templates.

Review these templates:

- Confirm signup
- Invite user
- Reset password

Keep the confirmation action connected to the Supabase confirmation URL variable. Use clear PrintFlow language and explain where the button will take the user.

## 5. Test the complete flow

### Google

1. Open /signup in a private browser.
2. Select Create account with Google.
3. Choose a Google account.
4. Confirm the browser returns to /onboarding.
5. Complete the Business step.

### Email signup

1. Create a new account using email and password.
2. Confirm the new guided inbox screen appears.
3. Open the confirmation email.
4. Select the confirmation button.
5. Confirm the browser returns to /onboarding.

### Platform invitation

1. Sign in as the PrintFlow platform administrator.
2. Open Platform admin → User management.
3. Create a new shop account.
4. Open the invitation email.
5. Create a password.
6. Confirm guided onboarding opens.
