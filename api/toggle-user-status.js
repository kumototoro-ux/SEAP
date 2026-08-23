// api/toggle-user-status.js
// =====================================================================
// تفعيل/تعطيل حساب دخول موظف — أدمن فقط
// =====================================================================

import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { apiHandler } from '../lib/apiHandler.js';
import { validateBody, toggleUserStatusSchema } from '../lib/validation.js';

export default apiHandler(async function toggleUserStatus(req, res) {
  if (req.method !== 'POST') {
    const err = new Error('الطريقة غير مسموحة');
    err.statusCode = 405;
    throw err;
  }

  const user = requireAuth(req);
  requireRole(user, ['role_admin']);

  const { id, newStatus } = validateBody(toggleUserStatusSchema, req.body);

  const { data: existing } = await supabaseAdmin.from('users').select('id').eq('id', id).maybeSingle();
  if (!existing) {
    const err = new Error('الحساب غير موجود');
    err.statusCode = 404;
    throw err;
  }

  const { error } = await supabaseAdmin.from('users').update({ status: newStatus }).eq('id', id);
  if (error) throw error;

  await supabaseAdmin.from('audit_log').insert({
    emp_id: user.id, emp_name: user.fullName, role: user.role,
    action: newStatus === 'active' ? 'تفعيل حساب موظف' : 'تعطيل حساب موظف',
    details: { userId: id }, branch: user.branch,
  });

  return res.status(200).json({ success: true, data: true });
});
