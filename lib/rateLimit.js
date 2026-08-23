// lib/rateLimit.js
// =====================================================================
// حماية من هجمات القوة الغاشمة (Brute Force) على تسجيل الدخول — مجانية
// بالكامل عبر Upstash Redis (الفئة المجانية سخية جداً وتكفي أي مدرسة).
// بدون هذا، أي شخص يقدر يجرّب آلاف كلمات المرور بالثانية بلا أي عائق.
// =====================================================================

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// 5 محاولات كحد أقصى كل 60 ثانية لكل (اسم مستخدم + عنوان IP) — يوقف
// المهاجم فوراً دون التأثير على مستخدم حقيقي أخطأ مرة أو مرتين بكلمة المرور
const loginRateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '60 s'),
  prefix: 'ratelimit:login',
});

/** يرمي خطأ 429 لو تجاوز عدد المحاولات المسموح بها */
export async function checkLoginRateLimit(identifier) {
  const { success, remaining } = await loginRateLimiter.limit(identifier);
  if (!success) {
    const err = new Error('محاولات كثيرة جداً، حاول مرة أخرى بعد دقيقة');
    err.statusCode = 429;
    throw err;
  }
  return remaining;
}
