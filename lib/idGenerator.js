// lib/idGenerator.js
// =====================================================================
// 🆕 توليد معرِّفات صعبة التخمين — مزيج أحرف وأرقام عشوائي، بدل الترقيم
// التسلسلي السابق (E001, E002...) الذي كان يسهُل تخمينه أو تعداده
// (Enumeration Attack). نتجنّب أحرف/أرقام متشابهة بصرياً (0/O, 1/I/L)
// لتفادي أخطاء قراءة عند الحاجة لكتابة المعرِّف يدوياً.
// =====================================================================

const SAFE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // بلا 0،O،1،I،L لتفادي الالتباس البصري

function randomAlphanumeric(length) {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += SAFE_CHARS[Math.floor(Math.random() * SAFE_CHARS.length)];
  }
  return result;
}

/** يولّد معرِّف موظف فريداً وصعب التخمين — يتحقق من عدم التكرار قبل الإرجاع */
export async function generateEmployeeId(supabaseAdmin) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = 'EMP-' + randomAlphanumeric(6);
    const { data } = await supabaseAdmin.from('employees').select('id').eq('id', candidate).maybeSingle();
    if (!data) return candidate; // لا يوجد تكرار — جاهز للاستخدام
  }
  throw new Error('تعذّر توليد معرِّف فريد، حاول مرة أخرى'); // احتمال شبه مستحيل إحصائياً (32^6 احتمال)
}

/** 🆕 يولّد معرِّف طالب فريداً وصعب التخمين — نفس منطق الموظفين بالضبط */
export async function generateStudentId(supabaseAdmin) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = 'STU-' + randomAlphanumeric(6);
    const { data } = await supabaseAdmin.from('students').select('id').eq('id', candidate).maybeSingle();
    if (!data) return candidate;
  }
  throw new Error('تعذّر توليد معرِّف فريد، حاول مرة أخرى');
}
