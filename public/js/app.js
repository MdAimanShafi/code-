// ── SESSION ──────────────────────────────────────────
const Auth = {
  get: () => JSON.parse(localStorage.getItem('sc_user') || 'null'),
  set: (u) => localStorage.setItem('sc_user', JSON.stringify(u)),
  clear: () => localStorage.removeItem('sc_user'),
  require: () => {
    const u = Auth.get();
    if (!u) { window.location.href = '/login'; return null; }
    return u;
  }
};

// ── API ───────────────────────────────────────────────
const API = {
  base: '',
  async req(method, url, body) {
    const res = await fetch(API.base + url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  },
  get:  (url)       => API.req('GET', url),
  post: (url, body) => API.req('POST', url, body),
  put:  (url, body) => API.req('PUT', url, body),
};

// ── TOAST ─────────────────────────────────────────────
function showToast(msg, type = '') {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast'; t.className = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.className = `toast ${type} show`;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 3000);
}

// ── HELPERS ───────────────────────────────────────────
function timeAgo(iso) {
  const diff = (Date.now() - new Date(iso)) / 1000;
  if (diff < 60)   return 'just now';
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400)return `${Math.floor(diff/3600)}h ago`;
  return `${Math.floor(diff/86400)}d ago`;
}

function initials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function avatarEl(name, avatarUrl, cls = '') {
  if (avatarUrl) return `<img src="${avatarUrl}" alt="${name}" onerror="this.style.display='none'">`;
  return `<span>${initials(name)}</span>`;
}

// ── NAVBAR ────────────────────────────────────────────
function renderNavbar(activePage) {
  const user = Auth.get();
  const nav = document.getElementById('navbar');
  if (!nav) return;

  const links = [
    { href: '/',          label: '🏠 <span>Home</span>',      page: 'home' },
    { href: '/discover',  label: '✨ <span>Discover</span>',  page: 'discover' },
    { href: '/profile',   label: '👤 <span>Profile</span>',   page: 'profile' },
    { href: '/dashboard', label: '📊 <span>Dashboard</span>', page: 'dashboard' },
  ];

  nav.innerHTML = `
    <a href="/" class="nav-logo">🔗 SocialConnect</a>
    <div class="nav-links">
      ${links.map(l => `<a href="${l.href}" class="${activePage===l.page?'active':''}">${l.label}</a>`).join('')}
      ${user
        ? `<div class="nav-avatar" onclick="window.location='/profile'" title="${user.name}">${user.avatar ? `<img src="${user.avatar}">` : initials(user.name)}</div>
           <button class="nav-btn btn" onclick="logout()">Logout</button>`
        : `<a href="/login" class="nav-btn btn">Login</a>`
      }
    </div>`;
}

function logout() {
  Auth.clear();
  showToast('Logged out!');
  setTimeout(() => window.location.href = '/login', 600);
}

// ── POST CARD ─────────────────────────────────────────
function buildPostCard(post, currentUser) {
  const liked = currentUser && post.likes.includes(currentUser.email);
  const likeCount = post.likes.length;
  const commentCount = (post.comments || []).length;

  const commentsHtml = (post.comments || []).map(c => `
    <div class="comment-item">
      <div class="comment-avatar">${avatarEl(c.userName, '')}</div>
      <div class="comment-body">
        <div class="comment-author">${c.userName || c.userEmail}</div>
        <div class="comment-text">${escHtml(c.text)}</div>
        <div class="comment-time">${timeAgo(c.createdAt)}</div>
      </div>
    </div>`).join('');

  const userInitials = currentUser ? initials(currentUser.name) : '?';

  return `
  <div class="card post-card" id="post-${post.id}">
    <div class="post-header">
      <div class="post-avatar">${avatarEl(post.userName, '')}</div>
      <div class="post-meta">
        <div class="post-author">${post.userName || post.userEmail}</div>
        <div class="post-time">${timeAgo(post.createdAt)}</div>
      </div>
    </div>
    <div class="post-content">${escHtml(post.content)}</div>
    ${post.imageUrl ? `<img class="post-image" src="${post.imageUrl}" alt="post image" onerror="this.style.display='none'">` : ''}
    <div class="post-stats">
      <span>${likeCount} like${likeCount !== 1 ? 's' : ''}</span>
      <span>${commentCount} comment${commentCount !== 1 ? 's' : ''}</span>
    </div>
    <div class="post-actions">
      <button class="post-action-btn ${liked ? 'liked' : ''}" onclick="toggleLike('${post.id}', this)">
        <svg viewBox="0 0 24 24" fill="${liked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
        </svg>
        Like
      </button>
      <button class="post-action-btn" onclick="toggleComments('${post.id}')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        Comment
      </button>
    </div>
    <div class="comments-section" id="comments-${post.id}">
      ${currentUser ? `
      <div class="comment-input-row">
        <div class="comment-avatar">${userInitials}</div>
        <input type="text" placeholder="Write a comment…" id="cinput-${post.id}" onkeydown="if(event.key==='Enter') submitComment('${post.id}')">
        <button class="comment-send-btn" onclick="submitComment('${post.id}')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>` : ''}
      <div id="clist-${post.id}">${commentsHtml}</div>
    </div>
  </div>`;
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── LIKE ──────────────────────────────────────────────
async function toggleLike(postId, btn) {
  const user = Auth.get();
  if (!user) return showToast('Please login to like posts', 'error');
  try {
    const data = await API.post('/like', { postId, userEmail: user.email });
    btn.classList.toggle('liked', data.liked);
    btn.querySelector('svg').setAttribute('fill', data.liked ? 'currentColor' : 'none');
    const card = document.getElementById(`post-${postId}`);
    const stats = card.querySelector('.post-stats span');
    stats.textContent = `${data.likes} like${data.likes !== 1 ? 's' : ''}`;
  } catch(e) { showToast(e.message, 'error'); }
}

// ── COMMENT ───────────────────────────────────────────
async function submitComment(postId) {
  const user = Auth.get();
  if (!user) return showToast('Please login to comment', 'error');
  const input = document.getElementById(`cinput-${postId}`);
  const text = input.value.trim();
  if (!text) return;
  try {
    const c = await API.post('/comment', { postId, userEmail: user.email, userName: user.name, text });
    input.value = '';
    const clist = document.getElementById(`clist-${postId}`);
    const div = document.createElement('div');
    div.className = 'comment-item';
    div.innerHTML = `
      <div class="comment-avatar">${initials(c.userName)}</div>
      <div class="comment-body">
        <div class="comment-author">${c.userName || c.userEmail}</div>
        <div class="comment-text">${escHtml(c.text)}</div>
        <div class="comment-time">just now</div>
      </div>`;
    clist.appendChild(div);
    // update comment count
    const card = document.getElementById(`post-${postId}`);
    const spans = card.querySelectorAll('.post-stats span');
    const cur = parseInt(spans[1].textContent) || 0;
    spans[1].textContent = `${cur+1} comment${cur+1 !== 1 ? 's' : ''}`;
  } catch(e) { showToast(e.message, 'error'); }
}

function toggleComments(postId) {
  document.getElementById(`comments-${postId}`).classList.toggle('open');
}

// ── SEARCH ────────────────────────────────────────────
async function searchUsers(query) {
  if (!query || query.length < 2) {
    document.querySelector('.search-results')?.classList.remove('open');
    return;
  }
  try {
    const results = await API.get(`/search/users?q=${encodeURIComponent(query)}`);
    const searchResults = document.querySelector('.search-results');
    if (!searchResults) return;
    if (results.length === 0) {
      searchResults.innerHTML = '<div style="padding: 12px 16px; text-align: center; color: var(--muted);">No users found</div>';
    } else {
      searchResults.innerHTML = results.map(u => `
        <div class="search-result-item" onclick="window.location='/profile?user=${encodeURIComponent(u.email)}'">
          <div class="search-result-avatar">${initials(u.name)}</div>
          <div class="search-result-info">
            <div class="search-result-name">${u.name}</div>
            <div class="search-result-email">${u.email}</div>
          </div>
        </div>
      `).join('');
    }
    searchResults.classList.add('open');
  } catch(e) { console.error(e); }
}

// ── FOLLOW ────────────────────────────────────────────
async function toggleFollow(targetEmail, btn) {
  const user = Auth.get();
  if (!user) return showToast('Please login to follow users', 'error');
  if (user.email === targetEmail) return showToast('Cannot follow yourself', 'error');
  try {
    const data = await API.post('/follow', { currentEmail: user.email, targetEmail });
    btn.classList.toggle('following', data.isFollowing);
    btn.textContent = data.isFollowing ? 'Following' : 'Follow';
    showToast(data.isFollowing ? 'Now following!' : 'Unfollowed', 'success');
  } catch(e) { showToast(e.message, 'error'); }
}

// ── DISCOVER ──────────────────────────────────────────
async function loadDiscoverUsers() {
  const user = Auth.require();
  if (!user) return;
  try {
    const users = await API.get(`/discover/users/${user.email}`);
    const container = document.getElementById('discover-users');
    if (!container) return;
    if (users.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-icon">👥</div><p>No users to discover right now</p></div>';
    } else {
      container.innerHTML = users.map(u => `
        <div class="card user-card">
          <div class="user-avatar-lg">${initials(u.name)}</div>
          <div class="user-name">${u.name}</div>
          <div class="user-bio">${u.bio || 'No bio yet'}</div>
          <div class="user-followers">${u.followers} follower${u.followers !== 1 ? 's' : ''}</div>
          <button class="follow-btn" onclick="toggleFollow('${u.email}', this)">Follow</button>
          <a href="/profile?user=${encodeURIComponent(u.email)}" class="view-profile-link">View Profile</a>
        </div>
      `).join('');
    }
  } catch(e) { showToast(e.message, 'error'); }
}
