import { MongoClient } from "mongodb";

const emptyState = () => ({
  products: [],
  popHistory: [],
  sales: [],
  posReturns: [],
  heldSales: [],
  customDepartments: [],
});

let client;
let db;
let queue = Promise.resolve();

function strip(doc) {
  if (!doc || typeof doc !== "object") return doc;
  const { _id, ...rest } = doc;
  return rest;
}

export async function connectMongo() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is missing in backend/.env");
  }
  client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
  await client.connect();
  db = client.db();
  await Promise.all([
    db.collection("products").createIndex({ id: 1 }, { unique: true }),
    db.collection("sales").createIndex({ id: 1 }, { unique: true }),
    db.collection("popHistory").createIndex({ id: 1 }, { unique: true }),
    db.collection("posReturns").createIndex({ id: 1 }, { unique: true }),
    db.collection("heldSales").createIndex({ id: 1 }, { unique: true }),
  ]);
  const ping = await db.command({ ping: 1 });
  if (ping.ok !== 1) throw new Error("MongoDB ping failed");
  console.log(`MongoDB connected: ${uri}`);
}

export async function loadDb() {
  if (!db) throw new Error("MongoDB is not connected");
  const [products, popHistory, sales, posReturns, heldSales, meta] = await Promise.all([
    db.collection("products").find({}).sort({ _order: 1 }).toArray(),
    db.collection("popHistory").find({}).sort({ at: -1 }).toArray(),
    db.collection("sales").find({}).sort({ at: -1 }).toArray(),
    db.collection("posReturns").find({}).sort({ at: -1 }).toArray(),
    db.collection("heldSales").find({}).sort({ at: -1 }).toArray(),
    db.collection("meta").findOne({ _id: "store" }),
  ]);
  return {
    products: products.map(strip),
    popHistory: popHistory.map(strip),
    sales: sales.map(strip),
    posReturns: posReturns.map(strip),
    heldSales: heldSales.map(strip),
    customDepartments: Array.isArray(meta?.customDepartments) ? meta.customDepartments : [],
  };
}

async function replaceAll(name, docs, extra = () => ({})) {
  const col = db.collection(name);
  await col.deleteMany({});
  if (!docs.length) return;
  await col.insertMany(docs.map((doc, index) => ({ ...doc, ...extra(doc, index) })));
}

export async function saveDb(state) {
  if (!db) throw new Error("MongoDB is not connected");
  await Promise.all([
    replaceAll("products", state.products, (_d, i) => ({ _order: i })),
    replaceAll("popHistory", state.popHistory),
    replaceAll("sales", state.sales),
    replaceAll("posReturns", state.posReturns),
    replaceAll("heldSales", state.heldSales),
    db.collection("meta").updateOne(
      { _id: "store" },
      { $set: { customDepartments: state.customDepartments || [] } },
      { upsert: true },
    ),
  ]);
}

export function mutate(fn) {
  const run = async () => {
    const state = await loadDb();
    const result = fn(state);
    await saveDb(state);
    return result;
  };
  const next = queue.then(run, run);
  queue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

export function mongoStatus() {
  return {
    connected: Boolean(db),
    database: db?.databaseName || null,
  };
}

export { emptyState };
