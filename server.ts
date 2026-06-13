import express from "express";
import path from "path";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import pg from "pg";

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ limit: "100mb", extended: true }));

const STORE_FILE = path.join(process.cwd(), "data_store.json");

// Initialize PostgreSQL client pool to persist store permanently
let dbPool: pg.Pool | null = null;
let isPostgresActive = false;
let lastPostgresError: string | null = null;

try {
  let connectionString = (process.env.DATABASE_URL || "").trim();
  if (!connectionString || connectionString.includes("MY_DATABASE_URL")) {
    connectionString = "postgresql://neondb_owner:npg_Bm3sWhS7QRjE@ep-polished-firefly-atulc8ab.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require";
  }
  
  dbPool = new pg.Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: false
    },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  dbPool.on("error", (err) => {
    console.error("🐘 Unexpected error on idle client:", err);
    lastPostgresError = err?.message || String(err);
  });

  console.log("🐘 PostgreSQL Pool successfully created.");
} catch (error: any) {
  console.error("❌ Failed to initialize PostgreSQL Pool:", error);
  lastPostgresError = error?.message || String(error);
}

// Check connection and ensure table exists
async function initializePostgres() {
  if (!dbPool) {
    lastPostgresError = "PostgreSQL Pool is uninitialized or config is bad.";
    return;
  }
  try {
    const probe = await dbPool.query("SELECT NOW()");
    console.log("✅ Successfully reached PostgreSQL database:", probe.rows[0]);
    
    // Create the system_store table if not present
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS system_store (
        id VARCHAR(50) PRIMARY KEY,
        data TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("✅ verified table structure in PostgreSQL 'system_store'.");
    isPostgresActive = true;
    lastPostgresError = null;
  } catch (error: any) {
    console.error("⚠️ Failed to verify or run query against PostgreSQL. Sticking to server cache file:", error);
    lastPostgresError = error?.message || String(error);
    isPostgresActive = false;
  }
}

// Bulk loads complete store from PostgreSQL
async function loadFromPostgres(): Promise<any> {
  if (!dbPool || !isPostgresActive) return null;
  try {
    const res = await dbPool.query("SELECT data FROM system_store WHERE id = 'main_store'");
    if (res.rows.length > 0) {
      return JSON.parse(res.rows[0].data);
    }
    return null;
  } catch (error) {
    console.error("Error loading data from PostgreSQL:", error);
    return null;
  }
}

// Bulk saves store state to PostgreSQL
async function saveToPostgres(data: any) {
  if (!dbPool || !data) return;
  try {
    const dataStr = JSON.stringify(data);
    await dbPool.query(`
      INSERT INTO system_store (id, data, updated_at)
      VALUES ('main_store', $1, CURRENT_TIMESTAMP)
      ON CONFLICT (id)
      DO UPDATE SET data = $1, updated_at = CURRENT_TIMESTAMP
    `, [dataStr]);
    console.log("🐘 Successfully synchronized all local changes to permanent PostgreSQL.");
    isPostgresActive = true;
    lastPostgresError = null;
  } catch (error: any) {
    console.error("❌ Failed to synchronize changes to PostgreSQL:", error);
    isPostgresActive = false;
    lastPostgresError = error?.message || String(error);
  }
}

// Initial seed and load check
async function initializeDataStore() {
  await initializePostgres();

  if (!isPostgresActive) {
    console.log("No PostgreSQL database connection active. Running solely on local filesystem caching.");
    return;
  }

  try {
    console.log("Starting PostgreSQL database reconciliation...");
    const storeFromDb = await loadFromPostgres();
    
    const hasData = storeFromDb && (
      (Array.isArray(storeFromDb.suppliers) && storeFromDb.suppliers.length > 0) ||
      (Array.isArray(storeFromDb.invoices) && storeFromDb.invoices.length > 0) ||
      (Array.isArray(storeFromDb.supplierCategories) && storeFromDb.supplierCategories.length > 0)
    );

    if (hasData) {
      console.log("Existing permanent data found in PostgreSQL. Synchronizing local cache...");
      fs.writeFileSync(STORE_FILE, JSON.stringify(storeFromDb, null, 2), "utf-8");
    } else {
      console.log("PostgreSQL is empty. Checking for local migration data...");
      if (fs.existsSync(STORE_FILE)) {
        const localDataStr = fs.readFileSync(STORE_FILE, "utf-8");
        const localData = JSON.parse(localDataStr);
        console.log("Migrating current local data_store.json to PostgreSQL...");
        await saveToPostgres(localData);
        console.log("Migration complete!");
      } else {
        console.log("Initializing first-time pristine defaults to PostgreSQL...");
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
        await saveToPostgres(pristineState);
        fs.writeFileSync(STORE_FILE, JSON.stringify(pristineState, null, 2), "utf-8");
      }
    }
  } catch (error) {
    console.error("Error during PostgreSQL datastore reconciliation:", error);
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
      // Append database status and connection error
      return res.json({ 
        ...data, 
        postgresActive: isPostgresActive,
        postgresError: lastPostgresError 
      });
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
    // Save to local cache instantly (reliable container disk backup)
    fs.writeFileSync(STORE_FILE, JSON.stringify(data, null, 2), "utf-8");
    
    // Always attempt to save to permanent PostgreSQL (it is internally safe and non-blocking)
    await saveToPostgres(data);
    
    return res.json({ 
      success: true, 
      message: "Data saved successfully on local server and attempted PostgreSQL synchronization.",
      postgresActive: isPostgresActive,
      postgresError: lastPostgresError
    });
  } catch (error: any) {
    console.error("Critical error in save-store endpoint:", error);
    return res.status(500).json({ error: "Failed to persist storage locally on server." });
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
