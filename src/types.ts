/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum UserRole {
  ADMIN = 'admin',       // مدير النظام (كامل الصلاحيات)
  ACCOUNTANT = 'accountant', // محاسب / مدير حسابات (إضافة وتعديل، بدون حذف الموردين أو تعديل الصلاحيات)
  VIEWER = 'viewer'      // مراقب مالي (عرض وتقارير فقط، لا يمكنه التعديل أو الحذف)
}

export interface Supplier {
  id: string;
  name: string;        // اسم المورد
  company: string;     // اسم الشركة
  phone: string;       // رقم الهاتف
  email: string;       // البريد الإلكتروني
  bankAccount: string; // رقم الحساب البنكي / IBAN
  category: string;    // فئة الموردين (مواد خام، خدمات، لوجستيات، إلخ)
  address: string;     // العنوان
  notes?: string;      // مذكرات إضافية
  createdAt: string;   // تاريخ الإضافة
}

export interface Invoice {
  id: string;
  invoiceNumber: string; // رقم الفاتورة
  supplierId: string;    // معرف المورد
  issueDate: string;    // تاريخ الإصدار
  dueDate: string;      // تاريخ الاستحقاق
  items: Array<{ name: string; quantity: number; price: number }>;
  totalAmount: number;   // المبلغ الإجمالي
  status: 'paid' | 'unpaid'; // حالة السداد (تم السداد / لم يتم السداد)
  notes?: string;
}

export interface Payment {
  id: string;
  supplierId: string;    // معرف المورد
  invoiceId: string;     // معرف الفاتورة
  amount: number;        // المبلغ المدفوع
  paymentDate: string;   // تاريخ الدفع
  method: 'bank_transfer' | 'fawry' | 'cash' | 'check'; // طريقة الدفع
  transRef: string; // المرجع البنكي / رقم العملية
}

export interface BackupRecord {
  id: string;
  timestamp: string;     // وقت النسخة
  type: 'auto' | 'manual'; // تلقائية أو يدوية
  size: string;         // حجم البيانات التقريبي
  recordsCount: {
    suppliers: number;
    invoices: number;
    payments: number;
  };
  dataDump: string;      // البيانات ملسلسلة كـ JSON للتمكن من استرجاعها
}

export interface SupportMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
}

export interface BankConfig {
  bankName: string;
  accountNumber: string;
  apiKey: string;
  isLinked: boolean;
}

export interface CreditNote {
  id: string;
  creditNoteNumber: string; // رقم الإشعار الدائن
  supplierId: string;       // المورد المرتبط
  amount: number;           // قيمة الإشعار الدائن
  issueDate: string;        // تاريخ الإصدار
  dueDate: string;          // تاريخ الاستحقاق المتوقع
  status: 'active' | 'applied'; // حالة الإشعار (نشط / مطبق)
  items: Array<{ name: string; quantity: number; price: number }>; // تفاصيل بنود الإشعار الدائن
  notes?: string;           // ملاحظات
}

