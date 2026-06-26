import express from "express";
import path from "path";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import pg from "pg";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getDb, isConfigured, getPool } from "./src/db/index.ts";
import * as schema from "./src/db/schema.ts";

// robust global exception & promise rejection catch handlers to prevent the server process from crashing 
process.on("unhandledRejection", (reason, promise) => {
  console.error("🚨 Unhandled Rejection at promise:", promise, "reason:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("🚨 Uncaught Exception thrown:", err);
});

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ limit: "100mb", extended: true }));

const STORE_FILE = path.join(process.cwd(), "data_store.json");

let isPostgresActive = false;
let lastPostgresError: string | null = null;

let isFirebaseActive = false;
let lastFirebaseError: string | null = null;
let firebaseDbId: string | undefined = undefined;

try {
  const firebaseConfigPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(firebaseConfigPath)) {
    const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf8"));
    if (firebaseConfig.projectId) {
      if (getApps().length === 0) {
        initializeApp({
          projectId: firebaseConfig.projectId,
        });
      }
      isFirebaseActive = true;
      if (firebaseConfig.firestoreDatabaseId) {
        firebaseDbId = firebaseConfig.firestoreDatabaseId;
      }
      console.log(`🔥 Firebase Admin initialized successfully for project: ${firebaseConfig.projectId} (Database ID: ${firebaseDbId || "default"})`);
    } else {
      console.warn("⚠️ Warning: projectId not found in firebase-applet-config.json");
    }
  } else {
    console.warn("⚠️ Warning: firebase-applet-config.json not found");
  }
} catch (error: any) {
  isFirebaseActive = false;
  lastFirebaseError = error?.message || String(error);
  console.error("❌ Firebase Admin initialization failed:", error);
}

function getFirestoreDb() {
  return firebaseDbId ? getFirestore(undefined, firebaseDbId) : getFirestore();
}

async function loadFromFirestore(): Promise<any> {
  if (!isFirebaseActive) return null;
  const db = getFirestoreDb();
  
  try {
    const [suppliersSnap, invoicesSnap, paymentsSnap, backupsSnap, creditNotesSnap] = await Promise.all([
      db.collection("suppliers").get(),
      db.collection("invoices").get(),
      db.collection("payments").get(),
      db.collection("backups").get(),
      db.collection("creditNotes").get()
    ]);
    
    const suppliers = suppliersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const invoices = invoicesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const payments = paymentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const backups = backupsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const creditNotes = creditNotesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // System config
    const configDoc = await db.collection("config").doc("system").get();
    let supplierCategories = ["مواد خام", "خدمات", "أجهزة ومعدات", "مستلزمات مكتبية"];
    let warehouses = ["المستودع الرئيسي", "مخزن أكتوبر", "مستودع الإسكندرية"];
    let linkedBanks: any[] = [];
    let safeBalance = 0;
    
    if (configDoc.exists) {
      const configData = configDoc.data() || {};
      if (Array.isArray(configData.supplierCategories)) supplierCategories = configData.supplierCategories;
      if (Array.isArray(configData.warehouses)) warehouses = configData.warehouses;
      if (Array.isArray(configData.linkedBanks)) linkedBanks = configData.linkedBanks;
      if (typeof configData.safeBalance === "number") safeBalance = configData.safeBalance;
    }
    
    return {
      suppliers,
      invoices,
      payments,
      backups,
      creditNotes,
      supplierCategories,
      warehouses,
      linkedBanks,
      safeBalance
    };
  } catch (error) {
    console.error("Failed to load from Firestore:", error);
    throw error;
  }
}

async function saveToFirestore(data: any) {
  if (!isFirebaseActive) return;
  const db = getFirestoreDb();
  
  try {
    const syncCollection = async (colName: string, items: any[]) => {
      if (!Array.isArray(items)) return;
      
      const existingSnap = await db.collection(colName).get();
      const existingIds = existingSnap.docs.map(doc => doc.id);
      const currentIds = new Set(items.map(item => item.id).filter(Boolean));
      
      const batch = db.batch();
      let batchCount = 0;
      
      // Delete missing items
      for (const id of existingIds) {
        if (!currentIds.has(id)) {
          batch.delete(db.collection(colName).doc(id));
          batchCount++;
          if (batchCount >= 400) {
            await batch.commit();
            batchCount = 0;
          }
        }
      }
      
      // Upsert current items
      for (const item of items) {
        if (item && item.id) {
          batch.set(db.collection(colName).doc(item.id), item, { merge: true });
          batchCount++;
          if (batchCount >= 400) {
            await batch.commit();
            batchCount = 0;
          }
        }
      }
      
      if (batchCount > 0) {
        await batch.commit();
      }
    };
    
    await Promise.all([
      syncCollection("suppliers", data.suppliers || []),
      syncCollection("invoices", data.invoices || []),
      syncCollection("payments", data.payments || []),
      syncCollection("backups", data.backups || []),
      syncCollection("creditNotes", data.creditNotes || [])
    ]);
    
    await db.collection("config").doc("system").set({
      supplierCategories: data.supplierCategories || [],
      warehouses: data.warehouses || [],
      linkedBanks: data.linkedBanks || [],
      safeBalance: typeof data.safeBalance === "number" ? data.safeBalance : 0
    }, { merge: true });
    
    console.log("🔥 Successfully synced state to Firestore.");
  } catch (error) {
    console.error("Failed to save to Firestore:", error);
    throw error;
  }
}

async function initializeFirestore() {
  if (!isFirebaseActive) return;
  try {
    const db = getFirestoreDb();
    console.log("🔥 Verifying Firestore Admin connection and permissions...");
    const existingSuppliers = await db.collection("suppliers").limit(1).get();
    console.log("✅ Firestore Admin connected successfully!");
    
    if (existingSuppliers.empty && fs.existsSync(STORE_FILE)) {
      console.log("🔥 Firestore is empty but local file store is present. Seeding data_store.json into Firestore...");
      const localData = JSON.parse(fs.readFileSync(STORE_FILE, "utf-8"));
      await saveToFirestore(localData);
      console.log("🔥 Firestore Seed completed successfully!");
    }
  } catch (error: any) {
    isFirebaseActive = false;
    lastFirebaseError = error?.message || String(error);
    console.error("⚠️ Firestore initialization failed due to permissions or configuration. Disabling server-side Firestore operations:", error);
  }
}

async function loadFromPostgres(): Promise<any> {
  if (!isConfigured()) return null;
  const db = getDb();
  try {
    const sups = await db.select().from(schema.suppliers);
    const invs = await db.select().from(schema.invoices);
    const pays = await db.select().from(schema.payments);
    const bks = await db.select().from(schema.backups);
    const cns = await db.select().from(schema.creditNotes);
    const cfgs = await db.select().from(schema.systemConfig);

    // Reconstruct the configs
    const supplierCategories = cfgs.find(c => c.key === "supplierCategories")?.value || ["مواد خام", "خدمات", "أجهزة ومعدات", "مستلزمات مكتبية"];
    const warehouses = cfgs.find(c => c.key === "warehouses")?.value || ["المستودع الرئيسي", "مخزن أكتوبر", "مستودع الإسكندرية"];
    const linkedBanks = cfgs.find(c => c.key === "linkedBanks")?.value || [];
    const safeBalance = cfgs.find(c => c.key === "safeBalance")?.value || 0;

    return {
      suppliers: sups,
      invoices: invs,
      payments: pays,
      backups: bks,
      creditNotes: cns,
      supplierCategories,
      warehouses,
      linkedBanks,
      safeBalance
    };
  } catch (error) {
    console.error("Failed to load from Postgres:", error);
    throw error;
  }
}

async function saveToPostgres(data: any) {
  if (!isConfigured()) return;
  const db = getDb();
  
  try {
    await db.transaction(async (tx) => {
      // Clear existing records first
      await tx.delete(schema.suppliers);
      await tx.delete(schema.invoices);
      await tx.delete(schema.payments);
      await tx.delete(schema.backups);
      await tx.delete(schema.creditNotes);
      await tx.delete(schema.systemConfig);

      // Insert suppliers
      if (Array.isArray(data.suppliers) && data.suppliers.length > 0) {
        await tx.insert(schema.suppliers).values(data.suppliers);
      }

      // Insert invoices
      if (Array.isArray(data.invoices) && data.invoices.length > 0) {
        const invoicesToSave = data.invoices.map((inv: any) => ({
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          supplierId: inv.supplierId,
          issueDate: inv.issueDate,
          dueDate: inv.dueDate,
          items: inv.items || [],
          totalAmount: typeof inv.totalAmount === "number" ? inv.totalAmount : 0,
          status: inv.status || 'unpaid',
          notes: inv.notes || null,
          warehouse: inv.warehouse || null,
          creditNoteAmount: typeof inv.creditNoteAmount === "number" ? inv.creditNoteAmount : null,
          vatRate: typeof inv.vatRate === "number" ? inv.vatRate : null,
          vatAmount: typeof inv.vatAmount === "number" ? inv.vatAmount : null,
          customVatAmount: typeof inv.customVatAmount === "number" ? inv.customVatAmount : null,
          isCustomVat: typeof inv.isCustomVat === "boolean" ? inv.isCustomVat : null,
          attachments: inv.attachments || null,
        }));
        await tx.insert(schema.invoices).values(invoicesToSave);
      }

      // Insert payments
      if (Array.isArray(data.payments) && data.payments.length > 0) {
        const paymentsToSave = data.payments.map((p: any) => ({
          id: p.id,
          supplierId: p.supplierId,
          invoiceId: p.invoiceId,
          amount: typeof p.amount === "number" ? p.amount : 0,
          paymentDate: p.paymentDate,
          method: p.method,
          transRef: p.transRef,
        }));
        await tx.insert(schema.payments).values(paymentsToSave);
      }

      // Insert backups
      if (Array.isArray(data.backups) && data.backups.length > 0) {
        const backupsToSave = data.backups.map((b: any) => ({
          id: b.id,
          timestamp: b.timestamp,
          type: b.type,
          size: b.size,
          recordsCount: b.recordsCount || { suppliers: 0, invoices: 0, payments: 0 },
          dataDump: b.dataDump,
        }));
        await tx.insert(schema.backups).values(backupsToSave);
      }

      // Insert creditNotes
      if (Array.isArray(data.creditNotes) && data.creditNotes.length > 0) {
        const creditNotesToSave = data.creditNotes.map((cn: any) => ({
          id: cn.id,
          creditNoteNumber: cn.creditNoteNumber,
          supplierId: cn.supplierId,
          amount: typeof cn.amount === "number" ? cn.amount : 0,
          issueDate: cn.issueDate,
          dueDate: cn.dueDate,
          status: cn.status,
          items: cn.items || [],
          notes: cn.notes || null,
          attachments: cn.attachments || null,
        }));
        await tx.insert(schema.creditNotes).values(creditNotesToSave);
      }

      // Insert config key-values
      const configsToSave = [
        { key: "supplierCategories", value: data.supplierCategories || [] },
        { key: "warehouses", value: data.warehouses || [] },
        { key: "linkedBanks", value: data.linkedBanks || [] },
        { key: "safeBalance", value: typeof data.safeBalance === "number" ? data.safeBalance : 0 },
      ];
      await tx.insert(schema.systemConfig).values(configsToSave);
    });
  } catch (error) {
    console.error("Failed to save to Postgres:", error);
    throw error;
  }
}

async function initializePostgres(forceRecreate = false) {
  if (!isConfigured()) {
    isPostgresActive = false;
    lastPostgresError = "PostgreSQL environment variables are not loaded.";
    console.log("🔌 PostgreSQL setup bypassed (missing coordinates).");
    return;
  }
  
  try {
    console.log("🔌 Initializing PostgreSQL connection via connection pool...");
    const pool = getPool();
    // Test query
    const res = await pool.query("SELECT 1;");
    if (res.rows.length > 0) {
      isPostgresActive = true;
      lastPostgresError = null;
      console.log("✅ PostgreSQL is ACTIVE and connected successfully!");

      // Sync local data_store.json database cache into Postgres if database is clean/empty
      const db = getDb();
      const existingSuppliers = await db.select().from(schema.suppliers);
      if (existingSuppliers.length === 0 && fs.existsSync(STORE_FILE)) {
        console.log("💾 Database is empty but local file store is present. Seeding data_store.json into Postgres...");
        const localData = JSON.parse(fs.readFileSync(STORE_FILE, "utf-8"));
        await saveToPostgres(localData);
        console.log("✅ Seed completed successfully!");
      }
    }
  } catch (error: any) {
    isPostgresActive = false;
    lastPostgresError = error?.message || String(error);
    console.error("❌ PostgreSQL connection check failed:", error);
  }
}

async function initializeDataStore() {
  console.log("🔌 System Initializing Local Cache File...");
  try {
    if (!fs.existsSync(STORE_FILE)) {
      console.log("Initializing first-time pristine defaults to local file store...");
      const pristineState = {
        suppliers: [],
        invoices: [],
        payments: [],
        backups: [],
        supplierCategories: ["مواد خام", "خدمات", "أجهزة ومعدات", "مستلزمات مكتبية"],
        warehouses: ["المستودع الرئيسي", "مخزن أكتوبر", "مستودع الإسكندرية"],
        linkedBanks: [],
        safeBalance: 0,
        creditNotes: []
      };
      fs.writeFileSync(STORE_FILE, JSON.stringify(pristineState, null, 2), "utf-8");
    } else {
      console.log("✅ Local data_store.json detected.");
    }
  } catch (error) {
    console.error("Error during Datastore initialization:", error);
  }
}

// Reconcile on app launch
initializeDataStore();
initializePostgres();
initializeFirestore();

// API endpoint to retrieve stored data
app.get("/api/get-store", async (req, res) => {
  try {
    // 1. Try Firebase Firestore
    if (isFirebaseActive) {
      try {
        const data = await loadFromFirestore();
        if (data) {
          console.log("✅ Successfully loaded data store from Firestore!");
          return res.json({
            ...data,
            postgresActive: true, // Tell React client connection is healthy
            postgresError: null,
          });
        }
      } catch (err: any) {
        console.error("❌ Failed to fetch from Firestore:", err);
      }
    }

    // 2. Try PostgreSQL
    if (isPostgresActive) {
      try {
        const data = await loadFromPostgres();
        if (data) {
          return res.json({
            ...data,
            postgresActive: true,
            postgresError: null,
          });
        }
      } catch (err: any) {
        console.error("Failed to fetch from Postgres, falling back to file:", err);
      }
    }

    // 3. Fall back to local file
    if (fs.existsSync(STORE_FILE)) {
      const dataStr = fs.readFileSync(STORE_FILE, "utf-8");
      const data = JSON.parse(dataStr);
      return res.json({ 
        ...data, 
        postgresActive: isPostgresActive || isFirebaseActive,
        postgresError: lastPostgresError || lastFirebaseError 
      });
    }

    const pristineState = {
      suppliers: [],
      invoices: [],
      payments: [],
      backups: [],
      supplierCategories: ["مواد خام", "خدمات", "أجهزة ومعدات", "مستلزمات مكتبية"],
      warehouses: ["المستودع الرئيسي", "مخزن أكتوبر", "مستودع الإسكندرية"],
      linkedBanks: [],
      safeBalance: 0,
      creditNotes: []
    };
    fs.writeFileSync(STORE_FILE, JSON.stringify(pristineState, null, 2), "utf-8");
    return res.json({
      ...pristineState,
      postgresActive: isPostgresActive || isFirebaseActive,
      postgresError: lastPostgresError || lastFirebaseError,
    });
  } catch (error: any) {
    console.error("Error reading data store file:", error);
    return res.status(500).json({ error: "Failed to read storage." });
  }
});

// API endpoint to write stored data
app.post("/api/save-store", async (req, res) => {
  try {
    const data = req.body;
    
    // Save to local cache file first
    fs.writeFileSync(STORE_FILE, JSON.stringify(data, null, 2), "utf-8");

    let dbWriteSuccess = false;
    let dbErrorMsg: string | null = null;

    // 1. Save to Firestore
    if (isFirebaseActive) {
      try {
        await saveToFirestore(data);
        dbWriteSuccess = true;
      } catch (err: any) {
        console.error("Failed to save to Firestore:", err);
        dbErrorMsg = "Firestore error: " + err.message;
      }
    }

    // 2. Save to Postgres
    if (isPostgresActive) {
      try {
        await saveToPostgres(data);
        dbWriteSuccess = true;
      } catch (err: any) {
        console.error("Failed to commit save to Postgres:", err);
        if (dbErrorMsg) {
          dbErrorMsg += " | Postgres error: " + err.message;
        } else {
          dbErrorMsg = "Postgres error: " + err.message;
        }
      }
    }

    if (dbWriteSuccess) {
      return res.json({
        success: true,
        message: "تم حفظ البيانات بنجاح في قاعدة البيانات السحابية Firebase والملفات المحلية.",
        postgresActive: true,
        postgresError: dbErrorMsg
      });
    }

    return res.json({ 
      success: true, 
      message: "Data saved successfully on local secure server file system.",
      postgresActive: false,
      postgresError: dbErrorMsg || lastPostgresError || lastFirebaseError
    });
  } catch (error: any) {
    console.error("Critical error in save-store endpoint:", error);
    return res.status(500).json({ error: "Failed to persist storage locally on server." });
  }
});

// API endpoint to manually request database reconnection and verify status
app.post("/api/reconnect-db", async (req, res) => {
  try {
    await initializePostgres();
    if (isPostgresActive) {
      return res.json({
        success: true,
        postgresActive: true,
        postgresError: null,
        message: "تم الاتصال بقاعدة بيانات Cloud SQL بنجاح ومزامنة البيانات!"
      });
    } else {
      return res.status(500).json({
        success: false,
        postgresActive: false,
        postgresError: lastPostgresError,
        message: "فشل إعادة الاتصال: " + lastPostgresError
      });
    }
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      postgresActive: false,
      postgresError: String(err),
      message: "فشل: " + String(err)
    });
  }
});

// API endpoint to completely reset the connection and clear/reinitialize the database back to clean defaults
app.post("/api/reset-db", async (req, res) => {
  try {
    console.log("🚨 Client-requested full data store reset...");
    
    const pristineState = {
      suppliers: [],
      invoices: [],
      payments: [],
      backups: [],
      supplierCategories: ["مواد خام", "خدمات", "أجهزة ومعدات", "مستلزمات مكتبية"],
      warehouses: ["المستودع الرئيسي", "مخزن أكتوبر", "مستودع الإسكندرية"],
      linkedBanks: [],
      safeBalance: 0,
      creditNotes: []
    };

    // Save pristine file locally
    fs.writeFileSync(STORE_FILE, JSON.stringify(pristineState, null, 2), "utf-8");

    if (isFirebaseActive) {
      try {
        await saveToFirestore(pristineState);
      } catch (err) {
        console.error("Failed to clear Firestore on reset:", err);
      }
    }

    if (isPostgresActive) {
      try {
        await saveToPostgres(pristineState);
      } catch (err) {
        console.error("Failed to clear Postgres on reset:", err);
      }
    }

    return res.json({
      success: true,
      postgresActive: isPostgresActive || isFirebaseActive,
      postgresError: null,
      message: "تمت إعادة ضبط وتصفير النظام بالكامل وحذف كافة الفواتير والمعاملات من قاعدة البيانات والملفات بنجاح!"
    });
  } catch (err: any) {
    console.error("❌ Critical error during reset:", err);
    return res.status(500).json({
      success: false,
      postgresActive: isPostgresActive || isFirebaseActive,
      postgresError: err?.message || String(err),
      message: "فشلت عملية إعادة التهيئة: " + (err?.message || String(err))
    });
  }
});


// Initialize Gemini Client Lazily/Safely
let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("⚠️ Warning: GEMINI_API_KEY is missing. AI Support chat will run in local demo mode.");
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey || "DEMO_KEY",
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// API endpoint for support chat with Gemini
app.post("/api/chat", async (req, res) => {
  try {
    const { message, history, stats } = req.body;
    
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      // Offline fallback simulator
      setTimeout(() => {
        const arabicResponses = [
          `مرحباً بك! أنا مساعد الدعم الفني الافتراضي لنظام "مورد". يبدو أن مفتاح API الخاص بـ Gemini غير مهيأ حالياً في الإعدادات، لكني أعمل في وضع المحاكاة المحتلي لمساعدتك!
          إحصائياتك الحالية المتوفرة لدي:
          - الموردون النشطون: ${stats?.suppliersCount || 0} موردين.
          - فواتير المشتريات الإجمالية: ${stats?.invoicesCount || 0} فواتير.
          - إجمالي المديونية المستحقة: ${stats?.pendingAmount || 0} جنيه مصري.
          
          كيف يمكنني مساعدتك اليوم في إدارة المدفوعات والتقارير؟`,
          `أهلاً بك في نظام الدعم الفني لـ "مورد". يمكنك إضافة الموردين وسداد فواتيرهم بلمسة واحدة وتصديرها بصيغة PDF. هل تريد مني شرح كيفية عمل السداد الفوري والتكامل البنكي؟`,
          `أنا تحت أمرك! يمكنك القيام بتسوية أي فاتورة فوراً من خلال "بوابة التسوية اللحظية" المرتبطة بالبنوك المحلية (مثل بنك مصر والبنك الأهلي المصري) للحصول على رقم معاملة رسمي فوري.`
        ];
        const randomAnswer = arabicResponses[Math.floor(Math.random() * arabicResponses.length)];
        return res.json({ text: randomAnswer, isDemo: true });
      }, 800);
      return;
    }

    const client = getGeminiClient();
    
    // Convert custom simplified history inside body to Gemini contents format
    // Each history item is { role: 'user' | 'model', text: string }
    const formattedHistory = (history || []).map((msg: any) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }]
    }));

    // Add current user message at the end
    formattedHistory.push({
      role: 'user',
      parts: [{ text: message }]
    });

    const systemInstruction = `أنت مساعد الدعم الفني الذكي والمستشار المالي لنظام الإدارة المالية للموردين والمشتريات والمدفوعات المسمى "مورد".
أجب دائماً باللغة العربية بأسلوب مهني، دقيق، وودود للغاية.
يتعامل هذا النظام مع الحسابات الحساسة للموردين، الفواتير، العمليات البنكية، والتقارير التحليلية.

إليك الإحصائيات الفورية الحالية للنظام لتستخدمها بدقة للرد على أسئلة المستخدم:
- عدد الموردين الكلي: ${stats?.suppliersCount || 0}ورد.
- عدد فواتير المشتريات الكلي: ${stats?.invoicesCount || 0} فاتورة.
- عدد الفواتير غير المسددة: ${stats?.unpaidInvoicesCount || 0} فاتورة مستحقة.
- إجمالي مبلغ المشتريات: ${stats?.totalInvoicesAmount || 0} جنيه مصري.
- إجمالي المبالغ المسددة: ${stats?.paidAmount || 0} جنيه مصري.
- المبلغ المتبقي المستحق السداد (المديونية الكلية): ${stats?.pendingAmount || 0} جنيه مصري.

قواعد مهمة لك:
1. إذا سأل المستخدم عن إحصائيات، حسابات، أو مبالغ، اقرأ الإحصائيات المذكورة أعلاه وقدم له تحليلاً وافياً في لغة واضحة ومهنية.
2. وجه المستخدم دائماً وتحدث معه كمستشار مالي خبير.
3. ساعده في حل المشكلات التقنية للمؤسسة (مثل كيفية تفعيل التكامل البنكي، كيفية تسجيل فواتير جديدة، أو سبل تحسين التدفق النقدي).
4. حافظ على سرية البيانات ولا تذكر أي كود برمجي أو خفايا تقنية خاصة بالخادم؛ تحدث فقط بأسلوب موجه للمدير التنفيذي أو المحاسب المحترف.`;

    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: formattedHistory,
      config: {
        systemInstruction,
        temperature: 0.7,
      }
    });

    res.json({ text: response.text || "عذراً، لم أستطع توليد رد في الوقت الحالي." });

  } catch (error: any) {
    console.error("Gemini API Error:", error);
    res.status(500).json({ error: "فشل الاتصال بمساعد الذكاء الاصطناعي.", details: error.message });
  }
});

// API endpoint to generate an AI Executive Summary for the analytical financial reports
app.post("/api/reports/ai-summary", async (req, res) => {
  try {
    const { stats, suppliersList } = req.body;
    
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.json({
        summary: "تنبيه: يتطلب ملخص الذكاء الاصطناعي ربط مفتاح Gemini API. بناءً على الحسابات الحالية، فإن نسبة سداد المشتريات الإجمالية جيدة ولكن يُنصح بجدولة الدفعات القادمة لتجنب تراكم الغرامات وموافاة البنوك بطلبات التسوية مبكراً."
      });
    }

    const client = getGeminiClient();
    const prompt = `الرجاء كتابة تقرير تحليلي مالي تنفيذي قصير ومقنع باللغة العربية الفصحى (في حدود 3-4 أسطر) يحلل الأداء الحالي لمحفظة الموردين كالتالي:
إحصائياتنا المالية:
- إجمالي المشتريات: ${stats?.totalInvoicesAmount || 0} جنيه مصري.
- إجمالي المبالغ المسددة: ${stats?.paidAmount || 0} جنيه مصري.
- المديونية المعلقة: ${stats?.pendingAmount || 0} جنيه مصري.
- نسبة السداد الحالية: ${stats?.paymentRatio || 0}%.
- الموردين المسجلين: ${stats?.suppliersCount || 0}.

يرجى إعطاء نصيحة استراتيجية ذكية حول السيولة النقدية، العلاقات مع الموردين، وإدارة فترات السداد للتنبيهات القادمة.`;

    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        temperature: 0.6,
      }
    });

    res.json({ summary: response.text || "لا يتوفر تحليل حالياً." });

  } catch (error: any) {
    res.status(500).json({ error: "فشل توليد التقرير التحليلي.", details: error.message });
  }
});

// High-fidelity PDF exporter via Puppeteer
app.post("/api/export-pdf", async (req, res) => {
  try {
    const { html, filename, landscape = false } = req.body;
    if (!html) {
      return res.status(400).json({ error: "Missing HTML content" });
    }

    const puppeteer = await import("puppeteer");
    console.log("📄 Starting Puppeteer PDF generation (landscape:", landscape, ")...");

    const browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ]
    });

    const page = await browser.newPage();

    // Set A4 viewport
    const width = landscape ? 1123 : 794;
    const height = landscape ? 794 : 1123;
    await page.setViewport({
      width,
      height,
      deviceScaleFactor: 1,
    });

    // Load full HTML content
    await page.setContent(html, {
      waitUntil: ["load", "networkidle0"] as any
    });

    // Generate high-fidelity A4 PDF with exact margins
    const pdfBuffer = await page.pdf({
      format: "A4",
      landscape,
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: "0px",
        bottom: "0px",
        left: "0px",
        right: "0px",
      }
    });

    await browser.close();

    console.log("✅ High-fidelity PDF successfully created. Size:", pdfBuffer.length);

    res.contentType("application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename || 'report.pdf')}"`);
    res.send(pdfBuffer);

  } catch (error: any) {
    console.error("❌ Failed to generate PDF via Puppeteer:", error);
    res.status(500).json({
      error: "Failed to generate PDF",
      details: error?.message || String(error)
    });
  }
});

// Setup development or production build flows
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 [مورد] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
