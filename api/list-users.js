// api/list-users.js
// =====================================================================
// قائمة كل حسابات الموظفين مدمجة ببياناتهم (اسم/دور/فرع) — أدمن فقط
// =====================================================================

import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { apiHandler } from '../lib/apiHandler.js';

export default apiHandler(async function listUsers(req, res) {
  if (req.method !== 'GET') {
    const err = new Error('الطريقة غير مسموحة');
    err.statusCode = 405;
    throw err;
  }

  const user = requireAuth(req);
  requireRole(user, ['role_admin']);

  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id, username, status, created_at, last_login_at, employees:id(name_ar, role, branch)')
    .order('created_at', { ascending: false });

  if (error) throw error;

  const enriched = data.map((u) => ({
    id: u.id,
    username: u.username,
    status: u.status,
    createdAt: u.created_at,
    lastLoginAt: u.last_login_at,
    nameAr: u.employees ? u.employees.name_ar : '(بلا بيانات موظف)',
    role: u.employees ? u.employees.role : null,
    branch: u.employees ? u.employees.branch : null,
  }));

  return res.status(200).json({ success: true, data: enriched });
});
