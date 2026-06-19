import { useState, useEffect } from "react";
import { googleSignIn, googleSignInRedirect, handleRedirectResult } from "../firebase";
import { 
  Cloud, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldCheck, 
  HelpCircle, 
  Copy, 
  Check, 
  ArrowRight, 
  RefreshCw,
  Sparkles,
  Info,
  XCircle,
  Smartphone,
  Navigation
} from "lucide-react";

export default function AuthHelper() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedDomain, setCopiedDomain] = useState<string | null>(null);
  const [lastAttemptTime, setLastAttemptTime] = useState<number>(0);

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
    setLastAttemptTime(Date.now());
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
    setLastAttemptTime(Date.now());
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

  const handleForceClearCache = () => {
    setLoading(true);
    localStorage.removeItem("mawrid_gdrive_auth");
    sessionStorage.clear();
    setError(null);
    
    // Refresh the inner iframe states if possible by reloading
    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

  const isUnauthorizedDomainError = error === "unauthorized-domain" || lastAttemptTime > 0;

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 flex flex-col items-center justify-center p-4 md:p-6 text-right font-sans selection:bg-sky-500/20" dir="rtl">
      {/* Decorative gradient glowing spots */}
      <div className="absolute top-10 right-10 w-96 h-96 bg-sky-500/5 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-10 left-10 w-96 h-96 bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none"></div>

      <div className={`w-full max-w-2xl bg-[#0b1329]/90 border border-slate-800/90 p-6 md:p-8 rounded-3xl shadow-2xl relative z-10 backdrop-blur-md space-y-6 transition-all duration-300`}>
        
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
          <span className="text-[10px] font-bold tracking-widest text-sky-400 uppercase bg-sky-500/10 border border-sky-500/20 px-2.5 py-1 rounded-full">بوابة تفعيل ومزامنة مَورِد</span>
          <h2 className="text-xl font-extrabold text-white tracking-tight pt-1">
            "حدث خطأ أثناء الربط: Error (auth/unauthorized-domain)"
          </h2>
          <p className="text-xs text-slate-400 max-w-lg mx-auto leading-relaxed">
            يطلب نظام التحقق من الهوية Google & Firebase تسجيل نطاقات الإقران الحالية كـ "نطاقات مصرح بها" لحماية حسابك وحفظ نسخك الاحتياطية بأمان.
          </p>
        </div>

        {/* Status Blocks */}
        {success ? (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-6 text-center space-y-3 animate-fadeIn">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
            <p className="text-base font-bold text-emerald-300">تم تسجيل الدخول والربط بنجاح تام!</p>
            <p className="text-xs text-slate-300 font-mono select-all break-all bg-emerald-950/40 py-2 px-4 rounded-xl border border-emerald-500/20 max-w-md mx-auto">
              {userEmail}
            </p>
            <p className="text-xs text-slate-400">يجري حفظ ترخيص المزامنة وإغلاق هذا الإقران تلقائياً...</p>
          </div>
        ) : (
          <div className="space-y-6 animate-fadeIn">
            
            {/* IMPORTANT RULES FOR FORMAT (TO PREVENT THE POPULAR USER TYPO) */}
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 md:p-5 space-y-3.5">
              <div className="flex items-center gap-2 border-b border-rose-500/10 pb-2">
                <Info className="w-5 h-5 text-rose-400 shrink-0" />
                <h3 className="font-extrabold text-sm text-rose-300">⚠️ تنبيه أمني هام جداً (تجنّب الخطأ الشائع):</h3>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                عند إضافة النطاقات في صفحة Firebase، **يجب كتابتها بالنص الصحيح والامتناع تماماً عن إضافة بادئة الرابط أو علامة مائلة في النهاية.** إضافة رابط كامل سيسبب استمرار ظهور نفس الخطأ ولن تنجح المحاولة!
              </p>

              {/* Format Guide Table */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <div className="bg-slate-950/40 border border-rose-500/20 p-3 rounded-xl space-y-1.5">
                  <div className="flex items-center gap-1.5 text-rose-400 font-bold text-xs">
                    <XCircle className="w-4 h-4" />
                    <span>❌ أمثلة خاطئة (تجنبها تماماً):</span>
                  </div>
                  <ul className="text-[11px] text-slate-400 space-y-1 font-mono break-all list-disc list-inside text-left">
                    <li>https://{devDomain}/</li>
                    <li>https://{devDomain}</li>
                    <li>{devDomain}/</li>
                  </ul>
                </div>

                <div className="bg-emerald-500/5 border border-emerald-500/20 p-3 rounded-xl space-y-1.5">
                  <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-xs">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>✅ الشكل الصحيح والمقبول فقط:</span>
                  </div>
                  <ul className="text-[11px] text-slate-200 space-y-1 font-mono break-all list-disc list-inside text-left">
                    <li>{devDomain}</li>
                    <li>{preDomain}</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Quick Steps */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 md:p-5 text-xs text-slate-300 space-y-3.5">
              <h3 className="font-bold text-white text-sm border-b border-slate-800/80 pb-2 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-sky-400" />
                <span>كيفية إضافة النطاقات في Firebase الآن:</span>
              </h3>
              
              <ol className="list-decimal list-inside space-y-2 leading-relaxed text-right text-slate-300">
                <li>
                  املأ لوحة تحكم مشروعك <span className="text-sky-400 font-bold font-mono">vibrant-continuity-5fbwx</span> بزيارة موقع <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer" className="text-sky-400 underline hover:text-sky-300 font-bold">Firebase Console ↗</a>
                </li>
                <li>
                  اختر قسم <span className="text-white font-bold">Authentication</span> ثم اضغط تبويب <span className="text-white font-bold">Settings (الإعدادات)</span> في الأعلى.
                </li>
                <li>
                  من القائمة الجانبية للإعدادات، اختر <span className="text-white font-bold">Authorized domains</span>.
                </li>
                <li>
                  اضغط على زر <span className="text-sky-400 font-bold">Add domain (إضافة نطاق)</span> وألصق النطاقين التاليين (انسخ واحداً تلو الآخر عبر الأزرار):
                </li>
              </ol>

              {/* Copy Widgets */}
              <div className="space-y-2 pt-2">
                {/* Dev domain */}
                <div className="flex items-center justify-between bg-slate-950/90 border border-slate-800 p-2.5 rounded-xl">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] bg-sky-500/10 text-sky-400 border border-sky-500/20 px-1.5 py-0.5 rounded font-mono">1</span>
                    <span className="font-mono text-[11px] select-all break-all text-slate-200">{devDomain}</span>
                  </div>
                  <button 
                    onClick={() => copyToClipboard(devDomain)}
                    className="p-1.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-sky-400 rounded-lg transition-all cursor-pointer flex items-center gap-1"
                    title="نسخ النطاق"
                  >
                    {copiedDomain === devDomain ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-[10px] text-emerald-400">تم النسخ!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span className="text-[10px]">نسخ النطاق</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Pre domain */}
                <div className="flex items-center justify-between bg-slate-950/90 border border-slate-800 p-2.5 rounded-xl">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] bg-sky-500/10 text-sky-400 border border-sky-500/20 px-1.5 py-0.5 rounded font-mono">2</span>
                    <span className="font-mono text-[11px] select-all break-all text-slate-200">{preDomain}</span>
                  </div>
                  <button 
                    onClick={() => copyToClipboard(preDomain)}
                    className="p-1.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-sky-400 rounded-lg transition-all cursor-pointer flex items-center gap-1"
                    title="نسخ النطاق"
                  >
                    {copiedDomain === preDomain ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-[10px] text-emerald-400">تم النسخ!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span className="text-[10px]">نسخ النطاق</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* CACHING WORKAROUNDS AND SOLUTIONS */}
            <div className="bg-sky-500/10 border border-sky-500/20 rounded-2xl p-4 md:p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-sky-400 shrink-0" />
                <h4 className="font-extrabold text-sm text-sky-300">💡 حل مشكلة التخزين المؤقت (الحل السحري الفوري):</h4>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                يقوم متصفح Google Chrome ومتصفحات الويب الأخرى بحفظ حالة التحقق من الهوية القديمة (الكاش) في ذاكرة المتصفح لمدة تصل إلى نصف ساعة. لذلك، حتى بعد إضافتك النطاقات بشكل صحيح، قد يستمر المتصفح في إخبارك بنفس الخطأ. لترقية والالتفاف على هذا وبدء المزامنة فوراً:
              </p>
              
              <div className="bg-slate-950/50 p-3.5 rounded-xl border border-sky-500/10 space-y-2">
                <p className="text-xs font-bold text-white">افتح صفحة البرنامج في وضع التصفح المتخفي (Incognito / Private Window):</p>
                <div className="text-[11px] text-slate-400 space-y-1.5 leading-relaxed">
                  <p>1. انسخ رابط صفحة "مورِد" الرئيسية في متصفحك.</p>
                  <p>2. افتح نافذة تصفح متخفية جديدة (افتح القائمة واضغط على <span className="text-sky-300 font-bold">New Incognito Window</span>).</p>
                  <p>3. ألصق الرابط وسجل الدخول هناك ثم اضغط على زر ربط حساب جوجل وسيعمل معك فوراً في ثانية واحدة!</p>
                </div>
              </div>

              {/* Force Clear Cache Button */}
              <div className="pt-1 flex justify-end">
                <button
                  onClick={handleForceClearCache}
                  disabled={loading}
                  className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 text-slate-300 text-[11px] py-1.5 px-3 rounded-lg transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
                  <span>تحديث الصفحة ومسح ذاكرة الكاش محلياً</span>
                </button>
              </div>
            </div>

            {/* Error Indicator (If any) */}
            {error && error !== "unauthorized-domain" && (
              <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 text-xs text-rose-300 space-y-1">
                <p className="font-bold text-rose-400">حدث خطأ آخر أثناء تسجيل الدخول:</p>
                <p className="font-mono bg-rose-950/20 p-2 rounded-lg border border-rose-500/10 select-all break-all">
                  {error}
                </p>
              </div>
            )}

            {/* Action Buttons to Login */}
            <div className="pt-2 space-y-3">
              <div className="text-center">
                <p className="text-[11px] text-slate-400 font-semibold mb-2 flex items-center justify-center gap-1.5">
                  <Navigation className="w-3.5 h-3.5 text-emerald-400" />
                  <span>اضغط على أحد الخيارات أدناه بعد إضافة وتأكيد النطاقات:</span>
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                  disabled={loading}
                  onClick={handleStartRedirectAuth}
                  className="w-full flex flex-col items-center justify-center gap-1 bg-gradient-to-br from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.98] text-white font-extrabold py-3.5 px-6 rounded-2xl shadow-lg transition-all duration-200 cursor-pointer text-xs"
                >
                  <span className="font-extrabold">الخيار 1: إقران مباشر بدون منبثقات</span>
                  <span className="text-[10px] text-teal-100 font-normal opacity-90">موصى به في متصفحات الجوال وسفاري</span>
                </button>

                <button
                  disabled={loading}
                  onClick={handleStartPopupAuth}
                  className="w-full flex flex-col items-center justify-center gap-1 bg-gradient-to-br from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 active:scale-[0.98] text-white font-extrabold py-3.5 px-6 rounded-2xl shadow-lg transition-all duration-200 cursor-pointer text-xs"
                >
                  <span className="font-extrabold">الخيار 2: استخدام النافذة المنبثقة</span>
                  <span className="text-[10px] text-sky-100 font-normal opacity-90">دخول سريع عبر نافذة منفصلة</span>
                </button>
              </div>

              {loading && (
                <div className="flex items-center justify-center gap-2 text-xs text-sky-400 py-2">
                  <div className="w-4 h-4 border-2 border-sky-400 border-t-transparent rounded-full animate-spin"></div>
                  <span>يجري الاتصال والتحقق مع خوادم جوجل...</span>
                </div>
              )}
            </div>

          </div>
        )}

        {/* Footer */}
        <div className="text-center pt-2 border-t border-slate-900/60 flex items-center justify-between text-[10px] text-slate-500 select-none">
          <span>نظام بوابة الأمان المورد</span>
          <span className="font-mono">Mawrid Security Gate &bull; v1.4</span>
        </div>

      </div>
    </div>
  );
}
