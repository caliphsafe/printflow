// Run: node --test tests/artwork-pricing.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const sharp = require('sharp');
const root = path.resolve(__dirname, '..');
const resolve = Module._resolveFilename;
Module._resolveFilename = function (name, parent, ...rest) {
  return resolve.call(this, name.startsWith('@/') ? path.join(root, name.slice(2)) : name, parent, ...rest);
};
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
}).outputText, filename);

const dimensions = require('../lib/artwork-dimensions.ts');
const { normalizeConfiguration, printAreaFor } = require('../lib/catalog.ts');
const { DEFAULT_PRICING_PROFILE, normalizePricingProfile, calculateResolvedOrderPricing } = require('../lib/pricing-settings.ts');
const { analyzeOriginalArtwork } = require('../lib/artwork-analysis.ts');
const { verifyOrderArtwork } = require('../lib/verify-order-artwork.ts');

function fixture() {
  const product = { id: 'product-a', name: 'Cotton tee', active: true, slug: 'cotton-tee', configuration: normalizeConfiguration({ manualUnitCost: 2 }) };
  const profile = normalizePricingProfile(DEFAULT_PRICING_PROFILE);
  profile.orderSetupFee.enabled = false;
  profile.dtf = { ...profile.dtf, ratePerSquareInch: 1 / 15, pressFeePerLocation: 0, minimumPerLocation: 0, setupFee: 0 };
  const color = { id: 'white', name: 'White', hex: '#ffffff', active: true };
  product.configuration.colors = [color];
  return { product, profile, color };
}
function placement(product, side = 'front', size = 'full', width = 7, height = 9) {
  const zone = dimensions.artworkZone(printAreaFor(product.configuration, side, size));
  return { x: zone.x, y: zone.y, width: width / zone.widthInches * zone.width, height: height / zone.heightInches * zone.height, rotation: 0 };
}
function quote(f, method = 'dtf', selections, quantity = 12) {
  return calculateResolvedOrderPricing({ ...f, decorationMethod: method, sizes: [{ size: 'M', quantity }],
    printSelections: selections || { front: { printSize: 'full', placement: placement(f.product), inkColors: 1 } },
    designOptimizationRequested: false, selectedAddOnIds: [] });
}
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect x="20" y="10" width="56" height="72" fill="white"/></svg>';

test('14 × 18 calibration measures 7 × 9 even when legacy movement bounds are larger', () => {
  const f = fixture(), area = printAreaFor(f.product.configuration, 'front', 'full');
  const measured = dimensions.artworkDimensions(area, placement(f.product));
  assert.deepEqual(measured, { widthInches: 7, heightInches: 9, squareInches: 63 });
  const line = quote(f).printLines[0];
  assert.equal(line.unitPrice, 4.2);
  const full = quote(f, 'dtf', { front: { printSize: 'full', placement: placement(f.product, 'front', 'full', 14, 18) } });
  assert.equal(full.printLines[0].unitPrice, 16.8);
});

test('small dimensions have no artificial five-percent floor; pricing precision is retained', () => {
  const f = fixture();
  assert.equal(quote(f, 'dtf', { front: { printSize: 'full', placement: placement(f.product, 'front', 'full', 0.2, 0.3) } }).printLines[0].squareInches, 0.06);
  assert.equal(dimensions.roundPricingInput(0.066667, 6), 0.066667);
  assert.equal(dimensions.roundPricingInput(12.345, 2), 12.35);
  assert.equal(normalizePricingProfile({ dtf: { ratePerSquareInch: 0.066667 } }).dtf.ratePerSquareInch, 0.066667);
});

test('screen printing chooses measured compact dimensions independently of zone label and honors colors/discounts', () => {
  const f = fixture();
  const selections = { front: { printSize: 'full', placement: placement(f.product, 'front', 'full', 4, 4), inkColors: 2 } };
  const small = quote(f, 'screen-print', selections);
  assert.equal(small.printLines[0].pricingSize, 'heart');
  assert.equal(small.printLines[0].unitPrice, 4);
  assert.equal(quote(f, 'screen-print', selections, 36).printLines[0].unitPrice, 3.6);
  selections.front.placement = placement(f.product, 'front', 'full', 4.01, 4);
  assert.equal(quote(f, 'screen-print', selections).printLines[0].pricingSize, 'full');
  f.profile.screenPrinting.compactMaxWidthInches = 5;
  assert.equal(quote(f, 'screen-print', selections).printLines[0].pricingSize, 'heart');
});

test('embroidery estimates change with area, agree across zones, and keep production minimums', () => {
  const f = fixture();
  const sizes = [[2, 2], [4, 4], [7, 9], [14, 18]];
  const lines = sizes.map(([w, h]) => quote(f, 'embroidery', { front: { printSize: 'full', placement: placement(f.product, 'front', 'full', w, h) } }).printLines[0]);
  assert.deepEqual(lines.map(x => x.estimatedStitches), [2000, 8000, 11386, 25000]);
  assert.equal(lines[0].unitPrice, 6);
  assert.equal(lines[0].minimumApplied, true);
  const heart = quote(f, 'embroidery', { front: { printSize: 'heart', placement: placement(f.product, 'front', 'heart', 4, 4) } }).printLines[0];
  assert.equal(heart.unitPrice, lines[1].unitPrice);
  assert.equal(heart.estimatedStitches, lines[1].estimatedStitches);
});

test('front and back use independent measurements; labor, minimums, quantity, garments and setup remain separate', () => {
  const f = fixture(); f.profile.dtf.minimumPerLocation = 3; f.profile.dtf.pressFeePerLocation = 1.5; f.profile.dtf.setupFee = 25;
  const q = quote(f, 'dtf', { front: { printSize: 'full', placement: placement(f.product) }, back: { printSize: 'heart', placement: placement(f.product, 'back', 'heart', 2, 2) } });
  assert.equal(q.printLines[0].unitPrice, 5.7);
  assert.equal(q.printLines[1].unitPrice, 3);
  assert.equal(q.printLines[1].minimumApplied, true);
  assert.equal(q.printSubtotal, 104.4);
  assert.equal(q.garmentSubtotal, 26.4);
  assert.equal(q.setupFee, 25);
  assert.equal(q.totalPrice, 155.8);
});

test('exact inputs preserve proportions and stay inside the zone', () => {
  const f = fixture(), area = printAreaFor(f.product.configuration, 'front', 'full');
  const p = placement(f.product);
  assert.deepEqual(dimensions.artworkDimensions(area, dimensions.resizeArtwork(p, area, 'width', 3.5)), { widthInches: 3.5, heightInches: 4.5, squareInches: 15.75 });
  const capped = dimensions.resizeArtwork(p, area, 'height', 40);
  assert.equal(dimensions.artworkDimensions(area, capped).heightInches, 18);
  assert.doesNotThrow(() => dimensions.validateArtworkPlacement(area, capped));
  for (const invalid of [{ ...p, width: -1 }, { ...p, width: NaN }, { ...p, height: Infinity }, { ...p, x: -1 }, { ...p, width: p.width * 4 }, { ...p, rotation: 10 }]) {
    assert.throws(() => dimensions.validateArtworkPlacement(area, invalid));
  }
});

test('transparent margins are excluded, white ink retained, and the original buffer is unchanged', async () => {
  const original = await sharp(Buffer.from(svg)).png().toBuffer();
  const unchanged = Buffer.from(original);
  const source = await analyzeOriginalArtwork(original);
  assert.deepEqual(source.bounds, { x: .2, y: .1, width: .56, height: .72 });
  assert.deepEqual(original, unchanged);
  const opaque = await sharp(original).flatten({ background: 'white' }).jpeg().toBuffer();
  assert.deepEqual((await analyzeOriginalArtwork(opaque)).bounds, dimensions.FULL_ARTWORK_BOUNDS);
  const blank = await sharp({ create: { width: 100, height: 100, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
  await assert.rejects(analyzeOriginalArtwork(blank), /fully transparent/);
});

test('checkout verifies stored originals and quoted dimensions, rejects absent/replaced/tampered artwork, and leaves legacy orders alone', async () => {
  const f = fixture(), area = printAreaFor(f.product.configuration, 'front', 'full');
  const original = await sharp(Buffer.from(svg)).png().toBuffer();
  const source = await analyzeOriginalArtwork(original);
  const design = { design_configuration: { artworkSizingVersion: 2, printLines: quote(f).printLines },
    design_sides: { front: { originalPath: 'shop/order/front.png', source, placement: placement(f.product), printArea: area } } };
  await verifyOrderArtwork(design, async () => original);
  await assert.rejects(verifyOrderArtwork(design, async () => { throw new Error('missing upload'); }), /missing upload/);
  const tampered = structuredClone(design); tampered.design_sides.front.source.bounds.width = .2;
  await assert.rejects(verifyOrderArtwork(tampered, async () => original), /does not match/);
  const mismatched = structuredClone(design); mismatched.design_configuration.printLines[0].widthInches = 14;
  await assert.rejects(verifyOrderArtwork(mismatched, async () => original), /do not match the quote/);
  await verifyOrderArtwork({ design_configuration: {} }, async () => { throw new Error('legacy must not be read'); });
});

test('actual start/complete routes persist the server quote and verify the original before requesting payment', async t => {
  const f = fixture();
  const original = await sharp(Buffer.from(svg)).png().toBuffer();
  const source = await analyzeOriginalArtwork(original);
  const { normalizeShopSettings } = require('../lib/shop-settings.ts');
  const shop = { id: 'shop-a', organization_id: 'org-a', slug: 'test-shop', settings: normalizeShopSettings({}) };
  let saved, hasUpload = false, checkoutCalls = 0;
  const database = { from(table) {
    const state = {};
    const result = () => {
      if (table === 'shops') return { data: shop };
      if (table === 'subscription_accounts') return { data: null };
      if (table === 'catalog_products') return { data: [f.product] };
      if (table === 'shop_pricing_profiles') return { data: { configuration: f.profile } };
      if (table === 'designs') {
        if (state.insert) saved = { ...state.insert, id: 'design-a', shops: shop };
        if (state.update) saved = { ...saved, ...state.update };
        return { data: saved };
      }
      throw new Error(`Unexpected table ${table}`);
    };
    const query = { select() { return query; }, eq() { return query; },
      insert(value) { state.insert = value; return query; }, update(value) { state.update = value; return query; },
      single: async () => result(), maybeSingle: async () => result(), then(resolve) { return Promise.resolve(result()).then(resolve); } };
    return query;
  }, storage: { from() { return {
    createSignedUploadUrl: async () => ({ data: { token: 'fixture-upload-token' } }),
    download: async () => hasUpload ? { data: new Blob([original]) } : { error: new Error('missing') }
  }; } } };
  const admin = require('../lib/supabase-admin.ts');
  const payments = require('../lib/payments.ts');
  const commerce = require('../lib/commerce-orders.ts');
  t.mock.method(admin, 'createSupabaseAdmin', () => database);
  t.mock.method(commerce, 'mirrorDesignToCommerceOrder', async () => ({ id: 'order-a' }));
  t.mock.method(payments, 'createCheckoutForDesign', async design => {
    checkoutCalls++;
    assert.equal(design.package_price, 76.8); // 12 garments at $2.20 + 12 prints at $4.20.
    return { checkoutUrl: 'https://checkout.example/fixture', provider: 'stripe' };
  });
  const { POST: start } = require('../app/api/designs/start/route.ts');
  const { POST: complete } = require('../app/api/designs/complete/route.ts');
  const payload = {
    shopSlug: shop.slug, customer: { name: 'Test Customer', email: 'fixture@example.com' },
    configuration: { productId: f.product.id, artworkSizingVersion: 2, colorId: 'white', designMode: 'front',
      decorationMethod: f.product.configuration.customization.decorationMethods.find(x => x.toLowerCase().includes('dtf')),
      printSizes: { front: 'full' }, sizes: [{ size: 'M', quantity: 12 }], totalPrice: 0.01 },
    artworks: { front: { filename: 'logo.png', mimeType: 'image/png', sizeBytes: original.length, placement: placement(f.product), source } }
  };
  const request = data => new Request('https://printflow.example/api/designs/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  const invalid = structuredClone(payload); invalid.artworks.front.placement.width = 1000;
  assert.equal((await start(request(invalid))).status, 400);
  assert.equal(saved, undefined);
  const started = await start(request(payload));
  assert.equal(started.status, 200, await started.clone().text());
  assert.equal(saved.package_price, 76.8);
  assert.deepEqual(saved.design_sides.front.productionDimensions, { widthInches: 7, heightInches: 9, squareInches: 63 });
  assert.equal(saved.design_sides.front.source.bounds.width, .56);
  assert.equal((await complete(request({ designId: saved.id }))).status, 400);
  assert.equal(checkoutCalls, 0);
  assert.equal(saved.status, 'draft');
  hasUpload = true;
  const finished = await complete(request({ designId: saved.id }));
  assert.equal(finished.status, 200, await finished.clone().text());
  assert.equal(checkoutCalls, 1);
  assert.equal(saved.status, 'awaiting_payment');
  assert.equal((await finished.json()).checkoutUrl, 'https://checkout.example/fixture');
});
