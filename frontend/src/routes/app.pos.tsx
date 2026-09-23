import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Barcode, Camera, Minus, PauseCircle, Percent, Play, Plus, Receipt, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  commitSale,
  deleteHeldSale,
  findByCode,
  holdSale,
  saleDiscountAmount,
  useHeldSales,
  useProducts,
  type Product,
} from "@/lib/store";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { printReceipt } from "@/lib/receipt";


export const Route = createFileRoute("/app/pos")({
  head: () => ({
    meta: [
      { title: "POS — Checkout | Book POS" },
      { name: "description", content: "Scan barcodes and ring up multi-item sales in Book POS." },
      { property: "og:title", content: "POS — Checkout | Book POS" },
      { property: "og:description", content: "Scan barcodes and ring up multi-item sales in Book POS." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PosPage,
});

type Line = { id: string; name: string; price: number; qty: number; upc: string; stock: number };

function PosPage() {
  const products = useProducts();
  const [lines, setLines] = useState<Line[]>([]);
  const [code, setCode] = useState("");
  const [last, setLast] = useState<Line | null>(null);
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(false);
  const [q, setQ] = useState("");
  const [discType, setDiscType] = useState<"none" | "percent" | "amount">("none");
  const [discValue, setDiscValue] = useState(0);
  const [holdLabel, setHoldLabel] = useState("");
  const held = useHeldSales();
  const scanRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scanRef.current?.focus();
  }, []);

  const addProductToSale = (p: Product) => {
    const existingQty = lines.find((item) => item.id === p.id)?.qty ?? 0;
    if (Number(p.onHandQty) <= existingQty) {
      setError(`Only ${p.onHandQty} unit(s) of "${p.name}" are available.`);
      toast.error("Not enough stock");
      return;
    }
    const line: Line = {
      id: p.id,
      name: p.name,
      price: Number(p.regPrice),
      qty: 1,
      upc: p.upc,
      stock: Number(p.onHandQty),
    };
    setLines((ls) =>
      ls.some((l) => l.id === p.id)
        ? ls.map((l) => (l.id === p.id ? { ...l, qty: l.qty + 1 } : l))
        : [...ls, line],
    );
    setLast(line);
    setError("");
  };

  const handleCode = (raw: string) => {
    const p = findByCode(raw);
    if (!p) {
      setError(`No product found for code "${raw}". Add it in POP first.`);
      toast.error("Product not found");
    } else {
      addProductToSale(p);
      toast.success(`${p.name} added`);
    }
  };

  const scan = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim()) handleCode(code);
    setCode("");
    scanRef.current?.focus();
  };

  const step = (id: string, d: number) =>
    setLines((ls) =>
      ls.flatMap((l) => {
        if (l.id !== id) return [l];
        if (l.qty + d <= 0) return [];
        if (l.qty + d > l.stock) {
          toast.error(`Only ${l.stock} unit(s) available`);
          return [l];
        }
        return [{ ...l, qty: l.qty + d }];
      }),
    );

  const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
  const itemCount = lines.reduce((s, l) => s + l.qty, 0);
  const discount = saleDiscountAmount(subtotal, discType, discValue);
  const grandTotal = Math.max(0, subtotal - discount);

  const visibleProducts = products.filter((p) =>
    (p.name + p.department + p.upc).toLowerCase().includes(q.trim().toLowerCase()),
  );

  const setLinePrice = (id: string, price: number) =>
    setLines((ls) => ls.map((l) => (l.id === id ? { ...l, price: price < 0 ? 0 : price } : l)));

  const setLineQty = (id: string, qty: number) =>
    setLines((ls) =>
      ls.map((l) => {
        if (l.id !== id) return l;
        if (qty < 1) return l;
        if (qty > l.stock) {
          toast.error(`Only ${l.stock} unit(s) available`);
          return l;
        }
        return { ...l, qty };
      }),
    );

  const charge = async () => {
    try {
      const sale = await commitSale(
        lines.map((l) => ({ id: l.id, name: l.name, upc: l.upc, price: l.price, qty: l.qty })),
        { type: discType, value: discValue },
      );
      if (sale) printReceipt(sale);
      toast.success(`Sale complete — ${itemCount} item(s), Rs ${grandTotal.toFixed(2)}`);
      setLines([]);
      setDiscType("none");
      setDiscValue(0);
      setLast(null);
      scanRef.current?.focus();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sale failed");
    }
  };

  const hold = async () => {
    const saved = await holdSale(
      lines.map((l) => ({ id: l.id, name: l.name, upc: l.upc, price: l.price, qty: l.qty })),
      { type: discType, value: discValue },
      { label: holdLabel },
    );
    if (!saved) return;
    toast.success(`Receipt held — ${saved.label}`);
    setLines([]);
    setDiscType("none");
    setDiscValue(0);
    setHoldLabel("");
    setLast(null);
    scanRef.current?.focus();
  };

  const resumeHeld = async (id: string) => {
    const entry = held.find((h) => h.id === id);
    if (!entry) return;
    if (lines.length > 0) {
      toast.error("Pehle mojooda sale charge ya hold karein");
      return;
    }
    let trimmed = false;
    const restored: Line[] = [];
    for (const item of entry.items) {
      const product = products.find((p) => p.id === item.id);
      const stock = Number(product?.onHandQty ?? 0);
      if (!product || stock <= 0) {
        trimmed = true;
        continue;
      }
      const qty = Math.min(item.qty, stock);
      if (qty < item.qty) trimmed = true;
      restored.push({ id: item.id, name: product.name, upc: product.upc, price: item.price, qty, stock });
    }
    if (restored.length === 0) {
      toast.error("Is held receipt ke items ka stock khatam ho gaya hai");
      return;
    }
    setLines(restored);
    setDiscType(entry.discountType === "none" ? "none" : entry.discountType);
    setDiscValue(entry.discountValue);
    await deleteHeldSale(entry.id);
    toast.success(trimmed ? `${entry.label} resumed — stock ke mutabiq qty adjust ki gai` : `${entry.label} resumed`);
    scanRef.current?.focus();
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">POS — Checkout</h2>
        <p className="text-sm text-muted-foreground">
          Scan or type the UPC / barcode and press Enter. You can also tap a product below.
        </p>

        <form
          onSubmit={scan}
          className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4"
        >
          <div className="flex min-w-56 flex-1 items-center gap-2 rounded-lg border border-border bg-background px-3">
            <Barcode className="size-5 text-primary" />
            <input
              ref={scanRef}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Scan barcode / enter UPC, ALU or Item No."
              autoComplete="off"
              className="h-11 w-full bg-transparent text-sm outline-none"
            />
          </div>
          <button
            type="submit"
            className="h-11 rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => setScanning(true)}
            className="flex h-11 items-center gap-2 rounded-lg border border-border px-4 text-sm font-medium transition hover:bg-secondary"
          >
            <Camera className="size-4" />
            Scan with camera
          </button>
        </form>

        <BarcodeScanner
          open={scanning}
          onClose={() => setScanning(false)}
          onScan={(scanned) => handleCode(scanned)}
        />

        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

        {last && (
          <div className="mt-3 rounded-xl border border-primary/40 bg-accent/40 p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Last scanned</div>
            <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
              <div className="text-lg font-bold">{last.name}</div>
              <div className="text-lg font-bold text-primary">Rs {last.price.toFixed(2)}</div>
            </div>
            <div className="text-xs text-muted-foreground">
              UPC {last.upc || "—"} • In stock {last.stock}
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">Products</h3>
          <div className="flex min-w-56 flex-1 items-center gap-2 rounded-lg border border-border bg-card px-3 sm:max-w-xs">
            <Search className="size-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search products"
              className="h-9 w-full bg-transparent text-sm outline-none"
            />
          </div>
        </div>

        <div className="mt-3 overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left text-xs text-muted-foreground">
              <tr>
                {["Item Name", "Department", "UPC", "Price", "Stock", ""].map((h) => (
                  <th key={h} className="px-4 py-3 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleProducts.map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3">{p.department}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.upc || "—"}</td>
                  <td className="px-4 py-3">Rs {Number(p.regPrice).toFixed(2)}</td>
                  <td className="px-4 py-3">{p.onHandQty}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => addProductToSale(p)}
                      disabled={Number(p.onHandQty) <= 0}
                      className="h-8 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
                    >
                      Add
                    </button>
                  </td>
                </tr>
              ))}
              {visibleProducts.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                    No products found. Add them in the POP module first.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
            {visibleProducts.length} record(s) in results
          </div>
        </div>
      </div>

      <div className="h-fit rounded-xl border border-border bg-card p-5 lg:sticky lg:top-6">
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <Receipt className="size-4 text-primary" />
          <h3 className="text-sm font-semibold">Current Sale</h3>
          <span className="ml-auto text-xs text-muted-foreground">{itemCount} item(s)</span>
        </div>
        <div className="space-y-3 py-4">
          {lines.map((l) => (
            <div key={l.id} className="rounded-lg border border-border p-3 text-sm">
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <div className="font-medium">{l.name}</div>
                  <div className="text-xs text-muted-foreground">
                    Line total Rs {(l.price * l.qty).toFixed(2)}
                  </div>
                </div>
                <button
                  onClick={() => setLines((ls) => ls.filter((x) => x.id !== l.id))}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label={`Remove ${l.name}`}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <button onClick={() => step(l.id, -1)} className="rounded border border-border p-1">
                  <Minus className="size-3" />
                </button>
                <input
                  type="number"
                  min={1}
                  value={l.qty}
                  onChange={(e) => setLineQty(l.id, Number(e.target.value))}
                  aria-label={`Quantity for ${l.name}`}
                  className="h-8 w-14 rounded-md border border-border bg-background px-2 text-center text-sm outline-none"
                />
                <button onClick={() => step(l.id, 1)} className="rounded border border-border p-1">
                  <Plus className="size-3" />
                </button>
                <span className="ml-auto text-xs text-muted-foreground">Rs</span>
                <input
                  type="number"
                  value={l.price}
                  onChange={(e) => setLinePrice(l.id, Number(e.target.value))}
                  aria-label={`Price for ${l.name}`}
                  className="h-8 w-20 rounded-md border border-border bg-background px-2 text-right text-sm outline-none"
                />
              </div>
            </div>
          ))}
          {lines.length === 0 && <p className="text-sm text-muted-foreground">No items yet.</p>}
        </div>
        <div className="space-y-2 border-t border-border pt-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span>Rs {subtotal.toFixed(2)}</span>
          </div>

          <div>
            <div className="mb-1 flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <Percent className="size-3" />
              Discount
            </div>
            <div className="flex gap-2">
              <select
                value={discType}
                onChange={(e) => setDiscType(e.target.value as "none" | "percent" | "amount")}
                aria-label="Discount type"
                className="h-9 flex-1 rounded-md border border-border bg-background px-2 text-sm outline-none"
              >
                <option value="none">No discount</option>
                <option value="percent">Percentage (%)</option>
                <option value="amount">Amount (Rs)</option>
              </select>
              <input
                type="number"
                min={0}
                max={discType === "percent" ? 100 : undefined}
                value={discValue}
                disabled={discType === "none"}
                onChange={(e) => setDiscValue(Math.max(0, Number(e.target.value)))}
                aria-label="Discount value"
                className="h-9 w-20 rounded-md border border-border bg-background px-2 text-right text-sm outline-none disabled:opacity-50"
              />
            </div>
            {discType === "percent" && (
              <div className="mt-2 flex gap-1">
                {[5, 10, 15, 20].map((v) => (
                  <button
                    key={v}
                    onClick={() => setDiscValue(v)}
                    className="h-7 flex-1 rounded-md border border-border text-xs transition hover:bg-secondary"
                  >
                    {v}%
                  </button>
                ))}
              </div>
            )}
          </div>

          {discount > 0 && (
            <div className="flex items-center justify-between text-sm text-destructive">
              <span>Discount {discType === "percent" ? `(${discValue}%)` : ""}</span>
              <span>- Rs {discount.toFixed(2)}</span>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-border pt-2 text-lg font-bold">
            <span>Total</span>
            <span>Rs {grandTotal.toFixed(2)}</span>
          </div>
        </div>
        <button
          disabled={lines.length === 0}
          onClick={charge}
          className="mt-4 h-11 w-full rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
        >
          Charge
        </button>
        <div className="mt-2 flex gap-2">
          <input
            value={holdLabel}
            onChange={(e) => setHoldLabel(e.target.value)}
            placeholder="Hold name (e.g. customer name)"
            aria-label="Hold receipt label"
            className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-sm outline-none"
          />
          <button
            disabled={lines.length === 0}
            onClick={hold}
            className="flex h-10 items-center gap-2 rounded-lg border border-border px-4 text-sm font-medium transition hover:bg-secondary disabled:opacity-50"
          >
            <PauseCircle className="size-4" />
            Hold
          </button>
        </div>
        <button
          disabled={lines.length === 0}
          onClick={() => setLines([])}
          className="mt-2 h-10 w-full rounded-lg border border-border text-sm font-medium transition hover:bg-secondary disabled:opacity-50"
        >
          Clear sale
        </button>

        {held.length > 0 && (
          <div className="mt-4 border-t border-border pt-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Held receipts ({held.length})
            </h4>
            <div className="mt-2 space-y-2">
              {held.map((h) => (
                <div
                  key={h.id}
                  className="flex items-center gap-2 rounded-lg border border-border p-2.5 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{h.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(h.at).toLocaleTimeString()} • {h.items.reduce((s, i) => s + i.qty, 0)} item(s) • Rs{" "}
                      {Math.max(
                        0,
                        h.items.reduce((s, i) => s + i.price * i.qty, 0) -
                          saleDiscountAmount(
                            h.items.reduce((s, i) => s + i.price * i.qty, 0),
                            h.discountType,
                            h.discountValue,
                          ),
                      ).toFixed(2)}
                    </div>
                  </div>
                  <button
                    onClick={() => resumeHeld(h.id)}
                    aria-label={`Resume ${h.label}`}
                    className="rounded-md bg-primary p-2 text-primary-foreground transition hover:opacity-90"
                  >
                    <Play className="size-4" />
                  </button>
                  <button
                    onClick={() => void deleteHeldSale(h.id)}
                    aria-label={`Delete ${h.label}`}
                    className="rounded-md border border-border p-2 text-muted-foreground transition hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
