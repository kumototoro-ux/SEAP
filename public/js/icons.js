// public/js/icons.js
// =====================================================================
// مكتبة أيقونات SVG بخط رفيع — بديل احترافي كامل للإيموجي بكل الموقع.
// كل أيقونة دالة تُرجع نص SVG جاهز، بحجم قابل للتخصيص. تُستخدَم بكل
// مكان بدل أي رمز إيموجي: الشريط الجانبي، الشريط العلوي، الأزرار.
// =====================================================================

function icon(path, size = 20) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
}

const ICONS = {
  home: () => icon('<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/>'),
  employees: () => icon('<circle cx="9" cy="8" r="3.2"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.2 3.2 0 0 1 0 6.3"/><path d="M18.5 20a5.5 5.5 0 0 0-3.5-5.1"/>'),
  students: () => icon('<path d="M2 8l10-4 10 4-10 4-10-4z"/><path d="M6 10.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-5.5"/><path d="M22 8v6"/>'),
  users: () => icon('<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>'),
  search: () => icon('<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>', 18),
  bell: () => icon('<path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10 20a2 2 0 0 0 4 0"/>', 19),
  chevronDown: () => icon('<path d="M6 9l6 6 6-6"/>', 15),
  menu: () => icon('<path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/>', 20),
  plus: () => icon('<path d="M12 5v14"/><path d="M5 12h14"/>', 16),
  close: () => icon('<path d="M6 6l12 12"/><path d="M18 6L6 18"/>', 16),
  edit: () => icon('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>', 15),
  trash: () => icon('<path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>', 15),
  key: () => icon('<circle cx="8" cy="15" r="4"/><path d="M10.5 12.5L20 3"/><path d="M17 6l3 3"/><path d="M14 9l3 3"/>', 15),
  lock: () => icon('<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>', 14),
  logout: () => icon('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>', 16),
};
