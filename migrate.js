const fs = require('fs');
const path = require('path');
const db = require('./db');

const DATA_DIR = path.join(__dirname, 'data');
const SUBSCRIBERS_FILE = path.join(DATA_DIR, 'subscribers.json');
const POSTS_FILE = path.join(DATA_DIR, 'posts.json');

console.log('Starting migration to SQLite...');

// Migrate Subscribers
if (fs.existsSync(SUBSCRIBERS_FILE)) {
    try {
        const subData = JSON.parse(fs.readFileSync(SUBSCRIBERS_FILE, 'utf8'));
        if (subData.subscribers && subData.subscribers.length > 0) {
            const insertSub = db.prepare('INSERT OR IGNORE INTO subscribers (id, name, email, subscribedAt) VALUES (@id, @name, @email, @subscribedAt)');
            
            let subCount = 0;
            const insertManySubs = db.transaction((subs) => {
                for (const sub of subs) {
                    const result = insertSub.run({
                        id: sub.id,
                        name: sub.name,
                        email: sub.email,
                        subscribedAt: sub.subscribedAt || new Date().toISOString()
                    });
                    if (result.changes > 0) subCount++;
                }
            });
            
            insertManySubs(subData.subscribers);
            console.log(`Migrated ${subCount} subscribers from subscribers.json`);
        } else {
            console.log('No subscribers found in subscribers.json');
        }
    } catch (err) {
        console.error('Error migrating subscribers:', err);
    }
} else {
    console.log('subscribers.json does not exist. Skipping.');
}

// Migrate Posts
if (fs.existsSync(POSTS_FILE)) {
    try {
        const postData = JSON.parse(fs.readFileSync(POSTS_FILE, 'utf8'));
        if (postData.posts && postData.posts.length > 0) {
            const insertPost = db.prepare('INSERT OR IGNORE INTO posts (id, createdAt, data) VALUES (@id, @createdAt, @data)');
            
            let postCount = 0;
            const insertManyPosts = db.transaction((posts) => {
                for (const post of posts) {
                    const result = insertPost.run({
                        id: post.id,
                        createdAt: post.createdAt || new Date().toISOString(),
                        data: JSON.stringify(post)
                    });
                    if (result.changes > 0) postCount++;
                }
            });
            
            insertManyPosts(postData.posts);
            console.log(`Migrated ${postCount} posts from posts.json`);
        } else {
            console.log('No posts found in posts.json');
        }
    } catch (err) {
        console.error('Error migrating posts:', err);
    }
} else {
    console.log('posts.json does not exist. Skipping.');
}

console.log('Migration complete!');
