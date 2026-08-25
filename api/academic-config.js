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
} from '../lib/validation.js';

/* -------------------- 🆕 صلاحيات التكاليف/المهام/الاختبارات/الإثراء -------------------- */
// عرض: أدمن (بلا قيد) + معلم (تكاليفه هو فقط) + 3 أدوار إشراف (عرض فقط
// بفرعهم/فروعهم). كتابة (إضافة/تعديل/حذف): أدمن + معلم فقط — الإشراف
// عرض فقط ولا يصل إطلاقاً لإجراءات الكتابة أدناه.
const ASSIGNMENT_VIEW_ROLES = ['role_admin', 'role_teacher', 'role_student_sup', 'role_teacher_sup', 'role_branch_monitor'];
const ASSIGNMENT_WRITE_ROLES = ['role_admin', 'role_teacher'];
const ASSIGNMENT_EDIT_WINDOW_MS = 60 * 60 * 1000;       // 🆕 ساعة واحدة من لحظة النشر
const ASSIGNMENT_DELETE_WINDOW_MS = 30 * 60 * 1000;     // 🆕 نصف ساعة من لحظة النشر
const GRADE_EDIT_WINDOW_MS = 6 * 60 * 60 * 1000;        // 🆕 6 ساعات من لحظة الرصد
const GRADE_DELETE_WINDOW_MS = 30 * 60 * 1000;          // 🆕 نصف ساعة من لحظة الرصد

/** 🆕 يتحقق أن المعلم مصرَّح له بالضبط بهذا (الفرع/الصف/الشعبة/المادة) —
 * بحسب مصفوفة grades/sections/subject المخزَّنة بجلسته (JWT). الأدمن بلا قيد. */
function assertTeacherScopeForAssignment_(user, d) {
  if (user.role === 'role_admin') return;
  const inScope = user.branch === d.branch
    && (user.grades || []).includes(d.grade)
    && (user.sections || []).includes(d.section)
    && (user.subject || []).includes(d.subject);
  if (!inScope) {
    const e = new Error('لا تملك صلاحية النشر لهذا الفرع/الصف/الشعبة/المادة');
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
  if (ids.length) {
    const { data: grades, error: gradesError } = await supabaseAdmin.from('assignment_grades').select('assignment_id').in('assignment_id', ids);
    if (gradesError) throw gradesError;
    (grades || []).forEach((g) => { counts[g.assignment_id] = (counts[g.assignment_id] || 0) + 1; });
  }

  const enriched = (assignments || []).map((a) => ({ ...a, participants_count: counts[a.id] || 0 }));
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

  const { data: assignment, error: aError } = await supabaseAdmin.from('assignments').select('teacher_id, max_score').eq('id', d.assignmentId).single();
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
    assertWithinWindow_(existingGrade.recorded_at, GRADE_EDIT_WINDOW_MS, 'تعديل الدرجة');
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
    action: 'رصد درجة تكليف', details: { assignmentId: d.assignmentId, studentId: d.studentId, score: d.score }, branch: user.branch,
  });
  return res.status(200).json({ success: true, data: true });
}

async function handleDeleteAssignmentGrade(req, res) {
  const user = requireAuth(req);
  requireRole(user, ['role_admin', 'role_teacher']);
  const { assignmentId, studentId } = validateBody(z.object({
    assignmentId: z.union([z.string(), z.number()]), studentId: z.string().min(1),
  }), req.body);

  const { data: existingGrade, error: fetchError } = await supabaseAdmin.from('assignment_grades').select('*, assignments!inner(teacher_id)')
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
  listAssignmentRoster: handleListAssignmentRoster,
  saveAssignmentGrade: handleSaveAssignmentGrade,
  deleteAssignmentGrade: handleDeleteAssignmentGrade,
});
