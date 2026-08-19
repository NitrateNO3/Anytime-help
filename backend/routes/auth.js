const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// @route   POST api/auth/register
// @desc    Register user (Resident or Staff)
// @access  Public
router.post('/register', async (req, res) => {
  const { name, phone_number, firebase_uid, role, department } = req.body;

  try {
    let user = await User.findOne({ phone_number });
    if (user) return res.status(400).json({ msg: 'User already exists' });

    user = new User({ name, phone_number, firebase_uid, role, department });

    await user.save();

    // Create JWT Payload
    const payload = { user: { id: user.id, role: user.role, assigned_category: user.assigned_category } };
    
    jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' }, (err, token) => {
      if (err) throw err;
      res.json({ token, user: { id: user.id, name: user.name, role: user.role, phone_number: user.phone_number, assigned_category: user.assigned_category } });
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   POST api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    let user = await User.findOne({ email });
    if (!user) return res.status(400).json({ msg: 'Invalid Credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ msg: 'Invalid Credentials' });

    const payload = { user: { id: user.id, role: user.role, assigned_category: user.assigned_category } };
    
    jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' }, (err, token) => {
      if (err) throw err;
      res.json({ token, user: { id: user.id, name: user.name, role: user.role, email: user.email, assigned_category: user.assigned_category } });
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   POST api/auth/firebase-login
// @desc    Authenticate or Register user via Firebase Phone Auth
// @access  Public
router.post('/firebase-login', async (req, res) => {
  const { phone_number, firebase_uid } = req.body;

  try {
    if (!phone_number) return res.status(400).json({ msg: 'Phone number is required' });

    let user = await User.findOne({ phone_number });
    
    // If user does not exist, auto-register as Resident
    if (!user) {
      user = new User({ 
        phone_number, 
        firebase_uid, 
        role: 'Resident',
        name: 'User ' + phone_number.slice(-4)
      });
      await user.save();
    } else {
      // Update firebase_uid if not set
      if (!user.firebase_uid && firebase_uid) {
        user.firebase_uid = firebase_uid;
        await user.save();
      }
    }

    const payload = { user: { id: user.id, role: user.role, assigned_category: user.assigned_category } };
    
    jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' }, (err, token) => {
      if (err) throw err;
      res.json({ token, user: { id: user.id, name: user.name, role: user.role, phone_number: user.phone_number, assigned_category: user.assigned_category } });
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;
