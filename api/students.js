// api/students.js
// =====================================================================
// إجراءات: list, add, update, delete — نفس هيكل api/employees.js بالضبط.
// الإضافة تُنشئ حساب دخول تلقائياً بشيت family_accounts — بكلمة مرور
// مُشفَّرة (bcrypt) من البداية، بلا أي نص صريح مُخزَّن إطلاقاً (بتصريحك).
// =====================================================================

import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { createRouter } from '../lib/router.js';
import { validateBody, addStudentSchema, updateStudentSchema } from '../lib/validation.js';
import { generateStudentId } from '../lib/idGenerator.js';

const STUDENT_MANAGE_ROLES_ = ['role_admin', 'Admission'];

/* -------------------- قائمة الطلاب -------------------- */
async function handleList(req, res) {
  requireAuth(req);
  const { data, error } = await supabaseAdmin
    .from('students')
    .select('id, national_id, name_ar, name_en, nationality, date_of_birth, gender, branch, stage, grade, section, subjects, fee_status, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return res.status(200).json({ success: true, data });
}

/* -------------------- إضافة طالب -------------------- */
async function handleAdd(req, res) {
  const user = requireAuth(req);
  requireRole(user, STUDENT_MANAGE_ROLES_);
  const d = validateBody(addStudentSchema, req.body);

  const { data: existing } = await supabaseAdmin.from('students').select('id').eq('national_id', d.nationalId).maybeSingle();
  if (existing) {
    const err = new Error('رقم الهوية هذا مسجَّل بالفعل لطالب آخر');
    err.statusCode = 409;
    throw err;
  }

  const newId = await generateStudentId(supabaseAdmin);

  const { error: stuError } = await supabaseAdmin.from('students').insert({
    id: newId, national_id: d.nationalId, name_ar: d.nameAr, name_en: d.nameEn,
    nationality: d.nationality || null, date_of_birth: d.dateOfBirth || null, gender: d.gender || null,
    branch: d.branch, stage: d.stage, grade: d.grade, section: d.section, subjects: d.subjects,
  });
  if (stuError) throw stuError;

  const passwordHash = await bcrypt.hash(d.nationalId, 10);
  const { error: accError } = await supabaseAdmin.from('family_accounts').insert({
    id: newId, full_name: d.nameAr, username: d.nationalId, password_hash: passwordHash,
    branch: d.branch, user_type: 'student', role: 'role_studen', status: 'نشط', student_id: newId,
  });
  if (accError) throw accError;

  await supabaseAdmin.from('audit_log').insert({
    emp_id: user.id, emp_name: user.fullName, role: user.role,
    action: 'تسجيل طالب جديد', details: { newStudentId: newId, nameAr: d.nameAr }, branch: user.branch,
  });

  return res.status(200).json({ success: true, data: { id: newId } });
}

/* -------------------- تعديل طالب -------------------- */
async function handleUpdate(req, res) {
  const user = requireAuth(req);
  requireRole(user, STUDENT_MANAGE_ROLES_);
  const { id } = validateBody(z.object({ id: z.string().min(1) }).passthrough(), req.body);
  const d = validateBody(updateStudentSchema, req.body);

  const { data: existing, error: findError } = await supabaseAdmin.from('students').select('id').eq('id', id).maybeSingle();
  if (findError) throw findError;
  if (!existing) {
    const err = new Error('الطالب غير موجود');
    err.statusCode = 404;
    throw err;
  }

  const { error: updateError } = await supabaseAdmin.from('students').update({
    name_ar: d.nameAr, name_en: d.nameEn, nationality: d.nationality || null,
    date_of_birth: d.dateOfBirth || null, gender: d.gender || null,
    branch: d.branch, stage: d.stage, grade: d.grade, section: d.section, subjects: d.subjects,
  }).eq('id', id);
  if (updateError) throw updateError;

  await supabaseAdmin.from('audit_log').insert({
    emp_id: user.id, emp_name: user.fullName, role: user.role,
    action: 'تعديل بيانات طالب', details: { studentId: id, nameAr: d.nameAr }, branch: user.branch,
  });

  return res.status(200).json({ success: true, data: true });
}

/* -------------------- حذف طالب -------------------- */
async function handleDelete(req, res) {
  const user = requireAuth(req);
  requireRole(user, STUDENT_MANAGE_ROLES_);
  const { id } = validateBody(z.object({ id: z.string().min(1, 'رقم الطالب مطلوب') }), req.body);

  const { data: existing } = await supabaseAdmin.from('students').select('id, name_ar').eq('id', id).maybeSingle();
  if (!existing) {
    const err = new Error('الطالب غير موجود');
    err.statusCode = 404;
    throw err;
  }

  const { error } = await supabaseAdmin.from('students').delete().eq('id', id);
  if (error) throw error;

  await supabaseAdmin.from('audit_log').insert({
    emp_id: user.id, emp_name: user.fullName, role: user.role,
    action: 'حذف طالب', details: { studentId: id, nameAr: existing.name_ar }, branch: user.branch,
  });

  return res.status(200).json({ success: true, data: true });
}

export default createRouter({
  list: handleList,
  add: handleAdd,
  update: handleUpdate,
  delete: handleDelete,
});
