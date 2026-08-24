// public/js/app.js
// =====================================================================
// هيكل التطبيق الكامل — نظام صفحة واحدة (SPA) بنفس فلسفة JavaScript.html
// بمشروع GAS بالضبط: PAGE_REGISTRY لتسجيل الصفحات، ROLE_PAGES للصلاحيات،
// navigate() للتنقّل بلا إعادة تحميل. كل صفحة قادمة تُضاف هنا بسطرين
// فقط بلا أي حاجة لإعادة بناء الهيكل.
// =====================================================================

const APP = { token: null, user: null };

/** 🆕 سجل الصفحات المركزي — أي صفحة قادمة (الموظفون، الطلاب...) تُضاف هنا فقط */
/**
 * 🆕 خارطة الصلاحيات الكاملة — مرجع دائم لكل تفاصيل كل دور (مو فقط
 * أسماء الصفحات). تُستخدَم كوثيقة مرجعية إلزامية عند بناء أي صفحة
 * قادمة (تقويم، جداول، مراسلات، تحضير، سلوك، تكاليف...) — بلا أي
 * استثناء أو تفسير شخصي. أي تفصيل غير مذكور هنا = يُرجَع للمستخدم
 * للتأكيد قبل التنفيذ، لا افتراض.
 *
 * ================= role_admin =================
 * كل الصفحات، بلا أي قيد. إضافة/تعديل/حذف/تفعيل/تعطيل لأي شيء.
 *
 * ================= role_teacher =================
 * الصفحات: الرئيسية، التقويم الدراسي، الجداول الدراسية (عرض فقط —
 *   حصص واختبارات فرعه)، المراسلات، التكاليف، رصد الدرجات اليومي،
 *   تحضير الطلاب، تقارير أداء.
 * القيود:
 *   - الجداول/التكاليف/الدرجات/التحضير: مقيَّدة بالصفوف التي يدرّسها فقط.
 *   - التكاليف/الدرجات/التحضير: التعديل مسموح فقط خلال 30 دقيقة من
 *     وقت التسجيل الأصلي (نافذة تصحيح، لا تعديل مفتوح بلا حد زمني).
 *   - المراسلات: مقيَّدة بفرعه (لا يراسل فروعاً أخرى) — باستثناء
 *     يقدر يراسل الأدمن ومراقب الفروع دائماً بلا قيد فرع (شكاوى/اقتراحات).
 *   - تقارير الأداء: لصفوفه/طلابه الذين يدرّسهم فقط — لا كل الطلاب.
 *
 * ================= role_student_sup =================
 * الصفحات: الرئيسية، التقويم، الجداول (عرض فرعه)، المراسلات، تحضير
 *   الطلاب، السلوك، تقارير أداء، تحديد حالة سداد الطالب (مسدد/غير مسدد).
 * القيود:
 *   - كل شيء مقيَّد بفرعه فقط (لا فروع أخرى).
 *   - تحضير الطلاب: تعديل أي حضور/غياب لأي طالب **بلا قيد وقت** (خلافاً للمعلم).
 *   - السلوك: إضافة وتعديل مسموحان له؛ **الحذف للأدمن فقط**.
 *   - المراسلات: نفس استثناء المعلم (الأدمن + مراقب الفروع بلا قيد).
 *
 * ================= role_teacher_sup =================
 * الصفحات: الرئيسية، التقويم، الجداول (فرعه — مع صلاحية **تخصيص**
 *   جدول الحصص لأي صف، وإضافة جداول اختبارات بخيارات تخصيص حسب
 *   المرحلة/الصف)، المراسلات، التكاليف (فرعه + تقارير أداء معلمين
 *   بتنظيم يومي)، تحضير المعلمين (فرعه، بلا قيد وقت)، تقييم أداء
 *   المعلمين (إضافة/تعديل له، **الحذف للأدمن فقط**)، تقارير أداء معلمين.
 * القيود: كل شيء مقيَّد بفرعه فقط. نفس استثناء المراسلة.
 *
 * ================= Admission (إدارة القبول والتسجيل) =================
 * الصفحات: الرئيسية، التقويم، المراسلات، تسجيل الطلاب، تقارير
 *   إحصائيات طلاب، تحديد حالة سداد الطالب.
 * القيود: كل شيء مقيَّد بفرعه فقط. نفس استثناء المراسلة.
 *
 * ================= role_branch_monitor (مراقب فروع) =================
 * نفس صلاحيات role_teacher_sup بالضبط (جداول+تخصيص، مراسلات، تكاليف،
 *   تحضير مشرفين، تقييم أداء مشرفين، تقارير)، **لكن غير مقيَّد بفرع
 *   واحد** — يعمل على عدة فروع معاً (كل الفروع المُسندة له).
 * ملاحظة: هو نفسه أحد استثناءات المراسلة العامة (يستقبل من الجميع
 *   بلا قيد فرع، تماماً مثل الأدمن).
 *
 * ================= role_parent / role_studen =================
 * ممنوعان هيكلياً من دخول موقع الموظفين (جدول family_accounts منفصل
 *   تماماً عن users — لا يُوجَدان أصلاً بجدول الدخول هذا). 🆕 مطلوب
 *   لاحقاً: رسالة تحذير واضحة عند محاولات دخول متكررة بهذا الحساب.
 *
 * ================= قاعدة عامة تشمل كل الأدوار =================
 * 🆕 استثناء المراسلة: **أي دور** يقدر يراسل الأدمن ومراقب الفروع
 *   دائماً بلا أي قيد فرع (قناة شكاوى/اقتراحات مفتوحة) — ليس المعلم فقط.
 */
const PAGE_REGISTRY = {
  home: { label: 'الرئيسية', icon: 'home', render: renderHomeView },
  employees: { label: 'الموظفون', icon: 'employees', render: renderEmployeesView },
  students: { label: 'الطلاب', icon: 'students', render: renderStudentsView },
  parents: { label: 'أولياء الأمور', icon: 'guardians', render: renderParentsView },
  familyAccounts: { label: 'حسابات الطلاب والأسر', icon: 'lock', render: renderFamilyAccountsView },
  users: { label: 'المستخدمون', icon: 'users', render: renderUsersView },
  auditLog: { label: 'سجل التتبّع', icon: 'lock', render: renderAuditLogView },
  siteSettings: { label: 'الإعدادات', icon: 'settingsGear', render: renderSiteSettingsView },
  studentAttendance: { label: 'تحضير الطلاب', icon: 'students', render: renderStudentAttendanceView },
  staffAttendance: { label: 'تحضير الموظفين', icon: 'employees', render: renderStaffAttendanceView },
  studentBehavior: { label: 'سلوك الطلاب', icon: 'guardians', render: renderStudentBehaviorView },
  performance: { label: 'تقييم الأداء', icon: 'tasks', render: renderPerformanceView },
  messages: { label: 'المراسلات', icon: 'messages', render: renderMessagesView },
};

/** 🆕 صلاحيات كل دور — مطابقة تماماً لمنطق ROLE_PAGES بمشروع GAS الأصلي،
 * لكن مقتصرة على الصفحات المبنية فعلياً بهذا المشروع حتى الآن. أي دور
 * غير مذكور هنا (أو صفحة لم تُبنَ بعد لدوره) يحصل تلقائياً على "الرئيسية" فقط. */
const ROLE_PAGES = {
  role_admin: ['home', 'employees', 'students', 'parents', 'familyAccounts', 'users', 'auditLog', 'siteSettings', 'studentAttendance', 'staffAttendance', 'studentBehavior', 'performance', 'messages'],
  role_teacher: ['home', 'studentAttendance', 'performance', 'messages'],
  role_student_sup: ['home', 'students', 'parents', 'familyAccounts', 'studentAttendance', 'studentBehavior', 'performance', 'messages'],
  role_teacher_sup: ['home', 'staffAttendance', 'performance', 'messages'],
  Admission: ['home', 'students', 'parents', 'familyAccounts', 'messages'],
  role_branch_monitor: ['home', 'staffAttendance', 'performance', 'messages'],
};

function pagesForCurrentUser() {
  return ROLE_PAGES[APP.user.role] || ['home'];
}

/* ===================== تسجيل الدخول ===================== */

function renderLogin() {
  document.getElementById('app').innerHTML = `
    <div class="login-wrap">
      <div class="login-card">
        <div class="login-logo">${mirqatLogo(44)}</div>
        <h2>مِرقاة</h2>
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
    const data = await apiCall('auth', { method: 'POST', body: { action: 'login', username, password }, requiresAuth: false });
    APP.token = data.token;
    APP.user = data.user;

    if (data.firstLogin) {
      localStorage.setItem('mirqat_token', APP.token); // 🆕 كان الخطأ هنا — التوكن لازم يُحفَظ حتى بمسار أول دخول
      localStorage.setItem('mirqat_user', JSON.stringify(APP.user));
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
      await apiCall('auth', { method: 'POST', body: { action: 'forceSetPassword', newPassword } });
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
  document.getElementById('detailModalOverlay')?.remove(); // 🆕 حماية عامة — يزيل أي نافذة منبثقة عالقة قبل شاشة الدخول
  try { await apiCall('auth', { method: 'POST', body: { action: 'logout' } }); } catch (e) { /* لا يهم فشل الطلب، نمسح محلياً بأي حال */ }
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

/** 🆕 شعار مِرقاة — مُبرمَج بالكامل (SVG)، سلّم متدرّج صاعد ينتهي بسهم (رمز الارتقاء) */
function mirqatLogo(size) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <path d="M 15 85 L 15 65 L 35 65 L 35 45 L 55 45 L 55 25 L 72 25" fill="none" stroke="#202124" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M 57 17 L 76 25 L 68 43" fill="none" stroke="#202124" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="15" cy="85" r="7" fill="#DAF39F"/>
  </svg>`;
}

function renderShell() {
  const initials = (APP.user.fullName || '؟').trim().charAt(0);
  document.getElementById('app').innerHTML = `
    <div class="app-body">
      <div class="sidebar-overlay" id="sidebarOverlay"></div>
      <aside class="sidebar" id="sidebar">
        <div class="sidebar-brand">
          ${mirqatLogo(30)}<span class="brand-text">مِرقاة</span>
          <button type="button" class="sidebar-collapse-btn" id="sidebarCollapseBtn">${ICONS.chevronDown()}</button>
          <button type="button" class="sidebar-close-btn" id="sidebarCloseBtn">${ICONS.close()}</button>
        </div>
        <nav id="sidebarNav"></nav>
      </aside>
      <div class="app-main-col">
        <div class="app-header">
          <div class="header-start">
            <button class="menu-toggle-btn" id="menuToggle">☰</button>
            <div class="header-brand-mobile">${mirqatLogo(24)}<span>مِرقاة</span></div>
          </div>
          <div class="header-branch-label" id="headerBranchLabel"></div>
          <div class="header-search" style="position:relative">
            ${ICONS.search()}
            <input type="text" placeholder="بحث..." id="globalSearchInput" autocomplete="off">
            <span class="header-search-kbd">⌘K</span>
            <div class="search-results-box" id="searchResultsBox"></div>
          </div>
          <div class="header-actions">
            <button class="header-icon-btn" id="notifBtn">${ICONS.bell()}<span class="notif-badge" id="notifBadge" style="display:none"></span></button>
            <div class="header-user" id="userMenuBtn">
              <span class="user-avatar">${initials}</span>
              <span class="user-name">${escapeHtml(APP.user.fullName)}</span>
              ${ICONS.chevronDown()}
              <div class="user-dropdown" id="userDropdown">
                <button type="button" id="openProfileInfoBtn">${ICONS.users()} معلومات المستخدم</button>
                <button type="button" id="dropdownLogoutBtn">${ICONS.logout()} تسجيل الخروج</button>
              </div>
            </div>
          </div>
        </div>
        <main class="main-content" id="mainContent"></main>
        <nav class="bottom-nav" id="bottomNav"></nav>
      </div>
    </div>`;

  const pages = pagesForCurrentUser();
  document.getElementById('sidebarNav').innerHTML = pages
    .map((key) => `<a data-view="${key}" title="${PAGE_REGISTRY[key].label}">${ICONS[PAGE_REGISTRY[key].icon]()}<span>${PAGE_REGISTRY[key].label}</span></a>`)
    .join('');

  document.querySelectorAll('#sidebarNav a').forEach((a) => {
    a.addEventListener('click', () => { navigate(a.getAttribute('data-view')); closeSidebarMobile(); });
  });

  // 🆕 الشريط السفلي بالجوال — 4 اختصارات ثابتة (لا تتبع PAGE_REGISTRY)، منفصلة تماماً
  // عن القائمة الجانبية اللي تبقى تحتوي كل الصفحات الأخرى (تُفتَح بزر ☰)
  const BOTTOM_NAV_ITEMS = [
    { key: 'home', label: 'الرئيسية', icon: 'home', ready: true },
    { key: 'messages', label: 'المراسلات', icon: 'messages', ready: false },
    { key: 'search', label: 'بحث', icon: 'search', ready: true },
    { key: 'tasks', label: 'المهام', icon: 'tasks', ready: false },
  ];
  document.getElementById('bottomNav').innerHTML = BOTTOM_NAV_ITEMS
    .map((item) => `<a data-bottom-key="${item.key}" data-ready="${item.ready}">${ICONS[item.icon]()}<span>${item.label}</span></a>`)
    .join('');

  document.querySelectorAll('#bottomNav a').forEach((a) => {
    a.addEventListener('click', () => {
      const key = a.getAttribute('data-bottom-key');
      const isReady = a.getAttribute('data-ready') === 'true';
      if (!isReady) { showToast('قريباً — هذي الصفحة لم تُبنَ بعد', 'error'); return; }
      if (key === 'search') { openSearchModal(); return; } // 🆕 البحث يفتح نافذة مخصَّصة بالجوال بدل صفحة
      navigate(key);
      document.querySelectorAll('#bottomNav a').forEach((x) => x.classList.remove('active'));
      a.classList.add('active');
    });
  });
  document.querySelector('#bottomNav a[data-bottom-key="home"]')?.classList.add('active');

  document.getElementById('menuToggle').addEventListener('click', (e) => {
    e.stopPropagation();
    const sidebar = document.getElementById('sidebar');
    const isOpen = sidebar.classList.toggle('open');
    document.getElementById('sidebarOverlay').classList.toggle('show', isOpen);
  });
  document.getElementById('sidebarOverlay').addEventListener('click', closeSidebarMobile);
  document.getElementById('sidebarCloseBtn').addEventListener('click', closeSidebarMobile);

  // 🆕 حماية إضافية بالجافاسكربت — تُخفي شريط البحث بناءً على العرض
  // الحقيقي للشاشة (window.innerWidth)، بلا اعتماد على استعلامات CSS
  // إطلاقاً. تعمل حتى لو تعطّلت الاستعلامات لأي سبب متعلّق بالمتصفح.
  function applyResponsiveJS() {
    const isMobile = window.innerWidth <= 860;
    const searchBox = document.querySelector('.header-search');
    if (searchBox) searchBox.style.display = isMobile ? 'none' : 'flex';
    const bottomNavEl = document.getElementById('bottomNav');
    if (bottomNavEl) bottomNavEl.style.display = isMobile ? 'flex' : 'none';
    const menuBtn = document.getElementById('menuToggle');
    if (menuBtn) menuBtn.style.display = isMobile ? 'flex' : 'none'; // 🆕 مخفي بسطح المكتب بشكل مؤكَّد — القائمة الجانبية ظاهرة أصلاً هناك
  }
  applyResponsiveJS();
  window.addEventListener('resize', applyResponsiveJS);

  // 🆕 طيّ الشريط الجانبي (أيقونات فقط) — يُحفَظ الاختيار بالمتصفح، يعمل على سطح المكتب فقط (الجوال له سلوك منفصل)
  const collapseBtn = document.getElementById('sidebarCollapseBtn');
  const sidebarEl = document.getElementById('sidebar');
  if (localStorage.getItem('mirqat_sidebar_collapsed') === 'true') sidebarEl.classList.add('collapsed');
  collapseBtn.addEventListener('click', () => {
    const isCollapsed = sidebarEl.classList.toggle('collapsed');
    localStorage.setItem('mirqat_sidebar_collapsed', isCollapsed);
  });

  // 🆕 قائمة المستخدم المنسدلة (بديل زر الخروج المنفصل — مطابق للتصميم المرجعي)
  document.getElementById('userMenuBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('userDropdown').classList.toggle('show');
  });
  document.addEventListener('click', () => { document.getElementById('userDropdown')?.classList.remove('show'); });
  document.getElementById('openProfileInfoBtn').addEventListener('click', openMyProfileModal);
  document.getElementById('dropdownLogoutBtn').addEventListener('click', doLogout);
  wireDesktopSearch();

  // 🆕 اسم الفرع بالشريط العلوي — أو اسم المدرسة لو المستخدم مرتبط بأكثر من فرع
  (async () => {
    const branchLabel = document.getElementById('headerBranchLabel');
    const allBranches = APP.user.allBranches || [APP.user.branch];
    if (allBranches.length > 1) {
      try {
        const settings = await getSettingsOnce();
        branchLabel.textContent = settings.schoolName;
      } catch (e) {
        branchLabel.textContent = APP.user.branch; // احتياط لو فشل الجلب لأي سبب
      }
    } else {
      branchLabel.textContent = APP.user.branch;
    }
  })();

  // 🆕 عدد الرسائل غير المقروءة بالجرس — يتحدَّث عند كل تحميل للوحة
  apiCall('audit-log', { method: 'POST', body: { action: 'unreadCount' } }).then((r) => {
    const badge = document.getElementById('notifBadge');
    if (badge && r.count > 0) badge.style.display = 'block';
  }).catch(() => {});
  document.getElementById('notifBtn').addEventListener('click', () => navigate('messages'));
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
      <h2>أهلاً، ${escapeHtml(APP.user.fullName)}</h2>
      <p style="color:#666">${escapeHtml(APP.user.role)} — ${escapeHtml(APP.user.branch)}</p>
    </div>`;
}

/* ===================== صفحة الموظفين ===================== */

let cachedSettings = null;

async function getSettingsOnce() {
  if (!cachedSettings) cachedSettings = await apiCall('settings', { method: 'POST', body: { action: 'get' }, requiresAuth: false });
  return cachedSettings;
}

/**
 * 🆕 تحويل تقريبي (Transliteration) من العربي للإنجليزي بالحروف — ليس
 * ترجمة حقيقية (الأسماء لا تُترجَم، بل تُكتَب بلفظها بحروف لاتينية).
 * يملأ حقل الاسم الإنجليزي تلقائياً كمقترح أولي، والأدمن يقدر يعدّله
 * يدوياً بأي وقت (لا يُفرَض عليه، فقط يوفّر عليه الكتابة من الصفر).
 */
const ARABIC_TO_LATIN_MAP = {
  'ا': 'a', 'أ': 'a', 'إ': 'i', 'آ': 'aa', 'ى': 'a', 'ب': 'b', 'ت': 't', 'ث': 'th',
  'ج': 'j', 'ح': 'h', 'خ': 'kh', 'د': 'd', 'ذ': 'th', 'ر': 'r', 'ز': 'z', 'س': 's',
  'ش': 'sh', 'ص': 's', 'ض': 'd', 'ط': 't', 'ظ': 'z', 'ع': 'a', 'غ': 'gh', 'ف': 'f',
  'ق': 'q', 'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n', 'ه': 'h', 'و': 'w', 'ي': 'y',
  'ة': 'ah', 'ء': 'a', 'ئ': 'e', 'ؤ': 'o', ' ': ' ',
};

function transliterateArabicToEnglish(text) {
  const letters = text.trim().split('').map((ch) => ARABIC_TO_LATIN_MAP[ch] ?? '').join('');
  return letters.split(' ').filter(Boolean).map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function branchCheckboxesHtml(branches, selected, prefix) {
  return branches.map((b) => `
    <label class="checkbox-item">
      <input type="checkbox" class="${prefix}-branch-cb" value="${escapeHtml(b)}" ${selected.includes(b) ? 'checked' : ''}> ${escapeHtml(b)}
    </label>`).join('');
}

function scopeCheckboxesHtml(items, selected, cls) {
  return items.map((item) => `
    <label class="checkbox-item">
      <input type="checkbox" class="${cls}" value="${escapeHtml(item)}" ${selected.includes(item) ? 'checked' : ''}> ${escapeHtml(item)}
    </label>`).join('');
}

async function renderEmployeesView() {
  const main = document.getElementById('mainContent');
  main.innerHTML = `<div class="card"><div class="skel-rows"><div class="skel-row"></div><div class="skel-row"></div></div></div>`;

  const settings = await getSettingsOnce();
  APP.allEmployees = [];

  main.innerHTML = `
    <button type="button" class="btn-toggle-form" id="toggleEmpFormBtn">${ICONS.plus()} إضافة موظف جديد</button>
    <div class="card" id="empFormCard" style="display:none">
      <h2 id="empFormTitle">إضافة موظف جديد</h2>
      <p style="color:#888;font-size:12.5px;margin-top:-10px">* كل الحقول إجبارية لضمان عدم نسيان أي بيانات مهمة</p>
      <form id="addEmpForm">
        <input type="hidden" id="emp_editId" value="">
        <div class="field"><label>الاسم بالعربي *</label><input id="emp_nameAr" type="text" required></div>
        <div class="field"><label>الاسم بالإنجليزي * <span style="font-weight:400;color:#888;font-size:11.5px">(تحويل تقريبي تلقائي، يمكن تعديله)</span></label><input id="emp_nameEn" type="text" required></div>
        <div class="field" id="emp_nationalIdField"><label>رقم الهوية/الإقامة/الجواز *</label><input id="emp_nationalId" type="text" maxlength="20" required></div>
        <div class="field"><label>نوع المستخدم *</label>
          <select id="emp_userType" required>
            <option value="" disabled selected>-- اختر --</option>
            ${settings.userTypes.map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>الدور *</label>
          <select id="emp_role" required>
            <option value="" disabled selected>-- اختر الدور --</option>
            <option value="role_admin">أدمن</option>
            <option value="role_teacher">معلم</option>
            <option value="role_teacher_sup">مشرف معلمين</option>
            <option value="role_student_sup">مشرف طلاب</option>
            <option value="Admission">إدارة القبول والتسجيل</option>
            <option value="role_branch_monitor">مراقب فروع</option>
          </select>
        </div>
        <div class="filter-card-title">الفرع/الفروع * (يمكن اختيار أكثر من فرع)</div>
        <div class="checkbox-list" id="emp_branchesBox">${branchCheckboxesHtml(settings.branches, [], 'emp')}</div>

        <div id="emp_teacherScopeBox" style="display:none">
          <div class="filter-card-title">نطاق المعلم — الصفوف</div>
          <div class="checkbox-list" id="emp_gradesBox">${scopeCheckboxesHtml(settings.grades, [], 'emp-grade-cb')}</div>
          <div class="filter-card-title">الشعب</div>
          <div class="checkbox-list" id="emp_sectionsBox">${scopeCheckboxesHtml(settings.sections, [], 'emp-section-cb')}</div>
          <div class="filter-card-title">المواد</div>
          <div class="checkbox-list" id="emp_subjectsBox">${scopeCheckboxesHtml(settings.subjects, [], 'emp-subject-cb')}</div>
        </div>

        <button type="submit" id="addEmpBtn" style="margin-top:14px">إضافة الموظف</button>
        <button type="button" id="cancelEditBtn" style="display:none;background:#888;margin-top:8px">إلغاء التعديل</button>
      </form>
    </div>

    <div class="card">
      <h3>قائمة الموظفين</h3>
      <div class="field"><label>بحث بالاسم أو الدور أو الفرع</label><input id="empSearchInput" type="text"></div>
      <div id="empListArea"><div class="skel-rows"><div class="skel-row"></div><div class="skel-row"></div></div></div>
    </div>`;

  wireFormToggle('toggleEmpFormBtn', 'empFormCard', `${ICONS.plus()} إضافة موظف جديد`);

  document.getElementById('emp_role').addEventListener('change', (e) => {
    document.getElementById('emp_teacherScopeBox').style.display = e.target.value === 'role_teacher' ? 'block' : 'none';
  });

  document.getElementById('emp_nameAr').addEventListener('blur', () => {
    const enField = document.getElementById('emp_nameEn');
    if (!enField.value.trim()) enField.value = transliterateArabicToEnglish(document.getElementById('emp_nameAr').value);
  });

  document.getElementById('addEmpForm').addEventListener('submit', saveEmployeeHandler);
  document.getElementById('cancelEditBtn').addEventListener('click', resetEmployeeForm);
  document.getElementById('empSearchInput').addEventListener('input', renderEmployeesTable);

  loadEmployeesList();
}

function collectCheckedValues(selector) {
  return Array.from(document.querySelectorAll(selector)).filter((el) => el.checked).map((el) => el.value);
}

function resetEmployeeForm() {
  document.getElementById('addEmpForm').reset();
  document.getElementById('emp_editId').value = '';
  document.getElementById('emp_nationalIdField').style.display = 'block';
  document.getElementById('emp_nationalId').required = true; // 🆕 يُعاد إجباره عند وضع الإضافة
  document.getElementById('emp_teacherScopeBox').style.display = 'none';
  document.getElementById('empFormTitle').textContent = 'إضافة موظف جديد';
  document.getElementById('addEmpBtn').textContent = 'إضافة الموظف';
  document.getElementById('cancelEditBtn').style.display = 'none';
  document.querySelectorAll('.emp-branch-cb, .emp-grade-cb, .emp-section-cb, .emp-subject-cb').forEach((cb) => { cb.checked = false; });
  document.getElementById('empFormCard').style.display = 'none'; // 🆕 يُخفى النموذج تلقائياً بعد الحفظ/الإلغاء
  document.getElementById('toggleEmpFormBtn').innerHTML = `${ICONS.plus()} إضافة موظف جديد`;
}

function startEditEmployee(emp) {
  document.getElementById('empFormCard').style.display = 'block'; // 🆕 يُظهر النموذج تلقائياً عند التعديل
  document.getElementById('toggleEmpFormBtn').innerHTML = `${ICONS.close()} إغلاق النموذج`;
  document.getElementById('emp_editId').value = emp.id;
  document.getElementById('emp_nameAr').value = emp.name_ar;
  document.getElementById('emp_nameEn').value = emp.name_en || '';
  document.getElementById('emp_nationalIdField').style.display = 'none'; // لا يُعدَّل رقم الهوية
  document.getElementById('emp_nationalId').required = false; // 🆕 أهم سطر — يمنع خطأ "حقل مخفٍ إجباري" الذي كان يُجمِّد الزر بالكامل
  document.getElementById('emp_userType').value = emp.user_type;
  document.getElementById('emp_role').value = emp.role;
  document.getElementById('emp_teacherScopeBox').style.display = emp.role === 'role_teacher' ? 'block' : 'none';

  document.querySelectorAll('.emp-branch-cb').forEach((cb) => { cb.checked = emp.all_branches.includes(cb.value); });
  document.querySelectorAll('.emp-grade-cb').forEach((cb) => { cb.checked = (emp.grades || []).includes(cb.value); });
  document.querySelectorAll('.emp-section-cb').forEach((cb) => { cb.checked = (emp.sections || []).includes(cb.value); });
  document.querySelectorAll('.emp-subject-cb').forEach((cb) => { cb.checked = (emp.subjects || []).includes(cb.value); });

  document.getElementById('empFormTitle').textContent = 'تعديل بيانات: ' + emp.name_ar;
  document.getElementById('addEmpBtn').textContent = 'حفظ التعديلات';
  document.getElementById('cancelEditBtn').style.display = 'inline-block';
  document.getElementById('empFormCard').scrollIntoView({ behavior: 'smooth' });
}

async function saveEmployeeHandler(e) {
  e.preventDefault();
  const editId = document.getElementById('emp_editId').value;
  const btn = document.getElementById('addEmpBtn');
  btn.disabled = true; btn.textContent = 'جارِ الحفظ...';

  const branches = collectCheckedValues('.emp-branch-cb');
  if (!branches.length) { showToast('اختر فرعاً واحداً على الأقل', 'error'); btn.disabled = false; btn.textContent = editId ? 'حفظ التعديلات' : 'إضافة الموظف'; return; }

  const body = {
    nameAr: document.getElementById('emp_nameAr').value.trim(),
    nameEn: document.getElementById('emp_nameEn').value.trim(),
    userType: document.getElementById('emp_userType').value,
    role: document.getElementById('emp_role').value,
    branches,
    grades: collectCheckedValues('.emp-grade-cb'),
    sections: collectCheckedValues('.emp-section-cb'),
    subjects: collectCheckedValues('.emp-subject-cb'),
  };
  if (!editId) body.nationalId = document.getElementById('emp_nationalId').value.trim();

  try {
    if (editId) {
      await apiCall('employees', { method: 'POST', body: { action: 'update', id: editId, ...body } });
      showToast('تم تحديث بيانات الموظف بنجاح', 'success');
    } else {
      await apiCall('employees', { method: 'POST', body: { action: 'add', ...body } });
      showToast('تم إضافة الموظف بنجاح — كلمة المرور المبدئية هي رقم الهوية', 'success');
    }
    resetEmployeeForm();
    loadEmployeesList();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = editId ? 'حفظ التعديلات' : 'إضافة الموظف';
  }
}

async function loadEmployeesList() {
  const area = document.getElementById('empListArea');
  try {
    APP.allEmployees = await apiCall('employees', { method: 'POST', body: { action: 'list' } });
    renderEmployeesTable();
  } catch (e) {
    area.innerHTML = `<p style="color:#c62828">${escapeHtml(e.message)}</p>`;
  }
}

const ROLE_LABELS_AR = {
  role_admin: 'أدمن', role_teacher: 'معلم', role_teacher_sup: 'مشرف معلمين',
  role_student_sup: 'مشرف طلاب', Admission: 'إدارة القبول والتسجيل', role_branch_monitor: 'مراقب فروع',
};

function renderEmployeesTable() {
  const area = document.getElementById('empListArea');
  const q = (document.getElementById('empSearchInput').value || '').trim().toLowerCase();
  const list = APP.allEmployees.filter((e) => {
    if (!q) return true;
    return e.name_ar.toLowerCase().includes(q) ||
      (ROLE_LABELS_AR[e.role] || e.role).toLowerCase().includes(q) ||
      e.all_branches.some((b) => b.toLowerCase().includes(q));
  });

  if (!list.length) { area.innerHTML = '<p style="color:#888">لا يوجد موظفون مطابقون</p>'; return; }

  area.innerHTML = `<div class="person-card-grid">${list.map((e) => `
    <div class="person-card" data-id="${escapeHtml(e.id)}" data-card-clickable>
      <div class="person-card-header">
        <span class="person-avatar">${escapeHtml((e.name_ar || '؟').trim().charAt(0))}</span>
        <div class="person-card-info">
          <div class="person-card-name">${escapeHtml(e.name_ar)}</div>
          <div class="person-card-role">${escapeHtml(ROLE_LABELS_AR[e.role] || e.role)}</div>
        </div>
      </div>
      <div class="person-card-body">
        <div class="person-card-row"><span>الفروع</span><span>${escapeHtml(e.all_branches.join('، '))}</span></div>
      </div>
      <div class="person-card-footer">
        <div class="person-card-actions">
          <button type="button" class="btn-icon-edit" data-id="${escapeHtml(e.id)}">${ICONS.edit()}</button>
          <button type="button" class="btn-icon-delete" data-id="${escapeHtml(e.id)}" data-name="${escapeHtml(e.name_ar)}">${ICONS.trash()}</button>
        </div>
      </div>
    </div>`).join('')}</div>`;

  // 🆕 الضغط على أي مكان بالبطاقة (بخلاف الأزرار) يفتح نافذة التفاصيل والصلاحيات
  area.querySelectorAll('[data-card-clickable]').forEach((card) => {
    card.addEventListener('click', () => {
      const emp = APP.allEmployees.find((x) => x.id === card.getAttribute('data-id'));
      if (!emp) return;
      showDetailModal(emp.name_ar, ROLE_LABELS_AR[emp.role] || emp.role, [
        { label: 'الاسم بالإنجليزي', value: emp.name_en },
        { label: 'رقم الهوية/الإقامة', value: emp.national_id },
        { label: 'نوع المستخدم', value: emp.user_type },
        { label: 'الدور (الصلاحية)', value: ROLE_LABELS_AR[emp.role] || emp.role },
        { label: 'الفروع', value: emp.all_branches.join('، ') },
        { label: 'المرحلة', value: emp.stage },
        { label: 'الجنس', value: emp.gender },
        ...(emp.role === 'role_teacher' ? [
          { label: 'الصفوف', value: (emp.grades || []).join('، ') },
          { label: 'الشعب', value: (emp.sections || []).join('، ') },
          { label: 'المواد', value: (emp.subjects || []).join('، ') },
        ] : []),
      ]);
    });
  });

  area.querySelectorAll('.btn-icon-edit').forEach((btn) => {
    btn.addEventListener('click', (evt) => {
      evt.stopPropagation();
      const emp = APP.allEmployees.find((e) => e.id === btn.getAttribute('data-id'));
      if (emp) startEditEmployee(emp);
    });
  });
  area.querySelectorAll('.btn-icon-delete').forEach((btn) => {
    btn.addEventListener('click', async (evt) => {
      evt.stopPropagation();
      const name = btn.getAttribute('data-name');
      if (!confirm(`تأكيد حذف الموظف "${name}"؟ سيُحذَف حساب دخوله تلقائياً معه.`)) return;
      try {
        await apiCall('employees', { method: 'POST', body: { action: 'delete', id: btn.getAttribute('data-id') } });
        showToast('تم الحذف بنجاح', 'success');
        loadEmployeesList();
      } catch (e) {
        showToast(e.message, 'error');
      }
    });
  });
}

/* ===================== صفحة الطلاب ===================== */

async function renderStudentsView() {
  const main = document.getElementById('mainContent');
  main.innerHTML = `<div class="card"><div class="skel-rows"><div class="skel-row"></div><div class="skel-row"></div></div></div>`;

  const settings = await getSettingsOnce();
  APP.allStudents = [];

  main.innerHTML = `
    <button type="button" class="btn-toggle-form" id="toggleStuFormBtn">${ICONS.plus()} تسجيل طالب جديد</button>
    <div class="card" id="stuFormCard" style="display:none">
      <h2 id="stuFormTitle">تسجيل طالب جديد</h2>
      <p style="color:#888;font-size:12.5px;margin-top:-10px">* كل الحقول إجبارية لضمان عدم نسيان أي بيانات مهمة</p>
      <form id="addStuForm">
        <input type="hidden" id="stu_editId" value="">
        <div class="field"><label>الاسم بالعربي *</label><input id="stu_nameAr" type="text" required></div>
        <div class="field"><label>الاسم بالإنجليزي * <span style="font-weight:400;color:#888;font-size:11.5px">(تحويل تقريبي تلقائي)</span></label><input id="stu_nameEn" type="text" required></div>
        <div class="field" id="stu_nationalIdField"><label>رقم الهوية/الإقامة/الجواز *</label><input id="stu_nationalId" type="text" maxlength="20" required></div>
        <div class="field"><label>الجنسية</label><input id="stu_nationality" type="text"></div>
        <div class="field"><label>تاريخ الميلاد</label><input id="stu_dateOfBirth" type="date"></div>
        <div class="field"><label>الجنس</label>
          <select id="stu_gender">
            <option value="">-- غير محدَّد --</option>
            <option value="ذكر">ذكر</option>
            <option value="أنثى">أنثى</option>
          </select>
        </div>
        <div class="field"><label>الفرع *</label>
          <select id="stu_branch" required><option value="" disabled selected>-- اختر --</option>
            ${settings.branches.map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>المرحلة *</label>
          <select id="stu_stage" required><option value="" disabled selected>-- اختر --</option>
            ${settings.stages.map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>الصف *</label>
          <select id="stu_grade" required><option value="" disabled selected>-- اختر --</option>
            ${settings.grades.map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>الشعبة *</label>
          <select id="stu_section" required><option value="" disabled selected>-- اختر --</option>
            ${settings.sections.map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('')}
          </select>
        </div>
        <div class="filter-card-title">المواد الدراسية</div>
        <div class="checkbox-list" id="stu_subjectsBox">${scopeCheckboxesHtml(settings.subjects, [], 'stu-subject-cb')}</div>

        <button type="submit" id="addStuBtn" style="margin-top:14px">تسجيل الطالب</button>
        <button type="button" id="cancelStuEditBtn" style="display:none;background:#888;margin-top:8px">إلغاء التعديل</button>
      </form>
    </div>

    <div class="card">
      <h3>قائمة الطلاب</h3>
      <div class="field"><label>بحث بالاسم أو الصف أو الشعبة</label><input id="stuSearchInput" type="text"></div>
      <div id="stuListArea"><div class="skel-rows"><div class="skel-row"></div><div class="skel-row"></div></div></div>
    </div>`;

  wireFormToggle('toggleStuFormBtn', 'stuFormCard', `${ICONS.plus()} تسجيل طالب جديد`);

  document.getElementById('stu_nameAr').addEventListener('blur', () => {
    const enField = document.getElementById('stu_nameEn');
    if (!enField.value.trim()) enField.value = transliterateArabicToEnglish(document.getElementById('stu_nameAr').value);
  });

  document.getElementById('addStuForm').addEventListener('submit', saveStudentHandler);
  document.getElementById('cancelStuEditBtn').addEventListener('click', resetStudentForm);
  document.getElementById('stuSearchInput').addEventListener('input', renderStudentsTable);

  loadStudentsList();
}

function resetStudentForm() {
  document.getElementById('addStuForm').reset();
  document.getElementById('stu_editId').value = '';
  document.getElementById('stu_nationalIdField').style.display = 'block';
  document.getElementById('stu_nationalId').required = true;
  document.getElementById('stuFormTitle').textContent = 'تسجيل طالب جديد';
  document.getElementById('addStuBtn').textContent = 'تسجيل الطالب';
  document.getElementById('cancelStuEditBtn').style.display = 'none';
  document.querySelectorAll('.stu-subject-cb').forEach((cb) => { cb.checked = false; });
  document.getElementById('stuFormCard').style.display = 'none'; // 🆕 يُخفى النموذج تلقائياً بعد الحفظ/الإلغاء
  document.getElementById('toggleStuFormBtn').innerHTML = `${ICONS.plus()} تسجيل طالب جديد`;
}

function startEditStudent(stu) {
  document.getElementById('stuFormCard').style.display = 'block'; // 🆕 يُظهر النموذج تلقائياً عند التعديل
  document.getElementById('toggleStuFormBtn').innerHTML = `${ICONS.close()} إغلاق النموذج`;
  document.getElementById('stu_editId').value = stu.id;
  document.getElementById('stu_nameAr').value = stu.name_ar;
  document.getElementById('stu_nameEn').value = stu.name_en || '';
  document.getElementById('stu_nationalIdField').style.display = 'none';
  document.getElementById('stu_nationalId').required = false;
  document.getElementById('stu_nationality').value = stu.nationality || '';
  document.getElementById('stu_dateOfBirth').value = stu.date_of_birth || '';
  document.getElementById('stu_gender').value = stu.gender || '';
  document.getElementById('stu_branch').value = stu.branch;
  document.getElementById('stu_stage').value = stu.stage;
  document.getElementById('stu_grade').value = stu.grade;
  document.getElementById('stu_section').value = stu.section;
  document.querySelectorAll('.stu-subject-cb').forEach((cb) => { cb.checked = (stu.subjects || []).includes(cb.value); });

  document.getElementById('stuFormTitle').textContent = 'تعديل بيانات: ' + stu.name_ar;
  document.getElementById('addStuBtn').textContent = 'حفظ التعديلات';
  document.getElementById('cancelStuEditBtn').style.display = 'inline-block';
  document.getElementById('stuFormCard').scrollIntoView({ behavior: 'smooth' });
}

async function saveStudentHandler(e) {
  e.preventDefault();
  const editId = document.getElementById('stu_editId').value;
  const btn = document.getElementById('addStuBtn');
  btn.disabled = true; btn.textContent = 'جارِ الحفظ...';

  const body = {
    nameAr: document.getElementById('stu_nameAr').value.trim(),
    nameEn: document.getElementById('stu_nameEn').value.trim(),
    nationality: document.getElementById('stu_nationality').value.trim(),
    dateOfBirth: document.getElementById('stu_dateOfBirth').value,
    gender: document.getElementById('stu_gender').value,
    branch: document.getElementById('stu_branch').value,
    stage: document.getElementById('stu_stage').value,
    grade: document.getElementById('stu_grade').value,
    section: document.getElementById('stu_section').value,
    subjects: collectCheckedValues('.stu-subject-cb'),
  };
  if (!editId) body.nationalId = document.getElementById('stu_nationalId').value.trim();

  try {
    if (editId) {
      await apiCall('students', { method: 'POST', body: { action: 'update', id: editId, ...body } });
      showToast('تم تحديث بيانات الطالب بنجاح', 'success');
    } else {
      await apiCall('students', { method: 'POST', body: { action: 'add', ...body } });
      showToast('تم تسجيل الطالب بنجاح — حساب دخوله بموقعه المستقبلي جاهز أيضاً', 'success');
    }
    resetStudentForm();
    loadStudentsList();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = editId ? 'حفظ التعديلات' : 'تسجيل الطالب';
  }
}

async function loadStudentsList() {
  const area = document.getElementById('stuListArea');
  try {
    APP.allStudents = await apiCall('students', { method: 'POST', body: { action: 'list' } });
    renderStudentsTable();
  } catch (e) {
    area.innerHTML = `<p style="color:#c62828">${escapeHtml(e.message)}</p>`;
  }
}

function renderStudentsTable() {
  const area = document.getElementById('stuListArea');
  const q = (document.getElementById('stuSearchInput').value || '').trim().toLowerCase();
  const list = APP.allStudents.filter((s) => {
    if (!q) return true;
    return s.name_ar.toLowerCase().includes(q) || s.grade.toLowerCase().includes(q) || s.section.toLowerCase().includes(q);
  });

  if (!list.length) { area.innerHTML = '<p style="color:#888">لا يوجد طلاب مطابقون</p>'; return; }

  area.innerHTML = `<div class="person-card-grid">${list.map((s) => `
    <div class="person-card" data-id="${escapeHtml(s.id)}" data-card-clickable>
      <div class="person-card-header">
        <span class="person-avatar">${escapeHtml((s.name_ar || '؟').trim().charAt(0))}</span>
        <div class="person-card-info">
          <div class="person-card-name">${escapeHtml(s.name_ar)}</div>
          <div class="person-card-role">${escapeHtml(s.grade)} — ${escapeHtml(s.section)}</div>
        </div>
      </div>
      <div class="person-card-body">
        <div class="person-card-row"><span>الفرع</span><span>${escapeHtml(s.branch)}</span></div>
      </div>
      <div class="person-card-footer">
        <div class="person-card-actions">
          <button type="button" class="btn-icon-edit" data-id="${escapeHtml(s.id)}">${ICONS.edit()}</button>
          <button type="button" class="btn-icon-delete" data-id="${escapeHtml(s.id)}" data-name="${escapeHtml(s.name_ar)}">${ICONS.trash()}</button>
        </div>
      </div>
    </div>`).join('')}</div>`;

  area.querySelectorAll('[data-card-clickable]').forEach((card) => {
    card.addEventListener('click', () => {
      const stu = APP.allStudents.find((x) => x.id === card.getAttribute('data-id'));
      if (!stu) return;
      showDetailModal(stu.name_ar, `${stu.grade} — ${stu.section}`, [
        { label: 'الاسم بالإنجليزي', value: stu.name_en },
        { label: 'رقم الهوية/الإقامة', value: stu.national_id },
        { label: 'الجنسية', value: stu.nationality },
        { label: 'تاريخ الميلاد', value: stu.date_of_birth },
        { label: 'الجنس', value: stu.gender },
        { label: 'الفرع', value: stu.branch },
        { label: 'المرحلة', value: stu.stage },
        { label: 'الصف', value: stu.grade },
        { label: 'الشعبة', value: stu.section },
        { label: 'المواد', value: (stu.subjects || []).join('، ') },
        { label: 'حالة الرسوم', value: stu.fee_status },
      ]);
    });
  });

  area.querySelectorAll('.btn-icon-edit').forEach((btn) => {
    btn.addEventListener('click', (evt) => {
      evt.stopPropagation();
      const stu = APP.allStudents.find((s) => s.id === btn.getAttribute('data-id'));
      if (stu) startEditStudent(stu);
    });
  });
  area.querySelectorAll('.btn-icon-delete').forEach((btn) => {
    btn.addEventListener('click', async (evt) => {
      evt.stopPropagation();
      const name = btn.getAttribute('data-name');
      if (!confirm(`تأكيد حذف الطالب "${name}"؟ سيُحذَف حساب دخوله تلقائياً معه.`)) return;
      try {
        await apiCall('students', { method: 'POST', body: { action: 'delete', id: btn.getAttribute('data-id') } });
        showToast('تم الحذف بنجاح', 'success');
        loadStudentsList();
      } catch (e) {
        showToast(e.message, 'error');
      }
    });
  });
}

/* ===================== صفحة المستخدمون ===================== */

async function renderUsersView() {
  const main = document.getElementById('mainContent');
  main.innerHTML = `
    <div class="card" id="missingUsersCard" style="display:none">
      <h3>موظفون بلا حساب دخول</h3>
      <p style="color:#888;font-size:12.5px">حسابات لم تُنشأ تلقائياً لأي سبب — يمكنك إنشاؤها من هنا</p>
      <button type="button" id="createAllMissingUsersBtn" class="btn-outline-sm" style="margin-bottom:10px">${ICONS.plus()} إنشاء الكل دفعة واحدة</button>
      <div id="missingUsersList" class="checkbox-list"></div>
    </div>
    <div class="card">
      <h2>حسابات الموظفين</h2>
      <div class="field"><label>بحث بالاسم أو اسم المستخدم</label><input id="userSearchInput" type="text"></div>
      <div id="usersListArea"><div class="skel-rows"><div class="skel-row"></div><div class="skel-row"></div></div></div>
    </div>`;

  document.getElementById('userSearchInput').addEventListener('input', renderUsersTable);
  loadUsersList();
  loadMissingUserAccounts();
}

async function loadMissingUserAccounts() {
  try {
    if (!APP.allEmployees || !APP.allEmployees.length) {
      APP.allEmployees = await apiCall('employees', { method: 'POST', body: { action: 'list' } });
    }
    const users = await apiCall('users', { method: 'POST', body: { action: 'list' } });
    const existingIds = new Set(users.map((u) => u.id));
    const missing = APP.allEmployees.filter((e) => !existingIds.has(e.id));

    const card = document.getElementById('missingUsersCard');
    if (!missing.length) { card.style.display = 'none'; return; }
    card.style.display = 'block';

    document.getElementById('missingUsersList').innerHTML = missing.map((e) => `
      <span class="checkbox-item">${escapeHtml(e.name_ar)}
        <span data-create-missing="${escapeHtml(e.id)}" style="cursor:pointer;color:#2F7A4D;margin-right:4px">${ICONS.plus()}</span>
      </span>`).join('');

    document.querySelectorAll('[data-create-missing]').forEach((el) => {
      el.addEventListener('click', async () => {
        try {
          const result = await apiCall('users', { method: 'POST', body: { action: 'createMissing', id: el.getAttribute('data-create-missing') } });
          showToast('تم إنشاء الحساب — كلمة المرور: ' + result.tempPassword, 'success');
          loadUsersList(); loadMissingUserAccounts();
        } catch (e) { showToast(e.message, 'error'); }
      });
    });

    document.getElementById('createAllMissingUsersBtn').onclick = () => runBulkCreation('users', loadMissingUserAccounts, loadUsersList);
  } catch (e) { /* تجاهل بصمت لو فشل التحقق — لا يجب يعطّل الصفحة الأساسية */ }
}

/** 🆕 تشغيل الإنشاء الجماعي بالدفعات (50 كل مرة) مع شريط تقدّم — يُستخدَم بصفحتَي المستخدمين وحسابات الأسر معاً */
async function runBulkCreation(endpoint, onDone, onListRefresh, extraBody) {
  showToast('جارِ الإنشاء... لا تُغلق الصفحة', 'success');
  let totalCreated = 0;
  let remaining = 1;
  try {
    while (remaining > 0) {
      const result = await apiCall(endpoint, { method: 'POST', body: { action: 'createAllMissing', ...(extraBody || {}) } });
      totalCreated += result.createdThisBatch;
      remaining = result.remaining;
    }
    showToast(`تم إنشاء ${totalCreated} حساب بنجاح`, 'success');
  } catch (e) {
    showToast(e.message, 'error');
  } finally {
    onListRefresh(); onDone();
  }
}

async function loadUsersList() {
  const area = document.getElementById('usersListArea');
  try {
    APP.allUsers = await apiCall('users', { method: 'POST', body: { action: 'list' } });
    renderUsersTable();
  } catch (e) {
    area.innerHTML = `<p style="color:#c62828">${escapeHtml(e.message)}</p>`;
  }
}

function renderUsersTable() {
  const area = document.getElementById('usersListArea');
  const q = (document.getElementById('userSearchInput').value || '').trim().toLowerCase();
  const list = APP.allUsers.filter((u) => !q || u.nameAr.toLowerCase().includes(q) || u.username.toLowerCase().includes(q));

  if (!list.length) { area.innerHTML = '<p style="color:#888">لا توجد حسابات مطابقة</p>'; return; }

  area.innerHTML = `<div class="person-card-grid">${list.map((u) => {
    const isActive = u.status === 'active';
    return `
    <div class="person-card" data-id="${escapeHtml(u.id)}" data-card-clickable>
      <div class="person-card-header">
        <span class="person-avatar">${escapeHtml((u.nameAr || '؟').trim().charAt(0))}</span>
        <div class="person-card-info">
          <div class="person-card-name">${escapeHtml(u.nameAr)}</div>
          <div class="person-card-role">${escapeHtml(ROLE_LABELS_AR[u.role] || u.role || '—')}</div>
        </div>
        <span class="status-badge ${isActive ? 'status-badge-on' : 'status-badge-off'}">
          <span class="status-dot ${isActive ? 'status-dot-on' : 'status-dot-off'}"></span>${isActive ? 'مفعَّل' : 'معطَّل'}
        </span>
      </div>
      <div class="person-card-body">
        <div class="person-card-row"><span>اسم المستخدم</span><span>${escapeHtml(u.username)}</span></div>
      </div>
      <div class="person-card-footer">
        <div class="person-card-actions">
          <button type="button" class="btn-outline-sm ${isActive ? 'btn-danger-outline' : ''}" data-id="${escapeHtml(u.id)}" data-new-status="${isActive ? 'inactive' : 'active'}">
            ${isActive ? 'تعطيل' : 'تفعيل'}
          </button>
          <button type="button" class="btn-reset-pass btn-outline-sm" data-id="${escapeHtml(u.id)}" data-name="${escapeHtml(u.nameAr)}">${ICONS.key()} إعادة تعيين</button>
        </div>
      </div>
    </div>`;
  }).join('')}</div>`;

  area.querySelectorAll('[data-card-clickable]').forEach((card) => {
    card.addEventListener('click', () => {
      const u = APP.allUsers.find((x) => x.id === card.getAttribute('data-id'));
      if (!u) return;
      showDetailModal(u.nameAr, ROLE_LABELS_AR[u.role] || u.role || '—', [
        { label: 'اسم المستخدم', value: u.username },
        { label: 'الدور (الصلاحية)', value: ROLE_LABELS_AR[u.role] || u.role },
        { label: 'الفرع', value: u.branch },
        { label: 'حالة الحساب', value: u.status === 'active' ? 'مفعَّل' : 'معطَّل' },
        { label: 'تاريخ الإنشاء', value: u.createdAt ? new Date(u.createdAt).toLocaleDateString('ar') : null },
      ]);
    });
  });

  area.querySelectorAll('[data-new-status]').forEach((btn) => {
    btn.addEventListener('click', async (evt) => {
      evt.stopPropagation();
      const newStatus = btn.getAttribute('data-new-status');
      if (!confirm(newStatus === 'active' ? 'تأكيد تفعيل هذا الحساب؟' : 'تأكيد تعطيل هذا الحساب؟')) return;
      try {
        await apiCall('users', { method: 'POST', body: { action: 'toggleStatus', id: btn.getAttribute('data-id'), newStatus } });
        showToast(newStatus === 'active' ? 'تم التفعيل' : 'تم التعطيل', 'success');
        loadUsersList();
      } catch (e) {
        showToast(e.message, 'error');
      }
    });
  });

  area.querySelectorAll('.btn-reset-pass').forEach((btn) => {
    btn.addEventListener('click', async (evt) => {
      evt.stopPropagation();
      const name = btn.getAttribute('data-name');
      if (!confirm(`إعادة تعيين كلمة مرور "${name}" لرقم هويته الأصلي؟`)) return;
      try {
        const result = await apiCall('users', { method: 'POST', body: { action: 'resetPassword', id: btn.getAttribute('data-id') } });
        showToast('تمت إعادة التعيين — كلمة المرور الجديدة: ' + result.tempPassword, 'success');
      } catch (e) {
        showToast(e.message, 'error');
      }
    });
  });
}

/* ===================== صفحة أولياء الأمور ===================== */

let selectedParentStudentIds = [];

async function renderParentsView() {
  const main = document.getElementById('mainContent');
  main.innerHTML = `<div class="card"><div class="skel-rows"><div class="skel-row"></div><div class="skel-row"></div></div></div>`;

  const settings = await getSettingsOnce();
  if (!APP.allStudents || !APP.allStudents.length) {
    APP.allStudents = await apiCall('students', { method: 'POST', body: { action: 'list' } });
  }
  APP.allParents = [];
  selectedParentStudentIds = [];

  main.innerHTML = `
    <button type="button" class="btn-toggle-form" id="toggleParentFormBtn">${ICONS.plus()} تسجيل ولي أمر جديد</button>
    <div class="card" id="parentFormCard" style="display:none">
      <h2 id="parentFormTitle">تسجيل ولي أمر جديد</h2>
      <p style="color:#888;font-size:12.5px;margin-top:-10px">* كل الحقول إجبارية لضمان عدم نسيان أي بيانات مهمة</p>
      <form id="addParentForm">
        <input type="hidden" id="parent_editId" value="">
        <div class="field"><label>الاسم بالعربي *</label><input id="parent_nameAr" type="text" required></div>
        <div class="field"><label>الاسم بالإنجليزي * <span style="font-weight:400;color:#888;font-size:11.5px">(تحويل تقريبي تلقائي)</span></label><input id="parent_nameEn" type="text" required></div>
        <div class="field" id="parent_nationalIdField"><label>رقم الهوية/الإقامة/الجواز *</label><input id="parent_nationalId" type="text" maxlength="20" required></div>
        <div class="field"><label>رقم الجوال *</label><input id="parent_phone" type="tel" required></div>
        <div class="field"><label>الفرع *</label>
          <select id="parent_branch" required><option value="" disabled selected>-- اختر --</option>
            ${settings.branches.map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>صلة القرابة *</label>
          <select id="parent_relationship" required>
            <option value="" disabled selected>-- اختر --</option>
            <option value="أب">أب</option>
            <option value="أم">أم</option>
            <option value="ولي أمر آخر">ولي أمر آخر</option>
          </select>
        </div>

        <div class="student-linker-box">
          <div class="filter-card-title">ربط بالطالب/الطلاب *</div>
          <div class="student-search-input-wrap">
            ${ICONS.search()}
            <input type="text" id="parentStudentSearch" placeholder="اكتب اسم الطالب للبحث...">
          </div>
          <div id="parentStudentSearchResults" class="student-search-results"></div>

          <div class="filter-card-title" style="margin-top:16px">الطلاب المرتبطون حالياً</div>
          <div id="parentSelectedStudents" class="student-chip-list">
            <span class="student-linker-empty">لا يوجد طالب مُختار بعد</span>
          </div>
        </div>

        <button type="submit" id="addParentBtn" style="margin-top:14px">تسجيل ولي الأمر</button>
        <button type="button" id="cancelParentEditBtn" style="display:none;background:#888;margin-top:8px">إلغاء التعديل</button>
      </form>
    </div>

    <div class="card">
      <h3>قائمة أولياء الأمور</h3>
      <div class="field"><label>بحث بالاسم أو رقم الجوال</label><input id="parentSearchInput" type="text"></div>
      <div id="parentsListArea"><div class="skel-rows"><div class="skel-row"></div><div class="skel-row"></div></div></div>
    </div>`;

  wireFormToggle('toggleParentFormBtn', 'parentFormCard', `${ICONS.plus()} تسجيل ولي أمر جديد`);

  document.getElementById('parent_nameAr').addEventListener('blur', () => {
    const enField = document.getElementById('parent_nameEn');
    if (!enField.value.trim()) enField.value = transliterateArabicToEnglish(document.getElementById('parent_nameAr').value);
  });

  document.getElementById('parentStudentSearch').addEventListener('input', renderParentStudentSearchResults);
  document.getElementById('addParentForm').addEventListener('submit', saveParentHandler);
  document.getElementById('cancelParentEditBtn').addEventListener('click', resetParentForm);
  document.getElementById('parentSearchInput').addEventListener('input', renderParentsTable);

  loadParentsList();
}

function renderParentStudentSearchResults() {
  const q = (document.getElementById('parentStudentSearch').value || '').trim().toLowerCase();
  const box = document.getElementById('parentStudentSearchResults');
  if (!q) { box.classList.remove('show'); box.innerHTML = ''; return; }
  const matches = APP.allStudents.filter((s) => s.name_ar.toLowerCase().includes(q) && !selectedParentStudentIds.includes(s.id)).slice(0, 8);
  box.classList.add('show');
  box.innerHTML = matches.map((s) => `
    <div class="student-search-result-item" data-add-student="${escapeHtml(s.id)}">
      <span class="person-avatar" style="width:32px;height:32px;font-size:13px">${escapeHtml((s.name_ar || '؟').trim().charAt(0))}</span>
      <div>
        <div class="search-result-label">${escapeHtml(s.name_ar)}</div>
        <div class="search-result-sublabel">${escapeHtml(s.grade)} — ${escapeHtml(s.section)}</div>
      </div>
      <span class="student-add-icon">${ICONS.plus()}</span>
    </div>
  `).join('') || '<p style="padding:12px;color:#aaa;font-size:12.5px;text-align:center">لا نتائج مطابقة</p>';

  box.querySelectorAll('[data-add-student]').forEach((el) => {
    el.addEventListener('click', () => {
      selectedParentStudentIds.push(el.getAttribute('data-add-student'));
      document.getElementById('parentStudentSearch').value = '';
      box.innerHTML = ''; box.classList.remove('show');
      renderSelectedParentStudents();
    });
  });
}

function renderSelectedParentStudents() {
  const box = document.getElementById('parentSelectedStudents');
  if (!selectedParentStudentIds.length) { box.innerHTML = '<span class="student-linker-empty">لا يوجد طالب مُختار بعد</span>'; return; }
  box.innerHTML = selectedParentStudentIds.map((sid) => {
    const stu = APP.allStudents.find((s) => s.id === sid);
    return `<span class="student-chip">
      <span class="person-avatar" style="width:24px;height:24px;font-size:11px">${escapeHtml((stu?.name_ar || '؟').trim().charAt(0))}</span>
      ${escapeHtml(stu ? stu.name_ar : sid)}
      <span data-remove-student="${escapeHtml(sid)}" class="student-chip-remove">${ICONS.close()}</span>
    </span>`;
  }).join('');
  box.querySelectorAll('[data-remove-student]').forEach((el) => {
    el.addEventListener('click', () => {
      selectedParentStudentIds = selectedParentStudentIds.filter((id) => id !== el.getAttribute('data-remove-student'));
      renderSelectedParentStudents();
    });
  });
}

function resetParentForm() {
  document.getElementById('addParentForm').reset();
  document.getElementById('parent_editId').value = '';
  document.getElementById('parent_nationalIdField').style.display = 'block';
  document.getElementById('parent_nationalId').required = true;
  document.getElementById('parentFormTitle').textContent = 'تسجيل ولي أمر جديد';
  document.getElementById('addParentBtn').textContent = 'تسجيل ولي الأمر';
  document.getElementById('cancelParentEditBtn').style.display = 'none';
  selectedParentStudentIds = [];
  renderSelectedParentStudents();
  document.getElementById('parentFormCard').style.display = 'none';
  document.getElementById('toggleParentFormBtn').innerHTML = `${ICONS.plus()} تسجيل ولي أمر جديد`;
}

function startEditParent(parent) {
  document.getElementById('parentFormCard').style.display = 'block';
  document.getElementById('toggleParentFormBtn').innerHTML = `${ICONS.close()} إغلاق النموذج`;
  document.getElementById('parent_editId').value = parent.id;
  document.getElementById('parent_nameAr').value = parent.name_ar;
  document.getElementById('parent_nameEn').value = parent.name_en || '';
  document.getElementById('parent_nationalIdField').style.display = 'none';
  document.getElementById('parent_nationalId').required = false;
  document.getElementById('parent_phone').value = parent.phone || '';
  document.getElementById('parent_branch').value = parent.branch;
  document.getElementById('parent_relationship').value = (parent.linked_students[0] && parent.linked_students[0].relationship) || '';
  selectedParentStudentIds = parent.linked_students.map((l) => l.id).filter(Boolean);
  renderSelectedParentStudents();

  document.getElementById('parentFormTitle').textContent = 'تعديل بيانات: ' + parent.name_ar;
  document.getElementById('addParentBtn').textContent = 'حفظ التعديلات';
  document.getElementById('cancelParentEditBtn').style.display = 'inline-block';
  document.getElementById('parentFormCard').scrollIntoView({ behavior: 'smooth' });
}

async function saveParentHandler(e) {
  e.preventDefault();
  const editId = document.getElementById('parent_editId').value;
  const btn = document.getElementById('addParentBtn');

  if (!selectedParentStudentIds.length) { showToast('اربط ولي الأمر بطالب واحد على الأقل', 'error'); return; }

  btn.disabled = true; btn.textContent = 'جارِ الحفظ...';
  const body = {
    nameAr: document.getElementById('parent_nameAr').value.trim(),
    nameEn: document.getElementById('parent_nameEn').value.trim(),
    phone: document.getElementById('parent_phone').value.trim(),
    branch: document.getElementById('parent_branch').value,
    relationship: document.getElementById('parent_relationship').value,
    studentIds: selectedParentStudentIds,
  };
  if (!editId) body.nationalId = document.getElementById('parent_nationalId').value.trim();

  try {
    if (editId) {
      await apiCall('parents', { method: 'POST', body: { action: 'update', id: editId, ...body } });
      showToast('تم تحديث بيانات ولي الأمر بنجاح', 'success');
    } else {
      await apiCall('parents', { method: 'POST', body: { action: 'add', ...body } });
      showToast('تم تسجيل ولي الأمر بنجاح — حساب دخوله جاهز أيضاً', 'success');
    }
    resetParentForm();
    loadParentsList();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = editId ? 'حفظ التعديلات' : 'تسجيل ولي الأمر';
  }
}

async function loadParentsList() {
  const area = document.getElementById('parentsListArea');
  try {
    APP.allParents = await apiCall('parents', { method: 'POST', body: { action: 'list' } });
    renderParentsTable();
  } catch (e) {
    area.innerHTML = `<p style="color:#c62828">${escapeHtml(e.message)}</p>`;
  }
}

function renderParentsTable() {
  const area = document.getElementById('parentsListArea');
  const q = (document.getElementById('parentSearchInput').value || '').trim().toLowerCase();
  const list = APP.allParents.filter((p) => !q || p.name_ar.toLowerCase().includes(q) || (p.phone || '').includes(q));

  if (!list.length) { area.innerHTML = '<p style="color:#888">لا يوجد أولياء أمور مطابقون</p>'; return; }

  area.innerHTML = `<div class="person-card-grid">${list.map((p) => `
    <div class="person-card" data-id="${escapeHtml(p.id)}" data-card-clickable>
      <div class="person-card-header">
        <span class="person-avatar">${escapeHtml((p.name_ar || '؟').trim().charAt(0))}</span>
        <div class="person-card-info">
          <div class="person-card-name">${escapeHtml(p.name_ar)}</div>
          <div class="person-card-role">${escapeHtml(p.phone || '')}</div>
        </div>
      </div>
      <div class="person-card-body">
        <div class="person-card-row"><span>الأبناء</span><span>${escapeHtml(p.linked_students.map((l) => l.name_ar).join('، ') || '—')}</span></div>
      </div>
      <div class="person-card-footer">
        <div class="person-card-actions">
          <button type="button" class="btn-icon-edit" data-id="${escapeHtml(p.id)}">${ICONS.edit()}</button>
          <button type="button" class="btn-icon-delete" data-id="${escapeHtml(p.id)}" data-name="${escapeHtml(p.name_ar)}">${ICONS.trash()}</button>
        </div>
      </div>
    </div>`).join('')}</div>`;

  area.querySelectorAll('[data-card-clickable]').forEach((card) => {
    card.addEventListener('click', () => {
      const p = APP.allParents.find((x) => x.id === card.getAttribute('data-id'));
      if (!p) return;
      showDetailModal(p.name_ar, p.phone, [
        { label: 'الاسم بالإنجليزي', value: p.name_en },
        { label: 'رقم الهوية/الإقامة', value: p.national_id },
        { label: 'رقم الجوال', value: p.phone },
        { label: 'الفرع', value: p.branch },
        { label: 'الأبناء المرتبطون', value: p.linked_students.map((l) => `${l.name_ar} (${l.relationship || '—'})`).join('، ') },
      ]);
    });
  });

  area.querySelectorAll('.btn-icon-edit').forEach((btn) => {
    btn.addEventListener('click', (evt) => {
      evt.stopPropagation();
      const p = APP.allParents.find((x) => x.id === btn.getAttribute('data-id'));
      if (p) startEditParent(p);
    });
  });
  area.querySelectorAll('.btn-icon-delete').forEach((btn) => {
    btn.addEventListener('click', async (evt) => {
      evt.stopPropagation();
      const name = btn.getAttribute('data-name');
      if (!confirm(`تأكيد حذف ولي الأمر "${name}"؟ سيُحذَف حساب دخوله تلقائياً معه.`)) return;
      try {
        await apiCall('parents', { method: 'POST', body: { action: 'delete', id: btn.getAttribute('data-id') } });
        showToast('تم الحذف بنجاح', 'success');
        loadParentsList();
      } catch (e) {
        showToast(e.message, 'error');
      }
    });
  });
}

/* ===================== صفحة حسابات الطلاب والأسر ===================== */

async function renderFamilyAccountsView() {
  const main = document.getElementById('mainContent');
  main.innerHTML = `
    <div class="card" id="missingFamAccCard" style="display:none">
      <h3>طلاب/أولياء أمور بلا حساب دخول</h3>
      <p style="color:#888;font-size:12.5px">حسابات لم تُنشأ تلقائياً لأي سبب — يمكنك إنشاؤها من هنا</p>
      <button type="button" id="createAllMissingFamAccBtn" class="btn-outline-sm" style="margin-bottom:10px">${ICONS.plus()} إنشاء الكل دفعة واحدة</button>
      <div id="missingFamAccList" class="checkbox-list"></div>
    </div>
    <div class="card">
      <h2>حسابات الطلاب وأولياء الأمور</h2>
      <div class="field"><label>بحث بالاسم أو اسم المستخدم</label><input id="famAccSearchInput" type="text"></div>
      <div id="famAccListArea"><div class="skel-rows"><div class="skel-row"></div><div class="skel-row"></div></div></div>
    </div>`;

  document.getElementById('famAccSearchInput').addEventListener('input', renderFamilyAccountsTable);
  loadFamilyAccountsList();
  loadMissingFamilyAccounts();
}

async function loadMissingFamilyAccounts() {
  try {
    if (!APP.allStudents || !APP.allStudents.length) {
      APP.allStudents = await apiCall('students', { method: 'POST', body: { action: 'list' } });
    }
    if (!APP.allParents || !APP.allParents.length) {
      APP.allParents = await apiCall('parents', { method: 'POST', body: { action: 'list' } });
    }
    const accounts = await apiCall('family-accounts', { method: 'POST', body: { action: 'list' } });
    const existingIds = new Set(accounts.map((a) => a.id));

    const missing = [
      ...APP.allStudents.filter((s) => !existingIds.has(s.id)).map((s) => ({ id: s.id, name_ar: s.name_ar, type: 'student' })),
      ...APP.allParents.filter((p) => !existingIds.has(p.id)).map((p) => ({ id: p.id, name_ar: p.name_ar, type: 'parent' })),
    ];

    const card = document.getElementById('missingFamAccCard');
    if (!missing.length) { card.style.display = 'none'; return; }
    card.style.display = 'block';

    document.getElementById('missingFamAccList').innerHTML = missing.map((r) => `
      <span class="checkbox-item">${escapeHtml(r.name_ar)} <span style="color:#aaa">(${r.type === 'student' ? 'طالب' : 'ولي أمر'})</span>
        <span data-create-missing="${escapeHtml(r.id)}" data-type="${r.type}" style="cursor:pointer;color:#2F7A4D;margin-right:4px">${ICONS.plus()}</span>
      </span>`).join('');

    document.querySelectorAll('[data-create-missing]').forEach((el) => {
      el.addEventListener('click', async () => {
        try {
          const result = await apiCall('family-accounts', { method: 'POST', body: { action: 'createMissing', id: el.getAttribute('data-create-missing'), type: el.getAttribute('data-type') } });
          showToast('تم إنشاء الحساب — كلمة المرور: ' + result.tempPassword, 'success');
          loadFamilyAccountsList(); loadMissingFamilyAccounts();
        } catch (e) { showToast(e.message, 'error'); }
      });
    });

    document.getElementById('createAllMissingFamAccBtn').onclick = () => runBulkCreation('family-accounts', loadMissingFamilyAccounts, loadFamilyAccountsList);
  } catch (e) { /* تجاهل بصمت */ }
}

async function loadFamilyAccountsList() {
  const area = document.getElementById('famAccListArea');
  try {
    APP.allFamilyAccounts = await apiCall('family-accounts', { method: 'POST', body: { action: 'list' } });
    renderFamilyAccountsTable();
  } catch (e) {
    area.innerHTML = `<p style="color:#c62828">${escapeHtml(e.message)}</p>`;
  }
}

function renderFamilyAccountsTable() {
  const area = document.getElementById('famAccListArea');
  const q = (document.getElementById('famAccSearchInput').value || '').trim().toLowerCase();
  const list = APP.allFamilyAccounts.filter((a) => !q || (a.nameAr || '').toLowerCase().includes(q) || a.username.toLowerCase().includes(q));

  if (!list.length) { area.innerHTML = '<p style="color:#888">لا توجد حسابات مطابقة</p>'; return; }

  area.innerHTML = `<div class="person-card-grid">${list.map((a) => {
    const isActive = a.status === 'نشط';
    const typeLabel = a.role === 'role_studen' ? 'طالب' : 'ولي أمر';
    return `
    <div class="person-card">
      <div class="person-card-header">
        <span class="person-avatar">${escapeHtml((a.nameAr || '؟').trim().charAt(0))}</span>
        <div class="person-card-info">
          <div class="person-card-name">${escapeHtml(a.nameAr || 'بلا اسم')}</div>
          <div class="person-card-role">${typeLabel} — ${escapeHtml(a.detail || '')}</div>
        </div>
        <span class="status-badge ${isActive ? 'status-badge-on' : 'status-badge-off'}">
          <span class="status-dot ${isActive ? 'status-dot-on' : 'status-dot-off'}"></span>${isActive ? 'مفعَّل' : 'معطَّل'}
        </span>
      </div>
      <div class="person-card-body">
        <div class="person-card-row"><span>اسم المستخدم</span><span>${escapeHtml(a.username)}</span></div>
      </div>
      <div class="person-card-footer">
        <div class="person-card-actions">
          <button type="button" class="btn-outline-sm ${isActive ? 'btn-danger-outline' : ''}" data-id="${escapeHtml(a.id)}" data-new-status="${isActive ? 'غير نشط' : 'نشط'}">
            ${isActive ? 'تعطيل' : 'تفعيل'}
          </button>
          <button type="button" class="btn-reset-fam-pass btn-outline-sm" data-id="${escapeHtml(a.id)}" data-name="${escapeHtml(a.nameAr || '')}">${ICONS.key()} إعادة تعيين</button>
        </div>
      </div>
    </div>`;
  }).join('')}</div>`;

  area.querySelectorAll('[data-new-status]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const newStatus = btn.getAttribute('data-new-status');
      if (!confirm(newStatus === 'نشط' ? 'تأكيد تفعيل هذا الحساب؟' : 'تأكيد تعطيل هذا الحساب؟')) return;
      try {
        await apiCall('family-accounts', { method: 'POST', body: { action: 'toggleStatus', id: btn.getAttribute('data-id'), newStatus } });
        showToast(newStatus === 'نشط' ? 'تم التفعيل' : 'تم التعطيل', 'success');
        loadFamilyAccountsList();
      } catch (e) {
        showToast(e.message, 'error');
      }
    });
  });

  area.querySelectorAll('.btn-reset-fam-pass').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const name = btn.getAttribute('data-name');
      if (!confirm(`إعادة تعيين كلمة مرور "${name}" لرقم هويته الأصلي؟`)) return;
      try {
        const result = await apiCall('family-accounts', { method: 'POST', body: { action: 'resetPassword', id: btn.getAttribute('data-id') } });
        showToast('تمت إعادة التعيين — كلمة المرور الجديدة: ' + result.tempPassword, 'success');
      } catch (e) {
        showToast(e.message, 'error');
      }
    });
  });
}

/* ===================== صفحة الإعدادات الموحَّدة (شريط جانبي داخلي + محتوى) ===================== */
// 🆕 كل الإعدادات بمكان واحد — معلومات عامة، 4 مجموعات قوائم، توزيع المواد، توزيع الدرجات.
// نفس فلسفة لوحة إعدادات Claude: قائمة تصنيفات يسار، محتوى القسم المُختار يمين.

const SETTINGS_LIST_KEYS = [
  { camel: 'branches', snake: 'branches', label: 'الفروع' },
  { camel: 'stages', snake: 'stages', label: 'المراحل الدراسية' },
  { camel: 'grades', snake: 'grades', label: 'الصفوف' },
  { camel: 'sections', snake: 'sections', label: 'الشعب' },
  { camel: 'subjects', snake: 'subjects', label: 'المواد الدراسية' },
  { camel: 'userTypes', snake: 'user_types', label: 'أنواع المستخدمين' },
  { camel: 'roles', snake: 'roles', label: 'الأدوار' },
  { camel: 'accountStatuses', snake: 'account_statuses', label: 'حالات الحساب' },
  { camel: 'attendanceStatuses', snake: 'attendance_statuses', label: 'حالات الحضور' },
  { camel: 'terms', snake: 'terms', label: 'الفصول الدراسية' },
  { camel: 'behaviorStatuses', snake: 'behavior_statuses', label: 'حالات السلوك' },
  { camel: 'continuousEvalTypes', snake: 'continuous_eval_types', label: 'أنواع التقييم المستمر' },
  { camel: 'exams', snake: 'exams', label: 'أنواع الاختبارات' },
];

const SETTINGS_SECTIONS = [
  { key: 'general', label: 'المعلومات العامة', icon: 'settingsGear' },
  { key: 'academic', label: 'الهيكل الأكاديمي', icon: 'students', lists: ['branches', 'stages', 'grades', 'sections', 'subjects'] },
  { key: 'accounts', label: 'الحسابات والأدوار', icon: 'lock', lists: ['userTypes', 'roles', 'accountStatuses'] },
  { key: 'attendance', label: 'الحضور والسلوك', icon: 'tasks', lists: ['attendanceStatuses', 'behaviorStatuses'] },
  { key: 'evaluation', label: 'التقييم والاختبارات', icon: 'tasks', lists: ['terms', 'continuousEvalTypes', 'exams'] },
  { key: 'subjectMatrix', label: 'توزيع المواد', icon: 'employees' },
  { key: 'gradeDistribution', label: 'توزيع الدرجات', icon: 'guardians' },
];

let siteSettingsListsState = {};
let siteSettingsActiveSection = 'general';
let gradeDistCurrentEntries = [];

async function renderSiteSettingsView() {
  const main = document.getElementById('mainContent');
  main.innerHTML = `<div class="card"><div class="skel-rows"><div class="skel-row"></div><div class="skel-row"></div></div></div>`;

  cachedSettings = null;
  const settings = await getSettingsOnce();
  siteSettingsListsState = {};
  SETTINGS_LIST_KEYS.forEach((k) => { siteSettingsListsState[k.camel] = [...(settings[k.camel] || [])]; });

  main.innerHTML = `
    <div class="settings-shell">
      <nav class="settings-nav">
        ${SETTINGS_SECTIONS.map((s) => `
          <button type="button" class="settings-nav-item ${s.key === siteSettingsActiveSection ? 'active' : ''}" data-section="${s.key}">
            ${ICONS[s.icon]()}<span>${escapeHtml(s.label)}</span>
          </button>`).join('')}
      </nav>
      <div class="settings-content" id="settingsContent"></div>
    </div>`;

  document.querySelectorAll('.settings-nav-item').forEach((btn) => {
    btn.addEventListener('click', () => { siteSettingsActiveSection = btn.getAttribute('data-section'); renderSettingsSection(); });
  });

  renderSettingsSection();
}

async function renderSettingsSection() {
  document.querySelectorAll('.settings-nav-item').forEach((b) => b.classList.toggle('active', b.getAttribute('data-section') === siteSettingsActiveSection));
  const content = document.getElementById('settingsContent');
  const section = SETTINGS_SECTIONS.find((s) => s.key === siteSettingsActiveSection);

  if (section.key === 'general') { renderSettingsGeneralSection(content); return; }
  if (section.key === 'subjectMatrix') { await renderSettingsSubjectMatrixSection(content); return; }
  if (section.key === 'gradeDistribution') { await renderSettingsGradeDistSection(content); return; }

  // 🆕 أقسام "قوائم قابلة للتعديل" (الهيكل الأكاديمي، الحسابات، الحضور، التقييم) — نفس النمط الموحَّد للأربعة
  content.innerHTML = `<h2 style="margin-top:0">${escapeHtml(section.label)}</h2>` + section.lists.map((camel) => {
    const k = SETTINGS_LIST_KEYS.find((x) => x.camel === camel);
    return `
      <div style="margin-bottom:24px">
        <div class="filter-card-title" style="margin-top:0">${escapeHtml(k.label)}</div>
        <div class="student-chip-list" id="ssList_${k.camel}" style="margin-bottom:10px"></div>
        <div class="student-search-input-wrap"><input type="text" id="ssAdd_${k.camel}" placeholder="أضف قيمة جديدة واضغط Enter"></div>
        <button type="button" data-save-list="${k.camel}" data-snake="${k.snake}" class="btn-outline-sm" style="margin-top:10px">حفظ ${escapeHtml(k.label)}</button>
      </div>`;
  }).join('');

  section.lists.forEach((camel) => {
    renderSettingsChipList(camel);
    document.getElementById(`ssAdd_${camel}`).addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const val = e.target.value.trim();
      if (!val) return;
      if (!siteSettingsListsState[camel].includes(val)) siteSettingsListsState[camel].push(val);
      e.target.value = '';
      renderSettingsChipList(camel);
    });
  });
  content.querySelectorAll('[data-save-list]').forEach((btn) => {
    btn.addEventListener('click', () => saveSettingsListHandler(btn.getAttribute('data-save-list'), btn.getAttribute('data-snake')));
  });
}

function renderSettingsGeneralSection(content) {
  content.innerHTML = `
    <h2 style="margin-top:0">اسم المدرسة والشعار</h2>
    <div class="field"><label>اسم المدرسة</label><input id="ss_schoolName" type="text" value="${escapeHtml(cachedSettings.schoolName || '')}"></div>
    <div class="field"><label>رابط الشعار</label><input id="ss_logoUrl" type="text" value="${escapeHtml(cachedSettings.logoUrl || '')}"></div>
    <button type="button" id="saveSiteInfoBtn">حفظ</button>`;
  document.getElementById('saveSiteInfoBtn').addEventListener('click', saveSiteInfoHandler);
}

function renderSettingsChipList(camelKey) {
  const box = document.getElementById(`ssList_${camelKey}`);
  const values = siteSettingsListsState[camelKey];
  box.innerHTML = values.length
    ? values.map((v, i) => `<span class="student-chip">${escapeHtml(v)}<span data-remove-val="${i}" data-key="${camelKey}" class="student-chip-remove">${ICONS.close()}</span></span>`).join('')
    : '<span class="student-linker-empty">لا توجد قيم بعد</span>';
  box.querySelectorAll('[data-remove-val]').forEach((el) => {
    el.addEventListener('click', () => {
      const key = el.getAttribute('data-key');
      siteSettingsListsState[key].splice(Number(el.getAttribute('data-remove-val')), 1);
      renderSettingsChipList(key);
    });
  });
}

async function saveSiteInfoHandler() {
  const btn = document.getElementById('saveSiteInfoBtn');
  btn.disabled = true; btn.textContent = 'جارِ الحفظ...';
  try {
    await apiCall('settings', { method: 'POST', body: { action: 'updateSite', schoolName: document.getElementById('ss_schoolName').value.trim(), logoUrl: document.getElementById('ss_logoUrl').value.trim() } });
    showToast('تم حفظ بيانات المدرسة بنجاح', 'success');
    cachedSettings = null;
  } catch (e) { showToast(e.message, 'error'); }
  finally { btn.disabled = false; btn.textContent = 'حفظ'; }
}

async function saveSettingsListHandler(camelKey, snakeKey) {
  const values = siteSettingsListsState[camelKey];
  if (!values.length) { showToast('يجب إدخال قيمة واحدة على الأقل', 'error'); return; }
  try {
    await apiCall('settings', { method: 'POST', body: { action: 'updateList', listKey: snakeKey, values } });
    showToast('تم الحفظ بنجاح', 'success');
    cachedSettings = null;
  } catch (e) { showToast(e.message, 'error'); }
}

/* -------------------- قسم: توزيع المواد -------------------- */
async function renderSettingsSubjectMatrixSection(content) {
  const settings = cachedSettings;
  content.innerHTML = `
    <h2 style="margin-top:0">إضافة توزيع مواد</h2>
    <p style="color:#888;font-size:12.5px;margin-top:-10px">اختر الفرع/المرحلة/الصف/الشعبة، ثم حدّد كل المواد التي تُدرَّس لها دفعة واحدة</p>
    <div class="field"><label>الفرع</label><select id="sm_branch">${settings.branches.map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('')}</select></div>
    <div class="field"><label>المرحلة</label><select id="sm_stage">${settings.stages.map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('')}</select></div>
    <div class="field"><label>الصف</label><select id="sm_grade">${settings.grades.map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('')}</select></div>
    <div class="field"><label>الشعبة</label><select id="sm_section">${settings.sections.map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('')}</select></div>
    <div class="filter-card-title">المواد (اختر كل ما ينطبق)</div>
    <div class="checkbox-list" id="sm_subjectsBox">${scopeCheckboxesHtml(settings.subjects, [], 'sm-subject-cb')}</div>
    <button type="button" id="addMatrixBtn" style="margin-top:14px">حفظ التوزيع</button>
    <hr style="margin:24px 0;border-color:var(--outline)">
    <h3>التوزيعات الحالية</h3>
    <div class="field"><label>بحث بالفرع أو الصف أو المادة</label><input id="matrixSearchInput" type="text"></div>
    <div id="matrixListArea"><div class="skel-rows"><div class="skel-row"></div></div></div>`;

  document.getElementById('addMatrixBtn').addEventListener('click', async () => {
    const subjects = collectCheckedValues('.sm-subject-cb');
    if (!subjects.length) { showToast('اختر مادة واحدة على الأقل', 'error'); return; }
    const btn = document.getElementById('addMatrixBtn');
    btn.disabled = true; btn.textContent = 'جارِ الحفظ...';
    try {
      const result = await apiCall('academic-config', {
        method: 'POST',
        body: {
          action: 'addMatrixEntries',
          branch: document.getElementById('sm_branch').value,
          stage: document.getElementById('sm_stage').value,
          grade: document.getElementById('sm_grade').value,
          section: document.getElementById('sm_section').value,
          subjects,
        },
      });
      showToast(`تمت إضافة ${result.added} مادة${result.skipped ? ` (تجاوزنا ${result.skipped} كانت مسجَّلة أصلاً)` : ''}`, 'success');
      document.querySelectorAll('.sm-subject-cb').forEach((cb) => { cb.checked = false; });
      loadMatrixList();
    } catch (e) { showToast(e.message, 'error'); }
    finally { btn.disabled = false; btn.textContent = 'حفظ التوزيع'; }
  });

  document.getElementById('matrixSearchInput').addEventListener('input', renderMatrixTable);
  loadMatrixList();
}

async function loadMatrixList() {
  const area = document.getElementById('matrixListArea');
  if (!area) return;
  try {
    APP.allMatrixEntries = await apiCall('academic-config', { method: 'POST', body: { action: 'listMatrix' } });
    renderMatrixTable();
  } catch (e) { area.innerHTML = `<p style="color:#c62828">${escapeHtml(e.message)}</p>`; }
}

function renderMatrixTable() {
  const area = document.getElementById('matrixListArea');
  if (!area) return;
  const q = (document.getElementById('matrixSearchInput').value || '').trim().toLowerCase();
  const groups = {};
  APP.allMatrixEntries.forEach((r) => {
    const key = `${r.branch}|${r.stage}|${r.grade}|${r.section}`;
    (groups[key] = groups[key] || { branch: r.branch, stage: r.stage, grade: r.grade, section: r.section, items: [] }).items.push(r);
  });
  const groupList = Object.values(groups).filter((g) =>
    !q || g.branch.toLowerCase().includes(q) || g.grade.toLowerCase().includes(q) || g.items.some((i) => i.subject.toLowerCase().includes(q))
  );

  if (!groupList.length) { area.innerHTML = '<p style="color:#888">لا توجد توزيعات مطابقة</p>'; return; }

  area.innerHTML = groupList.map((g) => `
    <div class="card" style="background:var(--surface);box-shadow:none;margin-bottom:10px">
      <div style="font-weight:800;font-size:13.5px;margin-bottom:8px">${escapeHtml(g.branch)} — ${escapeHtml(g.stage)} — ${escapeHtml(g.grade)} — ${escapeHtml(g.section)}</div>
      <div class="student-chip-list">
        ${g.items.map((i) => `<span class="student-chip">${escapeHtml(i.subject)}<span data-del-matrix="${i.id}" class="student-chip-remove">${ICONS.close()}</span></span>`).join('')}
      </div>
    </div>`).join('');

  area.querySelectorAll('[data-del-matrix]').forEach((el) => {
    el.addEventListener('click', async () => {
      try {
        await apiCall('academic-config', { method: 'POST', body: { action: 'deleteMatrixEntry', id: el.getAttribute('data-del-matrix') } });
        loadMatrixList();
      } catch (e) { showToast(e.message, 'error'); }
    });
  });
}

/* -------------------- قسم: توزيع الدرجات (بطاقة ذكية) -------------------- */
async function renderSettingsGradeDistSection(content) {
  const settings = cachedSettings;
  const evalTypes = [...(settings.continuousEvalTypes || []), ...(settings.exams || [])];
  APP.allGradeDist = await apiCall('academic-config', { method: 'POST', body: { action: 'listGradeDist' } });

  content.innerHTML = `
    <h2 style="margin-top:0">توزيع درجات مادة</h2>
    <p style="color:#888;font-size:12.5px;margin-top:-10px">اختر المادة، ثم أضف كل أنواع التقييم ودرجاتها — المجموع يُحسَب تلقائياً</p>
    <div class="field"><label>المادة</label>
      <select id="gd_subject"><option value="" disabled selected>-- اختر مادة --</option>${settings.subjects.map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('')}</select>
    </div>
    <div id="gradeDistCardBox" style="display:none">
      <h3 id="gd_cardTitle"></h3>
      <div id="gd_entriesArea"></div>
      <div style="display:flex;gap:8px;margin:14px 0;align-items:flex-end">
        <div class="field" style="flex:2;margin-bottom:0"><label>نوع التقييم</label><select id="gd_newEvalType">${evalTypes.map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('')}</select></div>
        <div class="field" style="flex:1;margin-bottom:0"><label>الدرجة</label><input type="number" id="gd_newScore" min="0" max="100" step="0.5" value="10"></div>
        <button type="button" id="gd_addEntryBtn" style="width:auto;flex-shrink:0">${ICONS.plus()}</button>
      </div>
      <div id="gd_totalBox" class="modal-detail-row" style="border-top:2px solid var(--outline);padding-top:12px"></div>
      <button type="button" id="gd_saveBtn" style="margin-top:14px;width:100%">حفظ توزيع هذي المادة</button>
    </div>`;

  document.getElementById('gd_subject').addEventListener('change', (e) => {
    const subject = e.target.value;
    gradeDistCurrentEntries = APP.allGradeDist.filter((r) => r.subject === subject).map((r) => ({ evalType: r.eval_type, maxScore: Number(r.max_grade) }));
    document.getElementById('gd_cardTitle').textContent = 'توزيع درجات: ' + subject;
    document.getElementById('gradeDistCardBox').style.display = 'block';
    renderGradeDistEntries();
  });

  document.getElementById('gd_addEntryBtn').addEventListener('click', () => {
    const evalType = document.getElementById('gd_newEvalType').value;
    const maxScore = Number(document.getElementById('gd_newScore').value);
    if (!evalType || maxScore <= 0) { showToast('أدخل نوع تقييم ودرجة صحيحة', 'error'); return; }
    gradeDistCurrentEntries.push({ evalType, maxScore });
    renderGradeDistEntries();
  });

  document.getElementById('gd_saveBtn').addEventListener('click', async () => {
    if (!gradeDistCurrentEntries.length) { showToast('أضف تقييماً واحداً على الأقل', 'error'); return; }
    const total = gradeDistCurrentEntries.reduce((s, e) => s + e.maxScore, 0);
    if (total > 100) { showToast(`مجموع الدرجات (${total}) يتجاوز 100 — صحّح قبل الحفظ`, 'error'); return; }
    const btn = document.getElementById('gd_saveBtn');
    btn.disabled = true; btn.textContent = 'جارِ الحفظ...';
    try {
      await apiCall('academic-config', { method: 'POST', body: { action: 'saveGradeDistForSubject', subject: document.getElementById('gd_subject').value, entries: gradeDistCurrentEntries } });
      showToast('تم حفظ التوزيع بنجاح', 'success');
      APP.allGradeDist = await apiCall('academic-config', { method: 'POST', body: { action: 'listGradeDist' } });
    } catch (e) { showToast(e.message, 'error'); }
    finally { btn.disabled = false; btn.textContent = 'حفظ توزيع هذي المادة'; }
  });
}

function renderGradeDistEntries() {
  const area = document.getElementById('gd_entriesArea');
  area.innerHTML = gradeDistCurrentEntries.length
    ? gradeDistCurrentEntries.map((e, i) => `
      <div class="modal-detail-row">
        <span class="modal-detail-label">${escapeHtml(e.evalType)}</span>
        <span class="modal-detail-value" style="display:flex;align-items:center;gap:8px">${e.maxScore}<span data-remove-entry="${i}" style="cursor:pointer;color:#c62828">${ICONS.close()}</span></span>
      </div>`).join('')
    : '<p style="color:#aaa;font-size:12.5px">لا توجد تقييمات مضافة بعد</p>';

  area.querySelectorAll('[data-remove-entry]').forEach((el) => {
    el.addEventListener('click', () => { gradeDistCurrentEntries.splice(Number(el.getAttribute('data-remove-entry')), 1); renderGradeDistEntries(); });
  });

  const total = gradeDistCurrentEntries.reduce((s, e) => s + e.maxScore, 0);
  const over = total > 100;
  document.getElementById('gd_totalBox').innerHTML = `
    <span class="modal-detail-label">المجموع</span>
    <span class="modal-detail-value" style="color:${over ? '#C4483A' : '#2F7A4D'};font-size:15px">${total} / 100 ${over ? '⚠️ تجاوز الحد!' : ''}</span>`;
}

/* ===================== صفحة سجل التتبّع ===================== */

async function renderAuditLogView() {
  const main = document.getElementById('mainContent');
  main.innerHTML = `
    <div class="card">
      <h2>سجل التتبّع (آخر 300 عملية)</h2>
      <div class="field"><label>بحث بالاسم أو نوع العملية</label><input id="auditSearchInput" type="text"></div>
      <div id="auditLogListArea"><div class="skel-rows"><div class="skel-row"></div><div class="skel-row"></div></div></div>
    </div>`;

  document.getElementById('auditSearchInput').addEventListener('input', renderAuditLogTable);
  loadAuditLogList();
}

async function loadAuditLogList() {
  const area = document.getElementById('auditLogListArea');
  try {
    APP.allAuditLog = await apiCall('audit-log', { method: 'POST', body: { action: 'list' } });
    renderAuditLogTable();
  } catch (e) { area.innerHTML = `<p style="color:#c62828">${escapeHtml(e.message)}</p>`; }
}

function renderAuditLogTable() {
  const area = document.getElementById('auditLogListArea');
  const q = (document.getElementById('auditSearchInput').value || '').trim().toLowerCase();
  const list = APP.allAuditLog.filter((r) => !q || (r.emp_name || '').toLowerCase().includes(q) || (r.action || '').toLowerCase().includes(q));

  if (!list.length) { area.innerHTML = '<p style="color:#888">لا توجد عمليات مطابقة</p>'; return; }

  area.innerHTML = list.map((r) => `
    <div class="person-card-row" style="padding:10px 0;border-bottom:1px solid var(--surface);align-items:flex-start">
      <div>
        <div style="font-weight:700;font-size:13px">${escapeHtml(r.action)}</div>
        <div style="font-size:11.5px;color:var(--text-muted)">${escapeHtml(r.emp_name)} — ${escapeHtml(r.role)} — ${escapeHtml(r.branch)}</div>
      </div>
      <span style="font-size:11px;color:var(--text-muted);white-space:nowrap">${new Date(r.created_at).toLocaleString('ar')}</span>
    </div>`).join('');
}

/* ===================== صفحة تحضير الطلاب ===================== */

function todayISO() { return new Date().toISOString().slice(0, 10); }

async function renderStudentAttendanceView() {
  const main = document.getElementById('mainContent');
  main.innerHTML = `<div class="card"><div class="skel-rows"><div class="skel-row"></div></div></div>`;
  const settings = await getSettingsOnce();
  const role = APP.user.role;

  const branchLocked = role !== 'role_admin';
  const branchOptions = role === 'role_admin' ? settings.branches : [APP.user.branch];
  const gradeOptions = role === 'role_teacher' ? (APP.user.grades || []) : settings.grades;
  const sectionOptions = role === 'role_teacher' ? (APP.user.sections || []) : settings.sections;

  if (role === 'role_teacher' && (!gradeOptions.length || !sectionOptions.length)) {
    main.innerHTML = `<div class="card"><p style="color:#888">لم تُسنَد لك صفوف/شعب بعد — راجع الإدارة.</p></div>`;
    return;
  }

  main.innerHTML = `
    <div class="card">
      <h2>تحضير الطلاب</h2>
      <div class="field"><label>التاريخ</label><input type="date" id="att_date" value="${todayISO()}"></div>
      <div class="field"><label>الفرع</label><select id="att_branch" ${branchLocked ? 'disabled' : ''}>${branchOptions.map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('')}</select></div>
      <div class="field"><label>الصف</label><select id="att_grade">${gradeOptions.map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('')}</select></div>
      <div class="field"><label>الشعبة</label><select id="att_section">${sectionOptions.map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('')}</select></div>
      <button type="button" id="att_loadBtn">تحميل قائمة الطلاب</button>
    </div>
    <div class="card" id="att_rosterCard" style="display:none">
      <h3>قائمة الطلاب</h3>
      <div id="att_rosterArea"></div>
      <button type="button" id="att_saveBtn" style="margin-top:14px">حفظ الحضور</button>
    </div>`;

  document.getElementById('att_loadBtn').addEventListener('click', () => loadAttendanceRoster('student'));
}

/* ===================== صفحة تحضير الموظفين ===================== */

async function renderStaffAttendanceView() {
  const main = document.getElementById('mainContent');
  main.innerHTML = `<div class="card"><div class="skel-rows"><div class="skel-row"></div></div></div>`;
  const settings = await getSettingsOnce();
  const role = APP.user.role;

  let branchOptions, branchLocked, targetRoleOptions, targetRoleLocked;
  if (role === 'role_admin') {
    branchOptions = settings.branches; branchLocked = false;
    targetRoleOptions = [{ v: 'role_teacher', l: 'معلمون' }, { v: 'role_teacher_sup', l: 'مشرفو معلمين' }, { v: 'role_student_sup', l: 'مشرفو طلاب' }];
    targetRoleLocked = false;
  } else if (role === 'role_teacher_sup') {
    branchOptions = [APP.user.branch]; branchLocked = true;
    targetRoleOptions = [{ v: 'role_teacher', l: 'معلمون' }]; targetRoleLocked = true;
  } else { // role_branch_monitor
    branchOptions = APP.user.allBranches || [APP.user.branch]; branchLocked = branchOptions.length <= 1;
    targetRoleOptions = [{ v: 'role_teacher_sup', l: 'مشرفو معلمين' }, { v: 'role_student_sup', l: 'مشرفو طلاب' }];
    targetRoleLocked = false;
  }

  main.innerHTML = `
    <div class="card">
      <h2>تحضير الموظفين</h2>
      <div class="field"><label>التاريخ</label><input type="date" id="att_date" value="${todayISO()}"></div>
      <div class="field"><label>الفرع</label><select id="att_branch" ${branchLocked ? 'disabled' : ''}>${branchOptions.map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('')}</select></div>
      <div class="field"><label>الفئة</label><select id="att_targetRole" ${targetRoleLocked ? 'disabled' : ''}>${targetRoleOptions.map((o) => `<option value="${o.v}">${escapeHtml(o.l)}</option>`).join('')}</select></div>
      <button type="button" id="att_loadBtn">تحميل القائمة</button>
    </div>
    <div class="card" id="att_rosterCard" style="display:none">
      <h3>القائمة</h3>
      <div id="att_rosterArea"></div>
      <button type="button" id="att_saveBtn" style="margin-top:14px">حفظ الحضور</button>
    </div>`;

  document.getElementById('att_loadBtn').addEventListener('click', () => loadAttendanceRoster('employee'));
}

/* ===================== منطق مشترك بين الصفحتين ===================== */

async function loadAttendanceRoster(personType) {
  const date = document.getElementById('att_date').value;
  const branch = document.getElementById('att_branch').value;
  const settings = await getSettingsOnce();
  const statuses = settings.attendanceStatuses;

  let roster, existing;
  try {
    if (personType === 'student') {
      const grade = document.getElementById('att_grade').value;
      const section = document.getElementById('att_section').value;
      roster = await apiCall('attendance', { method: 'POST', body: { action: 'listStudentRoster', branch, grade, section } });
      existing = await apiCall('attendance', { method: 'POST', body: { action: 'listForDate', date, personType, branch, grade, section } });
    } else {
      const targetRole = document.getElementById('att_targetRole').value;
      roster = await apiCall('attendance', { method: 'POST', body: { action: 'listStaffRoster', branch, targetRole } });
      existing = await apiCall('attendance', { method: 'POST', body: { action: 'listForDate', date, personType, branch, targetRole } });
    }
  } catch (e) { showToast(e.message, 'error'); return; }

  const existingMap = {};
  existing.forEach((r) => { existingMap[r.person_id] = r; });

  if (!roster.length) { showToast('لا يوجد أشخاص مطابقون لهذا الاختيار', 'error'); return; }

  document.getElementById('att_rosterCard').style.display = 'block';
  document.getElementById('att_rosterArea').innerHTML = `
    <div class="att-quick-mark">
      <span>تعليم الكل:</span>
      ${statuses.map((st) => `<button type="button" class="att-quick-btn" data-quick-mark="${escapeHtml(st)}">${escapeHtml(st)}</button>`).join('')}
    </div>
    ${roster.map((p) => {
      const rec = existingMap[p.id];
      return `
      <div class="person-card-row att-roster-row" data-person-id="${escapeHtml(p.id)}" data-record-id="${rec ? rec.id : ''}" data-status="${rec ? escapeHtml(rec.status) : ''}">
        <span class="att-person-name">${escapeHtml(p.name_ar)}</span>
        <div class="att-status-buttons">
          ${statuses.map((st) => `<button type="button" class="att-status-btn ${rec && rec.status === st ? 'active' : ''}" data-status-value="${escapeHtml(st)}">${escapeHtml(st)}</button>`).join('')}
        </div>
      </div>`;
    }).join('')}`;

  document.querySelectorAll('.att-status-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const row = btn.closest('.att-roster-row');
      row.setAttribute('data-status', btn.getAttribute('data-status-value'));
      row.querySelectorAll('.att-status-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  document.querySelectorAll('[data-quick-mark]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const status = btn.getAttribute('data-quick-mark');
      document.querySelectorAll('.att-roster-row').forEach((row) => {
        row.setAttribute('data-status', status);
        row.querySelectorAll('.att-status-btn').forEach((b) => b.classList.toggle('active', b.getAttribute('data-status-value') === status));
      });
    });
  });

  document.getElementById('att_saveBtn').onclick = () => saveAttendanceRoster(personType);
}

async function saveAttendanceRoster(personType) {
  const date = document.getElementById('att_date').value;
  const branch = document.getElementById('att_branch').value;
  const btn = document.getElementById('att_saveBtn');
  btn.disabled = true; btn.textContent = 'جارِ الحفظ...';

  const rows = document.querySelectorAll('#att_rosterArea [data-person-id]');
  const missingStatus = Array.from(rows).find((r) => !r.getAttribute('data-status'));
  if (missingStatus) { showToast('حدّد حالة كل شخص قبل الحفظ', 'error'); btn.disabled = false; btn.textContent = 'حفظ الحضور'; return; }
  const entries = Array.from(rows).map((row) => ({
    personId: row.getAttribute('data-person-id'),
    status: row.getAttribute('data-status'),
  }));

  const body = { date, personType, branch, entries };
  if (personType === 'student') {
    body.grade = document.getElementById('att_grade').value;
    body.section = document.getElementById('att_section').value;
  } else {
    body.targetRole = document.getElementById('att_targetRole').value;
  }

  try {
    await apiCall('attendance', { method: 'POST', body: { action: 'save', ...body } });
    showToast('تم حفظ الحضور بنجاح', 'success');
  } catch (e) { showToast(e.message, 'error'); }
  finally { btn.disabled = false; btn.textContent = 'حفظ الحضور'; }
}

/* ===================== صفحة سلوك الطلاب ===================== */

let behaviorSelectedStudentId = null;

async function renderStudentBehaviorView() {
  const main = document.getElementById('mainContent');
  main.innerHTML = `<div class="card"><div class="skel-rows"><div class="skel-row"></div></div></div>`;
  behaviorSelectedStudentId = null;

  if (!APP.allStudents || !APP.allStudents.length) {
    APP.allStudents = await apiCall('students', { method: 'POST', body: { action: 'list' } });
  }

  main.innerHTML = `
    <div class="card">
      <h2 style="margin-bottom:4px">سلوك الطلاب</h2>
      <p style="color:#888;font-size:12.5px;margin-top:0">ابحث عن طالب لعرض سجل سلوكه الكامل وتسجيل موقف جديد</p>
      <div class="student-search-input-wrap">
        ${ICONS.search()}
        <input type="text" id="behaviorStudentSearch" placeholder="اكتب اسم الطالب...">
      </div>
      <div id="behaviorStudentResults" class="student-search-results"></div>
    </div>
    <div id="behaviorDetailCard"></div>`;

  document.getElementById('behaviorStudentSearch').addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    const box = document.getElementById('behaviorStudentResults');
    if (!q) { box.classList.remove('show'); box.innerHTML = ''; return; }
    const matches = APP.allStudents.filter((s) => s.name_ar.toLowerCase().includes(q)).slice(0, 8);
    box.classList.add('show');
    box.innerHTML = matches.map((s) => `
      <div class="student-search-result-item" data-select-student="${escapeHtml(s.id)}">
        <span class="person-avatar" style="width:32px;height:32px;font-size:13px">${escapeHtml((s.name_ar || '؟').trim().charAt(0))}</span>
        <div><div class="search-result-label">${escapeHtml(s.name_ar)}</div><div class="search-result-sublabel">${escapeHtml(s.grade)} — ${escapeHtml(s.section)} — ${escapeHtml(s.branch)}</div></div>
      </div>`).join('') || '<p style="padding:12px;color:#aaa;font-size:12.5px;text-align:center">لا نتائج</p>';

    box.querySelectorAll('[data-select-student]').forEach((el) => {
      el.addEventListener('click', () => {
        behaviorSelectedStudentId = el.getAttribute('data-select-student');
        document.getElementById('behaviorStudentSearch').value = '';
        box.innerHTML = ''; box.classList.remove('show');
        loadBehaviorForStudent();
      });
    });
  });
}

async function loadBehaviorForStudent() {
  const student = APP.allStudents.find((s) => s.id === behaviorSelectedStudentId);
  const card = document.getElementById('behaviorDetailCard');
  card.innerHTML = `<div class="card"><div class="skel-rows"><div class="skel-row"></div></div></div>`;

  let result;
  try {
    result = await apiCall('behavior', { method: 'POST', body: { action: 'listForStudent', studentId: behaviorSelectedStudentId } });
  } catch (e) { card.innerHTML = `<div class="card"><p style="color:#c62828">${escapeHtml(e.message)}</p></div>`; return; }

  const score = result.score;
  const scoreColor = score >= 90 ? '#2F7A4D' : score >= 60 ? '#B8860B' : '#C4483A';
  const positiveCount = result.records.filter((r) => r.type === 'positive').length;
  const negativeCount = result.records.filter((r) => r.type === 'negative').length;

  card.innerHTML = `
    <div class="card">
      <div class="behavior-score-header">
        <div class="behavior-student-info">
          <span class="person-avatar" style="width:48px;height:48px;font-size:18px">${escapeHtml((student.name_ar || '؟').trim().charAt(0))}</span>
          <div>
            <h2 style="margin:0">${escapeHtml(student.name_ar)}</h2>
            <p style="color:#888;margin:2px 0 0;font-size:12.5px">${escapeHtml(student.grade)} — ${escapeHtml(student.section)} — ${escapeHtml(student.branch)}</p>
          </div>
        </div>
        <div class="behavior-score-circle" style="border-color:${scoreColor}">
          <span style="color:${scoreColor}">${score}</span>
          <span class="behavior-score-sublabel">من 100</span>
        </div>
      </div>
      <div class="behavior-stats-row">
        <div class="behavior-stat-chip behavior-stat-positive">${ICONS.plus()} ${positiveCount} موقف إيجابي</div>
        <div class="behavior-stat-chip behavior-stat-negative">${ICONS.close()} ${negativeCount} موقف سلبي</div>
        ${score >= 100 ? `<div class="behavior-stat-chip" style="background:#FFF3DE;color:#8a6d1f">🏆 مؤهَّل لشهادة سلوك</div>` : ''}
      </div>
    </div>

    <div class="card">
      <h3 style="margin-bottom:14px">تسجيل موقف سلوكي جديد</h3>
      <div class="behavior-type-toggle">
        <button type="button" class="behavior-type-btn active" data-behavior-type="positive">${ICONS.plus()} إيجابي</button>
        <button type="button" class="behavior-type-btn" data-behavior-type="negative">${ICONS.close()} سلبي</button>
      </div>
      <input type="hidden" id="beh_type" value="positive">
      <div class="field"><label>عدد النقاط</label><input type="number" id="beh_points" min="1" max="100" step="1" value="5"></div>
      <div class="field"><label>الوصف</label><input type="text" id="beh_description" placeholder="مثال: مساعدة زميل، تكرار عدم إحضار الواجب..."></div>
      <button type="button" id="beh_addBtn">تسجيل</button>
    </div>

    <div class="card">
      <h3>السجل الكامل</h3>
      <div id="behaviorHistoryArea"></div>
    </div>`;

  document.querySelectorAll('.behavior-type-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.behavior-type-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('beh_type').value = btn.getAttribute('data-behavior-type');
    });
  });

  renderBehaviorHistory(result.records);

  document.getElementById('beh_addBtn').addEventListener('click', async () => {
    const btn = document.getElementById('beh_addBtn');
    const description = document.getElementById('beh_description').value.trim();
    if (!description) { showToast('الوصف مطلوب', 'error'); return; }
    btn.disabled = true; btn.textContent = 'جارِ الحفظ...';
    try {
      await apiCall('behavior', {
        method: 'POST',
        body: {
          action: 'add', studentId: behaviorSelectedStudentId, branch: student.branch,
          type: document.getElementById('beh_type').value,
          points: Math.max(1, Number(document.getElementById('beh_points').value) || 1), // 🆕 حماية إضافية — يمنع إرسال قيمة فارغة أو صفر أو غير صالحة مهما حصل بالواجهة
          description,
        },
      });
      showToast('تم التسجيل بنجاح', 'success');
      loadBehaviorForStudent();
    } catch (e) { showToast(e.message, 'error'); }
    finally { btn.disabled = false; btn.textContent = 'تسجيل'; }
  });
}

function renderBehaviorHistory(records) {
  const area = document.getElementById('behaviorHistoryArea');
  if (!records.length) { area.innerHTML = '<p style="color:#888">لا يوجد سجل بعد</p>'; return; }

  area.innerHTML = records.map((r) => `
    <div class="behavior-history-row ${r.type === 'positive' ? 'behavior-history-positive' : 'behavior-history-negative'}">
      <div class="behavior-history-badge">${r.type === 'positive' ? '+' : '−'}${r.points}</div>
      <div class="behavior-history-body">
        <div class="behavior-history-desc">${escapeHtml(r.description)}</div>
        <div class="behavior-history-date">${new Date(r.recorded_at).toLocaleString('ar')}</div>
      </div>
      ${APP.user.role === 'role_admin' ? `<span data-del-behavior="${r.id}" class="behavior-history-delete">${ICONS.trash()}</span>` : ''}
    </div>`).join('');

  area.querySelectorAll('[data-del-behavior]').forEach((el) => {
    el.addEventListener('click', async () => {
      if (!confirm('تأكيد حذف هذا السجل؟')) return;
      try {
        await apiCall('behavior', { method: 'POST', body: { action: 'delete', id: el.getAttribute('data-del-behavior') } });
        loadBehaviorForStudent();
      } catch (e) { showToast(e.message, 'error'); }
    });
  });
}

/* ===================== صفحة تقييم الأداء ===================== */

const EVALUATOR_ROLES = ['role_admin', 'role_teacher_sup', 'role_branch_monitor'];
let perfActiveTab = 'my';
let perfSelectedEmployeeId = null;
let perfSelectedCycleId = null;

async function renderPerformanceView() {
  const main = document.getElementById('mainContent');
  main.innerHTML = `<div class="card"><div class="skel-rows"><div class="skel-row"></div></div></div>`;

  const isEvaluator = EVALUATOR_ROLES.includes(APP.user.role);
  const isAdmin = APP.user.role === 'role_admin';
  perfActiveTab = 'my';

  const tabs = [
    { key: 'my', label: 'أدائي' },
    ...(isEvaluator ? [{ key: 'evaluate', label: 'تقييم موظف' }, { key: 'dashboard', label: 'لوحة الإحصاءات' }] : []),
    ...(isAdmin ? [{ key: 'criteria', label: 'معايير التقييم' }, { key: 'cycles', label: 'دورات التقييم' }] : []),
  ];

  main.innerHTML = `
    <div class="card">
      <div class="segmented-control" id="perfTabBar" style="flex-wrap:wrap">
        ${tabs.map((t) => `<button type="button" class="segmented-item ${t.key === perfActiveTab ? 'active' : ''}" data-perf-tab="${t.key}">${escapeHtml(t.label)}</button>`).join('')}
      </div>
    </div>
    <div id="perfContent"></div>`;

  document.querySelectorAll('[data-perf-tab]').forEach((btn) => {
    btn.addEventListener('click', () => { perfActiveTab = btn.getAttribute('data-perf-tab'); renderPerfTabContent(); });
  });

  renderPerfTabContent();
}

async function renderPerfTabContent() {
  document.querySelectorAll('[data-perf-tab]').forEach((b) => b.classList.toggle('active', b.getAttribute('data-perf-tab') === perfActiveTab));
  const content = document.getElementById('perfContent');
  content.innerHTML = `<div class="card"><div class="skel-rows"><div class="skel-row"></div></div></div>`;

  if (perfActiveTab === 'my') return renderPerfMySection(content);
  if (perfActiveTab === 'evaluate') return renderPerfEvaluateSection(content);
  if (perfActiveTab === 'dashboard') return renderPerfDashboardSection(content);
  if (perfActiveTab === 'criteria') return renderPerfCriteriaSection(content);
  if (perfActiveTab === 'cycles') return renderPerfCyclesSection(content);
}

/* -------------------- أدائي -------------------- */
async function renderPerfMySection(content) {
  const evals = await apiCall('performance', { method: 'POST', body: { action: 'myEvaluations' } });
  if (!evals.length) { content.innerHTML = '<div class="card"><p style="color:#888">لا توجد تقييمات مسجَّلة لك بعد</p></div>'; return; }

  content.innerHTML = `
    <div class="card">
      <h2>سجل أدائي</h2>
      ${evals.map((e) => {
        const color = e.final_score >= 85 ? '#2F7A4D' : e.final_score >= 65 ? '#B8860B' : '#C4483A';
        return `
        <div style="border:1px solid var(--outline);border-radius:var(--radius-sm);padding:14px;margin-bottom:12px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div>
              <div style="font-weight:800">${escapeHtml(e.evaluation_cycles?.name || '—')}</div>
              <div style="font-size:11.5px;color:var(--text-muted)">${escapeHtml(e.evaluation_cycles?.start_date || '')} — ${escapeHtml(e.evaluation_cycles?.end_date || '')}</div>
            </div>
            <div style="font-size:26px;font-weight:800;color:${color}">${e.final_score}<span style="font-size:13px">/100</span></div>
          </div>
          ${e.strengths ? `<div style="margin-top:10px;font-size:13px"><b>نقاط القوة:</b> ${escapeHtml(e.strengths)}</div>` : ''}
          ${e.improvements ? `<div style="margin-top:4px;font-size:13px"><b>نقاط التحسين:</b> ${escapeHtml(e.improvements)}</div>` : ''}
          ${e.manager_notes ? `<div style="margin-top:4px;font-size:13px"><b>ملاحظات المدير:</b> ${escapeHtml(e.manager_notes)}</div>` : ''}
        </div>`;
      }).join('')}
    </div>`;
}

/* -------------------- تقييم موظف -------------------- */
async function renderPerfEvaluateSection(content) {
  const cycles = await apiCall('performance', { method: 'POST', body: { action: 'listCycles' } });
  const activeCycles = cycles.filter((c) => c.status === 'active');

  if (!activeCycles.length) { content.innerHTML = '<div class="card"><p style="color:#888">لا توجد دورة تقييم نشطة حالياً — يجب على الأدمن إنشاء واحدة أولاً.</p></div>'; return; }

  content.innerHTML = `
    <div class="card">
      <h2>تقييم موظف</h2>
      <div class="field"><label>دورة التقييم</label>
        <select id="perf_cycle">${activeCycles.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}</select>
      </div>
    </div>
    <div id="perfRosterArea"></div>
    <div id="perfEvalFormBox"></div>`;

  document.getElementById('perf_cycle').addEventListener('change', loadPerfRoster);
  loadPerfRoster();
}

async function loadPerfRoster() {
  perfSelectedCycleId = document.getElementById('perf_cycle').value;
  const area = document.getElementById('perfRosterArea');
  area.innerHTML = `<div class="card"><div class="skel-rows"><div class="skel-row"></div></div></div>`;
  document.getElementById('perfEvalFormBox').innerHTML = '';

  const roster = await apiCall('performance', { method: 'POST', body: { action: 'listEvaluationsForCycle', cycleId: perfSelectedCycleId } });
  if (!roster.length) { area.innerHTML = '<div class="card"><p style="color:#888">لا يوجد موظفون ضمن نطاقك للتقييم</p></div>'; return; }

  area.innerHTML = `<div class="card"><h3>الموظفون (${roster.filter((r) => r.evaluated).length}/${roster.length} تم تقييمهم)</h3>
    <div class="person-card-grid">
      ${roster.map((r) => `
        <div class="person-card" data-eval-employee="${escapeHtml(r.id)}" data-eval-branch="${escapeHtml(r.branch)}" data-card-clickable>
          <div class="person-card-header">
            <span class="person-avatar">${escapeHtml((r.name_ar || '؟').trim().charAt(0))}</span>
            <div class="person-card-info">
              <div class="person-card-name">${escapeHtml(r.name_ar)}</div>
              <div class="person-card-role">${escapeHtml(ROLE_LABELS_AR[r.role] || r.role)}</div>
            </div>
            <span class="status-badge ${r.evaluated ? 'status-badge-on' : 'status-badge-off'}">${r.evaluated ? r.score + '/100' : 'لم يُقيَّم بعد'}</span>
          </div>
          <div class="person-card-footer">
            <div class="person-card-actions">
              <button type="button" class="btn-outline-sm" data-message-employee="${escapeHtml(r.id)}" data-message-name="${escapeHtml(r.name_ar)}" style="width:100%;justify-content:center">${ICONS.messages()} مراسلة</button>
            </div>
          </div>
        </div>`).join('')}
    </div>
  </div>`;

  area.querySelectorAll('[data-message-employee]').forEach((btn) => {
    btn.addEventListener('click', (evt) => {
      evt.stopPropagation();
      openComposeMessageModal({
        recipients: [{ id: btn.getAttribute('data-message-employee'), type: 'employee' }],
        subject: 'بخصوص تقييم الأداء',
        contextType: 'performance',
      });
    });
  });

  area.querySelectorAll('[data-eval-employee]').forEach((card) => {
    card.addEventListener('click', async () => {
      perfSelectedEmployeeId = card.getAttribute('data-eval-employee');
      await loadEvaluationForm(card.getAttribute('data-eval-branch'));
      document.getElementById('perfEvalFormBox').scrollIntoView({ behavior: 'smooth' });
    });
  });
}

async function loadEvaluationForm(branch) {
  const box = document.getElementById('perfEvalFormBox');
  box.innerHTML = `<div class="card"><div class="skel-rows"><div class="skel-row"></div></div></div>`;

  const [criteria, existing] = await Promise.all([
    apiCall('performance', { method: 'POST', body: { action: 'listCriteria' } }),
    apiCall('performance', { method: 'POST', body: { action: 'getEvaluation', employeeId: perfSelectedEmployeeId, cycleId: perfSelectedCycleId } }),
  ]);
  const existingScoresMap = {};
  (existing.scores || []).forEach((s) => { existingScoresMap[s.criterion_id] = s.score; });

  box.innerHTML = `
    <div class="card">
      <h3 style="margin-bottom:4px">نموذج التقييم</h3>
      <p style="color:#888;font-size:12px;margin-top:0">حرّك كل معيار وفق الأداء الفعلي — النتيجة النهائية تُحسَب تلقائياً بالأسفل</p>
      ${criteria.map((c) => {
        const val = existingScoresMap[c.id] ?? 70;
        return `
        <div class="perf-criterion-card">
          <div class="perf-criterion-head">
            <span class="perf-criterion-name">${escapeHtml(c.name)}</span>
            <span class="status-badge status-badge-off">وزن ${c.weight}%</span>
          </div>
          <div class="perf-criterion-slider-row">
            <input type="range" class="perf-score-input" data-criterion-id="${c.id}" data-weight="${c.weight}" min="0" max="100" value="${val}">
            <span class="perf-score-value" id="perfScoreLabel_${c.id}">${val}</span>
          </div>
        </div>`;
      }).join('')}

      <div class="filter-card-title" style="margin-top:22px">ملاحظات التقييم</div>
      <div class="field"><label>نقاط القوة</label><textarea id="perf_strengths" rows="2">${escapeHtml(existing.evaluation?.strengths || '')}</textarea></div>
      <div class="field"><label>نقاط تحتاج تحسيناً</label><textarea id="perf_improvements" rows="2">${escapeHtml(existing.evaluation?.improvements || '')}</textarea></div>
      <div class="field"><label>ملاحظات المدير</label><textarea id="perf_notes" rows="2">${escapeHtml(existing.evaluation?.manager_notes || '')}</textarea></div>

      <div class="perf-final-score-box" id="perf_liveTotal"></div>
      <button type="button" id="perf_saveBtn" style="margin-top:14px;width:100%">${existing.evaluation ? 'تحديث التقييم' : 'حفظ التقييم'}</button>
      ${existing.evaluation && APP.user.role === 'role_admin' ? `<button type="button" id="perf_deleteBtn" class="btn-danger-outline" style="margin-top:8px;width:100%">حذف هذا التقييم نهائياً</button>` : ''}
    </div>`;

  function recalcLiveTotal() {
    let weightedSum = 0, totalWeight = 0;
    document.querySelectorAll('.perf-score-input').forEach((inp) => {
      const w = Number(inp.getAttribute('data-weight'));
      weightedSum += Number(inp.value) * w; totalWeight += w;
      document.getElementById(`perfScoreLabel_${inp.getAttribute('data-criterion-id')}`).textContent = inp.value;
    });
    const final = totalWeight ? Math.round((weightedSum / totalWeight) * 100) / 100 : 0;
    const color = final >= 85 ? '#2F7A4D' : final >= 65 ? '#B8860B' : '#C4483A';
    document.getElementById('perf_liveTotal').innerHTML = `<span>النتيجة النهائية المتوقَّعة</span><span style="color:${color};font-size:22px;font-weight:800">${final} / 100</span>`;
  }
  document.querySelectorAll('.perf-score-input').forEach((inp) => inp.addEventListener('input', recalcLiveTotal));
  recalcLiveTotal();

  document.getElementById('perf_saveBtn').addEventListener('click', async () => {
    const btn = document.getElementById('perf_saveBtn');
    btn.disabled = true; btn.textContent = 'جارِ الحفظ...';
    const scores = Array.from(document.querySelectorAll('.perf-score-input')).map((inp) => ({ criterionId: Number(inp.getAttribute('data-criterion-id')), score: Number(inp.value) }));
    try {
      const result = await apiCall('performance', {
        method: 'POST',
        body: {
          action: 'saveEvaluation', employeeId: perfSelectedEmployeeId, cycleId: perfSelectedCycleId, branch, scores,
          strengths: document.getElementById('perf_strengths').value.trim(),
          improvements: document.getElementById('perf_improvements').value.trim(),
          managerNotes: document.getElementById('perf_notes').value.trim(),
        },
      });
      showToast(`تم الحفظ — النتيجة النهائية: ${result.finalScore}/100`, 'success');
      await loadPerfRoster(); // 🆕 يُحدِّث قائمة الموظفين فوراً (تظهر النتيجة الجديدة)، ويُخفي النموذج تلقائياً
    } catch (e) { showToast(e.message, 'error'); }
    finally { btn.disabled = false; btn.textContent = 'حفظ التقييم'; }
  });

  document.getElementById('perf_deleteBtn')?.addEventListener('click', async () => {
    if (!confirm('تأكيد حذف هذا التقييم نهائياً؟ لا يمكن التراجع.')) return;
    try {
      await apiCall('performance', { method: 'POST', body: { action: 'deleteEvaluation', id: existing.evaluation.id } });
      showToast('تم الحذف بنجاح', 'success');
      await loadPerfRoster(); // 🆕 يُحدِّث القائمة ويُخفي النموذج بدل تركه ظاهراً
    } catch (e) { showToast(e.message, 'error'); }
  });
}

/* -------------------- لوحة الإحصاءات (أدمن) -------------------- */
async function renderPerfDashboardSection(content) {
  const cycles = await apiCall('performance', { method: 'POST', body: { action: 'listCycles' } });
  if (!cycles.length) { content.innerHTML = '<div class="card"><p style="color:#888">لا توجد دورات تقييم بعد</p></div>'; return; }
  const isAdmin = APP.user.role === 'role_admin';
  const settings = isAdmin ? await getSettingsOnce() : null;

  content.innerHTML = `
    <div class="card">
      <div class="field"><label>اختر الدورة</label><select id="perf_dashCycle">${cycles.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}</select></div>
      ${isAdmin ? `
      <div class="filter-card-title">تخصيص النطاق (اختياري — اتركه فارغاً لعرض الكل)</div>
      <div class="checkbox-list" id="perf_dashBranchBox">${scopeCheckboxesHtml(settings.branches, [], 'perf-dash-branch-cb')}</div>
      ` : ''}
      <button type="button" id="perf_dashLoadBtn" style="margin-top:14px">عرض</button>
    </div>
    <div id="perfDashArea"></div>`;

  document.getElementById('perf_dashLoadBtn').addEventListener('click', loadPerfDashboard);
  loadPerfDashboard();
}

async function loadPerfDashboard() {
  const cycleId = document.getElementById('perf_dashCycle').value;
  const isAdmin = APP.user.role === 'role_admin';
  const branchFilter = isAdmin ? collectCheckedValues('.perf-dash-branch-cb') : undefined;
  const area = document.getElementById('perfDashArea');
  area.innerHTML = `<div class="card"><div class="skel-rows"><div class="skel-row"></div></div></div>`;

  const stats = await apiCall('performance', { method: 'POST', body: { action: 'dashboardStats', cycleId, branchFilter } });

  area.innerHTML = `
    <div class="card" style="display:flex;align-items:center;gap:24px;flex-wrap:wrap">
      ${renderGaugeSVG(stats.average)}
      <div>
        <div style="font-size:12.5px;color:var(--text-muted);font-weight:700">متوسط الأداء العام</div>
        <div style="font-size:28px;font-weight:800;color:var(--primary)">${stats.average} <span style="font-size:14px;color:var(--text-muted);font-weight:600">/ 100</span></div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:4px">${stats.count} تقييماً مسجَّلاً هذي الدورة</div>
      </div>
    </div>
    <div class="card">
      <h3>أفضل 5 موظفين</h3>
      ${renderBarChartSVG(stats.topPerformers.map((p) => ({ label: p.name || '—', value: p.score })), '#2F7A4D')}
    </div>
    <div class="card">
      <h3>يحتاجون تحسيناً</h3>
      ${renderBarChartSVG(stats.needsImprovement.map((p) => ({ label: p.name || '—', value: p.score })), '#C4483A')}
    </div>
    <div class="card">
      <h3>مقارنة بين الفروع</h3>
      ${renderBarChartSVG(Object.entries(stats.byBranch).map(([b, avg]) => ({ label: b, value: avg })), '#7B5FB8')}
    </div>`;
}

/** 🆕 رسم بياني شريطي أفقي — SVG خالص، بلا أي مكتبة خارجية، يُعاد استخدامه بأي لوحة إحصاءات قادمة */
function renderBarChartSVG(items, color) {
  if (!items.length) return '<p style="color:#888">لا بيانات كافية بعد</p>';
  const maxVal = Math.max(100, ...items.map((i) => i.value));
  const rowHeight = 34;
  const svgHeight = items.length * rowHeight + 10;
  const chartWidth = 100; // نسبة مئوية من عرض الحاوية

  return `
    <svg viewBox="0 0 400 ${svgHeight}" style="width:100%;height:auto" xmlns="http://www.w3.org/2000/svg">
      ${items.map((item, i) => {
        const y = i * rowHeight;
        const barWidth = Math.max(4, (item.value / maxVal) * 260);
        return `
          <text x="398" y="${y + 14}" text-anchor="end" font-size="11" font-weight="700" fill="var(--primary)">${escapeHtml(item.label.length > 18 ? item.label.slice(0, 18) + '…' : item.label)}</text>
          <rect x="${398 - 260}" y="${y + 18}" width="260" height="10" rx="5" fill="var(--surface)"></rect>
          <rect x="${398 - barWidth}" y="${y + 18}" width="${barWidth}" height="10" rx="5" fill="${color}"></rect>
          <text x="${398 - 265}" y="${y + 27}" text-anchor="end" font-size="10" font-weight="800" fill="${color}">${item.value}</text>
        `;
      }).join('')}
    </svg>`;
}

/** 🆕 مقياس دائري بسيط (Gauge) — للمتوسط العام */
function renderGaugeSVG(value) {
  const pct = Math.max(0, Math.min(100, value)) / 100;
  const radius = 42, circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct);
  const color = value >= 85 ? '#2F7A4D' : value >= 65 ? '#B8860B' : '#C4483A';
  return `
    <svg width="100" height="100" viewBox="0 0 100 100" style="flex-shrink:0">
      <circle cx="50" cy="50" r="${radius}" fill="none" stroke="var(--surface)" stroke-width="10"></circle>
      <circle cx="50" cy="50" r="${radius}" fill="none" stroke="${color}" stroke-width="10" stroke-linecap="round"
        stroke-dasharray="${circumference}" stroke-dashoffset="${offset}" transform="rotate(-90 50 50)"></circle>
    </svg>`;
}

/* -------------------- معايير التقييم (أدمن) — مُجمَّعة بصناديق حسب الدور، مع تعديل -------------------- */
const PERF_ROLE_LABELS_ = { role_teacher: 'معلم', role_teacher_sup: 'مشرف معلمين', role_student_sup: 'مشرف طلاب', role_branch_monitor: 'مراقب فروع' };
let perfEditingCriterionId = null;

async function renderPerfCriteriaSection(content) {
  const criteria = await apiCall('performance', { method: 'POST', body: { action: 'listCriteria' } });
  const roleOptions = Object.entries(PERF_ROLE_LABELS_).map(([v, l]) => ({ v, l }));
  perfEditingCriterionId = null;

  content.innerHTML = `
    <div class="card">
      <h2 id="crit_formTitle">إضافة معيار تقييم جديد</h2>
      <input type="hidden" id="crit_editId" value="">
      <div class="field"><label>اسم المعيار</label><input type="text" id="crit_name" placeholder="مثال: جودة العمل"></div>
      <div class="field"><label>الوزن (%)</label><input type="number" id="crit_weight" min="1" max="100" value="10"></div>
      <div class="filter-card-title">ينطبق على الأدوار</div>
      <div class="checkbox-list" id="crit_rolesBox">${roleOptions.map((o) => `<label class="checkbox-item"><input type="checkbox" class="crit-role-cb" value="${o.v}"> ${o.l}</label>`).join('')}</div>
      <button type="button" id="crit_addBtn" style="margin-top:14px">إضافة</button>
      <button type="button" id="crit_cancelEditBtn" style="display:none;background:#888;margin-top:8px">إلغاء التعديل</button>
    </div>
    ${roleOptions.map(({ v: roleKey, l: roleLabel }) => {
      const roleCriteria = criteria.filter((c) => (c.applicable_roles || []).includes(roleKey));
      const totalWeight = roleCriteria.reduce((s, c) => s + Number(c.weight), 0);
      return `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
          <h3 style="margin:0">معايير ${escapeHtml(roleLabel)}</h3>
          <span class="status-badge ${totalWeight === 100 ? 'status-badge-on' : 'status-badge-off'}">مجموع الأوزان: ${totalWeight}%${totalWeight !== 100 ? ' ⚠️' : ''}</span>
        </div>
        ${roleCriteria.length ? roleCriteria.map((c) => `
          <div class="person-card-row" style="padding:10px 0;border-bottom:1px solid var(--surface)">
            <span style="font-weight:700;font-size:13px">${escapeHtml(c.name)}</span>
            <span style="display:flex;align-items:center;gap:10px">
              <span class="status-badge status-badge-off" style="color:var(--primary);background:var(--surface)">${c.weight}%</span>
              <span data-edit-criterion="${c.id}" style="cursor:pointer;color:var(--primary)">${ICONS.edit()}</span>
              <span data-del-criterion="${c.id}" style="cursor:pointer;color:#c62828">${ICONS.trash()}</span>
            </span>
          </div>`).join('') : '<p style="color:#aaa;font-size:12.5px">لا معايير بعد لهذا الدور</p>'}
      </div>`;
    }).join('')}`;

  function resetCriterionForm() {
    perfEditingCriterionId = null;
    document.getElementById('crit_editId').value = '';
    document.getElementById('crit_name').value = '';
    document.getElementById('crit_weight').value = '10';
    document.querySelectorAll('.crit-role-cb').forEach((cb) => { cb.checked = false; });
    document.getElementById('crit_formTitle').textContent = 'إضافة معيار تقييم جديد';
    document.getElementById('crit_addBtn').textContent = 'إضافة';
    document.getElementById('crit_cancelEditBtn').style.display = 'none';
  }

  document.getElementById('crit_addBtn').addEventListener('click', async () => {
    const name = document.getElementById('crit_name').value.trim();
    const weight = Number(document.getElementById('crit_weight').value);
    const applicableRoles = collectCheckedValues('.crit-role-cb');
    if (!name || !applicableRoles.length) { showToast('أكمل الاسم واختر دوراً واحداً على الأقل', 'error'); return; }
    try {
      const body = { action: 'saveCriterion', name, weight, applicableRoles };
      if (perfEditingCriterionId) body.id = perfEditingCriterionId;
      await apiCall('performance', { method: 'POST', body });
      showToast(perfEditingCriterionId ? 'تم تعديل المعيار بنجاح' : 'تمت الإضافة بنجاح', 'success');
      renderPerfCriteriaSection(content);
    } catch (e) { showToast(e.message, 'error'); }
  });

  document.getElementById('crit_cancelEditBtn').addEventListener('click', resetCriterionForm);

  content.querySelectorAll('[data-edit-criterion]').forEach((el) => {
    el.addEventListener('click', () => {
      const c = criteria.find((x) => String(x.id) === el.getAttribute('data-edit-criterion'));
      if (!c) return;
      perfEditingCriterionId = c.id;
      document.getElementById('crit_editId').value = c.id;
      document.getElementById('crit_name').value = c.name;
      document.getElementById('crit_weight').value = c.weight;
      document.querySelectorAll('.crit-role-cb').forEach((cb) => { cb.checked = (c.applicable_roles || []).includes(cb.value); });
      document.getElementById('crit_formTitle').textContent = 'تعديل معيار: ' + c.name;
      document.getElementById('crit_addBtn').textContent = 'حفظ التعديلات';
      document.getElementById('crit_cancelEditBtn').style.display = 'inline-block';
      document.getElementById('crit_formTitle').scrollIntoView({ behavior: 'smooth' });
    });
  });

  content.querySelectorAll('[data-del-criterion]').forEach((el) => {
    el.addEventListener('click', async () => {
      if (!confirm('تأكيد إزالة هذا المعيار؟')) return;
      try {
        await apiCall('performance', { method: 'POST', body: { action: 'deleteCriterion', id: el.getAttribute('data-del-criterion') } });
        renderPerfCriteriaSection(content);
      } catch (e) { showToast(e.message, 'error'); }
    });
  });
}

/* -------------------- دورات التقييم (أدمن) -------------------- */
async function renderPerfCyclesSection(content) {
  const cycles = await apiCall('performance', { method: 'POST', body: { action: 'listCycles' } });

  content.innerHTML = `
    <div class="card">
      <h2>إنشاء دورة تقييم جديدة</h2>
      <div class="field"><label>اسم الدورة</label><input type="text" id="cyc_name" placeholder="مثال: تقييم الربع الأول 2026"></div>
      <div class="field"><label>النوع</label>
        <select id="cyc_type"><option value="monthly">شهرية</option><option value="quarterly">ربع سنوية</option><option value="yearly">سنوية</option></select>
      </div>
      <div class="field"><label>تاريخ البداية</label><input type="date" id="cyc_start"></div>
      <div class="field"><label>تاريخ النهاية</label><input type="date" id="cyc_end"></div>
      <button type="button" id="cyc_addBtn">إنشاء الدورة</button>
    </div>
    <div class="card">
      <h3>الدورات الحالية</h3>
      ${cycles.map((c) => `
        <div class="modal-detail-row">
          <span class="modal-detail-label">${escapeHtml(c.name)} <span style="color:#888">(${c.start_date} → ${c.end_date})</span></span>
          <span class="modal-detail-value" style="display:flex;align-items:center;gap:8px">
            <span class="status-badge ${c.status === 'active' ? 'status-badge-on' : 'status-badge-off'}">${c.status === 'active' ? 'نشطة' : 'مغلقة'}</span>
            ${c.status === 'active' ? `<button type="button" class="btn-outline-sm" data-close-cycle="${c.id}" style="width:auto">إغلاق</button>` : ''}
          </span>
        </div>`).join('') || '<p style="color:#888">لا توجد دورات بعد</p>'}
    </div>`;

  document.getElementById('cyc_addBtn').addEventListener('click', async () => {
    const name = document.getElementById('cyc_name').value.trim();
    const startDate = document.getElementById('cyc_start').value;
    const endDate = document.getElementById('cyc_end').value;
    if (!name || !startDate || !endDate) { showToast('أكمل كل الحقول', 'error'); return; }
    try {
      await apiCall('performance', { method: 'POST', body: { action: 'addCycle', name, periodType: document.getElementById('cyc_type').value, startDate, endDate } });
      showToast('تم إنشاء الدورة بنجاح', 'success');
      renderPerfCyclesSection(content);
    } catch (e) { showToast(e.message, 'error'); }
  });

  content.querySelectorAll('[data-close-cycle]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('تأكيد إغلاق هذي الدورة؟ لن يُسمح بتقييمات جديدة فيها.')) return;
      try {
        await apiCall('performance', { method: 'POST', body: { action: 'closeCycle', id: btn.getAttribute('data-close-cycle') } });
        renderPerfCyclesSection(content);
      } catch (e) { showToast(e.message, 'error'); }
    });
  });
}

/* ===================== صفحة المراسلات ===================== */

async function renderMessagesView() {
  const main = document.getElementById('mainContent');
  main.innerHTML = `<div class="card"><div class="skel-rows"><div class="skel-row"></div></div></div>`;
  const isAdmin = APP.user.role === 'role_admin';

  main.innerHTML = `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
        <h2 style="margin:0">المراسلات</h2>
        <button type="button" id="composeNewBtn" style="width:auto">${ICONS.plus()} رسالة جديدة</button>
      </div>
      ${isAdmin ? `
      <div class="segmented-control" id="msgTabBar" style="margin-top:14px">
        <button type="button" class="segmented-item active" data-msg-tab="inbox">المراسلات</button>
        <button type="button" class="segmented-item" data-msg-tab="terms">الكلمات الممنوعة</button>
        <button type="button" class="segmented-item" data-msg-tab="blocked">الحسابات المحظورة</button>
      </div>` : ''}
    </div>
    <div id="msgTabContent"></div>`;

  document.getElementById('composeNewBtn').addEventListener('click', () => openComposeMessageModal());

  if (isAdmin) {
    document.querySelectorAll('#msgTabBar .segmented-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#msgTabBar .segmented-item').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const tab = btn.getAttribute('data-msg-tab');
        if (tab === 'inbox') renderMsgInboxTab();
        else if (tab === 'terms') renderMsgTermsTab();
        else if (tab === 'blocked') renderMsgBlockedTab();
      });
    });
  }
  renderMsgInboxTab();
}

function renderMsgInboxTab() {
  document.getElementById('msgTabContent').innerHTML = `<div id="threadsListArea"><div class="card"><div class="skel-rows"><div class="skel-row"></div></div></div></div>`;
  loadMyThreads();
}

async function renderMsgTermsTab() {
  const content = document.getElementById('msgTabContent');
  const terms = await apiCall('audit-log', { method: 'POST', body: { action: 'listBlockedTerms' } });
  content.innerHTML = `
    <div class="card">
      <h3>إضافة كلمة ممنوعة</h3>
      <p style="color:#888;font-size:12px;margin-top:-8px">أي رسالة تحتوي هذي الكلمة تُرفَض تلقائياً، ومُرسِلها يُحظَر فوراً</p>
      <div class="student-search-input-wrap"><input type="text" id="newTermInput" placeholder="اكتب الكلمة..."></div>
      <button type="button" id="addTermBtn" style="margin-top:10px">إضافة</button>
    </div>
    <div class="card">
      <h3>القائمة الحالية (${terms.length})</h3>
      <div class="student-chip-list">${terms.map((t) => `<span class="student-chip">${escapeHtml(t.term)}<span data-del-term="${t.id}" class="student-chip-remove">${ICONS.close()}</span></span>`).join('') || '<span class="student-linker-empty">لا توجد كلمات بعد</span>'}</div>
    </div>`;

  document.getElementById('addTermBtn').addEventListener('click', async () => {
    const term = document.getElementById('newTermInput').value.trim();
    if (!term) return;
    try {
      await apiCall('audit-log', { method: 'POST', body: { action: 'addBlockedTerm', term } });
      renderMsgTermsTab();
    } catch (e) { showToast(e.message, 'error'); }
  });
  content.querySelectorAll('[data-del-term]').forEach((el) => {
    el.addEventListener('click', async () => {
      await apiCall('audit-log', { method: 'POST', body: { action: 'deleteBlockedTerm', id: el.getAttribute('data-del-term') } });
      renderMsgTermsTab();
    });
  });
}

async function renderMsgBlockedTab() {
  const content = document.getElementById('msgTabContent');
  const blocked = await apiCall('audit-log', { method: 'POST', body: { action: 'listBlockedSenders' } });
  content.innerHTML = `<div class="card"><h3>الحسابات المحظورة حالياً</h3>
    ${blocked.map((b) => `
      <div class="person-card-row" style="padding:10px 0;border-bottom:1px solid var(--surface);align-items:flex-start">
        <div>
          <div style="font-weight:700;font-size:13px">${escapeHtml(b.person_id)}</div>
          <div style="font-size:11.5px;color:#C4483A;margin-top:2px">"${escapeHtml(b.flagged_message || '')}"</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${new Date(b.blocked_at).toLocaleString('ar')}</div>
        </div>
        <button type="button" class="btn-outline-sm" data-unblock="${b.id}" style="width:auto">رفع الحظر</button>
      </div>`).join('') || '<p style="color:#888">لا يوجد أحد محظور حالياً</p>'}
    </div>`;

  content.querySelectorAll('[data-unblock]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('تأكيد رفع الحظر عن هذا الحساب؟')) return;
      await apiCall('audit-log', { method: 'POST', body: { action: 'unblockSender', id: btn.getAttribute('data-unblock') } });
      renderMsgBlockedTab();
    });
  });
}

async function loadMyThreads() {
  const area = document.getElementById('threadsListArea');
  const threads = await apiCall('audit-log', { method: 'POST', body: { action: 'listMyThreads' } });

  if (!threads.length) { area.innerHTML = '<div class="card"><p style="color:#888">لا توجد مراسلات بعد</p></div>'; return; }

  area.innerHTML = `<div class="card">${threads.map((t) => `
    <div class="person-card-row" data-open-thread="${t.id}" style="padding:12px 0;border-bottom:1px solid var(--surface);cursor:pointer">
      <div>
        <div style="font-weight:700;font-size:13.5px">${escapeHtml(t.subject)}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${new Date(t.created_at).toLocaleString('ar')}</div>
      </div>
      <span>${ICONS.chevronDown()}</span>
    </div>`).join('')}</div>`;

  area.querySelectorAll('[data-open-thread]').forEach((el) => {
    el.addEventListener('click', () => openThreadView(el.getAttribute('data-open-thread')));
  });
}

async function openThreadView(threadId) {
  const messages = await apiCall('audit-log', { method: 'POST', body: { action: 'getThread', threadId } });

  const { close } = showDetailModal('المحادثة', null, []);
  const body = document.getElementById('modalBodyContent');
  body.innerHTML = `
    <div id="threadMessagesArea" style="max-height:320px;overflow-y:auto;margin-bottom:14px"></div>
    <div class="student-search-input-wrap">
      <input type="text" id="threadReplyInput" placeholder="اكتب ردّك...">
    </div>
    <button type="button" id="threadReplyBtn" style="margin-top:10px;width:100%">إرسال</button>`;

  document.getElementById('threadMessagesArea').innerHTML = messages.map((m) => `
    <div style="text-align:${m.sender_id === APP.user.id ? 'left' : 'right'};margin-bottom:10px">
      <div style="display:inline-block;max-width:80%;padding:8px 12px;border-radius:12px;background:${m.sender_id === APP.user.id ? 'var(--accent-green)' : 'var(--surface)'};font-size:13px">
        ${escapeHtml(m.body)}
      </div>
      <div style="font-size:10px;color:var(--text-muted);margin-top:2px">${new Date(m.created_at).toLocaleString('ar')}${m.is_original ? ' 📌' : ''}</div>
    </div>`).join('');

  document.getElementById('threadReplyBtn').addEventListener('click', async () => {
    const input = document.getElementById('threadReplyInput');
    const text = input.value.trim();
    if (!text) return;
    try {
      await apiCall('audit-log', { method: 'POST', body: { action: 'reply', threadId, body: text } });
      input.value = '';
      close();
      openThreadView(threadId);
    } catch (e) { showToast(e.message, 'error'); }
  });
}

/** 🆕 نافذة إنشاء رسالة جديدة — قابلة للاستدعاء من أي مكان بالتطبيق (بطاقة موظف، تقييم، سلوك...)
 * prefill اختياري: { recipients: [{id,type}], subject, contextType, contextId } */
function openComposeMessageModal(prefill) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay show';
  overlay.innerHTML = `
    <div class="modal-card">
      <div class="modal-header">
        <h3>رسالة جديدة</h3>
        <button type="button" class="modal-close-btn" id="composeCloseBtn">${ICONS.close()}</button>
      </div>
      <div class="modal-body">
        <div class="field"><label>الموضوع</label><input type="text" id="compose_subject" value="${escapeHtml(prefill?.subject || '')}"></div>
        ${!prefill?.recipients ? `
        <div class="field"><label>المستلم (اكتب اسم موظف)</label><input type="text" id="compose_recipientSearch" placeholder="ابحث بالاسم..."></div>
        <div id="compose_recipientResults" class="student-search-results"></div>
        <div id="compose_selectedRecipient" style="margin:8px 0;font-size:12.5px;color:var(--text-muted)">لم يُحدَّد مستلم بعد</div>
        ` : `<p style="font-size:12.5px;color:var(--text-muted)">سيصل هذا لجهة الاختصاص المرتبطة بهذا السجل</p>`}
        <div class="field"><label>الرسالة</label><textarea id="compose_body" rows="4"></textarea></div>
        <button type="button" id="composeSendBtn" style="width:100%">إرسال</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.getElementById('composeCloseBtn').addEventListener('click', close);

  let selectedRecipients = prefill?.recipients || [];

  if (!prefill?.recipients) {
    document.getElementById('compose_recipientSearch').addEventListener('input', async (e) => {
      const q = e.target.value.trim().toLowerCase();
      const box = document.getElementById('compose_recipientResults');
      if (q.length < 2) { box.innerHTML = ''; box.classList.remove('show'); return; }
      if (!APP.allEmployees || !APP.allEmployees.length) {
        try { APP.allEmployees = await apiCall('employees', { method: 'POST', body: { action: 'list' } }); } catch (err) { APP.allEmployees = []; }
      }
      const matches = APP.allEmployees.filter((emp) => emp.name_ar.toLowerCase().includes(q)).slice(0, 6);
      box.classList.add('show');
      box.innerHTML = matches.map((emp) => `<div class="search-result-item" data-pick-recipient="${escapeHtml(emp.id)}"><div class="search-result-label">${escapeHtml(emp.name_ar)}</div></div>`).join('') || '<p style="padding:10px;color:#aaa;font-size:12px">لا نتائج</p>';
      box.querySelectorAll('[data-pick-recipient]').forEach((el) => {
        el.addEventListener('click', () => {
          const emp = APP.allEmployees.find((x) => x.id === el.getAttribute('data-pick-recipient'));
          selectedRecipients = [{ id: emp.id, type: 'employee' }];
          document.getElementById('compose_selectedRecipient').textContent = 'المستلم: ' + emp.name_ar;
          box.innerHTML = ''; box.classList.remove('show');
          document.getElementById('compose_recipientSearch').value = '';
        });
      });
    });
  }

  document.getElementById('composeSendBtn').addEventListener('click', async () => {
    const subject = document.getElementById('compose_subject').value.trim();
    const bodyText = document.getElementById('compose_body').value.trim();
    if (!subject || !bodyText || !selectedRecipients.length) { showToast('أكمل كل الحقول واختر مستلماً', 'error'); return; }
    const btn = document.getElementById('composeSendBtn');
    btn.disabled = true; btn.textContent = 'جارِ الإرسال...';
    try {
      await apiCall('audit-log', {
        method: 'POST',
        body: { action: 'sendMessage', subject, body: bodyText, recipients: selectedRecipients, contextType: prefill?.contextType, contextId: prefill?.contextId },
      });
      showToast('تم الإرسال بنجاح', 'success');
      close();
    } catch (e) { showToast(e.message, 'error'); }
    finally { btn.disabled = false; btn.textContent = 'إرسال'; }
  });
}

/* ===================== أدوات مساعدة عامة ===================== */

/**
 * 🆕 زر إظهار/إخفاء عام لأي نموذج بأي صفحة — يُستخدَم بصفحة الموظفين
 * والطلاب حالياً، وأي صفحة قادمة (حضور، درجات...) بنفس السطر الواحد.
 * النموذج مخفي افتراضياً؛ يظهر عند الضغط، ويُخفى تلقائياً عند الحفظ الناجح.
 */
function wireFormToggle(toggleBtnId, formCardId, defaultLabel) {
  const btn = document.getElementById(toggleBtnId);
  const card = document.getElementById(formCardId);
  btn.addEventListener('click', () => {
    const isHidden = card.style.display === 'none';
    card.style.display = isHidden ? 'block' : 'none';
    btn.innerHTML = isHidden ? `${ICONS.close()} إغلاق النموذج` : defaultLabel;
    if (isHidden) card.scrollIntoView({ behavior: 'smooth' });
  });
}

/**
 * 🆕 نافذة تفاصيل عامة (Modal) — تعرض معلومات وصلاحيات أي شخص (موظف/طالب/مستخدم)
 * بشكل موحَّد. تُستخدَم بكل صفحات الأشخاص الثلاث، بلا أي تكرار كود.
 */
/**
 * 🆕 نافذة تفاصيل عامة (Modal) — تعرض معلومات وصلاحيات أي شخص (موظف/طالب/مستخدم)
 * بشكل موحَّد. تُستخدَم بكل صفحات الأشخاص الثلاث، بلا أي تكرار كود.
 * footerHtml اختياري — محتوى إضافي (أزرار إجراءات مثلاً) أسفل النافذة.
 */
function showDetailModal(title, subtitle, rows, footerHtml) {
  const existing = document.getElementById('detailModalOverlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'detailModalOverlay';
  overlay.innerHTML = `
    <div class="modal-card">
      <div class="modal-header">
        <div>
          <h3>${escapeHtml(title)}</h3>
          ${subtitle ? `<p class="modal-subtitle">${escapeHtml(subtitle)}</p>` : ''}
        </div>
        <button type="button" class="modal-close-btn" id="modalCloseBtn">${ICONS.close()}</button>
      </div>
      <div class="modal-body" id="modalBodyContent">
        ${rows.map((r) => `
          <div class="modal-detail-row">
            <span class="modal-detail-label">${escapeHtml(r.label)}</span>
            <span class="modal-detail-value">${r.value ? escapeHtml(r.value) : '<span style="color:#bbb">—</span>'}</span>
          </div>`).join('')}
      </div>
      ${footerHtml ? `<div class="modal-footer">${footerHtml}</div>` : ''}
    </div>`;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('show'));

  const close = () => { overlay.classList.remove('show'); setTimeout(() => overlay.remove(), 200); };
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.getElementById('modalCloseBtn').addEventListener('click', close);
  return { overlay, close };
}

/** 🆕 بطاقة الملف الشخصي — تفتح عند الضغط على معلومات المستخدم بالشريط العلوي */
function openMyProfileModal() {
  const u = APP.user;
  const { overlay } = showDetailModal(u.fullName, ROLE_LABELS_AR[u.role] || u.role, [
    { label: 'اسم المستخدم', value: u.username },
    { label: 'الدور (الصلاحية)', value: ROLE_LABELS_AR[u.role] || u.role },
    { label: 'الفرع', value: u.branch },
  ], `
    <button type="button" id="openChangePasswordBtn" class="btn-outline-sm" style="width:100%;justify-content:center;margin-bottom:8px">${ICONS.key()} تغيير كلمة المرور</button>
    <button type="button" id="modalLogoutBtn" class="btn-danger-outline btn-outline-sm" style="width:100%;justify-content:center">${ICONS.logout()} تسجيل الخروج</button>
  `);

  document.getElementById('modalLogoutBtn').addEventListener('click', () => {
    overlay.remove(); // 🆕 يزيل البطاقة صراحةً أولاً — تمنع بقاءها عالقة فوق شاشة الدخول الجديدة
    doLogout();
  });
  document.getElementById('openChangePasswordBtn').addEventListener('click', () => {
    const body = document.getElementById('modalBodyContent');
    body.innerHTML = `
      <div class="field"><label>كلمة المرور الجديدة</label><input type="password" id="myNewPassword" minlength="6"></div>
      <button type="button" id="saveNewPasswordBtn" style="width:100%">حفظ كلمة المرور الجديدة</button>`;
    document.getElementById('saveNewPasswordBtn').addEventListener('click', async () => {
      const newPassword = document.getElementById('myNewPassword').value;
      if (newPassword.length < 6) { showToast('كلمة المرور يجب ألا تقل عن 6 أحرف', 'error'); return; }
      try {
        await apiCall('auth', { method: 'POST', body: { action: 'forceSetPassword', newPassword } });
        showToast('تم تغيير كلمة المرور بنجاح', 'success');
        overlay.classList.remove('show'); setTimeout(() => overlay.remove(), 200);
      } catch (e) {
        showToast(e.message, 'error');
      }
    });
  });
}

/**
 * 🆕 محرّك البحث الشامل — يبحث بالصفحات المتاحة للمستخدم + الموظفين
 * + الطلاب + المستخدمين (حسب صلاحيات المستخدم الحالي فقط). يُستخدَم
 * من مكانَين: شريط البحث بسطح المكتب (قائمة منسدلة)، ونافذة البحث
 * المخصَّصة بالجوال — بنفس المنطق بالضبط، بلا أي تكرار كود.
 */
async function performGlobalSearch(query) {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const results = [];

  // 1) الصفحات المتاحة للمستخدم
  pagesForCurrentUser().forEach((key) => {
    if (PAGE_REGISTRY[key].label.toLowerCase().includes(q)) {
      results.push({ group: 'صفحات', label: PAGE_REGISTRY[key].label, action: () => navigate(key) });
    }
  });

  // 2) الموظفون (يُجلَبون فقط لو المستخدم يملك صلاحية الوصول لصفحتهم)
  if (pagesForCurrentUser().includes('employees')) {
    try {
      if (!APP.allEmployees || !APP.allEmployees.length) {
        APP.allEmployees = await apiCall('employees', { method: 'POST', body: { action: 'list' } });
      }
      APP.allEmployees.filter((e) => e.name_ar.toLowerCase().includes(q)).slice(0, 5).forEach((e) => {
        results.push({
          group: 'الموظفون', label: e.name_ar, sublabel: ROLE_LABELS_AR[e.role] || e.role,
          action: () => { navigate('employees'); setTimeout(() => showEmployeeDetailById(e.id), 150); },
        });
      });
    } catch (err) { /* تجاهل بصمت — البحث لا يجب يعطّل الصفحة */ }
  }

  // 3) الطلاب
  if (pagesForCurrentUser().includes('students')) {
    try {
      if (!APP.allStudents || !APP.allStudents.length) {
        APP.allStudents = await apiCall('students', { method: 'POST', body: { action: 'list' } });
      }
      APP.allStudents.filter((s) => s.name_ar.toLowerCase().includes(q)).slice(0, 5).forEach((s) => {
        results.push({
          group: 'الطلاب', label: s.name_ar, sublabel: `${s.grade} — ${s.section}`,
          action: () => { navigate('students'); setTimeout(() => showStudentDetailById(s.id), 150); },
        });
      });
    } catch (err) { /* تجاهل بصمت */ }
  }

  // 4) المستخدمون
  if (pagesForCurrentUser().includes('users')) {
    try {
      if (!APP.allUsers || !APP.allUsers.length) {
        APP.allUsers = await apiCall('users', { method: 'POST', body: { action: 'list' } });
      }
      APP.allUsers.filter((u) => u.nameAr.toLowerCase().includes(q) || u.username.toLowerCase().includes(q)).slice(0, 5).forEach((u) => {
        results.push({
          group: 'المستخدمون', label: u.nameAr, sublabel: u.username,
          action: () => { navigate('users'); },
        });
      });
    } catch (err) { /* تجاهل بصمت */ }
  }

  return results.slice(0, 15);
}

function showEmployeeDetailById(id) {
  document.querySelector(`.person-card[data-id="${id}"]`)?.click();
}
function showStudentDetailById(id) {
  document.querySelector(`.person-card[data-id="${id}"]`)?.click();
}

function renderSearchResultsList(results) {
  if (!results.length) return '<p style="padding:14px;color:#888;font-size:13px;text-align:center">لا نتائج مطابقة</p>';
  const groups = {};
  results.forEach((r) => { (groups[r.group] = groups[r.group] || []).push(r); });
  return Object.entries(groups).map(([group, items]) => `
    <div class="search-group-label">${escapeHtml(group)}</div>
    ${items.map((r, i) => `<div class="search-result-item" data-idx="${results.indexOf(r)}">
      <div class="search-result-label">${escapeHtml(r.label)}</div>
      ${r.sublabel ? `<div class="search-result-sublabel">${escapeHtml(r.sublabel)}</div>` : ''}
    </div>`).join('')}
  `).join('');
}

/* -------------------- بحث سطح المكتب: قائمة منسدلة داخل الشريط العلوي -------------------- */
function wireDesktopSearch() {
  const input = document.getElementById('globalSearchInput');
  const box = document.getElementById('searchResultsBox');
  if (!input || !box) return;
  let currentResults = [];
  let debounceTimer;

  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      currentResults = await performGlobalSearch(input.value);
      box.innerHTML = renderSearchResultsList(currentResults);
      box.classList.toggle('show', input.value.trim().length >= 2);
      box.querySelectorAll('.search-result-item').forEach((el) => {
        el.addEventListener('click', () => {
          currentResults[Number(el.getAttribute('data-idx'))]?.action();
          box.classList.remove('show'); input.value = '';
        });
      });
    }, 250);
  });
  document.addEventListener('click', (e) => { if (!e.target.closest('.header-search')) box.classList.remove('show'); });
}

/* -------------------- بحث الجوال: نافذة مخصَّصة -------------------- */
function openSearchModal() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay show';
  overlay.innerHTML = `
    <div class="modal-card" style="max-width:480px">
      <div class="modal-header">
        <h3>بحث شامل</h3>
        <button type="button" class="modal-close-btn" id="searchModalCloseBtn">${ICONS.close()}</button>
      </div>
      <div class="modal-body">
        <div class="field"><input type="text" id="mobileSearchInput" placeholder="اكتب للبحث..." autocomplete="off"></div>
        <div id="mobileSearchResults"></div>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.getElementById('searchModalCloseBtn').addEventListener('click', close);

  const input = document.getElementById('mobileSearchInput');
  const resultsBox = document.getElementById('mobileSearchResults');
  let currentResults = [];
  let debounceTimer;
  input.focus();
  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      currentResults = await performGlobalSearch(input.value);
      resultsBox.innerHTML = renderSearchResultsList(currentResults);
      resultsBox.querySelectorAll('.search-result-item').forEach((el) => {
        el.addEventListener('click', () => {
          currentResults[Number(el.getAttribute('data-idx'))]?.action();
          close();
        });
      });
    }, 250);
  });
}

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
