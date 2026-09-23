import { useSyncExternalStore } from "react";
import { api } from "./api";

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
let departments: string[] = [...DEPARTMENTS];
let currentEmail: string | null = null;
let loaded = false;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

async function refresh() {
  const data = await api<{
    products: Product[];
    popHistory: PopEntry[];
    sales: Sale[];
    posReturns: PosReturnEntry[];
    heldSales: HeldSale[];
    departments: string[];
    vendors: string[];
  }>("/api/bootstrap");
  products = data.products;
  popHistory = data.popHistory;
  sales = data.sales;
  posReturns = data.posReturns;
  heldSales = data.heldSales;
  departments = data.departments;
  loaded = true;
  notify();
}

function ensureLoaded() {
  if (typeof window === "undefined") return;
  if (loaded || loading) return;
  loading = refresh().finally(() => {
    loading = null;
  });
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  ensureLoaded();
  return () => listeners.delete(cb);
}

const empty: Product[] = [];
const emptyPop: PopEntry[] = [];
const emptySales: Sale[] = [];
const emptyRet: PosReturnEntry[] = [];
const emptyHeld: HeldSale[] = [];
const emptyDepts: string[] = [];

function useStore<T>(get: () => T, server: T) {
  return useSyncExternalStore(subscribe, get, () => server);
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

export function useDepartments() {
  return useStore(() => departments, emptyDepts);
}

export async function addDepartment(name: string) {
  const data = await api<{ name: string; departments: string[] }>("/api/departments", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
  departments = data.departments;
  notify();
  return data.name;
}

export async function holdSale(
  items: { id: string; name: string; upc: string; price: number; qty: number }[],
  discount: { type: "none" | "amount" | "percent"; value: number },
  info: { label?: string; note?: string } = {},
) {
  if (items.length === 0) return null;
  const held = await api<HeldSale>("/api/held-sales", {
    method: "POST",
    body: JSON.stringify({ items, discount, info }),
  });
  await refresh();
  return held;
}

export async function deleteHeldSale(id: string) {
  await api(`/api/held-sales/${id}`, { method: "DELETE" });
  await refresh();
}

export async function addProduct(p: Omit<Product, "id">) {
  await api("/api/products", { method: "POST", body: JSON.stringify(p) });
  await refresh();
}

export async function deleteProduct(id: string) {
  await api(`/api/products/${id}`, { method: "DELETE" });
  await refresh();
}

export async function updateProduct(id: string, patch: Omit<Product, "id">) {
  await api(`/api/products/${id}`, { method: "PUT", body: JSON.stringify(patch) });
  await refresh();
  return true;
}

export async function stockIn(
  productId: string,
  qty: number,
  orderCost: number,
  regPrice: number | null,
  note: string,
) {
  try {
    await api(`/api/products/${productId}/stock-in`, {
      method: "POST",
      body: JSON.stringify({ qty, orderCost, regPrice, note }),
    });
    await refresh();
    return true;
  } catch {
    return false;
  }
}

export async function popReturn(productId: string, qty: number, reason: string) {
  try {
    await api(`/api/products/${productId}/pop-return`, {
      method: "POST",
      body: JSON.stringify({ qty, reason }),
    });
    await refresh();
    return true;
  } catch {
    return false;
  }
}

export function findByCode(code: string): Product | undefined {
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
  const c = upc.trim().toLowerCase();
  if (!c) return false;
  return products.some((p) => p.id !== exceptId && p.upc.trim().toLowerCase() === c);
}

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

export function saleRefundRatio(sale: Pick<Sale, "items" | "subtotal" | "discount">) {
  const gross = sale.items.reduce((s, i) => s + i.price * i.qty, 0);
  const net = Number(sale.subtotal ?? gross) - Number(sale.discount ?? 0);
  return gross > 0 ? Math.max(0, net) / gross : 1;
}

export function saleNet(sale: Pick<Sale, "total" | "refunded">) {
  return Math.max(0, Number(sale.total || 0) - Number(sale.refunded || 0));
}

export async function commitSale(
  items: { id: string; name: string; upc: string; price: number; qty: number }[],
  discount?: { type: "none" | "amount" | "percent"; value: number },
) {
  const sale = await api<Sale>("/api/sales", {
    method: "POST",
    body: JSON.stringify({ items, discount }),
  });
  await refresh();
  return sale;
}

export async function posReturn(saleId: string, lines: { id: string; qty: number }[], reason: string) {
  try {
    const data = await api<{ refund: number }>(`/api/sales/${saleId}/return`, {
      method: "POST",
      body: JSON.stringify({ lines, reason }),
    });
    await refresh();
    return data.refund;
  } catch {
    return 0;
  }
}

export function nextItemNo() {
  return String(2600 + products.length + 1);
}

export async function updateSale(saleId: string, lines: { id: string; price: number; qty: number }[]) {
  try {
    await api(`/api/sales/${saleId}`, { method: "PUT", body: JSON.stringify({ lines }) });
    await refresh();
    return true;
  } catch {
    return false;
  }
}

export async function login(email: string, password: string) {
  const data = await api<{ email: string }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  currentEmail = data.email;
  loaded = false;
  await refresh();
  notify();
}

export async function logout() {
  try {
    await api("/api/auth/logout", { method: "POST" });
  } catch {
    /* ignore */
  }
  currentEmail = null;
  products = [];
  popHistory = [];
  sales = [];
  posReturns = [];
  heldSales = [];
  loaded = false;
  notify();
}

export function setCurrentUser(email: string | null) {
  currentEmail = email;
  notify();
}

export function currentUser() {
  return currentEmail;
}
