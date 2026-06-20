import { useState, useEffect } from "react";
import { googleSignIn, googleSignInRedirect, handleRedirectResult, activeFirebaseConfig } from "../firebase";
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

  const [configText, setConfigText] = useState("");
  const [showConfigEditor, setShowConfigEditor] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [isCustomConfigActive, setIsCustomConfigActive] = useState(false);

  useEffect(() => {
    const custom = localStorage.getItem("mawrid_custom_firebase_config");
    setIsCustomConfigActive(!!custom);
    if (custom) {
      try {
        setConfigText(JSON.stringify(JSON.parse(custom), null, 2));
      } catch (e) {
        setConfigText(custom);
      }
    }
  }, []);

  const handleSaveCustomConfig = () => {
    setConfigError(null);
    if (!configText.trim()) {
      setConfigError("يرجى إدخال إعدادات مشروع Firebase أولاً.");
      return;
    }

    try {
      let parsed: any = null;
      let cleaned = configText.trim();
      
      // If it looks like a JavaScript object instead of strict JSON (e.g., keys are not in double quotes)
      // or starts with 'const firebaseConfig ='
      if (!cleaned.startsWith("{")) {
        const match = cleaned.match(/\{[\s\S]*\}/);
        if (match) {
          cleaned = match[0];
        }
      }

      // Pre-process and normalize smart quotes and general characters
      let extracted = cleaned
        .replace(/[\u201c\u201d\u201e\u201f]/g, '"') // smart double quotes
        .replace(/[\u2018\u2019\u201a\u201b]/g, '"') // smart single quotes
        .replace(/'/g, '"'); // single quotes to double quotes

      // Auto-repair missing commas before subsequent keys
      extracted = extracted
        .replace(/(")\s*\n\s*([\w"]+)\s*:/g, '",\n  $2:') // e.g. "val" \n key: -> "val", \n key:
        .replace(/(')\s*\n\s*([\w"]+)\s*:/g, "',\n  $2:")
        .replace(/(\d+)\s*\n\s*([\w"]+)\s*:/g, "$1,\n  $2:"); // e.g. 123 \n key: -> 123, \n key:

      // Convert standard JS object syntax to valid JSON by quoting unquoted keys
      let jsonStr = extracted
        .replace(/(\w+)\s*:/g, '"$1":') // Quote unquoted keys
        .replace(/,\s*}/g, "}"); // Remove trailing commas
      
      try {
        parsed = JSON.parse(jsonStr);
      } catch (err1) {
        // Fallback: Use safe evaluation inside `new Function` if standard JSON parsing fails
        try {
          const safeEval = new Function(`return (${extracted});`);
          parsed = safeEval();
        } catch (err2) {
          throw err1; // Throw original JSON parse error as it contains line/col info
        }
      }

      const requiredKeys = ["apiKey", "projectId", "authDomain", "appId"];
      const missingKeys = requiredKeys.filter(k => !parsed[k]);
      if (missingKeys.length > 0) {
        throw new Error(`مشروع Firebase غير كامل. ينقصه الحقول التالية: ${missingKeys.join(", ")}`);
      }

      localStorage.setItem("mawrid_custom_firebase_config", JSON.stringify(parsed));
      setError(null);
      alert("تم حفظ إعدادات مشروعك بنجاح! سيتم الآن إعادة تحميل الصفحة لتطبيق الإعدادات الجديدة والمزامنة.");
      window.location.reload();
    } catch (e: any) {
      console.error(e);
      setConfigError(`فشل تحليل الإعدادات. يرجى التأكد من نسخ كود الـ JSON أو كود الإعدادات بشكل كامل وصحيح: ${e.message}`);
    }
  };

  const handleResetToDefaultConfig = () => {
    if (window.confirm("هل أنت متأكد من العودة إلى مشروع Firebase الافتراضي للتطبيق؟")) {
      localStorage.removeItem("mawrid_custom_firebase_config");
      window.location.reload();
    }
  };

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
    <div className="min-h-screen bg-[#020617] text-slate-100 flex flex-col items-center justify-center p-4 md:p-6 text-right font-sans selection:bg-emerald-500/20" dir="rtl">
      {/* Decorative gradient glowing spots */}
      <div className="absolute top-10 right-10 w-96 h-96 bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-10 left-10 w-96 h-96 bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none"></div>

      <div className={`w-full max-w-2xl bg-[#0b1329]/90 border border-slate-800/90 p-6 md:p-8 rounded-3xl shadow-2xl relative z-10 backdrop-blur-md space-y-6 transition-all duration-300`}>
        
        {/* Header Icon */}
        <div className="flex justify-center">
          <div className="relative">
            <div className={`absolute inset-0 ${isUnauthorizedDomainError ? "bg-amber-500/20" : "bg-emerald-500/20"} rounded-full blur-xl animate-pulse`}></div>
            <div className="relative bg-slate-900 border border-slate-700/60 p-5 rounded-2xl flex items-center justify-center">
              {isUnauthorizedDomainError ? (
                <AlertTriangle className="w-10 h-10 text-amber-400 animate-bounce" />
              ) : (
                <Cloud className="w-10 h-10 text-emerald-400" />
              )}
            </div>
          </div>
        </div>

        {/* Title and Intro */}
        <div className="text-center space-y-2">
          <span className="text-[10px] font-bold tracking-widest text-emerald-400 uppercase bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">بوابة تفعيل ومزامنة مَورِد</span>
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
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span>كيفية إضافة النطاقات في Firebase الآن:</span>
              </h3>
              
              <ol className="list-decimal list-inside space-y-2 leading-relaxed text-right text-slate-300">
                <li>
                  املأ لوحة تحكم مشروعك <span className="text-emerald-400 font-bold font-mono">vibrant-continuity-5fbwx</span> بزيارة موقع <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer" className="text-emerald-400 underline hover:text-emerald-300 font-bold">Firebase Console ↗</a>
                </li>
                <li>
                  اختر قسم <span className="text-white font-bold">Authentication</span> ثم اضغط تبويب <span className="text-white font-bold">Settings (الإعدادات)</span> في الأعلى.
                </li>
                <li>
                  من القائمة الجانبية للإعدادات، اختر <span className="text-white font-bold">Authorized domains</span>.
                </li>
                <li>
                  اضغط على زر <span className="text-emerald-400 font-bold">Add domain (إضافة نطاق)</span> وألصق النطاقين التاليين (انسخ واحداً تلو الآخر عبر الأزرار):
                </li>
              </ol>

              {/* Copy Widgets */}
              <div className="space-y-2 pt-2">
                {/* Dev domain */}
                <div className="flex items-center justify-between bg-slate-950/90 border border-slate-800 p-2.5 rounded-xl">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded font-mono">1</span>
                    <span className="font-mono text-[11px] select-all break-all text-slate-200">{devDomain}</span>
                  </div>
                  <button 
                    onClick={() => copyToClipboard(devDomain)}
                    className="p-1.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-emerald-400 rounded-lg transition-all cursor-pointer flex items-center gap-1"
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
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded font-mono">2</span>
                    <span className="font-mono text-[11px] select-all break-all text-slate-200">{preDomain}</span>
                  </div>
                  <button 
                    onClick={() => copyToClipboard(preDomain)}
                    className="p-1.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-emerald-400 rounded-lg transition-all cursor-pointer flex items-center gap-1"
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
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 md:p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-400 shrink-0" />
                <h4 className="font-extrabold text-sm text-emerald-300">💡 حل مشكلة التخزين المؤقت (الحل السحري الفوري):</h4>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                يقوم متصفح Google Chrome ومتصفحات الويب الأخرى بحفظ حالة التحقق من الهوية القديمة (الكاش) في ذاكرة المتصفح لمدة تصل إلى نصف ساعة. لذلك، حتى بعد إضافتك النطاقات بشكل صحيح، قد يستمر المتصفح في إخبارك بنفس الخطأ. لترقية والالتفاف على هذا وبدء المزامنة فوراً:
              </p>
              
              <div className="bg-slate-950/50 p-3.5 rounded-xl border border-emerald-500/10 space-y-2">
                <p className="text-xs font-bold text-white">افتح صفحة البرنامج في وضع التصفح المتخفي (Incognito / Private Window):</p>
                <div className="text-[11px] text-slate-400 space-y-1.5 leading-relaxed">
                  <p>1. انسخ رابط صفحة "مورِد" الرئيسية في متصفحك.</p>
                  <p>2. افتح نافذة تصفح متخفية جديدة (افتح القائمة واضغط على <span className="text-emerald-300 font-bold">New Incognito Window</span>).</p>
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

            {/* DYNAMIC FIREBASE CONFIG EDIT MODULE - FOR USERS WHO ENCOUNTER DOMAIN ERRORS OUT OF USER CONTROL */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 md:p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-indigo-400 shrink-0" />
                  <h4 className="font-extrabold text-sm text-indigo-300">هل تواجه خطأ النطاق غير المصرح به بالرغم من إضافته؟</h4>
                </div>
                <button
                  onClick={() => setShowConfigEditor(!showConfigEditor)}
                  className="text-[11px] bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/20 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                >
                  {showConfigEditor ? "إخفاء لوحة الإعدادات" : "عرض حلول متقدمة إضافية"}
                </button>
              </div>

              {showConfigEditor && (
                <div className="space-y-3.5 animate-fadeIn">
                  <p className="text-xs text-slate-300 leading-relaxed">
                    يستخدم هذا التطبيق حالياً معرّف مشروع افتراضي هو: <span className="font-mono font-bold text-emerald-400 bg-emerald-500/5 px-1.5 py-0.5 rounded border border-emerald-500/10">{activeFirebaseConfig.projectId}</span>.
                    <br />
                    إذا كانت لوحة تحكم Firebase التي أضفت إليها النطاق تملك معرّف مشروع مختلفاً، فهذا هو السبب الرئيسي لعدم المزامنة! يمكنك ربط التطبيق بمشروعك الخاص مباشرة وإزالة الخطأ للأبد.
                  </p>

                  <div className="bg-slate-950/80 p-3.5 rounded-xl border border-indigo-500/10 space-y-3">
                    <div className="bg-[#0c162d] border border-slate-800 p-4 rounded-xl space-y-4 font-sans text-xs">
                      <span className="font-bold text-emerald-400 block border-b border-slate-800 pb-2">📂 دليل خطوة بخطوة بالصور التعبيرية للوصول للكود:</span>
                      
                      <div className="space-y-3 leading-relaxed text-slate-300">
                        <div className="flex gap-2 items-start">
                          <span className="w-5 h-5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold font-mono text-[11px] shrink-0">1</span>
                          <p>
                            افتح منصة <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer" className="text-emerald-400 font-bold underline hover:text-emerald-300">Firebase Console ↗</a> واضغط على <strong>مشروعك</strong>.
                          </p>
                        </div>

                        <div className="flex gap-2 items-start">
                          <span className="w-5 h-5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold font-mono text-[11px] shrink-0">2</span>
                          <p>
                            في القائمة الجانبية باليمين/اليسار، اضغط على أيقونة <strong>الترس (Gear) ⚙️</strong> بجانب كلمة "Project Overview" ثم اختر <strong>Project settings (إعدادات المشروع)</strong>.
                          </p>
                        </div>

                        <div className="flex gap-2 items-start">
                          <span className="w-5 h-5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold font-mono text-[11px] shrink-0">3</span>
                          <div>
                            <p>
                              تأكد أنك في التبويب الأول <strong>General (عام)</strong>، ثم انزل لآخر الصفحة تماماً حتى تجد قسماً يسمى <strong>Your apps (تطبيقاتك)</strong>.
                            </p>
                            <div className="mt-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-[11px] text-amber-300 space-y-1.5 list-none font-sans">
                              <p className="font-bold flex items-center gap-1">⚠️ إذا رأيت رسالة "There are no apps in your project" (مشروعك لا يحتوي على أي تطبيقات):</p>
                              <ul className="list-decimal list-inside space-y-1 pr-1 text-slate-350">
                                <li>اضغط على أيقونة <strong>الويب <code className="bg-slate-900 px-1.5 py-0.5 rounded text-emerald-400 font-mono font-bold">&lt;/&gt;</code></strong> (الدائرة الثالثة في المنتصف التي تظهر في الصورة لديك).</li>
                                <li>اكتب اسماً لتطبيقك الجديد (مثلاً: <code className="bg-slate-900 px-1.5 py-0.5 rounded text-pink-400 font-mono">mawrid-app</code>) ثم اضغط على زر <strong>Register app</strong> الأزرق.</li>
                                <li>ستظهر لك شاشة الكود فوراً وبها الكائن الذي تبحث عنه!</li>
                              </ul>
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-2 items-start">
                          <span className="w-5 h-5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold font-mono text-[11px] shrink-0">4</span>
                          <p>
                            اضغط على خيار <strong>Config</strong> أو حدد الدائرة المسماة <strong>NPM</strong>، ستظهر لك كود وستجد داخله كائن الإعدادات بالشكل التالي تماماً:
                          </p>
                        </div>

                        <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800 font-mono text-[11px] text-slate-400 space-y-1 block max-w-full overflow-x-auto text-left" dir="ltr">
                          <p className="text-slate-500">// انسخ الكود الذي يشبه هذا وضعه في المربع بالأسفل:</p>
                          <p><span className="text-emerald-400">const</span> <span className="text-pink-400">firebaseConfig</span> = {"{"}</p>
                          <p>&nbsp;&nbsp;apiKey: <span className="text-emerald-400">"AIzaSy..."</span>,</p>
                          <p>&nbsp;&nbsp;authDomain: <span className="text-emerald-400">"..."</span>,</p>
                          <p>&nbsp;&nbsp;projectId: <span className="text-emerald-400">"..."</span>,</p>
                          <p>&nbsp;&nbsp;storageBucket: <span className="text-emerald-400">"..."</span>,</p>
                          <p>&nbsp;&nbsp;appId: <span className="text-emerald-400">"..."</span></p>
                          <p>{"};"}</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 pt-2">
                      <label className="block text-xs font-black text-emerald-400 flex items-center gap-1.5">
                        <span>✍️ ألصق الكود المنسوخ هنا في هذا المربع (المستطيل):</span>
                      </label>
                      <textarea
                        rows={7}
                        dir="ltr"
                        className="w-full bg-slate-900 border-2 border-emerald-500/50 rounded-xl p-3 text-xs font-mono text-white placeholder-slate-500 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/30 focus:outline-none text-left"
                        placeholder={`ألصق الكود هنا، مثال:
{
  "apiKey": "AIzaSy...",
  "authDomain": "...",
  "projectId": "...",
  "appId": "..."
}`}
                        value={configText}
                        onChange={(e) => setConfigText(e.target.value)}
                      />
                    </div>

                    {configError && (
                      <p className="text-xs text-rose-400 font-bold">{configError}</p>
                    )}

                    <div className="flex gap-2 pt-1.5">
                      <button
                        onClick={handleSaveCustomConfig}
                        className="flex-grow bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-2 px-4 rounded-lg transition-colors cursor-pointer"
                      >
                        حفظ إعدادات مشروعي وإعادة تحميل التطبيق
                      </button>

                      {isCustomConfigActive && (
                        <button
                          onClick={handleResetToDefaultConfig}
                          className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 text-xs font-bold py-2 px-3 rounded-lg transition-colors cursor-pointer"
                        >
                          إرجاع المشروع الافتراضي
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Error Indicator (If any) */}
            {error && error !== "unauthorized-domain" && (
              <div className="space-y-4">
                <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 text-xs text-rose-300 space-y-1">
                  <p className="font-bold text-rose-400">حدث خطأ آخر أثناء تسجيل الدخول:</p>
                  <p className="font-mono bg-rose-950/20 p-2 rounded-lg border border-rose-500/10 select-all break-all text-left" dir="ltr">
                    {error}
                  </p>
                </div>

                {/* Specific guide for "auth/configuration-not-found" */}
                {String(error).toLowerCase().includes("configuration-not-found") && (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 md:p-5 space-y-4 text-right" dir="rtl">
                    <div className="flex items-center gap-2 border-b border-amber-500/20 pb-2">
                      <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                      <h4 className="font-extrabold text-sm text-amber-300">💡 الحل الفوري لخطأ "Configuration-not-found":</h4>
                    </div>
                    
                    <p className="text-xs text-slate-200 leading-relaxed font-sans">
                      هذا الخطأ يعني أنك لم تقم بتفعيل <strong>موفر تسجيل الدخول عبر Google (Google Sign-In)</strong> في منصة Firebase لمشروعك حتى الآن. لتفعيله في دقيقة واحدة، اتبع الخطوات التالية:
                    </p>

                    <div className="space-y-3 leading-relaxed text-[11px] text-slate-300">
                      <div className="flex gap-2 items-start">
                        <span className="w-4 h-4 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center justify-center font-bold font-mono shrink-0">1</span>
                        <p>
                          افتح منصة <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer" className="text-emerald-400 font-bold underline hover:text-emerald-300">Firebase Console ↗</a> واضغط على مشروعك.
                        </p>
                      </div>

                      <div className="flex gap-2 items-start">
                        <span className="w-4 h-4 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center justify-center font-bold font-mono shrink-0">2</span>
                        <p>
                          من القائمة الجانبية، اضغط على <strong>Build (بناء)</strong> ثم اختر <strong>Authentication</strong>.
                        </p>
                      </div>

                      <div className="flex gap-2 items-start">
                        <span className="w-4 h-4 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center justify-center font-bold font-mono shrink-0">3</span>
                        <p>
                          اضغط على تبويب <strong>Sign-in method (طريقة تسجيل الدخول)</strong> من التبويبات بالأعلى.
                        </p>
                      </div>

                      <div className="flex gap-2 items-start">
                        <span className="w-4 h-4 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center justify-center font-bold font-mono shrink-0">4</span>
                        <p>
                          اضغط على زر <strong>Add new provider (إضافة موفر جديد)</strong>، ثم اختر موفّر <strong>Google</strong> من القائمة.
                        </p>
                      </div>

                      <div className="flex gap-2 items-start">
                        <span className="w-4 h-4 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center justify-center font-bold font-mono shrink-0">5</span>
                        <p>
                          قم بتفعيل الخيار (تغيير المفتاح بالأعلى إلى <strong>Enable</strong>)، ثم اختر <strong>البريد الإلكتروني للدعم (Support email)</strong> الخاص بك من القائمة المنسدلة، واضغط على زر <strong>Save (حفظ)</strong> الأزرق بالأسفل.
                        </p>
                      </div>
                    </div>

                    <p className="text-[11px] text-emerald-400 bg-emerald-500/5 p-2 rounded-lg border border-emerald-500/10 font-bold text-center">
                      ✅ بعد الضغط على "Save" المباشر، ارجع هنا واضغط على أزرار تسجيل الدخول وسيعمل معك فوراً بنجاح!
                    </p>
                  </div>
                )}
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
                  className="w-full flex flex-col items-center justify-center gap-1 bg-gradient-to-br from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 font-extrabold pb-0.5 active:scale-[0.98] text-white font-extrabold py-3.5 px-6 rounded-2xl shadow-lg transition-all duration-200 cursor-pointer text-xs"
                >
                  <span className="font-extrabold">الخيار 1: إقران مباشر بدون منبثقات</span>
                  <span className="text-[10px] text-teal-100 font-normal opacity-90">موصى به في متصفحات الجوال وسفاري</span>
                </button>

                <button
                  disabled={loading}
                  onClick={handleStartPopupAuth}
                  className="w-full flex flex-col items-center justify-center gap-1 bg-gradient-to-br from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.98] text-white font-extrabold py-3.5 px-6 rounded-2xl shadow-lg transition-all duration-200 cursor-pointer text-xs"
                >
                  <span className="font-extrabold">الخيار 2: استخدام النافذة المنبثقة</span>
                  <span className="text-[10px] text-teal-100 font-normal opacity-90">دخول سريع عبر نافذة منفصلة</span>
                </button>
              </div>

              {loading && (
                <div className="flex items-center justify-center gap-2 text-xs text-emerald-400 py-2">
                  <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
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
