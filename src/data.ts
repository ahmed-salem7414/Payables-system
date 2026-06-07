import { Supplier, Invoice, Payment, BackupRecord, UserRole } from "./types";

// Preseeded list of Egyptian/Arab custom suppliers
export const INITIAL_SUPPLIERS: Supplier[] = [
  {
    id: "sup-1",
    name: "م. أحمد الشافعي",
    company: "الوطنية للحديد والصلب",
    phone: "01023456789",
    email: "shafey@nationalsteel.com.eg",
    bankAccount: "EG93000201201928374859102",
    category: "مواد خام",
    address: "المنطقة الصناعية، السادس من أكتوبر، الجيزة",
    notes: "المورد الرئيسي لحديد التسليح والقطاعات المعدنية الهيكلية.",
    createdAt: "2026-01-15T08:30:00Z"
  },
  {
    id: "sup-2",
    name: "أ. فاطمة الزهراء",
    company: "الشرق الأوسط للحلول اللوجستية",
    phone: "01234567890",
    email: "logistic_zahra@mideast.com",
    bankAccount: "EG42000301902837461529348",
    category: "شحن ولوجستيات",
    address: "مبنى الصادرات، ميناء الإسكندرية",
    notes: "شريك الشحن البحري والبري للمواد والتجهيزات المستوردة.",
    createdAt: "2026-02-10T11:45:00Z"
  },
  {
    id: "sup-3",
    name: "أ. كريم عبد العزيز",
    company: "بروميديا للاستشارات وحلول المكاتب",
    phone: "01145678901",
    email: "k.abdelaziz@promedia-solutions.com",
    bankAccount: "EG15000501203948576210349",
    category: "خدمات مكتبية وتكنولوجيا",
    address: "بناية رقم ٤، شارع التسعين، التجمع الخامس، القاهرة",
    notes: "توريد الأجهزة المكتبية وصيانة الحواسيب وتجهيز غرف الاجتماعات.",
    createdAt: "2026-03-01T14:20:00Z"
  },
  {
    id: "sup-4",
    name: "م. مصطفى الجيار",
    company: "البلاستيك الحديث والعبوات الداعمة",
    phone: "01556789012",
    email: "m.geyar@modernplastic.eg",
    bankAccount: "EG72000801293847562019348",
    category: "تعبئة وتغليف",
    address: "المنطقة الحرة، العامرية، الإسكندرية",
    notes: "يوفر علب البولي-إيثيلين ومواد التغليف الكرتونية المعزولة طبياً.",
    createdAt: "2026-04-12T09:15:00Z"
  }
];

// Preseeded list of invoices with varying due dates to generate alerts (some past due, some upcoming, some paid)
export const INITIAL_INVOICES: Invoice[] = [
  {
    id: "inv-101",
    invoiceNumber: "FT-2026-001",
    supplierId: "sup-1",
    issueDate: "2026-05-01",
    dueDate: "2026-05-15", // Past due (unpaid)
    items: [
      { name: "حديد صلب مجلفن - ١٠ طن", quantity: 10, price: 34000 },
      { name: "أنابيب صلب مفرغة ٦ بوصة", quantity: 50, price: 1200 }
    ],
    totalAmount: 400000,
    status: "unpaid",
    notes: "فاتورة شحنة الربع الثاني من الحديد المجلفن المقاوم للصدأ."
  },
  {
    id: "inv-102",
    invoiceNumber: "FT-2026-002",
    supplierId: "sup-2",
    issueDate: "2026-05-05",
    dueDate: "2026-06-05", // Recently past due (unpaid)
    items: [
      { name: "تخليص جمركي شحنة الهند", quantity: 1, price: 42000 },
      { name: "شحن بري مقطورات نقل ثقيل", quantity: 3, price: 15000 }
    ],
    totalAmount: 87000,
    status: "unpaid",
    notes: "رسوم الميناء وتوريد النقل البري إلى مخازن أكتوبر."
  },
  {
    id: "inv-103",
    invoiceNumber: "FT-2026-003",
    supplierId: "sup-3",
    issueDate: "2026-05-10",
    dueDate: "2026-06-10", // Upcoming due in 3 days (unpaid)
    items: [
      { name: "أجهزة كمبيوتر محمول للمطورين", quantity: 5, price: 28000 },
      { name: "شاشات عرض الترا - ٤K", quantity: 5, price: 9000 }
    ],
    totalAmount: 185000,
    status: "unpaid",
    notes: "أجهزة القسم الهندسي الجديد وإضافات شبكة الألياف الضوئية."
  },
  {
    id: "inv-104",
    invoiceNumber: "FT-2026-004",
    supplierId: "sup-4",
    issueDate: "2026-04-15",
    dueDate: "2026-05-15",
    items: [
      { name: "رولات تغليف شفاف معزول", quantity: 200, price: 350 },
      { name: "صناديق كرتون مضلع مقوى", quantity: 5000, price: 8 }
    ],
    totalAmount: 110000,
    status: "paid", // Already fully paid
    notes: "شحنة الكرتون الفوري لبضائع العيد."
  },
  {
    id: "inv-105",
    invoiceNumber: "FT-2026-005",
    supplierId: "sup-1",
    issueDate: "2026-04-01",
    dueDate: "2026-05-01",
    items: [
      { name: "روافد فولاذية جسور أساس", quantity: 4, price: 45000 }
    ],
    totalAmount: 180000,
    status: "paid", // Already fully paid
    notes: "تجهيز خوص البنية الأساسية."
  }
];

// Preseeded list of completed payments tied to paid invoices
export const INITIAL_PAYMENTS: Payment[] = [
  {
    id: "pay-501",
    supplierId: "sup-4",
    invoiceId: "inv-104",
    amount: 110000,
    paymentDate: "2026-05-12",
    method: "fawry",
    transRef: "FWRY-9102837265"
  },
  {
    id: "pay-502",
    supplierId: "sup-1",
    invoiceId: "inv-105",
    amount: 180000,
    paymentDate: "2026-04-20",
    method: "bank_transfer",
    transRef: "NBE-TXN-20260420-998"
  }
];

// Preseeded logs for backup
export const INITIAL_BACKUPS: BackupRecord[] = [
  {
    id: "bcp-1",
    timestamp: "2026-06-05T00:00:05Z",
    type: "auto",
    size: "4.8 KB",
    recordsCount: { suppliers: 4, invoices: 5, payments: 2 },
    dataDump: "" // Filled dynamically if restored
  },
  {
    id: "bcp-2",
    timestamp: "2026-06-06T00:00:02Z",
    type: "auto",
    size: "4.9 KB",
    recordsCount: { suppliers: 4, invoices: 5, payments: 2 },
    dataDump: ""
  }
];

// List of bank connection simulator configurations
export const LOCAL_BANKS_SELECTION = [
  { id: "bme", name: "بنك مصر (Banque Misr)", code: "BM-EG" },
  { id: "nbe", name: "البنك الأهلي المصري (NBE)", code: "NBE-EG" },
  { id: "cib", name: "البنك التجاري الدولي (CIB)", code: "CIB-EG" },
  { id: "qnb", name: "بنك قطر الوطني الأهلي (QNB)", code: "QNB-EG" },
  { id: "fawry", name: "بوابة فوري بيزنس (Fawry Business)", code: "FWRY-EG" }
];
