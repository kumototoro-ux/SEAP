// api/reset-user-password.js
// =====================================================================
// إعادة تعيين كلمة مرور موظف لرقم هويته الأصلي (مُشفَّرة bcrypt) — أدمن فقط
// =====================================================================

import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { apiHandler } from '../lib/apiHandler.js';
import { validateBody, resetUserPasswordSchema } from '../lib/validation.js';

export default apiHandler(async function resetUserPassword(req, res) {
  if (req.method !== 'POST') {
    const err = new Error('الطريقة غير مسموحة');
    err.statusCode = 405;
    throw err;
  }

  const user = requireAuth(req);
  requireRole(user, ['role_admin']);

  const { id } = validateBody(resetUserPasswordSchema, req.body);

  const { data: employee } = await supabaseAdmin.from('employees').select('national_id').eq('id', id).maybeSingle();
  if (!employee) {
    const err = new Error('تعذّر إيجاد بيانات هذا الموظف');
    err.statusCode = 404;
    throw err;
  }

  const passwordHash = await bcrypt.hash(employee.national_id, 10);
  const { error } = await supabaseAdmin.from('users').update({ password_hash: passwordHash }).eq('id', id);
  if (error) throw error;

  await supabaseAdmin.from('audit_log').insert({
    emp_id: user.id, emp_name: user.fullName, role: user.role,
    action: 'إعادة تعيين كلمة مرور موظف', details: { userId: id }, branch: user.branch,
  });

  return res.status(200).json({ success: true, data: { tempPassword: employee.national_id } });
});
