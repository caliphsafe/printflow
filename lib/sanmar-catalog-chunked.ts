import { parse } from "csv-parse/sync";
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

type SyncInput = {
  supabase: any;
  organizationId: string;
  shopId: string;
  connection: Connection;
  cursor?: number;
  syncStartedAt?: string;
  preferredRemotePath?: string;
};

const DEFAULT_CHUNK_BYTES = 6 * 1024 * 1024;
const LOOKAHEAD_BYTES = 3 * 1024 * 1024;
const HEADER_READ_BYTES = 128 * 1024;

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

function numeric(value: string) {
  const n = Number(String(value || "").replace(/[$,]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function secureImage(value: string) {
  const raw = String(value || "").replace(/\s+/g, "").trim();
  if (!raw) return "";
  if (/^http:\/\//i.test(raw)) return raw.replace(/^http:\/\//i, "https://");
  return /^https:\/\//i.test(raw) ? raw : "";
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

function variantKey(variant: CachedVariant) {
  return (
    variant.uniqueKey ||
    `${variant.inventoryKey || ""}|${variant.sizeIndex || ""}|${variant.colorName}|${variant.sizeName}`
  );
}

function addRow(grouped: Map<string, any>, raw: Record<string, unknown>) {
  const row = indexRow(raw);

  const styleId = get(
    row,
    "STYLE#",
    "STYLE",
    "STYLE_ID",
    "STYLEID",
    "STYLE_NUMBER",
    "STYLENUMBER",
    "CATALOG_NO",
    "CATALOGNO"
  ).toUpperCase();

  if (!styleId) return;

  const status = get(row, "PRODUCT_STATUS", "PRODUCTSTATUS", "STATUS");
  if (/discontinued/i.test(status)) return;

  const title =
    get(row, "PRODUCT_TITLE", "PRODUCTTITLE", "DESCRIPTION") || styleId;
  const description = get(
    row,
    "PRODUCT_DESCRIPTION",
    "PRODUCTDESCRIPTION",
    "EXTENDED_DESCRIPTION",
    "EXTENDEDDESCRIPTION"
  );

  const brandName =
    get(row, "MILL", "BRAND_NAME", "BRANDNAME") || "SanMar";

  const sourceCategory = get(row, "CATEGORY_NAME", "CATEGORYNAME", "CATEGORY");
  const subcategory = get(row, "SUBCATEGORY_NAME", "SUBCATEGORYNAME");
  const category = categoryName(sourceCategory, subcategory, title);

  const frontModelUrl = secureImage(
    get(
      row,
      "FRONT_MODEL_IMAGE_URL",
      "FRONTMODELIMAGEURL",
      "FRONT_MODEL",
      "FRONTMODEL",
      "PRODUCT_IMAGE_URL",
      "PRODUCTIMAGEURL"
    )
  );
  const backModelUrl = secureImage(
    get(row, "BACK_MODEL_IMAGE_URL", "BACKMODELIMAGEURL", "BACK_MODEL", "BACKMODEL")
  );
  const frontFlatUrl = secureImage(
    get(
      row,
      "FRONT_FLAT_IMAGE_URL",
      "FRONTFLATIMAGEURL",
      "FRONT_FLAT",
      "FRONTFLAT",
      "COLOR_PRODUCT_IMAGE_URL",
      "COLORPRODUCTIMAGEURL"
    )
  );
  const backFlatUrl = secureImage(
    get(row, "BACK_FLAT_IMAGE_URL", "BACKFLATIMAGEURL", "BACK_FLAT", "BACKFLAT")
  );
  const swatchImageUrl = secureImage(
    get(
      row,
      "COLOR_SWATCH_IMAGE_URL",
      "COLORSWATCHIMAGEURL",
      "COLOR_SQUARE_IMAGE_URL",
      "COLORSQUAREIMAGEURL"
    )
  );
  const colorProductImageUrl = secureImage(
    get(row, "COLOR_PRODUCT_IMAGE_URL", "COLORPRODUCTIMAGEURL")
  );

  const colorName = get(
    row,
    "COLOR_NAME",
    "COLORNAME",
    "CATALOG_COLOR",
    "CATALOGCOLOR"
  );
  const sizeName = get(row, "SIZE");
  const inventoryKey = get(row, "INVENTORY_KEY", "INVENTORYKEY");
  const sizeIndex = get(row, "SIZE_INDEX", "SIZEINDEX");
  const uniqueKey =
    get(row, "UNIQUE_KEY", "UNIQUEKEY") || `${inventoryKey}${sizeIndex}`;
  const mainframeColor =
    get(
      row,
      "SANMAR_MAINFRAME_COLOR",
      "SANMARMAINFRAMECOLOR",
      "CATALOG_COLOR",
      "CATALOGCOLOR"
    ) || colorName;
  const quantity = numeric(get(row, "QTY", "QUANTITY"));
  const piecePrice = numeric(
    get(
      row,
      "PIECE_PRICE",
      "PIECEPRICE",
      "SUGGESTED_PRICE",
      "SUGGESTEDPRICE"
    )
  );
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
      imageUrl:
        frontFlatUrl ||
        frontModelUrl ||
        colorProductImageUrl,
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
  if (!style.imageUrl) {
    style.imageUrl =
      frontFlatUrl ||
      frontModelUrl ||
      colorProductImageUrl;
  }
  if (!style.frontModelUrl && frontModelUrl) style.frontModelUrl = frontModelUrl;
  if (!style.backModelUrl && backModelUrl) style.backModelUrl = backModelUrl;
  if (!style.frontFlatUrl && frontFlatUrl) style.frontFlatUrl = frontFlatUrl;
  if (!style.backFlatUrl && backFlatUrl) style.backFlatUrl = backFlatUrl;

  if (colorName) style.colors.add(colorName);
  if (sizeName) style.sizes.add(sizeName);
  if (piecePrice > 0) style.prices.push(piecePrice);

  if (colorName && sizeName) {
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

    const key = variantKey(variant);
    const previous = style.variants.get(key);

    if (!previous || quantity >= previous.quantity) {
      style.variants.set(key, variant);
    }
  }
}

async function readRange(
  client: any,
  remotePath: string,
  start: number,
  end: number
): Promise<Buffer> {
  if (end < start) return Buffer.alloc(0);

  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const stream = client.createReadStream(remotePath, {
      start,
      end,
      encoding: null,
      autoClose: true
    });

    stream.on("data", (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

async function resolveRemotePath(client: any, settings: Record<string, any>) {
  const configured = String(settings.catalogFilePath || "").trim();

  if (configured) {
    try {
      const stat = await client.stat(configured);
      if (Number(stat?.size || 0) > 100) {
        return { remotePath: configured, remoteSize: Number(stat.size) };
      }
    } catch {
      // Continue to directory discovery.
    }
  }

  const desired = ["sanmar_sdl_n.csv", "sanmar_epdd.csv"];
  const directories = ["SanMarPDD", "/SanMarPDD", "."];

  for (const directory of directories) {
    try {
      const entries = await client.list(directory);

      for (const target of desired) {
        const hit = (entries || []).find(
          (entry: any) => String(entry.name || "").toLowerCase() === target
        );

        if (hit) {
          const cleanDir = directory === "." ? "" : directory.replace(/\/+$/, "");
          const remotePath = cleanDir ? `${cleanDir}/${hit.name}` : String(hit.name);
          const remoteSize = Number(hit.size || 0);

          if (remoteSize > 100) return { remotePath, remoteSize };

          const stat = await client.stat(remotePath);
          if (Number(stat?.size || 0) > 100) {
            return { remotePath, remoteSize: Number(stat.size) };
          }
        }
      }
    } catch {
      // Try the next folder.
    }
  }

  const fallbackCandidates = [
    "SanMarPDD/SanMar_SDL_N.csv",
    "SanMarPDD/Sanmar_SDL_N.csv",
    "/SanMarPDD/SanMar_SDL_N.csv",
    "/SanMarPDD/Sanmar_SDL_N.csv",
    "SanMar_SDL_N.csv",
    "Sanmar_SDL_N.csv",
    "SanMarPDD/SanMar_EPDD.csv",
    "SanMarPDD/Sanmar_EPDD.csv",
    "/SanMarPDD/SanMar_EPDD.csv",
    "/SanMarPDD/Sanmar_EPDD.csv",
    "SanMar_EPDD.csv",
    "Sanmar_EPDD.csv"
  ];

  let lastError: unknown;

  for (const remotePath of fallbackCandidates) {
    try {
      const stat = await client.stat(remotePath);
      const remoteSize = Number(stat?.size || 0);
      if (remoteSize > 100) return { remotePath, remoteSize };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(
        "SanMar SFTP connected, but neither SanMar_SDL_N.csv nor SanMar_EPDD.csv could be found."
      );
}

function findHeaderEnd(buffer: Buffer) {
  const index = buffer.indexOf(0x0a);
  if (index < 0) {
    throw new Error(
      "SanMar catalog header could not be read. The first CSV line is larger than expected."
    );
  }
  return index;
}

function parseChunk(
  header: Buffer,
  chunk: Buffer,
  finalChunk: boolean
): { records: Record<string, unknown>[]; consumedBytes: number } {
  if (!chunk.length) return { records: [], consumedBytes: 0 };

  const candidateCuts: number[] = [];

  if (finalChunk) {
    candidateCuts.push(chunk.length);
  } else {
    let position = Math.min(DEFAULT_CHUNK_BYTES, chunk.length - 1);

    while (position >= 0 && position < chunk.length) {
      const newline = chunk.indexOf(0x0a, position);
      if (newline < 0) break;
      candidateCuts.push(newline + 1);
      position = newline + 1;

      if (candidateCuts.length >= 80) break;
    }

    if (!candidateCuts.length) {
      const last = chunk.lastIndexOf(0x0a);
      if (last >= 0) candidateCuts.push(last + 1);
    }
  }

  let lastError: unknown;

  for (const cut of candidateCuts) {
    try {
      const body = chunk.subarray(0, cut);
      const csv = Buffer.concat([header, Buffer.from("\n"), body]);

      const records = parse(csv, {
        columns: true,
        bom: true,
        skip_empty_lines: true,
        relax_column_count: true,
        relax_quotes: true,
        trim: true
      }) as Record<string, unknown>[];

      return {
        records,
        consumedBytes: cut
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? new Error(`SanMar CSV chunk could not be parsed: ${lastError.message}`)
    : new Error("SanMar CSV chunk could not be parsed.");
}

async function fetchExistingRows(
  supabase: any,
  shopId: string,
  styleIds: string[]
) {
  const out: any[] = [];

  for (let index = 0; index < styleIds.length; index += 150) {
    const batch = styleIds.slice(index, index + 150);

    const { data, error } = await supabase
      .from("sanmar_catalog_styles")
      .select("*")
      .eq("shop_id", shopId)
      .in("style_id", batch);

    if (error) throw error;
    out.push(...(data || []));
  }

  return out;
}

function mergeStyle(existing: any | undefined, incoming: any) {
  const variants = new Map<string, CachedVariant>();

  for (const raw of Array.isArray(existing?.variants) ? existing.variants : []) {
    const variant = raw as CachedVariant;
    variants.set(variantKey(variant), variant);
  }

  for (const raw of incoming.variants.values()) {
    const variant = raw as CachedVariant;
    const key = variantKey(variant);
    const previous = variants.get(key);

    if (!previous || variant.quantity >= previous.quantity) {
      variants.set(key, variant);
    }
  }

  const mergedVariants = Array.from(variants.values());
  const colors = new Set(
    mergedVariants.map((variant) => variant.colorName).filter(Boolean)
  );
  const sizes = new Set(
    mergedVariants.map((variant) => variant.sizeName).filter(Boolean)
  );
  const variantPrices = mergedVariants
    .map((variant) => Number(variant.piecePrice || 0))
    .filter((value) => value > 0);

  const incomingPrices = (incoming.prices || []).filter(
    (value: number) => value > 0
  );

  const existingPriceMin = Number(existing?.price_min || 0);
  const existingPriceMax = Number(existing?.price_max || 0);

  const allPrices = [
    ...variantPrices,
    ...incomingPrices,
    ...(existingPriceMin > 0 ? [existingPriceMin] : []),
    ...(existingPriceMax > 0 ? [existingPriceMax] : [])
  ];

  return {
    brandName: incoming.brandName || existing?.brand_name || "SanMar",
    title: incoming.title || existing?.title || incoming.styleId,
    description: incoming.description || existing?.description || "",
    category: preferredCategory(
      String(existing?.category || ""),
      String(incoming.category || "")
    ),
    sourceCategory:
      incoming.sourceCategory || existing?.source_category || null,
    subcategory: incoming.subcategory || existing?.subcategory || null,
    imageUrl:
      incoming.imageUrl ||
      existing?.image_url ||
      null,
    frontModelUrl:
      incoming.frontModelUrl ||
      existing?.front_model_url ||
      null,
    backModelUrl:
      incoming.backModelUrl ||
      existing?.back_model_url ||
      null,
    frontFlatUrl:
      incoming.frontFlatUrl ||
      existing?.front_flat_url ||
      null,
    backFlatUrl:
      incoming.backFlatUrl ||
      existing?.back_flat_url ||
      null,
    colorCount: colors.size || Number(existing?.color_count || 0),
    sizeCount: sizes.size || Number(existing?.size_count || 0),
    priceMin: allPrices.length ? Math.min(...allPrices) : 0,
    priceMax: allPrices.length ? Math.max(...allPrices) : 0,
    variants: mergedVariants
  };
}

function normalizeStartedAt(input?: string) {
  if (input) {
    const parsed = new Date(input);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return new Date().toISOString();
}

export async function syncSanMarCatalogChunk(input: SyncInput) {
  const {
    supabase,
    organizationId,
    shopId,
    connection
  } = input;

  const cursor = Math.max(0, Number(input.cursor || 0));
  const syncStartedAt = normalizeStartedAt(input.syncStartedAt);
  const settings = connection.settings || {};

  if (!settings.sftpPasswordEncrypted) {
    throw new Error(
      "SanMar SFTP catalog password is not configured. Save the separate SanMar FTP password first."
    );
  }

  const customerNumber = String(
    settings.sftpUsername || settings.customerNumber || ""
  ).trim();

  if (!customerNumber) {
    throw new Error(
      "SanMar customer number / SFTP username is missing."
    );
  }

  const host = String(settings.sftpHost || "ftp.sanmar.com");
  const port = Number(settings.sftpPort || 2200);
  const password = decryptSecret(String(settings.sftpPasswordEncrypted));

  const client = new SftpClient();

  await client.connect({
    host,
    port,
    username: customerNumber,
    password,
    readyTimeout: 30000
  });

  try {
    const source = await resolveRemotePath(client, settings);
    const remotePath = source.remotePath;
    const remoteSize = source.remoteSize;

    const headerProbe = await readRange(
      client,
      remotePath,
      0,
      Math.min(remoteSize - 1, HEADER_READ_BYTES - 1)
    );

    const headerEnd = findHeaderEnd(headerProbe);
    const header = headerProbe.subarray(0, headerEnd);

    const dataStart = cursor > 0 ? cursor : headerEnd + 1;

    if (dataStart >= remoteSize) {
      const { count, error: countError } = await supabase
        .from("sanmar_catalog_styles")
        .select("id", { count: "exact", head: true })
        .eq("shop_id", shopId);

      if (countError) throw countError;

      return {
        done: true,
        nextCursor: remoteSize,
        remotePath,
        remoteSize,
        syncStartedAt,
        chunkRows: 0,
        chunkStyles: 0,
        cachedStyleCount: Number(count || 0),
        progress: 100
      };
    }

    const readEnd = Math.min(
      remoteSize - 1,
      dataStart + DEFAULT_CHUNK_BYTES + LOOKAHEAD_BYTES - 1
    );

    const chunk = await readRange(client, remotePath, dataStart, readEnd);
    const reachesEnd = readEnd >= remoteSize - 1;

    const parsed = parseChunk(header, chunk, reachesEnd);

    if (!parsed.records.length && !reachesEnd) {
      throw new Error(
        `SanMar catalog chunk at byte ${dataStart.toLocaleString()} produced no CSV rows.`
      );
    }

    const grouped = new Map<string, any>();

    for (const raw of parsed.records) {
      addRow(grouped, raw);
    }

    if (!grouped.size && parsed.records.length) {
      const headers = Object.keys(parsed.records[0] || {}).slice(0, 50).join(", ");

      throw new Error(
        `SanMar returned ${parsed.records.length.toLocaleString()} CSV rows but no style numbers were recognized. Detected headers: ${headers || "(none)"}`
      );
    }

    const styleIds = Array.from(grouped.keys());
    const existingRows = await fetchExistingRows(supabase, shopId, styleIds);
    const existingMap = new Map(
      existingRows.map((row: any) => [String(row.style_id), row])
    );

    const rows = Array.from(grouped.values()).map((incoming: any) => {
      const merged = mergeStyle(existingMap.get(incoming.styleId), incoming);

      return {
        organization_id: organizationId,
        shop_id: shopId,
        style_id: incoming.styleId,
        brand_name: merged.brandName,
        title: merged.title,
        description: merged.description,
        category: merged.category,
        source_category: merged.sourceCategory,
        subcategory: merged.subcategory,
        image_url: merged.imageUrl,
        front_model_url: merged.frontModelUrl,
        back_model_url: merged.backModelUrl,
        front_flat_url: merged.frontFlatUrl,
        back_flat_url: merged.backFlatUrl,
        color_count: merged.colorCount,
        size_count: merged.sizeCount,
        price_min: merged.priceMin,
        price_max: merged.priceMax,
        variants: merged.variants,
        source_file: remotePath,
        source_updated_at: null,
        synced_at: syncStartedAt
      };
    });

    for (let index = 0; index < rows.length; index += 60) {
      const batch = rows.slice(index, index + 60);

      const { error } = await supabase
        .from("sanmar_catalog_styles")
        .upsert(batch, { onConflict: "shop_id,style_id" });

      if (error) {
        throw new Error(
          `SanMar cache upsert failed: ${error.message || String(error)}`
        );
      }
    }

    const nextCursor = Math.min(
      remoteSize,
      dataStart + parsed.consumedBytes
    );
    const done = nextCursor >= remoteSize;

    if (done) {
      const { error: cleanupError } = await supabase
        .from("sanmar_catalog_styles")
        .delete()
        .eq("shop_id", shopId)
        .lt("synced_at", syncStartedAt);

      if (cleanupError) {
        throw new Error(
          `SanMar cache cleanup failed: ${cleanupError.message || String(cleanupError)}`
        );
      }
    }

    const { count, error: countError } = await supabase
      .from("sanmar_catalog_styles")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shopId);

    if (countError) {
      throw new Error(
        `SanMar cache verification failed: ${countError.message || String(countError)}`
      );
    }

    const cachedStyleCount = Number(count || 0);

    if (rows.length > 0 && cachedStyleCount === 0) {
      throw new Error(
        "SanMar product rows were parsed, but Supabase still reports 0 cached styles. Verify the production SanMar cache migration and active shop permissions."
      );
    }

    return {
      done,
      nextCursor,
      remotePath,
      remoteSize,
      syncStartedAt,
      chunkRows: parsed.records.length,
      chunkStyles: rows.length,
      cachedStyleCount,
      progress: Math.min(
        100,
        Math.max(0, Math.round((nextCursor / remoteSize) * 100))
      )
    };
  } finally {
    await client.end().catch(() => undefined);
  }
}
