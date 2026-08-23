// api/delete-employee.js
// =====================================================================
// حذف موظف — أدمن فقط. حساب دخوله وأي فروع إضافية تُحذَف تلقائياً معه
// (ON DELETE CASCADE مُفعَّل بقاعدة البيانات، بلا حاجة لحذف يدوي بالكود)
// =====================================================================

import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { apiHandler } from '../lib/apiHandler.js';
import { z } from 'zod';
import { validateBody } from '../lib/validation.js';

export default apiHandler(async function deleteEmployee(req, res) {
  if (req.method !== 'POST') {
    const err = new Error('الطريقة غير مسموحة');
    err.statusCode = 405;
    throw err;
  }

  const user = requireAuth(req);
  requireRole(user, ['role_admin']);

  const { id } = validateBody(z.object({ id: z.string().min(1, 'رقم الموظف مطلوب') }), req.body);

  const { data: existing } = await supabaseAdmin.from('employees').select('id, name_ar').eq('id', id).maybeSingle();
  if (!existing) {
    const err = new Error('الموظف غير موجود');
    err.statusCode = 404;
    throw err;
  }

  const { error } = await supabaseAdmin.from('employees').delete().eq('id', id);
  if (error) throw error;

  await supabaseAdmin.from('audit_log').insert({
    emp_id: user.id, emp_name: user.fullName, role: user.role,
    action: 'حذف موظف', details: { employeeId: id, nameAr: existing.name_ar }, branch: user.branch,
  });

  return res.status(200).json({ success: true, data: true });
});
