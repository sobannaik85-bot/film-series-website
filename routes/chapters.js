const express = require('express');

module.exports = function (db) {
  const router = express.Router();

  // Require login middleware
  function requireLogin(req, res, next) {
    if (!req.session.user) {
      return res.redirect('/login');
    }
    next();
  }

  // Chapter list
  router.get('/', (req, res) => {
    const chapters = db.getAllChapters();
    res.render('chapters', { chapters });
  });

  // Read chapter (must be logged in)
  router.get('/:id', requireLogin, (req, res) => {
    const chapterId = parseInt(req.params.id, 10);
    if (isNaN(chapterId)) return res.redirect('/chapters');

    const chapter = db.findChapter({ id: chapterId });
    if (!chapter) return res.redirect('/chapters');

    const pages = db.getChapterPages(chapterId);
    const prevChapter = db.getPrevChapter(chapter.chapter_number);
    const nextChapter = db.getNextChapter(chapter.chapter_number);
    const reviews = db.getChapterReviews(chapterId);
    const rating = db.getAverageRating(chapterId);

    res.render('reader', { chapter, pages, prevChapter, nextChapter, reviews, rating });
  });

  // Submit review
  router.post('/:id/review', requireLogin, (req, res) => {
    const chapterId = parseInt(req.params.id, 10);
    if (isNaN(chapterId)) return res.redirect('/chapters');

    const { stars, text } = req.body;
    if (!stars) return res.redirect('/chapters/' + chapterId);

    db.addReview(chapterId, req.session.user.id, req.session.user.username, stars, text);
    res.redirect('/chapters/' + chapterId + '#reviews');
  });

  return router;
};
