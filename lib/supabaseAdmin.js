// lib/supabaseAdmin.js
// =====================================================================
// اتصال واحد مشترك بقاعدة البيانات، بصلاحيات كاملة (Service Role) —
// يعادل بالضبط "التنفيذ من قبل: أنا" اللي كنا نعتمد عليه بـGAS، فيقدر
// يقرأ ويكتب بكل الجداول بغض النظر عن هوية المستخدم النهائي (نحن من
// نتحقق من الصلاحيات يدوياً بكل دالة API، تماماً كما كنا نفعل بـ
// requireAuth_/requireRole_).
//
// ⚠️ لا تستخدم هذا المفتاح إطلاقاً بأي كود يعمل بالمتصفح (Frontend) —
// فقط بدوال /api الخادمية. المفتاح المخصَّص للمتصفح مختلف تماماً
// (anon key) وسنستخدمه لاحقاً فقط لو احتجنا Supabase Realtime مباشرة.
// =====================================================================

import { createClient } from '@supabase/supabase-js';

export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { autoRefreshToken: false, persistSession: false },
  }
);

