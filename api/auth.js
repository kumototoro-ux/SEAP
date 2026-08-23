// api/auth.js
// =====================================================================
// كل إجراءات المصادقة بملف واحد — 3 أقسام منفصلة تماماً، كل واحد
// بدالته الخاصة الواضحة. يُستدعى بـ action محدَّد بجسم الطلب:
//   { action: 'login', username, password }
//   { action: 'logout' }
//   { action: 'forceSetPassword', newPassword }
// =====================================================================

import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { requireAuth, issueSessionToken } from '../lib/auth.js';
import { createRouter } from '../lib/router.js';
import { validateBody, loginSchema, forceSetNewPasswordSchema } from '../lib/validation.js';
import { checkLoginRateLimit } from '../lib/rateLimit.js';

/* -------------------- تسجيل الدخول -------------------- */
async function handleLogin(req, res) {
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  await checkLoginRateLimit(clientIp);

  const { username, password } = validateBody(loginSchema, req.body);

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
    id: employee.id, fullName: employee.name_ar, username: userRow.username,
    branch: employee.branch, userType: employee.user_type, role: employee.role,
    subject: employee.subjects, grades: employee.grades, sections: employee.sections,
  };

  const token = issueSessionToken(userPayload);
  return res.status(200).json({ success: true, data: { token, user: userPayload, firstLogin: isFirstLogin } });
}

/* -------------------- تسجيل الخروج -------------------- */
async function handleLogout(req, res) {
  return res.status(200).json({ success: true, data: true });
}

/* -------------------- تعيين كلمة مرور جديدة إجبارياً (أول دخول) -------------------- */
async function handleForceSetPassword(req, res) {
  const user = requireAuth(req);
  const { newPassword } = validateBody(forceSetNewPasswordSchema, req.body);

  // 🆕 قيد "مرة واحدة كل 30 يوماً" — يمنع تغييراً متكرراً بلا داعٍ (سبام).
  // لا يُطبَّق أبداً على أول دخول (لا يوجد تاريخ تغيير سابق بعد).
  const { data: userRow } = await supabaseAdmin.from('users').select('password_changed_at').eq('id', user.id).maybeSingle();
  if (userRow?.password_changed_at) {
    const daysSinceChange = (Date.now() - new Date(userRow.password_changed_at).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceChange < 30) {
      const daysLeft = Math.ceil(30 - daysSinceChange);
      const err = new Error(`يمكنك تغيير كلمة المرور مرة واحدة كل 30 يوماً فقط. تبقّى ${daysLeft} يوماً.`);
      err.statusCode = 429;
      throw err;
    }
  }

  const newHash = await bcrypt.hash(newPassword, 10);
  const { error } = await supabaseAdmin.from('users').update({
    password_hash: newHash,
    password_changed_at: new Date().toISOString(),
  }).eq('id', user.id);
  if (error) throw error;

  await supabaseAdmin.from('audit_log').insert({
    emp_id: user.id, emp_name: user.fullName, role: user.role,
    action: 'تغيير كلمة المرور', details: {}, branch: user.branch,
  });

  return res.status(200).json({ success: true, data: true });
}

export default createRouter({
  login: handleLogin,
  logout: handleLogout,
  forceSetPassword: handleForceSetPassword,
});
