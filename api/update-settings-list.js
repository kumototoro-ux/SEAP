// api/update-settings-list.js
// =====================================================================
// يعادل updateSettingsList() بـGAS — يستبدل كل قيم قائمة معيّنة (مثلاً
// كل "الفروع") دفعة واحدة. أدمن فقط.
// =====================================================================

import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { apiHandler } from '../lib/apiHandler.js';
import { validateBody, updateSettingsListSchema } from '../lib/validation.js';

export default apiHandler(async function updateSettingsList(req, res) {
  if (req.method !== 'POST') {
    const err = new Error('الطريقة غير مسموحة');
    err.statusCode = 405;
    throw err;
  }

  const user = requireAuth(req);
  requireRole(user, ['role_admin']);

  const { listKey, values } = validateBody(updateSettingsListSchema, req.body);

  // 🆕 حذف القيم القديمة لهذي القائمة ثم إدخال الجديدة دفعة واحدة —
  // أبسط وأضمن من محاولة مقارنة الفروقات يدوياً (Diff) كما كان بـGAS
  const { error: deleteError } = await supabaseAdmin.from('settings_lists').delete().eq('list_key', listKey);
  if (deleteError) throw deleteError;

  const rows = values.map((value, index) => ({ list_key: listKey, value, sort_order: index }));
  const { error: insertError } = await supabaseAdmin.from('settings_lists').insert(rows);
  if (insertError) throw insertError;

  await supabaseAdmin.from('audit_log').insert({
    emp_id: user.id, emp_name: user.fullName, role: user.role,
    action: 'تحديث قائمة إعدادات', details: { listKey, count: values.length }, branch: user.branch,
  });

  return res.status(200).json({ success: true, data: true });
});