require('dotenv').config();
const express = require('express');
const fs      = require('fs');
const path    = require('path');
const { v4: uuidv4 } = require('uuid');
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
const app  = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'yellowsky2025';
const DATA_DIR  = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'posts.json');
const SUBSCRIBERS_FILE = path.join(DATA_DIR, 'subscribers.json');

// Ensure data directory and file exist on first run
if (!fs.existsSync(DATA_DIR))  fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify({ posts: [] }, null, 2));
if (!fs.existsSync(SUBSCRIBERS_FILE)) fs.writeFileSync(SUBSCRIBERS_FILE, JSON.stringify({ subscribers: [] }, null, 2));

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

// ── Subscribers API ──────────────────────────────────────────────────────────

// POST /api/subscribe — public endpoint for mailing list signup
app.post('/api/subscribe', (req, res) => {
  const { name, email } = req.body || {};
  
  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required.' });
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  let data = { subscribers: [] };
  try {
    data = JSON.parse(fs.readFileSync(SUBSCRIBERS_FILE, 'utf8'));
  } catch (err) {
    console.error('Error reading subscribers file:', err);
  }

  // Check if email already exists
  if (data.subscribers.some(sub => sub.email.toLowerCase() === email.toLowerCase())) {
    return res.status(400).json({ error: 'This email is already on the invite list.' });
  }

  const newSubscriber = {
    id: uuidv4(),
    name: name.trim(),
    email: email.trim().toLowerCase(),
    subscribedAt: new Date().toISOString()
  };

  data.subscribers.push(newSubscriber);
  
  try {
    fs.writeFileSync(SUBSCRIBERS_FILE, JSON.stringify(data, null, 2), 'utf8');
    
    // Send automated welcome email via Resend
    if (process.env.RESEND_API_KEY) {
      resend.emails.send({
        from: 'Yellow Sky Brewery <nitwits@yellowskybrewery.com>',
        to: newSubscriber.email,
        subject: 'Welcome to the Nitwits',
        html: `
          <h2>Cheers, ${newSubscriber.name}!</h2>
          <p>You're officially on the list.</p>
          <p>We brew every Sunday from 1pm at the secret YSB HQ (Colin's garden in Cranleigh).</p>
          <p>If you're ever in the mood for a pint, some darts, and a lot of nonsense, you know where to find us.</p>
          <br>
          <p>— The Nitwits</p>
        `
      }).catch(err => console.error('Resend error:', err));
    }
    
    res.status(201).json({ success: true, message: "You're on the list. Check your inbox soon." });
  } catch (err) {
    console.error('Error saving subscriber:', err);
    res.status(500).json({ error: 'Internal server error. Please try again later.' });
  }
});

// POST /api/mailshot — authenticated endpoint to blast email to all subscribers
app.post('/api/mailshot', requireAuth, async (req, res) => {
  const { subject, message } = req.body || {};
  
  if (!subject || !message) {
    return res.status(400).json({ error: 'Subject and message are required.' });
  }

  if (!process.env.RESEND_API_KEY) {
    return res.status(500).json({ error: 'Resend API key is not configured.' });
  }

  let data = { subscribers: [] };
  try {
    data = JSON.parse(fs.readFileSync(SUBSCRIBERS_FILE, 'utf8'));
  } catch (err) {
    return res.status(500).json({ error: 'Failed to read subscribers list.' });
  }

  if (data.subscribers.length === 0) {
    return res.status(400).json({ error: 'No subscribers to email.' });
  }

  // Resend batch sending allows up to 100 emails at once
  // For small lists, this is perfectly fine.
  const emails = data.subscribers.map(sub => ({
    from: 'Yellow Sky Brewery <nitwits@yellowskybrewery.com>',
    to: sub.email,
    subject: subject,
    html: `<p>Hi ${sub.name},</p><p>${message.replace(/\n/g, '<br>')}</p><br><p>— The Nitwits</p>`
  }));

  try {
    const response = await resend.batch.send(emails);
    res.json({ success: true, count: emails.length, response });
  } catch (err) {
    console.error('Batch email error:', err);
    res.status(500).json({ error: 'Failed to send mailshot.' });
  }
});

// ── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🍺  Yellow Sky Brewery server running`);
  console.log(`    Site:  http://localhost:${PORT}`);
  console.log(`    Admin: http://localhost:${PORT}/admin\n`);
});
