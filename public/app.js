  const API_BASE = window.location.origin + '/api';
  let currentToken = null;

  function showCard(id) {
    document.querySelectorAll('.card').forEach(c => c.style.display = 'none');
    document.getElementById(id).style.display = 'block';
  }

  document.getElementById('loginBtn').addEventListener('click', async () => {
    const btn = document.getElementById('loginBtn');
    const errBox = document.getElementById('loginError');
    errBox.style.display = 'none';
    btn.disabled = true; btn.textContent = 'جارِ الدخول...';

    try {
      const res = await fetch(API_BASE + '/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: document.getElementById('username').value,
          password: document.getElementById('password').value,
        }),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.message);

      currentToken = result.data.token;
      localStorage.setItem('mirqat_token', currentToken);
      localStorage.setItem('mirqat_user', JSON.stringify(result.data.user));

      if (result.data.firstLogin) {
        showCard('firstLoginCard');
      } else {
        showDashboard(result.data.user);
      }
    } catch (e) {
      errBox.textContent = e.message;
      errBox.style.display = 'block';
    } finally {
      btn.disabled = false; btn.textContent = 'دخول';
    }
  });

  document.getElementById('setPasswordBtn').addEventListener('click', async () => {
    const btn = document.getElementById('setPasswordBtn');
    const errBox = document.getElementById('setPasswordError');
    errBox.style.display = 'none';
    btn.disabled = true; btn.textContent = 'جارِ الحفظ...';

    try {
      const res = await fetch(API_BASE + '/force-set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentToken },
        body: JSON.stringify({ newPassword: document.getElementById('newPassword').value }),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.message);

      const user = JSON.parse(localStorage.getItem('mirqat_user'));
      showDashboard(user);
    } catch (e) {
      errBox.textContent = e.message;
      errBox.style.display = 'block';
    } finally {
      btn.disabled = false; btn.textContent = 'تعيين وحفظ';
    }
  });

  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await fetch(API_BASE + '/logout', { method: 'POST' });
    localStorage.removeItem('mirqat_token');
    localStorage.removeItem('mirqat_user');
    currentToken = null;
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    showCard('loginCard');
  });

  function showDashboard(user) {
    document.getElementById('welcomeName').textContent = 'أهلاً، ' + user.fullName + ' 👋';
    document.getElementById('welcomeRole').textContent = user.role + ' — ' + user.branch;
    showCard('dashboardCard');
  }

  // استعادة الجلسة تلقائياً لو موجودة أصلاً بالمتصفح
  const savedToken = localStorage.getItem('mirqat_token');
  const savedUser = localStorage.getItem('mirqat_user');
  if (savedToken && savedUser) {
    currentToken = savedToken;
    showDashboard(JSON.parse(savedUser));
  }

