import { pgTable, text, boolean, doublePrecision, varchar, jsonb } from "drizzle-orm/pg-core";

// Suppliers Table
export const suppliers = pgTable("suppliers", {
  id: varchar("id", { length: 128 }).primaryKey(),
  name: text("name").notNull(),
  company: text("company").notNull(),
  phone: text("phone").notNull(),
  email: text("email").notNull(),
  bankAccount: text("bank_account").notNull(),
  category: text("category").notNull(),
  address: text("address").notNull(),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
});

// Invoices Table
export const invoices = pgTable("invoices", {
  id: varchar("id", { length: 128 }).primaryKey(),
  invoiceNumber: text("invoice_number").notNull(),
  supplierId: varchar("supplier_id", { length: 128 }).notNull(),
  issueDate: text("issue_date").notNull(),
  dueDate: text("due_date").notNull(),
  items: jsonb("items").notNull().$type<Array<{ name: string; quantity: number; price: number }>>(),
  totalAmount: doublePrecision("total_amount").notNull(),
  status: text("status").notNull(), // 'paid' | 'unpaid'
  notes: text("notes"),
  warehouse: text("warehouse"),
  creditNoteAmount: doublePrecision("credit_note_amount"),
  vatRate: doublePrecision("vat_rate"),
  vatAmount: doublePrecision("vat_amount"),
  customVatAmount: doublePrecision("custom_vat_amount"),
  isCustomVat: boolean("is_custom_vat"),
  attachments: jsonb("attachments").$type<Array<{ name: string; type: string; dataUrl: string }>>(),
});

// Payments Table
export const payments = pgTable("payments", {
  id: varchar("id", { length: 128 }).primaryKey(),
  supplierId: varchar("supplier_id", { length: 128 }).notNull(),
  invoiceId: varchar("invoice_id", { length: 128 }).notNull(),
  amount: doublePrecision("amount").notNull(),
  paymentDate: text("payment_date").notNull(),
  method: text("method").notNull(), // 'bank_transfer' | 'fawry' | 'cash' | 'check'
  transRef: text("trans_ref").notNull(),
});

// Backups Table
export const backups = pgTable("backups", {
  id: varchar("id", { length: 128 }).primaryKey(),
  timestamp: text("timestamp").notNull(),
  type: text("type").notNull(), // 'auto' | 'manual'
  size: text("size").notNull(),
  recordsCount: jsonb("records_count").notNull().$type<{ suppliers: number; invoices: number; payments: number }>(),
  dataDump: text("data_dump").notNull(),
});

// Credit Notes Table
export const creditNotes = pgTable("credit_notes", {
  id: varchar("id", { length: 128 }).primaryKey(),
  creditNoteNumber: text("credit_note_number").notNull(),
  supplierId: varchar("supplier_id", { length: 128 }).notNull(),
  amount: doublePrecision("amount").notNull(),
  issueDate: text("issue_date").notNull(),
  dueDate: text("due_date").notNull(),
  status: text("status").notNull(), // 'active' | 'applied'
  items: jsonb("items").notNull().$type<Array<{ name: string; quantity: number; price: number }>>(),
  notes: text("notes"),
  attachments: jsonb("attachments").$type<Array<{ name: string; type: string; dataUrl: string }>>(),
});

// Configuration Table (holds key-value pairs for system settings)
export const systemConfig = pgTable("system_config", {
  key: varchar("key", { length: 128 }).primaryKey(),
  value: jsonb("value").notNull(),
});
