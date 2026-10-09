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

/** Item columns are narrow, so they show the number only (no "Rs"). */
const num = (n: number) =>
  Number(n || 0).toLocaleString("en-PK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

function slipCss() {
  // 80mm roll, but the print head only marks about 64mm. Anything wider
  // runs off the right edge of the paper (prices and receipt no. get cut).
  // Height is replaced in printHtml with the slip's real height. `auto`
  // makes Chrome send a full A4-length page, so the roll keeps feeding blank.
  return `
  @page { size: 80mm 140mm; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    margin: 0;
    padding: 0;
    width: 80mm;
    background: #fff;
    height: auto !important;
    min-height: 0 !important;
    overflow: hidden !important;
  }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 13px;
    font-weight: 700;
    line-height: 1.3;
    color: #000;
    background: #fff;
    /* Thermal heads print only black dots; grey anti-aliased edges become fuzz. */
    -webkit-font-smoothing: none;
    font-smooth: never;
    text-rendering: optimizeLegibility;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .slip {
    width: 64mm;
    margin: 0 auto;
    padding: 0;
  }
  .meta { display: flex; justify-content: space-between; gap: 2mm; font-size: 12px; }
  .meta span { min-width: 0; overflow-wrap: anywhere; }
  .meta span.grow { text-align: right; }
  .c { text-align: center; }
  .r { text-align: right; }
  .b { font-weight: 700; }
  .shop { text-align: center; margin-top: 0.8mm; }
  .shop .name { font-size: 17px; font-weight: 700; overflow-wrap: anywhere; }
  .shop .line { font-size: 12px; overflow-wrap: anywhere; }
  .rule { border-top: 1px solid #000; margin: 1.2mm 0; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  col.c-name { width: 35%; }
  col.c-qty { width: 10%; }
  col.c-price { width: 26%; }
  col.c-ext { width: 29%; }
  th { font-size: 12px; text-align: left; border-bottom: 1px solid #000; padding: 0 0.4mm 0.4mm 0; overflow-wrap: anywhere; }
  td { font-size: 12px; padding: 0.4mm 0.4mm 0.4mm 0; vertical-align: top; overflow-wrap: anywhere; }
  td.r { white-space: nowrap; overflow-wrap: normal; }
  td.nm div { font-size: 11px; font-weight: 700; }
  th.r, td.r { padding-right: 0; }
  .totals { margin-top: 0.6mm; }
  .totals div { display: flex; justify-content: space-between; gap: 2mm; font-size: 13px; }
  .totals div span:first-child { min-width: 0; overflow-wrap: anywhere; }
  .totals div span:last-child { white-space: nowrap; }
  .grand { font-size: 16px; font-weight: 700; border-top: 1px solid #000; padding-top: 1mm; margin-top: 1mm; }
  .terms { margin-top: 1.5mm; text-align: center; font-size: 12px; font-weight: 700; overflow-wrap: anywhere; }
  .terms .t { font-weight: 700; }
  .tag { text-align: center; font-size: 14px; font-weight: 700; margin-top: 1.5mm; letter-spacing: 0.4px; }
  .head { text-align: center; font-weight: 700; font-size: 16px; letter-spacing: 0.4px; margin-top: 1mm; }
  .cut-space { height: 3mm; }
  @media print {
    html, body { width: 80mm !important; min-height: 0 !important; overflow: hidden !important; margin: 0 !important; padding: 0 !important; }
    .slip { width: 64mm !important; }
  }
`;
}

function receiptHtml(sale: Sale, reprint: boolean) {
  const when = new Date(sale.at).toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const subtotal = Number(sale.subtotal) || sale.items.reduce((s, i) => s + i.price * i.qty, 0);
  const itemDiscount = sale.items.reduce((s, i) => s + (Number(i.lineDiscount) || 0), 0);
  const listGross = sale.items.reduce((s, i) => s + Number(i.listPrice ?? i.price) * i.qty, 0);
  const discount = Number(sale.discount) || 0;
  const discLabel =
    sale.discountType === "percent"
      ? `Bill discount (${Number(sale.discountValue) || 0}%):`
      : "Bill discount:";

  const rows = sale.items
    .map((i) => {
      const off = Number(i.lineDiscount) || 0;
      const discNote =
        off > 0
          ? i.discountType === "percent"
            ? `Item disc ${Number(i.discountValue) || 0}%`
            : `Item disc ${money(off)}`
          : "";
      return `<tr>
        <td class="nm">${esc(i.name)}${discNote ? `<div>${esc(discNote)}</div>` : ""}</td>
        <td class="c">${i.qty}</td>
        <td class="r">${num(i.price)}</td>
        <td class="r">${num(i.price * i.qty)}</td>
      </tr>`;
    })
    .join("");

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${esc(sale.receiptNo)}</title>
<style>${slipCss()}</style></head>
<body>
  <div class="slip">
    <div class="meta"><span>${esc(when)}</span><span class="grow">Receipt #${esc(sale.receiptNo)}</span></div>
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
      <colgroup><col class="c-name"><col class="c-qty"><col class="c-price"><col class="c-ext"></colgroup>
      <thead><tr><th>Item</th><th class="c">Qty</th><th class="r">Price</th><th class="r">Amount</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="rule"></div>
    <div class="totals">
      ${itemDiscount > 0 ? `<div><span>Items:</span><span>${money(listGross)}</span></div><div><span>Item discount:</span><span>- ${money(itemDiscount)}</span></div>` : ""}
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
    <div class="cut-space"></div>
  </div>
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
        <td class="r">${num(i.price)}</td>
        <td class="r">${num(i.amount)}</td>
      </tr>`,
    )
    .join("");

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Return ${esc(sale.receiptNo)}</title>
<style>${slipCss()}</style></head>
<body>
  <div class="slip">
    <div class="meta"><span>${esc(when)}</span><span class="grow">Return #${esc(sale.receiptNo)}</span></div>
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
      <colgroup><col class="c-name"><col class="c-qty"><col class="c-price"><col class="c-ext"></colgroup>
      <thead><tr><th>Item</th><th class="c">Qty</th><th class="r">Price</th><th class="r">Refund</th></tr></thead>
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
    <div class="cut-space"></div>
  </div>
</body></html>`;
}

let busy = false;

type PrintJob = {
  print: (html: string, onError?: (error: Error) => void) => void;
  cancel: () => void;
};

/** Last inked pixel of the slip. Ignores empty space below it. */
function slipContentPx(slip: HTMLElement) {
  const top = slip.getBoundingClientRect().top;
  let bottom = 0;
  // Elements live in the iframe's window, so `instanceof HTMLElement`
  // (the app window's class) is always false here. Use Element APIs only.
  for (const el of Array.from(slip.children)) {
    bottom = Math.max(bottom, el.getBoundingClientRect().bottom - top);
  }
  if (bottom > 20) return Math.ceil(bottom + 2);
  return Math.ceil(slip.scrollHeight || 240);
}

/**
 * Print one 80mm thermal slip.
 * The page is only as long as the receipt, so the roll does not keep feeding.
 * Uses one opaque iframe so the app page itself is never printed.
 */
function preparePrintJob(): PrintJob | null {
  if (typeof window === "undefined" || busy) return null;
  busy = true;

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.setAttribute("title", "Receipt print");
  iframe.setAttribute("data-receipt-print", "true");
  // Opaque and laid out. A 0-height or opacity:0 frame prints a blank roll.
  // Keep it off-screen; height is shrunk to the slip before print().
  iframe.style.position = "fixed";
  iframe.style.left = "-120mm";
  iframe.style.top = "0";
  iframe.style.width = "80mm";
  iframe.style.height = "1000px";
  iframe.style.border = "0";
  iframe.style.opacity = "1";
  iframe.style.background = "#fff";
  iframe.style.pointerEvents = "none";
  document.body.appendChild(iframe);

  const shield = document.createElement("style");
  shield.textContent = `
    @media print {
      body > *:not([data-receipt-print]) { display: none !important; }
      body > iframe[data-receipt-print] {
        display: block !important;
        position: fixed !important;
        left: 0 !important;
        top: 0 !important;
        width: 80mm !important;
        border: 0 !important;
      }
    }
  `;
  document.head.appendChild(shield);

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    busy = false;
    shield.remove();
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
  };

  const doc = iframe.contentDocument;
  if (!doc) {
    cleanup();
    throw new Error("Receipt print frame could not be opened.");
  }

  const print = (html: string, onError?: (error: Error) => void) => {
    const fail = (error: unknown) => {
      cleanup();
      onError?.(error instanceof Error ? error : new Error("Receipt could not be printed."));
    };

    try {
      doc.open();
      doc.write(html);
      doc.close();

      const fire = () => {
        if (cleaned) return;
        const win = iframe.contentWindow;
        const inner = iframe.contentDocument;
        const slip = inner?.querySelector<HTMLElement>(".slip");
        if (!win || !inner?.body || !slip) {
          fail(new Error("Receipt content is unavailable."));
          return;
        }


        const px = slipContentPx(slip);
        // 96 CSS px = 25.4mm. A couple of mm keeps the last line off the cutter
        // without feeding a second blank page.
        const mm = Math.max(20, Math.ceil((px * 25.4) / 96) + 3);
        const styleEl = inner.querySelector("style");
        const pageRule = `@page { size: 80mm ${mm}mm; margin: 0; }`;
        if (styleEl?.textContent) {
          styleEl.textContent = styleEl.textContent.replace(/@page\s*\{[^}]*\}/, pageRule);
        }
        const lock = inner.createElement("style");
        lock.textContent = `html, body { width: 80mm !important; height: ${mm}mm !important; max-height: ${mm}mm !important; min-height: 0 !important; overflow: hidden !important; margin: 0 !important; padding: 0 !important; }`;
        inner.head.appendChild(lock);
        iframe.style.height = `${mm}mm`;

        window.setTimeout(() => {
          if (cleaned) return;
          try {
            win.focus();
            win.addEventListener("afterprint", cleanup, { once: true });
            win.print();
            window.setTimeout(cleanup, 20000);
          } catch (error) {
            fail(error);
          }
        }, 60);
      };

      if (doc.readyState === "complete") window.setTimeout(fire, 80);
      else iframe.onload = () => window.setTimeout(fire, 80);
    } catch (error) {
      fail(error);
    }
  };

  return { print, cancel: cleanup };
}

function printHtml(html: string) {
  const job = preparePrintJob();
  if (!job) return;
  job.print(html);
}

/** Reserve the print frame during the checkout click, before the sale is saved. */
export function prepareReceiptPrint(
  onError?: (error: Error) => void,
): { print: (sale: Sale) => void; cancel: () => void } | null {
  const job = preparePrintJob();
  if (!job) return null;
  return {
    print: (sale) => job.print(receiptHtml(sale, false), onError),
    cancel: job.cancel,
  };
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
