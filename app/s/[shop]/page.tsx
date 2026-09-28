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

type Props = {
  params: Promise<{ shop: string }>;
};

export const dynamic = "force-dynamic";

const ADVANCED_SHOP_SLUG =
  "advanced-embroidery-screen-printing";

function isLiveCustomProduct(
  product: CatalogProduct,
  shopSlug: string
) {
  const supplier =
    product.configuration.supplier;

  if (shopSlug === ADVANCED_SHOP_SLUG) {
    return (
      supplier?.provider === "sanmar" &&
      supplier?.sourceMode !== "demo"
    );
  }

  return supplier?.sourceMode !== "demo";
}

export default async function ShopDesignerPage({
  params
}: Props) {
  const { shop: slug } = await params;
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
      { persist: false }
    );

  const products: CatalogProduct[] =
    flatRows
      .map((row) => ({
        ...row,
        configuration:
          normalizeConfiguration(
            row.configuration
          )
      }))
      .filter((item) =>
        isLiveCustomProduct(item, slug)
      );

  const shop: PublicShop = {
    ...data,
    settings,
    pricing: normalizePricingProfile(
      pricingRow?.configuration ||
        DEFAULT_PRICING_PROFILE
    ),
    products,
    paymentReady:
      Number(paymentCount || 0) > 0
  };

  return <DesignerApp shop={shop} />;
}
