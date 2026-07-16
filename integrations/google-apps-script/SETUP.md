# Google Drive + Google Sheet setup

This script must be created and deployed while signed in as the printing
company. It then writes every paid order into that company's own Google Drive
and spreadsheet.

## 1. Create the Apps Script

1. Sign in to the printing company's Google account.
2. Open `https://script.google.com`.
3. Create a new project named `PrintFlow Order Receiver`.
4. Replace the contents of `Code.gs` with the included `Code.gs`.
5. Save the project.
6. Select `setupIntegration` from the function menu and click Run.
7. Approve the Drive and Sheets permissions.
8. Open the execution log and save:
   - `ROOT_FOLDER_ID`
   - `SPREADSHEET_ID`
   - `WEBHOOK_SECRET`

The setup function creates:

- A Google Drive folder named `PrintFlow Orders`
- A Google Sheet named `PrintFlow Orders`
- A secret used to authenticate incoming order deliveries

## 2. Deploy as a web app

1. Click **Deploy → New deployment**.
2. Select **Web app**.
3. Execute as: **Me**
4. Who has access: **Anyone**
5. Deploy and copy the web app URL.

## 3. Add the integration to Supabase

Insert one row into `shop_integrations` using:

- `shop_id`: the shop UUID from the `shops` table
- `squarespace_api_key`: the Squarespace Commerce API key
- `google_web_app_url`: the deployed Apps Script URL
- `google_webhook_secret`: the secret printed by `setupIntegration`

Keep all four values private.
