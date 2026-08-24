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
