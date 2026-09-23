import type { Sale } from "@/lib/store";

/** Shop details shown on the printed slip. */
export const STORE = {
  name: "Hamza Books Taramri",
  address1: "Shop#9, Irfan Arcade, Irfanabad",
  address2: "Taramri, Isb. Outlet#4",
  phone: "03035556893 (WhatsApp)",
  email: "hamzabooks.isb.pk@gmail.com",
  storeNo: "1",
  terms: [
    "1.Invoice+Barcode must be attached.",
    "2.Items can be Exchd within 7-days of Sale",
    "3.No Exch/Rtrn on Damaged Items.",
    "4.No Exch/Rtrn Stationary & Calculators.",
    "5.No Exch/Rtrn on Keybooks, Bags & Paper.",
    "6.Misprinted-Govt Books cannot be Exchd/Rtrnd",
  ],
  footer: "Thankyou for Shopping at Hamza Books Taramri",
};

const esc = (s: string) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const money = (n: number) =>
  `Rs ${Number(n || 0).toLocaleString("en-PK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

function receiptHtml(sale: Sale, reprint: boolean) {
  const when = new Date(sale.at).toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const subtotal = sale.items.reduce((s, i) => s + i.price * i.qty, 0);
  const discount = Number(sale.discount) || 0;
  const discLabel =
    sale.discountType === "percent"
      ? `Discount (${Number(sale.discountValue) || 0}%):`
      : "Discount:";

  const rows = sale.items
    .map(
      (i) => `<tr>
        <td class="nm">${esc(i.name)}</td>
        <td class="c">${i.qty}</td>
        <td class="r">${money(i.price)}</td>
        <td class="r">${money(i.price * i.qty)}</td>
      </tr>`,
    )
    .join("");

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${esc(sale.receiptNo)}</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body {
    width: 72mm; margin: 0 auto; padding: 2mm 0 4mm;
    font-family: "Segoe UI", Arial, Helvetica, sans-serif;
    font-size: 11px; line-height: 1.35; color: #000;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .meta { display: flex; justify-content: space-between; font-size: 10px; }
  .c { text-align: center; }
  .r { text-align: right; }
  .b { font-weight: 700; }
  .shop { text-align: center; margin-top: 2mm; }
  .shop .name { font-size: 14px; font-weight: 700; }
  .shop .line { font-size: 10px; }
  .rule { border-top: 1px solid #000; margin: 1.5mm 0; }
  table { width: 100%; border-collapse: collapse; }
  th { font-size: 10px; text-align: left; border-bottom: 1px solid #000; padding-bottom: 0.5mm; }
  td { font-size: 10px; padding: 0.4mm 0; vertical-align: top; }
  td.nm { max-width: 34mm; word-break: break-word; }
  .totals { margin-top: 1mm; }
  .totals div { display: flex; justify-content: space-between; font-size: 11px; }
  .grand { font-size: 13px; font-weight: 700; border-top: 1px solid #000; padding-top: 1mm; margin-top: 1mm; }
  .terms { margin-top: 2.5mm; text-align: center; font-size: 9.5px; }
  .terms .t { font-weight: 700; }
  .tag { text-align: center; font-weight: 700; margin-top: 3mm; letter-spacing: 1px; }
</style></head>
<body>
  <div class="meta"><span>${esc(when)}</span><span>Sales Receipt #${esc(sale.receiptNo)}</span></div>
  <div class="meta"><span>Store: ${esc(STORE.storeNo)}</span><span></span></div>
  ${reprint ? '<div class="c b">REPRINTED</div>' : ""}
  <div class="shop">
    <div class="name">${esc(STORE.name)}</div>
    <div class="line">${esc(STORE.address1)}</div>
    <div class="line">${esc(STORE.address2)}</div>
    <div class="line">${esc(STORE.phone)}</div>
    <div class="line" style="margin-top:1mm">${esc(STORE.email)}</div>
  </div>
  <div class="rule"></div>
  <table>
    <thead><tr><th>Item Name</th><th class="c">Qty</th><th class="r">Price</th><th class="r">Ext Price</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="rule"></div>
  <div class="totals">
    <div><span>Subtotal:</span><span>${money(subtotal)}</span></div>
    ${discount > 0 ? `<div><span>${discLabel}</span><span>- ${money(discount)}</span></div>` : ""}
    <div><span>Local Sales Tax 0%:</span><span>+ Rs 0.00</span></div>
    ${sale.refunded > 0 ? `<div><span>Refunded:</span><span>- ${money(sale.refunded)}</span></div>` : ""}
    <div class="grand"><span>RECEIPT TOTAL:</span><span>${money(subtotal - discount - (sale.refunded || 0))}</span></div>
  </div>
  <div class="terms">
    <div class="t">Terms &amp; Conditions:</div>
    ${STORE.terms.map((t) => `<div>${esc(t)}</div>`).join("")}
    <div style="margin-top:1mm">${esc(STORE.footer)}</div>
  </div>
  <div class="tag">${esc(sale.receiptNo)}</div>
</body></html>`;
}

function returnReceiptHtml(
  sale: Sale,
  lines: { name: string; upc: string; price: number; qty: number; amount: number }[],
  refund: number,
  reason: string,
) {
  const when = new Date().toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const rows = lines
    .map(
      (i) => `<tr>
        <td class="nm">${esc(i.name)}</td>
        <td class="c">${i.qty}</td>
        <td class="r">${money(i.price)}</td>
        <td class="r">${money(i.amount)}</td>
      </tr>`,
    )
    .join("");

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Return ${esc(sale.receiptNo)}</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body {
    width: 72mm; margin: 0 auto; padding: 2mm 0 4mm;
    font-family: "Segoe UI", Arial, Helvetica, sans-serif;
    font-size: 11px; line-height: 1.35; color: #000;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .meta { display: flex; justify-content: space-between; font-size: 10px; }
  .c { text-align: center; }
  .r { text-align: right; }
  .b { font-weight: 700; }
  .shop { text-align: center; margin-top: 2mm; }
  .shop .name { font-size: 14px; font-weight: 700; }
  .shop .line { font-size: 10px; }
  .rule { border-top: 1px solid #000; margin: 1.5mm 0; }
  table { width: 100%; border-collapse: collapse; }
  th { font-size: 10px; text-align: left; border-bottom: 1px solid #000; padding-bottom: 0.5mm; }
  td { font-size: 10px; padding: 0.4mm 0; vertical-align: top; }
  td.nm { max-width: 34mm; word-break: break-word; }
  .totals { margin-top: 1mm; }
  .totals div { display: flex; justify-content: space-between; font-size: 11px; }
  .grand { font-size: 13px; font-weight: 700; border-top: 1px solid #000; padding-top: 1mm; margin-top: 1mm; }
  .head { text-align: center; font-weight: 700; font-size: 13px; letter-spacing: 1px; margin-top: 1mm; }
  .terms { margin-top: 2.5mm; text-align: center; font-size: 9.5px; }
  .tag { text-align: center; font-weight: 700; margin-top: 3mm; letter-spacing: 1px; }
</style></head>
<body>
  <div class="meta"><span>${esc(when)}</span><span>Return Slip #${esc(sale.receiptNo)}</span></div>
  <div class="meta"><span>Store: ${esc(STORE.storeNo)}</span><span></span></div>
  <div class="shop">
    <div class="name">${esc(STORE.name)}</div>
    <div class="line">${esc(STORE.address1)}</div>
    <div class="line">${esc(STORE.address2)}</div>
    <div class="line">${esc(STORE.phone)}</div>
  </div>
  <div class="head">RETURN / REFUND</div>
  <div class="rule"></div>
  <div class="meta"><span>Original Receipt:</span><span>${esc(sale.receiptNo)}</span></div>
  <div class="meta"><span>Sold On:</span><span>${esc(new Date(sale.at).toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }))}</span></div>
  <div class="rule"></div>
  <table>
    <thead><tr><th>Item Name</th><th class="c">Qty</th><th class="r">Price</th><th class="r">Refund</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="rule"></div>
  <div class="totals">
    <div><span>Items Returned:</span><span>${lines.reduce((s, i) => s + i.qty, 0)}</span></div>
    <div class="grand"><span>REFUND TOTAL:</span><span>${money(refund)}</span></div>
  </div>
  ${reason ? `<div class="terms">Reason: ${esc(reason)}</div>` : ""}
  <div class="terms">
    <div>Refunded amount is adjusted on the original receipt.</div>
    <div style="margin-top:1mm">${esc(STORE.footer)}</div>
  </div>
  <div class="tag">${esc(sale.receiptNo)}-RTN</div>
</body></html>`;
}

let busy = false;

/**
 * Print one 80mm thermal slip.
 * Uses a hidden iframe so the app page itself is never printed and
 * exactly one copy is sent per call.
 */
function printHtml(html: string) {
  if (typeof window === "undefined" || busy) return;
  busy = true;

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "80mm";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";
  document.body.appendChild(iframe);

  const cleanup = () => {
    busy = false;
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
  };

  const doc = iframe.contentDocument;
  if (!doc) {
    cleanup();
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();

  const fire = () => {
    const win = iframe.contentWindow;
    if (!win) {
      cleanup();
      return;
    }
    win.focus();
    win.print();
    // give the browser time to hand the job to the printer, then remove
    window.setTimeout(cleanup, 1200);
  };

  if (doc.readyState === "complete") window.setTimeout(fire, 60);
  else iframe.onload = () => window.setTimeout(fire, 60);
}

/** Print an 80mm thermal slip for one sale. */
export function printReceipt(sale: Sale, opts: { reprint?: boolean } = {}) {
  printHtml(receiptHtml(sale, Boolean(opts.reprint)));
}

/** Print an 80mm refund slip for a POS return. */
export function printReturnReceipt(
  sale: Sale,
  lines: { name: string; upc: string; price: number; qty: number; amount: number }[],
  refund: number,
  reason = "",
) {
  printHtml(returnReceiptHtml(sale, lines, refund, reason));
}
