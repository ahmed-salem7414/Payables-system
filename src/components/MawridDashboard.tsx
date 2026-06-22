/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import {
  Users,
  Receipt,
  CreditCard,
  Bell,
  FileText,
  Database,
  MessageSquare,
  ShieldAlert,
  Plus,
  Trash2,
  Download,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  TrendingUp,
  Building,
  Check,
  Key,
  Upload,
  Activity,
  UserCheck,
  Send,
  Printer,
  Shield,
  ChevronLeft,
  HelpCircle,
  Save,
  Edit,
  Search,
  Wallet,
  Warehouse,
  FileSpreadsheet,
  Paperclip,
  Image,
  Cloud,
  CloudLightning,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from "recharts";

import {
  Supplier,
  Invoice,
  Payment,
  BackupRecord,
  UserRole,
  BankConfig,
  SupportMessage,
  CreditNote,
} from "../types";
import {
  INITIAL_SUPPLIERS,
  INITIAL_INVOICES,
  INITIAL_PAYMENTS,
  INITIAL_BACKUPS,
  LOCAL_BANKS_SELECTION,
} from "../data";
import { MersalLogo } from "./MersalLogo";
import {
  testConnection,
  loadFromUserFirestore,
  saveToUserFirestore,
  initAuthListener,
  googleSignIn,
  googleSignOut,
} from "../firebase";

const fAmt = (val: number | undefined | null): string => {
  if (val === undefined || val === null) return "0.00";
  const rounded = Math.round(val * 100) / 100;
  return rounded.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export default function MawridDashboard() {
  // Application State
  const [suppliers, setSuppliers] = useState<Supplier[]>(() => {
    const saved = localStorage.getItem("mawrid_suppliers");
    return saved ? JSON.parse(saved) : INITIAL_SUPPLIERS;
  });

  const [invoices, setInvoices] = useState<Invoice[]>(() => {
    const saved = localStorage.getItem("mawrid_invoices");
    return saved ? JSON.parse(saved) : INITIAL_INVOICES;
  });

  const [payments, setPayments] = useState<Payment[]>(() => {
    const saved = localStorage.getItem("mawrid_payments");
    return saved ? JSON.parse(saved) : INITIAL_PAYMENTS;
  });

  const [backups, setBackups] = useState<BackupRecord[]>(() => {
    const saved = localStorage.getItem("mawrid_backups");
    return saved ? JSON.parse(saved) : INITIAL_BACKUPS;
  });

  // Current Active User Context & Permissions Role
  const [currentRole, setCurrentRole] = useState<UserRole>(() => {
    const saved = localStorage.getItem("mawrid_user_role");
    return (saved as UserRole) || UserRole.ADMIN;
  });

  // Navigation state
  const [activeTab, setActiveTab] = useState<string>("suppliers");

  // Notifications toggle and state
  const [showNotifications, setShowNotifications] = useState(false);
  const [alerts, setAlerts] = useState<string[]>([]);

  // Google Drive Integration States
  const [gdriveUser, setGdriveUser] = useState<any>(null);
  const [gdriveToken, setGdriveToken] = useState<string | null>(null);
  const [driveBackups, setDriveBackups] = useState<any[]>([]);
  const [isDriveLoading, setIsDriveLoading] = useState(false);
  const [isSignDriveLoading, setIsSignDriveLoading] = useState(false);
  const [autoBackupFreq, setAutoBackupFreq] = useState<string>(() => {
    return localStorage.getItem("mawrid_auto_backup_freq") || "daily";
  });
  const [lastBackupTime, setLastBackupTime] = useState<number>(() => {
    const saved = localStorage.getItem("mawrid_last_backup_time");
    return saved ? Number(saved) : 0;
  });
  const [isSilentBackupRunning, setIsSilentBackupRunning] = useState(false);

  useEffect(() => {
    const unsubscribe = initAuthListener(
      (user, token) => {
        setGdriveUser(user);
        setGdriveToken(token);
        handleListBackupsFromDrive(token);
      },
      () => {
        setGdriveUser(null);
        setGdriveToken(null);
        setDriveBackups([]);
      }
    );
    
    // Capture successful authentication message from the popup helper of the same origin
    const handleAuthMessage = (event: MessageEvent) => {
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost')) {
        return;
      }
      
      if (event.data?.type === "GOOGLE_AUTH_SUCCESS") {
        const { user, accessToken } = event.data;
        setGdriveUser(user);
        setGdriveToken(accessToken);
        handleListBackupsFromDrive(accessToken);
        showToast("تم ربط حساب Google Drive بنجاح!", "success");
        setIsSignDriveLoading(false);
      }
    };

    // Check localStorage for successful auth transfers (e.g., when popup completes via redirect)
    const checkLocalStorageAuth = () => {
      try {
        const raw = localStorage.getItem("mawrid_gdrive_auth");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.accessToken && (Date.now() - parsed.timestamp < 300000)) {
            setGdriveUser(parsed.user);
            setGdriveToken(parsed.accessToken);
            handleListBackupsFromDrive(parsed.accessToken);
            showToast("تم ربط حساب Google Drive بنجاح!", "success");
            setIsSignDriveLoading(false);
            
            // Clear storage to prevent repeat notifications
            localStorage.removeItem("mawrid_gdrive_auth");
          }
        }
      } catch (e) {
        console.error("Local storage auth reading failed:", e);
      }
    };

    // Run checks
    checkLocalStorageAuth();
    
    window.addEventListener("message", handleAuthMessage);
    window.addEventListener("focus", checkLocalStorageAuth);
    document.addEventListener("visibilitychange", checkLocalStorageAuth);
    
    return () => {
      unsubscribe();
      window.removeEventListener("message", handleAuthMessage);
      window.removeEventListener("focus", checkLocalStorageAuth);
      document.removeEventListener("visibilitychange", checkLocalStorageAuth);
    };
  }, []);

  const handleGoogleSignIn = () => {
    setIsSignDriveLoading(true);
    
    const width = 600;
    const height = 700;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;
    
    const popup = window.open(
      "/?auth-helper=true",
      "MawridGoogleAuthGate",
      `width=${width},height=${height},top=${top},left=${left},scrollbars=yes,status=yes`
    );
    
    if (!popup) {
      showToast("عذراً، تم حظر النافذة المنبثقة من قبل متصفحك! يرجى الاستمرار بالنقر والسماح بفتح النوافذ المنبثقة ليرتبط حسابك بنجاح.", "error");
      setIsSignDriveLoading(false);
      return;
    }
    
    // Fallback scanner to reset loading mode when popup closes
    const closeCheckInterval = setInterval(() => {
      if (popup.closed) {
        clearInterval(closeCheckInterval);
        setIsSignDriveLoading(false);
      }
    }, 1000);
  };

  const handleGoogleSignOut = async () => {
    const confirmed = window.confirm("هل ترغب في تسجيل الخروج وإلغاء ربط حساب Google Drive؟");
    if (!confirmed) return;
    try {
      await googleSignOut();
      setGdriveUser(null);
      setGdriveToken(null);
      setDriveBackups([]);
      showToast("تم تسجيل الخروج وإلغاء الربط بنجاح.", "success");
    } catch (err) {
      console.error(err);
    }
  };

  const handleListBackupsFromDrive = async (token = gdriveToken) => {
    const activeTok = token || gdriveToken;
    if (!activeTok) return;
    try {
      setIsDriveLoading(true);
      const query = encodeURIComponent("name contains 'Mawrid_Backup' and trashed = false");
      const fields = encodeURIComponent("files(id, name, createdTime, size)");
      const orderBy = encodeURIComponent("createdTime desc");
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${query}&fields=${fields}&orderBy=${orderBy}`,
        {
          headers: { Authorization: `Bearer ${activeTok}` },
        }
      );
      if (res.ok) {
        const data = await res.json();
        setDriveBackups(data.files || []);
      } else {
        const errText = await res.text().catch(() => "");
        console.error("Failed to fetch Google Drive backups:", res.status, errText);
        showToast(`فشل استرجاع النسخ الاحتياطية من Drive: الكود ${res.status}`, "error");
      }
    } catch (err: any) {
      console.error("Error listing backups:", err);
      showToast(`حدث خطأ أثناء تحميل ملفات Drive: ${err.message || err}`, "error");
    } finally {
      setIsDriveLoading(false);
    }
  };

  const handleSilentUploadBackupToDrive = async (token = gdriveToken) => {
    const activeTok = token || gdriveToken;
    if (!activeTok) return;
    try {
      setIsSilentBackupRunning(true);
      const fullBackup = {
        suppliers,
        invoices,
        payments,
        backups,
        creditNotes,
        supplierCategories,
        warehouses,
        linkedBanks,
        safeBalance,
        timestamp: Date.now(),
        v: "3.2",
      };
      const fileContent = JSON.stringify(fullBackup, null, 2);
      const filename = `Mawrid_Backup_Auto_${new Date().toISOString().split("T")[0]}_${Date.now()}.json`;

      const boundary = "mawrid_backup_boundary";
      const delimiter = `\r\n--${boundary}\r\n`;
      const close_delim = `\r\n--${boundary}--`;

      const metadata = {
        name: filename,
        mimeType: "application/json",
        description: "Mawrid System Automatic Backup File",
      };

      const multipartRequestBody =
        delimiter +
        "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
        JSON.stringify(metadata) +
        delimiter +
        "Content-Type: application/json\r\n\r\n" +
        fileContent +
        close_delim;

      const response = await fetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${activeTok}`,
            "Content-Type": `multipart/related; boundary=${boundary}`,
          },
          body: multipartRequestBody,
        }
      );

      if (response.ok) {
        const now = Date.now();
        setLastBackupTime(now);
        localStorage.setItem("mawrid_last_backup_time", String(now));
        showToast("تم إجراء نسخ احتياطي تلقائي بنجاح على Google Drive!", "success");
        handleListBackupsFromDrive(activeTok);
      } else {
        console.error("GDrive silent upload error:", await response.text().catch(() => ""));
      }
    } catch (err) {
      console.error("Silent backup upload failed:", err);
    } finally {
      setIsSilentBackupRunning(false);
    }
  };

  // WhatsApp-like Auto Backup Trigger Effect
  useEffect(() => {
    if (!gdriveToken || autoBackupFreq === "off") return;

    const intervalMs =
      autoBackupFreq === "daily" ? 24 * 60 * 60 * 1000 :
      autoBackupFreq === "weekly" ? 7 * 24 * 60 * 60 * 1000 :
      autoBackupFreq === "monthly" ? 30 * 24 * 60 * 60 * 1000 :
      0;

    if (intervalMs === 0) return;

    const timePassed = Date.now() - lastBackupTime;
    if (timePassed >= intervalMs || lastBackupTime === 0) {
      console.log("Auto-backup is due. Running silently in the background...");
      handleSilentUploadBackupToDrive(gdriveToken);
    }
  }, [gdriveToken, autoBackupFreq]);

  const handleUploadBackupToDrive = async () => {
    if (!gdriveToken) {
      showToast("يرجى ربط حساب Google Drive أولاً.", "error");
      return;
    }
    const confirmed = window.confirm("هل ترغب في رفع نسخة احتياطية جديدة الآن إلى حسابك على Google Drive؟");
    if (!confirmed) return;

    try {
      setIsDriveLoading(true);
      const fullBackup = {
        suppliers,
        invoices,
        payments,
        backups,
        creditNotes,
        supplierCategories,
        warehouses,
        linkedBanks,
        safeBalance,
        timestamp: Date.now(),
        v: "3.2",
      };
      const fileContent = JSON.stringify(fullBackup, null, 2);
      const filename = `Mawrid_Backup_${new Date().toISOString().split("T")[0]}_${Date.now()}.json`;

      const boundary = "mawrid_backup_boundary";
      const delimiter = `\r\n--${boundary}\r\n`;
      const close_delim = `\r\n--${boundary}--`;

      const metadata = {
        name: filename,
        mimeType: "application/json",
        description: "Mawrid Supplier Management System Backup File",
      };

      const multipartRequestBody =
        delimiter +
        "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
        JSON.stringify(metadata) +
        delimiter +
        "Content-Type: application/json\r\n\r\n" +
        fileContent +
        close_delim;

      const response = await fetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${gdriveToken}`,
            "Content-Type": `multipart/related; boundary=${boundary}`,
          },
          body: multipartRequestBody,
        }
      );

      if (response.ok) {
        const now = Date.now();
        setLastBackupTime(now);
        localStorage.setItem("mawrid_last_backup_time", String(now));
        showToast("تم رفع النسخة الاحتياطية بنجاح إلى Google Drive!", "success");
        handleListBackupsFromDrive(gdriveToken);
      } else {
        const errText = await response.text();
         console.error("GDrive upload error:", errText);
         showToast("فشل رفع النسخة الاحتياطية لـ Google Drive.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("حدث خطأ أثناء الاتصال بجوجل درايف.", "error");
    } finally {
      setIsDriveLoading(false);
    }
  };

  const handleRestoreFromDriveFile = async (fileId: string, fileName: string) => {
    if (!gdriveToken) return;
    const confirmed = window.confirm(
      `هل أنت متأكد من استعادة قاعدة البيانات من النسخة [${fileName}]؟ سيتم استبدال جميع البيانات الحالية بالكامل.`
    );
    if (!confirmed) return;

    try {
      setIsDriveLoading(true);
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        {
          headers: { Authorization: `Bearer ${gdriveToken}` },
        }
      );
      if (res.ok) {
        const backupData = await res.json();
        if (backupData.suppliers && backupData.invoices) {
          setSuppliers(backupData.suppliers || []);
          setInvoices(backupData.invoices || []);
          setPayments(backupData.payments || []);
          setBackups(backupData.backups || []);
          setCreditNotes(backupData.creditNotes || []);
          if (backupData.supplierCategories) setSupplierCategories(backupData.supplierCategories);
          if (backupData.warehouses) setWarehouses(backupData.warehouses);
          if (backupData.linkedBanks) setLinkedBanks(backupData.linkedBanks);
          if (typeof backupData.safeBalance === "number") setSafeBalance(backupData.safeBalance);

          // Save to localStorage as well
          localStorage.setItem("mawrid_suppliers", JSON.stringify(backupData.suppliers || []));
          localStorage.setItem("mawrid_invoices", JSON.stringify(backupData.invoices || []));
          localStorage.setItem("mawrid_payments", JSON.stringify(backupData.payments || []));
          localStorage.setItem("mawrid_backups", JSON.stringify(backupData.backups || []));
          localStorage.setItem("mawrid_creditNotes", JSON.stringify(backupData.creditNotes || []));
          localStorage.setItem("mawrid_supplier_categories", JSON.stringify(backupData.supplierCategories || []));
          localStorage.setItem("mawrid_warehouses", JSON.stringify(backupData.warehouses || []));
          localStorage.setItem("mawrid_linked_banks", JSON.stringify(backupData.linkedBanks || []));
          localStorage.setItem("mawrid_safe_balance", String(backupData.safeBalance || 0));

          showToast("تم استيراد واستعادة قاعدة البيانات من Google Drive بنجاح!", "success");
        } else {
          showToast("الملف المختار غير صالح أو يحتوي على بنية غير مطابقة.", "error");
        }
      } else {
        showToast("فشل تحميل البيانات من Google Drive.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("خطأ أثناء استعادة البيانات.", "error");
    } finally {
      setIsDriveLoading(false);
    }
  };

  const handleDeleteDriveFile = async (fileId: string, fileName: string) => {
    if (!gdriveToken) return;
    const confirmed = window.confirm(
      `هل تريد بالتأكيد حذف الملف [${fileName}] من حساب Google Drive الخاص بك نهائياً؟`
    );
    if (!confirmed) return;

    try {
      setIsDriveLoading(true);
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${gdriveToken}` },
        }
      );
      if (res.ok) {
        showToast("تم حذف النسخة الاحتياطية من Google Drive بنجاح.", "success");
        handleListBackupsFromDrive(gdriveToken);
      } else {
        showToast("فشل حذف النسخة الاحتياطية من Google Drive.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("خطأ أثناء حذف الملف.", "error");
    } finally {
      setIsDriveLoading(false);
    }
  };

  // Search and Filter States
  const [supplierSearch, setSupplierSearch] = useState("");
  const [supplierCategories, setSupplierCategories] = useState<string[]>(() => {
    const saved = localStorage.getItem("mawrid_supplier_categories");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        // fallback
      }
    }
    return [
      "تجهيزات ومستلزمات",
      "شحن ولوجستيات",
      "خدمات مكتبية وتكنولوجيا",
      "تعبئة وتغليف",
    ];
  });

  useEffect(() => {
    localStorage.setItem(
      "mawrid_supplier_categories",
      JSON.stringify(supplierCategories),
    );
  }, [supplierCategories]);

  const [warehouses, setWarehouses] = useState<string[]>(() => {
    const saved = localStorage.getItem("mawrid_warehouses");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        // fallback
      }
    }
    return [
      "مخازن أكتوبر الرئيسية",
      "مستودع العبور لتجهيز الخامات",
      "مخزن الإسكندرية المينائي",
      "مخازن العاشر من رمضان",
    ];
  });

  useEffect(() => {
    localStorage.setItem("mawrid_warehouses", JSON.stringify(warehouses));
  }, [warehouses]);

  const [supplierCategoryFilter, setSupplierCategoryFilter] = useState("all");
  const [selectedSupplierInvoiceFilter, setSelectedSupplierInvoiceFilter] =
    useState<string>("");
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState("all");
  const [invoiceTypeFilter, setInvoiceTypeFilter] = useState<
    "all" | "invoices" | "credit_notes"
  >("all");

  // Selected Report Parameters
  const [reportStartDate, setReportStartDate] = useState<string>("2026-04-01");
  const [reportEndDate, setReportEndDate] = useState<string>("2026-06-30");
  const [selectedReportSupplierId, setSelectedReportSupplierId] =
    useState<string>("all");
  const [reportWarehouseFilter, setReportWarehouseFilter] =
    useState<string>("all");
  const [reportDateType, setReportDateType] = useState<
    "issue_date" | "due_date"
  >("issue_date");
  const [reportViewType, setReportViewType] = useState<
    "detailed" | "summary" | "aging"
  >("detailed");
  const [activeReportPage, setActiveReportPage] = useState<number>(0);
  const [reportOrientation, setReportOrientation] = useState<"portrait" | "landscape">(
    "portrait",
  );

  // Attachment upload states
  const [invoiceAttachment, setInvoiceAttachment] = useState<{
    name: string;
    type: string;
    dataUrl: string;
  } | null>(null);
  const [invoiceAttachments, setInvoiceAttachments] = useState<
    Array<{ name: string; type: string; dataUrl: string }>
  >([]);
  const [cnAttachment, setCnAttachment] = useState<{
    name: string;
    type: string;
    dataUrl: string;
  } | null>(null);
  const [previewAttachment, setPreviewAttachment] = useState<{
    name: string;
    type: string;
    dataUrl: string;
  } | null>(null);
  const [previewAttachmentList, setPreviewAttachmentList] = useState<
    Array<{ name: string; type: string; dataUrl: string }>
  >([]);

  // New Invoice itemized discount state
  const [invoiceBaseAmount, setInvoiceBaseAmount] = useState<number>(0);
  const [discounts, setDiscounts] = useState<
    Array<{ name: string; price: number }>
  >([]);
  const [editInvoiceBaseAmount, setEditInvoiceBaseAmount] = useState<number>(0);
  const [editDiscounts, setEditDiscounts] = useState<
    Array<{ name: string; price: number }>
  >([]);
  const [aiReportSummary, setAiReportSummary] = useState<string>("");
  const [isGeneratingAiSummary, setIsGeneratingAiSummary] = useState(false);

  // Bank integrations state
  const [linkedBanks, setLinkedBanks] = useState<BankConfig[]>(() => {
    const saved = localStorage.getItem("mawrid_linked_banks");
    if (saved) return JSON.parse(saved);
    return LOCAL_BANKS_SELECTION.map((b) => ({
      bankName: b.name,
      accountNumber:
        "EGXX-XXXX-XXXX-" + Math.floor(1000 + Math.random() * 9000),
      apiKey: "••••••••••••••••••••",
      isLinked: b.id === "bme", // Pre-link National / Banque Misr
    }));
  });

  // Safe / Cash Cabinet Balance States
  const [safeBalance, setSafeBalance] = useState<number>(() => {
    const saved = localStorage.getItem("mawrid_safe_balance");
    if (saved) return Number(saved);
    return 1500000; // Default 1.5 Million EGP
  });

  useEffect(() => {
    localStorage.setItem("mawrid_safe_balance", safeBalance.toString());
  }, [safeBalance]);

  const [showSafeDepositModal, setShowSafeDepositModal] = useState(false);
  const [safeDepositAmount, setSafeDepositAmount] = useState<number>(100000);

  // New settlement modal states
  const [showSettleInvoiceModal, setShowSettleInvoiceModal] = useState(false);
  const [invoiceToSettle, setInvoiceToSettle] = useState<Invoice | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<
    "bank_transfer" | "cash"
  >("bank_transfer");
  const [selectedPaymentBank, setSelectedPaymentBank] = useState<string>("");

  useEffect(() => {
    const activeBank = linkedBanks.find((b) => b.isLinked);
    if (activeBank) {
      setSelectedPaymentBank(activeBank.bankName);
    }
  }, [linkedBanks]);

  // Local settlement simulator terminal state
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] =
    useState<Invoice | null>(null);
  const [paymentGatewayBank, setPaymentGatewayBank] = useState(
    LOCAL_BANKS_SELECTION[0].name,
  );
  const [settlementLogs, setSettlementLogs] = useState<string[]>([]);
  const [isSettlingProcess, setIsSettlingProcess] = useState(false);
  const [settlementProgress, setSettlementProgress] = useState(0);

  // Add Modals states
  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);
  const [showAddInvoiceModal, setShowAddInvoiceModal] = useState(false);
  const [showAddWarehouseModal, setShowAddWarehouseModal] = useState(false);
  const [addWarehouseContext, setAddWarehouseContext] = useState<"new" | "edit" | null>(null);
  const [newWarehouseName, setNewWarehouseName] = useState("");

  // Delete Confirmation modals states
  const [supplierToDelete, setSupplierToDelete] = useState<{ id: string; name: string } | null>(null);
  const [warehouseToDelete, setWarehouseToDelete] = useState<{ name: string; invoicesCount: number } | null>(null);

  // New Supplier form state
  const [newSupplier, setNewSupplier] = useState<
    Omit<Supplier, "id" | "createdAt">
  >({
    name: "",
    company: "",
    phone: "",
    email: "",
    bankAccount: "",
    category: "تجهيزات ومستلزمات",
    address: "",
    notes: "",
  });

  // New Invoice form state
  const [newInvoice, setNewInvoice] = useState({
    supplierId: "",
    invoiceNumber: "",
    issueDate: new Date().toISOString().split("T")[0],
    dueDate: "",
    notes: "",
    items: [{ name: "بند شحنة", quantity: 1, price: 0 }],
    vatRate: 14,
    isCustomVat: false,
    customVatAmount: 0,
    warehouse: "",
  });

  // Edit Invoice form state
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);

  // Credit Note inside Edit Invoice Modal State
  const [showEditInvoiceCNSection, setShowEditInvoiceCNSection] =
    useState(false);
  const [editInvoiceCNData, setEditInvoiceCNData] = useState({
    creditNoteNumber: "",
    issueDate: "2026-06-07",
    dueDate: "",
    notes: "",
    items: [{ name: "بند إشعار", quantity: 1, price: 0 }],
  });

  useEffect(() => {
    if (editingInvoice) {
      setShowEditInvoiceCNSection(false);
      const randomID = Math.floor(1000 + Math.random() * 9000);
      setEditInvoiceCNData({
        creditNoteNumber: `CN-${editingInvoice.invoiceNumber}-${randomID}`,
        issueDate: new Date().toISOString().split("T")[0],
        dueDate: editingInvoice.dueDate || "",
        notes: `مرتجع / خصم مرتبط بالفاتورة رقم ${editingInvoice.invoiceNumber}`,
        items: [{ name: "مرتجع بضائع بالفاتورة", quantity: 1, price: 0 }],
      });
    }
  }, [editingInvoice]);

  // Edit Supplier form state
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  // Edit Credit Note states
  const [editingCreditNote, setEditingCreditNote] = useState<CreditNote | null>(
    null,
  );
  const [showEditCreditNoteModal, setShowEditCreditNoteModal] = useState(false);

  // Credit Notes state
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>(() => {
    const saved = localStorage.getItem("mawrid_credit_notes");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((cn: any) => ({
          ...cn,
          items: cn.items || [
            {
              name: cn.notes || "بند الإشعار دائن",
              quantity: 1,
              price: cn.amount,
            },
          ],
          dueDate: cn.dueDate || cn.issueDate || "2026-06-22",
        }));
      } catch (e) {
        // fallback
      }
    }
    return [
      {
        id: "cn-1",
        creditNoteNumber: "CN-2026-001",
        supplierId: "sup-1",
        amount: 25000,
        issueDate: "2026-05-15",
        dueDate: "2026-06-15",
        status: "active",
        items: [
          {
            name: "خصم ترويجي للمواد الخام الربع السنوي",
            quantity: 1,
            price: 25000,
          },
        ],
        notes: "خصم ترويجي للمواد الخام الربع السنوي",
      },
    ];
  });

  const [showAddCreditNoteModal, setShowAddCreditNoteModal] = useState(false);
  const [newCreditNote, setNewCreditNote] = useState({
    supplierId: "",
    invoiceId: "",
    creditNoteNumber: "",
    amount: 0,
    issueDate: "2026-06-07",
    dueDate: "",
    notes: "",
    items: [{ name: "", quantity: 1, price: 0 }],
  });

  // AI Support chatbot state
  const [supportMessages, setSupportMessages] = useState<SupportMessage[]>(
    () => {
      const saved = localStorage.getItem("mawrid_chat_history");
      if (saved) return JSON.parse(saved);
      return [
        {
          id: "msg-init",
          role: "model",
          text: "أهلاً بك في نظام 'مورد' الذكي لإدارة الحسابات والتعاملات البنكية. أنا مساعد الدعم الفني الآلي ومستشارك المالي، كيف يمكنني مساعدتك اليوم بخصوص حسابات الموردين أو فواتيرك؟",
          timestamp: new Date().toISOString(),
        },
      ];
    },
  );
  const [chatInput, setChatInput] = useState("");
  const [isAiTyping, setIsAiTyping] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Toast notifications for user feedback
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);

  // Check roles permissions
  const checkPermission = (
    action: "create" | "delete" | "write" | "backup",
  ): boolean => {
    if (currentRole === UserRole.ADMIN) return true;
    if (currentRole === UserRole.ACCOUNTANT) {
      if (action === "delete") {
        showToast(
          "عذراً، لا تمتلك صلاحية حذف السجلات بصفتك محاسباً. يتطلب ذلك رتبة مدير النظام.",
          "error",
        );
        return false;
      }
      if (action === "backup") {
        showToast(
          "عذراً، صلاحيات النسخ الاحتياطي وحفظ النظام مقيدة بمدير النظام فقط.",
          "error",
        );
        return false;
      }
      return true; // Can write and create
    }
    if (currentRole === UserRole.VIEWER) {
      showToast(
        "عذراً، حساب مراقب مالي يمتلك صلاحية القراءة فقط. ميزة تعديل أو حذف البيانات مقفلة.",
        "error",
      );
      return false;
    }
    return false;
  };

  const showToast = (
    message: string,
    type: "success" | "error" | "info" = "success",
  ) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Flag to know if server configuration has finished loading, preventing early overwrite of DB with empty state
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [firebaseStatus, setFirebaseStatus] = useState<
    "connecting" | "success" | "fallback" | "error"
  >("connecting");
  const [dbError, setDbError] = useState<string | null>(null);

  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);
  const [isReconnectingDb, setIsReconnectingDb] = useState(false);
  const [isResettingDb, setIsResettingDb] = useState(false);

  const handleReconnectDb = async () => {
    if (isReconnectingDb) return;
    setIsReconnectingDb(true);
    setFirebaseStatus("connecting");
    showToast("جاري إعادة تشغيل قنوات الاتصال والتحقق من سلامة الجداول...", "info");
    try {
      const res = await fetch("/api/reconnect-db", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      const data = await res.json();
      if (data && data.success) {
        setFirebaseStatus("success");
        setDbError(null);
        showToast(data.message || "تم إعادة الاتصال بـ PostgreSQL بنجاح!", "success");
      } else {
        setFirebaseStatus("error");
        setDbError(data.postgresError || "فشل الاتصال");
        showToast(data.message || "فشلت عملية الاتصال بقاعدة البيانات", "error");
      }
    } catch (err: any) {
      setFirebaseStatus("error");
      setDbError(err?.message || String(err));
      showToast("فشل الاتصال: " + (err?.message || String(err)), "error");
    } finally {
      setIsReconnectingDb(false);
    }
  };

  const handleResetDbFromScratch = async () => {
    if (isResettingDb) return;
    setIsResettingDb(true);
    showToast("جاري تصفير قاعدة بيانات الموردين وإعادة تهيئة الجداول كأول مرة...", "info");
    try {
      const res = await fetch("/api/reset-db", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      const data = await res.json();
      if (data && data.success) {
        setFirebaseStatus("success");
        setDbError(null);
        showToast("تمت إعادة ضبط وحذف كل البيانات وإعادة التهيئة كأول مرة بنجاح! جاري تنشيط النظام...", "success");
        // Clear react states first to avoid state dump overwrite while reloading
        setSuppliers([]);
        setInvoices([]);
        setPayments([]);
        setBackups([]);
        setCreditNotes([]);
        setSafeBalance(0);
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      } else {
        showToast(data.message || "فشل تصفير قاعدة البيانات", "error");
      }
    } catch (err: any) {
      showToast("فشلت عملية إعادة التهيئة: " + (err?.message || String(err)), "error");
    } finally {
      setIsResettingDb(false);
      setShowResetConfirmModal(false);
    }
  };

  // Load initial store from server backend, which persists to PostgreSQL and has local backup file fallback
  useEffect(() => {
    const initializeDataSystem = async () => {
      try {
        setFirebaseStatus("connecting");
        const res = await fetch("/api/get-store");
        if (res.ok) {
          const data = await res.json();
          if (data) {
            if (Array.isArray(data.suppliers)) setSuppliers(data.suppliers);
            if (Array.isArray(data.invoices)) setInvoices(data.invoices);
            if (Array.isArray(data.payments)) setPayments(data.payments);
            if (Array.isArray(data.backups)) setBackups(data.backups);
            if (Array.isArray(data.supplierCategories))
              setSupplierCategories(data.supplierCategories);
            if (Array.isArray(data.warehouses))
              setWarehouses(data.warehouses);
            if (Array.isArray(data.linkedBanks))
              setLinkedBanks(data.linkedBanks);
            if (typeof data.safeBalance === "number")
              setSafeBalance(data.safeBalance);
            if (Array.isArray(data.creditNotes))
              setCreditNotes(data.creditNotes);

            if (data.postgresActive) {
              setFirebaseStatus("success");
              setDbError(null);
            } else {
              setFirebaseStatus("fallback");
              setDbError(data.postgresError || "قاعدة اتصال محلية نشطة");
            }
          }
        } else {
          setFirebaseStatus("error");
          setDbError("Server returned status " + res.status);
        }
      } catch (serverErr: any) {
        console.error("Failed to load local backup from server:", serverErr);
        setFirebaseStatus("error");
        setDbError(serverErr?.message || String(serverErr));
      } finally {
        setIsDataLoaded(true);
      }
    };

    initializeDataSystem();
  }, []);

  // Synchronize entire system state to server filesystem storage and PostgreSQL on state change
  useEffect(() => {
    if (!isDataLoaded) return;

    const syncAllStates = async () => {
      const stateDump = {
        suppliers,
        invoices,
        payments,
        backups,
        supplierCategories,
        warehouses,
        linkedBanks,
        safeBalance,
        creditNotes,
      };

      // Sync to backend store linked to PostgreSQL & local cache file
      try {
        const res = await fetch("/api/save-store", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(stateDump),
        });
        if (res.ok) {
          const resData = await res.json();
          if (resData && resData.postgresActive) {
            setFirebaseStatus("success");
            setDbError(null);
          } else {
            setFirebaseStatus("fallback");
            setDbError(resData?.postgresError || "قاعدة اتصال محلية نشطة");
          }
        } else {
          setFirebaseStatus("error");
          setDbError("حدث خطأ أثناء حفظ نسخة احتياطية من البيانات على خادم التطبيق المحلي.");
        }
      } catch (err: any) {
        console.error("Failed to save state update to server:", err);
        setFirebaseStatus("error");
        setDbError(err?.message || String(err));
      }
    };

    const timer = setTimeout(syncAllStates, 800);
    return () => clearTimeout(timer);
  }, [
    isDataLoaded,
    suppliers,
    invoices,
    payments,
    backups,
    supplierCategories,
    warehouses,
    linkedBanks,
    safeBalance,
    creditNotes,
  ]);

  // Sync state to LocalStorage
  useEffect(() => {
    localStorage.setItem("mawrid_suppliers", JSON.stringify(suppliers));
  }, [suppliers]);

  useEffect(() => {
    localStorage.setItem("mawrid_invoices", JSON.stringify(invoices));
  }, [invoices]);

  useEffect(() => {
    localStorage.setItem("mawrid_payments", JSON.stringify(payments));
  }, [payments]);

  useEffect(() => {
    localStorage.setItem("mawrid_backups", JSON.stringify(backups));
  }, [backups]);

  useEffect(() => {
    localStorage.setItem("mawrid_user_role", currentRole);
  }, [currentRole]);

  useEffect(() => {
    localStorage.setItem(
      "mawrid_chat_history",
      JSON.stringify(supportMessages),
    );
  }, [supportMessages]);

  useEffect(() => {
    localStorage.setItem("mawrid_linked_banks", JSON.stringify(linkedBanks));
  }, [linkedBanks]);

  useEffect(() => {
    localStorage.setItem("mawrid_credit_notes", JSON.stringify(creditNotes));
  }, [creditNotes]);

  // Reset active report page back to 0 when report parameters change
  useEffect(() => {
    setActiveReportPage(0);
  }, [
    selectedReportSupplierId,
    reportWarehouseFilter,
    reportStartDate,
    reportEndDate,
    reportDateType,
    reportViewType,
  ]);

  // Generate Payment Alerts based on system time and invoice due dates
  useEffect(() => {
    const today = new Date("2026-06-07"); // System baseline date requested in metadata context
    const currentAlerts: string[] = [];

    invoices.forEach((inv) => {
      if (inv.status === "unpaid") {
        const dueDate = new Date(inv.dueDate);
        const timeDiff = dueDate.getTime() - today.getTime();
        const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
        const supplier = suppliers.find((s) => s.id === inv.supplierId);
        const supplierName = supplier ? supplier.name : "غير معروف";

        if (daysDiff < 0) {
          currentAlerts.push(
            `تنبیه عاجل: الفاتورة رقم ${inv.invoiceNumber} للمورد ${supplierName} متأخرة عن موعد سدادها منذ ${Math.abs(daysDiff)} يوم!`,
          );
        } else if (daysDiff <= 5) {
          currentAlerts.push(
            `استحقاق قادم: الفاتورة رقم ${inv.invoiceNumber} للمورد ${supplierName} تستحق السداد خلال ${daysDiff} أيام.`,
          );
        }
      }
    });

    setAlerts(currentAlerts);
  }, [invoices, suppliers]);

  // Scroll to bottom of chat
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [supportMessages]);

  // Dynamic metrics helpers
  const getSupplierStats = () => {
    const totalInvoicesAmount = invoices.reduce(
      (acc, curr) => acc + (curr.totalAmount - (curr.creditNoteAmount || 0)),
      0,
    );
    const paidAmount = payments.reduce((acc, curr) => acc + curr.amount, 0);
    const pendingAmount = invoices
      .filter((i) => i.status === "unpaid")
      .reduce(
        (acc, curr) => acc + (curr.totalAmount - (curr.creditNoteAmount || 0)),
        0,
      );
    const paidInvoicesCount = invoices.filter(
      (i) => i.status === "paid",
    ).length;
    const unpaidInvoicesCount = invoices.filter(
      (i) => i.status === "unpaid",
    ).length;

    return {
      suppliersCount: suppliers.length,
      invoicesCount: invoices.length,
      unpaidInvoicesCount,
      totalInvoicesAmount,
      paidAmount,
      pendingAmount,
      paymentRatio:
        totalInvoicesAmount > 0
          ? Math.round((paidAmount / totalInvoicesAmount) * 100)
          : 0,
    };
  };

  const getSelectedReportFinancials = () => {
    // Filter by date range first
    const dateFilteredInvoices = invoices.filter((i) => {
      const date =
        (reportDateType === "issue_date" ? i.issueDate : i.dueDate) ||
        "2026-06-01";
      return date >= reportStartDate && date <= reportEndDate;
    });

    // Filter by supplier and warehouse
    const targetInvoices = dateFilteredInvoices.filter((i) => {
      const matchesSupplier =
        selectedReportSupplierId === "all" ||
        i.supplierId === selectedReportSupplierId;
      const matchesWarehouse =
        reportWarehouseFilter === "all" ||
        i.warehouse === reportWarehouseFilter;
      return matchesSupplier && matchesWarehouse;
    });

    const targetTotal = targetInvoices.reduce(
      (sum, curr) => sum + (curr.totalAmount - (curr.creditNoteAmount || 0)),
      0,
    );
    const targetPending = targetInvoices
      .filter((i) => i.status === "unpaid")
      .reduce(
        (sum, curr) => sum + (curr.totalAmount - (curr.creditNoteAmount || 0)),
        0,
      );

    return {
      total: targetTotal,
      pending: targetPending,
    };
  };

  const dashboardStats = getSupplierStats();

  // Add new Supplier handler
  const handleAddSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkPermission("create")) return;

    if (!newSupplier.name || !newSupplier.company) {
      showToast("يرجى إدخال اسم المورد واسم الشركة على الأقل.", "error");
      return;
    }

    const createdSupplier: Supplier = {
      ...newSupplier,
      id: "sup-" + Date.now(),
      createdAt: new Date().toISOString(),
    };

    setSuppliers([...suppliers, createdSupplier]);
    setShowAddSupplierModal(false);
    if (showAddInvoiceModal) {
      setNewInvoice(prev => ({ ...prev, supplierId: createdSupplier.id }));
    }
    setNewSupplier({
      name: "",
      company: "",
      phone: "",
      email: "",
      bankAccount: "",
      category: "تجهيزات ومستلزمات",
      address: "",
      notes: "",
    });
    showToast(`تمت إضافة المورد ${createdSupplier.name} بنجاح.`);
  };

  // Add new Warehouse handler
  const handleSaveNewWarehouse = () => {
    const trimmed = newWarehouseName.trim();
    if (!trimmed) {
      showToast("يرجى إدخال اسم المستودع أولاً للتمكن من الإضافة.", "error");
      return;
    }

    if (!warehouses.includes(trimmed)) {
      const updated = [...warehouses, trimmed];
      setWarehouses(updated);
      showToast(`تمت إضافة المخزن "${trimmed}" بنجاح وتحديده.`);
    } else {
      showToast("هذا المخزن موجود بالفعل وتم تحديده.", "info");
    }

    if (addWarehouseContext === "new") {
      setNewInvoice((prev) => ({
        ...prev,
        warehouse: trimmed,
      }));
    } else if (addWarehouseContext === "edit") {
      setEditingInvoice((prev) =>
        prev ? { ...prev, warehouse: trimmed } : null
      );
    }

    setShowAddWarehouseModal(false);
    setNewWarehouseName("");
    setAddWarehouseContext(null);
  };

  // Delete Supplier handler
  const handleDeleteSupplier = (id: string, name: string) => {
    if (!checkPermission("delete")) return;
    setSupplierToDelete({ id, name });
  };

  // Execution of Supplier deletion
  const executeDeleteSupplier = () => {
    if (!supplierToDelete) return;
    const { id, name } = supplierToDelete;

    // Verify if there are unpaid invoices before deleting
    const hasUnpaid = invoices.some(
      (i) => i.supplierId === id && i.status === "unpaid",
    );
    if (hasUnpaid) {
      showToast(
        "لا يمكن حذف المورد نظراً لوجود فواتير مستحقة وغير مسددة مسجلة عليه.",
        "error",
      );
      setSupplierToDelete(null);
      return;
    }

    setSuppliers(suppliers.filter((s) => s.id !== id));
    // Filter invoices associated
    setInvoices(invoices.filter((i) => i.supplierId !== id));
    showToast(`تم حذف المورد ${name} وكافة بياناته بنجاح.`);
    setSupplierToDelete(null);
  };

  // Request Warehouse deletion modal
  const handleRequestDeleteWarehouse = (name: string, invoicesCount: number) => {
    setWarehouseToDelete({ name, invoicesCount });
  };

  // Execution of Warehouse deletion
  const executeDeleteWarehouse = () => {
    if (!warehouseToDelete) return;
    const { name } = warehouseToDelete;
    const updated = warehouses.filter((w) => w !== name);
    setWarehouses(updated);
    showToast(
      `تم حذف المخزن "${name}" بنجاح من النظام.`,
      "info"
    );
    setWarehouseToDelete(null);
  };

  // Edit Supplier handler
  const handleUpdateSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkPermission("write")) return;

    if (!editingSupplier) return;

    if (!editingSupplier.name || !editingSupplier.company) {
      showToast("يرجى إدخال اسم المورد واسم الشركة على الأقل.", "error");
      return;
    }

    setSuppliers(
      suppliers.map((s) => (s.id === editingSupplier.id ? editingSupplier : s)),
    );
    setEditingSupplier(null);
    showToast(`تم تعديل بيانات المورد ${editingSupplier.name} بنجاح.`);
  };

  // Submit new credit note handler
  const handleAddCreditNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkPermission("create")) return;

    if (!newCreditNote.supplierId || !newCreditNote.creditNoteNumber) {
      showToast("يرجى تعبئة كافة الحقول الإجبارية للإشعار الدائن.", "error");
      return;
    }

    if (!newCreditNote.invoiceId) {
      showToast(
        "يرجى تحديد الفاتورة المربُوطة بالإشعار الدائن بشكل إجباري للخصم منها.",
        "error",
      );
      return;
    }

    const selectedInvoice = invoices.find(
      (inv) => inv.id === newCreditNote.invoiceId,
    );
    if (!selectedInvoice) {
      showToast("الفاتورة المحددة غير صالحة أو غير موجودة.", "error");
      return;
    }

    const calculatedCNTotal =
      Math.round(
        newCreditNote.items.reduce(
          (sum, item) => sum + item.quantity * item.price,
          0,
        ) * 100,
      ) / 100;
    if (calculatedCNTotal <= 0) {
      showToast("يرجى إضافة بند واحد على الأقل بقيمة أكبر من الصفر.", "error");
      return;
    }

    const remainingPayable =
      Math.round(
        (selectedInvoice.totalAmount -
          (selectedInvoice.creditNoteAmount || 0)) *
          100,
      ) / 100;
    if (calculatedCNTotal > remainingPayable) {
      showToast(
        `قيمة الإشعار الدائن (${fAmt(calculatedCNTotal)} ج.م) لا يمكن أن تتجاوز الرصيد المستحق المتبقي بالفاتورة وهو (${fAmt(remainingPayable)} ج.م).`,
        "error",
      );
      return;
    }

    const hasEmptyItem = newCreditNote.items.some(
      (item) => !item.name.trim() || item.price <= 0,
    );
    if (hasEmptyItem) {
      showToast(
        "يرجى التأكد من كتابة وصف كافة البنود وتحديد سعر أكبر من الصفر.",
        "error",
      );
      return;
    }

    const createdCN: CreditNote = {
      id: "cn-" + Date.now(),
      creditNoteNumber: newCreditNote.creditNoteNumber,
      supplierId: newCreditNote.supplierId,
      amount: calculatedCNTotal,
      issueDate: newCreditNote.issueDate,
      dueDate:
        newCreditNote.dueDate ||
        new Date(Date.now() + 15 * 24 * 3600 * 1000)
          .toISOString()
          .split("T")[0],
      status: "active",
      items: newCreditNote.items,
      notes: `${newCreditNote.notes || ""} [مرتبط بالفاتورة: ${selectedInvoice.invoiceNumber}]`,
      attachment: cnAttachment || undefined,
    };

    setCreditNotes([...creditNotes, createdCN]);

    // Update the matched invoice directly
    const updatedInvoices = invoices.map((inv) => {
      if (inv.id === selectedInvoice.id) {
        const cnRefText = `[تم إصدار إشعار دائن مرتبط برقم: ${createdCN.creditNoteNumber} بقيمة: ${fAmt(createdCN.amount)} ج.م]`;
        const existingNotes = inv.notes ? `${inv.notes} ` : "";
        const currentCNList = inv.creditNotes || [];
        return {
          ...inv,
          notes: existingNotes + cnRefText,
          creditNoteAmount:
            Math.round(
              ((inv.creditNoteAmount || 0) + calculatedCNTotal) * 100,
            ) / 100,
          creditNotes: [...currentCNList, createdCN],
        };
      }
      return inv;
    });
    setInvoices(updatedInvoices);

    setShowAddCreditNoteModal(false);
    setCnAttachment(null);
    setNewCreditNote({
      supplierId: "",
      invoiceId: "",
      creditNoteNumber: "",
      amount: 0,
      issueDate: "2026-06-07",
      dueDate: "",
      notes: "",
      items: [{ name: "بند إشعار", quantity: 1, price: 0 }],
    });
    showToast(
      `تم تسجيل الإشعار الدائن رقم ${createdCN.creditNoteNumber} وخصمه من الفاتورة رقم ${selectedInvoice.invoiceNumber} بنجاح.`,
    );
  };

  // Credit Note Form Item handlers
  const handleCNAddItemRow = () => {
    setNewCreditNote({
      ...newCreditNote,
      items: [
        ...newCreditNote.items,
        { name: "بند إشعار", quantity: 1, price: 0 },
      ],
    });
  };

  const handleCNRemoveItemRow = (index: number) => {
    if (newCreditNote.items.length === 1) return;
    const filtered = newCreditNote.items.filter((_, i) => i !== index);
    setNewCreditNote({ ...newCreditNote, items: filtered });
  };

  const handleCNUpdateItemRow = (index: number, field: string, value: any) => {
    const updatedItems = newCreditNote.items.map((item, i) => {
      if (i === index) {
        return { ...item, [field]: value };
      }
      return item;
    });
    setNewCreditNote({ ...newCreditNote, items: updatedItems });
  };

  // Delete Credit Note handler
  const handleDeleteCreditNote = (id: string, cnNumber: string) => {
    if (!checkPermission("delete")) return;

    if (
      window.confirm(
        `هل أنت متأكد من رغبتك في حذف الإشعار الدائن رقم ${cnNumber} نهائياً؟`,
      )
    ) {
      setCreditNotes(creditNotes.filter((cn) => cn.id !== id));

      const updatedInvoices = invoices.map((inv) => {
        const hasCN = (inv.creditNotes || []).some((cn) => cn.id === id);
        if (hasCN) {
          const targetCN = (inv.creditNotes || []).find((cn) => cn.id === id)!;
          const remainingCNs = (inv.creditNotes || []).filter(
            (cn) => cn.id !== id,
          );
          const newCNAmount = Math.max(
            0,
            Math.round(((inv.creditNoteAmount || 0) - targetCN.amount) * 100) /
              100,
          );
          return {
            ...inv,
            creditNoteAmount: newCNAmount,
            creditNotes: remainingCNs,
            notes:
              (inv.notes || "") +
              ` [تم حذف الإشعار الدائن المرتبط رقم: ${cnNumber}]`,
          };
        }
        return inv;
      });
      setInvoices(updatedInvoices);

      showToast(
        `تم حذف الإشعار الدائن ${cnNumber} بنجاح وتحديث الفواتير المرتبطة.`,
      );
    }
  };

  // Initiate Edit Credit Note
  const handleInitiateEditCreditNote = (cn: CreditNote) => {
    if (!checkPermission("write")) return;
    setEditingCreditNote(JSON.parse(JSON.stringify(cn)));
    setShowEditCreditNoteModal(true);
  };

  const handleEditCNAddItemRow = () => {
    if (!editingCreditNote) return;
    setEditingCreditNote({
      ...editingCreditNote,
      items: [
        ...editingCreditNote.items,
        { name: "بند إشعار", quantity: 1, price: 0 },
      ],
    });
  };

  const handleEditCNRemoveItemRow = (index: number) => {
    if (!editingCreditNote || editingCreditNote.items.length === 1) return;
    setEditingCreditNote({
      ...editingCreditNote,
      items: editingCreditNote.items.filter((_, i) => i !== index),
    });
  };

  const handleEditCNUpdateItemRow = (
    index: number,
    field: string,
    value: any,
  ) => {
    if (!editingCreditNote) return;
    const updated = editingCreditNote.items.map((item, i) => {
      if (i === index) {
        return { ...item, [field]: value };
      }
      return item;
    });
    setEditingCreditNote({ ...editingCreditNote, items: updated });
  };

  const handleUpdateCreditNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkPermission("write")) return;
    if (!editingCreditNote) return;

    if (!editingCreditNote.creditNoteNumber) {
      showToast("يرجى تعبئة كافة الحقول الإجبارية للإشعار الدائن.", "error");
      return;
    }

    const calculatedTotal =
      Math.round(
        editingCreditNote.items.reduce(
          (sum, item) => sum + item.quantity * item.price,
          0,
        ) * 100,
      ) / 100;
    if (calculatedTotal <= 0) {
      showToast("يرجى إضافة بند واحد على الأقل بقيمة أكبر من الصفر.", "error");
      return;
    }

    const hasEmptyItem = editingCreditNote.items.some(
      (item) => !item.name.trim() || item.price <= 0,
    );
    if (hasEmptyItem) {
      showToast(
        "يرجى التأكد من كتابة وصف كافة البنود وتحديد سعر أكبر من الصفر.",
        "error",
      );
      return;
    }

    // Find linked invoice (if any)
    const linkedInvoice = invoices.find((inv) =>
      (inv.creditNotes || []).some((cn) => cn.id === editingCreditNote.id),
    );
    if (linkedInvoice) {
      // Find original credit note amount in invoice
      const originalCN = (linkedInvoice.creditNotes || []).find(
        (cn) => cn.id === editingCreditNote.id,
      );
      const originalAmount = originalCN ? originalCN.amount : 0;
      const otherCNAmount =
        (linkedInvoice.creditNoteAmount || 0) - originalAmount;
      const remainingPayable =
        Math.round((linkedInvoice.totalAmount - otherCNAmount) * 100) / 100;

      if (calculatedTotal > remainingPayable) {
        showToast(
          `قيمة الإشعار الدائن المعدلة (${fAmt(calculatedTotal)} ج.م) لا يمكن أن تتجاوز الرصيد المستحق المتبقي بالفاتورة وهو (${fAmt(remainingPayable)} ج.م).`,
          "error",
        );
        return;
      }

      // Update invoice side
      const updatedInvoices = invoices.map((inv) => {
        if (inv.id === linkedInvoice.id) {
          const updatedCNList = (inv.creditNotes || []).map((cn) =>
            cn.id === editingCreditNote.id
              ? { ...editingCreditNote, amount: calculatedTotal }
              : cn,
          );
          return {
            ...inv,
            creditNoteAmount:
              Math.round((otherCNAmount + calculatedTotal) * 100) / 100,
            creditNotes: updatedCNList,
          };
        }
        return inv;
      });
      setInvoices(updatedInvoices);
    }

    // Update global creditNotes list
    setCreditNotes(
      creditNotes.map((cn) =>
        cn.id === editingCreditNote.id
          ? { ...editingCreditNote, amount: calculatedTotal }
          : cn,
      ),
    );

    setShowEditCreditNoteModal(false);
    setEditingCreditNote(null);
    showToast(
      `تم تعديل الإشعار الدائن رقم ${editingCreditNote.creditNoteNumber} بنجاح.`,
    );
  };

  // Mark/Toggle Credit Note status handler
  const handleToggleCreditNoteStatus = (id: string) => {
    if (!checkPermission("write")) return;
    setCreditNotes(
      creditNotes.map((cn) => {
        if (cn.id === id) {
          const nextStatus = cn.status === "active" ? "applied" : "active";
          return { ...cn, status: nextStatus };
        }
        return cn;
      }),
    );
    showToast("تم تحديث حالة الإشعار الدائن بنجاح.");
  };

  // Add Invoice Form Item handlers
  const handleAddItemRow = () => {
    setNewInvoice({
      ...newInvoice,
      items: [...newInvoice.items, { name: "بند شحنة", quantity: 1, price: 0 }],
    });
  };

  const handleRemoveItemRow = (index: number) => {
    if (newInvoice.items.length === 1) return;
    const filtered = newInvoice.items.filter((_, i) => i !== index);
    setNewInvoice({ ...newInvoice, items: filtered });
  };

  const handleUpdateItemRow = (index: number, field: string, value: any) => {
    const updatedItems = newInvoice.items.map((item, i) => {
      if (i === index) {
        return { ...item, [field]: value };
      }
      return item;
    });
    setNewInvoice({ ...newInvoice, items: updatedItems });
  };

  // Discount management helpers
  const handleAddDiscountRow = () => {
    setDiscounts((prev) => [...prev, { name: "", price: 0 }]);
  };

  const handleUpdateDiscountRow = (
    index: number,
    field: "name" | "price",
    value: any,
  ) => {
    setDiscounts((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );
  };

  const handleRemoveDiscountRow = (index: number) => {
    setDiscounts((prev) => prev.filter((_, i) => i !== index));
  };

  // Edit Invoice Discount management helpers
  const handleAddEditDiscountRow = () => {
    setEditDiscounts((prev) => [...prev, { name: "", price: 0 }]);
  };

  const handleUpdateEditDiscountRow = (
    index: number,
    field: "name" | "price",
    value: any,
  ) => {
    setEditDiscounts((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );
  };

  const handleRemoveEditDiscountRow = (index: number) => {
    setEditDiscounts((prev) => prev.filter((_, i) => i !== index));
  };

  // Attachment file upload helper
  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    target: "invoice" | "credit_note",
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      if (reader.result) {
        const fileData = {
          name: file.name,
          type: file.type,
          dataUrl: reader.result as string,
        };
        if (target === "invoice") {
          setInvoiceAttachment(fileData);
        } else {
          setCnAttachment(fileData);
        }
        showToast(`تم إرفاق الملف "${file.name}" بنجاح.`);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleMultipleFilesUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    target: "invoice" | "edit_invoice" | "credit_note",
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file: any) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (reader.result) {
          const fileData = {
            name: file.name,
            type: file.type,
            dataUrl: reader.result as string,
          };
          if (target === "invoice") {
            setInvoiceAttachments((prev) => [...prev, fileData]);
          } else if (target === "edit_invoice") {
            setEditingInvoice((prev) => {
              if (!prev) return prev;
              const currentAttachments =
                prev.attachments || (prev.attachment ? [prev.attachment] : []);
              // prevent duplicate exact name
              if (currentAttachments.some((att) => att.name === fileData.name))
                return prev;
              return {
                ...prev,
                attachments: [...currentAttachments, fileData],
              };
            });
          } else {
            setCnAttachment(fileData);
          }
          showToast(`تم إرفاق الملف "${file.name}" بنجاح.`);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  // Handle create Invoice
  const handleAddInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkPermission("create")) return;

    if (!newInvoice.supplierId) {
      showToast("يرجى اختيار المورد المرتبط.", "error");
      return;
    }

    if (invoiceBaseAmount <= 0) {
      showToast("يرجى إدخال قيمة الفاتورة الأساسية أكبر من الصفر.", "error");
      return;
    }

    // Generate unique invoice number automatically (since input field is removed)
    let generatedInvoiceNum = "";
    let isDuplicate = true;
    while (isDuplicate) {
      generatedInvoiceNum = `FT-2026-${Math.floor(10000 + Math.random() * 90000)}`;
      isDuplicate = invoices.some((i) => i.invoiceNumber === generatedInvoiceNum);
    }

    // Construct the items array representing base amount and discounts
    const compiledItems = [
      {
        name: "القيمة الأساسية للفاتورة",
        quantity: 1,
        price: Math.round(invoiceBaseAmount * 100) / 100,
      },
    ];

    discounts.forEach((d) => {
      if (d.price > 0) {
        compiledItems.push({
          name: d.name.trim() ? `خصم: ${d.name.trim()}` : "خصم مطبق",
          quantity: 1,
          price: -Math.round(d.price * 100) / 100,
        });
      }
    });

    const subtotal =
      Math.round(
        compiledItems.reduce(
          (sum, item) => sum + item.quantity * item.price,
          0,
        ) * 100,
      ) / 100;
    const vatRate = newInvoice.isCustomVat
      ? Math.round((newInvoice.customVatAmount / (subtotal || 1)) * 100 * 100) /
        100
      : newInvoice.vatRate !== undefined
        ? newInvoice.vatRate
        : 14;
    const vatAmount = newInvoice.isCustomVat
      ? Math.round(newInvoice.customVatAmount * 100) / 100
      : Math.round(subtotal * (vatRate / 100) * 100) / 100;
    const calculatedTotal = Math.round((subtotal + vatAmount) * 100) / 100;

    const createdInvoice: Invoice = {
      id: "inv-" + Date.now(),
      invoiceNumber: generatedInvoiceNum,
      supplierId: newInvoice.supplierId,
      issueDate: newInvoice.issueDate || new Date().toISOString().split("T")[0],
      dueDate:
        newInvoice.dueDate ||
        new Date(Date.now() + 15 * 24 * 3600 * 1000)
          .toISOString()
          .split("T")[0],
      items: compiledItems,
      totalAmount: calculatedTotal,
      status: "unpaid",
      notes: newInvoice.notes,
      warehouse: newInvoice.warehouse || warehouses[0],
      vatRate: vatRate,
      vatAmount: vatAmount,
      isCustomVat: newInvoice.isCustomVat,
      customVatAmount: newInvoice.isCustomVat
        ? newInvoice.customVatAmount
        : undefined,
      attachment: invoiceAttachments[0] || invoiceAttachment || undefined,
      attachments: invoiceAttachments,
    };

    setInvoices([createdInvoice, ...invoices]);
    setShowAddInvoiceModal(false);

    // Reset states
    setInvoiceBaseAmount(0);
    setDiscounts([]);
    setInvoiceAttachment(null);
    setInvoiceAttachments([]);
    setNewInvoice({
      supplierId: "",
      invoiceNumber: "",
      issueDate: new Date().toISOString().split("T")[0],
      dueDate: "",
      notes: "",
      items: [{ name: "بند شحنة", quantity: 1, price: 0 }],
      vatRate: 14,
      isCustomVat: false,
      customVatAmount: 0,
      warehouse: "",
    });
    showToast(
      `تم تسجيل فاتورة جديدة ${createdInvoice.invoiceNumber} بقيمة ${fAmt(calculatedTotal)} ج.م (تتضمن ضريبة ق.م: ${fAmt(vatAmount)} ج.م).`,
    );
  };

  // Edit Invoice Handlers
  const handleAddEditItemRow = () => {
    if (!editingInvoice) return;
    setEditingInvoice({
      ...editingInvoice,
      items: [
        ...editingInvoice.items,
        { name: "بند شحنة", quantity: 1, price: 0 },
      ],
    });
  };

  const handleRemoveEditItemRow = (index: number) => {
    if (!editingInvoice) return;
    if (editingInvoice.items.length === 1) return;
    const filtered = editingInvoice.items.filter((_, i) => i !== index);
    setEditingInvoice({ ...editingInvoice, items: filtered });
  };

  const handleUpdateEditItemRow = (
    index: number,
    field: string,
    value: any,
  ) => {
    if (!editingInvoice) return;
    const updatedItems = editingInvoice.items.map((item, i) => {
      if (i === index) {
        return { ...item, [field]: value };
      }
      return item;
    });
    setEditingInvoice({ ...editingInvoice, items: updatedItems });
  };

  const handleUpdateInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkPermission("write")) return;

    if (!editingInvoice) return;

    if (!editingInvoice.supplierId || !editingInvoice.invoiceNumber) {
      showToast("يرجى اختيار المورد وتحديد رقم الفاتورة.", "error");
      return;
    }

    // Verify duplicate invoice number (excluding self)
    const isDuplicate = invoices.some(
      (i) =>
        i.id !== editingInvoice.id &&
        i.invoiceNumber === editingInvoice.invoiceNumber,
    );
    if (isDuplicate) {
      showToast(
        `الفاتورة رقم ${editingInvoice.invoiceNumber} مسجلة مسبقاً بالنظام.`,
        "error",
      );
      return;
    }

    if (editInvoiceBaseAmount <= 0) {
      showToast("يرجى إدخال قيمة الفاتورة الأساسية أكبر من الصفر.", "error");
      return;
    }

    const compiledItems = [
      {
        name: "القيمة الأساسية للفاتورة",
        quantity: 1,
        price: Math.round(editInvoiceBaseAmount * 100) / 100,
      },
    ];

    editDiscounts.forEach((d) => {
      if (d.price > 0) {
        compiledItems.push({
          name: d.name.trim() ? `خصم: ${d.name.trim()}` : "خصم مطبق",
          quantity: 1,
          price: -Math.round(d.price * 100) / 100,
        });
      }
    });

    const subtotal =
      Math.round(
        compiledItems.reduce(
          (sum, item) => sum + item.quantity * item.price,
          0,
        ) * 100,
      ) / 100;
    const vatRate = editingInvoice.isCustomVat
      ? Math.round(
          ((editingInvoice.customVatAmount || 0) / (subtotal || 1)) * 100 * 100,
        ) / 100
      : editingInvoice.vatRate !== undefined
        ? editingInvoice.vatRate
        : 14;
    const vatAmount = editingInvoice.isCustomVat
      ? Math.round((editingInvoice.customVatAmount || 0) * 100) / 100
      : Math.round(subtotal * (vatRate / 100) * 100) / 100;
    const calculatedTotal = Math.round((subtotal + vatAmount) * 100) / 100;

    const updatedInvoice: Invoice = {
      ...editingInvoice,
      items: compiledItems,
      totalAmount: calculatedTotal,
      vatRate: vatRate,
      vatAmount: vatAmount,
    };

    // Check if the invoice payment was cancelled (changed from paid to unpaid)
    const originalInvoice = invoices.find((i) => i.id === editingInvoice.id);
    if (
      originalInvoice &&
      originalInvoice.status === "paid" &&
      updatedInvoice.status === "unpaid"
    ) {
      // Find any cash payments to refund of this invoice to the cash safe
      const associatedPayments = payments.filter(
        (p) => p.invoiceId === editingInvoice.id,
      );
      const cashRefundSum = associatedPayments
        .filter((p) => p.method === "cash")
        .reduce((sum, p) => sum + p.amount, 0);

      if (cashRefundSum > 0) {
        setSafeBalance((prev) => prev + cashRefundSum);
      }

      // Filter out payments associated with this invoice ID
      setPayments((prev) =>
        prev.filter((p) => p.invoiceId !== editingInvoice.id),
      );
      showToast(
        `تم إلغاء سداد الفاتورة رقم ${updatedInvoice.invoiceNumber} بنجاح وإلغاء عملية الدفع من سجل المدفوعات والتحويلات.`,
        "info",
      );
    }

    setInvoices(
      invoices.map((i) => (i.id === editingInvoice.id ? updatedInvoice : i)),
    );
    setEditingInvoice(null);
    showToast(`تم تعديل الفاتورة رقم ${updatedInvoice.invoiceNumber} بنجاح.`);
  };

  // Helpers for Credit Note within Edit Invoice
  const handleAddEditInvoiceCNItemRow = () => {
    setEditInvoiceCNData((prev) => ({
      ...prev,
      items: [...prev.items, { name: "بند إشعار", quantity: 1, price: 0 }],
    }));
  };

  const handleRemoveEditInvoiceCNItemRow = (index: number) => {
    if (editInvoiceCNData.items.length === 1) return;
    setEditInvoiceCNData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const handleUpdateEditInvoiceCNItemRow = (
    index: number,
    field: string,
    value: any,
  ) => {
    setEditInvoiceCNData((prev) => {
      const updatedItems = prev.items.map((item, i) => {
        if (i === index) {
          const updatedItem = { ...item, [field]: value };
          if (field === "price") {
            updatedItem.quantity = 1;
          }
          return updatedItem;
        }
        return item;
      });
      return {
        ...prev,
        items: updatedItems,
      };
    });
  };

  const handleSaveCNFromEditInvoice = () => {
    if (!editingInvoice) return;
    if (!editInvoiceCNData.creditNoteNumber) {
      showToast("يرجى إدخال رقم الإشعار الدائن.", "error");
      return;
    }

    const calculatedTotal = editInvoiceCNData.items.reduce(
      (sum, item) => sum + item.quantity * (Number(item.price) || 0),
      0,
    );
    if (calculatedTotal <= 0) {
      showToast(
        "يرجى إضافة بند واحد على الأقل بقيمة أكبر من الصفر للإشعار الدائن.",
        "error",
      );
      return;
    }

    const hasEmptyItem = editInvoiceCNData.items.some(
      (item) => !item.name.trim() || (Number(item.price) || 0) <= 0,
    );
    if (hasEmptyItem) {
      showToast(
        "يرجى تعبئة كافة تفاصيل ووصف البنود وقيمها بشكل صحيح.",
        "error",
      );
      return;
    }

    // Create the New Credit Note
    const createdCN: CreditNote = {
      id: "cn-" + Date.now(),
      creditNoteNumber: editInvoiceCNData.creditNoteNumber,
      supplierId: editingInvoice.supplierId,
      amount: calculatedTotal,
      issueDate: editInvoiceCNData.issueDate,
      dueDate:
        editInvoiceCNData.dueDate ||
        new Date(Date.now() + 15 * 24 * 3600 * 1000)
          .toISOString()
          .split("T")[0],
      status: "active",
      items: editInvoiceCNData.items.map((item) => ({
        ...item,
        price: Number(item.price) || 0,
      })),
      notes: `${editInvoiceCNData.notes || ""} [تم إنشاؤه من الفاتورة: ${editingInvoice.invoiceNumber}]`,
    };

    setCreditNotes([...creditNotes, createdCN]);
    setShowEditInvoiceCNSection(false);

    // Auto-append details to invoice notes so it acts as reference
    const cnReferenceText = `[تم إصدار إشعار دائن مرتبط برقم: ${createdCN.creditNoteNumber} بقيمة: ${fAmt(createdCN.amount)} ج.م]`;
    const existingNotes = editingInvoice.notes
      ? `${editingInvoice.notes} `
      : "";

    // Set the credit note amount and list on editingInvoice directly so it saves together
    const currentNotes = editingInvoice.creditNotes || [];
    const newCreditNoteAmount =
      (editingInvoice.creditNoteAmount || 0) + calculatedTotal;

    setEditingInvoice({
      ...editingInvoice,
      notes: existingNotes + cnReferenceText,
      creditNoteAmount: newCreditNoteAmount,
      creditNotes: [...currentNotes, createdCN],
    });

    showToast(
      `تم إصدار الإشعار الدائن رقم ${createdCN.creditNoteNumber} بنجاح وتعديل رصيد الفاتورة وفقاً لذلك!`,
    );
  };

  // Delete Invoice handler
  const handleDeleteInvoice = (id: string, invoiceNumber: string) => {
    if (!checkPermission("delete")) return;

    if (
      window.confirm(
        `هل أنت متأكد من رغبتك في حذف الفاتورة رقم ${invoiceNumber} نهائياً؟`,
      )
    ) {
      setPayments(payments.filter((p) => p.invoiceId !== id));
      setInvoices(invoices.filter((i) => i.id !== id));
      showToast(`تم حذف الفاتورة رقم ${invoiceNumber} بنجاح.`);
    }
  };

  // Cancel/Unlink Credit Note from an Invoice
  const handleCancelCreditNoteFromInvoice = (
    invoiceId: string,
    creditNoteId: string,
  ) => {
    if (!checkPermission("write")) return;

    const targetInvoice = invoices.find((inv) => inv.id === invoiceId);
    if (!targetInvoice) return;

    const targetCN = (targetInvoice.creditNotes || []).find(
      (cn) => cn.id === creditNoteId,
    );
    if (!targetCN) return;

    if (
      window.confirm(
        `هل أنت متأكد من رغبتك في إلغاء ربط وخصم الإشعار الدائن رقم ${targetCN.creditNoteNumber} من هذه الفاتورة؟`,
      )
    ) {
      // 1. Update the Invoice
      const updatedInvoices = invoices.map((inv) => {
        if (inv.id === invoiceId) {
          const remainingCNs = (inv.creditNotes || []).filter(
            (cn) => cn.id !== creditNoteId,
          );
          const newCNAmount = Math.max(
            0,
            Math.round(((inv.creditNoteAmount || 0) - targetCN.amount) * 100) /
              100,
          );
          const cancelRefText = ` [تم إلغاء ربط الإشعار الدائن رقم: ${targetCN.creditNoteNumber} بقيمة: ${fAmt(targetCN.amount)} ج.م]`;
          const existingNotes = inv.notes ? `${inv.notes} ` : "";
          return {
            ...inv,
            notes: existingNotes + cancelRefText,
            creditNoteAmount: newCNAmount,
            creditNotes: remainingCNs,
          };
        }
        return inv;
      });
      setInvoices(updatedInvoices);

      // 2. Also update global Credit Note status to "active" so it's active and reusable
      setCreditNotes(
        creditNotes.map((cn) => {
          if (cn.id === creditNoteId) {
            return { ...cn, status: "active" };
          }
          return cn;
        }),
      );

      showToast(
        `تم إلغاء ربط وخصم الإشعار الدائن رقم ${targetCN.creditNoteNumber} من الفاتورة بنجاح.`,
      );
    }
  };

  // Initiate payment/settlement process by showing method selection modal
  const handleInitiateSettleInvoice = (invoice: Invoice) => {
    if (!checkPermission("write")) return;
    setInvoiceToSettle(invoice);
    setSelectedPaymentMethod("bank_transfer");
    // Default to the first linked bank if available
    const activeBank = linkedBanks.find((b) => b.isLinked);
    if (activeBank) {
      setSelectedPaymentBank(activeBank.bankName);
    } else {
      setSelectedPaymentBank("");
    }
    setShowSettleInvoiceModal(true);
  };

  // Execute settlement with the selected method (local bank transfer or physical safe)
  const executeFinalSettlement = (
    invoice: Invoice,
    method: "bank_transfer" | "cash",
    bankName?: string,
  ) => {
    setShowSettleInvoiceModal(false);

    const supplier = suppliers.find((s) => s.id === invoice.supplierId);
    if (!supplier) {
      showToast("فشل السداد، لم يتم تحديد المورد للفاتورة المسجلة.", "error");
      return;
    }

    const payableAmount = invoice.totalAmount - (invoice.creditNoteAmount || 0);

    if (method === "bank_transfer") {
      const userBank =
        linkedBanks.find((b) => b.bankName === bankName && b.isLinked) ||
        linkedBanks.find((b) => b.isLinked);
      if (!userBank) {
        showToast(
          "فشل التسوية، يرجى ربط بنك محلي واحد على الأقل في الإعدادات لتفعيل التحويل الفوري.",
          "error",
        );
        setActiveTab("banking");
        return;
      }

      setPaymentGatewayBank(userBank.bankName);
      setSelectedInvoiceForPayment(invoice);
      setSettlementLogs([]);
      setIsSettlingProcess(true);
      setSettlementProgress(0);

      const steps = [
        {
          text: `📡 جاري تهيئة الاتصال فوري عبر قنوات التسوية الفورية مع البنك المحلي المرتبط (${userBank.bankName})...`,
          progress: 10,
          wait: 400,
        },
        {
          text: `🔑 جاري تأكيد الرموز الأمنية المشفرة وتصريح الـ API لـ "مورد"...`,
          progress: 25,
          wait: 800,
        },
        {
          text: `🏦 التحقق من رصيد الحساب المصدق رقم: ${userBank.accountNumber}...`,
          progress: 40,
          wait: 1200,
        },
        {
          text: `💸 إرسال طلب تحويل فوري للمبلغ (${fAmt(payableAmount)} ج.م) لحساب المورد المستلم بنجاح...`,
          progress: 60,
          wait: 1900,
        },
        {
          text: `📥 جاري إرسال المستحقات لحساب المورد: ${supplier.company} (حساب IBAN: ${supplier.bankAccount})...`,
          progress: 80,
          wait: 2400,
        },
        {
          text: `✅ استلام رد تأكيدي من البنك المركزي المصري (CBE RTGS). رمز المعاملة: TXN-BM-${Math.floor(100000 + Math.random() * 900000)}`,
          progress: 100,
          wait: 3000,
        },
      ];

      steps.forEach((step, i) => {
        setTimeout(() => {
          setSettlementLogs((prev) => [...prev, step.text]);
          setSettlementProgress(step.progress);

          if (step.progress === 100) {
            setTimeout(() => {
              // Update Invoice Status
              setInvoices((prev) =>
                prev.map((inv) => {
                  if (inv.id === invoice.id) {
                    return { ...inv, status: "paid" };
                  }
                  return inv;
                }),
              );

              // Record custom payment
              const newPayment: Payment = {
                id: "pay-" + Date.now(),
                supplierId: invoice.supplierId,
                invoiceId: invoice.id,
                amount: payableAmount,
                paymentDate: new Date().toISOString().split("T")[0],
                method: userBank.bankName.includes("فوري")
                  ? "fawry"
                  : "bank_transfer",
                transRef: `RTGS-EG-${Math.floor(102931238 + Math.random() * 928374823)}`,
              };

              setPayments((prev) => [newPayment, ...prev]);
              setIsSettlingProcess(false);
              setSelectedInvoiceForPayment(null);
              showToast(
                `تم سداد الفاتورة ${invoice.invoiceNumber} بالكامل وتسويتها لحظياً عبر البنك!`,
              );
            }, 600);
          }
        }, step.wait);
      });
    } else {
      // Cash Safe / Treasury Settlement
      if (safeBalance < payableAmount) {
        showToast(
          "خطأ: رصيد الخزينة الرئيسية غير كافٍ لسداد الفاتورة نقداً! يرجى تغذية الخزينة أولاً.",
          "error",
        );
        return;
      }

      setPaymentGatewayBank("الخزينة الرئيسية للمنشأة");
      setSelectedInvoiceForPayment(invoice);
      setSettlementLogs([]);
      setIsSettlingProcess(true);
      setSettlementProgress(0);

      const steps = [
        {
          text: `📡 جاري فتح قفل الخزينة الرقمية الآمنة لشركة "مورد"...`,
          progress: 15,
          wait: 400,
        },
        {
          text: `🔑 مطابقة التواقيع الصلاحية وإذن الصرف النقدي المولد للفاتورة رقم: ${invoice.invoiceNumber}...`,
          progress: 35,
          wait: 800,
        },
        {
          text: `🧮 التحقق من كفاية السيولة النقدية (الرصيد الحالي: ${fAmt(safeBalance)} ج.م)...`,
          progress: 55,
          wait: 1200,
        },
        {
          text: `💵 عد وفرز أوراق البنكنوت فئة (200 ج.م و 100 ج.م) بقيمة إجمالية ${fAmt(payableAmount)} ج.م...`,
          progress: 75,
          wait: 1900,
        },
        {
          text: `📝 إصدار وتوثيق سند صرف الخزينة العاجل رقم: CSH-VOUCH-${Math.floor(1000 + Math.random() * 9000)}...`,
          progress: 90,
          wait: 2400,
        },
        {
          text: `✅ تم تسليم المبلغ نقداً لمندوب المورد والتسوية للخزية بنجاح!`,
          progress: 100,
          wait: 3000,
        },
      ];

      steps.forEach((step, i) => {
        setTimeout(() => {
          setSettlementLogs((prev) => [...prev, step.text]);
          setSettlementProgress(step.progress);

          if (step.progress === 100) {
            setTimeout(() => {
              // Deduct from Balance
              setSafeBalance((prev) => prev - payableAmount);

              // Update Invoice Status
              setInvoices((prev) =>
                prev.map((inv) => {
                  if (inv.id === invoice.id) {
                    return { ...inv, status: "paid" };
                  }
                  return inv;
                }),
              );

              // Record custom payment
              const newPayment: Payment = {
                id: "pay-" + Date.now(),
                supplierId: invoice.supplierId,
                invoiceId: invoice.id,
                amount: payableAmount,
                paymentDate: new Date().toISOString().split("T")[0],
                method: "cash",
                transRef: `CSH-VOUCH-${Math.floor(100000 + Math.random() * 900000)}`,
              };

              setPayments((prev) => [newPayment, ...prev]);
              setIsSettlingProcess(false);
              setSelectedInvoiceForPayment(null);
              showToast(
                `تم سداد الفاتورة ${invoice.invoiceNumber} نقداً بالكامل وخصمها من خزينة المنشأة!`,
              );
            }, 600);
          }
        }, step.wait);
      });
    }
  };

  // Toggle bank linkage status
  const handleToggleBankLinkage = (bankName: string) => {
    if (!checkPermission("write")) return;

    setLinkedBanks((prev) =>
      prev.map((bank) => {
        if (bank.bankName === bankName) {
          const nextState = !bank.isLinked;
          showToast(
            nextState
              ? `تم ربط وتفعيل حسابك بنجاح في ${bankName}.`
              : `تم قطع الاتصال البنكي مع ${bankName}.`,
            nextState ? "success" : "info",
          );
          return { ...bank, isLinked: nextState };
        }
        return bank;
      }),
    );
  };

  // Periodic automatic & manual backup generator simulating
  const triggerManualBackup = () => {
    if (!checkPermission("backup")) return;

    const dumpDataStr = JSON.stringify({ suppliers, invoices, payments });
    const backupSize = (dumpDataStr.length / 1024).toFixed(2);

    const newBackup: BackupRecord = {
      id: "bcp-" + Date.now(),
      timestamp: new Date().toISOString(),
      type: "manual",
      size: `${backupSize} KB`,
      recordsCount: {
        suppliers: suppliers.length,
        invoices: invoices.length,
        payments: payments.length,
      },
      dataDump: dumpDataStr,
    };

    setBackups([newBackup, ...backups]);
    showToast(
      `تم إنشاء نسخة احتياطية جديدة وموثقة بنجاح لحماية البيانات الاستثمارية (${backupSize} KB).`,
    );
  };

  // Restore backup
  const restoreBackupRecord = (backup: BackupRecord) => {
    if (!checkPermission("backup")) return;
    if (!backup.dataDump) {
      // Simulate fallback from initial dumps
      showToast(
        "تنبيه: النسخ الاحتياطية القديمة المسجلة مسبقاً لا تحتوي على مستودع في الذاكرة الحالية. تم استعادة قالب الضبط الابتدائي بنجاح.",
        "info",
      );
      setSuppliers(INITIAL_SUPPLIERS);
      setInvoices(INITIAL_INVOICES);
      setPayments(INITIAL_PAYMENTS);
      return;
    }

    try {
      const restored = JSON.parse(backup.dataDump);
      if (restored.suppliers) setSuppliers(restored.suppliers);
      if (restored.invoices) setInvoices(restored.invoices);
      if (restored.payments) setPayments(restored.payments);
      showToast(
        `تم استعادة حالة قاعدة البيانات بنجاح طبقاً لتوقيت النسخة الاحتياطية: ${new Date(backup.timestamp).toLocaleString("ar")}`,
      );
    } catch (e) {
      showToast("خطأ في قراءة ملف التصدير.", "error");
    }
  };

  // Download backup to user's computer
  const downloadBackupAsFile = (backup: BackupRecord) => {
    try {
      const dataStr =
        "data:text/json;charset=utf-8," +
        encodeURIComponent(backup.dataDump || "");
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute(
        "download",
        `mawrid_backup_${new Date(backup.timestamp).toISOString().split("T")[0]}_${backup.id}.json`,
      );
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showToast("✓ تم تفريغ وتحميل ملف النسخة الاحتياطية بنجاح على جهازك.");
    } catch (e) {
      showToast("عذراً، حدث خطأ أثناء محاولة تصدير الملف.", "error");
    }
  };

  // Export all application datasets inside a single file
  const exportAllDataAsJSON = () => {
    const fullBackup = {
      suppliers,
      invoices,
      payments,
      backups,
      supplierCategories,
      warehouses,
      safeBalance,
      linkedBanks,
      creditNotes,
      exportDate: new Date().toISOString(),
    };
    try {
      const jsonStr = JSON.stringify(fullBackup, null, 2);
      const dataStr =
        "data:text/json;charset=utf-8," + encodeURIComponent(jsonStr);
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute(
        "download",
        `mawrid_complete_database_${new Date().toISOString().split("T")[0]}.json`,
      );
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showToast("✓ تم تصدير وتحميل قاعدة البيانات الشاملة بنجاح في ملف واحد.");
    } catch (e) {
      showToast("فشل تصدير قاعدة البيانات.", "error");
    }
  };

  // Import entire datasets from a JSON file
  const importAllDataFromJSON = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const restored = JSON.parse(content);

        if (restored.suppliers && Array.isArray(restored.suppliers))
          setSuppliers(restored.suppliers);
        if (restored.invoices && Array.isArray(restored.invoices))
          setInvoices(restored.invoices);
        if (restored.payments && Array.isArray(restored.payments))
          setPayments(restored.payments);
        if (restored.backups && Array.isArray(restored.backups))
          setBackups(restored.backups);
        if (restored.supplierCategories && Array.isArray(restored.supplierCategories))
          setSupplierCategories(restored.supplierCategories);
        if (restored.warehouses && Array.isArray(restored.warehouses))
          setWarehouses(restored.warehouses);
        if (restored.safeBalance !== undefined)
          setSafeBalance(Number(restored.safeBalance));
        if (restored.linkedBanks && Array.isArray(restored.linkedBanks))
          setLinkedBanks(restored.linkedBanks);
        if (restored.creditNotes && Array.isArray(restored.creditNotes))
          setCreditNotes(restored.creditNotes);

        showToast("✓ تم استيراد وقراءة الملف الشامل ودمجه بنجاح مع النظام!");
      } catch (err) {
        showToast(
          "تنبيه: الملف غير صالح أو ربما تالف. تأكد من تحديد ملف نسخة شاملة بامتداد JSON.",
          "error",
        );
      }
    };
    reader.readAsText(file);
  };

  // Wipe system states cleanly to build custom databases from scratch
  const clearAllData = () => {
    if (
      !window.confirm(
        "تحذير أمني: سيتم حذف كافة السجلات الحالية من موردين، وفواتير، ومستودعات، وحسابات بنكية وخزنة. هل أنت متأكد من تصفير المنظومة للعمل الشخصي؟",
      )
    ) {
      return;
    }
    setSuppliers([]);
    setInvoices([]);
    setPayments([]);
    setWarehouses([]);
    setSafeBalance(0);
    setCreditNotes([]);
    setBackups([]);
    showToast(
      "✓ تم تصفير قاعدة بيانات المنظومة بالكامل. يمكنك البدء بإضافة سجلاتك الخاصة.",
      "info",
    );
  };

  // Quick Seed the standard Egyptian demo structure if needed
  const loadDemoData = () => {
    if (
      !window.confirm(
        "هل ترغب في إعادة إدخال وتحميل البيانات التجريبية الافتراضية؟ سيتم استبدال البيانات الحالية.",
      )
    ) {
      return;
    }
    setSuppliers(INITIAL_SUPPLIERS);
    setInvoices(INITIAL_INVOICES);
    setPayments(INITIAL_PAYMENTS);
    setWarehouses([
      "مخازن أكتوبر الرئيسية",
      "مستودع العبور لتجهيز الخامات",
      "مخزن الإسكندرية المينائي",
      "مخازن العاشر من رمضان",
    ]);
    setSafeBalance(1500000);
    setCreditNotes([
      {
        id: "cn-1",
        creditNoteNumber: "CN-2026-001",
        supplierId: "sup-1",
        amount: 25000,
        issueDate: "2026-05-15",
        dueDate: "2026-06-15",
        status: "active",
        items: [
          {
            name: "خصم ترويجي للمواد الخام الربع السنوي",
            quantity: 1,
            price: 25000,
          },
        ],
        notes: "خصم ترويجي للمواد الخام الربع السنوي",
      },
    ]);
    showToast("✓ تم بث وتحميل البيانات التجريبية الافتراضية بنجاح.");
  };

  // Automatic backup simulator
  useEffect(() => {
    const interval = setInterval(() => {
      const today = new Date();
      // Only mock log an automatic backup when the component is active if there is any modifications
      console.log("Mawrid automatic backup active routine checking...");
    }, 60000); // 1 minute mock
    return () => clearInterval(interval);
  }, [suppliers, invoices, payments]);

  // AI interactive executive reports summary generator
  const getAiAnalyticsDraft = async () => {
    const apiStats = {
      suppliersCount: suppliers.length,
      invoicesCount: invoices.length,
      unpaidInvoicesCount: invoices.filter((i) => i.status === "unpaid").length,
      totalInvoicesAmount: dashboardStats.totalInvoicesAmount,
      paidAmount: dashboardStats.paidAmount,
      pendingAmount: dashboardStats.pendingAmount,
      paymentRatio: dashboardStats.paymentRatio,
    };

    setIsGeneratingAiSummary(true);
    setAiReportSummary("");

    try {
      const resp = await fetch("/api/reports/ai-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stats: apiStats,
          suppliersList: suppliers.map((s) => ({
            name: s.name,
            company: s.company,
            category: s.category,
          })),
        }),
      });
      const data = await resp.json();
      setAiReportSummary(data.summary || "لا تتوفر تفاصيل كافية.");
    } catch (e: any) {
      console.error(e);
      setAiReportSummary(
        "عذراً، حدث خطأ في النظام الخارجي لمساعد الذكاء الاصطناعي أثناء توليد التلخيص المالي.",
      );
    } finally {
      setIsGeneratingAiSummary(false);
    }
  };

  // Trigger once on loading Reports tab
  useEffect(() => {
    if (activeTab === "reports" && !aiReportSummary) {
      getAiAnalyticsDraft();
    }
  }, [activeTab]);

  // Support Technical Assistant chatbot send action
  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMsg: SupportMessage = {
      id: "msg-" + Date.now(),
      role: "user",
      text: chatInput,
      timestamp: new Date().toISOString(),
    };

    setSupportMessages((prev) => [...prev, userMsg]);
    setChatInput("");
    setIsAiTyping(true);

    const apiStats = {
      suppliersCount: suppliers.length,
      invoicesCount: invoices.length,
      unpaidInvoicesCount: invoices.filter((i) => i.status === "unpaid").length,
      totalInvoicesAmount: dashboardStats.totalInvoicesAmount,
      paidAmount: dashboardStats.paidAmount,
      pendingAmount: dashboardStats.pendingAmount,
    };

    try {
      // Send chat request to our Express server backend API
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMsg.text,
          history: supportMessages.map((m) => ({ role: m.role, text: m.text })),
          stats: apiStats,
        }),
      });
      const data = await response.json();

      const machineMsg: SupportMessage = {
        id: "msg-response-" + Date.now(),
        role: "model",
        text: data.text,
        timestamp: new Date().toISOString(),
      };

      setSupportMessages((prev) => [...prev, machineMsg]);
    } catch (err) {
      console.error("Chat error:", err);
      const offlineMsg: SupportMessage = {
        id: "msg-err-" + Date.now(),
        role: "model",
        text: "عذراً، فشلت عملية الاتصال بخادم خدمات الذكاء الاصطناعي. يرجى التحقق من تفعيل خادم التطبيق ومفاتيح الإعدادات.",
        timestamp: new Date().toISOString(),
      };
      setSupportMessages((prev) => [...prev, offlineMsg]);
    } finally {
      setIsAiTyping(false);
    }
  };

  // Full payment status text helper
  const getFullPaymentStatus = (inv: Invoice) => {
    if (inv.status === "paid") {
      const p = payments.find((pay) => pay.invoiceId === inv.id);
      if (p) {
        if (p.method === "cash") return "تم السداد نقداً";
        if (p.method === "bank_transfer") return "تم السداد بتحويل بنكي";
        if (p.method === "fawry") return "تم السداد بفوري";
        if (p.method === "check") return "تم السداد بشيك";
      }
      return "تم السداد";
    } else {
      const today = new Date().toISOString().split("T")[0];
      if (inv.dueDate < today) {
        return "لم يتم السداد (متجاوزة الاستحقاق)";
      }
      return "مستحقة للدفع";
    }
  };

  const getComponentReportAgingItems = () => {
    const targetSuppliers =
      selectedReportSupplierId === "all"
        ? suppliers
        : suppliers.filter((s) => s.id === selectedReportSupplierId);

    const items: Array<{
      supplier: any;
      totalDebt: number;
      current: number;
      range_1_30: number;
      range_31_60: number;
      range_61_90: number;
      range_91_plus: number;
    }> = [];

    // The current evaluation date is simulated as 2026-06-17 according to metadata
    const evaluationDate = new Date("2026-06-17");

    targetSuppliers.forEach((sup) => {
      const supInvoices = invoices.filter((i) => {
        const matchesSupplier = i.supplierId === sup.id;
        const date =
          (reportDateType === "issue_date" ? i.issueDate : i.dueDate) ||
          "2026-06-01";
        const matchesRange = date >= reportStartDate && date <= reportEndDate;
        const matchesWarehouse =
          reportWarehouseFilter === "all" ||
          i.warehouse === reportWarehouseFilter;
        return matchesSupplier && matchesRange && matchesWarehouse;
      });

      let totalDebt = 0;
      let current = 0;
      let range_1_30 = 0;
      let range_31_60 = 0;
      let range_61_90 = 0;
      let range_91_plus = 0;

      supInvoices.forEach((inv) => {
        const invoicePayments = payments.filter((p) => p.invoiceId === inv.id);
        const paidAmount = invoicePayments.reduce((sum, p) => sum + p.amount, 0);
        const remainingBalance =
          inv.totalAmount - (inv.creditNoteAmount || 0) - paidAmount;

        if (remainingBalance <= 0) return; // Fully paid, no debt aging contribution

        totalDebt += remainingBalance;

        // Calculate age based on due date
        const dueDate = new Date(inv.dueDate || "2026-06-01");
        const diffTime = evaluationDate.getTime() - dueDate.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays <= 0) {
          current += remainingBalance;
        } else if (diffDays >= 1 && diffDays <= 30) {
          range_1_30 += remainingBalance;
        } else if (diffDays >= 31 && diffDays <= 60) {
          range_31_60 += remainingBalance;
        } else if (diffDays >= 61 && diffDays <= 90) {
          range_61_90 += remainingBalance;
        } else {
          range_91_plus += remainingBalance;
        }
      });

      if (totalDebt > 0) {
        items.push({
          supplier: sup,
          totalDebt,
          current,
          range_1_30,
          range_31_60,
          range_61_90,
          range_91_plus,
        });
      }
    });

    return items;
  };

  // Export report to spreadsheet document
  const handleExportReportToExcel = () => {
    let csvContent = "\uFEFF"; // Enable Arabic Excel Compatibility

    const reportSuppliers =
      selectedReportSupplierId === "all"
        ? suppliers
        : suppliers.filter((s) => s.id === selectedReportSupplierId);

    if (reportViewType === "summary") {
      // Summary/Aggregated Excel format
      csvContent +=
        "المورد والشركة,عمليات الشراء النشطة بالفترة,إجمالي فواتير الشراء الأصلية,إجمالي خصومات الإشعارات الدائنة,إجمالي صافي المطلوب سداده,حالة السداد الإجمالية\n";

      reportSuppliers.forEach((sup) => {
        const supInvoices = invoices.filter((i) => {
          const matchesSupplier = i.supplierId === sup.id;
          const date =
            (reportDateType === "issue_date" ? i.issueDate : i.dueDate) ||
            "2026-06-01";
          const matchesRange = date >= reportStartDate && date <= reportEndDate;
          const matchesWarehouse =
            reportWarehouseFilter === "all" ||
            i.warehouse === reportWarehouseFilter;
          return matchesSupplier && matchesRange && matchesWarehouse;
        });

        if (supInvoices.length === 0) return;

        const totalOriginal = supInvoices.reduce(
          (sum, inv) => sum + inv.totalAmount,
          0,
        );
        const totalCN = supInvoices.reduce(
          (sum, inv) => sum + (inv.creditNoteAmount || 0),
          0,
        );
        const totalNet = supInvoices.reduce(
          (sum, inv) => sum + (inv.totalAmount - (inv.creditNoteAmount || 0)),
          0,
        );

        const paidCount = supInvoices.filter((i) =>
          getFullPaymentStatus(i).includes("تم السداد"),
        ).length;

        let overallStatusText = "";
        if (paidCount === supInvoices.length) {
          overallStatusText = "مسددة بالكامل";
        } else if (paidCount > 0) {
          overallStatusText = `مسدد جزئياً (${paidCount}/${supInvoices.length})`;
        } else {
          overallStatusText = "غير مسددة";
        }

        const nameField = `${sup.name} (${sup.company})`.replace(/,/g, " ");

        csvContent += `"${nameField}",${supInvoices.length},${totalOriginal},${totalCN},${totalNet},"${overallStatusText}"\n`;
      });
    } else if (reportViewType === "aging") {
      // Debt Aging Excel Format
      csvContent +=
        "المورد,الشركة,غير مستحق بعد (حالي),1 - 30 يوم,31 - 60 يوم,61 - 90 يوم,أكثر من 90 يوم,إجمالي المديونية القائمة\n";

      const agingItems = getComponentReportAgingItems();
      agingItems.forEach((item) => {
        const name = item.supplier.name.replace(/,/g, " ");
        const company = item.supplier.company.replace(/,/g, " ");
        csvContent += `"${name}","${company}",${item.current},${item.range_1_30},${item.range_31_60},${item.range_61_90},${item.range_91_plus},${item.totalDebt}\n`;
      });
    } else {
      // Detailed Excel format (row-by-row invoice details)
      csvContent +=
        "المورد,الشركة,رقم الفاتورة,تاريخ الإضافة,تاريخ الاستحقاق,المخزن المستلم,قيمة الفاتورة الأصلية,خصم الإشعارات الدائنة,صافي المطلوب سداده,حالة السداد\n";

      reportSuppliers.forEach((sup) => {
        const supInvoices = invoices.filter((i) => {
          const matchesSupplier = i.supplierId === sup.id;
          const date =
            (reportDateType === "issue_date" ? i.issueDate : i.dueDate) ||
            "2026-06-01";
          const matchesRange = date >= reportStartDate && date <= reportEndDate;
          const matchesWarehouse =
            reportWarehouseFilter === "all" ||
            i.warehouse === reportWarehouseFilter;
          return matchesSupplier && matchesRange && matchesWarehouse;
        });

        supInvoices.forEach((inv) => {
          const payableAmount =
            Math.round((inv.totalAmount - (inv.creditNoteAmount || 0)) * 100) /
            100;
          const statusText = getFullPaymentStatus(inv);
          const name = sup.name.replace(/,/g, " ");
          const company = sup.company.replace(/,/g, " ");
          const invoiceNum = inv.invoiceNumber.replace(/,/g, " ");
          const warehouseName = (inv.warehouse || "").replace(/,/g, " ");

          csvContent += `"${name}","${company}","${invoiceNum}","${inv.issueDate || ""}","${inv.dueDate}","${warehouseName}",${inv.totalAmount},${inv.creditNoteAmount || 0},${payableAmount},"${statusText}"\n`;
        });
      });
    }

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);

    const filePrefix =
      reportViewType === "summary"
        ? "إجمالي"
        : reportViewType === "aging"
        ? "أعمار_الديون"
        : "تفصيلي";
    link.setAttribute(
      "download",
      `تقرير_مرسال_${filePrefix}_${reportStartDate}_إلى_${reportEndDate}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`تم تصدير تقرير Excel (${filePrefix}) بنجاح.`);
  };

  // Print report natively
  const handlePrintReport = () => {
    window.print();
  };

  // Filtered lists
  const filteredSuppliers = suppliers.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(supplierSearch.toLowerCase()) ||
      s.company.toLowerCase().includes(supplierSearch.toLowerCase()) ||
      s.phone.includes(supplierSearch);
    const matchesCategory =
      supplierCategoryFilter === "all" || s.category === supplierCategoryFilter;
    return matchesSearch && matchesCategory;
  });

  const filteredInvoices = invoices.filter((i) => {
    const supplier = suppliers.find((s) => s.id === i.supplierId);
    const matchesSearch =
      i.invoiceNumber.toLowerCase().includes(invoiceSearch.toLowerCase()) ||
      (supplier &&
        supplier.name.toLowerCase().includes(invoiceSearch.toLowerCase())) ||
      (supplier &&
        supplier.company.toLowerCase().includes(invoiceSearch.toLowerCase()));
    const matchesStatus =
      invoiceStatusFilter === "all" || i.status === invoiceStatusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredCreditNotes = creditNotes.filter((cn) => {
    const supplier = suppliers.find((s) => s.id === cn.supplierId);
    const matchesSearch =
      cn.creditNoteNumber.toLowerCase().includes(invoiceSearch.toLowerCase()) ||
      (supplier &&
        supplier.name.toLowerCase().includes(invoiceSearch.toLowerCase())) ||
      (supplier &&
        supplier.company.toLowerCase().includes(invoiceSearch.toLowerCase())) ||
      (cn.notes &&
        cn.notes.toLowerCase().includes(invoiceSearch.toLowerCase()));
    const matchesStatus =
      invoiceStatusFilter === "all" ||
      (invoiceStatusFilter === "unpaid" && cn.status === "active") ||
      (invoiceStatusFilter === "paid" && cn.status === "applied");
    return matchesSearch && matchesStatus;
  });

  // Analytics distribution data for Recharts
  const getPortfolioDistributionData = () => {
    // Group invoices total value by category or by supplier group
    const dict: { [key: string]: number } = {};
    const dateFilteredInvoices = invoices.filter((i) => {
      const date =
        (reportDateType === "issue_date" ? i.issueDate : i.dueDate) ||
        "2026-06-01";
      return date >= reportStartDate && date <= reportEndDate;
    });

    const targetInvoices = dateFilteredInvoices.filter((i) => {
      const matchesSupplier =
        selectedReportSupplierId === "all" ||
        i.supplierId === selectedReportSupplierId;
      const matchesWarehouse =
        reportWarehouseFilter === "all" ||
        i.warehouse === reportWarehouseFilter;
      return matchesSupplier && matchesWarehouse;
    });

    targetInvoices.forEach((inv) => {
      const supplier = suppliers.find((s) => s.id === inv.supplierId);
      const cat = supplier ? supplier.category : "أخرى";
      dict[cat] =
        (dict[cat] || 0) + (inv.totalAmount - (inv.creditNoteAmount || 0));
    });

    return Object.keys(dict).map((name, i) => ({
      name,
      value: dict[name],
      fill: ["#0284c7", "#f59e0b", "#10b981", "#8b5cf6", "#ec4899"][i % 5],
    }));
  };

  const getMonthlyFinancialsData = () => {
    const start = new Date(reportStartDate);
    const end = new Date(reportEndDate);

    // We want to collect all months between start and end (inclusive)
    const months: {
      year: number;
      month: number;
      label: string;
      key: string;
    }[] = [];
    const current = new Date(start.getFullYear(), start.getMonth(), 1);
    const stop = new Date(end.getFullYear(), end.getMonth(), 1);

    const arabicMonths = [
      "يناير",
      "فبراير",
      "مارس",
      "أبريل",
      "مايو",
      "يونيو",
      "يوليو",
      "أغسطس",
      "سبتمبر",
      "أكتوبر",
      "نوفمبر",
      "ديسمبر",
    ];

    // Safety check to prevent infinite loop
    let limit = 0;
    while (current <= stop && limit < 120) {
      const y = current.getFullYear();
      const m = current.getMonth();
      const label = `${arabicMonths[m]} ${y}`;
      const key = `${y}-${String(m + 1).padStart(2, "0")}`;

      months.push({ year: y, month: m, label, key });
      current.setMonth(current.getMonth() + 1);
      limit++;
    }

    // If date range is small/invalid, default to last 3 months
    if (months.length === 0) {
      return [
        {
          name: "أبريل 2026",
          "إجمالي المشتريات": 290000,
          "إجمالي المسدد": 290000,
        },
        {
          name: "مايو 2026",
          "إجمالي المشتريات": 400000,
          "إجمالي المسدد": 110000,
        },
        { name: "يونيو 2026", "إجمالي المشتريات": 272000, "إجمالي المسدد": 0 },
      ];
    }

    return months.map((m) => {
      // Filter invoices in this month that are within the selected supplier and date range
      const inMonthInvoices = invoices.filter((i) => {
        const date =
          (reportDateType === "issue_date" ? i.issueDate : i.dueDate) ||
          "2026-06-01";
        // Check if date belongs to this year-month and is also within general range
        const matchesMonth = date.startsWith(m.key);
        const matchesRange = date >= reportStartDate && date <= reportEndDate;
        const matchesSupplier =
          selectedReportSupplierId === "all" ||
          i.supplierId === selectedReportSupplierId;
        const matchesWarehouse =
          reportWarehouseFilter === "all" ||
          i.warehouse === reportWarehouseFilter;
        return (
          matchesMonth && matchesRange && matchesSupplier && matchesWarehouse
        );
      });

      const purchaseSum = inMonthInvoices.reduce(
        (sum, curr) => sum + (curr.totalAmount - (curr.creditNoteAmount || 0)),
        0,
      );

      // Filter payments in this month that are within the selected supplier and date range
      const inMonthPayments = payments.filter((p) => {
        const date = p.paymentDate || "2026-06-01";
        const matchesMonth = date.startsWith(m.key);
        const matchesRange = date >= reportStartDate && date <= reportEndDate;
        const matchesSupplier =
          selectedReportSupplierId === "all" ||
          p.supplierId === selectedReportSupplierId;

        let matchesWarehouse = true;
        if (reportWarehouseFilter !== "all") {
          const inv = invoices.find((i) => i.id === p.invoiceId);
          matchesWarehouse = inv
            ? inv.warehouse === reportWarehouseFilter
            : false;
        }

        return (
          matchesMonth && matchesRange && matchesSupplier && matchesWarehouse
        );
      });

      const paidSum = inMonthPayments.reduce(
        (sum, curr) => sum + curr.amount,
        0,
      );

      return {
        name: m.label,
        "إجمالي المشتريات": purchaseSum,
        "إجمالي المسدد": paidSum,
      };
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc] text-slate-850 font-sans selection:bg-emerald-500 selection:text-white pb-10">
      {/* Toast Alert */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={`fixed top-4 left-4 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl border backdrop-blur-md ${
              toast.type === "success"
                ? "bg-emerald-50 text-emerald-800 border-emerald-200/80 shadow-emerald-500/5"
                : toast.type === "error"
                  ? "bg-rose-50 text-rose-800 border-rose-200/80 shadow-rose-500/5"
                  : "bg-amber-50 text-amber-800 border-amber-200/80 shadow-amber-500/5"
            }`}
          >
            {toast.type === "success" && (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            )}
            {toast.type === "error" && (
              <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            {toast.type === "info" && (
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            )}
            <span className="text-sm font-bold">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Corporate Arabic Header */}
      <header className="no-print bg-white/95 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-40 px-4 sm:px-6 pt-[calc(1rem+env(safe-area-inset-top,0px))] pb-4 shadow-xl">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-slate-100/60 px-3 py-1.5 rounded-2xl border border-slate-200 flex items-center justify-center">
              <MersalLogo
                width={110}
                height={110}
                isDarkBackground={false}
                className="h-14 w-auto -my-3"
              />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-950 flex flex-wrap items-center gap-2">
                مستشفى مرسال للأطفال - Marsal Children's Hospital
                <span className="inline-flex items-center justify-center text-xs bg-emerald-500/15 text-emerald-600 font-semibold px-2.5 py-1 leading-none rounded-full border border-emerald-500/20 align-middle h-fit">
                  للإصدار المالي
                </span>
              </h1>
              <p className="text-xs text-slate-600">
                المنظومة المالية المتكاملة لإدارة المشتريات والموردين والمدفوعات
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 self-end md:self-auto no-print">
            {/* System Diagnostics & Reset Module */}
            <div className="flex items-center gap-2 bg-slate-100/60 p-1.5 rounded-2xl border border-slate-200/80 shadow-inner">
              {/* Local Storage Live Status Badge */}
              <div className="flex flex-col items-start gap-0.5 px-2 py-0.5">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 " />
                  <span className="text-[11px] text-slate-800 font-semibold font-sans">
                    الوضع المحلي نشط ومستقر
                  </span>
                </div>
                <span className="text-[9px] text-teal-400 font-sans block leading-none">مزامنة فائقة السرعة</span>
              </div>

              {/* Action Buttons to Reset */}
              <div className="flex items-center gap-1 border-r border-slate-200/80 pr-1.5 mr-0.5">
                <button
                  type="button"
                  onClick={() => setShowResetConfirmModal(true)}
                  disabled={isResettingDb}
                  className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-950 text-rose-600 hover:text-rose-350 border border-slate-200/50 hover:border-rose-500/20 transition-all disabled:opacity-50 cursor-pointer shadow-xs relative group"
                  title="تصفير كافة البيانات ومسح الفواتير بالكامل"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* System notifications feed triggers */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors relative shadow-sm cursor-pointer"
              >
                <Bell className="w-5 h-5 text-slate-600" />
                {alerts.length > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-rose-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full ring-2 ring-white shadow-xs">
                    {alerts.length}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {showNotifications && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute left-0 mt-3 w-80 md:w-96 bg-white border border-slate-200/90 rounded-2xl shadow-xl z-50 p-4 text-right"
                  >
                    <div className="flex items-center justify-between border-b border-slate-200/60 pb-3 mb-3">
                      <span className="font-bold text-slate-800 text-sm">
                        تنبيهات المدفوعات المستحقة
                      </span>
                      <span className="text-xs text-slate-705 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200/50">
                        {alerts.length} تنبيهات
                      </span>
                    </div>
                    <div className="space-y-2 max-h-72 overflow-y-auto">
                      {alerts.length === 0 ? (
                        <p className="text-xs text-center text-slate-400 py-6">
                          لا توجد فواتير معلقة متأخرة حالياً.
                        </p>
                      ) : (
                        alerts.map((al, idx) => (
                          <div
                            key={idx}
                            className="p-3 rounded-lg bg-rose-50 text-rose-800 text-xs border border-rose-100 leading-normal font-sans"
                          >
                            {al}
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Simulated Live Profiles & Permissions switcher */}
            <div className="flex items-center gap-2 bg-slate-100/80 p-1.5 rounded-xl border border-slate-200">
              <div className="hidden lg:flex flex-col text-left px-2">
                <span className="text-[10px] text-slate-600 font-medium">
                  حساب الصلاحيات النشط:
                </span>
                <span className="text-xs font-bold text-slate-800">
                  {currentRole === UserRole.ADMIN
                    ? "مدير النظام (كامل الصلاحية)"
                    : currentRole === UserRole.ACCOUNTANT
                      ? "محاسب / مدير حسابات"
                      : "مراقب مالي (عرض فقط)"}
                </span>
              </div>
              <select
                value={currentRole}
                onChange={(e) => {
                  setCurrentRole(e.target.value as UserRole);
                  showToast(
                    `تم التغيير إلى صلاحيات: ${e.target.value === UserRole.ADMIN ? "مدير النظام" : e.target.value === UserRole.ACCOUNTANT ? "المحاسب" : "مراقب مالي"}`,
                  );
                }}
                className="bg-white text-slate-800 border border-slate-200 text-xs font-bold px-3 py-1.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
              >
                <option value={UserRole.ADMIN}>مدير النظام</option>
                <option value={UserRole.ACCOUNTANT}>محاسب مالي</option>
                <option value={UserRole.VIEWER}>مراقب مالي</option>
              </select>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container Layout */}
      <main className="max-w-7xl mx-auto px-4 md:px-6 mt-6 flex-1 w-full flex flex-col lg:flex-row gap-6">
        {/* RIGHT SIDEBAR - Tab controller and dynamic Navigation */}
        <aside className="no-print w-full lg:w-64 shrink-0">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-2.5 lg:p-4 shadow-xl flex flex-row lg:flex-col gap-1.5 overflow-x-auto lg:overflow-x-visible lg:sticky lg:top-24 z-30 w-full no-scrollbar">
            <p className="hidden lg:block text-[11px] font-bold text-slate-500 tracking-wider uppercase px-3 pb-2 border-b border-slate-200/65 mb-2">
              القائمة المالية
            </p>

            <button
              onClick={() => setActiveTab("suppliers")}
              className={`shrink-0 lg:shrink flex items-center gap-2 lg:gap-3 px-3 py-2 lg:py-3 text-xs lg:text-sm font-semibold rounded-xl transition-all whitespace-nowrap ${
                activeTab === "suppliers"
                  ? "bg-emerald-500/10 text-emerald-600 shadow-[0_2px_12px_rgba(16,185,129,0.08)] border border-emerald-500/25"
                  : "text-slate-600 hover:bg-slate-100/60 hover:text-slate-900"
              }`}
            >
              <Users className="w-4 h-4 lg:w-5 lg:h-5 shrink-0" />
              <span>إدارة الموردين ({suppliers.length})</span>
            </button>

            <button
              onClick={() => setActiveTab("invoices")}
              className={`shrink-0 lg:shrink flex items-center gap-2 lg:gap-3 px-3 py-2 lg:py-3 text-xs lg:text-sm font-semibold rounded-xl transition-all whitespace-nowrap ${
                activeTab === "invoices"
                  ? "bg-emerald-500/10 text-emerald-600 shadow-[0_2px_12px_rgba(16,185,129,0.08)] border border-emerald-500/25"
                  : "text-slate-600 hover:bg-slate-100/60 hover:text-slate-900"
              }`}
            >
              <Receipt className="w-4 h-4 lg:w-5 lg:h-5 shrink-0" />
              <span>فواتير المشتريات ({invoices.length})</span>
            </button>

            <button
              onClick={() => setActiveTab("payments")}
              className={`shrink-0 lg:shrink flex items-center gap-2 lg:gap-3 px-3 py-2 lg:py-3 text-xs lg:text-sm font-semibold rounded-xl transition-all whitespace-nowrap ${
                activeTab === "payments"
                  ? "bg-emerald-500/10 text-emerald-600 shadow-[0_2px_12px_rgba(16,185,129,0.08)] border border-emerald-500/25"
                  : "text-slate-600 hover:bg-slate-100/60 hover:text-slate-900"
              }`}
            >
              <CreditCard className="w-4 h-4 lg:w-5 lg:h-5 shrink-0" />
              <span>سجل المدفوعات</span>
            </button>

            <button
              onClick={() => setActiveTab("banking")}
              className={`shrink-0 lg:shrink flex items-center gap-2 lg:gap-3 px-3 py-2 lg:py-3 text-xs lg:text-sm font-semibold rounded-xl transition-all whitespace-nowrap ${
                activeTab === "banking"
                  ? "bg-emerald-500/10 text-emerald-600 shadow-[0_2px_12px_rgba(16,185,129,0.08)] border border-emerald-500/25"
                  : "text-slate-600 hover:bg-slate-100/60 hover:text-slate-900"
              }`}
            >
              <Building className="w-4 h-4 lg:w-5 lg:h-5 shrink-0" />
              <span>التكامل البنكي والتسوية</span>
            </button>

            <p className="hidden lg:block text-[11px] font-bold text-slate-500 tracking-wider uppercase px-3 pt-4 pb-2 border-b border-slate-200/65 mb-2">
              التحليلات والمتابعة
            </p>

            <button
              onClick={() => setActiveTab("reports")}
              className={`shrink-0 lg:shrink flex items-center gap-2 lg:gap-3 px-3 py-2 lg:py-3 text-xs lg:text-sm font-semibold rounded-xl transition-all whitespace-nowrap ${
                activeTab === "reports"
                  ? "bg-emerald-500/10 text-emerald-600 shadow-[0_2px_12px_rgba(16,185,129,0.08)] border border-emerald-500/25"
                  : "text-slate-600 hover:bg-slate-100/60 hover:text-slate-900"
              }`}
            >
              <FileText className="w-4 h-4 lg:w-5 lg:h-5 shrink-0" />
              <span>التقارير التحليلية والتحميل</span>
            </button>

            <button
              onClick={() => setActiveTab("warehouses")}
              className={`shrink-0 lg:shrink flex items-center gap-2 lg:gap-3 px-3 py-2 lg:py-3 text-xs lg:text-sm font-semibold rounded-xl transition-all whitespace-nowrap ${
                activeTab === "warehouses"
                  ? "bg-emerald-500/10 text-emerald-600 shadow-[0_2px_12px_rgba(16,185,129,0.08)] border border-emerald-500/25"
                  : "text-slate-600 hover:bg-slate-100/60 hover:text-slate-900"
              }`}
            >
              <Warehouse className="w-4 h-4 lg:w-5 lg:h-5 shrink-0" />
              <span>إدارة المخازن ({warehouses.length})</span>
            </button>

            <button
              onClick={() => setActiveTab("backups")}
              className={`shrink-0 lg:shrink flex items-center gap-2 lg:gap-3 px-3 py-2 lg:py-3 text-xs lg:text-sm font-semibold rounded-xl transition-all whitespace-nowrap ${
                activeTab === "backups"
                  ? "bg-emerald-500/10 text-emerald-600 shadow-[0_2px_12px_rgba(16,185,129,0.08)] border border-emerald-500/25"
                  : "text-slate-600 hover:bg-slate-100/60 hover:text-slate-900"
              }`}
            >
              <Database className="w-4 h-4 lg:w-5 lg:h-5 shrink-0" />
              <span>النسخ الاحتياطي التلقائي</span>
            </button>
          </div>
        </aside>

        {/* CONTENT BOX - Tab Views */}
        <div className="flex-1 min-w-0">
          {/* Dashboard Summary Statistics Bar (Always rendered at the top of content tabs in screen) */}
          <div className="no-print grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
            <div className="bg-white backdrop-blur-md p-5 rounded-2xl border border-slate-200/80 hover:border-slate-300/80 shadow-[0_4px_20px_rgba(0,0,0,0.04)] flex items-center justify-between transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_6px_25px_rgba(0,0,0,0.08)]">
              <div>
                <p className="text-xs text-slate-500 font-semibold mb-1">
                  إجمالي المشتريات
                </p>
                <p className="text-lg md:text-xl font-extrabold text-slate-800 mt-1">
                  {fAmt(dashboardStats.totalInvoicesAmount)}{" "}
                  <span className="text-xs text-slate-500 font-normal">ج.م</span>
                </p>
                <div className="flex items-center gap-1 mt-1.5 text-slate-400 text-[10px]">
                  <Activity className="w-3.5 h-3.5 text-slate-400" />
                  <span>تاريخ آخر تحديث اليوم</span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 border border-slate-200/50">
                <Receipt className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-emerald-50/40 backdrop-blur-md p-5 rounded-2xl border border-emerald-200 hover:border-emerald-300 shadow-[0_4px_20px_rgba(16,185,129,0.02)] flex items-center justify-between transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_6px_25px_rgba(16,185,129,0.06)]">
              <div>
                <p className="text-xs text-emerald-700/90 font-semibold mb-1">
                  إجمالي المسدد
                </p>
                <p className="text-lg md:text-xl font-extrabold text-emerald-600 mt-1">
                  {fAmt(dashboardStats.paidAmount)}{" "}
                  <span className="text-xs text-emerald-700/60 font-normal">ج.م</span>
                </p>
                <div className="flex items-center gap-1 mt-1.5 text-emerald-700/80 text-[10px] font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>معدل تسوية {dashboardStats.paymentRatio}%</span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-100/60 flex items-center justify-center text-emerald-600 border border-emerald-200/55">
                <Check className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-rose-50/40 backdrop-blur-md p-5 rounded-2xl border border-rose-200 hover:border-rose-300 shadow-[0_4px_20px_rgba(244,63,94,0.02)] flex items-center justify-between transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_6px_25px_rgba(244,63,94,0.06)]">
              <div>
                <p className="text-xs text-rose-700 font-semibold mb-1">
                  المديونية المستحقة
                </p>
                <p className="text-lg md:text-xl font-extrabold text-rose-600 mt-1">
                  {fAmt(dashboardStats.pendingAmount)}{" "}
                  <span className="text-xs text-rose-700/60 font-normal">ج.م</span>
                </p>
                <div className="flex items-center gap-1 mt-1.5 text-rose-600 text-[10px] font-semibold">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
                  <span>
                    {dashboardStats.unpaidInvoicesCount} فواتير تحتاج سداد
                  </span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-rose-100/60 flex items-center justify-center text-rose-600 border border-rose-200/55">
                <ShieldAlert className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-purple-50/40 backdrop-blur-md p-5 rounded-2xl border border-purple-200 hover:border-purple-300 shadow-[0_4px_20px_rgba(168,85,247,0.02)] flex items-center justify-between transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_6px_25px_rgba(168,85,247,0.06)]">
              <div>
                <p className="text-xs text-purple-700 font-semibold mb-1">
                  حساب الموردين
                </p>
                <p className="text-lg md:text-xl font-extrabold text-purple-600 mt-1">
                  {dashboardStats.suppliersCount}{" "}
                  <span className="text-xs text-purple-700/60 font-normal">موردين</span>
                </p>
                <div className="flex items-center gap-1 mt-1.5 text-purple-600/80 text-[10px] font-semibold">
                  <UserCheck className="w-3.5 h-3.5 text-purple-500" />
                  <span>مصنفين حسب الخدمات</span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-purple-100/60 flex items-center justify-center text-purple-600 border border-purple-200/55">
                <Users className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* VIEW: SUPPLIERS */}
          {activeTab === "suppliers" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Filter controls and add buttons */}
              <div className="bg-white backdrop-blur-md p-4 rounded-2xl border border-slate-200/80 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4 animate-fadeIn">
                <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
                  {/* Search Bar */}
                  <div className="relative w-full md:w-64">
                    <input
                      type="text"
                      placeholder="ابحث باسم المورد أو الشركة..."
                      value={supplierSearch}
                      onChange={(e) => setSupplierSearch(e.target.value)}
                      className="w-full text-xs border border-slate-200/80 px-3 py-2.5 pr-8 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-slate-50 border-slate-200 text-slate-800 transition-all"
                    />
                    <Users className="w-4 h-4 text-slate-500 absolute right-3 top-3.5" />
                  </div>
                </div>

                <button
                  onClick={() => setShowAddSupplierModal(true)}
                  className="w-full md:w-auto flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-bold px-5 py-3 rounded-xl shadow-md cursor-pointer transition-all duration-200"
                >
                  <Plus className="w-4 h-4" />
                  <span>إضافة مورد جديد</span>
                </button>
              </div>

              {/* Grid / List of suppliers */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredSuppliers.length === 0 ? (
                  <div className="col-span-2 bg-slate-50/50 rounded-2xl border border-slate-200/80 p-12 text-center text-slate-600 text-sm">
                    لا يوجد موردين متوافقين مع معايير البحث الحالية.
                  </div>
                ) : (
                  filteredSuppliers.map((sup) => {
                    const supInvoices = invoices.filter(
                      (i) => i.supplierId === sup.id,
                    );
                    const supPaid = payments
                      .filter((p) => p.supplierId === sup.id)
                      .reduce((sum, p) => sum + p.amount, 0);
                    const supTotal = supInvoices.reduce(
                      (sum, i) => sum + i.totalAmount,
                      0,
                    );
                    const supPending = supInvoices
                      .filter((i) => i.status === "unpaid")
                      .reduce((sum, i) => sum + i.totalAmount, 0);

                    return (
                      <motion.div
                        key={sup.id}
                        layout
                        onClick={() => {
                          setInvoiceSearch(sup.name);
                          setActiveTab("invoices");
                        }}
                        className="bg-white backdrop-blur-xs rounded-2xl border border-slate-200/90 p-5 shadow-sm hover:shadow-[0_4px_25px_rgba(16,185,129,0.08)] hover:bg-slate-50 hover:border-emerald-550/40 hover:border-emerald-550 hover:border-emerald-500/40 transition-all duration-300 flex flex-col justify-between cursor-pointer group"
                      >
                        <div>
                          <div className="flex items-start justify-between">
                            <div>
                              <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full border border-emerald-500/20">
                                {sup.category}
                              </span>
                              <h3 className="text-base font-bold text-slate-900 mt-1.5 group-hover:text-emerald-600 transition-colors flex items-center gap-1">
                                {sup.name}
                              </h3>
                              <p className="text-xs text-emerald-600 font-semibold mt-0.5">
                                {sup.company}
                              </p>
                              <span className="text-[9px] text-slate-500 mt-1 block group-hover:text-emerald-600 group-hover:underline">
                                👤 اضغط لعرض كشف فواتير المورد
                              </span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!checkPermission("write")) return;
                                  setNewInvoice({
                                    supplierId: sup.id,
                                    invoiceNumber: `INV-2026-${Math.floor(1000 + Math.random() * 9000)}`,
                                    dueDate: new Date(
                                      Date.now() + 15 * 24 * 60 * 60 * 1000,
                                    )
                                      .toISOString()
                                      .split("T")[0],
                                    notes: "",
                                    items: [
                                      {
                                        name: "بند شحنة",
                                        quantity: 1,
                                        price: 0,
                                      },
                                    ],
                                    vatRate: 14,
                                    warehouse: "مخزن رئيسي",
                                  });
                                  setShowAddInvoiceModal(true);
                                }}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-2 py-1 text-[10px] rounded shadow flex items-center gap-1 cursor-pointer transition-colors"
                                title="سجّل فاتورة شراء جديدة على هذا المورد"
                              >
                                <Plus className="w-3 h-3" />
                                <span>إضافة فاتورة</span>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!checkPermission("write")) return;
                                  setEditingSupplier(sup);
                                }}
                                className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-500/10 rounded-lg transition-colors cursor-pointer"
                                title="تعديل بيانات المورد"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteSupplier(sup.id, sup.name);
                                }}
                                className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                                title="حذف هذا المورد"
                              >
                                <Trash2 className="w-4.5 h-4.5" />
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 pt-4 border-t border-slate-200 text-xs text-slate-700">
                            <div>
                              <span className="text-slate-600 block mb-0.5">
                                رقم الهاتف:
                              </span>
                              <span className="font-semibold text-slate-800 font-mono">{sup.phone}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-600 block mb-0.5">
                                البريد الإلكتروني:
                              </span>
                              <span className="font-semibold text-slate-800 break-all">{sup.email}
                              </span>
                            </div>
                            <div className="col-span-1 sm:col-span-2">
                              <span className="text-slate-600 block mb-0.5">
                                رقم الحساب البنكي / IBAN:
                              </span>
                              <span className="font-mono text-slate-700 text-[11px] block bg-slate-50/60 p-1 px-2 rounded border border-slate-200">
                                {sup.bankAccount}
                              </span>
                            </div>
                            <div className="col-span-1 sm:col-span-2">
                              <span className="text-slate-600 block mb-0.5">
                                العنوان المسجل:
                              </span>
                              <span className="text-slate-700 text-xs">
                                {sup.address}
                              </span>
                            </div>
                          </div>

                          {/* Credit Notes (إشعارات دائنة) Section */}
                          {(() => {
                            const supCreditNotes = creditNotes.filter(
                              (cn) => cn.supplierId === sup.id,
                            );
                            return (
                              <div className="mt-4 pt-4 border-t border-slate-200">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                    <FileText className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>
                                      الإشعارات الدائنة ({supCreditNotes.length}
                                      )
                                    </span>
                                  </span>
                                  <button
                                    onClick={() => {
                                      if (!checkPermission("write")) return;
                                      setNewCreditNote({
                                        supplierId: sup.id,
                                        invoiceId: "",
                                        creditNoteNumber: `CN-2026-${Math.floor(100 + Math.random() * 900)}`,
                                        amount: 0,
                                        issueDate: "2026-06-07",
                                        dueDate: "2026-06-22",
                                        notes: "",
                                        items: [
                                          { name: "", quantity: 1, price: 0 },
                                        ],
                                      });
                                      setShowAddCreditNoteModal(true);
                                    }}
                                    className="text-[10px] bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-600 font-bold px-2.5 py-1 rounded-lg border border-emerald-500/20 flex items-center gap-1 cursor-pointer transition-colors"
                                  >
                                    <Plus className="w-3 h-3" />
                                    <span>إضافة إشعار</span>
                                  </button>
                                </div>

                                {supCreditNotes.length === 0 ? (
                                  <p className="text-[10px] text-slate-500 italic">
                                    لا توجد إشعارات دائنة نشطة.
                                  </p>
                                ) : (
                                  <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                                    {supCreditNotes.map((cn) => (
                                      <div
                                        key={cn.id}
                                        className="flex items-center justify-between bg-slate-50/60 p-2 rounded-lg border border-slate-200 text-[10px]"
                                      >
                                        <div className="flex flex-col">
                                          <span className="font-semibold text-slate-800">{cn.creditNoteNumber}{" "}
                                            <span className="text-slate-500 font-mono text-[9px]">
                                              ({cn.issueDate})
                                            </span>
                                          </span>
                                          {cn.dueDate && (
                                            <span className="text-slate-600 text-[9px]">
                                              استحقاق:{" "}
                                              <span className="font-mono text-slate-700">
                                                {cn.dueDate}
                                              </span>
                                            </span>
                                          )}
                                          {cn.notes && (
                                            <span className="text-slate-600 text-[9px] truncate max-w-[150px]">
                                              {cn.notes}
                                            </span>
                                          )}
                                          {cn.items && cn.items.length > 0 && (
                                            <div
                                              className="text-[9px] text-emerald-600 max-w-[180px] truncate mt-0.5"
                                              title={cn.items
                                                .map(
                                                  (item) =>
                                                    `${item.name} (${item.quantity} × ${fAmt(item.price)} ج.م)`,
                                                )
                                                .join("\n")}
                                            >
                                              <span className="text-slate-500">
                                                البنود:{" "}
                                              </span>
                                              {cn.items
                                                .map(
                                                  (item) =>
                                                    `${item.name} (${item.quantity}×)`,
                                                )
                                                .join("، ")}
                                            </div>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <span className="font-bold text-emerald-600 font-mono">
                                            {fAmt(cn.amount)} ج.م
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleToggleCreditNoteStatus(
                                                cn.id,
                                              )
                                            }
                                            className={`px-1.5 py-0.5 rounded text-[8px] font-bold border transition-colors cursor-pointer ${
                                              cn.status === "active"
                                                ? "bg-amber-500/10 border-amber-500/20 text-amber-600 hover:bg-amber-500/25"
                                                : "bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200"
                                            }`}
                                            title={
                                              cn.status === "active"
                                                ? "اضغط لتعيين كمنتهى/مُطبّق"
                                                : "اضغط لتعيين كنشط"
                                            }
                                          >
                                            {cn.status === "active"
                                              ? "نشط"
                                              : "مُطبّق"}
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleInitiateEditCreditNote(cn)
                                            }
                                            className="text-slate-500 hover:text-emerald-600 p-0.5 rounded hover:bg-emerald-500/10 transition-colors cursor-pointer"
                                            title="تعديل الإشعار"
                                          >
                                            <Edit className="w-3 h-3" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleDeleteCreditNote(
                                                cn.id,
                                                cn.creditNoteNumber,
                                              )
                                            }
                                            className="text-slate-500 hover:text-rose-600 p-0.5 rounded hover:bg-rose-500/10 transition-colors cursor-pointer"
                                            title="حذف الإشعار"
                                          >
                                            <Trash2 className="w-3 h-3" />
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>

                        {(() => {
                          const supInvoices = invoices.filter(
                            (i) => i.supplierId === sup.id,
                          );
                          const supTotal = supInvoices.reduce(
                            (sum, i) => sum + i.totalAmount,
                            0,
                          );
                          const supPending = supInvoices
                            .filter((i) => i.status === "unpaid")
                            .reduce((sum, i) => sum + i.totalAmount, 0);
                          const activeCNTotal = creditNotes
                            .filter(
                              (cn) =>
                                cn.supplierId === sup.id &&
                                cn.status === "active",
                            )
                            .reduce((sum, cn) => sum + cn.amount, 0);
                          const netPending = Math.max(
                            0,
                            supPending - activeCNTotal,
                          );

                          return (
                            <div className="mt-5 pt-4 border-t border-slate-200 flex items-center justify-between text-xs bg-slate-50/60/60 -mx-5 -mb-5 px-5 py-3 rounded-b-2xl">
                              <div>
                                <span className="text-slate-600 block mb-0.5">
                                  إجمالي الفواتير / دائنة:
                                </span>
                                <span className="font-bold text-slate-800">{fAmt(supTotal)}{" "}
                                  <span className="text-[10px] text-slate-600">
                                    ج.م
                                  </span>{" "}
                                  {activeCNTotal > 0 && (
                                    <span className="text-emerald-600 font-mono text-[10px]">
                                      (-{fAmt(activeCNTotal)})
                                    </span>
                                  )}
                                </span>
                              </div>
                              <div className="text-left">
                                <span className="text-slate-600 block mb-0.5">
                                  الصافي بعد الإشعارات:
                                </span>
                                <span
                                  className={`font-bold ${netPending > 0 ? "text-red-400" : "text-emerald-600"}`}
                                >
                                  {fAmt(netPending)}{" "}
                                  <span className="text-[10px]">ج.م</span>
                                </span>
                              </div>
                            </div>
                          );
                        })()}
                      </motion.div>
                    );
                  })
                )}
              </div>
            </motion.div>
          )}

          {/* VIEW: INVOICES */}
          {activeTab === "invoices" &&
            (() => {
              const displayedItems = [
                ...(invoiceTypeFilter === "all" ||
                invoiceTypeFilter === "invoices"
                  ? filteredInvoices.map((inv) => ({
                      ...inv,
                      itemType: "invoice" as const,
                    }))
                  : []),
                ...(invoiceTypeFilter === "all" ||
                invoiceTypeFilter === "credit_notes"
                  ? filteredCreditNotes.map((cn) => ({
                      ...cn,
                      itemType: "credit_note" as const,
                    }))
                  : []),
              ].sort((a, b) => b.issueDate.localeCompare(a.issueDate));

              return (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  {/* Search and filter toolbar */}
                  <div className="bg-white backdrop-blur-md p-4 rounded-2xl border border-slate-200/80 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4 animate-fadeIn">
                    <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
                      {/* Invoice search */}
                      <div className="relative w-full md:w-64">
                        <input
                          type="text"
                          placeholder="ابحث برقم الفاتورة، الإشعار أو المورد..."
                          value={invoiceSearch}
                          onChange={(e) => setInvoiceSearch(e.target.value)}
                          className="w-full text-xs border border-slate-200/80 px-3 py-2.5 pr-8 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-slate-50 border-slate-200 text-slate-800 transition-all"
                        />
                        <Search className="w-4 h-4 text-slate-500 absolute right-3 top-3.5" />
                      </div>

                      {/* Status filter */}
                      <div className="w-full md:w-auto">
                        <select
                          value={invoiceStatusFilter}
                          onChange={(e) =>
                            setInvoiceStatusFilter(e.target.value)
                          }
                          className="w-full text-xs border border-slate-200/80 px-3 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer bg-[#f8fafc]/80 text-slate-900 font-bold transition-all"
                        >
                          <option value="all">كل حالات السداد / التطبيق</option>
                          <option value="unpaid">غير مسدد / كإشعار نشط</option>
                          <option value="paid">
                            تم السداد / كإشعار مُطبّق
                          </option>
                        </select>
                      </div>
                    </div>

                    <button
                      onClick={() => setShowAddInvoiceModal(true)}
                      className="w-full md:w-auto flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-bold px-5 py-3 rounded-xl shadow-md cursor-pointer transition-all duration-200"
                    >
                      <Plus className="w-4 h-4" />
                      <span>تسجيل فاتورة جديدة</span>
                    </button>
                  </div>

                  {/* Sub-tabs selector for Invoices & Credit Notes */}
                  <div className="flex border-b border-slate-200/60">
                    <button
                      onClick={() => setInvoiceTypeFilter("all")}
                      className={`px-5 py-3 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
                        invoiceTypeFilter === "all"
                          ? "border-emerald-500 text-emerald-600 font-extrabold"
                          : "border-transparent text-slate-600 hover:text-slate-800"
                      }`}
                    >
                      <Receipt className="w-3.5 h-3.5" />
                      <span>
                        الكل (
                        {filteredInvoices.length + filteredCreditNotes.length})
                      </span>
                    </button>
                    <button
                      onClick={() => setInvoiceTypeFilter("invoices")}
                      className={`px-5 py-3 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
                        invoiceTypeFilter === "invoices"
                          ? "border-emerald-500 text-emerald-600 font-extrabold"
                          : "border-transparent text-slate-600 hover:text-slate-800"
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>فواتير المشتريات ({filteredInvoices.length})</span>
                    </button>
                    <button
                      onClick={() => setInvoiceTypeFilter("credit_notes")}
                      className={`px-5 py-3 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
                        invoiceTypeFilter === "credit_notes"
                          ? "border-emerald-500 text-emerald-600 font-extrabold"
                          : "border-transparent text-slate-600 hover:text-slate-800"
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5 text-emerald-600" />
                      <span>
                        الإشعارات الدائنة ({filteredCreditNotes.length})
                      </span>
                    </button>
                  </div>

                  {/* Combined list display */}
                  <div className="space-y-4">
                    {displayedItems.length === 0 ? (
                      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 text-sm shadow-sm">
                        لا توجد فواتير أو إشعارات دائنة مطابقة للبحث والفرز
                        حالياً.
                      </div>
                    ) : (
                      displayedItems.map((item) => {
                        const sup = suppliers.find(
                          (s) => s.id === item.supplierId,
                        );

                        if (item.itemType === "invoice") {
                          const inv = item as (typeof invoices)[number];
                          const isDueSoon =
                            inv.status === "unpaid" &&
                            new Date(inv.dueDate).getTime() <=
                            new Date("2026-06-12").getTime();

                          return (
                            <div
                              key={inv.id}
                              className={`bg-white rounded-2xl border ${isDueSoon ? "border-rose-500 ring-1 ring-rose-500/10" : "border-slate-200/90"} p-5 shadow-sm hover:shadow-md transition-all`}
                            >
                              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="flex items-start gap-3">
                                  <div
                                    className={`p-3 rounded-xl ${inv.status === "paid" ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600"} shrink-0`}
                                  >
                                    <Receipt className="w-6 h-6" />
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-slate-800 font-mono text-sm">{inv.invoiceNumber}
                                      </span>
                                      {inv.attachments &&
                                      inv.attachments.length > 0 ? (
                                        <span className="bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 text-[9px] px-2 py-0.5 rounded-full flex items-center gap-1 font-sans">
                                          <Paperclip className="w-2.5 h-2.5" />
                                          {inv.attachments.length} مرفقات
                                        </span>
                                      ) : (
                                        inv.attachment && (
                                          <span
                                            className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[9px] px-2 py-0.5 rounded-full flex items-center gap-1 font-sans"
                                            title={inv.attachment.name}
                                          >
                                            <Paperclip className="w-2.5 h-2.5" />
                                            مرفق واحد
                                          </span>
                                        )
                                      )}
                                      <span
                                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                                          inv.status === "paid"
                                            ? "bg-emerald-500/20 text-emerald-600"
                                            : "bg-rose-500/20 text-rose-700"
                                        }`}
                                      >
                                        {inv.status === "paid"
                                          ? "تم السداد"
                                          : "لم يتم السداد"}
                                      </span>
                                      {isDueSoon && (
                                        <span className="text-[10px] font-semibold bg-rose-600 text-white px-2 py-0.5 rounded-full flex items-center gap-1">
                                          <AlertTriangle className="w-3 h-3 text-white" />
                                          مستحق قريباً!
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs text-slate-650 font-semibold mt-1">
                                      المورد:{" "}
                                      {sup
                                        ? `${sup.name} (${sup.company})`
                                        : "غير معروف"}
                                      {inv.warehouse && (
                                        <span className="inline-flex items-center gap-1 bg-slate-100 text-amber-350 border border-amber-500/30 px-2 py-0.5 rounded-md text-[10px] mx-2 font-bold font-sans">
                                          📦 المخزن: {inv.warehouse}
                                        </span>
                                      )}
                                    </p>
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                                  <div>
                                    <span className="text-slate-600 block mb-0.5">
                                      تاريخ الإصدار:
                                    </span>
                                    <span className="font-semibold text-slate-700 font-mono">{inv.issueDate}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-slate-600 block mb-0.5">
                                      تاريخ الاستحقاق:
                                    </span>
                                    <span
                                      className={`font-semibold font-mono ${inv.status === "unpaid" ? "text-rose-600" : "text-slate-700"}`}
                                    >
                                      {inv.dueDate}
                                    </span>
                                  </div>
                                  <div className="col-span-1 sm:col-span-2 md:col-span-1 border-r-0 md:border-r border-slate-200/60 pr-0 md:pr-3">
                                    {inv.creditNoteAmount &&
                                    inv.creditNoteAmount > 0 ? (
                                      <>
                                        <span className="text-slate-600 block mb-0.5">
                                          صافي القيمة بعد الخصم:
                                        </span>
                                        <span className="text-sm font-black text-emerald-600 font-mono block">
                                          {fAmt(
                                            inv.totalAmount -
                                              inv.creditNoteAmount,
                                          )}{" "}
                                          ج.م
                                        </span>
                                        <span className="text-[9px] text-slate-500 text-slate-500 block leading-tight mt-0.5">
                                          (الأصل: {fAmt(inv.totalAmount)} - خصم:{" "}
                                          {fAmt(inv.creditNoteAmount)})
                                        </span>
                                      </>
                                    ) : (
                                      <>
                                        <span className="text-slate-600 block mb-0.5">
                                          القيمة الإجمالية:
                                        </span>
                                        <span className="text-sm font-black text-slate-800 font-mono block">{fAmt(inv.totalAmount)} ج.م
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-start md:justify-end">
                                  {inv.attachments &&
                                  inv.attachments.length > 0 ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setPreviewAttachment(
                                          inv.attachments[0],
                                        );
                                        setPreviewAttachmentList(
                                          inv.attachments,
                                        );
                                      }}
                                      className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-emerald-600 hover:text-emerald-700 text-xs font-bold px-3 py-1.5 rounded-xl cursor-pointer transition-colors shadow-xs"
                                      title={`عرض وتنزيل المرفقات (${inv.attachments.length})`}
                                    >
                                      <Paperclip className="w-3.5 h-3.5 shrink-0" />
                                      <span>
                                        عرض المرفقات ({inv.attachments.length})
                                      </span>
                                    </button>
                                  ) : (
                                    inv.attachment && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setPreviewAttachment(inv.attachment!);
                                          setPreviewAttachmentList([
                                            inv.attachment!,
                                          ]);
                                        }}
                                        className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-emerald-600 hover:text-emerald-700 text-xs font-bold px-3.5 py-2.5 rounded-xl cursor-pointer transition-colors shadow-xs"
                                        title="عرض المرفق"
                                      >
                                        <Paperclip className="w-3.5 h-3.5" />
                                        <span>عرض المرفق</span>
                                      </button>
                                    )
                                  )}
                                  <button
                                    onClick={() => {
                                      if (!checkPermission("write")) return;
                                      setEditingInvoice(inv);
                                      const base =
                                        inv.items.find(
                                          (item) => item.price >= 0,
                                        ) || inv.items[0];
                                      const baseVal = base ? base.price : 0;
                                      const discRows = inv.items
                                        .filter((item) => item.price < 0)
                                        .map((item) => ({
                                          name: item.name.replace(
                                            /^خصم:\s*/,
                                            "",
                                          ),
                                          price: Math.abs(item.price),
                                        }));
                                      setEditInvoiceBaseAmount(baseVal);
                                      setEditDiscounts(discRows);
                                    }}
                                    className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-800 text-xs font-bold px-3.5 py-2.5 rounded-xl cursor-pointer transition-colors shadow-xs"
                                    title="تعديل بيانات الفاتورة"
                                  >
                                    <Edit className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>تعديل</span>
                                  </button>

                                  <button
                                    onClick={() =>
                                      handleDeleteInvoice(
                                        inv.id,
                                        inv.invoiceNumber,
                                      )
                                    }
                                    className="flex items-center gap-1.5 bg-slate-50 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-700 border border-slate-200 text-slate-600 text-xs font-bold px-3.5 py-2.5 rounded-xl cursor-pointer transition-colors shadow-xs"
                                    title="حذف الفاتورة نهائياً"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                    <span>حذف</span>
                                  </button>

                                  {inv.status === "unpaid" ? (
                                    <button
                                      onClick={() =>
                                        handleInitiateSettleInvoice(inv)
                                      }
                                      className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-md cursor-pointer transition-colors"
                                    >
                                      <CreditCard className="w-4 h-4" />
                                      <span>سداد وتسوية الفاتورة</span>
                                    </button>
                                  ) : (
                                    <span className="text-xs font-semibold text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-xl flex items-center gap-1">
                                      <CheckCircle2 className="w-4 h-4" />
                                      تم السداد بالكامل
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Invoice notes without item list display */}
                              {inv.notes && (
                                <div className="mt-4 pt-4 border-t border-slate-200">
                                  <p className="text-[11px] text-slate-650 font-medium">
                                    <strong className="text-slate-700">
                                      ملاحظات الفاتورة:
                                    </strong>{" "}
                                    {inv.notes}
                                  </p>
                                </div>
                              )}

                              {/* Linked Credit Notes Details */}
                              {inv.creditNotes &&
                                inv.creditNotes.length > 0 && (
                                  <div className="mt-4 pt-4 border-t border-slate-200/80">
                                    <div className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5 mb-2.5">
                                      <FileText className="w-3.5 h-3.5 text-emerald-600" />
                                      <span>
                                        الإشعارات الدائنة المرتبطة بالفاتورة
                                        للخصم:
                                      </span>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                      {inv.creditNotes.map((cn) => (
                                        <div
                                          key={cn.id}
                                          className="flex items-center justify-between bg-slate-50/40 p-3 rounded-xl border border-slate-200 text-xs gap-3"
                                        >
                                          <div className="flex flex-col gap-0.5">
                                            <div className="flex items-center gap-1.5">
                                              <span className="font-bold text-slate-800 font-mono">{cn.creditNoteNumber}
                                              </span>
                                              <span className="text-[9px] bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 px-1.5 py-0.5 rounded-md">
                                                مُطبّق خصم
                                              </span>
                                            </div>
                                            <span className="text-[10px] text-slate-600 mt-0.5">
                                              تاريخ الإصدار:{" "}
                                              <span className="font-mono text-slate-700">
                                                {cn.issueDate}
                                              </span>
                                            </span>
                                            <span className="text-emerald-600 font-extrabold font-mono mt-0.5">
                                              المبلغ المخفض: {fAmt(cn.amount)}{" "}
                                              ج.م
                                            </span>
                                          </div>

                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleCancelCreditNoteFromInvoice(
                                                inv.id,
                                                cn.id,
                                              )
                                            }
                                            className="text-[10px] bg-rose-500/10 hover:bg-rose-500/20 active:bg-rose-500/35 text-rose-450 text-rose-600 font-bold border border-rose-500/20 rounded-lg px-2.5 py-1.5 cursor-pointer transition-colors flex items-center gap-1 shrink-0"
                                            title="إلغاء الخصم المالي وإلغاء ربط الإشعار الدائن بالفاتورة"
                                          >
                                            <XCircle className="w-3.5 h-3.5 shrink-0" />
                                            <span>إلغاء الخصم</span>
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                            </div>
                          );
                        } else {
                          // Render Credit Note as part of the list
                          const cn = item as (typeof creditNotes)[number];

                          return (
                            <div
                              key={cn.id}
                              className="bg-white rounded-2xl border border-emerald-500/15 p-5 shadow-sm hover:shadow-md transition-all"
                            >
                              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="flex items-start gap-3">
                                  <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-600 shrink-0">
                                    <FileText className="w-6 h-6 text-emerald-600" />
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-slate-800 font-mono text-sm">
                                        {cn.creditNoteNumber}
                                      </span>
                                      {cn.attachment && (
                                        <span
                                          className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[9px] px-2 py-0.5 rounded-full flex items-center gap-1 font-sans"
                                          title={cn.attachment.name}
                                        >
                                          <Paperclip className="w-2.5 h-2.5" />
                                          مرفق الإشعار
                                        </span>
                                      )}
                                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 border border-emerald-550 border-emerald-500/30">
                                        إشعار دائن (
                                        {cn.status === "active"
                                          ? "نشط"
                                          : "مُطبّق"}
                                        )
                                      </span>
                                    </div>
                                    <p className="text-xs text-slate-650 font-semibold mt-1">
                                      المورد:{" "}
                                      {sup
                                        ? `${sup.name} (${sup.company})`
                                        : "غير معروف"}
                                    </p>
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                                  <div>
                                    <span className="text-slate-600 block mb-0.5">
                                      تاريخ الإصدار:
                                    </span>
                                    <span className="font-semibold text-slate-750 font-mono">{cn.issueDate}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-slate-600 block mb-0.5">
                                      تاريخ الاستحقاق المتوقع:
                                    </span>
                                    <span className="font-semibold font-mono text-slate-750">{cn.dueDate || "-"}
                                    </span>
                                  </div>
                                  <div className="col-span-1 sm:col-span-2 md:col-span-1">
                                    <span className="text-slate-600 block mb-0.5">
                                      قيمة الإشعار (خصم):
                                    </span>
                                    <span className="text-sm font-black text-emerald-600 font-mono">
                                      -{fAmt(cn.amount)} ج.م
                                    </span>
                                  </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-start md:justify-end font-bold text-xs">
                                  {cn.attachment && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setPreviewAttachment(cn.attachment!);
                                        setPreviewAttachmentList([
                                          cn.attachment!,
                                        ]);
                                      }}
                                      className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-emerald-600 hover:text-emerald-700 text-xs font-bold px-3.5 py-2.5 rounded-xl cursor-pointer transition-colors shadow-xs"
                                      title="عرض وتنزيل المرفق"
                                    >
                                      <Paperclip className="w-3.5 h-3.5" />
                                      <span>المرفق</span>
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleToggleCreditNoteStatus(cn.id)
                                    }
                                    className={`px-3 py-2.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                                      cn.status === "active"
                                        ? "bg-amber-500/10 border-amber-500/20 text-amber-600 hover:bg-amber-500/25"
                                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                                    }`}
                                  >
                                    {cn.status === "active"
                                      ? "تحديد كمُطبّق"
                                      : "إعادة تنشيط الإشعار"}
                                  </button>

                                  <button
                                    onClick={() =>
                                      handleInitiateEditCreditNote(cn)
                                    }
                                    className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-800 text-xs font-bold px-3.5 py-2.5 rounded-xl cursor-pointer transition-colors shadow-xs"
                                    title="تعديل بيانات الإشعار الدائن"
                                  >
                                    <Edit className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>تعديل</span>
                                  </button>

                                  <button
                                    onClick={() =>
                                      handleDeleteCreditNote(
                                        cn.id,
                                        cn.creditNoteNumber,
                                      )
                                    }
                                    className="flex items-center gap-1.5 bg-slate-50 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-700 border border-slate-200 text-slate-600 text-xs font-bold px-3.5 py-2.5 rounded-xl cursor-pointer transition-colors shadow-xs"
                                    title="حذف الإشعار نهائياً"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                    <span>حذف</span>
                                  </button>
                                </div>
                              </div>

                              {/* Credit Note items details */}
                              <div className="mt-4 pt-4 border-t border-slate-200">
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                                  تفاصيل بنود الإشعار الدائن المسجلة:
                                </p>
                                <div className="bg-slate-50/60 rounded-xl p-3 space-y-2 border border-slate-200">
                                  {cn.items && cn.items.length > 0 ? (
                                    cn.items.map((itemRow, idx) => (
                                      <div
                                        key={idx}
                                        className="flex items-center justify-between text-xs text-emerald-300 font-medium"
                                      >
                                        <span>
                                          {itemRow.name || "بند الإشعار"}
                                        </span>
                                        <span className="text-slate-500 font-mono">
                                          {itemRow.quantity} ×{" "}
                                          {fAmt(itemRow.price)} ج.م ={" "}
                                          <strong className="text-emerald-600">
                                            {fAmt(
                                              itemRow.quantity * itemRow.price,
                                            )}{" "}
                                            ج.م
                                          </strong>
                                        </span>
                                      </div>
                                    ))
                                  ) : (
                                    <div className="text-xs text-slate-500 italic">
                                      لا توجد بنود تفصيلية لهذا الإشعار (يُحتسب
                                      كخصم مباشر).
                                    </div>
                                  )}
                                  {cn.notes && (
                                    <p className="text-[11px] text-slate-600 border-t border-slate-200 pt-2 mt-2 font-medium">
                                      <strong className="text-slate-700">
                                        البيان/الملاحظات العامة:
                                      </strong>{" "}
                                      {cn.notes}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        }
                      })
                    )}
                  </div>
                </motion.div>
              );
            })()}

          {/* VIEW: PAYMENTS */}
          {activeTab === "payments" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-6 rounded-2xl border border-slate-200 shadow-md space-y-6 text-slate-800"
            >
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  سجل المدفوعات والعمليات المالية المنفذة
                </h3>
                <p className="text-xs text-slate-600 mt-1">
                  تتبع كافة التحويلات الصادرة لتسوية فواتير المشتريات الخاصة
                  بالموردين
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-600 font-bold bg-slate-50/60">
                      <th className="py-3 px-4 rounded-r-xl">رقم العملية</th>
                      <th className="py-3 px-4">المورّد</th>
                      <th className="py-3 px-4">الفاتورة المرتبطة</th>
                      <th className="py-3 px-4">تاريخ المعاملة</th>
                      <th className="py-3 px-4">طريقة الدفع</th>
                      <th className="py-3 px-4">المرجع المصرفي</th>
                      <th className="py-3 px-4 rounded-l-xl text-left">
                        المبلغ المدفوع
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="py-8 text-center text-slate-600 font-medium"
                        >
                          لا توجد عمليات دفع مسجلة حالياً.
                        </td>
                      </tr>
                    ) : (
                      payments.map((p) => {
                        const sup = suppliers.find(
                          (s) => s.id === p.supplierId,
                        );
                        const inv = invoices.find((i) => i.id === p.invoiceId);

                        return (
                          <tr
                            key={p.id}
                            className="border-b border-slate-200 hover:bg-slate-100/40 transition-colors"
                          >
                            <td className="py-4 px-4 font-bold text-emerald-600 font-mono">
                              {p.id}
                            </td>
                            <td className="py-4 px-4 font-semibold text-slate-800">{sup ? sup.name : "مورد محذوف"}
                            </td>
                            <td className="py-4 px-4 font-mono text-slate-600">
                              {inv ? inv.invoiceNumber : "فاتورة كرتونية"}
                            </td>
                            <td className="py-4 px-4 font-mono text-slate-600">
                              {p.paymentDate}
                            </td>
                            <td className="py-4 px-4 font-semibold whitespace-nowrap">
                              <span
                                className={`px-2 py-0.5 rounded-full border text-[10px] font-bold whitespace-nowrap inline-block ${
                                  p.method === "bank_transfer"
                                    ? "bg-blue-50 text-blue-700 border-blue-200"
                                    : p.method === "fawry"
                                      ? "bg-amber-50 text-amber-700 border-amber-200"
                                      : "bg-purple-50 text-purple-700 border-purple-200"
                                }`}
                              >
                                {p.method === "bank_transfer"
                                  ? "تحويل بنكي"
                                  : p.method === "fawry"
                                    ? "مدفوعات فوري"
                                    : "شيك / نقدي"}
                              </span>
                            </td>
                            <td className="py-4 px-4 font-mono text-slate-600 text-[11px] font-medium">
                              {p.transRef}
                            </td>
                            <td className="py-4 px-4 font-bold text-emerald-600 text-left text-sm">
                              {fAmt(p.amount)} ج.م
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {/* VIEW: BANKING INTEGRATIONS & REALTIME RTGS SETTLEMENT */}
          {activeTab === "banking" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Bank Integration Panel Intro */}
              <div className="bg-white backdrop-blur-md p-6 rounded-2xl border border-slate-200/80 shadow-xl">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                       <Building className="w-5 h-5 text-emerald-600" />
                       بوابات التكامل البنكي والتحويل الفوري (RTGS Console)
                    </h3>
                    <p className="text-xs text-slate-600 mt-1">
                      تكامل لحظي مع شبكة المدفوعات القومية للبنوك وتفويض
                      التحويلات والخصم المباشر لحسابات الموردين
                    </p>
                  </div>
                  <div className="text-xs bg-slate-100/60 text-emerald-350 font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 border border-emerald-500/25">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping"></span>
                    المسار البنكي متصل (Settle Server Online)
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
                  {linkedBanks.map((bank, index) => (
                    <div
                      key={index}
                      className={`p-4 rounded-xl border transition-all ${
                        bank.isLinked
                          ? "bg-[#f8fafc]/85 border-emerald-500/25 shadow-[0_2px_15px_rgba(16,185,129,0.04)]"
                          : "bg-slate-100/70 border-slate-200/80 opacity-60 hover:opacity-100"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold text-slate-800">{bank.bankName}
                        </span>
                        <button
                          onClick={() => handleToggleBankLinkage(bank.bankName)}
                          className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border cursor-pointer transition-colors ${
                            bank.isLinked
                              ? "bg-rose-500/10 text-rose-700 border-rose-500/20 hover:bg-rose-500/20"
                              : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/20"
                          }`}
                        >
                          {bank.isLinked ? "فصل الاتصال" : "ربط الآن"}
                        </button>
                      </div>
                      <div className="space-y-1.5 text-xs text-slate-700 font-medium">
                        <div className="flex justify-between">
                          <span>رقم الحساب التسووي:</span>
                          <span className="font-mono text-slate-700">{bank.accountNumber}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>رمز الـ API المصرفي:</span>
                          <span className="font-mono text-slate-500">
                            {bank.apiKey}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-50 text-slate-700 p-6 rounded-2xl border border-slate-200 shadow-2xl relative overflow-hidden mt-6">
                <div className="absolute top-2 left-3 text-[10px] font-mono text-slate-500">
                  Mawrid RTGS Core Engine v3.1
                </div>

                <h3 className="text-emerald-600 font-bold text-sm mb-4 border-b border-slate-200 pb-2 flex items-center gap-2">
                  <Activity className="w-4.5 h-4.5 animate-pulse text-emerald-600" />
                  أداة إدارة التسوية الذكية للمدفوعات اللحظية
                </h3>

                {isSettlingProcess ? (
                  <div className="space-y-4 py-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-800 font-semibold mb-1 block">
                        جاري تشغيل تسوية المعاملة... {settlementProgress}%
                      </span>
                      <RefreshCw className="w-4.5 h-4.5 text-emerald-600 animate-spin" />
                    </div>
                    {/* Console Logger box */}
                    <div className="bg-slate-50/60 rounded-xl p-4 border border-slate-200 h-40 overflow-y-auto space-y-1.5 font-mono text-[11px] leading-relaxed">
                      {settlementLogs.map((log, idx) => (
                        <div
                          key={idx}
                          className="text-emerald-600 flex items-start gap-1"
                        >
                          <span className="text-slate-600 shrink-0">
                            [{idx + 1}]
                          </span>
                          <span>{log}</span>
                        </div>
                      ))}
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-emerald-500 to-emerald-400 h-full transition-all duration-300"
                        style={{ width: `${settlementProgress}%` }}
                      ></div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-xs text-slate-600">
                      يمكنك تحديد أي فاتورة غير مسددة من القائمة وسدادها
                      تلقائياً بضغطة زر. يقوم المحرك بالاتصال اللحظي بـ APIs
                      البنك المُرتبط وتطوير العمليات ماليًا.
                    </p>

                    <div className="bg-white border border-slate-200 rounded-xl p-4">
                      <h4 className="text-xs font-bold text-slate-700 border-b border-slate-200 pb-2 mb-3">
                        اختر الفاتورة المستهدفة للتصفية الفورية:
                      </h4>

                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {invoices.filter((i) => i.status === "unpaid")
                          .length === 0 ? (
                          <p className="text-xs text-center text-slate-500 py-3">
                            لا توجد فواتير غير مسددة حالياً.
                          </p>
                        ) : (
                          invoices
                            .filter((i) => i.status === "unpaid")
                            .map((inv) => {
                              const sup = suppliers.find(
                                (s) => s.id === inv.supplierId,
                              );
                              return (
                                <div
                                  key={inv.id}
                                  className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200 hover:bg-slate-100 gap-4"
                                >
                                  <div className="text-xs">
                                    <div className="flex items-center gap-2">
                                      <strong className="text-emerald-600 font-mono text-xs">
                                        {inv.invoiceNumber}
                                      </strong>
                                      <span className="text-slate-600 font-mono">
                                        ({inv.dueDate})
                                      </span>
                                    </div>
                                    <span className="text-slate-700 text-[11px]">
                                      مستحق للمورد:{" "}
                                      {sup ? sup.name : "غير معروف"}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                                    <div className="text-left font-mono">
                                      <span className="text-emerald-600 font-bold text-xs block">
                                        {fAmt(
                                          inv.totalAmount -
                                            (inv.creditNoteAmount || 0),
                                        )}{" "}
                                        ج.م
                                      </span>
                                      {inv.creditNoteAmount &&
                                      inv.creditNoteAmount > 0 ? (
                                        <span className="text-[9px] text-slate-500 block leading-none">
                                          (خصم إشعار دائن)
                                        </span>
                                      ) : null}
                                    </div>
                                    <button
                                      onClick={() =>
                                        handleInitiateSettleInvoice(inv)
                                      }
                                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] px-3 py-1.5 rounded-lg whitespace-nowrap cursor-pointer transition-colors"
                                    >
                                      تشغيل السداد والتسوية
                                    </button>
                                  </div>
                                </div>
                              );
                            })
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* VIEW: REPORTS & ANALYTICAL PORTFOLIO & PDF DOWNLOAD */}
          {activeTab === "reports" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6 animate-fade-in"
            >
              {/* Unified High-Density Single Line Control Panel for reports/portfolio */}
              <div className="no-print bg-white backdrop-blur-md p-4 rounded-xl border border-slate-200/80 shadow-2xl animate-fadeIn">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
                  {/* 1. Supplier Select */}
                  <div className="flex flex-col gap-1 w-full">
                    <label className="text-[10px] text-slate-800 font-bold font-sans flex items-center gap-1">
                      <span>👤</span> المورد:
                    </label>
                    <select
                      value={selectedReportSupplierId}
                      onChange={(e) => {
                        setSelectedReportSupplierId(e.target.value);
                        setActiveReportPage(0);
                      }}
                      className="bg-slate-50 text-slate-800 border border-slate-200 text-xs px-2.5 py-2.5 rounded-xl focus:ring-1 focus:ring-emerald-500/20 focus:border-emerald-500 font-bold cursor-pointer font-sans w-full h-[42px] transition-all"
                    >
                      <option value="all">جميع الموردين</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 2. Warehouse Select */}
                  <div className="flex flex-col gap-1 w-full">
                    <label className="text-[10px] text-slate-800 font-bold font-sans flex items-center gap-1">
                      <span>🏭</span> المستودع:
                    </label>
                    <select
                      value={reportWarehouseFilter}
                      onChange={(e) => {
                        setReportWarehouseFilter(e.target.value);
                        setActiveReportPage(0);
                      }}
                      className="bg-slate-50 text-slate-800 border border-slate-200 text-xs px-2.5 py-2.5 rounded-xl focus:ring-1 focus:ring-emerald-500/20 focus:border-emerald-500 font-bold cursor-pointer font-sans w-full h-[42px] transition-all"
                    >
                      <option value="all">كافة المستودعات</option>
                      {warehouses.map((w) => (
                        <option key={w} value={w}>
                          {w}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 3. Date Type Selection */}
                  <div className="flex flex-col gap-1 w-full">
                    <label className="text-[10px] text-slate-800 font-bold font-sans flex items-center gap-1">
                      <span>📅</span> التاريخ بـ:
                    </label>
                    <select
                      value={reportDateType}
                      onChange={(e) => {
                        setReportDateType(
                          e.target.value as "issue_date" | "due_date",
                        );
                        setActiveReportPage(0);
                      }}
                      className="bg-slate-50 text-slate-800 border border-slate-200 text-xs px-2.5 py-2.5 rounded-xl focus:ring-1 focus:ring-amber-500/20 focus:border-amber-500 font-bold cursor-pointer font-sans w-full h-[42px] transition-all"
                    >
                      <option value="issue_date">🕒 تاريخ الإضافة</option>
                      <option value="due_date">⚠️ تاريخ الاستحقاق</option>
                    </select>
                  </div>

                  {/* 4. Start Date Input */}
                  <div className="flex flex-col gap-1 w-full">
                    <label className="text-[10px] text-slate-800 font-bold font-sans flex items-center gap-1">
                      <span>📅</span> من تاريخ:
                    </label>
                    <input
                      type="date"
                      value={reportStartDate}
                      onChange={(e) => {
                        setReportStartDate(e.target.value);
                        setActiveReportPage(0);
                      }}
                      className="bg-slate-50 text-slate-800 border border-slate-200 text-xs px-2 py-2 rounded-xl focus:ring-1 focus:ring-emerald-500/20 focus:border-emerald-500 font-bold font-mono w-full align-middle h-[42px] transition-all"
                    />
                  </div>

                  {/* 5. End Date Input */}
                  <div className="flex flex-col gap-1 w-full">
                    <label className="text-[10px] text-slate-800 font-bold font-sans flex items-center gap-1">
                      <span>📅</span> إلى تاريخ:
                    </label>
                    <input
                      type="date"
                      value={reportEndDate}
                      onChange={(e) => {
                        setReportEndDate(e.target.value);
                        setActiveReportPage(0);
                      }}
                      className="bg-slate-50 text-slate-800 border border-slate-200 text-xs px-2 py-2 rounded-xl focus:ring-1 focus:ring-emerald-500/20 focus:border-emerald-500 font-bold font-mono w-full align-middle h-[42px] transition-all"
                    />
                  </div>

                  {/* 6. Report View Type Select */}
                  <div className="flex flex-col gap-1 w-full">
                    <label className="text-[10px] text-slate-800 font-bold font-sans flex items-center gap-1">
                      <span>📝</span> نوع التقرير:
                    </label>
                    <select
                      value={reportViewType}
                      onChange={(e) => {
                        setReportViewType(
                          e.target.value as "detailed" | "summary" | "aging",
                        );
                        setActiveReportPage(0);
                      }}
                      className="bg-slate-50 text-slate-800 border border-slate-200 text-xs px-2.5 py-2.5 rounded-xl focus:ring-1 focus:ring-cyan-500/20 focus:border-cyan-500 font-bold cursor-pointer font-sans w-full h-[42px] transition-all"
                    >
                      <option value="summary">📊 تقرير إجمالي</option>
                      <option value="detailed">📝 تقرير تفصيلي</option>
                      <option value="aging">⏳ تقرير أعمار الديون (Aging)</option>
                    </select>
                  </div>
                </div>

                {/* Highly structured Export Actions with premium accents & color themes */}
                <div className="mt-4 pt-4 border-t border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="text-[11px] text-slate-600 font-medium font-sans flex items-center gap-2">
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span>خيارات استخراج وحفظ التقارير بطرق مختلفة للمشاركة البريدية والطباعة والتحليل المالي.</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 w-full md:w-auto shrink-0 font-sans">
                    {/* 1. Excel Export Button */}
                    <button
                      type="button"
                      onClick={handleExportReportToExcel}
                      className="bg-emerald-600/95 hover:bg-emerald-500 text-white font-bold text-[11px] h-[40px] px-5 rounded-xl cursor-pointer transition-all flex items-center justify-center gap-2 transition-colors duration-150 shadow-md hover:-translate-y-0.5 active:translate-y-0"
                    >
                      <span className="text-sm">📊</span> تصدير Excel (.csv)
                    </button>

                    {/* 2. Direct Print Button */}
                    <button
                      type="button"
                      onClick={handlePrintReport}
                      className="bg-emerald-600 hover:bg-sky-550 active:bg-emerald-700 text-white font-bold text-[11px] h-[40px] px-5 rounded-xl cursor-pointer transition-all flex items-center justify-center gap-2 transition-colors duration-150 shadow-md hover:-translate-y-0.5 active:translate-y-0"
                    >
                      <Printer className="w-4 h-4 text-white shrink-0" />
                      طباعة مباشرة / حفظ PDF
                    </button>
                  </div>
                </div>
              </div>

              {/* PRINT-ONLY OFFICIAL DIRECT Arabic REPORT (Will print layout exceptionally) */}
              {(() => {
                const dynamicChunkArray = <T,>(arr: T[], sizeFirst: number, sizeSubsequent: number): T[][] => {
                  if (arr.length === 0) return [];
                  const chunks: T[][] = [];
                  chunks.push(arr.slice(0, sizeFirst));
                  let index = sizeFirst;
                  while (index < arr.length) {
                    chunks.push(arr.slice(index, index + sizeSubsequent));
                    index += sizeSubsequent;
                  }
                  return chunks;
                };

                const tc = {
                  accentText: "text-emerald-850 font-black",
                  bannerBorder: "border-emerald-600",
                  borderSpecs: "border-emerald-200/80 bg-emerald-500/10/20 shadow-sm",
                  invoiceText: "text-emerald-800 font-extrabold",
                  totalDebtText: "text-emerald-950 font-black bg-emerald-500/30",
                  headerTr: "bg-emerald-500/20 border-b-2 border-emerald-300",
                  headerSpan: "border-emerald-600 text-emerald-950",
                };

                const getReportSummaryItems = () => {
                  const targetSuppliers =
                    selectedReportSupplierId === "all"
                      ? suppliers
                      : suppliers.filter(
                          (s) => s.id === selectedReportSupplierId,
                        );

                  const items: Array<{
                    supplier: any;
                    supInvoices: Invoice[];
                    totalOriginal: number;
                    totalCN: number;
                    totalNet: number;
                    overallStatusText: string;
                    badgeClass: string;
                  }> = [];

                  targetSuppliers.forEach((sup) => {
                    const supInvoices = invoices.filter((i) => {
                      const matchesSupplier = i.supplierId === sup.id;
                      const date =
                        (reportDateType === "issue_date"
                          ? i.issueDate
                          : i.dueDate) || "2026-06-01";
                      const matchesRange =
                        date >= reportStartDate && date <= reportEndDate;
                      const matchesWarehouse =
                        reportWarehouseFilter === "all" ||
                        i.warehouse === reportWarehouseFilter;
                      return (
                        matchesSupplier && matchesRange && matchesWarehouse
                      );
                    });

                    if (supInvoices.length === 0) return;

                    const totalOriginal = supInvoices.reduce(
                      (sum, inv) => sum + inv.totalAmount,
                      0,
                    );
                    const totalCN = supInvoices.reduce(
                      (sum, inv) => sum + (inv.creditNoteAmount || 0),
                      0,
                    );
                    const totalNet = supInvoices.reduce(
                      (sum, inv) =>
                        sum + (inv.totalAmount - (inv.creditNoteAmount || 0)),
                      0,
                    );

                    const paidCount = supInvoices.filter((i) =>
                      getFullPaymentStatus(i).includes("تم السداد"),
                    ).length;

                    let overallStatusText = "";
                    let badgeClass = "";
                    if (paidCount === supInvoices.length) {
                      overallStatusText = "مسددة بالكامل";
                      badgeClass =
                        "bg-emerald-100 text-emerald-800 border border-emerald-200";
                    } else if (paidCount > 0) {
                      overallStatusText = `مسدد جزئياً (${paidCount}/${supInvoices.length})`;
                      badgeClass =
                        "bg-amber-100 text-amber-800 border border-amber-200";
                    } else {
                      overallStatusText = "غير مسددة";
                      badgeClass =
                        "bg-rose-100 text-rose-800 border border-rose-250";
                    }

                    items.push({
                      supplier: sup,
                      supInvoices,
                      totalOriginal,
                      totalCN,
                      totalNet,
                      overallStatusText,
                      badgeClass,
                    });
                  });

                  return items;
                };

                const getReportDetailedItems = () => {
                  const targetSuppliers =
                    selectedReportSupplierId === "all"
                      ? suppliers
                      : suppliers.filter(
                          (s) => s.id === selectedReportSupplierId,
                        );

                  const items: Array<{
                    supplier: any;
                    invoice: Invoice;
                    payableAmount: number;
                  }> = [];

                  targetSuppliers.forEach((sup) => {
                    const supInvoices = invoices.filter((i) => {
                      const matchesSupplier = i.supplierId === sup.id;
                      const date =
                        (reportDateType === "issue_date"
                          ? i.issueDate
                          : i.dueDate) || "2026-06-01";
                      const matchesRange =
                        date >= reportStartDate && date <= reportEndDate;
                      const matchesWarehouse =
                        reportWarehouseFilter === "all" ||
                        i.warehouse === reportWarehouseFilter;
                      return (
                        matchesSupplier && matchesRange && matchesWarehouse
                      );
                    });

                    supInvoices.forEach((inv) => {
                      items.push({
                        supplier: sup,
                        invoice: inv,
                        payableAmount:
                          inv.totalAmount - (inv.creditNoteAmount || 0),
                      });
                    });
                  });

                  return items;
                };

                // Flat list of items to display
                const rawReportItems: any[] =
                  reportViewType === "summary"
                    ? getReportSummaryItems()
                    : reportViewType === "detailed"
                    ? getReportDetailedItems()
                    : getComponentReportAgingItems();
                const reportPages =
                  reportViewType === "summary"
                    ? dynamicChunkArray(rawReportItems, 6, 10)
                    : reportViewType === "detailed"
                    ? dynamicChunkArray(rawReportItems, 5, 8)
                    : dynamicChunkArray(rawReportItems, 6, 10);
                const reportPagesToRender =
                  reportPages.length > 0 ? reportPages : [[]];

                return (
                  <div className="space-y-6">
                    {/* Screen Pagination Controls */}
                    {reportPagesToRender.length > 1 && (
                      <div className="no-print flex items-center justify-between bg-white border border-slate-200 rounded-2xl p-4 max-w-7xl mx-auto mb-4 shadow-sm text-slate-800">
                        <button
                          type="button"
                          disabled={activeReportPage === 0}
                          onClick={() =>
                            setActiveReportPage((prev) => Math.max(0, prev - 1))
                          }
                          className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:hover:bg-slate-100 text-slate-800 font-bold px-4 py-2 rounded-xl text-xs cursor-pointer select-none transition-colors"
                        >
                          <span>&larr;</span> الصفحة السابقة
                        </button>

                        <span className="text-xs font-semibold font-sans text-slate-700">
                          معاينة الصفحة {activeReportPage + 1} من أصل{" "}
                          {reportPagesToRender.length}
                        </span>

                        <button
                          type="button"
                          disabled={
                            activeReportPage === reportPagesToRender.length - 1
                          }
                          onClick={() =>
                            setActiveReportPage((prev) =>
                              Math.min(
                                reportPagesToRender.length - 1,
                                prev + 1,
                              ),
                            )
                          }
                          className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:hover:bg-slate-100 text-slate-800 font-bold px-4 py-2 rounded-xl text-xs cursor-pointer select-none transition-colors"
                        >
                          الصفحة التالية <span>&rarr;</span>
                        </button>
                      </div>
                    )}

                    {/* Rendering Pages */}
                    <div id="printable-report-content" className="space-y-6 pb-24 sm:pb-28 md:pb-36">
                      {reportPagesToRender.map((pageItems, pageIdx) => {
                        const isPageActive = pageIdx === activeReportPage;
                        const hasItems = pageItems.length > 0;

                        return (
                          <div
                            key={pageIdx}
                            className={`bg-white rounded-3xl border-[6px] border-double border-emerald-700/60 p-10 shadow-xl space-y-6 printable-report-sheet max-w-7xl mx-auto text-slate-900 printable-report-page relative overflow-hidden ${
                              isPageActive
                                ? "active-preview-page"
                                : "hidden-on-screen"
                            }`}
                          >
                            {/* Official Background Watermark Logo with high transparency to convey ultimate security */}
                            <div className="absolute inset-0 flex items-center justify-center opacity-[0.02] pointer-events-none select-none z-0">
                              <MersalLogo width={500} height={500} isDarkBackground={false} />
                            </div>

                            <div className="relative z-10 space-y-6">
                              {/* Printed Header Banner */}
                              <div className="border-b-2 border-emerald-650 pb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                <div className="text-right">
                                  <h2 className="text-xl font-extrabold text-slate-950 font-sans tracking-tight">
                                    مستشفى مرسال للأطفال - Marsal Children's Hospital
                                  </h2>
                                  <p className="text-[10px] text-emerald-800 font-bold font-sans mt-0.5">
                                    الشؤون المالية والرقابة • إدارة الحسابات العامة ومراجعة فواتير الموردين
                                  </p>
                                  <p className="text-[10px] text-slate-500 font-semibold font-sans mt-0.5">
                                    التقرير المالي التدقيقي للموردين وفواتير الشراء المفتوحة
                                  </p>
                                </div>
                                <div className="text-left flex flex-col items-end">
                                  <div className="flex items-center gap-2">
                                    <MersalLogo
                                      width={80}
                                      height={80}
                                      isDarkBackground={false}
                                      className="h-10 w-auto"
                                    />
                                    <div className="border-r border-slate-300 h-8 pl-2"></div>
                                    <div className="text-left">
                                      <h3 className="text-sm font-black text-slate-950 font-sans leading-none">
                                        Mersal Foundation
                                      </h3>
                                      <span className="text-[9px] text-slate-500 font-bold block mt-0.5">
                                        Financial Audit Division
                                      </span>
                                    </div>
                                  </div>
                                  <div className="text-[9px] text-slate-600 font-mono mt-1">
                                    تاريخ الطباعة: {new Date().toISOString().split("T")[0]} | المستند: MRL-FIN-{new Date().getFullYear()}-{String(new Date().getMonth() + 1).padStart(2, '0')}
                                  </div>
                                </div>
                              </div>

                              {/* Report specs indicators (ONLY ON FIRST PAGE: pageIdx === 0) */}
                              {pageIdx === 0 && (
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 border border-emerald-200 bg-emerald-500/15 rounded-2xl p-5 shadow-sm relative z-10 divide-y md:divide-y-0 md:divide-x md:divide-x-reverse divide-emerald-100">
                                  <div className="text-center flex flex-col justify-between items-center font-bold pb-2 md:pb-0">
                                    <span className="text-slate-500 text-[10px] font-bold block mb-1 font-sans">
                                      📅 فترة ومعايير التدقيق المالي
                                    </span>
                                    <span className="text-xs text-slate-800 font-bold block leading-relaxed font-sans text-center">
                                      من: <span className="font-mono">{reportStartDate}</span> <br/>
                                      إلى: <span className="font-mono">{reportEndDate}</span>
                                    </span>
                                  </div>
                                  
                                  <div className="text-center flex flex-col justify-between items-center font-bold pt-2 md:pt-0 md:px-4">
                                    <span className="text-slate-500 text-[10px] font-bold block mb-1 font-sans">
                                      👤 نطاق البحث والمورد المختار
                                    </span>
                                    <span className="text-xs text-emerald-950 font-black block leading-snug font-sans text-center max-w-full break-words">
                                      {selectedReportSupplierId === "all" 
                                        ? "جميع الموردين المسجلين بالمستشفى" 
                                        : suppliers.find((s) => s.id === selectedReportSupplierId)?.name}
                                      {reportWarehouseFilter !== "all"
                                        ? ` (مستودع: ${reportWarehouseFilter})`
                                        : " (جميع المستودعات)"}
                                    </span>
                                  </div>

                                  <div className="text-center flex flex-col justify-between items-center font-bold pt-2 md:pt-0 md:px-4">
                                    <span className="text-slate-500 text-[10px] font-bold block mb-1 font-sans">
                                      💰 مجموع المطالبات الصافية
                                    </span>
                                    <strong className="text-sm text-emerald-800 font-black block font-mono text-center">
                                      {fAmt(getSelectedReportFinancials().total)} ج.م
                                    </strong>
                                  </div>

                                  <div className="text-center flex flex-col justify-between items-center font-bold pt-2 md:pt-0">
                                    <span className="text-slate-500 text-[10px] font-bold block mb-1 font-sans">
                                      🚨 القيمة المتبقية للمديونية
                                    </span>
                                    <strong className="text-sm text-rose-700 font-black block font-mono text-center">
                                      {fAmt(getSelectedReportFinancials().pending)} ج.م
                                    </strong>
                                  </div>
                                </div>
                              )}

                            {/* Ledger Listing inside the PDF */}
                            <div className="space-y-4">
                              <div className="flex items-center justify-between border-b border-slate-150 pb-2 no-print">
                                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-widest border-r-2 border-emerald-600 pr-2 font-sans">
                                  {selectedReportSupplierId === "all"
                                    ? "تفاصيل أرصدة الموردين والفواتير النشطة"
                                    : `كشف حساب المورد التفصيلي: ${suppliers.find((s) => s.id === selectedReportSupplierId)?.name}`}
                                </h4>
                                {selectedReportSupplierId !== "all" && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setSelectedReportSupplierId("all")
                                    }
                                    className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-2.5 py-1 rounded-lg cursor-pointer transition-colors no-print font-sans"
                                  >
                                    عرض كافة الموردين
                                  </button>
                                )}
                              </div>

                              <div className="overflow-x-auto w-full max-w-full no-scrollbar">
                                <table className="w-full text-[11px] text-right border border-slate-200 min-w-[700px]">
                                  <thead>
                                    {/* Repeatable print-only section title header */}
                                    <tr className={`print-only-tr border-b-2 ${tc.headerTr}`}>
                                      <th
                                        colSpan={
                                          reportViewType === "summary" ? 6 : 7
                                        }
                                        className="py-3 px-3 text-right bg-slate-50 border border-slate-350"
                                      >
                                        <div className="flex items-center justify-between text-slate-950 font-bold">
                                          <span className={`text-xs border-r-2 pr-2.5 font-bold font-sans ${tc.headerSpan}`}>
                                            {selectedReportSupplierId === "all"
                                              ? "تفاصيل أرصدة الموردين والفواتير النشطة"
                                              : `كشف حساب المورد التفصيلي: ${suppliers.find((s) => s.id === selectedReportSupplierId)?.name}`}
                                          </span>
                                          <span className="text-[10px] text-slate-500 font-mono font-medium select-none">
                                            مستشفى مرسال للأطفال - Marsal Children's Hospital
                                            (تابع التقرير المالي المعتمد) - صفحة{" "}
                                            {pageIdx + 1}
                                          </span>
                                        </div>
                                      </th>
                                    </tr>
                                    {reportViewType === "summary" ? (
                                      <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold font-sans">
                                        <th className="py-2.5 px-3 text-center">
                                          المورد
                                        </th>
                                        <th className="py-2.5 px-3 text-center">
                                          عدد الفواتير بالفترة
                                        </th>
                                        <th className="py-2.5 px-3 text-center">
                                          إجمالي الفواتير الأصلية
                                        </th>
                                        <th className="py-2.5 px-3 text-center">
                                          إجمالي الخصومات الدائنة
                                        </th>
                                        <th className="py-2.5 px-3 text-center font-bold">
                                          إجمالي صافي المطلوب سداده
                                        </th>
                                        <th className="py-2.5 px-3 text-center">
                                          حالة السداد الإجمالية
                                        </th>
                                      </tr>
                                    ) : reportViewType === "detailed" ? (
                                      <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold font-sans">
                                        <th className="py-2.5 px-3 text-center">
                                          المورد
                                        </th>
                                        <th className="py-2.5 px-3 text-center font-semibold">
                                          تاريخ الإضافة
                                        </th>
                                        <th className="py-2.5 px-3 text-center font-semibold">
                                          تاريخ الاستحقاق
                                        </th>
                                        <th className="py-2.5 px-3 text-center font-semibold">
                                          قيمة الفاتورة الأصلية
                                        </th>
                                        <th className="py-2.5 px-3 text-center font-semibold">
                                          خصم الإشعار الدائن
                                        </th>
                                        <th className="py-2.5 px-3 text-center font-bold">
                                          صافي المطلوب سداده
                                        </th>
                                        <th className="py-2.5 px-3 text-center">
                                          حالة السداد والتحصيل
                                        </th>
                                      </tr>
                                    ) : (
                                      <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold font-sans">
                                        <th className="py-2.5 px-3 text-center">
                                          المورد والشركة
                                        </th>
                                        <th className="py-2.5 px-3 text-center font-semibold">
                                          غير مستحق (حالي)
                                        </th>
                                        <th className="py-2.5 px-3 text-center font-semibold text-amber-700">
                                          1 - 30 يوم
                                        </th>
                                        <th className="py-2.5 px-3 text-center font-semibold text-orange-700">
                                          31 - 60 يوم
                                        </th>
                                        <th className="py-2.5 px-3 text-center font-semibold text-rose-700">
                                          61 - 90 يوم
                                        </th>
                                        <th className="py-2.5 px-3 text-center font-semibold text-red-800">
                                          أكثر من 90 يوم
                                        </th>
                                        <th className="py-2.5 px-3 text-center font-bold">
                                          إجمالي المديونية القائمة
                                        </th>
                                      </tr>
                                    )}
                                  </thead>
                                  <tbody>
                                    {!hasItems ? (
                                      <tr>
                                        <td
                                          colSpan={
                                            reportViewType === "summary" ? 6 : 7
                                          }
                                          className="py-12 text-center text-slate-600 italic font-sans"
                                        >
                                          لا توجد بيانات مسجلة للفترة المحددة أو
                                          المورد المختار.
                                        </td>
                                      </tr>
                                    ) : reportViewType === "summary" ? (
                                      (
                                        pageItems as any as Array<{
                                          supplier: any;
                                          supInvoices: Invoice[];
                                          totalOriginal: number;
                                          totalCN: number;
                                          totalNet: number;
                                          overallStatusText: string;
                                          badgeClass: string;
                                        }>
                                      ).map((item) => (
                                        <tr
                                          key={item.supplier.id}
                                          className="border-b border-slate-200 hover:bg-slate-50/50"
                                        >
                                          <td className="py-2.5 px-3 font-semibold text-slate-900 border-r border-slate-100 align-middle font-sans text-center">
                                            <div className="font-bold text-slate-950 text-xs text-center">
                                              {item.supplier.name}
                                            </div>
                                          </td>
                                          <td className="py-2.5 px-3 font-mono font-bold text-center text-slate-700">
                                            {item.supInvoices.length} فواتير
                                          </td>
                                          <td className="py-2.5 px-3 font-mono text-center font-medium">
                                            {fAmt(item.totalOriginal)} ج.م
                                          </td>
                                          <td className="py-2.5 px-3 font-mono text-rose-600 font-bold text-center">
                                            {item.totalCN > 0
                                              ? `-${fAmt(item.totalCN)} ج.م`
                                              : "0.0 ج.م"}
                                          </td>
                                          <td className={`py-2.5 px-3 font-mono font-black text-center ${tc.accentText}`}>
                                            {fAmt(item.totalNet)} ج.م
                                          </td>
                                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                            <span
                                              className={`px-2 py-0.5 rounded-full text-[9px] font-bold whitespace-nowrap inline-block ${item.badgeClass}`}
                                            >
                                              {item.overallStatusText}
                                            </span>
                                          </td>
                                        </tr>
                                      ))
                                    ) : reportViewType === "detailed" ? (
                                      (
                                        pageItems as any as Array<{
                                          supplier: any;
                                          invoice: Invoice;
                                          payableAmount: number;
                                        }>
                                      ).map((item) => {
                                        const statusText = getFullPaymentStatus(
                                          item.invoice,
                                        );
                                        let badgeClass =
                                          "bg-slate-100 text-slate-800 border border-slate-200";
                                        if (statusText === "تم السداد نقداً") {
                                          badgeClass =
                                            "bg-emerald-100 text-emerald-800 border border-emerald-200";
                                        } else if (
                                          statusText === "تم السداد بتحويل بنكي"
                                        ) {
                                          badgeClass =
                                            "bg-emerald-100 text-sky-800 border border-emerald-200";
                                        } else if (
                                          statusText === "تم السداد بفوري" ||
                                          statusText === "تم السداد بشيك"
                                        ) {
                                          badgeClass =
                                            "bg-indigo-100 text-indigo-800 border border-indigo-200";
                                        } else if (statusText === "تم السداد") {
                                          badgeClass =
                                            "bg-emerald-100 text-emerald-800 border border-emerald-250";
                                        } else if (
                                          statusText ===
                                          "لم يتم السداد (متجاوزة الاستحقاق)"
                                        ) {
                                          badgeClass =
                                            "bg-rose-100 text-rose-800 border border-rose-200 font-bold";
                                        } else if (
                                          statusText === "مستحقة للدفع"
                                        ) {
                                          badgeClass =
                                            "bg-amber-100 text-amber-800 border border-amber-200";
                                        }

                                        return (
                                          <tr
                                            key={item.invoice.id}
                                            className="border-b border-slate-200 hover:bg-slate-50/50"
                                          >
                                            <td className="py-2.5 px-3 font-semibold text-slate-900 border-r border-slate-100 align-middle font-sans text-center">
                                              <div className="font-bold text-slate-950 text-xs text-center">
                                                {item.supplier.name}
                                              </div>
                                            </td>
                                            <td className="py-2.5 px-3 font-mono text-slate-600 text-center">
                                              {item.invoice.issueDate ||
                                                "2026-06-01"}
                                            </td>
                                            <td className="py-2.5 px-3 font-mono text-slate-500 text-center">
                                              {item.invoice.dueDate}
                                            </td>
                                            <td className="py-2.5 px-3 font-mono text-center font-medium">
                                              {fAmt(item.invoice.totalAmount)}{" "}
                                              ج.م
                                            </td>
                                            <td className="py-2.5 px-3 font-mono text-rose-600 font-bold text-center">
                                              {item.invoice.creditNoteAmount &&
                                              item.invoice.creditNoteAmount > 0
                                                ? `-${fAmt(item.invoice.creditNoteAmount)} ج.م`
                                                : "0.0 ج.م"}
                                            </td>
                                            <td className={`py-2.5 px-3 font-mono font-black text-center ${tc.invoiceText}`}>
                                              {fAmt(item.payableAmount)} ج.م
                                            </td>
                                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                              <span
                                                className={`px-2 py-0.5 rounded-full text-[9px] font-bold whitespace-nowrap inline-block ${badgeClass}`}
                                              >
                                                {statusText}
                                              </span>
                                            </td>
                                          </tr>
                                        );
                                      })
                                    ) : (
                                      (
                                        pageItems as any as Array<{
                                          supplier: any;
                                          totalDebt: number;
                                          current: number;
                                          range_1_30: number;
                                          range_31_60: number;
                                          range_61_90: number;
                                          range_91_plus: number;
                                        }>
                                      ).map((item) => (
                                        <tr
                                          key={item.supplier.id}
                                          className="border-b border-slate-200 hover:bg-slate-50/50"
                                        >
                                          <td className="py-2.5 px-3 font-semibold text-slate-900 border-r border-slate-100 align-middle font-sans text-center">
                                            <div className="font-bold text-slate-950 text-xs text-center animate-fade-in">
                                              {item.supplier.name} <span className="text-[10px] text-slate-500 font-normal">({item.supplier.company})</span>
                                            </div>
                                          </td>
                                          <td className="py-2.5 px-3 font-mono text-center font-medium text-slate-600">
                                            {item.current > 0 ? `${fAmt(item.current)} ج.م` : "-"}
                                          </td>
                                          <td className="py-2.5 px-3 font-mono text-center font-medium text-amber-600">
                                            {item.range_1_30 > 0 ? `${fAmt(item.range_1_30)} ج.م` : "-"}
                                          </td>
                                          <td className="py-2.5 px-3 font-mono text-center font-bold text-orange-600">
                                            {item.range_31_60 > 0 ? `${fAmt(item.range_31_60)} ج.م` : "-"}
                                          </td>
                                          <td className="py-2.5 px-3 font-mono text-center font-bold text-rose-500">
                                            {item.range_61_90 > 0 ? `${fAmt(item.range_61_90)} ج.م` : "-"}
                                          </td>
                                          <td className="py-2.5 px-3 font-mono text-center font-black text-rose-700">
                                            {item.range_91_plus > 0 ? `${fAmt(item.range_91_plus)} ج.م` : "-"}
                                          </td>
                                          <td className={`py-2.5 px-3 font-mono font-black text-center ${tc.totalDebtText}`}>
                                            {fAmt(item.totalDebt)} ج.م
                                          </td>
                                        </tr>
                                      ))
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>

                            </div>


                            {/* Legal terms stamp bottom screen */}
                            <div className="flex items-center justify-between border-t border-slate-100 pt-4 pb-0 mt-auto text-xs w-full select-none text-slate-600 font-sans relative z-10">
                              <span className="text-[9px] font-medium leading-none font-sans text-slate-600">
                                مستند رسمي صادر عن منظومة مورد المعتمدة للمشتريات تحت إشراف الإدارة العامة لمستشفى مرسال للأطفال.
                              </span>
                              <div className="text-center font-mono text-[10px] text-slate-600 whitespace-nowrap">
                                صفحة {pageIdx + 1} من {reportPagesToRender.length}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </motion.div>
          )}
          {/* VIEW: BACKUPS TIMELINE */}
          {activeTab === "backups" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white backdrop-blur-md p-6 rounded-2xl border border-slate-200/80 shadow-xl space-y-6 text-slate-850"
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Database className="w-5 h-5 text-indigo-400" />
                    منظومة النسخ الاحتياطي وحماية البيانات المتكاملة
                  </h3>
                  <p className="text-xs text-slate-600 mt-1">
                    حماية تامة من فقدان الحسابات بقاعدة بيانات دورية مشفرة،
                    والقدرة الكاملة على تفريغ وتحميل السجلات المباشرة.
                  </p>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={triggerManualBackup}
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-md transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4 text-white" />
                    <span>إنشاء نقطة استعادة جديدة</span>
                  </button>
                </div>
              </div>

              {/* Database State Controllers & JSON Persistence File Actions */}
              <div className="bg-[#f8fafc]/60 border border-slate-200/70 p-5 rounded-2xl space-y-4 shadow-sm">
                <div>
                  <h4 className="font-bold text-emerald-600 text-xs flex items-center gap-1.5 uppercase tracking-wider">
                    <Shield className="w-4 h-4 text-emerald-700" />
                    التحكم المتقدم بالذاكرة الدائمة والملفات الشخصية (JSON Hard Drive Backup)
                  </h4>
                  <p className="text-[11px] text-slate-600 mt-1">
                    احمِ أعمالك من إمكانية مسح ذاكرة المتصفح المؤقتة (LocalStorage) أو فقدان البيانات عند التحديث. قم بتنزيل ملف حساباتك كلياً على حاسوبك الشخصي واقرأه وقتما تشاء بشكل آمن تماماً وبسرية تامة.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* Export Full Dataset */}
                  <button
                    onClick={exportAllDataAsJSON}
                    className="flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold px-3 py-2.5 rounded-xl cursor-pointer shadow-sm transition-all text-center"
                    title="تنزيل نسخة بنية الحسابات والعمليات كاملة"
                  >
                    <Download className="w-4 h-4 text-white" />
                    تصدير قاعدة البيانات (JSON)
                  </button>

                  {/* Import Full Dataset */}
                  <label className="flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold px-3 py-2.5 rounded-xl cursor-pointer shadow-sm transition-all text-center">
                    <Upload className="w-4 h-4 text-white" />
                    <span>استيراد قاعدة بيانات (JSON)</span>
                    <input
                      type="file"
                      accept=".json"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          importAllDataFromJSON(file);
                        }
                      }}
                    />
                  </label>

                  {/* Clean system data */}
                  <button
                    onClick={clearAllData}
                    className="flex items-center justify-center gap-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 border border-rose-500/20 text-xs font-bold px-3 py-2.5 rounded-xl cursor-pointer transition-all text-center"
                    title="تهيئة النظام للعمل من الصفر والبدء بحزمة فارغة"
                  >
                    <Trash2 className="w-4 h-4 text-rose-450" />
                    تصفير الحسابات (شغل شخصي فارغ)
                  </button>

                  {/* Load demo default database */}
                  <button
                    onClick={loadDemoData}
                    className="flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-black border border-slate-200 text-xs font-bold px-3 py-2.5 rounded-xl cursor-pointer transition-all text-center"
                    title="إعادة جلب وضخ بيانات الموردين التجريبية الافتراضية"
                  >
                    <RefreshCw className="w-4 h-4 text-black" />
                    استرجع الداتا الافتراضية
                  </button>
                </div>
              </div>


              {/* Automatic Backup state indicator */}
              <div className="bg-emerald-500/5 p-4 rounded-xl border border-emerald-500/10 flex items-center gap-3 text-xs text-slate-700">
                <Shield className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <span className="font-bold text-slate-800 block">حالة الحفظ الذاتي: نشط وتلقائي (Auto-save Enabled)
                  </span>
                  <span className="text-[11px] text-slate-600">
                    يقوم النظام تلقائياً بتحديث وحفظ أي تعديلات تجريها فورياً
                    بذاكرة المتصفح المحلية لتكون جاهزة عند إعادة التحميل.
                  </span>
                </div>
              </div>

              {/* Backup list history */}
              <div className="space-y-3">
                <span className="text-xs font-bold text-slate-600 block uppercase tracking-wider">
                  سجل النسخ الاحتياطية المتوفرة ومستودع الأمان الفوري:
                </span>

                {backups.length === 0 ? (
                  <div className="text-center py-6 text-slate-600 text-xs italic bg-white border border-dashed border-slate-200 rounded-xl">
                    لا يوجد نسخ احتياطية مسجلة في التايم لاين الحالي. قم بإنشاء
                    واحدة الآن كحماية دورية فائقة السرعة.
                  </div>
                ) : (
                  backups.map((bc, idx) => (
                    <div
                      key={idx}
                      className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-slate-50/60/40 border border-slate-200 rounded-xl hover:border-slate-200 transition-colors justify-between gap-4"
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="p-2 rounded-lg bg-slate-850 text-indigo-400 mt-0.5 shrink-0">
                          <Database className="w-4.5 h-4.5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <strong className="text-sm text-slate-900 font-bold">
                              {bc.type === "auto"
                                ? "نسخة احتياطية تلقائية"
                                : "نسخة احتياطية يدوية"}
                            </strong>
                            <span
                              className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${bc.type === "auto" ? "bg-indigo-500/20 text-indigo-300" : "bg-emerald-500/20 text-emerald-300"}`}
                            >
                              {bc.type === "auto" ? "تلقائي" : "يدوي مُصدَّق"}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-600 block mt-0.5 font-mono">
                            {new Date(bc.timestamp).toLocaleString("ar")}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                        <div className="text-xs text-slate-600 text-right">
                          <span>
                            الحجم:{" "}
                            <strong className="text-slate-800">
                              {bc.size}
                            </strong>
                          </span>
                          <span className="block text-[11px] text-slate-600 font-bold mt-0.5">
                            {bc.recordsCount.suppliers} موردين |{" "}
                            {bc.recordsCount.invoices} فواتير
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-row-reverse">
                          <button
                            onClick={() => restoreBackupRecord(bc)}
                            className="bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-750 text-white font-bold text-[11px] px-3.5 py-1.5 rounded-xl shrink-0 cursor-pointer transition-colors"
                          >
                            استرجاع النسخة
                          </button>
                          <button
                            onClick={() => downloadBackupAsFile(bc)}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs p-2 rounded-xl shrink-0 cursor-pointer transition-colors border border-slate-200"
                            title="تحميل كملف JSON مستقل على الهارد ديسك"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}

          {/* VIEW: WAREHOUSES MANAGEMENT */}
          {activeTab === "warehouses" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6 animate-fade-in text-slate-850"
            >
              {/* Header Box */}
              <div className="bg-white backdrop-blur-md p-6 rounded-2xl border border-slate-200/80 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Warehouse className="w-5 h-5 text-emerald-600" />
                    منظومة إدارة مستودعات ومخازن الشحنات
                  </h3>
                  <p className="text-xs text-slate-600 mt-1">
                    عرض جميع المخازن المعتمَدة لاستقبال الفواتير وإدارتها بإضافة
                    أو حذف فروع ومستودعات التوجيه
                  </p>
                </div>

                {/* Form to add a new warehouse directly */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <input
                    type="text"
                    id="new-warehouse-input"
                    placeholder="اسم المخزن الجديد (مثال: مخزن طنطا الفرعي)"
                    className="border border-slate-200 rounded-xl px-4 py-2 text-xs focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none text-slate-900 font-bold bg-[#f8fafc]/80 transition-all min-w-[240px]"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const val = (
                          e.currentTarget as HTMLInputElement
                        ).value.trim();
                        if (val) {
                          if (warehouses.includes(val)) {
                            showToast(
                              "هذا المخزن متواجد بالفعل بقائمة المخازن.",
                              "info",
                            );
                          } else {
                            setWarehouses([...warehouses, val]);
                            e.currentTarget.value = "";
                            showToast(
                              `تمت إضافة المستودع "${val}" بنجاح للنظام.`,
                            );
                          }
                        }
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      const inputEl = document.getElementById(
                        "new-warehouse-input",
                      ) as HTMLInputElement;
                      const val = inputEl ? inputEl.value.trim() : "";
                      if (val) {
                        if (warehouses.includes(val)) {
                          showToast(
                            "هذا المخزن متواجد بالفعل بقائمة المخازن.",
                            "info",
                          );
                        } else {
                          setWarehouses([...warehouses, val]);
                          if (inputEl) inputEl.value = "";
                          showToast(
                            `تمت إضافة المستودع "${val}" بنجاح للنظام.`,
                          );
                        }
                      } else {
                        showToast(
                          "يرجى إدخال اسم المستودع أولاً للتمكن من الإضافة.",
                          "error",
                        );
                      }
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    إضافة مخزن جديد
                  </button>
                </div>
              </div>

              {/* Grid of Warehouses */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {warehouses.map((wh) => {
                  const whInvoices = invoices.filter((i) => i.warehouse === wh);
                  const totalShipmentsValue = whInvoices.reduce(
                    (sum, curr) => sum + curr.totalAmount,
                    0,
                  );
                  const unpaidInvoicesCount = whInvoices.filter(
                    (i) => i.status === "unpaid",
                  ).length;
                  const paidInvoicesCount = whInvoices.filter(
                    (i) => i.status === "paid",
                  ).length;
                  const lastShipment =
                    whInvoices.length > 0
                      ? [...whInvoices].sort((a, b) =>
                          (b.issueDate || "").localeCompare(a.issueDate || ""),
                        )[0]
                      : null;

                  return (
                    <div
                      key={wh}
                      className="bg-white p-5 rounded-2xl border border-slate-200 shadow-md flex flex-col justify-between hover:border-emerald-500/40 transition-all duration-200 group relative overflow-hidden text-slate-800"
                    >
                      {/* Ambient background decoration */}
                      <div className="absolute top-0 right-0 w-24 h-24 bg-slate-100 rounded-full -mr-6 -mt-6 -z-0 opacity-20 group-hover:bg-slate-100 transition-colors pointer-events-none"></div>

                      <div className="relative z-10">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
                              <Warehouse className="w-5 h-5 text-emerald-600" />
                            </div>
                            <div>
                              <h4 className="font-bold text-slate-800 text-sm leading-snug">
                                {wh}
                              </h4>
                              <p className="text-[11px] text-slate-600 font-medium">
                                سجل شحنات الاستقبال بالموقع
                              </p>
                            </div>
                          </div>

                          <div className="bg-slate-50/60 text-slate-700 text-xs px-2.5 py-1 rounded-full border border-slate-200 font-bold">
                            {whInvoices.length}{" "}
                            {whInvoices.length === 1 ? "شحنة" : "شحنات مسجلة"}
                          </div>
                        </div>

                        {/* Financial Statistics details section */}
                        <div className="mt-5 grid grid-cols-2 gap-3 bg-slate-50/60/30 p-3 rounded-xl border border-slate-200">
                          <div>
                            <span className="text-[10px] text-slate-600 font-bold block mb-0.5">
                              القيمة المالية الكلية
                            </span>
                            <span className="text-xs font-black text-emerald-600 font-mono">
                              {fAmt(totalShipmentsValue)} ج.م
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-600 font-bold block mb-0.5">
                              تحليل الشحنات
                            </span>
                            <div className="flex items-center gap-1.5 text-[10px] font-bold">
                              <span className="text-emerald-600">
                                ✓ {paidInvoicesCount} مسدد
                              </span>
                              <span className="text-slate-600">|</span>
                              <span className="text-amber-600">
                                🕞 {unpaidInvoicesCount} مستحق
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Last Shipment tracker */}
                        {lastShipment ? (
                          <div className="mt-4 text-[11px] text-slate-600 flex items-center gap-1.5 border-t border-slate-200/80 pt-3">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span>آخر شحنة واردة:</span>
                            <span className="font-mono font-bold text-slate-800">
                              #{lastShipment.invoiceNumber}
                            </span>
                            <span className="text-slate-600">بتاريخ</span>
                            <span className="font-bold text-slate-700">
                              {lastShipment.issueDate || "2026-06-01"}
                            </span>
                          </div>
                        ) : (
                          <div className="mt-4 text-[11px] text-slate-500 italic border-t border-slate-200/80 pt-3">
                            لا يوجد فواتير واردة مسجلة لهذا المخزن حتى الآن.
                          </div>
                        )}
                      </div>

                      {/* Action buttons section */}
                      <div className="mt-5 pt-3 border-t border-slate-200 flex items-center justify-end relative z-10">
                        <button
                          onClick={() => {
                            handleRequestDeleteWarehouse(wh, whInvoices.length);
                          }}
                          className="text-rose-600 hover:text-rose-350 hover:bg-rose-500/10 p-2 rounded-xl text-xs font-bold transition-all duration-150 flex items-center justify-center gap-1 cursor-pointer"
                          title="حذف المخزن من قائمة الخيارات"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span>إلغاء واعتماد الإزالة</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </div>
      </main>

      {/* FOOTER */}
      <footer className="no-print text-center text-[11px] text-slate-600 border-t border-slate-200 mt-12 pt-6 max-w-7xl mx-auto w-full">
        <p>
          مستشفى مرسال للأطفال - Marsal Children's Hospital المنظومة المتكاملة لإدارة المدفوعات والمشتريات
          © 2026. كافة الحقوق محفوظة بسلامة وأمان.
        </p>
      </footer>

      {/* MODAL: CHOOSE SETTLEMENT METHOD */}
      {showSettleInvoiceModal && invoiceToSettle && (
        <div
          className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 no-print text-right"
          dir="rtl"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-slate-100/80 text-slate-800 rounded-3xl max-w-lg w-full p-4 sm:p-6 shadow-2xl border border-slate-200 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900">
                  سداد وتصفية الفاتورة: {invoiceToSettle.invoiceNumber}
                </h3>
              </div>
              <button
                onClick={() => setShowSettleInvoiceModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Invoice details summary */}
              <div className="bg-[#1e293b] rounded-xl p-4 border border-slate-200 space-y-2">
                <div className="flex justify-between items-center text-slate-700">
                  <span>المورّد المستحق:</span>
                  <span className="font-bold text-white">
                    {suppliers.find((s) => s.id === invoiceToSettle.supplierId)
                      ?.company || "مورد غير معروف"}
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-700">
                  <span>تاريخ الاستحقاق:</span>
                  <span className="font-mono text-white">
                    {invoiceToSettle.dueDate}
                  </span>
                </div>
                {invoiceToSettle.creditNoteAmount &&
                invoiceToSettle.creditNoteAmount > 0 ? (
                  <>
                    <div className="flex justify-between items-center text-slate-600">
                      <span>القيمة الأصلية للفاتورة:</span>
                      <span className="font-mono">
                        {fAmt(invoiceToSettle.totalAmount)} ج.م
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-rose-450 text-rose-600">
                      <span>خصم الإشعار الدائن:</span>
                      <span className="font-mono font-bold">
                        - {fAmt(invoiceToSettle.creditNoteAmount)} ج.م
                      </span>
                    </div>
                  </>
                ) : null}
                <div className="flex justify-between items-center border-t border-slate-200 pt-2">
                  <span className="text-slate-800 font-bold">
                    صافي القيمة المطلوبة للسداد:
                  </span>
                  <span className="text-base font-black text-[#34d399] font-mono">
                    {fAmt(
                      invoiceToSettle.totalAmount -
                        (invoiceToSettle.creditNoteAmount || 0),
                    )}{" "}
                    ج.م
                  </span>
                </div>
              </div>

              {/* Payment Method Tabs */}
              <div>
                <label className="text-slate-600 font-bold mb-2 block">
                  اختر طريقة السداد التسووي:
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedPaymentMethod("bank_transfer")}
                    className={`p-3.5 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all cursor-pointer ${
                      selectedPaymentMethod === "bank_transfer"
                        ? "bg-emerald-600/20 border-emerald-500 text-slate-900 font-bold ring-2 ring-emerald-500/10"
                        : "bg-slate-850 border-slate-200 text-slate-405 text-slate-600 hover:text-slate-800 hover:bg-slate-100"
                    }`}
                  >
                    <Building className="w-5 h-5 text-emerald-600" />
                    <span className="font-bold">تحويل بنكي فوري (RTGS)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedPaymentMethod("cash")}
                    className={`p-3.5 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all cursor-pointer ${
                      selectedPaymentMethod === "cash"
                        ? "bg-amber-600/20 border-amber-500 text-slate-900 font-bold ring-2 ring-amber-500/10"
                        : "bg-slate-850 border-slate-200 text-slate-405 text-slate-600 hover:text-slate-800 hover:bg-slate-100"
                    }`}
                  >
                    <Wallet className="w-5 h-5 text-amber-600" />
                    <span className="font-bold">صرف نقدي من الخزينة</span>
                  </button>
                </div>
              </div>

              {/* Bank Selection parameters */}
              {selectedPaymentMethod === "bank_transfer" && (
                <div className="space-y-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <p className="text-slate-600 font-bold mb-1">
                    اختر البنك المحلي المخصّوم منه:
                  </p>

                  {linkedBanks.filter((b) => b.isLinked).length === 0 ? (
                    <div className="text-amber-600 font-semibold p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-center leading-relaxed">
                      ⚠️ لا يوجد أي حساب بنكي نشط حالياً! يرجى الانتقال إلى
                      تبويب "التكامل البنكي" لربط حساب في البنك الأهلي أو بنك
                      مصر.
                    </div>
                  ) : (
                    <select
                      value={selectedPaymentBank}
                      onChange={(e) => setSelectedPaymentBank(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-800 p-2.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 font-bold"
                    >
                      {linkedBanks
                        .filter((b) => b.isLinked)
                        .map((b) => (
                          <option key={b.bankName} value={b.bankName}>
                            {b.bankName} ({b.accountNumber})
                          </option>
                        ))}
                    </select>
                  )}

                  <div className="text-[10px] text-slate-500 font-light mt-1 text-center">
                    سيتم إجراء تسوية فوريّ ولحظية وإيداع المدفوعات في الـ IBAN
                    المقيد للمورد تلقائياً.
                  </div>
                </div>
              )}

              {/* Cash safe selection parameters */}
              {selectedPaymentMethod === "cash" && (
                <div className="space-y-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">
                      السيولة النقدية المتوفرة بالخزينة:
                    </span>
                    <span
                      className={`font-mono font-black text-sm ${safeBalance >= invoiceToSettle.totalAmount - (invoiceToSettle.creditNoteAmount || 0) ? "text-amber-600" : "text-rose-450 text-rose-450 text-rose-600"}`}
                    >
                      {fAmt(safeBalance)} ج.م
                    </span>
                  </div>

                  {safeBalance <
                  invoiceToSettle.totalAmount -
                    (invoiceToSettle.creditNoteAmount || 0) ? (
                    <div className="p-3 bg-rose-500/15 border border-rose-500/20 text-rose-700 rounded-lg space-y-2">
                      <p className="font-semibold text-center">
                        ⚠️ رصيد الخزينة الحالي غير كافٍ لتسديد هذه الفاتورة
                        نقداً!
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setShowSettleInvoiceModal(false);
                          setSafeDepositAmount(
                            invoiceToSettle.totalAmount -
                              (invoiceToSettle.creditNoteAmount || 0) -
                              safeBalance,
                          );
                          setShowSafeDepositModal(true);
                        }}
                        className="w-full bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-bold py-2 rounded-lg text-[11px] cursor-pointer text-center"
                      >
                        قم بتغذية الخزينة الآن بقيمة العجز (
                        {fAmt(
                          invoiceToSettle.totalAmount -
                            (invoiceToSettle.creditNoteAmount || 0) -
                            safeBalance,
                        )}{" "}
                        ج.م) +
                      </button>
                    </div>
                  ) : (
                    <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-300 text-center font-medium">
                      ✓ السيولة متاحة وسيتم الخصم التلقائي وتسجيل الحركة في
                      القيود المالية لقسم الحسابات.
                    </div>
                  )}

                  <div className="text-[10px] text-slate-500 font-light text-center">
                    سيتم إصدار إذن صرف خزينة الكتروني فوري وتحديث تقرير الأرصدة.
                  </div>
                </div>
              )}

              {/* Submit details */}
              <div className="flex gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() =>
                    executeFinalSettlement(
                      invoiceToSettle,
                      selectedPaymentMethod,
                      selectedPaymentBank,
                    )
                  }
                  disabled={
                    selectedPaymentMethod === "cash" &&
                    safeBalance <
                      invoiceToSettle.totalAmount -
                        (invoiceToSettle.creditNoteAmount || 0)
                  }
                  className={`flex-1 py-3 px-4 font-bold rounded-xl text-center cursor-pointer transition-all ${
                    selectedPaymentMethod === "cash" &&
                    safeBalance <
                      invoiceToSettle.totalAmount -
                        (invoiceToSettle.creditNoteAmount || 0)
                      ? "bg-slate-100 text-slate-500 cursor-not-allowed"
                      : "bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white shadow-lg font-bold"
                  }`}
                >
                  تأكيد وإجراء التسوية والدفع الفوري
                </button>
                <button
                  type="button"
                  onClick={() => setShowSettleInvoiceModal(false)}
                  className="bg-slate-100 hover:bg-slate-200 active:bg-slate-300 border border-slate-200 text-slate-700 font-bold px-4 py-3 rounded-xl cursor-pointer transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* MODAL: REPLENISH SAFE/TREASURY */}
      {showSafeDepositModal && (
        <div
          className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 no-print text-right"
          dir="rtl"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white text-slate-800 rounded-3xl max-w-sm w-full p-4 sm:p-6 shadow-2xl border border-slate-200 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-amber-600" />
                <h3 className="text-base font-bold text-slate-900">
                  تغذية الخزينة النقدية (كاش)
                </h3>
              </div>
              <button
                onClick={() => setShowSafeDepositModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <p className="text-xs text-slate-700 mb-2 leading-relaxed font-semibold">
                  أدخل بموجبه قيمة المبلغ المراد إيداعه أو تحويله من الحساب
                  الجاري البنكي لخزينة الشركة لتوفير سيولة كاش كافية:
                </p>

                <div className="relative">
                  <input
                    type="number"
                    value={safeDepositAmount}
                    onChange={(e) =>
                      setSafeDepositAmount(Math.max(1, Number(e.target.value)))
                    }
                    className="w-full bg-white border border-slate-200 rounded-xl p-3 pr-4 pl-12 font-mono text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="100,000"
                  />
                  <div className="absolute left-3 top-3.5 text-xs text-slate-600 font-bold font-mono">
                    ج.م
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setSafeBalance((prev) => prev + safeDepositAmount);
                    showToast(
                      `تم إيداع مبلغ ${fAmt(safeDepositAmount)} ج.م وتغذية خزينة المنشأة بنجاح.`,
                    );
                    setShowSafeDepositModal(false);
                  }}
                  className="flex-1 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-900 font-extrabold py-3 px-4 rounded-xl text-center cursor-pointer shadow-md text-xs font-bold"
                >
                  إيداع وتغذية الخزينة
                </button>
                <button
                  type="button"
                  onClick={() => setShowSafeDepositModal(false)}
                  className="bg-slate-100 hover:bg-slate-200 active:bg-slate-100/80 border border-slate-200 text-slate-700 font-bold px-4 py-3 rounded-xl cursor-pointer text-xs"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* MODAL: ADD WAREHOUSE */}
      {showAddWarehouseModal && (
        <div className="fixed inset-0 bg-slate-950/45 backdrop-blur-sm flex items-center justify-center z-[70] p-4 font-sans" dir="rtl">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white backdrop-blur-md text-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200/80 space-y-5"
          >
            <div className="flex items-center justify-between border-b border-slate-200/60 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                  <Warehouse className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-white">
                    إضافة مخزن جديد للنظام
                  </h3>
                  <p className="text-[10px] text-slate-500">
                    سيتم إدراج هذا المستودع في قائمة الخيارات لجميع الفواتير وتعيينه كوجهة حالية للعملية.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAddWarehouseModal(false);
                  setNewWarehouseName("");
                  setAddWarehouseContext(null);
                }}
                className="p-1.5 rounded-xl hover:bg-slate-100/70 text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-slate-600 block mb-1.5 text-xs font-bold font-sans">
                  اسم المخزن / المستودع *
                </label>
                <input
                  type="text"
                  autoFocus
                  required
                  value={newWarehouseName}
                  onChange={(e) => setNewWarehouseName(e.target.value)}
                  placeholder="مثال: مخزن طنطا الفرعي، مخزن مرسال الرئيسي"
                  className="w-full border border-slate-200 rounded-xl p-3 bg-[#f8fafc]/80 text-slate-900 font-bold placeholder:text-slate-400 font-sans text-xs focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleSaveNewWarehouse();
                    }
                  }}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleSaveNewWarehouse}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5 font-sans"
              >
                <Plus className="w-4 h-4" />
                تأكيد الإضافة والتحديد
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddWarehouseModal(false);
                  setNewWarehouseName("");
                  setAddWarehouseContext(null);
                }}
                className="bg-slate-100/60 hover:bg-slate-100 text-slate-700 border border-slate-200/60 text-xs font-bold py-2.5 px-4 rounded-xl transition-all cursor-pointer font-sans"
              >
                إلغاء
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* MODAL: CONFIRM DELETE SUPPLIER */}
      {supplierToDelete && (
        <div className="fixed inset-0 bg-slate-950/45 backdrop-blur-sm flex items-center justify-center z-[70] p-4 font-sans" dir="rtl">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white backdrop-blur-md text-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200/80 space-y-5"
          >
            <div className="flex items-center gap-3 border-b border-slate-200/60 pb-3">
              <div className="p-2 bg-rose-500/10 rounded-xl border border-rose-500/20">
                <ShieldAlert className="w-6 h-6 text-rose-450" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-800 font-sans">
                  تأكيد حذف المورد نهائياً
                </h3>
                <p className="text-[10px] text-slate-600 font-sans">
                  إجراء حساس يتطلب التحقق الأمني من الإدارة.
                </p>
              </div>
            </div>

            <div className="p-4 bg-amber-500/5 rounded-2xl border border-amber-500/20 text-amber-200 text-xs leading-relaxed space-y-2 font-sans">
              <span className="font-bold block text-rose-600 flex items-center gap-1.5 font-sans">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                تنبيه حذف نهائي وتصفية:
              </span>
              <p className="font-sans font-medium text-slate-700">
                هل أنت متأكد من رغبتك في حذف المورد <span className="text-rose-600 font-extrabold font-mono">"{supplierToDelete.name}"</span> وكافة فواتير المشتريات والبيانات والعمليات المرتبطة به من السجلات؟
              </p>
              <span className="text-[10px] text-slate-500 block font-normal leading-normal font-sans">
                ملاحظة: النظام لن يسمح بالحذف في حال وجود أي أرصدة معلقة أو فواتير مستحقة الدفع حالياً.
              </span>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={executeDeleteSupplier}
                className="flex-1 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-slate-800 text-xs font-bold py-2.5 px-4 rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5 font-sans"
              >
                <Trash2 className="w-4 h-4" />
                نعم، احذف المورد فوراً
              </button>
              <button
                type="button"
                onClick={() => setSupplierToDelete(null)}
                className="bg-slate-100/60 hover:bg-slate-100 text-slate-700 border border-slate-200/60 text-xs font-bold py-2.5 px-4 rounded-xl transition-all cursor-pointer font-sans"
              >
                التراجع والإلغاء
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* MODAL: CONFIRM DELETE WAREHOUSE */}
      {warehouseToDelete && (
        <div className="fixed inset-0 bg-slate-950/45 backdrop-blur-sm flex items-center justify-center z-[70] p-4 font-sans" dir="rtl">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white backdrop-blur-md text-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200/80 space-y-5"
          >
            <div className="flex items-center gap-3 border-b border-slate-200/60 pb-3">
              <div className="p-2 bg-amber-500/10 rounded-xl border border-amber-500/25">
                <Warehouse className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-800 font-sans">
                  إزالة مخزن من خيارات النظام
                </h3>
                <p className="text-[10px] text-slate-600 font-sans">
                  حذف وإلغاء وجهة استلام الفواتير الحالية.
                </p>
              </div>
            </div>

            <div className={`p-4 rounded-2xl border text-xs leading-relaxed space-y-2 font-sans ${
              warehouseToDelete.invoicesCount > 0 
                ? "bg-rose-500/10 border-rose-500/20 text-rose-200" 
                : "bg-slate-100/30 border-slate-200 text-slate-700"
            }`}>
              <span className={`font-bold block flex items-center gap-1.5 font-sans ${
                warehouseToDelete.invoicesCount > 0 ? "text-rose-600" : "text-amber-600"
              }`}>
                <AlertTriangle className="w-4 h-4" />
                {warehouseToDelete.invoicesCount > 0 ? "تحذير: المخزن مرتبط بعمليات!" : "تأكيد إزالة المخزن:"}
              </span>
              <p className="font-sans font-medium text-slate-700">
                {warehouseToDelete.invoicesCount > 0 ? (
                  <>
                    تنبيه: هذا المخزن مرتبط بالفعل بـ <span className="font-bold underline text-white">({warehouseToDelete.invoicesCount})</span> فواتير مسجلة في شحنات المشتريات. حذفه الآن سيؤثر على تصفية وعرض هذي الفواتير. هل تود حذف المخزن <span className="text-rose-450 font-extrabold font-mono">"{warehouseToDelete.name}"</span> نهائياً على أي حال؟
                  </>
                ) : (
                  <>
                    هل أنت متأكد من رغبتك في حذف المخزن <span className="text-slate-900 font-black font-mono">"{warehouseToDelete.name}"</span> من السجلات وقائمة الخيارات المتاحة؟
                  </>
                )}
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={executeDeleteWarehouse}
                className="flex-1 bg-rose-600 hover:bg-rose-500 active:bg-rose-750 text-slate-800 text-xs font-bold py-2.5 px-4 rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5 font-sans"
              >
                <Trash2 className="w-4 h-4" />
                تأكيد وبدء الحذف
              </button>
              <button
                type="button"
                onClick={() => setWarehouseToDelete(null)}
                className="bg-slate-100/60 hover:bg-slate-100 text-slate-700 border border-slate-200/60 text-xs font-bold py-2.5 px-4 rounded-xl transition-all cursor-pointer font-sans"
              >
                تراجع
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* MODAL: ADD SUPPLIER */}
      {showAddSupplierModal && (
        <div className="fixed inset-0 bg-slate-950/45 backdrop-blur-sm flex items-center justify-center z-[80] p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white backdrop-blur-md text-slate-800 rounded-3xl max-w-xl w-full p-4 sm:p-6 shadow-2xl border border-slate-200/80 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-200/60 pb-3">
              <h3 className="text-base font-extrabold text-black">
                إضافة مورد جديد
              </h3>
              <button
                onClick={() => setShowAddSupplierModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100/70 text-slate-600 hover:text-slate-900 transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSupplier} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-600 block mb-1">
                    اسم المورد الكامل *
                  </label>
                  <input
                    type="text"
                    required
                    value={newSupplier.name}
                    onChange={(e) =>
                      setNewSupplier({ ...newSupplier, name: e.target.value })
                    }
                    className="w-full border border-slate-200 rounded-lg p-2.5 bg-white text-slate-800 font-semibold placeholder:text-slate-400 font-sans focus:ring-1 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                    placeholder="م. محمد العربي"
                  />
                </div>
                <div>
                  <label className="text-slate-600 block mb-1">
                    اسم الشركة / المؤسسة *
                  </label>
                  <input
                    type="text"
                    required
                    value={newSupplier.company}
                    onChange={(e) =>
                      setNewSupplier({
                        ...newSupplier,
                        company: e.target.value,
                      })
                    }
                    className="w-full border border-slate-200 rounded-lg p-2.5 bg-white text-slate-800 font-semibold placeholder:text-slate-400 font-sans focus:ring-1 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                    placeholder="مجموعة السويدي كابلات"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-600 block mb-1">
                    رقم الهاتف التواصل *
                  </label>
                  <input
                    type="tel"
                    value={newSupplier.phone}
                    onChange={(e) =>
                      setNewSupplier({ ...newSupplier, phone: e.target.value })
                    }
                    className="w-full border border-slate-200 rounded-lg p-2.5 bg-white text-slate-800 font-semibold placeholder:text-slate-400 font-sans focus:ring-1 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                    placeholder="01012345678"
                  />
                </div>
                <div>
                  <label className="text-slate-600 block mb-1">
                    رقم الحساب البنكي / International IBAN *
                  </label>
                  <input
                    type="text"
                    value={newSupplier.bankAccount}
                    onChange={(e) =>
                      setNewSupplier({
                        ...newSupplier,
                        bankAccount: e.target.value,
                      })
                    }
                    className="w-full border border-slate-200 rounded-lg p-2.5 bg-white font-mono text-[11px] text-slate-800 font-semibold placeholder:text-slate-400 font-sans focus:ring-1 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                    placeholder="EG000000000000000000000000000"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-600 block mb-1">
                  ملاحظات وشروط إضافية
                </label>
                <textarea
                  value={newSupplier.notes}
                  onChange={(e) =>
                    setNewSupplier({ ...newSupplier, notes: e.target.value })
                  }
                  className="w-full border border-slate-200 rounded-lg p-2 bg-[#f8fafc]/85 h-20 text-slate-800 font-semibold placeholder:text-slate-400 font-sans focus:ring-1 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                  placeholder="أدخل أي ملاحظات حول الدفع أو السداد..."
                />
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-200/60 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddSupplierModal(false)}
                  className="bg-slate-100/60 hover:bg-slate-100 text-slate-700 border border-slate-200/60 font-bold px-4 py-2.5 rounded-lg select-none cursor-pointer transition-colors"
                >
                  إلغاء الأمر
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold px-5 py-2.5 rounded-lg cursor-pointer transition-all"
                >
                  حفظ المورد
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* MODAL: ADD INVOICE */}
      {showAddInvoiceModal && (
        <div className="fixed inset-0 bg-slate-950/45 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white backdrop-blur-md text-slate-800 rounded-3xl max-w-5xl w-full p-4 sm:p-6 shadow-2xl border border-slate-200/80 space-y-4 max-h-[95vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-200/60 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-600" />
                تسجيل فاتورة جديدة
              </h3>
              <button
                onClick={() => setShowAddInvoiceModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100/70 text-slate-500 hover:text-slate-900 transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddInvoice} className="text-xs space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Right Side Panel: Core Invoice Details */}
                <div className="lg:col-span-5 bg-[#f8fafc]/80 p-4 rounded-2xl border border-slate-200/60 space-y-4">
                  <h4 className="font-bold text-slate-800 border-b border-slate-200/50 pb-2 mb-1">
                    بيانات الشحنة والمورد
                  </h4>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-slate-600 font-bold">
                        اختر المورد المرتبط *
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowAddSupplierModal(true)}
                        className="text-emerald-600 hover:text-emerald-800 font-extrabold flex items-center gap-1 transition-colors px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded text-[10px]"
                        title="إضافة مورد جديد"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>مورد جديد</span>
                      </button>
                    </div>
                    <select
                      required
                      value={newInvoice.supplierId}
                      onChange={(e) =>
                        setNewInvoice({
                          ...newInvoice,
                          supplierId: e.target.value,
                        })
                      }
                      className="w-full border border-slate-200 rounded-lg p-2.5 bg-white font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500/20 transition-all cursor-pointer"
                    >
                      <option className="bg-white" value="">-- اضغط للاختيار --</option>
                      {suppliers.map((s) => (
                        <option className="bg-white" key={s.id} value={s.id}>
                          {s.name} ({s.company})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-600 block mb-1 font-bold">
                      تاريخ إضافة الفاتورة *
                    </label>
                    <input
                      type="date"
                      required
                      value={newInvoice.issueDate}
                      onChange={(e) =>
                        setNewInvoice({
                          ...newInvoice,
                          issueDate: e.target.value,
                        })
                      }
                      className="w-full border border-slate-200 rounded-lg p-2.5 bg-white/95 font-mono text-slate-800 font-semibold focus:ring-1 focus:ring-emerald-500/20 outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-slate-600 block mb-1 font-bold">
                      تاريخ الاستحقاق المتوقع *
                    </label>
                    <input
                      type="date"
                      required
                      value={newInvoice.dueDate}
                      onChange={(e) =>
                        setNewInvoice({
                          ...newInvoice,
                          dueDate: e.target.value,
                        })
                      }
                      className="w-full border border-slate-200 rounded-lg p-2.5 bg-white/95 font-mono text-slate-800 font-semibold focus:ring-1 focus:ring-emerald-500/20 outline-none"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-slate-600 block font-bold">
                        المخزن المتلقي للشحنة *
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setAddWarehouseContext("new");
                          setShowAddWarehouseModal(true);
                        }}
                        className="text-[10px] text-emerald-700 font-bold hover:text-emerald-800 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 hover:bg-emerald-500/20 transition-all cursor-pointer"
                      >
                        + مخزن جديد
                      </button>
                    </div>
                    <select
                      required
                      value={newInvoice.warehouse}
                      onChange={(e) =>
                        setNewInvoice({
                          ...newInvoice,
                          warehouse: e.target.value,
                        })
                      }
                      className="w-full border border-slate-200 rounded-lg p-2.5 bg-white text-slate-800 font-semibold cursor-pointer focus:outline-none focus:ring-1 focus:ring-emerald-500/20 transition-all"
                    >
                      <option className="bg-white" value="">-- اختر المخزن --</option>
                      {warehouses.map((wh) => (
                        <option className="bg-white" key={wh} value={wh}>
                          {wh}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-600 font-bold block mb-1">
                      البيانات / مذكرات عامة
                    </label>
                    <input
                      type="text"
                      value={newInvoice.notes || ""}
                      onChange={(e) =>
                        setNewInvoice({ ...newInvoice, notes: e.target.value })
                      }
                      className="w-full border border-slate-200 rounded-lg p-2.5 bg-white text-slate-800 font-semibold placeholder:text-slate-400 font-sans focus:ring-1 focus:ring-emerald-500/20 outline-none transition-all"
                      placeholder="شحنة التجهيز المقررة لمخازن العاشر"
                    />
                  </div>

                  <div>
                    <label className="text-slate-600 block mb-1.5 font-bold">
                      مرفقات الفاتورة (يمكنك اختيار ملف أو أكثر) *
                    </label>
                    <div className="space-y-2">
                      <label className="w-full flex flex-col items-center justify-center border-2 border-dashed border-slate-200 hover:border-emerald-500/80 hover:bg-[#f8fafc]/80 rounded-2xl p-4 bg-slate-100/50 cursor-pointer transition-all duration-200 group text-center">
                        <Upload className="w-6 h-6 text-emerald-600 group-hover:scale-110 transition-transform mb-1.5" />
                        <span className="text-slate-800 font-bold text-xs">
                          اضغط لتصفح واختيار ملف أو أكثر من جهازك
                        </span>
                        <span className="text-slate-500 text-[10px] mt-0.5">
                          الصيغ المدعومة: الصور، PDF، ملفات Word و Excel
                        </span>
                        <input
                          type="file"
                          multiple
                          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                          onChange={(e) =>
                            handleMultipleFilesUpload(e, "invoice")
                          }
                          className="hidden"
                        />
                      </label>
                      {invoiceAttachments.length > 0 && (
                        <div className="bg-slate-100/60 p-2 rounded-xl border border-slate-200 mt-2 space-y-1">
                          <p className="font-bold text-slate-700 text-[10px] mb-1">
                            المرفقات المختارة ({invoiceAttachments.length}):
                          </p>
                          {invoiceAttachments.map((f, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between bg-slate-100/60 text-white p-1.5 rounded border border-slate-200/80 text-[11px]"
                            >
                              <span
                                className="font-mono font-bold text-slate-800 truncate max-w-[200px]"
                                title={f.name}
                              >
                                {f.name}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  setInvoiceAttachments((prev) =>
                                    prev.filter((_, i) => i !== idx),
                                  )
                                }
                                className="p-1 text-rose-600 hover:bg-rose-500/10 rounded cursor-pointer"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>



                {/* Left Side Panel: Items Row Editor & VAT/Calculations & Credit Note */}
                <div className="lg:col-span-7 space-y-4">
                  {/* Items header */}
                  <div className="border border-slate-200/60 p-5 rounded-2xl bg-[#f8fafc]/80 space-y-4">
                    <div>
                      <label className="text-slate-600 block mb-1 font-bold">
                        القيمة الأساسية للفاتورة (قبل الخصم) *
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          required
                          min="0.01"
                          step="any"
                          value={invoiceBaseAmount || ""}
                          onChange={(e) =>
                            setInvoiceBaseAmount(
                              parseFloat(e.target.value) || 0,
                            )
                          }
                          placeholder="مثال: 15000"
                          className="w-full border border-slate-200 rounded-xl p-3 bg-[#f8fafc] font-mono font-bold text-slate-800 text-sm focus:ring-1 focus:ring-emerald-500/20 outline-none transition-all"
                        />
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-xs select-none">
                          ج.م
                        </span>
                      </div>
                    </div>

                    <div className="border-t border-slate-200/50 pt-3">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-slate-700 block font-bold text-xs">
                          الخصومات المطبقة على الفاتورة (تنقص من الإجمالي):
                        </label>
                        <button
                          type="button"
                          onClick={handleAddDiscountRow}
                          className="text-emerald-700 hover:text-emerald-800 font-bold text-xs flex items-center gap-1 cursor-pointer bg-emerald-500/10 hover:bg-emerald-500/20 py-1.5 px-2.5 rounded-lg border border-emerald-500/20 transition-all"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          إضافة خصم جديد
                        </button>
                      </div>

                      {discounts.length === 0 ? (
                        <p className="text-[11px] text-slate-500 py-2 text-right">
                          لا توجد خصومات مضافة حالياً. سيتم حساب القيمة الأساسية
                          للفاتورة كاملة.
                        </p>
                      ) : (
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                          {discounts.map((disc, index) => (
                            <div
                              key={index}
                              className="flex items-center gap-2 bg-slate-50/40 p-2 rounded-xl border border-slate-200/60"
                            >
                              <div className="flex-1">
                                <input
                                  type="text"
                                  required
                                  value={disc.name}
                                  onChange={(e) =>
                                    handleUpdateDiscountRow(
                                      index,
                                      "name",
                                      e.target.value,
                                    )
                                  }
                                  placeholder="نوع الخصم (مثال: خصم تعجيل دفع، خصم تجاري...)"
                                  className="w-full border border-slate-200 rounded-lg p-1.5 bg-white text-slate-800 placeholder:text-slate-400 font-sans focus:ring-1 focus:ring-emerald-500/20 outline-none"
                                />
                              </div>
                              <div className="w-32 relative">
                                <input
                                  type="number"
                                  required
                                  min="0"
                                  step="any"
                                  value={disc.price || ""}
                                  onChange={(e) =>
                                    handleUpdateDiscountRow(
                                      index,
                                      "price",
                                      parseFloat(e.target.value) || 0,
                                    )
                                  }
                                  placeholder="المبلغ"
                                  className="w-full border border-slate-200 rounded-lg p-1.5 bg-white font-mono text-left text-slate-800 focus:ring-1 focus:ring-emerald-500/20 outline-none pl-8"
                                />
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-[10px] font-bold">
                                  ج.م
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  handleRemoveDiscountRow(index)
                                }
                                className="p-1 px-1.5 text-slate-600 hover:text-rose-450 hover:bg-rose-500/10 rounded-lg cursor-pointer transition-colors"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* VAT and Totals Calculator */}
                  {(() => {
                    const totalDiscounts = discounts.reduce(
                      (sum, d) => sum + d.price,
                      0,
                    );
                    const subtotal = Math.max(
                      0,
                      invoiceBaseAmount - totalDiscounts,
                    );
                    const vatAmount = newInvoice.isCustomVat
                      ? Math.round(
                          (newInvoice.customVatAmount !== undefined
                            ? newInvoice.customVatAmount
                            : 0) * 100,
                        ) / 100
                      : Math.round(
                          subtotal *
                            ((newInvoice.vatRate !== undefined
                              ? newInvoice.vatRate
                              : 14) /
                              100) *
                            100,
                        ) / 100;
                    const vatRateDisplay = newInvoice.isCustomVat
                      ? Math.round((vatAmount / (subtotal || 1)) * 100 * 100) /
                        100
                      : newInvoice.vatRate !== undefined
                        ? newInvoice.vatRate
                        : 14;
                    const totalAmount = subtotal + vatAmount;

                    return (
                      <div className="bg-slate-100/60 p-4 rounded-2xl border border-slate-200/60 space-y-3">
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                          <div className="flex flex-col gap-2.5 w-full md:w-auto">
                            {/* Toggle between Automatic Percentage and Custom Tax Amount */}
                            <div className="flex items-center gap-2">
                              <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-slate-700 select-none">
                                <input
                                  type="checkbox"
                                  checked={newInvoice.isCustomVat || false}
                                  onChange={(e) =>
                                    setNewInvoice({
                                      ...newInvoice,
                                      isCustomVat: e.target.checked,
                                    })
                                  }
                                  className="rounded border-slate-200 bg-[#f8fafc] text-[#0284c7] focus:ring-[#0284c7] focus:ring-offset-0 w-3.5 h-3.5 cursor-pointer"
                                />
                                <span>
                                  كتابة قيمة ضريبة مخصصة (يدوياً بالجنيه)
                                </span>
                              </label>
                            </div>

                            {!newInvoice.isCustomVat ? (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs text-slate-600 font-bold font-sans">
                                  ضريبة القيمة المضافة (VAT):
                                </span>
                                <div className="flex items-center gap-1.5 bg-[#f8fafc] border border-slate-200 rounded-lg px-2 py-0.5 shadow-xs">
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={
                                      newInvoice.vatRate !== undefined
                                        ? newInvoice.vatRate
                                        : 14
                                    }
                                    onChange={(e) =>
                                      setNewInvoice({
                                        ...newInvoice,
                                        vatRate: Math.max(
                                          0,
                                          parseFloat(e.target.value) || 0,
                                        ),
                                      })
                                    }
                                    className="w-10 text-center font-mono font-bold text-white bg-transparent text-xs focus:outline-none"
                                  />
                                  <span className="text-slate-600 text-xs font-bold font-sans">
                                    %
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setNewInvoice({
                                      ...newInvoice,
                                      vatRate:
                                        (newInvoice.vatRate !== undefined
                                          ? newInvoice.vatRate
                                          : 14) === 14
                                          ? 0
                                          : 14,
                                    })
                                  }
                                  className="text-[9px] text-emerald-600 hover:text-emerald-800 font-extrabold bg-emerald-500/10 hover:bg-emerald-500/20 px-2.5 py-1 rounded-lg border border-emerald-500/20 cursor-pointer transition-colors"
                                >
                                  {(newInvoice.vatRate !== undefined
                                    ? newInvoice.vatRate
                                    : 14) === 14
                                    ? "تصفير الضريبة (0%)"
                                    : "تطبيق الضريبة (14%)"}
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs text-slate-600 font-bold font-sans">
                                  قيمة الضريبة المخصصة:
                                </span>
                                <div className="flex items-center gap-1.5 bg-[#f8fafc] border border-slate-200 rounded-lg px-2 py-1 shadow-xs">
                                  <input
                                    type="number"
                                    min="0"
                                    step="any"
                                    value={
                                      newInvoice.customVatAmount !== undefined
                                        ? newInvoice.customVatAmount
                                        : 0
                                    }
                                    onChange={(e) =>
                                      setNewInvoice({
                                        ...newInvoice,
                                        customVatAmount: Math.max(
                                          0,
                                          parseFloat(e.target.value) || 0,
                                        ),
                                      })
                                    }
                                    onBlur={(e) => {
                                      const rounded =
                                        Math.round(
                                          (parseFloat(e.target.value) || 0) *
                                            100,
                                        ) / 100;
                                      setNewInvoice({
                                        ...newInvoice,
                                        customVatAmount: rounded,
                                      });
                                    }}
                                    className="w-24 text-center font-mono font-bold text-white bg-transparent text-xs focus:outline-none"
                                    placeholder="ادخل القيمة..."
                                  />
                                  <span className="text-slate-600 text-[10px] font-bold">
                                    ج.م
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="space-y-1 w-full sm:w-auto text-left font-mono">
                            <div className="flex justify-between sm:justify-end gap-6 text-slate-600 text-[11px] text-right">
                              <span>قيمة الفاتورة الأساسية:</span>
                              <span className="font-bold text-slate-800">
                                {fAmt(invoiceBaseAmount)} ج.م
                              </span>
                            </div>
                            {totalDiscounts > 0 && (
                              <div className="flex justify-between sm:justify-end gap-6 text-rose-600 text-[11px] text-right">
                                <span>إجمالي الخصم المطبق (-):</span>
                                <span className="font-bold">
                                  {fAmt(totalDiscounts)} ج.م
                                </span>
                              </div>
                            )}
                            <div className="flex justify-between sm:justify-end gap-6 text-slate-600 text-[11px] text-right">
                              <span>الإجمالي قبل الضريبة:</span>
                              <span className="font-bold text-slate-800">
                                {fAmt(subtotal)} ج.م
                              </span>
                            </div>
                            <div className="flex justify-between sm:justify-end gap-6 text-slate-600 text-[11px] text-right">
                              <span>قيمة الضريبة ({vatRateDisplay}%):</span>
                              <span className="font-bold text-slate-800">
                                {fAmt(vatAmount)} ج.م
                              </span>
                            </div>
                            <div className="flex justify-between sm:justify-end gap-6 text-slate-800 font-black text-xs border-t border-slate-200 pt-1 mt-1 text-right">
                              <span>الصافي المطلوب للتوريد:</span>
                              <span className="text-emerald-600 font-black text-sm">
                                {fAmt(totalAmount)} ج.م
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Submission and Action Panel */}
                  <div className="flex items-center justify-end gap-2 border-t border-slate-200/60 pt-3">
                    <button
                      type="button"
                      onClick={() => setShowAddInvoiceModal(false)}
                      className="bg-slate-100/40 hover:bg-slate-100 text-slate-700 border border-slate-200/60 font-bold px-4 py-2.5 rounded-lg select-none cursor-pointer transition-colors"
                    >
                      إلغاء وعودة
                    </button>
                    <button
                      type="submit"
                      className="bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold px-5 py-2.5 rounded-lg cursor-pointer flex items-center gap-1.5 transition-all shadow-md shadow-emerald-600/10"
                    >
                      <span>تسجيل وحفظ الفاتورة</span>
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* MODAL: EDIT INVOICE */}
      {editingInvoice && (
        <div className="fixed inset-0 bg-slate-100/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl max-w-5xl w-full p-4 sm:p-6 shadow-2xl border border-slate-100 space-y-4 text-slate-800 max-h-[95vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-950 flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-700" />
                تعديل بيانات فاتورة المشتريات
              </h3>
              <button
                onClick={() => setEditingInvoice(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateInvoice} className="text-xs space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Right Side Panel: Core Invoice Details */}
                <div className="lg:col-span-5 bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-4">
                  <h4 className="font-bold text-slate-800 border-b border-slate-200 pb-2 mb-1">
                    بيانات تاريخ وحالة الفاتورة
                  </h4>

                  <div>
                    <label className="text-slate-505 block mb-1">
                      اختر المورد المرتبط *
                    </label>
                    <select
                      required
                      value={editingInvoice.supplierId}
                      onChange={(e) =>
                        setEditingInvoice({
                          ...editingInvoice,
                          supplierId: e.target.value,
                        })
                      }
                      className="w-full border border-slate-200 rounded-lg p-2.5 bg-white font-semibold text-slate-900 focus:outline-none"
                    >
                      <option value="">-- اضغط للاختيار --</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.company})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-500 block mb-1 font-bold">
                      رقم الفاتورة الصادر *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="FT-2026-X"
                      value={editingInvoice.invoiceNumber}
                      onChange={(e) =>
                        setEditingInvoice({
                          ...editingInvoice,
                          invoiceNumber: e.target.value,
                        })
                      }
                      className="w-full border border-slate-200 rounded-lg p-2.5 bg-white font-mono font-bold text-slate-800"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="text-slate-505 block mb-1 font-bold">
                        تاريخ إضافة الفاتورة *
                      </label>
                      <input
                        type="date"
                        required
                        value={editingInvoice.issueDate || ""}
                        onChange={(e) =>
                          setEditingInvoice({
                            ...editingInvoice,
                            issueDate: e.target.value,
                          })
                        }
                        className="w-full border border-slate-200 rounded-lg p-2.5 bg-white font-mono text-slate-800 font-semibold"
                      />
                    </div>
                    <div>
                      <label className="text-slate-505 block mb-1 font-bold">
                        تاريخ الاستحقاق المتوقع *
                      </label>
                      <input
                        type="date"
                        required
                        value={editingInvoice.dueDate}
                        onChange={(e) =>
                          setEditingInvoice({
                            ...editingInvoice,
                            dueDate: e.target.value,
                          })
                        }
                        className="w-full border border-slate-200 rounded-lg p-2.5 bg-white font-mono text-slate-800 font-semibold"
                      />
                    </div>
                    <div>
                      <label className="text-slate-505 block mb-1 font-bold">
                        حالة سداد الفاتورة *
                      </label>
                      <select
                        required
                        value={editingInvoice.status}
                        onChange={(e) =>
                          setEditingInvoice({
                            ...editingInvoice,
                            status: e.target.value as "paid" | "unpaid",
                          })
                        }
                        className="w-full border border-slate-200 rounded-lg p-2.5 bg-white font-bold text-slate-900 cursor-pointer focus:outline-none"
                      >
                        <option value="unpaid">لم يتم السداد</option>
                        <option value="paid">تم السداد بالكامل</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-slate-505 block">
                        المخزن المتلقي للشحنة *
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setAddWarehouseContext("edit");
                          setShowAddWarehouseModal(true);
                        }}
                        className="text-[10px] text-emerald-700 font-bold hover:text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 hover:bg-emerald-100 transition-colors cursor-pointer"
                      >
                        + مخزن جديد
                      </button>
                    </div>
                    <select
                      required
                      value={
                        editingInvoice.warehouse ||
                        (warehouses.length > 0 ? warehouses[0] : "")
                      }
                      onChange={(e) =>
                        setEditingInvoice({
                          ...editingInvoice,
                          warehouse: e.target.value,
                        })
                      }
                      className="w-full border border-slate-200 rounded-lg p-2.5 bg-white text-slate-800 font-semibold cursor-pointer focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="">-- اختر المخزن --</option>
                      {warehouses.map((wh) => (
                        <option key={wh} value={wh}>
                          {wh}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-600 block mb-1 font-bold">
                      البيانات / مذكرات عامة
                    </label>
                    <input
                      type="text"
                      value={editingInvoice.notes || ""}
                      onChange={(e) =>
                        setEditingInvoice({
                          ...editingInvoice,
                          notes: e.target.value,
                        })
                      }
                      className="w-full border border-slate-200 rounded-lg p-2.5 bg-white text-slate-800"
                      placeholder="شحنة التجهيز المقررة لمخازن العاشر"
                    />
                  </div>

                  <div>
                    <label className="text-slate-600 block mb-1 font-bold">
                      مرفقات الفاتورة (يمكنك اختيار ملف أو أكثر)
                    </label>
                    <div className="space-y-2">
                      <label className="w-full flex items-center justify-between border border-dashed border-slate-300 hover:border-emerald-500 rounded-lg p-3 bg-white cursor-pointer transition-colors">
                        <span className="text-slate-600 text-[11px] block">
                          اضغط لتصفح وإضافة مرفقات جديدة...
                        </span>
                        <span className="bg-emerald-500/10 text-emerald-700 px-2.5 py-1.5 rounded text-[10px] font-bold">
                          تصفح المرفقات
                        </span>
                        <input
                          type="file"
                          multiple
                          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                          onChange={(e) =>
                            handleMultipleFilesUpload(e, "edit_invoice")
                          }
                          className="hidden"
                        />
                      </label>

                      {((editingInvoice.attachments &&
                        editingInvoice.attachments.length > 0) ||
                        editingInvoice.attachment) && (
                        <div className="bg-slate-50 p-2 rounded-xl border border-slate-200 mt-2 space-y-1">
                          <p className="font-bold text-slate-700 text-[10px] mb-1">
                            المرفقات الحالية:
                          </p>
                          {editingInvoice.attachments &&
                          editingInvoice.attachments.length > 0
                            ? editingInvoice.attachments.map((file, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between bg-white text-black p-1.5 rounded border border-slate-100 text-[11px]"
                                >
                                  <span
                                    className="font-mono font-bold text-black truncate max-w-[200px]"
                                    title={file.name}
                                  >
                                    {file.name}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated =
                                        editingInvoice.attachments?.filter(
                                          (_, i) => i !== idx,
                                        ) || [];
                                      setEditingInvoice({
                                        ...editingInvoice,
                                        attachments: updated,
                                        attachment: updated[0] || undefined,
                                      });
                                    }}
                                    className="p-1 text-rose-500 hover:bg-rose-50 rounded cursor-pointer transition-colors"
                                  >
                                    <XCircle className="w-4 h-4" />
                                  </button>
                                </div>
                              ))
                            : editingInvoice.attachment && (
                                <div className="flex items-center justify-between bg-white text-black p-1.5 rounded border border-slate-100 text-[11px]">
                                  <span
                                    className="font-mono font-bold text-black truncate max-w-[200px]"
                                    title={editingInvoice.attachment.name}
                                  >
                                    {editingInvoice.attachment.name}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setEditingInvoice({
                                        ...editingInvoice,
                                        attachment: undefined,
                                        attachments: [],
                                      })
                                    }
                                    className="p-1 text-rose-500 hover:bg-rose-50 rounded cursor-pointer transition-colors"
                                  >
                                    <XCircle className="w-4 h-4" />
                                  </button>
                                </div>
                              )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Left Side Panel: Items Row Editor & VAT/Calculations & Credit Note */}
                <div className="lg:col-span-7 space-y-4">
                  {/* Items header */}
                  <div className="border border-slate-200 p-5 rounded-2xl bg-white space-y-4">
                    <div>
                      <label className="text-slate-600 block mb-1 font-bold">
                        القيمة الأساسية للفاتورة (قبل الخصم) *
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          required
                          min="0.01"
                          step="any"
                          value={editInvoiceBaseAmount || ""}
                          onChange={(e) =>
                            setEditInvoiceBaseAmount(
                              parseFloat(e.target.value) || 0,
                            )
                          }
                          placeholder="مثال: 15000"
                          className="w-full border border-slate-200 rounded-xl p-3 bg-slate-50 font-mono font-bold text-slate-900 text-sm focus:ring-1 focus:ring-emerald-500 focus:bg-white"
                        />
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 font-bold text-xs select-none">
                          ج.م
                        </span>
                      </div>
                    </div>

                    <div className="border-t border-slate-100 pt-3">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-slate-700 block font-bold text-xs">
                          الخصومات المطبقة على الفاتورة (تنقص من الإجمالي):
                        </label>
                        <button
                          type="button"
                          onClick={handleAddEditDiscountRow}
                          className="text-emerald-700 hover:text-emerald-600 font-bold text-xs flex items-center gap-1 cursor-pointer bg-emerald-500/10 hover:bg-emerald-100/70 py-1.5 px-2.5 rounded-lg border border-emerald-500/20 transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          إضافة خصم جديد
                        </button>
                      </div>

                      {editDiscounts.length === 0 ? (
                        <p className="text-[11px] text-slate-600 py-2 text-right">
                          لا توجد خصومات مضافة حالياً. سيتم حساب القيمة الأساسية
                          للفاتورة كاملة.
                        </p>
                      ) : (
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                          {editDiscounts.map((disc, index) => (
                            <div
                              key={index}
                              className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200"
                            >
                              <div className="flex-1">
                                <input
                                  type="text"
                                  required
                                  value={disc.name}
                                  onChange={(e) =>
                                    handleUpdateEditDiscountRow(
                                      index,
                                      "name",
                                      e.target.value,
                                    )
                                  }
                                  placeholder="نوع الخصم (مثال: خصم تعجيل دفع، خصم تجاري...)"
                                  className="w-full border border-slate-200 rounded-lg p-1.5 bg-white text-slate-800 focus:ring-1 focus:ring-emerald-500"
                                />
                              </div>
                              <div className="w-32 relative">
                                <input
                                  type="number"
                                  required
                                  min="0"
                                  step="any"
                                  value={disc.price || ""}
                                  onChange={(e) =>
                                    handleUpdateEditDiscountRow(
                                      index,
                                      "price",
                                      parseFloat(e.target.value) || 0,
                                    )
                                  }
                                  placeholder="المبلغ"
                                  className="w-full border border-slate-200 rounded-lg p-1.5 bg-white font-mono text-left text-slate-900 focus:ring-1 focus:ring-emerald-500 pl-8"
                                />
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600 text-[10px] font-bold">
                                  ج.م
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  handleRemoveEditDiscountRow(index)
                                }
                                className="p-1 px-1.5 text-slate-600 hover:text-red-500 hover:bg-red-50 rounded-lg cursor-pointer transition-colors"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* VAT and Totals Calculator */}
                  {(() => {
                    const totalDiscounts = editDiscounts.reduce(
                      (sum, d) => sum + d.price,
                      0,
                    );
                    const subtotal = Math.max(
                      0,
                      editInvoiceBaseAmount - totalDiscounts,
                    );
                    const vatAmount = editingInvoice.isCustomVat
                      ? Math.round(
                          (editingInvoice.customVatAmount !== undefined
                            ? editingInvoice.customVatAmount
                            : 0) * 100,
                        ) / 100
                      : Math.round(
                          subtotal *
                            ((editingInvoice.vatRate !== undefined
                              ? editingInvoice.vatRate
                              : 14) /
                              100) *
                            100,
                        ) / 100;
                    const vatRateDisplay = editingInvoice.isCustomVat
                      ? Math.round((vatAmount / (subtotal || 1)) * 100 * 100) /
                        100
                      : editingInvoice.vatRate !== undefined
                        ? editingInvoice.vatRate
                        : 14;
                    const totalAmount = subtotal + vatAmount;

                    return (
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                          <div className="flex flex-col gap-2.5 w-full md:w-auto">
                            {/* Toggle between Automatic Percentage and Custom Tax Amount */}
                            <div className="flex items-center gap-2">
                              <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-slate-700 select-none">
                                <input
                                  type="checkbox"
                                  checked={editingInvoice.isCustomVat || false}
                                  onChange={(e) =>
                                    setEditingInvoice({
                                      ...editingInvoice,
                                      isCustomVat: e.target.checked,
                                    })
                                  }
                                  className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 w-3.5 h-3.5 cursor-pointer"
                                />
                                <span>
                                  كتابة قيمة ضريبة مخصصة (يدوياً بالجنيه)
                                </span>
                              </label>
                            </div>

                            {!editingInvoice.isCustomVat ? (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs text-slate-600 font-bold font-sans">
                                  ضريبة القيمة المضافة (VAT):
                                </span>
                                <div className="flex items-center gap-1.5 bg-white border border-slate-250 rounded-lg px-2 py-0.5 shadow-xs">
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={
                                      editingInvoice.vatRate !== undefined
                                        ? editingInvoice.vatRate
                                        : 14
                                    }
                                    onChange={(e) =>
                                      setEditingInvoice({
                                        ...editingInvoice,
                                        vatRate: Math.max(
                                          0,
                                          parseFloat(e.target.value) || 0,
                                        ),
                                      })
                                    }
                                    className="w-10 text-center font-mono font-bold text-slate-800 text-xs focus:outline-none"
                                  />
                                  <span className="text-slate-500 text-xs font-bold font-sans">
                                    %
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEditingInvoice({
                                      ...editingInvoice,
                                      vatRate:
                                        (editingInvoice.vatRate !== undefined
                                          ? editingInvoice.vatRate
                                          : 14) === 14
                                          ? 0
                                          : 14,
                                    })
                                  }
                                  className="text-[9px] text-teal-600 hover:text-teal-700 font-extrabold bg-teal-50 hover:bg-teal-100/70 px-2.5 py-1 rounded-lg border border-teal-100 cursor-pointer transition-colors"
                                >
                                  {(editingInvoice.vatRate !== undefined
                                    ? editingInvoice.vatRate
                                    : 14) === 14
                                    ? "تصفير الضريبة (0%)"
                                    : "تطبيق الضريبة (14%)"}
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs text-slate-600 font-bold font-sans">
                                  قيمة الضريبة المخصصة:
                                </span>
                                <div className="flex items-center gap-1.5 bg-white border border-slate-250 rounded-lg px-2 py-1 shadow-xs">
                                  <input
                                    type="number"
                                    min="0"
                                    step="any"
                                    value={
                                      editingInvoice.customVatAmount !==
                                      undefined
                                        ? editingInvoice.customVatAmount
                                        : 0
                                    }
                                    onChange={(e) =>
                                      setEditingInvoice({
                                        ...editingInvoice,
                                        customVatAmount: Math.max(
                                          0,
                                          parseFloat(e.target.value) || 0,
                                        ),
                                      })
                                    }
                                    onBlur={(e) => {
                                      const rounded =
                                        Math.round(
                                          (parseFloat(e.target.value) || 0) *
                                            100,
                                        ) / 100;
                                      setEditingInvoice({
                                        ...editingInvoice,
                                        customVatAmount: rounded,
                                      });
                                    }}
                                    className="w-24 text-center font-mono font-bold text-slate-800 text-xs focus:outline-none"
                                    placeholder="ادخل القيمة..."
                                  />
                                  <span className="text-slate-500 text-[10px] font-bold">
                                    ج.م
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="space-y-1 w-full sm:w-auto text-left font-mono">
                            <div className="flex justify-between sm:justify-end gap-6 text-slate-500 text-[11px] text-right">
                              <span>قيمة الفاتورة الأساسية:</span>
                              <span className="font-bold">
                                {fAmt(editInvoiceBaseAmount)} ج.م
                              </span>
                            </div>
                            {totalDiscounts > 0 && (
                              <div className="flex justify-between sm:justify-end gap-6 text-rose-650 text-[11px] text-right">
                                <span>إجمالي الخصم المطبق (-):</span>
                                <span className="font-bold">
                                  {fAmt(totalDiscounts)} ج.م
                                </span>
                              </div>
                            )}
                            <div className="flex justify-between sm:justify-end gap-6 text-slate-500 text-[11px] text-right">
                              <span>الإجمالي قبل الضريبة:</span>
                              <span className="font-bold">
                                {fAmt(subtotal)} ج.م
                              </span>
                            </div>
                            <div className="flex justify-between sm:justify-end gap-6 text-slate-500 text-[11px] text-right">
                              <span>قيمة الضريبة ({vatRateDisplay}%):</span>
                              <span className="font-bold">
                                {fAmt(vatAmount)} ج.م
                              </span>
                            </div>
                            <div className="flex justify-between sm:justify-end gap-6 text-slate-800 font-black text-xs border-t border-slate-200 pt-1 mt-1 text-right">
                              <span>الصافي الإجمالي بعد الحفظ:</span>
                              <span className="text-emerald-700 font-black text-sm">
                                {fAmt(totalAmount)} ج.م
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Option to create a Credit Note associated with this Invoice */}
                  <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50 space-y-3">
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() =>
                          setShowEditInvoiceCNSection(!showEditInvoiceCNSection)
                        }
                        className="flex items-center gap-2 text-emerald-700 hover:text-emerald-600 font-extrabold text-xs cursor-pointer select-none"
                      >
                        <FileText className="w-4.5 h-4.5" />
                        <span>
                          {showEditInvoiceCNSection
                            ? "إغلاق نموذج الإشعار الدائن"
                            : "عمل إشعار دائن (خصم/مرتجع) على هذه الفاتورة"}
                        </span>
                      </button>
                      {!showEditInvoiceCNSection && (
                        <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
                          جديد ومطور
                        </span>
                      )}
                    </div>

                    {showEditInvoiceCNSection && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        className="space-y-4 pt-3 border-t border-slate-200 text-right"
                        dir="rtl"
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                          <div>
                            <label className="text-slate-500 block mb-1 font-bold">
                              رقم الإشعار الدائن *
                            </label>
                            <input
                              type="text"
                              required={showEditInvoiceCNSection}
                              value={editInvoiceCNData.creditNoteNumber}
                              onChange={(e) =>
                                setEditInvoiceCNData({
                                  ...editInvoiceCNData,
                                  creditNoteNumber: e.target.value,
                                })
                              }
                              className="w-full border border-slate-200 rounded-lg p-2.5 bg-white font-mono font-bold text-slate-800"
                              placeholder="CN-2026-X"
                            />
                          </div>
                          <div>
                            <label className="text-slate-500 block mb-1 font-bold">
                              البيان/الملاحظات العامة
                            </label>
                            <input
                              type="text"
                              value={editInvoiceCNData.notes}
                              onChange={(e) =>
                                setEditInvoiceCNData({
                                  ...editInvoiceCNData,
                                  notes: e.target.value,
                                })
                              }
                              className="w-full border border-slate-200 rounded-lg p-2.5 bg-white text-slate-805"
                              placeholder="مثال: خصم جودة أو كميات ممزقة"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-700">
                              قائمة البنود والكميات المخصومة:
                            </span>
                            <button
                              type="button"
                              onClick={handleAddEditInvoiceCNItemRow}
                              className="text-emerald-700 hover:text-emerald-600 font-semibold flex items-center gap-1 cursor-pointer"
                            >
                              <Plus className="w-4 h-4" />
                              <span>إضافة بند خصم</span>
                            </button>
                          </div>

                          <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                            {editInvoiceCNData.items.map((item, index) => (
                              <div
                                key={index}
                                className="flex items-center gap-2 bg-white p-2.5 rounded-lg border border-slate-200"
                              >
                                <input
                                  type="text"
                                  required={showEditInvoiceCNSection}
                                  value={item.name}
                                  onChange={(e) =>
                                    handleUpdateEditInvoiceCNItemRow(
                                      index,
                                      "name",
                                      e.target.value,
                                    )
                                  }
                                  className="flex-1 border border-slate-200 rounded p-1.5 text-slate-800 text-xs bg-slate-50"
                                  placeholder="الوصف (مثال: كرتونة عيوب صناعة...)"
                                />
                                <input
                                  type="number"
                                  required={showEditInvoiceCNSection}
                                  min="0"
                                  step="any"
                                  value={item.price === 0 ? "" : (item.price ?? "")}
                                  placeholder="المبلغ المخصوم للبند"
                                  onChange={(e) => {
                                    const valStr = e.target.value;
                                    const parsed = valStr === "" ? "" : parseFloat(valStr);
                                    handleUpdateEditInvoiceCNItemRow(
                                      index,
                                      "price",
                                      parsed === "" || isNaN(parsed) ? "" : parsed
                                    );
                                  }}
                                  className="w-40 border border-slate-200 rounded p-1.5 text-left font-mono text-slate-800 text-xs bg-slate-50 font-bold focus:ring-1 focus:ring-emerald-500"
                                />
                                <span className="text-slate-600 text-[10px] font-bold select-none">
                                  ج.م
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleRemoveEditInvoiceCNItemRow(index)
                                  }
                                  className="p-1.5 text-slate-600 hover:text-red-500 rounded cursor-pointer"
                                  title="حذف هذا البند"
                                >
                                  <XCircle className="w-4.5 h-4.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center justify-between bg-emerald-500/10 hover:bg-emerald-50 p-3 rounded-xl border border-emerald-500/20 select-none">
                          <div className="text-emerald-800 font-bold text-xs flex items-center gap-1">
                            <CheckCircle2 className="w-4.5 h-4.5" />
                            <span>إجمالي رصيد الخصم الصادر:</span>
                          </div>
                          <span className="text-emerald-600 font-black text-sm font-mono">
                            {fAmt(
                              editInvoiceCNData.items.reduce(
                                (sum, item) => sum + item.quantity * item.price,
                                0,
                              )
                            )}{" "}
                            ج.م
                          </span>
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                          <button
                            type="button"
                            onClick={handleSaveCNFromEditInvoice}
                            className="bg-emerald-600 hover:bg-emerald-500 text-slate-900 font-bold text-xs px-4 py-2 rounded-lg cursor-pointer flex items-center gap-1 shadow-sm"
                          >
                            <Check className="w-4 h-4" />
                            <span>تأكيد وتسجيل كإشعار دائن</span>
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </div>

                  {/* Submission Row */}
                  <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                    <button
                      type="button"
                      onClick={() => setEditingInvoice(null)}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-lg select-none cursor-pointer"
                    >
                      إلغاء وعودة
                    </button>
                    <button
                      type="submit"
                      className="bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-slate-900 font-bold px-5 py-2.5 rounded-lg cursor-pointer flex items-center gap-1.5"
                    >
                      <Save className="w-4 h-4" />
                      <span>حفظ التعديلات الحالية</span>
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* MODAL: EDIT SUPPLIER */}
      {editingSupplier && (
        <div className="fixed inset-0 bg-slate-950/45 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white backdrop-blur-md text-slate-800 rounded-3xl max-w-xl w-full p-4 sm:p-6 shadow-2xl border border-slate-200/80 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-200/60 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                تعديل بيانات المورد
              </h3>
              <button
                onClick={() => setEditingSupplier(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100/70 text-slate-500 hover:text-slate-900 transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateSupplier} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-600 block mb-1">
                    اسم المورد الكامل *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingSupplier.name}
                    onChange={(e) =>
                      setEditingSupplier({
                        ...editingSupplier,
                        name: e.target.value,
                      })
                    }
                    className="w-full border border-slate-200 rounded-lg p-2.5 bg-white text-slate-800 font-semibold placeholder:text-slate-400 font-sans focus:ring-1 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                    placeholder="م. محمد العربي"
                  />
                </div>
                <div>
                  <label className="text-slate-600 block mb-1">
                    اسم الشركة / المؤسسة *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingSupplier.company}
                    onChange={(e) =>
                      setEditingSupplier({
                        ...editingSupplier,
                        company: e.target.value,
                      })
                    }
                    className="w-full border border-slate-200 rounded-lg p-2.5 bg-white text-slate-800 font-semibold placeholder:text-slate-400 font-sans focus:ring-1 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                    placeholder="مجموعة السويدي كابلات"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-600 block mb-1">
                    رقم الهاتف التواصل *
                  </label>
                  <input
                    type="tel"
                    required
                    value={editingSupplier.phone}
                    onChange={(e) =>
                      setEditingSupplier({
                        ...editingSupplier,
                        phone: e.target.value,
                      })
                    }
                    className="w-full border border-slate-200 rounded-lg p-2.5 bg-white text-slate-800 font-semibold placeholder:text-slate-400 font-sans focus:ring-1 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                    placeholder="01012345678"
                  />
                </div>
                <div>
                  <label className="text-slate-600 block mb-1">
                    رقم الحساب البنكي / International IBAN *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingSupplier.bankAccount}
                    onChange={(e) =>
                      setEditingSupplier({
                        ...editingSupplier,
                        bankAccount: e.target.value,
                      })
                    }
                    className="w-full border border-slate-200 rounded-lg p-2.5 bg-white font-mono text-[11px] text-slate-800 font-semibold placeholder:text-slate-600 focus:ring-1 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                    placeholder="EG000000000000000000000000000"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-600 block mb-1">
                  ملاحظات وشروط إضافية
                </label>
                <textarea
                  value={editingSupplier.notes}
                  onChange={(e) =>
                    setEditingSupplier({
                      ...editingSupplier,
                      notes: e.target.value,
                    })
                  }
                  className="w-full border border-slate-200 rounded-lg p-2 bg-[#f8fafc]/85 h-20 text-slate-800 font-semibold placeholder:text-slate-400 font-sans focus:ring-1 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                  placeholder="أدخل أي ملاحظات حول الدفع أو السداد..."
                />
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-200/60 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingSupplier(null)}
                  className="bg-slate-100/60 hover:bg-slate-100 text-slate-700 border border-slate-200/60 font-bold px-4 py-2.5 rounded-lg select-none cursor-pointer transition-colors"
                >
                  إلغاء وعودة
                </button>
                <button
                  type="submit"
                  className="bg-[#10b981] hover:bg-emerald-500 active:bg-emerald-700 text-slate-900 font-bold px-5 py-2.5 rounded-lg cursor-pointer flex items-center gap-1.5 transition-all"
                >
                  <Save className="w-4 h-4" />
                  <span>حفظ التعديلات</span>
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* MODAL: ADD CREDIT NOTE */}
      {showAddCreditNoteModal && (
        <div className="fixed inset-0 bg-slate-950/45 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white backdrop-blur-md text-slate-800 rounded-3xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl border border-slate-200/80 space-y-4 max-h-[95vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-200/60 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                إضافة إشعار دائن جديد للمورد
              </h3>
              <button
                type="button"
                onClick={() => setShowAddCreditNoteModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100/70 text-slate-500 hover:text-slate-900 transition-colors animate-pulse"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddCreditNote} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-600 block mb-1">
                    اختر المورد المرتبط
                  </label>
                  <select
                    disabled
                    value={newCreditNote.supplierId}
                    className="w-full border border-slate-200 rounded-lg p-2.5 bg-[#f8fafc]/60 font-semibold text-slate-500 focus:outline-none cursor-not-allowed"
                  >
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.company})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-slate-600 block mb-1">
                    رقم الإشعار الدائن الصادر *
                  </label>
                  <input
                    type="text"
                    required
                    value={newCreditNote.creditNoteNumber}
                    onChange={(e) =>
                      setNewCreditNote({
                        ...newCreditNote,
                        creditNoteNumber: e.target.value,
                      })
                    }
                    className="w-full border border-slate-200 rounded-lg p-2.5 bg-slate-50 font-bold text-slate-800 focus:ring-1 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                    placeholder="CN-2026-XYZ"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-600 block mb-1">
                    تاريخ الاستحقاق المتوقع *
                  </label>
                  <input
                    type="date"
                    required
                    value={newCreditNote.dueDate}
                    onChange={(e) =>
                      setNewCreditNote({
                        ...newCreditNote,
                        dueDate: e.target.value,
                      })
                    }
                    className="w-full border border-slate-200 rounded-lg p-2.5 bg-white font-semibold text-slate-800 font-mono focus:ring-1 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all cursor-pointer"
                  />
                </div>
                <div>
                  <label className="text-slate-600 block mb-1">
                    البيانات / مذكرات عامة
                  </label>
                  <input
                    type="text"
                    value={newCreditNote.notes}
                    onChange={(e) =>
                      setNewCreditNote({
                        ...newCreditNote,
                        notes: e.target.value,
                      })
                    }
                    className="w-full border border-slate-200 rounded-lg p-2.5 bg-white text-slate-800 font-semibold focus:ring-1 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                    placeholder="خصم ترويجي للمواد الخام الربع السنوي"
                  />
                </div>
              </div>

              {/* Target Invoice Selection (Compulsory/Required) */}
              <div className="bg-emerald-950/20 p-4 rounded-2xl border border-emerald-900/30 space-y-2">
                <label className="text-emerald-600 block font-bold text-xs">
                  ربط وتحديد الفاتورة للخصم منها (إجباري) *
                </label>
                <select
                  required
                  value={newCreditNote.invoiceId}
                  onChange={(e) =>
                    setNewCreditNote({
                      ...newCreditNote,
                      invoiceId: e.target.value,
                    })
                  }
                  className="w-full border border-slate-200 rounded-lg p-2.5 bg-white font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer text-xs"
                >
                  <option className="bg-white" value="">
                    -- اختر الفاتورة غير المسددة للربط والخصم منها --
                  </option>
                  {invoices
                    .filter(
                      (i) =>
                        i.supplierId === newCreditNote.supplierId &&
                        i.status === "unpaid",
                    )
                    .map((i) => {
                      const remaining =
                        i.totalAmount - (i.creditNoteAmount || 0);
                      return (
                        <option className="bg-white" key={i.id} value={i.id}>
                          فاتورة رقم {i.invoiceNumber} (قيمة الفاتورة:{" "}
                          {fAmt(i.totalAmount)} ج.م | المتبقي للاستحقاق:{" "}
                          {fAmt(remaining)} ج.م)
                        </option>
                      );
                    })}
                </select>
                {/* Visual feedback of the selected invoice */}
                {(() => {
                  const selectedInvoice = invoices.find(
                    (inv) => inv.id === newCreditNote.invoiceId,
                  );
                  if (selectedInvoice) {
                    const remaining =
                      selectedInvoice.totalAmount -
                      (selectedInvoice.creditNoteAmount || 0);
                    return (
                      <div className="bg-[#f8fafc]/80 p-3 rounded-xl border border-slate-200 mt-2 space-y-1 font-sans">
                        <div className="flex justify-between text-slate-600 text-[11px]">
                          <span>قيمة الفاتورة المحددة الأصلية:</span>
                          <span className="font-bold text-slate-800 font-mono">
                            {fAmt(selectedInvoice.totalAmount)} ج.م
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-600 text-[11px]">
                          <span>الخصم المطبق مسبقاً بالإشعارات الدائنة:</span>
                          <span className="font-bold text-amber-500 font-mono">
                            {selectedInvoice.creditNoteAmount
                              ? `${fAmt(selectedInvoice.creditNoteAmount)} ج.م`
                              : "0.00 ج.م"}
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-800 text-[11px] font-bold border-t border-slate-200 pt-1 mt-1">
                          <span>
                            الحد الأقصى المسموح به لقيمة الإشعار الدائن:
                          </span>
                          <span className="text-emerald-600 font-black font-mono">
                            {fAmt(remaining)} ج.م
                          </span>
                        </div>
                      </div>
                    );
                  } else if (
                    invoices.filter(
                      (i) =>
                        i.supplierId === newCreditNote.supplierId &&
                        i.status === "unpaid",
                    ).length === 0
                  ) {
                    return (
                      <div className="bg-red-950/20 border border-red-900/30 text-rose-450 p-3 rounded-xl text-center font-bold text-[11px]">
                        ⚠️ لا توجد فواتير غير مسددة مسجلة لهذا المورد حالياً
                        للخصم منها. يرجى تسجيل فاتورة جديدة له أولاً.
                      </div>
                    );
                  }
                  return (
                    <div className="text-slate-600 text-[11px] italic">
                      يرجى تحديد الفاتورة لتأكيد المبلغ الإجمالي والخصم المطلوب.
                    </div>
                  );
                })()}
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-slate-700 block font-bold">
                    بنود الإشعار وقائمة التوريد الدائنة:
                  </label>
                  <button
                    type="button"
                    onClick={handleCNAddItemRow}
                    className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 font-bold px-3 py-1.5 rounded-lg border border-emerald-500/20 flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة بند جديد</span>
                  </button>
                </div>

                <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                  {/* Item Column Headers */}
                  <div className="flex items-center justify-between px-1 text-slate-600 font-bold mb-1 select-none text-[10px]">
                    <div>التسلسل</div>
                    <div className="w-48 text-left pl-6">
                      القيمة الإجمالية للبند (ج.م) *
                    </div>
                  </div>

                  {newCreditNote.items.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between gap-3 bg-slate-50/40 p-2 rounded-lg border border-slate-200/60"
                    >
                      <span className="text-slate-700 text-xs font-bold font-mono">
                        البند #{index + 1}
                      </span>
                      <div className="flex items-center gap-2 flex-1 max-w-xs">
                        <input
                          type="number"
                          required
                          min="0"
                          step="any"
                          placeholder="أدخل القيمة الإجمالية"
                          value={item.price || ""}
                          onChange={(e) => {
                            handleCNUpdateItemRow(
                              index,
                              "price",
                              parseFloat(e.target.value) || 0,
                            );
                            if (!item.name) {
                              handleCNUpdateItemRow(index, "name", "بند إشعار");
                            }
                          }}
                          className="w-full border border-slate-200 rounded p-1.5 bg-white text-slate-800 font-mono text-left text-xs focus:ring-1 focus:ring-emerald-500/30 outline-none"
                        />
                        <span className="text-slate-500 text-[10px] font-bold">
                          ج.م
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCNRemoveItemRow(index)}
                        className="p-1 text-slate-600 hover:text-red-400 rounded cursor-pointer hover:bg-red-500/10 transition-colors"
                        title="حذف هذا البند"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Attachment upload */}
              <div>
                <label className="text-slate-600 block mb-1 font-bold">
                  مرفق الإشعار الدائن (صورة أو ملف)
                </label>
                <div className="flex items-center gap-2">
                  <label className="flex-1 flex items-center justify-between border border-dashed border-slate-200 hover:border-emerald-500/50 rounded-lg p-2.5 bg-[#f8fafc]/80 cursor-pointer transition-colors">
                    <span className={`text-[11px] truncate max-w-[270px] ${cnAttachment ? "text-emerald-600 font-bold" : "text-slate-500"}`}>
                      {cnAttachment
                        ? cnAttachment.name
                        : "اختر ملفاً لإرفاقه بالخصم..."}
                    </span>
                    <span className="bg-emerald-500/10 text-emerald-600 px-2 py-1 rounded text-[10px] font-bold border border-emerald-500/20">
                      تصفح
                    </span>
                    <input
                      type="file"
                      accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                      onChange={(e) => handleFileUpload(e, "credit_note")}
                      className="hidden"
                    />
                  </label>
                  {cnAttachment && (
                    <button
                      type="button"
                      onClick={() => setCnAttachment(null)}
                      className="p-1.5 text-red-400 hover:bg-rose-500/10 rounded-lg cursor-pointer transition-colors"
                      title="حذف المرفق"
                    >
                      <XCircle className="w-4.5 h-4.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Total Display */}
              <div className="bg-emerald-950/20 border border-emerald-900/30 rounded-xl p-3 flex justify-between items-center select-none text-white">
                <span className="text-emerald-600 font-bold">
                  إجمالي قيمة الإشعار الدائن:
                </span>
                <span className="text-emerald-300 text-base font-black font-mono">
                  {fAmt(
                    newCreditNote.items.reduce(
                      (sum, item) => sum + item.quantity * item.price,
                      0,
                    ),
                  )}{" "}
                  ج.م
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-200/60 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddCreditNoteModal(false)}
                  className="bg-slate-100/60 hover:bg-slate-100 text-slate-700 border border-slate-200/60 font-bold px-4 py-2.5 rounded-lg select-none cursor-pointer transition-colors"
                >
                  إلغاء وعودة
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-slate-900 font-bold px-5 py-2.5 rounded-lg cursor-pointer transition-colors"
                >
                  تسجيل الإشعار الدائن
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* MODAL: EDIT CREDIT NOTE */}
      {showEditCreditNoteModal && editingCreditNote && (
        <div className="fixed inset-0 bg-slate-100/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl border border-slate-100 space-y-4 text-slate-800"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-950">
                تعديل الإشعار الدائن للمورد
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowEditCreditNoteModal(false);
                  setEditingCreditNote(null);
                }}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleUpdateCreditNote}
              className="space-y-4 text-xs"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-500 block mb-1">
                    المورد المرتبط
                  </label>
                  <select
                    disabled
                    value={editingCreditNote.supplierId}
                    className="w-full border border-slate-200 rounded-lg p-2.5 bg-slate-100 font-semibold text-slate-700 focus:outline-none cursor-not-allowed"
                  >
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.company})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-slate-500 block mb-1">
                    رقم الإشعار الدائن *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingCreditNote.creditNoteNumber}
                    onChange={(e) =>
                      setEditingCreditNote({
                        ...editingCreditNote,
                        creditNoteNumber: e.target.value,
                      })
                    }
                    className="w-full border border-slate-200 rounded-lg p-2.5 bg-slate-50 font-bold text-slate-900"
                    placeholder="CN-2026-XYZ"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-500 block mb-1">
                    تاريخ الاستحقاق المتوقع *
                  </label>
                  <input
                    type="date"
                    required
                    value={editingCreditNote.dueDate}
                    onChange={(e) =>
                      setEditingCreditNote({
                        ...editingCreditNote,
                        dueDate: e.target.value,
                      })
                    }
                    className="w-full border border-slate-200 rounded-lg p-2.5 bg-slate-50 font-semibold text-slate-900 font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-500 block mb-1">
                    البيانات / مذكرات عامة
                  </label>
                  <input
                    type="text"
                    value={editingCreditNote.notes || ""}
                    onChange={(e) =>
                      setEditingCreditNote({
                        ...editingCreditNote,
                        notes: e.target.value,
                      })
                    }
                    className="w-full border border-slate-200 rounded-lg p-2.5 bg-slate-50 text-slate-950 font-semibold"
                    placeholder="خصم ترويجي للمواد الخام الربع السنوي"
                  />
                </div>
              </div>

              {/* Linked Invoice Info block */}
              {(() => {
                const linkedInvoice = invoices.find((inv) =>
                  (inv.creditNotes || []).some(
                    (cn) => cn.id === editingCreditNote.id,
                  ),
                );
                if (linkedInvoice) {
                  const originalCN = (linkedInvoice.creditNotes || []).find(
                    (cn) => cn.id === editingCreditNote.id,
                  );
                  const originalAmount = originalCN ? originalCN.amount : 0;
                  const otherCNAmount =
                    (linkedInvoice.creditNoteAmount || 0) - originalAmount;
                  const remaining =
                    Math.round(
                      (linkedInvoice.totalAmount - otherCNAmount) * 100,
                    ) / 100;
                  return (
                    <div className="bg-emerald-500/10/50 p-4 rounded-2xl border border-emerald-500/20 space-y-2">
                      <span className="text-slate-700 block font-bold text-xs">
                        الفاتورة المربوط بها الخصم:
                      </span>
                      <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1 font-sans">
                        <div className="flex justify-between text-slate-500 text-[11px]">
                          <span>الفاتورة المرتبطة:</span>
                          <span className="font-bold text-slate-700">
                            {linkedInvoice.invoiceNumber}
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-500 text-[11px]">
                          <span>
                            الحد الأقصى المسموح به لقيمة الإشعار الدائن:
                          </span>
                          <span className="text-emerald-600 font-black">
                            {fAmt(remaining)} ج.م
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-slate-500 block font-bold font-sans">
                    بنود الإشعار وقائمة التوريد الدائنة:
                  </label>
                  <button
                    type="button"
                    onClick={handleEditCNAddItemRow}
                    className="bg-emerald-500/10 hover:bg-emerald-100 text-emerald-600 font-bold px-3 py-1.5 rounded-lg border border-emerald-200 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة بند جديد</span>
                  </button>
                </div>

                <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                  <div className="flex items-center justify-between px-1 text-slate-500 font-bold mb-1 select-none text-[10px]">
                    <div>التسلسل</div>
                    <div className="w-48 text-left pl-6">
                      القيمة الإجمالية للبند (ج.م) *
                    </div>
                  </div>

                  {editingCreditNote.items.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between gap-3 bg-slate-50 p-2 rounded-lg border border-slate-150"
                    >
                      <span className="text-slate-600 text-xs font-bold font-mono">
                        البند #{index + 1}
                      </span>
                      <div className="flex items-center gap-2 flex-1 max-w-xs">
                        <input
                          type="number"
                          required
                          min="0"
                          step="any"
                          placeholder="أدخل القيمة الإجمالية"
                          value={item.price || ""}
                          onChange={(e) => {
                            handleEditCNUpdateItemRow(
                              index,
                              "price",
                              parseFloat(e.target.value) || 0,
                            );
                            if (!item.name) {
                              handleEditCNUpdateItemRow(
                                index,
                                "name",
                                "بند إشعار",
                              );
                            }
                          }}
                          className="w-full border border-slate-200 rounded p-1 bg-white text-slate-900 font-mono text-left text-xs focus:ring-1 focus:ring-emerald-500"
                        />
                        <span className="text-slate-600 text-[10px] font-bold">
                          ج.م
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleEditCNRemoveItemRow(index)}
                        className="p-1 text-slate-600 hover:text-red-500 rounded cursor-pointer"
                        title="حذف هذا البند"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total Display */}
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex justify-between items-center select-none text-slate-800">
                <span className="text-emerald-800 font-bold">
                  إجمالي قيمة الإشعار الدائن بعد التعديل:
                </span>
                <span className="text-emerald-600 text-base font-black font-mono">
                  {fAmt(
                    editingCreditNote.items.reduce(
                      (sum, item) => sum + item.quantity * item.price,
                      0,
                    ),
                  )}{" "}
                  ج.م
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditCreditNoteModal(false);
                    setEditingCreditNote(null);
                  }}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-lg select-none cursor-pointer"
                >
                  إلغاء وعودة
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-slate-900 font-bold px-5 py-2.5 rounded-lg cursor-pointer"
                >
                  حفظ التعديلات
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* MODAL: PREVIEW ATTACHMENT */}
      {previewAttachment && (
        <div className="fixed inset-0 bg-slate-100/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 font-sans dir-rtl">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl max-w-5xl w-full p-4 sm:p-6 shadow-2xl border border-slate-100 flex flex-col space-y-4 text-slate-800 max-h-[92vh] overflow-y-auto custom-scrollbar"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-950 flex items-center gap-2">
                <Paperclip className="w-5 h-5 text-emerald-600" />
                <span>مستندات ومرفقات المعاملة</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setPreviewAttachment(null);
                  setPreviewAttachmentList([]);
                }}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Layout layout grid: List of all files on the right, active preview on the left */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 overflow-hidden">
              {/* Right list pane (RTL right): Lists all files with option to download next to each */}
              <div className="md:col-span-4 flex flex-col space-y-3 bg-slate-50/50 p-3 rounded-2xl border border-slate-200 max-h-[220px] md:max-h-[400px]">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="text-xs font-black text-slate-600">
                    الملفات المتاحة (
                    {(previewAttachmentList || []).length > 0
                      ? previewAttachmentList.length
                      : 1}
                    )
                  </span>
                </div>

                <div className="space-y-2 overflow-y-auto flex-1 pr-0.5 custom-scrollbar">
                  {(previewAttachmentList && previewAttachmentList.length > 0
                    ? previewAttachmentList
                    : [previewAttachment]
                  ).map((att, idx) => {
                    const isActive =
                      previewAttachment &&
                      previewAttachment.name === att.name &&
                      previewAttachment.dataUrl === att.dataUrl;
                    const isImage = att.type
                      ? att.type.startsWith("image/")
                      : false;
                    return (
                      <div
                        key={idx}
                        className={`flex items-center justify-between p-2.5 rounded-xl border text-right transition-all duration-200 ${
                          isActive
                            ? "bg-emerald-50 border-emerald-200 text-emerald-950 shadow-xs"
                            : "bg-white hover:bg-slate-50 border-slate-200 text-slate-700"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setPreviewAttachment(att)}
                          className="flex items-center gap-2 flex-1 min-w-0 text-right font-sans cursor-pointer"
                        >
                          <div
                            className={`p-1.5 rounded-lg shrink-0 ${isActive ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-600"}`}
                          >
                            {isImage ? (
                              <Image className="w-4 h-4" />
                            ) : (
                              <FileText className="w-4 h-4" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p
                              className="text-[11px] font-bold truncate text-slate-800"
                              title={att.name}
                            >
                              {att.name}
                            </p>
                            <p className="text-[9px] text-slate-600">
                              {isImage ? "صورة" : "مستند"}
                            </p>
                          </div>
                        </button>

                        <a
                          href={att.dataUrl}
                          download={att.name}
                          title={`تحميل الملف: ${att.name}`}
                          className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-600 hover:text-emerald-700 transition-all shadow-xs shrink-0 cursor-pointer mr-2 border border-emerald-100"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Left view pane (RTL left): displays active picture / file details */}
              <div className="md:col-span-8 flex flex-col space-y-3 min-h-[240px] md:min-h-[350px]">
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col items-center justify-center flex-1 min-h-[200px] md:min-h-[300px] overflow-hidden">
                  {previewAttachment.type &&
                  previewAttachment.type.startsWith("image/") ? (
                    <div className="w-full flex justify-center items-center overflow-auto max-h-[360px]">
                      <img
                        src={previewAttachment.dataUrl}
                        alt={previewAttachment.name}
                        referrerPolicy="no-referrer"
                        className="max-h-[340px] max-w-full rounded-lg object-contain shadow-sm border border-slate-200"
                      />
                    </div>
                  ) : (
                    <div className="text-center space-y-3 py-8">
                      <div className="mx-auto w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center border border-emerald-100 shadow-xs">
                        <FileText className="w-8 h-8" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800 text-sm">
                          {previewAttachment.name}
                        </h4>
                        <p className="text-xs text-slate-500 mt-1">
                          امتداد المرفق:{" "}
                          {previewAttachment.type || "مستند خارجي"}
                        </p>
                      </div>
                      <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                        هذا الملف هو مستند أو تقرير رسمي لا يمكن للمتصفح عرضه
                        مباشرة كصورة. يمكنك تحميله لفتحه على جهازك.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 pt-3">
              <span className="text-[10px] text-slate-500">
                يمكنك التنقل بين الملفات المرفقة من خلال لوحة الاختيارات
                الجانبية والتحميل مباشرة لملف أو لكل المرفقات.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPreviewAttachment(null);
                    setPreviewAttachmentList([]);
                  }}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-lg select-none cursor-pointer text-xs transition"
                >
                  إغلاق
                </button>
                <a
                  href={previewAttachment.dataUrl}
                  download={previewAttachment.name}
                  className="bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-slate-900 font-bold px-5 py-2 rounded-lg cursor-pointer flex items-center gap-1.5 text-xs text-center transition"
                >
                  <Download className="w-4 h-4" />
                  <span>تحميل الملف النشط</span>
                </a>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* MODAL: RESET DATABASE CONFIRMATION */}
      {showResetConfirmModal && (
        <div className="fixed inset-0 bg-slate-100/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 font-sans dir-rtl">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white text-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-right text-slate-800 space-y-6"
          >
            <div className="flex items-center gap-3 border-b border-slate-200 pb-3">
              <div className="w-10 h-10 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500">
                <AlertTriangle className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">تأكيد إعادة ضبط النظام بالكامل</h3>
                <p className="text-xs text-rose-600 font-semibold">إجراء تصفير مالي حساس ومباشر</p>
              </div>
            </div>

            <p className="text-xs leading-relaxed text-slate-700">
              أنت على وشك القيام بـ <strong className="text-rose-600">مسح وتصفير كافة الحسابات بالكامل من قاعدة بياناتك ومزامنتها من أول وجديد كأول مرة</strong>.
              <br /><br />
              هذا الإجراء سيقوم بـ:
              <span className="block mt-2 space-y-1.5 pr-2 text-slate-600 text-[11px]">
                <span className="block">• تدمير الجداول النشطة وإعادة بنائها من الصفر.</span>
                <span className="block">• حذف كافة الفواتير، الموردين، المدفوعات، المعاملات، والمرفقات نهائياً.</span>
                <span className="block">• استرجاع إعدادات المصنع الافتراضية مع الكتالوجات الرسمية.</span>
              </span>
            </p>

            <div className="flex items-center gap-2 pt-3 border-t border-slate-200/80">
              <button
                type="button"
                disabled={isResettingDb}
                onClick={() => setShowResetConfirmModal(false)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-xl cursor-pointer text-xs text-center transition"
              >
                تراجع وإلغاء
              </button>
              <button
                type="button"
                disabled={isResettingDb}
                onClick={handleResetDbFromScratch}
                className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-bold px-4 py-2.5 rounded-xl cursor-pointer text-xs text-center transition flex items-center justify-center gap-1.5 shadow-lg shadow-rose-900/10"
              >
                {isResettingDb ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>جاري التصفير...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>تأكيد التصفير والتهيئة</span>
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}

    </div>
  );
}
