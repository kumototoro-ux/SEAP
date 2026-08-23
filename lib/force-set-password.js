// api/force-set-password.js
// =====================================================================
// يعادل بالضبط دالة forceSetNewPassword() بملف Auth.gs — يُستدعى فقط
// عندما تكون استجابة تسجيل الدخول تحمل firstLogin: true. يتطلّب جلسة
// صالحة (Token من /api/login)، لكن بلا طلب كلمة المرور الحالية (لأنه
// إجباري بعد أول دخول فقط، وليس تغييراً اختيارياً لاحقاً).
// =====================================================================

import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { requireAuth } from '../lib/auth.js';
import { apiHandler } from '../lib/apiHandler.js';
import { validateBody, forceSetNewPasswordSchema } from '../lib/validation.js';

export default apiHandler(async function forceSetPassword(req, res) {
  if (req.method !== 'POST') {
    const err = new Error('الطريقة غير مسموحة');
    err.statusCode = 405;
    throw err;
  }

  // 1) تحقّق من الجلسة — أي مستخدم مسجَّل دخوله حديثاً يقدر يستخدم هذي الدالة على نفسه فقط
  const user = requireAuth(req);

  // 2) فحص صارم للمدخل
  const { newPassword } = validateBody(forceSetNewPasswordSchema, req.body);

  // 3) تشفير bcrypt وتحديث مباشر
  const newHash = await bcrypt.hash(newPassword, 10);
  const { error } = await supabaseAdmin
    .from('users')
    .update({ password_hash: newHash })
    .eq('id', user.id);

  if (error) throw error;

  // 🆕 تسجيل بسجل التتبع — تغيير كلمة مرور حدث حساس يستحق التوثيق
  await supabaseAdmin.from('audit_log').insert({
    emp_id: user.id,
    emp_name: user.fullName,
    role: user.role,
    action: 'تعيين كلمة مرور جديدة (أول دخول)',
    details: { forced: true },
    branch: user.branch,
  });

  return res.status(200).json({ success: true, data: true });
});