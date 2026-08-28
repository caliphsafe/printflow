import Link from "next/link";
import SanMarCatalogImporter from "@/components/SanMarCatalogImporter";
import { getAdvancedAdminContext } from "@/lib/advanced-admin";

export const dynamic = "force-dynamic";

export default async function AdvancedSanMarCatalog() {
  const { db, shop } = await getAdvancedAdminContext();

  const [{ data: connection }, { data: products }] = await Promise.all([
    db
      .from("supplier_connections")
      .select("status,account_hint")
      .eq("shop_id", shop.id)
      .eq("provider", "sanmar")
      .maybeSingle(),
    db
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
      <header className="ae-page-head">
        <div className="copy">
          <p className="ae-kicker">SANMAR CATALOG</p>
          <h1>Browse it like a real supplier catalog.</h1>
          <p>
            Search and filter SanMar T-shirts, polos and hats visually. Open a
            product to see its real colors, sizes, your account pricing,
            inventory and supplier images before adding it to Advanced.
          </p>
        </div>
        <div className="ae-page-actions">
          <Link className="ae-button" href="/advanced-admin/products">
            ← Products
          </Link>
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
