import DesignerApp from "@/components/DesignerApp";
import { getAdminContext } from "@/lib/admin-data";
import { DEFAULT_CONFIGURATION, normalizeConfiguration } from "@/lib/catalog";
import { DEFAULT_PRICING_PROFILE, normalizePricingProfile } from "@/lib/pricing-settings";
import { normalizeShopSettings } from "@/lib/shop-settings";
import type { CatalogProduct, PublicShop, ShopSettings } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

function previewProduct(): CatalogProduct {
  return {
    id: "preview-product",
    slug: "preview-heavyweight-tee",
    name: "Heavyweight T-Shirt",
    description: "A sample product that lets you review the customer experience before your catalog is complete.",
    active: true,
    configuration: normalizeConfiguration({ ...DEFAULT_CONFIGURATION, manualUnitCost: 4 })
  };
}

export default async function StorefrontPreviewPage() {
  const { supabase, shop, user, organization } = await getAdminContext();

  // A newly registered owner should always be able to understand the customer
  // experience, even before the Business step creates a persistent shop record.
  if (!shop) {
    const name = String(
      user?.user_metadata?.business_name ||
      organization?.name ||
      user?.user_metadata?.full_name ||
      "Your Print Shop"
    );

    const previewShop: PublicShop = {
      id: "account-preview",
      slug: "preview",
      name,
      settings: normalizeShopSettings({
        brand: {
          primaryColor: "#111111",
          textColor: "#ffffff",
          accentColor: "#d8ff5f",
          surfaceColor: "#f4f4ef"
        },
        customerExperience: {
          heroBadge: "CUSTOM APPAREL, MADE EASY",
          headline: "Design your custom shirts",
          introduction: "Choose a garment, upload your artwork, and review the order before checkout.",
          trustMessage: "Secure checkout · Production artwork review · Clear order confirmation"
        },
        upload: {
          acceptedTypes: ["image/png", "image/jpeg", "image/webp", "image/svg+xml"],
          maxBytes: 500 * 1024 * 1024
        }
      } as ShopSettings),
      pricing: DEFAULT_PRICING_PROFILE,
      products: [previewProduct()],
      paymentReady: false,
      previewMode: true
    };

    return <DesignerApp shop={previewShop} />;
  }

  const [{ data: rows }, { data: pricingRow }, { count: paymentCount }] = await Promise.all([
    supabase
      .from("catalog_products")
      .select("id,slug,name,description,active,configuration")
      .eq("shop_id", shop.id)
      .eq("active", true)
      .order("created_at", { ascending: true }),
    supabase.from("shop_pricing_profiles").select("configuration").eq("shop_id", shop.id).maybeSingle(),
    supabase
      .from("integration_connections")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shop.id)
      .eq("category", "payment")
      .eq("status", "connected")
  ]);

  const liveProducts: CatalogProduct[] = (rows || [])
    .map((row: any) => ({ ...row, configuration: normalizeConfiguration(row.configuration) }))
    .filter((item) => item.configuration.supplier?.sourceMode !== "demo");

  const previewShop: PublicShop = {
    id: shop.id,
    slug: shop.slug,
    name: shop.name,
    settings: normalizeShopSettings(shop.settings as ShopSettings),
    pricing: normalizePricingProfile(pricingRow?.configuration || DEFAULT_PRICING_PROFILE),
    products: liveProducts.length ? liveProducts : [previewProduct()],
    paymentReady: Number(paymentCount || 0) > 0,
    previewMode: true
  };

  return <DesignerApp shop={previewShop} />;
}
