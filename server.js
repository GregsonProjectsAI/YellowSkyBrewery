require('dotenv').config();
const express = require('express');
const fs      = require('fs');
const path    = require('path');
const { v4: uuidv4 } = require('uuid');

const app  = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'yellowsky2025';
const DATA_DIR  = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'posts.json');

// Ensure data directory and file exist on first run
if (!fs.existsSync(DATA_DIR))  fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify({ posts: [] }, null, 2));

// In-memory session tokens (cleared on server restart — fine for this use case)
const sessions = new Map();

// ── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json());

// Serve admin panel at /admin before the static middleware so it always hits
app.get('/admin', (_req, res) => res.sendFile(path.join(__dirname, 'admin', 'index.html')));

// Serve all other static files (HTML, CSS, JS, assets)
app.use(express.static(__dirname));

// ── Auth middleware ──────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  const auth  = req.headers['authorization'] || '';
  const token = auth.replace('Bearer ', '').trim();
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ error: 'Unauthorised — please log in again.' });
  }
  next();
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function readPosts() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function writePosts(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// ── Auth routes ──────────────────────────────────────────────────────────────
app.post('/api/login', (req, res) => {
  const { password } = req.body || {};
  if (!password || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Incorrect password.' });
  }
  const token = uuidv4();
  sessions.set(token, Date.now());
  res.json({ token });
});

app.post('/api/logout', (req, res) => {
  const auth  = req.headers['authorization'] || '';
  const token = auth.replace('Bearer ', '').trim();
  sessions.delete(token);
  res.json({ success: true });
});

// ── Posts API ────────────────────────────────────────────────────────────────

// GET /api/posts — public, no auth required
app.get('/api/posts', (_req, res) => {
  const data = readPosts();
  data.posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(data);
});

// POST /api/posts — create new post
app.post('/api/posts', requireAuth, (req, res) => {
  const data = readPosts();
  const post = {
    id:        uuidv4(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...req.body
  };
  data.posts.push(post);
  writePosts(data);
  res.status(201).json(post);
});

// PUT /api/posts/:id — edit existing post
app.put('/api/posts/:id', requireAuth, (req, res) => {
  const data = readPosts();
  const idx  = data.posts.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Post not found.' });
  data.posts[idx] = {
    ...data.posts[idx],
    ...req.body,
    id:        req.params.id,           // never allow ID to change
    createdAt: data.posts[idx].createdAt, // preserve original date
    updatedAt: new Date().toISOString()
  };
  writePosts(data);
  res.json(data.posts[idx]);
});

// DELETE /api/posts/:id
app.delete('/api/posts/:id', requireAuth, (req, res) => {
  const data = readPosts();
  const idx  = data.posts.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Post not found.' });
  data.posts.splice(idx, 1);
  writePosts(data);
  res.json({ success: true });
});

// ── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🍺  Yellow Sky Brewery server running`);
  console.log(`    Site:  http://localhost:${PORT}`);
  console.log(`    Admin: http://localhost:${PORT}/admin\n`);
});
