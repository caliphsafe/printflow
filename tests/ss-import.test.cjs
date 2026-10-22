// Run with: node --test tests/ss-import.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const resolve = Module._resolveFilename;
Module._resolveFilename = function (name, parent, ...rest) {
  return resolve.call(this, name.startsWith('@/') ? path.join(root, name.slice(2)) : name, parent, ...rest);
};
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
}).outputText, filename);
const { normalizeSSProduct, loadSSStyle } = require('../lib/ss-catalog.ts');
const { importSSPrintProduct } = require('../lib/ss-print-import.ts');
const { encryptSecret } = require('../lib/crypto.ts');
process.env.PRINTFLOW_ENCRYPTION_KEY = 'test-only-local-key';
const connection = { status: 'connected', encrypted_account_number: encryptSecret('test-account'), encrypted_api_key: encryptSecret('test-key') };
const raw = color => ({ styleID: 39, sku: `SKU-${color}`, skuID_Master: `MASTER-${color}`, gtin: `GTIN-${color}`, brandName: 'Gildan', styleName: '2000', colorName: color, sizeName: 'M', color1: '000000', qty: 0, warehouses: [{ qty: 12 }], customerPrice: 2.72,
  colorFrontImage: `Images/Color/${color}_f_fm.jpg`, colorBackImage: `Images/Color/${color}_b_fm.jpg`, colorOnModelFrontImage: `Images/ModelColor/${color}_omf_fm.jpg`,
  mediaAssets: [{ image: 'Images/Style/39_fm.jpg', asset_type: 'Style' }] });
const rawStyles = [{ styleID: 39, brandName: 'Gildan', styleName: '2000', title: 'Cotton &amp; Comfort', description: '<p>A shirt</p>', baseCateogry: 'T-Shirts' }];
function mockSupplier(t, rows = [raw('Black'), raw('White')]) {
  const old = global.fetch;
  global.fetch = async url => new Response(JSON.stringify(String(url).includes('/styles/') ? rawStyles : rows), { status: 200 });
  t.after(() => { global.fetch = old; });
}
function context(existing = []) {
  const writes = [];
  const supabase = { from(table) {
    const state = { filters: [] };
    const query = {
      select() { return query; }, eq(...args) { state.filters.push(args); return query; }, contains(...args) { state.contains = args; return query; }, order() { return query; },
      maybeSingle: async () => ({ data: connection }),
      update(value) { state.update = value; return query; }, insert(value) { state.insert = value; return query; },
      single: async () => { writes.push(state); return { data: { id: existing[0]?.id || 'new', ...(existing[0] || {}), ...(state.insert || state.update) } }; },
      then(resolve) { return Promise.resolve({ data: existing }).then(resolve); }
    };
    assert.ok(['supplier_connections', 'catalog_products'].includes(table));
    return query;
  } };
  return { supabase, shop: { id: 'shop-a' }, membership: { organization_id: 'org-a' }, writes };
}
const request = () => ({ styleId: '39', selectedColors: ['Black'], displayName: 'My tee', imageSelections: { Black: { frontImageUrl: 'https://www.ssactivewear.com/Images/ModelColor/Black_omf_fl.jpg' } }, customization: {
  category: 'T-Shirts', minimumQuantity: 24, decorationMethods: ['DTF'], printSizes: ['heart'], printLocations: ['Left Chest'],
  printAreas: { frontHeartArea: { x: 320, y: 230, width: 120, height: 130, widthInches: 3, heightInches: 4 } }
} });
test('S&S images stay color-specific; flat images win; zero inventory and master SKU survive', () => {
  const product = normalizeSSProduct(raw('Black'));
  assert.match(product.frontImageUrl, /Black_f_fl/);
  assert.match(product.backImageUrl, /Black_b_fl/);
  assert.equal(product.imageChoices.length, 3);
  assert.equal(product.quantity, 0);
  assert.equal(product.skuId, 'MASTER-Black');
  assert.equal(product.customerPrice, 2.72);
  assert.equal(normalizeSSProduct({ ...raw('Black'), qty: undefined }).quantity, 12);
});
test('detail groups SKU media by color and decodes style metadata', async t => {
  mockSupplier(t);
  const { style, products } = await loadSSStyle(connection, '39');
  assert.deepEqual(Object.keys(style.media), ['Black', 'White']);
  assert.equal(products.length, 2);
  assert.match(style.name, /Cotton & Comfort/);
  assert.ok(style.media.White.imageChoices.every(choice => !choice.url.includes('Black')));
});
test('import saves selected color, image, method, zone dimensions and canonical price', async t => {
  mockSupplier(t); const ctx = context(); const body = request(); body.products = [{ customerPrice: 999 }];
  const response = await importSSPrintProduct(body, ctx);
  assert.equal(response.status, 200);
  const { product } = await response.json(); const c = product.configuration;
  assert.equal(c.colors.length, 1); assert.match(c.colors[0].frontImageUrl, /Black_omf_fl/);
  assert.deepEqual(c.printLocations, ['Left Chest']); assert.deepEqual(c.customization.printSizes, ['heart']);
  assert.deepEqual(c.customization.decorationMethods, ['DTF (Direct To Fabric)']); assert.equal(c.customization.backEnabled, false);
  assert.equal(c.customization.frontHeartArea.widthInches, 3); assert.equal(c.customization.minimumQuantity, 24);
  assert.equal(c.supplier.variants[0].customerPrice, 2.72); assert.equal(c.supplier.variants[0].quantity, 0);
  assert.ok(ctx.writes[0].insert);
});
test('reimport updates the same product and preserves existing color, slug, visibility and unrelated settings', async t => {
  mockSupplier(t);
  const ctx = context([{ id: 'existing', slug: 'keep-slug', active: false, configuration: { customValue: 'keep', colors: [{ id: 'white-original', name: 'White', hex: '#ffffff', active: false }], supplier: { variants: [{ sku: 'SKU-White', colorName: 'White', sizeName: 'L', customerPrice: 3, quantity: 10 }] } } }]);
  const response = await importSSPrintProduct(request(), ctx); const { product } = await response.json();
  assert.equal(response.status, 200); assert.equal(product.id, 'existing'); assert.equal(product.slug, 'keep-slug'); assert.equal(product.active, false);
  assert.ok(ctx.writes[0].update); assert.ok(ctx.writes[0].filters.some(([key, value]) => key === 'shop_id' && value === 'shop-a'));
  assert.equal(product.configuration.colors.length, 2); assert.equal(product.configuration.colors.find(c => c.name === 'White').active, false);
  assert.equal(product.configuration.supplier.variants.length, 2);
});
test('invalid setup, foreign image and missing back imagery do not write products', async t => {
  mockSupplier(t, [{ ...raw('Black'), colorBackImage: '' }]); const ctx = context();
  assert.equal((await importSSPrintProduct({ styleId: '39' }, ctx)).status, 400);
  const foreign = request(); foreign.imageSelections.Black.frontImageUrl = 'https://example.com/other.jpg';
  assert.equal((await importSSPrintProduct(foreign, ctx)).status, 400);
  const back = request(); back.customization.printLocations = ['Back'];
  assert.equal((await importSSPrintProduct(back, ctx)).status, 400);
  assert.equal(ctx.writes.length, 0);
});
