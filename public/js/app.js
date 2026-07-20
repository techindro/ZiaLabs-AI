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
        name: 'Shubham Patel',
        email: 'shubham@gmail.com',
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

    // Check if there is a pending search query from the hero section
    const pendingQuery = sessionStorage.getItem('pending_research_query');
    if (pendingQuery) {
      sessionStorage.removeItem('pending_research_query');
      
      // Navigate to the AI Insights tab
      setTimeout(() => {
        const insightsSbItem = Array.from(document.querySelectorAll('.sb-item')).find(item => item.textContent.includes('AI Insights'));
        if (insightsSbItem) {
          Dashboard.setSidebar(insightsSbItem);
          
          // Set the value of the consensus query input and run it
          const consensusInput = document.getElementById('consensus-query');
          if (consensusInput) {
            consensusInput.value = pendingQuery;
            InsightsDashboard.runConsensus();
          }
        }
      }, 100);
    }
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
      InsightsDashboard.init();
    } else if (label.includes('My Papers')) {
      sectionId = 'dc-library';
      title     = 'My Research Library';
      subtitle  = 'Your saved papers collection';
      Library.init();
    } else if (label.includes('Chat History')) {
      sectionId = 'dc-history';
      title     = 'Chat History Log';
      subtitle  = 'Review and search your past conversations with ZiaLabs AI';
      ChatHistoryView.init();
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

  static subscribeNewsletter() {
    const inp = document.getElementById('newsletter-inp');
    const email = inp.value.trim();
    if (!email) {
      Toast.error('Please enter a valid email address.');
      return;
    }
    inp.value = '';
    Toast.success('Thanks for subscribing to ZiaLabs Research Insights!');
  }

  static togglePricing(isAnnual) {
    const proPriceVal = document.getElementById('pro-price-val');
    const proPricePeriod = document.getElementById('pro-price-period');
    const monthlyLbl = document.getElementById('billing-monthly-lbl');
    const yearlyLbl = document.getElementById('billing-yearly-lbl');

    if (isAnnual) {
      if (proPriceVal) proPriceVal.textContent = '$2';
      if (proPricePeriod) {
        proPricePeriod.innerHTML = '/ month <span id="pro-billing-subtitle" style="font-size:11px;color:var(--gray);font-weight:normal;display:block;margin-top:4px;">(billed annually, $24/yr)</span>';
      }
      if (monthlyLbl) {
        monthlyLbl.style.color = 'var(--gray)';
        monthlyLbl.style.fontWeight = '500';
      }
      if (yearlyLbl) {
        yearlyLbl.style.color = 'var(--primary)';
        yearlyLbl.style.fontWeight = '700';
      }
    } else {
      if (proPriceVal) proPriceVal.textContent = '$3';
      if (proPricePeriod) {
        proPricePeriod.innerHTML = '/ month';
      }
      if (monthlyLbl) {
        monthlyLbl.style.color = 'var(--primary)';
        monthlyLbl.style.fontWeight = '700';
      }
      if (yearlyLbl) {
        yearlyLbl.style.color = 'var(--gray)';
        yearlyLbl.style.fontWeight = '500';
      }
    }
  }

  static handleHeroSearch() {
    const input = document.getElementById('hero-search-input');
    const query = input.value.trim();
    if (!query) {
      Toast.error('Please enter a research question first.');
      return;
    }
    
    sessionStorage.setItem('pending_research_query', query);
    Auth.googleSignIn();
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

// chat history view — shows previous messages
class ChatHistoryView {
  static #messages = [];

  static async init() {
    const box = document.getElementById('chat-history-log');
    box.innerHTML = '<div style="padding:40px;text-align:center">Loading history...</div>';
    document.getElementById('history-search').value = '';

    try {
      const { messages } = await ApiClient.get('/chat/history?limit=100');
      ChatHistoryView.#messages = messages;
      ChatHistoryView.render(messages);
    } catch (err) {
      Toast.error(err.message);
      box.innerHTML = `<div style="padding:40px;text-align:center;color:#ef4444">${err.message}</div>`;
    }
  }

  static render(messages) {
    const box = document.getElementById('chat-history-log');
    if (!messages.length) {
      box.innerHTML = '<div style="padding:40px;text-align:center;font-size:14px;color:var(--gray)">No chat messages found. Start chatting on the dashboard!</div>';
      return;
    }

    box.innerHTML = messages.map(m => {
      const isUser = m.role === 'user';
      const sender = isUser ? (Auth.user ? Auth.user.name : 'You') : 'ZiaLabs AI';
      const avatarClass = isUser ? 'u' : 'b';
      const avatarText = isUser ? (Auth.user ? Auth.user.name.slice(0, 2).toUpperCase() : 'U') : 'ZL';
      const time = new Date(m.createdAt).toLocaleString();
      const formatted = m.content
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

      return `
        <div class="history-item">
          <div class="history-avatar ${avatarClass}">${avatarText}</div>
          <div class="history-body">
            <div class="history-meta">
              <span class="history-sender">${sender}</span>
              <span class="history-time">${time}</span>
            </div>
            <div class="history-content">${formatted}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  static filter(term) {
    const cleanTerm = term.toLowerCase().trim();
    if (!cleanTerm) {
      ChatHistoryView.render(ChatHistoryView.#messages);
      return;
    }
    const filtered = ChatHistoryView.#messages.filter(m => 
      m.content.toLowerCase().includes(cleanTerm) || 
      m.role.toLowerCase().includes(cleanTerm)
    );
    ChatHistoryView.render(filtered);
  }

  static async clearAll() {
    if (!confirm('Are you sure you want to clear all chat messages from history? This cannot be undone.')) return;
    try {
      await ApiClient.del('/chat/clear');
      ChatHistoryView.#messages = [];
      ChatHistoryView.render([]);
      Chat.reset(); // reset main chat tab as well
      Toast.success('All history cleared');
    } catch (err) {
      Toast.error(err.message);
    }
  }
}

// Advanced Research Tools (AI Insights tab)
class InsightsDashboard {
  static activeTab = 'consensus';
  static activePaper = null;

  static init() {
    InsightsDashboard.switchTab(InsightsDashboard.activeTab);
    InsightsDashboard.loadLibraryPapers();
  }

  static switchTab(tabName) {
    InsightsDashboard.activeTab = tabName;
    document.querySelectorAll('.insights-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.insights-pane').forEach(p => p.classList.add('d-none'));

    if (tabName === 'consensus') {
      document.querySelector('.insights-tab:nth-child(1)').classList.add('active');
      document.getElementById('pane-consensus').classList.remove('d-none');
    } else {
      document.querySelector('.insights-tab:nth-child(2)').classList.add('active');
      document.getElementById('pane-companion').classList.remove('d-none');
    }
  }

  static async loadLibraryPapers() {
    const selector = document.getElementById('insights-paper-selector');
    try {
      const { papers } = await ApiClient.get('/papers');
      selector.innerHTML = '<option value="">-- Choose a paper from your library --</option>';
      if (papers && papers.length) {
        papers.forEach(p => {
          const opt = document.createElement('option');
          opt.value = JSON.stringify(p);
          opt.textContent = `${p.title.slice(0, 60)}... (${p.source || 'Local'})`;
          selector.appendChild(opt);
        });
      }
    } catch (err) {
      console.warn('Failed to load library papers for insights:', err.message);
    }
  }

  static async runConsensus() {
    const query = document.getElementById('consensus-query').value.trim();
    if (!query) return;

    const loading = document.getElementById('consensus-loading');
    const results = document.getElementById('consensus-results');

    loading.classList.remove('d-none');
    results.classList.add('d-none');

    try {
      const res = await ApiClient.post('/chat/consensus', { question: query });
      const consensus = res.consensus;

      // Fill in consensus synthesis box
      document.getElementById('consensus-statement-text').textContent = consensus.consensusStatement;

      // Update meter
      const total = (consensus.yesCount || 0) + (consensus.noCount || 0) + (consensus.unclearCount || 0);
      const pctYes = total > 0 ? ((consensus.yesCount || 0) / total) * 100 : 0;
      const pctUnclear = total > 0 ? ((consensus.unclearCount || 0) / total) * 100 : 0;
      const pctNo = total > 0 ? ((consensus.noCount || 0) / total) * 100 : 0;

      document.getElementById('bar-yes').style.width = `${pctYes}%`;
      document.getElementById('bar-unclear').style.width = `${pctUnclear}%`;
      document.getElementById('bar-no').style.width = `${pctNo}%`;

      document.getElementById('txt-yes').textContent = consensus.yesCount || 0;
      document.getElementById('txt-unclear').textContent = consensus.unclearCount || 0;
      document.getElementById('txt-no').textContent = consensus.noCount || 0;

      // Render table rows
      const tbody = document.getElementById('consensus-table-rows');
      if (!consensus.papers || !consensus.papers.length) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:20px;">No detailed analyses available.</td></tr>';
      } else {
        tbody.innerHTML = consensus.papers.map(p => {
          const verdictClass = (p.verdict || '').toLowerCase();
          return `
            <tr>
              <td style="padding:12px 16px;font-weight:600;color:var(--primary);">${p.title}</td>
              <td style="padding:12px 16px;">
                <span class="verdict-tag ${verdictClass}">${p.verdict}</span>
              </td>
              <td style="padding:12px 16px;line-height:1.5;">${p.findings}</td>
              <td style="padding:12px 16px;color:var(--gray);">${p.methodology}</td>
            </tr>
          `;
        }).join('');
      }

      results.classList.remove('d-none');
    } catch (err) {
      Toast.error(err.message);
    } finally {
      loading.classList.add('d-none');
    }
  }

  static async loadPaperInsight(paperJsonStr) {
    const emptyState = document.getElementById('insights-empty-state');
    const loadingState = document.getElementById('insights-companion-loading');
    const splitScreen = document.getElementById('insights-companion-split');

    if (!paperJsonStr) {
      InsightsDashboard.activePaper = null;
      emptyState.classList.remove('d-none');
      splitScreen.classList.add('d-none');
      loadingState.classList.add('d-none');
      return;
    }

    const paper = JSON.parse(paperJsonStr);
    InsightsDashboard.activePaper = paper;

    emptyState.classList.add('d-none');
    splitScreen.classList.add('d-none');
    loadingState.classList.remove('d-none');

    // Title
    document.getElementById('insight-paper-title').textContent = `Summary: ${paper.title.slice(0, 50)}...`;

    // Clear previous chat
    const chatBox = document.getElementById('insights-chat-thread');
    chatBox.innerHTML = `<div class="dm"><div class="dav b">ZL</div><div class="dbub b">Hello! Ask me anything about <strong>"${paper.title}"</strong>. I have loaded its content for our discussion.</div></div>`;

    try {
      // Get structured summary
      const { summary } = await ApiClient.post('/chat/structured-summary', {
        title: paper.title,
        abstract: paper.abstract || 'No abstract available.'
      });

      // Render summary
      const takeawaysEl = document.getElementById('sc-takeaways');
      if (summary.takeaways && summary.takeaways.length) {
        takeawaysEl.innerHTML = summary.takeaways.map(t => `<li>${t}</li>`).join('');
      } else {
        takeawaysEl.innerHTML = '<li>Key takeaways not extracted.</li>';
      }

      document.getElementById('sc-methodology').textContent = summary.methodology || 'N/A';
      document.getElementById('sc-findings').textContent = summary.findings || 'N/A';
      document.getElementById('sc-limitations').textContent = summary.limitations || 'N/A';

      splitScreen.classList.remove('d-none');
    } catch (err) {
      Toast.error(err.message);
      emptyState.classList.remove('d-none');
    } finally {
      loadingState.classList.add('d-none');
    }
  }

  static async sendPaperChat() {
    const inp = document.getElementById('insights-chat-inp');
    const text = inp.value.trim();
    if (!text || !InsightsDashboard.activePaper) return;

    inp.value = '';

    // Append user message
    const chatBox = document.getElementById('insights-chat-thread');
    const uDiv = document.createElement('div');
    uDiv.className = 'dm u';
    const initials = Auth.user ? Auth.user.name.slice(0,2).toUpperCase() : 'U';
    uDiv.innerHTML = `<div class="dav u">${initials}</div><div class="dbub u">${text}</div>`;
    chatBox.appendChild(uDiv);
    chatBox.scrollTop = chatBox.scrollHeight;

    // Show typing
    const tDiv = document.createElement('div');
    tDiv.className = 'dm';
    tDiv.id = 'insights-typ';
    tDiv.innerHTML = `<div class="dav b">ZL</div><div class="dbub b"><div class="dtyping"><div class="ddot"></div><div class="ddot"></div><div class="ddot"></div></div></div>`;
    chatBox.appendChild(tDiv);
    chatBox.scrollTop = chatBox.scrollHeight;

    try {
      // Send chat message in context of paper abstract/details
      const paperContext = `Paper Context: Title: "${InsightsDashboard.activePaper.title}", Abstract: "${InsightsDashboard.activePaper.abstract || ''}". User is asking a question in this context.`;
      
      const { response } = await ApiClient.post('/chat/message', {
        message: `${paperContext}\nQuestion: ${text}`
      });

      document.getElementById('insights-typ')?.remove();

      // Append bot response
      const bDiv = document.createElement('div');
      bDiv.className = 'dm';
      const formatted = response
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      bDiv.innerHTML = `<div class="dav b">ZL</div><div class="dbub b">${formatted}</div>`;
      chatBox.appendChild(bDiv);
      chatBox.scrollTop = chatBox.scrollHeight;
    } catch (err) {
      document.getElementById('insights-typ')?.remove();
      Toast.error(err.message);
    }
  }
}

// Interactive Landing Page Playground
class Playground {
  static activeTab = 'consensus';
  
  static consensusData = {
    "does zinc shorten cold duration": {
      statement: "Clinical evidence indicates that zinc lozenges or syrup administered within 24 hours of onset of symptoms significantly reduces the duration of common cold symptoms. However, efficacy varies depending on the dosage and formulation used.",
      yes: 3, unclear: 1, no: 0,
      papers: [
        { title: "Zinc for the common cold — a meta-analysis", verdict: "Yes", findings: "Reduces duration of symptoms by 1.65 days on average.", methodology: "Double-blind, placebo-controlled trial, n=150" },
        { title: "Efficacy of zinc lozenges in shortening cold symptoms", verdict: "Yes", findings: "Shortens cold symptoms by 33% when taken within 24 hours.", methodology: "Randomized clinical study, n=200" },
        { title: "The role of zinc acetate lozenges in common cold recovery", verdict: "Yes", findings: "Symptom duration reduced by 40%. No significant side effects.", methodology: "Meta-analysis of 7 clinical trials, total n=575" },
        { title: "Low-dose zinc lozenges for common cold in school children", verdict: "Unclear", findings: "Showed trend towards reduction but did not reach statistical significance.", methodology: "Pediatric cohort trial, n=120" }
      ]
    },
    "does caffeine enhance long-term memory recall": {
      statement: "Caffeine administration immediately after learning has been shown to enhance memory consolidation over a 24-hour period, indicating a positive effect on long-term memory recall. This effect appears to be dose-dependent, with optimal results observed at 200mg.",
      yes: 2, unclear: 2, no: 0,
      papers: [
        { title: "Post-study caffeine administration enhances memory consolidation in humans", verdict: "Yes", findings: "Significantly improved performance in recognition tests 24 hours post-learning.", methodology: "Double-blind placebo crossover design, n=160" },
        { title: "Caffeine effects on cognitive performance and memory recall", verdict: "Yes", findings: "Enhanced retrieval efficiency and consolidation metrics for complex tasks.", methodology: "Neurological study with EEG mapping, n=85" },
        { title: "The impact of habitual caffeine intake on episodic memory", verdict: "Unclear", findings: "Habitual users showed diminished consolidation benefit compared to naive users.", methodology: "Prospective cohort study, n=300" },
        { title: "Moderate caffeine consumption and age-related memory preservation", verdict: "Unclear", findings: "Correlation observed but confounding factors like sleep quality make causal links unclear.", methodology: "Longitudinal health study, n=1200" }
      ]
    },
    "is microplastics exposure harmful to human gut cells": {
      statement: "In vitro and animal model studies demonstrate that exposure to high concentrations of microplastics causes oxidative stress, inflammatory response, and barrier dysfunction in intestinal epithelial cells. However, clinical evidence for direct human pathogenicity remains limited and requires further investigation.",
      yes: 3, unclear: 1, no: 0,
      papers: [
        { title: "Microplastics induce oxidative stress and cell death in human intestinal cells", verdict: "Yes", findings: "Exposure to polystyrene particles resulted in significant cellular viability reduction.", methodology: "In vitro human Caco-2 cell line assay, n=24 trials" },
        { title: "Intestinal barrier disruption and inflammation by microplastic ingestion", verdict: "Yes", findings: "Increased tight junction permeability and release of pro-inflammatory cytokines.", methodology: "Murine model in vivo ingestion study, n=40 mice" },
        { title: "Toxicity assessment of dietary microplastics in gut microbiota", verdict: "Yes", findings: "Induced microbial dysbiosis, significantly reducing beneficial Lactobacilli strains.", methodology: "Gut microbiome simulator validation" },
        { title: "Analysis of microplastics in human stool samples and dietary intake", verdict: "Unclear", findings: "Microplastics detected in stool, but long-term systemic absorption rate is unknown.", methodology: "Observational pilot study, n=8 healthy volunteers" }
      ]
    }
  };

  static summaryData = {
    "attention": {
      title: "Attention Is All You Need (Vaswani et al., 2017)",
      abstract: "The dominant sequence transduction models are based on complex recurrent or convolutional neural networks that include an encoder and a decoder. The best performing models also connect the encoder and decoder through an attention mechanism. We propose a new simple network architecture, the Transformer, based solely on attention mechanisms, dispensing with recurrence and convolutions entirely. Experiments on two machine translation tasks show these models to be superior in quality while being more parallelizable and requiring significantly less time to train.",
      takeaways: [
        "Introduces the Transformer, the first sequence transduction model based entirely on self-attention.",
        "Eliminates recurrent (LSTM/GRU) and convolutional layers, making training highly parallelizable.",
        "Achieves state-of-the-art results on translation tasks while drastically reducing training times."
      ],
      methodology: "Replaces recurrence with Multi-Head Self-Attention layers combined with Positional Encodings to model sequence order.",
      findings: "Achieved 28.4 BLEU on WMT 2014 English-to-German translation, outperforming previous ensembles by over 2.0 BLEU.",
      limitations: "Requires significant memory resources for processing extremely long context sequences due to quadratic complexity of attention."
    },
    "crispr": {
      title: "CRISPR-Cas9 System for Gene Editing (Doudna & Charpentier)",
      abstract: "Clustered regularly interspaced short palindromic repeats (CRISPR)/CRISPR-associated (Cas) systems provide bacteria and archaea with adaptive immunity against viruses and plasmids. Here, we show that the Cas9 endonuclease can be programmed by a dual-RNA guide to target and cleave specific double-stranded DNA sequences. By combining the tracrRNA and precursor-crRNA into a single synthetic guide RNA, we create a simple two-component system that can be engineered for genome editing in a wide variety of cell types and organisms.",
      takeaways: [
        "Demonstrates programmable double-stranded DNA cleavage using the Cas9 endonuclease.",
        "Simplifies the CRISPR system into a two-component setup using a Single Guide RNA (sgRNA).",
        "Enables precise, targeted genome editing across diverse cell types and organisms."
      ],
      methodology: "Engineered single guide RNA molecules to target specific sequences and direct Cas9 cleavage in vitro.",
      findings: "Successfully introduced double-strand breaks at user-defined loci, which can trigger cellular DNA repair pathways.",
      limitations: "Risk of off-target cleavage at sequence-similar genomic loci and challenges in delivery vectors for therapeutic applications."
    }
  };

  static switchTab(tabName) {
    Playground.activeTab = tabName;
    document.querySelectorAll('.pg-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.pg-tab-content').forEach(c => c.classList.add('d-none'));

    if (tabName === 'consensus') {
      document.getElementById('pg-tab-consensus').classList.add('active');
      document.getElementById('pg-content-consensus').classList.remove('d-none');
    } else {
      document.getElementById('pg-tab-summary').classList.add('active');
      document.getElementById('pg-content-summary').classList.remove('d-none');
      
      const abstractInput = document.getElementById('pg-summary-abstract');
      if (!abstractInput.value) {
        Playground.selectSummaryPaper('attention');
      }
    }
  }

  static selectPreset(question) {
    document.getElementById('pg-consensus-query').value = question;
    Playground.runConsensus();
  }

  static async runConsensus() {
    const query = document.getElementById('pg-consensus-query').value.trim();
    if (!query) return;

    const queryKey = query.toLowerCase().replace(/[?.]/g, '').trim();
    const loading = document.getElementById('pg-consensus-loading');
    const loadingText = document.getElementById('pg-consensus-loading-text');
    const results = document.getElementById('pg-consensus-results');

    loading.classList.remove('d-none');
    results.classList.add('d-none');

    // Simulate search and analysis steps
    loadingText.textContent = "Querying semantic databases...";
    await new Promise(r => setTimeout(r, 600));
    loadingText.textContent = "Synthesizing consensus verdicts...";
    await new Promise(r => setTimeout(r, 600));

    loading.classList.add('d-none');

    const data = Playground.consensusData[queryKey];
    if (data) {
      document.getElementById('pg-consensus-statement').textContent = data.statement;
      
      const total = data.yes + data.unclear + data.no;
      const pctYes = total > 0 ? (data.yes / total) * 100 : 0;
      const pctUnclear = total > 0 ? (data.unclear / total) * 100 : 0;
      const pctNo = total > 0 ? (data.no / total) * 100 : 0;

      document.getElementById('pg-bar-yes').style.width = `${pctYes}%`;
      document.getElementById('pg-bar-unclear').style.width = `${pctUnclear}%`;
      document.getElementById('pg-bar-no').style.width = `${pctNo}%`;

      document.getElementById('pg-txt-yes').textContent = data.yes;
      document.getElementById('pg-txt-unclear').textContent = data.unclear;
      document.getElementById('pg-txt-no').textContent = data.no;

      const tbody = document.getElementById('pg-consensus-table-rows');
      tbody.innerHTML = data.papers.map(p => `
        <tr>
          <td style="padding:10px 14px;font-weight:600;color:var(--primary);">${p.title}</td>
          <td style="padding:10px 14px;"><span class="verdict-tag ${p.verdict.toLowerCase()}">${p.verdict}</span></td>
          <td style="padding:10px 14px;line-height:1.5;">${p.findings}</td>
          <td style="padding:10px 14px;color:var(--gray);">${p.methodology}</td>
        </tr>
      `).join('');
      
      results.classList.remove('d-none');
    } else {
      // It's a custom question. Prompt user to login to run real synthesis.
      sessionStorage.setItem('pending_research_query', query);
      Toast.info("Redirecting to real workspace via Google Sign-In...");
      setTimeout(() => {
        Auth.googleSignIn();
      }, 1000);
    }
  }

  static selectSummaryPaper(key) {
    const abstractInput = document.getElementById('pg-summary-abstract');
    if (key === 'custom') {
      abstractInput.value = '';
      abstractInput.focus();
    } else {
      const data = Playground.summaryData[key];
      if (data) {
        abstractInput.value = data.abstract;
      }
    }
  }

  static async runSummary() {
    const abstract = document.getElementById('pg-summary-abstract').value.trim();
    if (!abstract) return;

    const loading = document.getElementById('pg-summary-loading');
    const results = document.getElementById('pg-summary-results');

    loading.classList.remove('d-none');
    results.classList.add('d-none');

    await new Promise(r => setTimeout(r, 1000));
    loading.classList.add('d-none');

    // Check if it matches one of our presets
    let data = null;
    if (abstract.includes('Transformer') || abstract.includes('recurrence')) {
      data = Playground.summaryData['attention'];
    } else if (abstract.includes('CRISPR') || abstract.includes('Cas9')) {
      data = Playground.summaryData['crispr'];
    } else {
      // Generate a mock/fallback structured summary on the fly for custom abstract
      data = {
        takeaways: [
          "Identifies key themes related to: " + abstract.split(' ').slice(0, 5).join(' ') + "...",
          "Proposes structural evaluation metrics and optimization frameworks.",
          "Demonstrates significant performance enhancements over baseline models."
        ],
        methodology: "Empirical evaluation utilizing sequence transduction parameters.",
        findings: "Demonstrates positive performance indicators in cell/sequence benchmarks.",
        limitations: "Limited to initial model validation scales and parameter distributions."
      };
    }

    document.getElementById('pg-sc-takeaways').innerHTML = data.takeaways.map(t => `<li>${t}</li>`).join('');
    document.getElementById('pg-sc-methodology').textContent = data.methodology;
    document.getElementById('pg-sc-findings').textContent = data.findings;
    document.getElementById('pg-sc-limitations').textContent = data.limitations;

    results.classList.remove('d-none');
  }

  static submitEnterpriseDemo() {
    const org = document.getElementById('ent-org').value.trim();
    const email = document.getElementById('ent-email').value.trim();
    if (!org || !email) return;

    document.getElementById('enterprise-form').classList.add('d-none');
    document.getElementById('ent-confirm-email').textContent = email;
    document.getElementById('ent-success').classList.remove('d-none');
    Toast.success("Enterprise inquiry submitted!");
  }
}

document.addEventListener('DOMContentLoaded', () => App.init());
