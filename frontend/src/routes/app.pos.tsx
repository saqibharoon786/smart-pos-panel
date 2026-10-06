import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  Camera,
  Minus,
  PauseCircle,
  Percent,
  Play,
  Plus,
  Receipt,
  Search,
  ShoppingBag,
  Trash2,
  X,
} from "lucide-react";
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

type DiscType = "none" | "percent" | "amount";
type Line = {
  id: string;
  name: string;
  listPrice: number;
  qty: number;
  upc: string;
  stock: number;
  discType: DiscType;
  discValue: number;
  cost: number;
};

function rs(n: number) {
  return `Rs ${n.toFixed(2)}`;
}

function netUnit(line: Pick<Line, "listPrice" | "discType" | "discValue">) {
  const off = saleDiscountAmount(line.listPrice, line.discType, line.discValue);
  return Math.max(0, Number((line.listPrice - off).toFixed(2)));
}

function lineGross(line: Pick<Line, "listPrice" | "qty">) {
  return line.listPrice * line.qty;
}

function productPrice(p: Product) {
  const discType = p.discountType === "amount" || p.discountType === "percent" ? p.discountType : "none";
  return netUnit({
    listPrice: Number(p.regPrice) || 0,
    discType,
    discValue: discType === "none" ? 0 : Number(p.discountValue) || 0,
  });
}

function toCheckout(line: Line) {
  return {
    id: line.id,
    name: line.name,
    upc: line.upc,
    price: netUnit(line),
    listPrice: line.listPrice,
    qty: line.qty,
    discountType: line.discType,
    discountValue: line.discValue,
    cost: line.cost,
  };
}

function PosPage() {
  const products = useProducts();
  const [lines, setLines] = useState<Line[]>([]);
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(false);
  const [q, setQ] = useState("");
  const [holdLabel, setHoldLabel] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [discType, setDiscType] = useState<DiscType>("none");
  const [discValue, setDiscValue] = useState(0);
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
      return false;
    }
    const catalogDisc =
      p.discountType === "amount" || p.discountType === "percent" ? p.discountType : "none";
    const line: Line = {
      id: p.id,
      name: p.name,
      listPrice: Number(p.regPrice) || 0,
      qty: 1,
      upc: p.upc,
      stock: Number(p.onHandQty),
      discType: catalogDisc,
      discValue: catalogDisc === "none" ? 0 : Number(p.discountValue) || 0,
      cost: Number(p.avgCost) || 0,
    };
    setLines((ls) => {
      const existing = ls.find((l) => l.id === p.id);
      if (!existing) return [...ls, line];
      return ls.map((l) => (l.id === p.id ? { ...l, qty: l.qty + 1 } : l));
    });
    setSelectedId(p.id);
    setError("");
    return true;
  };

  const handleCode = (raw: string) => {
    const p = findByCode(raw);
    if (!p) {
      setError(`No product found for code "${raw}". Add it in POP first.`);
      toast.error("Product not found");
      return;
    }
    if (addProductToSale(p)) toast.success(`${p.name} added`);
  };

  const clearSale = () => {
    setLines([]);
    setDiscType("none");
    setDiscValue(0);
    setHoldLabel("");
    setSelectedId(null);
    setError("");
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

  const itemCount = lines.reduce((s, l) => s + l.qty, 0);
  const gross = lines.reduce((s, l) => s + lineGross(l), 0);
  const itemDiscount = lines.reduce((s, l) => s + (lineGross(l) - netUnit(l) * l.qty), 0);
  const subtotal = Math.max(0, gross - itemDiscount);
  const discount = saleDiscountAmount(subtotal, discType, discValue);
  const grandTotal = Math.max(0, subtotal - discount);

  const nameQuery = q.trim().toLowerCase();
  const visibleProducts = useMemo(() => {
    const list = nameQuery
      ? products.filter((p) =>
          [p.name, p.itemNo, p.upc, p.alu, p.department].join(" ").toLowerCase().includes(nameQuery),
        )
      : products;
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [products, nameQuery]);

  const pickProduct = (p: Product) => {
    if (!addProductToSale(p)) return;
    toast.success(`${p.name} added`);
    if (nameQuery) setQ("");
    scanRef.current?.focus();
  };

  const searchItem = (e: FormEvent) => {
    e.preventDefault();
    const raw = q.trim();
    if (!raw) return;
    const byCode = findByCode(raw);
    if (byCode) {
      pickProduct(byCode);
      return;
    }
    if (visibleProducts.length === 1) {
      pickProduct(visibleProducts[0]);
      return;
    }
    if (visibleProducts.length === 0) {
      setError(`"${raw}" se koi item nahi mila.`);
      toast.error("Product not found");
    }
  };

  const setLinePrice = (id: string, price: number) =>
    setLines((ls) => ls.map((l) => (l.id === id ? { ...l, listPrice: price < 0 ? 0 : price } : l)));

  const setLineDiscount = (id: string, patch: Partial<Pick<Line, "discType" | "discValue">>) =>
    setLines((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));

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
      const sale = await commitSale(lines.map(toCheckout), { type: discType, value: discValue });
      if (sale) printReceipt(sale);
      toast.success(`Sale complete — ${itemCount} item(s), ${rs(grandTotal)}`);
      clearSale();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sale failed");
    }
  };

  const hold = async () => {
    const saved = await holdSale(
      lines.map(toCheckout),
      { type: discType, value: discValue },
      { label: holdLabel.trim() || "Held receipt" },
    );
    if (!saved) return;
    toast.success(`Receipt held — ${saved.label}`);
    clearSale();
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
      const savedType = item.discountType === "amount" || item.discountType === "percent" ? item.discountType : "none";
      restored.push({
        id: item.id,
        name: product.name,
        upc: product.upc,
        listPrice: Number(item.listPrice ?? item.price) || 0,
        qty,
        stock,
        discType: savedType,
        discValue: savedType === "none" ? 0 : Number(item.discountValue) || 0,
        cost: Number(item.cost ?? product.avgCost) || 0,
      });
    }
    if (restored.length === 0) {
      toast.error("Is held receipt ke items ka stock khatam ho gaya hai");
      return;
    }
    setLines(restored);
    setSelectedId(restored[0]?.id ?? null);
    setDiscType(entry.discountType === "none" ? "none" : entry.discountType);
    setDiscValue(entry.discountValue);
    setHoldLabel(entry.label === "Held receipt" ? "" : entry.label);
    await deleteHeldSale(entry.id);
    toast.success(trimmed ? `${entry.label} resumed — stock ke mutabiq qty adjust ki gai` : `${entry.label} resumed`);
    scanRef.current?.focus();
  };

  return (
    <div className="flex flex-col gap-3 lg:h-[calc(100dvh-7.25rem)] lg:min-h-[36rem]">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold tracking-tight">POS — Checkout</h2>
          <p className="text-sm text-muted-foreground">
            Naam, UPC ya barcode likhein, Add karein, phir Charge se sale complete karein.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-full bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm ring-1 ring-border">
            {itemCount} item{itemCount === 1 ? "" : "s"}
          </span>
          <span className="rounded-full bg-primary px-3 py-1 text-sm font-semibold tabular-nums text-primary-foreground">
            {rs(grandTotal)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,0.96fr)_minmax(340px,1.04fr)]">
        <section className="order-2 flex h-[34rem] min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm lg:order-1 lg:h-auto">
          <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Receipt className="size-4" />
            </span>
            <h3 className="text-sm font-semibold">Current Sale</h3>
            <span className="ml-auto rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              {itemCount}
            </span>
          </div>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
            {lines.map((l) => {
              const unit = netUnit(l);
              const lineTotal = unit * l.qty;
              const selected = l.id === selectedId;
              return (
                <article
                  key={l.id}
                  onClick={() => setSelectedId(l.id)}
                  className={`rounded-xl border p-3 text-sm transition ${
                    selected ? "border-primary/40 bg-accent/50" : "border-border bg-background hover:border-primary/20"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{l.name}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {l.upc || "No UPC"} · {rs(unit)} each
                        {l.listPrice > unit && <span className="ml-1 line-through">{rs(l.listPrice)}</span>}
                      </div>
                    </div>
                    <div className="text-right text-base font-bold tabular-nums">{rs(lineTotal)}</div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setLines((ls) => ls.filter((x) => x.id !== l.id));
                      }}
                      className="rounded-md p-1 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                      aria-label={`Remove ${l.name}`}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <div className="inline-flex items-center overflow-hidden rounded-lg border border-border bg-card">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          step(l.id, -1);
                        }}
                        className="px-2 py-2 text-muted-foreground hover:bg-secondary"
                        aria-label={`Decrease ${l.name}`}
                      >
                        <Minus className="size-3.5" />
                      </button>
                      <input
                        type="number"
                        min={1}
                        value={l.qty}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setLineQty(l.id, Number(e.target.value))}
                        aria-label={`Quantity for ${l.name}`}
                        className="h-8 w-12 border-x border-border bg-transparent text-center text-sm outline-none"
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          step(l.id, 1);
                        }}
                        className="px-2 py-2 text-muted-foreground hover:bg-secondary"
                        aria-label={`Increase ${l.name}`}
                      >
                        <Plus className="size-3.5" />
                      </button>
                    </div>
                    <label className="flex items-center gap-1 text-xs text-muted-foreground">
                      Rs
                      <input
                        type="number"
                        value={l.listPrice}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setLinePrice(l.id, Number(e.target.value))}
                        aria-label={`Price for ${l.name}`}
                        className="h-8 w-20 rounded-lg border border-border bg-card px-2 text-right text-sm text-foreground outline-none"
                      />
                    </label>
                    <select
                      value={l.discType}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setLineDiscount(l.id, { discType: e.target.value as DiscType })}
                      aria-label={`Item discount type for ${l.name}`}
                      className="h-8 min-w-32 flex-1 rounded-lg border border-border bg-card px-2 text-xs outline-none"
                    >
                      <option value="none">No item discount</option>
                      <option value="percent">Item % off</option>
                      <option value="amount">Rs off each</option>
                    </select>
                    <input
                      type="number"
                      min={0}
                      max={l.discType === "percent" ? 100 : undefined}
                      value={l.discValue}
                      disabled={l.discType === "none"}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setLineDiscount(l.id, { discValue: Math.max(0, Number(e.target.value) || 0) })}
                      aria-label={`Item discount for ${l.name}`}
                      className="h-8 w-16 rounded-lg border border-border bg-card px-2 text-right text-xs outline-none disabled:opacity-40"
                    />
                  </div>
                </article>
              );
            })}

            {lines.length === 0 && (
              <div className="flex h-full min-h-48 flex-col items-center justify-center px-6 text-center">
                <span className="flex size-14 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
                  <ShoppingBag className="size-6" />
                </span>
                <p className="mt-3 text-sm font-medium">Abhi koi item nahi</p>
                <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                  Search se item dhoondh kar Add karein. Barcode scan karke Enter bhi kaam karta hai.
                </p>
              </div>
            )}

            {held.length > 0 && (
              <div className="rounded-xl border border-dashed border-border bg-secondary/40 p-3">
                <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Held receipts · {held.length}
                </h4>
                <div className="mt-2 space-y-2">
                  {held.map((h) => {
                    const heldGross = h.items.reduce((s, i) => s + i.price * i.qty, 0);
                    const heldTotal = Math.max(
                      0,
                      heldGross - saleDiscountAmount(heldGross, h.discountType, h.discountValue),
                    );
                    return (
                      <div key={h.id} className="flex items-center gap-2 rounded-lg bg-card px-2.5 py-2 text-sm">
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">{h.label}</div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(h.at).toLocaleTimeString()} · {h.items.reduce((s, i) => s + i.qty, 0)} items ·{" "}
                            {rs(heldTotal)}
                          </div>
                        </div>
                        <button
                          onClick={() => resumeHeld(h.id)}
                          aria-label={`Resume ${h.label}`}
                          className="rounded-lg bg-primary p-2 text-primary-foreground transition hover:opacity-90"
                        >
                          <Play className="size-3.5" />
                        </button>
                        <button
                          onClick={() => void deleteHeldSale(h.id)}
                          aria-label={`Delete ${h.label}`}
                          className="rounded-lg border border-border p-2 text-muted-foreground transition hover:text-destructive"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="shrink-0 space-y-3 border-t border-border bg-secondary/30 px-4 py-3">
            {itemDiscount > 0 && (
              <div className="flex items-center justify-between text-sm text-destructive">
                <span>Item discount</span>
                <span className="tabular-nums">- {rs(itemDiscount)}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium tabular-nums">{rs(subtotal)}</span>
            </div>

            <div>
              <div className="mb-1.5 flex items-center gap-1 text-xs font-medium text-muted-foreground">
                <Percent className="size-3" />
                Bill discount
              </div>
              <div className="flex gap-2">
                <select
                  value={discType}
                  onChange={(e) => setDiscType(e.target.value as DiscType)}
                  aria-label="Discount type"
                  className="h-10 flex-1 rounded-lg border border-border bg-card px-2 text-sm outline-none"
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
                  className="h-10 w-20 rounded-lg border border-border bg-card px-2 text-right text-sm outline-none disabled:opacity-40"
                />
              </div>
              {discType === "percent" && (
                <div className="mt-2 grid grid-cols-4 gap-1.5">
                  {[5, 10, 15, 20].map((v) => (
                    <button
                      key={v}
                      onClick={() => setDiscValue(v)}
                      className={`h-8 rounded-lg border text-xs font-medium transition ${
                        discValue === v
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card hover:bg-secondary"
                      }`}
                    >
                      {v}%
                    </button>
                  ))}
                </div>
              )}
            </div>

            {discount > 0 && (
              <div className="flex items-center justify-between text-sm text-destructive">
                <span>Bill discount {discType === "percent" ? `(${discValue}%)` : ""}</span>
                <span className="tabular-nums">- {rs(discount)}</span>
              </div>
            )}

            <div className="flex items-center justify-between border-t border-border pt-3">
              <span className="text-sm font-medium text-muted-foreground">Total</span>
              <span className="text-2xl font-bold tabular-nums tracking-tight">{rs(grandTotal)}</span>
            </div>

            <button
              disabled={lines.length === 0}
              onClick={charge}
              className="h-12 w-full rounded-xl bg-primary text-base font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 disabled:opacity-45"
            >
              Charge · {rs(grandTotal)}
            </button>
            <div className="flex gap-2">
              <input
                value={holdLabel}
                onChange={(e) => setHoldLabel(e.target.value)}
                placeholder="Hold name"
                aria-label="Hold receipt label"
                className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-card px-3 text-sm outline-none"
              />
              <button
                disabled={lines.length === 0}
                onClick={hold}
                className="flex h-10 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-medium transition hover:bg-secondary disabled:opacity-45"
              >
                <PauseCircle className="size-4" />
                Hold
              </button>
              <button
                disabled={lines.length === 0 && !holdLabel && discType === "none"}
                onClick={clearSale}
                className="h-10 rounded-lg border border-border bg-card px-3 text-sm font-medium transition hover:bg-secondary disabled:opacity-45"
              >
                Clear
              </button>
            </div>
          </div>
        </section>

        <section className="order-1 flex h-[34rem] min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm lg:order-2 lg:h-auto">
          <div className="shrink-0 border-b border-border p-3">
            <form onSubmit={searchItem} className="flex items-center gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-background px-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
                <Search className="size-4 shrink-0 text-primary" />
                <input
                  ref={scanRef}
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                    if (error) setError("");
                  }}
                  placeholder="Item ka naam, UPC ya barcode"
                  autoComplete="off"
                  aria-label="Search product by name or barcode"
                  className="h-11 w-full bg-transparent text-sm outline-none"
                />
                {q && (
                  <button
                    type="button"
                    onClick={() => {
                      setQ("");
                      setError("");
                      scanRef.current?.focus();
                    }}
                    className="rounded-md p-1 text-muted-foreground hover:bg-secondary"
                    aria-label="Clear search"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setScanning(true)}
                className="flex h-11 shrink-0 items-center gap-2 rounded-xl border border-border bg-background px-3.5 text-sm font-medium transition hover:bg-secondary"
              >
                <Camera className="size-4" />
                Scan
              </button>
            </form>
            <p className="mt-2 px-1 text-xs text-muted-foreground">
              Naam likhein, result par Add dabayein. Barcode scan karke Enter bhi item add kar deta hai.
            </p>
            {error && <p className="mt-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          </div>

          <div className="flex shrink-0 items-center justify-between border-b border-border bg-secondary/40 px-4 py-2 text-xs text-muted-foreground">
            <span className="font-medium">{nameQuery ? "Search results" : "Products"}</span>
            <span>{visibleProducts.length}</span>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {visibleProducts.map((p) => {
              const price = productPrice(p);
              const list = Number(p.regPrice) || 0;
              const out = Number(p.onHandQty) <= 0;
              const code = p.upc || p.itemNo || p.alu || "—";
              return (
                <div
                  key={p.id}
                  className={`flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0 ${
                    out ? "opacity-55" : "hover:bg-secondary/50"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{p.name}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                      <span className="truncate">{code}</span>
                      {p.department && <span className="truncate">{p.department}</span>}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-semibold tabular-nums">{rs(price)}</div>
                    {list > price && (
                      <div className="text-[11px] text-muted-foreground line-through tabular-nums">{rs(list)}</div>
                    )}
                    <div className={`text-[11px] ${out ? "text-destructive" : "text-muted-foreground"}`}>
                      {out ? "Out of stock" : `Stock ${p.onHandQty}`}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => pickProduct(p)}
                    disabled={out}
                    className="h-9 shrink-0 rounded-lg bg-primary px-3.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
                  >
                    Add
                  </button>
                </div>
              );
            })}
            {visibleProducts.length === 0 && (
              <div className="flex h-full min-h-48 flex-col items-center justify-center px-6 text-center">
                <span className="flex size-14 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
                  <Search className="size-6" />
                </span>
                <p className="mt-3 text-sm font-medium">
                  {nameQuery ? "Koi matching item nahi" : "Koi product nahi"}
                </p>
                <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                  {nameQuery
                    ? "Naam ya barcode check karein, ya POP se naya item add karein."
                    : "POP module mein products add karein, phir yahan se sale karein."}
                </p>
              </div>
            )}
          </div>
        </section>
      </div>

      <BarcodeScanner open={scanning} onClose={() => setScanning(false)} onScan={(scanned) => handleCode(scanned)} />
    </div>
  );
}
