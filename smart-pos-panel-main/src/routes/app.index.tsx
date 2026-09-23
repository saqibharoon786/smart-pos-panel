import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  Boxes,
  DollarSign,
  Package,
  RotateCcw,
  ShoppingBag,
  TrendingDown,
} from "lucide-react";
import { finalPrice, usePopHistory, useProducts, useSales } from "@/lib/store";

export const Route = createFileRoute("/app/")({
  head: () => ({
    meta: [
      { title: "Store Dashboard | Book POS" },
      { name: "description", content: "Live sales, refunds, stock levels and inventory value for Hamza Books." },
      { property: "og:title", content: "Store Dashboard | Book POS" },
      { property: "og:description", content: "Live sales, refunds, stock levels and inventory value for Hamza Books." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

const money = (n: number) => `Rs ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

function Dashboard() {
  const products = useProducts();
  const sales = useSales();
  const popHistory = usePopHistory();

  const today = dayStart(new Date());
  const todaySales = sales.filter((s) => s.at >= today);

  const sum = (list: typeof sales, pick: (s: typeof sales[number]) => number) =>
    list.reduce((t, s) => t + pick(s), 0);

  const grossToday = sum(todaySales, (s) => s.total);
  const refundToday = sum(todaySales, (s) => s.refunded);
  const netToday = Math.max(0, grossToday - refundToday);
  const discountToday = sum(todaySales, (s) => Number(s.discount || 0));
  const netAll = Math.max(0, sum(sales, (s) => s.total) - sum(sales, (s) => s.refunded));
  const refundAll = sum(sales, (s) => s.refunded);

  const itemsSoldToday = todaySales.reduce(
    (t, s) => t + s.items.reduce((q, i) => q + i.qty - i.returnedQty, 0),
    0,
  );

  const stockUnits = products.reduce((t, p) => t + (Number(p.onHandQty) || 0), 0);
  const retailValue = products.reduce((t, p) => t + finalPrice(p) * (Number(p.onHandQty) || 0), 0);
  const costValue = products.reduce(
    (t, p) => t + (Number(p.avgCost) || 0) * (Number(p.onHandQty) || 0),
    0,
  );

  const lowStock = products
    .filter((p) => (Number(p.onHandQty) || 0) <= Math.max(1, Number(p.reorderPoint) || 0))
    .slice(0, 6);

  const vendorReturns = popHistory.filter((e) => e.action === "Return");
  const vendorReturnValue = vendorReturns.reduce((t, e) => t + e.qty * e.price, 0);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const start = dayStart(d);
    const end = start + 86_400_000;
    const inDay = sales.filter((s) => s.at >= start && s.at < end);
    return {
      label: d.toLocaleDateString(undefined, { weekday: "short" }),
      value: Math.max(0, sum(inDay, (s) => s.total) - sum(inDay, (s) => s.refunded)),
    };
  });
  const peak = Math.max(1, ...days.map((d) => d.value));

  const bestSellers = Object.values(
    sales.flatMap((s) => s.items).reduce<Record<string, { name: string; qty: number; amount: number }>>(
      (acc, i) => {
        const net = i.qty - i.returnedQty;
        if (net <= 0) return acc;
        const row = acc[i.id] ?? { name: i.name, qty: 0, amount: 0 };
        row.qty += net;
        row.amount += net * i.price;
        acc[i.id] = row;
        return acc;
      },
      {},
    ),
  )
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  const cards = [
    { label: "Today's Net Sales", value: money(netToday), sub: `${todaySales.length} receipt(s)`, icon: DollarSign },
    { label: "Items Sold Today", value: String(itemsSoldToday), sub: `Discount ${money(discountToday)}`, icon: ShoppingBag },
    { label: "Refunds Today", value: money(refundToday), sub: `All time ${money(refundAll)}`, icon: RotateCcw },
    { label: "Products", value: String(products.length), sub: `${stockUnits} unit(s) in stock`, icon: Boxes },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-sm text-muted-foreground">
            Live figures — every sale, discount and return updates these totals automatically.
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          <Link to="/app/pos" className="rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground hover:opacity-90">New Sale</Link>
          <Link to="/app/pop" className="rounded-md border border-border bg-card px-4 py-2 font-medium hover:bg-secondary">Add Stock</Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{c.label}</span>
              <c.icon className="size-4 text-primary" />
            </div>
            <div className="mt-2 text-2xl font-bold">{c.value}</div>
            <p className="mt-1 text-xs text-muted-foreground">{c.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Last 7 days (net of returns)</h3>
            <span className="text-xs text-muted-foreground">All time {money(netAll)}</span>
          </div>
          <div className="mt-6 flex h-44 items-end gap-3">
            {days.map((d) => (
              <div key={d.label} className="flex flex-1 flex-col items-center gap-2">
                <span className="text-[10px] text-muted-foreground">{d.value > 0 ? money(d.value) : ""}</span>
                <div
                  className="w-full rounded-t bg-primary/70"
                  style={{ height: `${Math.max(3, (d.value / peak) * 100)}%` }}
                />
                <span className="text-xs text-muted-foreground">{d.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold"><Package className="size-4 text-primary" /> Inventory value</h3>
            <p className="mt-2 text-2xl font-bold">{money(retailValue)}</p>
            <p className="text-xs text-muted-foreground">At cost {money(costValue)}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold"><TrendingDown className="size-4 text-primary" /> Vendor returns</h3>
            <p className="mt-2 text-2xl font-bold">{money(vendorReturnValue)}</p>
            <p className="text-xs text-muted-foreground">{vendorReturns.length} return record(s)</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card lg:col-span-2">
          <h3 className="border-b border-border px-5 py-4 text-sm font-semibold">Recent receipts</h3>
          <div className="divide-y divide-border">
            {sales.slice(0, 6).map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <div>
                  <p className="font-medium">{s.receiptNo}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(s.at).toLocaleString()} • {s.items.length} line(s)
                    {Number(s.discount || 0) > 0 ? ` • discount ${money(Number(s.discount))}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{money(Math.max(0, s.total - s.refunded))}</p>
                  {s.refunded > 0 && <p className="text-xs text-destructive">refunded {money(s.refunded)}</p>}
                </div>
              </div>
            ))}
            {sales.length === 0 && <p className="px-5 py-10 text-center text-sm text-muted-foreground">No sales yet.</p>}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card">
          <h3 className="border-b border-border px-5 py-4 text-sm font-semibold">Best sellers</h3>
          <div className="divide-y divide-border">
            {bestSellers.map((b) => (
              <div key={b.name} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <span className="truncate">{b.name}</span>
                <span className="shrink-0 font-semibold">{b.qty}</span>
              </div>
            ))}
            {bestSellers.length === 0 && <p className="px-5 py-10 text-center text-sm text-muted-foreground">No items sold yet.</p>}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <h3 className="flex items-center gap-2 border-b border-border px-5 py-4 text-sm font-semibold">
          <AlertTriangle className="size-4 text-destructive" /> Low stock
        </h3>
        <div className="divide-y divide-border">
          {lowStock.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
              <div>
                <p className="font-medium">{p.name}</p>
                <p className="text-xs text-muted-foreground">{p.department || "—"} • {p.vendor || "No vendor"}</p>
              </div>
              <span className="font-semibold text-destructive">{p.onHandQty} left</span>
            </div>
          ))}
          {lowStock.length === 0 && <p className="px-5 py-10 text-center text-sm text-muted-foreground">All items are above their reorder point.</p>}
        </div>
      </div>
    </div>
  );
}
