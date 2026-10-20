import { decodeHtmlEntities } from "@/lib/html-entities";
import { slugify } from "@/lib/catalog";
const ADVANCED_SHOP_ID = "1fb2131a-3e33-4986-a66b-de70ea6c7b6b";

/**
 * Advanced's custom SanMar catalog is one product per supplier STYLE, with
 * all of that style's colors and sizes in a single configuration.
 *
 * School uniforms and other shops are deliberately excluded.
 * Historical duplicate rows are archived, not deleted: existing orders and
 * other references can continue to resolve their original product IDs.
 */

type ProductRow = {
  id: string;
  slug?: string;
  name?: string;
  description?: string | null;
  active?: boolean;
  created_at?: string;
  configuration?: any;
  [key: string]: any;
};

const value = (input: unknown) => String(input ?? "").trim();
const normalized = (input: unknown) => value(input).replace(/\s+/g, " ").toLowerCase();
const styleKey = (input: unknown) => value(input).toUpperCase();

export function isAdvancedShop(shopId: string) {
  return shopId === ADVANCED_SHOP_ID;
}

export function advancedSanMarStyleId(row: ProductRow): string {
  const supplier = row.configuration?.supplier;
  const category = normalized(row.configuration?.customization?.category);
  if (
    normalized(supplier?.provider) !== "sanmar" ||
    supplier?.sourceMode === "demo" ||
    !value(supplier?.styleId) ||
    category === "school uniform" ||
    category === "school uniforms" ||
    normalized(row.slug).startsWith("espirito-") ||
    normalized(row.name).includes("espirito santo")
  ) return "";
  return styleKey(supplier.styleId);
}

export function advancedSanMarKind(
  configuration: any,
  name?: string
): "polo" | "hat" | "other" {
  const category = normalized(configuration?.customization?.category);
  const title = [
    name,
    configuration?.supplier?.styleName
  ].map(normalized).join(" ");

  if (/\b(hats?|caps?|headwear|beanies?|visors?|snapback|trucker|bucket hat)\b/i.test(`${category} ${title}`)) {
    return "hat";
  }

  if (
    /\bpolos?\b/i.test(title) ||
    /^(polo|polos|polo shirts)$/.test(category)
  ) return "polo";

  return "other";
}

export function applyAdvancedSanMarRules(configuration: any, name?: string) {
  if (normalized(configuration?.supplier?.provider) !== "sanmar") {
    return configuration;
  }

  const kind = advancedSanMarKind(configuration, name);
  const customization = { ...(configuration?.customization || {}) };
  const result = { ...(configuration || {}), customization };

  if (kind === "polo") {
    // Polos: embroidery only, front left chest (heart-size) only.
    customization.decorationMethods = ["Embroidery"];
    customization.printSizes = ["heart"];
    customization.designModes = ["front"];
    customization.frontEnabled = true;
    customization.backEnabled = false;
    result.printLocations = ["Left Chest"];
  } else if (kind === "hat") {
    // Hats: embroidery only. Retain valid hat zones and image-dependent sides.
    customization.decorationMethods = ["Embroidery"];
  }

  return result;
}

function mergeChoices(first: any, second: any) {
  const merged = new Map<string, any>();
  for (const choice of [...(Array.isArray(first) ? first : []), ...(Array.isArray(second) ? second : [])]) {
    const url = value(choice?.url);
    if (url && !merged.has(url)) merged.set(url, choice);
  }
  return [...merged.values()];
}

function mergeColors(first: any, second: any) {
  const merged = new Map<string, any>();
  for (const color of [...(Array.isArray(first) ? first : []), ...(Array.isArray(second) ? second : [])]) {
    const key = normalized(color?.name);
    if (!key) continue;
    const previous = merged.get(key);
    if (!previous) {
      merged.set(key, { ...color });
      continue;
    }
    merged.set(key, {
      ...previous,
      ...color,
      id: value(previous.id) || value(color.id) || slugify(key),
      name: value(previous.name) || value(color.name),
      hex: value(previous.hex) && previous.hex !== "#777777" ? previous.hex : color.hex || previous.hex,
      frontImageUrl: value(color.frontImageUrl) || previous.frontImageUrl,
      backImageUrl: value(color.backImageUrl) || previous.backImageUrl,
      swatchImageUrl: value(color.swatchImageUrl) || previous.swatchImageUrl,
      imageChoices: mergeChoices(previous.imageChoices, color.imageChoices),
      // Keep an explicitly disabled existing color disabled on re-import.
      active: previous.active === false ? false : color.active !== false
    });
  }
  return [...merged.values()];
}

function mergeVariants(first: any, second: any) {
  const merged = new Map<string, any>();
  for (const variant of [...(Array.isArray(first) ? first : []), ...(Array.isArray(second) ? second : [])]) {
    const color = normalized(variant?.colorName);
    const size = normalized(variant?.sizeName);
    if (!color || !size) continue;
    const key = `${color}|${size}`;
    const previous = merged.get(key);
    if (!previous) {
      merged.set(key, { ...variant });
      continue;
    }
    merged.set(key, {
      ...previous,
      ...variant,
      sku: value(variant.sku) || previous.sku,
      skuId: value(variant.skuId) || previous.skuId,
      gtin: value(variant.gtin) || previous.gtin,
      customerPrice: Number(variant.customerPrice) > 0 ? Number(variant.customerPrice) : previous.customerPrice,
      quantity: Number.isFinite(Number(variant.quantity)) ? Number(variant.quantity) : previous.quantity,
      active: previous.active !== false && variant.active !== false
    });
  }
  return [...merged.values()];
}

export function mergeAdvancedSanMarConfigurations(
  existing: any,
  incoming: any,
  productName?: string
) {
  const colors = mergeColors(existing?.colors, incoming?.colors);
  const variants = mergeVariants(existing?.supplier?.variants, incoming?.supplier?.variants);
  const sizes = [...new Set([
    ...(Array.isArray(existing?.sizes) ? existing.sizes : []),
    ...(Array.isArray(incoming?.sizes) ? incoming.sizes : []),
    ...variants.map((variant: any) => variant.sizeName)
  ].map(value).filter(Boolean))];

  const defaultColor =
    colors.find((color: any) => color.id === existing?.defaultColorId && color.active !== false) ||
    colors.find((color: any) => color.id === incoming?.defaultColorId && color.active !== false) ||
    colors.find((color: any) => color.active !== false) ||
    colors[0];

  const configuration: any = {
    ...(existing || {}),
    ...(incoming || {}),
    colors,
    sizes,
    defaultColorId: defaultColor?.id,
    mockupImageUrl: defaultColor?.frontImageUrl || existing?.mockupImageUrl || incoming?.mockupImageUrl,
    supplier: {
      ...(existing?.supplier || {}),
      ...(incoming?.supplier || {}),
      styleId: styleKey(incoming?.supplier?.styleId || existing?.supplier?.styleId),
      variants
    },
    customization: {
      ...(existing?.customization || {}),
      ...(incoming?.customization || {})
    }
  };
  delete configuration.duplicateOf;
  return applyAdvancedSanMarRules(configuration, productName);
}

function displayName(row: ProductRow) {
  const style = advancedSanMarStyleId(row);
  if (!style) return value(row.name);
  const supplier = row.configuration?.supplier || {};
  const brand = decodeHtmlEntities(value(supplier.brandName)).replace(/[®™]/g, "").trim();
  let title = decodeHtmlEntities(value(supplier.styleName) || value(row.name));
  title = title.replace(new RegExp(`^\\s*${style}\\s*[|:–—-]?\\s*`, "i"), "");
  title = title.replace(new RegExp(`\\s*[|:–—-]?\\s*${style}\\s*$`, "i"), "").trim();
  title = title.replace(/\s+/g, " ").trim();

  if (brand) {
    const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const prefix = new RegExp(`^${escape(brand)}\\s*[®™]?\\s*`, "i");
    const marked = new RegExp(`${escape(brand)}\\s*®`, "i").test(title);
    let stripped = title;
    let repetitions = 0;
    while (prefix.test(stripped) && repetitions++ < 4) stripped = stripped.replace(prefix, "").trim();
    if (repetitions > 0) title = `${brand}${marked ? "®" : ""} ${stripped}`.trim();
    else if (!normalized(title).startsWith(normalized(brand))) title = `${brand} ${title}`;
  }

  title = title.replace(/\s+([®™])/g, "$1").replace(/([®™])(?=[A-Za-z])/g, "$1 ").replace(/\s+/g, " ").trim();
  return title ? `${style} | ${title}` : style;
}

export function collapseAdvancedSanMarRows<T extends ProductRow>(rows: T[]): {
  products: T[];
  archives: Array<{ id: string; canonicalId: string; configuration: any }>;
  changed: T[];
} {
  const grouped = new Map<string, T[]>();
  const passthrough: T[] = [];

  for (const row of rows) {
    const style = advancedSanMarStyleId(row);
    if (!style) {
      passthrough.push(row);
      continue;
    }
    if (row.configuration?.duplicateOf) continue;
    grouped.set(style, [...(grouped.get(style) || []), row]);
  }

  const products: T[] = [...passthrough];
  const archives: Array<{ id: string; canonicalId: string; configuration: any }> = [];
  const changed: T[] = [];

  for (const group of grouped.values()) {
    group.sort((a, b) =>
      Number(b.active !== false) - Number(a.active !== false) ||
      value(a.created_at).localeCompare(value(b.created_at)) ||
      value(a.id).localeCompare(value(b.id))
    );

    const canonical = group[0];
    let configuration = canonical.configuration || {};
    for (const duplicate of group.slice(1)) {
      configuration = mergeAdvancedSanMarConfigurations(configuration, duplicate.configuration, canonical.name);
      archives.push({
        id: duplicate.id,
        canonicalId: canonical.id,
        configuration: { ...(duplicate.configuration || {}), duplicateOf: canonical.id }
      });
    }

    configuration = applyAdvancedSanMarRules(configuration, canonical.name);
    const nextName = displayName({ ...canonical, configuration });
    const repaired = {
      ...canonical,
      name: nextName || canonical.name,
      active: group.some((item) => item.active !== false),
      configuration
    } as T;

    if (
      repaired.name !== canonical.name ||
      repaired.active !== canonical.active ||
      JSON.stringify(configuration) !== JSON.stringify(canonical.configuration)
    ) changed.push(repaired);

    products.push(repaired);
  }

  return { products, archives, changed };
}

async function listAdvancedProducts(db: any, shopId: string): Promise<ProductRow[]> {
  const all: ProductRow[] = [];
  const pageSize = 500;
  for (let start = 0; ; start += pageSize) {
    const { data, error } = await db
      .from("catalog_products")
      .select("id,slug,name,description,active,configuration,created_at")
      .eq("shop_id", shopId)
      .order("created_at", { ascending: true })
      .range(start, start + pageSize - 1);
    if (error) throw error;
    all.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return all;
}

export async function consolidateAdvancedSanMarCatalog(db: any, shopId: string) {
  if (!isAdvancedShop(shopId)) return [] as ProductRow[];
  const rows = await listAdvancedProducts(db, shopId);
  const collapsed = collapseAdvancedSanMarRows(rows);

  // Save the combined product BEFORE archiving any duplicate. This order
  // prevents lost color/size data if an update fails partway through.
  for (const row of collapsed.changed) {
    const { error } = await db.from("catalog_products")
      .update({
        name: row.name,
        active: row.active,
        configuration: row.configuration,
        updated_at: new Date().toISOString()
      })
      .eq("shop_id", shopId)
      .eq("id", row.id);
    if (error) throw error;
  }

  for (const duplicate of collapsed.archives) {
    const { error } = await db.from("catalog_products")
      .update({
        active: false,
        configuration: duplicate.configuration,
        updated_at: new Date().toISOString()
      })
      .eq("shop_id", shopId)
      .eq("id", duplicate.id);
    if (error) throw error;
  }

  return collapsed.products;
}

export async function saveAdvancedSanMarImport({
  db,
  shopId,
  organizationId,
  name,
  description,
  configuration
}: {
  db: any;
  shopId: string;
  organizationId: string;
  name: string;
  description?: string | null;
  configuration: any;
}) {
  if (!isAdvancedShop(shopId)) {
    throw new Error("This import is available only for the Advanced shop.");
  }
  const styleId = styleKey(configuration?.supplier?.styleId);
  if (!styleId) throw new Error("SanMar style ID is required.");

  // Resolve any historical duplicates first, then merge the new selection.
  const rows = await consolidateAdvancedSanMarCatalog(db, shopId);
  const existing = rows.find((row) => advancedSanMarStyleId(row) === styleId);
  const finalName = displayName({
    id: existing?.id || "",
    name: value(name) || value(existing?.name),
    configuration: {
      ...(existing?.configuration || {}),
      ...(configuration || {}),
      supplier: {
        ...(existing?.configuration?.supplier || {}),
        ...(configuration?.supplier || {})
      }
    }
  });

  const merged = existing
    ? mergeAdvancedSanMarConfigurations(existing.configuration, configuration, finalName)
    : applyAdvancedSanMarRules(configuration, finalName);

  if (existing) {
    const { data, error } = await db.from("catalog_products")
      .update({
        name: finalName || existing.name,
        description: description || existing.description,
        active: true,
        configuration: merged,
        updated_at: new Date().toISOString()
      })
      .eq("shop_id", shopId)
      .eq("id", existing.id)
      .select("id,slug,name")
      .single();
    if (error) throw error;
    return { product: data, mergedExistingProduct: true };
  }

  const baseSlug = slugify(`${styleId}-sanmar`);
  let slug = baseSlug;
  for (let suffix = 2; suffix < 1000; suffix++) {
    const { data: collision, error } = await db.from("catalog_products")
      .select("id").eq("shop_id", shopId).eq("slug", slug).maybeSingle();
    if (error) throw error;
    if (!collision) break;
    slug = `${baseSlug}-${suffix}`;
  }

  const { data, error } = await db.from("catalog_products")
    .insert({
      organization_id: organizationId,
      shop_id: shopId,
      slug,
      name: finalName || styleId,
      description: description || "",
      active: true,
      configuration: merged
    })
    .select("id,slug,name")
    .single();
  if (error) throw error;
  return { product: data, mergedExistingProduct: false };
}
