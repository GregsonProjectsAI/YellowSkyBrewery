const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR);
}

// Allow overriding the database path via environment variables (crucial for Render Disks)
const dbPath = process.env.DATABASE_PATH || path.join(DATA_DIR, 'database.sqlite');
const db = new Database(dbPath);

// Initialize schema
db.exec(`
    CREATE TABLE IF NOT EXISTS subscribers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        subscribedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS posts (
        id TEXT PRIMARY KEY,
        createdAt TEXT NOT NULL,
        data TEXT NOT NULL
    );
`);

// --- AUTOMATIC MIGRATION ---
// This ensures that when deployed to Render (which creates a fresh disk if no persistent disk is attached),
// the database is automatically seeded with whatever was in the original JSON files.
try {
    const SUBSCRIBERS_FILE = path.join(DATA_DIR, 'subscribers.json');
    if (fs.existsSync(SUBSCRIBERS_FILE)) {
        const subData = JSON.parse(fs.readFileSync(SUBSCRIBERS_FILE, 'utf8'));
        if (subData.subscribers && subData.subscribers.length > 0) {
            const insertSub = db.prepare('INSERT OR IGNORE INTO subscribers (id, name, email, subscribedAt) VALUES (@id, @name, @email, @subscribedAt)');
            const insertManySubs = db.transaction((subs) => {
                for (const sub of subs) {
                    insertSub.run({
                        id: sub.id,
                        name: sub.name,
                        email: sub.email,
                        subscribedAt: sub.subscribedAt || new Date().toISOString()
                    });
                }
            });
            insertManySubs(subData.subscribers);
        }
    }

    const POSTS_FILE = path.join(DATA_DIR, 'posts.json');
    if (fs.existsSync(POSTS_FILE)) {
        const postData = JSON.parse(fs.readFileSync(POSTS_FILE, 'utf8'));
        if (postData.posts && postData.posts.length > 0) {
            const insertPost = db.prepare('INSERT OR IGNORE INTO posts (id, createdAt, data) VALUES (@id, @createdAt, @data)');
            const insertManyPosts = db.transaction((posts) => {
                for (const post of posts) {
                    insertPost.run({
                        id: post.id,
                        createdAt: post.createdAt || new Date().toISOString(),
                        data: JSON.stringify(post)
                    });
                }
            });
            insertManyPosts(postData.posts);
        }
    }
} catch (err) {
    console.error("Auto-migration failed:", err);
}

module.exports = db;
