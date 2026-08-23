// lib/auth.js
// =====================================================================
// 🆕 تحوّل معماري مهم عن GAS: كنا نستخدم CacheService (خادم يحفظ الجلسة
// ويُرجعها عند كل طلب). Vercel Serverless بلا حالة (Stateless) — كل
// استدعاء دالة منفصل تماماً، لا ذاكرة مشتركة بينها. الحل المعياري:
// JWT (Signed Token) — الرمز نفسه يحمل بيانات الجلسة موقَّعة رقمياً،
// نتحقق من التوقيع فقط (بلا أي استعلام قاعدة بيانات إضافي)، أسرع
// وأبسط، ومثالي لبيئة Serverless تحديداً.
// =====================================================================

import jwt from 'jsonwebtoken';

const SESSION_DURATION = '6h'; // ⚠️ نفس مدة الجلسة المعتمدة بـCONFIG.SESSION_DURATION_SEC بالضبط

export function issueSessionToken(userPayload) {
  return jwt.sign(userPayload, process.env.JWT_SECRET, { expiresIn: SESSION_DURATION });
}

/** يعادل requireAuth_ بـGAS بالضبط — يُستخدَم بأول سطر بأي دالة API قادمة */
export function requireAuth(req) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) throw new AuthError('الجلسة غير موجودة، الرجاء تسجيل الدخول');

  try {
    return jwt.verify(token, process.env.JWT_SECRET); // يرجع بيانات المستخدم نفسها المخزَّنة بالرمز
  } catch (e) {
    throw new AuthError('انتهت صلاحية الجلسة، الرجاء تسجيل الدخول من جديد');
  }
}

/** يعادل requireRole_ بـGAS بالضبط */
export function requireRole(user, allowedRoles) {
  if (!allowedRoles.includes(user.role)) {
    throw new AuthError('لا تملك صلاحية تنفيذ هذا الإجراء');
  }
}

export class AuthError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AuthError';
    this.statusCode = 401;
  }
}

