// api/attendance.js
// =====================================================================
// إجراءات: listForDate, save (تسجيل جماعي ليوم واحد), updateOne (تعديل
// حالة شخص واحد). يخدم حضور الطلاب وحضور الموظفين معاً — الفرق فقط
// بـ personType بالطلب. منطق الصلاحيات هنا مطابق تماماً لخارطة الأدوار
// الموثَّقة بـ public/js/app.js (فوق PAGE_REGISTRY) — أي تعديل مستقبلي
// لهذا الملف يجب يرجع لتلك الوثيقة أولاً.
// =====================================================================

import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { requireAuth } from '../lib/auth.js';
import { createRouter } from '../lib/router.js';
import { validateBody, saveAttendanceSchema, updateAttendanceSchema, listAttendanceForDateSchema, listStudentRosterSchema, listStaffRosterSchema } from '../lib/validation.js';

const EDIT_WINDOW_MINUTES = 30;

/** 🆕 يتحقّق: هل هذا المستخدم مصرَّح له يتعامل مع حضور هذا النوع (طالب/موظف) بهذا الفرع/الصف؟
 * يرمي خطأ 403 لو لا. يُرجِع { unrestricted: boolean } — true يعني بلا قيد وقت بالتعديل. */
function checkAttendanceAccess(user, { personType, branch, grade, section, targetRole }) {
  if (user.role === 'role_admin') return { unrestricted: true };

  if (personType === 'student') {
    if (user.role === 'role_teacher') {
      const teachesThis = (user.grades || []).includes(grade) && (user.sections || []).includes(section);
      if (!teachesThis) { const e = new Error('غير مصرَّح لك بهذا الصف/الشعبة'); e.statusCode = 403; throw e; }
      return { unrestricted: false }; // 🆕 المعلم: نافذة 30 دقيقة فقط
    }
    if (user.role === 'role_student_sup') {
      if (user.branch !== branch) { const e = new Error('غير مصرَّح لك بهذا الفرع'); e.statusCode = 403; throw e; }
      return { unrestricted: true }; // 🆕 مشرف الطلاب: بلا قيد وقت
    }
  }

  if (personType === 'employee') {
    if (user.role === 'role_teacher_sup') {
      if (user.branch !== branch || targetRole !== 'role_teacher') { const e = new Error('غير مصرَّح لك بهذا'); e.statusCode = 403; throw e; }
      return { unrestricted: true };
    }
    if (user.role === 'role_branch_monitor') {
      const allowedBranches = user.allBranches || [user.branch];
      if (!allowedBranches.includes(branch) || !['role_teacher_sup', 'role_student_sup'].includes(targetRole)) {
        const e = new Error('غير مصرَّح لك بهذا'); e.statusCode = 403; throw e;
      }
      return { unrestricted: true };
    }
  }

  const e = new Error('دورك لا يملك صلاحية الوصول لهذي الصفحة');
  e.statusCode = 403;
  throw e;
}

/* -------------------- عرض حضور يوم معيّن -------------------- */
async function handleListForDate(req, res) {
  const user = requireAuth(req);
  const { date, personType, branch, grade, section, targetRole } = validateBody(listAttendanceForDateSchema, req.body); // 🆕 كان يُقرَأ بلا تحقق
  checkAttendanceAccess(user, { personType, branch, grade, section, targetRole });

  let query = supabaseAdmin.from('attendance').select('*').eq('date', date).eq('person_type', personType).eq('branch', branch);
  if (grade) query = query.eq('grade', grade);
  if (section) query = query.eq('section', section);
  if (targetRole) query = query.eq('target_role', targetRole);

  const { data, error } = await query;
  if (error) throw error;
  return res.status(200).json({ success: true, data });
}

/** 🆕 يجيب الفصل والأسبوع الدراسي الفعليين اللي يقع فيهما تاريخ معيّن —
 * الربط الحقيقي المطلوب بين الحضور والتقويم الدراسي (لا الاكتفاء بترك
 * الحقول فارغة). لو التاريخ خارج أي فصل/أسبوع مُعرَّف (مثلاً التقويم لسه
 * ما اكتمل)، يُرجِع قيم فارغة بلا رمي أي خطأ — تسجيل الحضور يستمر بلا
 * توقّف حتى لو التقويم غير مكتمل بعد. */
async function resolveTermAndWeek_(dateStr) {
  const { data: term } = await supabaseAdmin.from('academic_terms').select('id, name')
    .lte('start_date', dateStr).gte('end_date', dateStr).limit(1).maybeSingle();
  if (!term) return { termId: null, termName: null, weekId: null, weekLabel: null };

  const { data: week } = await supabaseAdmin.from('academic_weeks').select('id, label, week_number')
    .eq('term_id', term.id).lte('start_date', dateStr).gte('end_date', dateStr).limit(1).maybeSingle();

  return {
    termId: term.id, termName: term.name,
    weekId: week ? week.id : null, weekLabel: week ? (week.label || `الأسبوع ${week.week_number}`) : null,
  };
}

/* -------------------- تسجيل حضور جماعي ليوم واحد -------------------- */
async function handleSave(req, res) {
  const user = requireAuth(req);
  const d = validateBody(saveAttendanceSchema, req.body);
  checkAttendanceAccess(user, d);

  const { termId, termName, weekId, weekLabel } = await resolveTermAndWeek_(d.date); // 🆕 ربط حقيقي بالتقويم الدراسي

  const rows = d.entries.map((e) => ({
    person_id: e.personId, person_type: d.personType, date: d.date, status: e.status,
    branch: d.branch, grade: d.grade || null, section: d.section || null, target_role: d.targetRole || null,
    recorded_by: user.id, recorded_by_emp_id: user.id, recorded_at: new Date().toISOString(), // 🆕 recorded_by_emp_id عمود ذو معنى حقيقي (مرجع الموظف) — كان يُترَك فارغاً بالخطأ
    term_id: termId, term: termName, week_id: weekId, week: weekLabel, // 🆕
  }));

  // 🆕 upsert — لو الشخص مسجَّل حضوره أصلاً بنفس اليوم، يُحدَّث بدل تكرار الصف (يطابق قيد UNIQUE بالجدول)
  const { error } = await supabaseAdmin.from('attendance').upsert(rows, { onConflict: 'person_id,person_type,date' });
  if (error) throw error;

  await supabaseAdmin.from('audit_log').insert({
    emp_id: user.id, emp_name: user.fullName, role: user.role,
    action: `تسجيل حضور ${d.personType === 'student' ? 'طلاب' : 'موظفين'}`, details: { date: d.date, count: rows.length, branch: d.branch }, branch: user.branch,
  });
  return res.status(200).json({ success: true, data: true });
}

/* -------------------- تعديل حالة شخص واحد -------------------- */
async function handleUpdateOne(req, res) {
  const user = requireAuth(req);
  const { id, status } = validateBody(updateAttendanceSchema, req.body);

  const { data: existing } = await supabaseAdmin.from('attendance').select('*').eq('id', id).maybeSingle();
  if (!existing) { const e = new Error('السجل غير موجود'); e.statusCode = 404; throw e; }

  const access = checkAttendanceAccess(user, {
    personType: existing.person_type, branch: existing.branch, grade: existing.grade, section: existing.section, targetRole: existing.target_role,
  });

  // 🆕 نافذة الـ30 دقيقة — تُطبَّق فقط لو access.unrestricted === false (المعلم تحديداً)
  if (!access.unrestricted) {
    const minutesPassed = (Date.now() - new Date(existing.recorded_at).getTime()) / 60000;
    if (minutesPassed > EDIT_WINDOW_MINUTES) {
      const e = new Error(`انتهت مهلة التعديل (${EDIT_WINDOW_MINUTES} دقيقة من وقت التسجيل)`);
      e.statusCode = 403;
      throw e;
    }
  }

  const { error } = await supabaseAdmin.from('attendance').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;

  await supabaseAdmin.from('audit_log').insert({
    emp_id: user.id, emp_name: user.fullName, role: user.role,
    action: 'تعديل حالة حضور', details: { attendanceId: id, newStatus: status }, branch: user.branch,
  });
  return res.status(200).json({ success: true, data: true });
}

/* -------------------- قوائم مصغَّرة للتحضير فقط (اسم + معرِّف، بلا أي بيانات حساسة) -------------------- */
async function handleListStudentRoster(req, res) {
  const user = requireAuth(req);
  const { branch, grade, section } = validateBody(listStudentRosterSchema, req.body); // 🆕 كان يُقرَأ بلا تحقق
  checkAttendanceAccess(user, { personType: 'student', branch, grade, section });

  const { data, error } = await supabaseAdmin.from('students').select('id, name_ar, grade, section')
    .eq('branch', branch).eq('grade', grade).eq('section', section).is('deleted_at', null);
  if (error) throw error;
  return res.status(200).json({ success: true, data });
}

async function handleListStaffRoster(req, res) {
  const user = requireAuth(req);
  const { branch, targetRole } = validateBody(listStaffRosterSchema, req.body); // 🆕 كان يُقرَأ بلا تحقق
  checkAttendanceAccess(user, { personType: 'employee', branch, targetRole });

  const { data, error } = await supabaseAdmin.from('employees').select('id, name_ar, role')
    .eq('branch', branch).eq('role', targetRole).is('deleted_at', null);
  if (error) throw error;
  return res.status(200).json({ success: true, data });
}

export default createRouter({
  listForDate: handleListForDate,
  save: handleSave,
  updateOne: handleUpdateOne,
  listStudentRoster: handleListStudentRoster,
  listStaffRoster: handleListStaffRoster,
});
