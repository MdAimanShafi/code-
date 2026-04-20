const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const DATA = {
  users: path.join(__dirname, 'data', 'users.json'),
  posts: path.join(__dirname, 'data', 'posts.json'),
  comments: path.join(__dirname, 'data', 'comments.json'),
};

const read = (file) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return [];
  }
};
const write = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));

// ── VALIDATION ────────────────────────────────────────
const validate = {
  email: (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e),
  password: (p) => p.length >= 6,
  name: (n) => n && n.trim().length >= 2,
};

// ── AUTH ──────────────────────────────────────────────
app.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    if (!name || !email || !password)
      return res.status(400).json({ error: 'All fields required' });
    
    if (!validate.email(email))
      return res.status(400).json({ error: 'Invalid email format' });
    if (!validate.password(password))
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    if (!validate.name(name))
      return res.status(400).json({ error: 'Name must be at least 2 characters' });

    const users = read(DATA.users);
    if (users.find(u => u.email === email))
      return res.status(409).json({ error: 'Email already registered' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = { 
      id: uuidv4(), 
      name: name.trim(), 
      email: email.toLowerCase(), 
      password: hashedPassword, 
      avatar: '', 
      bio: '', 
      followers: [],
      following: [],
      createdAt: new Date().toISOString() 
    };
    users.push(user);
    write(DATA.users, users);
    const { password: _, ...safe } = user;
    res.status(201).json({ message: 'Registered successfully', user: safe });
  } catch (err) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email and password required' });

    const users = read(DATA.users);
    const user = users.find(u => u.email === email.toLowerCase());
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(401).json({ error: 'Invalid credentials' });

    const { password: _, ...safe } = user;
    res.json({ message: 'Login successful', user: safe });
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// ── POSTS ─────────────────────────────────────────────
app.get('/posts', (req, res) => {
  try {
    const posts = read(DATA.posts);
    const comments = read(DATA.comments);
    const result = posts
      .map(p => ({ ...p, comments: comments.filter(c => c.postId === p.id).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)) }))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

app.get('/posts/user/:email', (req, res) => {
  try {
    const posts = read(DATA.posts);
    const comments = read(DATA.comments);
    const result = posts
      .filter(p => p.userEmail === req.params.email)
      .map(p => ({ ...p, comments: comments.filter(c => c.postId === p.id).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)) }))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

app.post('/posts', (req, res) => {
  try {
    const { userEmail, userName, content, imageUrl } = req.body;
    if (!userEmail || !content || !content.trim())
      return res.status(400).json({ error: 'Email and content required' });

    const posts = read(DATA.posts);
    const post = { 
      id: uuidv4(), 
      userEmail, 
      userName: userName || 'User',
      content: content.trim(), 
      imageUrl: imageUrl || '', 
      likes: [], 
      createdAt: new Date().toISOString() 
    };
    posts.push(post);
    write(DATA.posts, posts);
    res.status(201).json({ ...post, comments: [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create post' });
  }
});

// ── LIKES ─────────────────────────────────────────────
app.post('/like', (req, res) => {
  try {
    const { postId, userEmail } = req.body;
    if (!postId || !userEmail)
      return res.status(400).json({ error: 'Post ID and email required' });

    const posts = read(DATA.posts);
    const post = posts.find(p => p.id === postId);
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const idx = post.likes.indexOf(userEmail);
    if (idx === -1) post.likes.push(userEmail);
    else post.likes.splice(idx, 1);

    write(DATA.posts, posts);
    res.json({ likes: post.likes.length, liked: idx === -1 });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update like' });
  }
});

// ── COMMENTS ──────────────────────────────────────────
app.post('/comment', (req, res) => {
  try {
    const { postId, userEmail, userName, text } = req.body;
    if (!postId || !userEmail || !text || !text.trim())
      return res.status(400).json({ error: 'Post ID, email and text required' });

    const comments = read(DATA.comments);
    const comment = { 
      id: uuidv4(), 
      postId, 
      userEmail, 
      userName: userName || 'User',
      text: text.trim(), 
      createdAt: new Date().toISOString() 
    };
    comments.push(comment);
    write(DATA.comments, comments);
    res.status(201).json(comment);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create comment' });
  }
});

// ── USER PROFILE ──────────────────────────────────────
app.get('/user/:email', (req, res) => {
  try {
    const users = read(DATA.users);
    const user = users.find(u => u.email === req.params.email);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { password: _, ...safe } = user;
    res.json(safe);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

app.put('/user/:email', (req, res) => {
  try {
    const users = read(DATA.users);
    const idx = users.findIndex(u => u.email === req.params.email);
    if (idx === -1) return res.status(404).json({ error: 'User not found' });
    
    const { name, bio, avatar } = req.body;
    if (name && validate.name(name)) users[idx].name = name.trim();
    if (bio !== undefined) users[idx].bio = bio ? bio.trim() : '';
    if (avatar !== undefined) users[idx].avatar = avatar || '';
    
    write(DATA.users, users);
    const { password: _, ...safe } = users[idx];
    res.json(safe);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// ── FOLLOW SYSTEM ─────────────────────────────────────
app.post('/follow', (req, res) => {
  try {
    const { currentEmail, targetEmail } = req.body;
    if (!currentEmail || !targetEmail)
      return res.status(400).json({ error: 'Both emails required' });
    if (currentEmail === targetEmail)
      return res.status(400).json({ error: 'Cannot follow yourself' });

    const users = read(DATA.users);
    const currentIdx = users.findIndex(u => u.email === currentEmail);
    const targetIdx = users.findIndex(u => u.email === targetEmail);

    if (currentIdx === -1 || targetIdx === -1)
      return res.status(404).json({ error: 'User not found' });

    const currentUser = users[currentIdx];
    const targetUser = users[targetIdx];

    if (!currentUser.following) currentUser.following = [];
    if (!targetUser.followers) targetUser.followers = [];

    const idx = currentUser.following.indexOf(targetEmail);
    if (idx === -1) {
      currentUser.following.push(targetEmail);
      targetUser.followers.push(currentEmail);
    } else {
      currentUser.following.splice(idx, 1);
      targetUser.followers = targetUser.followers.filter(e => e !== currentEmail);
    }

    write(DATA.users, users);
    res.json({ following: currentUser.following.length, isFollowing: idx === -1 });
  } catch (err) {
    res.status(500).json({ error: 'Failed to follow/unfollow' });
  }
});

// ── SEARCH USERS ──────────────────────────────────────
app.get('/search/users', (req, res) => {
  try {
    const query = (req.query.q || '').toLowerCase().trim();
    if (!query || query.length < 2)
      return res.json([]);

    const users = read(DATA.users);
    const results = users
      .filter(u => u.name.toLowerCase().includes(query) || u.email.toLowerCase().includes(query))
      .slice(0, 10)
      .map(u => ({ id: u.id, name: u.name, email: u.email, avatar: u.avatar, bio: u.bio }));

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: 'Search failed' });
  }
});

// ── DISCOVER USERS ────────────────────────────────────
app.get('/discover/users/:currentEmail', (req, res) => {
  try {
    const currentEmail = req.params.currentEmail;
    const users = read(DATA.users);
    const currentUser = users.find(u => u.email === currentEmail);
    if (!currentUser) return res.status(404).json({ error: 'User not found' });

    const following = currentUser.following || [];
    const discovered = users
      .filter(u => u.email !== currentEmail && !following.includes(u.email))
      .slice(0, 8)
      .map(u => ({ id: u.id, name: u.name, email: u.email, avatar: u.avatar, bio: u.bio, followers: (u.followers || []).length }));

    res.json(discovered);
  } catch (err) {
    res.status(500).json({ error: 'Discovery failed' });
  }
});

// ── SERVE PAGES ───────────────────────────────────────
const pages = ['login', 'index', 'profile', 'dashboard', 'discover'];
pages.forEach(p => {
  app.get(`/${p === 'index' ? '' : p}`, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', `${p}.html`));
  });
});

app.listen(3000, () => console.log('🚀 SocialConnect v2.0 running at http://localhost:3000'));
