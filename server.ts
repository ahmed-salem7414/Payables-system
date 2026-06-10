import express from "express";
import path from "path";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ limit: "100mb", extended: true }));

const STORE_FILE = path.join(process.cwd(), "data_store.json");

// Initialize Firebase Admin dynamically to persist store permanently
let fdb: any = null;

try {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(configPath)) {
    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    const adminApp = initializeApp({
      projectId: firebaseConfig.projectId,
    });
    fdb = getFirestore(adminApp, firebaseConfig.firestoreDatabaseId);
    console.log("🔥 Firebase Admin SDK initialized successfully with Firestore database:", firebaseConfig.firestoreDatabaseId);
  } else {
    console.warn("⚠️ Warning: firebase-applet-config.json is missing. Running in local filesystem mode.");
  }
} catch (error) {
  console.error("❌ Failed to initialize Firebase Admin SDK:", error);
}

// Sync complete array with a Firestore collection, handling Add, Update, and Delete.
async function syncCollection(colName: string, items: any[]) {
  if (!fdb) return;
  try {
    const colRef = fdb.collection(colName);
    
    // 1. Get current document IDs in Firestore
    const snapshot = await colRef.get();
    const existingIds = snapshot.docs.map((doc: any) => doc.id);
    
    // 2. Map posted items
    const postedIds = new Set(items.map((item: any) => item && item.id).filter(Boolean));
    
    // 3. Delete items no longer present
    const deletePromises = existingIds
      .filter((id: string) => !postedIds.has(id))
      .map((id: string) => colRef.doc(id).delete());
      
    // 4. Save/update existing items
    const writePromises = items.map((item: any) => {
      if (!item || !item.id) return Promise.resolve();
      return colRef.doc(item.id).set(item);
    });
    
    await Promise.all([...deletePromises, ...writePromises]);
  } catch (error) {
    console.error(`Error syncing collection ${colName} to Firestore:`, error);
  }
}

// Sync configuration fields in a single document
async function syncConfig(configData: any) {
  if (!fdb) return;
  try {
    const docRef = fdb.collection("config").doc("system");
    await docRef.set(configData);
  } catch (error) {
    console.error("Error syncing configs to Firestore:", error);
  }
}

// Bulk loads complete store from Firestore
async function loadFromFirestore(): Promise<any> {
  if (!fdb) return null;
  const store: any = {
    suppliers: [],
    invoices: [],
    payments: [],
    backups: [],
    supplierCategories: [],
    warehouses: [],
    linkedBanks: [],
    safeBalance: 0,
    creditNotes: []
  };

  try {
    const [suppliersSnap, invoicesSnap, paymentsSnap, backupsSnap, creditNotesSnap, configSnap] = await Promise.all([
      fdb.collection("suppliers").get(),
      fdb.collection("invoices").get(),
      fdb.collection("payments").get(),
      fdb.collection("backups").get(),
      fdb.collection("creditNotes").get(),
      fdb.collection("config").doc("system").get()
    ]);

    store.suppliers = suppliersSnap.docs.map((doc: any) => doc.data());
    store.invoices = invoicesSnap.docs.map((doc: any) => doc.data());
    store.payments = paymentsSnap.docs.map((doc: any) => doc.data());
    store.backups = backupsSnap.docs.map((doc: any) => doc.data());
    store.creditNotes = creditNotesSnap.docs.map((doc: any) => doc.data());

    if (configSnap.exists) {
      const configData = configSnap.data() || {};
      if (Array.isArray(configData.supplierCategories)) store.supplierCategories = configData.supplierCategories;
      if (Array.isArray(configData.warehouses)) store.warehouses = configData.warehouses;
      if (Array.isArray(configData.linkedBanks)) store.linkedBanks = configData.linkedBanks;
      if (typeof configData.safeBalance === "number") store.safeBalance = configData.safeBalance;
    }

    return store;
  } catch (error) {
    console.error("Error loading data from Firestore:", error);
    return null;
  }
}

// Bulk saves store state to Firestore
async function saveToFirestore(data: any) {
  if (!fdb || !data) return;
  try {
    await Promise.all([
      syncCollection("suppliers", data.suppliers || []),
      syncCollection("invoices", data.invoices || []),
      syncCollection("payments", data.payments || []),
      syncCollection("backups", data.backups || []),
      syncCollection("creditNotes", data.creditNotes || [])
    ]);

    await syncConfig({
      supplierCategories: data.supplierCategories || [],
      warehouses: data.warehouses || [],
      linkedBanks: data.linkedBanks || [],
      safeBalance: typeof data.safeBalance === "number" ? data.safeBalance : 0
    });
    console.log("🔥 Successfully synchronized all local changes to permanent Firestore.");
  } catch (error) {
    console.error("❌ Failed to synchronize changes to Firestore:", error);
    throw error;
  }
}

// Initial seed and load check
async function initializeDataStore() {
  if (!fdb) {
    console.log("No Firestore available. Running solely on local filesystem caching.");
    return;
  }
  try {
    console.log("Starting Firestore database reconciliation...");
    const storeFromDb = await loadFromFirestore();
    
    const hasData = storeFromDb && (
      storeFromDb.suppliers.length > 0 ||
      storeFromDb.invoices.length > 0 ||
      storeFromDb.supplierCategories.length > 0
    );

    if (hasData) {
      console.log("Existing permanent data found in Firestore. Synchronizing local cache...");
      fs.writeFileSync(STORE_FILE, JSON.stringify(storeFromDb, null, 2), "utf-8");
    } else {
      console.log("Firestore is empty. Checking for local migration data...");
      if (fs.existsSync(STORE_FILE)) {
        const localDataStr = fs.readFileSync(STORE_FILE, "utf-8");
        const localData = JSON.parse(localDataStr);
        console.log("Migrating current local data_store.json to Firestore...");
        await saveToFirestore(localData);
        console.log("Migration complete!");
      } else {
        console.log("Initializing first-time pristine defaults to Firestore...");
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
        await saveToFirestore(pristineState);
        fs.writeFileSync(STORE_FILE, JSON.stringify(pristineState, null, 2), "utf-8");
      }
    }
  } catch (error) {
    console.error("Error during Firestore datastore reconciliation:", error);
  }
}

// Reconcile on app launch
initializeDataStore();

// API endpoint to retrieve stored data
app.get("/api/get-store", (req, res) => {
  try {
    if (fs.existsSync(STORE_FILE)) {
      const dataStr = fs.readFileSync(STORE_FILE, "utf-8");
      const data = JSON.parse(dataStr);
      return res.json(data);
    }
    return res.status(404).json({ message: "No stored data exists yet." });
  } catch (error: any) {
    console.error("Error reading data store file:", error);
    return res.status(500).json({ error: "Failed to read storage." });
  }
});

// API endpoint to write stored data
app.post("/api/save-store", async (req, res) => {
  try {
    const data = req.body;
    // Save to local cache instantly
    fs.writeFileSync(STORE_FILE, JSON.stringify(data, null, 2), "utf-8");
    
    // Save to permanent Firestore asynchronously/synchronously
    if (fdb) {
      await saveToFirestore(data);
    }
    
    return res.json({ success: true, message: "Data saved successfully on server and persisted to Firestore." });
  } catch (error: any) {
    console.error("Error writing data store file:", error);
    return res.status(500).json({ error: "Failed to persist storage in Firestore database." });
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
