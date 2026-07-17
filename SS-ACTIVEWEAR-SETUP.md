# S&S Activewear Phase 1 setup

## Credentials required
S&S documents HTTP Basic authentication where the **username is your S&S account number** and the **password is your API key**. This is not your ordinary website password and S&S does not document an OAuth login flow.

1. Sign in to your S&S Activewear customer account.
2. Find the API / integrations area and create or copy the API key associated with your account.
3. If the key is not visible, contact `api@ssactivewear.com` and request REST API access for your account number.
4. In PrintFlow, open **Dashboard → Integrations → S&S Activewear**.
5. Enter the account number and API key. PrintFlow tests them against the S&S Categories endpoint before saving.

## Required Vercel environment variable
Add `PRINTFLOW_ENCRYPTION_KEY` in Vercel → Project Settings → Environment Variables. Use a long random value (at least 32 characters) and enable it for Production, Preview and Development. Redeploy after adding it.

Do not change this encryption key after shops connect S&S. Changing it makes existing encrypted supplier credentials unreadable and each shop would need to reconnect.

## Safe ordering default
The integration defaults to **Test orders**. S&S documents that test orders are created and canceled. Keep this enabled while testing imports and order submission. A shop owner must explicitly switch to **Live wholesale orders** before PrintFlow will submit a live purchase.

## Phase 1 behavior
- Search styles from the dashboard.
- Import selected colors and all available size SKUs.
- Save S&S front, back and swatch image URLs with the PrintFlow product.
- Display the selected color's real front image in the public designer.
- Save exact supplier SKUs and cost/inventory snapshots with the customer design.
- Show an Order Blanks control on paid orders.

Front/back artwork editing is Phase 2. Phase 1 stores the back images now so that upgrade will not require re-importing products.
