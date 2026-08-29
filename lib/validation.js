// lib/validation.js
// =====================================================================
// كل مدخلات أي دالة API تمر عبر مخطط Zod هنا أولاً — لا يصل أي منطق
// عمل (Business Logic) لأي قيمة لم تُفحَص شكلاً ونوعاً بدقة.
// =====================================================================

import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().trim().min(1, 'اسم المستخدم مطلوب').max(100),
  password: z.string().min(1, 'كلمة المرور مطلوبة').max(200),
});

// 🆕 يعادل بالضبط قاعدة forceSetNewPassword بـGAS: 6 أحرف كحد أدنى
export const forceSetNewPasswordSchema = z.object({
  newPassword: z.string().min(6, 'كلمة المرور الجديدة يجب ألا تقل عن 6 أحرف').max(200),
});

// 🆕 لإدارة قوائم الإعدادات (فروع/صفوف/مواد...) — الأدمن فقط
export const updateSettingsListSchema = z.object({
  listKey: z.enum([
    'branches', 'stages', 'grades', 'sections', 'subjects', 'user_types',
    'roles', 'account_statuses', 'attendance_statuses', 'terms',
    'behavior_statuses', 'continuous_eval_types', 'exams',
  ]),
  values: z.array(z.string().trim().min(1)).min(1, 'يجب إدخال قيمة واحدة على الأقل'),
});

export const updateSiteSettingsSchema = z.object({
  schoolName: z.string().trim().min(1).max(200).optional(),
  logoUrl: z.string().trim().url('رابط الشعار غير صحيح').max(500).optional().or(z.literal('')),
  allowMessageImages: z.boolean().optional(), // 🆕 تفعيل/تعطيل إرسال الصور بالمراسلات — مركزي لكل الموقع
});

// 🆕 بحث ذكي عن مستلمي المراسلات — مقيَّد بالصلاحية من الاستعلام نفسه
// 🆕 كشف رصد مباشر — تقييمات خارج نظام التكاليف (اختبار ورقي، شفهي...)
export const createGradingSheetSchema = z.object({
  branch: z.string().trim().min(1), stage: z.string().trim().optional(),
  grade: z.string().trim().min(1), section: z.string().trim().min(1), subject: z.string().trim().min(1),
  evalType: z.string().trim().min(1), title: z.string().trim().min(2).max(200), description: z.string().trim().max(1000).optional().nullable(),
  recordDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'صيغة التاريخ غير صحيحة'),
  manualMaxScore: z.number().positive('الدرجة الكلية يجب أن تكون أكبر من صفر').max(1000).optional(), // 🆕 تحديد الدرجة العظمى يدوياً (اختياري — وإلا تُسحَب من توزيع الدرجات)
  entries: z.array(z.object({ studentId: z.string().min(1), score: z.number().min(0).optional().nullable(), note: z.string().trim().max(300).optional().nullable() })),
});

export const updateGradingSheetEntriesSchema = z.object({
  sheetId: z.union([z.string(), z.number()]),
  entries: z.array(z.object({ studentId: z.string().min(1), score: z.number().min(0).optional().nullable(), note: z.string().trim().max(300).optional().nullable() })),
});

export const requestSheetReopenSchema = z.object({
  sheetId: z.union([z.string(), z.number()]),
  reason: z.string().trim().min(3, 'وضّح سبب الطلب').max(500),
});

export const searchMessageRecipientsSchema = z.object({
  personType: z.enum(['employee', 'student', 'parent']),
  branch: z.string().trim().optional(), // مطلوب فقط لمراقب الفروع (يختار من فروعه)
  query: z.string().trim().max(100).optional(),
});

// 🆕 إرسال رسالة جديدة — recipients يُعاد التحقق منها بالكامل بالخادم
// (لا اعتماد على القيمة القادمة من العميل وحدها) — كانت ثغرة حقيقية
export const sendMessageSchema = z.object({
  subject: z.string().trim().min(2).max(200),
  body: z.string().trim().min(1).max(2000),
  contextType: z.string().optional(),
  contextId: z.string().optional(),
  imageUrl: z.string().trim().url('رابط الصورة غير صحيح').max(500).optional().or(z.literal('')),
  recipients: z.array(z.object({ id: z.string(), type: z.enum(['employee', 'student', 'parent']) })).min(1, 'حدّد مستلماً واحداً على الأقل').max(20, 'الحد الأقصى 20 مستلماً بالرسالة الواحدة'),
});

export const replyMessageSchema = z.object({
  threadId: z.union([z.string(), z.number()]),
  body: z.string().trim().min(1).max(2000),
  imageUrl: z.string().trim().url('رابط الصورة غير صحيح').max(500).optional().or(z.literal('')),
});

// 🆕 تسجيل موظف جديد — نفس القواعد الصارمة المتَّبعة بمشروع GAS بالضبط
export const addEmployeeSchema = z.object({
  nameAr: z.string().trim().min(2, 'الاسم بالعربي قصير جداً').max(100),
  nameEn: z.string().trim().min(2, 'الاسم بالإنجليزي مطلوب').max(100),
  nationalId: z.string().trim().regex(/^[A-Za-z0-9]{4,20}$/, 'رقم الهوية يجب أن يكون أحرفاً و/أو أرقاماً (4-20 خانة)'),
  userType: z.string().min(1, 'نوع المستخدم مطلوب'),
  role: z.enum([
    'role_admin', 'role_teacher', 'role_teacher_sup', 'role_student_sup', 'Admission', 'role_branch_monitor',
  ], { errorMap: () => ({ message: 'يجب اختيار دور صحيح' }) }),
  branches: z.array(z.string()).min(1, 'يجب اختيار فرع واحد على الأقل'), // 🆕 مصفوفة بدل نص واحد — يدعم أكثر من فرع
  gender: z.string().optional().or(z.literal('')),
  stage: z.string().optional().or(z.literal('')),
  grades: z.array(z.string()).default([]),
  sections: z.array(z.string()).default([]),
  subjects: z.array(z.string()).default([]),
});

// 🆕 تعديل موظف — نفس مخطط الإضافة (بلا رقم هوية قابل للتغيير لتفادي تعارضات حساب الدخول)
export const updateEmployeeSchema = addEmployeeSchema.omit({ nationalId: true });

// 🆕 صفحة المستخدمون — تفعيل/تعطيل وإعادة تعيين كلمة مرور
export const toggleUserStatusSchema = z.object({
  id: z.string().min(1),
  newStatus: z.enum(['active', 'inactive'], { errorMap: () => ({ message: 'قيمة حالة غير صحيحة' }) }),
});

export const resetUserPasswordSchema = z.object({
  id: z.string().min(1),
});

// 🆕 إنشاء حساب يدوي واحد (احتياط لو فشل الإنشاء التلقائي)
export const createMissingAccountSchema = z.object({
  id: z.string().min(1),
});

// 🆕 مصفوفة توزيع المواد — اختيار عدة مواد دفعة واحدة (لا مادة واحدة فقط)
export const addMatrixEntriesSchema = z.object({
  branch: z.string().min(1, 'الفرع مطلوب'),
  stage: z.string().min(1, 'المرحلة مطلوبة'),
  grade: z.string().min(1, 'الصف مطلوب'),
  section: z.string().min(1, 'الشعبة مطلوبة'),
  subjects: z.array(z.string()).min(1, 'اختر مادة واحدة على الأقل'),
});

// 🆕 حفظ كل توزيع درجات مادة معيّنة دفعة واحدة (بطاقة ذكية بالواجهة)
export const saveGradeDistForSubjectSchema = z.object({
  subject: z.string().min(1, 'المادة مطلوبة'),
  entries: z.array(z.object({
    evalType: z.string().min(1),
    maxScore: z.number().min(0).max(100),
    isParticipation: z.boolean().optional(), // 🆕 يحدّد أي نوع تقييم يمثّل "المشاركة والتفاعل" فعلياً لهذي المادة
  })).min(1, 'أضف تقييماً واحداً على الأقل'),
});

// 🆕 تسجيل طالب — نفس مبدأ الحقول الإجبارية والقوائم المحدَّدة المتَّبع بالموظفين
export const addStudentSchema = z.object({
  nameAr: z.string().trim().min(2, 'الاسم بالعربي قصير جداً').max(100),
  nameEn: z.string().trim().min(2, 'الاسم بالإنجليزي مطلوب').max(100),
  nationalId: z.string().trim().regex(/^[A-Za-z0-9]{4,20}$/, 'رقم الهوية يجب أن يكون أحرفاً و/أو أرقاماً (4-20 خانة)'),
  nationality: z.string().trim().optional().or(z.literal('')),
  dateOfBirth: z.string().trim().optional().or(z.literal('')),
  gender: z.string().optional().or(z.literal('')),
  branch: z.string().min(1, 'الفرع مطلوب'),
  stage: z.string().min(1, 'المرحلة مطلوبة'),
  grade: z.string().min(1, 'الصف مطلوب'),
  section: z.string().min(1, 'الشعبة مطلوبة'),
  subjects: z.array(z.string()).default([]),
});

export const updateStudentSchema = addStudentSchema.omit({ nationalId: true });

// 🆕 تسجيل ولي أمر — يُربَط بطالب واحد أو أكثر من الطلاب المسجَّلين فعلياً
export const addParentSchema = z.object({
  nameAr: z.string().trim().min(2, 'الاسم بالعربي قصير جداً').max(100),
  nameEn: z.string().trim().min(2, 'الاسم بالإنجليزي مطلوب').max(100),
  nationalId: z.string().trim().regex(/^[A-Za-z0-9]{4,20}$/, 'رقم الهوية يجب أن يكون أحرفاً و/أو أرقاماً (4-20 خانة)'),
  phone: z.string().trim().min(6, 'رقم الجوال قصير جداً').max(20),
  branch: z.string().min(1, 'الفرع مطلوب'),
  relationship: z.string().min(1, 'صلة القرابة مطلوبة'),
  studentIds: z.array(z.string()).min(1, 'يجب ربط ولي الأمر بطالب واحد على الأقل'),
});

export const updateParentSchema = addParentSchema.omit({ nationalId: true });

// 🆕 إدارة حسابات الطلاب وأولياء الأمور
export const toggleFamilyAccountStatusSchema = z.object({
  id: z.string().min(1),
  newStatus: z.enum(['نشط', 'غير نشط'], { errorMap: () => ({ message: 'قيمة حالة غير صحيحة' }) }),
});

export const resetFamilyAccountPasswordSchema = z.object({
  id: z.string().min(1),
});

// 🆕 كل دالة API قادمة تضيف مخططها هنا — نقطة مرجعية واحدة لكل قواعد
// التحقق بالمشروع كله، بدل تكرارها يدوياً بكل ملف كما كان بـGAS
// (مثال جاهز للاستخدام لاحقاً):
// export const addStudentSchema = z.object({
//   nameAr: z.string().trim().min(2).max(100),
//   nationalId: z.string().regex(/^\d{10}$/, 'رقم الهوية يجب أن يكون 10 أرقام'),
//   branch: z.string().min(1),
//   grade: z.string().min(1),
//   section: z.string().min(1),
// });

// 🆕 حضور — تسجيل حالة يوم واحد لعدة أشخاص دفعة واحدة (طلاب أو موظفين)
export const saveAttendanceSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'صيغة التاريخ غير صحيحة'),
  personType: z.enum(['student', 'employee']),
  branch: z.string().min(1),
  stage: z.string().optional(), // 🆕 ربط إضافي بالمرحلة الدراسية
  grade: z.string().optional(),
  section: z.string().optional(),
  targetRole: z.string().optional(),
  entries: z.array(z.object({
    personId: z.string().min(1),
    status: z.string().min(1),
  })).min(1, 'لا يوجد أشخاص لتسجيل حضورهم'),
});

// 🆕 فلاتر قائمة الطلاب — تمنع نقل كل الطلاب دفعة وحدة (قد تصل لآلاف
// البطاقات). الفرع إجباري بالخادم لغير الأدمن (يُفرَض فرعه تلقائياً)،
// ولازم فلتر إضافي واحد على الأقل (مرحلة/صف/شعبة/بحث) قبل إرجاع نتائج.
export const listStudentsFilterSchema = z.object({
  branch: z.string().trim().optional(),
  stage: z.string().trim().optional(),
  grade: z.string().trim().optional(),
  section: z.string().trim().optional(),
  search: z.string().trim().max(100).optional(),
});

export const updateAttendanceSchema = z.object({
  id: z.union([z.string(), z.number()]),
  status: z.string().min(1),
});

// 🆕 استعلامات قراءة الحضور — كانت تُقرَأ من req.body مباشرة بلا أي تحقق نوع/صيغة
export const listAttendanceForDateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'صيغة التاريخ غير صحيحة'),
  personType: z.enum(['student', 'employee']),
  branch: z.string().min(1),
  grade: z.string().optional(),
  section: z.string().optional(),
  targetRole: z.string().optional(),
});

export const listStudentRosterSchema = z.object({
  branch: z.string().min(1), grade: z.string().min(1), section: z.string().min(1),
});

export const listStaffRosterSchema = z.object({
  branch: z.string().min(1), targetRole: z.string().min(1),
});

// 🆕 سلوك الطلاب — نظام نقاط
export const addBehaviorSchema = z.object({
  studentId: z.string().min(1),
  type: z.enum(['positive', 'negative']),
  points: z.number().min(1).max(100), // 🆕 أزلت .int() الصارم — بعض المتصفحات ترسل رقماً عشرياً حتى لو كتب المستخدم عدداً صحيحاً، نُقرِّبه بالخادم بدل رفضه
  description: z.string().min(1, 'الوصف مطلوب').max(300),
  branch: z.string().min(1),
});

// 🆕 نظام تقييم أداء الموظفين
export const addCriterionSchema = z.object({
  name: z.string().min(1, 'اسم المعيار مطلوب').max(100),
  weight: z.number().min(1).max(100),
  applicableRoles: z.array(z.string()).min(1, 'اختر دوراً واحداً على الأقل'),
});

export const addCycleSchema = z.object({
  name: z.string().min(1, 'اسم الدورة مطلوب').max(100),
  periodType: z.enum(['monthly', 'quarterly', 'yearly']),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const saveEvaluationSchema = z.object({
  employeeId: z.string().min(1),
  cycleId: z.union([z.string(), z.number()]),
  branch: z.string().min(1),
  scores: z.array(z.object({
    criterionId: z.union([z.string(), z.number()]),
    score: z.number().min(0).max(100),
  })).min(1, 'أدخل درجة معيار واحد على الأقل'),
  strengths: z.string().max(1000).optional().default(''),
  improvements: z.string().max(1000).optional().default(''),
  managerNotes: z.string().max(1000).optional().default(''),
});

// 🆕 خانة حصة بالجدول الدراسي الأسبوعي (id اختياري = إضافة، موجود = تعديل)
export const classScheduleEntrySchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  branch: z.string().trim().min(1, 'الفرع مطلوب'),
  stage: z.string().trim().min(1, 'المرحلة مطلوبة'),
  grade: z.string().trim().min(1, 'الصف مطلوب'),
  section: z.string().trim().min(1, 'الشعبة مطلوبة'),
  dayOfWeek: z.enum(['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'], { errorMap: () => ({ message: 'يوم غير صحيح' }) }),
  periodNumber: z.number().int('رقم الحصة يجب أن يكون رقماً صحيحاً').min(1).max(12, 'رقم الحصة يجب أن يكون بين 1 و12'),
  subject: z.string().trim().min(1, 'المادة مطلوبة'),
  teacherId: z.union([z.string(), z.number()]),
});

// 🆕 خانة اختبار بجدول الاختبارات (id اختياري = إضافة، موجود = تعديل)
export const examScheduleEntrySchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  branch: z.string().trim().min(1, 'الفرع مطلوب'),
  stage: z.string().trim().min(1, 'المرحلة مطلوبة'),
  grade: z.string().trim().min(1, 'الصف مطلوب'),
  section: z.string().trim().min(1, 'الشعبة مطلوبة'),
  subject: z.string().trim().min(1, 'المادة مطلوبة'),
  examDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'صيغة التاريخ غير صحيحة'),
  periodSlot: z.enum(['الفترة الأولى', 'الفترة الثانية'], { errorMap: () => ({ message: 'الفترة غير صحيحة' }) }),
  supervisorId: z.union([z.string(), z.number()]),
});

/* ===================== 🆕 التكاليف والمهام والاختبارات ===================== */

const TASK_SUBTYPES = ['واجب', 'ورقة عمل', 'بحث', 'تقرير', 'مطوية', 'حفظ وتسميع', 'قراءة'];
const EXAM_SUBTYPES = ['اختبار قصير', 'اختبار شهري', 'اختبار نهائي'];
const ANSWER_TYPES = ['mcq', 'true_false', 'short_answer', 'long_answer', 'attachment'];

const assignmentQuestionSchema = z.object({
  questionText: z.string().trim().min(1, 'نص السؤال مطلوب').max(2000),
  answerType: z.enum(ANSWER_TYPES, { errorMap: () => ({ message: 'نوع إجابة غير صحيح' }) }),
  points: z.number().positive('درجة السؤال يجب أن تكون أكبر من صفر').max(1000),
  options: z.array(z.object({ id: z.string().min(1), text: z.string().trim().min(1).max(300) })).max(10).optional(),
  correctOptionId: z.string().max(50).optional(),
}).refine((q) => {
  if (q.answerType === 'mcq') return Array.isArray(q.options) && q.options.length >= 2 && !!q.correctOptionId;
  if (q.answerType === 'true_false') return !!q.correctOptionId;
  return true;
}, { message: 'أسئلة الخيارات/صح وخطأ تحتاج خيارات وتحديد الإجابة الصحيحة', path: ['correctOptionId'] });

export const saveAssignmentSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  category: z.enum(['task', 'exam', 'enrichment'], { errorMap: () => ({ message: 'نوع غير صحيح' }) }),
  subtype: z.string().trim().max(50).optional().nullable(),
  evalType: z.string().trim().max(50).optional().nullable(), // 🆕 أساس توزيع الدرجات (Grade Aggregation)
  title: z.string().trim().min(1, 'العنوان مطلوب').max(200),
  description: z.string().trim().max(5000).optional().nullable(),
  branch: z.string().trim().min(1, 'الفرع مطلوب'),
  stage: z.string().trim().min(1, 'المرحلة مطلوبة'),
  grade: z.string().trim().min(1, 'الصف مطلوب'),
  section: z.string().trim().min(1, 'الشعبة مطلوبة'),
  subject: z.string().trim().min(1, 'المادة مطلوبة'),
  availableFrom: z.string().datetime({ offset: true }).optional().nullable(),
  dueAt: z.string().datetime({ offset: true }).optional().nullable(),
  youtubeUrl: z.string().trim().url('رابط يوتيوب غير صحيح').max(500).optional().nullable().or(z.literal('')),
  attachmentUrl: z.string().trim().url('رابط المرفق غير صحيح').max(500).optional().nullable().or(z.literal('')),
  questions: z.array(assignmentQuestionSchema).max(40, 'الحد الأقصى 40 سؤالاً').optional(),
}).refine((d) => {
  if (d.category === 'task') return TASK_SUBTYPES.includes(d.subtype || '');
  if (d.category === 'exam') return EXAM_SUBTYPES.includes(d.subtype || '');
  return true;
}, { message: 'نوع فرعي غير مطابق للتصنيف', path: ['subtype'] })
  .refine((d) => d.category === 'enrichment' || (d.questions && d.questions.length > 0), { message: 'أضف سؤالاً واحداً على الأقل للتكليف أو الاختبار', path: ['questions'] })
  .refine((d) => d.category === 'enrichment' || !!d.evalType, { message: 'حدّد نوع التقييم (لتوزيع الدرجات)', path: ['evalType'] });

export const saveAssignmentGradeSchema = z.object({
  assignmentId: z.union([z.string(), z.number()]),
  studentId: z.string().min(1),
  score: z.number().min(0).optional().nullable(),
  participationNote: z.string().trim().max(500).optional().nullable(),
});

// 🆕 التقويم الدراسي — فصل دراسي (id اختياري = إضافة، موجود = تعديل).
// ⚠️ لا يوجد أي توليد تلقائي للأسابيع — تُدار الأسابيع يدوياً بالكامل
// عبر addWeekSchema/updateWeekSchema المستقلة تماماً.
export const saveTermSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  name: z.string().trim().min(1, 'اسم الفصل مطلوب').max(100),
  termNumber: z.number().int('رقم الفصل يجب أن يكون رقماً صحيحاً').min(1).max(2, 'رقم الفصل يجب أن يكون 1 أو 2'),
  academicYear: z.string().trim().min(1, 'العام الدراسي مطلوب').max(20),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'صيغة تاريخ البداية غير صحيحة'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'صيغة تاريخ النهاية غير صحيحة'),
}).refine((d) => d.endDate >= d.startDate, { message: 'تاريخ النهاية يجب أن يكون بعد تاريخ البداية أو يساويه', path: ['endDate'] });

// 🆕 حقول الأسبوع الدراسي المشتركة — كلها يحدّدها الأدمن يدوياً بلا استثناء
const weekFieldsShape = {
  weekNumber: z.number().int('رقم الأسبوع يجب أن يكون رقماً صحيحاً').min(1, 'رقم الأسبوع يجب أن يكون 1 أو أكثر'),
  label: z.string().trim().min(1, 'التسمية مطلوبة').max(100), // 🆕 تُستخدَم أيضاً لاسم الإجازة الحر (مثل "إجازة مطر")
  weekType: z.enum(['دراسي', 'إجازة', 'اختبار شهري', 'اختبار نهائي'], { errorMap: () => ({ message: 'نوع أسبوع غير صحيح' }) }),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'صيغة تاريخ البداية غير صحيحة'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'صيغة تاريخ النهاية غير صحيحة'),
};

// 🆕 إضافة أسبوع دراسي جديد لفصل معيّن
export const addWeekSchema = z.object({
  termId: z.union([z.string(), z.number()]),
  ...weekFieldsShape,
}).refine((d) => d.endDate >= d.startDate, { message: 'تاريخ النهاية يجب أن يكون بعد تاريخ البداية أو يساويه', path: ['endDate'] });

// 🆕 تعديل أسبوع دراسي موجود (كل الحقول قابلة للتعديل، بما فيها التواريخ)
export const updateWeekSchema = z.object({
  id: z.union([z.string(), z.number()]),
  ...weekFieldsShape,
}).refine((d) => d.endDate >= d.startDate, { message: 'تاريخ النهاية يجب أن يكون بعد تاريخ البداية أو يساويه', path: ['endDate'] });

// 🆕 إجازة داخل فصل دراسي — مستقلة عن الأسابيع، طول حر (يوم إلى عدة أيام)،
// قد تقع داخل أسبوع دراسي واحد أو تمتد لتغطي أكثر من أسبوع
const holidayFieldsShape = {
  label: z.string().trim().min(1, 'اسم الإجازة مطلوب').max(100),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'صيغة تاريخ البداية غير صحيحة'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'صيغة تاريخ النهاية غير صحيحة'),
};

export const addHolidaySchema = z.object({
  termId: z.union([z.string(), z.number()]),
  ...holidayFieldsShape,
}).refine((d) => d.endDate >= d.startDate, { message: 'تاريخ النهاية يجب أن يكون بعد تاريخ البداية أو يساويه', path: ['endDate'] });

export const updateHolidaySchema = z.object({
  id: z.union([z.string(), z.number()]),
  ...holidayFieldsShape,
}).refine((d) => d.endDate >= d.startDate, { message: 'تاريخ النهاية يجب أن يكون بعد تاريخ البداية أو يساويه', path: ['endDate'] });

// 🆕 فتح/إغلاق عرض فصل دراسي كامل لكل الموظفين (الأدمن فقط)
export const toggleTermVisibilitySchema = z.object({
  id: z.union([z.string(), z.number()]),
  isVisible: z.boolean(),
});

/** يفحص body الطلب بمخطط معيّن، يرمي خطأ واضح موحَّد لو فشل الفحص */
export function validateBody(schema, body) {
  const result = schema.safeParse(body);
  if (!result.success) {
    const firstError = result.error.errors[0];
    const err = new Error(firstError.message);
    err.statusCode = 400;
    throw err;
  }
  return result.data;
}
