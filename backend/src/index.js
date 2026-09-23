import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { connectMongo, loadDb, mongoStatus, mutate } from "./db.js";
import {
  adminEmail,
  adminPassword,
  cookieName,
  cookieOptions,
  signToken,
  verifyToken,
} from "./auth.js";
import * as logic from "./logic.js";

if (!process.env.JWT_SECRET || !adminEmail() || !adminPassword() || !process.env.MONGODB_URI) {
  console.error("Missing ADMIN_EMAIL, ADMIN_PASSWORD, JWT_SECRET, or MONGODB_URI in .env");
  process.exit(1);
}

const app = express();
const PORT = Number(process.env.PORT) || 4000;
const origins = (process.env.FRONTEND_ORIGIN || "http://localhost:8080")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(
  cors({
    origin(origin, cb) {
      if (!origin || origins.includes(origin)) return cb(null, true);
      return cb(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

function requireAuth(req, res, next) {
  const token = req.cookies?.[cookieName()];
  const payload = verifyToken(token);
  if (!payload?.email) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  req.user = { email: payload.email, role: payload.role || "admin" };
  return next();
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, mongo: mongoStatus() });
});

app.post("/api/auth/login", loginLimiter, (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }
  if (email !== adminEmail() || password !== adminPassword()) {
    return res.status(401).json({ error: "Invalid email or password" });
  }
  const token = signToken(email);
  res.cookie(cookieName(), token, cookieOptions());
  return res.json({ email, role: "admin" });
});

app.post("/api/auth/logout", (req, res) => {
  res.clearCookie(cookieName(), { ...cookieOptions(), maxAge: 0 });
  res.json({ ok: true });
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json(req.user);
});

app.get("/api/bootstrap", requireAuth, async (_req, res) => {
  const state = await loadDb();
  res.json({
    products: state.products,
    popHistory: state.popHistory,
    sales: state.sales,
    posReturns: state.posReturns,
    heldSales: state.heldSales,
    departments: logic.allDepartments(state),
    vendors: logic.VENDORS,
  });
});

app.post("/api/departments", requireAuth, async (req, res) => {
  const name = await mutate((state) => logic.addDepartment(state, req.body?.name));
  if (!name) return res.status(400).json({ error: "Department name is required" });
  const state = await loadDb();
  res.json({ name, departments: logic.allDepartments(state) });
});

app.post("/api/products", requireAuth, async (req, res) => {
  const created = await mutate((state) => {
    if (logic.upcExists(state.products, req.body?.upc)) {
      return { error: "UPC already exists" };
    }
    return { item: logic.addProduct(state, req.body) };
  });
  if (created.error) return res.status(409).json({ error: created.error });
  res.json(created.item);
});

app.put("/api/products/:id", requireAuth, async (req, res) => {
  const updated = await mutate((state) => {
    if (logic.upcExists(state.products, req.body?.upc, req.params.id)) {
      return { error: "UPC already exists" };
    }
    const item = logic.updateProduct(state, req.params.id, req.body);
    return item ? { item } : { error: "Product not found", status: 404 };
  });
  if (updated.error) return res.status(updated.status || 409).json({ error: updated.error });
  res.json(updated.item);
});

app.delete("/api/products/:id", requireAuth, async (req, res) => {
  const ok = await mutate((state) => logic.deleteProduct(state, req.params.id));
  if (!ok) return res.status(404).json({ error: "Product not found" });
  res.json({ ok: true });
});

app.post("/api/products/:id/stock-in", requireAuth, async (req, res) => {
  const ok = await mutate((state) =>
    logic.stockIn(
      state,
      req.params.id,
      Number(req.body?.qty) || 0,
      Number(req.body?.orderCost) || 0,
      req.body?.regPrice ?? null,
      String(req.body?.note || ""),
    ),
  );
  if (!ok) return res.status(400).json({ error: "Could not add stock" });
  res.json({ ok: true });
});

app.post("/api/products/:id/pop-return", requireAuth, async (req, res) => {
  const ok = await mutate((state) =>
    logic.popReturn(state, req.params.id, Number(req.body?.qty) || 0, String(req.body?.reason || "")),
  );
  if (!ok) return res.status(400).json({ error: "Return could not be completed" });
  res.json({ ok: true });
});

app.post("/api/sales", requireAuth, async (req, res) => {
  const sale = await mutate((state) => logic.commitSale(state, req.body?.items || [], req.body?.discount));
  if (!sale) return res.status(400).json({ error: "Sale could not be completed. Check stock." });
  res.json(sale);
});

app.put("/api/sales/:id", requireAuth, async (req, res) => {
  const ok = await mutate((state) => logic.updateSale(state, req.params.id, req.body?.lines || []));
  if (!ok) return res.status(400).json({ error: "Sale could not be updated. Check stock." });
  res.json({ ok: true });
});

app.post("/api/sales/:id/return", requireAuth, async (req, res) => {
  const refund = await mutate((state) =>
    logic.posReturn(state, req.params.id, req.body?.lines || [], String(req.body?.reason || "")),
  );
  if (refund <= 0) return res.status(400).json({ error: "Return could not be completed" });
  res.json({ refund });
});

app.post("/api/held-sales", requireAuth, async (req, res) => {
  const held = await mutate((state) =>
    logic.holdSale(state, req.body?.items || [], req.body?.discount || { type: "none", value: 0 }, req.body?.info || {}),
  );
  if (!held) return res.status(400).json({ error: "Nothing to hold" });
  res.json(held);
});

app.delete("/api/held-sales/:id", requireAuth, async (req, res) => {
  await mutate((state) => logic.deleteHeldSale(state, req.params.id));
  res.json({ ok: true });
});

app.use("/api", requireAuth, (_req, res) => {
  res.status(404).json({ error: "Not found" });
});

try {
  await connectMongo();
} catch (err) {
  console.error("MongoDB connection failed:", err instanceof Error ? err.message : err);
  process.exit(1);
}

app.listen(PORT, () => {
  console.log(`Book POS API listening on http://127.0.0.1:${PORT}`);
});
