import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Camera, Minus, PauseCircle, Percent, Play, Plus, Search, Trash2, X } from "lucide-react";
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [holdLabel, setHoldLabel] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [discType, setDiscType] = useState<DiscType>("none");
  const [discValue, setDiscValue] = useState(0);
  const held = useHeldSales();
  const scanRef = useRef<HTMLInputElement>(null);
  const searchBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scanRef.current?.focus();
  }, []);

  useEffect(() => {
    const onPointer = (event: MouseEvent) => {
      if (!searchBoxRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
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
  const suggestions = useMemo(() => {
    if (!nameQuery) return [];
    return products
      .filter((p) => [p.name, p.itemNo, p.upc, p.alu, p.department].join(" ").toLowerCase().includes(nameQuery))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 8);
  }, [products, nameQuery]);

  const pickProduct = (p: Product) => {
    if (!addProductToSale(p)) return;
    toast.success(`${p.name} added`);
    setQ("");
    setMenuOpen(false);
    setActiveIndex(0);
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
    if (suggestions.length > 0) {
      pickProduct(suggestions[Math.min(activeIndex, suggestions.length - 1)]);
      return;
    }
    setError(`"${raw}" se koi item nahi mila.`);
    toast.error("Product not found");
    setMenuOpen(true);
  };

  const onSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      if (!suggestions.length) return;
      e.preventDefault();
      setMenuOpen(true);
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      if (!suggestions.length) return;
      e.preventDefault();
      setMenuOpen(true);
      setActiveIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Escape") {
      setMenuOpen(false);
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

  const highlighted = suggestions.length ? Math.min(activeIndex, suggestions.length - 1) : 0;
  const showMenu = menuOpen && nameQuery.length > 0;

  return (
    <div className="-m-6 flex h-[calc(100dvh-4rem)] flex-col overflow-y-auto bg-background">
      <div
        className={`mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 ${
          lines.length === 0 && held.length === 0 ? "justify-center pb-24" : "pt-8"
        }`}
      >
        <form onSubmit={searchItem} className="relative shrink-0">
          <div className="flex items-center gap-2">
            <div
              ref={searchBoxRef}
              className="relative flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-border bg-card px-4 shadow-sm focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20"
            >
              <Search className="size-5 shrink-0 text-muted-foreground" />
              <input
                ref={scanRef}
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setActiveIndex(0);
                  setMenuOpen(e.target.value.trim().length > 0);
                  if (error) setError("");
                }}
                onKeyDown={onSearchKeyDown}
                onFocus={() => {
                  if (q.trim()) setMenuOpen(true);
                }}
                placeholder="Barcode ya item ka naam"
                autoComplete="off"
                aria-label="Search product by name or barcode"
                aria-expanded={showMenu}
                aria-controls="pos-search-menu"
                aria-activedescendant={showMenu && suggestions[highlighted] ? `pos-opt-${suggestions[highlighted].id}` : undefined}
                role="combobox"
                className="h-14 w-full bg-transparent text-base outline-none"
              />
              {q && (
                <button
                  type="button"
                  onClick={() => {
                    setQ("");
                    setMenuOpen(false);
                    setError("");
                    scanRef.current?.focus();
                  }}
                  className="rounded-md p-1 text-muted-foreground hover:bg-secondary"
                  aria-label="Clear search"
                >
                  <X className="size-4" />
                </button>
              )}
              {showMenu && (
                <ul
                  id="pos-search-menu"
                  role="listbox"
                  className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-30 max-h-80 overflow-y-auto rounded-2xl border border-border bg-card py-1 shadow-lg"
                >
                  {suggestions.length === 0 && (
                    <li className="px-4 py-3 text-sm text-muted-foreground">Koi item nahi mila</li>
                  )}
                  {suggestions.map((p, index) => {
                    const price = productPrice(p);
                    const out = Number(p.onHandQty) <= 0;
                    const code = p.upc || p.itemNo || p.alu || "—";
                    const active = index === highlighted;
                    return (
                      <li key={p.id} role="presentation">
                        <button
                          id={`pos-opt-${p.id}`}
                          type="button"
                          role="option"
                          aria-selected={active}
                          onMouseEnter={() => setActiveIndex(index)}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => pickProduct(p)}
                          className={`flex w-full items-center gap-3 px-4 py-3 text-left ${
                            active ? "bg-accent" : "hover:bg-secondary/70"
                          } ${out ? "opacity-60" : ""}`}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{p.name}</span>
                            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                              {code}
                              {p.department ? ` · ${p.department}` : ""}
                              {out ? " · Out of stock" : ` · Stock ${p.onHandQty}`}
                            </span>
                          </span>
                          <span className="shrink-0 text-sm font-semibold tabular-nums">{rs(price)}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <button
              type="button"
              onClick={() => setScanning(true)}
              className="flex h-14 shrink-0 items-center gap-2 rounded-2xl border border-border bg-card px-4 text-sm font-medium shadow-sm transition hover:bg-secondary"
            >
              <Camera className="size-4" />
              Scan
            </button>
          </div>
          {error && <p className="mt-3 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        </form>

        {(lines.length > 0 || held.length > 0) && (
        <section className="mt-6 flex flex-col">
          <div className="space-y-2">
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
                    <div
                      className="flex h-8 min-w-40 flex-1 items-center overflow-hidden rounded-lg border border-border bg-card"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="number"
                        min={0}
                        max={l.discType === "percent" ? 100 : undefined}
                        value={l.discValue}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (raw === "") {
                            setLineDiscount(l.id, { discType: "none", discValue: 0 });
                            return;
                          }
                          let value = Math.max(0, Number(raw) || 0);
                          const type: DiscType = l.discType === "percent" ? "percent" : "amount";
                          if (type === "percent") value = Math.min(100, value);
                          setLineDiscount(l.id, { discType: value === 0 ? "none" : type, discValue: value });
                        }}
                        aria-label={`Item discount for ${l.name}`}
                        placeholder="Discount"
                        className="h-full min-w-0 flex-1 bg-transparent px-2 text-right text-xs outline-none"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLineDiscount(l.id, {
                            discType: l.discValue > 0 ? "amount" : "none",
                            discValue: l.discValue,
                          });
                        }}
                        aria-label={`Rupee discount for ${l.name}`}
                        className={`h-full border-l border-border px-2 text-[11px] font-semibold ${
                          l.discType !== "percent" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"
                        }`}
                      >
                        Rs
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const value = Math.min(100, l.discValue);
                          setLineDiscount(l.id, {
                            discType: value > 0 ? "percent" : "percent",
                            discValue: value,
                          });
                        }}
                        aria-label={`Percent discount for ${l.name}`}
                        className={`h-full border-l border-border px-2 text-[11px] font-semibold ${
                          l.discType === "percent" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"
                        }`}
                      >
                        %
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}

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

          {lines.length > 0 && (
          <div className="mt-6 shrink-0 space-y-3 rounded-2xl border border-border bg-card px-4 py-4">
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
          )}
        </section>
        )}
      </div>


      <BarcodeScanner open={scanning} onClose={() => setScanning(false)} onScan={(scanned) => handleCode(scanned)} />
    </div>
  );
}
