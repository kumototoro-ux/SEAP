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