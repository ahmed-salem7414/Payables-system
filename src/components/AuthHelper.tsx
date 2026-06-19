import { useState } from "react";
import { googleSignIn } from "../firebase";
import { Cloud, CheckCircle2, AlertTriangle, ShieldCheck, HelpCircle } from "lucide-react";

export default function AuthHelper() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleStartAuth = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setSuccess(true);
        setUserEmail(result.user.email || "حساب Google");
        
        // Post credentials back to main Mawrid dashboard in opener window
        if (window.opener) {
          window.opener.postMessage({
            type: "GOOGLE_AUTH_SUCCESS",
            user: result.user,
            accessToken: result.accessToken
          }, "*");
          
          // Smooth closure
          setTimeout(() => {
            window.close();
          }, 1800);
        } else {
          setError("لم يتم فتح هذه النافذة من قبل نافذة مورد الأم. يرجى محاولة فتح الربط من داخل النظام.");
        }
      }
    } catch (err: any) {
      console.error("Auth helper popup error:", err);
      const msg = String(err?.message || err);
      if (msg.includes("popup-closed-by-user") || msg.includes("auth/popup-closed-by-user")) {
        setError("تم إغلاق نافذة الدخول قبل إتمام الربط.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 flex flex-col items-center justify-center p-6 text-right font-sans selection:bg-sky-500/20" dir="rtl">
      {/* Decorative gradient glowing spots */}
      <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-sky-500/10 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="w-full max-w-md bg-[#0b1329]/80 border border-slate-800/80 p-6 md:p-8 rounded-3xl shadow-2xl relative z-10 backdrop-blur-md space-y-6">
        
        {/* Header Icon */}
        <div className="flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 bg-sky-500/20 rounded-full blur-xl animate-pulse"></div>
            <div className="relative bg-slate-900 border border-slate-700/60 p-5 rounded-2xl flex items-center justify-center">
              <Cloud className="w-10 h-10 text-sky-400" />
            </div>
          </div>
        </div>

        {/* Title and Intro */}
        <div className="text-center space-y-2">
          <h2 className="text-xl font-extrabold text-white tracking-tight">
            ربط حساب Google Drive الآمن
          </h2>
          <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
            بوابة الإقران الخارجية لتجاوز قيود النوافذ المنبثقة داخل متصفحك وحفظ النسخ الاحتياطية لنظام مورد تلقائياً.
          </p>
        </div>

        {/* Status Blocks */}
        {success ? (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 text-center space-y-2 animate-fadeIn">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
            <p className="text-sm font-bold text-emerald-300">تم تسجيل الدخول بنجاح!</p>
            <p className="text-xs text-slate-300 font-mono select-all break-all bg-emerald-950/40 py-1.5 px-3 rounded-lg border border-emerald-500/20">
              {userEmail}
            </p>
            <p className="text-[11px] text-slate-400">سيتم إغلاق هذه النافذة تلقائياً والمتابعة بنظام مورد...</p>
          </div>
        ) : error ? (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 text-right space-y-2 animate-fadeIn">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-400" />
              <p className="text-xs font-bold text-rose-400">عذراً، حدث خطأ أثناء الربط:</p>
            </div>
            <p className="text-xs text-rose-300/90 font-mono bg-rose-950/20 py-2 px-3 rounded-lg border border-rose-500/10 select-all break-all">
              {error}
            </p>
            <button
              onClick={handleStartAuth}
              className="w-full mt-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 text-white font-bold py-2 rounded-xl text-xs transition-colors cursor-pointer"
            >
              إعادة المحاولة والربط مجدداً
            </button>
          </div>
        ) : (
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 text-xs text-slate-300 leading-relaxed space-y-3">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
              <span>مورد يستخدم بروتوكول Google OAuth 2.0 القياسي والآمن بنسبة 100%.</span>
            </div>
            <div className="flex items-start gap-2.5">
              <HelpCircle className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
              <span>يقتصر الوصول فقط على المجلد الخاص بنسخ نظام مورد الاحتياطية على السحاب دون أي إمكانية لقراءة أي ملفات أخرى خاصة بك.</span>
            </div>
          </div>
        )}

        {/* Action Button */}
        {!success && (
          <div className="pt-2">
            <button
              disabled={loading}
              onClick={handleStartAuth}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 text-white font-extrabold py-3.5 px-6 rounded-2xl text-xs cursor-pointer select-none transition-all shadow-lg active:scale-[0.98] duration-200"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-300 border-t-white rounded-full animate-spin"></div>
                  <span>جاري الاتصال والتحقق...</span>
                </>
              ) : (
                <span>المتابعة وتسجيل الدخول بحساب جوجل</span>
              )}
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="text-center pt-2">
          <span className="text-[10px] text-slate-500 font-mono">
            Mawrid Security Gate &bull; v1.1
          </span>
        </div>

      </div>
    </div>
  );
}
