import React, { useEffect, useState } from "react";
import { getApiUrl } from "../utils/api";
import { 
  Users, 
  UserPlus, 
  Shield, 
  Trash2, 
  UserX, 
  UserCheck, 
  Mail, 
  Calendar, 
  Search, 
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Lock,
  ChevronDown
} from "lucide-react";

interface UserInfo {
  id: string;
  name: string;
  email: string;
  role: "admin" | "accountant" | "viewer";
  status: "active" | "suspended";
  createdAt: string;
}

interface MawridUserManagementProps {
  onShowToast: (msg: string, type?: "success" | "error" | "info") => void;
  currentUserId: string; // so they don't lock themselves out or delete themselves!
}

export default function MawridUserManagement({ onShowToast, currentUserId }: MawridUserManagementProps) {
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Create User Form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "accountant" | "viewer">("viewer");
  const [submitting, setSubmitting] = useState(false);

  // Load all users from backend
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch(getApiUrl("/api/auth/users"));
      const data = await res.json();
      if (res.ok && data.success) {
        setUsers(data.users || []);
      } else {
        onShowToast(data.error || "فشل جلب قائمة المستخدمين.", "error");
      }
    } catch (err) {
      console.error(err);
      onShowToast("خطأ في الشبكة أثناء جلب المستخدمين.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Handle Role Change
  const handleRoleChange = async (userId: string, targetRole: "admin" | "accountant" | "viewer") => {
    if (userId === currentUserId) {
      onShowToast("عذراً، لا يمكنك تعديل صلاحيات حسابك النشط لتفادي قفل حسابك.", "error");
      return;
    }

    try {
      const res = await fetch(getApiUrl("/api/auth/users/update-role"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: targetRole })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onShowToast(data.message || "تم تحديث الصلاحية بنجاح!", "success");
        // Update local state
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: targetRole } : u));
      } else {
        onShowToast(data.error || "فشل تحديث الصلاحية.", "error");
      }
    } catch (err) {
      onShowToast("خطأ في الاتصال بالخادم.", "error");
    }
  };

  // Handle Status Toggle (Suspend / Activate)
  const handleStatusToggle = async (userId: string, currentStatus: "active" | "suspended") => {
    if (userId === currentUserId) {
      onShowToast("لا يمكنك تعطيل حسابك النشط بنفسك.", "error");
      return;
    }

    const nextStatus = currentStatus === "active" ? "suspended" : "active";

    try {
      const res = await fetch(getApiUrl("/api/auth/users/update-status"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, status: nextStatus })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onShowToast(data.message || "تم تغيير حالة الحساب بنجاح!", "success");
        // Update state
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: nextStatus } : u));
      } else {
        onShowToast(data.error || "فشل تغيير حالة الحساب.", "error");
      }
    } catch (err) {
      onShowToast("خطأ في الاتصال بالخادم.", "error");
    }
  };

  // Handle User Deletion
  const handleDeleteUser = async (userId: string) => {
    if (userId === currentUserId) {
      onShowToast("لا يمكنك حذف حسابك الحالي من النظام.", "error");
      return;
    }

    if (!window.confirm("هل أنت متأكد تماماً من رغبتك في حذف هذا المستخدم نهائياً؟ لا يمكن التراجع عن هذا الإجراء.")) {
      return;
    }

    try {
      const res = await fetch(getApiUrl("/api/auth/users/delete"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onShowToast(data.message || "تم حذف المستخدم بنجاح.", "success");
        setUsers(prev => prev.filter(u => u.id !== userId));
      } else {
        onShowToast(data.error || "فشل حذف المستخدم.", "error");
      }
    } catch (err) {
      onShowToast("خطأ في الاتصال بالخادم.", "error");
    }
  };

  // Handle Add User Form Submission
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newEmail || !newPassword) {
      onShowToast("يرجى ملء جميع الحقول المطلوبة.", "error");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(getApiUrl("/api/auth/register"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          email: newEmail,
          password: newPassword,
          role: newRole
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onShowToast("تم إنشاء حساب المستخدم بنجاح ومزامنته!", "success");
        // Refresh users list
        fetchUsers();
        // Clear inputs and close
        setNewName("");
        setNewEmail("");
        setNewPassword("");
        setNewRole("viewer");
        setShowAddForm(false);
      } else {
        onShowToast(data.error || "فشل إنشاء الحساب الجديد.", "error");
      }
    } catch (err) {
      onShowToast("خطأ في الاتصال بالخادم أثناء التسجيل.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Filtering users
  const filteredUsers = users.filter(u => {
    const query = searchQuery.trim().toLowerCase();
    return (
      u.name.toLowerCase().includes(query) ||
      u.email.toLowerCase().includes(query) ||
      u.role.toLowerCase().includes(query)
    );
  });

  // Calculate statistics
  const stats = {
    total: users.length,
    active: users.filter(u => u.status === "active").length,
    suspended: users.filter(u => u.status === "suspended").length,
    admins: users.filter(u => u.role === "admin").length,
    accountants: users.filter(u => u.role === "accountant").length,
    viewers: users.filter(u => u.role === "viewer").length,
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Upper Dashboard Tab Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-md">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2.5">
            <Users className="w-5.5 h-5.5 text-emerald-600" />
            <span>نظام الصلاحيات وإدارة المستخدمين</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">عرض السجلات والموظفين وتخصيص رتب الصلاحيات وتعطيل الحسابات</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-600/10 hover:shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>إضافة مستخدم جديد</span>
          </button>
          <button
            onClick={fetchUsers}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all border border-slate-200/50"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-emerald-600" : ""}`} />
          </button>
        </div>
      </div>

      {/* Mini Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200/65 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">إجمالي المستخدمين</p>
          <p className="text-xl font-black text-slate-800 mt-1">{stats.total}</p>
        </div>
        <div className="bg-emerald-50/40 p-4 rounded-xl border border-emerald-100/50 shadow-sm">
          <p className="text-[10px] font-bold text-emerald-600/80 uppercase tracking-wider">حسابات نشطة</p>
          <p className="text-xl font-black text-emerald-800 mt-1">{stats.active}</p>
        </div>
        <div className="bg-red-50/40 p-4 rounded-xl border border-red-100/50 shadow-sm">
          <p className="text-[10px] font-bold text-red-600/80 uppercase tracking-wider">معطلة وموقوفة</p>
          <p className="text-xl font-black text-red-800 mt-1">{stats.suspended}</p>
        </div>
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/65 shadow-sm">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">التوزع الإداري</p>
          <p className="text-[11px] font-bold text-slate-700 mt-1">
            {stats.admins} مدير | {stats.accountants} محاسب | {stats.viewers} مراقب
          </p>
        </div>
      </div>

      {/* Manual Add User Drawer/Card */}
      {showAddForm && (
        <div className="bg-slate-50 border border-slate-200/80 p-5 rounded-2xl shadow-inner space-y-4">
          <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-emerald-600" />
            <span>تسجيل مستخدم جديد يدوياً</span>
          </h3>
          <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600">اسم الموظف</label>
              <input
                type="text"
                placeholder="أدخل الاسم الرباعي"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600">البريد الإلكتروني</label>
              <input
                type="email"
                placeholder="user@mawrid.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500 text-left"
                dir="ltr"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600">كلمة المرور الابتدائية</label>
              <input
                type="password"
                placeholder="أدخل كلمة المرور"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500 text-left"
                dir="ltr"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600">رتبة الصلاحية</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as any)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="viewer">مراقب مالي (عرض فقط)</option>
                <option value="accountant">محاسب مالي</option>
                <option value="admin">مدير النظام (كامل الصلاحية)</option>
              </select>
            </div>
            
            <div className="md:col-span-4 flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 bg-slate-200/80 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-xl transition-all"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1"
              >
                {submitting ? "جاري الحفظ..." : "تأكيد الإضافة والإنشاء"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters & Grid Container */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-md overflow-hidden">
        
        {/* Search Bar */}
        <div className="p-4 border-b border-slate-200/60 bg-slate-50/50 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="البحث بالاسم، البريد الإلكتروني، أو رتبة الصلاحية..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-4 pr-9 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <span className="text-[11px] text-slate-400 font-bold hidden sm:inline-block">
            مستعرضاً: {filteredUsers.length} من {users.length} مستخدم
          </span>
        </div>

        {/* Users Table */}
        {loading ? (
          <div className="flex flex-col items-center justify-center p-16 space-y-3">
            <div className="w-8 h-8 border-3 border-emerald-500/20 border-t-emerald-600 rounded-full animate-spin" />
            <span className="text-xs font-bold text-slate-500">جاري تحميل قائمة الموظفين والمستخدمين...</span>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 text-center space-y-2">
            <Users className="w-12 h-12 text-slate-300" />
            <span className="text-sm font-black text-slate-600">لا يوجد مستخدمون متوافقون</span>
            <span className="text-xs text-slate-400">تأكد من صحة محددات البحث أو أضف موظفاً جديداً.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-500 font-extrabold uppercase text-[10px] tracking-wider border-b border-slate-200/60">
                <tr>
                  <th className="px-5 py-3">الموظف / البريد</th>
                  <th className="px-5 py-3">تاريخ الإنشاء</th>
                  <th className="px-5 py-3">حالة الحساب</th>
                  <th className="px-5 py-3 text-center">الصلاحية (الرتبة)</th>
                  <th className="px-5 py-3 text-left">إجراءات التحكم</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredUsers.map((user) => {
                  const isSelf = user.id === currentUserId;
                  return (
                    <tr 
                      key={user.id} 
                      className={`hover:bg-slate-50/50 transition-colors ${
                        isSelf ? "bg-emerald-50/10" : ""
                      }`}
                    >
                      {/* Name & Email */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                            user.role === "admin" 
                              ? "bg-purple-500/10 text-purple-700" 
                              : user.role === "accountant"
                                ? "bg-emerald-500/10 text-emerald-700"
                                : "bg-blue-500/10 text-blue-700"
                          }`}>
                            {user.name.charAt(0)}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-extrabold text-slate-800 flex items-center gap-1.5">
                              {user.name}
                              {isSelf && (
                                <span className="text-[9px] bg-emerald-500/15 text-emerald-700 px-1.5 py-0.5 rounded-full font-bold">
                                  أنت حالياً
                                </span>
                              )}
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium font-mono tracking-tight flex items-center gap-1 mt-0.5" dir="ltr">
                              <Mail className="w-3 h-3 text-slate-300" />
                              {user.email}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Date Registered */}
                      <td className="px-5 py-4 text-slate-500 font-mono text-[11px]">
                        <div className="flex items-center gap-1.5 text-slate-500">
                          <Calendar className="w-3.5 h-3.5 text-slate-300" />
                          <span>{new Date(user.createdAt).toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" })}</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4">
                        {user.status === "active" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-black">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            نشط ومفعل
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-700 rounded-full text-[10px] font-black">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                            موقوف / معطل
                          </span>
                        )}
                      </td>

                      {/* Role selection dropdown */}
                      <td className="px-5 py-4 text-center">
                        {isSelf ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 text-slate-700 border border-slate-200/50 rounded-lg text-[10px] font-bold uppercase">
                            <Shield className="w-3 h-3 text-purple-600" />
                            {user.role === "admin" ? "مدير نظام" : user.role === "accountant" ? "محاسب مالي" : "مراقب مالي"}
                          </span>
                        ) : (
                          <div className="inline-flex items-center relative">
                            <select
                              value={user.role}
                              onChange={(e) => handleRoleChange(user.id, e.target.value as any)}
                              className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg border focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer text-slate-700 ${
                                user.role === "admin" 
                                  ? "bg-purple-500/5 border-purple-200 text-purple-700" 
                                  : user.role === "accountant"
                                    ? "bg-emerald-500/5 border-emerald-200 text-emerald-700"
                                    : "bg-blue-500/5 border-blue-200 text-blue-700"
                              }`}
                            >
                              <option value="viewer">مراقب مالي</option>
                              <option value="accountant">محاسب مالي</option>
                              <option value="admin">مدير نظام</option>
                            </select>
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-left">
                        <div className="flex items-center justify-end gap-2">
                          {/* Suspend / Activate Toggle */}
                          {!isSelf && (
                            <button
                              onClick={() => handleStatusToggle(user.id, user.status)}
                              className={`p-1.5 rounded-lg border transition-all ${
                                user.status === "active"
                                  ? "bg-amber-50 hover:bg-amber-100/80 border-amber-200 text-amber-700"
                                  : "bg-emerald-50 hover:bg-emerald-100/80 border-emerald-200 text-emerald-700"
                              }`}
                              title={user.status === "active" ? "تعطيل الحساب" : "تفعيل الحساب"}
                            >
                              {user.status === "active" ? (
                                <UserX className="w-4 h-4" />
                              ) : (
                                <UserCheck className="w-4 h-4" />
                              )}
                            </button>
                          )}

                          {/* Delete Button */}
                          {!isSelf && (
                            <button
                              onClick={() => handleDeleteUser(user.id)}
                              className="p-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 rounded-lg transition-all"
                              title="حذف نهائي"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Info Safety Notice */}
      <div className="bg-slate-50 border border-slate-200/50 p-4 rounded-xl text-slate-500 text-xs flex items-start gap-2.5">
        <AlertTriangle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong>ملاحظة أمنية:</strong> كمدير للنظام، تذكر أن تغيير الصلاحيات يسري مفعوله بشكل فوري على مستوى الجلسة والطلبات الخلفية. لمنع وقوع أي سيناريو لقفل الحسابات الإدارية، يمنع النظام مدراء الحسابات من تعطيل أو تعديل صلاحيات حساباتهم النشطة ذاتياً.
        </p>
      </div>
    </div>
  );
}
