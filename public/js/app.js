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
  home: { label: 'الرئيسية', icon: 'home', render: renderHomeView },
  employees: { label: 'الموظفون', icon: 'employees', render: renderEmployeesView },
  students: { label: 'الطلاب', icon: 'students', render: renderStudentsView },
  parents: { label: 'أولياء الأمور', icon: 'guardians', render: renderParentsView },
  familyAccounts: { label: 'حسابات الطلاب والأسر', icon: 'lock', render: renderFamilyAccountsView },
  users: { label: 'المستخدمون', icon: 'users', render: renderUsersView },
  siteSettings: { label: 'إعدادات الموقع', icon: 'settingsGear', render: renderSiteSettingsView },
  subjectMatrix: { label: 'توزيع المواد', icon: 'tasks', render: renderSubjectMatrixView },
  gradeDistribution: { label: 'توزيع الدرجات', icon: 'tasks', render: renderGradeDistributionView },
  auditLog: { label: 'سجل التتبّع', icon: 'lock', render: renderAuditLogView },
};

/** 🆕 صلاحيات كل دور — مطابقة تماماً لمنطق ROLE_PAGES بمشروع GAS الأصلي،
 * لكن مقتصرة على الصفحات المبنية فعلياً بهذا المشروع حتى الآن. أي دور
 * غير مذكور هنا (أو صفحة لم تُبنَ بعد لدوره) يحصل تلقائياً على "الرئيسية" فقط. */
const ROLE_PAGES = {
  role_admin: ['home', 'employees', 'students', 'parents', 'familyAccounts', 'users', 'siteSettings', 'subjectMatrix', 'gradeDistribution', 'auditLog'],
  role_teacher: ['home'],
  role_teacher_sup: ['home'],
  role_student_sup: ['home', 'students', 'parents', 'familyAccounts'],
  Admission: ['home', 'students', 'parents', 'familyAccounts'],
  role_branch_monitor: ['home'],
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

/* ===================== صفحة إعدادات الموقع ===================== */

// 🆕 تجميع الـ13 قائمة بـ4 فئات منطقية — بدل 13 بطاقة مكدَّسة، تبويبات نظيفة
const SETTINGS_TAB_GROUPS = [
  { key: 'academic', label: 'الهيكل الأكاديمي', lists: ['branches', 'stages', 'grades', 'sections', 'subjects'] },
  { key: 'accounts', label: 'الحسابات والأدوار', lists: ['userTypes', 'roles', 'accountStatuses'] },
  { key: 'attendance', label: 'الحضور والسلوك', lists: ['attendanceStatuses', 'behaviorStatuses'] },
  { key: 'evaluation', label: 'التقييم والاختبارات', lists: ['terms', 'continuousEvalTypes', 'exams'] },
];

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

let siteSettingsListsState = {};
let siteSettingsActiveTab = 'academic';

async function renderSiteSettingsView() {
  const main = document.getElementById('mainContent');
  main.innerHTML = `<div class="card"><div class="skel-rows"><div class="skel-row"></div><div class="skel-row"></div></div></div>`;

  cachedSettings = null;
  const settings = await getSettingsOnce();
  siteSettingsListsState = {};
  SETTINGS_LIST_KEYS.forEach((k) => { siteSettingsListsState[k.camel] = [...(settings[k.camel] || [])]; });

  main.innerHTML = `
    <div class="card">
      <h2>اسم المدرسة والشعار</h2>
      <div class="field"><label>اسم المدرسة</label><input id="ss_schoolName" type="text" value="${escapeHtml(settings.schoolName || '')}"></div>
      <div class="field"><label>رابط الشعار</label><input id="ss_logoUrl" type="text" value="${escapeHtml(settings.logoUrl || '')}"></div>
      <button type="button" id="saveSiteInfoBtn">حفظ</button>
    </div>

    <div class="card">
      <div class="segmented-control" id="settingsTabBar" style="margin-bottom:18px;flex-wrap:wrap">
        ${SETTINGS_TAB_GROUPS.map((g) => `<button type="button" class="segmented-item ${g.key === siteSettingsActiveTab ? 'active' : ''}" data-tab="${g.key}">${escapeHtml(g.label)}</button>`).join('')}
      </div>
      <div id="settingsTabContent"></div>
    </div>`;

  document.getElementById('saveSiteInfoBtn').addEventListener('click', saveSiteInfoHandler);
  document.querySelectorAll('#settingsTabBar .segmented-item').forEach((btn) => {
    btn.addEventListener('click', () => { siteSettingsActiveTab = btn.getAttribute('data-tab'); renderSiteSettingsView_tabContent(); });
  });

  renderSiteSettingsView_tabContent();
}

function renderSiteSettingsView_tabContent() {
  document.querySelectorAll('#settingsTabBar .segmented-item').forEach((b) => b.classList.toggle('active', b.getAttribute('data-tab') === siteSettingsActiveTab));

  const group = SETTINGS_TAB_GROUPS.find((g) => g.key === siteSettingsActiveTab);
  const content = document.getElementById('settingsTabContent');
  content.innerHTML = group.lists.map((camel) => {
    const k = SETTINGS_LIST_KEYS.find((x) => x.camel === camel);
    return `
      <div style="margin-bottom:24px">
        <div class="filter-card-title" style="margin-top:0">${escapeHtml(k.label)}</div>
        <div class="student-chip-list" id="ssList_${k.camel}" style="margin-bottom:10px"></div>
        <div class="student-search-input-wrap">
          <input type="text" id="ssAdd_${k.camel}" placeholder="أضف قيمة جديدة واضغط Enter">
        </div>
        <button type="button" data-save-list="${k.camel}" data-snake="${k.snake}" class="btn-outline-sm" style="margin-top:10px">حفظ ${escapeHtml(k.label)}</button>
      </div>`;
  }).join('');

  group.lists.forEach((camel) => {
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
    await apiCall('settings', {
      method: 'POST',
      body: { action: 'updateSite', schoolName: document.getElementById('ss_schoolName').value.trim(), logoUrl: document.getElementById('ss_logoUrl').value.trim() },
    });
    showToast('تم حفظ بيانات المدرسة بنجاح', 'success');
    cachedSettings = null;
  } catch (e) {
    showToast(e.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'حفظ';
  }
}

async function saveSettingsListHandler(camelKey, snakeKey) {
  const values = siteSettingsListsState[camelKey];
  if (!values.length) { showToast('يجب إدخال قيمة واحدة على الأقل', 'error'); return; }
  try {
    await apiCall('settings', { method: 'POST', body: { action: 'updateList', listKey: snakeKey, values } });
    showToast('تم الحفظ بنجاح', 'success');
    cachedSettings = null;
  } catch (e) {
    showToast(e.message, 'error');
  }
}

/* ===================== صفحة توزيع المواد (احترافية — اختيار متعدد) ===================== */

async function renderSubjectMatrixView() {
  const main = document.getElementById('mainContent');
  main.innerHTML = `<div class="card"><div class="skel-rows"><div class="skel-row"></div></div></div>`;
  const settings = await getSettingsOnce();

  main.innerHTML = `
    <div class="card">
      <h2>إضافة توزيع مواد</h2>
      <p style="color:#888;font-size:12.5px;margin-top:-10px">اختر الفرع/الصف/الشعبة، ثم حدّد كل المواد التي تُدرَّس لها دفعة واحدة</p>
      <div class="field"><label>الفرع</label><select id="sm_branch">${settings.branches.map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('')}</select></div>
      <div class="field"><label>الصف</label><select id="sm_grade">${settings.grades.map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('')}</select></div>
      <div class="field"><label>الشعبة</label><select id="sm_section">${settings.sections.map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('')}</select></div>
      <div class="filter-card-title">المواد (اختر كل ما ينطبق)</div>
      <div class="checkbox-list" id="sm_subjectsBox">${scopeCheckboxesHtml(settings.subjects, [], 'sm-subject-cb')}</div>
      <button type="button" id="addMatrixBtn" style="margin-top:14px">حفظ التوزيع</button>
    </div>
    <div class="card">
      <h3>التوزيعات الحالية</h3>
      <div class="field"><label>بحث بالفرع أو الصف أو المادة</label><input id="matrixSearchInput" type="text"></div>
      <div id="matrixListArea"><div class="skel-rows"><div class="skel-row"></div></div></div>
    </div>`;

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
  try {
    APP.allMatrixEntries = await apiCall('academic-config', { method: 'POST', body: { action: 'listMatrix' } });
    renderMatrixTable();
  } catch (e) { area.innerHTML = `<p style="color:#c62828">${escapeHtml(e.message)}</p>`; }
}

function renderMatrixTable() {
  const area = document.getElementById('matrixListArea');
  const q = (document.getElementById('matrixSearchInput').value || '').trim().toLowerCase();
  // 🆕 نجمّع حسب الفرع/الصف/الشعبة — بطاقة واحدة تعرض كل موادها معاً بدل سطر لكل مادة
  const groups = {};
  APP.allMatrixEntries.forEach((r) => {
    const key = `${r.branch}|${r.grade}|${r.section}`;
    (groups[key] = groups[key] || { branch: r.branch, grade: r.grade, section: r.section, items: [] }).items.push(r);
  });
  const groupList = Object.values(groups).filter((g) =>
    !q || g.branch.toLowerCase().includes(q) || g.grade.toLowerCase().includes(q) || g.items.some((i) => i.subject.toLowerCase().includes(q))
  );

  if (!groupList.length) { area.innerHTML = '<p style="color:#888">لا توجد توزيعات مطابقة</p>'; return; }

  area.innerHTML = groupList.map((g) => `
    <div class="card" style="background:var(--surface);box-shadow:none;margin-bottom:10px">
      <div style="font-weight:800;font-size:13.5px;margin-bottom:8px">${escapeHtml(g.branch)} — ${escapeHtml(g.grade)} — ${escapeHtml(g.section)}</div>
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

/* ===================== صفحة توزيع الدرجات (بطاقة ذكية — حساب مجموع فوري) ===================== */

let gradeDistCurrentEntries = [];

async function renderGradeDistributionView() {
  const main = document.getElementById('mainContent');
  main.innerHTML = `<div class="card"><div class="skel-rows"><div class="skel-row"></div></div></div>`;
  const settings = await getSettingsOnce();
  const evalTypes = [...(settings.continuousEvalTypes || []), ...(settings.exams || [])];
  APP.allGradeDist = await apiCall('academic-config', { method: 'POST', body: { action: 'listGradeDist' } });

  main.innerHTML = `
    <div class="card">
      <h2>توزيع درجات مادة</h2>
      <p style="color:#888;font-size:12.5px;margin-top:-10px">اختر المادة، ثم أضف كل أنواع التقييم ودرجاتها — المجموع يُحسَب تلقائياً</p>
      <div class="field"><label>المادة</label>
        <select id="gd_subject">
          <option value="" disabled selected>-- اختر مادة --</option>
          ${settings.subjects.map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="card" id="gradeDistCardBox" style="display:none">
      <h3 id="gd_cardTitle"></h3>
      <div id="gd_entriesArea"></div>
      <div style="display:flex;gap:8px;margin:14px 0;align-items:flex-end">
        <div class="field" style="flex:2;margin-bottom:0"><label>نوع التقييم</label>
          <select id="gd_newEvalType">${evalTypes.map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('')}</select>
        </div>
        <div class="field" style="flex:1;margin-bottom:0"><label>الدرجة</label><input type="number" id="gd_newScore" min="0" max="100" step="0.5" value="10"></div>
        <button type="button" id="gd_addEntryBtn" style="width:auto;flex-shrink:0">${ICONS.plus()}</button>
      </div>
      <div id="gd_totalBox" class="modal-detail-row" style="border-top:2px solid var(--outline);padding-top:12px"></div>
      <button type="button" id="gd_saveBtn" style="margin-top:14px;width:100%">حفظ توزيع هذي المادة</button>
    </div>`;

  document.getElementById('gd_subject').addEventListener('change', (e) => {
    const subject = e.target.value;
    gradeDistCurrentEntries = APP.allGradeDist
      .filter((r) => r.subject === subject)
      .map((r) => ({ evalType: r.eval_type, maxScore: Number(r.max_score) }));
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
      await apiCall('academic-config', {
        method: 'POST',
        body: { action: 'saveGradeDistForSubject', subject: document.getElementById('gd_subject').value, entries: gradeDistCurrentEntries },
      });
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
        <span class="modal-detail-value" style="display:flex;align-items:center;gap:8px">${e.maxScore}
          <span data-remove-entry="${i}" style="cursor:pointer;color:#c62828">${ICONS.close()}</span>
        </span>
      </div>`).join('')
    : '<p style="color:#aaa;font-size:12.5px">لا توجد تقييمات مضافة بعد</p>';

  area.querySelectorAll('[data-remove-entry]').forEach((el) => {
    el.addEventListener('click', () => {
      gradeDistCurrentEntries.splice(Number(el.getAttribute('data-remove-entry')), 1);
      renderGradeDistEntries();
    });
  });

  const total = gradeDistCurrentEntries.reduce((s, e) => s + e.maxScore, 0);
  const over = total > 100;
  document.getElementById('gd_totalBox').innerHTML = `
    <span class="modal-detail-label">المجموع</span>
    <span class="modal-detail-value" style="color:${over ? '#C4483A' : '#2F7A4D'};font-size:15px">
      ${total} / 100 ${over ? '⚠️ تجاوز الحد!' : ''}
    </span>`;
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
      <span style="font-size:11px;color:var(--text-muted);white-space:nowrap">${new Date(r.timestamp).toLocaleString('ar')}</span>
    </div>`).join('');
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
