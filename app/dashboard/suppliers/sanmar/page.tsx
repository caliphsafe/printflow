import SanMarCatalogImporter from "@/components/SanMarCatalogImporter";
import { getAdminContext } from "@/lib/admin-data";

export const dynamic = "force-dynamic";

export default async function SanMarCatalogPage() {
  const { supabase, shop } = await getAdminContext();
  if (!shop) return <p>No shop configured.</p>;

  const [{ data: connection }, { data: products }] = await Promise.all([
    supabase
      .from("supplier_connections")
      .select("status,account_hint")
      .eq("shop_id", shop.id)
      .eq("provider", "sanmar")
      .maybeSingle(),
    supabase
      .from("catalog_products")
      .select("configuration")
      .eq("shop_id", shop.id)
  ]);

  const importedStyleIds = Array.from(
    new Set(
      (products || [])
        .map((row: any) =>
          row?.configuration?.supplier?.provider === "sanmar"
            ? String(row.configuration.supplier.styleId || "")
            : ""
        )
        .filter(Boolean)
    )
  );

  return (
    <>
      <header className="admin-header">
        <div>
          <p className="eyebrow">SANMAR</p>
          <h1>Live product catalog</h1>
          <p>
            Browse SanMar visually, then import only the products and colors
            this shop actually wants to offer.
          </p>
        </div>
      </header>

      <SanMarCatalogImporter
        connected={connection?.status === "connected"}
        accountHint={connection?.account_hint || undefined}
        importedStyleIds={importedStyleIds}
      />
    </>
  );
}
