const express = require('express');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

module.exports = function (db) {
  const router = express.Router();

  // Multer setup for file uploads
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(__dirname, '..', 'uploads', 'chapters');
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1e6) + path.extname(file.originalname);
      cb(null, uniqueName);
    }
  });

  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
      const ext = allowedTypes.test(path.extname(file.originalname).toLowerCase());
      const mime = allowedTypes.test(file.mimetype.split('/')[1]);
      if (ext && mime) return cb(null, true);
      cb(new Error('Only image files are allowed'));
    }
  });

  // Admin auth middleware
  function requireAdmin(req, res, next) {
    if (!req.session.user || req.session.user.role !== 'admin') {
      return res.redirect('/admin/login');
    }
    next();
  }

  // Admin login page
  router.get('/login', (req, res) => {
    if (req.session.user && req.session.user.role === 'admin') {
      return res.redirect('/admin/dashboard');
    }
    res.render('admin-login', { error: null });
  });

  // Admin login
  router.post('/login', (req, res) => {
    const { username, password } = req.body;
    const admin = db.findUser({ username, role: 'admin' });

    if (!admin || !bcrypt.compareSync(password, admin.password)) {
      return res.render('admin-login', { error: 'Invalid admin credentials' });
    }

    req.session.user = { id: admin.id, username: admin.username, role: admin.role };
    res.redirect('/admin/dashboard');
  });

  // Dashboard
  router.get('/dashboard', requireAdmin, (req, res) => {
    const chapters = db.getAllChapters();
    const userCount = db.getUserCount('user');
    const announcements = db.getAllAnnouncements();
    res.render('admin-dashboard', { chapters, userCount, announcements });
  });

  // Add chapter page
  router.get('/chapters/add', requireAdmin, (req, res) => {
    res.render('admin-add-chapter', { error: null });
  });

  // Add chapter
  router.post('/chapters/add', requireAdmin, upload.fields([
    { name: 'cover', maxCount: 1 },
    { name: 'pages', maxCount: 200 }
  ]), (req, res) => {
    const { chapter_number, title } = req.body;

    if (!chapter_number || !title) {
      return res.render('admin-add-chapter', { error: 'Chapter number and title are required' });
    }

    const num = parseInt(chapter_number, 10);
    const existing = db.findChapter({ chapter_number: num });
    if (existing) {
      return res.render('admin-add-chapter', { error: 'Chapter number already exists' });
    }

    const coverPath = req.files['cover'] ? '/uploads/chapters/' + req.files['cover'][0].filename : null;

    const result = db.addChapter(num, title, '', coverPath);

    // Add pages
    if (req.files['pages']) {
      req.files['pages'].forEach((file, index) => {
        db.addPage(result.id, index + 1, '/uploads/chapters/' + file.filename);
      });
    }

    res.redirect('/admin/dashboard');
  });

  // Delete chapter
  router.post('/chapters/delete/:id', requireAdmin, (req, res) => {
    const chapterId = parseInt(req.params.id, 10);
    if (isNaN(chapterId)) return res.redirect('/admin/dashboard');

    // Delete page images from disk
    const pages = db.getChapterPages(chapterId);
    const chapter = db.findChapter({ id: chapterId });

    pages.forEach(page => {
      const filePath = path.join(__dirname, '..', page.image_path);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    });

    if (chapter && chapter.cover_image) {
      const coverPath = path.join(__dirname, '..', chapter.cover_image);
      if (fs.existsSync(coverPath)) fs.unlinkSync(coverPath);
    }

    db.deleteChapter(chapterId);

    res.redirect('/admin/dashboard');
  });

  // Edit chapter page
  router.get('/chapters/edit/:id', requireAdmin, (req, res) => {
    const chapterId = parseInt(req.params.id, 10);
    if (isNaN(chapterId)) return res.redirect('/admin/dashboard');
    const chapter = db.findChapter({ id: chapterId });
    if (!chapter) return res.redirect('/admin/dashboard');
    const pages = db.getChapterPages(chapterId);
    res.render('admin-edit-chapter', { chapter, pages, error: null });
  });

  // Edit chapter submit
  router.post('/chapters/edit/:id', requireAdmin, upload.fields([
    { name: 'cover', maxCount: 1 },
    { name: 'pages', maxCount: 200 }
  ]), (req, res) => {
    const chapterId = parseInt(req.params.id, 10);
    if (isNaN(chapterId)) return res.redirect('/admin/dashboard');

    const chapter = db.findChapter({ id: chapterId });
    if (!chapter) return res.redirect('/admin/dashboard');

    const { title } = req.body;
    const updates = {};

    if (title) updates.title = title;

    // New cover uploaded
    if (req.files['cover'] && req.files['cover'][0]) {
      // Delete old cover
      if (chapter.cover_image) {
        const oldCover = path.join(__dirname, '..', chapter.cover_image);
        if (fs.existsSync(oldCover)) fs.unlinkSync(oldCover);
      }
      updates.cover_image = '/uploads/chapters/' + req.files['cover'][0].filename;
    }

    db.updateChapter(chapterId, updates);

    // Replace pages if new ones uploaded
    if (req.files['pages'] && req.files['pages'].length > 0) {
      const oldPages = db.clearChapterPages(chapterId);
      oldPages.forEach(p => {
        const filePath = path.join(__dirname, '..', p.image_path);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      });
      req.files['pages'].forEach((file, index) => {
        db.addPage(chapterId, index + 1, '/uploads/chapters/' + file.filename);
      });
    }

    res.redirect('/admin/dashboard');
  });

  // Delete a review (admin)
  router.post('/reviews/delete/:id', requireAdmin, (req, res) => {
    const reviewId = parseInt(req.params.id, 10);
    if (!isNaN(reviewId)) db.deleteReview(reviewId);
    const referer = req.get('Referer') || '/admin/dashboard';
    res.redirect(referer);
  });

  // Add announcement
  router.post('/announcements/add', requireAdmin, (req, res) => {
    const { title, content } = req.body;
    if (title && content) {
      db.addAnnouncement(title, content);
    }
    res.redirect('/admin/dashboard');
  });

  // Delete announcement
  router.post('/announcements/delete/:id', requireAdmin, (req, res) => {
    const annId = parseInt(req.params.id, 10);
    if (!isNaN(annId)) db.deleteAnnouncement(annId);
    res.redirect('/admin/dashboard');
  });

  return router;
};
