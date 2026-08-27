let BULK_PRODUCTS = [];
let BULK_IS_UPLOADING = false;

document.addEventListener("DOMContentLoaded", () => {
  initBulkUpload();
});

function initBulkUpload() {
  const input = document.getElementById("bulk-product-images");
  const zone = document.getElementById("bulk-upload-zone");
  const resetBtn = document.getElementById("bulk-reset-btn");
  const applyBtn = document.getElementById("bulk-apply-all-btn");
  const publishBtn = document.getElementById("bulk-publish-btn");

  if (!input || !zone) return;

  input.addEventListener("change", (event) => {
    ingestBulkFiles(Array.from(event.target.files || []));
    event.target.value = "";
  });

  zone.addEventListener("dragover", (event) => {
    event.preventDefault();
    zone.classList.add("is-dragging");
  });

  zone.addEventListener("dragleave", () => {
    zone.classList.remove("is-dragging");
  });

  zone.addEventListener("drop", (event) => {
    event.preventDefault();
    zone.classList.remove("is-dragging");
    ingestBulkFiles(Array.from(event.dataTransfer.files || []));
  });

  resetBtn?.addEventListener("click", resetBulkUpload);
  applyBtn?.addEventListener("click", applyBulkDefaultsToAll);
  publishBtn?.addEventListener("click", publishBulkProducts);

  renderBulkGlobalCollections();
}

function cleanBulkFilename(filename = "") {
  const withoutExt = String(filename).replace(/\.[^.]+$/, "").trim();

  let order = null;
  let base = withoutExt;

  const patterns = [
    /^(.*?)[\s_-]+\((\d+)\)\s*$/,
    /^(.*?)[\s_-]+(\d+)\s*$/,
    /^(.*?)\s*\((\d+)\)\s*$/,
  ];

  for (const pattern of patterns) {
    const match = withoutExt.match(pattern);
    if (match) {
      base = match[1].trim();
      order = Number(match[2]);
      break;
    }
  }

  if (!base) base = withoutExt;

  return {
    productName: base.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim(),
    order,
  };
}

function makeBulkId(prefix = "bulk") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function getDefaultBulkCollections() {
  const allItems = (typeof ADMIN_COLLECTIONS !== "undefined" ? ADMIN_COLLECTIONS : [])
    .filter((collection) => collection.handle === "shop-all")
    .map((collection) => collection.id);

  return allItems;
}

function makeDefaultSizes(names = ["S", "M", "L", "XL"], quantity = 0) {
  return names.map((name) => ({ name, quantity }));
}

function ingestBulkFiles(files) {
  const imageFiles = files.filter((file) => file.type?.startsWith("image/"));
  if (!imageFiles.length) return;

  const groups = new Map();

  imageFiles.forEach((file, inputIndex) => {
    const parsed = cleanBulkFilename(file.name);
    const key = parsed.productName.toLowerCase();

    if (!groups.has(key)) {
      groups.set(key, {
        id: makeBulkId("product"),
        name: parsed.productName,
        price: "",
        type: "Tops",
        status: "DRAFT",
        vendor: "Longevity Co.",
        description: "",
        collectionIds: getDefaultBulkCollections(),
        sizes: makeDefaultSizes(),
        images: [],
        state: "editing",
        error: "",
      });
    }

    groups.get(key).images.push({
      id: makeBulkId("image"),
      file,
      filename: file.name,
      url: URL.createObjectURL(file),
      order: parsed.order,
      inputIndex,
    });
  });

  groups.forEach((group) => {
    group.images.sort((a, b) => {
      if (a.order != null && b.order != null) return a.order - b.order;
      if (a.order != null) return -1;
      if (b.order != null) return 1;
      return a.inputIndex - b.inputIndex;
    });

    const existing = BULK_PRODUCTS.find(
      (product) => product.name.toLowerCase() === group.name.toLowerCase()
    );

    if (existing) {
      existing.images.push(...group.images);
      existing.images.sort((a, b) => {
        if (a.order != null && b.order != null) return a.order - b.order;
        if (a.order != null) return -1;
        if (b.order != null) return 1;
        return a.inputIndex - b.inputIndex;
      });
    } else {
      BULK_PRODUCTS.push(group);
    }
  });

  renderBulkGlobalCollections();
  renderBulkProducts();
  updateBulkSummary();
}

function resetBulkUpload() {
  if (BULK_IS_UPLOADING) return;

  BULK_PRODUCTS.forEach((product) => {
    product.images.forEach((image) => {
      if (image.url) URL.revokeObjectURL(image.url);
    });
  });

  BULK_PRODUCTS = [];

  const wrap = document.getElementById("bulk-products-wrap");
  const progress = document.getElementById("bulk-progress");
  if (wrap) wrap.innerHTML = "";
  if (progress) progress.hidden = true;

  updateBulkSummary();
}

function renderBulkGlobalCollections() {
  const wrap = document.getElementById("bulk-global-collection-grid");
  if (!wrap) return;

  const collections = typeof ADMIN_COLLECTIONS !== "undefined" ? ADMIN_COLLECTIONS : [];

  wrap.innerHTML = collections.map((collection) => `
    <label class="bulk-collection-chip">
      <input type="checkbox" value="${escapeHtml(collection.id)}" ${collection.handle === "shop-all" ? "checked" : ""} />
      <span>${escapeHtml(collection.title)}</span>
    </label>
  `).join("");
}

function collectGlobalBulkCollectionIds() {
  return Array.from(
    document.querySelectorAll("#bulk-global-collection-grid input:checked")
  ).map((input) => input.value);
}

function applyBulkDefaultsToAll() {
  if (!BULK_PRODUCTS.length || BULK_IS_UPLOADING) return;

  const price = document.getElementById("bulk-all-price")?.value ?? "";
  const type = document.getElementById("bulk-all-type")?.value || "";
  const status = document.getElementById("bulk-all-status")?.value || "";
  const vendor = document.getElementById("bulk-all-vendor")?.value.trim() || "";
  const stockValue = document.getElementById("bulk-all-stock")?.value ?? "";
  const sizePreset = document.getElementById("bulk-all-sizes")?.value || "";
  const selectedCollections = collectGlobalBulkCollectionIds();

  BULK_PRODUCTS.forEach((product) => {
    if (price !== "") product.price = price;
    if (type) product.type = type;
    if (status) product.status = status;
    if (vendor) product.vendor = vendor;
    if (selectedCollections.length) product.collectionIds = [...selectedCollections];

    if (sizePreset) {
      const names = sizePreset.split(",").map((name) => name.trim()).filter(Boolean);
      const quantity = stockValue !== "" ? Math.max(0, Number(stockValue || 0)) : 0;
      product.sizes = makeDefaultSizes(names, quantity);
    } else if (stockValue !== "") {
      product.sizes.forEach((size) => {
        size.quantity = Math.max(0, Number(stockValue || 0));
      });
    }
  });

  renderBulkProducts();
  updateBulkSummary();
}

function renderBulkProducts() {
  const wrap = document.getElementById("bulk-products-wrap");
  if (!wrap) return;

  if (!BULK_PRODUCTS.length) {
    wrap.innerHTML = "";
    return;
  }

  wrap.innerHTML = BULK_PRODUCTS.map((product, index) => buildBulkProductCard(product, index)).join("");

  BULK_PRODUCTS.forEach((product) => bindBulkProductCard(product.id));
}

function buildBulkProductCard(product, index) {
  const collections = typeof ADMIN_COLLECTIONS !== "undefined" ? ADMIN_COLLECTIONS : [];
  const validation = validateBulkProduct(product);
  const statusClass = product.state === "success" ? "is-success" : product.state === "error" ? "is-error" : validation.ready ? "is-ready" : "needs-attention";

  const imagesHtml = product.images.map((image, imageIndex) => `
    <div class="bulk-image-tile" data-image-id="${escapeHtml(image.id)}">
      <img src="${escapeHtml(image.url)}" alt="${escapeHtml(product.name)}" />
      <span class="bulk-image-role">${imageIndex === 0 ? "COVER" : imageIndex === 1 ? "HOVER" : `GALLERY ${imageIndex - 1}`}</span>
      <div class="bulk-image-controls">
        <button type="button" data-bulk-image-left="${escapeHtml(image.id)}" aria-label="Move image left">←</button>
        <button type="button" data-bulk-image-right="${escapeHtml(image.id)}" aria-label="Move image right">→</button>
        <button type="button" data-bulk-image-remove="${escapeHtml(image.id)}" aria-label="Remove image">×</button>
      </div>
    </div>
  `).join("");

  const collectionHtml = collections.map((collection) => `
    <label class="bulk-collection-chip">
      <input
        type="checkbox"
        value="${escapeHtml(collection.id)}"
        data-bulk-collection
        ${product.collectionIds.includes(collection.id) ? "checked" : ""}
      />
      <span>${escapeHtml(collection.title)}</span>
    </label>
  `).join("");

  const sizesHtml = product.sizes.map((size, sizeIndex) => `
    <div class="bulk-size-row">
      <input class="bulk-size-name" data-size-index="${sizeIndex}" type="text" value="${escapeHtml(size.name)}" placeholder="Size" />
      <input class="bulk-size-qty" data-size-index="${sizeIndex}" type="number" min="0" step="1" inputmode="numeric" value="${Number(size.quantity || 0)}" />
      <button type="button" data-remove-size="${sizeIndex}" aria-label="Remove size">×</button>
    </div>
  `).join("");

  const issueHtml = validation.issues.length
    ? validation.issues.map((issue) => `<span>${escapeHtml(issue)}</span>`).join("")
    : `<span>Ready to upload</span>`;

  return `
    <article class="bulk-product-card ${statusClass}" data-bulk-product-id="${escapeHtml(product.id)}">
      <div class="bulk-card-number">${String(index + 1).padStart(2, "0")}</div>

      <div class="bulk-card-main">
        <div class="bulk-card-head">
          <div>
            <p class="admin-kicker">Detected product</p>
            <h2>${escapeHtml(product.name || "Untitled Product")}</h2>
          </div>
          <div class="bulk-card-status">${issueHtml}</div>
        </div>

        <div class="bulk-images-strip">${imagesHtml}</div>

        <div class="bulk-fields-grid">
          <label class="bulk-field bulk-field-full">Product name<input data-bulk-field="name" type="text" value="${escapeHtml(product.name)}" /></label>
          <label class="bulk-field">Price<input data-bulk-field="price" type="number" min="0" step="0.01" inputmode="decimal" value="${escapeHtml(product.price)}" placeholder="Required" /></label>
          <label class="bulk-field">Type<select data-bulk-field="type">
            <option value="Tops" ${product.type === "Tops" ? "selected" : ""}>Tops</option>
            <option value="Bottoms" ${product.type === "Bottoms" ? "selected" : ""}>Bottoms</option>
            <option value="Outerwear" ${product.type === "Outerwear" ? "selected" : ""}>Outerwear</option>
            <option value="Accessories" ${product.type === "Accessories" ? "selected" : ""}>Accessories</option>
            <option value="Product" ${product.type === "Product" ? "selected" : ""}>Product</option>
          </select></label>
          <label class="bulk-field">Status<select data-bulk-field="status">
            <option value="DRAFT" ${product.status === "DRAFT" ? "selected" : ""}>Draft</option>
            <option value="ACTIVE" ${product.status === "ACTIVE" ? "selected" : ""}>Live</option>
          </select></label>
          <label class="bulk-field">Vendor<input data-bulk-field="vendor" type="text" value="${escapeHtml(product.vendor)}" /></label>
          <label class="bulk-field bulk-field-full">Description<textarea data-bulk-field="description" rows="4" placeholder="Product description">${escapeHtml(product.description)}</textarea></label>
        </div>

        <div class="bulk-subsection">
          <div class="bulk-subsection-head"><span>Sizes + Inventory</span><button type="button" data-add-size>+ Size</button></div>
          <div class="bulk-sizes-list">${sizesHtml}</div>
        </div>

        <div class="bulk-subsection">
          <div class="bulk-subsection-head"><span>Collections</span></div>
          <div class="bulk-collection-grid">${collectionHtml}</div>
        </div>

        <div class="bulk-card-actions">
          <button class="admin-text-btn" data-duplicate-product type="button">Duplicate</button>
          <button class="admin-text-btn" data-remove-product type="button">Remove Product</button>
        </div>

        ${product.state === "error" ? `<p class="bulk-error-message">${escapeHtml(product.error)}</p>` : ""}
      </div>
    </article>
  `;
}

function bindBulkProductCard(productId) {
  const product = BULK_PRODUCTS.find((item) => item.id === productId);
  const card = document.querySelector(`[data-bulk-product-id="${CSS.escape(productId)}"]`);
  if (!product || !card) return;

  card.querySelectorAll("[data-bulk-field]").forEach((field) => {
    const update = () => {
      product[field.dataset.bulkField] = field.value;
      product.state = "editing";
      product.error = "";
      updateBulkSummary();
      refreshBulkCardStatus(card, product);
    };
    field.addEventListener("input", update);
    field.addEventListener("change", update);
  });

  card.querySelectorAll("[data-bulk-collection]").forEach((input) => {
    input.addEventListener("change", () => {
      product.collectionIds = Array.from(card.querySelectorAll("[data-bulk-collection]:checked"))
        .map((item) => item.value);
      product.state = "editing";
      updateBulkSummary();
    });
  });

  card.querySelectorAll(".bulk-size-name").forEach((input) => {
    input.addEventListener("input", () => {
      product.sizes[Number(input.dataset.sizeIndex)].name = input.value;
      product.state = "editing";
      refreshBulkCardStatus(card, product);
      updateBulkSummary();
    });
  });

  card.querySelectorAll(".bulk-size-qty").forEach((input) => {
    input.addEventListener("input", () => {
      product.sizes[Number(input.dataset.sizeIndex)].quantity = Math.max(0, Number(input.value || 0));
      product.state = "editing";
      updateBulkSummary();
    });
  });

  card.querySelectorAll("[data-remove-size]").forEach((button) => {
    button.addEventListener("click", () => {
      product.sizes.splice(Number(button.dataset.removeSize), 1);
      product.state = "editing";
      renderBulkProducts();
      updateBulkSummary();
    });
  });

  card.querySelector("[data-add-size]")?.addEventListener("click", () => {
    product.sizes.push({ name: "", quantity: 0 });
    product.state = "editing";
    renderBulkProducts();
    updateBulkSummary();
  });

  card.querySelectorAll("[data-bulk-image-left]").forEach((button) => {
    button.addEventListener("click", () => moveBulkImage(product, button.dataset.bulkImageLeft, -1));
  });

  card.querySelectorAll("[data-bulk-image-right]").forEach((button) => {
    button.addEventListener("click", () => moveBulkImage(product, button.dataset.bulkImageRight, 1));
  });

  card.querySelectorAll("[data-bulk-image-remove]").forEach((button) => {
    button.addEventListener("click", () => removeBulkImage(product, button.dataset.bulkImageRemove));
  });

  card.querySelector("[data-remove-product]")?.addEventListener("click", () => {
    product.images.forEach((image) => image.url && URL.revokeObjectURL(image.url));
    BULK_PRODUCTS = BULK_PRODUCTS.filter((item) => item.id !== product.id);
    renderBulkProducts();
    updateBulkSummary();
  });

  card.querySelector("[data-duplicate-product]")?.addEventListener("click", () => {
    BULK_PRODUCTS.push({
      ...product,
      id: makeBulkId("product"),
      name: `${product.name} Copy`,
      images: [...product.images],
      sizes: product.sizes.map((size) => ({ ...size })),
      collectionIds: [...product.collectionIds],
      state: "editing",
      error: "",
    });
    renderBulkProducts();
    updateBulkSummary();
  });
}

function moveBulkImage(product, imageId, direction) {
  const index = product.images.findIndex((image) => image.id === imageId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= product.images.length) return;

  [product.images[index], product.images[target]] = [product.images[target], product.images[index]];
  product.state = "editing";
  renderBulkProducts();
  updateBulkSummary();
}

function removeBulkImage(product, imageId) {
  const image = product.images.find((item) => item.id === imageId);
  if (image?.url) URL.revokeObjectURL(image.url);
  product.images = product.images.filter((item) => item.id !== imageId);
  product.state = "editing";
  renderBulkProducts();
  updateBulkSummary();
}

function validateBulkProduct(product) {
  const issues = [];

  if (!String(product.name || "").trim()) issues.push("Name required");
  if (product.price === "" || Number(product.price) < 0) issues.push("Price required");
  if (!product.images.length) issues.push("Image required");
  if (!product.sizes.length || product.sizes.some((size) => !String(size.name || "").trim())) issues.push("Check sizes");

  return {
    ready: issues.length === 0,
    issues,
  };
}

function refreshBulkCardStatus(card, product) {
  const validation = validateBulkProduct(product);
  const status = card.querySelector(".bulk-card-status");

  card.classList.toggle("is-ready", validation.ready && product.state !== "success");
  card.classList.toggle("needs-attention", !validation.ready);
  card.classList.toggle("is-success", product.state === "success");
  card.classList.toggle("is-error", product.state === "error");

  if (status) {
    status.innerHTML = validation.issues.length
      ? validation.issues.map((issue) => `<span>${escapeHtml(issue)}</span>`).join("")
      : `<span>${product.state === "success" ? "Uploaded" : "Ready to upload"}</span>`;
  }
}

function updateBulkSummary() {
  const summary = document.getElementById("bulk-summary");
  const panel = document.getElementById("bulk-apply-panel");
  const publishBar = document.getElementById("bulk-publish-bar");

  const imageCount = BULK_PRODUCTS.reduce((total, product) => total + product.images.length, 0);
  const readyCount = BULK_PRODUCTS.filter((product) => validateBulkProduct(product).ready && product.state !== "success").length;
  const attentionCount = BULK_PRODUCTS.filter((product) => !validateBulkProduct(product).ready).length;

  if (summary) summary.hidden = !BULK_PRODUCTS.length;
  if (panel) panel.hidden = !BULK_PRODUCTS.length;
  if (publishBar) publishBar.hidden = !BULK_PRODUCTS.length;

  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };

  setText("bulk-product-count", BULK_PRODUCTS.length);
  setText("bulk-image-count", imageCount);
  setText("bulk-ready-count", readyCount);
  setText("bulk-attention-count", attentionCount);

  const label = document.getElementById("bulk-publish-label");
  const detail = document.getElementById("bulk-publish-detail");
  const publishBtn = document.getElementById("bulk-publish-btn");

  if (label) label.textContent = `${readyCount} product${readyCount === 1 ? "" : "s"} ready`;
  if (detail) detail.textContent = attentionCount ? `${attentionCount} need attention before they can upload.` : "Everything is ready.";
  if (publishBtn) {
    publishBtn.disabled = BULK_IS_UPLOADING || readyCount === 0;
    publishBtn.textContent = BULK_IS_UPLOADING ? "Uploading..." : `Upload ${readyCount || ""} Ready Product${readyCount === 1 ? "" : "s"}`.trim();
  }
}

async function bulkUploadOneImage(file, title) {
  const staged = await apiJson("/api/admin-upload", {
    method: "POST",
    body: JSON.stringify({
      filename: file.name,
      mimeType: file.type || "image/jpeg",
      fileSize: file.size,
    }),
  });

  if (!staged.uploadUrl || !staged.resourceUrl) {
    throw new Error(`Shopify did not prepare an upload for ${file.name}.`);
  }

  const formData = new FormData();

  (staged.parameters || []).forEach((parameter) => {
    formData.append(parameter.name, parameter.value);
  });

  formData.append("file", file, file.name);

  const uploadResponse = await fetch(staged.uploadUrl, {
    method: "POST",
    body: formData,
  });

  if (!uploadResponse.ok) {
    const detail = await uploadResponse.text();
    console.error("Bulk staged upload error:", detail);
    throw new Error(`Image upload failed for ${file.name} (${uploadResponse.status}).`);
  }

  return {
    originalSource: staged.resourceUrl,
    filename: file.name,
    contentType: "IMAGE",
    alt: title,
  };
}

async function publishBulkProducts() {
  if (BULK_IS_UPLOADING) return;

  const queue = BULK_PRODUCTS.filter(
    (product) => validateBulkProduct(product).ready && product.state !== "success"
  );

  if (!queue.length) return;

  BULK_IS_UPLOADING = true;
  updateBulkSummary();

  const progress = document.getElementById("bulk-progress");
  const progressList = document.getElementById("bulk-progress-list");
  if (progress) progress.hidden = false;
  if (progressList) progressList.innerHTML = "";

  let completed = 0;

  for (let index = 0; index < queue.length; index += 1) {
    const product = queue[index];

    updateBulkProgress(index, queue.length, `Uploading ${product.name}`);

    const row = document.createElement("div");
    row.className = "bulk-progress-item is-working";
    row.innerHTML = `<span>${escapeHtml(product.name)}</span><strong>Uploading...</strong>`;
    progressList?.appendChild(row);

    try {
      const files = [];

      for (const image of product.images) {
        files.push(await bulkUploadOneImage(image.file, product.name));
      }

      const saved = await apiJson("/api/admin-product-save", {
        method: "POST",
        body: JSON.stringify({
          productId: null,
          title: String(product.name).trim(),
          descriptionHtml: textToHtml(product.description || ""),
          productType: product.type || "Product",
          status: product.status || "DRAFT",
          vendor: String(product.vendor || "").trim() || "Longevity Co.",
          price: Number(product.price || 0),
          locationId: typeof ADMIN_LOCATIONS !== "undefined" ? ADMIN_LOCATIONS[0]?.id || null : null,
          collectionIds: product.collectionIds,
          sizes: product.sizes
            .map((size) => ({
              name: String(size.name || "").trim(),
              quantity: Math.max(0, Number(size.quantity || 0)),
            }))
            .filter((size) => size.name),
          files,
        }),
      });

      product.state = "success";
      product.error = "";
      product.shopifyProduct = saved.product || null;

      row.classList.remove("is-working");
      row.classList.add("is-success");
      row.querySelector("strong").textContent = product.status === "ACTIVE" ? "Live" : "Draft saved";
    } catch (error) {
      product.state = "error";
      product.error = error.message || "Upload failed";

      row.classList.remove("is-working");
      row.classList.add("is-error");
      row.querySelector("strong").textContent = "Failed";
      row.title = product.error;
    }

    completed += 1;
    updateBulkProgress(completed, queue.length, completed === queue.length ? "Batch complete" : `Processed ${completed} of ${queue.length}`);
  }

  BULK_IS_UPLOADING = false;

  try {
    if (typeof loadAdminData === "function") {
      await loadAdminData();
      renderBulkGlobalCollections();
    }
  } catch (error) {
    console.warn("Bulk upload completed, but admin refresh failed:", error);
  }

  renderBulkProducts();
  updateBulkSummary();
}

function updateBulkProgress(current, total, labelText) {
  const label = document.getElementById("bulk-progress-label");
  const count = document.getElementById("bulk-progress-count");
  const fill = document.getElementById("bulk-progress-fill");

  if (label) label.textContent = labelText;
  if (count) count.textContent = `${current} / ${total}`;
  if (fill) fill.style.width = `${total ? Math.min(100, (current / total) * 100) : 0}%`;
}
