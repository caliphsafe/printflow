/**
 * PrintFlow Google Drive + Sheet receiver.
 *
 * Deploy this project from the PRINT SHOP OWNER'S Google account:
 * - Execute as: Me
 * - Who has access: Anyone
 *
 * Run setupIntegration() once before deployment.
 */

const HEADERS = [
  "Received At",
  "Squarespace Order #",
  "Squarespace Order ID",
  "Design ID",
  "Customer Name",
  "Customer Email",
  "Customer Phone",
  "Product",
  "Package",
  "Package Quantity",
  "Package Price",
  "Shirt Color",
  "Print Location",
  "Size Breakdown",
  "Customer Notes",
  "Order Total",
  "Shipping Address",
  "Drive Folder",
  "Original Artwork",
  "Preview"
];

function setupIntegration() {
  const properties = PropertiesService.getScriptProperties();

  let folderId = properties.getProperty("ROOT_FOLDER_ID");
  let spreadsheetId = properties.getProperty("SPREADSHEET_ID");
  let secret = properties.getProperty("WEBHOOK_SECRET");

  if (!folderId) {
    const folder = DriveApp.createFolder("PrintFlow Orders");
    folderId = folder.getId();
    properties.setProperty("ROOT_FOLDER_ID", folderId);
  }

  if (!spreadsheetId) {
    const spreadsheet = SpreadsheetApp.create("PrintFlow Orders");
    const file = DriveApp.getFileById(spreadsheet.getId());
    const rootFolder = DriveApp.getFolderById(folderId);
    file.moveTo(rootFolder);

    const sheet = spreadsheet.getSheets()[0];
    sheet.setName("Paid Orders");
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, HEADERS.length);

    spreadsheetId = spreadsheet.getId();
    properties.setProperty("SPREADSHEET_ID", spreadsheetId);
  }

  if (!secret) {
    secret = Utilities.getUuid().replace(/-/g, "") +
      Utilities.getUuid().replace(/-/g, "");
    properties.setProperty("WEBHOOK_SECRET", secret);
  }

  Logger.log("ROOT_FOLDER_ID: " + folderId);
  Logger.log("SPREADSHEET_ID: " + spreadsheetId);
  Logger.log("WEBHOOK_SECRET: " + secret);
}

function doGet() {
  return jsonResponse({
    ok: true,
    service: "PrintFlow Google receiver"
  });
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || "{}");
    const payloadB64 = String(body.payloadB64 || "");
    const signature = String(body.signature || "").toLowerCase();

    if (!payloadB64 || !signature) {
      return jsonResponse({ ok: false, error: "Missing signed payload." });
    }

    const properties = PropertiesService.getScriptProperties();
    const secret = properties.getProperty("WEBHOOK_SECRET");

    if (!secret) {
      return jsonResponse({
        ok: false,
        error: "Integration has not been initialized."
      });
    }

    const expected = bytesToHex(
      Utilities.computeHmacSha256Signature(payloadB64, secret)
    ).toLowerCase();

    if (!constantTimeEqual(expected, signature)) {
      return jsonResponse({ ok: false, error: "Invalid signature." });
    }

    const payloadJson = Utilities.newBlob(
      Utilities.base64Decode(payloadB64)
    ).getDataAsString("UTF-8");
    const payload = JSON.parse(payloadJson);

    const spreadsheetId = properties.getProperty("SPREADSHEET_ID");
    const rootFolderId = properties.getProperty("ROOT_FOLDER_ID");
    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    const sheet = spreadsheet.getSheetByName("Paid Orders") ||
      spreadsheet.getSheets()[0];

    if (sheet.getLastRow() > 1) {
      const found = sheet
        .getRange(2, 4, sheet.getLastRow() - 1, 1)
        .createTextFinder(payload.designId)
        .matchEntireCell(true)
        .findNext();

      if (found) {
        return jsonResponse({
          ok: true,
          duplicate: true,
          designId: payload.designId
        });
      }
    }

    const rootFolder = DriveApp.getFolderById(rootFolderId);
    const folderName = sanitizeFilename(
      `${payload.orderNumber || "Order"} - ${payload.designId}`
    );
    const orderFolder = rootFolder.createFolder(folderName);

    const originalFile = saveRemoteFile(
      orderFolder,
      payload.files.original.signedUrl,
      payload.files.original.filename
    );

    const previewFile = saveRemoteFile(
      orderFolder,
      payload.files.preview.signedUrl,
      payload.files.preview.filename
    );

    const sizeBreakdown = (payload.product.sizes || [])
      .filter(function(item) {
        return Number(item.quantity) > 0;
      })
      .map(function(item) {
        return item.size + ": " + item.quantity;
      })
      .join(", ");

    sheet.appendRow([
      new Date(),
      payload.orderNumber || "",
      payload.orderId || "",
      payload.designId || "",
      payload.customer.name || "",
      payload.customer.email || "",
      payload.customer.phone || "",
      payload.product.name || "",
      payload.product.package || "",
      payload.product.quantity || "",
      payload.product.price || "",
      payload.product.shirtColor || "",
      payload.product.printLocation || "",
      sizeBreakdown,
      payload.notes || "",
      formatMoney(payload.checkout.grandTotal),
      formatAddress(payload.checkout.shippingAddress),
      orderFolder.getUrl(),
      originalFile.getUrl(),
      previewFile.getUrl()
    ]);

    return jsonResponse({
      ok: true,
      designId: payload.designId,
      folderUrl: orderFolder.getUrl(),
      spreadsheetUrl: spreadsheet.getUrl()
    });
  } catch (error) {
    console.error(error);
    return jsonResponse({
      ok: false,
      error: error && error.message ? error.message : String(error)
    });
  }
}

function saveRemoteFile(folder, url, filename) {
  const response = UrlFetchApp.fetch(url, {
    muteHttpExceptions: true,
    followRedirects: true
  });

  const status = response.getResponseCode();
  if (status < 200 || status >= 300) {
    throw new Error("Unable to download " + filename + ". HTTP " + status);
  }

  const blob = response.getBlob().setName(sanitizeFilename(filename));
  return folder.createFile(blob);
}

function formatMoney(value) {
  if (!value || value.value === undefined) return "";
  return `${value.currency || "USD"} ${Number(value.value).toFixed(2)}`;
}

function formatAddress(address) {
  if (!address) return "";
  return [
    address.firstName,
    address.lastName,
    address.address1,
    address.address2,
    address.city,
    address.state,
    address.postalCode,
    address.countryCode
  ]
    .filter(Boolean)
    .join(", ");
}

function sanitizeFilename(value) {
  return String(value || "file")
    .replace(/[\\/:*?"<>|#%{}~]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

function bytesToHex(bytes) {
  return bytes
    .map(function(byte) {
      const value = byte < 0 ? byte + 256 : byte;
      return ("0" + value.toString(16)).slice(-2);
    })
    .join("");
}

function constantTimeEqual(left, right) {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index++) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return result === 0;
}

function jsonResponse(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
