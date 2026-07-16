/**
 * Add this through Squarespace Code Injection after creating an Add-to-cart
 * form field whose title is exactly: Design ID
 *
 * The customizer redirects to the product page with:
 * ?designId=DSN-XXXXXXXX
 */
(function () {
  const params = new URLSearchParams(window.location.search);
  const designId = params.get("designId");

  if (!designId) return;

  function labelTextFor(input) {
    const id = input.getAttribute("id");
    const directLabel = id
      ? document.querySelector(`label[for="${CSS.escape(id)}"]`)
      : null;
    const wrappingLabel = input.closest("label");
    const fieldWrapper = input.closest(
      ".form-item, .field, .product-quantity-input, [data-field]"
    );

    return [
      directLabel && directLabel.textContent,
      wrappingLabel && wrappingLabel.textContent,
      fieldWrapper && fieldWrapper.textContent,
      input.getAttribute("aria-label"),
      input.getAttribute("placeholder"),
      input.getAttribute("name")
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
  }

  function setNativeValue(input, value) {
    const descriptor = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value"
    );

    if (descriptor && descriptor.set) {
      descriptor.set.call(input, value);
    } else {
      input.value = value;
    }

    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function attachDesignId() {
    const inputs = Array.from(
      document.querySelectorAll('input[type="text"], input:not([type])')
    );

    const field = inputs.find(function (input) {
      return labelTextFor(input).includes("design id");
    });

    if (!field) return false;

    setNativeValue(field, designId);
    field.readOnly = true;
    field.setAttribute("aria-readonly", "true");

    if (!document.querySelector("[data-printflow-attached]")) {
      const notice = document.createElement("div");
      notice.setAttribute("data-printflow-attached", "true");
      notice.textContent = `Design ${designId} is attached to this order.`;
      notice.style.cssText = [
        "margin:12px 0",
        "padding:12px 14px",
        "border:1px solid currentColor",
        "border-radius:10px",
        "font-size:14px",
        "font-weight:600"
      ].join(";");

      const form = field.closest("form");
      if (form) form.prepend(notice);
    }

    return true;
  }

  if (attachDesignId()) return;

  const observer = new MutationObserver(function () {
    if (attachDesignId()) observer.disconnect();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  window.setTimeout(function () {
    observer.disconnect();
  }, 15000);
})();
