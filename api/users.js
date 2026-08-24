// api/users.js
// =====================================================================
// إجراءات: list, toggleStatus, resetPassword — كلها أدمن فقط
// =====================================================================

import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { createRouter } from '../lib/router.js';
import { validateBody, toggleUserStatusSchema, resetUserPasswordSchema, createMissingAccountSchema } from '../lib/validation.js';

const BULK_BATCH_SIZE = 50; // 🆕 معالجة بالدفعات — يمنع تجاوز مهلة الخادم مع آلاف السجلات

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

/* -------------------- إنشاء حساب يدوي لموظف واحد (احتياط) -------------------- */
async function handleCreateMissing(req, res) {
  const user = requireAuth(req);
  requireRole(user, ['role_admin']);
  const { id } = validateBody(createMissingAccountSchema, req.body);

  const { data: employee } = await supabaseAdmin.from('employees').select('id, national_id').eq('id', id).maybeSingle();
  if (!employee) {
    const err = new Error('الموظف غير موجود');
    err.statusCode = 404;
    throw err;
  }

  const { data: existingUser } = await supabaseAdmin.from('users').select('id').eq('id', id).maybeSingle();
  if (existingUser) {
    const err = new Error('هذا الموظف يملك حساباً بالفعل');
    err.statusCode = 409;
    throw err;
  }

  const passwordHash = await bcrypt.hash(employee.national_id, 10);
  const { error } = await supabaseAdmin.from('users').insert({
    id: employee.id, username: employee.national_id, password_hash: passwordHash, status: 'active',
  });
  if (error) throw error;

  await supabaseAdmin.from('audit_log').insert({
    emp_id: user.id, emp_name: user.fullName, role: user.role,
    action: 'إنشاء حساب يدوي لموظف', details: { employeeId: id }, branch: user.branch,
  });

  return res.status(200).json({ success: true, data: { tempPassword: employee.national_id } });
}

/* -------------------- إنشاء الحسابات الناقصة جماعياً (بالدفعات) -------------------- */
async function handleCreateAllMissing(req, res) {
  const user = requireAuth(req);
  requireRole(user, ['role_admin']);

  const { data: allEmployees } = await supabaseAdmin.from('employees').select('id, national_id');
  const { data: allUsers } = await supabaseAdmin.from('users').select('id');
  const existingIds = new Set((allUsers || []).map((u) => u.id));
  const missing = (allEmployees || []).filter((e) => !existingIds.has(e.id));

  const batch = missing.slice(0, BULK_BATCH_SIZE); // 🆕 دفعة واحدة فقط بكل استدعاء
  if (batch.length) {
    const rows = await Promise.all(batch.map(async (e) => ({
      id: e.id, username: e.national_id, password_hash: await bcrypt.hash(e.national_id, 10), status: 'active',
    })));
    const { error } = await supabaseAdmin.from('users').insert(rows);
    if (error) throw error;

    await supabaseAdmin.from('audit_log').insert({
      emp_id: user.id, emp_name: user.fullName, role: user.role,
      action: 'إنشاء حسابات موظفين جماعياً (دفعة)', details: { count: batch.length }, branch: user.branch,
    });
  }

  return res.status(200).json({
    success: true,
    data: { createdThisBatch: batch.length, remaining: missing.length - batch.length },
  });
}

export default createRouter({
  list: handleList,
  toggleStatus: handleToggleStatus,
  resetPassword: handleResetPassword,
  createMissing: handleCreateMissing,
  createAllMissing: handleCreateAllMissing,
});
