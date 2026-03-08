const express = require('express');
const session = require('express-session');
const path = require('path');
const crypto = require('crypto');
const { initDB } = require('./db');
const authRoutes = require('./routes/auth');
const chapterRoutes = require('./routes/chapters');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database
const db = initDB();

// Middleware
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  secret: crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Make user available to all templates
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

// Routes
app.use('/', authRoutes(db));
app.use('/chapters', chapterRoutes(db));
app.use('/admin', adminRoutes(db));

// Home page
app.get('/', (req, res) => {
  const chapters = db.getAllChapters();
  const announcements = db.getAllAnnouncements();
  res.render('home', { chapters, announcements });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
