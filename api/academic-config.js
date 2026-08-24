// api/academic-config.js
// =====================================================================
// إجراءات: listMatrix, addMatrixEntry, deleteMatrixEntry (مصفوفة توزيع
// المواد: أي مادة تُدرَّس بأي فرع/صف/شعبة)، و listGradeDist,
// addGradeDist, deleteGradeDist (توزيع الدرجات: نوع التقييم ودرجته من
// 100 لكل مادة). كلاهما إعدادات أكاديمية أساسية، أدمن فقط.
// =====================================================================

import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { createRouter } from '../lib/router.js';
import { z } from 'zod';
import { validateBody, addMatrixEntrySchema, addGradeDistributionSchema } from '../lib/validation.js';

/* -------------------- مصفوفة توزيع المواد -------------------- */
async function handleListMatrix(req, res) {
  requireAuth(req);
  const { data, error } = await supabaseAdmin.from('subject_distribution_matrix').select('*').order('branch');
  if (error) throw error;
  return res.status(200).json({ success: true, data });
}

async function handleAddMatrixEntry(req, res) {
  const user = requireAuth(req);
  requireRole(user, ['role_admin']);
  const d = validateBody(addMatrixEntrySchema, req.body);

  const { error } = await supabaseAdmin.from('subject_distribution_matrix').insert({
    branch: d.branch, grade: d.grade, section: d.section, subject: d.subject,
  });
  if (error) {
    if (error.code === '23505') {
      const err = new Error('هذا التوزيع مُسجَّل بالفعل');
      err.statusCode = 409;
      throw err;
    }
    throw error;
  }

  await supabaseAdmin.from('audit_log').insert({
    emp_id: user.id, emp_name: user.fullName, role: user.role,
    action: 'إضافة توزيع مادة', details: d, branch: user.branch,
  });
  return res.status(200).json({ success: true, data: true });
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
  requireAuth(req);
  const { data, error } = await supabaseAdmin.from('grade_distribution').select('*').order('subject');
  if (error) throw error;
  return res.status(200).json({ success: true, data });
}

async function handleAddGradeDist(req, res) {
  const user = requireAuth(req);
  requireRole(user, ['role_admin']);
  const d = validateBody(addGradeDistributionSchema, req.body);

  const { error } = await supabaseAdmin.from('grade_distribution').insert({
    subject: d.subject, eval_type: d.evalType, max_score: d.maxScore,
  });
  if (error) {
    if (error.code === '23505') {
      const err = new Error('نوع التقييم هذا مُسجَّل بالفعل لهذي المادة');
      err.statusCode = 409;
      throw err;
    }
    throw error;
  }

  await supabaseAdmin.from('audit_log').insert({
    emp_id: user.id, emp_name: user.fullName, role: user.role,
    action: 'إضافة توزيع درجات', details: d, branch: user.branch,
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
  addMatrixEntry: handleAddMatrixEntry,
  deleteMatrixEntry: handleDeleteMatrixEntry,
  listGradeDist: handleListGradeDist,
  addGradeDist: handleAddGradeDist,
  deleteGradeDist: handleDeleteGradeDist,
});
