const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const mongoose = require('mongoose');
const User = require('../models/User');
const Area = require('../models/Area');
const { setCurrentArea, getDefaultArea } = require('../utils/areaContext');

// In-memory store for OTPs (Key: phone_number, Value: { otp, expiresAt })
// Note: In production, consider using Redis or a Database for scalability.
const otpStore = new Map();

// @route   POST api/auth/register
// @desc    Register user (Resident or Staff)
// @access  Public
router.post('/register', async (req, res) => {
  const { name, phone_number, firebase_uid, role, department, address, relation, phase, block, house_no, property_type, family_members, gender, otp, area: areaId, terms_accepted, terms_version } = req.body;

  try {
    if (!phone_number) return res.status(400).json({ msg: 'Phone number is required' });
    const cleanPhone = phone_number.replace(/^\+91/, '').trim();
    const isTestAccount = ['9999999999', '8888888888', '7777777777'].includes(cleanPhone);

    // Verify OTP - STRICT: Account cannot be created without valid OTP
    if (!otp) {
      return res.status(400).json({ msg: 'OTP is required for registration' });
    }

    if (isTestAccount && otp === '123456') {
      // Test account OTP bypass
    } else {
      const regKey = `reg_${cleanPhone}`;
      const storedData = otpStore.get(regKey) || otpStore.get(cleanPhone);

      if (!storedData) {
        return res.status(400).json({ msg: 'OTP not found or expired. Please request a new one.' });
      }

      if (Date.now() > storedData.expiresAt) {
        otpStore.delete(regKey);
        otpStore.delete(cleanPhone);
        return res.status(400).json({ msg: 'OTP expired. Please request a new one.' });
      }

      if (storedData.otp !== otp.trim()) {
        return res.status(400).json({ msg: 'Invalid OTP' });
      }

      // OTP verified successfully, clear from store
      otpStore.delete(regKey);
      otpStore.delete(cleanPhone);
    }

    const dbPhoneNumber = phone_number.startsWith('+91') ? phone_number : `+91${cleanPhone}`;
    let user = await User.findOne({ 
      $or: [{ phone_number: dbPhoneNumber }, { phone_number: cleanPhone }] 
    });
    if (user) return res.status(400).json({ msg: 'User already exists with this phone number' });

    // Area the resident is registering into. Older app builds don't send one,
    // so they fall back to the original area.
    let area = null;
    // App builds from the reverted location feature send the phase name
    // (e.g. "Sushant Lok 3") as `area`; treat anything that isn't an id as legacy.
    if (areaId && mongoose.Types.ObjectId.isValid(String(areaId))) {
      area = await Area.findOne({ _id: areaId, is_active: true }).catch(() => null);
      if (!area) return res.status(400).json({ msg: 'Please select a valid area' });
    } else {
      area = getDefaultArea() ? { _id: getDefaultArea() } : null;
    }
    // From here on (address checks, save, live events) work inside that area
    if (area) setCurrentArea(area._id);

    // Handle address logic for Residents.
    // Village addresses may have no house number; those can't identify one
    // home, so they are never treated as duplicates. (Old app builds don't
    // send house_no at all and keep the check.)
    const hasHouseNo = house_no === undefined || String(house_no).trim() !== '';
    if (role === 'Resident' && address && hasHouseNo) {
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

    user = new User({ 
      name, 
      phone_number: dbPhoneNumber, 
      firebase_uid, 
      role: role || 'Resident', 
      department, 
      address, 
      relation, 
      phase, 
      block,
      house_no,
      property_type,
      family_members: family_members || [], 
      gender,
      area: area ? area._id : undefined,
      // Consent given on the registration screen (newer app builds only)
      ...(terms_accepted === true ? { terms_accepted_at: new Date(), terms_version: String(terms_version || '').slice(0, 32) || undefined } : {})
    });

    await user.save();

    // Emit live event to admin dashboard
    const io = req.app.get('io');
    if (io) {
      io.emit('user_created', user);
    }

    // Do NOT return JWT token so user is NOT automatically logged in!
    // User must be redirected to the login page and login themselves.
    res.json({ 
      success: true, 
      msg: 'Registration successful! Please login.', 
      user: { id: user.id, name: user.name, role: user.role, phone_number: user.phone_number } 
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

    user.has_logged_in = true;
    user.last_login_at = new Date();
    await user.save();

    const payload = { user: { id: user.id, role: user.role, assigned_category: user.assigned_category, assigned_categories: user.assigned_categories, permissions: user.permissions } };
    
    jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' }, (err, token) => {
      if (err) throw err;
      res.json({ token, user: { id: user.id, name: user.name, role: user.role, email: user.email, area: user.area || null, assigned_category: user.assigned_category, assigned_categories: user.assigned_categories, assigned_locations: user.assigned_locations || [], permissions: user.permissions } });
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// ---------------------------------------------------------------------------
// Admin panel login by phone OTP (replaces email + password)
//
// portal 'Admin'    -> SuperAdmin or area Admin accounts
// portal 'SubAdmin' -> SubAdmin accounts
// The OTP goes to the number saved on that account; whoever holds that phone
// shares the code. One number may be set on both an Admin and a SubAdmin; the
// portal tab decides which account is signed in.
//
// Testing bypass: OTP "0786" signs in without SMS, only for ADMIN_BYPASS_PHONES
// (comma separated, default below). Override the code with ADMIN_BYPASS_OTP, or
// set ADMIN_BYPASS_OTP=off to disable it without a code change.
// ---------------------------------------------------------------------------
const ADMIN_PORTAL_ROLES = { Admin: ['SuperAdmin', 'Admin'], SubAdmin: ['SubAdmin'] };
const DEFAULT_ADMIN_BYPASS_PHONES = ['8650214489', '9810922338'];
const DEFAULT_ADMIN_BYPASS_OTP = '0786';
const adminOtpFailures = new Map(); // phone -> { count, lockedUntil }
const ADMIN_MAX_FAILS = 5;
const ADMIN_LOCK_MS = 15 * 60 * 1000;

const toLocal10 = (p) => String(p || '').replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '').slice(-10);

const findAdminByPhone = async (phone10, portal) => {
  const roles = ADMIN_PORTAL_ROLES[portal] || ADMIN_PORTAL_ROLES.Admin;
  const users = await User.find({
    role: { $in: roles },
    phone_number: { $in: [`+91${phone10}`, phone10] },
  });
  // Admin portal: a SuperAdmin wins over an area Admin with the same number
  return users.find((u) => u.role === 'SuperAdmin') || users[0] || null;
};

const isBypassPhone = (phone10) => {
  const phones = (process.env.ADMIN_BYPASS_PHONES || '').split(',').map(toLocal10).filter(Boolean);
  return (phones.length ? phones : DEFAULT_ADMIN_BYPASS_PHONES).includes(phone10);
};

const adminBypassAllowed = (phone10, otp) => {
  const code = (process.env.ADMIN_BYPASS_OTP || DEFAULT_ADMIN_BYPASS_OTP).trim();
  if (!code || code.toLowerCase() === 'off' || otp !== code) return false;
  return isBypassPhone(phone10);
};

const adminLockedFor = (phone10) => {
  const f = adminOtpFailures.get(phone10);
  return f && f.lockedUntil > Date.now() ? Math.ceil((f.lockedUntil - Date.now()) / 60000) : 0;
};

// @route   POST api/auth/admin/send-otp
// @body    { phone_number, portal: 'Admin' | 'SubAdmin' }
router.post('/admin/send-otp', async (req, res) => {
  try {
    const portal = req.body.portal === 'SubAdmin' ? 'SubAdmin' : 'Admin';
    const phone10 = toLocal10(req.body.phone_number);
    if (phone10.length !== 10) return res.status(400).json({ msg: 'Please enter a valid 10-digit mobile number' });

    const locked = adminLockedFor(phone10);
    if (locked) return res.status(429).json({ msg: `Too many wrong attempts. Try again in ${locked} min.` });

    const user = await findAdminByPhone(phone10, portal);
    if (!user) {
      return res.status(400).json({ msg: `This number is not registered for the ${portal === 'SubAdmin' ? 'Sub-Admin' : 'Super Admin'} portal.` });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore.set(`admin_${portal}_${phone10}`, { otp, expiresAt: Date.now() + 5 * 60 * 1000 });

    const fast2smsKey = process.env.FAST2SMS_API_KEY;
    if (!fast2smsKey) {
      console.warn('[admin-otp] FAST2SMS_API_KEY not set; OTP not sent');
      if (isBypassPhone(phone10)) return res.json({ msg: 'Enter your OTP', short_code: true });
      return res.status(503).json({ msg: 'SMS service is not configured. Please contact support.' });
    }
    try {
      const response = await axios.post(
        'https://www.fast2sms.com/dev/bulkV2',
        { route: 'dlt', sender_id: 'ANTHLP', message: '225661', variables_values: otp, flash: 0, numbers: phone10 },
        { headers: { authorization: fast2smsKey } }
      );
      if (response.data && response.data.return === false) throw new Error(JSON.stringify(response.data));
    } catch (smsErr) {
      // Never reveal the OTP when SMS fails: this login controls the admin panel
      console.error('[admin-otp] SMS failed:', smsErr.message);
      if (!isBypassPhone(phone10)) {
        return res.status(502).json({ msg: 'Could not send the OTP right now. Please try again.' });
      }
    }

    // short_code: this number may also use the 4-digit testing code (never sent)
    res.json({ msg: `OTP sent to +91 ${phone10.slice(0, 2)}XXXXX${phone10.slice(-3)}`, ...(isBypassPhone(phone10) ? { short_code: true } : {}) });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   POST api/auth/admin/verify-otp
// @body    { phone_number, otp, portal: 'Admin' | 'SubAdmin' }
router.post('/admin/verify-otp', async (req, res) => {
  try {
    const portal = req.body.portal === 'SubAdmin' ? 'SubAdmin' : 'Admin';
    const phone10 = toLocal10(req.body.phone_number);
    const otp = String(req.body.otp || '').trim();
    if (phone10.length !== 10 || !otp) return res.status(400).json({ msg: 'Phone number and OTP are required' });

    const locked = adminLockedFor(phone10);
    if (locked) return res.status(429).json({ msg: `Too many wrong attempts. Try again in ${locked} min.` });

    const key = `admin_${portal}_${phone10}`;
    const stored = otpStore.get(key);
    const validOtp = stored && Date.now() <= stored.expiresAt && stored.otp === otp;

    if (!validOtp && !adminBypassAllowed(phone10, otp)) {
      const f = adminOtpFailures.get(phone10) || { count: 0, lockedUntil: 0 };
      f.count += 1;
      if (f.count >= ADMIN_MAX_FAILS) {
        f.count = 0;
        f.lockedUntil = Date.now() + ADMIN_LOCK_MS;
        otpStore.delete(key);
      }
      adminOtpFailures.set(phone10, f);
      const expired = stored && Date.now() > stored.expiresAt;
      return res.status(400).json({ msg: expired ? 'OTP expired. Please request a new one.' : 'Invalid OTP' });
    }

    otpStore.delete(key);
    adminOtpFailures.delete(phone10);

    const user = await findAdminByPhone(phone10, portal);
    if (!user) return res.status(400).json({ msg: 'This number is no longer registered for this portal.' });

    user.has_logged_in = true;
    user.last_login_at = new Date();
    await user.save();

    const payload = { user: { id: user.id, role: user.role, assigned_category: user.assigned_category, assigned_categories: user.assigned_categories, permissions: user.permissions } };
    jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' }, (err, token) => {
      if (err) return res.status(500).json({ msg: 'Server error' });
      res.json({ token, user: { id: user.id, name: user.name, role: user.role, email: user.email, phone_number: user.phone_number, area: user.area || null, assigned_category: user.assigned_category, assigned_categories: user.assigned_categories, assigned_locations: user.assigned_locations || [], permissions: user.permissions } });
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   POST api/auth/firebase-login
// @desc    Authenticate or Register user via Firebase Phone Auth
// @access  Public
router.post('/firebase-login', async (req, res) => {
  const { phone_number, firebase_uid } = req.body;

  try {
    if (!phone_number) return res.status(400).json({ msg: 'Phone number is required' });

    let users = await User.find({ phone_number });
    let user;
    
    // If user does not exist, auto-register as Resident
    if (users.length === 0) {
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
      user = users.find(u => u.role === 'Staff' || u.role === 'PaidStaff') 
          || users.find(u => u.role === 'Admin' || u.role === 'SubAdmin') 
          || users[0];
          
      // Update firebase_uid if not set
      if (!user.firebase_uid && firebase_uid) {
        user.firebase_uid = firebase_uid;
        await user.save();
      }
    }
    
    user.has_logged_in = true;
    user.last_login_at = new Date();
    await user.save();
    // Mark all accounts with same phone as active too
    if (user.phone_number) {
      await User.updateMany({ phone_number: user.phone_number, _id: { $ne: user._id } }, { has_logged_in: true, last_login_at: new Date() });
    }

    const payload = { user: { id: user.id, role: user.role, assigned_category: user.assigned_category, assigned_categories: user.assigned_categories, member_id: user.member_id } };
    
    jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' }, (err, token) => {
      if (err) throw err;
      res.json({ token, user: { id: user.id, name: user.name, role: user.role, phone_number: user.phone_number, assigned_category: user.assigned_category, assigned_categories: user.assigned_categories, assigned_locations: user.assigned_locations || [], member_id: user.member_id } });
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
  let { phone_number, role, type, address, relation, house_no } = req.body;
  
  try {
    if (!phone_number) return res.status(400).json({ msg: 'Phone number is required' });
    
    // Clean up phone number (remove +91 if provided for Fast2SMS)
    phone_number = phone_number.replace(/^\+91/, '').trim();
    
    if (phone_number.length !== 10) {
      return res.status(400).json({ msg: 'Invalid phone number format' });
    }

    const dbPhoneNumber = `+91${phone_number}`;

    // Handle REGISTRATION flow OTP
    if (type === 'register') {
      let existingUser = await User.findOne({
        $or: [
          { phone_number: dbPhoneNumber },
          { phone_number: phone_number },
          { "family_members.phone_number": phone_number },
          { "family_members.phone_number": dbPhoneNumber }
        ]
      });

      if (existingUser) {
        return res.status(400).json({ msg: 'Phone number is already registered. Please login instead.' });
      }

      // Check address duplication if provided during registration
      // Same rule as /register: no house number (villages) -> no duplicate check
      const hasHouseNo = house_no === undefined || String(house_no).trim() !== '';
      if ((role === 'Resident' || !role) && address && hasHouseNo) {
        const normalizeAddress = (str) => (str || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        const normalizedInputAddress = normalizeAddress(address);
        const allResidents = await User.find({ role: 'Resident', address: { $exists: true, $ne: null } });
        const existingAddressUsers = allResidents.filter(u => normalizeAddress(u.address) === normalizedInputAddress);

        if (existingAddressUsers.length > 0) {
          if (!relation) {
            return res.status(400).json({ 
              error_code: 'DUPLICATE_ADDRESS', 
              msg: 'This address is already registered. Please specify your relation (e.g., Tenant, Family).' 
            });
          }

          const isNewRelationOwner = relation.trim().toLowerCase() === 'owner';
          if (isNewRelationOwner) {
            const hasExistingOwner = existingAddressUsers.some(u => {
              if (!u.relation) return true;
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

      // Generate 6 digit OTP for registration
      const isTestAccount = ['9999999999', '8888888888', '7777777777'].includes(phone_number);
      const otp = isTestAccount ? '123456' : Math.floor(100000 + Math.random() * 900000).toString();

      otpStore.set(`reg_${phone_number}`, {
        otp,
        expiresAt: Date.now() + 5 * 60 * 1000
      });

      if (isTestAccount) {
        return res.json({ msg: 'OTP sent successfully (Test Account)' });
      }

      const fast2smsKey = process.env.FAST2SMS_API_KEY;
      if (!fast2smsKey) {
        console.warn("Fast2SMS API Key is not set in environment variables! OTP logged for testing: ", otp);
        return res.json({ msg: 'OTP generated (Dev mode: API key missing)', dev_otp: otp });
      }

      try {
        const response = await axios.post(
          'https://www.fast2sms.com/dev/bulkV2',
          {
            route: 'dlt',
            sender_id: 'ANTHLP',
            message: '225661',
            variables_values: String(otp),
            flash: 0,
            numbers: phone_number,
          },
          {
            headers: {
              authorization: fast2smsKey,
            },
          }
        );

        if (response.data.return === false) {
           console.warn("Fast2SMS DLT API returned false. Fallback to Dev Mode. OTP:", otp, response.data);
           return res.json({ msg: `Test Mode OTP: ${otp} (Fast2SMS failed)`, dev_otp: otp });
        }

        console.log("Fast2SMS DLT sent successfully:", response.data);
        return res.json({ msg: 'OTP sent successfully to your mobile number' });
      } catch (apiError) {
        console.warn("Fast2SMS API threw an error. Fallback to Dev Mode. OTP:", otp);
        return res.json({ msg: `Test Mode OTP: ${otp}`, dev_otp: otp });
      }
    }

    // NORMAL LOGIN FLOW: Check if user is registered before sending OTP.
    // Admin-panel accounts (SuperAdmin) can share a number with an app user,
    // so ignore them here and prefer the account matching the requested role.
    const candidates = await User.find({
      role: { $ne: 'SuperAdmin' },
      $or: [
        { phone_number: dbPhoneNumber },
        { "family_members.phone_number": phone_number },
        { "family_members.phone_number": dbPhoneNumber }
      ]
    });
    const isAppUser = (u) => !['Admin', 'SubAdmin'].includes(u.role);
    let userExists = (role ? candidates.find((u) => u.role === role) : null)
      || (role === 'Resident' ? candidates.find((u) => u.role === 'Member') : null)
      || candidates.find(isAppUser)
      || candidates[0]
      || null;
    
    if (!userExists) {
      // Auto-register Reviewer test accounts
      if (phone_number === '9999999999') {
        userExists = new User({ name: 'Resident Reviewer', phone_number: dbPhoneNumber, role: 'Resident' });
        await userExists.save();
      } else if (phone_number === '8888888888') {
        userExists = new User({ name: 'Staff Reviewer', phone_number: dbPhoneNumber, role: 'Staff', assigned_category: 'Electrical', assigned_categories: ['Electrical'] });
        await userExists.save();
      } else if (phone_number === '7777777777') {
        userExists = new User({ name: 'Partner Reviewer', phone_number: dbPhoneNumber, role: 'PaidStaff' });
        await userExists.save();
      } else {
        return res.status(400).json({ msg: 'Number not registered. Please sign up first.' });
      }
    }

    if (role && userExists.role !== role) {
      // Check if this phone number is a family member
      const isFamily = (userExists.family_members || []).some(f => {
        const cleanF = (f.phone_number || '').replace(/^\+91/, '').trim();
        return cleanF === phone_number;
      });
      const isMemberResidentCross = (role === 'Resident' && userExists.role === 'Member');
      if (!isFamily && !isMemberResidentCross) {
        return res.status(403).json({ msg: `Access Denied. You are registered as ${userExists.role}, not ${role}.` });
      }
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
          route: 'dlt',
          sender_id: 'ANTHLP',
          message: '225661',
          variables_values: String(otp),
          flash: 0,
          numbers: phone_number,
        },
        {
          headers: {
            authorization: fast2smsKey,
          },
        }
      );

      if (response.data.return === false) {
         console.warn("Fast2SMS DLT API returned false. Fallback to Dev Mode. OTP:", otp, response.data);
         return res.json({ msg: `Test Mode OTP: ${otp} (Fast2SMS failed)`, dev_otp: otp });
      }

      console.log("Fast2SMS DLT sent successfully:", response.data);
      res.json({ msg: 'OTP sent successfully to your mobile number' });
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

    const dbPhoneNumber = `+91${phone_number}`;
    // The SuperAdmin account only signs in to the admin panel
    let users = await User.find({
      role: { $ne: 'SuperAdmin' },
      $or: [
        { phone_number: dbPhoneNumber },
        { "family_members.phone_number": phone_number },
        { "family_members.phone_number": dbPhoneNumber }
      ]
    });
    
    if (users.length === 0) {
      return res.status(400).json({ msg: 'Number not registered. Please sign up first.' });
    }
    
    // Prioritize explicitly requested role if provided (e.g. Resident, Member, Staff)
    let user = (role ? users.find(u => u.role === role) : null)
            || users.find(u => u.role === 'Staff' || u.role === 'PaidStaff') 
            || users.find(u => u.role === 'Admin' || u.role === 'SubAdmin') 
            || users.find(u => u.role === 'Member')
            || users[0];

    // Check if logging in as family member
    const matchingFamilyMember = (user.family_members || []).find(f => {
      const cleanF = (f.phone_number || '').replace(/^\+91/, '').trim();
      return cleanF === phone_number;
    });

    if (role && user.role !== role) {
      const isFamily = !!matchingFamilyMember;
      const isMemberResidentCross = (role === 'Resident' && user.role === 'Member');
      if (!isFamily && !isMemberResidentCross) {
        return res.status(403).json({ msg: `Access Denied. You are registered as ${user.role}, not ${role}.` });
      }
    }

    user.has_logged_in = true;
    user.last_login_at = new Date();
    await user.save();
    // Mark all accounts with same phone as active too
    if (user.phone_number) {
      await User.updateMany({ phone_number: user.phone_number, _id: { $ne: user._id } }, { has_logged_in: true, last_login_at: new Date() });
    }

    const payload = { user: { id: user.id, role: user.role, assigned_category: user.assigned_category, assigned_categories: user.assigned_categories, member_id: user.member_id, permissions: user.permissions || [] } };
    
    const displayName = matchingFamilyMember ? matchingFamilyMember.name : user.name;
    const displayPhone = matchingFamilyMember ? dbPhoneNumber : user.phone_number;

    jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' }, (err, token) => {
      if (err) throw err;
      res.json({ 
        token, 
        user: { 
          id: user.id, 
          name: displayName, 
          role: user.role, 
          phone_number: displayPhone, 
          is_family_member: !!matchingFamilyMember,
          family_relation: matchingFamilyMember ? matchingFamilyMember.relation : undefined,
          assigned_category: user.assigned_category, 
          assigned_categories: user.assigned_categories, 
          assigned_locations: user.assigned_locations || [],
          member_id: user.member_id, 
          permissions: user.permissions || [],
          phase: user.phase,
          block: user.block,
          house_no: user.house_no,
          property_type: user.property_type,
          address: user.address,
          gender: user.gender
        } 
      });
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   POST api/auth/logout
// @desc    Logout user and mark as inactive
// @access  Public
router.post('/logout', async (req, res) => {
  const { userId } = req.body;
  try {
    if (!userId) return res.status(400).json({ msg: 'User ID is required' });
    
    let user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    // has_logged_in stays true on logout — Active means "account set up", not "currently online"
    // Only update last_login_at is not needed on logout

    res.json({ msg: 'Logged out successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;
