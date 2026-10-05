const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", apos: "'", gt: ">", lt: "<", quot: '"', nbsp: "\u00a0",
  AMP: "&", COPY: "©", REG: "®", TRADE: "™", QUOT: '"', GT: ">", LT: "<", NBSP: "\u00a0",
  copy: "©", reg: "®", trade: "™", cent: "¢", pound: "£", yen: "¥", euro: "€",
  sect: "§", para: "¶", middot: "·", bull: "•", ndash: "–", mdash: "—",
  lsquo: "‘", rsquo: "’", sbquo: "‚", ldquo: "“", rdquo: "”", bdquo: "„",
  hellip: "…", permil: "‰", times: "×", divide: "÷", deg: "°", plusmn: "±",
  laquo: "«", raquo: "»", acute: "´", cedil: "¸", circ: "ˆ", tilde: "˜",
  Agrave: "À", Aacute: "Á", Acirc: "Â", Atilde: "Ã", Auml: "Ä", Aring: "Å", AElig: "Æ", Ccedil: "Ç",
  Egrave: "È", Eacute: "É", Ecirc: "Ê", Euml: "Ë", Igrave: "Ì", Iacute: "Í", Icirc: "Î", Iuml: "Ï",
  ETH: "Ð", Ntilde: "Ñ", Ograve: "Ò", Oacute: "Ó", Ocirc: "Ô", Otilde: "Õ", Ouml: "Ö", Oslash: "Ø",
  Ugrave: "Ù", Uacute: "Ú", Ucirc: "Û", Uuml: "Ü", Yacute: "Ý", THORN: "Þ", szlig: "ß",
  agrave: "à", aacute: "á", acirc: "â", atilde: "ã", auml: "ä", aring: "å", aelig: "æ", ccedil: "ç",
  egrave: "è", eacute: "é", ecirc: "ê", euml: "ë", igrave: "ì", iacute: "í", icirc: "î", iuml: "ï",
  eth: "ð", ntilde: "ñ", ograve: "ò", oacute: "ó", ocirc: "ô", otilde: "õ", ouml: "ö", oslash: "ø",
  ugrave: "ù", uacute: "ú", ucirc: "û", uuml: "ü", yacute: "ý", thorn: "þ", yuml: "ÿ"
};

/** Decode HTML character references in supplier-provided display text. */
export function decodeHtmlEntities(value: unknown): string {
  let decoded = String(value ?? "");
  // Decode in passes so double-encoded supplier values such as &amp;#174; work too.
  for (let pass = 0; pass < 3; pass += 1) {
    const next = decoded.replace(/&(#(?:x[\da-f]{1,8}|\d{1,10})|[a-z][a-z\d]+);?/gi, (match, entity: string) => {
      if (entity[0] === "#") {
        const hex = entity[1]?.toLowerCase() === "x";
        const codePoint = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
        if (!Number.isFinite(codePoint) || codePoint <= 0 || codePoint > 0x10ffff || (codePoint >= 0xd800 && codePoint <= 0xdfff)) return "\uFFFD";
        try { return String.fromCodePoint(codePoint); } catch { return "\uFFFD"; }
      }
      return NAMED_ENTITIES[entity] ?? match;
    });
    if (next === decoded) break;
    decoded = next;
  }
  // Supplier feeds often add a space before a registered mark, although the
  // brand name is conventionally written with the mark attached.
  return decoded.replace(/[\t ]+([®™])/g, "$1");
}

export function decodeProductNameFields<T extends { name?: unknown; configuration?: any }>(product: T): T {
  const configuration = product.configuration;
  const supplier = configuration?.supplier;
  return {
    ...product,
    name: decodeHtmlEntities(product.name),
    ...(configuration ? {
      configuration: {
        ...configuration,
        ...(Array.isArray(configuration.colors) ? {
          colors: configuration.colors.map((color: any) => ({ ...color, name: decodeHtmlEntities(color.name) }))
        } : {}),
        ...(supplier ? { supplier: {
          ...supplier,
          brandName: decodeHtmlEntities(supplier.brandName),
          styleName: decodeHtmlEntities(supplier.styleName),
          supplierName: decodeHtmlEntities(supplier.supplierName)
        } } : {})
      }
    } : {})
  } as T;
}
