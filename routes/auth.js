const express = require('express');
const bcrypt = require('bcryptjs');

module.exports = function (db) {
  const router = express.Router();

  // User login page
  router.get('/login', (req, res) => {
    if (req.session.user) return res.redirect('/');
    res.render('login', { error: null });
  });

  // User login
  router.post('/login', (req, res) => {
    const { username, password } = req.body;
    const user = db.findUser({ username, role: 'user' });

    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.render('login', { error: 'Invalid username or password' });
    }

    req.session.user = { id: user.id, username: user.username, role: user.role };
    res.redirect('/');
  });

  // Register page
  router.get('/register', (req, res) => {
    if (req.session.user) return res.redirect('/');
    res.render('register', { error: null });
  });

  // Register
  router.post('/register', (req, res) => {
    const { username, email, password, confirmPassword } = req.body;

    if (!username || !email || !password) {
      return res.render('register', { error: 'All fields are required' });
    }
    if (password.length < 6) {
      return res.render('register', { error: 'Password must be at least 6 characters' });
    }
    if (password !== confirmPassword) {
      return res.render('register', { error: 'Passwords do not match' });
    }

    const existing = db.findUserByUsernameOrEmail(username, email);
    if (existing) {
      return res.render('register', { error: 'Username or email already taken' });
    }

    const hash = bcrypt.hashSync(password, 10);
    const user = db.addUser(username, email, hash, 'user');

    req.session.user = {
      id: user.id,
      username,
      role: 'user'
    };
    res.redirect('/');
  });

  // Logout
  router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
  });

  return router;
};
