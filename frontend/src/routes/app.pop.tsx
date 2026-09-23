import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Camera, PackagePlus, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  VENDORS,
  addDepartment,
  useDepartments,
  addProduct,
  deleteProduct,
  finalPrice,
  nextItemNo,
  stockIn,
  updateProduct,
  upcExists,
  useProducts,
  type Product,
} from "@/lib/store";
import { BarcodeScanner } from "@/components/BarcodeScanner";

export const Route = createFileRoute("/app/pop")({
  head: () => ({
    meta: [
      { title: "POP — Product Operations | Book POS" },
      { name: "description", content: "Add and manage inventory products in Book POS." },
      { property: "og:title", content: "POP — Product Operations | Book POS" },
      { property: "og:description", content: "Add and manage inventory products in Book POS." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PopPage,
});

type Form = Omit<Product, "id">;

const emptyForm = (itemNo: string): Form => ({
  name: "",
  type: "Inventory",
  department: "",
  description: "",
  size: "",
  attribute: "",
  regPrice: 0,
  avgCost: 0,
  onHandQty: 0,
  tax: "Tax",
  upc: "",
  quickPickGroup: "",
  vendor: "",
  orderCost: 0,
  reorderPoint: "",
  itemNo,
  alu: "",
  unitOfMeasure: "",
  manufacturer: "",
  syncToMobile: false,
  comments: "",
  discountType: "none",
  discountValue: 0,
});

function PopPage() {
  const products = useProducts();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [form, setForm] = useState<Form>(() => emptyForm("2607"));
  const [error, setError] = useState("");
  const [scanningUpc, setScanningUpc] = useState(false);
  const [stockTarget, setStockTarget] = useState<Product | null>(null);
  const departments = useDepartments();
  const [addingDept, setAddingDept] = useState(false);
  const [newDept, setNewDept] = useState("");

  const saveNewDepartment = async () => {
    const clean = await addDepartment(newDept);
    if (!clean) return;
    set("department", clean);
    setNewDept("");
    setAddingDept(false);
    toast.success(`Department "${clean}" added`);
  };

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const openForm = () => {
    setForm(emptyForm(nextItemNo()));
    setEditingId(null);
    setError("");
    setOpen(true);
  };

  const openEdit = (p: Product) => {
    const { id: _id, ...rest } = p;
    setForm(rest);
    setEditingId(p.id);
    setError("");
    setOpen(true);
  };

  const save = async (again: boolean) => {
    if (!form.name.trim() || !form.department) {
      setError("Item Name and Department are required.");
      return;
    }
    if (form.upc.trim() && upcExists(form.upc, editingId ?? undefined)) {
      setError(`UPC "${form.upc.trim()}" is already used by another item.`);
      return;
    }
    try {
      if (editingId) {
        await updateProduct(editingId, form);
        toast.success(`"${form.name}" updated`);
        setOpen(false);
        setEditingId(null);
        return;
      }
      await addProduct(form);
      toast.success(`"${form.name}" added to inventory`);
      if (again) {
        setForm(emptyForm(nextItemNo()));
        setError("");
      } else {
        setOpen(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save product");
    }
  };

  const filtered = products.filter((p) =>
    (p.name + p.department + p.upc).toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">POP — Products</h2>
          <p className="text-sm text-muted-foreground">Add and manage your inventory items.</p>
        </div>
        <button
          onClick={openForm}
          className="flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
        >
          <Plus className="size-4" /> Add POP
        </button>
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3">
        <Search className="size-4 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search Inventory"
          className="h-10 w-full bg-transparent text-sm outline-none"
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left text-xs text-muted-foreground">
            <tr>
              {["Item Name", "Department", "Item Description", "Reg Price", "On-hand Qty", "UPC", "Vendor", ""].map(
                (h) => (
                  <th key={h} className="px-4 py-3 font-medium">
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="px-4 py-3 font-medium">{p.name}</td>
                <td className="px-4 py-3">{p.department}</td>
                <td className="px-4 py-3 text-muted-foreground">{p.description}</td>
                <td className="px-4 py-3">
                  {p.discountType !== "none" && Number(p.discountValue) > 0 ? (
                    <span>
                      <span className="font-medium">{finalPrice(p).toFixed(2)}</span>{" "}
                      <span className="text-xs text-muted-foreground line-through">
                        {Number(p.regPrice).toFixed(2)}
                      </span>
                      <span className="ml-1 text-xs text-primary">
                        {p.discountType === "percent" ? `-${p.discountValue}%` : `-Rs ${p.discountValue}`}
                      </span>
                    </span>
                  ) : (
                    Number(p.regPrice).toFixed(2)
                  )}
                </td>
                <td className="px-4 py-3">{p.onHandQty}</td>
                <td className="px-4 py-3 text-muted-foreground">{p.upc}</td>
                <td className="px-4 py-3">{p.vendor}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => setStockTarget(p)}
                      className="flex h-8 items-center gap-1 rounded-md border border-border px-2.5 text-xs font-medium transition hover:bg-secondary"
                      aria-label={`Stock in ${p.name}`}
                    >
                      <PackagePlus className="size-4" /> Stock In
                    </button>
                    <button
                      onClick={() => openEdit(p)}
                      className="flex h-8 items-center gap-1 rounded-md border border-border px-2.5 text-xs font-medium transition hover:bg-secondary"
                      aria-label={`Edit ${p.name}`}
                    >
                      <Pencil className="size-4" /> Edit
                    </button>
                    <button
                      onClick={() => {
                        void deleteProduct(p.id).then(() => toast.success("Item deleted"));
                      }}
                      className="text-muted-foreground transition hover:text-destructive"
                      aria-label={`Delete ${p.name}`}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                  No items found. Click “Add POP” to create one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
          {filtered.length} record(s) in results
        </div>
      </div>

      {stockTarget && (
        <StockInDialog product={stockTarget} onClose={() => setStockTarget(null)} />
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/40 p-4 backdrop-blur-sm">
          <div className="my-6 w-full max-w-4xl overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between bg-primary px-4 py-3 text-primary-foreground">
              <h3 className="text-sm font-semibold">
                {editingId ? "Edit Inventory Item" : "Add Inventory Item"}
              </h3>
              <button onClick={() => setOpen(false)} aria-label="Close">
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-5 p-5">
              <div className="flex items-center gap-2">
                <input
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="Enter Item Name"
                  className="h-12 w-full rounded-lg border border-border bg-background px-4 text-lg italic outline-none focus:ring-2 focus:ring-ring"
                />
                <span className="text-destructive">*</span>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <Section title="Basic Info">
                  <Select label="Type" value={form.type} onChange={(v) => set("type", v)} options={["Inventory", "Non-Inventory", "Service"]} />
                  <Field label="Department" required>
                    <div className="flex gap-2">
                      <select
                        value={addingDept ? "__new__" : form.department}
                        onChange={(e) => {
                          if (e.target.value === "__new__") {
                            setAddingDept(true);
                          } else {
                            setAddingDept(false);
                            set("department", e.target.value);
                          }
                        }}
                        className={inputCls}
                      >
                        <option value="">—</option>
                        {departments.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                        <option value="__new__">+ Add new department…</option>
                      </select>
                      {!addingDept && (
                        <button
                          type="button"
                          onClick={() => setAddingDept(true)}
                          aria-label="Add new department"
                          title="Add new department"
                          className="rounded-md border border-border px-2.5 transition hover:bg-secondary"
                        >
                          <Plus className="size-4" />
                        </button>
                      )}
                    </div>
                    {addingDept && (
                      <div className="mt-2 flex gap-2">
                        <input
                          value={newDept}
                          onChange={(e) => setNewDept(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              saveNewDepartment();
                            }
                          }}
                          placeholder="New department name"
                          autoFocus
                          className={inputCls}
                        />
                        <button
                          type="button"
                          onClick={saveNewDepartment}
                          disabled={!newDept.trim()}
                          className="h-9 shrink-0 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
                        >
                          Add
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAddingDept(false);
                            setNewDept("");
                          }}
                          aria-label="Cancel new department"
                          className="h-9 shrink-0 rounded-md border border-border px-2.5 transition hover:bg-secondary"
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                    )}
                  </Field>
                  <Field label="Item Description">
                    <textarea
                      value={form.description}
                      onChange={(e) => set("description", e.target.value)}
                      rows={3}
                      className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                    />
                  </Field>
                  <Text label="Size" value={form.size} onChange={(v) => set("size", v)} />
                  <Text label="Attribute" value={form.attribute} onChange={(v) => set("attribute", v)} />
                  <Num label="Reg Price" value={form.regPrice} onChange={(v) => set("regPrice", v)} />
                  <Field label="Discount">
                    <div className="flex gap-2">
                      <select
                        value={form.discountType}
                        onChange={(e) =>
                          set("discountType", e.target.value as Form["discountType"])
                        }
                        className={inputCls}
                      >
                        <option value="none">No discount</option>
                        <option value="amount">Amount off (Rs)</option>
                        <option value="percent">Percent off (%)</option>
                      </select>
                      <input
                        type="number"
                        min={0}
                        max={form.discountType === "percent" ? 100 : undefined}
                        disabled={form.discountType === "none"}
                        value={form.discountValue}
                        onChange={(e) => set("discountValue", Number(e.target.value) || 0)}
                        placeholder={form.discountType === "percent" ? "%" : "Rs"}
                        className={`${inputCls} w-28 shrink-0 disabled:opacity-50`}
                      />
                    </div>
                  </Field>
                  <Field label="Selling Price">
                    <div className="pt-1.5 text-sm font-semibold">
                      Rs {finalPrice(form).toFixed(2)}
                      {form.discountType !== "none" && Number(form.discountValue) > 0 && (
                        <span className="ml-2 text-xs font-normal text-muted-foreground line-through">
                          Rs {Number(form.regPrice).toFixed(2)}
                        </span>
                      )}
                    </div>
                  </Field>
                  <Num label="Avg. Unit Cost" value={form.avgCost} onChange={(v) => set("avgCost", v)} />
                  <Num label="On-Hand Qty" value={form.onHandQty} onChange={(v) => set("onHandQty", v)} />
                  <Select label="Tax" value={form.tax} onChange={(v) => set("tax", v)} options={["Tax", "Tax Free", "GST 17%"]} />
                  <Field label="UPC (barcode)">
                    <div className="flex gap-2">
                      <input
                        value={form.upc}
                        onChange={(e) => set("upc", e.target.value)}
                        placeholder="Optional — leave blank if no barcode"
                        className={inputCls}
                      />
                      <button
                        type="button"
                        onClick={() => setScanningUpc(true)}
                        title="Scan barcode with camera"
                        className="flex h-9 shrink-0 items-center gap-1 rounded-md border border-border px-3 text-xs font-medium transition hover:bg-secondary"
                      >
                        <Camera className="size-4" />
                        Scan
                      </button>
                    </div>
                  </Field>
                  <Select label="Quick Pick Group" value={form.quickPickGroup} onChange={(v) => set("quickPickGroup", v)} options={["Textbooks", "Accessories", "Stationery"]} />
                </Section>

                <div className="space-y-5">
                  <Section title="More Info">
                    <Select label="Vendor" value={form.vendor} onChange={(v) => set("vendor", v)} options={VENDORS} />
                    <Num label="Order Cost" value={form.orderCost} onChange={(v) => set("orderCost", v)} />
                    <Text label="Reorder Point" value={form.reorderPoint} onChange={(v) => set("reorderPoint", v)} />
                    <Text label="Item No." value={form.itemNo} onChange={(v) => set("itemNo", v)} />
                    <Text label="ALU" value={form.alu} onChange={(v) => set("alu", v)} />
                    <Select label="Unit of Measure" value={form.unitOfMeasure} onChange={(v) => set("unitOfMeasure", v)} options={["Each", "Box", "Dozen", "Pack"]} />
                    <Text label="Manufacturer" value={form.manufacturer} onChange={(v) => set("manufacturer", v)} />
                    <Field label="Sync to Mobile">
                      <input
                        type="checkbox"
                        checked={form.syncToMobile}
                        onChange={(e) => set("syncToMobile", e.target.checked)}
                        className="size-4 accent-primary"
                      />
                    </Field>
                  </Section>

                  <Section title="Comments">
                    <textarea
                      value={form.comments}
                      onChange={(e) => set("comments", e.target.value)}
                      rows={5}
                      className="w-full rounded-md border border-border bg-[oklch(0.98_0.04_105)] px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                    />
                  </Section>
                </div>
              </div>

              <BarcodeScanner
                open={scanningUpc}
                onClose={() => setScanningUpc(false)}
                onScan={(code) => {
                  set("upc", code);
                  setScanningUpc(false);
                  if (code.trim() && upcExists(code)) {
                    setError(`UPC "${code}" is already used by another item.`);
                  } else {
                    setError("");
                    toast.success(code.trim() ? `Barcode scanned: ${code}` : "Barcode cleared");
                  }
                }}
              />

              {error && <p className="text-sm text-destructive">{error}</p>}

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                {editingId ? (
                  <span />
                ) : (
                  <button
                    onClick={() => save(true)}
                    className="h-10 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
                  >
                    Save &amp; New
                  </button>
                )}
                <div className="flex gap-3">
                  <button
                    onClick={() => save(false)}
                    className="h-10 rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setOpen(false)}
                    className="h-10 rounded-lg border border-border px-6 text-sm font-medium transition hover:bg-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StockInDialog({ product, onClose }: { product: Product; onClose: () => void }) {
  const [qty, setQty] = useState(1);
  const [cost, setCost] = useState(Number(product.orderCost || product.avgCost || 0));
  const [price, setPrice] = useState(Number(product.regPrice || 0));
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");

  const submit = async () => {
    if (!qty || qty <= 0) {
      setErr("Enter how many units you are adding.");
      return;
    }
    const ok = await stockIn(product.id, qty, cost, price > 0 ? price : null, note);
    if (!ok) {
      setErr("Could not add this stock. Please check the quantity.");
      return;
    }
    toast.success(`${qty} unit(s) added to "${product.name}"`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between bg-primary px-4 py-3 text-primary-foreground">
          <h3 className="text-sm font-semibold">Stock In — refill inventory</h3>
          <button onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </button>
        </div>
        <div className="space-y-4 p-5">
          <div>
            <div className="text-base font-semibold">{product.name}</div>
            <div className="text-xs text-muted-foreground">
              Current stock {product.onHandQty} • UPC {product.upc || "—"} • Vendor{" "}
              {product.vendor || "—"}
            </div>
          </div>

          <label className="block text-sm">
            <span className="text-xs text-muted-foreground">Quantity to add</span>
            <input
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(Number(e.target.value))}
              className={`${inputCls} mt-1`}
            />
          </label>

          <label className="block text-sm">
            <span className="text-xs text-muted-foreground">New purchase cost (per unit)</span>
            <input
              type="number"
              value={cost}
              onChange={(e) => setCost(Number(e.target.value))}
              className={`${inputCls} mt-1`}
            />
          </label>

          <label className="block text-sm">
            <span className="text-xs text-muted-foreground">New selling price (per unit)</span>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
              className={`${inputCls} mt-1`}
            />
          </label>

          <label className="block text-sm">
            <span className="text-xs text-muted-foreground">Note (optional)</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. New lot from vendor"
              className={`${inputCls} mt-1`}
            />
          </label>

          <div className="rounded-lg bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
            After saving: stock becomes{" "}
            <strong className="text-foreground">{Number(product.onHandQty) + (qty || 0)}</strong>{" "}
            and selling price Rs {(price > 0 ? price : Number(product.regPrice)).toFixed(2)}.
          </div>

          {err && <p className="text-sm text-destructive">{err}</p>}

          <div className="flex justify-end gap-3 border-t border-border pt-4">
            <button
              onClick={onClose}
              className="h-10 rounded-lg border border-border px-5 text-sm font-medium transition hover:bg-secondary"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              className="h-10 rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
            >
              Add stock
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/40 p-4">
      <h4 className="mb-3 text-sm font-semibold text-primary">{title}</h4>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean | undefined;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[130px_1fr] items-start gap-3">
      <label className="pt-1.5 text-right text-xs text-muted-foreground">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  "h-9 w-full rounded-md border border-border bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring";

function Text({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field label={label}>
      <input value={value} onChange={(e) => onChange(e.target.value)} className={inputCls} />
    </Field>
  );
}

function Num({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <Field label={label}>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={inputCls}
      />
    </Field>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  required?: boolean | undefined;
}) {
  return (
    <Field label={label} required={required}>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={inputCls}>
        <option value="">—</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </Field>
  );
}
