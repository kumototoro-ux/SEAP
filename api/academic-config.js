// api/academic-config.js
// =====================================================================
// إجراءات: listMatrix, addMatrixEntries (مواد متعددة دفعة واحدة),
// deleteMatrixEntry، listGradeDist, saveGradeDistForSubject (يستبدل كل
// توزيع مادة معيّنة دفعة واحدة — بطاقة ذكية بالواجهة)، deleteGradeDist.
// =====================================================================

import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { createRouter } from '../lib/router.js';
import { z } from 'zod';
import { validateBody, addMatrixEntriesSchema, saveGradeDistForSubjectSchema } from '../lib/validation.js';

/* -------------------- مصفوفة توزيع المواد -------------------- */
async function handleListMatrix(req, res) {
  const user = requireAuth(req);
  requireRole(user, ['role_admin']); // 🆕 كان مفقوداً — نفس نمط الثغرة السابقة
  const { data, error } = await supabaseAdmin.from('subject_distribution_matrix').select('*').order('branch');
  if (error) throw error;
  return res.status(200).json({ success: true, data });
}

async function handleAddMatrixEntries(req, res) {
  const user = requireAuth(req);
  requireRole(user, ['role_admin']);
  const d = validateBody(addMatrixEntriesSchema, req.body);

  const { data: existingRows } = await supabaseAdmin
    .from('subject_distribution_matrix').select('subject')
    .eq('branch', d.branch).eq('grade', d.grade).eq('section', d.section);
  const existingSubjects = new Set((existingRows || []).map((r) => r.subject));
  const newSubjects = d.subjects.filter((s) => !existingSubjects.has(s));

  if (newSubjects.length) {
    const rows = newSubjects.map((subject) => ({ branch: d.branch, grade: d.grade, section: d.section, subject }));
    const { error } = await supabaseAdmin.from('subject_distribution_matrix').insert(rows);
    if (error) throw error;
  }

  await supabaseAdmin.from('audit_log').insert({
    emp_id: user.id, emp_name: user.fullName, role: user.role,
    action: 'إضافة توزيع مواد', details: { ...d, addedCount: newSubjects.length }, branch: user.branch,
  });
  return res.status(200).json({ success: true, data: { added: newSubjects.length, skipped: d.subjects.length - newSubjects.length } });
}

async function handleDeleteMatrixEntry(req, res) {
  const user = requireAuth(req);
  requireRole(user, ['role_admin']);
  const { id } = validateBody(z.object({ id: z.union([z.string(), z.number()]) }), req.body);

  const { error } = await supabaseAdmin.from('subject_distribution_matrix').delete().eq('id', id);
  if (error) throw error;

  await supabaseAdmin.from('audit_log').insert({
    emp_id: user.id, emp_name: user.fullName, role: user.role,
    action: 'حذف توزيع مادة', details: { id }, branch: user.branch,
  });
  return res.status(200).json({ success: true, data: true });
}

/* -------------------- توزيع الدرجات -------------------- */
async function handleListGradeDist(req, res) {
  const user = requireAuth(req);
  requireRole(user, ['role_admin']); // 🆕 كان مفقوداً — نفس نمط الثغرة السابقة
  const { data, error } = await supabaseAdmin.from('grade_distribution').select('*').order('subject');
  if (error) throw error;
  return res.status(200).json({ success: true, data });
}

async function handleSaveGradeDistForSubject(req, res) {
  const user = requireAuth(req);
  requireRole(user, ['role_admin']);
  const d = validateBody(saveGradeDistForSubjectSchema, req.body);

  const total = d.entries.reduce((sum, e) => sum + e.maxScore, 0);
  if (total > 100) {
    const err = new Error(`مجموع الدرجات (${total}) يتجاوز 100 — صحّح القيم قبل الحفظ`);
    err.statusCode = 400;
    throw err;
  }

  await supabaseAdmin.from('grade_distribution').delete().eq('subject', d.subject);
  const rows = d.entries.map((e) => ({ subject: d.subject, eval_type: e.evalType, max_score: e.maxScore }));
  const { error } = await supabaseAdmin.from('grade_distribution').insert(rows);
  if (error) throw error;

  await supabaseAdmin.from('audit_log').insert({
    emp_id: user.id, emp_name: user.fullName, role: user.role,
    action: 'حفظ توزيع درجات مادة', details: { subject: d.subject, entriesCount: d.entries.length, total }, branch: user.branch,
  });
  return res.status(200).json({ success: true, data: true });
}

async function handleDeleteGradeDist(req, res) {
  const user = requireAuth(req);
  requireRole(user, ['role_admin']);
  const { id } = validateBody(z.object({ id: z.union([z.string(), z.number()]) }), req.body);

  const { error } = await supabaseAdmin.from('grade_distribution').delete().eq('id', id);
  if (error) throw error;

  await supabaseAdmin.from('audit_log').insert({
    emp_id: user.id, emp_name: user.fullName, role: user.role,
    action: 'حذف توزيع درجات', details: { id }, branch: user.branch,
  });
  return res.status(200).json({ success: true, data: true });
}

export default createRouter({
  listMatrix: handleListMatrix,
  addMatrixEntries: handleAddMatrixEntries,
  deleteMatrixEntry: handleDeleteMatrixEntry,
  listGradeDist: handleListGradeDist,
  saveGradeDistForSubject: handleSaveGradeDistForSubject,
  deleteGradeDist: handleDeleteGradeDist,
});
