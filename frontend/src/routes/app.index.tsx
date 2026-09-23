import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Boxes,
  CalendarDays,
  DollarSign,
  Package,
  RotateCcw,
  ShoppingBag,
  TrendingDown,
} from "lucide-react";
import type { DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

type Preset = "today" | "week" | "month" | "year" | "custom";

const money = (n: number) => `Rs ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const dayEnd = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime();

function startOfWeek(d: Date) {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = date.getDay();
  const diff = day === 0 ? 6 : day - 1;
  date.setDate(date.getDate() - diff);
  return date;
}

function fmtDay(ts: number) {
  return new Date(ts).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function periodRange(preset: Preset, custom?: DateRange): { from: number; to: number } {
  const now = new Date();
  if (preset === "custom" && custom?.from) {
    const from = dayStart(custom.from);
    const to = dayEnd(custom.to ?? custom.from);
    return { from, to };
  }
  if (preset === "week") {
    const start = startOfWeek(now);
    return { from: dayStart(start), to: dayEnd(now) };
  }
  if (preset === "month") {
    return { from: dayStart(new Date(now.getFullYear(), now.getMonth(), 1)), to: dayEnd(now) };
  }
  if (preset === "year") {
    return { from: dayStart(new Date(now.getFullYear(), 0, 1)), to: dayEnd(now) };
  }
  return { from: dayStart(now), to: dayEnd(now) };
}

function chartBuckets(sales: { at: number; total: number; refunded: number }[], from: number, to: number) {
  const span = Math.max(1, to - from);
  const dayMs = 86_400_000;
  const sumNet = (list: typeof sales) =>
    list.reduce((t, s) => t + Math.max(0, s.total - s.refunded), 0);

  if (span <= dayMs) {
    return Array.from({ length: 12 }, (_, i) => {
      const start = from + i * 2 * 60 * 60 * 1000;
      const end = start + 2 * 60 * 60 * 1000;
      const hour = new Date(start).getHours();
      return {
        label: `${String(hour).padStart(2, "0")}:00`,
        value: sumNet(sales.filter((s) => s.at >= start && s.at < end)),
      };
    });
  }

  if (span <= 40 * dayMs) {
    const days = Math.min(40, Math.ceil(span / dayMs));
    return Array.from({ length: days }, (_, i) => {
      const d = new Date(from);
      d.setDate(d.getDate() + i);
      const start = dayStart(d);
      const end = dayEnd(d);
      return {
        label: d.toLocaleDateString(undefined, { day: "numeric", month: days > 14 ? undefined : "short" }),
        value: sumNet(sales.filter((s) => s.at >= start && s.at <= end)),
      };
    });
  }

  const start = new Date(from);
  const end = new Date(to);
  const months: { label: string; value: number }[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cursor <= end) {
    const mStart = dayStart(new Date(cursor.getFullYear(), cursor.getMonth(), 1));
    const mEnd = dayEnd(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0));
    months.push({
      label: cursor.toLocaleDateString(undefined, { month: "short" }),
      value: sumNet(sales.filter((s) => s.at >= mStart && s.at <= mEnd)),
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return months;
}

const presets: { id: Preset; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "week", label: "Weekly" },
  { id: "month", label: "Monthly" },
  { id: "year", label: "Yearly" },
];

function Dashboard() {
  const products = useProducts();
  const sales = useSales();
  const popHistory = usePopHistory();
  const [preset, setPreset] = useState<Preset>("today");
  const [custom, setCustom] = useState<DateRange | undefined>();
  const [calOpen, setCalOpen] = useState(false);

  const { from, to } = periodRange(preset, custom);
  const inPeriod = <T extends { at: number }>(list: T[]) => list.filter((row) => row.at >= from && row.at <= to);

  const periodSales = useMemo(() => inPeriod(sales), [sales, from, to]);
  const vendorReturns = useMemo(
    () => inPeriod(popHistory).filter((e) => e.action === "Return"),
    [popHistory, from, to],
  );

  const sum = (list: typeof sales, pick: (s: (typeof sales)[number]) => number) =>
    list.reduce((t, s) => t + pick(s), 0);

  const gross = sum(periodSales, (s) => s.total);
  const refund = sum(periodSales, (s) => s.refunded);
  const net = Math.max(0, gross - refund);
  const discount = sum(periodSales, (s) => Number(s.discount || 0));
  const itemsSold = periodSales.reduce(
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
  const vendorReturnValue = vendorReturns.reduce((t, e) => t + e.qty * e.price, 0);

  const days = chartBuckets(periodSales, from, to);
  const peak = Math.max(1, ...days.map((d) => d.value));

  const bestSellers = Object.values(
    periodSales
      .flatMap((s) => s.items)
      .reduce<Record<string, { name: string; qty: number; amount: number }>>((acc, i) => {
        const netQty = i.qty - i.returnedQty;
        if (netQty <= 0) return acc;
        const row = acc[i.id] ?? { name: i.name, qty: 0, amount: 0 };
        row.qty += netQty;
        row.amount += netQty * i.price;
        acc[i.id] = row;
        return acc;
      }, {}),
  )
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  const rangeLabel = from === dayStart(new Date()) && preset === "today" ? fmtDay(from) : `${fmtDay(from)} – ${fmtDay(to)}`;

  const cards = [
    { label: "Net Sales", value: money(net), sub: `${periodSales.length} receipt(s)`, icon: DollarSign },
    { label: "Items Sold", value: String(itemsSold), sub: `Discount ${money(discount)}`, icon: ShoppingBag },
    { label: "Refunds", value: money(refund), sub: `${periodSales.filter((s) => s.refunded > 0).length} refunded receipt(s)`, icon: RotateCcw },
    { label: "Products", value: String(products.length), sub: `${stockUnits} unit(s) in stock`, icon: Boxes },
  ];

  const chipClass = (active: boolean) =>
    `h-9 rounded-lg px-3 text-sm font-medium transition ${
      active ? "bg-primary text-primary-foreground" : "border border-border bg-card hover:bg-secondary"
    }`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-sm text-muted-foreground">
            Showing {rangeLabel}. Inventory value stays live; sales follow the selected dates.
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          <Link to="/app/pos" className="rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground hover:opacity-90">New Sale</Link>
          <Link to="/app/pop" className="rounded-md border border-border bg-card px-4 py-2 font-medium hover:bg-secondary">Add Stock</Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {presets.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => {
              setPreset(p.id);
              setCalOpen(false);
            }}
            className={chipClass(preset === p.id)}
          >
            {p.label}
          </button>
        ))}
        <Popover open={calOpen} onOpenChange={setCalOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={`${chipClass(preset === "custom")} inline-flex items-center gap-2`}
              onClick={() => setPreset("custom")}
            >
              <CalendarDays className="size-4" />
              {preset === "custom" && custom?.from ? rangeLabel : "Calendar"}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-3" align="start">
            <p className="mb-2 text-xs text-muted-foreground">Pick a from / to date, then figures update.</p>
            <Calendar
              mode="range"
              selected={custom}
              onSelect={(range) => {
                setCustom(range);
                setPreset("custom");
              }}
              numberOfMonths={1}
              captionLayout="dropdown"
              disabled={{ after: new Date() }}
              defaultMonth={custom?.from ?? new Date()}
            />
          </PopoverContent>
        </Popover>
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
            <h3 className="text-sm font-semibold">Sales in this period (net of returns)</h3>
            <span className="text-xs text-muted-foreground">{money(net)}</span>
          </div>
          <div className="mt-6 flex h-44 items-end gap-1.5 overflow-x-auto">
            {days.map((d, i) => (
              <div key={`${d.label}-${i}`} className="flex min-w-6 flex-1 flex-col items-center gap-2">
                <span className="text-[10px] text-muted-foreground">{d.value > 0 ? money(d.value) : ""}</span>
                <div
                  className="w-full rounded-t bg-primary/70"
                  style={{ height: `${Math.max(3, (d.value / peak) * 100)}%` }}
                />
                <span className="text-[10px] text-muted-foreground">{d.label}</span>
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
            <p className="text-xs text-muted-foreground">{vendorReturns.length} return record(s) in this period</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card lg:col-span-2">
          <h3 className="border-b border-border px-5 py-4 text-sm font-semibold">Receipts in this period</h3>
          <div className="divide-y divide-border">
            {periodSales.slice(0, 8).map((s) => (
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
            {periodSales.length === 0 && <p className="px-5 py-10 text-center text-sm text-muted-foreground">Is date range mein koi sale nahi.</p>}
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
            {bestSellers.length === 0 && <p className="px-5 py-10 text-center text-sm text-muted-foreground">Is period mein koi item nahi bika.</p>}
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
