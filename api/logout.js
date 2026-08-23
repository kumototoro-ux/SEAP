// api/logout.js
// =====================================================================
// 🆕 تحوّل معماري بسيط عن GAS: كان logout() يمسح الجلسة من CacheService
// يدوياً. الآن بما أن JWT بلا حالة خادمية (Stateless)، لا يوجد شيء
// "نمسحه" فعلياً بالخادم — إبطال الجلسة يحصل بجهة العميل فقط (حذف
// التوكن من التخزين المحلي بالمتصفح). هذي الدالة موجودة فقط للتناسق
// ولإتاحة نقطة توسّع مستقبلية (قائمة حظر توكنات مثلاً، لو احتجناها).
// =====================================================================

import { apiHandler } from '../lib/apiHandler.js';

export default apiHandler(async function logout(req, res) {
  if (req.method !== 'POST') {
    const err = new Error('الطريقة غير مسموحة');
    err.statusCode = 405;
    throw err;
  }
  return res.status(200).json({ success: true, data: true });
});