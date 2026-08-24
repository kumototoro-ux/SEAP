// api/employees.js
// =====================================================================
// إجراءات: list, add, update, delete — كلها بملف واحد، كل واحد بدالته
// الخاصة الواضحة تماماً
// =====================================================================

import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { createRouter } from '../lib/router.js';
import { validateBody, addEmployeeSchema, updateEmployeeSchema } from '../lib/validation.js';
import { generateEmployeeId } from '../lib/idGenerator.js';

/* -------------------- قائمة الموظفين -------------------- */
async function handleList(req, res) {
  const user = requireAuth(req);
  requireRole(user, ['role_admin']); // 🆕 كان مفقوداً — أي مستخدم مسجَّل دخول كان يقدر يجلب كل الموظفين
  const { data, error } = await supabaseAdmin
    .from('employees')
    .select('id, national_id, name_ar, name_en, user_type, role, gender, branch, stage, grades, sections, subjects, created_at, employee_branches(branch)')
    .is('deleted_at', null) // 🆕 يستثني الموظفين المحذوفين (Soft Delete) تلقائياً
    .order('created_at', { ascending: false });
  if (error) throw error;

  const enriched = data.map((emp) => ({
    ...emp,
    all_branches: [emp.branch, ...(emp.employee_branches || []).map((b) => b.branch)],
    employee_branches: undefined,
  }));
  return res.status(200).json({ success: true, data: enriched });
}

/* -------------------- إضافة موظف -------------------- */
async function handleAdd(req, res) {
  const user = requireAuth(req);
  requireRole(user, ['role_admin']);
  const d = validateBody(addEmployeeSchema, req.body);

  const { data: existing } = await supabaseAdmin.from('employees').select('id').eq('national_id', d.nationalId).is('deleted_at', null).maybeSingle();
  if (existing) {
    const err = new Error('رقم الهوية هذا مسجَّل بالفعل لموظف آخر');
    err.statusCode = 409;
    throw err;
  }

  const newId = await generateEmployeeId(supabaseAdmin);

  const { error: empError } = await supabaseAdmin.from('employees').insert({
    id: newId, national_id: d.nationalId, name_ar: d.nameAr, name_en: d.nameEn || null,
    user_type: d.userType, role: d.role, gender: d.gender || null, branch: d.branches[0],
    stage: d.stage || null, grades: d.grades, sections: d.sections, subjects: d.subjects,
  });
  if (empError) throw empError;

  if (d.branches.length > 1) {
    const extraBranches = d.branches.slice(1).map((branch) => ({ employee_id: newId, branch }));
    const { error: branchError } = await supabaseAdmin.from('employee_branches').insert(extraBranches);
    if (branchError) throw branchError;
  }

  const passwordHash = await bcrypt.hash(d.nationalId, 10);
  const { error: userError } = await supabaseAdmin.from('users').insert({
    id: newId, username: d.nationalId, password_hash: passwordHash, status: 'active',
  });
  if (userError) throw userError;

  await supabaseAdmin.from('audit_log').insert({
    emp_id: user.id, emp_name: user.fullName, role: user.role,
    action: 'تسجيل موظف جديد', details: { newEmployeeId: newId, nameAr: d.nameAr }, branch: user.branch,
  });

  return res.status(200).json({ success: true, data: { id: newId } });
}

/* -------------------- تعديل موظف -------------------- */
async function handleUpdate(req, res) {
  const user = requireAuth(req);
  requireRole(user, ['role_admin']);
  const { id } = validateBody(z.object({ id: z.string().min(1) }).passthrough(), req.body);
  const d = validateBody(updateEmployeeSchema, req.body);

  const { data: existing, error: findError } = await supabaseAdmin.from('employees').select('id').eq('id', id).is('deleted_at', null).maybeSingle();
  if (findError) throw findError;
  if (!existing) {
    const err = new Error('الموظف غير موجود');
    err.statusCode = 404;
    throw err;
  }

  const { error: updateError } = await supabaseAdmin.from('employees').update({
    name_ar: d.nameAr, name_en: d.nameEn || null, user_type: d.userType, role: d.role,
    gender: d.gender || null, branch: d.branches[0], stage: d.stage || null,
    grades: d.grades, sections: d.sections, subjects: d.subjects,
  }).eq('id', id);
  if (updateError) throw updateError;

  await supabaseAdmin.from('employee_branches').delete().eq('employee_id', id);
  if (d.branches.length > 1) {
    const extraBranches = d.branches.slice(1).map((branch) => ({ employee_id: id, branch }));
    const { error: branchError } = await supabaseAdmin.from('employee_branches').insert(extraBranches);
    if (branchError) throw branchError;
  }

  await supabaseAdmin.from('audit_log').insert({
    emp_id: user.id, emp_name: user.fullName, role: user.role,
    action: 'تعديل بيانات موظف', details: { employeeId: id, nameAr: d.nameAr }, branch: user.branch,
  });

  return res.status(200).json({ success: true, data: true });
}

/* -------------------- حذف موظف -------------------- */
async function handleDelete(req, res) {
  const user = requireAuth(req);
  requireRole(user, ['role_admin']);
  const { id } = validateBody(z.object({ id: z.string().min(1, 'رقم الموظف مطلوب') }), req.body);

  const { data: existing } = await supabaseAdmin.from('employees').select('id, name_ar').eq('id', id).maybeSingle();
  if (!existing) {
    const err = new Error('الموظف غير موجود');
    err.statusCode = 404;
    throw err;
  }

  // 🆕 حذف آمن (Soft Delete) — نُعلِّم الصف بتاريخ حذف بدل مسحه نهائياً، ونعطِّل حساب دخوله للحماية الفورية
  const { error } = await supabaseAdmin.from('employees').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
  await supabaseAdmin.from('users').update({ status: 'inactive' }).eq('id', id);

  await supabaseAdmin.from('audit_log').insert({
    emp_id: user.id, emp_name: user.fullName, role: user.role,
    action: 'حذف موظف', details: { employeeId: id, nameAr: existing.name_ar }, branch: user.branch,
  });

  return res.status(200).json({ success: true, data: true });
}

export default createRouter({
  list: handleList,
  add: handleAdd,
  update: handleUpdate,
  delete: handleDelete,
});
