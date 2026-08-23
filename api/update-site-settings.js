// api/update-site-settings.js
// =====================================================================
// يعادل updateSettingsField() بـGAS لاسم المدرسة والشعار — أدمن فقط
// =====================================================================

import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { apiHandler } from '../lib/apiHandler.js';
import { validateBody, updateSiteSettingsSchema } from '../lib/validation.js';

export default apiHandler(async function updateSiteSettings(req, res) {
  if (req.method !== 'POST') {
    const err = new Error('الطريقة غير مسموحة');
    err.statusCode = 405;
    throw err;
  }

  const user = requireAuth(req);
  requireRole(user, ['role_admin']);

  const updates = validateBody(updateSiteSettingsSchema, req.body);
  const dbUpdates = {};
  if (updates.schoolName !== undefined) dbUpdates.school_name = updates.schoolName;
  if (updates.logoUrl !== undefined) dbUpdates.logo_url = updates.logoUrl;

  if (Object.keys(dbUpdates).length === 0) {
    const err = new Error('لم يتم إرسال أي حقل للتحديث');
    err.statusCode = 400;
    throw err;
  }

  const { error } = await supabaseAdmin.from('site_settings').update(dbUpdates).eq('id', 1);
  if (error) throw error;

  return res.status(200).json({ success: true, data: true });
});

