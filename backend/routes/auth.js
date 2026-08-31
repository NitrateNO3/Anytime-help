const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const User = require('../models/User');

// In-memory store for OTPs (Key: phone_number, Value: { otp, expiresAt })
// Note: In production, consider using Redis or a Database for scalability.
const otpStore = new Map();

// @route   POST api/auth/register
// @desc    Register user (Resident or Staff)
// @access  Public
router.post('/register', async (req, res) => {
  const { name, phone_number, firebase_uid, role, department, address, relation } = req.body;

  try {
    let user = await User.findOne({ phone_number });
    if (user) return res.status(400).json({ msg: 'User already exists' });

    // Handle address logic for Residents
    if (role === 'Resident' && address) {
      // Normalize address to keep only alphanumeric characters for comparison
      const normalizeAddress = (str) => (str || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      const normalizedInputAddress = normalizeAddress(address);

      // Fetch all residents that have an address
      const allResidents = await User.find({ role: 'Resident', address: { $exists: true, $ne: null } });
      
      // Filter residents who have the same normalized address
      const existingAddressUsers = allResidents.filter(u => normalizeAddress(u.address) === normalizedInputAddress);

      if (existingAddressUsers.length > 0) {
        // If relation is not provided, prompt the user
        if (!relation) {
          return res.status(400).json({ 
            error_code: 'DUPLICATE_ADDRESS', 
            msg: 'This address is already registered. Please specify your relation (e.g., Tenant, Family).' 
          });
        }

        // If relation IS provided, prevent multiple "Owner" accounts
        const isNewRelationOwner = relation.trim().toLowerCase() === 'owner';
        if (isNewRelationOwner) {
          const hasExistingOwner = existingAddressUsers.some(u => {
            if (!u.relation) return true; // Default relation is considered 'Owner'
            return u.relation.trim().toLowerCase() === 'owner';
          });
          
          if (hasExistingOwner) {
            return res.status(400).json({ 
              msg: 'An Owner is already registered for this address. Please register as Tenant or Family member, or contact admin.' 
            });
          }
        }
      }
    }

    user = new User({ name, phone_number, firebase_uid, role, department, address, relation });

    await user.save();

    // Emit live event to admin dashboard
    const io = req.app.get('io');
    if (io) {
      io.emit('user_created', user);
    }

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
      
      // Emit live event to admin dashboard
      const io = req.app.get('io');
      if (io) {
        io.emit('user_created', user);
      }
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

// @route   POST api/auth/send-otp
// @desc    Generate and send OTP via Fast2SMS
// @access  Public
router.post('/send-otp', async (req, res) => {
  let { phone_number, role } = req.body;
  
  try {
    if (!phone_number) return res.status(400).json({ msg: 'Phone number is required' });
    
    // Clean up phone number (remove +91 if provided for Fast2SMS)
    phone_number = phone_number.replace(/^\+91/, '').trim();
    
    if (phone_number.length !== 10) {
      return res.status(400).json({ msg: 'Invalid phone number format' });
    }

    // Check if user is registered before sending OTP
    const dbPhoneNumber = `+91${phone_number}`;
    let userExists = await User.findOne({ phone_number: dbPhoneNumber });
    
    if (!userExists) {
      // Auto-register Reviewer test accounts
      if (phone_number === '9999999999') {
        userExists = new User({ name: 'Resident Reviewer', phone_number: dbPhoneNumber, role: 'Resident' });
        await userExists.save();
      } else if (phone_number === '8888888888') {
        userExists = new User({ name: 'Staff Reviewer', phone_number: dbPhoneNumber, role: 'Staff', assigned_category: 'Electrical' });
        await userExists.save();
      } else if (phone_number === '7777777777') {
        userExists = new User({ name: 'Partner Reviewer', phone_number: dbPhoneNumber, role: 'PaidStaff' });
        await userExists.save();
      } else {
        return res.status(400).json({ msg: 'Number not registered. Please sign up first.' });
      }
    }

    if (role && userExists.role !== role) {
      return res.status(403).json({ msg: `Access Denied. You are registered as ${userExists.role}, not ${role}.` });
    }

    // Generate 6 digit OTP (Hardcoded for Review Accounts)
    const isTestAccount = ['9999999999', '8888888888', '7777777777'].includes(phone_number);
    const otp = isTestAccount ? '123456' : Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store OTP with 5 minute expiration
    otpStore.set(phone_number, {
      otp,
      expiresAt: Date.now() + 5 * 60 * 1000
    });

    // Bypass Fast2SMS for Review Accounts
    if (isTestAccount) {
      return res.json({ msg: 'OTP sent successfully (Test Account)' });
    }

    // Call Fast2SMS API
    const fast2smsKey = process.env.FAST2SMS_API_KEY;
    if (!fast2smsKey) {
      console.warn("Fast2SMS API Key is not set in environment variables! OTP logged for testing: ", otp);
      return res.json({ msg: 'OTP generated (Dev mode: API key missing)', dev_otp: otp });
    }

    try {
      const response = await axios.post(
        'https://www.fast2sms.com/dev/bulkV2',
        {
          variables_values: otp,
          route: 'otp',
          numbers: phone_number,
        },
        {
          headers: {
            authorization: fast2smsKey,
          },
        }
      );

      if (response.data.return === false) {
         console.warn("Fast2SMS API returned false. Fallback to Dev Mode. OTP:", otp);
         return res.json({ msg: `Test Mode OTP: ${otp} (Fast2SMS failed)`, dev_otp: otp });
      }

      res.json({ msg: 'OTP sent successfully' });
    } catch (apiError) {
      console.warn("Fast2SMS API threw an error. Fallback to Dev Mode. OTP:", otp);
      return res.json({ msg: `Test Mode OTP: ${otp}`, dev_otp: otp });
    }
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   POST api/auth/verify-otp
// @desc    Verify OTP and Authenticate user
// @access  Public
router.post('/verify-otp', async (req, res) => {
  let { phone_number, otp, role } = req.body;

  try {
    if (!phone_number || !otp) return res.status(400).json({ msg: 'Phone number and OTP are required' });
    
    phone_number = phone_number.replace(/^\+91/, '').trim();
    
    const storedData = otpStore.get(phone_number);
    
    if (!storedData) {
      return res.status(400).json({ msg: 'OTP not found or expired. Please request a new one.' });
    }
    
    if (Date.now() > storedData.expiresAt) {
      otpStore.delete(phone_number);
      return res.status(400).json({ msg: 'OTP expired. Please request a new one.' });
    }
    
    if (storedData.otp !== otp) {
      return res.status(400).json({ msg: 'Invalid OTP' });
    }
    
    // OTP verified successfully, remove from store
    otpStore.delete(phone_number);

    // Find user
    const dbPhoneNumber = `+91${phone_number}`;
    let user = await User.findOne({ phone_number: dbPhoneNumber });
    
    if (!user) {
      return res.status(400).json({ msg: 'Number not registered. Please sign up first.' });
    }

    if (role && user.role !== role) {
      return res.status(403).json({ msg: `Access Denied. You are registered as ${user.role}, not ${role}.` });
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
