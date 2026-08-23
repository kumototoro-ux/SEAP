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
  users: { label: 'المستخدمون', icon: 'users', render: renderUsersView },
};

/** 🆕 صلاحيات كل دور — بنفس فلسفة ROLE_PAGES بمشروع GAS بالضبط */
const ROLE_PAGES = {
  role_admin: ['home', 'employees', 'students', 'users'],
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
    <div class="card">
      <h2>حسابات الموظفين</h2>
      <div class="field"><label>بحث بالاسم أو اسم المستخدم</label><input id="userSearchInput" type="text"></div>
      <div id="usersListArea"><div class="skel-rows"><div class="skel-row"></div><div class="skel-row"></div></div></div>
    </div>`;

  document.getElementById('userSearchInput').addEventListener('input', renderUsersTable);
  loadUsersList();
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
