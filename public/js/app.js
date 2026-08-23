// public/js/app.js
// =====================================================================
// هيكل التطبيق الكامل — نظام صفحة واحدة (SPA) بنفس فلسفة JavaScript.html
// بمشروع GAS بالضبط: PAGE_REGISTRY لتسجيل الصفحات، ROLE_PAGES للصلاحيات،
// navigate() للتنقّل بلا إعادة تحميل. كل صفحة قادمة تُضاف هنا بسطرين
// فقط بلا أي حاجة لإعادة بناء الهيكل.
// =====================================================================

const APP = { token: null, user: null };

/** 🆕 سجل الصفحات المركزي — أي صفحة قادمة (الموظفون، الطلاب...) تُضاف هنا فقط */
const PAGE_REGISTRY = {
  home: { label: '🏠 الرئيسية', render: renderHomeView },
  // 🆕 مثال جاهز للاستخدام لاحقاً:
  // employees: { label: '👩‍🏫 الموظفون', render: renderEmployeesView },
};

/** 🆕 صلاحيات كل دور — بنفس فلسفة ROLE_PAGES بمشروع GAS بالضبط */
const ROLE_PAGES = {
  role_admin: ['home'],
  // 🆕 أدوار قادمة تُضاف هنا فقط: role_teacher_sup: ['home', ...], إلخ
};

function pagesForCurrentUser() {
  return ROLE_PAGES[APP.user.role] || ['home'];
}

/* ===================== تسجيل الدخول ===================== */

function renderLogin() {
  document.getElementById('app').innerHTML = `
    <div class="login-wrap">
      <div class="login-card">
        <h2>منصة مِرقاة التعليمية</h2>
        <div class="field"><label>اسم المستخدم</label><input id="username" type="text"></div>
        <div class="field"><label>كلمة المرور</label><input id="password" type="password"></div>
        <button id="loginBtn">دخول</button>
      </div>
    </div>`;

  document.getElementById('loginBtn').addEventListener('click', doLogin);
  ['username', 'password'].forEach((id) => {
    document.getElementById(id).addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });
  });
}

async function doLogin() {
  const btn = document.getElementById('loginBtn');
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  if (!username || !password) { showToast('الرجاء تعبئة الحقلين', 'error'); return; }

  btn.disabled = true; btn.textContent = 'جارِ الدخول...';
  try {
    const data = await apiCall('login', { method: 'POST', body: { username, password }, requiresAuth: false });
    APP.token = data.token;
    APP.user = data.user;

    if (data.firstLogin) {
      renderForceChangePassword();
    } else {
      localStorage.setItem('mirqat_token', APP.token);
      localStorage.setItem('mirqat_user', JSON.stringify(APP.user));
      showToast('مرحباً ' + APP.user.fullName, 'success');
      bootDashboard();
    }
  } catch (e) {
    showToast(e.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'دخول';
  }
}

function renderForceChangePassword() {
  document.getElementById('app').innerHTML = `
    <div class="login-wrap">
      <div class="login-card">
        <h2>تعيين كلمة مرور جديدة</h2>
        <p class="login-sub">هذا أول دخول لك، يجب تعيين كلمة مرور جديدة قبل المتابعة</p>
        <div class="field"><label>كلمة المرور الجديدة</label><input id="newPassword" type="password"></div>
        <button id="setPasswordBtn">تعيين وحفظ</button>
      </div>
    </div>`;

  document.getElementById('setPasswordBtn').addEventListener('click', async () => {
    const btn = document.getElementById('setPasswordBtn');
    const newPassword = document.getElementById('newPassword').value;
    if (newPassword.length < 6) { showToast('كلمة المرور يجب ألا تقل عن 6 أحرف', 'error'); return; }

    btn.disabled = true; btn.textContent = 'جارِ الحفظ...';
    try {
      await apiCall('force-set-password', { method: 'POST', body: { newPassword } });
      localStorage.setItem('mirqat_token', APP.token);
      localStorage.setItem('mirqat_user', JSON.stringify(APP.user));
      showToast('تم تعيين كلمة المرور بنجاح', 'success');
      bootDashboard();
    } catch (e) {
      showToast(e.message, 'error');
      btn.disabled = false; btn.textContent = 'تعيين وحفظ';
    }
  });
}

async function doLogout() {
  try { await apiCall('logout', { method: 'POST' }); } catch (e) { /* لا يهم فشل الطلب، نمسح محلياً بأي حال */ }
  localStorage.removeItem('mirqat_token');
  localStorage.removeItem('mirqat_user');
  APP.token = null; APP.user = null;
  renderLogin();
}

/* ===================== هيكل لوحة التحكم ===================== */

function bootDashboard() {
  renderShell();
  const lastView = localStorage.getItem('mirqat_lastView');
  navigate(lastView && PAGE_REGISTRY[lastView] ? lastView : pagesForCurrentUser()[0]);
}

function renderShell() {
  const initials = (APP.user.fullName || '؟').trim().charAt(0);
  document.getElementById('app').innerHTML = `
    <div class="app-header">
      <button class="menu-toggle-btn" id="menuToggle">☰</button>
      <div class="app-header-title">منصة مِرقاة التعليمية</div>
      <div class="header-user">
        <span class="user-avatar">${initials}</span>
        <span class="user-name">${escapeHtml(APP.user.fullName)}</span>
        <button class="logout-btn-small" id="logoutBtn">خروج</button>
      </div>
    </div>
    <div class="app-body">
      <div class="sidebar-overlay" id="sidebarOverlay"></div>
      <aside class="sidebar" id="sidebar"><nav id="sidebarNav"></nav></aside>
      <main class="main-content" id="mainContent"></main>
    </div>`;

  const pages = pagesForCurrentUser();
  document.getElementById('sidebarNav').innerHTML = pages
    .map((key) => `<a data-view="${key}">${PAGE_REGISTRY[key].label}</a>`)
    .join('');

  document.querySelectorAll('#sidebarNav a').forEach((a) => {
    a.addEventListener('click', () => { navigate(a.getAttribute('data-view')); closeSidebarMobile(); });
  });

  document.getElementById('logoutBtn').addEventListener('click', doLogout);
  document.getElementById('menuToggle').addEventListener('click', (e) => {
    e.stopPropagation();
    const sidebar = document.getElementById('sidebar');
    const isOpen = sidebar.classList.toggle('open');
    document.getElementById('sidebarOverlay').classList.toggle('show', isOpen);
  });
  document.getElementById('sidebarOverlay').addEventListener('click', closeSidebarMobile);
}

function closeSidebarMobile() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('show');
}

function navigate(view) {
  if (!PAGE_REGISTRY[view] || !pagesForCurrentUser().includes(view)) {
    view = pagesForCurrentUser()[0];
  }
  localStorage.setItem('mirqat_lastView', view);
  document.querySelectorAll('#sidebarNav a').forEach((a) => {
    a.classList.toggle('active', a.getAttribute('data-view') === view);
  });
  PAGE_REGISTRY[view].render();

  const main = document.getElementById('mainContent');
  main.classList.remove('content-fade-in');
  void main.offsetWidth;
  main.classList.add('content-fade-in');
}

/* ===================== الصفحة الرئيسية (نموذج لأي صفحة قادمة) ===================== */

function renderHomeView() {
  document.getElementById('mainContent').innerHTML = `
    <div class="card">
      <h2>أهلاً، ${escapeHtml(APP.user.fullName)} 👋</h2>
      <p style="color:#666">${escapeHtml(APP.user.role)} — ${escapeHtml(APP.user.branch)}</p>
    </div>`;
}

/* ===================== أدوات مساعدة عامة ===================== */

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ===================== نقطة الانطلاق ===================== */

document.addEventListener('DOMContentLoaded', () => {
  const savedToken = localStorage.getItem('mirqat_token');
  const savedUser = localStorage.getItem('mirqat_user');
  if (savedToken && savedUser) {
    APP.token = savedToken;
    APP.user = JSON.parse(savedUser);
    bootDashboard();
  } else {
    renderLogin();
  }
});
