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
  addHolidaySchema, updateHolidaySchema,
  classScheduleEntrySchema, examScheduleEntrySchema,
  saveAssignmentSchema, saveAssignmentGradeSchema,
  createGradingSheetSchema, updateGradingSheetEntriesSchema, requestSheetReopenSchema,
} from '../lib/validation.js';

/* -------------------- 🆕 صلاحيات التكاليف/المهام/الاختبارات/الإثراء -------------------- */
// عرض: أدمن (بلا قيد) + معلم (تكاليفه هو فقط) + 3 أدوار إشراف (عرض فقط
// بفرعهم/فروعهم). كتابة (إضافة/تعديل/حذف): أدمن + معلم فقط — الإشراف
// عرض فقط ولا يصل إطلاقاً لإجراءات الكتابة أدناه.
const ASSIGNMENT_VIEW_ROLES = ['role_admin', 'role_teacher', 'role_student_sup', 'role_teacher_sup', 'role_branch_monitor'];
const ASSIGNMENT_WRITE_ROLES = ['role_admin', 'role_teacher'];
const ASSIGNMENT_EDIT_WINDOW_MS = 60 * 60 * 1000;       // 🆕 ساعة واحدة من لحظة النشر
const ASSIGNMENT_DELETE_WINDOW_MS = 30 * 60 * 1000;     // 🆕 نصف ساعة من لحظة النشر
const GRADE_EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;       // 🆕 يوم كامل من لحظة الرصد (أو آخر إعادة فتح من الأدمن)
const GRADE_DELETE_WINDOW_MS = 30 * 60 * 1000;          // 🆕 نصف ساعة من لحظة الرصد

/* -------------------- 🆕 تجميع الدرجات (Grade Aggregation) -------------------- */
// يُعاد الحساب تلقائياً بعد كل رصد/حذف درجة — يجمع كل assignment_grades
// لطالب+مادة معيَّنة حسب eval_type، يُرجِّح كل نوع بوزنه من
// grade_distribution، ويخزّن الناتج النهائي (من 100 عادةً) بجدول
// grade_aggregation_results مع تفصيل شفاف لكل خطوة حساب.
async function recomputeGradeAggregation_(studentId, subject) {
  const { data: student, error: sError } = await supabaseAdmin.from('students').select('id, name_ar, branch, stage, grade, section').eq('id', studentId).single();
  if (sError || !student) return; // 🆕 طالب محذوف مثلاً — لا داعي لإيقاف الطلب الأساسي بسببه

  const { data: distRows, error: dError } = await supabaseAdmin.from('grade_distribution').select('eval_type, max_grade').eq('subject', subject);
  if (dError) throw dError;
  if (!distRows || !distRows.length) return; // 🆕 لا يوجد توزيع درجات لهذي المادة بعد — لا يوجد أساس للحساب

  const { data: grades, error: gError } = await supabaseAdmin.from('assignment_grades').select('score, max_score, assignment_id, assignments!inner(subject, eval_type)')
    .eq('student_id', studentId).eq('assignments.subject', subject);
  if (gError) throw gError;

  // 🆕 سجل المشاركة والتفاعل — يُستخدَم فقط للأنواع اللي بلا أي تكاليف/اختبارات مرتبطة بها
  // (يمنع الاحتساب المزدوج لنفس نوع التقييم من مصدرين معاً)
  const { data: participation, error: pError } = await supabaseAdmin.from('participation_log').select('eval_type, direction').eq('student_id', studentId).eq('subject', subject);
  if (pError) throw pError;

  const breakdown = distRows.map((dist) => {
    const relevant = (grades || []).filter((g) => g.assignments.eval_type === dist.eval_type && g.score !== null);
    const earned = relevant.reduce((sum, g) => sum + Number(g.score), 0);
    const possible = relevant.reduce((sum, g) => sum + Number(g.max_score || 0), 0);

    if (possible > 0) {
      const contribution = (earned / possible) * Number(dist.max_grade);
      return { evalType: dist.eval_type, source: 'assignments', earned, possible, weight: Number(dist.max_grade), contribution: Math.round(contribution * 100) / 100 };
    }

    // 🆕 لا توجد تكاليف بهذا النوع — نجرّب المشاركة والتفاعل (معادلة نسبية: إيجابي مقابل سلبي)
    const relevantParticipation = (participation || []).filter((p) => p.eval_type === dist.eval_type);
    const positiveCount = relevantParticipation.filter((p) => p.direction === 'positive').length;
    const negativeCount = relevantParticipation.filter((p) => p.direction === 'negative').length;
    const total = positiveCount + negativeCount;
    const ratio = total > 0 ? positiveCount / total : 0;
    const contribution = ratio * Number(dist.max_grade);
    return {
      evalType: dist.eval_type, source: 'participation', positiveCount, negativeCount,
      weight: Number(dist.max_grade), contribution: Math.round(contribution * 100) / 100,
    };
  });

  const finalGrade = Math.round(breakdown.reduce((sum, b) => sum + b.contribution, 0) * 100) / 100;

  await supabaseAdmin.from('grade_aggregation_results').upsert({
    student_id: student.id, student_name: student.name_ar, subject,
    branch: student.branch, stage: student.stage, grade: student.grade, section: student.section,
    final_grade: finalGrade, breakdown, computed_at: new Date().toISOString(),
  }, { onConflict: 'student_id,subject' });
}

/** 🆕 يتحقق أن المعلم مصرَّح له بالضبط بهذا (الفرع/الصف/الشعبة/المادة) —
 * بحسب مصفوفة grades/sections/subject المخزَّنة بجلسته (JWT). الأدمن بلا قيد. */
function assertTeacherScopeForAssignment_(user, d) {
  if (user.role === 'role_admin') return;
  const inScope = user.branch === d.branch
    && user.stage === d.stage // 🆕 المرحلة أُضيفت لتقييد المعلم (كانت مفقودة — كل المراحل كانت تظهر له)
    && (user.grades || []).includes(d.grade)
    && (user.sections || []).includes(d.section)
    && (user.subject || []).includes(d.subject);
  if (!inScope) {
    const e = new Error('لا تملك صلاحية النشر لهذا الفرع/المرحلة/الصف/الشعبة/المادة');
    e.statusCode = 403;
    throw e;
  }
}

function assertWithinWindow_(sinceDate, windowMs, actionLabel) {
  const elapsed = Date.now() - new Date(sinceDate).getTime();
  if (elapsed > windowMs) {
    const e = new Error(`انتهت مهلة ${actionLabel} المسموحة`);
    e.statusCode = 403;
    throw e;
  }
}

/* -------------------- 🆕 صلاحيات الجداول الدراسية/الاختبارات (مشتركة) -------------------- */
// ثلاثة أدوار فقط تملك صلاحية التعديل: الأدمن بلا قيد، مراقب الفروع
// مقيَّد بفروعه المُسندة (user.allBranches)، مشرف المعلمين مقيَّد بفرعه
// الوحيد (user.branch). كل الأدوار الأخرى المصرَّح لها بالصفحة (معلم،
// مشرف طلاب) عرض فقط — لا تصل حتى لإجراءات الكتابة أدناه.
const SCHEDULE_VIEW_ROLES = ['role_admin', 'role_branch_monitor', 'role_teacher_sup', 'role_student_sup', 'role_teacher'];
const SCHEDULE_MANAGE_ROLES = ['role_admin', 'role_branch_monitor', 'role_teacher_sup'];

function assertScheduleBranchAccess_(user, branch) {
  if (user.role === 'role_admin') return;
  if (user.role === 'role_branch_monitor') {
    if (!(user.allBranches || []).includes(branch)) {
      const e = new Error('لا تملك صلاحية التعديل على هذا الفرع');
      e.statusCode = 403;
      throw e;
    }
    return;
  }
  if (user.role === 'role_teacher_sup') {
    if (user.branch !== branch) {
      const e = new Error('لا تملك صلاحية التعديل على هذا الفرع');
      e.statusCode = 403;
      throw e;
    }
    return;
  }
  const e = new Error('لا تملك صلاحية تنفيذ هذا الإجراء');
  e.statusCode = 403;
  throw e;
}

/* -------------------- 🆕 تحسينات أمان/تكامل بيانات مشتركة -------------------- */
// (1) أي أسبوع أو إجازة يجب أن تقع تواريخه ضمن نطاق فصله الدراسي بالضبط —
//     بلا هذا الفحص، يقدر الأدمن (بخطأ كتابي بحت) يُدخل تاريخاً خارج
//     الفصل، وهذا يكسر أي منطق مستقبلي (تكاليف/درجات) يعتمد على "كل
//     أيام الفصل مغطّاة بوضوح دراسي/إجازة/اختبار".
// (2) حد أقصى معقول لطول أي مدخل واحد (180 يوماً) — حماية من خطأ كتابي
//     بالتاريخ يُنتج مدى ضخماً غير منطقي (مثلاً سنة كاملة بدل أسبوع).

async function fetchTermOrThrow_(termId) {
  const { data: term, error } = await supabaseAdmin.from('academic_terms').select('*').eq('id', termId).single();
  if (error || !term) {
    const e = new Error('الفصل الدراسي المحدَّد غير موجود');
    e.statusCode = 404;
    throw e;
  }
  return term;
}

function assertDatesWithinTerm_(term, startDate, endDate) {
  if (startDate < term.start_date || endDate > term.end_date) {
    const e = new Error(`التواريخ يجب أن تقع ضمن نطاق الفصل الدراسي (${term.start_date} إلى ${term.end_date})`);
    e.statusCode = 400;
    throw e;
  }
}

function assertReasonableSpan_(startDate, endDate, maxDays = 180) {
  const days = (new Date(endDate) - new Date(startDate)) / 86400000;
  if (days > maxDays) {
    const e = new Error(`المدى الزمني طويل جداً (${Math.round(days)} يوم) — تحقّق من التواريخ المدخَلة`);
    e.statusCode = 400;
    throw e;
  }
}

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

/** 🆕 قراءة محصورة (بلا تحكّم إداري كامل بالمصفوفة) — تُرجِع فقط أسماء
 * المواد المُعرَّفة لصف/شعبة/فرع معيّن. تُستخدَم بنماذج تسجيل الطالب
 * لسحب المواد تلقائياً بدل اختيارها يدوياً — متاحة لأي مستخدم مسجَّل
 * دخول (بيانات غير حسّاسة: أسماء مواد فقط)، بعكس listMatrix الإدارية
 * الكاملة المحصورة بالأدمن فقط. */
async function handleListSubjectsForClass(req, res) {
  requireAuth(req);
  const { branch, stage, grade, section } = validateBody(z.object({
    branch: z.string().min(1), stage: z.string().min(1), grade: z.string().min(1), section: z.string().min(1),
  }), req.body);

  const { data, error } = await supabaseAdmin.from('subject_distribution_matrix').select('subject')
    .eq('branch', branch).eq('stage', stage).eq('grade', grade).eq('section', section);
  if (error) throw error;

  return res.status(200).json({ success: true, data: (data || []).map((r) => r.subject) });
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

  // 🆕 نحذف الأسابيع والإجازات يدوياً أولاً بدل الاعتماد فقط على ON DELETE
  // CASCADE — احتياط لو القيد غير مفعَّل فعلياً بقاعدة البيانات الحية
  const { error: deleteWeeksError } = await supabaseAdmin.from('academic_weeks').delete().eq('term_id', id);
  if (deleteWeeksError) throw deleteWeeksError;
  const { error: deleteHolidaysError } = await supabaseAdmin.from('academic_holidays').delete().eq('term_id', id);
  if (deleteHolidaysError) throw deleteHolidaysError;

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

  const term = await fetchTermOrThrow_(d.termId); // 🆕 يتأكد أن الفصل موجود فعلاً
  assertDatesWithinTerm_(term, d.startDate, d.endDate); // 🆕 تكامل بيانات: التواريخ ضمن نطاق الفصل
  assertReasonableSpan_(d.startDate, d.endDate); // 🆕 حماية من خطأ كتابي بمدى ضخم

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

  // 🆕 نحتاج نعرف فصل الأسبوع الحالي عشان نتحقق من نطاق التواريخ
  const { data: existingWeek, error: fetchError } = await supabaseAdmin.from('academic_weeks').select('term_id').eq('id', d.id).single();
  if (fetchError || !existingWeek) {
    const e = new Error('الأسبوع الدراسي غير موجود');
    e.statusCode = 404;
    throw e;
  }
  const term = await fetchTermOrThrow_(existingWeek.term_id);
  assertDatesWithinTerm_(term, d.startDate, d.endDate);
  assertReasonableSpan_(d.startDate, d.endDate);

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

/* -------------------- 🆕 التقويم الدراسي: إدارة الإجازات يدوياً (أدمن فقط) -------------------- */
// مستقلة عن الأسابيع عن قصد — إجازة قد تقع داخل أسبوع دراسي واحد أو
// تمتد لتغطي أكثر من أسبوع (يوم، يومين، 3، 8، حتى 11 يوماً أو أكثر).
// تُدار من نفس شاشة "إدارة الأسابيع" لكل فصل بالإعدادات.

async function handleListHolidaysForTerm(req, res) {
  const user = requireAuth(req);
  requireRole(user, ['role_admin']);
  const { termId } = validateBody(z.object({ termId: z.union([z.string(), z.number()]) }), req.body);
  const { data, error } = await supabaseAdmin.from('academic_holidays').select('*').eq('term_id', termId).order('start_date', { ascending: true });
  if (error) throw error;
  return res.status(200).json({ success: true, data });
}

async function handleAddHoliday(req, res) {
  const user = requireAuth(req);
  requireRole(user, ['role_admin']);
  const d = validateBody(addHolidaySchema, req.body);

  const term = await fetchTermOrThrow_(d.termId);
  assertDatesWithinTerm_(term, d.startDate, d.endDate);
  assertReasonableSpan_(d.startDate, d.endDate);

  const { data: inserted, error } = await supabaseAdmin.from('academic_holidays').insert({
    term_id: d.termId, label: d.label, start_date: d.startDate, end_date: d.endDate,
  }).select('id').single();
  if (error) throw error;

  await supabaseAdmin.from('audit_log').insert({
    emp_id: user.id, emp_name: user.fullName, role: user.role,
    action: 'إضافة إجازة', details: { id: inserted.id, termId: d.termId, label: d.label }, branch: user.branch,
  });
  return res.status(200).json({ success: true, data: { id: inserted.id } });
}

async function handleUpdateHoliday(req, res) {
  const user = requireAuth(req);
  requireRole(user, ['role_admin']);
  const d = validateBody(updateHolidaySchema, req.body);

  const { data: existingHoliday, error: fetchError } = await supabaseAdmin.from('academic_holidays').select('term_id').eq('id', d.id).single();
  if (fetchError || !existingHoliday) {
    const e = new Error('الإجازة غير موجودة');
    e.statusCode = 404;
    throw e;
  }
  const term = await fetchTermOrThrow_(existingHoliday.term_id);
  assertDatesWithinTerm_(term, d.startDate, d.endDate);
  assertReasonableSpan_(d.startDate, d.endDate);

  const { error } = await supabaseAdmin.from('academic_holidays').update({
    label: d.label, start_date: d.startDate, end_date: d.endDate,
  }).eq('id', d.id);
  if (error) throw error;

  await supabaseAdmin.from('audit_log').insert({
    emp_id: user.id, emp_name: user.fullName, role: user.role,
    action: 'تعديل إجازة', details: { id: d.id, label: d.label }, branch: user.branch,
  });
  return res.status(200).json({ success: true, data: true });
}

async function handleDeleteHoliday(req, res) {
  const user = requireAuth(req);
  requireRole(user, ['role_admin']);
  const { id } = validateBody(z.object({ id: z.union([z.string(), z.number()]) }), req.body);

  const { error } = await supabaseAdmin.from('academic_holidays').delete().eq('id', id);
  if (error) throw error;

  await supabaseAdmin.from('audit_log').insert({
    emp_id: user.id, emp_name: user.fullName, role: user.role,
    action: 'حذف إجازة', details: { id }, branch: user.branch,
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
  let holidays = []; // 🆕
  if (visibleTermIds.length) {
    const { data: weeksData, error: weeksError } = await supabaseAdmin
      .from('academic_weeks').select('*').in('term_id', visibleTermIds).order('week_number', { ascending: true });
    if (weeksError) throw weeksError;
    weeks = weeksData || [];

    const { data: holidaysData, error: holidaysError } = await supabaseAdmin
      .from('academic_holidays').select('*').in('term_id', visibleTermIds).order('start_date', { ascending: true });
    if (holidaysError) throw holidaysError;
    holidays = holidaysData || [];
  }

  return res.status(200).json({ success: true, data: { terms: terms || [], weeks, holidays } });
}

/* -------------------- 🆕 الجدول الدراسي الأسبوعي -------------------- */

/** 🆕 قائمة موظفين مبسَّطة للاختيار (معلم بالجدول / مراقب لجنة بالاختبار)
 * — بيانات دنيا فقط (بلا هوية وطنية أو حقول حساسة)، مقيَّدة بنفس فروع
 * صلاحية المستخدم (لا PII يتسرَّب لغير الأدمن). */
async function handleListStaffForScheduling(req, res) {
  const user = requireAuth(req);
  requireRole(user, SCHEDULE_MANAGE_ROLES); // 🆕 القائمة تُستخدَم فقط بنماذج الإضافة/التعديل (أدوار الإدارة)

  let query = supabaseAdmin.from('employees').select('id, name_ar, role, branch').is('deleted_at', null).order('name_ar');
  if (user.role === 'role_branch_monitor') query = query.in('branch', user.allBranches || []);
  else if (user.role === 'role_teacher_sup') query = query.eq('branch', user.branch);

  const { data, error } = await query;
  if (error) throw error;
  return res.status(200).json({ success: true, data });
}

async function handleListClassSchedule(req, res) {
  const user = requireAuth(req);
  requireRole(user, SCHEDULE_VIEW_ROLES);

  let query = supabaseAdmin.from('class_schedule_slots').select('*').order('day_of_week').order('period_number');
  if (user.role === 'role_branch_monitor') query = query.in('branch', user.allBranches || []);
  else if (user.role === 'role_teacher_sup' || user.role === 'role_student_sup') query = query.eq('branch', user.branch);
  else if (user.role === 'role_teacher') query = query.eq('teacher_id', user.id); // 🆕 المعلم يشوف حصصه هو فقط

  const { data, error } = await query;
  if (error) throw error;
  return res.status(200).json({ success: true, data });
}

async function handleSaveClassScheduleEntry(req, res) {
  const user = requireAuth(req);
  requireRole(user, SCHEDULE_MANAGE_ROLES);
  const d = validateBody(classScheduleEntrySchema, req.body);
  assertScheduleBranchAccess_(user, d.branch);

  // 🆕 نجلب اسم المعلم لحظة الحفظ ونخزّنه مكرَّراً بالخانة (Denormalization)
  // — يسمح لأدوار العرض فقط برؤية الاسم بلا صلاحية جلب قائمة الموظفين كاملة
  const { data: teacher, error: teacherError } = await supabaseAdmin.from('employees').select('name_ar').eq('id', d.teacherId).single();
  if (teacherError || !teacher) {
    const e = new Error('المعلم المحدَّد غير موجود');
    e.statusCode = 404;
    throw e;
  }

  const row = {
    branch: d.branch, stage: d.stage, grade: d.grade, section: d.section,
    day_of_week: d.dayOfWeek, period_number: d.periodNumber, subject: d.subject,
    teacher_id: d.teacherId, teacher_name: teacher.name_ar,
  };

  let savedId = d.id;
  if (d.id) {
    const { error } = await supabaseAdmin.from('class_schedule_slots').update(row).eq('id', d.id);
    if (error) throw error;
  } else {
    const { data: inserted, error } = await supabaseAdmin.from('class_schedule_slots').insert(row).select('id').single();
    if (error) {
      // 🆕 قيد UNIQUE بقاعدة البيانات يمنع تضارب حصتين — رسالة عربية واضحة بدل خطأ تقني
      if (error.code === '23505') {
        const e = new Error('يوجد بالفعل حصة أخرى مسجَّلة بنفس اليوم ورقم الحصة لهذا الصف — عدّل الحصة الموجودة بدل الإضافة');
        e.statusCode = 409;
        throw e;
      }
      throw error;
    }
    savedId = inserted.id;
  }

  await supabaseAdmin.from('audit_log').insert({
    emp_id: user.id, emp_name: user.fullName, role: user.role,
    action: d.id ? 'تعديل حصة بالجدول الدراسي' : 'إضافة حصة بالجدول الدراسي',
    details: { id: savedId, branch: d.branch, grade: d.grade, section: d.section, dayOfWeek: d.dayOfWeek, periodNumber: d.periodNumber },
    branch: user.branch,
  });
  return res.status(200).json({ success: true, data: { id: savedId } });
}

async function handleDeleteClassScheduleEntry(req, res) {
  const user = requireAuth(req);
  requireRole(user, SCHEDULE_MANAGE_ROLES);
  const { id } = validateBody(z.object({ id: z.union([z.string(), z.number()]) }), req.body);

  const { data: existing, error: fetchError } = await supabaseAdmin.from('class_schedule_slots').select('branch').eq('id', id).single();
  if (fetchError || !existing) {
    const e = new Error('الحصة غير موجودة');
    e.statusCode = 404;
    throw e;
  }
  assertScheduleBranchAccess_(user, existing.branch);

  const { error } = await supabaseAdmin.from('class_schedule_slots').delete().eq('id', id);
  if (error) throw error;

  await supabaseAdmin.from('audit_log').insert({
    emp_id: user.id, emp_name: user.fullName, role: user.role,
    action: 'حذف حصة بالجدول الدراسي', details: { id }, branch: user.branch,
  });
  return res.status(200).json({ success: true, data: true });
}

/* -------------------- 🆕 جدول الاختبارات -------------------- */

async function handleListExamSchedule(req, res) {
  const user = requireAuth(req);
  requireRole(user, SCHEDULE_VIEW_ROLES);

  let query = supabaseAdmin.from('exam_committee_schedule').select('*').order('exam_date').order('period_slot');
  if (user.role === 'role_branch_monitor') query = query.in('branch', user.allBranches || []);
  else if (user.role === 'role_teacher_sup' || user.role === 'role_student_sup') query = query.eq('branch', user.branch);
  else if (user.role === 'role_teacher') query = query.eq('supervisor_id', user.id); // 🆕 المعلم يشوف لجانه هو فقط

  const { data, error } = await query;
  if (error) throw error;
  return res.status(200).json({ success: true, data });
}

async function handleSaveExamScheduleEntry(req, res) {
  const user = requireAuth(req);
  requireRole(user, SCHEDULE_MANAGE_ROLES);
  const d = validateBody(examScheduleEntrySchema, req.body);
  assertScheduleBranchAccess_(user, d.branch);

  const { data: supervisor, error: supervisorError } = await supabaseAdmin.from('employees').select('name_ar').eq('id', d.supervisorId).single();
  if (supervisorError || !supervisor) {
    const e = new Error('المراقب المحدَّد غير موجود');
    e.statusCode = 404;
    throw e;
  }

  const row = {
    branch: d.branch, stage: d.stage, grade: d.grade, section: d.section, subject: d.subject,
    exam_date: d.examDate, period_slot: d.periodSlot, supervisor_id: d.supervisorId, supervisor_name: supervisor.name_ar,
  };

  let savedId = d.id;
  if (d.id) {
    const { error } = await supabaseAdmin.from('exam_committee_schedule').update(row).eq('id', d.id);
    if (error) throw error;
  } else {
    const { data: inserted, error } = await supabaseAdmin.from('exam_committee_schedule').insert(row).select('id').single();
    if (error) {
      if (error.code === '23505') {
        const e = new Error('يوجد بالفعل اختبار آخر مسجَّل بنفس التاريخ والفترة لهذا الصف — عدّل الاختبار الموجود بدل الإضافة');
        e.statusCode = 409;
        throw e;
      }
      throw error;
    }
    savedId = inserted.id;
  }

  await supabaseAdmin.from('audit_log').insert({
    emp_id: user.id, emp_name: user.fullName, role: user.role,
    action: d.id ? 'تعديل جدولة اختبار' : 'إضافة جدولة اختبار',
    details: { id: savedId, branch: d.branch, grade: d.grade, section: d.section, examDate: d.examDate, periodSlot: d.periodSlot },
    branch: user.branch,
  });
  return res.status(200).json({ success: true, data: { id: savedId } });
}

async function handleDeleteExamScheduleEntry(req, res) {
  const user = requireAuth(req);
  requireRole(user, SCHEDULE_MANAGE_ROLES);
  const { id } = validateBody(z.object({ id: z.union([z.string(), z.number()]) }), req.body);

  const { data: existing, error: fetchError } = await supabaseAdmin.from('exam_committee_schedule').select('branch').eq('id', id).single();
  if (fetchError || !existing) {
    const e = new Error('الاختبار غير موجود');
    e.statusCode = 404;
    throw e;
  }
  assertScheduleBranchAccess_(user, existing.branch);

  const { error } = await supabaseAdmin.from('exam_committee_schedule').delete().eq('id', id);
  if (error) throw error;

  await supabaseAdmin.from('audit_log').insert({
    emp_id: user.id, emp_name: user.fullName, role: user.role,
    action: 'حذف جدولة اختبار', details: { id }, branch: user.branch,
  });
  return res.status(200).json({ success: true, data: true });
}

/* -------------------- 🆕 التكاليف والمهام والاختبارات والإثراء -------------------- */

async function handleListAssignments(req, res) {
  const user = requireAuth(req);
  requireRole(user, ASSIGNMENT_VIEW_ROLES);

  let query = supabaseAdmin.from('assignments').select('*').order('published_at', { ascending: false });
  if (user.role === 'role_branch_monitor') query = query.in('branch', user.allBranches || []);
  else if (user.role === 'role_teacher_sup' || user.role === 'role_student_sup') query = query.eq('branch', user.branch);
  else if (user.role === 'role_teacher') query = query.eq('teacher_id', user.id);

  const { data: assignments, error } = await query;
  if (error) throw error;

  // 🆕 عدّاد الطلاب المتفاعلين (لبطاقات المشرفين) — نجلب الدرجات المرتبطة ونُجمِّعها بالجافاسكربت
  const ids = (assignments || []).map((a) => a.id);
  let counts = {};
  let questionsByAssignment = {};
  if (ids.length) {
    const { data: grades, error: gradesError } = await supabaseAdmin.from('assignment_grades').select('assignment_id').in('assignment_id', ids);
    if (gradesError) throw gradesError;
    (grades || []).forEach((g) => { counts[g.assignment_id] = (counts[g.assignment_id] || 0) + 1; });

    // 🆕 يحدّد هل التكليف قابل للتصحيح التلقائي بالكامل (كل أسئلته خيارات/صح وخطأ)
    // أو يحتاج تصحيح يدوي (فيه سؤال واحد على الأقل إجابة قصيرة/طويلة/مرفق)
    const { data: questions, error: qError } = await supabaseAdmin.from('assignment_questions').select('assignment_id, answer_type').in('assignment_id', ids);
    if (qError) throw qError;
    (questions || []).forEach((q) => {
      if (!questionsByAssignment[q.assignment_id]) questionsByAssignment[q.assignment_id] = [];
      questionsByAssignment[q.assignment_id].push(q.answer_type);
    });
  }

  const enriched = (assignments || []).map((a) => {
    const qTypes = questionsByAssignment[a.id] || [];
    const isAutoGradable = qTypes.length > 0 && qTypes.every((t) => t === 'mcq' || t === 'true_false');
    return { ...a, participants_count: counts[a.id] || 0, is_auto_gradable: isAutoGradable };
  });
  return res.status(200).json({ success: true, data: enriched });
}

async function handleListAssignmentQuestions(req, res) {
  const user = requireAuth(req);
  requireRole(user, ASSIGNMENT_VIEW_ROLES);
  const { assignmentId } = validateBody(z.object({ assignmentId: z.union([z.string(), z.number()]) }), req.body);

  const { data, error } = await supabaseAdmin.from('assignment_questions').select('*').eq('assignment_id', assignmentId).order('question_order');
  if (error) throw error;
  return res.status(200).json({ success: true, data });
}

async function handleSaveAssignment(req, res) {
  const user = requireAuth(req);
  requireRole(user, ASSIGNMENT_WRITE_ROLES);
  const d = validateBody(saveAssignmentSchema, req.body);

  const questions = d.questions || [];
  const maxScore = questions.reduce((sum, q) => sum + q.points, 0);

  const row = {
    category: d.category, subtype: d.category === 'enrichment' ? null : d.subtype,
    eval_type: d.category === 'enrichment' ? null : d.evalType, // 🆕 أساس توزيع الدرجات
    title: d.title, description: d.description || null,
    branch: d.branch, stage: d.stage, grade: d.grade, section: d.section, subject: d.subject,
    available_from: d.availableFrom || null, due_at: d.dueAt || null,
    youtube_url: d.youtubeUrl || null, attachment_url: d.attachmentUrl || null,
    max_score: maxScore, updated_at: new Date().toISOString(),
  };

  let assignmentId = d.id;

  if (assignmentId) {
    // 🆕 تعديل: تحقّق ملكية + نافذة الساعة الواحدة (بلا قيد للأدمن)
    const { data: existing, error: fetchError } = await supabaseAdmin.from('assignments').select('*').eq('id', assignmentId).single();
    if (fetchError || !existing) {
      const e = new Error('التكليف غير موجود');
      e.statusCode = 404;
      throw e;
    }
    if (user.role !== 'role_admin') {
      if (existing.teacher_id !== user.id) {
        const e = new Error('لا تملك صلاحية تعديل تكليف معلم آخر');
        e.statusCode = 403;
        throw e;
      }
      assertWithinWindow_(existing.published_at, ASSIGNMENT_EDIT_WINDOW_MS, 'تعديل التكليف');
      assertTeacherScopeForAssignment_(user, d);
    }

    const { error: updateError } = await supabaseAdmin.from('assignments').update(row).eq('id', assignmentId);
    if (updateError) throw updateError;

    // 🆕 نعيد بناء الأسئلة بالكامل (حذف القديم + إدراج الجديد) — أبسط وأضمن من محاولة الدمج/الفرق
    const { error: deleteQError } = await supabaseAdmin.from('assignment_questions').delete().eq('assignment_id', assignmentId);
    if (deleteQError) throw deleteQError;
  } else {
    assertTeacherScopeForAssignment_(user, d);
    row.teacher_id = user.id;
    row.teacher_name = user.fullName;
    row.published_at = new Date().toISOString();

    const { data: inserted, error: insertError } = await supabaseAdmin.from('assignments').insert(row).select('id').single();
    if (insertError) throw insertError;
    assignmentId = inserted.id;
  }

  if (questions.length) {
    const questionRows = questions.map((q, idx) => ({
      assignment_id: assignmentId, question_order: idx + 1, question_text: q.questionText,
      answer_type: q.answerType, points: q.points,
      options: q.options || null, correct_option_id: q.correctOptionId || null,
    }));
    const { error: qInsertError } = await supabaseAdmin.from('assignment_questions').insert(questionRows);
    if (qInsertError) throw qInsertError;
  }

  await supabaseAdmin.from('audit_log').insert({
    emp_id: user.id, emp_name: user.fullName, role: user.role,
    action: d.id ? 'تعديل تكليف/اختبار/إثراء' : 'نشر تكليف/اختبار/إثراء جديد',
    details: { id: assignmentId, category: d.category, title: d.title, branch: d.branch, grade: d.grade, section: d.section },
    branch: user.branch,
  });
  return res.status(200).json({ success: true, data: { id: assignmentId } });
}

async function handleDeleteAssignment(req, res) {
  const user = requireAuth(req);
  requireRole(user, ASSIGNMENT_WRITE_ROLES);
  const { id } = validateBody(z.object({ id: z.union([z.string(), z.number()]) }), req.body);

  const { data: existing, error: fetchError } = await supabaseAdmin.from('assignments').select('teacher_id, published_at').eq('id', id).single();
  if (fetchError || !existing) {
    const e = new Error('التكليف غير موجود');
    e.statusCode = 404;
    throw e;
  }
  if (user.role !== 'role_admin') {
    if (existing.teacher_id !== user.id) {
      const e = new Error('لا تملك صلاحية حذف تكليف معلم آخر');
      e.statusCode = 403;
      throw e;
    }
    assertWithinWindow_(existing.published_at, ASSIGNMENT_DELETE_WINDOW_MS, 'حذف التكليف');
  }

  const { error } = await supabaseAdmin.from('assignments').delete().eq('id', id); // ON DELETE CASCADE يحذف الأسئلة والدرجات تلقائياً
  if (error) throw error;

  await supabaseAdmin.from('audit_log').insert({
    emp_id: user.id, emp_name: user.fullName, role: user.role,
    action: 'حذف تكليف/اختبار/إثراء', details: { id }, branch: user.branch,
  });
  return res.status(200).json({ success: true, data: true });
}

/** 🆕 تحديث الدرجة الكلية مباشرة (مثال: "الاختبار الورقي من 20") — بلا
 * حاجة لإعادة بناء الأسئلة. مفيد للتقييمات الورقية/الخارجية التي أُنشئت
 * بسؤال واحد تمثيلي داخل النظام. */
async function handleUpdateAssignmentMaxScore(req, res) {
  const user = requireAuth(req);
  requireRole(user, ASSIGNMENT_WRITE_ROLES);
  const { id, maxScore } = validateBody(z.object({
    id: z.union([z.string(), z.number()]), maxScore: z.number().positive('الدرجة الكلية يجب أن تكون أكبر من صفر').max(1000),
  }), req.body);

  const { data: existing, error: fetchError } = await supabaseAdmin.from('assignments').select('teacher_id, published_at').eq('id', id).single();
  if (fetchError || !existing) {
    const e = new Error('التكليف غير موجود');
    e.statusCode = 404;
    throw e;
  }
  if (user.role !== 'role_admin') {
    if (existing.teacher_id !== user.id) {
      const e = new Error('لا تملك صلاحية تعديل تكليف معلم آخر');
      e.statusCode = 403;
      throw e;
    }
    assertWithinWindow_(existing.published_at, ASSIGNMENT_EDIT_WINDOW_MS, 'تعديل التكليف');
  }

  const { error } = await supabaseAdmin.from('assignments').update({ max_score: maxScore, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;

  await supabaseAdmin.from('audit_log').insert({
    emp_id: user.id, emp_name: user.fullName, role: user.role,
    action: 'تعديل الدرجة الكلية لتكليف', details: { id, maxScore }, branch: user.branch,
  });
  return res.status(200).json({ success: true, data: true });
}

/* -------------------- 🆕 رصد الدرجات (صفحة منفصلة — أدمن ومعلم فقط) -------------------- */

/** 🆕 قائمة طلاب صف/شعبة التكليف مدمَجة بأي درجات مرصودة سابقاً — أساس صفحة الرصد */
async function handleListAssignmentRoster(req, res) {
  const user = requireAuth(req);
  requireRole(user, ['role_admin', 'role_teacher']);
  const { assignmentId } = validateBody(z.object({ assignmentId: z.union([z.string(), z.number()]) }), req.body);

  const { data: assignment, error: aError } = await supabaseAdmin.from('assignments').select('*').eq('id', assignmentId).single();
  if (aError || !assignment) {
    const e = new Error('التكليف غير موجود');
    e.statusCode = 404;
    throw e;
  }
  if (user.role !== 'role_admin' && assignment.teacher_id !== user.id) {
    const e = new Error('لا تملك صلاحية عرض رصد درجات تكليف معلم آخر');
    e.statusCode = 403;
    throw e;
  }

  const { data: students, error: sError } = await supabaseAdmin.from('students').select('id, name_ar')
    .eq('branch', assignment.branch).eq('grade', assignment.grade).eq('section', assignment.section).is('deleted_at', null).order('name_ar');
  if (sError) throw sError;

  const { data: grades, error: gError } = await supabaseAdmin.from('assignment_grades').select('*').eq('assignment_id', assignmentId);
  if (gError) throw gError;
  const gradesByStudent = {};
  (grades || []).forEach((g) => { gradesByStudent[g.student_id] = g; });

  const roster = (students || []).map((s) => ({
    student_id: s.id, student_name: s.name_ar, grade_row: gradesByStudent[s.id] || null,
  }));

  return res.status(200).json({ success: true, data: { assignment, roster } });
}

async function handleSaveAssignmentGrade(req, res) {
  const user = requireAuth(req);
  requireRole(user, ['role_admin', 'role_teacher']);
  const d = validateBody(saveAssignmentGradeSchema, req.body);

  const { data: assignment, error: aError } = await supabaseAdmin.from('assignments').select('teacher_id, max_score, subject').eq('id', d.assignmentId).single();
  if (aError || !assignment) {
    const e = new Error('التكليف غير موجود');
    e.statusCode = 404;
    throw e;
  }
  if (user.role !== 'role_admin' && assignment.teacher_id !== user.id) {
    const e = new Error('لا تملك صلاحية رصد درجات تكليف معلم آخر');
    e.statusCode = 403;
    throw e;
  }
  if (d.score !== null && d.score !== undefined && d.score > assignment.max_score) {
    const e = new Error(`الدرجة لا يجب أن تتجاوز الدرجة الكلية للتكليف (${assignment.max_score})`);
    e.statusCode = 400;
    throw e;
  }

  const { data: student, error: stError } = await supabaseAdmin.from('students').select('name_ar').eq('id', d.studentId).single();
  if (stError || !student) {
    const e = new Error('الطالب غير موجود');
    e.statusCode = 404;
    throw e;
  }

  const { data: existingGrade } = await supabaseAdmin.from('assignment_grades').select('*')
    .eq('assignment_id', d.assignmentId).eq('student_id', d.studentId).maybeSingle();

  if (existingGrade && user.role !== 'role_admin') {
    // 🆕 الأساس الزمني هو الأحدث بين لحظة الرصد الأصلي وآخر إعادة فتح صريحة من الأدمن
    const baseTime = (existingGrade.reopened_at && new Date(existingGrade.reopened_at) > new Date(existingGrade.recorded_at))
      ? existingGrade.reopened_at : existingGrade.recorded_at;
    try {
      assertWithinWindow_(baseTime, GRADE_EDIT_WINDOW_MS, 'تعديل الدرجة');
    } catch (windowError) {
      windowError.message = 'انتهت مهلة التعديل (يوم كامل من وقت الرصد) — تواصل مع الأدمن عبر المراسلات لطلب إعادة فتح التعديل';
      throw windowError;
    }
  }

  const row = {
    assignment_id: d.assignmentId, student_id: d.studentId, student_name: student.name_ar,
    score: d.score ?? null, max_score: assignment.max_score, participation_note: d.participationNote || null,
    recorded_manually: true, graded_by: user.id, graded_by_name: user.fullName, updated_at: new Date().toISOString(),
  };

  if (existingGrade) {
    const { error } = await supabaseAdmin.from('assignment_grades').update(row).eq('id', existingGrade.id);
    if (error) throw error;
  } else {
    row.recorded_at = new Date().toISOString();
    const { error } = await supabaseAdmin.from('assignment_grades').insert(row);
    if (error) throw error;
  }

  await supabaseAdmin.from('audit_log').insert({
    emp_id: user.id, emp_name: user.fullName, role: user.role,
    action: existingGrade ? 'تعديل درجة تكليف' : 'رصد درجة تكليف',
    details: { assignmentId: d.assignmentId, studentId: d.studentId, previousScore: existingGrade ? existingGrade.score : null, newScore: d.score }, // 🆕 القيمة السابقة والجديدة معاً
    branch: user.branch,
  });
  await recomputeGradeAggregation_(d.studentId, assignment.subject); // 🆕 إعادة حساب فورية بعد أي رصد
  return res.status(200).json({ success: true, data: true });
}

async function handleDeleteAssignmentGrade(req, res) {
  const user = requireAuth(req);
  requireRole(user, ['role_admin', 'role_teacher']);
  const { assignmentId, studentId } = validateBody(z.object({
    assignmentId: z.union([z.string(), z.number()]), studentId: z.string().min(1),
  }), req.body);

  const { data: existingGrade, error: fetchError } = await supabaseAdmin.from('assignment_grades').select('*, assignments!inner(teacher_id, subject)')
    .eq('assignment_id', assignmentId).eq('student_id', studentId).single();
  if (fetchError || !existingGrade) {
    const e = new Error('لا يوجد رصد درجة لهذا الطالب');
    e.statusCode = 404;
    throw e;
  }
  if (user.role !== 'role_admin') {
    if (existingGrade.assignments.teacher_id !== user.id) {
      const e = new Error('لا تملك صلاحية حذف رصد درجة تكليف معلم آخر');
      e.statusCode = 403;
      throw e;
    }
    assertWithinWindow_(existingGrade.recorded_at, GRADE_DELETE_WINDOW_MS, 'حذف الدرجة');
  }

  const { error } = await supabaseAdmin.from('assignment_grades').delete().eq('id', existingGrade.id);
  if (error) throw error;

  await supabaseAdmin.from('audit_log').insert({
    emp_id: user.id, emp_name: user.fullName, role: user.role,
    action: 'حذف رصد درجة تكليف', details: { assignmentId, studentId }, branch: user.branch,
  });
  await recomputeGradeAggregation_(studentId, existingGrade.assignments.subject); // 🆕 إعادة حساب فورية بعد الحذف
  return res.status(200).json({ success: true, data: true });
}

/* -------------------- 🆕 دورة "طلب إعادة فتح تعديل الدرجة" — مرتبطة بالتكليف مباشرة عبر المراسلات -------------------- */

/** المعلم يطلب من الأدمن فتح تعديل درجة طالب معيّن بعد انتهاء مهلة اليوم
 * — الطلب يُنشئ رسالة فعلية بنظام المراسلات، مرتبطة بسجل الدرجة بالضبط
 * (contextType/contextId)، معبَّأة تلقائياً بكل التفاصيل المطلوبة. */
async function handleRequestGradeEditReopen(req, res) {
  const user = requireAuth(req);
  requireRole(user, ['role_teacher']);
  const d = validateBody(z.object({
    assignmentId: z.union([z.string(), z.number()]), studentId: z.string().min(1),
    requestedScore: z.number().min(0).optional().nullable(),
    reason: z.string().trim().min(3, 'وضّح سبب طلب إعادة الفتح').max(500),
  }), req.body);

  const { data: grade, error: gError } = await supabaseAdmin.from('assignment_grades')
    .select('*, assignments!inner(id, title, subject, grade, section, teacher_id, teacher_name)')
    .eq('assignment_id', d.assignmentId).eq('student_id', d.studentId).single();
  if (gError || !grade) { const e = new Error('لا يوجد رصد درجة لهذا الطالب على هذا التكليف'); e.statusCode = 404; throw e; }
  if (grade.assignments.teacher_id !== user.id) { const e = new Error('لا تملك صلاحية طلب فتح تعديل لتكليف معلم آخر'); e.statusCode = 403; throw e; }

  const baseTime = (grade.reopened_at && new Date(grade.reopened_at) > new Date(grade.recorded_at)) ? grade.reopened_at : grade.recorded_at;
  const windowEnd = new Date(new Date(baseTime).getTime() + GRADE_EDIT_WINDOW_MS).toISOString();

  const { data: admins } = await supabaseAdmin.from('employees').select('id').eq('role', 'role_admin').is('deleted_at', null);
  if (!admins || !admins.length) { const e = new Error('لا يوجد حساب أدمن لاستقبال الطلب حالياً'); e.statusCode = 500; throw e; }

  // 🆕 رسالة معبَّأة تلقائياً بكل التفاصيل المطلوبة — لا مراسلة منفصلة عن السياق
  const subject = `طلب إعادة فتح تعديل درجة — ${grade.assignments.title}`;
  const body = [
    `المعلم: ${user.fullName}`,
    `الطالب: ${grade.student_name}`,
    `التكليف/الاختبار: ${grade.assignments.title}`,
    `المادة: ${grade.assignments.subject}`,
    `الصف/الشعبة: ${grade.assignments.grade} / ${grade.assignments.section}`,
    `الدرجة الحالية: ${grade.score ?? '—'} من ${grade.max_score}`,
    d.requestedScore !== undefined && d.requestedScore !== null ? `الدرجة المطلوب تعديلها إلى: ${d.requestedScore}` : null,
    `وقت التصحيح الأصلي: ${new Date(grade.recorded_at).toLocaleString('ar-SA-u-ca-gregory')}`,
    `وقت انتهاء فترة التعديل: ${new Date(windowEnd).toLocaleString('ar-SA-u-ca-gregory')}`,
    `سبب الطلب: ${d.reason}`,
  ].filter(Boolean).join('\n');

  const { data: thread, error: threadError } = await supabaseAdmin.from('chat_threads').insert({
    subject, context_type: 'grade_reopen_request', context_id: String(grade.id),
    sender_id: user.id, sender_type: 'employee', branch: user.branch,
  }).select('id').single();
  if (threadError) throw threadError;

  await supabaseAdmin.from('chat_messages').insert({ thread_id: thread.id, sender_id: user.id, sender_type: 'employee', body, is_original: true });
  await supabaseAdmin.from('chat_recipients').insert(admins.map((a) => ({ thread_id: thread.id, recipient_id: a.id, recipient_type: 'employee' })));

  await supabaseAdmin.from('audit_log').insert({
    emp_id: user.id, emp_name: user.fullName, role: user.role,
    action: 'طلب إعادة فتح تعديل درجة', details: { gradeId: grade.id, assignmentId: d.assignmentId, studentId: d.studentId, reason: d.reason, threadId: thread.id }, branch: user.branch,
  });

  return res.status(200).json({ success: true, data: { threadId: thread.id } });
}

/** الأدمن يفتح نافذة تعديل جديدة (يوم كامل) لسجل درجة معيّن — يُستدعى
 * عادة من داخل نفس محادثة الطلب لكن يعمل بمعزل عنها كمان. */
async function handleReopenGradeEdit(req, res) {
  const user = requireAuth(req);
  requireRole(user, ['role_admin']);
  const { gradeId } = validateBody(z.object({ gradeId: z.union([z.string(), z.number()]) }), req.body);

  const { data: grade, error } = await supabaseAdmin.from('assignment_grades').select('*').eq('id', gradeId).single();
  if (error || !grade) { const e = new Error('سجل الدرجة غير موجود'); e.statusCode = 404; throw e; }

  const now = new Date().toISOString();
  const { error: updateError } = await supabaseAdmin.from('assignment_grades').update({ reopened_at: now, reopened_by: user.id }).eq('id', gradeId);
  if (updateError) throw updateError;

  const windowEnd = new Date(Date.now() + GRADE_EDIT_WINDOW_MS).toISOString();
  await supabaseAdmin.from('audit_log').insert({
    emp_id: user.id, emp_name: user.fullName, role: user.role,
    action: 'فتح تعديل درجة', details: { gradeId, reopenedAt: now, windowEnd, studentId: grade.student_id, assignmentId: grade.assignment_id }, branch: user.branch,
  });

  return res.status(200).json({ success: true, data: { windowEnd } });
}

/* ===================== 🆕 إعادة بناء صفحة الرصد — كشوفات الرصد المباشر ===================== */
// "كشف رصد" ككيان مستقل حقيقي للتقييمات خارج نظام التكاليف/الاختبارات
// (اختبار ورقي، تقييم شفهي، نشاط...) — لا يمس هذا أي شيء بصفحة
// التكاليف والمهام والاختبارات (assignments/assignment_grades) إطلاقاً.

const SHEET_EDIT_WINDOW_MS = 24 * 60 * 60 * 1000; // 🆕 يوم كامل — نفس منطق تعديل الدرجات بالضبط

/** يتحقّق أن المعلم مصرَّح له فعلياً بهذا (الفرع/الصف/الشعبة/المادة) —
 * الأدمن بلا قيد. مطابق تماماً لنفس منطق التحقق المستخدَم بالتكاليف. */
function assertTeacherClassScope_(user, d) {
  if (user.role === 'role_admin') return;
  const inScope = user.branch === d.branch
    && (user.grades || []).includes(d.grade)
    && (user.sections || []).includes(d.section)
    && (user.subject || []).includes(d.subject);
  if (!inScope) {
    const e = new Error('لا تملك صلاحية الوصول لهذا الفرع/الصف/الشعبة/المادة');
    e.statusCode = 403;
    throw e;
  }
}

/** 🆕 يجيب الدرجة القصوى المُعرَّفة بتوزيع الدرجات لهذا (المادة + نوع
 * التقييم) — تُحفَظ كـSnapshot ثابت بالكشف وقت إنشائه (لا تتأثر بأي
 * تعديل لاحق على توزيع الدرجات، حفاظاً على النتائج التاريخية). */
async function getMaxScoreForEvalType_(subject, evalType) {
  const { data, error } = await supabaseAdmin.from('grade_distribution').select('max_grade').eq('subject', subject).eq('eval_type', evalType).maybeSingle();
  if (error) throw error;
  if (!data) {
    const e = new Error(`لا يوجد توزيع درجات مُعرَّف لمادة "${subject}" بنوع تقييم "${evalType}" — أضفه أولاً من الإعدادات ← توزيع الدرجات`);
    e.statusCode = 400;
    throw e;
  }
  return Number(data.max_grade);
}

/** 🆕 حساب الأساس الزمني الفعلي لكشف (آخر إعادة فتح إن وُجدت، وإلا وقت الإنشاء) + هل لسه ضمن مهلة اليوم */
function computeSheetEditability_(sheet) {
  const baseTime = (sheet.reopened_at && new Date(sheet.reopened_at) > new Date(sheet.created_at)) ? sheet.reopened_at : sheet.created_at;
  const windowEnd = new Date(new Date(baseTime).getTime() + SHEET_EDIT_WINDOW_MS);
  return { baseTime, windowEnd: windowEnd.toISOString(), isOpen: Date.now() <= windowEnd.getTime() };
}

/* -------------------- إنشاء كشف رصد جديد -------------------- */
async function handleCreateGradingSheet(req, res) {
  const user = requireAuth(req);
  requireRole(user, ['role_admin', 'role_teacher']);
  const d = validateBody(createGradingSheetSchema, req.body);
  assertTeacherClassScope_(user, d);

  const maxScore = await getMaxScoreForEvalType_(d.subject, d.evalType); // 🆕 Snapshot ثابت
  const { termId, weekId } = await resolveTermAndWeek_(d.recordDate);

  const { data: sheet, error: sheetError } = await supabaseAdmin.from('grading_sheets').insert({
    teacher_id: user.id, teacher_name: user.fullName, branch: d.branch, stage: d.stage || null,
    grade: d.grade, section: d.section, subject: d.subject, eval_type: d.evalType,
    title: d.title, description: d.description || null, max_score: maxScore,
    term_id: termId, week_id: weekId, record_date: d.recordDate, status: 'open',
  }).select('id').single();
  if (sheetError) throw sheetError;

  if (d.entries.length) {
    // 🆕 نجيب أسماء الطلاب لتخزينها مباشرة بالكشف (Snapshot — لا يتأثر لو تغيّر اسم الطالب لاحقاً)
    const studentIds = d.entries.map((e) => e.studentId);
    const { data: students } = await supabaseAdmin.from('students').select('id, name_ar').in('id', studentIds);
    const nameById = Object.fromEntries((students || []).map((s) => [s.id, s.name_ar]));

    for (const e of d.entries) {
      if (e.score !== null && e.score !== undefined && e.score > maxScore) {
        const err = new Error(`درجة الطالب لا يجب أن تتجاوز الدرجة الكلية (${maxScore})`);
        err.statusCode = 400;
        throw err;
      }
    }
    const rows = d.entries.map((e) => ({ sheet_id: sheet.id, student_id: e.studentId, student_name: nameById[e.studentId] || null, score: e.score ?? null, note: e.note || null }));
    const { error: entriesError } = await supabaseAdmin.from('grading_sheet_entries').insert(rows);
    if (entriesError) throw entriesError;
  }

  await supabaseAdmin.from('audit_log').insert({
    emp_id: user.id, emp_name: user.fullName, role: user.role,
    action: 'إنشاء كشف رصد مباشر', details: { sheetId: sheet.id, subject: d.subject, evalType: d.evalType, title: d.title, studentsCount: d.entries.length }, branch: user.branch,
  });

  // 🆕 نُحدِّث تجميع الدرجات لكل طالب فوراً بعد الإنشاء
  for (const e of d.entries) { if (e.score !== null && e.score !== undefined) await recomputeGradeAggregation_(e.studentId, d.subject); }

  return res.status(200).json({ success: true, data: { id: sheet.id } });
}

/* -------------------- قائمة كشوفاتي (أو الكل للأدمن) -------------------- */
async function handleListGradingSheets(req, res) {
  const user = requireAuth(req);
  requireRole(user, ['role_admin', 'role_teacher']);

  let query = supabaseAdmin.from('grading_sheets').select('*').order('created_at', { ascending: false });
  if (user.role !== 'role_admin') query = query.eq('teacher_id', user.id);

  const { data, error } = await query;
  if (error) throw error;

  const sheetIds = data.map((s) => s.id);
  let entryCounts = {};
  if (sheetIds.length) {
    const { data: entries } = await supabaseAdmin.from('grading_sheet_entries').select('sheet_id, score').in('sheet_id', sheetIds);
    (entries || []).forEach((e) => {
      if (!entryCounts[e.sheet_id]) entryCounts[e.sheet_id] = { total: 0, graded: 0 };
      entryCounts[e.sheet_id].total += 1;
      if (e.score !== null) entryCounts[e.sheet_id].graded += 1;
    });
  }

  const enriched = data.map((s) => {
    const editability = computeSheetEditability_(s);
    const counts = entryCounts[s.id] || { total: 0, graded: 0 };
    return { ...s, ...editability, studentsTotal: counts.total, studentsGraded: counts.graded };
  });
  return res.status(200).json({ success: true, data: enriched });
}

/* -------------------- تفاصيل كشف واحد -------------------- */
async function handleGetGradingSheetDetail(req, res) {
  const user = requireAuth(req);
  requireRole(user, ['role_admin', 'role_teacher']);
  const { sheetId } = validateBody(z.object({ sheetId: z.union([z.string(), z.number()]) }), req.body);

  const { data: sheet, error } = await supabaseAdmin.from('grading_sheets').select('*').eq('id', sheetId).single();
  if (error || !sheet) { const e = new Error('الكشف غير موجود'); e.statusCode = 404; throw e; }
  if (user.role !== 'role_admin' && sheet.teacher_id !== user.id) { const e = new Error('لا تملك صلاحية الوصول لهذا الكشف'); e.statusCode = 403; throw e; }

  const { data: entries, error: entriesError } = await supabaseAdmin.from('grading_sheet_entries').select('*').eq('sheet_id', sheetId).order('student_name');
  if (entriesError) throw entriesError;

  return res.status(200).json({ success: true, data: { sheet: { ...sheet, ...computeSheetEditability_(sheet) }, entries } });
}

/* -------------------- تعديل درجات كشف (ضمن مهلة اليوم فقط) -------------------- */
async function handleUpdateGradingSheetEntries(req, res) {
  const user = requireAuth(req);
  requireRole(user, ['role_admin', 'role_teacher']);
  const d = validateBody(updateGradingSheetEntriesSchema, req.body);

  const { data: sheet, error } = await supabaseAdmin.from('grading_sheets').select('*').eq('id', d.sheetId).single();
  if (error || !sheet) { const e = new Error('الكشف غير موجود'); e.statusCode = 404; throw e; }
  if (user.role !== 'role_admin' && sheet.teacher_id !== user.id) { const e = new Error('لا تملك صلاحية تعديل هذا الكشف'); e.statusCode = 403; throw e; }

  const editability = computeSheetEditability_(sheet);
  if (user.role !== 'role_admin' && !editability.isOpen) {
    const e = new Error('انتهت مهلة تعديل هذا الكشف (يوم كامل) — أرسل طلب إعادة فتح للأدمن');
    e.statusCode = 403;
    throw e;
  }

  for (const e of d.entries) {
    if (e.score !== null && e.score !== undefined && e.score > sheet.max_score) {
      const err = new Error(`الدرجة لا يجب أن تتجاوز الدرجة الكلية للكشف (${sheet.max_score})`);
      err.statusCode = 400;
      throw err;
    }
  }

  for (const e of d.entries) {
    const { error: upsertError } = await supabaseAdmin.from('grading_sheet_entries')
      .upsert({ sheet_id: d.sheetId, student_id: e.studentId, score: e.score ?? null, note: e.note || null }, { onConflict: 'sheet_id,student_id' });
    if (upsertError) throw upsertError;
  }
  await supabaseAdmin.from('grading_sheets').update({ updated_at: new Date().toISOString() }).eq('id', d.sheetId);

  await supabaseAdmin.from('audit_log').insert({
    emp_id: user.id, emp_name: user.fullName, role: user.role,
    action: 'تعديل درجات كشف رصد', details: { sheetId: d.sheetId, entriesCount: d.entries.length }, branch: user.branch,
  });

  for (const e of d.entries) { if (e.score !== null && e.score !== undefined) await recomputeGradeAggregation_(e.studentId, sheet.subject); }

  return res.status(200).json({ success: true, data: true });
}

/* -------------------- طلب إعادة فتح كشف مغلق -------------------- */
async function handleRequestSheetReopen(req, res) {
  const user = requireAuth(req);
  requireRole(user, ['role_teacher']);
  const d = validateBody(requestSheetReopenSchema, req.body);

  const { data: sheet, error } = await supabaseAdmin.from('grading_sheets').select('*').eq('id', d.sheetId).single();
  if (error || !sheet) { const e = new Error('الكشف غير موجود'); e.statusCode = 404; throw e; }
  if (sheet.teacher_id !== user.id) { const e = new Error('لا تملك صلاحية طلب فتح كشف معلم آخر'); e.statusCode = 403; throw e; }

  const editability = computeSheetEditability_(sheet);
  const { data: entries } = await supabaseAdmin.from('grading_sheet_entries').select('student_name, score').eq('sheet_id', d.sheetId);

  const { data: admins } = await supabaseAdmin.from('employees').select('id').eq('role', 'role_admin').is('deleted_at', null);
  if (!admins || !admins.length) { const e = new Error('لا يوجد حساب أدمن لاستقبال الطلب حالياً'); e.statusCode = 500; throw e; }

  const subject = `طلب إعادة فتح كشف رصد — ${sheet.title}`;
  const body = [
    `المعلم: ${user.fullName}`,
    `المادة: ${sheet.subject}`,
    `الصف/الشعبة: ${sheet.grade} / ${sheet.section}`,
    `نوع التقييم: ${sheet.eval_type}`,
    `عنوان الكشف: ${sheet.title}`,
    `تاريخ الإنشاء: ${new Date(sheet.created_at).toLocaleString('ar-SA-u-ca-gregory')}`,
    `وقت الإغلاق: ${new Date(editability.windowEnd).toLocaleString('ar-SA-u-ca-gregory')}`,
    `الدرجات الحالية: ${(entries || []).map((e) => `${e.student_name}: ${e.score ?? '—'}`).join('، ')}`,
    `سبب طلب إعادة الفتح: ${d.reason}`,
  ].join('\n');

  const { data: thread, error: threadError } = await supabaseAdmin.from('chat_threads').insert({
    subject, context_type: 'sheet_reopen_request', context_id: String(sheet.id),
    sender_id: user.id, sender_type: 'employee', branch: user.branch,
  }).select('id').single();
  if (threadError) throw threadError;

  await supabaseAdmin.from('chat_messages').insert({ thread_id: thread.id, sender_id: user.id, sender_type: 'employee', body, is_original: true });
  await supabaseAdmin.from('chat_recipients').insert(admins.map((a) => ({ thread_id: thread.id, recipient_id: a.id, recipient_type: 'employee' })));

  await supabaseAdmin.from('audit_log').insert({
    emp_id: user.id, emp_name: user.fullName, role: user.role,
    action: 'طلب إعادة فتح كشف رصد', details: { sheetId: sheet.id, reason: d.reason, threadId: thread.id }, branch: user.branch,
  });

  return res.status(200).json({ success: true, data: { threadId: thread.id } });
}

/* -------------------- الأدمن يعيد فتح كشف -------------------- */
async function handleReopenGradingSheet(req, res) {
  const user = requireAuth(req);
  requireRole(user, ['role_admin']);
  const { sheetId } = validateBody(z.object({ sheetId: z.union([z.string(), z.number()]) }), req.body);

  const { data: sheet, error } = await supabaseAdmin.from('grading_sheets').select('id').eq('id', sheetId).single();
  if (error || !sheet) { const e = new Error('الكشف غير موجود'); e.statusCode = 404; throw e; }

  const now = new Date().toISOString();
  const { error: updateError } = await supabaseAdmin.from('grading_sheets').update({ reopened_at: now, reopened_by: user.id, status: 'open' }).eq('id', sheetId);
  if (updateError) throw updateError;

  const windowEnd = new Date(Date.now() + SHEET_EDIT_WINDOW_MS).toISOString();
  await supabaseAdmin.from('audit_log').insert({
    emp_id: user.id, emp_name: user.fullName, role: user.role,
    action: 'إعادة فتح كشف رصد', details: { sheetId, reopenedAt: now, windowEnd }, branch: user.branch,
  });

  return res.status(200).json({ success: true, data: { windowEnd } });
}

/* -------------------- قائمة طلاب لإنشاء كشف جديد (ضمن نطاق المعلم) -------------------- */
async function handleListStudentsForGradingSheet(req, res) {
  const user = requireAuth(req);
  requireRole(user, ['role_admin', 'role_teacher']);
  const { branch, grade, section } = validateBody(z.object({
    branch: z.string().min(1), grade: z.string().min(1), section: z.string().min(1),
  }), req.body);
  assertTeacherClassScope_(user, { branch, grade, section, subject: (user.subject || [])[0] || '' }); // 🆕 فحص تقريبي — الفحص الدقيق بالمادة يحصل وقت الإنشاء الفعلي

  const { data, error } = await supabaseAdmin.from('students').select('id, name_ar')
    .eq('branch', branch).eq('grade', grade).eq('section', section).is('deleted_at', null).order('name_ar');
  if (error) throw error;
  return res.status(200).json({ success: true, data });
}

/* -------------------- 🆕 الرصد الموحَّد: تكاليف/اختبارات + كشوفات مباشرة معاً -------------------- */
async function handleListUnifiedGradingRecords(req, res) {
  const user = requireAuth(req);
  requireRole(user, ['role_admin', 'role_teacher']);

  let assignmentsQuery = supabaseAdmin.from('assignments').select('*').gt('max_score', 0);
  if (user.role !== 'role_admin') assignmentsQuery = assignmentsQuery.eq('teacher_id', user.id);
  const { data: assignments, error: aError } = await assignmentsQuery;
  if (aError) throw aError;

  let sheetsQuery = supabaseAdmin.from('grading_sheets').select('*');
  if (user.role !== 'role_admin') sheetsQuery = sheetsQuery.eq('teacher_id', user.id);
  const { data: sheets, error: sError } = await sheetsQuery;
  if (sError) throw sError;

  const assignmentIds = assignments.map((a) => a.id);
  const sheetIds = sheets.map((s) => s.id);
  const [{ data: aGrades }, { data: sEntries }, { data: aQuestions }] = await Promise.all([
    assignmentIds.length ? supabaseAdmin.from('assignment_grades').select('assignment_id, score').in('assignment_id', assignmentIds) : { data: [] },
    sheetIds.length ? supabaseAdmin.from('grading_sheet_entries').select('sheet_id, score').in('sheet_id', sheetIds) : { data: [] },
    assignmentIds.length ? supabaseAdmin.from('assignment_questions').select('assignment_id, answer_type').in('assignment_id', assignmentIds) : { data: [] },
  ]);

  const countBySource = (rows, key) => {
    const map = {};
    (rows || []).forEach((r) => { if (!map[r[key]]) map[r[key]] = { total: 0, graded: 0 }; map[r[key]].total++; if (r.score !== null) map[r[key]].graded++; });
    return map;
  };
  const aCounts = countBySource(aGrades, 'assignment_id');
  const sCounts = countBySource(sEntries, 'sheet_id');
  const qByAssignment = {};
  (aQuestions || []).forEach((q) => { (qByAssignment[q.assignment_id] = qByAssignment[q.assignment_id] || []).push(q.answer_type); });

  const fromAssignments = assignments.map((a) => {
    const types = qByAssignment[a.id] || [];
    const counts = aCounts[a.id] || { total: 0, graded: 0 };
    return {
      source: 'assignment', id: a.id, title: a.title, subject: a.subject, grade: a.grade, section: a.section,
      evalType: a.eval_type, maxScore: a.max_score, isAutoGradable: types.length > 0 && types.every((t) => t === 'mcq' || t === 'true_false'),
      studentsTotal: counts.total, studentsGraded: counts.graded, createdAt: a.published_at,
    };
  });
  const fromSheets = sheets.map((s) => {
    const counts = sCounts[s.id] || { total: 0, graded: 0 };
    return {
      source: 'sheet', id: s.id, title: s.title, subject: s.subject, grade: s.grade, section: s.section,
      evalType: s.eval_type, maxScore: s.max_score, isAutoGradable: false,
      studentsTotal: counts.total, studentsGraded: counts.graded, createdAt: s.created_at,
      ...computeSheetEditability_(s),
    };
  });

  const combined = [...fromAssignments, ...fromSheets].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return res.status(200).json({ success: true, data: combined });
}

/* -------------------- 🆕 المشاركة والتفاعل (سجل تراكمي مستقل عن التكاليف) -------------------- */
// كل قيد "إشارة" فقط (إيجابي/سلبي) — لا قيمة رقمية حرة. الدرجة المستحقة
// تُحسَب بمعادلة نسبية (إيجابي ÷ إجمالي) مُرجَّحة بوزن "المشاركة والتفاعل"
// المُعرَّف بتوزيع الدرجات — تلقائياً ضمن recomputeGradeAggregation_.

async function handleAddParticipationEntry(req, res) {
  const user = requireAuth(req);
  requireRole(user, ['role_admin', 'role_teacher']);
  const d = validateBody(z.object({
    studentId: z.string().min(1), subject: z.string().trim().min(1), evalType: z.string().trim().min(1),
    direction: z.enum(['positive', 'negative']), participationType: z.string().trim().max(50).optional().nullable(), note: z.string().trim().max(300).optional().nullable(),
  }), req.body);

  const { data: student, error: sError } = await supabaseAdmin.from('students').select('*').eq('id', d.studentId).single();
  if (sError || !student) {
    const e = new Error('الطالب غير موجود');
    e.statusCode = 404;
    throw e;
  }
  if (user.role === 'role_teacher') {
    const inScope = user.branch === student.branch && (user.grades || []).includes(student.grade) && (user.sections || []).includes(student.section) && (user.subject || []).includes(d.subject);
    if (!inScope) {
      const e = new Error('لا تملك صلاحية تسجيل مشاركة لهذا الطالب/المادة');
      e.statusCode = 403;
      throw e;
    }
  }

  const { error } = await supabaseAdmin.from('participation_log').insert({
    student_id: student.id, student_name: student.name_ar, subject: d.subject, eval_type: d.evalType,
    branch: student.branch, stage: student.stage, grade: student.grade, section: student.section,
    direction: d.direction, participation_type: d.participationType || null, note: d.note || null, recorded_by: user.id, recorded_by_name: user.fullName,
  });
  if (error) throw error;

  await supabaseAdmin.from('audit_log').insert({
    emp_id: user.id, emp_name: user.fullName, role: user.role,
    action: d.direction === 'positive' ? 'تسجيل مشاركة إيجابية' : 'تسجيل مشاركة سلبية',
    details: { studentId: d.studentId, subject: d.subject, evalType: d.evalType }, branch: user.branch,
  });
  await recomputeGradeAggregation_(d.studentId, d.subject); // 🆕 إعادة حساب فورية
  return res.status(200).json({ success: true, data: true });
}

async function handleListParticipationLog(req, res) {
  const user = requireAuth(req);
  requireRole(user, ['role_admin', 'role_teacher']);
  const { studentId, subject } = validateBody(z.object({ studentId: z.string().min(1), subject: z.string().trim().min(1) }), req.body);

  const { data, error } = await supabaseAdmin.from('participation_log').select('*')
    .eq('student_id', studentId).eq('subject', subject).order('recorded_at', { ascending: false });
  if (error) throw error;
  return res.status(200).json({ success: true, data });
}

async function handleDeleteParticipationEntry(req, res) {
  const user = requireAuth(req);
  requireRole(user, ['role_admin', 'role_teacher']);
  const { id } = validateBody(z.object({ id: z.union([z.string(), z.number()]) }), req.body);

  const { data: existing, error: fetchError } = await supabaseAdmin.from('participation_log').select('*').eq('id', id).single();
  if (fetchError || !existing) {
    const e = new Error('القيد غير موجود');
    e.statusCode = 404;
    throw e;
  }
  if (user.role !== 'role_admin') {
    if (existing.recorded_by !== user.id) {
      const e = new Error('لا تملك صلاحية حذف قيد معلم آخر');
      e.statusCode = 403;
      throw e;
    }
    assertWithinWindow_(existing.recorded_at, GRADE_DELETE_WINDOW_MS, 'حذف قيد المشاركة');
  }

  const { error } = await supabaseAdmin.from('participation_log').delete().eq('id', id);
  if (error) throw error;

  await supabaseAdmin.from('audit_log').insert({
    emp_id: user.id, emp_name: user.fullName, role: user.role,
    action: 'حذف قيد مشاركة', details: { id }, branch: user.branch,
  });
  await recomputeGradeAggregation_(existing.student_id, existing.subject); // 🆕 إعادة حساب فورية
  return res.status(200).json({ success: true, data: true });
}

/* -------------------- 🆕 أداء الطلاب (تقارير — كل الصلاحيات بحدود) -------------------- */
// كل الأدوار تصل لهذي الصفحة، لكن بنطاق مختلف تماماً:
// أدمن: بلا قيد. مراقب فروع: فروعه المُسندة. مشرف معلمين/مشرف طلاب:
// فرعهم فقط. معلم: فرعه + (الصف/الشعبة) اللي يدرّسهم فقط.
const PERFORMANCE_VIEW_ROLES = ['role_admin', 'role_teacher', 'role_student_sup', 'role_teacher_sup', 'role_branch_monitor'];

/** 🆕 يتحقّق أن (فرع/صف/شعبة) الطالب المستهدَف ضمن نطاق صلاحية المستخدم */
function assertStudentInPerformanceScope_(user, student) {
  if (user.role === 'role_admin') return;
  if (user.role === 'role_branch_monitor') {
    if (!(user.allBranches || []).includes(student.branch)) {
      const e = new Error('هذا الطالب خارج نطاق فروعك');
      e.statusCode = 403;
      throw e;
    }
    return;
  }
  if (user.role === 'role_teacher_sup' || user.role === 'role_student_sup') {
    if (user.branch !== student.branch) {
      const e = new Error('هذا الطالب خارج نطاق فرعك');
      e.statusCode = 403;
      throw e;
    }
    return;
  }
  if (user.role === 'role_teacher') {
    const inScope = user.branch === student.branch && (user.grades || []).includes(student.grade) && (user.sections || []).includes(student.section);
    if (!inScope) {
      const e = new Error('هذا الطالب خارج نطاق الصفوف التي تدرّسها');
      e.statusCode = 403;
      throw e;
    }
    return;
  }
  const e = new Error('لا تملك صلاحية الوصول لهذي الصفحة');
  e.statusCode = 403;
  throw e;
}

/** 🆕 يبني فلتر (فرع + صف/شعبة اختيارية) لاستعلامات القوائم بحسب نطاق المستخدم */
function buildPerformanceScopeFilter_(user) {
  if (user.role === 'role_admin') return {};
  if (user.role === 'role_branch_monitor') return { branchIn: user.allBranches || [] };
  if (user.role === 'role_teacher_sup' || user.role === 'role_student_sup') return { branch: user.branch };
  if (user.role === 'role_teacher') return { branch: user.branch, gradesIn: user.grades || [], sectionsIn: user.sections || [] };
  return { branch: '__none__' }; // 🆕 دور غير مصرَّح — لا يطابق أي شيء
}

async function handleSearchStudentsForPerformance(req, res) {
  const user = requireAuth(req);
  requireRole(user, PERFORMANCE_VIEW_ROLES);
  const { query, branch, grade, section } = validateBody(z.object({
    query: z.string().trim().max(100).optional(),
    branch: z.string().trim().optional(), grade: z.string().trim().optional(), section: z.string().trim().optional(),
  }), req.body);

  const scope = buildPerformanceScopeFilter_(user);
  let q = supabaseAdmin.from('students').select('id, name_ar, branch, stage, grade, section').is('deleted_at', null).order('name_ar').limit(50);

  if (scope.branch === '__none__') return res.status(200).json({ success: true, data: [] });
  if (scope.branch) q = q.eq('branch', scope.branch);
  if (scope.branchIn) q = q.in('branch', scope.branchIn);
  if (scope.gradesIn) q = q.in('grade', scope.gradesIn);
  if (scope.sectionsIn) q = q.in('section', scope.sectionsIn);

  if (branch) q = q.eq('branch', branch);
  if (grade) q = q.eq('grade', grade);
  if (section) q = q.eq('section', section);
  if (query) q = q.ilike('name_ar', `%${query}%`);

  const { data, error } = await q;
  if (error) throw error;
  return res.status(200).json({ success: true, data });
}

async function handleGetStudentPerformanceReport(req, res) {
  const user = requireAuth(req);
  requireRole(user, PERFORMANCE_VIEW_ROLES);
  const { studentId } = validateBody(z.object({ studentId: z.string().min(1) }), req.body);

  const { data: student, error: sError } = await supabaseAdmin.from('students').select('*').eq('id', studentId).single();
  if (sError || !student) {
    const e = new Error('الطالب غير موجود');
    e.statusCode = 404;
    throw e;
  }
  assertStudentInPerformanceScope_(user, student);

  const [{ data: grades }, { data: behavior }, { data: attendance }] = await Promise.all([
    supabaseAdmin.from('grade_aggregation_results').select('*').eq('student_id', studentId).order('subject'),
    supabaseAdmin.from('student_behavior').select('type, points').eq('student_id', studentId),
    supabaseAdmin.from('attendance').select('status').eq('person_id', studentId).eq('person_type', 'student'),
  ]);

  const behaviorSummary = (behavior || []).reduce((acc, b) => {
    acc[b.type === 'positive' ? 'positivePoints' : 'negativePoints'] += Number(b.points) || 0;
    return acc;
  }, { positivePoints: 0, negativePoints: 0 });

  const attendanceSummary = (attendance || []).reduce((acc, a) => { acc[a.status] = (acc[a.status] || 0) + 1; return acc; }, {});

  return res.status(200).json({
    success: true,
    data: {
      student: { id: student.id, name: student.name_ar, branch: student.branch, stage: student.stage, grade: student.grade, section: student.section },
      grades: grades || [], behaviorSummary, attendanceSummary,
    },
  });
}

async function handleGetClassPerformanceSummary(req, res) {
  const user = requireAuth(req);
  requireRole(user, PERFORMANCE_VIEW_ROLES);
  const d = validateBody(z.object({
    branch: z.string().trim().min(1), stage: z.string().trim().min(1), grade: z.string().trim().min(1), section: z.string().trim().min(1),
  }), req.body);

  assertStudentInPerformanceScope_(user, d); // 🆕 نفس منطق فحص النطاق (يقبل كائن بحقول branch/grade/section)

  const { data: students, error: sError } = await supabaseAdmin.from('students').select('id, name_ar')
    .eq('branch', d.branch).eq('stage', d.stage).eq('grade', d.grade).eq('section', d.section).is('deleted_at', null).order('name_ar');
  if (sError) throw sError;

  const ids = (students || []).map((s) => s.id);
  let grades = [];
  if (ids.length) {
    const { data: gradesData, error: gError } = await supabaseAdmin.from('grade_aggregation_results').select('student_id, subject, final_grade').in('student_id', ids);
    if (gError) throw gError;
    grades = gradesData || [];
  }

  const bySubject = {};
  grades.forEach((g) => { bySubject[g.subject] = true; });
  const subjects = Object.keys(bySubject).sort();

  const roster = (students || []).map((s) => {
    const studentGrades = grades.filter((g) => g.student_id === s.id);
    const average = studentGrades.length ? Math.round((studentGrades.reduce((sum, g) => sum + Number(g.final_grade), 0) / studentGrades.length) * 100) / 100 : null;
    return { studentId: s.id, studentName: s.name_ar, average, bySubject: Object.fromEntries(studentGrades.map((g) => [g.subject, g.final_grade])) };
  });

  return res.status(200).json({ success: true, data: { subjects, roster } });
}

/* -------------------- 🆕 إحصائيات التسجيل — أدمن (كل الفروع) + إدارة القبول (فرعها فقط) -------------------- */

async function handleGetRegistrationStats(req, res) {
  const user = requireAuth(req);
  requireRole(user, ['role_admin', 'Admission']);
  const isAdmin = user.role === 'role_admin';

  let studentsQuery = supabaseAdmin.from('students').select('branch, grade, fee_status').is('deleted_at', null);
  if (!isAdmin) studentsQuery = studentsQuery.eq('branch', user.branch); // 🆕 إدارة القبول مقيَّدة بفرعها فقط
  const { data: students, error: sError } = await studentsQuery;
  if (sError) throw sError;

  const countBy = (arr, key) => {
    const map = {};
    arr.forEach((row) => { const k = row[key] || 'غير محدَّد'; map[k] = (map[k] || 0) + 1; });
    return Object.entries(map).map(([label, count]) => ({ label, count }));
  };

  const payload = {
    totalStudents: students.length,
    studentsByBranch: isAdmin ? countBy(students, 'branch') : [],
    studentsByGrade: countBy(students, 'grade'),
    feeStatusBreakdown: countBy(students, 'fee_status'),
  };

  // 🆕 الموظفون وأولياء الأمور — للأدمن فقط، كل الفروع
  if (isAdmin) {
    const { data: employees, error: eError } = await supabaseAdmin.from('employees').select('branch, role').is('deleted_at', null);
    if (eError) throw eError;
    const { data: parents, error: pError } = await supabaseAdmin.from('parent_info').select('branch').is('deleted_at', null);
    if (pError) throw pError;

    payload.totalEmployees = employees.length;
    payload.employeesByBranch = countBy(employees, 'branch');
    payload.employeesByRole = countBy(employees, 'role');
    payload.totalParents = parents.length;
    payload.parentsByBranch = countBy(parents, 'branch');
  }

  return res.status(200).json({ success: true, data: payload });
}

export default createRouter({
  listMatrix: handleListMatrix,
  addMatrixEntries: handleAddMatrixEntries,
  deleteMatrixEntry: handleDeleteMatrixEntry,
  listSubjectsForClass: handleListSubjectsForClass,
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
  listHolidaysForTerm: handleListHolidaysForTerm,
  addHoliday: handleAddHoliday,
  updateHoliday: handleUpdateHoliday,
  deleteHoliday: handleDeleteHoliday,
  listCalendarData: handleListCalendarData,
  listStaffForScheduling: handleListStaffForScheduling,
  listClassSchedule: handleListClassSchedule,
  saveClassScheduleEntry: handleSaveClassScheduleEntry,
  deleteClassScheduleEntry: handleDeleteClassScheduleEntry,
  listExamSchedule: handleListExamSchedule,
  saveExamScheduleEntry: handleSaveExamScheduleEntry,
  deleteExamScheduleEntry: handleDeleteExamScheduleEntry,
  listAssignments: handleListAssignments,
  listAssignmentQuestions: handleListAssignmentQuestions,
  saveAssignment: handleSaveAssignment,
  deleteAssignment: handleDeleteAssignment,
  updateAssignmentMaxScore: handleUpdateAssignmentMaxScore,
  listAssignmentRoster: handleListAssignmentRoster,
  saveAssignmentGrade: handleSaveAssignmentGrade,
  deleteAssignmentGrade: handleDeleteAssignmentGrade,
  requestGradeEditReopen: handleRequestGradeEditReopen,
  reopenGradeEdit: handleReopenGradeEdit,
  createGradingSheet: handleCreateGradingSheet,
  listGradingSheets: handleListGradingSheets,
  getGradingSheetDetail: handleGetGradingSheetDetail,
  updateGradingSheetEntries: handleUpdateGradingSheetEntries,
  requestSheetReopen: handleRequestSheetReopen,
  reopenGradingSheet: handleReopenGradingSheet,
  listStudentsForGradingSheet: handleListStudentsForGradingSheet,
  listUnifiedGradingRecords: handleListUnifiedGradingRecords,
  addParticipationEntry: handleAddParticipationEntry,
  listParticipationLog: handleListParticipationLog,
  deleteParticipationEntry: handleDeleteParticipationEntry,
  searchStudentsForPerformance: handleSearchStudentsForPerformance,
  getStudentPerformanceReport: handleGetStudentPerformanceReport,
  getClassPerformanceSummary: handleGetClassPerformanceSummary,
  getRegistrationStats: handleGetRegistrationStats,
});
