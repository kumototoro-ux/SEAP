# منصة مِرقاة — الموظفين (Vercel + Supabase)

## البنية
```
api/            ← ملف واحد لكل "مورد" (auth, settings, employees, users...) — مش ملف لكل إجراء
lib/            ← أدوات مشتركة (اتصال قاعدة البيانات، الجلسات، الفحص، الحماية، التوجيه)
public/         ← الواجهة الأمامية (index.html + css/ + js/)
sql/            ← ملفات SQL إضافية (RLS إلخ) — تُنفَّذ يدوياً بـSupabase SQL Editor
.env.example    ← نموذج متغيرات البيئة (انسخه لـ.env.local وعبّه)
```

## ⚠️ قاعدة صارمة: حد 12 دالة (خطة Vercel المجانية)
خطة Vercel Hobby (المجانية) تسمح بحد أقصى **12 ملفاً** بمجلد `api` لكل نشر — بغض النظر عن حجم كل ملف. لهذا **لا نُنشئ ملفاً جديداً لكل إجراء بسيط** (مثل "إضافة طالب" أو "حذف طالب" منفصلَين) — بل **ملف واحد لكل مورد كامل** (مثلاً `students.js`) يحتوي كل إجراءاته (list, add, update, delete...) كدوال منفصلة واضحة بداخله.

## النموذج القياسي لأي مورد جديد (طلاب، حضور، درجات...)
كل ملف مورد جديد يتبع بالضبط هيكل `api/employees.js`:

```js
import { createRouter } from '../lib/router.js';

async function handleList(req, res) { /* ... */ }
async function handleAdd(req, res) { /* ... */ }
async function handleUpdate(req, res) { /* ... */ }
async function handleDelete(req, res) { /* ... */ }

export default createRouter({
  list: handleList,
  add: handleAdd,
  update: handleUpdate,
  delete: handleDelete,
});
```

والواجهة الأمامية تستدعيه دائماً بنفس النمط الموحَّد (POST + اسم الإجراء بالـbody، بلا استثناءات):
```js
await apiCall('students', { method: 'POST', body: { action: 'add', ...data } });
await apiCall('students', { method: 'POST', body: { action: 'list' } });
```

كل دالة داخلية (`handleXxx`) تتّبع نفس تسلسل الملفات الحالية: `requireAuth` → `requireRole` → `validateBody` → منطق العمل.

## الإعداد المحلي
```
npm install
cp .env.example .env.local
```
ثم عبّي القيم الحقيقية بـ.env.local

## قائمة مراجعة قبل أي نشر
- كل حقل مُدخَل من المستخدم يمر عبر مخطط Zod
- كل إجراء حساس يتحقق من requireAuth + requireRole (إلا login نفسه بالطبع)
- لا يوجد أي مفتاح سري مكتوب مباشرة بالكود (كله عبر process.env)
- سياسات RLS مفعَّلة بكل جدول جديد (sql/enable_rls.sql)
- **عدد ملفات `api` لا يتجاوز 12** — لو اقتربنا من الحد، ندمج موارد مترابطة قبل إضافة أي جديد
