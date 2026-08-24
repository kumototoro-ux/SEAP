// api/audit-log.js
// =====================================================================
// عرض سجل تتبّع كل العمليات الحساسة بالنظام (إضافة/تعديل/حذف/تغيير
// صلاحيات...) — للقراءة فقط، أدمن فقط. كل الكتابة لهذا الجدول تحصل
// تلقائياً من داخل باقي الملفات (audit_log.insert بكل عملية حساسة).
// =====================================================================

import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { createRouter } from '../lib/router.js';

async function handleList(req, res) {
  const user = requireAuth(req);
  requireRole(user, ['role_admin']);

  const { data, error } = await supabaseAdmin
    .from('audit_log')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(300);

  if (error) throw error;
  return res.status(200).json({ success: true, data });
}

export default createRouter({
  list: handleList,
});
