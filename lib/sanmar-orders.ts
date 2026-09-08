import { decryptSecret } from "@/lib/crypto";

type Connection = { encrypted_account_number: string; encrypted_api_key: string; settings?: Record<string, any> | null };

type OrderLine = {
  style: string;
  color: string;
  size: string;
  quantity: number;
  inventoryKey?: string;
  sizeIndex?: string;
};

type Address = {
  customer: string;
  attn?: string;
  address: string;
  address2?: string;
  city: string;
  state: string;
  zip: string;
  residential?: boolean;
};

const cleanField = (value: unknown) => String(value ?? "").replace(/,/g, " ").replace(/\s+/g, " ").trim();
const escapeXml = (value: unknown) => cleanField(value)
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&apos;");

function tag(xml: string, name: string) {
  const match = xml.match(new RegExp(`<(?:(?:[A-Za-z0-9_-]+):)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:(?:[A-Za-z0-9_-]+):)?${name}>`, "i"));
  return match ? match[1].replace(/<[^>]+>/g, "").trim() : "";
}

function creds(row: Connection) {
  return {
    username: decryptSecret(row.encrypted_account_number),
    password: decryptSecret(row.encrypted_api_key),
    customerNumber: String(row.settings?.customerNumber || "")
  };
}

async function soap(url: string, body: string) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/xml; charset=utf-8", Accept: "text/xml" },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(45000)
  });
  const text = await response.text();
  const fault = /<(?:\w+:)?Fault\b/i.test(text);
  if (!response.ok || fault) throw new Error(tag(text, "faultstring") || tag(text, "message") || `SanMar PO request failed (${response.status}).`);
  return text;
}

function detailXml(lines: OrderLine[]) {
  return lines.map((line) => `<webServicePoDetailList>
    <inventoryKey>${escapeXml(line.inventoryKey || "")}</inventoryKey>
    <sizeIndex>${escapeXml(line.sizeIndex || "")}</sizeIndex>
    <style>${escapeXml(line.style)}</style>
    <color>${escapeXml(line.color)}</color>
    <size>${escapeXml(line.size)}</size>
    <quantity>${escapeXml(line.quantity)}</quantity>
    <whseNo />
  </webServicePoDetailList>`).join("");
}

function requestXml(method: "getPreSubmitInfo" | "submitPO", row: Connection, poNumber: string, address: Address, shipMethod: string, email: string, lines: OrderLine[]) {
  const c = creds(row);
  return `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:web="http://webservice.integration.sanmar.com/">
  <soapenv:Header/><soapenv:Body><web:${method}><arg0>
    <attention>${escapeXml(address.attn || poNumber)}</attention>
    <internalMessage></internalMessage><notes></notes><poNum>${escapeXml(poNumber)}</poNum><poSenderId></poSenderId>
    <residence>${address.residential ? "Y" : "N"}</residence><department></department>
    <shipAddress1>${escapeXml(address.address)}</shipAddress1><shipAddress2>${escapeXml(address.address2 || "")}</shipAddress2>
    <shipCity>${escapeXml(address.city)}</shipCity><shipEmail>${escapeXml(email)}</shipEmail><shipMethod>${escapeXml(shipMethod)}</shipMethod>
    <shipState>${escapeXml(address.state)}</shipState><shipTo>${escapeXml(address.customer)}</shipTo><shipZip>${escapeXml(address.zip)}</shipZip>
    ${detailXml(lines)}
  </arg0><arg1><sanMarCustomerNumber>${escapeXml(c.customerNumber)}</sanMarCustomerNumber><sanMarUserName>${escapeXml(c.username)}</sanMarUserName><sanMarUserPassword>${escapeXml(c.password)}</sanMarUserPassword></arg1></web:${method}></soapenv:Body></soapenv:Envelope>`;
}

export async function submitSanMarOrder(row: Connection, input: { poNumber: string; address: Address; shipMethod: string; email: string; lines: OrderLine[] }) {
  if (row.settings?.poEnabled !== true) {
    throw new Error("SanMar product-data access is connected, but production PO submission is not enabled for this shop. Complete SanMar PO onboarding/testing, then enable SanMar ordering in Suppliers.");
  }
  if (!row.settings?.customerNumber) throw new Error("SanMar customer number is required for PO submission.");
  const endpoint = String(row.settings?.poEndpoint || "https://ws.sanmar.com:8080/SanMarWebService/SanMarPOServicePort");

  const pre = await soap(endpoint, requestXml("getPreSubmitInfo", row, input.poNumber, input.address, input.shipMethod, input.email, input.lines));
  if (/true/i.test(tag(pre, "errorOccurred"))) throw new Error(tag(pre, "message") || "SanMar could not confirm inventory for this order.");

  const result = await soap(endpoint, requestXml("submitPO", row, input.poNumber, input.address, input.shipMethod, input.email, input.lines));
  if (/true/i.test(tag(result, "errorOccurred"))) throw new Error(tag(result, "message") || "SanMar rejected the purchase order.");
  const message = tag(result, "message") || "PO Submission successful";
  if (!/successful|success/i.test(message)) throw new Error(message);
  return { message, rawResponse: result };
}
