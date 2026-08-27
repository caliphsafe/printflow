/*
  LONGEVITY ADMIN — BULK EDIT EXISTING PRODUCTS
  Adds selection to the existing Products list and opens selected Shopify
  products inside the same Bulk Upload review screen.
*/
(() => {
  const SELECTED = new Set();

  function productById(id) {
    return (typeof ADMIN_PRODUCTS !== "undefined" ? ADMIN_PRODUCTS : [])
      .find(product => product.id === id);
  }

  function productPrice(product) {
    return product?.variants?.nodes?.[0]?.price ?? "";
  }

  function variantSize(variant) {
    if (typeof getVariantSize === "function") return getVariantSize(variant);
    const option = (variant.selectedOptions || []).find(o => String(o.name).toLowerCase() === "size");
    return option?.value || variant.title || "Default";
  }

  function existingImages(product) {
    const nodes = product.media?.nodes || [];
    return nodes
      .filter(node => node.mediaContentType === "IMAGE" && node.preview?.image?.url)
      .map((node, index) => ({
        id: node.id || `existing-${product.id}-${index}`,
        file: null,
        filename: "",
        url: node.preview.image.url,
        order: index + 1,
        inputIndex: index,
        existing: true,
      }));
  }

  function toBulkProduct(product) {
    return {
      id: makeBulkId("existing"),
      productId: product.id,
      isExisting: true,
      name: product.title || "",
      price: productPrice(product),
      type: product.productType || "Product",
      status: product.status === "ACTIVE" ? "ACTIVE" : "DRAFT",
      vendor: product.vendor || "Longevity Co.",
      description: typeof stripHtml === "function"
        ? stripHtml(product.descriptionHtml || "")
        : (product.descriptionHtml || "").replace(/<[^>]*>/g, ""),
      collectionIds: (product.collections?.nodes || []).map(collection => collection.id),
      sizes: (product.variants?.nodes || []).map(variant => ({
        name: variantSize(variant),
        quantity: Math.max(0, Number(variant.inventoryQuantity || 0)),
        variantId: variant.id,
      })),
      images: existingImages(product),
      state: "editing",
      error: "",
    };
  }

  function ensureBulkEditButton() {
    const productsView = document.getElementById("view-products");
    const pageHead = productsView?.querySelector(".admin-page-head");
    if (!pageHead || document.getElementById("bulk-edit-selected-btn")) return;

    const actions = document.createElement("div");
    actions.className = "admin-product-head-actions";
    actions.innerHTML = `
      <button class="admin-text-btn" id="bulk-edit-selected-btn" type="button" hidden>
        Bulk Edit Selected (<span id="bulk-edit-selected-count">0</span>)
      </button>
    `;

    const add = document.getElementById("add-product-btn");
    if (add) pageHead.insertBefore(actions, add);
    else pageHead.appendChild(actions);

    document.getElementById("bulk-edit-selected-btn")
      .addEventListener("click", openSelectedInBulkEditor);
  }

  function updateSelectionUI() {
    const button = document.getElementById("bulk-edit-selected-btn");
    const count = document.getElementById("bulk-edit-selected-count");

    if (button) button.hidden = SELECTED.size === 0;
    if (count) count.textContent = SELECTED.size;

    document.querySelectorAll(".admin-product-row").forEach(row => {
      const id = row.querySelector("[data-edit-product]")?.dataset.editProduct;
      row.classList.toggle("is-bulk-selected", !!id && SELECTED.has(id));
      const checkbox = row.querySelector(".admin-bulk-select-input");
      if (checkbox && id) checkbox.checked = SELECTED.has(id);
    });
  }

  function enhanceProductRows() {
    ensureBulkEditButton();

    document.querySelectorAll("#admin-product-list .admin-product-row").forEach(row => {
      if (row.querySelector(".admin-bulk-select")) return;

      const id = row.querySelector("[data-edit-product]")?.dataset.editProduct;
      if (!id) return;

      const selector = document.createElement("label");
      selector.className = "admin-bulk-select";
      selector.title = "Select for bulk edit";
      selector.innerHTML = `<input class="admin-bulk-select-input" type="checkbox" aria-label="Select product for bulk edit"><span></span>`;

      selector.querySelector("input").checked = SELECTED.has(id);
      selector.querySelector("input").addEventListener("change", event => {
        if (event.target.checked) SELECTED.add(id);
        else SELECTED.delete(id);
        updateSelectionUI();
      });

      row.prepend(selector);
    });

    updateSelectionUI();
  }

  function openSelectedInBulkEditor() {
    const products = [...SELECTED].map(productById).filter(Boolean);
    if (!products.length) return;

    if (typeof resetBulkUpload === "function") resetBulkUpload();

    BULK_PRODUCTS = products.map(toBulkProduct);

    // Existing products are edited in place. Their current images are shown
    // as locked previews and are preserved because we do not re-upload them.
    renderBulkGlobalCollections();
    renderBulkProducts();
    updateBulkSummary();

    if (typeof switchView === "function") switchView("bulk");

    const title = document.querySelector("#view-bulk h1");
    const kicker = document.querySelector("#view-bulk .bulk-page-head .admin-kicker");
    if (title) title.textContent = "Bulk Edit";
    if (kicker) kicker.textContent = "Existing Products";

    setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 0);
  }

  // Preserve existing Shopify images and make their role clear.
  const originalBuildBulkProductCard = window.buildBulkProductCard;
  if (typeof originalBuildBulkProductCard === "function") {
    window.buildBulkProductCard = function(product, index) {
      let html = originalBuildBulkProductCard(product, index);

      if (product.isExisting) {
        html = html
          .replace("Detected product", "Existing Shopify product")
          .replace("Ready to upload", "Ready to save")
          .replaceAll("data-bulk-image-left=", "disabled data-existing-image data-bulk-image-left=")
          .replaceAll("data-bulk-image-right=", "disabled data-existing-image data-bulk-image-right=")
          .replaceAll("data-bulk-image-remove=", "disabled data-existing-image data-bulk-image-remove=");
      }

      return html;
    };
  }

  // Replace the bulk publish button's original listener with an enhanced
  // version that supports BOTH new products and existing products.
  function installEnhancedPublishButton() {
    const oldButton = document.getElementById("bulk-publish-btn");
    if (!oldButton || oldButton.dataset.bulkEditEnhanced) return;

    const button = oldButton.cloneNode(true);
    button.dataset.bulkEditEnhanced = "1";
    oldButton.replaceWith(button);
    button.addEventListener("click", saveBulkQueue);
  }

  async function uploadLocalImage(file, title) {
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
    (staged.parameters || []).forEach(parameter => {
      formData.append(parameter.name, parameter.value);
    });
    formData.append("file", file, file.name);

    const response = await fetch(staged.uploadUrl, { method: "POST", body: formData });
    if (!response.ok) throw new Error(`Image upload failed for ${file.name} (${response.status}).`);

    return {
      originalSource: staged.resourceUrl,
      filename: file.name,
      contentType: "IMAGE",
      alt: title,
    };
  }

  async function saveBulkQueue() {
    if (BULK_IS_UPLOADING) return;

    const queue = BULK_PRODUCTS.filter(product =>
      validateBulkProduct(product).ready && product.state !== "success"
    );
    if (!queue.length) return;

    BULK_IS_UPLOADING = true;
    updateBulkSummary();

    const progress = document.getElementById("bulk-progress");
    const list = document.getElementById("bulk-progress-list");
    if (progress) progress.hidden = false;
    if (list) list.innerHTML = "";

    let completed = 0;

    for (const product of queue) {
      updateBulkProgress(completed, queue.length, `${product.isExisting ? "Saving" : "Uploading"} ${product.name}`);

      const row = document.createElement("div");
      row.className = "bulk-progress-item is-working";
      row.innerHTML = `<span>${escapeHtml(product.name)}</span><strong>${product.isExisting ? "Saving..." : "Uploading..."}</strong>`;
      list?.appendChild(row);

      try {
        const files = [];

        // Existing remote Shopify media is intentionally omitted. Omitting
        // files from the update preserves current media. Only new local files
        // are staged and attached.
        if (!product.isExisting) {
          for (const image of product.images.filter(image => image.file)) {
            files.push(await uploadLocalImage(image.file, product.name));
          }
        }

        const payload = {
          productId: product.productId || null,
          title: String(product.name).trim(),
          descriptionHtml: textToHtml(product.description || ""),
          productType: product.type || "Product",
          status: product.status || "DRAFT",
          vendor: String(product.vendor || "").trim() || "Longevity Co.",
          price: Number(product.price || 0),
          locationId: ADMIN_LOCATIONS?.[0]?.id || null,
          collectionIds: product.collectionIds || [],
          sizes: (product.sizes || []).map(size => ({
            name: String(size.name || "").trim(),
            quantity: Math.max(0, Number(size.quantity || 0)),
            variantId: size.variantId || null,
          })).filter(size => size.name),
          files,
        };

        await apiJson("/api/admin-product-save", {
          method: "POST",
          body: JSON.stringify(payload),
        });

        product.state = "success";
        product.error = "";
        row.className = "bulk-progress-item is-success";
        row.querySelector("strong").textContent = product.isExisting ? "Saved" : (product.status === "ACTIVE" ? "Live" : "Draft saved");
      } catch (error) {
        product.state = "error";
        product.error = error.message || "Save failed";
        row.className = "bulk-progress-item is-error";
        row.querySelector("strong").textContent = "Failed";
        row.title = product.error;
      }

      completed += 1;
      updateBulkProgress(completed, queue.length, completed === queue.length ? "Batch complete" : `Processed ${completed} of ${queue.length}`);
    }

    BULK_IS_UPLOADING = false;

    try {
      await loadAdminData();
      SELECTED.clear();
      enhanceProductRows();
    } catch (error) {
      console.warn("Products saved, but catalog refresh failed:", error);
    }

    renderBulkProducts();
    updateBulkSummary();
  }

  // Observe the product list because admin.js re-renders it after filters,
  // saves, archives and inventory refreshes.
  const productList = document.getElementById("admin-product-list");
  if (productList) {
    new MutationObserver(() => enhanceProductRows())
      .observe(productList, { childList: true });
  }

  // admin data loads asynchronously after session check.
  const waitForProducts = setInterval(() => {
    if (typeof ADMIN_PRODUCTS !== "undefined") {
      enhanceProductRows();
      installEnhancedPublishButton();
      clearInterval(waitForProducts);
    }
  }, 250);

  // Keep the Bulk Upload heading correct when user chooses the nav directly.
  document.querySelector('[data-view="bulk"]')?.addEventListener("click", () => {
    const title = document.querySelector("#view-bulk h1");
    const kicker = document.querySelector("#view-bulk .bulk-page-head .admin-kicker");
    if (title) title.textContent = "Bulk Upload";
    if (kicker) kicker.textContent = "Bulk Intake";
  });
})();
