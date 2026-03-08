const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data.json');

function loadData() {
  if (fs.existsSync(DB_PATH)) {
    const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    // Ensure new collections exist for upgrades
    if (!data.reviews) data.reviews = [];
    if (!data.announcements) data.announcements = [];
    if (!data.nextId.reviews) data.nextId.reviews = 1;
    if (!data.nextId.announcements) data.nextId.announcements = 1;
    return data;
  }
  return { users: [], chapters: [], chapter_pages: [], reviews: [], announcements: [], nextId: { users: 1, chapters: 1, pages: 1, reviews: 1, announcements: 1 } };
}

function saveData(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

function initDB() {
  let data = loadData();

  // Create default admin if not exists
  const admin = data.users.find(u => u.role === 'admin');
  if (!admin) {
    const hash = bcrypt.hashSync('Soban@123', 10);
    data.users.push({
      id: data.nextId.users++,
      username: 'admin',
      email: 'admin@series.com',
      password: hash,
      role: 'admin',
      created_at: new Date().toISOString()
    });
    saveData(data);
    console.log('Default admin account created (username: admin)');
  }

  // Return a db-like interface
  return {
    getUsers: () => loadData().users,
    getChapters: () => loadData().chapters,
    getPages: () => loadData().chapter_pages,

    findUser(query) {
      const d = loadData();
      return d.users.find(u => {
        return Object.entries(query).every(([k, v]) => u[k] === v);
      }) || null;
    },

    findUserByUsernameOrEmail(username, email) {
      return loadData().users.find(u => u.username === username || u.email === email) || null;
    },

    addUser(username, email, passwordHash, role = 'user') {
      const d = loadData();
      const user = {
        id: d.nextId.users++,
        username, email, password: passwordHash, role,
        created_at: new Date().toISOString()
      };
      d.users.push(user);
      saveData(d);
      return user;
    },

    getUserCount(role) {
      return loadData().users.filter(u => u.role === role).length;
    },

    findChapter(query) {
      return loadData().chapters.find(ch => {
        return Object.entries(query).every(([k, v]) => ch[k] === v);
      }) || null;
    },

    getAllChapters() {
      return loadData().chapters.sort((a, b) => a.chapter_number - b.chapter_number);
    },

    addChapter(chapter_number, title, content, cover_image) {
      const d = loadData();
      const ch = {
        id: d.nextId.chapters++,
        chapter_number, title, content: content || '', cover_image,
        created_at: new Date().toISOString()
      };
      d.chapters.push(ch);
      saveData(d);
      return ch;
    },

    deleteChapter(id) {
      const d = loadData();
      d.chapters = d.chapters.filter(ch => ch.id !== id);
      d.chapter_pages = d.chapter_pages.filter(p => p.chapter_id !== id);
      saveData(d);
    },

    getChapterPages(chapterId) {
      return loadData().chapter_pages
        .filter(p => p.chapter_id === chapterId)
        .sort((a, b) => a.page_number - b.page_number);
    },

    addPage(chapter_id, page_number, image_path) {
      const d = loadData();
      const page = { id: d.nextId.pages++, chapter_id, page_number, image_path };
      d.chapter_pages.push(page);
      saveData(d);
      return page;
    },

    getPrevChapter(chapterNumber) {
      return loadData().chapters
        .filter(c => c.chapter_number < chapterNumber)
        .sort((a, b) => b.chapter_number - a.chapter_number)[0] || null;
    },

    getNextChapter(chapterNumber) {
      return loadData().chapters
        .filter(c => c.chapter_number > chapterNumber)
        .sort((a, b) => a.chapter_number - b.chapter_number)[0] || null;
    },

    // Edit chapter
    updateChapter(id, updates) {
      const d = loadData();
      const idx = d.chapters.findIndex(ch => ch.id === id);
      if (idx === -1) return null;
      Object.assign(d.chapters[idx], updates);
      saveData(d);
      return d.chapters[idx];
    },

    // Clear pages for a chapter (used when re-uploading)
    clearChapterPages(chapterId) {
      const d = loadData();
      const removed = d.chapter_pages.filter(p => p.chapter_id === chapterId);
      d.chapter_pages = d.chapter_pages.filter(p => p.chapter_id !== chapterId);
      saveData(d);
      return removed;
    },

    // Reviews
    addReview(chapterId, userId, username, rating, text) {
      const d = loadData();
      // One review per user per chapter
      d.reviews = d.reviews.filter(r => !(r.chapter_id === chapterId && r.user_id === userId));
      const review = {
        id: d.nextId.reviews++,
        chapter_id: chapterId,
        user_id: userId,
        username,
        rating: Math.min(5, Math.max(1, parseInt(rating, 10))),
        text: text || '',
        created_at: new Date().toISOString()
      };
      d.reviews.push(review);
      saveData(d);
      return review;
    },

    getChapterReviews(chapterId) {
      return loadData().reviews
        .filter(r => r.chapter_id === chapterId)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    },

    getAverageRating(chapterId) {
      const reviews = loadData().reviews.filter(r => r.chapter_id === chapterId);
      if (reviews.length === 0) return { avg: 0, count: 0 };
      const sum = reviews.reduce((s, r) => s + r.rating, 0);
      return { avg: Math.round((sum / reviews.length) * 10) / 10, count: reviews.length };
    },

    deleteReview(reviewId) {
      const d = loadData();
      d.reviews = d.reviews.filter(r => r.id !== reviewId);
      saveData(d);
    },

    // Announcements
    addAnnouncement(title, content) {
      const d = loadData();
      const ann = {
        id: d.nextId.announcements++,
        title,
        content,
        created_at: new Date().toISOString()
      };
      d.announcements.push(ann);
      saveData(d);
      return ann;
    },

    getAllAnnouncements() {
      return loadData().announcements.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    },

    deleteAnnouncement(id) {
      const d = loadData();
      d.announcements = d.announcements.filter(a => a.id !== id);
      saveData(d);
    }
  };
}

module.exports = { initDB };
