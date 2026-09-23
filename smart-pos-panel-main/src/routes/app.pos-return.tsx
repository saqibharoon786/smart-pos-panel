import { createFileRoute } from "@tanstack/react-router";
import { Printer, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { printReturnReceipt } from "@/lib/receipt";
import { posReturn, saleRefundRatio, useSales } from "@/lib/store";

export const Route = createFileRoute("/app/pos-return")({
  head: () => ({
    meta: [
      { title: "POS Return | Book POS" },
      { name: "description", content: "Find a receipt, refund sold items, and restore stock automatically." },
      { property: "og:title", content: "POS Return | Book POS" },
      { property: "og:description", content: "Find a receipt, refund sold items, and restore stock automatically." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PosReturnPage,
});

function PosReturnPage() {
  const sales = useSales();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("");
  const [printSlip, setPrintSlip] = useState(true);
  const selected = sales.find((sale) => sale.id === selectedId);
  const needle = query.trim().toLowerCase();
  const matches = sales.filter((sale) => [sale.receiptNo, ...sale.items.flatMap((item) => [item.name, item.upc])].join(" ").toLowerCase().includes(needle));

  const selectSale = (id: string) => {
    setSelectedId(id);
    setQuantities({});
    setReason("");
  };

  const submit = () => {
    if (!selected) {
      toast.error("Select a receipt first");
      return;
    }
    const lines = selected.items.map((item) => ({ id: item.id, qty: Math.max(0, Math.floor(quantities[item.id] ?? 0)) })).filter((line) => line.qty > 0);
    if (lines.length === 0) {
      toast.error("Enter a return quantity");
      return;
    }
    const invalid = lines.some((line) => {
      const item = selected.items.find((candidate) => candidate.id === line.id);
      return !item || line.qty > item.qty - item.returnedQty;
    });
    if (invalid) {
      toast.error("A return quantity is higher than the remaining sold quantity");
      return;
    }
    const ratioNow = saleRefundRatio(selected);
    const slipLines = lines.map((line) => {
      const item = selected.items.find((candidate) => candidate.id === line.id)!;
      return {
        name: item.name,
        upc: item.upc,
        price: Number((item.price * ratioNow).toFixed(2)),
        qty: line.qty,
        amount: Number((item.price * ratioNow * line.qty).toFixed(2)),
      };
    });
    const refund = posReturn(selected.id, lines, reason);
    if (refund <= 0) {
      toast.error("Return could not be completed");
      return;
    }
    if (printSlip) printReturnReceipt(selected, slipLines, refund, reason);
    toast.success(`Return complete — refund Rs ${refund.toFixed(2)}`);
    setQuantities({});
    setReason("");
  };

  const ratio = selected ? saleRefundRatio(selected) : 1;
  const refundPreview = selected?.items.reduce((sum, item) => sum + item.price * ratio * Math.max(0, quantities[item.id] ?? 0), 0) ?? 0;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold">POS Return</h2>
        <p className="text-sm text-muted-foreground">Return customer purchases. Stock and refunded values update automatically.</p>
      </div>
      <label className="flex items-center gap-2 rounded-lg border border-border bg-card px-3">
        <Search className="size-4 text-muted-foreground" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search receipt number, product or UPC" className="h-11 w-full bg-transparent text-sm outline-none" />
      </label>
      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <div className="h-fit overflow-hidden rounded-lg border border-border bg-card">
          {matches.map((sale) => {
            const remaining = sale.items.reduce((sum, item) => sum + item.qty - item.returnedQty, 0);
            return (
              <button key={sale.id} type="button" onClick={() => selectSale(sale.id)} className={`w-full border-b border-border p-4 text-left last:border-0 ${selectedId === sale.id ? "bg-accent" : "hover:bg-secondary"}`}>
                <span className="flex justify-between gap-2 text-sm font-semibold"><span>{sale.receiptNo}</span><span>Rs {sale.total.toFixed(2)}</span></span>
                <span className="mt-1 block text-xs text-muted-foreground">{new Date(sale.at).toLocaleString()} • {remaining} returnable</span>
              </button>
            );
          })}
          {matches.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">No receipt found.</p>}
        </div>
        <div className="rounded-lg border border-border bg-card p-5">
          {!selected && <p className="py-16 text-center text-sm text-muted-foreground">Select a receipt to start a return.</p>}
          {selected && (
            <div className="space-y-5">
              <div className="flex flex-wrap justify-between gap-3 border-b border-border pb-4">
                <div><h3 className="font-semibold">Receipt {selected.receiptNo}</h3><p className="text-xs text-muted-foreground">{new Date(selected.at).toLocaleString()}</p></div>
                <div className="text-right text-sm"><p>Total Rs {selected.total.toFixed(2)}</p><p className="text-destructive">Already refunded Rs {selected.refunded.toFixed(2)}</p></div>
              </div>
              <div className="space-y-3">
                {selected.items.map((item) => {
                  const available = item.qty - item.returnedQty;
                  return (
                    <div key={item.id} className="grid items-center gap-3 rounded-md border border-border p-3 sm:grid-cols-[1fr_auto_auto]">
                      <div><p className="text-sm font-medium">{item.name}</p><p className="text-xs text-muted-foreground">UPC {item.upc || "—"} • Rs {item.price.toFixed(2)} • Sold {item.qty} • Returned {item.returnedQty}</p></div>
                      <span className="text-xs text-muted-foreground">Max {available}</span>
                      <input aria-label={`Return quantity for ${item.name}`} type="number" min={0} max={available} disabled={available === 0} value={quantities[item.id] ?? 0} onChange={(event) => setQuantities((current) => ({ ...current, [item.id]: Number(event.target.value) }))} className="h-9 w-24 rounded-md border border-border bg-background px-3 text-sm outline-none disabled:opacity-50" />
                    </div>
                  );
                })}
              </div>
              <label className="block text-sm font-medium">Return reason<input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Customer reason" className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 outline-none focus:ring-2 focus:ring-ring" /></label>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                <p className="font-bold">Refund: Rs {refundPreview.toFixed(2)}</p>
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input type="checkbox" checked={printSlip} onChange={(event) => setPrintSlip(event.target.checked)} className="size-4 accent-[var(--primary)]" />
                    <Printer className="size-4" /> Print return slip
                  </label>
                  <button type="button" onClick={submit} disabled={refundPreview <= 0} className="h-10 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">Complete POS Return</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}