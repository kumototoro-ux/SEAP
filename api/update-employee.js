// api/update-employee.js
// =====================================================================
// تعديل بيانات موظف موجود (بلا لمس رقم الهوية أو حساب الدخول) — أدمن فقط
// =====================================================================

import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { apiHandler } from '../lib/apiHandler.js';
import { validateBody, updateEmployeeSchema } from '../lib/validation.js';
import { z } from 'zod';

export default apiHandler(async function updateEmployee(req, res) {
  if (req.method !== 'POST') {
    const err = new Error('الطريقة غير مسموحة');
    err.statusCode = 405;
    throw err;
  }

  const user = requireAuth(req);
  requireRole(user, ['role_admin']);

  const { id } = validateBody(z.object({ id: z.string().min(1) }).passthrough(), req.body);
  const d = validateBody(updateEmployeeSchema, req.body);

  const { data: existing, error: findError } = await supabaseAdmin.from('employees').select('id').eq('id', id).maybeSingle();
  if (findError) throw findError;
  if (!existing) {
    const err = new Error('الموظف غير موجود');
    err.statusCode = 404;
    throw err;
  }

  const { error: updateError } = await supabaseAdmin.from('employees').update({
    name_ar: d.nameAr,
    name_en: d.nameEn || null,
    user_type: d.userType,
    role: d.role,
    gender: d.gender || null,
    branch: d.branches[0],
    stage: d.stage || null,
    grades: d.grades,
    sections: d.sections,
    subjects: d.subjects,
  }).eq('id', id);
  if (updateError) throw updateError;

  await supabaseAdmin.from('employee_branches').delete().eq('employee_id', id);
  if (d.branches.length > 1) {
    const extraBranches = d.branches.slice(1).map((branch) => ({ employee_id: id, branch }));
    const { error: branchError } = await supabaseAdmin.from('employee_branches').insert(extraBranches);
    if (branchError) throw branchError;
  }

  await supabaseAdmin.from('audit_log').insert({
    emp_id: user.id, emp_name: user.fullName, role: user.role,
    action: 'تعديل بيانات موظف', details: { employeeId: id, nameAr: d.nameAr }, branch: user.branch,
  });

  return res.status(200).json({ success: true, data: true });
});
