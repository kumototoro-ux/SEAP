// api/academic-config.js
// =====================================================================
// إجراءات: listMatrix, addMatrixEntries (مواد متعددة دفعة واحدة),
// deleteMatrixEntry، listGradeDist, saveGradeDistForSubject (يستبدل كل
// توزيع مادة معيّنة دفعة واحدة — بطاقة ذكية بالواجهة)، deleteGradeDist.
// 🆕 التقويم الدراسي (إدارة — أدمن فقط): listTerms, saveTerm (فصل بلا
// أي توليد تلقائي للأسابيع)، deleteTerm، listWeeksForTerm، addWeek،
// updateWeek، deleteWeek (كل أسبوع يُضاف/يُعدَّل يدوياً بالكامل — تاريخ
// بداية/نهاية/نوع/تسمية يحدّدها الأدمن بنفسه)، toggleTermVisibility
// (إظهار/إخفاء فصل كامل لكل الموظفين).
// 🆕 listCalendarData: نقطة القراءة الوحيدة لصفحة "التقويم الدراسي"
// بالواجهة (عرض فقط للجميع بلا استثناء، حتى الأدمن) — تُرجِع فقط
// الفصول الظاهرة (is_visible = true) وأسابيعها، بلا أي فلترة إضافية
// بالواجهة (الأمان الحقيقي هنا بمستوى الاستعلام).
// ⚠️ ملف مُجمَّع بسبب حد الـ12 دالة خادمة بخطة Vercel Hobby — أي ميزة
// جديدة تُضاف هنا كإجراء (action) جديد، لا كملف مستقل.
// =====================================================================

import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { createRouter } from '../lib/router.js';
import { z } from 'zod';
import {
  validateBody, addMatrixEntriesSchema, saveGradeDistForSubjectSchema,
  saveTermSchema, addWeekSchema, updateWeekSchema, toggleTermVisibilitySchema,
} from '../lib/validation.js';

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
    .eq('branch', d.branch).eq('stage', d.stage).eq('grade', d.grade).eq('section', d.section);
  const existingSubjects = new Set((existingRows || []).map((r) => r.subject));
  const newSubjects = d.subjects.filter((s) => !existingSubjects.has(s));

  if (newSubjects.length) {
    const rows = newSubjects.map((subject) => ({ branch: d.branch, stage: d.stage, grade: d.grade, section: d.section, subject }));
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
  const rows = d.entries.map((e) => ({ subject: d.subject, eval_type: e.evalType, max_grade: e.maxScore }));
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

/* -------------------- 🆕 التقويم الدراسي: إدارة الفصول (أدمن فقط) -------------------- */

async function handleListTerms(req, res) {
  const user = requireAuth(req);
  requireRole(user, ['role_admin']); // 🆕 إدارة الفصول أداة أدمن حصرية — القراءة العامة تمر عبر listCalendarData
  const { data, error } = await supabaseAdmin.from('academic_terms').select('*').order('academic_year', { ascending: false }).order('term_number', { ascending: true });
  if (error) throw error;
  return res.status(200).json({ success: true, data });
}

async function handleSaveTerm(req, res) {
  const user = requireAuth(req);
  requireRole(user, ['role_admin']);
  const d = validateBody(saveTermSchema, req.body);

  // 🆕 لا يوجد أي توليد تلقائي للأسابيع هنا — الأسابيع تُدار يدوياً بالكامل
  // بإجراءات addWeek/updateWeek/deleteWeek المستقلة تماماً عن هذا الإجراء
  let termId = d.id;
  if (termId) {
    const { error: updateError } = await supabaseAdmin.from('academic_terms').update({
      name: d.name, term_number: d.termNumber, academic_year: d.academicYear,
      start_date: d.startDate, end_date: d.endDate,
    }).eq('id', termId);
    if (updateError) throw updateError;
  } else {
    const { data: inserted, error: insertError } = await supabaseAdmin.from('academic_terms').insert({
      name: d.name, term_number: d.termNumber, academic_year: d.academicYear,
      start_date: d.startDate, end_date: d.endDate,
    }).select('id').single();
    if (insertError) throw insertError;
    termId = inserted.id;
  }

  await supabaseAdmin.from('audit_log').insert({
    emp_id: user.id, emp_name: user.fullName, role: user.role,
    action: d.id ? 'تعديل فصل دراسي' : 'إضافة فصل دراسي',
    details: { termId, name: d.name, academicYear: d.academicYear },
    branch: user.branch,
  });

  return res.status(200).json({ success: true, data: { id: termId } });
}

async function handleDeleteTerm(req, res) {
  const user = requireAuth(req);
  requireRole(user, ['role_admin']);
  const { id } = validateBody(z.object({ id: z.union([z.string(), z.number()]) }), req.body);

  // 🆕 نحذف الأسابيع يدوياً أولاً بدل الاعتماد فقط على ON DELETE CASCADE —
  // احتياط لو القيد غير مفعَّل فعلياً بقاعدة البيانات الحية
  const { error: deleteWeeksError } = await supabaseAdmin.from('academic_weeks').delete().eq('term_id', id);
  if (deleteWeeksError) throw deleteWeeksError;

  const { error: deleteTermError } = await supabaseAdmin.from('academic_terms').delete().eq('id', id);
  if (deleteTermError) throw deleteTermError;

  await supabaseAdmin.from('audit_log').insert({
    emp_id: user.id, emp_name: user.fullName, role: user.role,
    action: 'حذف فصل دراسي', details: { id }, branch: user.branch,
  });
  return res.status(200).json({ success: true, data: true });
}

async function handleToggleTermVisibility(req, res) {
  const user = requireAuth(req);
  requireRole(user, ['role_admin']);
  const d = validateBody(toggleTermVisibilitySchema, req.body);

  const { error } = await supabaseAdmin.from('academic_terms').update({ is_visible: d.isVisible }).eq('id', d.id);
  if (error) throw error;

  await supabaseAdmin.from('audit_log').insert({
    emp_id: user.id, emp_name: user.fullName, role: user.role,
    action: d.isVisible ? 'إظهار فصل دراسي لكل الموظفين' : 'إخفاء فصل دراسي عن الموظفين',
    details: { id: d.id }, branch: user.branch,
  });
  return res.status(200).json({ success: true, data: true });
}

/* -------------------- 🆕 التقويم الدراسي: إدارة الأسابيع يدوياً (أدمن فقط) -------------------- */

async function handleListWeeksForTerm(req, res) {
  const user = requireAuth(req);
  requireRole(user, ['role_admin']); // 🆕 أداة إدارة داخل الإعدادات فقط — القراءة العامة عبر listCalendarData
  const { termId } = validateBody(z.object({ termId: z.union([z.string(), z.number()]) }), req.body);
  const { data, error } = await supabaseAdmin.from('academic_weeks').select('*').eq('term_id', termId).order('week_number', { ascending: true });
  if (error) throw error;
  return res.status(200).json({ success: true, data });
}

async function handleAddWeek(req, res) {
  const user = requireAuth(req);
  requireRole(user, ['role_admin']);
  const d = validateBody(addWeekSchema, req.body);

  const { data: inserted, error } = await supabaseAdmin.from('academic_weeks').insert({
    term_id: d.termId, week_number: d.weekNumber, label: d.label,
    week_type: d.weekType, start_date: d.startDate, end_date: d.endDate,
  }).select('id').single();
  if (error) throw error;

  await supabaseAdmin.from('audit_log').insert({
    emp_id: user.id, emp_name: user.fullName, role: user.role,
    action: 'إضافة أسبوع دراسي', details: { id: inserted.id, termId: d.termId, weekNumber: d.weekNumber, weekType: d.weekType }, branch: user.branch,
  });
  return res.status(200).json({ success: true, data: { id: inserted.id } });
}

async function handleUpdateWeek(req, res) {
  const user = requireAuth(req);
  requireRole(user, ['role_admin']);
  const d = validateBody(updateWeekSchema, req.body);

  const { error } = await supabaseAdmin.from('academic_weeks').update({
    week_number: d.weekNumber, label: d.label, week_type: d.weekType,
    start_date: d.startDate, end_date: d.endDate,
  }).eq('id', d.id);
  if (error) throw error;

  await supabaseAdmin.from('audit_log').insert({
    emp_id: user.id, emp_name: user.fullName, role: user.role,
    action: 'تعديل أسبوع دراسي', details: { id: d.id, weekNumber: d.weekNumber, weekType: d.weekType }, branch: user.branch,
  });
  return res.status(200).json({ success: true, data: true });
}

async function handleDeleteWeek(req, res) {
  const user = requireAuth(req);
  requireRole(user, ['role_admin']);
  const { id } = validateBody(z.object({ id: z.union([z.string(), z.number()]) }), req.body);

  const { error } = await supabaseAdmin.from('academic_weeks').delete().eq('id', id);
  if (error) throw error;

  await supabaseAdmin.from('audit_log').insert({
    emp_id: user.id, emp_name: user.fullName, role: user.role,
    action: 'حذف أسبوع دراسي', details: { id }, branch: user.branch,
  });
  return res.status(200).json({ success: true, data: true });
}

/* -------------------- 🆕 التقويم الدراسي: نقطة العرض العامة (كل الأدوار، بلا استثناء) -------------------- */

/** يُرجِع فقط الفصول الظاهرة (is_visible = true) وأسابيعها — لكل مستخدم
 * مسجَّل دخول بغض النظر عن دوره (حتى الأدمن يرى بالضبط ما يراه الجميع
 * بصفحة العرض، بما إنه هو من يتحكّم بالإظهار من الإعدادات أصلاً). */
async function handleListCalendarData(req, res) {
  requireAuth(req);

  const { data: terms, error: termsError } = await supabaseAdmin
    .from('academic_terms').select('*').eq('is_visible', true)
    .order('academic_year', { ascending: false }).order('term_number', { ascending: true });
  if (termsError) throw termsError;

  const visibleTermIds = (terms || []).map((t) => t.id);
  let weeks = [];
  if (visibleTermIds.length) {
    const { data: weeksData, error: weeksError } = await supabaseAdmin
      .from('academic_weeks').select('*').in('term_id', visibleTermIds).order('week_number', { ascending: true });
    if (weeksError) throw weeksError;
    weeks = weeksData || [];
  }

  return res.status(200).json({ success: true, data: { terms: terms || [], weeks } });
}

export default createRouter({
  listMatrix: handleListMatrix,
  addMatrixEntries: handleAddMatrixEntries,
  deleteMatrixEntry: handleDeleteMatrixEntry,
  listGradeDist: handleListGradeDist,
  saveGradeDistForSubject: handleSaveGradeDistForSubject,
  deleteGradeDist: handleDeleteGradeDist,
  listTerms: handleListTerms,
  saveTerm: handleSaveTerm,
  deleteTerm: handleDeleteTerm,
  toggleTermVisibility: handleToggleTermVisibility,
  listWeeksForTerm: handleListWeeksForTerm,
  addWeek: handleAddWeek,
  updateWeek: handleUpdateWeek,
  deleteWeek: handleDeleteWeek,
  listCalendarData: handleListCalendarData,
});
