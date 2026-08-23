// api/users.js
// =====================================================================
// إجراءات: list, toggleStatus, resetPassword — كلها أدمن فقط
// =====================================================================

import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { createRouter } from '../lib/router.js';
import { validateBody, toggleUserStatusSchema, resetUserPasswordSchema } from '../lib/validation.js';

/* -------------------- قائمة الحسابات -------------------- */
async function handleList(req, res) {
  const user = requireAuth(req);
  requireRole(user, ['role_admin']);

  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id, username, status, created_at, last_login_at, employees:id(name_ar, role, branch)')
    .order('created_at', { ascending: false });
  if (error) throw error;

  const enriched = data.map((u) => ({
    id: u.id, username: u.username, status: u.status, createdAt: u.created_at, lastLoginAt: u.last_login_at,
    nameAr: u.employees ? u.employees.name_ar : '(بلا بيانات موظف)',
    role: u.employees ? u.employees.role : null,
    branch: u.employees ? u.employees.branch : null,
  }));
  return res.status(200).json({ success: true, data: enriched });
}

/* -------------------- تفعيل/تعطيل حساب -------------------- */
async function handleToggleStatus(req, res) {
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
}

/* -------------------- إعادة تعيين كلمة مرور -------------------- */
async function handleResetPassword(req, res) {
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
}

export default createRouter({
  list: handleList,
  toggleStatus: handleToggleStatus,
  resetPassword: handleResetPassword,
});
