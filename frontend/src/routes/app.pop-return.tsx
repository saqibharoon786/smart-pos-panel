import { createFileRoute } from "@tanstack/react-router";
import { Camera, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { findByCode, popReturn, useProducts } from "@/lib/store";

export const Route = createFileRoute("/app/pop-return")({
  head: () => ({
    meta: [
      { title: "POP Return | Book POS" },
      { name: "description", content: "Return inventory to vendors and adjust stock automatically." },
      { property: "og:title", content: "POP Return | Book POS" },
      { property: "og:description", content: "Return inventory to vendors and adjust stock automatically." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PopReturnPage,
});

function PopReturnPage() {
  const products = useProducts();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [qty, setQty] = useState(1);
  const [reason, setReason] = useState("");
  const [scanning, setScanning] = useState(false);
  const selected = products.find((product) => product.id === selectedId);
  const needle = query.trim().toLowerCase();
  const matches = products.filter((product) => [product.name, product.upc, product.vendor, product.itemNo, product.alu].join(" ").toLowerCase().includes(needle));

  const chooseCode = (code: string) => {
    setQuery(code);
    const product = findByCode(code);
    if (product) {
      setSelectedId(product.id);
      toast.success(`${product.name} selected`);
    } else {
      setSelectedId("");
      toast.error("No product found for this barcode");
    }
  };

  const submit = async () => {
    if (!selected) {
      toast.error("Select a product first");
      return;
    }
    if (!Number.isInteger(qty) || qty <= 0) {
      toast.error("Enter a valid quantity");
      return;
    }
    if (qty > selected.onHandQty) {
      toast.error(`Only ${selected.onHandQty} unit(s) are in stock`);
      return;
    }
    if (!(await popReturn(selected.id, qty, reason))) {
      toast.error("Return could not be completed");
      return;
    }
    toast.success(`${qty} × ${selected.name} returned to vendor`);
    setSelectedId("");
    setQuery("");
    setQty(1);
    setReason("");
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold">POP Return</h2>
        <p className="text-sm text-muted-foreground">Return stock to a vendor. On-hand quantity reduces automatically.</p>
      </div>
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex gap-2">
          <label className="flex flex-1 items-center gap-2 rounded-md border border-border px-3">
            <Search className="size-4 text-muted-foreground" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search or scan product UPC" className="h-11 w-full bg-transparent text-sm outline-none" />
          </label>
          <button type="button" onClick={() => setScanning(true)} className="flex items-center gap-2 rounded-md border border-border px-4 text-sm font-medium hover:bg-secondary"><Camera className="size-4" /> Scan</button>
        </div>
        <div className="mt-3 max-h-56 overflow-y-auto rounded-md border border-border">
          {matches.map((product) => (
            <button key={product.id} type="button" onClick={() => setSelectedId(product.id)} className={`flex w-full items-center justify-between border-b border-border px-4 py-3 text-left text-sm last:border-0 ${selectedId === product.id ? "bg-accent" : "hover:bg-secondary"}`}>
              <span><span className="font-medium">{product.name}</span><span className="block text-xs text-muted-foreground">UPC {product.upc} • {product.vendor || "No vendor"}</span></span>
              <span className="font-semibold">Stock {product.onHandQty}</span>
            </button>
          ))}
          {matches.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No product found.</p>}
        </div>
        {selected && (
          <div className="mt-5 grid gap-4 border-t border-border pt-5 md:grid-cols-2">
            <label className="text-sm font-medium">Return quantity<input type="number" min={1} max={selected.onHandQty} value={qty} onChange={(event) => setQty(Number(event.target.value))} className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 outline-none focus:ring-2 focus:ring-ring" /></label>
            <label className="text-sm font-medium">Reason<input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Damaged, excess stock, wrong item..." className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 outline-none focus:ring-2 focus:ring-ring" /></label>
            <div className="md:col-span-2 flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">After return: <strong className="text-foreground">{Math.max(0, selected.onHandQty - Math.max(0, qty || 0))}</strong> in stock</p>
              <button type="button" onClick={submit} className="h-10 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90">Complete POP Return</button>
            </div>
          </div>
        )}
      </div>
      <BarcodeScanner open={scanning} onClose={() => setScanning(false)} onScan={(code) => { setScanning(false); chooseCode(code); }} />
    </div>
  );
}