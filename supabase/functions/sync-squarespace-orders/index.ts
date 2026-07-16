import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Integration = {
  shop_id: string;
  squarespace_api_key: string;
  google_web_app_url: string;
  google_webhook_secret: string;
  last_order_sync: string;
};

type SquarespaceCustomization = {
  label?: string;
  value?: string;
};

type SquarespaceLineItem = {
  customizations?: SquarespaceCustomization[];
};

type SquarespaceOrder = {
  id: string;
  orderNumber?: string;
  createdOn?: string;
  modifiedOn?: string;
  customerEmail?: string;
  paymentState?: string;
  grandTotal?: { currency?: string; value?: number };
  shippingAddress?: Record<string, unknown>;
  billingAddress?: Record<string, unknown>;
  lineItems?: SquarespaceLineItem[];
};

function corsResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

function findDesignIds(order: SquarespaceOrder) {
  const ids = new Set<string>();

  for (const lineItem of order.lineItems ?? []) {
    for (const customization of lineItem.customizations ?? []) {
      if (
        customization.label?.trim().toLowerCase() === "design id" &&
        customization.value
      ) {
        ids.add(customization.value.trim().toUpperCase());
      }
    }
  }

  return [...ids];
}

function toHex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function signPayload(payloadB64: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payloadB64)
  );

  return toHex(signature);
}

Deno.serve(async () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return corsResponse({ error: "Missing Supabase function secrets." }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
  });

  const { data: integrations, error: integrationsError } = await supabase
    .from("shop_integrations")
    .select(
      "shop_id, squarespace_api_key, google_web_app_url, google_webhook_secret, last_order_sync"
    )
    .eq("active", true);

  if (integrationsError) {
    console.error(integrationsError);
    return corsResponse({ error: "Unable to load integrations." }, 500);
  }

  const results: Array<Record<string, unknown>> = [];

  for (const integration of (integrations ?? []) as Integration[]) {
    const modifiedAfter = new Date(
      new Date(integration.last_order_sync).getTime() - 5 * 60 * 1000
    ).toISOString();

    const ordersUrl = new URL(
      "https://api.squarespace.com/1.0/commerce/orders"
    );
    ordersUrl.searchParams.set("modifiedAfter", modifiedAfter);

    try {
      const ordersResponse = await fetch(ordersUrl, {
        headers: {
          Authorization: `Bearer ${integration.squarespace_api_key}`,
          "User-Agent": "PrintFlow Customizer order sync"
        }
      });

      if (!ordersResponse.ok) {
        throw new Error(
          `Squarespace returned ${ordersResponse.status}: ${await ordersResponse.text()}`
        );
      }

      const ordersData = await ordersResponse.json();
      const orders = (ordersData.result ?? []) as SquarespaceOrder[];

      for (const order of orders) {
        if (order.paymentState !== "PAID") continue;

        for (const displayId of findDesignIds(order)) {
          const { data: design, error: designError } = await supabase
            .from("designs")
            .select("*")
            .eq("shop_id", integration.shop_id)
            .eq("display_id", displayId)
            .single();

          if (designError || !design) {
            results.push({
              displayId,
              orderId: order.id,
              outcome: "design_not_found"
            });
            continue;
          }

          if (design.status === "delivered") {
            results.push({
              displayId,
              orderId: order.id,
              outcome: "already_delivered"
            });
            continue;
          }

          const [originalUrl, previewUrl] = await Promise.all([
            supabase.storage
              .from("artwork")
              .createSignedUrl(design.original_artwork_path, 3600),
            supabase.storage
              .from("previews")
              .createSignedUrl(design.preview_path, 3600)
          ]);

          if (originalUrl.error || previewUrl.error) {
            throw new Error("Unable to create temporary file links.");
          }

          const deliveryPayload = {
            designId: design.display_id,
            orderId: order.id,
            orderNumber: order.orderNumber ?? "",
            paidAt: order.modifiedOn ?? order.createdOn ?? new Date().toISOString(),
            customer: {
              name: design.customer_name,
              email: order.customerEmail ?? design.customer_email,
              phone: design.customer_phone ?? ""
            },
            product: {
              name: design.product_name,
              package: design.package_label,
              quantity: design.package_quantity,
              price: design.package_price,
              shirtColor: design.shirt_color_name,
              printLocation: design.print_location,
              sizes: design.size_breakdown
            },
            notes: design.customer_notes ?? "",
            checkout: {
              grandTotal: order.grandTotal ?? null,
              shippingAddress: order.shippingAddress ?? null,
              billingAddress: order.billingAddress ?? null
            },
            files: {
              original: {
                filename: design.original_filename,
                mimeType: design.original_mime_type,
                signedUrl: originalUrl.data.signedUrl
              },
              preview: {
                filename: `${design.display_id}-preview.png`,
                mimeType: "image/png",
                signedUrl: previewUrl.data.signedUrl
              }
            }
          };

          const payloadJson = JSON.stringify(deliveryPayload);
          const payloadB64 = btoa(
            String.fromCharCode(...new TextEncoder().encode(payloadJson))
          );
          const signature = await signPayload(
            payloadB64,
            integration.google_webhook_secret
          );

          const googleResponse = await fetch(integration.google_web_app_url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ payloadB64, signature })
          });

          if (!googleResponse.ok) {
            throw new Error(
              `Google receiver returned ${googleResponse.status}: ${await googleResponse.text()}`
            );
          }

          const googleResult = await googleResponse.json();

          if (!googleResult.ok) {
            throw new Error(
              `Google receiver rejected the order: ${
                googleResult.error || "Unknown receiver error"
              }`
            );
          }

          const { error: updateError } = await supabase
            .from("designs")
            .update({
              status: "delivered",
              squarespace_order_id: order.id,
              squarespace_order_number: order.orderNumber ?? null,
              paid_at:
                order.modifiedOn ?? order.createdOn ?? new Date().toISOString(),
              delivered_at: new Date().toISOString(),
              sync_error: null,
              updated_at: new Date().toISOString()
            })
            .eq("id", design.id);

          if (updateError) throw updateError;

          results.push({
            displayId,
            orderId: order.id,
            outcome: "delivered",
            google: googleResult
          });
        }
      }

      await supabase
        .from("shop_integrations")
        .update({
          last_order_sync: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq("shop_id", integration.shop_id);
    } catch (error) {
      console.error(error);
      results.push({
        shopId: integration.shop_id,
        outcome: "sync_failed",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return corsResponse({ ok: true, results });
});
