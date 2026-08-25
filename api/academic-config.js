// api/academic-config.js
// =====================================================================
// إجراءات: listMatrix, addMatrixEntries (مواد متعددة دفعة واحدة),
// deleteMatrixEntry، listGradeDist, saveGradeDistForSubject (يستبدل كل
// توزيع مادة معيّنة دفعة واحدة — بطاقة ذكية بالواجهة)، deleteGradeDist.
// 🆕 التقويم الدراسي: listTerms, saveTerm (إضافة/تعديل فصل + توليد
// أسابيعه تلقائياً)، deleteTerm، listWeeksForTerm، renameWeek.
// ⚠️ ملف مُجمَّع بسبب حد الـ12 دالة خادمة بخطة Vercel Hobby — أي ميزة
// جديدة تُضاف هنا كإجراء (action) جديد، لا كملف مستقل.
// =====================================================================

import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { createRouter } from '../lib/router.js';
import { z } from 'zod';
import { validateBody, addMatrixEntriesSchema, saveGradeDistForSubjectSchema, saveTermSchema, renameWeekSchema } from '../lib/validation.js';

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

/* -------------------- 🆕 التقويم الدراسي -------------------- */

/** يولّد أسابيع 7 أيام بين تاريخي بداية/نهاية الفصل — نفس منطق GAS الأصلي بالضبط */
function generateWeeksBetween_(startDate, endDate) {
  const weeks = [];
  let cursor = new Date(startDate);
  const end = new Date(endDate);
  let weekNumber = 1;
  while (cursor <= end) {
    const weekStart = new Date(cursor);
    const weekEnd = new Date(cursor);
    weekEnd.setDate(weekEnd.getDate() + 6);
    if (weekEnd > end) weekEnd.setTime(end.getTime());
    weeks.push({
      week_number: weekNumber,
      label: `الأسبوع ${weekNumber}`,
      start_date: weekStart.toISOString().slice(0, 10),
      end_date: weekEnd.toISOString().slice(0, 10),
    });
    cursor.setDate(cursor.getDate() + 7);
    weekNumber++;
  }
  return weeks;
}

// 🆕 القراءة (listTerms/listWeeksForTerm) متاحة لكل الأدوار المصرَّح لها بصفحة
// "التقويم الدراسي" بالواجهة (كل الأدوار بحسب خارطة الصلاحيات) — فقط requireAuth
// بلا requireRole. الكتابة (saveTerm/deleteTerm/renameWeek) للأدمن فقط.

async function handleListTerms(req, res) {
  requireAuth(req);
  const { data, error } = await supabaseAdmin.from('academic_terms').select('*').order('academic_year', { ascending: false }).order('term_number', { ascending: true });
  if (error) throw error;
  return res.status(200).json({ success: true, data });
}

async function handleListWeeksForTerm(req, res) {
  requireAuth(req);
  const { termId } = validateBody(z.object({ termId: z.union([z.string(), z.number()]) }), req.body);
  const { data, error } = await supabaseAdmin.from('academic_weeks').select('*').eq('term_id', termId).order('week_number', { ascending: true });
  if (error) throw error;
  return res.status(200).json({ success: true, data });
}

async function handleSaveTerm(req, res) {
  const user = requireAuth(req);
  requireRole(user, ['role_admin']);
  const d = validateBody(saveTermSchema, req.body);

  const weeks = generateWeeksBetween_(d.startDate, d.endDate);
  let termId = d.id;

  if (termId) {
    // 🆕 تعديل فصل موجود: نحدّث بياناته، ونحذف كل أسابيعه القديمة لنعيد توليدها من الصفر
    const { error: updateError } = await supabaseAdmin.from('academic_terms').update({
      name: d.name, term_number: d.termNumber, academic_year: d.academicYear,
      start_date: d.startDate, end_date: d.endDate,
    }).eq('id', termId);
    if (updateError) throw updateError;

    const { error: deleteWeeksError } = await supabaseAdmin.from('academic_weeks').delete().eq('term_id', termId);
    if (deleteWeeksError) throw deleteWeeksError;
  } else {
    // 🆕 إضافة فصل جديد
    const { data: inserted, error: insertError } = await supabaseAdmin.from('academic_terms').insert({
      name: d.name, term_number: d.termNumber, academic_year: d.academicYear,
      start_date: d.startDate, end_date: d.endDate,
    }).select('id').single();
    if (insertError) throw insertError;
    termId = inserted.id;
  }

  if (weeks.length) {
    const weekRows = weeks.map((w) => ({ ...w, term_id: termId }));
    const { error: weeksInsertError } = await supabaseAdmin.from('academic_weeks').insert(weekRows);
    if (weeksInsertError) throw weeksInsertError;
  }

  await supabaseAdmin.from('audit_log').insert({
    emp_id: user.id, emp_name: user.fullName, role: user.role,
    action: d.id ? 'تعديل فصل دراسي' : 'إضافة فصل دراسي',
    details: { termId, name: d.name, academicYear: d.academicYear, weeksGenerated: weeks.length },
    branch: user.branch,
  });

  return res.status(200).json({ success: true, data: { id: termId, weeksGenerated: weeks.length } });
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

async function handleRenameWeek(req, res) {
  const user = requireAuth(req);
  requireRole(user, ['role_admin']);
  const d = validateBody(renameWeekSchema, req.body);

  const { error } = await supabaseAdmin.from('academic_weeks').update({ label: d.label }).eq('id', d.id);
  if (error) throw error;

  await supabaseAdmin.from('audit_log').insert({
    emp_id: user.id, emp_name: user.fullName, role: user.role,
    action: 'إعادة تسمية أسبوع دراسي', details: { id: d.id, label: d.label }, branch: user.branch,
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
  listTerms: handleListTerms,
  listWeeksForTerm: handleListWeeksForTerm,
  saveTerm: handleSaveTerm,
  deleteTerm: handleDeleteTerm,
  renameWeek: handleRenameWeek,
});
