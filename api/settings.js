// api/settings.js
// =====================================================================
// إجراءات: { action: 'get' } (بلا مصادقة)، { action: 'updateList', listKey, values }،
// { action: 'updateSite', schoolName?, logoUrl? } — الأخيرتان أدمن فقط
// =====================================================================

import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { createRouter } from '../lib/router.js';
import { validateBody, updateSettingsListSchema, updateSiteSettingsSchema } from '../lib/validation.js';

const LIST_KEY_MAP = {
  branches: 'branches', stages: 'stages', grades: 'grades', sections: 'sections', subjects: 'subjects',
  user_types: 'userTypes', roles: 'roles', account_statuses: 'accountStatuses',
  attendance_statuses: 'attendanceStatuses', terms: 'terms', behavior_statuses: 'behaviorStatuses',
  continuous_eval_types: 'continuousEvalTypes', exams: 'exams',
};

/* -------------------- جلب الإعدادات (بلا مصادقة إلزامية) -------------------- */
async function handleGet(req, res) {
  const [{ data: siteSettings, error: siteError }, { data: listRows, error: listError }] = await Promise.all([
    supabaseAdmin.from('site_settings').select('school_name, logo_url, allow_message_images').single(),
    supabaseAdmin.from('settings_lists').select('list_key, value').order('sort_order'),
  ]);
  if (siteError) throw siteError;
  if (listError) throw listError;

  const grouped = {};
  Object.values(LIST_KEY_MAP).forEach((k) => { grouped[k] = []; });
  listRows.forEach((row) => {
    const camelKey = LIST_KEY_MAP[row.list_key];
    if (camelKey) grouped[camelKey].push(row.value);
  });

  return res.status(200).json({
    success: true,
    data: { schoolName: siteSettings.school_name, logoUrl: siteSettings.logo_url, allowMessageImages: siteSettings.allow_message_images || false, ...grouped },
  });
}

/* -------------------- تحديث قائمة إعدادات (أدمن فقط) -------------------- */
async function handleUpdateList(req, res) {
  const user = requireAuth(req);
  requireRole(user, ['role_admin']);
  const { listKey, values } = validateBody(updateSettingsListSchema, req.body);

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
}

/* -------------------- تحديث اسم/شعار المدرسة (أدمن فقط) -------------------- */
async function handleUpdateSite(req, res) {
  const user = requireAuth(req);
  requireRole(user, ['role_admin']);
  const updates = validateBody(updateSiteSettingsSchema, req.body);

  const dbUpdates = {};
  if (updates.schoolName !== undefined) dbUpdates.school_name = updates.schoolName;
  if (updates.logoUrl !== undefined) dbUpdates.logo_url = updates.logoUrl;
  if (updates.allowMessageImages !== undefined) dbUpdates.allow_message_images = updates.allowMessageImages; // 🆕
  if (Object.keys(dbUpdates).length === 0) {
    const err = new Error('لم يتم إرسال أي حقل للتحديث');
    err.statusCode = 400;
    throw err;
  }

  const { error } = await supabaseAdmin.from('site_settings').update(dbUpdates).eq('id', 1);
  if (error) throw error;
  return res.status(200).json({ success: true, data: true });
}

export default createRouter({
  get: handleGet,
  updateList: handleUpdateList,
  updateSite: handleUpdateSite,
});
