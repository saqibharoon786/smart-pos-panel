import { useSyncExternalStore } from "react";

export type Product = {
  id: string;
  name: string;
  type: string;
  department: string;
  description: string;
  size: string;
  attribute: string;
  regPrice: number;
  avgCost: number;
  onHandQty: number;
  tax: string;
  upc: string;
  quickPickGroup: string;
  vendor: string;
  orderCost: number;
  reorderPoint: string;
  itemNo: string;
  alu: string;
  unitOfMeasure: string;
  manufacturer: string;
  syncToMobile: boolean;
  comments: string;
  discountType: "none" | "amount" | "percent";
  discountValue: number;
};

/** Selling price after discount (amount off, or percent off). */
export function finalPrice(p: Pick<Product, "regPrice" | "discountType" | "discountValue">) {
  const base = Number(p.regPrice) || 0;
  const v = Number(p.discountValue) || 0;
  if (p.discountType === "amount") return Math.max(0, base - v);
  if (p.discountType === "percent") return Math.max(0, base - (base * Math.min(v, 100)) / 100);
  return base;
}

export type PopEntry = {
  id: string;
  at: number;
  action: "Added" | "Deleted" | "Return" | "Stock In" | "Edited";
  productId: string;
  name: string;
  upc: string;
  department: string;
  vendor: string;
  qty: number;
  price: number;
  note: string;
};

export type SaleItem = {
  id: string;
  name: string;
  upc: string;
  price: number;
  qty: number;
  returnedQty: number;
};

export type Sale = {
  id: string;
  at: number;
  receiptNo: string;
  items: SaleItem[];
  subtotal?: number;
  discountType?: "none" | "amount" | "percent";
  discountValue?: number;
  discount?: number;
  total: number;
  refunded: number;
};

/** A sale parked for later ("held receipt"). Stock is untouched until it is charged. */
export type HeldSale = {
  id: string;
  at: number;
  label: string;
  note: string;
  discountType: "none" | "amount" | "percent";
  discountValue: number;
  items: { id: string; name: string; upc: string; price: number; qty: number }[];
};


export type PosReturnEntry = {
  id: string;
  at: number;
  saleId: string;
  receiptNo: string;
  productId: string;
  name: string;
  upc: string;
  qty: number;
  amount: number;
  reason: string;
};

const KEY = "bookpos.products";
const POP_KEY = "bookpos.pophistory";
const SALES_KEY = "bookpos.sales";
const POSRET_KEY = "bookpos.posreturns";
const HELD_KEY = "bookpos.heldsales";
const AUTH_KEY = "bookpos.auth";
const DEPT_KEY = "bookpos.departments";


const seed: Product[] = [
  {
    id: "p-1",
    name: "PTB GENERAL SCIENCE 9/10",
    type: "Inventory",
    department: "BOOKS",
    description: "Punjab textbook general science",
    size: "",
    attribute: "",
    regPrice: 450,
    avgCost: 320,
    onHandQty: 24,
    tax: "Standard",
    upc: "6980682907184",
    quickPickGroup: "Textbooks",
    vendor: "AL-BILAL",
    orderCost: 320,
    reorderPoint: "5",
    itemNo: "2601",
    alu: "PTBGS910",
    unitOfMeasure: "Each",
    manufacturer: "PTB",
    syncToMobile: true,
    comments: "",
    discountType: "none",
    discountValue: 0,
  },
  {
    id: "p-3",
    name: "ARTICLE 1100",
    type: "Inventory",
    department: "STATIONERY",
    description: "Article No 1100 (scanned barcode item)",
    size: "",
    attribute: "",
    regPrice: 250,
    avgCost: 180,
    onHandQty: 10,
    tax: "Standard",
    upc: "8964001269106",
    quickPickGroup: "Accessories",
    vendor: "AFAQ",
    orderCost: 180,
    reorderPoint: "2",
    itemNo: "1100",
    alu: "ART1100",
    unitOfMeasure: "Each",
    manufacturer: "",
    syncToMobile: true,
    comments: "",
    discountType: "none",
    discountValue: 0,
  },
  {
    id: "p-2",
    name: "RACKET GRIPS W/Y",
    type: "Inventory",
    department: "SPORTS",
    description: "Racket grip white/yellow",
    size: "M",
    attribute: "White",
    regPrice: 80,
    avgCost: 55,
    onHandQty: 5,
    tax: "Standard",
    upc: "9200525",
    quickPickGroup: "Accessories",
    vendor: "ASIAN",
    orderCost: 55,
    reorderPoint: "3",
    itemNo: "2602",
    alu: "RGWY",
    unitOfMeasure: "Each",
    manufacturer: "Asian Sports",
    syncToMobile: false,
    comments: "",
    discountType: "none",
    discountValue: 0,
  },
];

export const DEPARTMENTS = [
  "BOOKS",
  "BAGS",
  "BOTTLE",
  "CALCULATOR",
  "CAMBRIDGE",
  "SPORTS",
  "STATIONERY",
  "TOYS",
];

export const VENDORS = ["AFAQ", "AINA", "AL-BILAL", "ASAN", "ASIAN", "AZEEM"];

let products: Product[] = [];
let popHistory: PopEntry[] = [];
let sales: Sale[] = [];
let posReturns: PosReturnEntry[] = [];
let heldSales: HeldSale[] = [];
let customDepartments: string[] = [];
let loaded = false;
const listeners = new Set<() => void>();

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  products = read<Product[]>(KEY, seed).map((p) => ({
    ...p,
    discountType: p.discountType ?? "none",
    discountValue: Number(p.discountValue ?? 0),
  }));
  const storedHistory = read<PopEntry[]>(POP_KEY, []);
  popHistory = storedHistory.length > 0
    ? storedHistory
    : products.map((product, index) => ({
        id: `initial-${product.id}`,
        at: Date.now() - (products.length - index) * 1000,
        action: "Added" as const,
        productId: product.id,
        name: product.name,
        upc: product.upc,
        department: product.department,
        vendor: product.vendor,
        qty: Number(product.onHandQty) || 0,
        price: Number(product.orderCost || product.avgCost || 0),
        note: "Opening inventory record",
      }));
  sales = read<Sale[]>(SALES_KEY, []).map((sale) => ({
    ...sale,
    items: sale.items.map((item) => {
      const product = products.find((candidate) => candidate.id === item.id);
      return {
        ...item,
        name: item.name || product?.name || "Unknown product",
        upc: item.upc || product?.upc || "",
        price: Number(item.price ?? product?.regPrice ?? 0),
        returnedQty: Number(item.returnedQty ?? 0),
      };
    }),
  }));
  posReturns = read<PosReturnEntry[]>(POSRET_KEY, []);
  heldSales = read<HeldSale[]>(HELD_KEY, []);
  customDepartments = read<string[]>(DEPT_KEY, []);
}

function persist() {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(products));
    window.localStorage.setItem(POP_KEY, JSON.stringify(popHistory));
    window.localStorage.setItem(SALES_KEY, JSON.stringify(sales));
    window.localStorage.setItem(POSRET_KEY, JSON.stringify(posReturns));
    window.localStorage.setItem(HELD_KEY, JSON.stringify(heldSales));
    window.localStorage.setItem(DEPT_KEY, JSON.stringify(customDepartments));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  load();
  listeners.add(cb);
  return () => listeners.delete(cb);
}

const empty: Product[] = [];
const emptyPop: PopEntry[] = [];
const emptySales: Sale[] = [];
const emptyRet: PosReturnEntry[] = [];
const emptyHeld: HeldSale[] = [];

function useStore<T>(get: () => T, server: T) {
  return useSyncExternalStore(
    subscribe,
    () => {
      load();
      return get();
    },
    () => server,
  );
}

export function useProducts() {
  return useStore(() => products, empty);
}

export function usePopHistory() {
  return useStore(() => popHistory, emptyPop);
}

export function useSales() {
  return useStore(() => sales, emptySales);
}

export function usePosReturns() {
  return useStore(() => posReturns, emptyRet);
}

export function useHeldSales() {
  return useStore(() => heldSales, emptyHeld);
}

const emptyDepts: string[] = [];

/** Cached combined list so the snapshot stays referentially stable. */
let allDepartmentsCache: string[] = [...DEPARTMENTS];
let allDepartmentsSrc: string[] | null = null;

function allDepartments() {
  if (allDepartmentsSrc !== customDepartments) {
    allDepartmentsSrc = customDepartments;
    allDepartmentsCache = [...DEPARTMENTS, ...customDepartments];
  }
  return allDepartmentsCache;
}

/** All departments: built-in list plus any added manually in POP. */
export function useDepartments() {
  return useStore(allDepartments, emptyDepts);
}

/** Add a custom department (stored in the browser, survives reload). */
export function addDepartment(name: string) {
  const clean = name.trim().toUpperCase();
  if (!clean) return "";
  if (DEPARTMENTS.includes(clean) || customDepartments.includes(clean)) return clean;
  customDepartments = [...customDepartments, clean].sort();
  persist();
  return clean;
}


/** Park the current sale so the counter is free for the next customer. */
export function holdSale(
  items: { id: string; name: string; upc: string; price: number; qty: number }[],
  discount: { type: "none" | "amount" | "percent"; value: number },
  info: { label?: string; note?: string } = {},
) {
  load();
  if (items.length === 0) return null;
  const held: HeldSale = {
    id: `h-${Date.now()}`,
    at: Date.now(),
    label: (info.label || "").trim() || `Hold #${heldSales.length + 1}`,
    note: (info.note || "").trim(),
    discountType: discount.type,
    discountValue: Number(discount.value) || 0,
    items: items.map((i) => ({ ...i })),
  };
  heldSales = [held, ...heldSales];
  persist();
  return held;
}

/** Remove a held receipt (after resuming it, or when the customer walks away). */
export function deleteHeldSale(id: string) {
  load();
  heldSales = heldSales.filter((h) => h.id !== id);
  persist();
}

function logPop(e: Omit<PopEntry, "id" | "at">) {
  popHistory = [{ ...e, id: `h-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, at: Date.now() }, ...popHistory];
}

export function addProduct(p: Omit<Product, "id">) {
  load();
  const item: Product = { ...p, id: `p-${Date.now()}` };
  products = [item, ...products];
  logPop({
    action: "Added",
    productId: item.id,
    name: item.name,
    upc: item.upc,
    department: item.department,
    vendor: item.vendor,
    qty: Number(item.onHandQty) || 0,
    price: Number(item.regPrice) || 0,
    note: "New inventory item created",
  });
  persist();
}

export function deleteProduct(id: string) {
  load();
  const p = products.find((x) => x.id === id);
  products = products.filter((x) => x.id !== id);
  if (p) {
    logPop({
      action: "Deleted",
      productId: p.id,
      name: p.name,
      upc: p.upc,
      department: p.department,
      vendor: p.vendor,
      qty: Number(p.onHandQty) || 0,
      price: Number(p.regPrice) || 0,
      note: "Item removed from inventory",
    });
  }
  persist();
}

/** Edit an existing product. */
export function updateProduct(id: string, patch: Omit<Product, "id">) {
  load();
  const prev = products.find((x) => x.id === id);
  if (!prev) return false;
  const next: Product = { ...patch, id };
  products = products.map((x) => (x.id === id ? next : x));
  logPop({
    action: "Edited",
    productId: id,
    name: next.name,
    upc: next.upc,
    department: next.department,
    vendor: next.vendor,
    qty: Number(next.onHandQty) || 0,
    price: Number(next.regPrice) || 0,
    note: "Item details updated",
  });
  persist();
  return true;
}

/** Stock In: refill stock, optionally at a different cost and selling price. */
export function stockIn(
  productId: string,
  qty: number,
  orderCost: number,
  regPrice: number | null,
  note: string,
) {
  load();
  const p = products.find((x) => x.id === productId);
  if (!p || qty <= 0) return false;
  const oldQty = Number(p.onHandQty) || 0;
  const newQty = oldQty + qty;
  const cost = Number(orderCost) || 0;
  // weighted average unit cost across old and new stock
  const avgCost =
    newQty > 0 ? (oldQty * (Number(p.avgCost) || 0) + qty * cost) / newQty : cost;
  products = products.map((x) =>
    x.id === productId
      ? {
          ...x,
          onHandQty: newQty,
          orderCost: cost,
          avgCost: Number(avgCost.toFixed(2)),
          regPrice: regPrice !== null && regPrice > 0 ? regPrice : x.regPrice,
        }
      : x,
  );
  logPop({
    action: "Stock In",
    productId: p.id,
    name: p.name,
    upc: p.upc,
    department: p.department,
    vendor: p.vendor,
    qty,
    price: cost,
    note: note || `Refilled ${qty} unit(s) at Rs ${cost.toFixed(2)} cost`,
  });
  persist();
  return true;
}

/** POP return: send stock back to the vendor — on-hand qty goes down. */
export function popReturn(productId: string, qty: number, reason: string) {
  load();
  const p = products.find((x) => x.id === productId);
  if (!p || qty <= 0) return false;
  if (qty > Number(p.onHandQty)) return false;
  products = products.map((x) =>
    x.id === productId ? { ...x, onHandQty: Number(x.onHandQty) - qty } : x,
  );
  logPop({
    action: "Return",
    productId: p.id,
    name: p.name,
    upc: p.upc,
    department: p.department,
    vendor: p.vendor,
    qty,
    price: Number(p.orderCost || p.avgCost || 0),
    note: reason || "Returned to vendor",
  });
  persist();
  return true;
}

/** Find a product by scanned/typed code: UPC, ALU or Item No. */
export function findByCode(code: string): Product | undefined {
  load();
  const c = code.trim().toLowerCase();
  if (!c) return undefined;
  return products.find(
    (p) =>
      p.upc.trim().toLowerCase() === c ||
      p.alu.trim().toLowerCase() === c ||
      p.itemNo.trim().toLowerCase() === c,
  );
}

export function upcExists(upc: string, exceptId?: string) {
  load();
  const c = upc.trim().toLowerCase();
  if (!c) return false;
  return products.some((p) => p.id !== exceptId && p.upc.trim().toLowerCase() === c);
}

/** Sale-level discount amount from a type + value pair. */
export function saleDiscountAmount(
  subtotal: number,
  type: "none" | "amount" | "percent" | undefined,
  value: number | undefined,
) {
  const v = Number(value) || 0;
  if (type === "amount") return Math.min(Math.max(v, 0), subtotal);
  if (type === "percent") return (subtotal * Math.min(Math.max(v, 0), 100)) / 100;
  return 0;
}

/** Share of each line price the customer actually paid (after sale discount). */
export function saleRefundRatio(sale: Pick<Sale, "items" | "subtotal" | "discount">) {
  const gross = sale.items.reduce((s, i) => s + i.price * i.qty, 0);
  const net = Number(sale.subtotal ?? gross) - Number(sale.discount ?? 0);
  return gross > 0 ? Math.max(0, net) / gross : 1;
}

/** Money actually kept from a sale after discount and refunds. */
export function saleNet(sale: Pick<Sale, "total" | "refunded">) {
  return Math.max(0, Number(sale.total || 0) - Number(sale.refunded || 0));
}

/** Reduce on-hand quantities after a completed sale and record the receipt. */
export function commitSale(
  items: { id: string; name: string; upc: string; price: number; qty: number }[],
  discount?: { type: "none" | "amount" | "percent"; value: number },
) {
  load();
  products = products.map((p) => {
    const hit = items.find((i) => i.id === p.id);
    return hit ? { ...p, onHandQty: Number(p.onHandQty) - hit.qty } : p;
  });
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const discAmount = saleDiscountAmount(subtotal, discount?.type, discount?.value);
  const sale: Sale = {
    id: `s-${Date.now()}`,
    at: Date.now(),
    receiptNo: `R-${1000 + sales.length + 1}`,
    items: items.map((i) => ({ ...i, returnedQty: 0 })),
    subtotal,
    discountType: discount?.type ?? "none",
    discountValue: Number(discount?.value) || 0,
    discount: discAmount,
    total: Math.max(0, subtotal - discAmount),
    refunded: 0,
  };
  sales = [sale, ...sales];
  persist();
  return sale;
}


/** POS return: customer brings items back — stock goes up, sale is refunded. */
export function posReturn(
  saleId: string,
  lines: { id: string; qty: number }[],
  reason: string,
) {
  load();
  const sale = sales.find((s) => s.id === saleId);
  if (!sale) return 0;
  let refund = 0;
  const stamped: PosReturnEntry[] = [];
  // refund what the customer actually paid: apply the sale discount share
  const gross = sale.items.reduce((s, i) => s + i.price * i.qty, 0);
  const net = Number(sale.subtotal ?? gross) - Number(sale.discount ?? 0);
  const ratio = gross > 0 ? Math.max(0, net) / gross : 1;

  const updatedItems = sale.items.map((it) => {
    const hit = lines.find((l) => l.id === it.id);
    const qty = hit ? Math.min(hit.qty, it.qty - it.returnedQty) : 0;
    if (qty > 0) {
      const amount = Number((qty * it.price * ratio).toFixed(2));
      refund += amount;
      stamped.push({
        id: `pr-${Date.now()}-${it.id}`,
        at: Date.now(),
        saleId: sale.id,
        receiptNo: sale.receiptNo,
        productId: it.id,
        name: it.name,
        upc: it.upc,
        qty,
        amount,
        reason: reason || "Customer return",
      });
      products = products.map((p) =>
        p.id === it.id ? { ...p, onHandQty: Number(p.onHandQty) + qty } : p,
      );
      return { ...it, returnedQty: it.returnedQty + qty };
    }
    return it;
  });

  if (refund === 0) return 0;

  sales = sales.map((s) =>
    s.id === sale.id ? { ...s, items: updatedItems, refunded: s.refunded + refund } : s,
  );
  posReturns = [...stamped, ...posReturns];
  persist();
  return refund;
}

export function nextItemNo() {
  load();
  return String(2600 + products.length + 1);
}

/**
 * Edit a completed sale: fix item prices/quantities after a mistake.
 * Stock is adjusted by the qty difference (sell more -> stock down, sell less -> stock back).
 * Cannot reduce qty below what has already been returned.
 */
export function updateSale(
  saleId: string,
  lines: { id: string; price: number; qty: number }[],
) {
  load();
  const sale = sales.find((s) => s.id === saleId);
  if (!sale) return false;

  const updatedItems = sale.items.map((it) => {
    const hit = lines.find((l) => l.id === it.id);
    if (!hit) return it;
    const qty = Math.max(it.returnedQty, Math.floor(hit.qty));
    const price = Math.max(0, Number(hit.price) || 0);
    const diff = qty - it.qty;
    const available = Number(products.find((p) => p.id === it.id)?.onHandQty ?? 0);
    if (diff > available) return null; // not enough stock to increase
    return { ...it, qty, price };
  });

  if (updatedItems.some((i) => i === null)) return false;
  const items = updatedItems as Sale["items"];
  // apply stock differences only after validation passed
  sale.items.forEach((it) => {
    const next = items.find((n) => n.id === it.id)!;
    const diff = next.qty - it.qty;
    if (diff !== 0) {
      products = products.map((p) =>
        p.id === it.id ? { ...p, onHandQty: Number(p.onHandQty) - diff } : p,
      );
    }
  });
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const discount = saleDiscountAmount(subtotal, sale.discountType, sale.discountValue);
  const total = Math.max(0, subtotal - discount);
  sales = sales.map((s) => (s.id === saleId ? { ...s, items, subtotal, discount, total } : s));
  persist();
  return true;
}


/* ---- dummy auth ---- */

export function login(email: string) {
  try {
    window.localStorage.setItem(AUTH_KEY, email);
  } catch {
    /* ignore */
  }
}

export function logout() {
  try {
    window.localStorage.removeItem(AUTH_KEY);
  } catch {
    /* ignore */
  }
}

export function currentUser() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(AUTH_KEY);
  } catch {
    return null;
  }
}
