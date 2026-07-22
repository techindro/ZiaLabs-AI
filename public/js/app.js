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

    const contentType = res.headers.get('content-type') || '';
    let data;
    if (contentType.includes('application/json')) {
      data = await res.json();
    } else {
      const text = await res.text();
      const cleanText = text.replace(/<[^>]*>/g, '').trim();
      throw new Error(cleanText ? `Server Error (${res.status}): ${cleanText.substring(0, 100)}` : `Server Error (${res.status})`);
    }

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

  static async resetPassword() {
    const emailInput = document.getElementById('si-email');
    let email = emailInput ? emailInput.value.trim() : '';
    if (!email) {
      email = prompt('Enter your registered email address for password reset:');
    }
    if (!email) return;

    try {
      Toast.info('Sending password reset email...');
      const res = await ApiClient.post('/auth/forgot-password', { email });
      Toast.success(res.message || `Password reset link sent to ${email}`);
    } catch (err) {
      Toast.success(`Password reset instructions sent to ${email}`);
    }
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
        Chat.#addBot('Hello! <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:2px;"><path d="M18 13V6a2 2 0 0 0-4 0v4"></path><path d="M14 10V4a2 2 0 0 0-4 0v6"></path><path d="M10 10V3a2 2 0 0 0-4 0v7"></path><path d="M6 10v2a6 6 0 0 0 6 6h2a6 6 0 0 0 6-6V9a2 2 0 0 0-4 0"></path></svg> I am the ZiaLabs AI Research Agent. How can I help with your research today?');
        document.getElementById('chatbot-welcome').style.display = '';
        document.getElementById('chatbot-thread').style.display = 'none';
      } else {
        messages.forEach(m => {
          if (m.role === 'user') Chat.#addUser(m.content);
          else Chat.#addBot(m.content);
        });
        document.getElementById('chatbot-welcome').style.display = 'none';
        document.getElementById('chatbot-thread').style.display = 'flex';
      }
    } catch {
      // if history load fails just show greeting
      Chat.#addBot('Hello! <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:2px;"><path d="M18 13V6a2 2 0 0 0-4 0v4"></path><path d="M14 10V4a2 2 0 0 0-4 0v6"></path><path d="M10 10V3a2 2 0 0 0-4 0v7"></path><path d="M6 10v2a6 6 0 0 0 6 6h2a6 6 0 0 0 6-6V9a2 2 0 0 0-4 0"></path></svg> I am the ZiaLabs AI Research Agent. How can I help with your research today?');
      document.getElementById('chatbot-welcome').style.display = '';
      document.getElementById('chatbot-thread').style.display = 'none';
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
      Chat.#addBot('Chat cleared! <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:2px;"><path d="M3 3l18 18M15 9l-6 6"></path></svg> Start a new conversation.');
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
      
      const elSearches = document.getElementById('m-searches');
      if (elSearches) elSearches.textContent = stats.searches;
      
      const elSearchesSub = document.getElementById('m-searches-sub');
      if (elSearchesSub) elSearchesSub.textContent = `+${stats.searchesThisWeek} this week`;
      
      const elPapers = document.getElementById('m-papers');
      if (elPapers) elPapers.textContent = stats.papersSaved;
      
      const elInsights = document.getElementById('m-insights');
      if (elInsights) elInsights.textContent = stats.insightsGenerated;

      const elApi = document.getElementById('m-api');
      if (elApi) {
        const left = stats.apiCallsLimit - stats.apiCallsUsed;
        elApi.textContent = left;
      }
      
      const elApiSub = document.getElementById('m-api-sub');
      if (elApiSub) elApiSub.textContent = `${stats.apiCallsLimit} limit / mo`;
    } catch {
      // default numbers already in html
    }
  }

  static async loadRecentSearches() {
    try {
      const { searches } = await ApiClient.get('/search/history?limit=5');
      const box = document.getElementById('recent-searches');
      if (!box) return;

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
        box.innerHTML = '<div style="padding:60px 0;text-align:center"><div style="font-size:40px;margin-bottom:16px"><svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="var(--primary)" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg></div><div style="font-size:16px;font-weight:600;color:var(--black)">No papers found</div><div style="font-size:13px;color:var(--gray);margin-top:8px">Try adjusting your keywords.</div></div>';
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
        box.innerHTML = '<div style="padding:60px 0;text-align:center"><div style="font-size:40px;margin-bottom:16px"><svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="var(--primary)" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg></div><div style="font-size:16px;font-weight:600;color:var(--black)">Your library is empty</div><div style="font-size:13px;color:var(--gray);margin-top:8px">Save papers from search results to build your collection.</div></div>';
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
      btn.textContent = 'Saved <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>';
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
  static openModal() {
    if (!Auth.isLoggedIn()) {
      Toast.info('Please sign in or create an account to upgrade to Pro.');
      App.showPage('pg-signin');
      return;
    }
    const overlay = document.getElementById('payment-modal-overlay');
    if (overlay) overlay.classList.remove('d-none');
  }

  static closeModal() {
    const overlay = document.getElementById('payment-modal-overlay');
    if (overlay) overlay.classList.add('d-none');
  }

  static upgrade() {
    Payment.openModal();
  }

  static switchTab(tab) {
    const rzpBtn = document.getElementById('pay-tab-razorpay');
    const qrBtn = document.getElementById('pay-tab-qr');
    const rzpContent = document.getElementById('pay-content-razorpay');
    const qrContent = document.getElementById('pay-content-qr');

    if (tab === 'razorpay') {
      rzpBtn.style.color = 'var(--primary)';
      rzpBtn.style.background = '#fff';
      rzpBtn.style.boxShadow = 'var(--shadow-sm)';
      rzpBtn.style.fontWeight = '700';

      qrBtn.style.color = 'var(--gray)';
      qrBtn.style.background = 'transparent';
      qrBtn.style.boxShadow = 'none';
      qrBtn.style.fontWeight = '600';

      rzpContent.classList.remove('d-none');
      qrContent.classList.add('d-none');
    } else {
      qrBtn.style.color = 'var(--primary)';
      qrBtn.style.background = '#fff';
      qrBtn.style.boxShadow = 'var(--shadow-sm)';
      qrBtn.style.fontWeight = '700';

      rzpBtn.style.color = 'var(--gray)';
      rzpBtn.style.background = 'transparent';
      rzpBtn.style.boxShadow = 'none';
      rzpBtn.style.fontWeight = '600';

      qrContent.classList.remove('d-none');
      rzpContent.classList.add('d-none');
    }
  }

  static async startRazorpayCheckout() {
    try {
      Toast.info('Creating Razorpay order...');
      const order = await ApiClient.post('/payment/razorpay-order');

      if (!window.Razorpay || (order.orderId && order.orderId.startsWith('order_demo_'))) {
        Toast.info('Razorpay SDK loading or fallback active... Activating Pro Plan.');
        return Payment.instantDemoUpgrade();
      }

      const options = {
        key: order.key || 'rzp_test_demo',
        amount: order.amount || 24900,
        currency: order.currency || 'INR',
        name: 'ZiaLabs AI',
        description: 'Pro Subscription — Unlimited AI Research',
        image: '/img/icon-192.png',
        order_id: order.orderId,
        handler: async function (response) {
          Toast.info('Verifying Razorpay payment...');
          try {
            const verifyRes = await ApiClient.post('/payment/verify-razorpay', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature
            });
            Auth.user = { ...(Auth.user || {}), ...verifyRes.user };
            localStorage.setItem('zl_user', JSON.stringify(Auth.user));
            Payment.closeModal();
            Toast.success('<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:2px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg> Razorpay Payment Verified! Welcome to ZiaLabs Pro.');
            Dashboard.init();
            App.showPage('pg-dash');
          } catch (vErr) {
            Toast.error(vErr.message);
          }
        },
        prefill: {
          name: Auth.user ? Auth.user.name : '',
          email: Auth.user ? Auth.user.email : ''
        },
        theme: {
          color: '#047857'
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (response) {
        Toast.error('Razorpay payment failed: ' + response.error.description);
      });
      rzp.open();
    } catch (err) {
      console.warn('Razorpay order creation fallback:', err.message);
      Payment.instantDemoUpgrade();
    }
  }

  static async submitUpiVerification() {
    const inp = document.getElementById('upi-utr-input');
    const utr = inp ? inp.value.trim() : '';

    if (!utr || utr.length < 6) {
      Toast.error('Please enter a valid 12-digit UPI UTR or Reference Number.');
      return;
    }

    try {
      Toast.info('Verifying UPI Payment reference...');
      const res = await ApiClient.post('/payment/verify-upi', { utr });
      if (res.user) {
        Auth.user = { ...(Auth.user || {}), ...res.user };
        localStorage.setItem('zl_user', JSON.stringify(Auth.user));
      }
      Payment.closeModal();
      Toast.success('<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:2px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg> UPI Payment Verified! Pro Plan Activated.');
      Dashboard.init();
      App.showPage('pg-dash');
    } catch (err) {
      Toast.error(err.message);
    }
  }

  static async instantDemoUpgrade() {
    try {
      const res = await ApiClient.post('/payment/upgrade-demo');
      if (res.user) {
        Auth.user = { ...(Auth.user || {}), ...res.user };
        localStorage.setItem('zl_user', JSON.stringify(Auth.user));
      }
      Payment.closeModal();
      Toast.success('<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:2px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg> Pro Plan Activated! Unlimited paper search & AI synthesis unlocked.');
      Dashboard.init();
      App.showPage('pg-dash');
    } catch (err) {
      Toast.error(err.message);
    }
  }

  static checkStatus() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('upgrade') === 'success') {
      if (Auth.user) {
        Auth.user.plan = 'pro';
        localStorage.setItem('zl_user', JSON.stringify(Auth.user));
      }
      Toast.success('<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:2px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg> Upgrade successful! You are now a Pro member.');
      window.history.replaceState({}, document.title, window.location.pathname);
      if (Auth.isLoggedIn()) {
        Dashboard.init();
        App.showPage('pg-dash');
      }
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
    
    // Scroll to top immediately on page change
    window.scrollTo({ top: 0, behavior: 'instant' });

    if (id === 'pg-dash') Dashboard.init();
    if (id === 'pg-blog') {
      Blog.switchTab('articles');
      Blog.loadPosts();
      Blog.loadTrendingNews();
    }
    
    // ensure sidebar is hidden on page switch if we were on mobile
    document.getElementById('dash-sidebar')?.classList.remove('open');
  }

  static showLandingSection(sectionId) {
    App.showPage('pg-landing');
    setTimeout(() => {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
    }, 150);
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

  static quickPrompt(text) {
    const inp = document.getElementById('dinp');
    if (inp) {
      inp.value = text;
      document.getElementById('chatbot-welcome').style.display = 'none';
      document.getElementById('chatbot-thread').style.display = 'flex';
      Chat.send();
    }
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
      if (document.getElementById('m-paper-tab-overfit')) {
        LandingShowcase.select('overfit');
      }
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
      const { posts } = await ApiClient.get('/blog');
      if (!posts?.length) return;

      box.innerHTML = posts.slice(0, 3).map((item, idx) => {
        return `
          <div class="blog-card" onclick="Blog.loadArticle('${item.slug}')">
            <div class="blog-img-wrap">
              <img src="/img/blog${idx+1}.png" alt="Research Update">
            </div>
            <div style="font-size:12px;color:var(--red);font-weight:600;margin-bottom:8px">
              ${item.tag.toUpperCase()} • LATEST
            </div>
            <div style="font-size:16px;font-weight:700;margin-bottom:8px">${item.title}</div>
            <p style="font-size:13px;color:var(--gray);line-height:1.5">${item.excerpt}</p>
          </div>
        `;
      }).join('');
    } catch (err) {
      console.warn('Local blog posts failed to load on homepage:', err.message);
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

class Blog {
  static currentArticle = null;
  static activeTag = '';
  static searchTerm = '';
  static searchTimeout = null;

  static async loadPosts() {
    const listContainer = document.getElementById('blog-posts-view');
    if (!listContainer) return;

    listContainer.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--gray);">Loading research insights...</div>';

    try {
      const url = `/blog?tag=${encodeURIComponent(Blog.activeTag)}&q=${encodeURIComponent(Blog.searchTerm)}`;
      const { posts } = await ApiClient.get(url);

      // Render tags navigation
      Blog.renderTags(posts);

      if (!posts || !posts.length) {
        listContainer.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--gray);">No articles found matching your criteria.</div>';
        return;
      }

      listContainer.innerHTML = posts.map((post, idx) => {
        const imageIndex = (idx % 3) + 1;
        return `
          <div class="blog-card" onclick="Blog.loadArticle('${post.slug}')">
            <div class="blog-img-wrap">
              <img src="/img/blog${imageIndex}.png" alt="${post.title}">
            </div>
            <div class="blog-card-tag">${post.tag.toUpperCase()}</div>
            <div class="blog-card-title">${post.title}</div>
            <p class="blog-card-excerpt">${post.excerpt}</p>
            <div class="blog-card-footer">
              <span>Read Article &rarr;</span>
              <span>${post.read_time}</span>
            </div>
          </div>
        `;
      }).join('');

      MathRenderer.render(listContainer);
    } catch (err) {
      listContainer.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:red;">Error: ${err.message}</div>`;
    }
  }

  static renderTags(posts = []) {
    const tagsContainer = document.getElementById('blog-tags-list');
    if (!tagsContainer) return;

    const categories = ['All', 'AI & ML', 'Privacy', 'Research Guide', 'Education'];
    
    tagsContainer.innerHTML = categories.map(cat => {
      const value = cat === 'All' ? '' : cat;
      const isActive = Blog.activeTag === value;
      return `
        <button class="tag-pill ${isActive ? 'active' : ''}" onclick="Blog.filterByTag('${value}')">
          ${cat}
        </button>
      `;
    }).join('');
  }

  static filterByTag(tag) {
    Blog.activeTag = tag;
    Blog.loadPosts();
  }

  static handleSearch(value) {
    Blog.searchTerm = value.trim();
    if (Blog.searchTimeout) clearTimeout(Blog.searchTimeout);
    Blog.searchTimeout = setTimeout(() => {
      Blog.loadPosts();
    }, 250);
  }

  static async loadArticle(slug) {
    App.showPage('pg-blog-article');
    
    // Clear comment inputs
    const nameInp = document.getElementById('comment-name-input');
    const contentInp = document.getElementById('comment-content-input');
    if (nameInp) nameInp.value = Auth.user ? Auth.user.name : '';
    if (contentInp) contentInp.value = '';

    const titleEl = document.getElementById('article-detail-title');
    const bodyEl = document.getElementById('article-detail-body');
    const tagEl = document.getElementById('article-badge-tag');
    const avatarEl = document.getElementById('article-detail-avatar');
    const authorEl = document.getElementById('article-detail-author');
    const dateEl = document.getElementById('article-detail-date');
    const readTimeEl = document.getElementById('article-detail-read-time');
    const likesEl = document.getElementById('article-likes-val');
    const commentsCountEl = document.getElementById('article-comments-val');
    const commentsListEl = document.getElementById('article-comments-thread');

    titleEl.textContent = 'Loading article content...';
    bodyEl.innerHTML = '';
    commentsListEl.innerHTML = 'Loading discussion...';

    try {
      const { post } = await ApiClient.get(`/blog/${slug}`);
      Blog.currentArticle = post;

      titleEl.textContent = post.title;
      bodyEl.innerHTML = post.content;
      tagEl.textContent = post.tag;
      avatarEl.textContent = post.author_avatar || post.author_name.slice(0,2).toUpperCase();
      authorEl.textContent = post.author_name;
      dateEl.textContent = new Date(post.published_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      readTimeEl.textContent = post.read_time;
      likesEl.textContent = post.likes || 0;
      commentsCountEl.textContent = post.comments ? post.comments.length : 0;

      const editBtn = document.getElementById('btn-edit-article-trigger');
      if (editBtn) {
        editBtn.onclick = () => Blog.openPublishModal(post.slug);
      }

      Blog.initProgressScroll();
      Blog.renderComments(post.comments || []);

      MathRenderer.render(bodyEl);
      MathRenderer.render(commentsListEl);
    } catch (err) {
      titleEl.textContent = 'Failed to load article';
      bodyEl.innerHTML = `<p style="color:red;text-align:center;">Error: ${err.message}</p>`;
      Toast.error(err.message);
    }
  }

  static initProgressScroll() {
    const bar = document.getElementById('blog-reading-bar');
    if (!bar) return;

    bar.style.width = '0%';
    window.onscroll = () => {
      const page = document.getElementById('pg-blog-article');
      if (!page || !page.classList.contains('active')) return;

      const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
      const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const scrolled = height > 0 ? (winScroll / height) * 100 : 0;
      bar.style.width = scrolled + '%';
    };
  }

  static async likeCurrentArticle() {
    if (!Blog.currentArticle) return;
    const slug = Blog.currentArticle.slug;

    try {
      const res = await ApiClient.post(`/blog/${slug}/like`);
      document.getElementById('article-likes-val').textContent = res.likes;
      Blog.currentArticle.likes = res.likes;
      
      const likeBtn = document.getElementById('article-like-button');
      likeBtn.classList.add('liked');
      setTimeout(() => likeBtn.classList.remove('liked'), 400);

      Toast.success('Article upvoted!');
    } catch (err) {
      Toast.error(err.message);
    }
  }

  static shareCurrentArticle() {
    if (!Blog.currentArticle) return;
    const shareUrl = window.location.origin + `/blog/${Blog.currentArticle.slug}`;
    
    navigator.clipboard.writeText(shareUrl).then(() => {
      Toast.success('Article link copied to clipboard!');
    }).catch(() => {
      Toast.error('Could not copy link.');
    });
  }

  static discussWithAI() {
    if (!Blog.currentArticle) return;
    sessionStorage.setItem('pending_research_query', `I'm reading your blog article titled "${Blog.currentArticle.title}" about ${Blog.currentArticle.tag}. Can you provide a summary and explain the primary takeaways?`);
    App.showPage('pg-dash');
  }

  static renderComments(comments = []) {
    const thread = document.getElementById('article-comments-thread');
    if (!thread) return;

    if (!comments.length) {
      thread.innerHTML = '<div style="text-align:center;padding:24px 0;color:var(--gray);font-style:italic;">No comments yet. Be the first to start the discussion!</div>';
      return;
    }

    thread.innerHTML = comments.map(c => {
      const initials = c.user_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'AN';
      const time = new Date(c.created_at).toLocaleString();
      return `
        <div class="comment-bubble">
          <div class="comment-avatar">${initials}</div>
          <div class="comment-details">
            <div class="comment-meta">
              <span class="comment-author">${c.user_name}</span>
              <span class="comment-time">${time}</span>
            </div>
            <div class="comment-body">${c.content}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  static async submitComment(event) {
    event.preventDefault();
    if (!Blog.currentArticle) return;

    const slug = Blog.currentArticle.slug;
    const nameInp = document.getElementById('comment-name-input');
    const contentInp = document.getElementById('comment-content-input');
    
    const userName = nameInp.value.trim();
    const content = contentInp.value.trim();

    if (!userName || !content) return;

    try {
      const { comment } = await ApiClient.post(`/blog/${slug}/comment`, {
        user_name: userName,
        content: content
      });

      if (!Blog.currentArticle.comments) Blog.currentArticle.comments = [];
      Blog.currentArticle.comments.push(comment);

      Blog.renderComments(Blog.currentArticle.comments);
      document.getElementById('article-comments-val').textContent = Blog.currentArticle.comments.length;
      contentInp.value = '';
      
      Toast.success('Comment added successfully!');
    } catch (err) {
      Toast.error(err.message);
    }
  }

  static currentTab = 'articles';

  static async switchTab(tab) {
    Blog.currentTab = tab;

    // Toggle tab buttons active class
    ['articles', 'notes', 'news'].forEach(t => {
      const btn = document.getElementById(`blog-tab-${t}`);
      const content = document.getElementById(`blog-tab-${t}-content`);
      if (btn) {
        if (t === tab) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      }
      if (content) {
        if (t === tab) {
          content.classList.remove('d-none');
        } else {
          content.classList.add('d-none');
        }
      }
    });

    if (tab === 'notes') {
      await Blog.loadNotes();
    } else if (tab === 'news') {
      await Blog.loadTrendingNews();
    }
  }

  static async loadNotes() {
    const feed = document.getElementById('blog-notes-feed');
    if (!feed) return;

    feed.innerHTML = '<div style="text-align:center;padding:40px;color:var(--gray);">Loading research notes...</div>';

    try {
      const { notes } = await ApiClient.get('/blog/notes');
      if (!notes || !notes.length) {
        feed.innerHTML = '<div style="text-align:center;padding:40px;color:var(--gray);font-style:italic;">No suggestions or notes yet. Be the first to share!</div>';
        return;
      }

      feed.innerHTML = notes.map(note => {
        const initials = note.author_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'AN';
        const time = new Date(note.created_at).toLocaleString();
        return `
          <div class="comment-bubble" style="background:#fff;border:1px solid var(--border);border-radius:var(--border-radius-lg);padding:20px;box-shadow:0 4px 10px rgba(0,0,0,0.005);">
            <div class="comment-avatar" style="background:var(--primary-light);color:var(--primary);">${initials}</div>
            <div class="comment-details" style="border:none;padding:0;box-shadow:none;max-width:100%;">
              <div class="comment-meta" style="margin-bottom:8px;">
                <span class="comment-author" style="font-size:14px;font-weight:700;color:var(--primary);">${note.author_name}</span>
                <span class="comment-time" style="font-size:11px;color:var(--gray-light);">${time}</span>
              </div>
              <div class="comment-body" style="font-size:14px;color:var(--black);line-height:1.6;margin-bottom:12px;">${note.content}</div>
              <div style="display:flex;gap:16px;align-items:center;">
                <button class="btn-like" onclick="Blog.likeNote(${note.id})" id="note-like-${note.id}" style="width:auto;padding:4px 12px;font-size:11px;font-weight:600;border-radius:12px;gap:4px;margin:0;">
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="fill:${note.likes > 0 ? 'currentColor' : 'none'};"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                  <span>Upvote</span>
                  <span class="like-badge" style="font-size:10px;padding:0 4px;">${note.likes || 0}</span>
                </button>
              </div>
            </div>
          </div>
        `;
      }).join('');

      MathRenderer.render(feed);
    } catch (err) {
      feed.innerHTML = `<div style="text-align:center;padding:40px;color:red;">Error: ${err.message}</div>`;
    }
  }

  static async submitNote() {
    const authorInp = document.getElementById('note-author-input');
    const contentInp = document.getElementById('note-content-input');
    if (!authorInp || !contentInp) return;

    const author = authorInp.value.trim();
    const content = contentInp.value.trim();

    if (!author || !content) {
      Toast.error('Please enter your name and a note.');
      return;
    }

    try {
      await ApiClient.post('/blog/notes', {
        author_name: author,
        content: content
      });
      
      contentInp.value = '';
      document.getElementById('note-char-count').textContent = '280 characters remaining';
      Toast.success('Note posted successfully!');
      await Blog.loadNotes();
    } catch (err) {
      Toast.error(err.message);
    }
  }

  static async likeNote(id) {
    try {
      const res = await ApiClient.post(`/blog/notes/${id}/like`);
      await Blog.loadNotes(); // Refresh to update count
      Toast.success('Note upvoted!');
    } catch (err) {
      Toast.error(err.message);
    }
  }

  static openPublishModal(editSlug = '') {
    const overlay = document.getElementById('publish-modal-overlay');
    const form = document.getElementById('publish-article-form');
    const titleInp = document.getElementById('publish-title-input');
    const excerptInp = document.getElementById('publish-excerpt-input');
    const contentInp = document.getElementById('publish-content-input');
    const tagInp = document.getElementById('publish-tag-input');
    const authorInp = document.getElementById('publish-author-input');
    const authorField = document.getElementById('publish-author-field');
    const titleEl = document.getElementById('publish-modal-title');
    const submitBtn = document.getElementById('publish-modal-submit-btn');
    const slugInp = document.getElementById('edit-article-slug');

    if (!overlay || !form) return;

    form.reset();
    overlay.classList.remove('d-none');

    if (editSlug) {
      slugInp.value = editSlug;
      titleEl.textContent = 'Edit Research Article';
      submitBtn.textContent = 'Save Changes';
      authorField.style.display = 'none';
      authorInp.removeAttribute('required');

      if (Blog.currentArticle && Blog.currentArticle.slug === editSlug) {
        titleInp.value = Blog.currentArticle.title;
        excerptInp.value = Blog.currentArticle.excerpt;
        contentInp.value = Blog.currentArticle.content;
        tagInp.value = Blog.currentArticle.tag;
      }
    } else {
      slugInp.value = '';
      titleEl.textContent = 'Publish Research Article';
      submitBtn.textContent = 'Publish Article';
      authorField.style.display = 'block';
      authorInp.setAttribute('required', 'required');
      if (Auth.user) {
        authorInp.value = Auth.user.name;
      }
    }
  }

  static closePublishModal() {
    const overlay = document.getElementById('publish-modal-overlay');
    if (overlay) overlay.classList.add('d-none');
  }

  static async submitArticle(event) {
    event.preventDefault();
    const slug = document.getElementById('edit-article-slug').value;
    const title = document.getElementById('publish-title-input').value.trim();
    const excerpt = document.getElementById('publish-excerpt-input').value.trim();
    const content = document.getElementById('publish-content-input').value.trim();
    const tag = document.getElementById('publish-tag-input').value;
    const author_name = document.getElementById('publish-author-input').value.trim();

    if (!title || !content || !excerpt) return;

    try {
      if (slug) {
        await ApiClient.put(`/blog/${slug}`, { title, excerpt, content, tag });
        Toast.success('Article updated successfully!');
        Blog.closePublishModal();
        await Blog.loadArticle(slug);
      } else {
        await ApiClient.post('/blog', { title, excerpt, content, tag, author_name });
        Toast.success('Article published successfully!');
        Blog.closePublishModal();
        await Blog.loadPosts();
      }
    } catch (err) {
      Toast.error(err.message);
    }
  }

  static async loadTrendingNews() {
    const feed = document.getElementById('blog-news-feed');
    const sidebar = document.getElementById('blog-sidebar-news');
    if (!feed && !sidebar) return;

    try {
      const { news } = await ApiClient.get('/news');
      if (!news || !news.length) {
        if (feed) feed.innerHTML = '<div style="text-align:center;color:var(--gray);">No global trending news active right now.</div>';
        if (sidebar) sidebar.innerHTML = '<div style="color:var(--gray-light);">No active news.</div>';
        return;
      }

      if (sidebar) {
        sidebar.innerHTML = news.slice(0, 3).map(item => `
          <div style="border-bottom:1px solid var(--border);padding-bottom:8px;margin-bottom:8px;text-align:left;">
            <a href="${item.link}" target="_blank" style="font-weight:600;color:var(--primary);text-decoration:none;line-height:1.4;display:block;">${item.title}</a>
            <div style="font-size:11px;color:var(--gray-light);margin-top:4px;display:flex;justify-content:space-between;">
              <span>${item.source}</span>
              <span>${new Date(item.pubDate).toLocaleDateString()}</span>
            </div>
          </div>
        `).join('');
      }

      if (feed) {
        feed.innerHTML = news.map(item => `
          <div style="border-bottom:1.5px solid var(--border);padding-bottom:20px;margin-bottom:20px;text-align:left;">
            <h4 style="font-family:var(--font-heading);font-size:17px;font-weight:600;margin-bottom:8px;">
              <a href="${item.link}" target="_blank" style="color:var(--primary);text-decoration:none;">${item.title}</a>
            </h4>
            <p style="font-size:13.5px;color:var(--gray);line-height:1.6;margin-bottom:12px;">${item.contentSnippet || 'Click below to read the full report on the publisher\'s site.'}</p>
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;color:var(--gray-light);">
              <span>Source: <strong>${item.source}</strong></span>
              <span>Published: ${new Date(item.pubDate).toLocaleDateString()}</span>
            </div>
          </div>
        `).join('');
      }
    } catch (err) {
      console.error('Error loading trending news:', err);
    }
  }
}

class MiniChatbot {
  static isOpen = false;

  static toggle() {
    const card = document.getElementById('mini-chatbot-card');
    if (!card) return;

    MiniChatbot.isOpen = !MiniChatbot.isOpen;
    if (MiniChatbot.isOpen) {
      card.classList.remove('d-none');
      document.getElementById('mini-chatbot-text')?.focus();
    } else {
      card.classList.add('d-none');
    }
  }

  static askPreset(question) {
    MiniChatbot.appendUser(question);
    MiniChatbot.showTyping();

    setTimeout(() => {
      document.getElementById('mini-chatbot-typing')?.remove();
      let response = '';
      if (question.includes('search')) {
        response = 'To search papers, log in or sign up first. Then head to the **Search Papers** tab in the sidebar, input your keywords or query, and click Search! We query ArXiv and Semantic Scholar.';
      } else if (question.includes('Synthesis') || question.includes('Consensus')) {
        response = 'Our **Consensus Engine** and **Literature Synthesis** tool compiles multiple studies, reads their abstracts, and aggregates results. It will show you a verdict breakdown (Yes / No / Unclear) and tabular methodology comparison.';
      } else if (question.includes('cost') || question.includes('Pricing')) {
        response = 'ZiaLabs Pro plan is available for just $3/month (or $2/month billed annually). It gives you unlimited search queries, unlimited PDF uploads/chats, and auto Zotero/Notion syncing!';
      } else {
        response = "That is a great question. You can access our full AI chat agent by creating a free account. ZiaLabs speaks English, Hindi, Tamil, and Bhojpuri natively!";
      }
      MiniChatbot.appendBot(response);
    }, 800);
  }

  static send() {
    const input = document.getElementById('mini-chatbot-text');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;

    input.value = '';
    MiniChatbot.appendUser(text);
    MiniChatbot.showTyping();

    setTimeout(() => {
      document.getElementById('mini-chatbot-typing')?.remove();
      let response = `ZiaLabs: "I've received your query: '${text}'. To analyze research papers or chat dynamically with our full Gemini models, please sign up or log in to the Workspace!"`;
      MiniChatbot.appendBot(response);
    }, 1000);
  }

  static appendUser(text) {
    const thread = document.getElementById('mini-chatbot-msgs-thread');
    const el = document.createElement('div');
    el.className = 'mini-chatbot-bubble user';
    el.textContent = text;
    thread.appendChild(el);
    thread.scrollTop = thread.scrollHeight;
  }

  static appendBot(text) {
    const thread = document.getElementById('mini-chatbot-msgs-thread');
    const el = document.createElement('div');
    el.className = 'mini-chatbot-bubble bot';
    el.innerHTML = text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
    thread.appendChild(el);
    thread.scrollTop = thread.scrollHeight;
    
    MathRenderer.render(el);
  }

  static showTyping() {
    const thread = document.getElementById('mini-chatbot-msgs-thread');
    const el = document.createElement('div');
    el.className = 'mini-chatbot-bubble bot';
    el.id = 'mini-chatbot-typing';
    el.innerHTML = `<div class="dtyping"><div class="ddot"></div><div class="ddot"></div><div class="ddot"></div></div>`;
    thread.appendChild(el);
    thread.scrollTop = thread.scrollHeight;
  }
}

class LandingShowcase {
  static papers = {
    overfit: {
      accuracy: 'ACCURACY 98%',
      title: 'Benign Overfitting in Token Selection of Attention Mechanisms',
      findings: 'Attention mechanisms achieve benign overfitting in token selection, maintaining high generalization even with noisy training labels.',
      methodology: 'Analyzes training dynamics and classification error using a mathematical framework based on Signal-to-Noise Ratio (SNR).',
      question: 'What is the sample size or validation dataset?',
      answer: 'The study validates theoretical bounds using both synthetic datasets and real-world classification benchmarks.',
      placeholder: 'Ask about sample size...'
    },
    attention: {
      accuracy: 'CITATIONS 145K+',
      title: 'Attention Is All You Need',
      findings: 'Replaces recurrent layers with self-attention, achieving superior translation quality and speed during training.',
      methodology: 'Evaluates Transformer networks on WMT 2014 English-to-German and English-to-French translation datasets.',
      question: 'Why is parallelization improved?',
      answer: 'By removing sequential recurrences, self-attention layers process all sequence tokens simultaneously during training.',
      placeholder: 'Ask about parallelization...'
    },
    crispr: {
      accuracy: 'NOBEL PRIZE WORK',
      title: 'Programmable Cas9 Endonuclease for Gene Editing',
      findings: 'Shows Cas9 can be programmed with single guide RNAs to target and cut specific double-stranded DNA sequences.',
      methodology: 'In vitro cleavage assays analyzing target sequence mutations using engineered CRISPR RNA structures.',
      question: 'What does Cas9 require to bind?',
      answer: 'Cas9 requires a target sequence complementary to the guide RNA, adjacent to a Protospacer Adjacent Motif (PAM).',
      placeholder: 'Ask about Cas9 binding requirements...'
    }
  };

  static select(key) {
    const data = LandingShowcase.papers[key];
    if (!data) return;

    // Toggle active class on tabs
    document.querySelectorAll('.mock-paper-tab').forEach(tab => {
      tab.classList.remove('active');
      tab.style.background = '#fff';
      tab.style.color = 'var(--gray)';
      tab.style.fontWeight = '500';
      tab.style.borderColor = 'var(--border)';
    });

    const activeTab = document.getElementById(`m-paper-tab-${key}`);
    if (activeTab) {
      activeTab.classList.add('active');
      activeTab.style.background = 'var(--primary-light)';
      activeTab.style.color = 'var(--primary)';
      activeTab.style.fontWeight = '600';
      activeTab.style.borderColor = 'rgba(0,64,64,0.15)';
    }

    // Update insights panel
    document.getElementById('m-paper-accuracy').textContent = data.accuracy;
    document.getElementById('m-paper-title').textContent = data.title;
    document.getElementById('m-paper-findings').textContent = data.findings;
    document.getElementById('m-paper-methodology').textContent = data.methodology;

    // Render LaTeX equations in central panel
    MathRenderer.render(document.getElementById('m-paper-findings'));
    MathRenderer.render(document.getElementById('m-paper-methodology'));

    // Trigger typewriter animation for chat
    const qEl = document.getElementById('m-chat-question');
    const aEl = document.getElementById('m-chat-answer');
    const inpEl = document.getElementById('m-chat-input');

    if (!qEl || !aEl) return;

    qEl.textContent = '';
    aEl.textContent = '';
    if (inpEl) inpEl.placeholder = data.placeholder;

    // Animate typing question
    let qIdx = 0;
    const typeQ = () => {
      if (qIdx < data.question.length) {
        qEl.textContent += data.question[qIdx++];
        setTimeout(typeQ, 20);
      } else {
        // Render LaTeX in the question bubble
        MathRenderer.render(qEl);

        // Start answer after brief pause
        setTimeout(() => {
          let aIdx = 0;
          const typeA = () => {
            if (aIdx < data.answer.length) {
              aEl.textContent += data.answer[aIdx++];
              setTimeout(typeA, 12);
            } else {
              // Render LaTeX in the answer bubble when complete
              MathRenderer.render(aEl);
            }
          };
          typeA();
        }, 300);
      }
    };
    typeQ();
  }
}

class MathRenderer {
  static render(element) {
    if (window.renderMathInElement) {
      window.renderMathInElement(element, {
        delimiters: [
          {left: '$$', right: '$$', display: true},
          {left: '$', right: '$', display: false},
          {left: '\\(', right: '\\)', display: false},
          {left: '\\[', right: '\\]', display: true}
        ],
        throwOnError: false
      });
    }
  }
}

class CommandPalette {
  static isOpen = false;

  static toggle() {
    const overlay = document.getElementById('cmd-palette-overlay');
    if (!overlay) return;
    CommandPalette.isOpen = !CommandPalette.isOpen;
    if (CommandPalette.isOpen) {
      overlay.classList.remove('d-none');
      const input = document.getElementById('cmd-palette-input');
      if (input) {
        input.value = '';
        input.focus();
      }
    } else {
      overlay.classList.add('d-none');
    }
  }

  static execute(action) {
    CommandPalette.toggle();
    if (action === 'search') {
      if (Auth.isLoggedIn()) App.showPage('pg-dash');
      else App.showPage('pg-signup');
    } else if (action === 'blog') {
      App.showPage('pg-blog');
    } else if (action === 'pricing') {
      App.showLandingSection('pricing');
    } else if (action === 'enterprise') {
      App.showLandingSection('enterprise');
    }
  }
}

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    CommandPalette.toggle();
  } else if (e.key === 'Escape' && CommandPalette.isOpen) {
    CommandPalette.toggle();
  }
});

class PWAInstaller {
  static deferredPrompt = null;

  static init() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      PWAInstaller.deferredPrompt = e;
      const installBtns = document.querySelectorAll('.pwa-install-btn');
      installBtns.forEach(btn => btn.style.display = 'inline-flex');
    });

    window.addEventListener('appinstalled', () => {
      PWAInstaller.deferredPrompt = null;
      Toast.success('ZiaLabs AI App installed successfully!');
    });
  }

  static prompt() {
    if (PWAInstaller.deferredPrompt) {
      PWAInstaller.deferredPrompt.prompt();
      PWAInstaller.deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('User accepted PWA prompt');
        }
        PWAInstaller.deferredPrompt = null;
      });
    } else {
      Toast.info('ZiaLabs AI is ready to install! Use your browser menu "Add to Home Screen".');
    }
  }
}

class Industries {
  static domainQueries = {
    pharmaceuticals: "What are the latest clinical breakthroughs in targeted small-molecule therapeutics for oncology?",
    academia: "What are the key open questions and progress in quantum error correction and topological quantum computing?",
    medtech: "What calibration models and safety standards improve accuracy for implantable medical sensors?",
    policy: "What empirical evidence exists on carbon pricing policy effectiveness for industrial emission reduction?",
    consumer: "What bio-based sustainable polymer packaging materials show high thermal stability and barrier properties?",
    industrials: "How to mitigate temperature drift and thermal strain hysteresis in MEMS silicon piezoresistive sensors?",
    software: "What are the optimal energy efficiency and latency trade-offs for deep learning gesture recognition models on edge hardware?"
  };

  static async explore(domainKey) {
    const query = Industries.domainQueries[domainKey] || "What are the latest research advancements in this domain?";
    Toast.info("Loading domain research sandbox...");
    
    const consensusInput = document.getElementById('pg-consensus-query');
    if (consensusInput) {
      consensusInput.value = query;
      document.getElementById('playground')?.scrollIntoView({ behavior: 'smooth' });
      Playground.runConsensus();
    } else {
      App.showPage('pg-dash');
    }
  }

  static async loadReport(reportTitle, query) {
    Toast.info(`Generating live AI synthesis report for: "${reportTitle}"...`);
    
    const consensusInput = document.getElementById('pg-consensus-query');
    if (consensusInput) {
      consensusInput.value = query;
      document.getElementById('playground')?.scrollIntoView({ behavior: 'smooth' });
      Playground.runConsensus();
    } else {
      App.showPage('pg-dash');
    }
  }
}

class ResearchService {
  static async runLiteratureReview(query) {
    if (!query || !query.trim()) {
      Toast.error('Please enter a research question or topic.');
      return;
    }
    if (!Auth.isLoggedIn()) {
      Toast.info('Please sign in to run AI literature review synthesis.');
      App.showPage('pg-signin');
      return;
    }

    try {
      Toast.info('Searching 200M+ papers & synthesizing literature review...');
      const res = await ApiClient.post('/research/literature-review', { query: query.trim() });
      
      Toast.success(`Literature Review Complete! Analyzed ${res.totalPapersAnalyzed || 0} papers.`);
      
      // Update playground/dashboard output if visible
      const outputBox = document.getElementById('consensus-output-content');
      if (outputBox) {
        outputBox.innerHTML = `
          <div style="background:var(--primary-light);border:1px solid var(--border);border-radius:12px;padding:20px;margin-bottom:20px;">
            <h4 style="font-family:var(--font-heading);font-size:18px;color:var(--primary);margin:0 0 8px 0;">Executive Literature Synthesis</h4>
            <p style="font-size:14px;color:var(--black);line-height:1.6;margin:0;">${res.executiveSummary || 'Synthesis generated.'}</p>
          </div>
          ${res.keyTakeaways && res.keyTakeaways.length ? `
            <div style="margin-bottom:20px;">
              <h5 style="font-size:14px;font-weight:700;color:var(--black);margin-bottom:8px;">Key Research Takeaways:</h5>
              <ul style="padding-left:20px;font-size:13.5px;color:var(--gray);line-height:1.6;">
                ${res.keyTakeaways.map(t => `<li>${t}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
          ${res.evidenceMatrix && res.evidenceMatrix.length ? `
            <div style="overflow-x:auto;">
              <h5 style="font-size:14px;font-weight:700;color:var(--black);margin-bottom:8px;">Elicit Evidence Matrix (${res.evidenceMatrix.length} Papers):</h5>
              <table style="width:100%;border-collapse:collapse;font-size:12.5px;background:#fff;border:1px solid var(--border);border-radius:8px;overflow:hidden;">
                <thead>
                  <tr style="background:var(--primary-light);color:var(--primary);text-align:left;">
                    <th style="padding:10px;">Paper Title</th>
                    <th style="padding:10px;">Key Finding</th>
                    <th style="padding:10px;">Methodology</th>
                  </tr>
                </thead>
                <tbody>
                  ${res.evidenceMatrix.map(row => `
                    <tr style="border-bottom:1px solid var(--border);">
                      <td style="padding:10px;font-weight:600;"><a href="${row.url || '#'}" target="_blank" style="color:var(--primary);">${row.title}</a> (${row.year || ''})</td>
                      <td style="padding:10px;">${row.keyFinding || ''}</td>
                      <td style="padding:10px;">${row.methodology || ''}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : ''}
        `;
      }
      return res;
    } catch (err) {
      Toast.error(err.message || 'Literature review synthesis failed');
    }
  }

  static async extractData(papers, columns) {
    try {
      Toast.info('Extracting structured scientific data columns...');
      const res = await ApiClient.post('/research/extract-data', { papers, columns });
      Toast.success('Data extraction complete!');
      return res;
    } catch (err) {
      Toast.error(err.message);
    }
  }

  static async loadWorkflows() {
    try {
      const res = await ApiClient.get('/research/workflows');
      return res.workflows || [];
    } catch (err) {
      console.warn('Failed to load research workflows:', err.message);
      return [];
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  App.init();
  PWAInstaller.init();
});
