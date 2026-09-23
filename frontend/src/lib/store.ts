import { useSyncExternalStore } from "react";
import * as logic from "../../../backend/src/logic.js";
import { api, isOfflineError } from "./api";
import { loadSnapshot, saveSnapshot, type LocalSnapshot } from "./local-db";

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

type DbState = {
  products: Product[];
  popHistory: PopEntry[];
  sales: Sale[];
  posReturns: PosReturnEntry[];
  heldSales: HeldSale[];
  customDepartments: string[];
};

type Bootstrap = DbState & {
  departments?: string[];
  vendors?: string[];
};

export const DEPARTMENTS = logic.DEPARTMENTS as string[];
export const VENDORS = logic.VENDORS as string[];

const SESSION_KEY = "bookpos.session";

let products: Product[] = [];
let popHistory: PopEntry[] = [];
let sales: Sale[] = [];
let posReturns: PosReturnEntry[] = [];
let heldSales: HeldSale[] = [];
let customDepartments: string[] = [];
let departments: string[] = [...(logic.DEPARTMENTS as string[])];
let currentEmail: string | null = null;
let loaded = false;
let started = false;
let dirty = false;
let hasRemoteBase = false;
let generation = 0;
let syncChain: Promise<void> = Promise.resolve();

type SyncStatus = { online: boolean; pending: boolean; syncing: boolean };
let status: SyncStatus = {
  online: typeof navigator === "undefined" ? true : navigator.onLine,
  pending: false,
  syncing: false,
};
const listeners = new Set<() => void>();
const statusListeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function setStatus(next: SyncStatus) {
  if (
    next.online === status.online &&
    next.pending === status.pending &&
    next.syncing === status.syncing
  ) {
    return;
  }
  status = next;
  statusListeners.forEach((listener) => listener());
}

function currentDb(): DbState {
  return { products, popHistory, sales, posReturns, heldSales, customDepartments };
}

function refreshDepartments() {
  const next = logic.allDepartments({ customDepartments }) as string[];
  if (next.length === departments.length && next.every((name, index) => name === departments[index])) return;
  departments = next;
}

function adopt(state: DbState) {
  products = state.products;
  popHistory = state.popHistory;
  sales = state.sales;
  posReturns = state.posReturns;
  heldSales = state.heldSales;
  customDepartments = state.customDepartments;
  refreshDepartments();
}

function snapshotPayload(): LocalSnapshot {
  return {
    products,
    popHistory,
    sales,
    posReturns,
    heldSales,
    customDepartments,
    dirty,
    hasRemoteBase,
  };
}

async function persist() {
  if (typeof indexedDB === "undefined") return;
  try {
    await saveSnapshot(snapshotPayload());
  } catch (error) {
    console.error("Could not save local data", error);
  }
}

function asList<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function stateFromBootstrap(data: Bootstrap): DbState {
  const remoteDepartments = asList<string>(data.customDepartments);
  const fallback = asList<string>(data.departments).filter((name) => !DEPARTMENTS.includes(name));
  return {
    products: asList<Product>(data.products),
    popHistory: asList<PopEntry>(data.popHistory),
    sales: asList<Sale>(data.sales),
    posReturns: asList<PosReturnEntry>(data.posReturns),
    heldSales: asList<HeldSale>(data.heldSales),
    customDepartments: remoteDepartments.length ? remoteDepartments : fallback,
  };
}

function localHasData(state: DbState) {
  return (
    state.products.length > 0 ||
    state.sales.length > 0 ||
    state.popHistory.length > 0 ||
    state.posReturns.length > 0 ||
    state.heldSales.length > 0 ||
    state.customDepartments.length > 0
  );
}

function mergeById<T extends { id: string }>(remote: T[], local: T[]) {
  const localIds = new Set(local.map((item) => item.id));
  return [...local.filter((item) => item.id), ...remote.filter((item) => item.id && !localIds.has(item.id))];
}

function mergeStates(remote: DbState, local: DbState): DbState {
  return {
    products: mergeById(remote.products, local.products),
    popHistory: mergeById(remote.popHistory, local.popHistory),
    sales: mergeById(remote.sales, local.sales),
    posReturns: mergeById(remote.posReturns, local.posReturns),
    heldSales: mergeById(remote.heldSales, local.heldSales),
    customDepartments: Array.from(new Set([...remote.customDepartments, ...local.customDepartments])).sort(),
  };
}

async function pushState() {
  await api("/api/sync", {
    method: "PUT",
    body: JSON.stringify(currentDb()),
  });
}

async function pullState() {
  const data = await api<Bootstrap>("/api/bootstrap");
  return stateFromBootstrap(data);
}

async function syncWithServer() {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    setStatus({ online: false, pending: dirty, syncing: false });
    return;
  }

  const gen = generation;
  setStatus({ online: status.online, pending: dirty, syncing: true });
  try {
    if (dirty && hasRemoteBase) {
      await pushState();
      if (generation === gen) {
        dirty = false;
        await persist();
      }
      setStatus({ online: true, pending: dirty, syncing: false });
      return;
    }

    if (dirty && !hasRemoteBase && localHasData(currentDb())) {
      const remote = await pullState();
      if (generation !== gen) {
        setStatus({ online: true, pending: true, syncing: false });
        return;
      }
      const merged = mergeStates(remote, currentDb());
      adopt(merged);
      hasRemoteBase = true;
      dirty = true;
      generation += 1;
      notify();
      await persist();
      await pushState();
      if (generation === gen + 1) {
        dirty = false;
        await persist();
      }
      setStatus({ online: true, pending: dirty, syncing: false });
      return;
    }

    const remote = await pullState();
    if (generation !== gen || dirty) {
      setStatus({ online: true, pending: dirty, syncing: false });
      return;
    }
    adopt(remote);
    hasRemoteBase = true;
    dirty = false;
    loaded = true;
    notify();
    await persist();
    setStatus({ online: true, pending: false, syncing: false });
  } catch (error) {
    const offline = isOfflineError(error) || (typeof navigator !== "undefined" && navigator.onLine === false);
    setStatus({ online: !offline, pending: dirty, syncing: false });
  }
}

function scheduleSync() {
  const run = syncChain.then(() => syncWithServer());
  syncChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function hydrate() {
  if (typeof indexedDB === "undefined") {
    loaded = true;
    return;
  }
  try {
    const saved = await loadSnapshot();
    if (saved) {
      adopt({
        products: asList<Product>(saved.products),
        popHistory: asList<PopEntry>(saved.popHistory),
        sales: asList<Sale>(saved.sales),
        posReturns: asList<PosReturnEntry>(saved.posReturns),
        heldSales: asList<HeldSale>(saved.heldSales),
        customDepartments: asList<string>(saved.customDepartments),
      });
      dirty = Boolean(saved.dirty);
      hasRemoteBase = Boolean(saved.hasRemoteBase);
      loaded = true;
      notify();
      setStatus({ online: status.online, pending: dirty, syncing: false });
    }
  } catch (error) {
    console.error("Could not read local data", error);
  } finally {
    loaded = true;
  }
}

function ensureLoaded() {
  if (typeof window === "undefined" || started) return;
  started = true;
  window.addEventListener("online", () => {
    setStatus({ online: true, pending: dirty, syncing: status.syncing });
    void scheduleSync();
  });
  window.addEventListener("offline", () => {
    setStatus({ online: false, pending: dirty, syncing: false });
  });
  window.setInterval(() => {
    if (dirty) void scheduleSync();
  }, 15000);
  void hydrate().then(() => scheduleSync());
}

async function applyChange<T>(fn: (db: DbState) => T, accept: (result: T) => boolean): Promise<T> {
  const draft = structuredClone(currentDb());
  const result = fn(draft);
  if (!accept(result)) return result;
  adopt(draft);
  generation += 1;
  dirty = true;
  loaded = true;
  notify();
  setStatus({ online: status.online, pending: true, syncing: status.syncing });
  await persist();
  void scheduleSync();
  return result;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  ensureLoaded();
  return () => listeners.delete(cb);
}

function subscribeStatus(cb: () => void) {
  statusListeners.add(cb);
  ensureLoaded();
  return () => statusListeners.delete(cb);
}

const empty: Product[] = [];
const emptyPop: PopEntry[] = [];
const emptySales: Sale[] = [];
const emptyRet: PosReturnEntry[] = [];
const emptyHeld: HeldSale[] = [];
const emptyDepts: string[] = [];
const serverStatus: SyncStatus = { online: true, pending: false, syncing: false };

function useStore<T>(get: () => T, server: T) {
  return useSyncExternalStore(subscribe, get, () => server);
}

export function useSyncStatus() {
  return useSyncExternalStore(subscribeStatus, () => status, () => serverStatus);
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

export function readCachedSession() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(SESSION_KEY);
}

export async function addDepartment(name: string) {
  const created = await applyChange(
    (db) => logic.addDepartment(db, name) as string,
    (value) => {
      const clean = String(value || "");
      return Boolean(clean) && !DEPARTMENTS.includes(clean) && !customDepartments.includes(clean);
    },
  );
  return String(created || "").trim().toUpperCase();
}

export async function holdSale(
  items: { id: string; name: string; upc: string; price: number; qty: number }[],
  discount: { type: "none" | "amount" | "percent"; value: number },
  info: { label?: string; note?: string } = {},
) {
  if (items.length === 0) return null;
  return applyChange(
    (db) => logic.holdSale(db, items, discount, info) as HeldSale | null,
    (held) => held != null,
  );
}

export async function deleteHeldSale(id: string) {
  await applyChange(
    (db) => logic.deleteHeldSale(db, id) as boolean,
    (ok) => ok,
  );
}

export async function addProduct(p: Omit<Product, "id">) {
  if (upcExists(p.upc)) throw new Error("UPC already exists");
  await applyChange((db) => logic.addProduct(db, p) as Product, () => true);
}

export async function deleteProduct(id: string) {
  const removed = await applyChange(
    (db) => logic.deleteProduct(db, id) as boolean,
    (ok) => ok,
  );
  if (!removed) throw new Error("Product not found");
}

export async function updateProduct(id: string, patch: Omit<Product, "id">) {
  if (upcExists(patch.upc, id)) throw new Error("UPC already exists");
  const updated = await applyChange(
    (db) => logic.updateProduct(db, id, patch) as Product | null,
    (item) => item != null,
  );
  if (!updated) throw new Error("Product not found");
  return true;
}

export async function stockIn(
  productId: string,
  qty: number,
  orderCost: number,
  regPrice: number | null,
  note: string,
) {
  return applyChange(
    (db) => logic.stockIn(db, productId, qty, orderCost, regPrice, note) as boolean,
    (ok) => ok,
  );
}

export async function popReturn(productId: string, qty: number, reason: string) {
  return applyChange(
    (db) => logic.popReturn(db, productId, qty, reason) as boolean,
    (ok) => ok,
  );
}

export function findByCode(code: string): Product | undefined {
  return logic.findByCode(products, code) as Product | undefined;
}

export function upcExists(upc: string, exceptId?: string) {
  return logic.upcExists(products, upc, exceptId) as boolean;
}

export function saleDiscountAmount(
  subtotal: number,
  type: "none" | "amount" | "percent" | undefined,
  value: number | undefined,
) {
  return logic.saleDiscountAmount(subtotal, type, value) as number;
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
  const sale = await applyChange(
    (db) => logic.commitSale(db, items, discount) as Sale | null,
    (created) => created != null,
  );
  if (!sale) throw new Error("Sale could not be completed. Check stock.");
  return sale;
}

export async function posReturn(saleId: string, lines: { id: string; qty: number }[], reason: string) {
  const refund = await applyChange(
    (db) => logic.posReturn(db, saleId, lines, reason) as number,
    (amount) => amount > 0,
  );
  return refund;
}

export function nextItemNo() {
  return logic.nextItemNo(products) as string;
}

export async function updateSale(saleId: string, lines: { id: string; price: number; qty: number }[]) {
  return applyChange(
    (db) => logic.updateSale(db, saleId, lines) as boolean,
    (ok) => ok,
  );
}

export async function login(email: string, password: string) {
  const data = await api<{ email: string }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  currentEmail = data.email;
  if (typeof window !== "undefined") localStorage.setItem(SESSION_KEY, data.email);
  if (!loaded) await hydrate();
  await scheduleSync();
  notify();
}

export async function logout() {
  try {
    await api("/api/auth/logout", { method: "POST" });
  } catch {
    /* Offline logout still clears the session on this device. */
  }
  currentEmail = null;
  if (typeof window !== "undefined") localStorage.removeItem(SESSION_KEY);
  notify();
}

export function setCurrentUser(email: string | null) {
  currentEmail = email;
  if (typeof window !== "undefined" && email) localStorage.setItem(SESSION_KEY, email);
  notify();
}

export function currentUser() {
  return currentEmail;
}
