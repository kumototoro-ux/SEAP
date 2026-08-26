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
  academicCalendar: { label: 'التقويم الدراسي', icon: 'calendar', render: renderAcademicCalendarView }, // 🆕
  schedules: { label: 'الجداول الدراسية', icon: 'schedule', render: renderSchedulesView }, // 🆕
  assignments: { label: 'التكاليف والمهام', icon: 'clipboard', render: renderAssignmentsView }, // 🆕
  assignmentGrades: { label: 'رصد الدرجات', icon: 'guardians', render: renderAssignmentGradesView }, // 🆕
  studentPerformance: { label: 'أداء الطلاب', icon: 'students', render: renderStudentPerformanceView }, // 🆕
  registrationStats: { label: 'إحصائيات التسجيل', icon: 'chart', render: renderRegistrationStatsView }, // 🆕
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
  reports: { label: 'التقارير', icon: 'settingsGear', render: renderReportsView },
};

/** 🆕 صلاحيات كل دور — مطابقة تماماً لمنطق ROLE_PAGES بمشروع GAS الأصلي،
 * لكن مقتصرة على الصفحات المبنية فعلياً بهذا المشروع حتى الآن. أي دور
 * غير مذكور هنا (أو صفحة لم تُبنَ بعد لدوره) يحصل تلقائياً على "الرئيسية" فقط. */
const ROLE_PAGES = {
  // 🆕 أُضيفت 'academicCalendar' و'schedules' لكل الأدوار المصرَّح لها (عدا
  // Admission التي لا تملك صفحة جداول أصلاً بحسب خارطة الصلاحيات أعلاه).
  // 🆕 'assignments' (تكاليف/مهام): أدمن+معلم (كتابة) + 3 أدوار إشراف (عرض فقط).
  // 🆕 'assignmentGrades' (رصد الدرجات): أدمن ومعلم فقط — لا أحد غيرهما.
  // 🆕 'studentPerformance' (أداء الطلاب): كل الأدوار الخمسة بنطاق مختلف لكل دور (محدَّد بالخادم)
  // 🆕 'registrationStats' (إحصائيات التسجيل): أدمن (كل الفروع) + Admission (فرعها فقط)
  role_admin: ['home', 'academicCalendar', 'schedules', 'assignments', 'assignmentGrades', 'studentPerformance', 'registrationStats', 'messages', 'studentAttendance', 'staffAttendance', 'studentBehavior', 'performance', 'reports', 'employees', 'students', 'parents', 'familyAccounts', 'users', 'auditLog', 'siteSettings'],
  role_teacher: ['home', 'academicCalendar', 'schedules', 'assignments', 'assignmentGrades', 'studentPerformance', 'messages', 'studentAttendance', 'performance'],
  role_student_sup: ['home', 'academicCalendar', 'schedules', 'assignments', 'studentPerformance', 'messages', 'studentAttendance', 'studentBehavior', 'performance', 'reports', 'students', 'parents', 'familyAccounts'],
  role_teacher_sup: ['home', 'academicCalendar', 'schedules', 'assignments', 'studentPerformance', 'messages', 'staffAttendance', 'performance', 'reports'],
  Admission: ['home', 'academicCalendar', 'registrationStats', 'messages', 'students', 'parents', 'familyAccounts'],
  role_branch_monitor: ['home', 'academicCalendar', 'schedules', 'assignments', 'studentPerformance', 'messages', 'staffAttendance', 'performance', 'reports'],
};

function pagesForCurrentUser() {
  return ROLE_PAGES[APP.user.role] || ['home'];
}

/** 🆕 مجموعات القائمة الجانبية — عنوان رئيسي بلا مجموعة (رئيسية/مراسلات/تقارير)،
 * وقوائم منسدلة قابلة للطيّ لكل فئة (الطلاب، الموظفون، الإدارة). أي مجموعة
 * تصبح فارغة لدور معيّن (كل صفحاتها غير مصرَّح له بها) تختفي تلقائياً بلا أثر. */
const SIDEBAR_GROUPS = [
  { type: 'single', key: 'home' },
  { type: 'group', label: 'التقويم والجداول', icon: 'calendar', items: ['academicCalendar', 'schedules'] },
  { type: 'group', label: 'التكاليف والدرجات', icon: 'clipboard', items: ['assignments', 'assignmentGrades'] },
  { type: 'single', key: 'messages' },
  { type: 'group', label: 'الطلاب وأولياء الأمور', icon: 'students', items: ['students', 'parents', 'familyAccounts', 'studentAttendance', 'studentBehavior', 'studentPerformance'] }, // 🆕 أُدمجت هنا بدل رابط منفصل
  { type: 'group', label: 'الموظفون', icon: 'employees', items: ['employees', 'staffAttendance', 'performance', 'users'] },
  { type: 'group', label: 'التقارير والإحصائيات', icon: 'chart', items: ['reports', 'registrationStats'] }, // 🆕 جُمِعا معاً بدل تفرّقهما
  { type: 'group', label: 'الإدارة والإعدادات', icon: 'settingsGear', items: ['auditLog', 'siteSettings'] },
];

function renderGroupedSidebarNav(pages, activeView) {
  const singleLinkHtml = (key) => `<a data-view="${key}" title="${escapeHtml(PAGE_REGISTRY[key].label)}">${ICONS[PAGE_REGISTRY[key].icon]()}<span>${escapeHtml(PAGE_REGISTRY[key].label)}</span></a>`;

  const html = SIDEBAR_GROUPS.map((g) => {
    if (g.type === 'single') {
      return pages.includes(g.key) ? singleLinkHtml(g.key) : '';
    }
    const visibleItems = g.items.filter((k) => pages.includes(k));
    if (!visibleItems.length) return '';
    const isActiveGroup = visibleItems.includes(activeView);
    return `
      <div class="sidebar-group">
        <button type="button" class="sidebar-group-header ${isActiveGroup ? 'expanded' : ''}" data-group-toggle>
          ${ICONS[g.icon]()}<span>${escapeHtml(g.label)}</span>${ICONS.chevronDown()}
        </button>
        <div class="sidebar-group-items" style="display:${isActiveGroup ? 'block' : 'none'}">
          ${visibleItems.map(singleLinkHtml).join('')}
        </div>
      </div>`;
  }).join('');

  document.getElementById('sidebarNav').innerHTML = html;

  document.querySelectorAll('[data-group-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const itemsBox = btn.nextElementSibling;
      const willOpen = itemsBox.style.display !== 'block';
      itemsBox.style.display = willOpen ? 'block' : 'none';
      btn.classList.toggle('expanded', willOpen);
    });
  });
}

/* ===================== تسجيل الدخول ===================== */

function renderLogin() {
  document.getElementById('app').innerHTML = `
    <div class="login-wrap">
      <div class="login-card">
        <div class="login-logo">${mirqatLogo(44)}</div>
        <h2>جارِ التحميل...</h2>
      </div>
    </div>`;

  // 🆕 يجلب اسم المدرسة وشعارها من الإعدادات ويعرضهما بدل العلامة الافتراضية —
  // "منصتي وشعارها" كما طُلِب. requiresAuth:false لأنها قبل تسجيل الدخول أصلاً.
  getSettingsOnce().then((settings) => {
    const schoolName = settings.schoolName || 'مِرقاة';
    const logoHtml = settings.logoUrl
      ? `<img src="${escapeHtml(settings.logoUrl)}" alt="${escapeHtml(schoolName)}" style="max-height:52px;max-width:180px;object-fit:contain">`
      : mirqatLogo(44);

    document.getElementById('app').innerHTML = `
      <div class="login-wrap">
        <div class="login-card">
          <div class="login-logo">${logoHtml}</div>
          <h2>${escapeHtml(schoolName)}</h2>
          <div class="field"><label>اسم المستخدم</label><input id="username" type="text"></div>
          <div class="field"><label>كلمة المرور</label><input id="password" type="password"></div>
          <button id="loginBtn">دخول</button>
        </div>
      </div>`;

    document.getElementById('loginBtn').addEventListener('click', doLogin);
    ['username', 'password'].forEach((id) => {
      document.getElementById(id).addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });
    });
  }).catch(() => {
    // 🆕 لو فشل جلب الإعدادات لأي سبب (مثلاً انقطاع اتصال) — نعرض العلامة الافتراضية بدل شاشة فارغة
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
      // 🆕 إصلاح ثغرة أمنية حرجة: التوكن كان يُحفَظ بالتخزين المحلي هنا مباشرة
      // — قبل إتمام تغيير كلمة المرور الإجباري فعلياً. أي تحديث للصفحة بهذي
      // اللحظة كان يدخل المستخدم للوحة التحكم كاملة متجاوزاً الخطوة الإجبارية
      // بالكامل. الآن: لا يُحفَظ أي شيء بالتخزين المحلي إلا بعد نجاح التغيير
      // الفعلي — لو حدَّث الصفحة قبل إكماله، يرجع لشاشة الدخول من جديد (آمن).
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
      // 🆕 authToken صراحة من الذاكرة (APP.token) — بلا أي حفظ بـlocalStorage
      // قبل هذي اللحظة، إغلاقاً كاملاً لثغرة تجاوز التغيير الإجباري بتحديث الصفحة
      await apiCall('auth', { method: 'POST', body: { action: 'forceSetPassword', newPassword }, authToken: APP.token });
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
  const lastView = localStorage.getItem('mirqat_lastView');
  renderGroupedSidebarNav(pages, lastView);

  document.querySelectorAll('#sidebarNav a').forEach((a) => {
    a.addEventListener('click', () => { navigate(a.getAttribute('data-view')); closeSidebarMobile(); });
  });

  // 🆕 الشريط السفلي بالجوال — 4 اختصارات ثابتة (لا تتبع PAGE_REGISTRY)، منفصلة تماماً
  // عن القائمة الجانبية اللي تبقى تحتوي كل الصفحات الأخرى (تُفتَح بزر ☰)
  const BOTTOM_NAV_ITEMS = [
    { key: 'home', label: 'الرئيسية', icon: 'home', ready: true },
    { key: 'messages', label: 'المراسلات', icon: 'messages', ready: true },
    { key: 'search', label: 'بحث', icon: 'search', ready: true },
    { key: 'performance', label: 'الأداء', icon: 'tasks', ready: true },
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
  // 🆕 لو الصفحة النشطة داخل مجموعة قابلة للطيّ، افتحها تلقائياً حتى تظهر
  const activeLink = document.querySelector(`#sidebarNav a[data-view="${view}"]`);
  const parentGroupItems = activeLink?.closest('.sidebar-group-items');
  if (parentGroupItems) {
    parentGroupItems.style.display = 'block';
    parentGroupItems.previousElementSibling?.classList.add('expanded');
  }
  PAGE_REGISTRY[view].render();

  const main = document.getElementById('mainContent');
  main.classList.remove('content-fade-in');
  void main.offsetWidth;
  main.classList.add('content-fade-in');
}

/* ===================== الصفحة الرئيسية (نموذج لأي صفحة قادمة) ===================== */

/* ===================== 🆕 الصفحة الرئيسية (لوحة ملخّصات احترافية) ===================== */
// ساعة تناظرية فاخرة + تقويم دراسي مصغَّر + بطاقات إحصائية — كل بطاقة
// تظهر فقط لو المستخدم يملك صلاحية وصول لتلك الصفحة فعلياً (pagesForCurrentUser).

let homeClockIntervalId = null;
let homeClockMode = 'analog'; // 🆕 'analog' | 'digital' — يُتحكَّم فيه بزر التبديل

function renderHomeView() {
  if (homeClockIntervalId) { clearInterval(homeClockIntervalId); homeClockIntervalId = null; } // 🆕 يمنع تراكم مؤقّتات لو تكرّر فتح الرئيسية

  const main = document.getElementById('mainContent');
  const pages = pagesForCurrentUser();
  const now = new Date();
  const greeting = now.getHours() < 12 ? 'صباح الخير' : now.getHours() < 17 ? 'مساء الخير' : 'مساء الخير';

  main.innerHTML = `
    <div class="card">
      <h2 style="margin:0">${greeting}، ${escapeHtml(APP.user.fullName)}</h2>
      <p style="color:#888;font-size:12.5px;margin:4px 0 0">${escapeHtml(ROLE_LABELS_AR[APP.user.role] || APP.user.role)} — ${escapeHtml(APP.user.branch)}</p>
    </div>

    <div class="home-top-row">
      <div class="card home-clock-card">
        <button type="button" id="clockModeToggle" class="clock-mode-toggle" title="تبديل نوع عرض الساعة">${ICONS.chevronDown()} ${homeClockMode === 'analog' ? 'رقمية' : 'تناظرية'}</button>
        <div id="clockDisplayArea"></div>
        <div class="home-clock-date" id="homeClockDate"></div>
      </div>
      <div class="card home-calendar-card" id="homeCalendarCard">
        <div class="skel-rows"><div class="skel-row"></div></div>
      </div>
    </div>

    <div class="kpi-cards-row" id="homeKpiCardsRow" style="margin-top:16px"></div>
    <div class="home-widgets-row" id="homeWidgetsRow" style="margin-top:16px"></div>
  `;

  renderClockTick(); // 🆕 يرسم أول نبضة فوراً (بلا انتظار الثانية الأولى من المؤقّت)
  homeClockIntervalId = setInterval(renderClockTick, 1000);

  document.getElementById('clockModeToggle').addEventListener('click', () => {
    homeClockMode = homeClockMode === 'analog' ? 'digital' : 'analog';
    document.getElementById('clockModeToggle').innerHTML = `${ICONS.chevronDown()} ${homeClockMode === 'analog' ? 'رقمية' : 'تناظرية'}`;
    renderClockTick();
  });

  loadHomeCalendarWidget();
  loadHomeKpiCards(pages);
  loadHomeExtraWidgets(pages);
}

/** 🆕 يرسم نبضة ساعة كاملة من الصفر كل ثانية (بلا الاعتماد على تعديل
 * سمة transform لعنصر موجود مسبقاً — كانت هذي الطريقة السابقة تفشل بصمت
 * أحياناً حسب توقيت ربط العنصر). التصيير الكامل هنا مضمون 100% لأن زاوية
 * كل عقرب تُحسَب وتُدمَج مباشرة بنص SVG وقت إنشائه، لا بعده. */
function renderClockTick() {
  const area = document.getElementById('clockDisplayArea');
  if (!area) return; // المستخدم غادر الصفحة — clearInterval يتكفّل بإيقاف المؤقّت لاحقاً
  const now = new Date();

  if (homeClockMode === 'digital') {
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    area.innerHTML = `
      <div class="digital-clock">
        <div class="digital-clock-time">${hh}<span class="digital-clock-colon">:</span>${mm}<span class="digital-clock-colon">:</span>${ss}</div>
        <div class="digital-clock-brand">مِرقاة</div>
      </div>`;
  } else {
    area.innerHTML = buildLuxuryClockSVG(now);
  }

  const dateEl = document.getElementById('homeClockDate');
  if (dateEl) dateEl.textContent = now.toLocaleDateString('ar-SA-u-ca-gregory', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

/** 🆕 ساعة تناظرية فاخرة (إطار ذهبي، قرص داكن) — SVG بحت، بلا صور خارجية.
 * زاوية كل عقرب تُحسَب وتُدمَج مباشرة داخل سمة transform وقت بناء النص —
 * لا اعتماد على تعديلها لاحقاً بجافاسكربت منفصل (كان هذا سبب توقّف الحركة). */
function buildLuxuryClockSVG(now) {
  const h = now.getHours() % 12, m = now.getMinutes(), s = now.getSeconds();
  const hourAngle = h * 30 + m * 0.5;
  const minuteAngle = m * 6 + s * 0.1;
  const secondAngle = s * 6;

  const ticks = Array.from({ length: 12 }).map((_, i) => {
    const angle = i * 30;
    const isMajor = i % 3 === 0;
    const r1 = isMajor ? 66 : 72;
    const rad = (angle * Math.PI) / 180;
    const x1 = 100 + r1 * Math.sin(rad), y1 = 100 - r1 * Math.cos(rad);
    const x2 = 100 + 80 * Math.sin(rad), y2 = 100 - 80 * Math.cos(rad);
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="clock-tick ${isMajor ? 'clock-tick-major' : ''}"/>`;
  }).join('');

  return `
    <svg viewBox="0 0 200 200" class="luxury-clock">
      <circle cx="100" cy="100" r="96" class="clock-bezel"/>
      <circle cx="100" cy="100" r="84" class="clock-face"/>
      ${ticks}
      <text x="100" y="60" text-anchor="middle" class="clock-brand-text">مِرقاة</text>
      <line x1="100" y1="100" x2="100" y2="60" class="clock-hand clock-hand-hour" transform="rotate(${hourAngle} 100 100)"/>
      <line x1="100" y1="100" x2="100" y2="42" class="clock-hand clock-hand-minute" transform="rotate(${minuteAngle} 100 100)"/>
      <line x1="100" y1="112" x2="100" y2="36" class="clock-hand clock-hand-second" transform="rotate(${secondAngle} 100 100)"/>
      <circle cx="100" cy="100" r="5" class="clock-center"/>
    </svg>`;
}

/** 🆕 تقويم دراسي مصغَّر — الفصل الحالي + أقرب الأحداث القادمة */
async function loadHomeCalendarWidget() {
  const card = document.getElementById('homeCalendarCard');
  if (!card) return;
  if (!pagesForCurrentUser().includes('academicCalendar')) { card.style.display = 'none'; return; }

  let calData;
  try {
    calData = await apiCall('academic-config', { method: 'POST', body: { action: 'listCalendarData' } });
  } catch (e) { card.innerHTML = '<p style="color:#888;font-size:12.5px">تعذّر تحميل التقويم</p>'; return; }

  const todayStr = toISODateLocal(new Date());
  const activeTerm = (calData.terms || []).find((t) => t.start_date <= todayStr && t.end_date >= todayStr) || (calData.terms || [])[0];

  const upcoming = [
    ...(calData.weeks || []).map((w) => ({ label: w.label || w.week_type, date: w.start_date, type: w.week_type })),
    ...(calData.holidays || []).map((h) => ({ label: `🌴 ${h.label}`, date: h.start_date, type: 'إجازة' })),
  ].filter((e) => e.date >= todayStr).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3);

  card.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center">
      <h3 style="margin:0">التقويم الدراسي</h3>
      <a data-view="academicCalendar" style="font-size:12px;color:var(--primary);cursor:pointer;text-decoration:none">عرض كامل ←</a>
    </div>
    ${activeTerm ? `<p style="color:#888;font-size:12.5px;margin:8px 0">${escapeHtml(activeTerm.name)} — ${formatDateAr(activeTerm.start_date)} ← ${formatDateAr(activeTerm.end_date)}</p>` : '<p style="color:#888;font-size:12.5px;margin:8px 0">لا يوجد فصل دراسي ظاهر حالياً</p>'}
    ${upcoming.length ? `
      <div style="display:flex;flex-direction:column;gap:6px;margin-top:8px">
        ${upcoming.map((e) => `
          <div class="person-card-row" style="padding:8px 10px;background:var(--surface);border-radius:8px">
            <span style="font-size:12px">${escapeHtml(e.label)}</span>
            <span style="font-size:11px;color:var(--text-muted)">${formatDateAr(e.date)}</span>
          </div>`).join('')}
      </div>` : ''}`;

  card.querySelector('[data-view="academicCalendar"]')?.addEventListener('click', () => navigate('academicCalendar'));
}

/** 🆕 بطاقات إحصائية سريعة — كل بطاقة مشروطة بامتلاك المستخدم صلاحية وصول لصفحتها فعلياً */
async function loadHomeKpiCards(pages) {
  const row = document.getElementById('homeKpiCardsRow');
  const cards = [];

  if (pages.includes('students')) {
    try {
      const students = await apiCall('students', { method: 'POST', body: { action: 'list' } });
      cards.push({ label: 'الطلاب', value: students.length, view: 'students' });
    } catch (e) { /* تجاهل بصمت */ }
  }
  if (pages.includes('employees')) {
    try {
      const employees = await apiCall('employees', { method: 'POST', body: { action: 'list' } });
      cards.push({ label: 'الموظفون', value: employees.length, view: 'employees' });
    } catch (e) { /* تجاهل بصمت */ }
  }
  if (pages.includes('messages')) {
    try {
      const unread = await apiCall('audit-log', { method: 'POST', body: { action: 'unreadCount' } });
      cards.push({ label: 'رسائل غير مقروءة', value: unread.count ?? unread, view: 'messages' });
    } catch (e) { /* تجاهل بصمت */ }
  }
  if (pages.includes('assignments')) {
    try {
      const assignments = await apiCall('academic-config', { method: 'POST', body: { action: 'listAssignments' } });
      cards.push({ label: 'التكاليف والمهام المنشورة', value: assignments.length, view: 'assignments' });
    } catch (e) { /* تجاهل بصمت */ }
  }
  if (pages.includes('registrationStats')) {
    try {
      const stats = await apiCall('academic-config', { method: 'POST', body: { action: 'getRegistrationStats' } });
      cards.push({ label: 'إجمالي الطلاب المسجَّلين', value: stats.totalStudents, view: 'registrationStats' });
    } catch (e) { /* تجاهل بصمت */ }
  }
  if (pages.includes('performance')) {
    cards.push({ label: 'تقييم الأداء', value: '←', view: 'performance', isLink: true });
  }

  if (!cards.length) { row.style.display = 'none'; return; }

  row.innerHTML = cards.map((c) => `
    <div class="kpi-card" data-home-kpi="${c.view}" style="cursor:pointer">
      <div class="kpi-card-label">${escapeHtml(c.label)}</div>
      <div class="kpi-card-value">${c.isLink ? '' : c.value}${c.isLink ? `<span style="font-size:15px;color:var(--primary)">فتح الصفحة ←</span>` : ''}</div>
    </div>`).join('');

  row.querySelectorAll('[data-home-kpi]').forEach((el) => {
    el.addEventListener('click', () => navigate(el.getAttribute('data-home-kpi')));
  });
}

/** 🆕 قسمان إضافيان يملآن الفراغ أسفل الرئيسية — آخر الأنشطة (أدمن فقط)
 * وأقرب التكاليف/الاختبارات استحقاقاً (لمن يملك صلاحية صفحة التكاليف) */
async function loadHomeExtraWidgets(pages) {
  const row = document.getElementById('homeWidgetsRow');
  const widgets = [];

  if (pages.includes('auditLog')) {
    try {
      const log = await apiCall('audit-log', { method: 'POST', body: { action: 'list' } });
      const recent = log.slice(0, 6);
      widgets.push(`
        <div class="card home-widget-card">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <h3 style="margin:0">آخر الأنشطة</h3>
            <a data-view="auditLog" style="font-size:12px;color:var(--primary);cursor:pointer;text-decoration:none">عرض الكل ←</a>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;margin-top:10px">
            ${recent.map((r) => `
              <div class="person-card-row" style="padding:8px 10px;background:var(--surface);border-radius:8px">
                <span style="font-size:12px">${escapeHtml(r.action)} — ${escapeHtml(r.emp_name || '')}</span>
                <span style="font-size:11px;color:var(--text-muted)">${new Date(r.created_at).toLocaleString('ar-SA-u-ca-gregory')}</span>
              </div>`).join('') || '<p style="color:#888;font-size:12px">لا يوجد نشاط بعد</p>'}
          </div>
        </div>`);
    } catch (e) { /* تجاهل بصمت */ }
  }

  if (pages.includes('assignments')) {
    try {
      const assignments = await apiCall('academic-config', { method: 'POST', body: { action: 'listAssignments' } });
      const upcoming = assignments.filter((a) => a.due_at && new Date(a.due_at) >= new Date())
        .sort((a, b) => new Date(a.due_at) - new Date(b.due_at)).slice(0, 5);
      widgets.push(`
        <div class="card home-widget-card">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <h3 style="margin:0">أقرب المواعيد استحقاقاً</h3>
            <a data-view="assignments" style="font-size:12px;color:var(--primary);cursor:pointer;text-decoration:none">عرض الكل ←</a>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;margin-top:10px">
            ${upcoming.map((a) => `
              <div class="person-card-row" style="padding:8px 10px;background:var(--surface);border-radius:8px">
                <span style="font-size:12px">${escapeHtml(a.title)}</span>
                <span style="font-size:11px;color:var(--text-muted)">${new Date(a.due_at).toLocaleDateString('ar-SA-u-ca-gregory')}</span>
              </div>`).join('') || '<p style="color:#888;font-size:12px">لا مواعيد قادمة حالياً</p>'}
          </div>
        </div>`);
    } catch (e) { /* تجاهل بصمت */ }
  }

  if (pages.includes('registrationStats')) {
    try {
      const stats = await apiCall('academic-config', { method: 'POST', body: { action: 'getRegistrationStats' } });
      if (stats.studentsByGrade?.length) {
        widgets.push(`
          <div class="card home-widget-card">
            <h3 style="margin:0">الطلاب حسب الصف</h3>
            ${renderBarChartSVG(stats.studentsByGrade.map((r) => ({ label: r.label, value: r.count })), '#7B5FB8')}
          </div>`);
      }
    } catch (e) { /* تجاهل بصمت */ }
  }

  if (!widgets.length) { row.style.display = 'none'; return; }
  row.innerHTML = widgets.join('');
  row.querySelectorAll('[data-view]').forEach((el) => {
    el.addEventListener('click', () => navigate(el.getAttribute('data-view')));
  });
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
  const isAdmin = APP.user.role === 'role_admin';

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
        <div class="field"><label>تاريخ الميلاد</label><input id="stu_dateOfBirth" type="date" dir="ltr"></div>
        <div class="field"><label>الجنس</label>
          <select id="stu_gender">
            <option value="">-- غير محدَّد --</option>
            <option value="ذكر">ذكر</option>
            <option value="أنثى">أنثى</option>
          </select>
        </div>
        <div class="field"><label>الفرع *</label>
          <select id="stu_branch" required><option value="" disabled selected>-- اختر --</option>
            ${allowedBranchesForUser_(settings.branches).map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('')}
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
        <div class="filter-card-title">المواد الدراسية <span style="font-weight:400;color:#888;font-size:11px">(تُسحَب تلقائياً من توزيع المواد بالإعدادات فور اختيار الفرع/المرحلة/الصف/الشعبة)</span></div>
        <div class="student-chip-list" id="stu_subjectsDisplay">
          <p style="color:#888;font-size:12px">اختر الفرع والمرحلة والصف والشعبة أولاً</p>
        </div>

        <button type="submit" id="addStuBtn" style="margin-top:14px">تسجيل الطالب</button>
        <button type="button" id="cancelStuEditBtn" style="display:none;background:#888;margin-top:8px">إلغاء التعديل</button>
      </form>
    </div>

    <div class="card">
      <h3>قائمة الطلاب</h3>
      <p style="color:#888;font-size:12px;margin-top:-6px">${isAdmin ? 'حدّد الفرع، ثم فلتراً إضافياً أو ابحث لعرض النتائج' : 'حدّد فلتراً إضافياً (مرحلة/صف/شعبة) أو ابحث لعرض النتائج'}</p>
      <div class="af-grid-row">
        ${isAdmin ? `<div class="field"><label>الفرع</label><select id="stu_filterBranch"><option value="">-- اختر --</option>${settings.branches.map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('')}</select></div>` : ''}
        <div class="field"><label>المرحلة</label><select id="stu_filterStage"><option value="">-- الكل --</option>${settings.stages.map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('')}</select></div>
        <div class="field"><label>الصف</label><select id="stu_filterGrade"><option value="">-- الكل --</option>${settings.grades.map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('')}</select></div>
        <div class="field"><label>الشعبة</label><select id="stu_filterSection"><option value="">-- الكل --</option>${settings.sections.map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('')}</select></div>
      </div>
      <div class="field"><label>أو ابحث بالاسم أو رقم الهوية</label><input id="stuSearchInput" type="text" placeholder="اكتب اسم الطالب أو رقم هويته..."></div>
      <div id="stuListArea"><p style="color:#888;font-size:12.5px">${isAdmin ? 'اختر الفرع أولاً لعرض النتائج' : 'حدّد فلتراً أو ابحث لعرض النتائج'}</p></div>
    </div>`;

  wireFormToggle('toggleStuFormBtn', 'stuFormCard', `${ICONS.plus()} تسجيل طالب جديد`);

  document.getElementById('stu_nameAr').addEventListener('blur', () => {
    const enField = document.getElementById('stu_nameEn');
    if (!enField.value.trim()) enField.value = transliterateArabicToEnglish(document.getElementById('stu_nameAr').value);
  });

  document.getElementById('addStuForm').addEventListener('submit', saveStudentHandler);
  document.getElementById('cancelStuEditBtn').addEventListener('click', resetStudentForm);
  // 🆕 سحب المواد تلقائياً من توزيع المواد بالإعدادات فور اكتمال الفرع/المرحلة/الصف/الشعبة
  ['stu_branch', 'stu_stage', 'stu_grade', 'stu_section'].forEach((id) => {
    document.getElementById(id).addEventListener('change', refreshStudentSubjects);
  });

  // 🆕 فلاتر القائمة — لا تحميل تلقائي لكل الطلاب؛ فقط عند اختيار فلتر
  // كافٍ أو كتابة بحث (يمنع ظهور آلاف البطاقات دفعة وحدة)
  let stuSearchDebounce;
  document.getElementById('stuSearchInput').addEventListener('input', () => {
    clearTimeout(stuSearchDebounce);
    stuSearchDebounce = setTimeout(loadStudentsList, 400);
  });
  ['stu_filterBranch', 'stu_filterStage', 'stu_filterGrade', 'stu_filterSection'].forEach((id) => {
    document.getElementById(id)?.addEventListener('change', loadStudentsList);
  });
}

function resetStudentForm() {
  document.getElementById('addStuForm').reset();
  document.getElementById('stu_editId').value = '';
  document.getElementById('stu_nationalIdField').style.display = 'block';
  document.getElementById('stu_nationalId').required = true;
  document.getElementById('stuFormTitle').textContent = 'تسجيل طالب جديد';
  document.getElementById('addStuBtn').textContent = 'تسجيل الطالب';
  document.getElementById('cancelStuEditBtn').style.display = 'none';
  stuResolvedSubjects = []; // 🆕
  document.getElementById('stu_subjectsDisplay').innerHTML = '<p style="color:#888;font-size:12px">اختر الفرع والمرحلة والصف والشعبة أولاً</p>';
  document.getElementById('stuFormCard').style.display = 'none'; // 🆕 يُخفى النموذج تلقائياً بعد الحفظ/الإلغاء
  document.getElementById('toggleStuFormBtn').innerHTML = `${ICONS.plus()} تسجيل طالب جديد`;
}

let stuResolvedSubjects = []; // 🆕 المواد المسحوبة تلقائياً من توزيع المواد — تُستخدَم مباشرة عند الحفظ

/** 🆕 يجلب مواد الفرع/المرحلة/الصف/الشعبة المُختارة تلقائياً من توزيع المواد بالإعدادات */
async function refreshStudentSubjects() {
  const branch = document.getElementById('stu_branch').value;
  const stage = document.getElementById('stu_stage').value;
  const grade = document.getElementById('stu_grade').value;
  const section = document.getElementById('stu_section').value;
  const display = document.getElementById('stu_subjectsDisplay');
  if (!branch || !stage || !grade || !section) {
    display.innerHTML = '<p style="color:#888;font-size:12px">اختر الفرع والمرحلة والصف والشعبة أولاً</p>';
    stuResolvedSubjects = [];
    return;
  }
  display.innerHTML = '<p style="color:#888;font-size:12px">جارِ التحميل...</p>';
  try {
    stuResolvedSubjects = await apiCall('academic-config', { method: 'POST', body: { action: 'listSubjectsForClass', branch, stage, grade, section } });
    display.innerHTML = stuResolvedSubjects.length
      ? stuResolvedSubjects.map((s) => `<span class="student-chip">${escapeHtml(s)}</span>`).join('')
      : '<p style="color:#c47a00;font-size:12px">⚠️ لا يوجد توزيع مواد مُعرَّف لهذا الفرع/المرحلة/الصف/الشعبة بعد — أضفه أولاً من الإعدادات ← توزيع المواد</p>';
  } catch (e) {
    display.innerHTML = `<p style="color:#c62828;font-size:12px">${escapeHtml(e.message)}</p>`;
    stuResolvedSubjects = [];
  }
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
  refreshStudentSubjects(); // 🆕 يسحب المواد تلقائياً بحسب صف/شعبة الطالب الحاليين (بدل خانات اختيار يدوية)

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
    subjects: stuResolvedSubjects, // 🆕 مسحوبة تلقائياً من توزيع المواد — بدل اختيار يدوي
  };
  if (!editId) body.nationalId = document.getElementById('stu_nationalId').value.trim();

  try {
    if (editId) {
      await apiCall('students', { method: 'POST', body: { action: 'update', id: editId, ...body } });
      showToast('تم تحديث بيانات الطالب بنجاح', 'success');
    } else {
      await apiCall('students', { method: 'POST', body: { action: 'add', ...body } });
      showToast('تم تسجيل الطالب بنجاح، وحسابه الخاص جاهز مسبقاً لموقع الطلاب فور إطلاقه', 'success');
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
  const isAdmin = APP.user.role === 'role_admin';
  const branch = isAdmin ? (document.getElementById('stu_filterBranch')?.value || '') : '';
  const stage = document.getElementById('stu_filterStage')?.value || '';
  const grade = document.getElementById('stu_filterGrade')?.value || '';
  const section = document.getElementById('stu_filterSection')?.value || '';
  const search = (document.getElementById('stuSearchInput').value || '').trim();

  // 🆕 بوابة العرض — بلا هذا الفحص كانت الصفحة تجيب كل الطلاب دفعة وحدة
  // (قد تصل لآلاف البطاقات). الفرع إجباري أولاً للأدمن، ثم فلتر إضافي
  // أو بحث لأي دور — بالضبط نفس الفحص المطبَّق بالخادم كطبقة حماية ثانية.
  if (isAdmin && !branch && !search) {
    area.innerHTML = '<p style="color:#888;font-size:12.5px">اختر الفرع أولاً لعرض النتائج</p>';
    APP.allStudents = [];
    return;
  }
  if ((isAdmin ? !!branch : true) && !stage && !grade && !section && !search) {
    area.innerHTML = `<p style="color:#888;font-size:12.5px">${isAdmin ? 'حدّد فلتراً إضافياً (المرحلة/الصف/الشعبة) أو ابحث لعرض النتائج' : 'حدّد فلتراً (المرحلة/الصف/الشعبة) أو ابحث لعرض النتائج'}</p>`;
    APP.allStudents = [];
    return;
  }

  area.innerHTML = `<div class="skel-rows"><div class="skel-row"></div><div class="skel-row"></div></div>`;
  try {
    APP.allStudents = await apiCall('students', { method: 'POST', body: { action: 'list', branch: branch || undefined, stage: stage || undefined, grade: grade || undefined, section: section || undefined, search: search || undefined } });
    renderStudentsTable();
  } catch (e) {
    area.innerHTML = `<p style="color:#c62828">${escapeHtml(e.message)}</p>`;
  }
}

function renderStudentsTable() {
  const area = document.getElementById('stuListArea');
  const list = APP.allStudents; // 🆕 مُفلترة فعلياً من الخادم — لا حاجة لفلترة إضافية بالمتصفح

  if (!list.length) { area.innerHTML = '<p style="color:#888">لا يوجد طلاب مطابقون للفلاتر المحدَّدة</p>'; return; }

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
            ${allowedBranchesForUser_(settings.branches).map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('')}
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
  { key: 'evaluation', label: 'التقييم والاختبارات', icon: 'tasks', lists: ['terms', 'continuousEvalTypes', 'exams'] },
  { key: 'gradeDistribution', label: 'توزيع الدرجات', icon: 'guardians' }, // 🆕 رُتِّب مبكراً — أساس نتائج الفصول الدراسية (Grade Aggregation)
  { key: 'subjectMatrix', label: 'توزيع المواد', icon: 'employees' },
  { key: 'accounts', label: 'الحسابات والأدوار', icon: 'lock', lists: ['userTypes', 'roles', 'accountStatuses'] },
  { key: 'attendance', label: 'الحضور والسلوك', icon: 'tasks', lists: ['attendanceStatuses', 'behaviorStatuses'] },
  { key: 'academicCalendar', label: 'التقويم الدراسي', icon: 'calendar' },
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
    btn.addEventListener('click', () => {
      siteSettingsActiveSection = btn.getAttribute('data-section');
      if (siteSettingsActiveSection !== 'academicCalendar') academicCalendarActiveTermId = null; // 🆕 يصفّر حالة إدارة الأسابيع عند مغادرة القسم
      renderSettingsSection();
    });
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
  if (section.key === 'academicCalendar') { await renderSettingsAcademicCalendarSection(content); return; } // 🆕

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
  // 🆕 إصلاح مهم: لو المستخدم كتب قيمة جديدة بحقل الإضافة لكن ضغط "حفظ"
  // مباشرة بلا الضغط على Enter أولاً، كانت القيمة تُهمَل تماماً بصمت
  // (يظهر "تم الحفظ بنجاح" لكن بالقائمة القديمة فقط). الآن نتحقق من
  // محتوى حقل الإضافة أولاً ونضيفه تلقائياً قبل الحفظ لو كان غير فارغ.
  const addInput = document.getElementById(`ssAdd_${camelKey}`);
  if (addInput && addInput.value.trim()) {
    const pendingVal = addInput.value.trim();
    if (!siteSettingsListsState[camelKey].includes(pendingVal)) siteSettingsListsState[camelKey].push(pendingVal);
    addInput.value = '';
  }

  const values = siteSettingsListsState[camelKey];
  if (!values.length) { showToast('يجب إدخال قيمة واحدة على الأقل', 'error'); return; }
  try {
    await apiCall('settings', { method: 'POST', body: { action: 'updateList', listKey: snakeKey, values } });
    showToast('تم الحفظ بنجاح', 'success');
    cachedSettings = null;
    const freshSettings = await getSettingsOnce();
    SETTINGS_LIST_KEYS.forEach((k) => { siteSettingsListsState[k.camel] = [...(freshSettings[k.camel] || [])]; });
    renderSettingsSection();
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
      <div class="field"><label>التاريخ</label><input type="date" dir="ltr" id="att_date" value="${todayISO()}"></div>
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
      <div class="field"><label>التاريخ</label><input type="date" dir="ltr" id="att_date" value="${todayISO()}"></div>
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
      <button type="button" class="btn-toggle-form" id="toggleBehFormBtn">${ICONS.plus()} تسجيل موقف سلوكي جديد</button>
      <div id="behaviorFormCard" style="display:none;margin-top:16px">
        <input type="hidden" id="beh_editId" value="">
        <div class="behavior-type-toggle">
          <button type="button" class="behavior-type-btn active" data-behavior-type="positive">${ICONS.plus()} إيجابي</button>
          <button type="button" class="behavior-type-btn" data-behavior-type="negative">${ICONS.close()} سلبي</button>
        </div>
        <input type="hidden" id="beh_type" value="positive">
        <div class="field"><label>عدد النقاط</label><input type="number" id="beh_points" min="1" max="100" step="1" value="5"></div>
        <div class="field"><label>الوصف</label><input type="text" id="beh_description" placeholder="مثال: مساعدة زميل، تكرار عدم إحضار الواجب..."></div>
        <button type="button" id="beh_addBtn">تسجيل</button>
      </div>
    </div>

    <div class="card">
      <h3>السجل الكامل</h3>
      <div id="behaviorHistoryArea"></div>
    </div>`;

  wireFormToggle('toggleBehFormBtn', 'behaviorFormCard', `${ICONS.plus()} تسجيل موقف سلوكي جديد`);

  function resetBehaviorForm() {
    document.getElementById('beh_editId').value = '';
    document.getElementById('beh_points').value = '5';
    document.getElementById('beh_description').value = '';
    document.querySelectorAll('.behavior-type-btn').forEach((b) => b.classList.remove('active'));
    document.querySelector('[data-behavior-type="positive"]').classList.add('active');
    document.getElementById('beh_type').value = 'positive';
    document.getElementById('beh_addBtn').textContent = 'تسجيل';
  }

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
    const editId = document.getElementById('beh_editId').value;
    const description = document.getElementById('beh_description').value.trim();
    if (!description) { showToast('الوصف مطلوب', 'error'); return; }
    btn.disabled = true; btn.textContent = 'جارِ الحفظ...';
    try {
      const body = {
        action: editId ? 'update' : 'add', studentId: behaviorSelectedStudentId, branch: student.branch,
        type: document.getElementById('beh_type').value,
        points: Math.max(1, Number(document.getElementById('beh_points').value) || 1),
        description,
      };
      if (editId) body.id = editId;
      await apiCall('behavior', { method: 'POST', body });
      showToast(editId ? 'تم التعديل بنجاح' : 'تم التسجيل بنجاح', 'success');
      resetBehaviorForm();
      document.getElementById('behaviorFormCard').style.display = 'none'; // 🆕 النموذج يختفي تلقائياً بعد الحفظ
      document.getElementById('toggleBehFormBtn').innerHTML = `${ICONS.plus()} تسجيل موقف سلوكي جديد`;
      loadBehaviorForStudent();
    } catch (e) { showToast(e.message, 'error'); }
    finally { btn.disabled = false; btn.textContent = editId ? 'حفظ التعديلات' : 'تسجيل'; }
  });
}

function renderBehaviorHistory(records) {
  const area = document.getElementById('behaviorHistoryArea');
  if (!records.length) { area.innerHTML = '<p style="color:#888">لا يوجد سجل بعد</p>'; return; }

  const canEdit = ['role_admin', 'role_student_sup'].includes(APP.user.role);
  area.innerHTML = records.map((r) => `
    <div class="behavior-history-row ${r.type === 'positive' ? 'behavior-history-positive' : 'behavior-history-negative'}">
      <div class="behavior-history-badge">${r.type === 'positive' ? '+' : '−'}${r.points}</div>
      <div class="behavior-history-body">
        <div class="behavior-history-desc">${escapeHtml(r.description)}</div>
        <div class="behavior-history-date">${new Date(r.recorded_at).toLocaleString('ar')}</div>
      </div>
      ${canEdit ? `<span data-edit-behavior="${r.id}" data-behavior-type="${r.type}" data-behavior-points="${r.points}" data-behavior-desc="${escapeHtml(r.description)}" style="cursor:pointer;color:var(--primary)">${ICONS.edit()}</span>` : ''}
      ${APP.user.role === 'role_admin' ? `<span data-del-behavior="${r.id}" class="behavior-history-delete">${ICONS.trash()}</span>` : ''}
    </div>`).join('');

  area.querySelectorAll('[data-edit-behavior]').forEach((el) => {
    el.addEventListener('click', () => {
      document.getElementById('behaviorFormCard').style.display = 'block';
      document.getElementById('toggleBehFormBtn').innerHTML = `${ICONS.close()} إغلاق النموذج`;
      document.getElementById('beh_editId').value = el.getAttribute('data-edit-behavior');
      document.getElementById('beh_points').value = el.getAttribute('data-behavior-points');
      document.getElementById('beh_description').value = el.getAttribute('data-behavior-desc');
      const type = el.getAttribute('data-behavior-type');
      document.getElementById('beh_type').value = type;
      document.querySelectorAll('.behavior-type-btn').forEach((b) => b.classList.toggle('active', b.getAttribute('data-behavior-type') === type));
      document.getElementById('beh_addBtn').textContent = 'حفظ التعديلات';
      document.getElementById('behaviorFormCard').scrollIntoView({ behavior: 'smooth' });
    });
  });

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
    <div class="kpi-cards-row">
      <div class="kpi-card">
        <div class="kpi-card-icon" style="background:#E7F5EC;color:#2F7A4D">${ICONS.tasks()}</div>
        <div class="kpi-card-label">متوسط الأداء العام</div>
        <div class="kpi-card-value">${stats.average}<span style="font-size:13px;color:var(--text-muted)"> /100</span></div>
      </div>
      <div class="kpi-card">
        <div class="kpi-card-icon" style="background:var(--accent-purple);color:var(--primary)">${ICONS.users()}</div>
        <div class="kpi-card-label">عدد التقييمات المسجَّلة</div>
        <div class="kpi-card-value">${stats.count}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-card-icon" style="background:#E7F5EC;color:#2F7A4D">${ICONS.plus()}</div>
        <div class="kpi-card-label">أفضل نتيجة</div>
        <div class="kpi-card-value">${stats.topPerformers[0]?.score ?? '—'}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-card-icon" style="background:#FBEAE8;color:#C4483A">${ICONS.close()}</div>
        <div class="kpi-card-label">يحتاجون تحسيناً</div>
        <div class="kpi-card-value">${stats.needsImprovement.length}</div>
      </div>
    </div>
    <div class="card" style="display:flex;align-items:center;gap:24px;flex-wrap:wrap;margin-top:14px">
      ${renderGaugeSVG(stats.average)}
      <div>
        <div style="font-size:12.5px;color:var(--text-muted);font-weight:700">التوزيع العام للأداء</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:4px">مقياس بصري سريع لمتوسط الأداء بهذي الدورة</div>
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
/** 🆕 رسم بياني شريطي أفقي — HTML/CSS بحت (لا SVG) — يتكيّف بشكل صحيح
 * مع أي عرض حاوية بلا أي تشوّه أو تمدّد غير متناسب. كان بصيغة SVG بحجم
 * viewBox ثابت (400 وحدة) مع width:100% — على الشاشات العريضة كان يتمدد
 * كل شيء (الخط والأشرطة معاً) بنسبة ضخمة، فيتحول الشريط لكبسولة عملاقة
 * تقريباً فارغة. هذا التصميم الجديد يبقي حجم الخط ثابتاً دائماً، وفقط
 * عرض الشريط نفسه يتغيّر بنسبة مئوية — النمط الصحيح لأي عرض حاوية. */
function renderBarChartSVG(items, color) {
  if (!items.length) return '<p style="color:#888">لا بيانات كافية بعد</p>';
  const maxVal = Math.max(1, ...items.map((i) => i.value));

  return `
    <div class="hbar-chart">
      ${items.map((item) => {
        const pct = Math.max(3, (item.value / maxVal) * 100);
        const label = item.label.length > 26 ? item.label.slice(0, 26) + '…' : item.label;
        return `
          <div class="hbar-row">
            <span class="hbar-label" title="${escapeHtml(item.label)}">${escapeHtml(label)}</span>
            <div class="hbar-track"><div class="hbar-fill" style="width:${pct}%;background:${color}"></div></div>
            <span class="hbar-value" style="color:${color}">${item.value}</span>
          </div>`;
      }).join('')}
    </div>`;
}

/** 🆕 مقياس دائري بسيط (Gauge) — للمتوسط العام. أُضيفت نسبة نصّية بمنتصف
 * الحلقة (كانت تظهر كحلقة فارغة بلا رقم، فتبدو "غير مكتملة" بصرياً) */
function renderGaugeSVG(value) {
  const pct = Math.max(0, Math.min(100, value)) / 100;
  const radius = 50, circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct);
  const color = value >= 85 ? '#2F7A4D' : value >= 65 ? '#B8860B' : '#C4483A';
  return `
    <svg width="130" height="130" viewBox="0 0 130 130" style="flex-shrink:0">
      <circle cx="65" cy="65" r="${radius}" fill="none" stroke="#EDEDEA" stroke-width="12"></circle>
      <circle cx="65" cy="65" r="${radius}" fill="none" stroke="${color}" stroke-width="12" stroke-linecap="round"
        stroke-dasharray="${circumference}" stroke-dashoffset="${offset}" transform="rotate(-90 65 65)"></circle>
      <text x="65" y="72" text-anchor="middle" font-size="26" font-weight="800" fill="${color}" font-family="Manrope, sans-serif">${Math.round(value)}</text>
    </svg>`;
}

/** 🆕 رسم دائري (Donut) بسيط لتوزيع نسب — لتحليل الحضور/الحالات بالتقارير الاحترافية */
function renderDonutChartSVG(segments) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (!total) return '<p style="color:#888">لا بيانات كافية بعد</p>';
  const radius = 60, circumference = 2 * Math.PI * radius;
  let cursor = 0;
  const arcs = segments.map((seg) => {
    const fraction = seg.value / total;
    const dash = fraction * circumference;
    const arc = `<circle cx="80" cy="80" r="${radius}" fill="none" stroke="${seg.color}" stroke-width="22"
      stroke-dasharray="${dash} ${circumference - dash}" stroke-dashoffset="${-cursor}" transform="rotate(-90 80 80)"></circle>`;
    cursor += dash;
    return arc;
  }).join('');

  return `
    <div style="display:flex;align-items:center;gap:20px;flex-wrap:wrap">
      <svg width="160" height="160" viewBox="0 0 160 160">${arcs}</svg>
      <div style="display:flex;flex-direction:column;gap:6px">
        ${segments.map((seg) => `
          <div style="display:flex;align-items:center;gap:8px;font-size:12.5px">
            <span style="width:10px;height:10px;border-radius:999px;background:${seg.color};display:inline-block"></span>
            ${escapeHtml(seg.label)}: <strong>${seg.value}</strong> (${Math.round((seg.value / total) * 100)}%)
          </div>`).join('')}
      </div>
    </div>`;
}

/* ===================== 🆕 قشرة التقرير الاحترافي (Preview + PDF + مشاركة) ===================== */
// تُستخدَم من كل صفحات التقارير (صفحة التقارير، أداء الطلاب، مستقبلاً
// أداء الموظفين) — رأس موحَّد (شعار المنصة/المدرسة + الفرع + مُعِد
// التقرير + التاريخ)، علامة مائية رادعة (بلا ادّعاء منع لقطة شاشة
// حقيقي — هذا غير ممكن تقنياً على الويب لأي موقع بالعالم)، وأزرار
// تحميل PDF/مشاركة/طباعة تُصدِر الصفحة **كما هي بالضبط** (نفس جودة
// العرض الأولي) عبر html2pdf.js (تصوير DOM فعلي، لا إعادة صياغة).

async function showProfessionalReportShell({ title, branchLabel, contentHtml }) {
  const settings = await getSettingsOnce();
  const schoolName = settings.schoolName || 'مِرقاة';
  const logoHtml = settings.logoUrl
    ? `<img src="${escapeHtml(settings.logoUrl)}" style="height:44px;max-width:160px;object-fit:contain">`
    : mirqatLogo(36);
  const now = new Date();
  const dateStr = now.toLocaleString('ar-SA-u-ca-gregory');
  const preparerName = APP.user.fullName;
  const preparerRole = ROLE_LABELS_AR[APP.user.role] || APP.user.role;

  document.getElementById('reportShellOverlay')?.remove();
  const overlay = document.createElement('div');
  overlay.className = 'report-shell-overlay';
  overlay.id = 'reportShellOverlay';
  overlay.oncontextmenu = () => false; // 🆕 إجراء رادع بسيط (ليس منعاً حقيقياً)
  overlay.innerHTML = `
    <div class="report-shell-toolbar">
      <button type="button" id="reportCloseBtn" class="btn-outline-sm">${ICONS.close()} إغلاق</button>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button type="button" id="reportPrintBtn" class="btn-outline-sm">طباعة</button>
        <button type="button" id="reportShareBtn" class="btn-outline-sm">مشاركة</button>
        <button type="button" id="reportDownloadBtn">${ICONS.plus()} تحميل PDF</button>
      </div>
    </div>
    <div class="report-shell-scroll">
      <div class="report-shell-page" id="reportShellPage">
        <div class="report-watermark">${escapeHtml(preparerName)} — ${dateStr}</div>
        <div class="report-shell-header">
          <div class="report-shell-header-brand">
            ${logoHtml}
            <div>
              <div class="report-shell-platform-name">${escapeHtml(schoolName)}</div>
              <div class="report-shell-sub">تقرير رسمي صادر عن نظام إدارة المدرسة</div>
            </div>
          </div>
          <div class="report-shell-meta">
            <div><strong>الفرع:</strong> ${escapeHtml(branchLabel || 'كل الفروع')}</div>
            <div><strong>مُعِد التقرير:</strong> ${escapeHtml(preparerName)} — ${escapeHtml(preparerRole)}</div>
            <div><strong>تاريخ الإصدار:</strong> ${dateStr}</div>
          </div>
        </div>
        <h2 class="report-shell-title">${escapeHtml(title)}</h2>
        <div class="report-shell-body">${contentHtml}</div>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  document.getElementById('reportCloseBtn').addEventListener('click', () => overlay.remove());
  document.getElementById('reportPrintBtn').addEventListener('click', () => window.print());
  document.getElementById('reportDownloadBtn').addEventListener('click', () => downloadReportAsPdf(title));
  document.getElementById('reportShareBtn').addEventListener('click', () => shareReportPdf(title));
}

function buildReportPdfWorker_(filename) {
  const page = document.getElementById('reportShellPage');
  return window.html2pdf().set({
    margin: 8,
    filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
  }).from(page);
}

async function downloadReportAsPdf(title) {
  const btn = document.getElementById('reportDownloadBtn');
  if (typeof window.html2pdf !== 'function') { showToast('مكتبة PDF لم تُحمَّل بعد — تحقّق من الاتصال بالإنترنت وحاول مجدداً', 'error'); return; }
  btn.disabled = true; btn.textContent = 'جارِ التجهيز...';
  try {
    await buildReportPdfWorker_(`${title}.pdf`).save();
  } catch (e) { showToast('تعذّر توليد PDF', 'error'); }
  finally { btn.disabled = false; btn.innerHTML = `${ICONS.plus()} تحميل PDF`; }
}

async function shareReportPdf(title) {
  const btn = document.getElementById('reportShareBtn');
  if (typeof window.html2pdf !== 'function') { showToast('مكتبة PDF لم تُحمَّل بعد — تحقّق من الاتصال بالإنترنت وحاول مجدداً', 'error'); return; }
  btn.disabled = true; btn.textContent = 'جارِ التجهيز...';
  try {
    const pdfBlob = await buildReportPdfWorker_(`${title}.pdf`).outputPdf('blob');
    const file = new File([pdfBlob], `${title}.pdf`, { type: 'application/pdf' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title }); // 🆕 يفتح قائمة مشاركة الجهاز الفعلية (واتساب/تلغرام/غيره) — تدعمها أغلب المتصفحات بالجوال
    } else {
      showToast('مشاركة الملف مباشرة غير مدعومة بهذا المتصفح — استخدم زر "تحميل PDF" ثم أرفقه يدوياً بالتطبيق', 'error');
    }
  } catch (e) {
    if (e.name !== 'AbortError') showToast('تعذّرت المشاركة', 'error');
  } finally { btn.disabled = false; btn.textContent = 'مشاركة'; }
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
      <div class="field"><label>تاريخ البداية</label><input type="date" dir="ltr" id="cyc_start"></div>
      <div class="field"><label>تاريخ النهاية</label><input type="date" dir="ltr" id="cyc_end"></div>
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

/* ===================== صفحة التقارير الموحَّدة ===================== */

const REPORT_DOMAIN_LABELS_ = { performance: 'تقييم الأداء', behavior: 'سلوك الطلاب', studentAttendance: 'تحضير الطلاب', staffAttendance: 'تحضير الموظفين' };
const REPORT_DOMAINS_BY_ROLE_FE_ = {
  role_admin: ['performance', 'behavior', 'studentAttendance', 'staffAttendance'],
  role_branch_monitor: ['performance', 'staffAttendance'],
  role_teacher_sup: ['performance', 'staffAttendance'],
  role_student_sup: ['behavior', 'studentAttendance'],
};
let reportSelectedPersonIds = [];

async function renderReportsView() {
  const main = document.getElementById('mainContent');
  main.innerHTML = `<div class="card"><div class="skel-rows"><div class="skel-row"></div></div></div>`;
  const settings = await getSettingsOnce();
  const role = APP.user.role;
  const allowedDomains = REPORT_DOMAINS_BY_ROLE_FE_[role] || [];
  reportSelectedPersonIds = [];

  if (!allowedDomains.length) { main.innerHTML = '<div class="card"><p style="color:#888">لا تملك صلاحية إنشاء تقارير</p></div>'; return; }

  const branchLocked = role === 'role_teacher_sup' || role === 'role_student_sup';
  const branchOptions = role === 'role_admin' ? settings.branches : (role === 'role_branch_monitor' ? (APP.user.allBranches || [APP.user.branch]) : [APP.user.branch]);

  main.innerHTML = `
    <div class="card">
      <h2>إنشاء تقرير جديد</h2>
      <div class="field"><label>نوع التقرير</label><select id="rep_domain">${allowedDomains.map((d) => `<option value="${d}">${escapeHtml(REPORT_DOMAIN_LABELS_[d])}</option>`).join('')}</select></div>

      <div class="filter-card-title">${branchLocked ? 'الفرع (مقيَّد بفرعك)' : 'الفرع/الفروع (اتركه فارغاً = كل الفروع المتاحة لك)'}</div>
      <div class="checkbox-list" id="rep_branchesBox">${scopeCheckboxesHtml(branchOptions, branchLocked ? branchOptions : [], 'rep-branch-cb')}</div>

      <div id="rep_studentFiltersBox" style="display:none">
        <div class="filter-card-title">الصفوف (اختياري)</div>
        <div class="checkbox-list" id="rep_gradesBox">${scopeCheckboxesHtml(settings.grades, [], 'rep-grade-cb')}</div>
        <div class="filter-card-title">الشعب (اختياري)</div>
        <div class="checkbox-list" id="rep_sectionsBox">${scopeCheckboxesHtml(settings.sections, [], 'rep-section-cb')}</div>
      </div>

      <div id="rep_cycleBox" style="display:none">
        <div class="field"><label>دورة التقييم</label><select id="rep_cycle"></select></div>
      </div>

      <div class="filter-card-title">أشخاص محدَّدون (اختياري — اتركه فارغاً لتقرير عن المجموعة كاملة)</div>
      <div class="student-search-input-wrap"><input type="text" id="rep_personSearch" placeholder="ابحث بالاسم لإضافة فرد..."></div>
      <div id="rep_personResults" class="student-search-results"></div>
      <div id="rep_selectedPersons" class="student-chip-list" style="margin-top:8px"><span class="student-linker-empty">لا يوجد أفراد محدَّدون</span></div>

      <button type="button" id="rep_generateBtn" style="margin-top:14px;width:100%">إنشاء التقرير</button>
    </div>
    <div id="reportResultArea"></div>`;

  if (branchLocked) document.querySelectorAll('.rep-branch-cb').forEach((cb) => { cb.disabled = true; });

  document.getElementById('rep_domain').addEventListener('change', updateReportFormFields);
  updateReportFormFields();

  document.getElementById('rep_personSearch').addEventListener('input', async (e) => {
    const q = e.target.value.trim().toLowerCase();
    const box = document.getElementById('rep_personResults');
    if (q.length < 2) { box.innerHTML = ''; box.classList.remove('show'); return; }
    const domain = document.getElementById('rep_domain').value;
    const isStudentDomain = ['behavior', 'studentAttendance'].includes(domain);
    let pool;
    if (isStudentDomain) {
      if (!APP.allStudents || !APP.allStudents.length) APP.allStudents = await apiCall('students', { method: 'POST', body: { action: 'list' } });
      pool = APP.allStudents;
    } else {
      if (!APP.allEmployees || !APP.allEmployees.length) APP.allEmployees = await apiCall('employees', { method: 'POST', body: { action: 'list' } });
      pool = APP.allEmployees;
    }
    const matches = pool.filter((p) => p.name_ar.toLowerCase().includes(q) && !reportSelectedPersonIds.includes(p.id)).slice(0, 6);
    box.classList.add('show');
    box.innerHTML = matches.map((p) => `<div class="search-result-item" data-pick-person="${escapeHtml(p.id)}" data-pick-name="${escapeHtml(p.name_ar)}"><div class="search-result-label">${escapeHtml(p.name_ar)}</div></div>`).join('') || '<p style="padding:10px;color:#aaa;font-size:12px">لا نتائج</p>';
    box.querySelectorAll('[data-pick-person]').forEach((el) => {
      el.addEventListener('click', () => {
        reportSelectedPersonIds.push(el.getAttribute('data-pick-person'));
        renderSelectedReportPersons(el.getAttribute('data-pick-name'));
        box.innerHTML = ''; box.classList.remove('show');
        document.getElementById('rep_personSearch').value = '';
      });
    });
  });

  document.getElementById('rep_generateBtn').addEventListener('click', generateReportHandler);
}

function renderSelectedReportPersons(justAddedName) {
  const box = document.getElementById('rep_selectedPersons');
  if (!reportSelectedPersonIds.length) { box.innerHTML = '<span class="student-linker-empty">لا يوجد أفراد محدَّدون</span>'; return; }
  const existing = box.querySelector('.student-linker-empty') ? [] : Array.from(box.querySelectorAll('.student-chip')).map((c) => c.getAttribute('data-name'));
  if (justAddedName) existing.push(justAddedName);
  box.innerHTML = reportSelectedPersonIds.map((id, i) => `<span class="student-chip" data-name="${escapeHtml(existing[i] || id)}">${escapeHtml(existing[i] || id)}<span data-remove-person="${i}" class="student-chip-remove">${ICONS.close()}</span></span>`).join('');
  box.querySelectorAll('[data-remove-person]').forEach((el) => {
    el.addEventListener('click', () => { reportSelectedPersonIds.splice(Number(el.getAttribute('data-remove-person')), 1); renderSelectedReportPersons(); });
  });
}

function updateReportFormFields() {
  const domain = document.getElementById('rep_domain').value;
  document.getElementById('rep_studentFiltersBox').style.display = ['behavior', 'studentAttendance'].includes(domain) ? 'block' : 'none';
  document.getElementById('rep_cycleBox').style.display = domain === 'performance' ? 'block' : 'none';
  if (domain === 'performance') loadCyclesForReport();
}

async function loadCyclesForReport() {
  const cycles = await apiCall('performance', { method: 'POST', body: { action: 'listCycles' } });
  document.getElementById('rep_cycle').innerHTML = cycles.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
}

async function generateReportHandler() {
  const domain = document.getElementById('rep_domain').value;
  const branches = collectCheckedValues('.rep-branch-cb');
  const grades = collectCheckedValues('.rep-grade-cb');
  const sections = collectCheckedValues('.rep-section-cb');
  const cycleId = domain === 'performance' ? document.getElementById('rep_cycle').value : undefined;

  const area = document.getElementById('reportResultArea');
  area.innerHTML = `<div class="card"><div class="skel-rows"><div class="skel-row"></div></div></div>`;
  try {
    const result = await apiCall('performance', {
      method: 'POST',
      body: { action: 'generateReport', domain, branches, grades, sections, personIds: reportSelectedPersonIds, cycleId },
    });
    renderReportResult(result, domain);
  } catch (e) { area.innerHTML = `<div class="card"><p style="color:#c62828">${escapeHtml(e.message)}</p></div>`; }
}

function renderReportResult(result, domain) {
  const area = document.getElementById('reportResultArea');
  const branchesUsed = collectCheckedValues('.rep-branch-cb');
  const branchLabel = branchesUsed.length ? branchesUsed.join('، ') : 'كل الفروع المتاحة';

  area.innerHTML = `
    <div class="card">
      <p style="color:#888;font-size:12.5px;margin:0 0 12px">تم إنشاء التقرير بنجاح — اضغط الزر لعرضه بشكل احترافي جاهز للطباعة والمشاركة</p>
      <button type="button" id="openReportShellBtn" style="width:100%">${ICONS.plus()} عرض التقرير الاحترافي</button>
    </div>
    <div class="card" style="margin-top:14px">
      ${renderGaugeSVG(result.average)}
      <div style="margin-top:10px">
        <div style="font-size:12.5px;color:var(--text-muted);font-weight:700">المتوسط العام</div>
        <div style="font-size:28px;font-weight:800;color:var(--primary)">${result.average}<span style="font-size:14px;color:var(--text-muted)"> ${escapeHtml(result.unit)}</span></div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:4px">${result.count} سجلاً</div>
      </div>
    </div>`;

  document.getElementById('openReportShellBtn').addEventListener('click', () => {
    const contentHtml = `
      <div class="report-stats-row">
        <div class="report-stat-box">${renderGaugeSVG(result.average)}<div style="margin-top:8px;font-weight:800;font-size:15px">${result.average} ${escapeHtml(result.unit)}</div><div style="font-size:11.5px;color:var(--text-muted)">المتوسط العام</div></div>
        <div class="report-stat-box"><div style="font-size:32px;font-weight:800;color:var(--primary)">${result.count}</div><div style="font-size:11.5px;color:var(--text-muted)">إجمالي السجلات</div></div>
      </div>
      <h3 style="margin-top:24px">التفاصيل الكاملة (ترتيب تنازلي)</h3>
      ${renderBarChartSVG([...result.rows].sort((a, b) => b.score - a.score).map((r) => ({ label: r.name || '—', value: r.score })), '#7B5FB8')}`;

    showProfessionalReportShell({ title: REPORT_DOMAIN_LABELS_[domain], branchLabel, contentHtml });
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

  // 🆕 5) أولياء الأمور — نفس نمط فحص الصلاحية قبل الجلب
  if (pagesForCurrentUser().includes('parents')) {
    try {
      if (!APP.allParents || !APP.allParents.length) {
        APP.allParents = await apiCall('parents', { method: 'POST', body: { action: 'list' } });
      }
      APP.allParents.filter((p) => p.name_ar.toLowerCase().includes(q)).slice(0, 5).forEach((p) => {
        results.push({
          group: 'أولياء الأمور', label: p.name_ar, sublabel: p.phone || '',
          action: () => { navigate('parents'); },
        });
      });
    } catch (err) { /* تجاهل بصمت */ }
  }

  // 🆕 6) التكاليف والمهام والاختبارات — بعنوانها، بنفس نطاق صلاحية المستخدم (الخادم يفلتر أصلاً)
  if (pagesForCurrentUser().includes('assignments')) {
    try {
      if (!APP.allAssignmentsForSearch || !APP.allAssignmentsForSearch.length) {
        APP.allAssignmentsForSearch = await apiCall('academic-config', { method: 'POST', body: { action: 'listAssignments' } });
      }
      APP.allAssignmentsForSearch.filter((a) => a.title.toLowerCase().includes(q)).slice(0, 5).forEach((a) => {
        results.push({
          group: 'التكاليف والمهام', label: a.title, sublabel: `${a.grade} — ${a.section}`,
          action: () => { navigate('assignments'); },
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

/* ===================== 🆕 صفحة التقويم الدراسي (عرض فقط للجميع) ===================== */
// تصميم شبكة تقويم احترافي بـ3 طرق عرض (شهري/أسبوعي/الفصل الدراسي
// كامل) — بلا أي أدوات إدارة إطلاقاً (لا للأدمن ولا لغيره). الإدارة
// الكاملة تعيش حصراً داخل "الإعدادات ← التقويم الدراسي" (أدمن فقط).

const WEEK_TYPE_META = {
  'دراسي':        { badgeClass: 'week-type-study' },
  'إجازة':         { badgeClass: 'week-type-holiday' },
  'اختبار شهري':  { badgeClass: 'week-type-monthly' },
  'اختبار نهائي': { badgeClass: 'week-type-final' },
};

/** يحوّل Date لنص YYYY-MM-DD بالتوقيت المحلي (بلا أي تحويل UTC قد يزحزح اليوم) */
function toISODateLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** يحوّل نص YYYY-MM-DD لكائن Date بالتوقيت المحلي (بلا فخ تفسير UTC لنصوص ISO) */
function parseISODateLocal(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDateAr(dateStr) {
  if (!dateStr) return '—';
  try {
    return parseISODateLocal(dateStr).toLocaleDateString('ar-SA-u-ca-gregory', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch (e) { return dateStr; }
}

let calendarViewDate = new Date(); // 🆕 المرساة الزمنية للعرض الشهري/الأسبوعي
let calendarViewMode = 'month';    // 🆕 'month' | 'week' | 'term'
let calendarSelectedTermId = null; // 🆕 الفصل المختار بعرض "الفصل الدراسي كامل"

/** 🆕 يبني خارطتي تاريخ→أسبوع وتاريخ→إجازة لعرض سريع O(1) لكل يوم —
 * الإجازة تُعرَض دائماً بالأولوية فوق الأسبوع لنفس اليوم (تراكب مقصود) */
function buildCalendarDateMaps() {
  const weekMap = {};
  const holidayMap = {};
  const termsById = {};
  (APP.calendarTerms || []).forEach((t) => { termsById[t.id] = t; });

  (APP.calendarWeeks || []).forEach((w) => {
    let cursor = parseISODateLocal(w.start_date);
    const end = parseISODateLocal(w.end_date);
    while (cursor <= end) {
      weekMap[toISODateLocal(cursor)] = { ...w, termName: termsById[w.term_id]?.name || '' };
      cursor.setDate(cursor.getDate() + 1);
    }
  });
  (APP.calendarHolidays || []).forEach((h) => {
    let cursor = parseISODateLocal(h.start_date);
    const end = parseISODateLocal(h.end_date);
    while (cursor <= end) {
      holidayMap[toISODateLocal(cursor)] = { ...h, termName: termsById[h.term_id]?.name || '' };
      cursor.setDate(cursor.getDate() + 1);
    }
  });
  return { weekMap, holidayMap, termsById };
}

async function renderAcademicCalendarView() {
  const main = document.getElementById('mainContent');
  main.innerHTML = `<div class="card"><div class="skel-rows"><div class="skel-row"></div><div class="skel-row"></div></div></div>`;

  let calData;
  try {
    calData = await apiCall('academic-config', { method: 'POST', body: { action: 'listCalendarData' } });
  } catch (e) {
    main.innerHTML = `<div class="card"><p style="color:#c62828">${escapeHtml(e.message)}</p></div>`;
    return;
  }

  APP.calendarTerms = calData.terms || [];
  APP.calendarWeeks = calData.weeks || [];
  APP.calendarHolidays = calData.holidays || []; // 🆕

  const visibleNames = APP.calendarTerms.map((t) => t.name).join('، ');

  main.innerHTML = `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;flex-wrap:wrap;gap:10px">
        <div>
          <h2 style="margin:0">التقويم الدراسي</h2>
          <p style="color:#888;font-size:12px;margin:4px 0 0">${visibleNames ? `الفصول الظاهرة حالياً: ${escapeHtml(visibleNames)}` : 'لا يوجد فصل دراسي ظاهر حالياً'}</p>
        </div>
        <div class="segmented-control" id="calModeTabBar">
          <button type="button" class="segmented-item ${calendarViewMode === 'month' ? 'active' : ''}" data-cal-mode="month">شهري</button>
          <button type="button" class="segmented-item ${calendarViewMode === 'week' ? 'active' : ''}" data-cal-mode="week">أسبوعي</button>
          <button type="button" class="segmented-item ${calendarViewMode === 'term' ? 'active' : ''}" data-cal-mode="term">الفصل الدراسي كامل</button>
        </div>
      </div>
      <div id="calendarContentArea" style="margin-top:14px"></div>
    </div>`;

  document.querySelectorAll('#calModeTabBar .segmented-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      calendarViewMode = btn.getAttribute('data-cal-mode');
      document.querySelectorAll('#calModeTabBar .segmented-item').forEach((b) => b.classList.toggle('active', b === btn));
      renderCalendarByMode();
    });
  });

  renderCalendarByMode();
}

function renderCalendarByMode() {
  const container = document.getElementById('calendarContentArea');
  if (!container) return;
  if (calendarViewMode === 'week') { renderCalendarWeekView(container); return; }
  if (calendarViewMode === 'term') { renderCalendarTermView(container); return; }
  renderCalendarMonthView(container);
}

/* -------------------- عرض شهري -------------------- */

function renderCalendarMonthView(container) {
  container.innerHTML = `
    <div class="calendar-toolbar">
      <div class="calendar-toolbar-nav">
        <button type="button" class="calendar-nav-btn" id="calPrevBtn" style="transform:rotate(90deg)" title="الشهر السابق">${ICONS.chevronDown()}</button>
        <span id="calMonthLabel" class="calendar-month-label"></span>
        <button type="button" class="calendar-nav-btn" id="calNextBtn" style="transform:rotate(-90deg)" title="الشهر التالي">${ICONS.chevronDown()}</button>
      </div>
      <button type="button" id="calTodayBtn" class="btn-outline-sm">اليوم</button>
    </div>
    <div id="calendarGridArea"></div>
    <div class="calendar-legend">
      ${Object.entries(WEEK_TYPE_META).map(([type, meta]) => `<span class="calendar-legend-item"><span class="calendar-legend-dot ${meta.badgeClass}"></span>${escapeHtml(type)}</span>`).join('')}
    </div>`;

  document.getElementById('calPrevBtn').addEventListener('click', () => { calendarViewDate = new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() - 1, 1); renderCalendarMonthGrid(); });
  document.getElementById('calNextBtn').addEventListener('click', () => { calendarViewDate = new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() + 1, 1); renderCalendarMonthGrid(); });
  document.getElementById('calTodayBtn').addEventListener('click', () => { calendarViewDate = new Date(); renderCalendarMonthGrid(); });

  renderCalendarMonthGrid();
}

function renderCalendarMonthGrid() {
  const area = document.getElementById('calendarGridArea');
  if (!area) return;

  const year = calendarViewDate.getFullYear();
  const monthIndex = calendarViewDate.getMonth();
  document.getElementById('calMonthLabel').textContent = calendarViewDate.toLocaleDateString('ar-SA-u-ca-gregory', { month: 'long', year: 'numeric' });

  const { weekMap, holidayMap } = buildCalendarDateMaps();
  const firstOfMonth = new Date(year, monthIndex, 1);
  const startWeekday = firstOfMonth.getDay(); // 0=الأحد
  const daysInThisMonth = new Date(year, monthIndex + 1, 0).getDate();
  const totalCells = Math.ceil((startWeekday + daysInThisMonth) / 7) * 7;
  const todayStr = toISODateLocal(new Date());
  const dayHeaders = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

  let cellsHtml = '';
  for (let i = 0; i < totalCells; i++) {
    const cellDate = new Date(year, monthIndex, 1 - startWeekday + i);
    const dateStr = toISODateLocal(cellDate);
    const isCurrentMonth = cellDate.getMonth() === monthIndex;
    const isToday = dateStr === todayStr;
    // 🆕 الإجازة تعلو الأسبوع بنفس اليوم (تراكب مقصود) — ومظهرها "مبهر" بلمحة بصر
    const holidayInfo = holidayMap[dateStr];
    const weekInfo = weekMap[dateStr];
    const chipInfo = holidayInfo
      ? { label: `🌴 ${holidayInfo.label}`, chipClass: 'calendar-chip-holiday', cellClass: 'calendar-cell-holiday' }
      : (weekInfo ? { label: weekInfo.label || weekInfo.week_type, chipClass: WEEK_TYPE_META[weekInfo.week_type]?.badgeClass || 'week-type-study', cellClass: '' } : null);

    cellsHtml += `
      <div class="calendar-cell ${isCurrentMonth ? '' : 'calendar-cell-outside'} ${isToday ? 'calendar-cell-today' : ''} ${chipInfo ? chipInfo.cellClass : ''}" ${chipInfo ? `data-cal-day="${dateStr}"` : ''}>
        <span class="calendar-cell-daynum">${cellDate.getDate()}</span>
        ${chipInfo ? `<span class="calendar-event-chip ${chipInfo.chipClass}">${escapeHtml(chipInfo.label)}</span>` : ''}
      </div>`;
  }

  area.innerHTML = `<div class="calendar-grid">${dayHeaders.map((d) => `<div class="calendar-day-header">${d}</div>`).join('')}${cellsHtml}</div>`;

  area.querySelectorAll('[data-cal-day]').forEach((cell) => {
    cell.addEventListener('click', () => showCalendarDayDetail(cell.getAttribute('data-cal-day'), weekMap, holidayMap));
  });
}

function showCalendarDayDetail(dateStr, weekMap, holidayMap) {
  const holidayInfo = holidayMap[dateStr];
  const weekInfo = weekMap[dateStr];
  if (holidayInfo) {
    showDetailModal('إجازة', holidayInfo.termName, [
      { label: 'اسم الإجازة', value: holidayInfo.label },
      { label: 'من', value: formatDateAr(holidayInfo.start_date) },
      { label: 'إلى', value: formatDateAr(holidayInfo.end_date) },
    ]);
    return;
  }
  if (weekInfo) {
    showDetailModal(`الأسبوع ${weekInfo.week_number} — ${weekInfo.week_type}`, weekInfo.termName, [
      { label: 'التسمية', value: weekInfo.label },
      { label: 'النوع', value: weekInfo.week_type },
      { label: 'من', value: formatDateAr(weekInfo.start_date) },
      { label: 'إلى', value: formatDateAr(weekInfo.end_date) },
    ]);
  }
}

/* -------------------- عرض أسبوعي -------------------- */

function renderCalendarWeekView(container) {
  container.innerHTML = `
    <div class="calendar-toolbar">
      <div class="calendar-toolbar-nav">
        <button type="button" class="calendar-nav-btn" id="calWeekPrevBtn" style="transform:rotate(90deg)" title="الأسبوع السابق">${ICONS.chevronDown()}</button>
        <span id="calWeekLabel" class="calendar-month-label"></span>
        <button type="button" class="calendar-nav-btn" id="calWeekNextBtn" style="transform:rotate(-90deg)" title="الأسبوع التالي">${ICONS.chevronDown()}</button>
      </div>
      <button type="button" id="calWeekTodayBtn" class="btn-outline-sm">هذا الأسبوع</button>
    </div>
    <div id="calendarWeekArea"></div>
    <div class="calendar-legend">
      ${Object.entries(WEEK_TYPE_META).map(([type, meta]) => `<span class="calendar-legend-item"><span class="calendar-legend-dot ${meta.badgeClass}"></span>${escapeHtml(type)}</span>`).join('')}
    </div>`;

  document.getElementById('calWeekPrevBtn').addEventListener('click', () => { calendarViewDate = new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth(), calendarViewDate.getDate() - 7); renderCalendarWeekGrid(); });
  document.getElementById('calWeekNextBtn').addEventListener('click', () => { calendarViewDate = new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth(), calendarViewDate.getDate() + 7); renderCalendarWeekGrid(); });
  document.getElementById('calWeekTodayBtn').addEventListener('click', () => { calendarViewDate = new Date(); renderCalendarWeekGrid(); });

  renderCalendarWeekGrid();
}

function renderCalendarWeekGrid() {
  const area = document.getElementById('calendarWeekArea');
  if (!area) return;

  const { weekMap, holidayMap } = buildCalendarDateMaps();
  const startOfWeek = new Date(calendarViewDate);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay()); // يرجع لآخر أحد
  const todayStr = toISODateLocal(new Date());
  const dayHeaders = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

  document.getElementById('calWeekLabel').textContent = `${formatDateAr(toISODateLocal(startOfWeek))} ← ${formatDateAr(toISODateLocal(new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate() + 6)))}`;

  let cellsHtml = '';
  for (let i = 0; i < 7; i++) {
    const cellDate = new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate() + i);
    const dateStr = toISODateLocal(cellDate);
    const isToday = dateStr === todayStr;
    const holidayInfo = holidayMap[dateStr];
    const weekInfo = weekMap[dateStr];
    const chipInfo = holidayInfo
      ? { label: `🌴 ${holidayInfo.label}`, chipClass: 'calendar-chip-holiday', cellClass: 'calendar-cell-holiday' }
      : (weekInfo ? { label: weekInfo.label || weekInfo.week_type, chipClass: WEEK_TYPE_META[weekInfo.week_type]?.badgeClass || 'week-type-study', cellClass: '' } : null);

    cellsHtml += `
      <div class="calendar-cell calendar-week-cell ${isToday ? 'calendar-cell-today' : ''} ${chipInfo ? chipInfo.cellClass : ''}" ${chipInfo ? `data-cal-day="${dateStr}"` : ''}>
        <span class="calendar-cell-daynum">${cellDate.getDate()}</span>
        ${chipInfo ? `<span class="calendar-event-chip ${chipInfo.chipClass}">${escapeHtml(chipInfo.label)}</span>` : '<span style="color:#bbb;font-size:11px">لا يوجد</span>'}
      </div>`;
  }

  area.innerHTML = `<div class="calendar-grid">${dayHeaders.map((d) => `<div class="calendar-day-header">${d}</div>`).join('')}${cellsHtml}</div>`;

  area.querySelectorAll('[data-cal-day]').forEach((cell) => {
    cell.addEventListener('click', () => showCalendarDayDetail(cell.getAttribute('data-cal-day'), weekMap, holidayMap));
  });
}

/* -------------------- عرض الفصل الدراسي كامل -------------------- */

function renderCalendarTermView(container) {
  const terms = APP.calendarTerms || [];
  if (!terms.length) { container.innerHTML = '<p style="color:#888">لا يوجد فصل دراسي ظاهر حالياً</p>'; return; }
  if (!calendarSelectedTermId || !terms.some((t) => String(t.id) === String(calendarSelectedTermId))) {
    calendarSelectedTermId = terms[0].id;
  }

  container.innerHTML = `
    ${terms.length > 1 ? `
      <div class="field" style="max-width:340px">
        <label>اختر الفصل الدراسي</label>
        <select id="calTermSelect">
          ${terms.map((t) => `<option value="${t.id}" ${String(t.id) === String(calendarSelectedTermId) ? 'selected' : ''}>${escapeHtml(t.name)} — ${escapeHtml(t.academic_year)}</option>`).join('')}
        </select>
      </div>` : ''}
    <div id="calendarTermTimelineArea" style="margin-top:14px"></div>`;

  if (terms.length > 1) {
    document.getElementById('calTermSelect').addEventListener('change', (e) => { calendarSelectedTermId = e.target.value; renderCalendarTermTimeline(); });
  }
  renderCalendarTermTimeline();
}

function renderCalendarTermTimeline() {
  const area = document.getElementById('calendarTermTimelineArea');
  const term = (APP.calendarTerms || []).find((t) => String(t.id) === String(calendarSelectedTermId));
  if (!term) { area.innerHTML = ''; return; }

  const termWeeks = (APP.calendarWeeks || []).filter((w) => String(w.term_id) === String(term.id))
    .map((w) => ({ ...w, _kind: 'week' }));
  const termHolidays = (APP.calendarHolidays || []).filter((h) => String(h.term_id) === String(term.id))
    .map((h) => ({ ...h, _kind: 'holiday' }));

  const timeline = [...termWeeks, ...termHolidays].sort((a, b) => (a.start_date || '').localeCompare(b.start_date || ''));

  if (!timeline.length) {
    area.innerHTML = `<p style="color:#888">لا توجد أسابيع أو إجازات مضافة لهذا الفصل بعد</p>`;
    return;
  }

  area.innerHTML = `
    <div class="card" style="margin-bottom:14px">
      <div style="font-weight:800;font-size:15px">${escapeHtml(term.name)} <span style="font-weight:600;font-size:12px;color:#888">— الفصل ${term.term_number === 1 ? 'الأول' : 'الثاني'} — ${escapeHtml(term.academic_year)}</span></div>
      <div style="font-size:12px;color:var(--text-muted);margin-top:4px">${formatDateAr(term.start_date)} ← ${formatDateAr(term.end_date)}</div>
    </div>
    <div style="display:flex;flex-direction:column;gap:6px">
      ${timeline.map((item) => {
        if (item._kind === 'holiday') {
          return `
            <div class="person-card-row" style="padding:10px 12px;background:var(--surface);border-radius:8px">
              <div style="display:flex;align-items:center;gap:8px">
                <span class="week-type-badge week-type-holiday">إجازة</span>
                <span style="font-size:12.5px;font-weight:700">${escapeHtml(item.label)}</span>
              </div>
              <span style="font-size:11.5px;color:var(--text-muted)">${formatDateAr(item.start_date)} ← ${formatDateAr(item.end_date)}</span>
            </div>`;
        }
        const meta = WEEK_TYPE_META[item.week_type] || WEEK_TYPE_META['دراسي'];
        return `
          <div class="person-card-row" style="padding:10px 12px;background:var(--surface);border-radius:8px">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
              <span style="font-weight:700;font-size:12.5px">الأسبوع ${item.week_number}</span>
              <span class="week-type-badge ${meta.badgeClass}">${escapeHtml(item.week_type)}</span>
              <span style="font-size:12px;color:var(--text-muted)">${escapeHtml(item.label || '')}</span>
            </div>
            <span style="font-size:11.5px;color:var(--text-muted)">${formatDateAr(item.start_date)} ← ${formatDateAr(item.end_date)}</span>
          </div>`;
      }).join('')}
    </div>`;
}

/* ===================== 🆕 إدارة التقويم الدراسي (داخل الإعدادات — أدمن فقط) ===================== */
// نفس فلسفة بقية أقسام الإعدادات: لا توليد تلقائي لأي شيء — الأدمن يضيف
// كل فصل وكل أسبوع وكل إجازة بنفسه يدوياً (تواريخ، نوع، تسمية)، ويتحكّم
// بإظهار كل فصل لكل الموظفين بشكل مستقل عن الآخر.

let academicCalendarActiveTermId = null; // null = عرض قائمة الفصول، وإلا = إدارة أسابيع/إجازات هذا الفصل

async function renderSettingsAcademicCalendarSection(content) {
  if (academicCalendarActiveTermId) {
    await renderAcademicWeeksManagerSection(content);
  } else {
    await renderAcademicTermsManagerSection(content);
  }
}

async function renderAcademicTermsManagerSection(content) {
  content.innerHTML = `<div class="skel-rows"><div class="skel-row"></div></div>`;
  let terms;
  try {
    terms = await apiCall('academic-config', { method: 'POST', body: { action: 'listTerms' } });
  } catch (e) {
    content.innerHTML = `<p style="color:#c62828">${escapeHtml(e.message)}</p>`;
    return;
  }
  APP.allAcademicTermsSettings = terms;

  content.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px">
      <div>
        <h2 style="margin:0">التقويم الدراسي</h2>
        <p style="color:#888;font-size:12.5px;margin:4px 0 0">أضف الفصول الدراسية، ثم أدر أسابيع وإجازات كل فصل يدوياً بنفسك — بلا أي توليد تلقائي</p>
      </div>
      <button type="button" id="addTermSettingsBtn">${ICONS.plus()} فصل دراسي جديد</button>
    </div>
    <div id="termSettingsFormCard" style="display:none;margin-bottom:16px"></div>
    <div id="termSettingsListArea"></div>`;

  document.getElementById('addTermSettingsBtn').addEventListener('click', () => openTermSettingsForm());
  renderTermSettingsList();
}

function renderTermSettingsList() {
  const area = document.getElementById('termSettingsListArea');
  const terms = APP.allAcademicTermsSettings || [];

  if (!terms.length) { area.innerHTML = '<p style="color:#888">لا توجد فصول دراسية مضافة بعد — أضف الفصل الأول من الزر أعلاه</p>'; return; }

  const sorted = [...terms].sort((a, b) =>
    (b.academic_year || '').localeCompare(a.academic_year || '') || (a.term_number || 0) - (b.term_number || 0));

  area.innerHTML = sorted.map((t) => `
    <div class="card ${t.is_visible === false ? 'term-card-hidden' : ''}" style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px">
        <div>
          <div style="font-weight:800;font-size:14.5px">${escapeHtml(t.name)} <span style="font-weight:600;font-size:12px;color:#888">— الفصل ${t.term_number === 1 ? 'الأول' : 'الثاني'} — ${escapeHtml(t.academic_year)}</span></div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:4px">${formatDateAr(t.start_date)} ← ${formatDateAr(t.end_date)}</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <button type="button" class="term-visibility-toggle ${t.is_visible === false ? 'is-hidden' : 'is-visible'}" data-toggle-visibility="${t.id}" data-current-visible="${t.is_visible !== false}">
            ${t.is_visible === false ? 'مخفي عن الجميع' : 'ظاهر للجميع'}
          </button>
          <button type="button" class="btn-icon-edit" data-edit-term="${t.id}" title="تعديل">${ICONS.edit()}</button>
          <button type="button" class="btn-icon-delete" data-delete-term="${t.id}" title="حذف">${ICONS.trash()}</button>
        </div>
      </div>
      <button type="button" class="btn-outline-sm" data-manage-weeks="${t.id}" style="margin-top:12px">${ICONS.calendar()} إدارة الأسابيع والإجازات</button>
    </div>`).join('');

  area.querySelectorAll('[data-manage-weeks]').forEach((btn) => {
    btn.addEventListener('click', () => { academicCalendarActiveTermId = btn.getAttribute('data-manage-weeks'); renderSettingsSection(); });
  });
  area.querySelectorAll('[data-edit-term]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const term = terms.find((t) => String(t.id) === btn.getAttribute('data-edit-term'));
      if (term) openTermSettingsForm(term);
    });
  });
  area.querySelectorAll('[data-delete-term]').forEach((btn) => {
    btn.addEventListener('click', () => deleteTermSettingsConfirm(btn.getAttribute('data-delete-term')));
  });
  area.querySelectorAll('[data-toggle-visibility]').forEach((btn) => {
    btn.addEventListener('click', () => toggleTermVisibilitySettings(btn.getAttribute('data-toggle-visibility'), btn.getAttribute('data-current-visible') === 'true'));
  });
}

function openTermSettingsForm(term = null) {
  const card = document.getElementById('termSettingsFormCard');
  card.style.display = 'block';
  card.className = 'card';
  card.innerHTML = `
    <h3 style="margin-top:0">${term ? 'تعديل فصل دراسي' : 'إضافة فصل دراسي جديد'}</h3>
    <div class="field"><label>اسم الفصل</label><input type="text" id="term_name" value="${term ? escapeHtml(term.name) : ''}" placeholder="مثال: الفصل الدراسي الأول"></div>
    <div class="field"><label>رقم الفصل</label>
      <select id="term_number">
        <option value="1" ${term && term.term_number === 1 ? 'selected' : ''}>الفصل الأول</option>
        <option value="2" ${term && term.term_number === 2 ? 'selected' : ''}>الفصل الثاني</option>
      </select>
    </div>
    <div class="field"><label>العام الدراسي</label><input type="text" id="term_year" value="${term ? escapeHtml(term.academic_year) : ''}" placeholder="مثال: 1447هـ أو 2025-2026"></div>
    <div class="field"><label>تاريخ البداية</label><input type="date" dir="ltr" id="term_start" value="${term ? term.start_date : ''}"></div>
    <div class="field"><label>تاريخ النهاية</label><input type="date" dir="ltr" id="term_end" value="${term ? term.end_date : ''}"></div>
    <div style="display:flex;gap:10px;margin-top:14px">
      <button type="button" id="saveTermSettingsBtn">${term ? 'حفظ التعديلات' : 'إضافة الفصل'}</button>
      <button type="button" id="cancelTermSettingsBtn" style="background:var(--surface);color:var(--text)">إلغاء</button>
    </div>`;

  document.getElementById('cancelTermSettingsBtn').addEventListener('click', () => { card.style.display = 'none'; card.innerHTML = ''; });
  document.getElementById('saveTermSettingsBtn').addEventListener('click', () => saveTermSettingsSubmit(term ? term.id : null));
  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function saveTermSettingsSubmit(existingId) {
  const name = document.getElementById('term_name').value.trim();
  const termNumber = Number(document.getElementById('term_number').value);
  const academicYear = document.getElementById('term_year').value.trim();
  const startDate = document.getElementById('term_start').value;
  const endDate = document.getElementById('term_end').value;

  if (!name || !academicYear || !startDate || !endDate) { showToast('أكمل كل الحقول', 'error'); return; }
  if (endDate < startDate) { showToast('تاريخ النهاية يجب أن يكون بعد تاريخ البداية', 'error'); return; }

  const btn = document.getElementById('saveTermSettingsBtn');
  btn.disabled = true; btn.textContent = 'جارِ الحفظ...';
  try {
    const body = { action: 'saveTerm', name, termNumber, academicYear, startDate, endDate };
    if (existingId) body.id = existingId;
    await apiCall('academic-config', { method: 'POST', body });
    showToast('تم حفظ الفصل الدراسي بنجاح', 'success');
    document.getElementById('termSettingsFormCard').style.display = 'none';
    document.getElementById('termSettingsFormCard').innerHTML = '';
    APP.allAcademicTermsSettings = await apiCall('academic-config', { method: 'POST', body: { action: 'listTerms' } });
    renderTermSettingsList();
  } catch (e) { showToast(e.message, 'error'); }
  finally { btn.disabled = false; btn.textContent = existingId ? 'حفظ التعديلات' : 'إضافة الفصل'; }
}

function deleteTermSettingsConfirm(termId) {
  if (!confirm('حذف هذا الفصل الدراسي سيحذف كل أسابيعه وإجازاته المُضافة يدوياً نهائياً. هل أنت متأكد؟')) return;
  (async () => {
    try {
      await apiCall('academic-config', { method: 'POST', body: { action: 'deleteTerm', id: termId } });
      showToast('تم حذف الفصل الدراسي', 'success');
      APP.allAcademicTermsSettings = await apiCall('academic-config', { method: 'POST', body: { action: 'listTerms' } });
      renderTermSettingsList();
    } catch (e) { showToast(e.message, 'error'); }
  })();
}

async function toggleTermVisibilitySettings(termId, currentlyVisible) {
  try {
    await apiCall('academic-config', { method: 'POST', body: { action: 'toggleTermVisibility', id: termId, isVisible: !currentlyVisible } });
    showToast(currentlyVisible ? 'تم إخفاء الفصل عن كل الموظفين' : 'تم إظهار الفصل لكل الموظفين', 'success');
    APP.allAcademicTermsSettings = await apiCall('academic-config', { method: 'POST', body: { action: 'listTerms' } });
    renderTermSettingsList();
  } catch (e) { showToast(e.message, 'error'); }
}

/* -------------------- إدارة أسابيع وإجازات فصل معيّن (يدوياً بالكامل) -------------------- */

async function renderAcademicWeeksManagerSection(content) {
  const term = (APP.allAcademicTermsSettings || []).find((t) => String(t.id) === String(academicCalendarActiveTermId));
  content.innerHTML = `<div class="skel-rows"><div class="skel-row"></div></div>`;

  let weeks, holidays;
  try {
    [weeks, holidays] = await Promise.all([
      apiCall('academic-config', { method: 'POST', body: { action: 'listWeeksForTerm', termId: academicCalendarActiveTermId } }),
      apiCall('academic-config', { method: 'POST', body: { action: 'listHolidaysForTerm', termId: academicCalendarActiveTermId } }),
    ]);
  } catch (e) {
    content.innerHTML = `<p style="color:#c62828">${escapeHtml(e.message)}</p>`;
    return;
  }
  APP.currentTermWeeks = weeks;
  APP.currentTermHolidays = holidays; // 🆕

  content.innerHTML = `
    <button type="button" id="backToTermsBtn" style="background:none;border:none;color:var(--primary);cursor:pointer;font-size:12.5px;padding:0;margin-bottom:14px;display:flex;align-items:center;gap:4px">→ رجوع لقائمة الفصول</button>
    <div style="margin-bottom:16px">
      <h2 style="margin:0">${term ? escapeHtml(term.name) : ''}</h2>
      <p style="color:#888;font-size:12.5px;margin:4px 0 0">${term ? `${formatDateAr(term.start_date)} ← ${formatDateAr(term.end_date)}` : ''}</p>
    </div>

    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:10px">
      <h3 style="margin:0">الأسابيع الدراسية</h3>
      <button type="button" id="addWeekBtn">${ICONS.plus()} إضافة أسبوع</button>
    </div>
    <div id="weekFormCard" style="display:none;margin-bottom:16px"></div>
    <div id="weeksSettingsListArea" style="margin-bottom:28px"></div>

    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:10px">
      <h3 style="margin:0">🆕 الإجازات ضمن هذا الفصل</h3>
      <button type="button" id="addHolidayBtn">${ICONS.plus()} إضافة إجازة</button>
    </div>
    <p style="color:#888;font-size:11.5px;margin-top:-6px">الإجازة مستقلة عن الأسابيع — قد تقع داخل أسبوع دراسي واحد أو تمتد لتغطي أكثر من أسبوع، وطولها حر بالكامل (يوم واحد إلى عدة أيام)</p>
    <div id="holidayFormCard" style="display:none;margin:12px 0 16px"></div>
    <div id="holidaysSettingsListArea"></div>`;

  document.getElementById('backToTermsBtn').addEventListener('click', () => { academicCalendarActiveTermId = null; renderSettingsSection(); });
  document.getElementById('addWeekBtn').addEventListener('click', () => openWeekForm());
  document.getElementById('addHolidayBtn').addEventListener('click', () => openHolidayForm());
  renderWeeksSettingsList();
  renderHolidaysSettingsList();
}

function renderWeeksSettingsList() {
  const area = document.getElementById('weeksSettingsListArea');
  const weeks = [...(APP.currentTermWeeks || [])].sort((a, b) => (a.week_number || 0) - (b.week_number || 0) || (a.start_date || '').localeCompare(b.start_date || ''));

  if (!weeks.length) { area.innerHTML = '<p style="color:#888">لا توجد أسابيع مضافة بعد لهذا الفصل — أضف الأسبوع الأول من الزر أعلاه</p>'; return; }

  area.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:6px">
      ${weeks.map((w) => {
        const meta = WEEK_TYPE_META[w.week_type] || WEEK_TYPE_META['دراسي'];
        return `
        <div class="person-card-row" style="padding:10px 12px;background:var(--surface);border-radius:8px">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span style="font-weight:700;font-size:12.5px">الأسبوع ${w.week_number}</span>
            <span class="week-type-badge ${meta.badgeClass}">${escapeHtml(w.week_type || 'دراسي')}</span>
            <span style="font-size:12px;color:var(--text-muted)">${escapeHtml(w.label || '')}</span>
          </div>
          <div style="display:flex;align-items:center;gap:10px">
            <span style="font-size:11.5px;color:var(--text-muted)">${formatDateAr(w.start_date)} ← ${formatDateAr(w.end_date)}</span>
            <button type="button" class="btn-icon-edit" data-edit-week="${w.id}" title="تعديل">${ICONS.edit()}</button>
            <button type="button" class="btn-icon-delete" data-delete-week="${w.id}" title="حذف">${ICONS.trash()}</button>
          </div>
        </div>`;
      }).join('')}
    </div>`;

  area.querySelectorAll('[data-edit-week]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const week = weeks.find((w) => String(w.id) === btn.getAttribute('data-edit-week'));
      if (week) openWeekForm(week);
    });
  });
  area.querySelectorAll('[data-delete-week]').forEach((btn) => {
    btn.addEventListener('click', () => deleteWeekConfirm(btn.getAttribute('data-delete-week')));
  });
}

function openWeekForm(week = null) {
  const card = document.getElementById('weekFormCard');
  card.style.display = 'block';
  card.className = 'card';
  const nextWeekNumber = week ? week.week_number : (Math.max(0, ...(APP.currentTermWeeks || []).map((w) => w.week_number || 0)) + 1);
  const typeOptions = Object.keys(WEEK_TYPE_META);

  card.innerHTML = `
    <h3 style="margin-top:0">${week ? `تعديل الأسبوع ${week.week_number}` : 'إضافة أسبوع جديد'}</h3>
    <div class="field"><label>رقم الأسبوع</label><input type="number" id="week_number" min="1" value="${nextWeekNumber}"></div>
    <div class="field"><label>نوع الأسبوع</label>
      <select id="week_type">
        ${typeOptions.map((t) => `<option value="${escapeHtml(t)}" ${week && week.week_type === t ? 'selected' : ''}>${escapeHtml(t)}</option>`).join('')}
      </select>
    </div>
    <div class="field"><label>التسمية</label><input type="text" id="week_label" value="${week ? escapeHtml(week.label || '') : `الأسبوع ${nextWeekNumber}`}" placeholder="مثال: الأسبوع ${nextWeekNumber}"></div>
    <div class="field"><label>تاريخ البداية</label><input type="date" dir="ltr" id="week_start" value="${week ? week.start_date : ''}"></div>
    <div class="field"><label>تاريخ النهاية</label><input type="date" dir="ltr" id="week_end" value="${week ? week.end_date : ''}"></div>
    <p style="color:#888;font-size:11.5px;margin-top:-6px">💡 عندك إجازات ضمن هذا الأسبوع؟ أضفها بشكل مستقل من قسم "الإجازات" أسفل — يقدر يقع جزء منها داخل هذا الأسبوع بالضبط</p>
    <div style="display:flex;gap:10px;margin-top:14px">
      <button type="button" id="saveWeekBtn">${week ? 'حفظ التعديلات' : 'إضافة الأسبوع'}</button>
      <button type="button" id="cancelWeekBtn" style="background:var(--surface);color:var(--text)">إلغاء</button>
    </div>`;

  document.getElementById('cancelWeekBtn').addEventListener('click', () => { card.style.display = 'none'; card.innerHTML = ''; });
  document.getElementById('saveWeekBtn').addEventListener('click', () => saveWeekFormSubmit(week ? week.id : null));
  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function saveWeekFormSubmit(existingId) {
  const weekNumber = Number(document.getElementById('week_number').value);
  const weekType = document.getElementById('week_type').value;
  const label = document.getElementById('week_label').value.trim();
  const startDate = document.getElementById('week_start').value;
  const endDate = document.getElementById('week_end').value;

  if (!weekNumber || weekNumber < 1) { showToast('رقم الأسبوع يجب أن يكون 1 أو أكثر', 'error'); return; }
  if (!label) { showToast('التسمية مطلوبة', 'error'); return; }
  if (!startDate || !endDate) { showToast('حدّد تاريخ البداية والنهاية', 'error'); return; }
  if (endDate < startDate) { showToast('تاريخ النهاية يجب أن يكون بعد تاريخ البداية', 'error'); return; }

  const btn = document.getElementById('saveWeekBtn');
  btn.disabled = true; btn.textContent = 'جارِ الحفظ...';
  try {
    const body = existingId
      ? { action: 'updateWeek', id: existingId, weekNumber, weekType, label, startDate, endDate }
      : { action: 'addWeek', termId: academicCalendarActiveTermId, weekNumber, weekType, label, startDate, endDate };
    await apiCall('academic-config', { method: 'POST', body });
    showToast('تم حفظ الأسبوع بنجاح', 'success');
    document.getElementById('weekFormCard').style.display = 'none';
    document.getElementById('weekFormCard').innerHTML = '';
    APP.currentTermWeeks = await apiCall('academic-config', { method: 'POST', body: { action: 'listWeeksForTerm', termId: academicCalendarActiveTermId } });
    renderWeeksSettingsList();
  } catch (e) { showToast(e.message, 'error'); }
  finally { btn.disabled = false; btn.textContent = existingId ? 'حفظ التعديلات' : 'إضافة الأسبوع'; }
}

function deleteWeekConfirm(weekId) {
  if (!confirm('حذف هذا الأسبوع نهائياً. هل أنت متأكد؟')) return;
  (async () => {
    try {
      await apiCall('academic-config', { method: 'POST', body: { action: 'deleteWeek', id: weekId } });
      showToast('تم حذف الأسبوع', 'success');
      APP.currentTermWeeks = await apiCall('academic-config', { method: 'POST', body: { action: 'listWeeksForTerm', termId: academicCalendarActiveTermId } });
      renderWeeksSettingsList();
    } catch (e) { showToast(e.message, 'error'); }
  })();
}

/* 🆕 -------------------- إدارة الإجازات (مستقلة عن الأسابيع) -------------------- */

function renderHolidaysSettingsList() {
  const area = document.getElementById('holidaysSettingsListArea');
  const holidays = [...(APP.currentTermHolidays || [])].sort((a, b) => (a.start_date || '').localeCompare(b.start_date || ''));

  if (!holidays.length) { area.innerHTML = '<p style="color:#888">لا توجد إجازات مضافة بعد لهذا الفصل</p>'; return; }

  area.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:6px">
      ${holidays.map((h) => `
        <div class="person-card-row" style="padding:10px 12px;background:var(--surface);border-radius:8px">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span class="week-type-badge week-type-holiday">إجازة</span>
            <span style="font-size:12.5px;font-weight:700">${escapeHtml(h.label)}</span>
          </div>
          <div style="display:flex;align-items:center;gap:10px">
            <span style="font-size:11.5px;color:var(--text-muted)">${formatDateAr(h.start_date)} ← ${formatDateAr(h.end_date)}</span>
            <button type="button" class="btn-icon-edit" data-edit-holiday="${h.id}" title="تعديل">${ICONS.edit()}</button>
            <button type="button" class="btn-icon-delete" data-delete-holiday="${h.id}" title="حذف">${ICONS.trash()}</button>
          </div>
        </div>`).join('')}
    </div>`;

  area.querySelectorAll('[data-edit-holiday]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const holiday = holidays.find((h) => String(h.id) === btn.getAttribute('data-edit-holiday'));
      if (holiday) openHolidayForm(holiday);
    });
  });
  area.querySelectorAll('[data-delete-holiday]').forEach((btn) => {
    btn.addEventListener('click', () => deleteHolidayConfirm(btn.getAttribute('data-delete-holiday')));
  });
}

function openHolidayForm(holiday = null) {
  const card = document.getElementById('holidayFormCard');
  card.style.display = 'block';
  card.className = 'card';
  card.innerHTML = `
    <h3 style="margin-top:0">${holiday ? 'تعديل إجازة' : 'إضافة إجازة جديدة'}</h3>
    <div class="field"><label>اسم الإجازة</label><input type="text" id="holiday_label" value="${holiday ? escapeHtml(holiday.label) : ''}" placeholder="مثال: إجازة مطر، إجازة الربيع، اليوم الوطني"></div>
    <div class="field"><label>تاريخ البداية</label><input type="date" dir="ltr" id="holiday_start" value="${holiday ? holiday.start_date : ''}"></div>
    <div class="field"><label>تاريخ النهاية</label><input type="date" dir="ltr" id="holiday_end" value="${holiday ? holiday.end_date : ''}"></div>
    <p style="color:#888;font-size:11.5px;margin-top:-6px">💡 حدّد أي مدى تاريخي تبيه — يوم واحد، يومين، أو حتى 11 يوماً أو أكثر، طالما ضمن تواريخ الفصل الدراسي</p>
    <div style="display:flex;gap:10px;margin-top:14px">
      <button type="button" id="saveHolidayBtn">${holiday ? 'حفظ التعديلات' : 'إضافة الإجازة'}</button>
      <button type="button" id="cancelHolidayBtn" style="background:var(--surface);color:var(--text)">إلغاء</button>
    </div>`;

  document.getElementById('cancelHolidayBtn').addEventListener('click', () => { card.style.display = 'none'; card.innerHTML = ''; });
  document.getElementById('saveHolidayBtn').addEventListener('click', () => saveHolidayFormSubmit(holiday ? holiday.id : null));
  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function saveHolidayFormSubmit(existingId) {
  const label = document.getElementById('holiday_label').value.trim();
  const startDate = document.getElementById('holiday_start').value;
  const endDate = document.getElementById('holiday_end').value;

  if (!label) { showToast('اسم الإجازة مطلوب', 'error'); return; }
  if (!startDate || !endDate) { showToast('حدّد تاريخ البداية والنهاية', 'error'); return; }
  if (endDate < startDate) { showToast('تاريخ النهاية يجب أن يكون بعد تاريخ البداية', 'error'); return; }

  const btn = document.getElementById('saveHolidayBtn');
  btn.disabled = true; btn.textContent = 'جارِ الحفظ...';
  try {
    const body = existingId
      ? { action: 'updateHoliday', id: existingId, label, startDate, endDate }
      : { action: 'addHoliday', termId: academicCalendarActiveTermId, label, startDate, endDate };
    await apiCall('academic-config', { method: 'POST', body });
    showToast('تم حفظ الإجازة بنجاح', 'success');
    document.getElementById('holidayFormCard').style.display = 'none';
    document.getElementById('holidayFormCard').innerHTML = '';
    APP.currentTermHolidays = await apiCall('academic-config', { method: 'POST', body: { action: 'listHolidaysForTerm', termId: academicCalendarActiveTermId } });
    renderHolidaysSettingsList();
  } catch (e) { showToast(e.message, 'error'); }
  finally { btn.disabled = false; btn.textContent = existingId ? 'حفظ التعديلات' : 'إضافة الإجازة'; }
}

function deleteHolidayConfirm(holidayId) {
  if (!confirm('حذف هذي الإجازة نهائياً. هل أنت متأكد؟')) return;
  (async () => {
    try {
      await apiCall('academic-config', { method: 'POST', body: { action: 'deleteHoliday', id: holidayId } });
      showToast('تم حذف الإجازة', 'success');
      APP.currentTermHolidays = await apiCall('academic-config', { method: 'POST', body: { action: 'listHolidaysForTerm', termId: academicCalendarActiveTermId } });
      renderHolidaysSettingsList();
    } catch (e) { showToast(e.message, 'error'); }
  })();
}

/* ===================== 🆕 صفحة الجداول الدراسية (حصص + اختبارات) ===================== */
// ثلاثة أدوار فقط تعدّل (أدمن بلا قيد، مراقب فروع بفروعه، مشرف معلمين
// بفرعه) — الباقي (مشرف طلاب) عرض فقط. المعلم يشوف جدوله الشخصي فقط
// (حصصه/لجانه هو) بلا فلاتر صف/شعبة — بقية الأدوار تختار صفاً لعرض جدوله.

const SCHEDULE_DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'];
const SCHEDULE_PERIODS = [1, 2, 3, 4, 5, 6, 7, 8];
const EXAM_PERIOD_SLOTS = ['الفترة الأولى', 'الفترة الثانية'];

let schedulesActiveTab = 'class'; // 🆕 'class' | 'exam'
let scheduleFilterBranch = null, scheduleFilterStage = null, scheduleFilterGrade = null, scheduleFilterSection = null;

function canManageSchedules() {
  return ['role_admin', 'role_branch_monitor', 'role_teacher_sup'].includes(APP.user.role);
}

/** 🆕 الفروع المتاحة للمستخدم الحالي (أدمن=الكل، مراقب فروع=فروعه، الباقي=فرعه فقط)
 * — يُستخدَم بكل نموذج فيه اختيار فرع (تسجيل طالب/ولي أمر، فلاتر الجداول...)
 * ⚠️ كانت ثغرة أمنية حقيقية: نماذج تسجيل الطلاب/أولياء الأمور كانت تعرض
 * كل الفروع لكل الأدوار بلا استثناء، بدل حصرها بفرع المستخدم فقط. */
function allowedBranchesForUser_(allBranches) {
  if (APP.user.role === 'role_admin') return allBranches;
  if (APP.user.role === 'role_branch_monitor') return (APP.user.allBranches || []).filter((b) => allBranches.includes(b));
  return allBranches.includes(APP.user.branch) ? [APP.user.branch] : [];
}

async function renderSchedulesView() {
  const main = document.getElementById('mainContent');
  main.innerHTML = `<div class="card"><div class="skel-rows"><div class="skel-row"></div></div></div>`;

  main.innerHTML = `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px">
        <h2 style="margin:0">الجداول الدراسية</h2>
        <div class="segmented-control" id="schedTabBar">
          <button type="button" class="segmented-item ${schedulesActiveTab === 'class' ? 'active' : ''}" data-sched-tab="class">الجدول الدراسي</button>
          <button type="button" class="segmented-item ${schedulesActiveTab === 'exam' ? 'active' : ''}" data-sched-tab="exam">جدول الاختبارات</button>
        </div>
      </div>
      <div id="schedulesContentArea"></div>
    </div>`;

  document.querySelectorAll('#schedTabBar .segmented-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      schedulesActiveTab = btn.getAttribute('data-sched-tab');
      document.querySelectorAll('#schedTabBar .segmented-item').forEach((b) => b.classList.toggle('active', b === btn));
      renderSchedulesContent();
    });
  });

  renderSchedulesContent();
}

async function renderSchedulesContent() {
  const area = document.getElementById('schedulesContentArea');
  if (APP.user.role === 'role_teacher') {
    // 🆕 المعلم: جدوله الشخصي مباشرة، بلا فلاتر صف/شعبة
    if (schedulesActiveTab === 'class') await renderTeacherOwnClassSchedule(area);
    else await renderTeacherOwnExamSchedule(area);
    return;
  }
  if (schedulesActiveTab === 'class') await renderClassScheduleTab(area);
  else await renderExamScheduleTab(area);
}

/* -------------------- عرض المعلم الشخصي (بلا فلاتر) -------------------- */

async function renderTeacherOwnClassSchedule(area) {
  area.innerHTML = `<div class="skel-rows"><div class="skel-row"></div></div>`;
  let entries;
  try {
    entries = await apiCall('academic-config', { method: 'POST', body: { action: 'listClassSchedule' } });
  } catch (e) { area.innerHTML = `<p style="color:#c62828">${escapeHtml(e.message)}</p>`; return; }

  if (!entries.length) { area.innerHTML = '<p style="color:#888">لا توجد حصص مسجَّلة لك بعد</p>'; return; }

  area.innerHTML = SCHEDULE_DAYS.map((day) => {
    const dayEntries = entries.filter((e) => e.day_of_week === day).sort((a, b) => a.period_number - b.period_number);
    if (!dayEntries.length) return '';
    return `
      <div style="margin-bottom:18px">
        <div class="filter-card-title" style="margin-bottom:8px">${day}</div>
        <div style="display:flex;flex-direction:column;gap:6px">
          ${dayEntries.map((e) => `
            <div class="person-card-row" style="padding:10px 12px;background:var(--surface);border-radius:8px">
              <span style="font-size:12.5px;font-weight:700">الحصة ${e.period_number} — ${escapeHtml(e.subject)}</span>
              <span style="font-size:11.5px;color:var(--text-muted)">${escapeHtml(e.grade)} / ${escapeHtml(e.section)} — ${escapeHtml(e.branch)}</span>
            </div>`).join('')}
        </div>
      </div>`;
  }).join('');
}

async function renderTeacherOwnExamSchedule(area) {
  area.innerHTML = `<div class="skel-rows"><div class="skel-row"></div></div>`;
  let entries;
  try {
    entries = await apiCall('academic-config', { method: 'POST', body: { action: 'listExamSchedule' } });
  } catch (e) { area.innerHTML = `<p style="color:#c62828">${escapeHtml(e.message)}</p>`; return; }

  if (!entries.length) { area.innerHTML = '<p style="color:#888">لا توجد لجان مراقبة مسندة لك بعد</p>'; return; }

  const sorted = [...entries].sort((a, b) => (a.exam_date || '').localeCompare(b.exam_date || ''));
  area.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:6px">
      ${sorted.map((e) => `
        <div class="person-card-row" style="padding:10px 12px;background:var(--surface);border-radius:8px">
          <span style="font-size:12.5px;font-weight:700">${formatDateAr(e.exam_date)} — ${e.period_slot}</span>
          <span style="font-size:11.5px;color:var(--text-muted)">${escapeHtml(e.subject)} — ${escapeHtml(e.grade)} / ${escapeHtml(e.section)} — ${escapeHtml(e.branch)}</span>
        </div>`).join('')}
    </div>`;
}

/* -------------------- شريط فلاتر الصف (مشترك بين التبويبين) -------------------- */

async function renderScheduleClassFilters(area, onFilterReady) {
  const settings = await getSettingsOnce();
  const allowedBranches = allowedBranchesForUser_(settings.branches || []);

  if (!allowedBranches.length) { area.innerHTML = '<p style="color:#888">لا يوجد فرع متاح لك حالياً</p>'; return; }
  if (!scheduleFilterBranch || !allowedBranches.includes(scheduleFilterBranch)) scheduleFilterBranch = allowedBranches[0];
  if (!scheduleFilterStage || !(settings.stages || []).includes(scheduleFilterStage)) scheduleFilterStage = (settings.stages || [])[0] || null;
  if (!scheduleFilterGrade || !(settings.grades || []).includes(scheduleFilterGrade)) scheduleFilterGrade = (settings.grades || [])[0] || null;
  if (!scheduleFilterSection || !(settings.sections || []).includes(scheduleFilterSection)) scheduleFilterSection = (settings.sections || [])[0] || null;

  area.innerHTML = `
    <div class="card" style="margin-bottom:16px">
      <div class="af-grid-row">
        <div class="field"><label>الفرع</label><select id="schedFilterBranch">${allowedBranches.map((b) => `<option value="${escapeHtml(b)}" ${b === scheduleFilterBranch ? 'selected' : ''}>${escapeHtml(b)}</option>`).join('')}</select></div>
        <div class="field"><label>المرحلة</label><select id="schedFilterStage">${(settings.stages || []).map((s) => `<option value="${escapeHtml(s)}" ${s === scheduleFilterStage ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('')}</select></div>
        <div class="field"><label>الصف</label><select id="schedFilterGrade">${(settings.grades || []).map((g) => `<option value="${escapeHtml(g)}" ${g === scheduleFilterGrade ? 'selected' : ''}>${escapeHtml(g)}</option>`).join('')}</select></div>
        <div class="field"><label>الشعبة</label><select id="schedFilterSection">${(settings.sections || []).map((s) => `<option value="${escapeHtml(s)}" ${s === scheduleFilterSection ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('')}</select></div>
      </div>
    </div>`;

  ['schedFilterBranch', 'schedFilterStage', 'schedFilterGrade', 'schedFilterSection'].forEach((id) => {
    document.getElementById(id).addEventListener('change', (e) => {
      if (id === 'schedFilterBranch') scheduleFilterBranch = e.target.value;
      if (id === 'schedFilterStage') scheduleFilterStage = e.target.value;
      if (id === 'schedFilterGrade') scheduleFilterGrade = e.target.value;
      if (id === 'schedFilterSection') scheduleFilterSection = e.target.value;
      onFilterReady();
    });
  });

  onFilterReady();
}

/* -------------------- تبويب الجدول الدراسي -------------------- */

async function renderClassScheduleTab(area) {
  area.innerHTML = `
    <div id="schedClassFiltersArea"></div>
    <div id="schedClassGridArea"></div>`;
  await renderScheduleClassFilters(document.getElementById('schedClassFiltersArea'), loadAndRenderClassGrid);
}

async function loadAndRenderClassGrid() {
  const gridArea = document.getElementById('schedClassGridArea');
  gridArea.innerHTML = `<div class="skel-rows"><div class="skel-row"></div></div>`;
  let entries;
  try {
    entries = await apiCall('academic-config', { method: 'POST', body: { action: 'listClassSchedule' } });
  } catch (e) { gridArea.innerHTML = `<p style="color:#c62828">${escapeHtml(e.message)}</p>`; return; }

  APP.currentClassScheduleEntries = entries;
  renderClassScheduleGrid();
}

function renderClassScheduleGrid() {
  const gridArea = document.getElementById('schedClassGridArea');
  const entries = (APP.currentClassScheduleEntries || []).filter((e) =>
    e.branch === scheduleFilterBranch && e.stage === scheduleFilterStage && e.grade === scheduleFilterGrade && e.section === scheduleFilterSection);
  const map = {};
  entries.forEach((e) => { map[`${e.day_of_week}|${e.period_number}`] = e; });
  const canManage = canManageSchedules();

  gridArea.innerHTML = `
    <div class="schedule-grid-wrap">
      <table class="schedule-table">
        <thead><tr><th></th>${SCHEDULE_DAYS.map((d) => `<th>${d}</th>`).join('')}</tr></thead>
        <tbody>
          ${SCHEDULE_PERIODS.map((p) => `
            <tr>
              <td class="schedule-period-label">الحصة ${p}</td>
              ${SCHEDULE_DAYS.map((day) => {
                const entry = map[`${day}|${p}`];
                if (entry) {
                  return `<td class="schedule-cell schedule-cell-filled ${canManage ? 'schedule-cell-clickable' : ''}" data-sched-cell="${day}|${p}">
                    <div class="schedule-cell-subject">${escapeHtml(entry.subject)}</div>
                    <div class="schedule-cell-teacher">${escapeHtml(entry.teacher_name || '')}</div>
                  </td>`;
                }
                return `<td class="schedule-cell ${canManage ? 'schedule-cell-clickable' : ''}" data-sched-cell="${day}|${p}">${canManage ? '<span class="schedule-cell-add">+</span>' : ''}</td>`;
              }).join('')}
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;

  if (canManage) {
    gridArea.querySelectorAll('[data-sched-cell]').forEach((cell) => {
      cell.addEventListener('click', () => {
        const [day, period] = cell.getAttribute('data-sched-cell').split('|');
        const entry = map[`${day}|${period}`];
        openClassScheduleForm(day, Number(period), entry || null);
      });
    });
  }
}

async function openClassScheduleForm(day, period, entry) {
  let staff;
  try {
    staff = await apiCall('academic-config', { method: 'POST', body: { action: 'listStaffForScheduling' } });
  } catch (e) { showToast(e.message, 'error'); return; }
  const teachers = staff.filter((s) => s.role === 'role_teacher');
  const settings = await getSettingsOnce();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay show';
  overlay.innerHTML = `
    <div class="modal-card" style="max-width:420px">
      <div class="modal-header">
        <h3>${entry ? 'تعديل حصة' : 'إضافة حصة'} — ${day} — الحصة ${period}</h3>
        <button type="button" class="modal-close-btn" id="schedFormCloseBtn">${ICONS.close()}</button>
      </div>
      <div class="modal-body">
        <div class="field"><label>المادة</label>
          <select id="sched_subject">${(settings.subjects || []).map((s) => `<option value="${escapeHtml(s)}" ${entry && entry.subject === s ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('')}</select>
        </div>
        <div class="field"><label>المعلم</label>
          <select id="sched_teacher">${teachers.map((t) => `<option value="${t.id}" ${entry && String(entry.teacher_id) === String(t.id) ? 'selected' : ''}>${escapeHtml(t.name_ar)}</option>`).join('')}</select>
        </div>
        <div style="display:flex;gap:10px;margin-top:14px">
          <button type="button" id="schedFormSaveBtn" style="flex:1">حفظ</button>
          ${entry ? `<button type="button" id="schedFormDeleteBtn" class="btn-danger-outline">حذف</button>` : ''}
        </div>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.getElementById('schedFormCloseBtn').addEventListener('click', close);

  document.getElementById('schedFormSaveBtn').addEventListener('click', async () => {
    const subject = document.getElementById('sched_subject').value;
    const teacherId = document.getElementById('sched_teacher').value;
    if (!subject || !teacherId) { showToast('أكمل كل الحقول', 'error'); return; }
    const btn = document.getElementById('schedFormSaveBtn');
    btn.disabled = true; btn.textContent = 'جارِ الحفظ...';
    try {
      const body = {
        action: 'saveClassScheduleEntry', branch: scheduleFilterBranch, stage: scheduleFilterStage,
        grade: scheduleFilterGrade, section: scheduleFilterSection, dayOfWeek: day, periodNumber: period,
        subject, teacherId,
      };
      if (entry) body.id = entry.id;
      await apiCall('academic-config', { method: 'POST', body });
      showToast('تم حفظ الحصة بنجاح', 'success');
      close();
      await loadAndRenderClassGrid();
    } catch (e) { showToast(e.message, 'error'); btn.disabled = false; btn.textContent = 'حفظ'; }
  });

  if (entry) {
    document.getElementById('schedFormDeleteBtn').addEventListener('click', async () => {
      if (!confirm('حذف هذي الحصة نهائياً. هل أنت متأكد؟')) return;
      try {
        await apiCall('academic-config', { method: 'POST', body: { action: 'deleteClassScheduleEntry', id: entry.id } });
        showToast('تم حذف الحصة', 'success');
        close();
        await loadAndRenderClassGrid();
      } catch (e) { showToast(e.message, 'error'); }
    });
  }
}

/* -------------------- تبويب جدول الاختبارات -------------------- */

async function renderExamScheduleTab(area) {
  const canManage = canManageSchedules();
  area.innerHTML = `
    <div id="schedExamFiltersArea"></div>
    <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
      ${canManage ? `<button type="button" id="addExamBtn">${ICONS.plus()} إضافة اختبار</button>` : ''}
    </div>
    <div id="schedExamListArea"></div>`;

  await renderScheduleClassFilters(document.getElementById('schedExamFiltersArea'), loadAndRenderExamList);

  if (canManage) {
    document.getElementById('addExamBtn').addEventListener('click', () => openExamScheduleForm());
  }
}

async function loadAndRenderExamList() {
  const listArea = document.getElementById('schedExamListArea');
  listArea.innerHTML = `<div class="skel-rows"><div class="skel-row"></div></div>`;
  let entries;
  try {
    entries = await apiCall('academic-config', { method: 'POST', body: { action: 'listExamSchedule' } });
  } catch (e) { listArea.innerHTML = `<p style="color:#c62828">${escapeHtml(e.message)}</p>`; return; }

  APP.currentExamScheduleEntries = entries;
  renderExamScheduleList();
}

function renderExamScheduleList() {
  const listArea = document.getElementById('schedExamListArea');
  const canManage = canManageSchedules();
  const entries = (APP.currentExamScheduleEntries || []).filter((e) =>
    e.branch === scheduleFilterBranch && e.stage === scheduleFilterStage && e.grade === scheduleFilterGrade && e.section === scheduleFilterSection)
    .sort((a, b) => (a.exam_date || '').localeCompare(b.exam_date || '') || a.period_slot.localeCompare(b.period_slot));

  if (!entries.length) { listArea.innerHTML = '<p style="color:#888">لا توجد اختبارات مجدولة لهذا الصف بعد</p>'; return; }

  listArea.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:6px">
      ${entries.map((e) => `
        <div class="person-card-row" style="padding:10px 12px;background:var(--surface);border-radius:8px">
          <div>
            <span style="font-size:12.5px;font-weight:700">${formatDateAr(e.exam_date)}</span>
            <span class="week-type-badge week-type-monthly" style="margin-inline-start:8px">${e.period_slot}</span>
            <span style="font-size:12px;color:var(--text-muted);margin-inline-start:8px">${escapeHtml(e.subject)}</span>
          </div>
          <div style="display:flex;align-items:center;gap:10px">
            <span style="font-size:11.5px;color:var(--text-muted)">مراقب: ${escapeHtml(e.supervisor_name || '—')}</span>
            ${canManage ? `<button type="button" class="btn-icon-edit" data-edit-exam="${e.id}" title="تعديل">${ICONS.edit()}</button><button type="button" class="btn-icon-delete" data-delete-exam="${e.id}" title="حذف">${ICONS.trash()}</button>` : ''}
          </div>
        </div>`).join('')}
    </div>`;

  if (canManage) {
    listArea.querySelectorAll('[data-edit-exam]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const entry = entries.find((e) => String(e.id) === btn.getAttribute('data-edit-exam'));
        if (entry) openExamScheduleForm(entry);
      });
    });
    listArea.querySelectorAll('[data-delete-exam]').forEach((btn) => {
      btn.addEventListener('click', () => deleteExamScheduleConfirm(btn.getAttribute('data-delete-exam')));
    });
  }
}

async function openExamScheduleForm(entry = null) {
  let staff;
  try {
    staff = await apiCall('academic-config', { method: 'POST', body: { action: 'listStaffForScheduling' } });
  } catch (e) { showToast(e.message, 'error'); return; }
  const settings = await getSettingsOnce();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay show';
  overlay.innerHTML = `
    <div class="modal-card" style="max-width:420px">
      <div class="modal-header">
        <h3>${entry ? 'تعديل اختبار' : 'إضافة اختبار جديد'}</h3>
        <button type="button" class="modal-close-btn" id="examFormCloseBtn">${ICONS.close()}</button>
      </div>
      <div class="modal-body">
        <div class="field"><label>المادة</label>
          <select id="exam_subject">${(settings.subjects || []).map((s) => `<option value="${escapeHtml(s)}" ${entry && entry.subject === s ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('')}</select>
        </div>
        <div class="field"><label>تاريخ الاختبار</label><input type="date" dir="ltr" id="exam_date" value="${entry ? entry.exam_date : ''}"></div>
        <div class="field"><label>الفترة</label>
          <select id="exam_period">${EXAM_PERIOD_SLOTS.map((p) => `<option value="${p}" ${entry && entry.period_slot === p ? 'selected' : ''}>${p}</option>`).join('')}</select>
        </div>
        <div class="field"><label>مراقب اللجنة</label>
          <select id="exam_supervisor">${staff.map((s) => `<option value="${s.id}" ${entry && String(entry.supervisor_id) === String(s.id) ? 'selected' : ''}>${escapeHtml(s.name_ar)}</option>`).join('')}</select>
        </div>
        <div style="display:flex;gap:10px;margin-top:14px">
          <button type="button" id="examFormSaveBtn" style="flex:1">حفظ</button>
          ${entry ? `<button type="button" id="examFormDeleteBtn" class="btn-danger-outline">حذف</button>` : ''}
        </div>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.getElementById('examFormCloseBtn').addEventListener('click', close);

  document.getElementById('examFormSaveBtn').addEventListener('click', async () => {
    const subject = document.getElementById('exam_subject').value;
    const examDate = document.getElementById('exam_date').value;
    const periodSlot = document.getElementById('exam_period').value;
    const supervisorId = document.getElementById('exam_supervisor').value;
    if (!subject || !examDate || !supervisorId) { showToast('أكمل كل الحقول', 'error'); return; }
    const btn = document.getElementById('examFormSaveBtn');
    btn.disabled = true; btn.textContent = 'جارِ الحفظ...';
    try {
      const body = {
        action: 'saveExamScheduleEntry', branch: scheduleFilterBranch, stage: scheduleFilterStage,
        grade: scheduleFilterGrade, section: scheduleFilterSection, subject, examDate, periodSlot, supervisorId,
      };
      if (entry) body.id = entry.id;
      await apiCall('academic-config', { method: 'POST', body });
      showToast('تم حفظ الاختبار بنجاح', 'success');
      close();
      await loadAndRenderExamList();
    } catch (e) { showToast(e.message, 'error'); btn.disabled = false; btn.textContent = 'حفظ'; }
  });

  if (entry) {
    document.getElementById('examFormDeleteBtn').addEventListener('click', () => {
      close();
      deleteExamScheduleConfirm(entry.id);
    });
  }
}

function deleteExamScheduleConfirm(examId) {
  if (!confirm('حذف هذا الاختبار نهائياً. هل أنت متأكد؟')) return;
  (async () => {
    try {
      await apiCall('academic-config', { method: 'POST', body: { action: 'deleteExamScheduleEntry', id: examId } });
      showToast('تم حذف الاختبار', 'success');
      await loadAndRenderExamList();
    } catch (e) { showToast(e.message, 'error'); }
  })();
}

/* ===================== 🆕 صفحة التكاليف والمهام (تكاليف + اختبارات + إثراء) ===================== */

const TASK_SUBTYPES = ['واجب', 'ورقة عمل', 'بحث', 'تقرير', 'مطوية', 'حفظ وتسميع', 'قراءة'];
const EXAM_SUBTYPES = ['اختبار قصير', 'اختبار شهري', 'اختبار نهائي'];
const ANSWER_TYPE_LABELS = { mcq: 'خيارات متعددة', true_false: 'صح وخطأ', short_answer: 'إجابة قصيرة', long_answer: 'إجابة طويلة', attachment: 'إرفاق صورة أو رابط' };
const ASSIGNMENT_CATEGORY_LABELS = { task: 'تكاليف ومهام', exam: 'اختبارات', enrichment: 'إثراء' };

let assignmentsActiveCategory = 'all'; // 🆕 'all' | 'task' | 'exam' | 'enrichment'
let currentQuestionsDraft = [];        // 🆕 مسوّدة أسئلة النموذج المفتوح حالياً

function canWriteAssignments() { return ['role_admin', 'role_teacher'].includes(APP.user.role); }

function youtubeEmbedUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    let id = null;
    if (u.hostname.includes('youtu.be')) id = u.pathname.slice(1);
    else if (u.searchParams.get('v')) id = u.searchParams.get('v');
    else if (u.pathname.includes('/embed/')) id = u.pathname.split('/embed/')[1];
    return id ? `https://www.youtube.com/embed/${id}` : null;
  } catch (e) { return null; }
}

async function renderAssignmentsView() {
  const main = document.getElementById('mainContent');
  main.innerHTML = `<div class="card"><div class="skel-rows"><div class="skel-row"></div></div></div>`;

  main.innerHTML = `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px">
        <h2 style="margin:0">التكاليف والمهام</h2>
        ${canWriteAssignments() ? `<button type="button" id="addAssignmentBtn">${ICONS.plus()} نشر جديد</button>` : ''}
      </div>
      <div class="segmented-control" id="assignCatTabBar" style="margin-bottom:16px">
        <button type="button" class="segmented-item ${assignmentsActiveCategory === 'all' ? 'active' : ''}" data-assign-cat="all">الكل</button>
        <button type="button" class="segmented-item ${assignmentsActiveCategory === 'task' ? 'active' : ''}" data-assign-cat="task">تكاليف ومهام</button>
        <button type="button" class="segmented-item ${assignmentsActiveCategory === 'exam' ? 'active' : ''}" data-assign-cat="exam">اختبارات</button>
        <button type="button" class="segmented-item ${assignmentsActiveCategory === 'enrichment' ? 'active' : ''}" data-assign-cat="enrichment">إثراء</button>
      </div>
      <div id="assignmentFormCard" style="display:none;margin-bottom:16px"></div>
      <div id="assignmentsListArea"></div>
    </div>`;

  document.querySelectorAll('#assignCatTabBar .segmented-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      assignmentsActiveCategory = btn.getAttribute('data-assign-cat');
      document.querySelectorAll('#assignCatTabBar .segmented-item').forEach((b) => b.classList.toggle('active', b === btn));
      renderAssignmentsList();
    });
  });

  if (canWriteAssignments()) {
    document.getElementById('addAssignmentBtn').addEventListener('click', () => openAssignmentForm());
  }

  await loadAndRenderAssignmentsList();
}

async function loadAndRenderAssignmentsList() {
  const area = document.getElementById('assignmentsListArea');
  area.innerHTML = `<div class="skel-rows"><div class="skel-row"></div></div>`;
  try {
    APP.currentAssignments = await apiCall('academic-config', { method: 'POST', body: { action: 'listAssignments' } });
  } catch (e) { area.innerHTML = `<p style="color:#c62828">${escapeHtml(e.message)}</p>`; return; }
  renderAssignmentsList();
}

function renderAssignmentsList() {
  const area = document.getElementById('assignmentsListArea');
  const canWrite = canWriteAssignments();
  const list = (APP.currentAssignments || [])
    .filter((a) => assignmentsActiveCategory === 'all' || a.category === assignmentsActiveCategory)
    .sort((a, b) => (b.published_at || '').localeCompare(a.published_at || ''));

  if (!list.length) { area.innerHTML = '<p style="color:#888">لا يوجد شيء منشور بعد بهذا التصنيف</p>'; return; }

  area.innerHTML = list.map((a) => {
    const canEditThis = canWrite && (APP.user.role === 'role_admin' || a.teacher_id === APP.user.id);
    return `
    <div class="card assignment-card" style="margin-bottom:12px" data-assign-card="${a.id}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px">
        <div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span class="week-type-badge ${a.category === 'exam' ? 'week-type-final' : a.category === 'enrichment' ? 'week-type-monthly' : 'week-type-study'}">${ASSIGNMENT_CATEGORY_LABELS[a.category]}${a.subtype ? ' — ' + escapeHtml(a.subtype) : ''}</span>
            <span style="font-weight:800;font-size:14px">${escapeHtml(a.title)}</span>
          </div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:6px">${escapeHtml(a.teacher_name || '')} — ${escapeHtml(a.subject)} — ${escapeHtml(a.grade)}/${escapeHtml(a.section)} — ${escapeHtml(a.branch)}</div>
        </div>
        <div style="text-align:left">
          <div style="font-size:11.5px;color:var(--text-muted)">👥 ${a.participants_count} طالب متفاعل</div>
          ${a.max_score > 0 ? `<div style="font-size:11.5px;color:var(--text-muted)">الدرجة الكلية: ${a.max_score}</div>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');

  area.querySelectorAll('[data-assign-card]').forEach((card) => {
    card.addEventListener('click', () => {
      const a = list.find((x) => String(x.id) === card.getAttribute('data-assign-card'));
      if (a) showAssignmentDetail(a);
    });
  });
}

async function showAssignmentDetail(a) {
  const canWrite = canWriteAssignments();
  const isOwner = APP.user.role === 'role_admin' || a.teacher_id === APP.user.id;
  const publishedMs = new Date(a.published_at).getTime();
  const canEdit = canWrite && isOwner && (APP.user.role === 'role_admin' || (Date.now() - publishedMs) <= 60 * 60 * 1000);
  const canDelete = canWrite && isOwner && (APP.user.role === 'role_admin' || (Date.now() - publishedMs) <= 30 * 60 * 1000);

  let questions = [];
  try { questions = await apiCall('academic-config', { method: 'POST', body: { action: 'listAssignmentQuestions', assignmentId: a.id } }); } catch (e) { /* تجاهل */ }

  const embed = youtubeEmbedUrl(a.youtube_url);

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay show';
  overlay.innerHTML = `
    <div class="modal-card" style="max-width:560px">
      <div class="modal-header">
        <div>
          <h3>${escapeHtml(a.title)}</h3>
          <p class="modal-subtitle">${escapeHtml(a.teacher_name || '')} — ${ASSIGNMENT_CATEGORY_LABELS[a.category]}${a.subtype ? ' — ' + escapeHtml(a.subtype) : ''}</p>
        </div>
        <button type="button" class="modal-close-btn" id="assignDetailCloseBtn">${ICONS.close()}</button>
      </div>
      <div class="modal-body">
        ${a.description ? `<p style="font-size:13px;line-height:1.8">${escapeHtml(a.description)}</p>` : ''}
        ${embed ? `<div class="video-embed-wrap"><iframe src="${embed}" allowfullscreen frameborder="0"></iframe></div>` : (a.youtube_url ? `<p><a href="${escapeHtml(a.youtube_url)}" target="_blank" rel="noopener">رابط الفيديو</a></p>` : '')}
        ${a.attachment_url ? `<p><a href="${escapeHtml(a.attachment_url)}" target="_blank" rel="noopener">📎 فتح المرفق</a></p>` : ''}
        <div class="modal-detail-row"><span class="modal-detail-label">الفرع/الصف/الشعبة</span><span class="modal-detail-value">${escapeHtml(a.branch)} — ${escapeHtml(a.grade)}/${escapeHtml(a.section)}</span></div>
        <div class="modal-detail-row"><span class="modal-detail-label">المادة</span><span class="modal-detail-value">${escapeHtml(a.subject)}</span></div>
        ${a.due_at ? `<div class="modal-detail-row"><span class="modal-detail-label">موعد التسليم</span><span class="modal-detail-value">${new Date(a.due_at).toLocaleString('ar-SA-u-ca-gregory')}</span></div>` : ''}
        <div class="modal-detail-row"><span class="modal-detail-label">عدد المتفاعلين</span><span class="modal-detail-value">${a.participants_count} طالب</span></div>
        ${a.max_score > 0 ? `<div class="modal-detail-row"><span class="modal-detail-label">الدرجة الكلية</span><span class="modal-detail-value">${a.max_score}</span></div>` : ''}
        ${questions.length ? `<div style="margin-top:10px"><div class="filter-card-title">الأسئلة (${questions.length})</div>${questions.map((q, i) => `<div style="font-size:12px;padding:6px 0;border-bottom:1px solid var(--outline)">${i + 1}. ${escapeHtml(q.question_text)} <span style="color:#888">(${ANSWER_TYPE_LABELS[q.answer_type]} — ${q.points} درجة)</span></div>`).join('')}</div>` : ''}
        ${(canEdit || canDelete) ? `
          <div style="display:flex;gap:10px;margin-top:16px">
            ${canEdit ? `<button type="button" id="assignEditBtn" style="flex:1">تعديل</button>` : ''}
            ${canDelete ? `<button type="button" id="assignDeleteBtn" class="btn-danger-outline">حذف</button>` : ''}
          </div>` : ''}
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.getElementById('assignDetailCloseBtn').addEventListener('click', close);
  if (canEdit) document.getElementById('assignEditBtn').addEventListener('click', () => { close(); openAssignmentForm(a, questions); });
  if (canDelete) {
    document.getElementById('assignDeleteBtn').addEventListener('click', async () => {
      if (!confirm('حذف هذا العنصر نهائياً مع كل درجاته المرصودة. هل أنت متأكد؟')) return;
      try {
        await apiCall('academic-config', { method: 'POST', body: { action: 'deleteAssignment', id: a.id } });
        showToast('تم الحذف بنجاح', 'success');
        close();
        await loadAndRenderAssignmentsList();
      } catch (e) { showToast(e.message, 'error'); }
    });
  }
}

/* -------------------- نموذج نشر/تعديل تكليف/اختبار/إثراء -------------------- */

async function openAssignmentForm(existing = null, existingQuestions = []) {
  const card = document.getElementById('assignmentFormCard');
  const settings = await getSettingsOnce();
  const isAdmin = APP.user.role === 'role_admin';
  const category = existing ? existing.category : 'task';
  currentQuestionsDraft = existingQuestions.map((q) => ({
    questionText: q.question_text, answerType: q.answer_type, points: q.points,
    options: q.options || [], correctOptionId: q.correct_option_id || '',
  }));

  const branchOptions = isAdmin ? (settings.branches || []) : [APP.user.branch];
  const stageOptions = isAdmin ? (settings.stages || []) : (APP.user.stage ? [APP.user.stage] : []); // 🆕 تقييد المرحلة للمعلم
  const gradeOptions = isAdmin ? (settings.grades || []) : (APP.user.grades || []);
  const sectionOptions = isAdmin ? (settings.sections || []) : (APP.user.sections || []);
  const subjectOptions = isAdmin ? (settings.subjects || []) : (APP.user.subject || []);

  card.style.display = 'block';
  card.className = 'card';
  card.innerHTML = `
    <h3 style="margin-top:0">${existing ? 'تعديل' : 'نشر جديد'}</h3>
    <div class="field"><label>التصنيف</label>
      <select id="af_category">
        <option value="task" ${category === 'task' ? 'selected' : ''}>تكاليف ومهام</option>
        <option value="exam" ${category === 'exam' ? 'selected' : ''}>اختبارات</option>
        <option value="enrichment" ${category === 'enrichment' ? 'selected' : ''}>إثراء</option>
      </select>
    </div>
    <div class="field" id="af_subtype_wrap"><label>النوع الفرعي</label><select id="af_subtype"></select></div>
    <div class="field"><label>العنوان</label><input type="text" id="af_title" value="${existing ? escapeHtml(existing.title) : ''}"></div>
    <div class="field"><label>الوصف</label><textarea id="af_description" rows="3">${existing ? escapeHtml(existing.description || '') : ''}</textarea></div>
    <div class="af-grid-row">
      <div class="field"><label>الفرع</label><select id="af_branch">${branchOptions.map((b) => `<option value="${escapeHtml(b)}" ${existing && existing.branch === b ? 'selected' : ''}>${escapeHtml(b)}</option>`).join('')}</select></div>
      <div class="field"><label>المرحلة</label><select id="af_stage">${stageOptions.map((s) => `<option value="${escapeHtml(s)}" ${existing && existing.stage === s ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('')}</select></div>
      <div class="field"><label>الصف</label><select id="af_grade">${gradeOptions.map((g) => `<option value="${escapeHtml(g)}" ${existing && existing.grade === g ? 'selected' : ''}>${escapeHtml(g)}</option>`).join('')}</select></div>
      <div class="field"><label>الشعبة</label><select id="af_section">${sectionOptions.map((s) => `<option value="${escapeHtml(s)}" ${existing && existing.section === s ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('')}</select></div>
      <div class="field"><label>المادة</label><select id="af_subject">${subjectOptions.map((s) => `<option value="${escapeHtml(s)}" ${existing && existing.subject === s ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('')}</select></div>
    </div>
    <div class="field" id="af_evaltype_wrap"><label>نوع التقييم (لتوزيع الدرجات بنتائج الفصل)</label><select id="af_evaltype"></select></div>
    <div class="af-grid-row-2">
      <div class="field"><label>متاح من</label><input type="datetime-local" dir="ltr" id="af_from" value="${existing && existing.available_from ? existing.available_from.slice(0, 16) : ''}"></div>
      <div class="field"><label>حتى</label><input type="datetime-local" dir="ltr" id="af_due" value="${existing && existing.due_at ? existing.due_at.slice(0, 16) : ''}"></div>
    </div>
    <div class="field" id="af_youtube_wrap"><label>رابط فيديو يوتيوب (اختياري)</label><input type="text" id="af_youtube" value="${existing ? escapeHtml(existing.youtube_url || '') : ''}" placeholder="https://youtube.com/watch?v=..."></div>
    <div class="field"><label>رابط مرفق — صورة أو ملف (اختياري)</label><input type="text" id="af_attachment" value="${existing ? escapeHtml(existing.attachment_url || '') : ''}" placeholder="رابط Google Drive أو أي رابط مباشر"></div>

    <div id="af_questions_wrap" style="margin-top:10px"></div>

    <div style="display:flex;gap:10px;margin-top:16px">
      <button type="button" id="af_saveBtn" style="flex:1">${existing ? 'حفظ التعديلات' : 'نشر'}</button>
      <button type="button" id="af_cancelBtn" style="background:var(--surface);color:var(--text)">إلغاء</button>
    </div>`;

  function refreshSubtypeOptions() {
    const cat = document.getElementById('af_category').value;
    const wrap = document.getElementById('af_subtype_wrap');
    const isEnrichment = cat === 'enrichment';
    wrap.style.display = isEnrichment ? 'none' : 'block';
    const opts = cat === 'task' ? TASK_SUBTYPES : cat === 'exam' ? EXAM_SUBTYPES : [];
    document.getElementById('af_subtype').innerHTML = opts.map((o) => `<option value="${escapeHtml(o)}" ${existing && existing.subtype === o ? 'selected' : ''}>${escapeHtml(o)}</option>`).join('');
    document.getElementById('af_questions_wrap').style.display = isEnrichment ? 'none' : 'block';
    document.getElementById('af_youtube_wrap').style.display = isEnrichment ? 'block' : 'none';
    // 🆕 نوع التقييم لتوزيع الدرجات — يعرض قائمة "التقييم المستمر" للتكاليف، أو "الاختبارات" للاختبارات، ويُخفى بالإثراء (بلا درجة)
    document.getElementById('af_evaltype_wrap').style.display = isEnrichment ? 'none' : 'block';
    if (!isEnrichment) {
      const evalOpts = cat === 'task' ? (settings.continuousEvalTypes || []) : (settings.exams || []);
      document.getElementById('af_evaltype').innerHTML = evalOpts.map((v) => `<option value="${escapeHtml(v)}" ${existing && existing.eval_type === v ? 'selected' : ''}>${escapeHtml(v)}</option>`).join('');
    }
  }
  document.getElementById('af_category').addEventListener('change', refreshSubtypeOptions);
  refreshSubtypeOptions();
  attachQuestionsWrapEvents(document.getElementById('af_questions_wrap')); // 🆕 تفويض أحداث ثابت — مرة واحدة فقط
  renderQuestionsBuilder();

  document.getElementById('af_cancelBtn').addEventListener('click', () => { card.style.display = 'none'; card.innerHTML = ''; });
  document.getElementById('af_saveBtn').addEventListener('click', () => saveAssignmentSubmit(existing ? existing.id : null));
  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function renderQuestionsBuilder() {
  const wrap = document.getElementById('af_questions_wrap');
  if (!wrap) return;
  wrap.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <div class="filter-card-title" style="margin:0">الأسئلة (${currentQuestionsDraft.length}/40)</div>
      ${currentQuestionsDraft.length < 40 ? `<button type="button" id="af_addQuestionBtn" class="btn-outline-sm">${ICONS.plus()} إضافة سؤال</button>` : ''}
    </div>
    <div id="af_questionsListArea">
      ${currentQuestionsDraft.map((q, i) => `
        <div class="card" style="margin-bottom:10px;padding:12px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <span style="font-weight:800;font-size:12.5px">سؤال ${i + 1}</span>
            <button type="button" class="btn-icon-delete" data-remove-q="${i}" title="حذف السؤال">${ICONS.trash()}</button>
          </div>
          <div class="field"><label>نص السؤال</label><textarea rows="2" data-q-field="questionText" data-q-idx="${i}">${escapeHtml(q.questionText)}</textarea></div>
          <div class="af-grid-row-2">
            <div class="field"><label>نوع الإجابة</label>
              <select data-q-field="answerType" data-q-idx="${i}">
                ${Object.entries(ANSWER_TYPE_LABELS).map(([v, l]) => `<option value="${v}" ${q.answerType === v ? 'selected' : ''}>${l}</option>`).join('')}
              </select>
            </div>
            <div class="field"><label>الدرجة</label><input type="number" min="0.5" step="0.5" data-q-field="points" data-q-idx="${i}" value="${q.points}"></div>
          </div>
          <div data-q-options-area="${i}">${buildQuestionOptionsHtml(i)}</div>
        </div>`).join('')}
    </div>`;
}

/** 🆕 يبني HTML منطقة الخيارات فقط (بلا أي addEventListener) — التفاعل كله
 * عبر تفويض أحداث واحد ثابت على af_questions_wrap (انظر attachQuestionsWrapEvents) */
function buildQuestionOptionsHtml(idx) {
  const q = currentQuestionsDraft[idx];

  if (q.answerType === 'true_false') {
    return `
      <div class="field"><label>الإجابة الصحيحة</label>
        <select data-tf-correct="${idx}">
          <option value="true" ${q.correctOptionId === 'true' ? 'selected' : ''}>صح</option>
          <option value="false" ${q.correctOptionId === 'false' ? 'selected' : ''}>خطأ</option>
        </select>
      </div>`;
  }

  if (q.answerType === 'mcq') {
    if (!q.options.length) q.options = [{ id: 'a', text: '' }, { id: 'b', text: '' }];
    return `
      <div class="field"><label>الخيارات (حدّد الإجابة الصحيحة)</label>
        ${q.options.map((opt, oi) => `
          <div class="mcq-option-row">
            <input type="radio" name="mcq_correct_${idx}" value="${opt.id}" ${q.correctOptionId === opt.id ? 'checked' : ''} data-mcq-correct="${idx}">
            <input type="text" class="mcq-option-input" placeholder="نص الخيار" value="${escapeHtml(opt.text)}" data-mcq-text="${idx}|${oi}">
            <button type="button" class="btn-icon-delete" data-mcq-remove="${idx}|${oi}">${ICONS.close()}</button>
          </div>`).join('')}
        ${q.options.length < 10 ? `<button type="button" class="btn-outline-sm" data-mcq-add="${idx}">${ICONS.plus()} خيار</button>` : ''}
      </div>`;
  }

  return ''; // short_answer/long_answer/attachment — بلا خيارات إضافية
}

/** 🆕 تفويض أحداث واحد ثابت — يُربَط مرة وحدة فقط لحظة إنشاء af_questions_wrap
 * (بالحاوية الأم نفسها لا بعناصر داخلية تُعاد كتابتها)، فلا ينقطع الكتابة أبداً
 * مهما تكرَّر renderQuestionsBuilder/buildQuestionOptionsHtml داخلياً */
function attachQuestionsWrapEvents(wrap) {
  wrap.addEventListener('input', (e) => {
    const t = e.target;
    if (t.matches('[data-q-field="questionText"]')) {
      currentQuestionsDraft[Number(t.dataset.qIdx)].questionText = t.value;
    } else if (t.matches('[data-q-field="points"]')) {
      currentQuestionsDraft[Number(t.dataset.qIdx)].points = Number(t.value) || 0;
    } else if (t.matches('[data-mcq-text]')) {
      const [qi, oi] = t.getAttribute('data-mcq-text').split('|').map(Number);
      currentQuestionsDraft[qi].options[oi].text = t.value;
    }
  });

  wrap.addEventListener('change', (e) => {
    const t = e.target;
    if (t.matches('[data-q-field="answerType"]')) {
      currentQuestionsDraft[Number(t.dataset.qIdx)].answerType = t.value;
      renderQuestionsBuilder();
    } else if (t.matches('[data-tf-correct]')) {
      currentQuestionsDraft[Number(t.getAttribute('data-tf-correct'))].correctOptionId = t.value;
    } else if (t.matches('[data-mcq-correct]')) {
      currentQuestionsDraft[Number(t.getAttribute('data-mcq-correct'))].correctOptionId = t.value;
    }
  });

  wrap.addEventListener('click', (e) => {
    const addQBtn = e.target.closest('#af_addQuestionBtn');
    if (addQBtn) {
      currentQuestionsDraft.push({ questionText: '', answerType: 'short_answer', points: 5, options: [], correctOptionId: '' });
      renderQuestionsBuilder();
      return;
    }
    const removeQBtn = e.target.closest('[data-remove-q]');
    if (removeQBtn) {
      currentQuestionsDraft.splice(Number(removeQBtn.getAttribute('data-remove-q')), 1);
      renderQuestionsBuilder();
      return;
    }
    const mcqAddBtn = e.target.closest('[data-mcq-add]');
    if (mcqAddBtn) {
      const idx = Number(mcqAddBtn.getAttribute('data-mcq-add'));
      const q = currentQuestionsDraft[idx];
      q.options.push({ id: String.fromCharCode(97 + q.options.length), text: '' });
      document.querySelector(`[data-q-options-area="${idx}"]`).innerHTML = buildQuestionOptionsHtml(idx);
      return;
    }
    const mcqRemoveBtn = e.target.closest('[data-mcq-remove]');
    if (mcqRemoveBtn) {
      const [qi, oi] = mcqRemoveBtn.getAttribute('data-mcq-remove').split('|').map(Number);
      currentQuestionsDraft[qi].options.splice(oi, 1);
      document.querySelector(`[data-q-options-area="${qi}"]`).innerHTML = buildQuestionOptionsHtml(qi);
    }
  });
}

async function saveAssignmentSubmit(existingId) {
  const category = document.getElementById('af_category').value;
  const title = document.getElementById('af_title').value.trim();
  if (!title) { showToast('العنوان مطلوب', 'error'); return; }
  if (category !== 'enrichment' && !currentQuestionsDraft.length) { showToast('أضف سؤالاً واحداً على الأقل', 'error'); return; }

  const btn = document.getElementById('af_saveBtn');
  btn.disabled = true; btn.textContent = 'جارِ الحفظ...';
  try {
    const body = {
      action: 'saveAssignment',
      category,
      subtype: category === 'enrichment' ? null : document.getElementById('af_subtype').value,
      evalType: category === 'enrichment' ? null : document.getElementById('af_evaltype').value, // 🆕 أساس توزيع الدرجات
      title,
      description: document.getElementById('af_description').value.trim() || null,
      branch: document.getElementById('af_branch').value,
      stage: document.getElementById('af_stage').value,
      grade: document.getElementById('af_grade').value,
      section: document.getElementById('af_section').value,
      subject: document.getElementById('af_subject').value,
      availableFrom: document.getElementById('af_from').value ? new Date(document.getElementById('af_from').value).toISOString() : null,
      dueAt: document.getElementById('af_due').value ? new Date(document.getElementById('af_due').value).toISOString() : null,
      youtubeUrl: document.getElementById('af_youtube').value.trim() || null,
      attachmentUrl: document.getElementById('af_attachment').value.trim() || null,
      questions: category === 'enrichment' ? [] : currentQuestionsDraft,
    };
    if (existingId) body.id = existingId;
    await apiCall('academic-config', { method: 'POST', body });
    showToast('تم النشر بنجاح', 'success');
    document.getElementById('assignmentFormCard').style.display = 'none';
    document.getElementById('assignmentFormCard').innerHTML = '';
    await loadAndRenderAssignmentsList();
  } catch (e) { showToast(e.message, 'error'); }
  finally { btn.disabled = false; btn.textContent = existingId ? 'حفظ التعديلات' : 'نشر'; }
}

/* ===================== 🆕 صفحة رصد الدرجات (أدمن ومعلم فقط) ===================== */
// تبويبان: (1) رصد التكاليف/المهام/الاختبارات — فلاتر ثم قائمة ثم كشف
// درجات. (2) المشاركة والتفاعل — سجل تراكمي مستقل لكل طالب بكل مادة.

let gradesActiveTab = 'assignments'; // 🆕 'assignments' | 'participation'
let assignmentGradesActiveId = null;
let gradesFilterCategory = 'all', gradesFilterSubject = '', gradesFilterGrade = '', gradesFilterSection = '';

async function renderAssignmentGradesView() {
  const main = document.getElementById('mainContent');
  main.innerHTML = `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px">
        <h2 style="margin:0">رصد الدرجات</h2>
        <div class="segmented-control" id="gradesTabBar">
          <button type="button" class="segmented-item ${gradesActiveTab === 'assignments' ? 'active' : ''}" data-grades-tab="assignments">تكاليف / اختبارات</button>
          <button type="button" class="segmented-item ${gradesActiveTab === 'participation' ? 'active' : ''}" data-grades-tab="participation">المشاركة والتفاعل</button>
        </div>
      </div>
      <div id="gradesContentArea"></div>
    </div>`;

  document.querySelectorAll('#gradesTabBar .segmented-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      gradesActiveTab = btn.getAttribute('data-grades-tab');
      document.querySelectorAll('#gradesTabBar .segmented-item').forEach((b) => b.classList.toggle('active', b === btn));
      assignmentGradesActiveId = null;
      renderGradesTabContent();
    });
  });

  renderGradesTabContent();
}

function renderGradesTabContent() {
  if (gradesActiveTab === 'participation') renderParticipationTab();
  else renderGradesAssignmentsFilters();
}

/* -------------------- تبويب 1: رصد التكاليف/المهام/الاختبارات -------------------- */

async function renderGradesAssignmentsFilters() {
  const area = document.getElementById('gradesContentArea');
  const settings = await getSettingsOnce();
  const isTeacher = APP.user.role === 'role_teacher';
  const subjectOptions = isTeacher ? (APP.user.subject || []) : (settings.subjects || []);
  const gradeOptions = isTeacher ? (APP.user.grades || []) : (settings.grades || []);
  const sectionOptions = isTeacher ? (APP.user.sections || []) : (settings.sections || []);

  area.innerHTML = `
    <div class="segmented-control" id="gradesCatFilterBar" style="margin-bottom:12px">
      <button type="button" class="segmented-item ${gradesFilterCategory === 'all' ? 'active' : ''}" data-grades-cat="all">الكل</button>
      <button type="button" class="segmented-item ${gradesFilterCategory === 'task' ? 'active' : ''}" data-grades-cat="task">تكاليف ومهام</button>
      <button type="button" class="segmented-item ${gradesFilterCategory === 'exam' ? 'active' : ''}" data-grades-cat="exam">اختبارات</button>
    </div>
    <div class="af-grid-row" style="margin-bottom:12px">
      <div class="field"><label>المادة</label><select id="gradesFilterSubject"><option value="">الكل</option>${subjectOptions.map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('')}</select></div>
      <div class="field"><label>الصف</label><select id="gradesFilterGrade"><option value="">الكل</option>${gradeOptions.map((g) => `<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`).join('')}</select></div>
      <div class="field"><label>الشعبة</label><select id="gradesFilterSection"><option value="">الكل</option>${sectionOptions.map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('')}</select></div>
    </div>
    <div id="gradesAssignmentsListArea"></div>`;

  document.querySelectorAll('#gradesCatFilterBar .segmented-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      gradesFilterCategory = btn.getAttribute('data-grades-cat');
      document.querySelectorAll('#gradesCatFilterBar .segmented-item').forEach((b) => b.classList.toggle('active', b === btn));
      renderGradesAssignmentsList();
    });
  });
  ['gradesFilterSubject', 'gradesFilterGrade', 'gradesFilterSection'].forEach((id) => {
    document.getElementById(id).addEventListener('change', (e) => {
      if (id === 'gradesFilterSubject') gradesFilterSubject = e.target.value;
      if (id === 'gradesFilterGrade') gradesFilterGrade = e.target.value;
      if (id === 'gradesFilterSection') gradesFilterSection = e.target.value;
      renderGradesAssignmentsList();
    });
  });

  await loadAndRenderGradesAssignmentsList();
}

async function loadAndRenderGradesAssignmentsList() {
  const area = document.getElementById('gradesAssignmentsListArea');
  area.innerHTML = `<div class="skel-rows"><div class="skel-row"></div></div>`;
  try {
    APP.gradableAssignments = await apiCall('academic-config', { method: 'POST', body: { action: 'listAssignments' } });
  } catch (e) { area.innerHTML = `<p style="color:#c62828">${escapeHtml(e.message)}</p>`; return; }
  renderGradesAssignmentsList();
}

function renderGradesAssignmentsList() {
  const area = document.getElementById('gradesAssignmentsListArea');
  const gradable = (APP.gradableAssignments || [])
    .filter((a) => a.max_score > 0)
    .filter((a) => gradesFilterCategory === 'all' || a.category === gradesFilterCategory)
    .filter((a) => !gradesFilterSubject || a.subject === gradesFilterSubject)
    .filter((a) => !gradesFilterGrade || a.grade === gradesFilterGrade)
    .filter((a) => !gradesFilterSection || a.section === gradesFilterSection)
    .sort((a, b) => (b.published_at || '').localeCompare(a.published_at || ''));

  if (!gradable.length) { area.innerHTML = '<p style="color:#888">لا يوجد تكليف أو اختبار مطابق للفلاتر</p>'; return; }

  area.innerHTML = gradable.map((a) => `
    <div class="card" style="margin-bottom:10px;cursor:pointer" data-grade-assign="${a.id}">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <div>
          <span class="week-type-badge ${a.category === 'exam' ? 'week-type-final' : 'week-type-study'}">${ASSIGNMENT_CATEGORY_LABELS[a.category]}${a.subtype ? ' — ' + escapeHtml(a.subtype) : ''}</span>
          <span class="week-type-badge ${a.is_auto_gradable ? 'week-type-study' : 'week-type-monthly'}" style="margin-inline-start:4px">${a.is_auto_gradable ? '✅ تصحيح تلقائي' : '✍️ تصحيح يدوي'}</span>
          <span style="font-weight:700;font-size:13px;margin-inline-start:8px">${escapeHtml(a.title)}</span>
        </div>
        <span style="font-size:11.5px;color:var(--text-muted)">${escapeHtml(a.grade)}/${escapeHtml(a.section)} — ${a.participants_count} مرصود من ${a.max_score}</span>
      </div>
    </div>`).join('');

  area.querySelectorAll('[data-grade-assign]').forEach((card) => {
    card.addEventListener('click', () => { assignmentGradesActiveId = card.getAttribute('data-grade-assign'); renderGradesRoster(); });
  });
}

async function renderGradesRoster() {
  const area = document.getElementById('gradesContentArea');
  area.innerHTML = `<div class="skel-rows"><div class="skel-row"></div></div>`;
  let payload;
  try {
    payload = await apiCall('academic-config', { method: 'POST', body: { action: 'listAssignmentRoster', assignmentId: assignmentGradesActiveId } });
  } catch (e) {
    area.innerHTML = `<p style="color:#c62828">${escapeHtml(e.message)}</p><button type="button" id="backToGradesListBtn" class="btn-outline-sm">→ رجوع</button>`;
    document.getElementById('backToGradesListBtn').addEventListener('click', () => { assignmentGradesActiveId = null; renderGradesAssignmentsFilters(); });
    return;
  }

  const { assignment, roster } = payload;
  const isAdmin = APP.user.role === 'role_admin';

  area.innerHTML = `
    <button type="button" id="backToGradesListBtn" style="background:none;border:none;color:var(--primary);cursor:pointer;font-size:12.5px;padding:0;margin-bottom:14px">→ رجوع لقائمة التكاليف</button>
    <h3 style="margin:0 0 4px">${escapeHtml(assignment.title)}</h3>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;flex-wrap:wrap">
      <span style="color:#888;font-size:12px">${escapeHtml(assignment.grade)}/${escapeHtml(assignment.section)} — الدرجة الكلية:</span>
      <input type="number" min="0.5" step="0.5" id="quickMaxScoreInput" value="${assignment.max_score}" style="width:80px">
      <button type="button" class="btn-outline-sm" id="quickMaxScoreSaveBtn">تحديث الدرجة الكلية</button>
    </div>
    <div style="display:flex;flex-direction:column;gap:6px">
      ${roster.map((r) => {
        const gr = r.grade_row;
        const canEditThis = isAdmin || !gr || (Date.now() - new Date(gr.recorded_at).getTime()) <= 6 * 60 * 60 * 1000;
        const canDeleteThis = gr && (isAdmin || (Date.now() - new Date(gr.recorded_at).getTime()) <= 30 * 60 * 1000);
        return `
        <div class="person-card-row" style="padding:10px 12px;background:var(--surface);border-radius:8px;flex-wrap:wrap;gap:8px">
          <span style="font-size:12.5px;font-weight:700;min-width:140px">${escapeHtml(r.student_name)}</span>
          <input type="number" min="0" max="${assignment.max_score}" step="0.5" value="${gr && gr.score !== null ? gr.score : ''}" placeholder="الدرجة" style="width:90px" data-grade-score="${r.student_id}" ${canEditThis ? '' : 'disabled'}>
          <input type="text" value="${gr ? escapeHtml(gr.participation_note || '') : ''}" placeholder="ملاحظة" style="flex:1;min-width:120px" data-grade-note="${r.student_id}" ${canEditThis ? '' : 'disabled'}>
          <button type="button" class="btn-outline-sm" data-save-grade="${r.student_id}" ${canEditThis ? '' : 'disabled'}>حفظ</button>
          ${gr ? `<button type="button" class="btn-icon-delete" data-delete-grade="${r.student_id}" ${canDeleteThis ? '' : 'disabled'} title="حذف الرصد">${ICONS.trash()}</button>` : ''}
        </div>`;
      }).join('')}
    </div>`;

  document.getElementById('backToGradesListBtn').addEventListener('click', () => { assignmentGradesActiveId = null; renderGradesAssignmentsFilters(); });

  document.getElementById('quickMaxScoreSaveBtn').addEventListener('click', async () => {
    const maxScore = Number(document.getElementById('quickMaxScoreInput').value);
    if (!maxScore || maxScore <= 0) { showToast('أدخل درجة كلية صحيحة', 'error'); return; }
    try {
      await apiCall('academic-config', { method: 'POST', body: { action: 'updateAssignmentMaxScore', id: assignmentGradesActiveId, maxScore } });
      showToast('تم تحديث الدرجة الكلية', 'success');
      renderGradesRoster();
    } catch (e) { showToast(e.message, 'error'); }
  });

  area.querySelectorAll('[data-save-grade]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const studentId = btn.getAttribute('data-save-grade');
      const scoreInput = area.querySelector(`[data-grade-score="${studentId}"]`);
      const noteInput = area.querySelector(`[data-grade-note="${studentId}"]`);
      const score = scoreInput.value === '' ? null : Number(scoreInput.value);
      btn.disabled = true; btn.textContent = 'جارِ...';
      try {
        await apiCall('academic-config', { method: 'POST', body: { action: 'saveAssignmentGrade', assignmentId: assignmentGradesActiveId, studentId, score, participationNote: noteInput.value.trim() || null } });
        showToast('تم حفظ الدرجة', 'success');
        renderGradesRoster();
      } catch (e) { showToast(e.message, 'error'); btn.disabled = false; btn.textContent = 'حفظ'; }
    });
  });
  area.querySelectorAll('[data-delete-grade]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('حذف رصد هذا الطالب نهائياً. هل أنت متأكد؟')) return;
      try {
        await apiCall('academic-config', { method: 'POST', body: { action: 'deleteAssignmentGrade', assignmentId: assignmentGradesActiveId, studentId: btn.getAttribute('data-delete-grade') } });
        showToast('تم الحذف', 'success');
        renderGradesRoster();
      } catch (e) { showToast(e.message, 'error'); }
    });
  });
}

/* -------------------- تبويب 2: المشاركة والتفاعل -------------------- */

async function renderParticipationTab() {
  const area = document.getElementById('gradesContentArea');
  area.innerHTML = `
    <div class="field"><label>ابحث باسم الطالب</label><input type="text" id="participationStudentSearch" placeholder="اكتب اسم الطالب..."></div>
    <div id="participationSearchResults" style="margin-top:10px"></div>
    <div id="participationDetailArea" style="margin-top:16px"></div>`;

  let debounceTimer;
  document.getElementById('participationStudentSearch').addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    const query = e.target.value.trim();
    debounceTimer = setTimeout(() => searchStudentsForParticipation(query), 350);
  });
}

async function searchStudentsForParticipation(query) {
  const resultsArea = document.getElementById('participationSearchResults');
  if (!query) { resultsArea.innerHTML = ''; return; }
  resultsArea.innerHTML = `<div class="skel-rows"><div class="skel-row"></div></div>`;
  let students;
  try {
    students = await apiCall('academic-config', { method: 'POST', body: { action: 'searchStudentsForPerformance', query } });
  } catch (e) { resultsArea.innerHTML = `<p style="color:#c62828">${escapeHtml(e.message)}</p>`; return; }

  if (!students.length) { resultsArea.innerHTML = '<p style="color:#888;font-size:12.5px">لا نتائج</p>'; return; }

  resultsArea.innerHTML = students.map((s) => `
    <div class="person-card-row" style="padding:8px 10px;background:var(--surface);border-radius:8px;margin-bottom:4px;cursor:pointer" data-part-student="${s.id}" data-part-student-name="${escapeHtml(s.name_ar)}">
      <span style="font-size:12.5px;font-weight:700">${escapeHtml(s.name_ar)}</span>
      <span style="font-size:11px;color:var(--text-muted)">${escapeHtml(s.grade)}/${escapeHtml(s.section)}</span>
    </div>`).join('');

  resultsArea.querySelectorAll('[data-part-student]').forEach((row) => {
    row.addEventListener('click', () => openParticipationDetail(row.getAttribute('data-part-student'), row.getAttribute('data-part-student-name')));
  });
}

async function openParticipationDetail(studentId, studentName) {
  const area = document.getElementById('participationDetailArea');
  const settings = await getSettingsOnce();
  const isTeacher = APP.user.role === 'role_teacher';
  const subjectOptions = isTeacher ? (APP.user.subject || []) : (settings.subjects || []);

  area.innerHTML = `
    <div class="card">
      <h3 style="margin:0 0 10px">${escapeHtml(studentName)}</h3>
      <div class="af-grid-row">
        <div class="field"><label>المادة</label><select id="part_subject">${subjectOptions.map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('')}</select></div>
        <div class="field"><label>نوع التقييم (بتوزيع الدرجات)</label><select id="part_evaltype">${(settings.continuousEvalTypes || []).map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('')}</select></div>
      </div>
      <div style="display:flex;gap:10px;margin-top:10px">
        <button type="button" id="part_addPositiveBtn" style="flex:1;background:#2F7A4D">+ مشاركة إيجابية</button>
        <button type="button" id="part_addNegativeBtn" style="flex:1;background:#C4483A">− مشاركة سلبية</button>
      </div>
      <div class="field" style="margin-top:10px"><label>ملاحظة (اختياري)</label><input type="text" id="part_note" placeholder="مثال: تفاعل ممتاز بالنقاش"></div>
      <div id="participationScoreArea" style="margin-top:16px"></div>
      <div id="participationHistoryArea" style="margin-top:12px"></div>
    </div>`;

  const loadForCurrentSubject = () => loadParticipationForStudentSubject(studentId, studentName, document.getElementById('part_subject').value);

  document.getElementById('part_subject').addEventListener('change', loadForCurrentSubject);
  document.getElementById('part_addPositiveBtn').addEventListener('click', () => submitParticipationEntry(studentId, 'positive'));
  document.getElementById('part_addNegativeBtn').addEventListener('click', () => submitParticipationEntry(studentId, 'negative'));

  loadForCurrentSubject();
}

async function submitParticipationEntry(studentId, direction) {
  const subject = document.getElementById('part_subject').value;
  const evalType = document.getElementById('part_evaltype').value;
  const note = document.getElementById('part_note').value.trim();
  if (!subject || !evalType) { showToast('حدّد المادة ونوع التقييم', 'error'); return; }
  try {
    await apiCall('academic-config', { method: 'POST', body: { action: 'addParticipationEntry', studentId, subject, evalType, direction, note: note || null } });
    showToast(direction === 'positive' ? 'تم تسجيل مشاركة إيجابية' : 'تم تسجيل مشاركة سلبية', 'success');
    document.getElementById('part_note').value = '';
    loadParticipationForStudentSubject(studentId, null, subject);
  } catch (e) { showToast(e.message, 'error'); }
}

async function loadParticipationForStudentSubject(studentId, studentName, subject) {
  const scoreArea = document.getElementById('participationScoreArea');
  const historyArea = document.getElementById('participationHistoryArea');
  scoreArea.innerHTML = `<div class="skel-rows"><div class="skel-row"></div></div>`;
  historyArea.innerHTML = '';

  let log, report;
  try {
    [log, report] = await Promise.all([
      apiCall('academic-config', { method: 'POST', body: { action: 'listParticipationLog', studentId, subject } }),
      apiCall('academic-config', { method: 'POST', body: { action: 'getStudentPerformanceReport', studentId } }),
    ]);
  } catch (e) { scoreArea.innerHTML = `<p style="color:#c62828">${escapeHtml(e.message)}</p>`; return; }

  const subjectGrade = (report.grades || []).find((g) => g.subject === subject);
  const participationBucket = subjectGrade ? (subjectGrade.breakdown || []).find((b) => b.source === 'participation') : null;

  scoreArea.innerHTML = participationBucket
    ? `<div class="perf-stats-row">
        <div class="perf-stat-box"><span class="perf-stat-value" style="color:#2F7A4D">${participationBucket.positiveCount}</span><span class="perf-stat-label">إيجابي</span></div>
        <div class="perf-stat-box"><span class="perf-stat-value" style="color:#C4483A">${participationBucket.negativeCount}</span><span class="perf-stat-label">سلبي</span></div>
        <div class="perf-stat-box"><span class="perf-stat-value">${participationBucket.contribution} / ${participationBucket.weight}</span><span class="perf-stat-label">الدرجة المستحقة</span></div>
      </div>`
    : '<p style="color:#888;font-size:12px">لا يوجد نوع تقييم مطابق بتوزيع درجات هذي المادة بعد — أضِف نوع التقييم بالإعدادات أولاً</p>';

  historyArea.innerHTML = `
    <div class="filter-card-title">السجل</div>
    ${log.length ? log.map((entry) => `
      <div class="person-card-row" style="padding:8px 10px;background:var(--surface);border-radius:8px;margin-top:6px">
        <span style="font-size:12px">${entry.direction === 'positive' ? '🟢 إيجابي' : '🔴 سلبي'} — ${escapeHtml(entry.eval_type)}${entry.note ? ' — ' + escapeHtml(entry.note) : ''}</span>
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:11px;color:var(--text-muted)">${new Date(entry.recorded_at).toLocaleString('ar-SA-u-ca-gregory')}</span>
          <button type="button" class="btn-icon-delete" data-delete-part="${entry.id}" title="حذف">${ICONS.trash()}</button>
        </div>
      </div>`).join('') : '<p style="color:#888;font-size:12px;margin-top:6px">لا يوجد سجل بعد لهذي المادة</p>'}`;

  historyArea.querySelectorAll('[data-delete-part]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('حذف هذا القيد نهائياً. هل أنت متأكد؟')) return;
      try {
        await apiCall('academic-config', { method: 'POST', body: { action: 'deleteParticipationEntry', id: btn.getAttribute('data-delete-part') } });
        showToast('تم الحذف', 'success');
        loadParticipationForStudentSubject(studentId, studentName, subject);
      } catch (e) { showToast(e.message, 'error'); }
    });
  });
}

/* ===================== 🆕 صفحة أداء الطلاب (تقارير — كل الصلاحيات بحدود مختلفة) ===================== */
// أدمن: بلا قيد. مراقب فروع: فروعه. مشرف معلمين/مشرف طلاب: فرعهم فقط.
// معلم: فرعه + الصف/الشعبة اللي يدرّسهم فقط. الخادم هو من يفرض النطاق
// الحقيقي بكل استعلام — الواجهة هنا فقط لسهولة الاستخدام.

let perfViewMode = 'student'; // 🆕 'student' | 'class'

async function renderStudentPerformanceView() {
  const main = document.getElementById('mainContent');
  main.innerHTML = `
    <div class="card">
      <h2 style="margin:0 0 4px">أداء الطلاب</h2>
      <p style="color:#888;font-size:12px;margin:0 0 16px">تقرير فردي لطالب، أو ملخّص لصف/شعبة كاملة</p>
      <div class="segmented-control" id="perfModeTabBar" style="margin-bottom:16px">
        <button type="button" class="segmented-item ${perfViewMode === 'student' ? 'active' : ''}" data-perf-mode="student">تقرير طالب</button>
        <button type="button" class="segmented-item ${perfViewMode === 'class' ? 'active' : ''}" data-perf-mode="class">ملخّص صف/شعبة</button>
      </div>
      <div id="perfContentArea"></div>
    </div>`;

  document.querySelectorAll('#perfModeTabBar .segmented-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      perfViewMode = btn.getAttribute('data-perf-mode');
      document.querySelectorAll('#perfModeTabBar .segmented-item').forEach((b) => b.classList.toggle('active', b === btn));
      renderPerformanceContent();
    });
  });

  renderPerformanceContent();
}

function renderPerformanceContent() {
  const area = document.getElementById('perfContentArea');
  if (perfViewMode === 'class') renderClassPerformanceSearch(area);
  else renderStudentPerformanceSearch(area);
}

/* -------------------- تقرير طالب فردي -------------------- */

function renderStudentPerformanceSearch(area) {
  area.innerHTML = `
    <div class="field"><label>ابحث باسم الطالب</label><input type="text" id="perfStudentSearch" placeholder="اكتب اسم الطالب..."></div>
    <div id="perfStudentResults" style="margin-top:10px"></div>
    <div id="perfStudentReportArea" style="margin-top:16px"></div>`;

  let debounceTimer;
  document.getElementById('perfStudentSearch').addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    const query = e.target.value.trim();
    debounceTimer = setTimeout(() => searchStudentsForPerformance(query), 350);
  });
}

async function searchStudentsForPerformance(query) {
  const resultsArea = document.getElementById('perfStudentResults');
  if (!query) { resultsArea.innerHTML = ''; return; }
  resultsArea.innerHTML = `<div class="skel-rows"><div class="skel-row"></div></div>`;
  let students;
  try {
    students = await apiCall('academic-config', { method: 'POST', body: { action: 'searchStudentsForPerformance', query } });
  } catch (e) { resultsArea.innerHTML = `<p style="color:#c62828">${escapeHtml(e.message)}</p>`; return; }

  if (!students.length) { resultsArea.innerHTML = '<p style="color:#888;font-size:12.5px">لا نتائج</p>'; return; }

  resultsArea.innerHTML = students.map((s) => `
    <div class="person-card-row" style="padding:8px 10px;background:var(--surface);border-radius:8px;margin-bottom:4px;cursor:pointer" data-perf-student="${s.id}">
      <span style="font-size:12.5px;font-weight:700">${escapeHtml(s.name_ar)}</span>
      <span style="font-size:11px;color:var(--text-muted)">${escapeHtml(s.grade)}/${escapeHtml(s.section)} — ${escapeHtml(s.branch)}</span>
    </div>`).join('');

  resultsArea.querySelectorAll('[data-perf-student]').forEach((row) => {
    row.addEventListener('click', () => loadStudentPerformanceReport(row.getAttribute('data-perf-student')));
  });
}

async function loadStudentPerformanceReport(studentId) {
  const reportArea = document.getElementById('perfStudentReportArea');
  reportArea.innerHTML = `<div class="skel-rows"><div class="skel-row"></div></div>`;
  let payload;
  try {
    payload = await apiCall('academic-config', { method: 'POST', body: { action: 'getStudentPerformanceReport', studentId } });
  } catch (e) { reportArea.innerHTML = `<p style="color:#c62828">${escapeHtml(e.message)}</p>`; return; }

  const { student, grades, behaviorSummary, attendanceSummary } = payload;
  const avgGrade = grades.length ? Math.round((grades.reduce((sum, g) => sum + Number(g.final_grade), 0) / grades.length) * 100) / 100 : null;

  reportArea.innerHTML = `
    <div class="card">
      <h3 style="margin:0 0 4px">${escapeHtml(student.name)}</h3>
      <p style="color:#888;font-size:12px;margin:0 0 14px">${escapeHtml(student.grade)}/${escapeHtml(student.section)} — ${escapeHtml(student.branch)}</p>

      <div class="perf-stats-row">
        <div class="perf-stat-box"><span class="perf-stat-value">${avgGrade !== null ? avgGrade : '—'}</span><span class="perf-stat-label">متوسط الدرجات</span></div>
        <div class="perf-stat-box"><span class="perf-stat-value" style="color:#2F7A4D">${behaviorSummary.positivePoints}</span><span class="perf-stat-label">نقاط سلوك إيجابي</span></div>
        <div class="perf-stat-box"><span class="perf-stat-value" style="color:#C4483A">${behaviorSummary.negativePoints}</span><span class="perf-stat-label">نقاط سلوك سلبي</span></div>
      </div>

      <div class="filter-card-title" style="margin-top:16px">الدرجات حسب المادة</div>
      ${grades.length ? `
        <div style="display:flex;flex-direction:column;gap:6px;margin-top:8px">
          ${grades.map((g) => `
            <div class="person-card-row" style="padding:8px 10px;background:var(--surface);border-radius:8px">
              <span style="font-size:12.5px;font-weight:700">${escapeHtml(g.subject)}</span>
              <span style="font-size:12.5px;font-weight:800">${g.final_grade} / 100</span>
            </div>`).join('')}
        </div>` : '<p style="color:#888;font-size:12.5px;margin-top:8px">لا توجد درجات محسوبة بعد</p>'}

      <div class="filter-card-title" style="margin-top:16px">الحضور</div>
      <div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:8px;font-size:12.5px;color:var(--text-muted)">
        ${Object.entries(attendanceSummary).map(([status, count]) => `<span>${escapeHtml(status)}: <strong style="color:var(--text)">${count}</strong></span>`).join('') || '<span>لا يوجد سجل حضور بعد</span>'}
      </div>

      <button type="button" id="openStudentReportShellBtn" style="width:100%;margin-top:16px">${ICONS.plus()} إصدار تقرير احترافي</button>
    </div>`;

  document.getElementById('openStudentReportShellBtn').addEventListener('click', () => {
    const attendanceSegments = Object.entries(attendanceSummary).map(([status, count], i) => ({
      label: status, value: count, color: ['#2F7A4D', '#C4483A', '#B8860B', '#7B5FB8', '#3E7CB1'][i % 5],
    }));
    const contentHtml = `
      <div class="report-stats-row">
        <div class="report-stat-box"><div style="font-size:32px;font-weight:800;color:var(--primary)">${avgGrade !== null ? avgGrade : '—'}</div><div style="font-size:11.5px;color:var(--text-muted)">متوسط الدرجات</div></div>
        <div class="report-stat-box"><div style="font-size:32px;font-weight:800;color:#2F7A4D">${behaviorSummary.positivePoints}</div><div style="font-size:11.5px;color:var(--text-muted)">نقاط سلوك إيجابي</div></div>
        <div class="report-stat-box"><div style="font-size:32px;font-weight:800;color:#C4483A">${behaviorSummary.negativePoints}</div><div style="font-size:11.5px;color:var(--text-muted)">نقاط سلوك سلبي</div></div>
      </div>
      <h3 style="margin-top:24px">الدرجات حسب المادة</h3>
      ${grades.length ? renderBarChartSVG(grades.map((g) => ({ label: g.subject, value: Number(g.final_grade) })), '#3E7CB1') : '<p style="color:#888">لا توجد درجات محسوبة بعد</p>'}
      <h3 style="margin-top:24px">توزيع الحضور</h3>
      ${attendanceSegments.length ? renderDonutChartSVG(attendanceSegments) : '<p style="color:#888">لا يوجد سجل حضور بعد</p>'}`;

    showProfessionalReportShell({ title: `تقرير أداء الطالب — ${student.name}`, branchLabel: student.branch, contentHtml });
  });
}

/* -------------------- ملخّص صف/شعبة كامل -------------------- */

async function renderClassPerformanceSearch(area) {
  const settings = await getSettingsOnce();
  const isAdmin = APP.user.role === 'role_admin';
  const isBranchMonitor = APP.user.role === 'role_branch_monitor';
  const isTeacher = APP.user.role === 'role_teacher';

  const branchOptions = isAdmin ? (settings.branches || []) : isBranchMonitor ? (APP.user.allBranches || []) : [APP.user.branch];
  const gradeOptions = isTeacher ? (APP.user.grades || []) : (settings.grades || []);
  const sectionOptions = isTeacher ? (APP.user.sections || []) : (settings.sections || []);

  area.innerHTML = `
    <div class="af-grid-row">
      <div class="field"><label>الفرع</label><select id="perfClassBranch">${branchOptions.map((b) => `<option value="${escapeHtml(b)}">${escapeHtml(b)}</option>`).join('')}</select></div>
      <div class="field"><label>المرحلة</label><select id="perfClassStage">${(isTeacher && APP.user.stage ? [APP.user.stage] : (settings.stages || [])).map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('')}</select></div>
      <div class="field"><label>الصف</label><select id="perfClassGrade">${gradeOptions.map((g) => `<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`).join('')}</select></div>
      <div class="field"><label>الشعبة</label><select id="perfClassSection">${sectionOptions.map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('')}</select></div>
    </div>
    <button type="button" id="perfClassLoadBtn" style="margin-top:12px">عرض الملخّص</button>
    <div id="perfClassSummaryArea" style="margin-top:16px"></div>`;

  document.getElementById('perfClassLoadBtn').addEventListener('click', loadClassPerformanceSummary);
}

async function loadClassPerformanceSummary() {
  const summaryArea = document.getElementById('perfClassSummaryArea');
  summaryArea.innerHTML = `<div class="skel-rows"><div class="skel-row"></div></div>`;
  const body = {
    action: 'getClassPerformanceSummary',
    branch: document.getElementById('perfClassBranch').value,
    stage: document.getElementById('perfClassStage').value,
    grade: document.getElementById('perfClassGrade').value,
    section: document.getElementById('perfClassSection').value,
  };
  let payload;
  try {
    payload = await apiCall('academic-config', { method: 'POST', body });
  } catch (e) { summaryArea.innerHTML = `<p style="color:#c62828">${escapeHtml(e.message)}</p>`; return; }

  const { subjects, roster } = payload;
  if (!roster.length) { summaryArea.innerHTML = '<p style="color:#888">لا يوجد طلاب بهذا الصف/الشعبة</p>'; return; }

  summaryArea.innerHTML = `
    <div class="schedule-grid-wrap">
      <table class="schedule-table">
        <thead><tr><th>الطالب</th>${subjects.map((s) => `<th>${escapeHtml(s)}</th>`).join('')}<th>المتوسط</th></tr></thead>
        <tbody>
          ${roster.map((r) => `
            <tr>
              <td class="schedule-period-label" style="text-align:right">${escapeHtml(r.studentName)}</td>
              ${subjects.map((s) => `<td class="schedule-cell">${r.bySubject[s] !== undefined ? r.bySubject[s] : '—'}</td>`).join('')}
              <td class="schedule-cell" style="font-weight:800">${r.average !== null ? r.average : '—'}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <button type="button" id="openClassReportShellBtn" style="width:100%;margin-top:14px">${ICONS.plus()} إصدار تقرير احترافي</button>`;

  document.getElementById('openClassReportShellBtn').addEventListener('click', () => {
    const classAverages = roster.filter((r) => r.average !== null);
    const classAvg = classAverages.length ? Math.round((classAverages.reduce((s, r) => s + r.average, 0) / classAverages.length) * 100) / 100 : null;
    const contentHtml = `
      <div class="report-stats-row">
        <div class="report-stat-box"><div style="font-size:32px;font-weight:800;color:var(--primary)">${roster.length}</div><div style="font-size:11.5px;color:var(--text-muted)">عدد الطلاب</div></div>
        <div class="report-stat-box"><div style="font-size:32px;font-weight:800;color:var(--primary)">${classAvg !== null ? classAvg : '—'}</div><div style="font-size:11.5px;color:var(--text-muted)">متوسط الصف العام</div></div>
      </div>
      <h3 style="margin-top:24px">ترتيب الطلاب حسب المتوسط</h3>
      ${renderBarChartSVG([...classAverages].sort((a, b) => b.average - a.average).map((r) => ({ label: r.studentName, value: r.average })), '#3E7CB1')}
      <h3 style="margin-top:24px">جدول الدرجات التفصيلي</h3>
      <div class="schedule-grid-wrap">
        <table class="schedule-table">
          <thead><tr><th>الطالب</th>${subjects.map((s) => `<th>${escapeHtml(s)}</th>`).join('')}<th>المتوسط</th></tr></thead>
          <tbody>
            ${roster.map((r) => `
              <tr>
                <td class="schedule-period-label" style="text-align:right">${escapeHtml(r.studentName)}</td>
                ${subjects.map((s) => `<td class="schedule-cell">${r.bySubject[s] !== undefined ? r.bySubject[s] : '—'}</td>`).join('')}
                <td class="schedule-cell" style="font-weight:800">${r.average !== null ? r.average : '—'}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;

    const branch = document.getElementById('perfClassBranch').value;
    const grade = document.getElementById('perfClassGrade').value;
    const section = document.getElementById('perfClassSection').value;
    showProfessionalReportShell({ title: `تقرير أداء الصف ${grade} / ${section}`, branchLabel: branch, contentHtml });
  });
}

/* ===================== 🆕 صفحة إحصائيات التسجيل (أدمن + إدارة القبول) ===================== */
// أدمن: كل الفروع (طلاب + أولياء أمور + موظفون). إدارة القبول
// (Admission): طلاب فرعها فقط. صفحة عرض فقط — بلا أي تعديل — مع زر
// إصدار تقرير احترافي يستخدم نفس قشرة التقارير الموحَّدة.

async function renderRegistrationStatsView() {
  const main = document.getElementById('mainContent');
  main.innerHTML = `<div class="card"><div class="skel-rows"><div class="skel-row"></div></div></div>`;

  let stats;
  try {
    stats = await apiCall('academic-config', { method: 'POST', body: { action: 'getRegistrationStats' } });
  } catch (e) { main.innerHTML = `<div class="card"><p style="color:#c62828">${escapeHtml(e.message)}</p></div>`; return; }

  const isAdmin = APP.user.role === 'role_admin';

  main.innerHTML = `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:16px">
        <h2 style="margin:0">إحصائيات التسجيل</h2>
        <button type="button" id="openStatsReportBtn">${ICONS.plus()} إصدار تقرير احترافي</button>
      </div>

      <div class="kpi-cards-row">
        <div class="kpi-card"><div class="kpi-card-label">إجمالي الطلاب</div><div class="kpi-card-value">${stats.totalStudents}</div></div>
        ${isAdmin ? `
          <div class="kpi-card"><div class="kpi-card-label">إجمالي أولياء الأمور</div><div class="kpi-card-value">${stats.totalParents}</div></div>
          <div class="kpi-card"><div class="kpi-card-label">إجمالي الموظفين</div><div class="kpi-card-value">${stats.totalEmployees}</div></div>` : ''}
      </div>

      ${isAdmin ? `<h3 style="margin-top:24px">الطلاب حسب الفرع</h3>${renderBarChartSVG(stats.studentsByBranch.map((r) => ({ label: r.label, value: r.count })), '#3E7CB1')}` : ''}

      <h3 style="margin-top:24px">الطلاب حسب الصف${isAdmin ? '' : ' (فرعك)'}</h3>
      ${renderBarChartSVG(stats.studentsByGrade.map((r) => ({ label: r.label, value: r.count })), '#7B5FB8')}

      <h3 style="margin-top:24px">حالة السداد</h3>
      ${renderDonutChartSVG(stats.feeStatusBreakdown.map((r, i) => ({ label: r.label, value: r.count, color: ['#2F7A4D', '#C4483A', '#B8860B'][i % 3] })))}

      ${isAdmin ? `
        <h3 style="margin-top:24px">الموظفون حسب الفرع</h3>
        ${renderBarChartSVG(stats.employeesByBranch.map((r) => ({ label: r.label, value: r.count })), '#3E7CB1')}
        <h3 style="margin-top:24px">الموظفون حسب الدور</h3>
        ${renderBarChartSVG(stats.employeesByRole.map((r) => ({ label: ROLE_LABELS_AR[r.label] || r.label, value: r.count })), '#7B5FB8')}
        <h3 style="margin-top:24px">أولياء الأمور حسب الفرع</h3>
        ${renderBarChartSVG(stats.parentsByBranch.map((r) => ({ label: r.label, value: r.count })), '#B8860B')}` : ''}
    </div>`;

  document.getElementById('openStatsReportBtn').addEventListener('click', () => {
    const contentHtml = `
      <div class="report-stats-row">
        <div class="report-stat-box"><div style="font-size:32px;font-weight:800;color:var(--primary)">${stats.totalStudents}</div><div style="font-size:11.5px;color:var(--text-muted)">إجمالي الطلاب</div></div>
        ${isAdmin ? `
          <div class="report-stat-box"><div style="font-size:32px;font-weight:800;color:var(--primary)">${stats.totalParents}</div><div style="font-size:11.5px;color:var(--text-muted)">أولياء الأمور</div></div>
          <div class="report-stat-box"><div style="font-size:32px;font-weight:800;color:var(--primary)">${stats.totalEmployees}</div><div style="font-size:11.5px;color:var(--text-muted)">الموظفون</div></div>` : ''}
      </div>
      ${isAdmin ? `<h3 style="margin-top:24px">الطلاب حسب الفرع</h3>${renderBarChartSVG(stats.studentsByBranch.map((r) => ({ label: r.label, value: r.count })), '#3E7CB1')}` : ''}
      <h3 style="margin-top:24px">الطلاب حسب الصف</h3>
      ${renderBarChartSVG(stats.studentsByGrade.map((r) => ({ label: r.label, value: r.count })), '#7B5FB8')}
      <h3 style="margin-top:24px">حالة السداد</h3>
      ${renderDonutChartSVG(stats.feeStatusBreakdown.map((r, i) => ({ label: r.label, value: r.count, color: ['#2F7A4D', '#C4483A', '#B8860B'][i % 3] })))}`;

    showProfessionalReportShell({ title: 'تقرير إحصائيات التسجيل', branchLabel: isAdmin ? 'كل الفروع' : APP.user.branch, contentHtml });
  });
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
