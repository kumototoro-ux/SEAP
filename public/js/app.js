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
  employees: { label: '👩‍🏫 الموظفون', render: renderEmployeesView },
};

/** 🆕 صلاحيات كل دور — بنفس فلسفة ROLE_PAGES بمشروع GAS بالضبط */
const ROLE_PAGES = {
  role_admin: ['home', 'employees'],
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

/* ===================== صفحة الموظفين ===================== */

let cachedSettings = null;

async function getSettingsOnce() {
  if (!cachedSettings) cachedSettings = await apiCall('get-settings', { requiresAuth: false });
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
    <div class="card" id="empFormCard">
      <h2 id="empFormTitle">➕ إضافة موظف جديد</h2>
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
        <div class="filter-card-title">🏢 الفرع/الفروع * (يمكن اختيار أكثر من فرع)</div>
        <div class="checkbox-list" id="emp_branchesBox">${branchCheckboxesHtml(settings.branches, [], 'emp')}</div>

        <div id="emp_teacherScopeBox" style="display:none">
          <div class="filter-card-title">📚 نطاق المعلم — الصفوف</div>
          <div class="checkbox-list" id="emp_gradesBox">${scopeCheckboxesHtml(settings.grades, [], 'emp-grade-cb')}</div>
          <div class="filter-card-title">🏫 الشعب</div>
          <div class="checkbox-list" id="emp_sectionsBox">${scopeCheckboxesHtml(settings.sections, [], 'emp-section-cb')}</div>
          <div class="filter-card-title">📖 المواد</div>
          <div class="checkbox-list" id="emp_subjectsBox">${scopeCheckboxesHtml(settings.subjects, [], 'emp-subject-cb')}</div>
        </div>

        <button type="submit" id="addEmpBtn" style="margin-top:14px">إضافة الموظف</button>
        <button type="button" id="cancelEditBtn" style="display:none;background:#888;margin-top:8px">إلغاء التعديل</button>
      </form>
    </div>

    <div class="card">
      <h3>قائمة الموظفين</h3>
      <div class="field"><label>🔍 بحث بالاسم أو الدور أو الفرع</label><input id="empSearchInput" type="text"></div>
      <div id="empListArea"><div class="skel-rows"><div class="skel-row"></div><div class="skel-row"></div></div></div>
    </div>`;

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
  document.getElementById('empFormTitle').textContent = '➕ إضافة موظف جديد';
  document.getElementById('addEmpBtn').textContent = 'إضافة الموظف';
  document.getElementById('cancelEditBtn').style.display = 'none';
  document.querySelectorAll('.emp-branch-cb, .emp-grade-cb, .emp-section-cb, .emp-subject-cb').forEach((cb) => { cb.checked = false; });
}

function startEditEmployee(emp) {
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

  document.getElementById('empFormTitle').textContent = '✏️ تعديل بيانات: ' + emp.name_ar;
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
      await apiCall('update-employee', { method: 'POST', body: { id: editId, ...body } });
      showToast('تم تحديث بيانات الموظف بنجاح', 'success');
    } else {
      await apiCall('add-employee', { method: 'POST', body });
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
    APP.allEmployees = await apiCall('list-employees', { method: 'GET' });
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

  area.innerHTML = `
    <table style="width:100%;border-collapse:collapse">
      <thead><tr style="text-align:right;border-bottom:2px solid #eee">
        <th style="padding:8px">الاسم</th><th style="padding:8px">الدور</th><th style="padding:8px">الفروع</th><th style="padding:8px"></th>
      </tr></thead>
      <tbody>
        ${list.map((e) => `
          <tr style="border-bottom:1px solid #f0f0f0">
            <td style="padding:8px">${escapeHtml(e.name_ar)}</td>
            <td style="padding:8px">${escapeHtml(ROLE_LABELS_AR[e.role] || e.role)}</td>
            <td style="padding:8px">${escapeHtml(e.all_branches.join('، '))}</td>
            <td style="padding:8px;white-space:nowrap">
              <button type="button" class="btn-edit-emp" data-id="${escapeHtml(e.id)}">✏️</button>
              <button type="button" class="btn-del-emp" data-id="${escapeHtml(e.id)}" data-name="${escapeHtml(e.name_ar)}" style="background:#c62828">🗑️</button>
            </td>
          </tr>`).join('')}
      </tbody>
    </table>`;

  area.querySelectorAll('.btn-edit-emp').forEach((btn) => {
    btn.addEventListener('click', () => {
      const emp = APP.allEmployees.find((e) => e.id === btn.getAttribute('data-id'));
      if (emp) startEditEmployee(emp);
    });
  });
  area.querySelectorAll('.btn-del-emp').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const name = btn.getAttribute('data-name');
      if (!confirm(`تأكيد حذف الموظف "${name}"؟ سيُحذَف حساب دخوله تلقائياً معه.`)) return;
      try {
        await apiCall('delete-employee', { method: 'POST', body: { id: btn.getAttribute('data-id') } });
        showToast('تم الحذف بنجاح', 'success');
        loadEmployeesList();
      } catch (e) {
        showToast(e.message, 'error');
      }
    });
  });
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
