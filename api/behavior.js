// api/behavior.js
// =====================================================================
// إجراءات: listForStudent (سجل + النتيجة الحالية)، add (تسجيل موقف
// جديد)، delete (أدمن فقط). النتيجة = 100 + مجموع الإيجابي - مجموع
// السلبي، محصورة بين 0 و100.
// =====================================================================

import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { createRouter } from '../lib/router.js';
import { z } from 'zod';
import { validateBody, addBehaviorSchema } from '../lib/validation.js';

const BEHAVIOR_MANAGE_ROLES_ = ['role_admin', 'role_student_sup'];

function computeScore(records) {
  const total = records.reduce((sum, r) => sum + (r.type === 'positive' ? r.points : -r.points), 100);
  return Math.max(0, Math.min(100, total));
}

/* -------------------- سجل سلوك طالب واحد + النتيجة -------------------- */
async function handleListForStudent(req, res) {
  const user = requireAuth(req);
  requireRole(user, BEHAVIOR_MANAGE_ROLES_);
  const { studentId } = req.body;

  const { data, error } = await supabaseAdmin.from('student_behavior').select('*').eq('student_id', studentId).order('recorded_at', { ascending: false });
  if (error) throw error;

  return res.status(200).json({ success: true, data: { records: data, score: computeScore(data) } });
}

/* -------------------- تسجيل موقف سلوكي جديد -------------------- */
async function handleAdd(req, res) {
  const user = requireAuth(req);
  requireRole(user, BEHAVIOR_MANAGE_ROLES_);
  const d = validateBody(addBehaviorSchema, req.body);

  if (user.role === 'role_student_sup' && user.branch !== d.branch) {
    const err = new Error('غير مصرَّح لك بهذا الفرع');
    err.statusCode = 403;
    throw err;
  }

  const { error } = await supabaseAdmin.from('student_behavior').insert({
    student_id: d.studentId, type: d.type, points: Math.round(d.points), description: d.description,
    branch: d.branch, recorded_by: user.id,
  });
  if (error) throw error;

  await supabaseAdmin.from('audit_log').insert({
    emp_id: user.id, emp_name: user.fullName, role: user.role,
    action: d.type === 'positive' ? 'تسجيل سلوك إيجابي' : 'تسجيل سلوك سلبي',
    details: { studentId: d.studentId, points: d.points }, branch: user.branch,
  });
  return res.status(200).json({ success: true, data: true });
}

/* -------------------- تعديل سجل سلوك (مشرف الطلاب بلا قيد وقت + أدمن) -------------------- */
async function handleUpdate(req, res) {
  const user = requireAuth(req);
  requireRole(user, BEHAVIOR_MANAGE_ROLES_);
  const { id } = req.body;
  const d = validateBody(addBehaviorSchema, req.body);

  if (user.role === 'role_student_sup' && user.branch !== d.branch) {
    const err = new Error('غير مصرَّح لك بهذا الفرع');
    err.statusCode = 403;
    throw err;
  }

  const { error } = await supabaseAdmin.from('student_behavior').update({
    type: d.type, points: Math.round(d.points), description: d.description,
  }).eq('id', id);
  if (error) throw error;

  await supabaseAdmin.from('audit_log').insert({
    emp_id: user.id, emp_name: user.fullName, role: user.role,
    action: 'تعديل سجل سلوك', details: { behaviorId: id, ...d }, branch: user.branch,
  });
  return res.status(200).json({ success: true, data: true });
}

/* -------------------- حذف سجل سلوك — أدمن فقط -------------------- */
async function handleDelete(req, res) {
  const user = requireAuth(req);
  requireRole(user, ['role_admin']);
  const { id } = validateBody(z.object({ id: z.union([z.string(), z.number()]) }), req.body);

  const { error } = await supabaseAdmin.from('student_behavior').delete().eq('id', id);
  if (error) throw error;

  await supabaseAdmin.from('audit_log').insert({
    emp_id: user.id, emp_name: user.fullName, role: user.role,
    action: 'حذف سجل سلوك', details: { behaviorId: id }, branch: user.branch,
  });
  return res.status(200).json({ success: true, data: true });
}

export default createRouter({
  listForStudent: handleListForStudent,
  add: handleAdd,
  update: handleUpdate,
  delete: handleDelete,
});
