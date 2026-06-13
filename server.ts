import express from "express";
import path from "path";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import pg from "pg";

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

// PostgreSQL database features deactivated as explicitly requested.
// The system now operates 100% on the internal data_store.json cache, which is ultra-stable, secure, with zero connection overhead.
let isPostgresActive = false;
let lastPostgresError: string | null = null;

async function createPoolAndConnect(forceRecreate = false) {
  console.log("🔌 PostgreSQL initialization bypassed. Running strictly in local file mode.");
}

async function initializePostgres(forceRecreate = false) {
  isPostgresActive = false;
  lastPostgresError = null;
  console.log("🔌 PostgreSQL is deactivated. Using file-based storage data_store.json.");
}

async function loadFromPostgres(): Promise<any> {
  return null;
}

async function saveToPostgres(data: any) {
  // No-op
}

async function initializeDataStore() {
  console.log("🔌 System Initializing in Local-Only Persistence Mode...");
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
      console.log("✅ Local data_store.json detected and loaded successfully.");
    }
  } catch (error) {
    console.error("Error during Datastore initialization:", error);
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
      return res.json({ 
        ...data, 
        postgresActive: false,
        postgresError: null 
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
      postgresActive: false,
      postgresError: null
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
    fs.writeFileSync(STORE_FILE, JSON.stringify(data, null, 2), "utf-8");
    return res.json({ 
      success: true, 
      message: "Data saved successfully on local secure server file system.",
      postgresActive: false,
      postgresError: null
    });
  } catch (error: any) {
    console.error("Critical error in save-store endpoint:", error);
    return res.status(500).json({ error: "Failed to persist storage locally on server." });
  }
});

// API endpoint to manually request database reconnection and verify status
app.post("/api/reconnect-db", async (req, res) => {
  try {
    return res.json({
      success: true,
      postgresActive: false,
      postgresError: null,
      message: "تم إلغاء تفعيل قاعدة البيانات الخارجية ونظامك يعمل الآن بالكامل في الوضع المحلي الفائق الآمن والمستقر وصفر الأخطاء!"
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      postgresActive: false,
      postgresError: null,
      message: "فشل: " + String(err)
    });
  }
});

// API endpoint to completely reset the connection and clear/reinitialize the database back to clean defaults
app.post("/api/reset-db", async (req, res) => {
  try {
    console.log("🚨 Client-requested full local data store reset...");
    
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

    return res.json({
      success: true,
      postgresActive: false,
      postgresError: null,
      message: "تمت إعادة ضبط وتصفير النظام المحلي بالكامل وحذف كافة الفواتير والمعاملات بنجاح!"
    });
  } catch (err: any) {
    console.error("❌ Critical error during local file reset:", err);
    return res.status(500).json({
      success: false,
      postgresActive: false,
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
