import { createReadStream, promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { parse } from "csv-parse";
import { decryptSecret } from "@/lib/crypto";

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

function buildCandidates(settings: Record<string, any>) {
  const configured = String(settings.catalogFilePath || "").trim();
  return Array.from(new Set([
    configured,
    "SanMarPDD/SanMar_EPDD.csv",
    "/SanMarPDD/SanMar_EPDD.csv",
    "SanMarPDD/SanMar_SDL_N.csv",
    "/SanMarPDD/SanMar_SDL_N.csv",
    "SanMar_EPDD.csv",
    "SanMar_SDL_N.csv"
  ].filter(Boolean))) as string[];
}

async function downloadCatalogFast(connection: Connection) {
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
  const username = String(settings.sftpUsername || customerNumber);
  const tempPath = path.join(os.tmpdir(), `sanmar-${randomUUID()}.csv`);

  await client.connect({ host, port, username, password, readyTimeout: 30000 });
  try {
    let remotePath = "";
    let remoteSize = 0;
    let lastError: unknown;

    for (const candidate of buildCandidates(settings)) {
      try {
        const stat = await client.stat(candidate);
        const size = Number(stat?.size || 0);
        if (size > 100) {
          remotePath = candidate;
          remoteSize = size;
          break;
        }
      } catch (error) {
        lastError = error;
      }
    }

    if (!remotePath) {
      throw lastError instanceof Error ? lastError : new Error("SanMar catalog file was not found in the SFTP account.");
    }

    // fastGet performs parallel SFTP reads and writes directly to /tmp. This avoids
    // buffering the entire EPDD file in RAM and is substantially faster than get().
    await client.fastGet(remotePath, tempPath, {
      concurrency: 64,
      chunkSize: 64 * 1024
    });

    const local = await fs.stat(tempPath);
    if (local.size < 100) throw new Error("SanMar catalog download completed but the file was empty.");

    return { tempPath, remotePath, remoteSize: remoteSize || local.size, localSize: local.size };
  } catch (error) {
    await fs.unlink(tempPath).catch(() => undefined);
    throw error;
  } finally {
    await client.end().catch(() => undefined);
  }
}

function addRawRow(grouped: Map<string, any>, raw: Record<string, unknown>) {
  const row = indexRow(raw);
  const styleId = get(row, "STYLE#", "STYLE", "CATALOG_NO", "CATALOGNO").toUpperCase();
  if (!styleId) return;

  const status = get(row, "PRODUCT_STATUS", "PRODUCTSTATUS");
  if (/discontinued/i.test(status)) return;

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

async function parseCatalogStream(tempPath: string) {
  const grouped = new Map<string, any>();
  const parser = createReadStream(tempPath).pipe(parse({
    columns: true,
    bom: true,
    skip_empty_lines: true,
    relax_column_count: true,
    relax_quotes: true,
    trim: true
  }));

  for await (const raw of parser) {
    addRawRow(grouped, raw as Record<string, unknown>);
  }

  return grouped;
}

export async function syncSanMarCatalogFast({ supabase, organizationId, shopId, connection }: {
  supabase: any;
  organizationId: string;
  shopId: string;
  connection: Connection;
}) {
  const startedAt = new Date().toISOString();
  const overallStart = Date.now();
  const downloadStart = Date.now();
  const downloaded = await downloadCatalogFast(connection);

  try {
    const downloadMs = Date.now() - downloadStart;
    const parseStart = Date.now();
    const grouped = await parseCatalogStream(downloaded.tempPath);
    const parseMs = Date.now() - parseStart;

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
      source_file: downloaded.remotePath,
      source_updated_at: null,
      synced_at: startedAt
    }));

    const dbStart = Date.now();
    const batches: any[][] = [];
    for (let index = 0; index < rows.length; index += 75) batches.push(rows.slice(index, index + 75));

    // A few concurrent batches are much faster than one long chain of round-trips,
    // while keeping request size and Supabase pressure bounded.
    const workers = 4;
    let cursor = 0;
    async function worker() {
      while (true) {
        const index = cursor++;
        if (index >= batches.length) return;
        const { error } = await supabase.from("sanmar_catalog_styles").upsert(batches[index], { onConflict: "shop_id,style_id" });
        if (error) throw error;
      }
    }
    await Promise.all(Array.from({ length: Math.min(workers, batches.length || 1) }, () => worker()));

    const { error: cleanupError } = await supabase
      .from("sanmar_catalog_styles")
      .delete()
      .eq("shop_id", shopId)
      .lt("synced_at", startedAt);
    if (cleanupError) throw cleanupError;

    const dbMs = Date.now() - dbStart;
    return {
      styleCount: rows.length,
      sourceFile: downloaded.remotePath,
      sourceBytes: downloaded.localSize,
      syncedAt: startedAt,
      timings: {
        downloadMs,
        parseMs,
        dbMs,
        totalMs: Date.now() - overallStart
      }
    };
  } finally {
    await fs.unlink(downloaded.tempPath).catch(() => undefined);
  }
}
