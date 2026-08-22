# منصة مِرقاة — الموظفين (Vercel + Supabase)

## البنية
```
api/            ← كل دالة = ملف مستقل (نفس فلسفة .gs بالضبط)
lib/            ← أدوات مشتركة (اتصال قاعدة البيانات، الجلسات، الفحص، الحماية)
sql/            ← ملفات SQL إضافية (RLS إلخ) — تُنفَّذ يدوياً بـSupabase SQL Editor
.env.example    ← نموذج متغيرات البيئة (انسخه لـ.env.local وعبّه)
```

## الإعداد المحلي
```
npm install
cp .env.example .env.local
```
ثم عبّي القيم الحقيقية بـ.env.local

## النموذج القياسي لأي دالة API جديدة
كل دالة قادمة تتبع نفس هيكل api/login.js بالضبط:

```js
import { apiHandler } from '../lib/apiHandler.js';
import { validateBody, xxxSchema } from '../lib/validation.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';

export default apiHandler(async function myFunction(req, res) {
  const user = requireAuth(req);
  requireRole(user, ['role_admin']);
  const data = validateBody(xxxSchema, req.body);
  return res.status(200).json({ success: true, data: null });
});
```

كل دالة جديدة تحتاج: إضافة مخططها بـlib/validation.js، ثم اتباع نفس التسلسل أعلاه بلا استثناءات.

## قائمة مراجعة قبل أي نشر
- كل حقل مُدخَل من المستخدم يمر عبر مخطط Zod
- كل دالة تتحقق من requireAuth + requireRole (إلا login نفسها بالطبع)
- لا يوجد أي مفتاح سري مكتوب مباشرة بالكود (كله عبر process.env)
- سياسات RLS مفعَّلة بكل جدول جديد (sql/enable_rls.sql)
