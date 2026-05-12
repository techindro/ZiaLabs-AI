// frontend SPA — no framework, just classes and vanilla DOM manipulation.
// i organized everything into classes to keep it manageable as it grew.
const API_BASE = '/api';

// centralized API client — every backend call goes through here
class ApiClient {
  static #token = localStorage.getItem('zl_token') || null;

  static setToken(t) {
    ApiClient.#token = t;
    if (t) localStorage.setItem('zl_token', t);
    else localStorage.removeItem('zl_token');
  }

  static getToken() { return ApiClient.#token; }

  static async request(endpoint, opts = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (ApiClient.#token) headers['Authorization'] = `Bearer ${ApiClient.#token}`;

    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...opts,
      headers: { ...headers, ...(opts.headers || {}) },
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Something went wrong (${res.status})`);
    return data;
  }

  static get(url) { return ApiClient.request(url); }

  static post(url, body) {
    return ApiClient.request(url, { method: 'POST', body: JSON.stringify(body) });
  }

  static del(url) {
    return ApiClient.request(url, { method: 'DELETE' });
  }
}

// toast notifications (the little popups in the top-right corner)
class Toast {
  static show(msg, type = 'info') {
    const box = document.getElementById('toasts');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    box.appendChild(el);
    // fade out then remove
    setTimeout(() => {
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 300);
    }, 3500);
  }

  static success(msg) { Toast.show(msg, 'success'); }
  static error(msg)   { Toast.show(msg, 'error'); }
  static info(msg)    { Toast.show(msg, 'info'); }
}

// authentication — handles sign in, sign up, google login, and session persistence
class Auth {
  static user = JSON.parse(localStorage.getItem('zl_user') || 'null');

  static #save(user, token) {
    Auth.user = user;
    ApiClient.setToken(token);
    localStorage.setItem('zl_user', JSON.stringify(user));
  }

  static async emailSignIn() {
    const email = document.getElementById('si-email').value.trim();
    const pass  = document.getElementById('si-pass').value;
    const errEl = document.getElementById('si-error');
    const btn   = document.getElementById('si-btn');

    errEl.classList.remove('show');

    if (!email || !pass) {
      errEl.textContent = 'Please fill in all fields.';
      errEl.classList.add('show');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Signing in...';

    try {
      const { user, token } = await ApiClient.post('/auth/login', { email, password: pass });
      Auth.#save(user, token);
      Toast.success(`Welcome back, ${user.name}!`);
      Dashboard.init();
      App.showPage('pg-dash');
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.add('show');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Sign in to ZiaLabs';
    }
  }

  static async emailSignUp() {
    const name  = document.getElementById('su-name').value.trim();
    const email = document.getElementById('su-email').value.trim();
    const pass  = document.getElementById('su-pass').value;
    const errEl = document.getElementById('su-error');
    const btn   = document.getElementById('su-btn');

    errEl.classList.remove('show');

    if (!name || !email || !pass) {
      errEl.textContent = 'Please fill in all fields.';
      errEl.classList.add('show');
      return;
    }
    if (pass.length < 8) {
      errEl.textContent = 'Password must be at least 8 characters.';
      errEl.classList.add('show');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Creating account...';

    try {
      const { user, token } = await ApiClient.post('/auth/register', { name, email, password: pass });
      Auth.#save(user, token);
      Toast.success(`Welcome to ZiaLabs, ${user.name}!`);
      Dashboard.init();
      App.showPage('pg-dash');
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.add('show');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Create free account';
    }
  }

  // TODO: swap this for real Google OAuth once we have production credentials
  static async googleSignIn() {
    try {
      const { user, token } = await ApiClient.post('/auth/google', {
        name: 'Zia Khan',
        email: 'zia@gmail.com',
      });
      Auth.#save(user, token);
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
    Toast.info('Signed out.');
    App.showPage('pg-landing');
  }

  static isLoggedIn() {
    return !!(Auth.user && ApiClient.getToken());
  }
}

// chat panel — talks to the gemini-powered backend
class Chat {
  static #ready = false;

  static init() {
    if (Chat.#ready) return;
    Chat.#ready = true;
    Chat.#fetchHistory();
  }

  static async #fetchHistory() {
    const chatEl = document.getElementById('dchat');
    try {
      const { messages } = await ApiClient.get('/chat/history');
      chatEl.innerHTML = '';
      if (!messages.length) {
        Chat.#addBot('Hello! 👋 I am the ZiaLabs AI Research Agent. How can I help with your research today?');
      } else {
        messages.forEach(m => {
          if (m.role === 'user') Chat.#addUser(m.content);
          else Chat.#addBot(m.content);
        });
      }
    } catch {
      // if history load fails just show greeting
      Chat.#addBot('Hello! 👋 I am the ZiaLabs AI Research Agent. How can I help with your research today?');
    }
  }

  static #addBot(html) {
    const c = document.getElementById('dchat');
    const d = document.createElement('div');
    d.className = 'dm';
    const formatted = html
      .replace(/\n/g, '<br>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
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
    d.className = 'dm';
    d.id = 'dtyp';
    d.innerHTML = `<div class="dav b">ZL</div><div class="dbub b"><div class="dtyping"><div class="ddot"></div><div class="ddot"></div><div class="ddot"></div></div></div>`;
    c.appendChild(d);
    c.scrollTop = c.scrollHeight;
  }

  static async send() {
    const inp = document.getElementById('dinp');
    const text = inp.value.trim();
    if (!text) return;

    inp.value = '';
    Chat.#addUser(text);
    Chat.#showTyping();

    try {
      const { response } = await ApiClient.post('/chat/message', { message: text });
      document.getElementById('dtyp')?.remove();
      Chat.#addBot(response);
      Dashboard.loadStats();
    } catch (err) {
      document.getElementById('dtyp')?.remove();
      Chat.#addBot(`Error: ${err.message}`);
    }
  }

  static async clear() {
    try {
      await ApiClient.del('/chat/clear');
      document.getElementById('dchat').innerHTML = '';
      Chat.#addBot('Chat cleared! 🧹 Start a new conversation.');
      Toast.success('Chat cleared');
    } catch (err) {
      Toast.error(err.message);
    }
  }

  static reset() {
    Chat.#ready = false;
    const el = document.getElementById('dchat');
    if (el) el.innerHTML = '';
  }
}

// dashboard — handles sidebar navigation, stats, and user info
class Dashboard {

  static init() {
    Dashboard.#setUserInfo();
    Dashboard.loadStats();
    Dashboard.loadRecentSearches();
    Chat.init();

    const active = document.querySelector('.sb-item.active');
    if (active) Dashboard.setSidebar(active);
  }

  static #setUserInfo() {
    const u = Auth.user;
    if (!u) return;

    const initials = u.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    document.getElementById('dash-av').textContent = initials;
    document.getElementById('dash-uname').textContent = u.name;
    document.getElementById('dash-role').textContent = `Researcher · ${u.plan || 'Free'} plan`;
    document.getElementById('dash-plan-badge').textContent = `${u.plan || 'Free'} plan`;
  }

  static async loadStats() {
    try {
      const { stats } = await ApiClient.get('/papers/stats');
      document.getElementById('m-searches').textContent = stats.searches;
      document.getElementById('m-searches-sub').textContent = `+${stats.searchesThisWeek} this week`;
      document.getElementById('m-papers').textContent = stats.papersSaved;
      document.getElementById('m-insights').textContent = stats.insightsGenerated;

      const left = stats.apiCallsLimit - stats.apiCallsUsed;
      document.getElementById('m-api').textContent = left;
      document.getElementById('m-api-sub').textContent = `${stats.apiCallsLimit} limit / mo`;
    } catch {
      // default numbers already in html
    }
  }

  static async loadRecentSearches() {
    try {
      const { searches } = await ApiClient.get('/search/history?limit=5');
      const box = document.getElementById('recent-searches');

      if (!searches || !searches.length) {
        box.innerHTML = '<div style="padding:16px 0;text-align:center;font-size:12px;color:#9ca3af">No searches yet</div>';
        return;
      }

      box.innerHTML = searches.map(s => {
        const ago = Dashboard.#timeAgo(s.searchedAt);
        return `<div class="rs-item">
          <div class="rs-icon"><svg viewBox="0 0 24 24"><path d="M9.5 3A6.5 6.5 0 0 1 16 9.5c0 1.61-.59 3.09-1.56 4.23l.27.27h.79l5 5-1.5 1.5-5-5v-.79l-.27-.27A6.516 6.516 0 0 1 9.5 16 6.5 6.5 0 0 1 3 9.5 6.5 6.5 0 0 1 9.5 3m0 2C7 5 5 7 5 9.5S7 14 9.5 14 14 12 14 9.5 12 5 9.5 5Z"/></svg></div>
          <div class="rs-text">${s.query}</div>
          <div class="rs-time">${ago}</div>
        </div>`;
      }).join('');
    } catch {
      // noop
    }
  }

  static #timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr + 'Z').getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  static setSidebar(el) {
    document.querySelectorAll('.sb-item').forEach(i => i.classList.remove('active'));
    el.classList.add('active');
    
    // close mobile menu if it's open
    const sb = document.getElementById('dash-sidebar');
    if (sb.classList.contains('open')) App.toggleMobileMenu();

    const label = el.textContent.trim();
    let sectionId = 'dc-home';
    let title     = 'Research Dashboard';
    let subtitle  = `Good to have you back, ${Auth.user ? Auth.user.name.split(' ')[0] : 'researcher'}`;

    if (label.includes('Search Papers')) {
      sectionId = 'dc-search';
      title     = 'Search Academic Papers';
      subtitle  = 'Find relevant research across multiple academic sources';
      Search.init();
    } else if (label.includes('AI Insights')) {
      sectionId = 'dc-insights';
      title     = 'AI Research Insights';
      subtitle  = 'Deep analysis and automated intelligence for your research';
    } else if (label.includes('My Papers')) {
      sectionId = 'dc-library';
      title     = 'My Research Library';
      subtitle  = 'Your saved papers collection';
      Library.init();
    } else if (label.includes('Settings')) {
      sectionId = 'dc-settings';
      title     = 'Account Settings';
      subtitle  = 'Manage your profile and preferences';
    }

    document.querySelectorAll('.dash-content').forEach(c => c.classList.add('d-none'));
    document.getElementById(sectionId).classList.remove('d-none');
    document.getElementById('dash-view-title').textContent    = title;
    document.getElementById('dash-view-subtitle').textContent = subtitle;
  }
}

// search — sends queries to /api/search and renders paper cards
class Search {
  static init() {
    setTimeout(() => document.getElementById('s-query')?.focus(), 100);
  }

  static async run() {
    const q = document.getElementById('s-query').value.trim();
    if (!q) return;

    const box = document.getElementById('s-results');
    box.innerHTML = '<div style="padding:100px 0;text-align:center"><div class="dtyping" style="justify-content:center"><div class="ddot"></div><div class="ddot"></div><div class="ddot"></div></div><div style="font-size:13px;color:var(--gray);margin-top:16px">Searching millions of papers...</div></div>';

    try {
      const { papers } = await ApiClient.get(`/search?q=${encodeURIComponent(q)}`);
      if (!papers.length) {
        box.innerHTML = '<div style="padding:60px 0;text-align:center"><div style="font-size:40px;margin-bottom:16px">🔍</div><div style="font-size:16px;font-weight:600;color:var(--black)">No papers found</div><div style="font-size:13px;color:var(--gray);margin-top:8px">Try adjusting your keywords.</div></div>';
        return;
      }
      box.innerHTML = papers.map(p => Search.renderCard(p)).join('');
      Dashboard.loadStats();
    } catch (err) {
      Toast.error(err.message);
      box.innerHTML = `<div style="padding:60px 0;text-align:center;color:#ef4444">${err.message}</div>`;
    }
  }

  static renderCard(p, inLibrary = false) {
    const authors = Array.isArray(p.authors) ? p.authors.join(', ') : (p.authors || 'Unknown Authors');
    const year    = p.published ? new Date(p.published).getFullYear() : 'N/A';

    return `
      <div class="paper-card">
        <div class="pc-top">
          <div class="pc-source">${p.source || 'Academic'}</div>
          <div class="pc-meta">${year} · ${p.citations || 0} citations</div>
        </div>
        <div class="pc-title">${p.title}</div>
        <div class="pc-authors">${authors}</div>
        <div class="pc-abstract">${p.abstract || 'No abstract available.'}</div>
        <div class="pc-foot">
          <a href="${p.sourceUrl}" target="_blank" style="font-size:12px;color:var(--red);text-decoration:none;font-weight:500">View Source ↗</a>
          <div class="pc-actions">
            ${inLibrary
              ? `${p.source === 'local_upload' ? `<button class="btn-save" onclick="window.open('${p.sourceUrl}?token=${ApiClient.getToken()}', '_blank')">Download</button>` : ''}
                 <button class="btn-save" onclick="Library.remove(${p.id})">Remove</button>`
              : `<button class="btn-save" id="btn-s-${Math.random().toString(36).substr(2,8)}" onclick="Library.save(this, ${JSON.stringify(p).replace(/"/g, '&quot;')})">Save to Library</button>`
            }
            <button class="btn-save" style="background:var(--black);color:#fff;border:none" onclick="Search.analyze('${p.title.replace(/'/g, "\\'")}')">AI Insights</button>
          </div>
        </div>
      </div>
    `;
  }

  // shortcut: clicking "AI Insights" on a paper pre-fills the chat with an analysis prompt
  static analyze(title) {
    Dashboard.setSidebar(document.querySelectorAll('.sb-item')[0]);
    document.getElementById('dinp').value = `Analyze the paper titled "${title}" and give me key insights.`;
    Chat.send();
  }
}

// library — saved papers with upload support
class Library {
  static async init() {
    const box = document.getElementById('l-results');
    box.innerHTML = '<div style="padding:40px;text-align:center">Loading library...</div>';

    try {
      const { papers } = await ApiClient.get('/papers');
      document.getElementById('lib-count').textContent = papers.length;

      if (!papers.length) {
        box.innerHTML = '<div style="padding:60px 0;text-align:center"><div style="font-size:40px;margin-bottom:16px">📁</div><div style="font-size:16px;font-weight:600;color:var(--black)">Your library is empty</div><div style="font-size:13px;color:var(--gray);margin-top:8px">Save papers from search results to build your collection.</div></div>';
        return;
      }

      box.innerHTML = papers.map(p => Search.renderCard(p, true)).join('');
    } catch (err) {
      Toast.error(err.message);
    }
  }

  static async save(btn, paper) {
    btn.disabled = true;
    btn.textContent = 'Saving...';
    try {
      await ApiClient.post('/papers/save', paper);
      btn.textContent = 'Saved ✓';
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
    if (!confirm('Remove this paper from your library?')) return;
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
    event.target.value = '';

    Toast.info(`Uploading ${file.name}...`);
    try {
      const form = new FormData();
      form.append('paper', file);

      const res = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${ApiClient.getToken()}` },
        body: form
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');

      Toast.success('Paper uploaded and saved!');
      Library.init();
      Dashboard.loadStats();
    } catch (err) {
      Toast.error(err.message);
    }
  }
}

// stripe payment integration (test mode)
class Payment {
  static async upgrade() {
    try {
      Toast.info('Preparing secure checkout...');
      const { url } = await ApiClient.post('/payment/create-checkout-session');
      if (url) window.location.href = url;
    } catch (err) {
      Toast.error(err.message);
    }
  }

  static checkStatus() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('upgrade') === 'success') {
      Toast.success('Upgrade successful! You are now a Pro member.');
      window.history.replaceState({}, document.title, window.location.pathname);
      if (Auth.isLoggedIn()) App.showPage('pg-dash');
    } else if (params.get('upgrade') === 'cancel') {
      Toast.info('Upgrade cancelled.');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }
}

// SPA page router — shows/hides page divs based on id
class App {
  static showPage(id) {
    if (id === 'pg-dash' && !Auth.isLoggedIn()) {
      id = 'pg-signin';
    }
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    if (id === 'pg-dash') Dashboard.init();
    
    // ensure sidebar is hidden on page switch if we were on mobile
    document.getElementById('dash-sidebar')?.classList.remove('open');
  }

  static toggleMobileMenu() {
    const sb = document.getElementById('dash-sidebar');
    if (!sb) return;
    sb.classList.toggle('open');
  }

  static async init() {
    try {
      Payment.checkStatus();

      if (Auth.isLoggedIn()) {
        try {
          const { user } = await ApiClient.get('/auth/me');
          Auth.user = user;
          localStorage.setItem('zl_user', JSON.stringify(user));
          
          if (window.location.pathname === '/dashboard') {
            App.showPage('pg-dash');
          }
        } catch (authErr) {
          Auth.signOut();
        }
      }

      if (document.getElementById('blog-grid')) News.load();
    } catch (err) {
      console.error('Init failed:', err);
    }
  }
}

// blog/news section on the landing page — pulls from our RSS aggregator
class News {
  static async load() {
    const box = document.getElementById('blog-grid');
    if (!box) return;

    try {
      const { news } = await ApiClient.get('/news');
      if (!news?.length) return;

      // Map RSS items to cards.
      // NOTE: Using fallback images blog1/2/3 for now.
      box.innerHTML = news.slice(0, 3).map((item, idx) => {
        const source = item.source || 'Lab Update';
        
        return `
          <div class="blog-card" onclick="window.open('${item.link}', '_blank')">
            <div class="blog-img-wrap">
              <img src="/img/blog${idx+1}.png" alt="Research Update">
            </div>
            <div style="font-size:12px;color:var(--red);font-weight:600;margin-bottom:8px">
              ${source.toUpperCase()} • LATEST
            </div>
            <div style="font-size:16px;font-weight:700;margin-bottom:8px">${item.title}</div>
            <p style="font-size:13px;color:var(--gray);line-height:1.5">
              ${item.description.replace(/<[^>]*>?/gm, '').slice(0, 110)}...
            </p>
          </div>
        `;
      }).join('');
    } catch (err) {
      console.warn('News failed to load:', err.message);
    }
  }
}

document.addEventListener('DOMContentLoaded', () => App.init());
