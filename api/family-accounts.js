// api/family-accounts.js
// =====================================================================
// إجراءات: list, toggleStatus, resetPassword — لحسابات family_accounts
// (الطلاب وأولياء الأمور معاً). نفس فكرة api/users.js بالضبط، لكن
// الحساب هنا قد يخص طالباً أو ولي أمر — نميّز بينهما عبر role.
// =====================================================================

import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { createRouter } from '../lib/router.js';
import { validateBody, toggleFamilyAccountStatusSchema, resetFamilyAccountPasswordSchema, createMissingAccountSchema } from '../lib/validation.js';

const FAMILY_ACCOUNT_MANAGE_ROLES_ = ['role_admin', 'Admission', 'role_student_sup'];
const BULK_BATCH_SIZE = 50; // 🆕 معالجة بالدفعات — يمنع تجاوز مهلة الخادم مع آلاف السجلات

/* -------------------- قائمة الحسابات -------------------- */
async function handleList(req, res) {
  const user = requireAuth(req);
  requireRole(user, FAMILY_ACCOUNT_MANAGE_ROLES_);

  const { data, error } = await supabaseAdmin
    .from('family_accounts')
    .select('id, username, status, role, branch, created_at, students:student_id(name_ar, grade, section), parent_info:parent_id(name_ar, phone)')
    .order('created_at', { ascending: false });
  if (error) throw error;

  const enriched = data.map((a) => ({
    id: a.id, username: a.username, status: a.status, role: a.role, branch: a.branch, createdAt: a.created_at,
    nameAr: a.role === 'role_studen' ? a.students?.name_ar : a.parent_info?.name_ar,
    detail: a.role === 'role_studen'
      ? `${a.students?.grade || ''} — ${a.students?.section || ''}`
      : (a.parent_info?.phone || ''),
  }));
  return res.status(200).json({ success: true, data: enriched });
}

/* -------------------- تفعيل/تعطيل حساب -------------------- */
async function handleToggleStatus(req, res) {
  const user = requireAuth(req);
  requireRole(user, FAMILY_ACCOUNT_MANAGE_ROLES_);
  const { id, newStatus } = validateBody(toggleFamilyAccountStatusSchema, req.body);

  const { data: existing } = await supabaseAdmin.from('family_accounts').select('id').eq('id', id).maybeSingle();
  if (!existing) {
    const err = new Error('الحساب غير موجود');
    err.statusCode = 404;
    throw err;
  }

  const { error } = await supabaseAdmin.from('family_accounts').update({ status: newStatus }).eq('id', id);
  if (error) throw error;

  await supabaseAdmin.from('audit_log').insert({
    emp_id: user.id, emp_name: user.fullName, role: user.role,
    action: newStatus === 'نشط' ? 'تفعيل حساب طالب/ولي أمر' : 'تعطيل حساب طالب/ولي أمر',
    details: { accountId: id }, branch: user.branch,
  });

  return res.status(200).json({ success: true, data: true });
}

/* -------------------- إعادة تعيين كلمة مرور -------------------- */
async function handleResetPassword(req, res) {
  const user = requireAuth(req);
  requireRole(user, FAMILY_ACCOUNT_MANAGE_ROLES_);
  const { id } = validateBody(resetFamilyAccountPasswordSchema, req.body);

  const { data: account } = await supabaseAdmin.from('family_accounts').select('role, student_id, parent_id').eq('id', id).maybeSingle();
  if (!account) {
    const err = new Error('الحساب غير موجود');
    err.statusCode = 404;
    throw err;
  }

  let nationalId;
  if (account.role === 'role_studen') {
    const { data: stu } = await supabaseAdmin.from('students').select('national_id').eq('id', account.student_id).maybeSingle();
    nationalId = stu?.national_id;
  } else {
    const { data: par } = await supabaseAdmin.from('parent_info').select('national_id').eq('id', account.parent_id).maybeSingle();
    nationalId = par?.national_id;
  }
  if (!nationalId) {
    const err = new Error('تعذّر إيجاد رقم الهوية المرتبط بهذا الحساب');
    err.statusCode = 404;
    throw err;
  }

  const passwordHash = await bcrypt.hash(nationalId, 10);
  const { error } = await supabaseAdmin.from('family_accounts').update({ password_hash: passwordHash }).eq('id', id);
  if (error) throw error;

  await supabaseAdmin.from('audit_log').insert({
    emp_id: user.id, emp_name: user.fullName, role: user.role,
    action: 'إعادة تعيين كلمة مرور طالب/ولي أمر', details: { accountId: id }, branch: user.branch,
  });

  return res.status(200).json({ success: true, data: { tempPassword: nationalId } });
}

/* -------------------- إنشاء حساب يدوي لطالب أو ولي أمر واحد (احتياط) -------------------- */
async function handleCreateMissing(req, res) {
  const user = requireAuth(req);
  requireRole(user, FAMILY_ACCOUNT_MANAGE_ROLES_);
  const { id, type } = validateBody(z.object({ id: z.string().min(1), type: z.enum(['student', 'parent']) }), req.body);

  let source, insertPayload;
  if (type === 'student') {
    const { data: stu } = await supabaseAdmin.from('students').select('id, name_ar, national_id, branch').eq('id', id).maybeSingle();
    if (!stu) { const err = new Error('الطالب غير موجود'); err.statusCode = 404; throw err; }
    source = stu;
    insertPayload = { id: stu.id, full_name: stu.name_ar, username: stu.national_id, branch: stu.branch, user_type: 'student', role: 'role_studen', status: 'نشط', student_id: stu.id };
  } else {
    const { data: par } = await supabaseAdmin.from('parent_info').select('id, name_ar, national_id, branch').eq('id', id).maybeSingle();
    if (!par) { const err = new Error('ولي الأمر غير موجود'); err.statusCode = 404; throw err; }
    source = par;
    insertPayload = { id: par.id, full_name: par.name_ar, username: par.national_id, branch: par.branch, user_type: 'parent', role: 'role_parent', status: 'نشط', parent_id: par.id };
  }

  const { data: existing } = await supabaseAdmin.from('family_accounts').select('id').eq('id', id).maybeSingle();
  if (existing) { const err = new Error('يملك حساباً بالفعل'); err.statusCode = 409; throw err; }

  insertPayload.password_hash = await bcrypt.hash(source.national_id, 10);
  const { error } = await supabaseAdmin.from('family_accounts').insert(insertPayload);
  if (error) throw error;

  await supabaseAdmin.from('audit_log').insert({
    emp_id: user.id, emp_name: user.fullName, role: user.role,
    action: 'إنشاء حساب يدوي', details: { accountId: id, type }, branch: user.branch,
  });

  return res.status(200).json({ success: true, data: { tempPassword: source.national_id } });
}

/* -------------------- إنشاء الحسابات الناقصة جماعياً (طلاب + أولياء أمور، بالدفعات) -------------------- */
async function handleCreateAllMissing(req, res) {
  const user = requireAuth(req);
  requireRole(user, FAMILY_ACCOUNT_MANAGE_ROLES_);

  const { data: allStudents } = await supabaseAdmin.from('students').select('id, name_ar, national_id, branch');
  const { data: allParents } = await supabaseAdmin.from('parent_info').select('id, name_ar, national_id, branch');
  const { data: allAccounts } = await supabaseAdmin.from('family_accounts').select('id');
  const existingIds = new Set((allAccounts || []).map((a) => a.id));

  const missing = [
    ...(allStudents || []).filter((s) => !existingIds.has(s.id)).map((s) => ({ ...s, _type: 'student' })),
    ...(allParents || []).filter((p) => !existingIds.has(p.id)).map((p) => ({ ...p, _type: 'parent' })),
  ];

  const batch = missing.slice(0, BULK_BATCH_SIZE);
  if (batch.length) {
    const rows = await Promise.all(batch.map(async (r) => ({
      id: r.id, full_name: r.name_ar, username: r.national_id,
      password_hash: await bcrypt.hash(r.national_id, 10),
      branch: r.branch, user_type: r._type, role: r._type === 'student' ? 'role_studen' : 'role_parent', status: 'نشط',
      student_id: r._type === 'student' ? r.id : null,
      parent_id: r._type === 'parent' ? r.id : null,
    })));
    const { error } = await supabaseAdmin.from('family_accounts').insert(rows);
    if (error) throw error;

    await supabaseAdmin.from('audit_log').insert({
      emp_id: user.id, emp_name: user.fullName, role: user.role,
      action: 'إنشاء حسابات طلاب/أولياء أمور جماعياً (دفعة)', details: { count: batch.length }, branch: user.branch,
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
