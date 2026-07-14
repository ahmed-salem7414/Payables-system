import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Lock, 
  Mail, 
  User, 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle2, 
  ArrowLeftRight, 
  Users,
  Eye,
  EyeOff
} from "lucide-react";

interface UserInfo {
  id: string;
  name: string;
  email: string;
  role: "admin" | "accountant" | "viewer";
  status: "active" | "suspended";
  createdAt: string;
}

interface MawridAuthProps {
  onLoginSuccess: (user: UserInfo) => void;
}

export default function MawridAuth({ onLoginSuccess }: MawridAuthProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"admin" | "accountant" | "viewer">("accountant");
  const [showPassword, setShowPassword] = useState(false);
  
  // Alerts and loading states
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Quick login handler
  const handleQuickLogin = async (presetRole: "admin" | "accountant" | "viewer") => {
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const emailMap = {
      admin: "admin@mawrid.com",
      accountant: "accountant@mawrid.com",
      viewer: "viewer@mawrid.com"
    };

    const passMap = {
      admin: "admin",
      accountant: "accountant",
      viewer: "viewer"
    };

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: emailMap[presetRole],
          password: passMap[presetRole]
        })
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || "فشل تسجيل الدخول السريع.");
      }

      setSuccessMsg("تم تسجيل الدخول بنجاح عبر حساب التجربة!");
      setTimeout(() => {
        onLoginSuccess(resData.user);
      }, 800);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Manual Form Submission (Login / Register)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email || !password || (!isLogin && !name)) {
      setErrorMsg("يرجى تعبئة جميع الحقول المطلوبة.");
      return;
    }

    setIsLoading(true);
    const endpoint = isLogin ? "/api/auth/login" : "/api/auth/register";
    const bodyObj = isLogin 
      ? { email, password } 
      : { name, email, password, role };

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyObj)
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || "حدث خطأ أثناء العملية.");
      }

      setSuccessMsg(resData.message || "تمت العملية بنجاح!");
      
      // If it is registration, auto-log them in or switch to login
      if (!isLogin) {
        setTimeout(() => {
          setIsLogin(true);
          setPassword("");
          setSuccessMsg("تم تسجيل حسابك الجديد! يرجى إدخال كلمة المرور لتسجيل الدخول.");
        }, 1200);
      } else {
        setTimeout(() => {
          onLoginSuccess(resData.user);
        }, 1000);
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 md:p-6 font-sans select-none overflow-y-auto" dir="rtl">
      {/* Visual background decorative elements */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Main container */}
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200/80 shadow-2xl p-6 md:p-8 relative z-10 my-8">
        
        {/* Header Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 bg-emerald-50 rounded-xl text-emerald-600 mb-3 border border-emerald-100 shadow-inner">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">نظام موِرد للمحاسبة</h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">بوابة تسجيل الدخول وإدارة الصلاحيات والوصول</p>
        </div>

        {/* Form Auth Tabs */}
        <div className="flex bg-slate-100 p-1 rounded-xl mb-6 border border-slate-200/40">
          <button
            type="button"
            onClick={() => {
              setIsLogin(true);
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              isLogin 
                ? "bg-white text-slate-800 shadow-[0_2px_8px_rgba(0,0,0,0.06)]" 
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            تسجيل الدخول
          </button>
          <button
            type="button"
            onClick={() => {
              setIsLogin(false);
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              !isLogin 
                ? "bg-white text-slate-800 shadow-[0_2px_8px_rgba(0,0,0,0.06)]" 
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            إنشاء حساب جديد
          </button>
        </div>

        {/* Message Notifications */}
        <AnimatePresence mode="wait">
          {errorMsg && (
            <motion.div 
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="bg-red-50 text-red-700 text-xs font-semibold p-3.5 rounded-xl border border-red-100 mb-4 flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </motion.div>
          )}

          {successMsg && (
            <motion.div 
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="bg-emerald-50 text-emerald-700 text-xs font-semibold p-3.5 rounded-xl border border-emerald-100 mb-4 flex items-start gap-2.5"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* User Name - Register Only */}
          {!isLogin && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 block">الاسم الكامل</label>
              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  placeholder="أدخل الاسم الكامل"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-4 pr-10 py-2.5 bg-slate-50 text-slate-800 text-sm font-semibold rounded-xl border border-slate-200 focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  required
                />
              </div>
            </div>
          )}

          {/* Email Address */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600 block">البريد الإلكتروني</label>
            <div className="relative">
              <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                <Mail className="w-4 h-4" />
              </div>
              <input
                type="email"
                placeholder="example@mawrid.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-4 pr-10 py-2.5 bg-slate-50 text-slate-800 text-sm font-semibold rounded-xl border border-slate-200 focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-left"
                dir="ltr"
                required
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600 block">كلمة المرور</label>
            <div className="relative">
              <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 bg-slate-50 text-slate-800 text-sm font-semibold rounded-xl border border-slate-200 focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-left"
                dir="ltr"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Role Selection - Register Only */}
          {!isLogin && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 block">رتبة الصلاحية المطلوبة</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setRole("viewer")}
                  className={`py-2 px-1 text-[11px] font-bold rounded-xl border transition-all ${
                    role === "viewer"
                      ? "bg-slate-50 border-slate-400 text-slate-800 shadow-sm"
                      : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                  }`}
                >
                  مراقب مالي
                </button>
                <button
                  type="button"
                  onClick={() => setRole("accountant")}
                  className={`py-2 px-1 text-[11px] font-bold rounded-xl border transition-all ${
                    role === "accountant"
                      ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-700 shadow-sm"
                      : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                  }`}
                >
                  محاسب مالي
                </button>
                <button
                  type="button"
                  onClick={() => setRole("admin")}
                  className={`py-2 px-1 text-[11px] font-bold rounded-xl border transition-all ${
                    role === "admin"
                      ? "bg-purple-500/10 border-purple-500/40 text-purple-700 shadow-sm"
                      : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                  }`}
                >
                  مدير النظام
                </button>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-emerald-600/10 hover:shadow-emerald-600/20 flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50 disabled:pointer-events-none mt-2"
          >
            {isLoading ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : isLogin ? (
              "تسجيل الدخول"
            ) : (
              "تسجيل حساب جديد"
            )}
          </button>
        </form>

        {/* Quick Access Preset Logins (Extremely friendly testing wrapper) */}
        <div className="mt-8 pt-6 border-t border-slate-200/60">
          <div className="flex items-center gap-2 text-[11px] font-extrabold text-slate-400 tracking-wider uppercase mb-4">
            <Users className="w-3.5 h-3.5" />
            <span>تسجيل دخول سريع للتجربة والاستكشاف</span>
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => handleQuickLogin("admin")}
              className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-100 hover:bg-slate-200/70 border border-slate-200/50 rounded-xl transition-all text-left group"
            >
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500 shrink-0" />
                <span className="text-xs font-bold text-slate-700">مدير النظام</span>
              </div>
              <span className="text-[10px] text-slate-400 font-medium group-hover:text-slate-600 transition-colors">دخول مباشر &larr;</span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickLogin("accountant")}
              className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-100 hover:bg-slate-200/70 border border-slate-200/50 rounded-xl transition-all text-left group"
            >
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                <span className="text-xs font-bold text-slate-700">المحاسب المالي</span>
              </div>
              <span className="text-[10px] text-slate-400 font-medium group-hover:text-slate-600 transition-colors">دخول مباشر &larr;</span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickLogin("viewer")}
              className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-100 hover:bg-slate-200/70 border border-slate-200/50 rounded-xl transition-all text-left group"
            >
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
                <span className="text-xs font-bold text-slate-700">المراقب المالي (عرض فقط)</span>
              </div>
              <span className="text-[10px] text-slate-400 font-medium group-hover:text-slate-600 transition-colors">دخول مباشر &larr;</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
