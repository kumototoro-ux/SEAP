// api/list-employees.js
// =====================================================================
// يعادل listEmployees() بملف Employees.gs — أي مستخدم مسجَّل دخوله
// يقدر يستدعيها (نطاق الفرع سيُضاف لاحقاً عند بناء أدوار أخرى غير الأدمن)
// =====================================================================

import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { requireAuth } from '../lib/auth.js';
import { apiHandler } from '../lib/apiHandler.js';

export default apiHandler(async function listEmployees(req, res) {
  if (req.method !== 'GET') {
    const err = new Error('الطريقة غير مسموحة');
    err.statusCode = 405;
    throw err;
  }

  requireAuth(req);

  const { data, error } = await supabaseAdmin
    .from('employees')
    .select('id, national_id, name_ar, name_en, user_type, role, gender, branch, stage, grades, sections, subjects, created_at')
    .order('created_at', { ascending: false });

  if (error) throw error;

  return res.status(200).json({ success: true, data });
});
