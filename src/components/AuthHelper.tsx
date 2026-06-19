import { useState, useEffect } from "react";
import { googleSignIn, googleSignInRedirect, handleRedirectResult } from "../firebase";
import { Cloud, CheckCircle2, AlertTriangle, ShieldCheck, HelpCircle, Copy, Check, ArrowRight, RefreshCw } from "lucide-react";

export default function AuthHelper() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedDomain, setCopiedDomain] = useState<string | null>(null);

  // Extract relevant domains for user convenience
  const devDomain = "ais-dev-q3mtusmun2tsb5rur7bk5w-88619399054.europe-west2.run.app";
  const preDomain = "ais-pre-q3mtusmun2tsb5rur7bk5w-88619399054.europe-west2.run.app";

  // Check if we are returning from a redirect flow on mount
  useEffect(() => {
    const checkRedirect = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await handleRedirectResult();
        if (result) {
          setSuccess(true);
          setUserEmail(result.user.email || "حساب Google");
          
          const authData = {
            user: result.user,
            accessToken: result.accessToken,
            timestamp: Date.now()
          };
          localStorage.setItem("mawrid_gdrive_auth", JSON.stringify(authData));
          
          if (window.opener) {
            window.opener.postMessage({
              type: "GOOGLE_AUTH_SUCCESS",
              user: result.user,
              accessToken: result.accessToken
            }, "*");
          }
          
          setTimeout(() => {
            window.close();
          }, 1800);
        }
      } catch (err: any) {
        console.error("Redirect check error:", err);
        const msg = String(err?.message || err).toLowerCase();
        if (msg.includes("unauthorized-domain") || msg.includes("auth/unauthorized-domain")) {
          setError("unauthorized-domain");
        } else {
          setError(String(err?.message || err));
        }
      } finally {
        setLoading(false);
      }
    };
    
    checkRedirect();
  }, []);

  const handleStartPopupAuth = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setSuccess(true);
        setUserEmail(result.user.email || "حساب Google");
        
        const authData = {
          user: result.user,
          accessToken: result.accessToken,
          timestamp: Date.now()
        };
        localStorage.setItem("mawrid_gdrive_auth", JSON.stringify(authData));
        
        // Post credentials back to main Mawrid dashboard in opener window
        if (window.opener) {
          window.opener.postMessage({
            type: "GOOGLE_AUTH_SUCCESS",
            user: result.user,
            accessToken: result.accessToken
          }, "*");
          
          setTimeout(() => {
            window.close();
          }, 1800);
        } else {
          // Solved gracefully since it is stored in localStorage!
          setSuccess(true);
        }
      }
    } catch (err: any) {
      console.error("Auth helper popup error:", err);
      const msg = String(err?.message || err).toLowerCase();
      if (msg.includes("popup-closed-by-user") || msg.includes("auth/popup-closed-by-user")) {
        setError("تم إغلاق نافذة الدخول قبل إتمام الربط.");
      } else if (msg.includes("unauthorized-domain") || msg.includes("auth/unauthorized-domain")) {
        setError("unauthorized-domain");
      } else {
        setError(String(err?.message || err));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleStartRedirectAuth = async () => {
    setLoading(true);
    setError(null);
    try {
      await googleSignInRedirect();
    } catch (err: any) {
      console.error("Auth helper redirect error:", err);
      const msg = String(err?.message || err).toLowerCase();
      if (msg.includes("unauthorized-domain") || msg.includes("auth/unauthorized-domain")) {
        setError("unauthorized-domain");
      } else {
        setError(String(err?.message || err));
      }
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedDomain(text);
      setTimeout(() => setCopiedDomain(null), 2000);
    }).catch(err => {
      console.error("Failed to copy text: ", err);
    });
  };

  const isUnauthorizedDomainError = error === "unauthorized-domain";

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 flex flex-col items-center justify-center p-4 md:p-6 text-right font-sans selection:bg-sky-500/20" dir="rtl">
      {/* Decorative gradient glowing spots */}
      <div className="absolute top-10 right-10 w-96 h-96 bg-sky-500/5 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-10 left-10 w-96 h-96 bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none"></div>

      <div className={`w-full ${isUnauthorizedDomainError ? "max-w-xl" : "max-w-md"} bg-[#0b1329]/80 border border-slate-800/80 p-6 md:p-8 rounded-3xl shadow-2xl relative z-10 backdrop-blur-md space-y-6 transition-all duration-300`}>
        
        {/* Header Icon */}
        <div className="flex justify-center">
          <div className="relative">
            <div className={`absolute inset-0 ${isUnauthorizedDomainError ? "bg-amber-500/20" : "bg-sky-500/20"} rounded-full blur-xl animate-pulse`}></div>
            <div className="relative bg-slate-900 border border-slate-700/60 p-5 rounded-2xl flex items-center justify-center">
              {isUnauthorizedDomainError ? (
                <AlertTriangle className="w-10 h-10 text-amber-400 animate-bounce" />
              ) : (
                <Cloud className="w-10 h-10 text-sky-400" />
              )}
            </div>
          </div>
        </div>

        {/* Title and Intro */}
        <div className="text-center space-y-2">
          <h2 className="text-xl font-extrabold text-white tracking-tight">
            {isUnauthorizedDomainError ? "تفعيل وإضافة النطاق المصرح به في Firebase" : "ربط حساب Google Drive الآمن"}
          </h2>
          <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
            {isUnauthorizedDomainError 
              ? "لتأمين تسجيل السحاب، يطلب Firebase تسجيل نطاقات الإقران الرسمية الخاصة بالتطبيق."
              : "بوابة الإقران الخارجية لتجاوز قيود النوافذ المنبثقة داخل متصفحك وحفظ النسخ الاحتياطية لنظام مورد تلقائياً."}
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
        ) : isUnauthorizedDomainError ? (
          <div className="space-y-5 animate-fadeIn">
            {/* Warning Message */}
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 text-sm text-amber-300 leading-relaxed">
              تظهر هذه المشكلة لأن النطاق الحالي للغرفة البرمجية غير معرّف في مشروعك الخاص بـ Firebase. لحل هذه المشكلة في أقل من دقيقة، يرجى القيام بالخطوات التالية:
            </div>

            {/* Steps & Solution Instruction */}
            <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 md:p-5 text-xs text-slate-300 space-y-4">
              <h3 className="font-bold text-white text-sm border-b border-slate-800 pb-2">خطوات الحل السريع:</h3>
              
              <ol className="list-decimal list-inside space-y-2.5 leading-relaxed text-right">
                <li>
                  افتح لوحة تحكم مشروعك <span className="text-sky-400 font-bold font-mono">vibrant-continuity-5fbwx</span> في موقع <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer" className="text-sky-400 underline hover:text-sky-300">Firebase Console ↗</a>
                </li>
                <li>
                  اذهب إلى قسم <span className="text-white font-bold">Authentication</span> من القائمة الجانبية.
                </li>
                <li>
                  اضغط على تبويب <span className="text-white font-bold">Settings (الإعدادات)</span> في الأعلى، ثم اختر قسم <span className="text-white font-bold">Authorized domains</span>.
                </li>
                <li>
                  اضغط على زر <span className="text-white font-bold">Add domain (إضافة نطاق)</span> وألصق النطاقين المدرجين بالأسفل (واحداً تلو الآخر):
                </li>
              </ol>

              {/* Copyable Domains Widget */}
              <div className="space-y-2 pt-2">
                <p className="text-[11px] font-semibold text-slate-400">انسخ النطاقات وألصقها في البوابة:</p>
                
                {/* Dev domain */}
                <div className="flex items-center justify-between bg-slate-950/80 border border-slate-800 p-2.5 rounded-xl">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] bg-sky-500/10 text-sky-400 border border-sky-500/20 px-1.5 py-0.5 rounded font-mono">1</span>
                    <span className="font-mono text-[11px] select-all break-all text-slate-200">{devDomain}</span>
                  </div>
                  <button 
                    onClick={() => copyToClipboard(devDomain)}
                    className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-sky-400 rounded-lg transition-colors cursor-pointer"
                    title="نسخ النطاق"
                  >
                    {copiedDomain === devDomain ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>

                {/* Pre domain */}
                <div className="flex items-center justify-between bg-slate-950/80 border border-slate-800 p-2.5 rounded-xl">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] bg-sky-500/10 text-sky-400 border border-sky-500/20 px-1.5 py-0.5 rounded font-mono">2</span>
                    <span className="font-mono text-[11px] select-all break-all text-slate-200">{preDomain}</span>
                  </div>
                  <button 
                    onClick={() => copyToClipboard(preDomain)}
                    className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-sky-400 rounded-lg transition-colors cursor-pointer"
                    title="نسخ النطاق"
                  >
                    {copiedDomain === preDomain ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="bg-sky-500/5 text-[11px] p-3 rounded-xl border border-sky-500/10 leading-relaxed text-sky-300">
                💡 <span className="font-bold">ملاحظة هامّة جداً:</span> قد يستغرق Firebase من دقيقة إلى دقيقتين لتحديث قائمة النطاقات المصرح بها وتطبيقها على الخوادم.
              </div>
            </div>

            {/* Back to auth try buttons */}
            <div className="space-y-2.5 pt-2">
              <button
                disabled={loading}
                onClick={handleStartRedirectAuth}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold py-3.5 px-6 rounded-2xl text-xs cursor-pointer select-none transition-all shadow-lg active:scale-[0.98] duration-200"
              >
                <span>الخيار 1: إقران مباشر بدون نوافذ منبثقة (موصى به)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              
              <button
                disabled={loading}
                onClick={handleStartPopupAuth}
                className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold py-3 rounded-2xl cursor-pointer transition-colors"
              >
                <span>الخيار 2: المتابعة عبر النوافذ المنبثقة البديلة</span>
              </button>
            </div>
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
            
            <div className="space-y-2 pt-2">
              <button
                onClick={handleStartRedirectAuth}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold py-2.5 rounded-xl text-xs cursor-pointer transition-all"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>إعادة المحاولة عبر تسجيل الدخول المباشر</span>
              </button>
              <button
                onClick={handleStartPopupAuth}
                className="w-full bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 text-slate-300 py-2 rounded-xl text-xs transition-colors cursor-pointer"
              >
                إعادة المحاولة بالنوافذ المنبثقة
              </button>
            </div>
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
        {!success && !isUnauthorizedDomainError && !error && (
          <div className="space-y-3 pt-2">
            <button
              disabled={loading}
              onClick={handleStartRedirectAuth}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#22c55e] to-[#10b981] hover:from-[#4ade80] hover:to-[#34d399] disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 text-white font-extrabold py-4 px-6 rounded-2xl text-xs cursor-pointer select-none transition-all shadow-lg active:scale-[0.98] duration-200"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-300 border-t-white rounded-full animate-spin"></div>
                  <span>جاري تسجيل الدخول بالتحويل...</span>
                </>
              ) : (
                <span>المتابعة وتسجيل الدخول بحساب جوجل</span>
              )}
            </button>
            
            <p className="text-[10px] text-slate-500 text-center leading-relaxed">
              طريقة التحويل المباشر هي الأكثر أماناً واستقراراً وتتفادى حظر النوافذ في جميع المتصفحات والهواتف.
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="text-center pt-2">
          <span className="text-[10px] text-slate-500 font-mono">
            Mawrid Security Gate &bull; v1.3
          </span>
        </div>

      </div>
    </div>
  );
}
