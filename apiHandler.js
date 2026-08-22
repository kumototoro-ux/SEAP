// lib/apiHandler.js
// =====================================================================
// غلاف واحد لكل دوال API — يوحّد: تنسيق الأخطاء، رموز الحالة (Status
// Codes)، السجلّ بالخادم (Logging)، وضمان أن أي خطأ غير متوقّع لا
// يُسرّب تفاصيل حساسة للمستخدم النهائي (Stack Trace مثلاً).
//
// الاستخدام بأي دالة API قادمة:
//   export default apiHandler(async (req, res) => { ... منطقك هنا ... });
// =====================================================================

export function apiHandler(fn) {
  return async function (req, res) {
    try {
      await fn(req, res);
    } catch (e) {
      const statusCode = e.statusCode || 500;
      // 🆕 نسجّل التفاصيل الكاملة بسجلّات Vercel (تظهر بلوحة التحكم فقط)،
      // لكن لا نُرسِل للمستخدم إلا رسالة آمنة ومفهومة
      console.error(`[API Error] ${req.url}:`, e);

      const safeMessage = statusCode === 500
        ? 'حدث خطأ غير متوقع بالخادم، حاول لاحقاً'
        : e.message;

      return res.status(statusCode).json({ success: false, message: safeMessage });
    }
  };
}
