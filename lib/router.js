// lib/router.js
// =====================================================================
// مساعد توجيه بسيط — يستخدمه كل ملف مُجمَّع (auth.js, settings.js,
// employees.js, users.js) ليقرأ "action" من الطلب ويستدعي الدالة
// المناسبة. هذا يحل مشكلة حد الـ12 دالة بخطة Vercel المجانية (نجمع
// عدة إجراءات بملف واحد)، مع بقاء كل إجراء بدالة منفصلة واضحة تماماً.
//
// الاستخدام بأي ملف مُجمَّع:
//   export default createRouter({
//     add: handleAdd,
//     update: handleUpdate,
//     delete: handleDelete,
//     list: handleList,
//   });
// =====================================================================

import { apiHandler } from './apiHandler.js';

export function createRouter(actions) {
  return apiHandler(async (req, res) => {
    // الإجراء يأتي إما من body (POST) أو من query string (GET)
    const action = (req.body && req.body.action) || req.query.action || 'default';
    const handler = actions[action];

    if (!handler) {
      const err = new Error(`إجراء غير معروف: ${action}`);
      err.statusCode = 400;
      throw err;
    }

    return handler(req, res);
  });
}
