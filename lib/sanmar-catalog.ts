import { decryptSecret } from "@/lib/crypto";
import { parse } from "csv-parse/sync";
import { sanmarNormalizedStyle, type SanMarNormalizedStyle } from "@/lib/sanmar";

const SftpClient: any = require("ssh2-sftp-client");

type Connection = {
  encrypted_account_number: string;
  encrypted_api_key: string;
  settings?: Record<string, any> | null;
};

type CachedVariant = {
  uniqueKey: string;
  inventoryKey: string;
  sizeIndex: string;
  mainframeColor: string;
  colorName: string;
  sizeName: string;
  quantity: number;
  piecePrice: number;
  gtin?: string;
  swatchImageUrl?: string;
  colorProductImageUrl?: string;
  frontModelUrl?: string;
  backModelUrl?: string;
  frontFlatUrl?: string;
  backFlatUrl?: string;
};

type CachedStyle = {
  style_id: string;
  brand_name: string;
  title: string;
  description: string;
  category: string;
  source_category?: string | null;
  subcategory?: string | null;
  image_url?: string | null;
  front_model_url?: string | null;
  back_model_url?: string | null;
  front_flat_url?: string | null;
  back_flat_url?: string | null;
  color_count: number;
  size_count: number;
  price_min: number | string;
  price_max: number | string;
  variants: CachedVariant[];
  synced_at?: string;
};

function cleanKey(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function indexRow(row: Record<string, unknown>) {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(row || {})) {
    out[cleanKey(key)] = String(value ?? "").trim();
  }
  return out;
}

function get(row: Record<string, string>, ...keys: string[]) {
  for (const key of keys) {
    const value = row[cleanKey(key)];
    if (value) return value;
  }
  return "";
}

function image(value: string) {
  const raw = String(value || "").replace(/\s+/g, "").trim();
  if (!raw) return "";
  if (/^http:\/\//i.test(raw)) return raw.replace(/^http:\/\//i, "https://");
  return /^https:\/\//i.test(raw) ? raw : "";
}

function numeric(value: string) {
  const n = Number(String(value || "").replace(/[$,]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function categoryName(source: string, subcategory: string, title: string) {
  const text = `${source} ${subcategory} ${title}`.toLowerCase();
  if (/\b(cap|caps|hat|hats|headwear|beanie|visor|trucker)\b/.test(text)) return "Caps";
  if (/\b(polo|polos|knit|knits)\b/.test(text)) return "Polos/Knits";
  if (/\b(tee|tees|t-shirt|t shirts|tshirts|shirt)\b/.test(text)) return "T-Shirts";
  return source || "Apparel";
}

function preferredCategory(current: string, next: string) {
  const preferred = new Set(["T-Shirts", "Polos/Knits", "Caps"]);
  if (preferred.has(current)) return current;
  if (preferred.has(next)) return next;
  return current || next || "Apparel";
}

function hasSftp(connection: Connection) {
  return Boolean(connection.settings?.sftpPasswordEncrypted);
}

export function sanmarSftpConfigured(connection: Connection) {
  return hasSftp(connection);
}

async function fetchCatalogBuffer(connection: Connection) {
  const settings = connection.settings || {};
  if (!settings.sftpPasswordEncrypted) {
    throw new Error("SanMar FTP/SFTP catalog access is not configured. Save the separate SanMar FTP password in Suppliers first.");
  }

  const customerNumber = String(settings.customerNumber || settings.sftpUsername || "").trim();
  if (!customerNumber) throw new Error("SanMar customer number is required for SFTP catalog access.");

  const client = new SftpClient();
  const password = decryptSecret(String(settings.sftpPasswordEncrypted));
  const host = String(settings.sftpHost || "ftp.sanmar.com");
  const port = Number(settings.sftpPort || 2200);
  const configured = String(settings.catalogFilePath || "").trim();
  const candidates = Array.from(new Set([
    configured,
    "SanMarPDD/SanMar_EPDD.csv",
    "/SanMarPDD/SanMar_EPDD.csv",
    "SanMarPDD/SanMar_SDL_N.csv",
    "/SanMarPDD/SanMar_SDL_N.csv",
    "SanMar_EPDD.csv",
    "SanMar_SDL_N.csv"
  ].filter(Boolean)));

  await client.connect({ host, port, username: String(settings.sftpUsername || customerNumber), password, readyTimeout: 30000 });
  try {
    let lastError: unknown;
    for (const remotePath of candidates) {
      try {
        const result = await client.get(remotePath);
        const buffer = Buffer.isBuffer(result) ? result : Buffer.from(result as any);
        if (buffer.length > 100) return { buffer, remotePath };
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError instanceof Error ? lastError : new Error("SanMar catalog file was not found in the SFTP account.");
  } finally {
    await client.end().catch(() => undefined);
  }
}

export async function syncSanMarCatalog({ supabase, organizationId, shopId, connection }: {
  supabase: any;
  organizationId: string;
  shopId: string;
  connection: Connection;
}) {
  const startedAt = new Date().toISOString();
  const { buffer, remotePath } = await fetchCatalogBuffer(connection);
  const records = parse(buffer, {
    columns: true,
    bom: true,
    skip_empty_lines: true,
    relax_column_count: true,
    relax_quotes: true,
    trim: true
  }) as Record<string, unknown>[];

  const grouped = new Map<string, any>();

  for (const raw of records) {
    const row = indexRow(raw);
    const styleId = get(row, "STYLE#", "STYLE", "CATALOG_NO", "CATALOGNO").toUpperCase();
    if (!styleId) continue;

    const status = get(row, "PRODUCT_STATUS", "PRODUCTSTATUS");
    if (/discontinued/i.test(status)) continue;

    const title = get(row, "PRODUCT_TITLE", "PRODUCTTITLE", "DESCRIPTION") || styleId;
    const description = get(row, "PRODUCT_DESCRIPTION", "PRODUCTDESCRIPTION", "EXTENDED_DESCRIPTION", "EXTENDEDDESCRIPTION");
    const brandName = get(row, "MILL", "BRAND_NAME", "BRANDNAME") || "SanMar";
    const sourceCategory = get(row, "CATEGORY_NAME", "CATEGORYNAME");
    const subcategory = get(row, "SUBCATEGORY_NAME", "SUBCATEGORYNAME");
    const category = categoryName(sourceCategory, subcategory, title);

    const frontModelUrl = image(get(row, "FRONT_MODEL_IMAGE_URL", "FRONTMODELIMAGEURL", "PRODUCT_IMAGE", "PRODUCTIMAGE"));
    const backModelUrl = image(get(row, "BACK_MODEL_IMAGE_URL", "BACKMODELIMAGEURL"));
    const frontFlatUrl = image(get(row, "FRONT_FLAT_IMAGE_URL", "FRONTFLATIMAGEURL", "COLOR_PRODUCT_IMAGE", "COLORPRODUCTIMAGE"));
    const backFlatUrl = image(get(row, "BACK_FLAT_IMAGE_URL", "BACKFLATIMAGEURL"));
    const swatchImageUrl = image(get(row, "COLOR_SWATCH_IMAGE_URL", "COLORSWATCHIMAGEURL", "COLOR_SQUARE_IMAGE_URL", "COLORSQUAREIMAGEURL"));
    const colorProductImageUrl = image(get(row, "COLOR_PRODUCT_IMAGE_URL", "COLORPRODUCTIMAGEURL"));

    const colorName = get(row, "COLOR_NAME", "COLORNAME", "CATALOG_COLOR", "CATALOGCOLOR");
    const sizeName = get(row, "SIZE");
    const inventoryKey = get(row, "INVENTORY_KEY", "INVENTORYKEY");
    const sizeIndex = get(row, "SIZE_INDEX", "SIZEINDEX");
    const uniqueKey = get(row, "UNIQUE_KEY", "UNIQUEKEY") || `${inventoryKey}${sizeIndex}`;
    const mainframeColor = get(row, "SANMAR_MAINFRAME_COLOR", "SANMARMAINFRAMECOLOR") || colorName;
    const quantity = numeric(get(row, "QTY", "QUANTITY"));
    const piecePrice = numeric(get(row, "PIECE_PRICE", "PIECEPRICE", "SUGGESTED_PRICE", "SUGGESTEDPRICE"));
    const gtin = get(row, "GTIN");

    let style = grouped.get(styleId);
    if (!style) {
      style = {
        styleId,
        brandName,
        title,
        description,
        category,
        sourceCategory,
        subcategory,
        imageUrl: frontFlatUrl || frontModelUrl || colorProductImageUrl,
        frontModelUrl,
        backModelUrl,
        frontFlatUrl,
        backFlatUrl,
        colors: new Set<string>(),
        sizes: new Set<string>(),
        prices: [] as number[],
        variants: new Map<string, CachedVariant>()
      };
      grouped.set(styleId, style);
    }

    style.category = preferredCategory(style.category, category);
    if (!style.description && description) style.description = description;
    if (!style.imageUrl) style.imageUrl = frontFlatUrl || frontModelUrl || colorProductImageUrl;
    if (!style.frontFlatUrl && frontFlatUrl) style.frontFlatUrl = frontFlatUrl;
    if (!style.backFlatUrl && backFlatUrl) style.backFlatUrl = backFlatUrl;
    if (!style.frontModelUrl && frontModelUrl) style.frontModelUrl = frontModelUrl;
    if (!style.backModelUrl && backModelUrl) style.backModelUrl = backModelUrl;

    if (colorName) style.colors.add(colorName);
    if (sizeName) style.sizes.add(sizeName);
    if (piecePrice > 0) style.prices.push(piecePrice);

    if (colorName && sizeName) {
      const variantKey = uniqueKey || `${colorName}|${sizeName}`;
      const previous = style.variants.get(variantKey);
      const variant: CachedVariant = {
        uniqueKey,
        inventoryKey,
        sizeIndex,
        mainframeColor,
        colorName,
        sizeName,
        quantity,
        piecePrice,
        gtin,
        swatchImageUrl,
        colorProductImageUrl,
        frontModelUrl,
        backModelUrl,
        frontFlatUrl,
        backFlatUrl
      };
      if (!previous || quantity >= previous.quantity) style.variants.set(variantKey, variant);
    }
  }

  const rows = Array.from(grouped.values()).map((style: any) => ({
    organization_id: organizationId,
    shop_id: shopId,
    style_id: style.styleId,
    brand_name: style.brandName,
    title: style.title,
    description: style.description || "",
    category: style.category,
    source_category: style.sourceCategory || null,
    subcategory: style.subcategory || null,
    image_url: style.imageUrl || null,
    front_model_url: style.frontModelUrl || null,
    back_model_url: style.backModelUrl || null,
    front_flat_url: style.frontFlatUrl || null,
    back_flat_url: style.backFlatUrl || null,
    color_count: style.colors.size,
    size_count: style.sizes.size,
    price_min: style.prices.length ? Math.min(...style.prices) : 0,
    price_max: style.prices.length ? Math.max(...style.prices) : 0,
    variants: Array.from(style.variants.values()),
    source_file: remotePath,
    source_updated_at: null,
    synced_at: startedAt
  }));

  for (let index = 0; index < rows.length; index += 100) {
    const batch = rows.slice(index, index + 100);
    const { error } = await supabase.from("sanmar_catalog_styles").upsert(batch, { onConflict: "shop_id,style_id" });
    if (error) throw error;
  }

  const { error: cleanupError } = await supabase
    .from("sanmar_catalog_styles")
    .delete()
    .eq("shop_id", shopId)
    .lt("synced_at", startedAt);
  if (cleanupError) throw cleanupError;

  return { styleCount: rows.length, sourceFile: remotePath, syncedAt: startedAt };
}

function escapeLike(value: string) {
  return value.replace(/[%_,]/g, " ").trim();
}

export async function listSanMarCatalogStyles({ supabase, shopId, category, q, brand, offset, limit }: {
  supabase: any;
  shopId: string;
  category?: string;
  q?: string;
  brand?: string;
  offset: number;
  limit: number;
}) {
  let query = supabase
    .from("sanmar_catalog_styles")
    .select("style_id,brand_name,title,description,category,image_url,color_count,size_count,price_min,price_max,synced_at", { count: "exact" })
    .eq("shop_id", shopId);

  if (category) query = query.eq("category", category);
  if (brand) query = query.ilike("brand_name", brand);
  if (q) {
    const term = escapeLike(q);
    query = query.or(`style_id.ilike.%${term}%,brand_name.ilike.%${term}%,title.ilike.%${term}%,description.ilike.%${term}%`);
  }

  const { data, error, count } = await query
    .order("brand_name", { ascending: true })
    .order("style_id", { ascending: true })
    .range(offset, offset + limit - 1);
  if (error) throw error;

  let brandQuery = supabase.from("sanmar_catalog_styles").select("brand_name").eq("shop_id", shopId);
  if (category) brandQuery = brandQuery.eq("category", category);
  const { data: brandRows } = await brandQuery.limit(3000);
  const brands: string[] = Array.from(
    new Set<string>(
      (brandRows || [])
        .map((row: any) => String(row.brand_name || ""))
        .filter((name: string) => name.length > 0)
    )
  ).sort((a: string, b: string) => a.localeCompare(b));

  return {
    styles: (data || []).map((row: any) => ({
      styleId: row.style_id,
      brandName: row.brand_name,
      styleName: row.style_id,
      title: row.title,
      description: row.description || "",
      category: row.category,
      imageUrl: row.image_url || "",
      colorCount: Number(row.color_count || 0),
      sizeCount: Number(row.size_count || 0),
      priceMin: Number(row.price_min || 0),
      priceMax: Number(row.price_max || 0),
      supplier: "sanmar"
    })),
    total: Number(count || 0),
    brands,
    categories: ["T-Shirts", "Polos/Knits", "Caps"]
  };
}

export async function getSanMarCachedStyle(supabase: any, shopId: string, styleId: string): Promise<CachedStyle | null> {
  const { data, error } = await supabase
    .from("sanmar_catalog_styles")
    .select("*")
    .eq("shop_id", shopId)
    .eq("style_id", styleId.trim().toUpperCase())
    .maybeSingle();
  if (error) throw error;
  return data as CachedStyle | null;
}

function mediaForCachedColor(cached: CachedStyle | null, colorName: string) {
  if (!cached) return {};
  const variants = Array.isArray(cached.variants) ? cached.variants : [];
  const row = variants.find((variant) => variant.colorName === colorName) || variants[0];
  if (!row) return {};
  return {
    frontImageUrl: row.frontFlatUrl || row.frontModelUrl || row.colorProductImageUrl || cached.front_flat_url || cached.front_model_url || cached.image_url || "",
    backImageUrl: row.backFlatUrl || row.backModelUrl || cached.back_flat_url || cached.back_model_url || "",
    swatchImageUrl: row.swatchImageUrl || ""
  };
}

export async function sanmarStyleWithCatalog(supabase: any, shopId: string, connection: Connection, styleId: string) {
  const [live, cached] = await Promise.all([
    sanmarNormalizedStyle(connection, styleId),
    getSanMarCachedStyle(supabase, shopId, styleId).catch(() => null)
  ]);

  const cachedVariants = new Map<string, CachedVariant>();
  for (const variant of cached?.variants || []) {
    cachedVariants.set(`${variant.colorName.toLowerCase()}|${variant.sizeName.toLowerCase()}`, variant);
  }

  const media: SanMarNormalizedStyle["media"] = { ...live.media };
  for (const variant of live.variants) {
    const fallback = mediaForCachedColor(cached, variant.colorName);
    const current = media[variant.colorName] || {};
    media[variant.colorName] = {
      frontImageUrl: current.frontImageUrl || fallback.frontImageUrl,
      backImageUrl: current.backImageUrl || fallback.backImageUrl,
      swatchImageUrl: current.swatchImageUrl || fallback.swatchImageUrl
    };
  }

  return {
    ...live,
    name: cached?.title || live.name,
    description: cached?.description || live.description,
    brandName: cached?.brand_name || live.brandName,
    media,
    cached,
    variants: live.variants.map((variant) => {
      const cachedVariant = cachedVariants.get(`${variant.colorName.toLowerCase()}|${variant.sizeName.toLowerCase()}`);
      return {
        ...variant,
        quantity: Number(variant.quantity || cachedVariant?.quantity || 0),
        customerPrice: Number(variant.customerPrice || cachedVariant?.piecePrice || 0),
        inventoryKey: cachedVariant?.inventoryKey || "",
        sizeIndex: cachedVariant?.sizeIndex || "",
        mainframeColor: cachedVariant?.mainframeColor || variant.colorName,
        uniqueKey: cachedVariant?.uniqueKey || "",
        gtin: cachedVariant?.gtin || ""
      };
    })
  };
}
