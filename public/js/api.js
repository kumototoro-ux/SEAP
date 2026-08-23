// public/js/api.js
// =====================================================================
// نقطة اتصال واحدة مركزية بكل دوال API — تعادل callServer() بمشروع
// GAS بالضبط. كل استدعاء مستقبلي (صفحة الموظفين، الطلاب، الحضور...)
// يمر عبر هذي الدالة الواحدة، فلا نكرر منطق التوكن/الأخطاء/التحميل
// بكل صفحة جديدة — يُكتَب مرة واحدة هنا، يُستفاد منه بكل مكان للأبد.
// =====================================================================

const API_BASE = window.location.origin + '/api';
let inFlightRequests = 0;

function toggleGlobalLoading(active) {
  inFlightRequests += active ? 1 : -1;
  if (inFlightRequests < 0) inFlightRequests = 0;
  const bar = document.getElementById('progress-bar');
  if (bar) bar.classList.toggle('active', inFlightRequests > 0);
}

/**
 * الدالة المركزية الوحيدة لأي اتصال بالخادم بكل المشروع.
 * @param {string} endpoint - اسم الملف بمجلد api (بدون /api/ ولا .js), مثال: 'login'
 * @param {object} options - { method, body, requiresAuth }
 */
async function apiCall(endpoint, options = {}) {
  const { method = 'GET', body = null, requiresAuth = true } = options;

  toggleGlobalLoading(true);
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (requiresAuth) {
      const token = localStorage.getItem('mirqat_token');
      if (!token) {
        handleSessionExpired();
        throw new Error('الجلسة غير موجودة');
      }
      headers['Authorization'] = 'Bearer ' + token;
    }

    const res = await fetch(`${API_BASE}/${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const result = await res.json().catch(() => ({ success: false, message: 'استجابة غير صحيحة من الخادم' }));

    // 🆕 انتهاء صلاحية الجلسة (401/403) يُعاد المستخدم لتسجيل الدخول تلقائياً
    // بلا حاجة لكل صفحة تتحقّق من هذا يدوياً — نقطة مركزية واحدة تكفي
    if ((res.status === 401 || res.status === 403) && requiresAuth) {
      handleSessionExpired();
    }

    if (!result.success) {
      throw new Error(result.message || 'حدث خطأ غير متوقع');
    }
    return result.data;
  } finally {
    toggleGlobalLoading(false);
  }
}

function handleSessionExpired() {
  localStorage.removeItem('mirqat_token');
  localStorage.removeItem('mirqat_user');
  if (window.location.pathname !== '/') {
    window.location.href = '/';
  } else if (window.renderLogin) {
    window.renderLogin();
    showToast('انتهت جلستك، الرجاء تسجيل الدخول من جديد', 'error');
  }
}

/** 🆕 نظام إشعارات موحَّد (Toast) — نفس النمط المعتمد بمشروع GAS بالضبط */
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

