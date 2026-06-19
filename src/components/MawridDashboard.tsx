/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { 
  Users, Receipt, CreditCard, Bell, FileText, Database, MessageSquare, 
  ShieldAlert, Plus, Trash2, Download, CheckCircle2, XCircle, AlertTriangle, 
  RefreshCw, TrendingUp, Building, Check, Key, Upload, Activity, 
  UserCheck, Send, Printer, Shield, ChevronLeft, HelpCircle, Save
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, LineChart, Line
} from "recharts";

import { Supplier, Invoice, Payment, BackupRecord, UserRole, BankConfig, SupportMessage } from "../types";
import { INITIAL_SUPPLIERS, INITIAL_INVOICES, INITIAL_PAYMENTS, INITIAL_BACKUPS, LOCAL_BANKS_SELECTION } from "../data";

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

  // Search and Filter States
  const [supplierSearch, setSupplierSearch] = useState("");
  const [supplierCategoryFilter, setSupplierCategoryFilter] = useState("all");
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState("all");

  // Selected Report Parameters
  const [reportMonth, setReportMonth] = useState("05");
  const [reportYear, setReportYear] = useState("2026");
  const [aiReportSummary, setAiReportSummary] = useState<string>("");
  const [isGeneratingAiSummary, setIsGeneratingAiSummary] = useState(false);

  // Bank integrations state
  const [linkedBanks, setLinkedBanks] = useState<BankConfig[]>(() => {
    const saved = localStorage.getItem("mawrid_linked_banks");
    if (saved) return JSON.parse(saved);
    return LOCAL_BANKS_SELECTION.map(b => ({
      bankName: b.name,
      accountNumber: "EGXX-XXXX-XXXX-" + Math.floor(1000 + Math.random() * 9000),
      apiKey: "••••••••••••••••••••",
      isLinked: b.id === "bme" // Pre-link National / Banque Misr
    }));
  });

  // Local settlement simulator terminal state
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<Invoice | null>(null);
  const [paymentGatewayBank, setPaymentGatewayBank] = useState(LOCAL_BANKS_SELECTION[0].name);
  const [settlementLogs, setSettlementLogs] = useState<string[]>([]);
  const [isSettlingProcess, setIsSettlingProcess] = useState(false);
  const [settlementProgress, setSettlementProgress] = useState(0);

  // Add Modals states
  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);
  const [showAddInvoiceModal, setShowAddInvoiceModal] = useState(false);

  // New Supplier form state
  const [newSupplier, setNewSupplier] = useState<Omit<Supplier, "id" | "createdAt">>({
    name: "", company: "", phone: "", email: "", bankAccount: "", category: "مواد خام", address: "", notes: ""
  });

  // New Invoice form state
  const [newInvoice, setNewInvoice] = useState({
    supplierId: "", invoiceNumber: "", dueDate: "", notes: "",
    items: [{ name: "", quantity: 1, price: 0 }]
  });

  // AI Support chatbot state
  const [supportMessages, setSupportMessages] = useState<SupportMessage[]>(() => {
    const saved = localStorage.getItem("mawrid_chat_history");
    if (saved) return JSON.parse(saved);
    return [
      {
        id: "msg-init",
        role: "model",
        text: "أهلاً بك في نظام 'مورد' الذكي لإدارة الحسابات والتعاملات البنكية. أنا مساعد الدعم الفني الآلي ومستشارك المالي، كيف يمكنني مساعدتك اليوم بخصوص حسابات الموردين أو فواتيرك؟",
        timestamp: new Date().toISOString()
      }
    ];
  });
  const [chatInput, setChatInput] = useState("");
  const [isAiTyping, setIsAiTyping] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Toast notifications for user feedback
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  // Check roles permissions
  const checkPermission = (action: "create" | "delete" | "write" | "backup"): boolean => {
    if (currentRole === UserRole.ADMIN) return true;
    if (currentRole === UserRole.ACCOUNTANT) {
      if (action === "delete") {
        showToast("عذراً، لا تمتلك صلاحية حذف السجلات بصفتك محاسباً. يتطلب ذلك رتبة مدير النظام.", "error");
        return false;
      }
      if (action === "backup") {
        showToast("عذراً، صلاحيات النسخ الاحتياطي وحفظ النظام مقيدة بمدير النظام فقط.", "error");
        return false;
      }
      return true; // Can write and create
    }
    if (currentRole === UserRole.VIEWER) {
      showToast("عذراً، حساب مراقب مالي يمتلك صلاحية القراءة فقط. ميزة تعديل أو حذف البيانات مقفلة.", "error");
      return false;
    }
    return false;
  };

  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

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
    localStorage.setItem("mawrid_chat_history", JSON.stringify(supportMessages));
  }, [supportMessages]);

  useEffect(() => {
    localStorage.setItem("mawrid_linked_banks", JSON.stringify(linkedBanks));
  }, [linkedBanks]);

  // Generate Payment Alerts based on system time and invoice due dates
  useEffect(() => {
    const today = new Date("2026-06-07"); // System baseline date requested in metadata context
    const currentAlerts: string[] = [];

    invoices.forEach(inv => {
      if (inv.status === "unpaid") {
        const dueDate = new Date(inv.dueDate);
        const timeDiff = dueDate.getTime() - today.getTime();
        const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
        const supplier = suppliers.find(s => s.id === inv.supplierId);
        const supplierName = supplier ? supplier.name : "غير معروف";

        if (daysDiff < 0) {
          currentAlerts.push(`تنبیه عاجل: الفاتورة رقم ${inv.invoiceNumber} للمورد ${supplierName} متأخرة عن موعد سدادها منذ ${Math.abs(daysDiff)} يوم!`);
        } else if (daysDiff <= 5) {
          currentAlerts.push(`استحقاق قادم: الفاتورة رقم ${inv.invoiceNumber} للمورد ${supplierName} تستحق السداد خلال ${daysDiff} أيام.`);
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
    const totalInvoicesAmount = invoices.reduce((acc, curr) => acc + curr.totalAmount, 0);
    const paidAmount = payments.reduce((acc, curr) => acc + curr.amount, 0);
    const pendingAmount = invoices.filter(i => i.status === "unpaid").reduce((acc, curr) => acc + curr.totalAmount, 0);
    const paidInvoicesCount = invoices.filter(i => i.status === "paid").length;
    const unpaidInvoicesCount = invoices.filter(i => i.status === "unpaid").length;
    
    return {
      suppliersCount: suppliers.length,
      invoicesCount: invoices.length,
      unpaidInvoicesCount,
      totalInvoicesAmount,
      paidAmount,
      pendingAmount,
      paymentRatio: totalInvoicesAmount > 0 ? Math.round((paidAmount / totalInvoicesAmount) * 100) : 0
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
      createdAt: new Date().toISOString()
    };

    setSuppliers([...suppliers, createdSupplier]);
    setShowAddSupplierModal(false);
    setNewSupplier({
      name: "", company: "", phone: "", email: "", bankAccount: "", category: "مواد خام", address: "", notes: ""
    });
    showToast(`تمت إضافة المورد ${createdSupplier.name} بنجاح.`);
  };

  // Delete Supplier handler
  const handleDeleteSupplier = (id: string, name: string) => {
    if (!checkPermission("delete")) return;

    // Verify if there are unpaid invoices before deleting
    const hasUnpaid = invoices.some(i => i.supplierId === id && i.status === "unpaid");
    if (hasUnpaid) {
      showToast("لا يمكن حذف المورد نظراً لوجود فواتير مستحقة وغير مسددة مسجلة عليه.", "error");
      return;
    }

    setSuppliers(suppliers.filter(s => s.id !== id));
    // Filter invoices associated
    setInvoices(invoices.filter(i => i.supplierId !== id));
    showToast(`تم حذف المورد ${name} وكافة بياناته بنجاح.`);
  };

  // Add Invoice Form Item handlers
  const handleAddItemRow = () => {
    setNewInvoice({
      ...newInvoice,
      items: [...newInvoice.items, { name: "", quantity: 1, price: 0 }]
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

  // Handle create Invoice
  const handleAddInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkPermission("create")) return;

    if (!newInvoice.supplierId || !newInvoice.invoiceNumber) {
      showToast("يرجى اختيار المورد وتحديد رقم الفاتورة.", "error");
      return;
    }

    // Verify duplicate invoice numbers
    const isDuplicate = invoices.some(i => i.invoiceNumber === newInvoice.invoiceNumber);
    if (isDuplicate) {
      showToast(`الفاتورة رقم ${newInvoice.invoiceNumber} مسجلة مسبقاً بالنظام.`, "error");
      return;
    }

    const calculatedTotal = newInvoice.items.reduce((sum, item) => sum + (item.quantity * item.price), 0);

    const createdInvoice: Invoice = {
      id: "inv-" + Date.now(),
      invoiceNumber: newInvoice.invoiceNumber,
      supplierId: newInvoice.supplierId,
      issueDate: new Date().toISOString().split("T")[0],
      dueDate: newInvoice.dueDate || new Date(Date.now() + 15 * 24 * 3600 * 1000).toISOString().split("T")[0],
      items: newInvoice.items,
      totalAmount: calculatedTotal,
      status: "unpaid",
      notes: newInvoice.notes
    };

    setInvoices([createdInvoice, ...invoices]);
    setShowAddInvoiceModal(false);
    setNewInvoice({
      supplierId: "", invoiceNumber: "", dueDate: "", notes: "",
      items: [{ name: "", quantity: 1, price: 0 }]
    });
    showToast(`تم تسجيل فاتورة جديدة ${createdInvoice.invoiceNumber} بقيمة ${calculatedTotal.toLocaleString()} ج.م.`);
  };

  // Instant local bank settlement triggers (Real-time Simulation)
  const executeSettlementSimulate = (invoice: Invoice) => {
    if (!checkPermission("write")) return;
    
    const supplier = suppliers.find(s => s.id === invoice.supplierId);
    if (!supplier) {
      showToast("فشل السحب، لم يتم تحديد المورد للفاتورة.", "error");
      return;
    }

    // Direct check if banking is configured
    const userBank = linkedBanks.find(b => b.isLinked);
    if (!userBank) {
      showToast("فشل التسوية، يرجى ربط بنك محلي واحد على الأقل في الإعدادات لتفعيل التحويل الفوري.", "error");
      setActiveTab("banking");
      return;
    }

    setSelectedInvoiceForPayment(invoice);
    setSettlementLogs([]);
    setIsSettlingProcess(true);
    setSettlementProgress(0);

    // Dynamic fake RTGS terminal logger
    const steps = [
      { text: `📡 جاري تهيئة الاتصال فوري عبر قنوات التسوية الفورية مع البنك المحلي المرتبط (${userBank.bankName})...`, progress: 10, wait: 400 },
      { text: `🔑 جاري تأكيد الرموز الأمنية المشفرة وتصريح الـ API لـ "مورد"...`, progress: 25, wait: 800 },
      { text: `🏦 التحقق من رصيد الحساب المصدق رقم: ${userBank.accountNumber}...`, progress: 40, wait: 1200 },
      { text: `💸 إرسال طلب تحويل فوري للمبلغ (${invoice.totalAmount.toLocaleString()} ج.م) لحساب المورد المستلم بنجاح...`, progress: 60, wait: 1900 },
      { text: `📥 جاري إرسال المستحقات لحساب المورد: ${supplier.company} (حساب IBAN: ${supplier.bankAccount})...`, progress: 80, wait: 2400 },
      { text: `✅ استلام رد تأكيدي من البنك المركزي المصري (CBE RTGS). رمز المعاملة: TXN-BM-${Math.floor(100000 + Math.random() * 900000)}`, progress: 100, wait: 3000 }
    ];

    steps.forEach((step, i) => {
      setTimeout(() => {
        setSettlementLogs(prev => [...prev, step.text]);
        setSettlementProgress(step.progress);

        if (step.progress === 100) {
          setTimeout(() => {
            // Update Invoice Status
            setInvoices(prev => prev.map(inv => {
              if (inv.id === invoice.id) {
                return { ...inv, status: "paid" };
              }
              return inv;
            }));

            // Record custom payment
            const newPayment: Payment = {
              id: "pay-" + Date.now(),
              supplierId: invoice.supplierId,
              invoiceId: invoice.id,
              amount: invoice.totalAmount,
              paymentDate: new Date().toISOString().split("T")[0],
              method: userBank.bankName.includes("فوري") ? "fawry" : "bank_transfer",
              transRef: `RTGS-EG-${Math.floor(102931238 + Math.random() * 928374823)}`
            };

            setPayments(prev => [newPayment, ...prev]);
            setIsSettlingProcess(false);
            setSelectedInvoiceForPayment(null);
            showToast(`تم سداد الفاتورة ${invoice.invoiceNumber} بالكامل وتسويتها لحظياً عبر البنك!`);
          }, 600);
        }
      }, step.wait);
    });
  };

  // Toggle bank linkage status
  const handleToggleBankLinkage = (bankName: string) => {
    if (!checkPermission("write")) return;

    setLinkedBanks(prev => prev.map(bank => {
      if (bank.bankName === bankName) {
        const nextState = !bank.isLinked;
        showToast(nextState ? `تم ربط وتفعيل حسابك بنجاح في ${bankName}.` : `تم قطع الاتصال البنكي مع ${bankName}.`, nextState ? "success" : "info");
        return { ...bank, isLinked: nextState };
      }
      return bank;
    }));
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
        payments: payments.length
      },
      dataDump: dumpDataStr
    };

    setBackups([newBackup, ...backups]);
    showToast(`تم إنشاء نسخة احتياطية جديدة وموثقة بنجاح لحماية البيانات الاستثمارية (${backupSize} KB).`);
  };

  // Restore backup
  const restoreBackupRecord = (backup: BackupRecord) => {
    if (!checkPermission("backup")) return;
    if (!backup.dataDump) {
      // Simulate fallback from initial dumps
      showToast("تنبيه: النسخ الاحتياطية القديمة المسجلة مسبقاً لا تحتوي على مستودع في الذاكرة الحالية. تم استعادة قالب الضبط الابتدائي بنجاح.", "info");
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
      showToast(`تم استعادة حالة قاعدة البيانات بنجاح طبقاً لتوقيت النسخة الاحتياطية: ${new Date(backup.timestamp).toLocaleString("ar")}`);
    } catch (e) {
      showToast("خطأ في قراءة ملف التصدير.", "error");
    }
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
      unpaidInvoicesCount: invoices.filter(i => i.status === "unpaid").length,
      totalInvoicesAmount: dashboardStats.totalInvoicesAmount,
      paidAmount: dashboardStats.paidAmount,
      pendingAmount: dashboardStats.pendingAmount,
      paymentRatio: dashboardStats.paymentRatio
    };

    setIsGeneratingAiSummary(true);
    setAiReportSummary("");

    try {
      const resp = await fetch("/api/reports/ai-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          stats: apiStats, 
          suppliersList: suppliers.map(s => ({ name: s.name, company: s.company, category: s.category }))
        })
      });
      const data = await resp.json();
      setAiReportSummary(data.summary || "لا تتوفر تفاصيل كافية.");
    } catch (e: any) {
      console.error(e);
      setAiReportSummary("عذراً، حدث خطأ في النظام الخارجي لمساعد الذكاء الاصطناعي أثناء توليد التلخيص المالي.");
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
      timestamp: new Date().toISOString()
    };

    setSupportMessages(prev => [...prev, userMsg]);
    setChatInput("");
    setIsAiTyping(true);

    const apiStats = {
      suppliersCount: suppliers.length,
      invoicesCount: invoices.length,
      unpaidInvoicesCount: invoices.filter(i => i.status === "unpaid").length,
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
          history: supportMessages.map(m => ({ role: m.role, text: m.text })),
          stats: apiStats
        })
      });
      const data = await response.json();
      
      const machineMsg: SupportMessage = {
        id: "msg-response-" + Date.now(),
        role: "model",
        text: data.text,
        timestamp: new Date().toISOString()
      };
      
      setSupportMessages(prev => [...prev, machineMsg]);
    } catch (err) {
      console.error("Chat error:", err);
      const offlineMsg: SupportMessage = {
        id: "msg-err-" + Date.now(),
        role: "model",
        text: "عذراً، فشلت عملية الاتصال بخادم خدمات الذكاء الاصطناعي. يرجى التحقق من تفعيل خادم التطبيق ومفاتيح الإعدادات.",
        timestamp: new Date().toISOString()
      };
      setSupportMessages(prev => [...prev, offlineMsg]);
    } finally {
      setIsAiTyping(false);
    }
  };

  // Printable layout window trigger (foolproof clean RTL Arabic PDF/Print setup)
  const handlePrintReport = () => {
    window.print();
  };

  // Filtered lists
  const filteredSuppliers = suppliers.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(supplierSearch.toLowerCase()) || 
                          s.company.toLowerCase().includes(supplierSearch.toLowerCase()) ||
                          s.phone.includes(supplierSearch);
    const matchesCategory = supplierCategoryFilter === "all" || s.category === supplierCategoryFilter;
    return matchesSearch && matchesCategory;
  });

  const filteredInvoices = invoices.filter(i => {
    const supplier = suppliers.find(s => s.id === i.supplierId);
    const matchesSearch = i.invoiceNumber.toLowerCase().includes(invoiceSearch.toLowerCase()) ||
                          (supplier && supplier.name.toLowerCase().includes(invoiceSearch.toLowerCase())) ||
                          (supplier && supplier.company.toLowerCase().includes(invoiceSearch.toLowerCase()));
    const matchesStatus = invoiceStatusFilter === "all" || i.status === invoiceStatusFilter;
    return matchesSearch && matchesStatus;
  });

  // Analytics distribution data for Recharts
  const getPortfolioDistributionData = () => {
    // Group invoices total value by category or by supplier group
    const dict: { [key: string]: number } = {};
    invoices.forEach(inv => {
      const supplier = suppliers.find(s => s.id === inv.supplierId);
      const cat = supplier ? supplier.category : "أخرى";
      dict[cat] = (dict[cat] || 0) + inv.totalAmount;
    });

    return Object.keys(dict).map((name, i) => ({
      name,
      value: dict[name],
      fill: ["#0284c7", "#f59e0b", "#10b981", "#8b5cf6", "#ec4899"][i % 5]
    }));
  };

  const getMonthlyFinancialsData = () => {
    // Generate simple mock tracking for early months (April, May, June 2026) to make beautiful charts
    return [
      { name: "أبريل 2026", "إجمالي المشتريات": 290000, "إجمالي المسدد": 290000 },
      { name: "مايو 2026", "إجمالي المشتريات": 400000, "إجمالي المسدد": 110000 },
      { name: "يونيو 2026", "إجمالي المشتريات": 272000, "إجمالي المسدد": 0 }
    ];
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans selection:bg-sky-500 selection:text-white pb-10">
      
      {/* Toast Alert */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={`fixed top-4 left-4 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-2xl border ${
              toast.type === "success" ? "bg-emerald-50 text-emerald-800 border-emerald-200" :
              toast.type === "error" ? "bg-rose-50 text-rose-800 border-rose-200" :
              "bg-amber-50 text-amber-800 border-amber-200"
            }`}
          >
            {toast.type === "success" && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />}
            {toast.type === "error" && <XCircle className="w-5 h-5 text-rose-600 shrink-0" />}
            {toast.type === "info" && <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />}
            <span className="text-sm font-semibold">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Corporate Arabic Header */}
      <header className="no-print bg-white border-b border-slate-200 sticky top-0 z-40 px-6 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-sky-600 to-sky-400 flex items-center justify-center text-white shadow-md shadow-sky-100">
              <Building className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-950 flex items-center gap-2">
                نظام مُوَرِّد الذكي
                <span className="text-xs bg-sky-100 text-sky-800 font-medium px-2 py-0.5 rounded-full">للإصدار المالي</span>
              </h1>
              <p className="text-xs text-slate-500">منظومة الحسابات والمشتريات وتتبع سداد الموردين التفاعلية</p>
            </div>
          </div>

          <div className="flex items-center gap-4 self-end md:self-auto">
            {/* System notifications feed triggers */}
            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors relative"
              >
                <Bell className="w-5 h-5 text-slate-600" />
                {alerts.length > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full ring-2 ring-white">
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
                    className="absolute left-0 mt-3 w-80 md:w-96 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-4"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
                      <span className="font-bold text-slate-900 text-sm">تنبيهات المدفوعات المستحقة</span>
                      <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{alerts.length} تنبيهات</span>
                    </div>
                    <div className="space-y-2 max-h-72 overflow-y-auto">
                      {alerts.length === 0 ? (
                        <p className="text-xs text-center text-slate-400 py-6">لا توجد فواتير معلقة متأخرة حالياً.</p>
                      ) : (
                        alerts.map((al, idx) => (
                          <div key={idx} className="p-3 rounded-lg bg-red-50 text-red-800 text-xs border border-red-100 leading-normal">
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
            <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
              <div className="hidden lg:flex flex-col text-left px-2">
                <span className="text-[10px] text-slate-500 font-medium">حساب الصلاحيات النشط:</span>
                <span className="text-xs font-bold text-slate-800">
                  {currentRole === UserRole.ADMIN ? "مدير النظام (كامل الصلاحية)" : 
                   currentRole === UserRole.ACCOUNTANT ? "محاسب / مدير حسابات" : 
                   "مراقب مالي (عرض فقط)"}
                </span>
              </div>
              <select 
                value={currentRole} 
                onChange={(e) => {
                  setCurrentRole(e.target.value as UserRole);
                  showToast(`تم التغيير إلى صلاحيات: ${e.target.value === UserRole.ADMIN ? "مدير النظام" : e.target.value === UserRole.ACCOUNTANT ? "المحاسب" : "مراقب مالي"}`);
                }}
                className="bg-white border border-slate-200 text-xs font-bold px-3 py-1.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer"
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
          <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-1 sticky top-24 shadow-sm">
            
            <p className="text-[11px] font-bold text-slate-400 tracking-wider uppercase px-3 pb-2 border-b border-slate-100 mb-2">القائمة المالية</p>

            <button 
              onClick={() => setActiveTab("suppliers")}
              className={`w-full flex items-center gap-3 px-3 py-3 text-sm font-semibold rounded-xl transition-all ${
                activeTab === "suppliers" ? "bg-sky-50 text-sky-700 shadow-sm" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Users className="w-5 h-5 shrink-0" />
              <span>إدارة الموردين ({suppliers.length})</span>
            </button>

            <button 
              onClick={() => setActiveTab("invoices")}
              className={`w-full flex items-center gap-3 px-3 py-3 text-sm font-semibold rounded-xl transition-all ${
                activeTab === "invoices" ? "bg-sky-50 text-sky-700 shadow-sm" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Receipt className="w-5 h-5 shrink-0" />
              <span>فواتير المشتريات ({invoices.length})</span>
            </button>

            <button 
              onClick={() => setActiveTab("payments")}
              className={`w-full flex items-center gap-3 px-3 py-3 text-sm font-semibold rounded-xl transition-all ${
                activeTab === "payments" ? "bg-sky-50 text-sky-700 shadow-sm" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <CreditCard className="w-5 h-5 shrink-0" />
              <span>سجل المدفوعات</span>
            </button>

            <button 
              onClick={() => setActiveTab("banking")}
              className={`w-full flex items-center gap-3 px-3 py-3 text-sm font-semibold rounded-xl transition-all ${
                activeTab === "banking" ? "bg-sky-50 text-sky-700 shadow-sm" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Building className="w-5 h-5 shrink-0" />
              <span>التكامل البنكي والتسوية</span>
            </button>

            <p className="text-[11px] font-bold text-slate-400 tracking-wider uppercase px-3 pt-4 pb-2 border-b border-slate-100 mb-2">التحليلات والمتابعة</p>

            <button 
              onClick={() => setActiveTab("reports")}
              className={`w-full flex items-center gap-3 px-3 py-3 text-sm font-semibold rounded-xl transition-all ${
                activeTab === "reports" ? "bg-sky-50 text-sky-700 shadow-sm" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <FileText className="w-5 h-5 shrink-0" />
              <span>التقارير التحليلية والتحميل</span>
            </button>

            <button 
              onClick={() => setActiveTab("backups")}
              className={`w-full flex items-center gap-3 px-3 py-3 text-sm font-semibold rounded-xl transition-all ${
                activeTab === "backups" ? "bg-sky-50 text-sky-700 shadow-sm" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Database className="w-5 h-5 shrink-0" />
              <span>النسخ الاحتياطي التلقائي</span>
            </button>

            <button 
              onClick={() => setActiveTab("chat")}
              className={`w-full flex items-center justify-between px-3 py-3 text-sm font-semibold rounded-xl transition-all ${
                activeTab === "chat" ? "bg-sky-50 text-sky-700 shadow-sm" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <div className="flex items-center gap-3">
                <MessageSquare className="w-5 h-5 shrink-0 text-sky-500" />
                <span>الدعم الفني والذكاء الاصطناعي</span>
              </div>
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            </button>

          </div>
        </aside>

        {/* CONTENT BOX - Tab Views */}
        <div className="flex-1 min-w-0">
          
          {/* Dashboard Summary Statistics Bar (Always rendered at the top of content tabs in screen) */}
          <div className="no-print grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 font-medium">إجمالي المشتريات</p>
                <p className="text-lg md:text-xl font-bold text-slate-900 mt-1">{dashboardStats.totalInvoicesAmount.toLocaleString()} <span className="text-xs text-slate-500">ج.م</span></p>
                <div className="flex items-center gap-1 mt-1.5 text-slate-400 text-[10px]">
                  <Activity className="w-3.5 h-3.5" />
                  <span>تاريخ آخر تحديث اليوم</span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
                <Receipt className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 font-medium font-semibold">إجمالي المسدد</p>
                <p className="text-lg md:text-xl font-bold text-emerald-700 mt-1">{dashboardStats.paidAmount.toLocaleString()} <span className="text-xs text-slate-500">ج.م</span></p>
                <div className="flex items-center gap-1 mt-1.5 text-emerald-600 text-[10px] font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>معدل تسوية {dashboardStats.paymentRatio}%</span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-700">
                <Check className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 font-medium">المديونية المستحقة</p>
                <p className="text-lg md:text-xl font-bold text-red-600 mt-1">{dashboardStats.pendingAmount.toLocaleString()} <span className="text-xs text-slate-500">ج.م</span></p>
                <div className="flex items-center gap-1 mt-1.5 text-red-600 text-[10px] font-medium">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-500 animate-pulse" />
                  <span>{dashboardStats.unpaidInvoicesCount} فواتير تحتاج سداد</span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-red-700">
                <ShieldAlert className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 font-medium">حساب الموردين</p>
                <p className="text-lg md:text-xl font-bold text-sky-950 mt-1">{dashboardStats.suppliersCount} <span className="text-xs text-slate-500">موردين مسجلين</span></p>
                <div className="flex items-center gap-1 mt-1.5 text-sky-700 text-[10px] font-medium">
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>مصنفين حسب الخدمات</span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center text-sky-700">
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
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
                  
                  {/* Search Bar */}
                  <div className="relative w-full md:w-64">
                    <input 
                      type="text" 
                      placeholder="ابحث باسم المورد أو الشركة..."
                      value={supplierSearch}
                      onChange={(e) => setSupplierSearch(e.target.value)}
                      className="w-full text-xs border border-slate-200 px-3 py-2.5 pr-8 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent bg-slate-50"
                    />
                    <Users className="w-4 h-4 text-slate-400 absolute right-3 top-3.5" />
                  </div>

                  {/* Category Filter */}
                  <div className="w-full md:w-auto">
                    <select
                      value={supplierCategoryFilter}
                      onChange={(e) => setSupplierCategoryFilter(e.target.value)}
                      className="w-full text-xs border border-slate-200 px-3 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer bg-slate-50 font-medium"
                    >
                      <option value="all">كل التصنيفات والخدمات</option>
                      <option value="مواد خام">مواد خام</option>
                      <option value="شحن ولوجستيات">شحن ولوجستيات</option>
                      <option value="خدمات مكتبية وتكنولوجيا">خدمات مكتبية وتكنولوجيا</option>
                      <option value="تعبئة وتغليف">تعبئة وتغليف</option>
                    </select>
                  </div>

                </div>

                <button 
                  onClick={() => setShowAddSupplierModal(true)}
                  className="w-full md:w-auto flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white text-xs font-bold px-5 py-3 rounded-xl shadow-md shadow-sky-100 cursor-pointer transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>إضافة مورد جديد</span>
                </button>
              </div>

              {/* Grid / List of suppliers */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredSuppliers.length === 0 ? (
                  <div className="col-span-2 bg-white rounded-2xl border border-slate-100 p-12 text-center text-slate-400 text-sm">
                    لا يوجد موردين متوافقين مع معايير البحث الحالية.
                  </div>
                ) : (
                  filteredSuppliers.map((sup) => {
                    const supInvoices = invoices.filter(i => i.supplierId === sup.id);
                    const supPaid = payments.filter(p => p.supplierId === sup.id).reduce((sum, p) => sum + p.amount, 0);
                    const supTotal = supInvoices.reduce((sum, i) => sum + i.totalAmount, 0);
                    const supPending = supInvoices.filter(i => i.status === "unpaid").reduce((sum, i) => sum + i.totalAmount, 0);

                    return (
                      <motion.div 
                        key={sup.id}
                        layout
                        className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-start justify-between">
                            <div>
                              <span className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full">{sup.category}</span>
                              <h3 className="text-base font-bold text-slate-900 mt-2">{sup.name}</h3>
                              <p className="text-xs text-sky-700 font-semibold">{sup.company}</p>
                            </div>
                            <button 
                              onClick={() => handleDeleteSupplier(sup.id, sup.name)}
                              className="p-1.5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                              title="حذف هذا المورد"
                            >
                              <Trash2 className="w-4.5 h-4.5" />
                            </button>
                          </div>

                          <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-slate-100 text-xs">
                            <div>
                              <span className="text-slate-400 block mb-0.5">رقم الهاتف:</span>
                              <span className="font-semibold text-slate-800 font-mono">{sup.phone}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block mb-0.5">البريد الإلكتروني:</span>
                              <span className="font-semibold text-slate-800 break-all">{sup.email}</span>
                            </div>
                            <div className="col-span-2">
                              <span className="text-slate-400 block mb-0.5">رقم الحساب البنكي / IBAN:</span>
                              <span className="font-mono text-slate-700 text-[11px] block bg-slate-50 p-1 px-2 rounded border border-slate-100">{sup.bankAccount}</span>
                            </div>
                            <div className="col-span-2">
                              <span className="text-slate-400 block mb-0.5">العنوان المسجل:</span>
                              <span className="text-slate-700 text-xs">{sup.address}</span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs bg-slate-50 -mx-5 -mb-5 px-5 py-3 rounded-b-2xl">
                          <div>
                            <span className="text-slate-500">إجمالي الفواتير:</span>
                            <span className="font-bold text-slate-900 mx-1">{supTotal.toLocaleString()} ج.م</span>
                          </div>
                          <div>
                            <span className="text-slate-500">المديونية الحالية:</span>
                            <span className={`font-bold ${supPending > 0 ? "text-red-600" : "text-emerald-700"} mx-1`}>
                              {supPending.toLocaleString()} ج.م
                            </span>
                          </div>
                        </div>

                      </motion.div>
                    );
                  })
                )}
              </div>
            </motion.div>
          )}

          {/* VIEW: INVOICES */}
          {activeTab === "invoices" && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              
              {/* Search and filter toolbar */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
                  
                  {/* Invoice search */}
                  <div className="relative w-full md:w-64">
                    <input 
                      type="text" 
                      placeholder="ابحث برقم الفاتورة أو المورد..."
                      value={invoiceSearch}
                      onChange={(e) => setInvoiceSearch(e.target.value)}
                      className="w-full text-xs border border-slate-200 px-3 py-2.5 pr-8 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 bg-slate-50"
                    />
                    <Receipt className="w-4 h-4 text-slate-400 absolute right-3 top-3.5" />
                  </div>

                  {/* Status filter */}
                  <div className="w-full md:w-auto">
                    <select
                      value={invoiceStatusFilter}
                      onChange={(e) => setInvoiceStatusFilter(e.target.value)}
                      className="w-full text-xs border border-slate-200 px-3 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer bg-slate-50 font-bold"
                    >
                      <option value="all">كل حالات السداد</option>
                      <option value="unpaid">لم يتم السداد</option>
                      <option value="paid">تم السداد</option>
                    </select>
                  </div>

                </div>

                <button 
                  onClick={() => setShowAddInvoiceModal(true)}
                  className="w-full md:w-auto flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white text-xs font-bold px-5 py-3 rounded-xl shadow-md shadow-sky-100 cursor-pointer transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>تسجيل فاتورة كرتونية جديدة</span>
                </button>
              </div>

              {/* Invoices List Display */}
              <div className="space-y-4">
                {filteredInvoices.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center text-slate-400 text-sm">
                    لا توجد فواتير مشتريات مطابقة للبحث حالياً.
                  </div>
                ) : (
                  filteredInvoices.map((inv) => {
                    const sup = suppliers.find(s => s.id === inv.supplierId);
                    const isDueSoon = inv.status === "unpaid" && new Date(inv.dueDate).getTime() <= new Date("2026-06-12").getTime();

                    return (
                      <div 
                        key={inv.id}
                        className={`bg-white rounded-2xl border ${isDueSoon ? "border-red-300 ring-1 ring-red-100" : "border-slate-200"} p-5 shadow-sm transition-all`}
                      >
                        
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          
                          <div className="flex items-start gap-3">
                            <div className={`p-3 rounded-xl ${inv.status === "paid" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"} shrink-0`}>
                              <Receipt className="w-6 h-6" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 font-mono text-sm">{inv.invoiceNumber}</span>
                                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                                  inv.status === "paid" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                                }`}>
                                  {inv.status === "paid" ? "تم السداد" : "لم يتم السداد"}
                                </span>
                                {isDueSoon && (
                                  <span className="text-[10px] font-semibold bg-red-600 text-white px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3 text-white" />
                                    مستحق قريباً!
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 font-semibold mt-1">المورد: {sup ? `${sup.name} (${sup.company})` : "غير معروف"}</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                            <div>
                              <span className="text-slate-400 block mb-0.5">تاريخ الإصدار:</span>
                              <span className="font-semibold text-slate-700 font-mono">{inv.issueDate}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block mb-0.5">تاريخ الاستحقاق:</span>
                              <span className={`font-semibold font-mono ${inv.status === "unpaid" ? "text-red-600" : "text-slate-700"}`}>{inv.dueDate}</span>
                            </div>
                            <div className="col-span-2 md:col-span-1">
                              <span className="text-slate-400 block mb-0.5">القيمة الإجمالية:</span>
                              <span className="text-sm font-black text-slate-900">{inv.totalAmount.toLocaleString()} ج.م</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end md:self-auto">
                            {inv.status === "unpaid" ? (
                              <button 
                                onClick={() => executeSettlementSimulate(inv)}
                                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-md shadow-emerald-100 cursor-pointer transition-colors"
                              >
                                <CreditCard className="w-4 h-4" />
                                <span>سداد وتسوية بنكية</span>
                              </button>
                            ) : (
                              <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100 px-3 py-2 rounded-xl flex items-center gap-1">
                                <CheckCircle2 className="w-4 h-4" />
                                تم السداد بالكامل
                              </span>
                            )}
                          </div>

                        </div>

                        {/* Invoice Items details line items dropdown style */}
                        <div className="mt-4 pt-4 border-t border-slate-100">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">البنود والمنتجات المسجلة:</p>
                          <div className="bg-slate-50 rounded-xl p-3 space-y-2 border border-slate-100">
                            {inv.items.map((item, idx) => (
                              <div key={idx} className="flex items-center justify-between text-xs text-slate-700 font-medium">
                                <span>{item.name || "بند افتراضي"}</span>
                                <span className="text-slate-500 font-mono">
                                  {item.quantity} × {item.price.toLocaleString()} ج.م = <strong className="text-slate-950">{(item.quantity * item.price).toLocaleString()} ج.م</strong>
                                </span>
                              </div>
                            ))}
                            {inv.notes && (
                              <p className="text-[11px] text-slate-500 border-t border-slate-200 pt-2 mt-2 font-medium">
                                <strong className="text-slate-700">ملاحظات:</strong> {inv.notes}
                              </p>
                            )}
                          </div>
                        </div>

                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          )}

          {/* VIEW: PAYMENTS */}
          {activeTab === "payments" && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6"
            >
              <div>
                <h3 className="text-base font-bold text-slate-900">سجل المدفوعات والعمليات المالية المنفذة</h3>
                <p className="text-xs text-slate-500 mt-1">تتبع كافة التحويلات الصادرة لتسوية فواتير المشتريات الخاصة بالموردين</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 font-bold bg-slate-50/50">
                      <th className="py-3 px-4 rounded-r-xl">رقم العملية</th>
                      <th className="py-3 px-4">المورّد</th>
                      <th className="py-3 px-4">الفاتورة المرتبطة</th>
                      <th className="py-3 px-4">تاريخ المعاملة</th>
                      <th className="py-3 px-4">طريقة الدفع</th>
                      <th className="py-3 px-4">المرجع المصرفي</th>
                      <th className="py-3 px-4 rounded-l-xl text-left">المبلغ المدفوع</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400 font-medium">لا توجد عمليات دفع مسجلة حالياً.</td>
                      </tr>
                    ) : (
                      payments.map((p) => {
                        const sup = suppliers.find(s => s.id === p.supplierId);
                        const inv = invoices.find(i => i.id === p.invoiceId);
                        
                        return (
                          <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors">
                            <td className="py-4 px-4 font-bold text-slate-800 font-mono">{p.id}</td>
                            <td className="py-4 px-4 font-semibold text-slate-900">{sup ? sup.name : "مورد محذوف"}</td>
                            <td className="py-4 px-4 font-mono text-slate-500">{inv ? inv.invoiceNumber : "فاتورة كرتونية"}</td>
                            <td className="py-4 px-4 font-mono text-slate-600">{p.paymentDate}</td>
                            <td className="py-4 px-4 font-semibold">
                              <span className={`px-2 py-0.5 rounded-full ${
                                p.method === "bank_transfer" ? "bg-blue-50 text-blue-700" :
                                p.method === "fawry" ? "bg-amber-50 text-amber-700" : "bg-purple-50 text-purple-700"
                              }`}>
                                {p.method === "bank_transfer" ? "تحويل بنكي" :
                                 p.method === "fawry" ? "مدفوعات فوري" : "شيك / نقدي"}
                              </span>
                            </td>
                            <td className="py-4 px-4 font-mono text-slate-500 text-[11px] font-medium">{p.transRef}</td>
                            <td className="py-4 px-4 font-bold text-emerald-700 text-left text-sm">{p.amount.toLocaleString()} ج.م</td>
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
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <Building className="w-5 h-5 text-sky-600" />
                      بوابات التكامل البنكي والتحويل الفوري (RTGS Console)
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">تكامل لحظي مع شبكة المدفوعات القومية للبنوك وتفويض التحويلات والخصم المباشر لحسابات الموردين</p>
                  </div>
                  <div className="text-xs bg-slate-100 font-semibold px-3 py-1 rounded-xl flex items-center gap-1 border border-slate-200">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    المسار البنكي متصل (Settle Server Online)
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
                  {linkedBanks.map((bank, index) => (
                    <div 
                      key={index} 
                      className={`p-4 rounded-xl border transition-all ${
                        bank.isLinked 
                        ? "bg-slate-50 border-sky-300 shadow-sm" 
                        : "bg-white border-slate-200 opacity-60 hover:opacity-100"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold text-slate-900">{bank.bankName}</span>
                        <button
                          onClick={() => handleToggleBankLinkage(bank.bankName)}
                          className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border cursor-pointer transition-colors ${
                            bank.isLinked
                            ? "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                            : "bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100"
                          }`}
                        >
                          {bank.isLinked ? "فصل الاتصال" : "ربط الآن"}
                        </button>
                      </div>
                      <div className="space-y-1.5 text-xs text-slate-500 font-medium">
                        <div className="flex justify-between">
                          <span>رقم الحساب التسووي:</span>
                          <span className="font-mono text-slate-800">{bank.accountNumber}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>رمز الـ API المصرفي:</span>
                          <span className="font-mono text-slate-400">{bank.apiKey}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Settlement Sandbox Visual Simulator Console */}
              <div className="bg-slate-950 text-slate-200 p-6 rounded-2xl border border-slate-800 shadow-2xl relative overflow-hidden">
                <div className="absolute top-2 left-3 text-[10px] font-mono text-slate-500">Mawrid RTGS Core Engine v3.1</div>
                
                <h3 className="text-sky-400 font-bold text-sm mb-4 border-b border-slate-800 pb-2 flex items-center gap-2">
                  <Activity className="w-4.5 h-4.5 animate-pulse text-sky-400" />
                  أداة إدارة التسوية الذكية للمدفوعات اللحظية
                </h3>

                {isSettlingProcess ? (
                  <div className="space-y-4 py-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-sky-200 font-semibold mb-1 block">جاري تشغيل تسوية المعاملة... {settlementProgress}%</span>
                      <RefreshCw className="w-4.5 h-4.5 text-sky-400 animate-spin" />
                    </div>
                    {/* Console Logger box */}
                    <div className="bg-slate-900 rounded-xl p-4 border border-slate-800 h-40 overflow-y-auto space-y-1.5 font-mono text-[11px] leading-relaxed">
                      {settlementLogs.map((log, idx) => (
                        <div key={idx} className="text-emerald-400 flex items-start gap-1">
                          <span className="text-slate-600 shrink-0">[{idx+1}]</span>
                          <span>{log}</span>
                        </div>
                      ))}
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div className="bg-gradient-to-r from-sky-400 to-emerald-400 h-full transition-all duration-300" style={{ width: `${settlementProgress}%` }}></div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 py-2">
                    <p className="text-xs text-slate-300">
                      يمكنك تحديد أي فاتورة غير مسددة من القائمة وسدادها تلقائياً بضغطة زر. يقوم المحرك بالاتصال اللحظي بـ APIs البنك المُرتبط وتطوير العمليات ماليًا.
                    </p>

                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                      <h4 className="text-xs font-bold text-slate-300 border-b border-slate-800 pb-2 mb-3">اختر الفاتورة المستهدفة للتصفية الفورية:</h4>
                      
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {invoices.filter(i => i.status === "unpaid").length === 0 ? (
                          <p className="text-xs text-center text-slate-500 py-4">كل فواتير المشتريات مسددة بالكامل! لا توجد فواتير معلقة حالياً.</p>
                        ) : (
                          invoices.filter(i => i.status === "unpaid").map((inv) => {
                            const sup = suppliers.find(s => s.id === inv.supplierId);
                            return (
                              <div key={inv.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 bg-slate-950 rounded-lg border border-slate-850 hover:bg-slate-900 justify-between gap-4">
                                <div className="text-xs">
                                  <div className="flex items-center gap-2">
                                    <strong className="text-sky-300 font-mono text-xs">{inv.invoiceNumber}</strong>
                                    <span className="text-slate-500 font-mono">({inv.dueDate})</span>
                                  </div>
                                  <span className="text-slate-400 text-[11px]">مستحق للمورد: {sup ? sup.name : "غير معروف"}</span>
                                </div>
                                <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                                  <span className="text-emerald-400 font-mono font-bold text-xs">{inv.totalAmount.toLocaleString()} ج.م</span>
                                  <button
                                    onClick={() => executeSettlementSimulate(inv)}
                                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] px-3 py-1.5 rounded-lg shrink-0 cursor-pointer transition-colors"
                                  >
                                    تسوية فورية
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
              className="space-y-6"
            >
              
              {/* Filter Report Month Parameters */}
              <div className="no-print bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">منظومة التقارير الشهرية ومحفظة الاستثمار</h3>
                  <p className="text-xs text-slate-500 mt-1">توليد تقارير شاملة للعمليات التشغيلية، وحفظها أو تصديرها كملفات PDF للأرشيف</p>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <select 
                    value={reportMonth} 
                    onChange={(e) => setReportMonth(e.target.value)}
                    className="bg-slate-50 border border-slate-200 text-xs px-3 py-2 rounded-xl focus:ring-1 focus:ring-sky-500 cursor-pointer"
                  >
                    <option value="04">أبريل</option>
                    <option value="05">مايو</option>
                    <option value="06">يونيو</option>
                  </select>

                  <select 
                    value={reportYear} 
                    onChange={(e) => setReportYear(e.target.value)}
                    className="bg-slate-50 border border-slate-200 text-xs px-3 py-2 rounded-xl focus:ring-1 focus:ring-sky-500 cursor-pointer"
                  >
                    <option value="2026">2026</option>
                  </select>

                  <button 
                    onClick={handlePrintReport}
                    className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-md cursor-pointer transition-colors"
                  >
                    <Printer className="w-4 h-4" />
                    <span>تصدير تقرير PDF</span>
                  </button>
                </div>
              </div>

              {/* AI Executive summary overview panel */}
              <div className="no-print bg-gradient-to-r from-sky-50 to-indigo-50 border border-sky-100 p-5 rounded-2xl shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-sky-950 flex items-center gap-1">
                    <TrendingUp className="w-4.5 h-4.5 text-sky-600 animate-bounce" />
                    الملخص التحليلي الذكي (AI executive insights)
                  </h4>
                  <button 
                    onClick={getAiAnalyticsDraft}
                    disabled={isGeneratingAiSummary || isAiTyping}
                    className="p-1.5 text-sky-600 hover:bg-sky-100 rounded-lg transition-colors cursor-pointer"
                    title="تحديث التلخيص بالذكاء الاصطناعي"
                  >
                    <RefreshCw className={`w-4 h-4 ${isGeneratingAiSummary ? "animate-spin" : ""}`} />
                  </button>
                </div>
                
                {isGeneratingAiSummary ? (
                  <div className="space-y-2 py-2">
                    <div className="h-3 w-3/4 rounded bg-sky-200/50 animate-pulse"></div>
                    <div className="h-3 w-5/6 rounded bg-sky-200/50 animate-pulse"></div>
                    <div className="h-3 w-1/2 rounded bg-sky-200/50 animate-pulse"></div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-700 leading-relaxed font-medium">
                    {aiReportSummary || "الرجاء الضغط على زر التحديث لتوليد تقرير الذكاء الاصطناعي الفوري بخصوص أرقام هذا الشهر."}
                  </p>
                )}
              </div>

              {/* Recharts Graphs representation Panels */}
              <div className="no-print grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Monthly Volume comparison chart */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                  <h4 className="text-xs font-bold text-slate-800">تتبع حجم المشتريات والمدفوعات الشهرية (ج.م)</h4>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={getMonthlyFinancialsData()}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={{ stroke: "#e2e8f0" }} />
                        <YAxis tick={{ fontSize: 10, fill: "#64748b" }} axisLine={{ stroke: "#e2e8f0" }} />
                        <Tooltip contentStyle={{ fontSize: "11px", borderRadius: "8px", direction: "rtl", textAlign: "right" }} />
                        <Legend wrapperStyle={{ fontSize: "11px" }} />
                        <Bar dataKey="إجمالي المشتريات" fill="#0284c7" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="إجمالي المسدد" fill="#10b981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Portfolio Supplier Category distribution */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                  <h4 className="text-xs font-bold text-slate-800">توزيع المشتريات طبقاً لفئات الموردين</h4>
                  <div className="h-64 flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={getPortfolioDistributionData()}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {getPortfolioDistributionData().map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: any) => `${value.toLocaleString()} ج.م`} contentStyle={{ fontSize: "11px" }} />
                        <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: "9px" }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

              </div>

              {/* PRINT-ONLY OFFICIAL DIRECT Arabic REPORT (Will print layout exceptionally) */}
              <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm space-y-6 printable-report-sheet max-w-4xl mx-auto">
                
                {/* Printed Header Banner */}
                <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4">
                  <div>
                    <h2 className="text-lg font-black text-slate-950">مؤسسة المدفوعات العربية المتكاملة</h2>
                    <p className="text-xs text-slate-500 font-medium">التقرير المالي المعزز لحسابات الموردين وفواتير الشراء</p>
                    <p className="text-xs text-slate-500 font-mono mt-1">تاريخ استخراج التقرير: 2026-06-07</p>
                  </div>
                  <div className="text-left">
                    <div className="w-10 h-10 bg-slate-950 rounded-xl flex items-center justify-center text-white font-extrabold mx-auto text-sm">م</div>
                    <span className="text-xs font-bold text-slate-900 block mt-1">مُورِّد الذكي</span>
                  </div>
                </div>

                {/* Report specs indicators */}
                <div className="grid grid-cols-3 gap-4 border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                  <div className="text-center">
                    <span className="text-slate-400 text-xs font-medium block">الفترة المحاسبية</span>
                    <strong className="text-sm text-slate-800 font-bold block mt-1">{reportMonth === "05" ? "مايو" : reportMonth === "04" ? "أبريل" : "يونيو"} {reportYear}</strong>
                  </div>
                  <div className="text-center border-x border-slate-200">
                    <span className="text-slate-400 text-xs font-medium block">إجمالي التعاملات للفترة</span>
                    <strong className="text-sm text-slate-900 font-black block mt-1">{dashboardStats.totalInvoicesAmount.toLocaleString()} ج.م</strong>
                  </div>
                  <div className="text-center">
                    <span className="text-slate-400 text-xs font-medium block">المديونية غير المسواة</span>
                    <strong className="text-sm text-red-600 font-black block mt-1">{dashboardStats.pendingAmount.toLocaleString()} ج.م</strong>
                  </div>
                </div>

                {/* Ledger Listing inside the PDF */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-widest border-r-2 border-sky-600 pr-2">تفاصيل أرصدة الموردين والفواتير النشطة</h4>
                  
                  <table className="w-full text-[11px] text-right border border-slate-200">
                    <thead>
                      <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-bold">
                        <th className="py-2.5 px-3">المورّد</th>
                        <th className="py-2.5 px-3">الشركة</th>
                        <th className="py-2.5 px-3">الفئة</th>
                        <th className="py-2.5 px-3">إجمالي المطالبات</th>
                        <th className="py-2.5 px-3 text-left">المديونية المستحقة والرهون</th>
                      </tr>
                    </thead>
                    <tbody>
                      {suppliers.map((sup) => {
                        const supInvoices = invoices.filter(i => i.supplierId === sup.id);
                        const supTotal = supInvoices.reduce((sum, i) => sum + i.totalAmount, 0);
                        const supPending = supInvoices.filter(i => i.status === "unpaid").reduce((sum, i) => sum + i.totalAmount, 0);

                        return (
                          <tr key={sup.id} className="border-b border-slate-200">
                            <td className="py-2 px-3 font-semibold text-slate-900">{sup.name}</td>
                            <td className="py-2 px-3 text-slate-600">{sup.company}</td>
                            <td className="py-2 px-3 text-slate-500">{sup.category}</td>
                            <td className="py-2 px-3 font-mono font-semibold">{supTotal.toLocaleString()} ج.م</td>
                            <td className="py-2 px-3 font-mono font-bold text-left text-slate-900">{supPending.toLocaleString()} ج.m</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Legal terms stamp bottom screen */}
                <div className="flex items-end justify-between border-t border-slate-200 pt-6 mt-12 text-xs">
                  <div>
                    <p className="font-semibold text-slate-800">توقيع الإدارة المالية والمحاسبة</p>
                    <div className="h-10 w-32 border-b border-slate-300 border-dashed mt-2"></div>
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-slate-800">خاتم وتوثيق المؤسسة</p>
                    <div className="w-16 h-16 rounded-full border-2 border-emerald-600/30 flex items-center justify-center text-[10px] text-emerald-600 border-dashed mt-2 select-none mx-auto leading-tight">
                      تم تصديره<br />إلكترونياً
                    </div>
                  </div>
                </div>

              </div>

            </motion.div>
          )}

          {/* VIEW: BACKUPS TIMELINE */}
          {activeTab === "backups" && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6"
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">نظام النسخ الاحتياطي التلقائي والدوري للبيانات</h3>
                  <p className="text-xs text-slate-500 mt-1">حماية تامة من فقدان الحسابات بقاعدة بيانات مدمجة دورية والقدرة على تحميل واسترجاع الأرشيف</p>
                </div>

                <button 
                  onClick={triggerManualBackup}
                  className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-md transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>إنشاء نسخة احتياطية الآن</span>
                </button>
              </div>

              {/* Automatic Backup state indicator */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center gap-3 text-xs text-slate-600">
                <Shield className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <span className="font-bold text-slate-900 block">جدولة النسخ التلقائي: فعالة وعاملة (Auto-backup Scheduled Daily)</span>
                  <span className="text-[11px] text-slate-500">يقوم الخادم آلياً بحفظ نسخة متكاملة مشفرة في تمام الساعة 12:00 منتصف الليل يومياً.</span>
                </div>
              </div>

              {/* Backup list history */}
              <div className="space-y-3">
                <span className="text-xs font-bold text-slate-400 block uppercase tracking-wider">سجل النسخ الاحتياطية المتوفرة:</span>
                
                {backups.map((bc, idx) => (
                  <div key={idx} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-white border border-slate-150 rounded-xl hover:border-slate-300 transition-colors justify-between gap-4">
                    <div className="flex items-start gap-2.5">
                      <div className="p-2 rounded-lg bg-slate-100 text-slate-600 mt-0.5 shrink-0">
                        <Database className="w-4.5 h-4.5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <strong className="text-sm text-slate-900 font-bold">{bc.type === "auto" ? "نسخة احتياطية تلقائية" : "نسخة احتياطية يدوية"}</strong>
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${bc.type === "auto" ? "bg-indigo-50 text-indigo-700" : "bg-sky-50 text-sky-700"}`}>
                            {bc.type === "auto" ? "تلقائي" : "يدوي مُصدَّق"}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 block mt-0.5 font-mono">{new Date(bc.timestamp).toLocaleString("ar")}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                      <div className="text-xs text-slate-500 text-right">
                        <span>الحجم: <strong>{bc.size}</strong></span>
                        <span className="block text-[11px] text-slate-400 font-medium">{bc.recordsCount.suppliers} موردين / {bc.recordsCount.invoices} فواتير</span>
                      </div>
                      <button
                        onClick={() => restoreBackupRecord(bc)}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] px-3 py-1.5 rounded-lg shrink-0 cursor-pointer transition-colors"
                      >
                        استرجاع النسخة
                      </button>
                    </div>

                  </div>
                ))}
              </div>

            </motion.div>
          )}

          {/* VIEW: CHAT DIRECT SUPPORT WITH GEMINI AI */}
          {activeTab === "chat" && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col h-[600px] overflow-hidden justify-between"
            >
              
              <div className="border-b border-slate-150 pb-3">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-3 h-3 bg-emerald-500 rounded-full animate-ping"></span>
                  المساعد المالي والتقني الذكي لـ "مورد"
                </h3>
                <p className="text-xs text-slate-500 mt-1">تحدث باللغة العربية مع مساعد الذكاء الاصطناعي للاستعلام الفوري عن الحسابات والمساعدة الفنية</p>
              </div>

              {/* Chat bubbles viewport Container */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 rounded-2xl my-4 border border-slate-100">
                {supportMessages.map((msg) => (
                  <div 
                    key={msg.id} 
                    className={`flex ${msg.role === "user" ? "justify-start" : "justify-end"}`}
                  >
                    <div className={`p-3.5 rounded-2xl text-xs max-w-2/3 leading-relaxed shadow-sm ${
                      msg.role === "user" 
                      ? "bg-slate-900 text-white rounded-br-none" 
                      : "bg-white text-slate-800 border border-slate-200 rounded-bl-none font-medium"
                    }`}>
                      <p className="whitespace-pre-line">{msg.text}</p>
                      <span className={`text-[9px] block text-left mt-1.5 ${msg.role === "user" ? "text-slate-400" : "text-slate-400"}`}>
                        {new Date(msg.timestamp).toLocaleTimeString("ar", { hour: "numeric", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>
                ))}

                {isAiTyping && (
                  <div className="flex justify-end">
                    <div className="bg-white text-slate-500 border border-slate-200 p-3.5 rounded-2xl rounded-bl-none flex items-center gap-1.5 text-xs font-semibold shadow-sm">
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                      <span>جاري التفكير والتوليد...</span>
                    </div>
                  </div>
                )}
                <div ref={chatBottomRef}></div>
              </div>

              {/* Chat Input form */}
              <form onSubmit={handleSendChatMessage} className="flex items-center gap-2">
                <input 
                  type="text" 
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  disabled={isAiTyping}
                  placeholder="اسألني عن الموردين، المديونات، أو كيفية تسجيل الفواتير والسداد..."
                  className="flex-1 text-xs border border-slate-200 p-3.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent bg-slate-50"
                />
                <button 
                  type="submit"
                  disabled={!chatInput.trim() || isAiTyping}
                  className="bg-slate-950 hover:bg-slate-800 text-white p-3.5 rounded-xl font-bold cursor-pointer transition-colors shrink-0 flex items-center justify-center disabled:opacity-45"
                >
                  <Send className="w-4.5 h-4.5" />
                </button>
              </form>

            </motion.div>
          )}

        </div>

      </main>

      {/* FOOTER */}
      <footer className="no-print text-center text-[11px] text-slate-400 border-t border-slate-200 mt-12 pt-6 max-w-7xl mx-auto w-full">
        <p>نظام مورد الذكي المتكامل للمدفوعات والمشتريات © 2026. كافة الحقوق محفوظة لحساب وسلامة البيانات الاستثمارية.</p>
      </footer>

      {/* MODAL: ADD SUPPLIER */}
      {showAddSupplierModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-950">إضافة مورد جديد للمنظومة</h3>
              <button onClick={() => setShowAddSupplierModal(false)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSupplier} className="space-y-4 text-xs">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-500 block mb-1">اسم المورد الكامل *</label>
                  <input 
                    type="text" 
                    required
                    value={newSupplier.name}
                    onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2.5 bg-slate-50"
                    placeholder="م. محمد العربي"
                  />
                </div>
                <div>
                  <label className="text-slate-500 block mb-1">اسم الشركة / المؤسسة *</label>
                  <input 
                    type="text" 
                    required
                    value={newSupplier.company}
                    onChange={(e) => setNewSupplier({ ...newSupplier, company: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2.5 bg-slate-50"
                    placeholder="مجموعة السويدي كابلات"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-500 block mb-1">رقم الهاتف التواصل *</label>
                  <input 
                    type="tel" 
                    value={newSupplier.phone}
                    onChange={(e) => setNewSupplier({ ...newSupplier, phone: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2.5 bg-slate-50"
                    placeholder="01012345678"
                  />
                </div>
                <div>
                  <label className="text-slate-500 block mb-1">البريد الإلكتروني</label>
                  <input 
                    type="email" 
                    value={newSupplier.email}
                    onChange={(e) => setNewSupplier({ ...newSupplier, email: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2.5 bg-slate-50"
                    placeholder="supplier@company.eg"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-500 block mb-1">رقم الحساب البنكي / International IBAN *</label>
                <input 
                  type="text" 
                  value={newSupplier.bankAccount}
                  onChange={(e) => setNewSupplier({ ...newSupplier, bankAccount: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg p-2.5 bg-slate-50 font-mono text-[11px]"
                  placeholder="EG000000000000000000000000000"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-500 block mb-1">فئة النشاط المورّد</label>
                  <select
                    value={newSupplier.category}
                    onChange={(e) => setNewSupplier({ ...newSupplier, category: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2.5 bg-slate-50"
                  >
                    <option value="مواد خام">مواد خام</option>
                    <option value="شحن ولوجستيات">شحن ولوجستيات</option>
                    <option value="خدمات مكتبية وتكنولوجيا">خدمات مكتبية وتكنولوجيا</option>
                    <option value="تعبئة وتغليف">تعبئة وتغليف</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-500 block mb-1">العنوان والمقر</label>
                  <input 
                    type="text" 
                    value={newSupplier.address}
                    onChange={(e) => setNewSupplier({ ...newSupplier, address: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2.5 bg-slate-50"
                    placeholder="المنطقة الصناعية الثالثة، الجيزة"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-500 block mb-1">ملاحظات وشروط إضافية</label>
                <textarea 
                  value={newSupplier.notes}
                  onChange={(e) => setNewSupplier({ ...newSupplier, notes: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg p-2 bg-slate-50 h-20"
                  placeholder="أدخل أي ملاحظات حول الدفع أو السداد..."
                />
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                <button 
                  type="button"
                  onClick={() => setShowAddSupplierModal(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-lg select-none cursor-pointer"
                >
                  إلغاء الأمر
                </button>
                <button 
                  type="submit"
                  className="bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white font-bold px-5 py-2.5 rounded-lg cursor-pointer"
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-950">تسجيل فاتورة شحنات مشتريات جديدة</h3>
              <button onClick={() => setShowAddInvoiceModal(false)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddInvoice} className="space-y-4 text-xs">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-500 block mb-1">اختر المورد المرتبط *</label>
                  <select 
                    required
                    value={newInvoice.supplierId}
                    onChange={(e) => setNewInvoice({ ...newInvoice, supplierId: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2.5 bg-slate-50 font-semibold text-slate-900 focus:outline-none"
                  >
                    <option value="">-- اضغط للاختيار --</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.company})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-slate-500 block mb-1">رقم الفاتورة الصادر *</label>
                  <input 
                    type="text" 
                    required
                    placeholder="FT-2026-X"
                    value={newInvoice.invoiceNumber}
                    onChange={(e) => setNewInvoice({ ...newInvoice, invoiceNumber: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2.5 bg-slate-50 font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-500 block mb-1">تاريخ الاستحقاق المتوقع *</label>
                  <input 
                    type="date" 
                    required
                    value={newInvoice.dueDate}
                    onChange={(e) => setNewInvoice({ ...newInvoice, dueDate: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2.5 bg-slate-50 font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-500 block mb-1">البيانات / مذكرات عامة</label>
                  <input 
                    type="text" 
                    value={newInvoice.notes}
                    onChange={(e) => setNewInvoice({ ...newInvoice, notes: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2.5 bg-slate-50"
                    placeholder="شحنة التجهيز المقررة لمخازن العاشر"
                  />
                </div>
              </div>

              {/* Items row editor section */}
              <div className="space-y-2 border-t border-slate-100 pt-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">بنود الفاتورة وقائمة التوريد:</span>
                  <button 
                    type="button" 
                    onClick={handleAddItemRow}
                    className="text-sky-600 hover:text-sky-800 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    اضافة سطر توريد
                  </button>
                </div>

                <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                  {newInvoice.items.map((item, index) => (
                    <div key={index} className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-150">
                      <input 
                        type="text" 
                        required
                        placeholder="اسم الصنف / الخدمة"
                        value={item.name}
                        onChange={(e) => handleUpdateItemRow(index, "name", e.target.value)}
                        className="flex-1 border border-slate-200 rounded p-1.5 bg-white text-slate-900"
                      />
                      <input 
                        type="number" 
                        required
                        min="1"
                        placeholder="الكمية"
                        value={item.quantity}
                        onChange={(e) => handleUpdateItemRow(index, "quantity", parseInt(e.target.value) || 1)}
                        className="w-16 border border-slate-200 rounded p-1.5 bg-white text-slate-900 font-mono text-center"
                      />
                      <input 
                        type="number" 
                        required
                        min="0"
                        placeholder="سعر الوحدة"
                        value={item.price}
                        onChange={(e) => handleUpdateItemRow(index, "price", parseFloat(e.target.value) || 0)}
                        className="w-24 border border-slate-200 rounded p-1.5 bg-white text-slate-900 font-mono text-left"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveItemRow(index)}
                        className="p-1.5 text-slate-400 hover:text-red-500 rounded"
                      >
                        <XCircle className="w-4.5 h-4.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                <button 
                  type="button"
                  onClick={() => setShowAddInvoiceModal(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-lg select-none cursor-pointer"
                >
                  إلغاء
                </button>
                <button 
                  type="submit"
                  className="bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white font-bold px-5 py-2.5 rounded-lg cursor-pointer"
                >
                  تسجيل وحفظ الفاتورة
                </button>
              </div>

            </form>
          </motion.div>
        </div>
      )}

    </div>
  );
}
