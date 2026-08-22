// api/login.js
// =====================================================================
// هذا الملف هو النموذج القياسي (Template) لكل دالة API قادمة بالمشروع —
// نفس التسلسل بالضبط: apiHandler → rate limit → validate → منطق العمل
// =====================================================================

import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { issueSessionToken } from '../lib/auth.js';
import { apiHandler } from '../lib/apiHandler.js';
import { validateBody, loginSchema } from '../lib/validation.js';
import { checkLoginRateLimit } from '../lib/rateLimit.js';

export default apiHandler(async function login(req, res) {
  if (req.method !== 'POST') {
    const err = new Error('الطريقة غير مسموحة');
    err.statusCode = 405;
    throw err;
  }

  // 1) حماية من القوة الغاشمة — قبل أي شيء آخر حتى
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  await checkLoginRateLimit(clientIp);

  // 2) فحص صارم للمدخلات
  const { username, password } = validateBody(loginSchema, req.body);

  // 3) منطق العمل الفعلي
  const { data: userRow, error } = await supabaseAdmin
    .from('users')
    .select(`
      id, username, password_hash, status,
      employees:id ( id, national_id, name_ar, branch, role, user_type, grades, sections, subjects )
    `)
    .eq('username', username)
    .maybeSingle();

  if (error) throw error;
  if (!userRow) {
    const err = new Error('اسم المستخدم أو كلمة المرور غير صحيحة');
    err.statusCode = 401;
    throw err;
  }

  const passwordMatches = await bcrypt.compare(password, userRow.password_hash);
  if (!passwordMatches) {
    const err = new Error('اسم المستخدم أو كلمة المرور غير صحيحة');
    err.statusCode = 401;
    throw err;
  }

  if (userRow.status !== 'active') {
    const err = new Error('الحساب غير مُفعّل، تواصل مع الإدارة');
    err.statusCode = 403;
    throw err;
  }

  const employee = userRow.employees;
  const isFirstLogin = await bcrypt.compare(employee.national_id, userRow.password_hash);

  const userPayload = {
    id: employee.id,
    fullName: employee.name_ar,
    username: userRow.username,
    branch: employee.branch,
    userType: employee.user_type,
    role: employee.role,
    subject: employee.subjects,
    grades: employee.grades,
    sections: employee.sections,
  };

  const token = issueSessionToken(userPayload);

  return res.status(200).json({
    success: true,
    data: { token, user: userPayload, firstLogin: isFirstLogin },
  });
});
