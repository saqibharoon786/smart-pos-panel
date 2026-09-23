import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Printer, ReceiptText, Search, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { printReceipt } from "@/lib/receipt";
import { updateSale, useSales, type Sale } from "@/lib/store";


export const Route = createFileRoute("/app/pos-history")({
  head: () => ({
    meta: [
      { title: "POS History | Book POS" },
      { name: "description", content: "Search receipts, sold products, totals, and refunds." },
      { property: "og:title", content: "POS History | Book POS" },
      { property: "og:description", content: "Search receipts, sold products, totals, and refunds." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PosHistoryPage,
});

function PosHistoryPage() {
  const sales = useSales();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Sale | null>(null);
  const needle = query.trim().toLowerCase();
  const rows = sales.filter((sale) =>
    [sale.receiptNo, ...sale.items.flatMap((item) => [item.name, item.upc])].join(" ").toLowerCase().includes(needle),
  );

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold">POS History</h2>
        <p className="text-sm text-muted-foreground">Every sale, receipt, item, and refund.</p>
      </div>
      <label className="flex items-center gap-2 rounded-lg border border-border bg-card px-3">
        <Search className="size-4 text-muted-foreground" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search receipt number, product or UPC" className="h-11 w-full bg-transparent text-sm outline-none" />
      </label>
      <div className="space-y-3">
        {rows.map((sale) => (
          <article key={sale.id} className="rounded-lg border border-border bg-card">
            <div className="flex flex-wrap items-center gap-4 border-b border-border p-4">
              <ReceiptText className="size-5 text-primary" />
              <div>
                <h3 className="font-semibold">Receipt {sale.receiptNo}</h3>
                <p className="text-xs text-muted-foreground">{new Date(sale.at).toLocaleString()}</p>
              </div>
              <div className="ml-auto flex items-center gap-3">
                <div className="text-right">
                  <p className="font-bold">Rs {sale.total.toFixed(2)}</p>
                  {sale.refunded > 0 && <p className="text-xs text-destructive">Refunded Rs {sale.refunded.toFixed(2)}</p>}
                </div>
                <button
                  onClick={() => printReceipt(sale, { reprint: true })}
                  className="flex h-8 items-center gap-1 rounded-md border border-border px-2.5 text-xs font-medium transition hover:bg-secondary"
                  aria-label={`Reprint receipt ${sale.receiptNo}`}
                >
                  <Printer className="size-4" /> Print
                </button>
                <button
                  onClick={() => setEditing(sale)}
                  className="flex h-8 items-center gap-1 rounded-md border border-border px-2.5 text-xs font-medium transition hover:bg-secondary"
                  aria-label={`Edit receipt ${sale.receiptNo}`}
                >
                  <Pencil className="size-4" /> Edit
                </button>

              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-sm">
                <thead className="bg-secondary/60 text-left text-xs text-muted-foreground">
                  <tr>{["Product", "UPC", "Price", "Qty", "Returned", "Line Total"].map((label) => <th key={label} className="px-4 py-2 font-medium">{label}</th>)}</tr>
                </thead>
                <tbody>{sale.items.map((item) => (
                  <tr key={item.id} className="border-t border-border">
                    <td className="px-4 py-3 font-medium">{item.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{item.upc || "—"}</td>
                    <td className="px-4 py-3">Rs {item.price.toFixed(2)}</td>
                    <td className="px-4 py-3">{item.qty}</td>
                    <td className="px-4 py-3">{item.returnedQty}</td>
                    <td className="px-4 py-3 font-medium">Rs {(item.price * item.qty).toFixed(2)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </article>
        ))}
        {rows.length === 0 && <div className="rounded-lg border border-border bg-card p-12 text-center text-sm text-muted-foreground">No POS history found.</div>}
      </div>
      {editing && <EditSaleDialog sale={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

type EditLine = { id: string; price: number; qty: number };

function EditSaleDialog({ sale, onClose }: { sale: Sale; onClose: () => void }) {
  const [lines, setLines] = useState<EditLine[]>(
    sale.items.map((i) => ({ id: i.id, price: i.price, qty: i.qty })),
  );
  const [err, setErr] = useState("");

  const set = (id: string, patch: Partial<EditLine>) =>
    setLines((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  const newTotal = lines.reduce((s, l) => s + l.price * l.qty, 0);

  const submit = async () => {
    for (const item of sale.items) {
      const line = lines.find((l) => l.id === item.id);
      if (!line) continue;
      if (line.qty < item.returnedQty) {
        setErr(`"${item.name}" ki quantity ${item.returnedQty} se kam nahi ho sakti (itne return ho chuke hain).`);
        return;
      }
    }
    const ok = await updateSale(sale.id, lines);
    if (!ok) {
      setErr("Stock utna nahi hai jitni quantity barhani hai. Quantity kam karke dobara try karein.");
      return;
    }
    toast.success(`Receipt ${sale.receiptNo} update ho gai`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/40 p-4 backdrop-blur-sm">
      <div className="my-6 w-full max-w-2xl overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between bg-primary px-4 py-3 text-primary-foreground">
          <h3 className="text-sm font-semibold">Edit Sale — Receipt {sale.receiptNo}</h3>
          <button onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </button>
        </div>
        <div className="space-y-4 p-5">
          <p className="text-xs text-muted-foreground">
            Price ya quantity theek karein. Quantity kam karne par stock wapas inventory ma chala jayega.
          </p>
          <div className="space-y-3">
            {sale.items.map((item) => {
              const line = lines.find((l) => l.id === item.id)!;
              return (
                <div key={item.id} className="rounded-lg border border-border p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium">{item.name}</div>
                    <div className="text-xs text-muted-foreground">
                      Line total Rs {(line.price * line.qty).toFixed(2)}
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      Qty
                      <input
                        type="number"
                        min={item.returnedQty}
                        value={line.qty}
                        onChange={(e) => set(item.id, { qty: Number(e.target.value) })}
                        aria-label={`Quantity for ${item.name}`}
                        className="h-8 w-20 rounded-md border border-border bg-background px-2 text-center text-sm text-foreground outline-none"
                      />
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      Price (Rs)
                      <input
                        type="number"
                        min={0}
                        value={line.price}
                        onChange={(e) => set(item.id, { price: Number(e.target.value) })}
                        aria-label={`Price for ${item.name}`}
                        className="h-8 w-24 rounded-md border border-border bg-background px-2 text-right text-sm text-foreground outline-none"
                      />
                    </label>
                    {item.returnedQty > 0 && (
                      <span className="text-xs text-muted-foreground">({item.returnedQty} returned)</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between border-t border-border pt-3 text-base font-bold">
            <span>New Total</span>
            <span>Rs {newTotal.toFixed(2)}</span>
          </div>
          {err && <p className="text-sm text-destructive">{err}</p>}
          <div className="flex justify-end gap-3 border-t border-border pt-4">
            <button
              onClick={onClose}
              className="h-10 rounded-lg border border-border px-6 text-sm font-medium transition hover:bg-secondary"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              className="h-10 rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}