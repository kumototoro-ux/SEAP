// api/parents.js
// =====================================================================
// إجراءات: list, add, update, delete — نفس هيكل api/students.js بالضبط.
// الإضافة تربط ولي الأمر بطالب واحد أو أكثر (parent_student_links)،
// وتُنشئ حساب دخول تلقائياً بشيت family_accounts — مُشفَّر (bcrypt) من
// البداية، بلا نص صريح إطلاقاً (نفس مبدأ الطلاب المعتمد).
// =====================================================================

import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { createRouter } from '../lib/router.js';
import { validateBody, addParentSchema, updateParentSchema } from '../lib/validation.js';
import { generateParentId } from '../lib/idGenerator.js';

const PARENT_MANAGE_ROLES_ = ['role_admin', 'Admission', 'role_student_sup'];

/* -------------------- قائمة أولياء الأمور (مع أسماء أبنائهم) -------------------- */
async function handleList(req, res) {
  requireAuth(req);
  const { data, error } = await supabaseAdmin
    .from('parent_info')
    .select('id, national_id, name_ar, name_en, phone, branch, created_at, parent_student_links(relationship, students(id, name_ar))')
    .order('created_at', { ascending: false });
  if (error) throw error;

  const enriched = data.map((p) => ({
    ...p,
    linked_students: (p.parent_student_links || []).map((l) => ({
      id: l.students?.id, name_ar: l.students?.name_ar, relationship: l.relationship,
    })),
    parent_student_links: undefined,
  }));
  return res.status(200).json({ success: true, data: enriched });
}

/* -------------------- إضافة ولي أمر -------------------- */
async function handleAdd(req, res) {
  const user = requireAuth(req);
  requireRole(user, PARENT_MANAGE_ROLES_);
  const d = validateBody(addParentSchema, req.body);

  const { data: existing } = await supabaseAdmin.from('parent_info').select('id').eq('national_id', d.nationalId).maybeSingle();
  if (existing) {
    const err = new Error('رقم الهوية هذا مسجَّل بالفعل لولي أمر آخر');
    err.statusCode = 409;
    throw err;
  }

  // ⚠️ التأكد أن كل الطلاب المُختارين موجودون فعلاً قبل الربط
  const { data: foundStudents } = await supabaseAdmin.from('students').select('id').in('id', d.studentIds);
  if (!foundStudents || foundStudents.length !== d.studentIds.length) {
    const err = new Error('أحد الطلاب المُختارين غير موجود');
    err.statusCode = 400;
    throw err;
  }

  const newId = await generateParentId(supabaseAdmin);

  const { error: parentError } = await supabaseAdmin.from('parent_info').insert({
    id: newId, national_id: d.nationalId, name_ar: d.nameAr, name_en: d.nameEn, phone: d.phone, branch: d.branch,
  });
  if (parentError) throw parentError;

  const links = d.studentIds.map((sid) => ({ parent_id: newId, student_id: sid, relationship: d.relationship }));
  const { error: linkError } = await supabaseAdmin.from('parent_student_links').insert(links);
  if (linkError) throw linkError;

  const passwordHash = await bcrypt.hash(d.nationalId, 10);
  const { error: accError } = await supabaseAdmin.from('family_accounts').insert({
    id: newId, full_name: d.nameAr, username: d.nationalId, password_hash: passwordHash,
    branch: d.branch, user_type: 'parent', role: 'role_parent', status: 'نشط', parent_id: newId,
  });
  if (accError) throw accError;

  await supabaseAdmin.from('audit_log').insert({
    emp_id: user.id, emp_name: user.fullName, role: user.role,
    action: 'تسجيل ولي أمر جديد', details: { newParentId: newId, nameAr: d.nameAr, studentIds: d.studentIds }, branch: user.branch,
  });

  return res.status(200).json({ success: true, data: { id: newId } });
}

/* -------------------- تعديل ولي أمر -------------------- */
async function handleUpdate(req, res) {
  const user = requireAuth(req);
  requireRole(user, PARENT_MANAGE_ROLES_);
  const { id } = validateBody(z.object({ id: z.string().min(1) }).passthrough(), req.body);
  const d = validateBody(updateParentSchema, req.body);

  const { data: existing, error: findError } = await supabaseAdmin.from('parent_info').select('id').eq('id', id).maybeSingle();
  if (findError) throw findError;
  if (!existing) {
    const err = new Error('ولي الأمر غير موجود');
    err.statusCode = 404;
    throw err;
  }

  const { data: foundStudents } = await supabaseAdmin.from('students').select('id').in('id', d.studentIds);
  if (!foundStudents || foundStudents.length !== d.studentIds.length) {
    const err = new Error('أحد الطلاب المُختارين غير موجود');
    err.statusCode = 400;
    throw err;
  }

  const { error: updateError } = await supabaseAdmin.from('parent_info').update({
    name_ar: d.nameAr, name_en: d.nameEn, phone: d.phone, branch: d.branch,
  }).eq('id', id);
  if (updateError) throw updateError;

  await supabaseAdmin.from('parent_student_links').delete().eq('parent_id', id);
  const links = d.studentIds.map((sid) => ({ parent_id: id, student_id: sid, relationship: d.relationship }));
  const { error: linkError } = await supabaseAdmin.from('parent_student_links').insert(links);
  if (linkError) throw linkError;

  await supabaseAdmin.from('audit_log').insert({
    emp_id: user.id, emp_name: user.fullName, role: user.role,
    action: 'تعديل بيانات ولي أمر', details: { parentId: id, nameAr: d.nameAr }, branch: user.branch,
  });

  return res.status(200).json({ success: true, data: true });
}

/* -------------------- حذف ولي أمر -------------------- */
async function handleDelete(req, res) {
  const user = requireAuth(req);
  requireRole(user, PARENT_MANAGE_ROLES_);
  const { id } = validateBody(z.object({ id: z.string().min(1, 'رقم ولي الأمر مطلوب') }), req.body);

  const { data: existing } = await supabaseAdmin.from('parent_info').select('id, name_ar').eq('id', id).maybeSingle();
  if (!existing) {
    const err = new Error('ولي الأمر غير موجود');
    err.statusCode = 404;
    throw err;
  }

  const { error } = await supabaseAdmin.from('parent_info').delete().eq('id', id);
  if (error) throw error;

  await supabaseAdmin.from('audit_log').insert({
    emp_id: user.id, emp_name: user.fullName, role: user.role,
    action: 'حذف ولي أمر', details: { parentId: id, nameAr: existing.name_ar }, branch: user.branch,
  });

  return res.status(200).json({ success: true, data: true });
}

export default createRouter({
  list: handleList,
  add: handleAdd,
  update: handleUpdate,
  delete: handleDelete,
});
