// api/performance.js
// =====================================================================
// نظام تقييم أداء موظفين احترافي — دورات تقييم، معايير متعددة الأدوار
// بوزن قابل للتخصيص، تقييم مفصَّل، حساب نتيجة موزونة تلقائياً، ولوحة
// إحصاءات (متوسط عام، أفضل 5، يحتاجون تحسيناً، مقارنة فروع).
// من يقيِّم من (حسب الخارطة الموثَّقة):
//   role_teacher_sup  → يقيِّم role_teacher (فرعه فقط)
//   role_branch_monitor → يقيِّم role_teacher_sup + role_student_sup (فروعه)
//   role_admin → يقيِّم الجميع + يدير المعايير والدورات + يشوف اللوحة
// =====================================================================

import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { createRouter } from '../lib/router.js';
import { z } from 'zod';
import { validateBody } from '../lib/validation.js';

const EVALUATOR_ROLES_ = ['role_admin', 'role_teacher_sup', 'role_branch_monitor'];

function checkEvaluatorAccess(evaluator, targetEmployee) {
  if (evaluator.role === 'role_admin') return;
  if (evaluator.role === 'role_teacher_sup') {
    if (targetEmployee.role === 'role_teacher' && targetEmployee.branch === evaluator.branch) return;
  }
  if (evaluator.role === 'role_branch_monitor') {
    const allowedBranches = evaluator.allBranches || [evaluator.branch];
    if (allowedBranches.includes(targetEmployee.branch)) return; // 🆕 كل موظفي فروعه، لا المشرفين فقط
  }
  // 🆕 محاولة وصول غير مصرَّح بها — تُسجَّل بسجل التتبّع بدل الرفض الصامت (مراقبة أمنية)
  supabaseAdmin.from('audit_log').insert({
    emp_id: evaluator.id, emp_name: evaluator.fullName, role: evaluator.role,
    action: '⚠️ محاولة وصول غير مصرَّح بها (تقييم أداء)', details: { targetEmployeeId: targetEmployee.id, targetBranch: targetEmployee.branch }, branch: evaluator.branch,
  }).then(() => {});
  const e = new Error('غير مصرَّح لك بتقييم هذا الموظف');
  e.statusCode = 403;
  throw e;
}

/* -------------------- تقييماتي الخاصة -------------------- */
async function handleMyEvaluations(req, res) {
  const user = requireAuth(req);
  const { data, error } = await supabaseAdmin
    .from('evaluations')
    .select('*, evaluation_cycles(name, start_date, end_date)')
    .eq('employee_id', user.id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return res.status(200).json({ success: true, data });
}

/* -------------------- قائمة الموظفين القابلين للتقييم من هذا المُقيِّم -------------------- */
async function handleListEvaluatable(req, res) {
  const user = requireAuth(req);
  requireRole(user, EVALUATOR_ROLES_);

  let query = supabaseAdmin.from('employees').select('id, name_ar, role, branch').is('deleted_at', null);
  if (user.role === 'role_teacher_sup') query = query.eq('role', 'role_teacher').eq('branch', user.branch);
  else if (user.role === 'role_branch_monitor') query = query.in('branch', user.allBranches || [user.branch]).neq('id', user.id); // 🆕 كل موظفي فروعه (عدا نفسه)

  const { data, error } = await query;
  if (error) throw error;
  return res.status(200).json({ success: true, data });
}

/* -------------------- معايير التقييم -------------------- */
async function handleListCriteria(req, res) {
  requireAuth(req);
  const { data, error } = await supabaseAdmin.from('evaluation_criteria').select('*').order('created_at');
  if (error) throw error;
  return res.status(200).json({ success: true, data });
}

async function handleSaveCriterion(req, res) {
  const user = requireAuth(req);
  requireRole(user, ['role_admin']);
  const d = validateBody(z.object({
    id: z.union([z.string(), z.number()]).optional(), // 🆕 وجوده يعني تعديل معيار موجود، غيابه يعني إضافة جديد
    name: z.string().min(2).max(150),
    weight: z.number().min(1).max(100),
    applicableRoles: z.array(z.string()).min(1, 'اختر دوراً واحداً على الأقل'),
  }), req.body);

  if (d.id) {
    const { error } = await supabaseAdmin.from('evaluation_criteria').update({ name: d.name, weight: d.weight, applicable_roles: d.applicableRoles }).eq('id', d.id);
    if (error) throw error;
    await supabaseAdmin.from('audit_log').insert({ emp_id: user.id, emp_name: user.fullName, role: user.role, action: 'تعديل معيار تقييم', details: d, branch: user.branch });
  } else {
    const { error } = await supabaseAdmin.from('evaluation_criteria').insert({ name: d.name, weight: d.weight, applicable_roles: d.applicableRoles });
    if (error) throw error;
    await supabaseAdmin.from('audit_log').insert({ emp_id: user.id, emp_name: user.fullName, role: user.role, action: 'إضافة معيار تقييم', details: d, branch: user.branch });
  }
  return res.status(200).json({ success: true, data: true });
}

async function handleDeleteCriterion(req, res) {
  const user = requireAuth(req);
  requireRole(user, ['role_admin']);
  const { id } = validateBody(z.object({ id: z.union([z.string(), z.number()]) }), req.body);
  const { error } = await supabaseAdmin.from('evaluation_criteria').delete().eq('id', id);
  if (error) throw error;
  await supabaseAdmin.from('audit_log').insert({ emp_id: user.id, emp_name: user.fullName, role: user.role, action: 'حذف معيار تقييم', details: { id }, branch: user.branch });
  return res.status(200).json({ success: true, data: true });
}

/* -------------------- دورات التقييم -------------------- */
async function handleListCycles(req, res) {
  requireAuth(req);
  const { data, error } = await supabaseAdmin.from('evaluation_cycles').select('*').order('start_date', { ascending: false });
  if (error) throw error;
  return res.status(200).json({ success: true, data });
}

async function handleAddCycle(req, res) {
  const user = requireAuth(req);
  requireRole(user, ['role_admin']);
  const d = validateBody(z.object({
    name: z.string().min(2).max(150),
    periodType: z.enum(['monthly', 'quarterly', 'yearly']),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }), req.body);

  const { error } = await supabaseAdmin.from('evaluation_cycles').insert({ name: d.name, period_type: d.periodType, start_date: d.startDate, end_date: d.endDate, status: 'active' });
  if (error) throw error;
  await supabaseAdmin.from('audit_log').insert({ emp_id: user.id, emp_name: user.fullName, role: user.role, action: 'إنشاء دورة تقييم', details: d, branch: user.branch });
  return res.status(200).json({ success: true, data: true });
}

async function handleCloseCycle(req, res) {
  const user = requireAuth(req);
  requireRole(user, ['role_admin']);
  const { id } = validateBody(z.object({ id: z.union([z.string(), z.number()]) }), req.body);
  const { error } = await supabaseAdmin.from('evaluation_cycles').update({ status: 'closed' }).eq('id', id);
  if (error) throw error;
  await supabaseAdmin.from('audit_log').insert({ emp_id: user.id, emp_name: user.fullName, role: user.role, action: 'إغلاق دورة تقييم', details: { id }, branch: user.branch });
  return res.status(200).json({ success: true, data: true });
}

/* -------------------- جلب/حفظ تقييم موظف بدورة معيّنة -------------------- */
async function handleGetEvaluation(req, res) {
  const user = requireAuth(req);
  requireRole(user, EVALUATOR_ROLES_);
  const { employeeId, cycleId } = req.body;

  const { data: employee } = await supabaseAdmin.from('employees').select('id, name_ar, role, branch').eq('id', employeeId).maybeSingle();
  if (!employee) { const e = new Error('الموظف غير موجود'); e.statusCode = 404; throw e; }
  checkEvaluatorAccess(user, employee);

  const { data: criteria } = await supabaseAdmin.from('evaluation_criteria').select('*').contains('applicable_roles', [employee.role]);
  const { data: evaluation } = await supabaseAdmin.from('evaluations').select('*').eq('employee_id', employeeId).eq('cycle_id', cycleId).maybeSingle();
  let scores = [];
  if (evaluation) {
    const { data: scoreRows } = await supabaseAdmin.from('evaluation_scores').select('*').eq('evaluation_id', evaluation.id);
    scores = scoreRows || [];
  }

  return res.status(200).json({ success: true, data: { employee, criteria: criteria || [], evaluation, scores } });
}

async function handleSaveEvaluation(req, res) {
  const user = requireAuth(req);
  requireRole(user, EVALUATOR_ROLES_);
  const d = validateBody(z.object({
    employeeId: z.string().min(1),
    cycleId: z.union([z.string(), z.number()]),
    branch: z.string().min(1),
    scores: z.array(z.object({ criterionId: z.union([z.string(), z.number()]), score: z.number().min(0).max(100) })).min(1),
    strengths: z.string().max(1000).optional(),
    improvements: z.string().max(1000).optional(),
    managerNotes: z.string().max(1000).optional(),
  }), req.body);

  const { data: employee } = await supabaseAdmin.from('employees').select('id, role, branch').eq('id', d.employeeId).maybeSingle();
  if (!employee) { const e = new Error('الموظف غير موجود'); e.statusCode = 404; throw e; }
  checkEvaluatorAccess(user, employee);

  // 🆕 تحقّق خادم حقيقي (لا واجهة فقط) — الدورة يجب تكون نشطة، وإلا لا يُقبَل أي تقييم جديد أو تعديل عليها
  const { data: cycle } = await supabaseAdmin.from('evaluation_cycles').select('status').eq('id', d.cycleId).maybeSingle();
  if (!cycle || cycle.status !== 'active') {
    const err = new Error('هذي الدورة مغلقة — لا يمكن إضافة أو تعديل تقييمات فيها');
    err.statusCode = 403;
    throw err;
  }

  const { data: criteriaRows } = await supabaseAdmin.from('evaluation_criteria').select('id, weight').in('id', d.scores.map((s) => s.criterionId));
  const weightMap = {}; (criteriaRows || []).forEach((c) => { weightMap[c.id] = Number(c.weight); });
  const totalWeight = d.scores.reduce((sum, s) => sum + (weightMap[s.criterionId] || 0), 0);
  const weightedSum = d.scores.reduce((sum, s) => sum + s.score * (weightMap[s.criterionId] || 0), 0);
  const finalScore = totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) / 100 : 0;

  const { data: existingEval } = await supabaseAdmin.from('evaluations').select('id, created_at, evaluated_by').eq('employee_id', d.employeeId).eq('cycle_id', d.cycleId).maybeSingle();

  // 🆕 مشرف المعلمين ومراقب الفروع: تعديل مسموح فقط خلال 24 ساعة من إنشاء التقييم — الأدمن بلا أي قيد
  if (existingEval && user.role !== 'role_admin') {
    const hoursPassed = (Date.now() - new Date(existingEval.created_at).getTime()) / (1000 * 60 * 60);
    if (hoursPassed > 24) {
      const err = new Error('انتهت مهلة تعديل هذا التقييم (24 ساعة من وقت الإنشاء) — تواصل مع الأدمن');
      err.statusCode = 403;
      throw err;
    }
  }

  let evaluationId;
  if (existingEval) {
    evaluationId = existingEval.id;
    const { error } = await supabaseAdmin.from('evaluations').update({
      final_score: finalScore, strengths: d.strengths || null, improvements: d.improvements || null,
      manager_notes: d.managerNotes || null, evaluated_by: user.id, branch: d.branch, updated_at: new Date().toISOString(),
    }).eq('id', evaluationId);
    if (error) throw error;
    await supabaseAdmin.from('evaluation_scores').delete().eq('evaluation_id', evaluationId);
  } else {
    const { data: inserted, error } = await supabaseAdmin.from('evaluations').insert({
      employee_id: d.employeeId, cycle_id: d.cycleId, evaluated_by: user.id, branch: d.branch, final_score: finalScore,
      strengths: d.strengths || null, improvements: d.improvements || null, manager_notes: d.managerNotes || null,
    }).select('id').single();
    if (error) throw error;
    evaluationId = inserted.id;
  }

  const scoreRows = d.scores.map((s) => ({ evaluation_id: evaluationId, criterion_id: s.criterionId, score: s.score }));
  const { error: scoreError } = await supabaseAdmin.from('evaluation_scores').insert(scoreRows);
  if (scoreError) throw scoreError;

  await supabaseAdmin.from('audit_log').insert({
    emp_id: user.id, emp_name: user.fullName, role: user.role,
    action: 'حفظ تقييم أداء موظف', details: { employeeId: d.employeeId, cycleId: d.cycleId, finalScore }, branch: user.branch,
  });
  return res.status(200).json({ success: true, data: { finalScore } });
}

/* -------------------- لوحة الإحصاءات — مقيَّدة حسب دور الطالب (كل واحد يشوف نطاقه فقط) -------------------- */
async function handleDashboardStats(req, res) {
  const user = requireAuth(req);
  requireRole(user, EVALUATOR_ROLES_); // 🆕 لم يعد أدمن فقط — كل مُقيِّم يشوف نطاقه
  const { cycleId, branchFilter } = req.body; // branchFilter اختياري — للأدمن فقط (فرد/فرع/عدة فروع)

  let query = supabaseAdmin.from('evaluations').select('final_score, branch, employee_id, employees(name_ar, role)').eq('cycle_id', cycleId);

  if (user.role === 'role_teacher_sup') {
    query = query.eq('branch', user.branch); // نطاقه: فرعه فقط (المعلمون تحديداً — يُفلتَر بالدور بعد الجلب)
  } else if (user.role === 'role_branch_monitor') {
    query = query.in('branch', user.allBranches || [user.branch]); // نطاقه: كل فروعه
  } else if (user.role === 'role_admin' && branchFilter && branchFilter.length) {
    query = query.in('branch', branchFilter); // 🆕 الأدمن يقدر يخصِّص فرعاً أو عدة فروع، أو يتركه فارغاً = الكل
  }

  const { data: evals, error } = await query;
  if (error) throw error;

  let withNames = evals.map((e) => ({ name: e.employees?.name_ar, score: Number(e.final_score), branch: e.branch, role: e.employees?.role }));
  if (user.role === 'role_teacher_sup') withNames = withNames.filter((e) => e.role === 'role_teacher'); // 🆕 استثناء نفسه من نتائجه

  if (!withNames.length) {
    return res.status(200).json({ success: true, data: { average: 0, count: 0, topPerformers: [], needsImprovement: [], byBranch: {} } });
  }

  const average = Math.round((withNames.reduce((s, e) => s + e.score, 0) / withNames.length) * 100) / 100;
  const sorted = [...withNames].sort((a, b) => b.score - a.score);
  const topPerformers = sorted.slice(0, 5);
  const needsImprovement = sorted.filter((e) => e.score < 65).slice(0, 5);

  const byBranchSums = {};
  withNames.forEach((e) => {
    if (!byBranchSums[e.branch]) byBranchSums[e.branch] = { sum: 0, count: 0 };
    byBranchSums[e.branch].sum += e.score; byBranchSums[e.branch].count += 1;
  });
  const byBranch = {};
  Object.entries(byBranchSums).forEach(([b, v]) => { byBranch[b] = Math.round((v.sum / v.count) * 100) / 100; });

  return res.status(200).json({ success: true, data: { average, count: withNames.length, topPerformers, needsImprovement, byBranch } });
}

/* -------------------- حذف تقييم — أدمن فقط -------------------- */
async function handleDeleteEvaluation(req, res) {
  const user = requireAuth(req);
  requireRole(user, ['role_admin']);
  const { id } = validateBody(z.object({ id: z.union([z.string(), z.number()]) }), req.body);

  const { error } = await supabaseAdmin.from('evaluations').delete().eq('id', id);
  if (error) throw error;

  await supabaseAdmin.from('audit_log').insert({
    emp_id: user.id, emp_name: user.fullName, role: user.role, action: 'حذف تقييم أداء', details: { evaluationId: id }, branch: user.branch,
  });
  return res.status(200).json({ success: true, data: true });
}

export default createRouter({
  myEvaluations: handleMyEvaluations,
  listEvaluatable: handleListEvaluatable,
  listCriteria: handleListCriteria,
  saveCriterion: handleSaveCriterion,
  deleteCriterion: handleDeleteCriterion,
  listCycles: handleListCycles,
  addCycle: handleAddCycle,
  closeCycle: handleCloseCycle,
  getEvaluation: handleGetEvaluation,
  saveEvaluation: handleSaveEvaluation,
  deleteEvaluation: handleDeleteEvaluation,
  dashboardStats: handleDashboardStats,
});
