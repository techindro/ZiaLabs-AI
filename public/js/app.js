// Class-based SPA controller with API client, auth, chat, and dashboard management.

const API_BASE = '/api';

// ════════════════════════════════════════════
//  API Client — handles all HTTP requests
// ════════════════════════════════════════════
class ApiClient {
  static #token = localStorage.getItem('zl_token') || null;

  static setToken(token) {
    ApiClient.#token = token;
    if (token) localStorage.setItem('zl_token', token);
    else localStorage.removeItem('zl_token');
  }

  static getToken() { return ApiClient.#token; }

  static async request(endpoint, options = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (ApiClient.#token) headers['Authorization'] = `Bearer ${ApiClient.#token}`;

    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: { ...headers, ...options.headers },
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  }

  static get(endpoint) { return ApiClient.request(endpoint); }

  static post(endpoint, body) {
    return ApiClient.request(endpoint, { method: 'POST', body: JSON.stringify(body) });
  }

  static del(endpoint) {
    return ApiClient.request(endpoint, { method: 'DELETE' });
  }
}

// ════════════════════════════════════════════
//  Toast — notification system
// ════════════════════════════════════════════
class Toast {
  static show(message, type = 'info') {
    const container = document.getElementById('toasts');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 3500);
  }
  static success(msg) { Toast.show(msg, 'success'); }
  static error(msg) { Toast.show(msg, 'error'); }
  static info(msg) { Toast.show(msg, 'info'); }
}

// ════════════════════════════════════════════
//  Auth — authentication flows
// ════════════════════════════════════════════
class Auth {
  static user = JSON.parse(localStorage.getItem('zl_user') || 'null');

  static #saveUser(user, token) {
    Auth.user = user;
    ApiClient.setToken(token);
    localStorage.setItem('zl_user', JSON.stringify(user));
  }

  static async emailSignIn() {
    const email = document.getElementById('si-email').value.trim();
    const pass = document.getElementById('si-pass').value;
    const errEl = document.getElementById('si-error');
    const btn = document.getElementById('si-btn');

    errEl.classList.remove('show');
    if (!email || !pass) { errEl.textContent = 'Please fill in all fields.'; errEl.classList.add('show'); return; }

    btn.disabled = true; btn.textContent = 'Signing in...';
    try {
      const { user, token } = await ApiClient.post('/auth/login', { email, password: pass });
      Auth.#saveUser(user, token);
      Toast.success(`Welcome back, ${user.name}!`);
      Dashboard.init();
      App.showPage('pg-dash');
    } catch (err) {
      errEl.textContent = err.message; errEl.classList.add('show');
    } finally {
      btn.disabled = false; btn.textContent = 'Sign in to ZiaLabs';
    }
  }

  static async emailSignUp() {
    const name = document.getElementById('su-name').value.trim();
    const email = document.getElementById('su-email').value.trim();
    const pass = document.getElementById('su-pass').value;
    const errEl = document.getElementById('su-error');
    const btn = document.getElementById('su-btn');

    errEl.classList.remove('show');
    if (!name || !email || !pass) { errEl.textContent = 'Please fill in all fields.'; errEl.classList.add('show'); return; }
    if (pass.length < 8) { errEl.textContent = 'Password must be at least 8 characters.'; errEl.classList.add('show'); return; }

    btn.disabled = true; btn.textContent = 'Creating account...';
    try {
      const { user, token } = await ApiClient.post('/auth/register', { name, email, password: pass });
      Auth.#saveUser(user, token);
      Toast.success(`Welcome to ZiaLabs, ${user.name}!`);
      Dashboard.init();
      App.showPage('pg-dash');
    } catch (err) {
      errEl.textContent = err.message; errEl.classList.add('show');
    } finally {
      btn.disabled = false; btn.textContent = 'Create free account';
    }
  }

  static async googleSignIn() {
    try {
      const { user, token } = await ApiClient.post('/auth/google', {
        name: 'Zia Khan',
        email: 'zia@gmail.com',
      });
      Auth.#saveUser(user, token);
      Toast.success(`Welcome, ${user.name}!`);
      Dashboard.init();
      App.showPage('pg-dash');
    } catch (err) {
      Toast.error(err.message);
    }
  }

  static signOut() {
    Auth.user = null;
    ApiClient.setToken(null);
    localStorage.removeItem('zl_user');
    Toast.info('Signed out successfully.');
    App.showPage('pg-landing');
  }

  static isLoggedIn() {
    return !!(Auth.user && ApiClient.getToken());
  }
}

// ════════════════════════════════════════════
//  Chat — AI agent messaging
// ════════════════════════════════════════════
class Chat {
  static #initialized = false;

  static init() {
    if (Chat.#initialized) return;
    Chat.#initialized = true;
    Chat.#loadHistory();
  }

  static async #loadHistory() {
    const chatEl = document.getElementById('dchat');
    try {
      const { messages } = await ApiClient.get('/chat/history');
      chatEl.innerHTML = '';
      if (messages.length === 0) {
        Chat.#addBot('Namaste! 🙏 Main ZiaLabs AI Agent hoon. Aaj kya research karna chahte hain?');
      } else {
        messages.forEach(m => {
          if (m.role === 'user') Chat.#addUser(m.content);
          else if (m.role === 'assistant') Chat.#addBot(m.content);
        });
      }
    } catch {
      Chat.#addBot('Namaste! 🙏 Main ZiaLabs AI Agent hoon. Aaj kya research karna chahte hain?');
    }
  }

  static #addBot(html) {
    const c = document.getElementById('dchat');
    const d = document.createElement('div');
    d.className = 'dm';
    const formatted = html.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    d.innerHTML = `<div class="dav b">ZL</div><div class="dbub b">${formatted}</div>`;
    c.appendChild(d);
    c.scrollTop = c.scrollHeight;
  }

  static #addUser(text) {
    const c = document.getElementById('dchat');
    const d = document.createElement('div');
    d.className = 'dm u';
    const initials = Auth.user ? Auth.user.name.slice(0, 2).toUpperCase() : 'U';
    d.innerHTML = `<div class="dav u">${initials}</div><div class="dbub u">${text}</div>`;
    c.appendChild(d);
    c.scrollTop = c.scrollHeight;
  }

  static #showTyping() {
    const c = document.getElementById('dchat');
    const d = document.createElement('div');
    d.className = 'dm'; d.id = 'dtyp';
    d.innerHTML = `<div class="dav b">ZL</div><div class="dbub b"><div class="dtyping"><div class="ddot"></div><div class="ddot"></div><div class="ddot"></div></div></div>`;
    c.appendChild(d);
    c.scrollTop = c.scrollHeight;
  }

  static async send() {
    const el = document.getElementById('dinp');
    const text = el.value.trim();
    if (!text) return;

    el.value = '';
    Chat.#addUser(text);
    Chat.#showTyping();

    try {
      const { response } = await ApiClient.post('/chat/message', { message: text });
      document.getElementById('dtyp')?.remove();
      Chat.#addBot(response);
      Dashboard.loadStats(); // refresh metrics
    } catch (err) {
      document.getElementById('dtyp')?.remove();
      Chat.#addBot(`Error: ${err.message}`);
    }
  }

  static async clear() {
    try {
      await ApiClient.del('/chat/clear');
      document.getElementById('dchat').innerHTML = '';
      Chat.#addBot('Chat clear ho gaya! 🧹 Naya conversation shuru karo.');
      Toast.success('Chat cleared');
    } catch (err) {
      Toast.error(err.message);
    }
  }

  static reset() {
    Chat.#initialized = false;
    const chatEl = document.getElementById('dchat');
    if (chatEl) chatEl.innerHTML = '';
  }
}

// ════════════════════════════════════════════
//  Dashboard — metrics and UI state
// ════════════════════════════════════════════
class Dashboard {
  static init() {
    Dashboard.#setUserInfo();
    Dashboard.loadStats();
    Dashboard.loadRecentSearches();
    Chat.init();
    
    // Initialize the active sidebar view to properly set titles/subtitles
    const activeItem = document.querySelector('.sb-item.active');
    if (activeItem) Dashboard.setSidebar(activeItem);
  }

  static #setUserInfo() {
    const user = Auth.user;
    if (!user) return;

    const initials = user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    document.getElementById('dash-av').textContent = initials;
    document.getElementById('dash-uname').textContent = user.name;
    document.getElementById('dash-role').textContent = `Researcher · ${user.plan || 'Free'} plan`;
    document.getElementById('dash-plan-badge').textContent = `${user.plan || 'Free'} plan`;
  }

  static async loadStats() {
    try {
      const { stats } = await ApiClient.get('/papers/stats');
      document.getElementById('m-searches').textContent = stats.searches;
      document.getElementById('m-searches-sub').textContent = `+${stats.searchesThisWeek} this week`;
      document.getElementById('m-papers').textContent = stats.papersSaved;
      document.getElementById('m-insights').textContent = stats.insightsGenerated;

      const remaining = stats.apiCallsLimit - stats.apiCallsUsed;
      document.getElementById('m-api').textContent = remaining;
      document.getElementById('m-api-sub').textContent = `${stats.apiCallsLimit} limit / mo`;
    } catch {
      // Stats will show defaults on error
    }
  }

  static async loadRecentSearches() {
    try {
      const { searches } = await ApiClient.get('/search/history?limit=5');
      const container = document.getElementById('recent-searches');

      if (!searches || searches.length === 0) {
        container.innerHTML = '<div style="padding:16px 0;text-align:center;font-size:12px;color:#9ca3af">No searches yet</div>';
        return;
      }

      container.innerHTML = searches.map(s => {
        const ago = Dashboard.#timeAgo(s.searchedAt);
        return `<div class="rs-item">
          <div class="rs-icon"><svg viewBox="0 0 24 24"><path d="M9.5 3A6.5 6.5 0 0 1 16 9.5c0 1.61-.59 3.09-1.56 4.23l.27.27h.79l5 5-1.5 1.5-5-5v-.79l-.27-.27A6.516 6.516 0 0 1 9.5 16 6.5 6.5 0 0 1 3 9.5 6.5 6.5 0 0 1 9.5 3m0 2C7 5 5 7 5 9.5S7 14 9.5 14 14 12 14 9.5 12 5 9.5 5Z"/></svg></div>
          <div class="rs-text">${s.query}</div>
          <div class="rs-time">${ago}</div>
        </div>`;
      }).join('');
    } catch {
      // Keep default UI
    }
  }

  static #timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr + 'Z').getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  }


  static setSidebar(el) {
    document.querySelectorAll('.sb-item').forEach(i => i.classList.remove('active'));
    el.classList.add('active');

    const text = el.textContent.trim();
    let sectionId = 'dc-home';
    let title = 'Research Dashboard';
    let subtitle = `Good to have you back, ${Auth.user ? Auth.user.name.split(' ')[0] : 'researcher'}`;

    if (text.includes('Search Papers')) {
      sectionId = 'dc-search';
      title = 'Search Academic Papers';
      subtitle = 'Find relevant research across multiple academic sources';
      Search.init();
    } else if (text.includes('AI Insights')) {
      sectionId = 'dc-insights';
      title = 'AI Research Insights';
      subtitle = 'Deep analysis and automated intelligence for your research';
    } else if (text.includes('My Papers')) {
      sectionId = 'dc-library';
      title = 'My Research Library';
      subtitle = 'Your personal collection of saved academic papers';
      Library.init();
    } else if (text.includes('Settings')) {
      sectionId = 'dc-settings';
      title = 'Account Settings';
      subtitle = 'Manage your profile and research preferences';
    }

    document.querySelectorAll('.dash-content').forEach(c => c.classList.add('d-none'));
    document.getElementById(sectionId).classList.remove('d-none');
    document.getElementById('dash-view-title').textContent = title;
    document.getElementById('dash-view-subtitle').textContent = subtitle;
  }
}

// ════════════════════════════════════════════
//  Search — Paper searching and results
// ════════════════════════════════════════════
class Search {
  static init() {
    // Focus search input
    setTimeout(() => document.getElementById('s-query')?.focus(), 100);
  }

  static async run() {
    const query = document.getElementById('s-query').value.trim();
    if (!query) return;

    const container = document.getElementById('s-results');
    container.innerHTML = '<div style="padding:100px 0;text-align:center"><div class="dtyping" style="justify-content:center"><div class="ddot"></div><div class="ddot"></div><div class="ddot"></div></div><div style="font-size:13px;color:var(--gray);margin-top:16px">Searching millions of papers...</div></div>';

    try {
      const { papers } = await ApiClient.get(`/search?q=${encodeURIComponent(query)}`);
      
      if (papers.length === 0) {
        container.innerHTML = '<div style="padding:60px 0;text-align:center"><div style="font-size:40px;margin-bottom:16px">🔍</div><div style="font-size:16px;font-weight:600;color:var(--black)">No papers found</div><div style="font-size:13px;color:var(--gray);margin-top:8px">Try adjusting your keywords or search filters.</div></div>';
        return;
      }

      container.innerHTML = papers.map(p => Search.renderPaperCard(p)).join('');
      Dashboard.loadStats(); // Update search count
    } catch (err) {
      Toast.error(err.message);
      container.innerHTML = `<div style="padding:60px 0;text-align:center;color:#ef4444">${err.message}</div>`;
    }
  }

  static renderPaperCard(p, isLibrary = false) {
    const authors = Array.isArray(p.authors) ? p.authors.join(', ') : p.authors || 'Unknown Authors';
    const year = p.published ? new Date(p.published).getFullYear() : 'N/A';
    
    return `
      <div class="paper-card">
        <div class="pc-top">
          <div class="pc-source">${p.source || 'Academic'}</div>
          <div class="pc-meta">${year} · ${p.citations || 0} citations</div>
        </div>
        <div class="pc-title">${p.title}</div>
        <div class="pc-authors">${authors}</div>
        <div class="pc-abstract">${p.abstract || 'No abstract available for this paper.'}</div>
        <div class="pc-foot">
          <a href="${p.sourceUrl}" target="_blank" style="font-size:12px;color:var(--red);text-decoration:none;font-weight:500">View Source ↗</a>
          <div class="pc-actions">
            ${isLibrary ? 
              `${p.source === 'local_upload' ? `<button class="btn-save" onclick="window.open('${p.sourceUrl}?token=${ApiClient.getToken()}', '_blank')">Download</button>` : ''}
              <button class="btn-save" onclick="Library.remove(${p.id})">Remove</button>` : 
              `<button class="btn-save" id="btn-save-${Math.random().toString(36).substr(2, 9)}" onclick="Library.save(this, ${JSON.stringify(p).replace(/"/g, '&quot;')})">Save to Library</button>`
            }
            <button class="btn-save" style="background:var(--black);color:#fff;border:none" onclick="Search.analyze('${p.title.replace(/'/g, "\\'")}')">AI Insights</button>
          </div>
        </div>
      </div>
    `;
  }

  static analyze(title) {
    Dashboard.setSidebar(document.querySelectorAll('.sb-item')[0]); // Go to dashboard
    document.getElementById('dinp').value = `Analyze the paper titled "${title}" and give me key insights.`;
    Chat.send();
  }
}

// ════════════════════════════════════════════
//  Library — Saved papers management
// ════════════════════════════════════════════
class Library {
  static async init() {
    const container = document.getElementById('l-results');
    container.innerHTML = '<div style="padding:40px;text-align:center">Loading library...</div>';

    try {
      const { papers } = await ApiClient.get('/papers');
      document.getElementById('lib-count').textContent = papers.length;

      if (papers.length === 0) {
        container.innerHTML = '<div style="padding:60px 0;text-align:center"><div style="font-size:40px;margin-bottom:16px">📁</div><div style="font-size:16px;font-weight:600;color:var(--black)">Your library is empty</div><div style="font-size:13px;color:var(--gray);margin-top:8px">Save papers from search results to build your collection.</div></div>';
        return;
      }

      container.innerHTML = papers.map(p => Search.renderPaperCard(p, true)).join('');
    } catch (err) {
      Toast.error(err.message);
    }
  }

  static async save(btn, paper) {
    btn.disabled = true;
    btn.textContent = 'Saving...';
    try {
      await ApiClient.post('/papers/save', paper);
      btn.textContent = 'Saved';
      btn.classList.add('saved');
      Toast.success('Paper saved to library');
      Dashboard.loadStats();
    } catch (err) {
      btn.disabled = false;
      btn.textContent = 'Save to Library';
      Toast.error(err.message);
    }
  }


  static async remove(id) {
    if (!confirm('Are you sure you want to remove this paper from your library?')) return;
    try {
      await ApiClient.del(`/papers/${id}`);
      Toast.success('Paper removed');
      Library.init();
      Dashboard.loadStats();
    } catch (err) {
      Toast.error(err.message);
    }
  }

  static async upload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Reset input
    event.target.value = '';

    Toast.info(`Uploading ${file.name}...`);
    try {
      const formData = new FormData();
      formData.append('paper', file);
      
      const res = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ApiClient.getToken()}`
        },
        body: formData
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      
      Toast.success('Paper uploaded and saved to library!');
      Library.init();
      Dashboard.loadStats();
    } catch (err) {
      Toast.error(err.message);
    }
  }
}

// ════════════════════════════════════════════
//  Payment — Stripe integration
// ════════════════════════════════════════════
class Payment {
  static async upgrade() {
    try {
      Toast.info('Preparing secure checkout...');
      const { url } = await ApiClient.post('/payment/create-checkout-session');
      if (url) {
        window.location.href = url;
      }
    } catch (err) {
      Toast.error(err.message);
    }
  }

  static checkStatus() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('upgrade') === 'success') {
      Toast.success('Upgrade successful! You are now a Pro member.');
      // Remove param from URL
      window.history.replaceState({}, document.title, window.location.pathname);
      if (Auth.isLoggedIn()) App.showPage('pg-dash');
    } else if (params.get('upgrade') === 'cancel') {
      Toast.info('Upgrade cancelled.');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }
}

// ════════════════════════════════════════════
//  App — main page router
// ════════════════════════════════════════════
class App {
  static showPage(id) {
    // If going to dashboard, must be logged in
    if (id === 'pg-dash' && !Auth.isLoggedIn()) {
      id = 'pg-signin';
    }

    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');

    if (id === 'pg-dash') {
      Dashboard.init();
    }
  }

  static init() {
    // Check for payment status first
    Payment.checkStatus();

    // Auto-login if token exists
    if (Auth.isLoggedIn()) {
      // Verify token is still valid
      ApiClient.get('/auth/me').then(({ user }) => {
        Auth.user = user;
        localStorage.setItem('zl_user', JSON.stringify(user));
      }).catch(() => {
        Auth.signOut();
      });
    }
  }
}

// ── Initialize on load ──
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

