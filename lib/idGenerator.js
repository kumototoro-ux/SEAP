// lib/idGenerator.js
// =====================================================================
// توليد رقم موظف تلقائي بصيغة E001, E002... — يعادل generateNextEmployeeId_
// بمشروع GAS. دالة مشتركة بدل تكرارها بأي ملف يحتاج توليد أرقام.
// =====================================================================

export async function generateNextEmployeeId(supabaseAdmin) {
  const { data, error } = await supabaseAdmin
    .from('employees')
    .select('id')
    .order('id', { ascending: false })
    .limit(1);

  if (error) throw error;
  if (!data.length) return 'E001';

  const lastNum = parseInt(data[0].id.replace('E', ''), 10) || 0;
  return 'E' + String(lastNum + 1).padStart(3, '0');
}
