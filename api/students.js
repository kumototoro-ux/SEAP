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
import { validateBody, addStudentSchema, updateStudentSchema, listStudentsFilterSchema } from '../lib/validation.js';
import { generateStudentId } from '../lib/idGenerator.js';

const STUDENT_MANAGE_ROLES_ = ['role_admin', 'Admission', 'role_student_sup'];

/* -------------------- قائمة الطلاب -------------------- */
async function handleList(req, res) {
  const user = requireAuth(req);
  requireRole(user, STUDENT_MANAGE_ROLES_); // 🆕 كان مفقوداً — نفس ثغرة الموظفين بالضبط
  const { branch, stage, grade, section, search } = validateBody(listStudentsFilterSchema, req.body);

  // 🆕 يمنع نقل كل الطلاب دفعة وحدة (قد تصل لآلاف البطاقات): الفرع
  // يُفرَض تلقائياً لغير الأدمن (بلا اعتماد على أي فرع يُرسِله العميل —
  // كانت Admission تشوف كل الفروع بالقائمة رغم تقييد نموذج الإضافة سابقاً)
  const effectiveBranch = user.role === 'role_admin' ? branch : user.branch;

  // 🆕 أزلت كل شروط الحظر الإجبارية هنا — كانت تكسر أي صفحة أخرى تستخدم
  // هذا الإجراء المشترك داخلياً بلا فلاتر (سلوك الطالب، الرئيسية، حسابات
  // الأسرة...) حتى لو كان المستخدم أدمن. الحماية الحقيقية من "آلاف
  // البطاقات" مطبَّقة بمكانين مستقلَّين تماماً عن هذا الإجراء: (1) فرض
  // فرع المستخدم تلقائياً لغير الأدمن أعلاه، (2) الحد الأقصى 200 أدناه،
  // (3) بوابة عرض مستقلة بواجهة صفحة إدارة الطلاب نفسها فقط (لا تمس
  // باقي الصفحات التي تحتاج قائمة مباشرة).

  let query = supabaseAdmin
    .from('students')
    .select('id, national_id, name_ar, name_en, nationality, date_of_birth, gender, branch, stage, grade, section, subjects, fee_status, created_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (effectiveBranch) query = query.eq('branch', effectiveBranch);
  if (stage) query = query.eq('stage', stage);
  if (grade) query = query.eq('grade', grade);
  if (section) query = query.eq('section', section);
  if (search) {
    const safe = search.replace(/[,()%]/g, ''); // 🆕 يمنع كسر صيغة .or() الخاصة بـ PostgREST
    query = query.or(`name_ar.ilike.%${safe}%,national_id.ilike.%${safe}%`);
  }
  query = query.limit(200); // 🆕 حد أقصى دفاعي إضافي حتى لو تحقّقت كل الفلاتر أعلاه

  const { data, error } = await query;
  if (error) throw error;
  return res.status(200).json({ success: true, data });
}

/* -------------------- إضافة طالب -------------------- */
async function handleAdd(req, res) {
  const user = requireAuth(req);
  requireRole(user, STUDENT_MANAGE_ROLES_);
  const d = validateBody(addStudentSchema, req.body);

  // 🆕 حماية دفاعية إضافية بالخادم: غير الأدمن لا يقدر يسجّل طالباً بفرع
  // غير فرعه، حتى لو تلاعب بالطلب مباشرة متجاوزاً قائمة الفروع بالواجهة
  if (user.role !== 'role_admin' && d.branch !== user.branch) {
    const e = new Error('لا تملك صلاحية تسجيل طالب بفرع غير فرعك');
    e.statusCode = 403;
    throw e;
  }

  const { data: existing } = await supabaseAdmin.from('students').select('id').eq('national_id', d.nationalId).is('deleted_at', null).maybeSingle();
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

  const { data: existing, error: findError } = await supabaseAdmin.from('students').select('id, branch').eq('id', id).is('deleted_at', null).maybeSingle();
  if (findError) throw findError;
  if (!existing) {
    const err = new Error('الطالب غير موجود');
    err.statusCode = 404;
    throw err;
  }
  // 🆕 حماية دفاعية: غير الأدمن لا يقدر يعدّل طالباً بفرع غير فرعه، ولا
  // ينقله لفرع آخر — لا اعتماد فقط على إخفاء الخيارات بالواجهة
  if (user.role !== 'role_admin' && (existing.branch !== user.branch || d.branch !== user.branch)) {
    const e = new Error('لا تملك صلاحية تعديل طالب بفرع غير فرعك');
    e.statusCode = 403;
    throw e;
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

  const { error } = await supabaseAdmin.from('students').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
  await supabaseAdmin.from('family_accounts').update({ status: 'غير نشط' }).eq('student_id', id);

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
