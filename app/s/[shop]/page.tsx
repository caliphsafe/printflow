import { notFound } from "next/navigation";
import DesignerApp from "@/components/DesignerApp";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { normalizeConfiguration } from "@/lib/catalog";
import {
  DEFAULT_PRICING_PROFILE,
  normalizePricingProfile
} from "@/lib/pricing-settings";
import type {
  CatalogProduct,
  PublicShop,
  ShopSettings
} from "@/lib/types";
import { normalizeShopSettings } from "@/lib/shop-settings";
import { platformShopAccess } from "@/lib/shop-mode";
import { hydrateSanMarProductRowsWithFlatMedia } from "@/lib/sanmar-flat-media";
import { decodeProductNameFields } from "@/lib/html-entities";
import { collapseAdvancedSanMarRows, isAdvancedShop } from "@/lib/advanced-sanmar-catalog";

type Props = {
  params: Promise<{ shop: string }>;
  searchParams: Promise<{ embed?: string }>;
};

export const dynamic = "force-dynamic";

function isLiveCustomProduct(
  product: CatalogProduct
) {
  const category = String(
    product.configuration.customization.category || ""
  ).trim().toLowerCase();
  const slug = String(product.slug || "").trim().toLowerCase();
  const name = String(product.name || "").trim().toLowerCase();

  // School uniforms remain in catalog_products and in their dedicated
  // storefront_products collection, but never enter the custom apparel catalog.
  if (
    category === "school uniform" ||
    category === "school uniforms" ||
    slug.startsWith("espirito-") ||
    name.includes("espirito santo")
  ) {
    return false;
  }

  const supplier =
    product.configuration.supplier;

  return supplier?.sourceMode !== "demo";
}

export default async function ShopDesignerPage({
  params,
  searchParams
}: Props) {
  const [{ shop: slug }, query] = await Promise.all([params, searchParams]);
  const supabase = createSupabaseAdmin();

  const { data, error } = await supabase
    .from("shops")
    .select(
      "id,slug,name,settings,active"
    )
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data) notFound();

  if (
    !platformShopAccess(data.settings)
      .customPrint
  ) {
    notFound();
  }

  const settings = normalizeShopSettings(
    data.settings as ShopSettings
  );

  if (!data.active) {
    return (
      <main
        className="storefront-offline-shell"
        style={
          {
            "--brand":
              settings.brand.primaryColor,
            "--brand-text":
              settings.brand.textColor,
            "--brand-surface":
              settings.brand.surfaceColor ||
              "#f4f4ef"
          } as React.CSSProperties
        }
      >
        <section className="storefront-offline-card">
          {settings.brand.logoUrl ? (
            <img
              src={settings.brand.logoUrl}
              alt={data.name}
            />
          ) : (
            <span>
              {data.name
                .slice(0, 1)
                .toUpperCase()}
            </span>
          )}

          <p className="eyebrow">
            STOREFRONT PREPARATION
          </p>

          <h1>
            {data.name} is getting ready
            to take orders.
          </h1>

          <p>
            This custom apparel storefront
            has not been published yet.
            Please check back soon or contact
            the shop directly.
          </p>
        </section>
      </main>
    );
  }

  const [
    { data: productRows },
    { data: pricingRow },
    { count: paymentCount }
  ] = await Promise.all([
    supabase
      .from("catalog_products")
      .select(
        "id,slug,name,description,active,configuration"
      )
      .eq("shop_id", data.id)
      .eq("active", true)
      .order("created_at", {
        ascending: true
      }),

    supabase
      .from("shop_pricing_profiles")
      .select("configuration")
      .eq("shop_id", data.id)
      .maybeSingle(),

    supabase
      .from("integration_connections")
      .select("id", {
        count: "exact",
        head: true
      })
      .eq("shop_id", data.id)
      .eq("category", "payment")
      .eq("status", "connected")
  ]);

  /*
    Existing SanMar products may have been imported before PrintFlow learned
    to distinguish FlatFront/FlatBack from ModelFront/ModelBack.

    Hydrate their image fields from the CURRENT SanMar SFTP cache before the
    storefront is built. This makes old products display flat garment images
    immediately without requiring a customer-facing re-import.
  */
  const flatRows =
    await hydrateSanMarProductRowsWithFlatMedia(
      supabase,
      data.id,
      productRows || [],
      {
        persist: false,
        allowLiveSanMarLookups: false
      }
    );

  // One card per SanMar style, including colors imported in separate batches.
  // This is a read-only safeguard; the Advanced admin persists the merge.
  const uniqueRows = isAdvancedShop(data.id)
    ? collapseAdvancedSanMarRows(flatRows).products
    : flatRows;

  const products: CatalogProduct[] =
    uniqueRows
      .map((row) => {
        const decoded = decodeProductNameFields(row);
        return {
          ...decoded,
          configuration: normalizeConfiguration(decoded.configuration)
        };
      })
      .filter((item) =>
        isLiveCustomProduct(item)
      );

  const shop: PublicShop = {
    ...data,
    settings,
    pricing: normalizePricingProfile(
      pricingRow?.configuration ||
        DEFAULT_PRICING_PROFILE
    ),
    products,
    embedMode: query.embed === "1",
    paymentReady:
      Number(paymentCount || 0) > 0
  };

  return <DesignerApp shop={shop} />;
}
