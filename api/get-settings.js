// api/get-settings.js
// =====================================================================
// يعادل بالضبط getSettingsCached() بـGAS — بلا مصادقة إلزامية (صفحة
// الدخول نفسها تحتاجها قبل أي تسجيل دخول لعرض اسم المدرسة والشعار).
// =====================================================================

import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { apiHandler } from '../lib/apiHandler.js';

// تحويل مفاتيح settings_lists (snake_case بقاعدة البيانات) لنفس الأسماء
// اللي كانت الواجهة الأمامية تتوقعها بـGAS (camelCase)
const LIST_KEY_MAP = {
  branches: 'branches',
  stages: 'stages',
  grades: 'grades',
  sections: 'sections',
  subjects: 'subjects',
  user_types: 'userTypes',
  roles: 'roles',
  account_statuses: 'accountStatuses',
  attendance_statuses: 'attendanceStatuses',
  terms: 'terms',
  behavior_statuses: 'behaviorStatuses',
  continuous_eval_types: 'continuousEvalTypes',
  exams: 'exams',
};

export default apiHandler(async function getSettings(req, res) {
  if (req.method !== 'GET') {
    const err = new Error('الطريقة غير مسموحة');
    err.statusCode = 405;
    throw err;
  }

  const [{ data: siteSettings, error: siteError }, { data: listRows, error: listError }] = await Promise.all([
    supabaseAdmin.from('site_settings').select('school_name, logo_url').single(),
    supabaseAdmin.from('settings_lists').select('list_key, value').order('sort_order'),
  ]);

  if (siteError) throw siteError;
  if (listError) throw listError;

  const grouped = {};
  Object.values(LIST_KEY_MAP).forEach((camelKey) => { grouped[camelKey] = []; });
  listRows.forEach((row) => {
    const camelKey = LIST_KEY_MAP[row.list_key];
    if (camelKey) grouped[camelKey].push(row.value);
  });

  return res.status(200).json({
    success: true,
    data: {
      schoolName: siteSettings.school_name,
      logoUrl: siteSettings.logo_url,
      ...grouped,
    },
  });
});

