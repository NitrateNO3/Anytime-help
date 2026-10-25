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
  const { name, phone_number, firebase_uid, role, department, address, relation, phase, block, house_no, property_type, family_members, gender, otp } = req.body;

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
      gender 
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
      res.json({ token, user: { id: user.id, name: user.name, role: user.role, email: user.email, assigned_category: user.assigned_category, assigned_categories: user.assigned_categories, permissions: user.permissions } });
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
      res.json({ token, user: { id: user.id, name: user.name, role: user.role, phone_number: user.phone_number, assigned_category: user.assigned_category, assigned_categories: user.assigned_categories, member_id: user.member_id } });
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
  let { phone_number, role, type, address, relation } = req.body;
  
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
      if ((role === 'Resident' || !role) && address) {
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

    // NORMAL LOGIN FLOW: Check if user is registered before sending OTP
    let userExists = await User.findOne({
      $or: [
        { phone_number: dbPhoneNumber },
        { "family_members.phone_number": phone_number } // check without +91 as well just in case, or with +91. Best to check both.
      ]
    });
    
    // Also check if family member phone number has +91
    if (!userExists) {
      userExists = await User.findOne({ "family_members.phone_number": dbPhoneNumber });
    }
    
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
    let users = await User.find({
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
