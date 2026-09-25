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

export function saleDiscountAmount(subtotal, type, value) {
  const v = Number(value) || 0;
  if (type === "amount") return Math.min(Math.max(v, 0), subtotal);
  if (type === "percent") return (subtotal * Math.min(Math.max(v, 0), 100)) / 100;
  return 0;
}

export function allDepartments(db) {
  const extra = Array.isArray(db.customDepartments) ? db.customDepartments : [];
  return [...DEPARTMENTS, ...extra];
}

export function findByCode(products, code) {
  const c = String(code || "").trim().toLowerCase();
  if (!c) return undefined;
  return products.find(
    (p) =>
      String(p.upc).trim().toLowerCase() === c ||
      String(p.alu).trim().toLowerCase() === c ||
      String(p.itemNo).trim().toLowerCase() === c,
  );
}

export function upcExists(products, upc, exceptId) {
  const c = String(upc || "").trim().toLowerCase();
  if (!c) return false;
  return products.some((p) => p.id !== exceptId && String(p.upc).trim().toLowerCase() === c);
}

export function nextItemNo(products) {
  return String(2600 + products.length + 1);
}

function logPop(db, e) {
  db.popHistory = [
    {
      ...e,
      id: `h-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      at: Date.now(),
    },
    ...db.popHistory,
  ];
}

export function addDepartment(db, name) {
  const clean = String(name || "").trim().toUpperCase();
  if (!clean) return "";
  if (DEPARTMENTS.includes(clean) || db.customDepartments.includes(clean)) return clean;
  db.customDepartments = [...db.customDepartments, clean].sort();
  return clean;
}

export function addProduct(db, p) {
  const item = { ...p, id: `p-${Date.now()}` };
  db.products = [item, ...db.products];
  logPop(db, {
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
  return item;
}

export function updateProduct(db, id, patch) {
  const prev = db.products.find((x) => x.id === id);
  if (!prev) return null;
  const next = { ...patch, id };
  db.products = db.products.map((x) => (x.id === id ? next : x));
  logPop(db, {
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
  return next;
}

export function deleteProduct(db, id) {
  const p = db.products.find((x) => x.id === id);
  db.products = db.products.filter((x) => x.id !== id);
  if (p) {
    logPop(db, {
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
  return Boolean(p);
}

export function stockIn(db, productId, qty, orderCost, regPrice, note) {
  const p = db.products.find((x) => x.id === productId);
  if (!p || qty <= 0) return false;
  const oldQty = Number(p.onHandQty) || 0;
  const newQty = oldQty + qty;
  const cost = Number(orderCost) || 0;
  const avgCost = newQty > 0 ? (oldQty * (Number(p.avgCost) || 0) + qty * cost) / newQty : cost;
  db.products = db.products.map((x) =>
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
  logPop(db, {
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
  return true;
}

export function popReturn(db, productId, qty, reason) {
  const p = db.products.find((x) => x.id === productId);
  if (!p || qty <= 0) return false;
  if (qty > Number(p.onHandQty)) return false;
  db.products = db.products.map((x) =>
    x.id === productId ? { ...x, onHandQty: Number(x.onHandQty) - qty } : x,
  );
  logPop(db, {
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
  return true;
}

export function commitSale(db, items, discount) {
  if (!Array.isArray(items) || items.length === 0) return null;
  for (const item of items) {
    const product = db.products.find((p) => p.id === item.id);
    if (!product || Number(product.onHandQty) < Number(item.qty)) return null;
  }
  db.products = db.products.map((p) => {
    const hit = items.find((i) => i.id === p.id);
    return hit ? { ...p, onHandQty: Number(p.onHandQty) - hit.qty } : p;
  });
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const discAmount = saleDiscountAmount(subtotal, discount?.type, discount?.value);
  const sale = {
    id: `s-${Date.now()}`,
    at: Date.now(),
    receiptNo: `R-${1000 + db.sales.length + 1}`,
    items: items.map((i) => ({ ...i, returnedQty: 0 })),
    subtotal,
    discountType: discount?.type ?? "none",
    discountValue: Number(discount?.value) || 0,
    discount: discAmount,
    total: Math.max(0, subtotal - discAmount),
    refunded: 0,
  };
  db.sales = [sale, ...db.sales];
  return sale;
}

export function holdSale(db, items, discount, info = {}) {
  if (!Array.isArray(items) || items.length === 0) return null;
  const held = {
    id: `h-${Date.now()}`,
    at: Date.now(),
    label: (info.label || "").trim() || `Hold #${db.heldSales.length + 1}`,
    note: (info.note || "").trim(),
    discountType: discount.type,
    discountValue: Number(discount.value) || 0,
    items: items.map((i) => ({ ...i })),
  };
  db.heldSales = [held, ...db.heldSales];
  return held;
}

export function deletePopEntry(db, id) {
  const before = db.popHistory.length;
  db.popHistory = db.popHistory.filter((entry) => entry.id !== id);
  return db.popHistory.length < before;
}

export function deleteSale(db, id) {
  const sale = db.sales.find((s) => s.id === id);
  if (!sale) return false;
  for (const item of sale.items) {
    const restore = Math.max(0, Number(item.qty) - Number(item.returnedQty || 0));
    if (restore <= 0) continue;
    db.products = db.products.map((p) =>
      p.id === item.id ? { ...p, onHandQty: Number(p.onHandQty) + restore } : p,
    );
  }
  db.sales = db.sales.filter((s) => s.id !== id);
  db.posReturns = (db.posReturns || []).filter((entry) => entry.saleId !== id);
  return true;
}

export function deleteHeldSale(db, id) {
  const before = db.heldSales.length;
  db.heldSales = db.heldSales.filter((h) => h.id !== id);
  return db.heldSales.length < before;
}

export function posReturn(db, saleId, lines, reason) {
  const sale = db.sales.find((s) => s.id === saleId);
  if (!sale) return 0;
  let refund = 0;
  const stamped = [];
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
      db.products = db.products.map((p) =>
        p.id === it.id ? { ...p, onHandQty: Number(p.onHandQty) + qty } : p,
      );
      return { ...it, returnedQty: it.returnedQty + qty };
    }
    return it;
  });

  if (refund === 0) return 0;

  db.sales = db.sales.map((s) =>
    s.id === sale.id ? { ...s, items: updatedItems, refunded: s.refunded + refund } : s,
  );
  db.posReturns = [...stamped, ...db.posReturns];
  return refund;
}

export function updateSale(db, saleId, lines) {
  const sale = db.sales.find((s) => s.id === saleId);
  if (!sale) return false;

  const updatedItems = sale.items.map((it) => {
    const hit = lines.find((l) => l.id === it.id);
    if (!hit) return it;
    const qty = Math.max(it.returnedQty, Math.floor(hit.qty));
    const price = Math.max(0, Number(hit.price) || 0);
    const diff = qty - it.qty;
    const available = Number(db.products.find((p) => p.id === it.id)?.onHandQty ?? 0);
    if (diff > available) return null;
    return { ...it, qty, price };
  });

  if (updatedItems.some((i) => i === null)) return false;
  const items = updatedItems;
  sale.items.forEach((it) => {
    const next = items.find((n) => n.id === it.id);
    const diff = next.qty - it.qty;
    if (diff !== 0) {
      db.products = db.products.map((p) =>
        p.id === it.id ? { ...p, onHandQty: Number(p.onHandQty) - diff } : p,
      );
    }
  });
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const discount = saleDiscountAmount(subtotal, sale.discountType, sale.discountValue);
  const total = Math.max(0, subtotal - discount);
  db.sales = db.sales.map((s) => (s.id === saleId ? { ...s, items, subtotal, discount, total } : s));
  return true;
}
