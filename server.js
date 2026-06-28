require('dotenv').config();
const express = require('express');
const fs      = require('fs');
const path    = require('path');
const { v4: uuidv4 } = require('uuid');
const { Resend } = require('resend');
const rateLimit = require('express-rate-limit');

// Aggressively hunt for the Resend API key to catch Render dashboard typos
let rawResendKey = process.env.RESEND_API_KEY;
if (!rawResendKey) {
  const typoKey = Object.keys(process.env).find(k => k.toUpperCase().includes('RESEND'));
  if (typoKey) rawResendKey = process.env[typoKey];
  if (!rawResendKey) {
    const valKey = Object.keys(process.env).find(k => typeof process.env[k] === 'string' && process.env[k].trim().startsWith('re_'));
    if (valKey) rawResendKey = process.env[valKey];
  }
}
if (rawResendKey) rawResendKey = rawResendKey.trim();

const resend = rawResendKey ? new Resend(rawResendKey) : null;
const app  = express();
const PORT = process.env.PORT || 3000;

// Require ADMIN_PASSWORD — refuse to start if missing
if (!process.env.ADMIN_PASSWORD) {
  throw new Error('ADMIN_PASSWORD environment variable is required but not set. Add it to your .env file.');
}
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

const DATA_DIR         = path.join(__dirname, 'data');
const DATA_FILE        = path.join(DATA_DIR, 'posts.json');
const SUBSCRIBERS_FILE = path.join(DATA_DIR, 'subscribers.json');

// Ensure data directory and files exist on first run
if (!fs.existsSync(DATA_DIR))         fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE))        fs.writeFileSync(DATA_FILE, JSON.stringify({ posts: [] }, null, 2));
if (!fs.existsSync(SUBSCRIBERS_FILE)) fs.writeFileSync(SUBSCRIBERS_FILE, JSON.stringify({ subscribers: [] }, null, 2));

// In-memory session tokens (cleared on server restart — fine for this use case)
const sessions = new Map();

// ── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json());

// ── Security headers ──────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com; " +
    "img-src 'self' data: blob: https:; " +
    "media-src 'self' blob:; " +
    "connect-src 'self'; " +
    "worker-src 'self' blob:; " +
    "frame-ancestors 'self';"
  );
  next();
});

// ── CORS — API endpoints only ─────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  'https://yellowskybrewery.com',
  'https://www.yellowskybrewery.com',
  `http://localhost:${PORT}`
];
app.use('/api', (req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ── Rate limiters ─────────────────────────────────────────────────────────────
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const subscribeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { error: 'Too many subscription attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Serve admin panel at /admin before the static middleware so it always hits
app.get('/admin', (_req, res) => res.sendFile(path.join(__dirname, 'admin', 'index.html')));

// Block direct access to data files
app.use('/data', (_req, res) => res.status(404).end());

// Disable caching for JS and CSS so edits are always picked up on refresh
app.use((req, res, next) => {
  if (req.path.endsWith('.js') || req.path.endsWith('.css')) {
    res.setHeader('Cache-Control', 'no-store');
  }
  next();
});

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

// Escape HTML entities to prevent injection in email content
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Auth routes ──────────────────────────────────────────────────────────────
app.post('/api/login', loginLimiter, (req, res) => {
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

// POST /api/posts — create new post (whitelisted fields only)
app.post('/api/posts', requireAuth, (req, res) => {
  const data = readPosts();
  const { title, content, excerpt, category, author, tags, image, published } = req.body || {};
  const post = {
    id:        uuidv4(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    title, content, excerpt, category, author, tags, image, published
  };
  data.posts.push(post);
  writePosts(data);
  res.status(201).json(post);
});

// PUT /api/posts/:id — edit existing post (whitelisted fields only)
app.put('/api/posts/:id', requireAuth, (req, res) => {
  const data = readPosts();
  const idx  = data.posts.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Post not found.' });
  const { title, content, excerpt, category, author, tags, image, published } = req.body || {};
  data.posts[idx] = {
    ...data.posts[idx],
    title, content, excerpt, category, author, tags, image, published,
    id:        req.params.id,
    createdAt: data.posts[idx].createdAt,
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

function getThemedEmailHtml(content) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          background-color: #0d0d0d;
          color: #ffffff;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background-color: #161616;
          border: 1px solid #333333;
          border-radius: 8px;
          overflow: hidden;
          margin-top: 40px;
          margin-bottom: 40px;
        }
        .header {
          background-color: #000000;
          padding: 30px;
          text-align: center;
          border-bottom: 1px solid #d4af37;
        }
        .header img {
          max-width: 150px;
        }
        .content {
          padding: 40px 30px;
          line-height: 1.6;
          color: #e0e0e0;
        }
        h2 {
          color: #d4af37;
          margin-top: 0;
          font-weight: normal;
          letter-spacing: 1px;
        }
        .footer {
          background-color: #0a0a0a;
          padding: 20px;
          text-align: center;
          font-size: 12px;
          color: #777777;
          border-top: 1px solid #222222;
        }
        a {
          color: #d4af37;
          text-decoration: none;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <img src="https://yellowskybrewery.com/assets/beer%20branding%20and%20names/transparent_logo.png" alt="Yellow Sky Brewery">
        </div>
        <div class="content">
          ${content}
        </div>
        <div class="footer">
          Yellow Sky Brewery<br>
          Hidden in Cranleigh, Surrey<br>
          <br>
          You are receiving this because you're on the Nitwits mailing list.
        </div>
      </div>
    </body>
    </html>
  `;
}

// POST /api/subscribe — public endpoint for mailing list signup
app.post('/api/subscribe', subscribeLimiter, (req, res) => {
  const { name, email } = req.body || {};

  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required.' });
  }

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

    if (resend) {
      resend.emails.send({
        from: 'Yellow Sky Brewery <nitwits@yellowskybrewery.com>',
        to: newSubscriber.email,
        subject: 'Thanks for joining the Nitwits',
        html: getThemedEmailHtml(`
          <h2>Cheers, ${escapeHtml(newSubscriber.name)}!</h2>
          <p>You're officially on the list.</p>
          <p>We brew every Sunday from 1pm at the secret YSB HQ (Colin's garden in Cranleigh).</p>
          <p>If you're ever in the mood for a pint, some darts, and a lot of nonsense, you know where to find us.</p>
          <br>
          <p>— The Nitwits</p>
        `)
      }).catch(err => console.error('Resend error:', err));
    }

    res.status(201).json({ success: true, message: "You're on the list. Check your inbox soon." });
  } catch (err) {
    console.error('Error saving subscriber:', err);
    res.status(500).json({ error: 'Internal server error. Please try again later.' });
  }
});

// POST /api/mailshot — authenticated, blast to all subscribers
app.post('/api/mailshot', requireAuth, async (req, res) => {
  const { subject, message } = req.body || {};

  if (!subject || !message) {
    return res.status(400).json({ error: 'Subject and message are required.' });
  }

  if (!resend) {
    return res.status(500).json({ error: 'Resend API key is not configured or invalid.' });
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

  const emails = data.subscribers.map(sub => ({
    from: 'Yellow Sky Brewery <nitwits@yellowskybrewery.com>',
    to: sub.email,
    subject: subject,
    html: getThemedEmailHtml(`
      <h2>Hi ${escapeHtml(sub.name || 'there')},</h2>
      <p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>
      <br>
      <p>— The Nitwits</p>
    `)
  }));

  try {
    const results = await Promise.all(emails.map(email => resend.emails.send(email)));
    const failed = results.find(res => res.error);
    if (failed) {
      console.error('Resend API rejected the email:', failed.error);
      return res.status(500).json({ error: `Resend Error: ${failed.error.message}` });
    }
    res.json({ success: true, count: emails.length });
  } catch (err) {
    console.error('Mailshot error:', err);
    res.status(500).json({ error: 'Failed to send mailshot.' });
  }
});

// GET /api/subscribers — authenticated, returns subscriber list for admin UI
app.get('/api/subscribers', requireAuth, (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(SUBSCRIBERS_FILE, 'utf8'));
    res.json({ subscribers: data.subscribers });
  } catch (err) {
    res.status(500).json({ error: 'Failed to read subscribers list.' });
  }
});

// POST /api/mailshot/single — authenticated, sends to one subscriber by id
app.post('/api/mailshot/single', requireAuth, async (req, res) => {
  const { subscriberId, subject, message } = req.body || {};

  if (!subscriberId || !subject || !message) {
    return res.status(400).json({ error: 'subscriberId, subject and message are required.' });
  }

  if (!resend) {
    return res.status(500).json({ error: 'Resend API key is not configured or invalid.' });
  }

  let data = { subscribers: [] };
  try {
    data = JSON.parse(fs.readFileSync(SUBSCRIBERS_FILE, 'utf8'));
  } catch (err) {
    return res.status(500).json({ error: 'Failed to read subscribers list.' });
  }

  const sub = data.subscribers.find(s => s.id === subscriberId);
  if (!sub) {
    return res.status(404).json({ error: 'Subscriber not found.' });
  }

  try {
    const result = await resend.emails.send({
      from: 'Yellow Sky Brewery <nitwits@yellowskybrewery.com>',
      to: sub.email,
      subject: subject,
      html: getThemedEmailHtml(`
        <h2>Hi ${escapeHtml(sub.name || 'there')},</h2>
        <p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>
        <br>
        <p>— The Nitwits</p>
      `)
    });

    if (result.error) {
      return res.status(500).json({ error: `Resend Error: ${result.error.message}` });
    }

    res.json({ success: true, to: sub.email });
  } catch (err) {
    console.error('Single mailshot error:', err);
    res.status(500).json({ error: 'Failed to send email.' });
  }
});

// ── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🍺  Yellow Sky Brewery server running`);
  console.log(`    Site:  http://localhost:${PORT}`);
  console.log(`    Admin: http://localhost:${PORT}/admin\n`);
});
