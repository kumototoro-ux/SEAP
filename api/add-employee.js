// api/add-employee.js
// =====================================================================
// يعادل addEmployee() بملف Employees.gs بالضبط — نفس التسلسل: توليد
// رقم موظف جديد، إنشاء السجل، ثم إنشاء حساب دخول تلقائي فوراً (اسم
// المستخدم = رقم الهوية، كلمة المرور المبدئية = رقم الهوية مُشفَّرة).
// =====================================================================

import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { apiHandler } from '../lib/apiHandler.js';
import { validateBody, addEmployeeSchema } from '../lib/validation.js';
import { generateEmployeeId } from '../lib/idGenerator.js';

export default apiHandler(async function addEmployee(req, res) {
  if (req.method !== 'POST') {
    const err = new Error('الطريقة غير مسموحة');
    err.statusCode = 405;
    throw err;
  }

  const user = requireAuth(req);
  requireRole(user, ['role_admin']);

  const d = validateBody(addEmployeeSchema, req.body);

  const { data: existing } = await supabaseAdmin
    .from('employees').select('id').eq('national_id', d.nationalId).maybeSingle();
  if (existing) {
    const err = new Error('رقم الهوية هذا مسجَّل بالفعل لموظف آخر');
    err.statusCode = 409;
    throw err;
  }

  const newId = await generateEmployeeId(supabaseAdmin);

  const { error: empError } = await supabaseAdmin.from('employees').insert({
    id: newId,
    national_id: d.nationalId,
    name_ar: d.nameAr,
    name_en: d.nameEn || null,
    user_type: d.userType,
    role: d.role,
    gender: d.gender || null,
    branch: d.branches[0], // 🆕 أول فرع مختار = الفرع الأساسي
    stage: d.stage || null,
    grades: d.grades,
    sections: d.sections,
    subjects: d.subjects,
  });
  if (empError) throw empError;

  // 🆕 الفروع الإضافية (لو أكثر من فرع) تُخزَّن بجدول الربط المخصَّص
  if (d.branches.length > 1) {
    const extraBranches = d.branches.slice(1).map((branch) => ({ employee_id: newId, branch }));
    const { error: branchError } = await supabaseAdmin.from('employee_branches').insert(extraBranches);
    if (branchError) throw branchError;
  }

  const passwordHash = await bcrypt.hash(d.nationalId, 10);
  const { error: userError } = await supabaseAdmin.from('users').insert({
    id: newId,
    username: d.nationalId,
    password_hash: passwordHash,
    status: 'active',
  });
  if (userError) throw userError;

  await supabaseAdmin.from('audit_log').insert({
    emp_id: user.id, emp_name: user.fullName, role: user.role,
    action: 'تسجيل موظف جديد', details: { newEmployeeId: newId, nameAr: d.nameAr }, branch: user.branch,
  });

  return res.status(200).json({ success: true, data: { id: newId } });
});
