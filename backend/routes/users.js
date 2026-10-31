const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const auth = require('../middleware/auth');

const checkAccess = (user, section) => {
  if (user.role === 'Admin') return true;
  
  if ((user.role === 'SubAdmin' || user.role === 'Member') && user.permissions) {
    if (user.permissions.includes(section)) return true;
    
    // Handle variations of the Residents permission
    if (section === 'Residents' || section === 'Residents List') {
      const hasResidentPerm = user.permissions.some(p => 
        ['Resident', 'Residents', 'Residents List'].includes(p)
      );
      if (hasResidentPerm) return true;
    }
  }
  return false;
};

// @route   GET api/users/me
// @desc    Get current user profile & linked accounts
// @access  Private
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    // Fetch all accounts associated with this phone number
    let accounts = [];
    if (user.phone_number) {
      accounts = await User.find({ 
        phone_number: user.phone_number,
        _id: { $ne: user._id }
      }).select('-password');
    }
    
    // Return user object with accounts attached
    const userData = { ...user.toObject(), accounts };
    res.json(userData);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   PUT api/users/me
// @desc    Update current user profile
// @access  Private
router.put('/me', auth, async (req, res) => {
  try {
    const { name, phone_number, address, gender, property_type, phase, block, house_no } = req.body;
    let user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (name !== undefined) user.name = name;
    if (phone_number !== undefined) {
      user.phone_number = phone_number.startsWith('+') ? phone_number : `+91${phone_number}`;
    }
    if (address !== undefined) user.address = address;
    if (gender !== undefined) user.gender = gender;
    
    if (user.role === 'Resident' || user.role === 'Member') {
      if (property_type !== undefined) user.property_type = property_type;
      if (phase !== undefined) user.phase = phase;
      if (block !== undefined) user.block = block;
      if (house_no !== undefined) user.house_no = house_no;
    }

    await user.save();
    
    const io = req.app.get('io');
    if (io) {
      io.emit('user_updated', { userId: user._id, role: user.role, name: user.name });
    }

    res.json({ message: 'Profile updated successfully', user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   DELETE api/users/me
// @desc    Self-delete user account (Resident, Member, Staff, PaidStaff)
// @access  Private
router.delete('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.role === 'Admin') {
      return res.status(403).json({ message: 'Admin account cannot be self-deleted from the app' });
    }

    await User.findByIdAndDelete(req.user.id);

    // Emit live event for remote logout and realtime update
    const io = req.app.get('io');
    if (io) {
      io.emit('user_deleted', { id: req.user.id });
      if (user.role === 'Staff' || user.role === 'PaidStaff') {
        io.emit('staff_changed', { action: 'delete', id: req.user.id });
      }
    }

    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET api/users/phases
// @desc    Get all distinct phases
// @access  Admin Private
router.get('/phases', auth, async (req, res) => {
  try {
    const phases = await User.distinct('phase', { phase: { $exists: true, $ne: null } });
    const canonicalPhases = ['Sushant Lok 2', 'Sushant Lok 3'];
    const customPhases = (phases || []).filter(p => 
      typeof p === 'string' && 
      p.trim() !== '' && 
      !['Universal', 'All', 'All Groups', 'All Groups (Universal)', 'Unassigned'].includes(p) &&
      !p.toLowerCase().includes('sushant lok') &&
      !p.includes(',') && !p.toLowerCase().includes('option') && !p.includes(' - ')
    );
    const combined = [...new Set([...canonicalPhases, ...customPhases])];
    res.json(combined);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   PUT api/users/phases/:oldName
// @desc    Rename a phase across all users
// @access  Admin Private
router.put('/phases/:oldName', auth, async (req, res) => {
  try {
    if (!checkAccess(req.user, 'Staff Team') && !checkAccess(req.user, 'Residents List')) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    const { oldName } = req.params;
    const { newName } = req.body;
    
    if (!newName || newName.trim() === '') {
      return res.status(400).json({ message: 'New phase name is required' });
    }

    const result = await User.updateMany(
      { phase: oldName },
      { $set: { phase: newName.trim() } }
    );
    
    res.json({ message: 'Phase renamed successfully', modifiedCount: result.modifiedCount });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   DELETE api/users/phases/:phaseName
// @desc    Safely delete a phase by setting users to Unassigned
// @access  Admin Private
router.delete('/phases/:phaseName', auth, async (req, res) => {
  try {
    if (!checkAccess(req.user, 'Staff Team') && !checkAccess(req.user, 'Residents List')) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    const { phaseName } = req.params;

    const result = await User.updateMany(
      { phase: phaseName },
      { $set: { phase: 'Unassigned' } }
    );
    
    res.json({ message: 'Phase deleted safely', modifiedCount: result.modifiedCount });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET api/users/staff
// @desc    Get all staff members (supports pagination)
// @access  Admin Private
router.get('/staff', auth, async (req, res) => {
  try {
    if (!checkAccess(req.user, 'Staff Team')) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    const { page, limit, phase, search, dateFrom, dateTo, status } = req.query;
    let query = { role: 'Staff' };
    const andConditions = [];

    if (phase && phase !== 'All' && phase !== 'All Groups (Show Everything)') {
      if (phase === 'Universal' || phase === 'Universal Staff Only') {
        andConditions.push({ $or: [
          { phase: 'Universal' },
          { phase: 'All' },
          { phase: 'All Groups' },
          { name: { $regex: 'universal', $options: 'i' } }
        ]});
      } else if (phase === 'Sushant Lok 2 - C,D,E') {
        andConditions.push({ $or: [
          { phase: 'Sushant Lok 2 - C,D,E' },
          { phase: 'Sushant Lok 2 Option 1' },
          { name: { $regex: 'Sushant Lok 2 - C,D,E', $options: 'i' } }
        ]});
      } else if (phase === 'Sushant Lok 2 - F,G') {
        andConditions.push({ $or: [
          { phase: 'Sushant Lok 2 - F,G' },
          { phase: 'Sushant Lok 2 Option 2' },
          { name: { $regex: 'Sushant Lok 2 - F,G', $options: 'i' } }
        ]});
      } else {
        andConditions.push({ $or: [
          { phase },
          { 'assigned_locations.phase': phase },
          { name: { $regex: phase, $options: 'i' } }
        ]});
      }
    }

    if (search && search.trim()) {
      const s = search.trim();
      andConditions.push({
        $or: [
          { name: { $regex: s, $options: 'i' } },
          { phone_number: { $regex: s, $options: 'i' } },
          { assigned_category: { $regex: s, $options: 'i' } },
          { 'assigned_locations.phase': { $regex: s, $options: 'i' } },
          { 'assigned_locations.blocks': { $regex: s, $options: 'i' } }
        ]
      });
    }

    if (dateFrom || dateTo) {
      const dateFilter = {};
      if (dateFrom) dateFilter.$gte = new Date(dateFrom);
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        dateFilter.$lte = end;
      }
      andConditions.push({ createdAt: dateFilter });
    }

    if (status && status !== 'ALL') {
      if (status === 'Active') {
        andConditions.push({ has_logged_in: true });
      } else if (status === 'Pending') {
        andConditions.push({ has_logged_in: { $ne: true } });
      }
    }

    if (andConditions.length > 0) {
      query.$and = andConditions;
    }

    const pageNum = parseInt(page || '1', 10);
    const limitNum = Math.min(parseInt(limit || '20', 10), 20);
    const skip = (pageNum - 1) * limitNum;
    
    let staffQuery = User.find(query).select('-password -__v').sort({ createdAt: -1 });
    if (req.query.all !== 'true') {
      staffQuery = staffQuery.skip(skip).limit(limitNum);
    }
    const staff = await staffQuery.lean();
    const total = await User.countDocuments(query);
    
    if (!page && !limit) return res.json(staff);
    
    return res.json({ staff, total, page: pageNum, totalPages: Math.ceil(total / limitNum) || 1 });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET api/users/paid-staff
// @desc    Get all paid staff members
// @access  Admin Private
router.get('/paid-staff', auth, async (req, res) => {
  try {
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    const staff = await User.find({ role: 'PaidStaff' }).select('-password -__v').lean();
    res.json(staff);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET api/users/residents
// @desc    Get all resident members (supports pagination)
// @access  Admin Private
router.get('/residents', auth, async (req, res) => {
  try {
    if (req.user.role !== 'Member' && !checkAccess(req.user, 'Residents')) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    const { page, limit, phase, search, relation, dateFrom, dateTo, role, status } = req.query;
    
    let roleQuery = { $in: ['Resident', 'Member'] };
    if (role === 'Resident') roleQuery = 'Resident';
    else if (role === 'Member') roleQuery = 'Member';
    
    let query = { role: roleQuery };
    const andConditions = [];

    if (phase && phase !== 'All Groups (Show Everything)') {
      if (phase === 'Sushant Lok 2') {
        andConditions.push({ 
          $or: [
            { phase: 'Sushant Lok 2' },
            { phase: 'Sushant Lok 2 - C,D,E' },
            { phase: 'Sushant Lok 2 - F,G' },
            { phase: 'Sushant Lok 2 Option 1' },
            { phase: 'Sushant Lok 2 Option 2' }
          ] 
        });
      } else if (phase === 'Sushant Lok 2 - C,D,E') {
        andConditions.push({ $or: [{ phase: 'Sushant Lok 2 - C,D,E' }, { phase: 'Sushant Lok 2 Option 1' }] });
      } else if (phase === 'Sushant Lok 2 - F,G') {
        andConditions.push({ $or: [{ phase: 'Sushant Lok 2 - F,G' }, { phase: 'Sushant Lok 2 Option 2' }] });
      } else {
        andConditions.push({ phase: phase });
      }
    }

    if (relation && relation !== 'ALL' && relation !== 'All Relations') {
      if (relation.toLowerCase() === 'owner') {
        andConditions.push({
          $or: [
            { relation: { $regex: /^(owner|owned)$/i } },
            { relation: null },
            { relation: { $exists: false } },
            { relation: '' }
          ]
        });
      } else if (relation.toLowerCase() === 'rented') {
        andConditions.push({
          $or: [
            { relation: { $regex: /rent/i } },
            { relation: { $regex: /tenant/i } }
          ]
        });
      } else {
        andConditions.push({ relation: { $regex: new RegExp(relation.trim(), 'i') } });
      }
    }

    if (search && search.trim()) {
      const s = search.trim();
      andConditions.push({
        $or: [
          { name: { $regex: s, $options: 'i' } },
          { phone_number: { $regex: s, $options: 'i' } },
          { address: { $regex: s, $options: 'i' } },
          { phase: { $regex: s, $options: 'i' } },
          { block: { $regex: s, $options: 'i' } },
          { house_no: { $regex: s, $options: 'i' } }
        ]
      });
    }

    if (dateFrom || dateTo) {
      const dateFilter = {};
      if (dateFrom) dateFilter.$gte = new Date(dateFrom);
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        dateFilter.$lte = end;
      }
      andConditions.push({ createdAt: dateFilter });
    }

    if (status && status !== 'ALL') {
      if (status === 'Active') {
        andConditions.push({ has_logged_in: true });
      } else if (status === 'Pending') {
        andConditions.push({ has_logged_in: { $ne: true } });
      }
    }

    if (andConditions.length > 0) {
      query.$and = andConditions;
    }

    const pageNum = parseInt(page || '1', 10);
    const limitNum = Math.min(parseInt(limit || '20', 10), 20);
    const skip = (pageNum - 1) * limitNum;
    
    let residentsQuery = User.find(query).select('-password -__v').sort({ createdAt: -1 });
    if (req.query.all !== 'true') {
      residentsQuery = residentsQuery.skip(skip).limit(limitNum);
    }
    const residents = await residentsQuery.lean();
    const total = await User.countDocuments(query);
    
    if (!page && !limit) return res.json(residents);
    
    return res.json({ residents, total, page: pageNum, totalPages: Math.ceil(total / limitNum) || 1 });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET api/users/members
// @desc    Get all member members (supports pagination)
// @access  Admin Private
router.get('/members', auth, async (req, res) => {
  try {
    if (!checkAccess(req.user, 'Committee Members')) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    const { page, limit, search, dateFrom, dateTo, status } = req.query;
    let query = { role: 'Member' };
    const andConditions = [];

    if (search && search.trim()) {
      const s = search.trim();
      andConditions.push({
        $or: [
          { name: { $regex: s, $options: 'i' } },
          { phone_number: { $regex: s, $options: 'i' } },
          { address: { $regex: s, $options: 'i' } },
          { designation: { $regex: s, $options: 'i' } },
          { member_id: { $regex: s, $options: 'i' } }
        ]
      });
    }

    if (dateFrom || dateTo) {
      const dateFilter = {};
      if (dateFrom) dateFilter.$gte = new Date(dateFrom);
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        dateFilter.$lte = end;
      }
      andConditions.push({ createdAt: dateFilter });
    }

    if (status && status !== 'ALL') {
      if (status === 'Active') {
        andConditions.push({ has_logged_in: true });
      } else if (status === 'Pending') {
        andConditions.push({ has_logged_in: { $ne: true } });
      }
    }

    if (andConditions.length > 0) {
      query.$and = andConditions;
    }

    const pageNum = parseInt(page || '1', 10);
    const limitNum = Math.min(parseInt(limit || '20', 10), 20);
    const skip = (pageNum - 1) * limitNum;
    
    let membersQuery = User.find(query).select('-password -__v').sort({ createdAt: -1 });
    if (req.query.all !== 'true') {
      membersQuery = membersQuery.skip(skip).limit(limitNum);
    }
    const members = await membersQuery.lean();
    const total = await User.countDocuments(query);
    
    if (!page && !limit) return res.json(members);
    
    return res.json({ members, total, page: pageNum, totalPages: Math.ceil(total / limitNum) || 1 });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST api/users/residents
// @desc    Create a new resident member
// @access  Admin Private
router.post('/residents', auth, async (req, res) => {
  let { name, phone_number, phase, address, relation, property_type, block, house_no } = req.body;

  try {
    if (!checkAccess(req.user, 'Residents')) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    if (!phone_number.startsWith('+')) {
      phone_number = `+91${phone_number}`;
    }

    let user = await User.findOne({ phone_number });
    if (user) {
      return res.status(400).json({ msg: 'User already exists' });
    }

    if (block) {
      block = String(block).replace(/^block\s*/i, '').trim();
    }
    if (house_no) {
      house_no = String(house_no).trim();
    }
    if (phase) {
      phase = String(phase).trim();
    }
    if (!address && house_no && block) {
      address = `House/Flat: ${house_no}, ${phase || 'Sushant Lok 2'}, Block ${block}, (${property_type || 'Owned'})`;
    }

    let existingActiveUser = await User.findOne({ phone_number, has_logged_in: true });
    let hasLoggedIn = !!existingActiveUser;

    user = new User({
      name,
      phone_number,
      role: 'Resident',
      phase,
      block,
      house_no,
      property_type,
      address,
      relation: relation || property_type,
      has_logged_in: hasLoggedIn
    });

    await user.save();
    
    const io = req.app.get('io');
    if (io) {
      io.emit('user_created', user);
    }

    res.status(201).json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST api/users/members
// @desc    Create a new member (Committee)
// @access  Admin Private
router.post('/members', auth, async (req, res) => {
  let { name, phone_number, designation, address, member_id, permissions, phase, block, house_no, property_type } = req.body;

  if (!member_id) {
    return res.status(400).json({ message: 'Member ID is required' });
  }

  try {
    if (!checkAccess(req.user, 'Committee Members')) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    if (!phone_number.startsWith('+')) {
      phone_number = `+91${phone_number}`;
    }

    if (!block && address) {
      const match = address.match(/Block\s+([A-H0-9]+)\b/i);
      if (match && match[1]) block = match[1].toUpperCase();
    }
    if (!house_no && address) {
      const hMatch =
        address.match(/House\/Flat:\s*([^,]+)/i) ||
        address.match(/(?:House|Flat|H\.No|Plot)\s*[:#\-]?\s*([A-Za-z0-9\/-]+)/i);
      if (hMatch && hMatch[1]) house_no = hMatch[1].trim();
    }
    if (!phase && address) {
      if (address.includes('Sushant Lok 3')) phase = 'Sushant Lok 3';
      else if (address.includes('Sushant Lok 2')) phase = 'Sushant Lok 2';
    }

    let user = await User.findOne({ phone_number });
    if (!user) {
      let existingActiveUser = await User.findOne({ phone_number, has_logged_in: true });
      let hasLoggedIn = !!existingActiveUser;

      user = new User({
        name,
        phone_number,
        role: 'Member',
        designation,
        address,
        member_id,
        permissions: permissions || [],
        has_logged_in: hasLoggedIn,
        phase: phase || undefined,
        block: block || undefined,
        house_no: house_no || undefined,
        property_type: property_type || 'Owned'
      });
    } else {
      user.name = name;
      user.role = 'Member';
      user.designation = designation;
      user.address = address;
      user.member_id = member_id;
      user.permissions = permissions || [];
      if (phase !== undefined) user.phase = phase;
      if (block !== undefined) user.block = block;
      if (house_no !== undefined) user.house_no = house_no;
      if (property_type !== undefined) user.property_type = property_type;
    }

    await user.save();
    
    const io = req.app.get('io');
    if (io) {
      io.emit('user_created', user);
    }

    res.status(201).json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST api/users/staff
// @desc    Create a new staff member
// @access  Admin Private
router.post('/staff', auth, async (req, res) => {
  let { name, phone_number, assigned_category, assigned_categories, phase, assigned_locations } = req.body;
  
  if (!assigned_categories && assigned_category) {
    assigned_categories = [assigned_category];
  }
  const legacy_category = assigned_categories && assigned_categories.length > 0 ? assigned_categories.join(', ') : '';

  try {
    if (!checkAccess(req.user, 'Staff Team')) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    if (!phone_number.startsWith('+')) {
      phone_number = `+91${phone_number}`;
    }

    if (Array.isArray(assigned_locations)) {
      assigned_locations = assigned_locations.map(loc => {
        let rawBlocks = Array.isArray(loc.blocks) ? loc.blocks : (loc.blocks ? [loc.blocks] : ['ALL']);
        let splitBlocks = [];
        for (const b of rawBlocks) {
          if (!b) continue;
          if (typeof b === 'string') {
            const parts = b.split(',').map(p => p.trim().replace(/^block\s*/i, '')).filter(Boolean);
            splitBlocks.push(...parts);
          } else {
            splitBlocks.push(b);
          }
        }
        if (splitBlocks.length === 0 || splitBlocks.some(b => typeof b === 'string' && (b.toUpperCase() === 'ALL' || b.toLowerCase().includes('all')))) {
          splitBlocks = ['ALL'];
        }
        return {
          phase: loc.phase || 'Universal',
          blocks: [...new Set(splitBlocks)]
        };
      });
    }

    let formattedPhase = phase;
    if (Array.isArray(assigned_locations) && assigned_locations.length > 0) {
      formattedPhase = assigned_locations.map(loc => {
        const blkStr = Array.isArray(loc.blocks) && loc.blocks.length > 0
          ? (loc.blocks.includes('ALL') || loc.blocks.includes('All Blocks') ? 'All Blocks' : `Block ${loc.blocks.join(', ')}`)
          : 'All Blocks';
        return `${loc.phase}: ${blkStr}`;
      }).join(' | ');
    }

    let user = await User.findOne({ phone_number, role: 'Staff' });
    if (user) {
      // Update existing staff profile with new locations and categories
      if (assigned_locations && assigned_locations.length > 0) {
        user.assigned_locations = assigned_locations;
      }
      if (assigned_categories && assigned_categories.length > 0) {
        user.assigned_categories = assigned_categories;
        user.assigned_category = legacy_category;
      }
      if (formattedPhase) {
        user.phase = formattedPhase;
      }
      if (name) {
        user.name = name;
      }
      await user.save();

      const io = req.app.get('io');
      if (io) {
        io.emit('staff_changed', { action: 'update', data: user });
      }

      return res.status(200).json(user);
    }

    let existingActiveUser = await User.findOne({ phone_number, has_logged_in: true });
    let hasLoggedIn = !!existingActiveUser;

    user = new User({
      name,
      phone_number,
      role: 'Staff',
      assigned_category: legacy_category,
      assigned_categories: assigned_categories || [],
      assigned_locations: assigned_locations || [],
      phase: formattedPhase,
      has_logged_in: hasLoggedIn
    });

    await user.save();
    
    const io = req.app.get('io');
    if (io) {
      io.emit('staff_changed', { action: 'create', data: user });
    }

    res.status(201).json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST api/users/paid-staff
// @desc    Create a new paid staff member
// @access  Admin Private
router.post('/paid-staff', auth, async (req, res) => {
  let { name, phone_number, assigned_category, assigned_categories } = req.body;

  if (!assigned_categories && assigned_category) {
    assigned_categories = [assigned_category];
  }
  const legacy_category = assigned_categories && assigned_categories.length > 0 ? assigned_categories.join(', ') : '';

  try {
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    if (!phone_number.startsWith('+')) {
      phone_number = `+91${phone_number}`;
    }

    let user = await User.findOne({ phone_number, role: 'PaidStaff', assigned_category: legacy_category });
    if (user) {
      return res.status(400).json({ msg: 'Paid staff already exists for this category' });
    }

    let existingActiveUser = await User.findOne({ phone_number, has_logged_in: true });
    let hasLoggedIn = !!existingActiveUser;

    user = new User({
      name,
      phone_number,
      role: 'PaidStaff',
      assigned_category: legacy_category,
      assigned_categories: assigned_categories || [],
      has_logged_in: hasLoggedIn
    });

    await user.save();
    
    const io = req.app.get('io');
    if (io) {
      io.emit('staff_changed', { action: 'create', data: user });
    }

    res.status(201).json({
      id: user.id,
      name: user.name,
      phone_number: user.phone_number,
      role: user.role,
      assigned_category: user.assigned_category
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   DELETE api/users/:id
// @desc    Delete a user
// @access  Admin Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const isSelf = req.user.id === req.params.id;
    // For DELETE, allow Admin, SubAdmin, or self-deletion
    if (req.user.role !== 'Admin' && req.user.role !== 'SubAdmin' && !isSelf) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (isSelf && user.role === 'Admin') {
      return res.status(403).json({ message: 'Admin account cannot be self-deleted from the app' });
    }

    if (req.user.role === 'SubAdmin') {
      if (user.role === 'Admin' || user.role === 'SubAdmin' || user.role === 'PaidStaff') {
        return res.status(403).json({ message: 'Sub-Admins cannot delete this user type' });
      }
      if (user.role === 'Resident' && !checkAccess(req.user, 'Residents')) {
        return res.status(403).json({ message: 'Sub-Admins cannot delete Residents' });
      }
      if (user.role === 'Staff' && !checkAccess(req.user, 'Staff Team')) {
        return res.status(403).json({ message: 'Sub-Admins cannot delete Staff' });
      }
      if (user.role === 'Member' && !checkAccess(req.user, 'Committee Members')) {
        return res.status(403).json({ message: 'Sub-Admins cannot delete Committee Members' });
      }
    }

    await User.findByIdAndDelete(req.params.id);
    
    // Emit live event for remote logout and realtime update
    const io = req.app.get('io');
    if (io) {
      io.emit('user_deleted', { id: req.params.id });
      if (user.role === 'Staff' || user.role === 'PaidStaff') {
        io.emit('staff_changed', { action: 'delete', id: req.params.id });
      }
    }
    
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   PUT api/users/push-token
// @desc    Update user expo push token
// @access  Private
router.put('/push-token', auth, async (req, res) => {
  try {
    const { expoPushToken } = req.body;
    if (!expoPushToken) {
      return res.status(400).json({ message: 'Push token is required' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.phone_number) {
      await User.updateMany({ phone_number: user.phone_number }, { expoPushToken });
    } else {
      user.expoPushToken = expoPushToken;
      await user.save();
    }

    res.json({ message: 'Push token updated successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   PUT api/users/clear-badge
// @desc    Reset unread notifications badge
// @access  Private
router.put('/clear-badge', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.phone_number) {
      await User.updateMany({ phone_number: user.phone_number }, { unread_notifications: 0 });
    } else {
      user.unread_notifications = 0;
      await user.save();
    }

    res.json({ message: 'Badge cleared successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET api/users/profile/family
// @desc    Get user's family members
// @access  Private
router.get('/profile/family', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user.family_members || []);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST api/users/profile/family
// @desc    Add a single family member
// @access  Private
router.post('/profile/family', auth, async (req, res) => {
  try {
    const { name, relation, phone_number } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Name is required' });
    }
    if (!relation || !relation.trim()) {
      return res.status(400).json({ message: 'Relation is required' });
    }
    if (!phone_number) {
      return res.status(400).json({ message: 'Phone number is required' });
    }

    const cleanPhone = phone_number.replace(/^\+91/, '').trim();
    if (cleanPhone.length !== 10) {
      return res.status(400).json({ message: 'Please enter a valid 10-digit phone number' });
    }
    const formattedPhone = `+91${cleanPhone}`;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if user is trying to add their own phone number
    if (user.phone_number && user.phone_number.replace(/^\+91/, '').trim() === cleanPhone) {
      return res.status(400).json({ message: 'Cannot add your own phone number as a family member' });
    }

    // Check if phone number already exists in this user's family members
    const alreadyExists = (user.family_members || []).some(m => 
      (m.phone_number || '').replace(/^\+91/, '').trim() === cleanPhone
    );
    if (alreadyExists) {
      return res.status(400).json({ message: 'This phone number is already added in your family members' });
    }

    if (!user.family_members) user.family_members = [];
    user.family_members.push({
      name: name.trim(),
      relation: relation.trim(),
      phone_number: formattedPhone
    });

    await user.save();

    const io = req.app.get('io');
    if (io) {
      io.emit('user_updated', { userId: user._id, role: user.role, name: user.name });
    }

    res.status(201).json({ 
      message: 'Family member added successfully', 
      family_members: user.family_members 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   PUT api/users/profile/family/:memberId
// @desc    Update a specific family member
// @access  Private
router.put('/profile/family/:memberId', auth, async (req, res) => {
  try {
    const { name, relation, phone_number } = req.body;
    const { memberId } = req.params;

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const member = user.family_members.id(memberId);
    if (!member) {
      return res.status(404).json({ message: 'Family member not found' });
    }

    if (name !== undefined) member.name = name.trim();
    if (relation !== undefined) member.relation = relation.trim();
    if (phone_number !== undefined) {
      const cleanPhone = phone_number.replace(/^\+91/, '').trim();
      if (cleanPhone.length !== 10) {
        return res.status(400).json({ message: 'Please enter a valid 10-digit phone number' });
      }
      if (user.phone_number && user.phone_number.replace(/^\+91/, '').trim() === cleanPhone) {
        return res.status(400).json({ message: 'Cannot add your own phone number as a family member' });
      }
      const duplicatePhone = user.family_members.some(m => 
        m._id.toString() !== memberId && (m.phone_number || '').replace(/^\+91/, '').trim() === cleanPhone
      );
      if (duplicatePhone) {
        return res.status(400).json({ message: 'Another family member already has this phone number' });
      }
      member.phone_number = `+91${cleanPhone}`;
    }

    await user.save();

    const io = req.app.get('io');
    if (io) {
      io.emit('user_updated', { userId: user._id, role: user.role, name: user.name });
    }

    res.json({ message: 'Family member updated successfully', family_members: user.family_members });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   DELETE api/users/profile/family/:memberId
// @desc    Remove a family member
// @access  Private
router.delete('/profile/family/:memberId', auth, async (req, res) => {
  try {
    const { memberId } = req.params;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.family_members = (user.family_members || []).filter(m => m._id.toString() !== memberId);
    await user.save();

    const io = req.app.get('io');
    if (io) {
      io.emit('user_updated', { userId: user._id, role: user.role, name: user.name });
    }

    res.json({ message: 'Family member removed successfully', family_members: user.family_members });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   PUT api/users/profile/family
// @desc    Update user's whole family members array
// @access  Private
router.put('/profile/family', auth, async (req, res) => {
  try {
    const { family_members } = req.body;
    
    if (!Array.isArray(family_members)) {
      return res.status(400).json({ message: 'family_members must be an array' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Ensure phone numbers have +91
    user.family_members = family_members.map(m => {
      let phone = m.phone_number || '';
      if (phone && !phone.startsWith('+91')) {
        phone = `+91${phone.replace(/^\+91/, '').trim()}`;
      }
      return {
        ...m,
        phone_number: phone
      };
    });

    await user.save();

    const io = req.app.get('io');
    if (io) {
      io.emit('user_updated', { userId: user._id, role: user.role, name: user.name });
    }

    res.json({ message: 'Family members updated successfully', family_members: user.family_members });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   PUT api/users/:id
// @desc    Update a User (Staff, Member, Resident)
// @access  Admin Private
router.put('/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'Admin') {
      // Allow SubAdmins with proper permissions? For now, keep it simple or check permissions
      // If we want SubAdmins to edit users, we should check `checkAccess`
      const targetUser = await User.findById(req.params.id);
      if (!targetUser) return res.status(404).json({ message: 'User not found' });
      
      let hasAccess = false;
      if (targetUser.role === 'Staff' && checkAccess(req.user, 'Staff Team')) hasAccess = true;
      if (targetUser.role === 'Member' && checkAccess(req.user, 'Committee Members')) hasAccess = true;
      if (targetUser.role === 'Resident' && checkAccess(req.user, 'Residents')) hasAccess = true;
      
      if (!hasAccess) return res.status(403).json({ message: 'Unauthorized' });
    }

    const { name, phone_number, designation, assigned_category, assigned_categories, phase, block, house_no, property_type, permissions, member_id, address, assigned_locations } = req.body;
    let user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Only allow specific fields to be updated based on role to prevent escalation
    if (name !== undefined) user.name = name;
    if (phone_number !== undefined) user.phone_number = phone_number;
    if (address !== undefined) user.address = address;
    
    if (user.role === 'Member' || user.role === 'Resident') {
      if (phase !== undefined) user.phase = phase;
      if (block !== undefined) user.block = block;
      if (house_no !== undefined) user.house_no = house_no;
      if (property_type !== undefined) user.property_type = property_type;
    }

    if (user.role === 'Member') {
      if (designation !== undefined) user.designation = designation;
      if (permissions !== undefined) user.permissions = permissions;
      if (member_id !== undefined) user.member_id = member_id;
    }
    
    if (user.role === 'Staff' || user.role === 'PaidStaff') {
      let finalAssignedCategories = assigned_categories;
      if (!finalAssignedCategories && assigned_category !== undefined) {
        finalAssignedCategories = [assigned_category];
      }
      if (finalAssignedCategories) {
        user.assigned_categories = finalAssignedCategories;
        user.assigned_category = finalAssignedCategories.join(', ');
      }
      if (assigned_locations !== undefined) {
        if (Array.isArray(assigned_locations)) {
          assigned_locations = assigned_locations.map(loc => {
            let rawBlocks = Array.isArray(loc.blocks) ? loc.blocks : (loc.blocks ? [loc.blocks] : ['ALL']);
            let splitBlocks = [];
            for (const b of rawBlocks) {
              if (!b) continue;
              if (typeof b === 'string') {
                const parts = b.split(',').map(p => p.trim().replace(/^block\s*/i, '')).filter(Boolean);
                splitBlocks.push(...parts);
              } else {
                splitBlocks.push(b);
              }
            }
            if (splitBlocks.length === 0 || splitBlocks.some(b => typeof b === 'string' && (b.toUpperCase() === 'ALL' || b.toLowerCase().includes('all')))) {
              splitBlocks = ['ALL'];
            }
            return {
              phase: loc.phase || 'Universal',
              blocks: [...new Set(splitBlocks)]
            };
          });
        }
        user.assigned_locations = assigned_locations;
        if (Array.isArray(assigned_locations) && assigned_locations.length > 0) {
          user.phase = assigned_locations.map(loc => {
            const blkStr = Array.isArray(loc.blocks) && loc.blocks.length > 0
              ? (loc.blocks.includes('ALL') || loc.blocks.includes('All Blocks') ? 'All Blocks' : `Block ${loc.blocks.join(', ')}`)
              : 'All Blocks';
            return `${loc.phase}: ${blkStr}`;
          }).join(' | ');
        }
      } else if (phase !== undefined) {
        user.phase = phase;
      }
    }

    await user.save();
    
    // Emit real-time update
    const io = req.app.get('io');
    if (io) {
      io.emit('user_updated', { userId: user._id, role: user.role, permissions: user.permissions, name: user.name, designation: user.designation });
      if (user.role === 'Staff') {
        io.emit('staff_changed', { action: 'update', data: user });
      }
    }

    res.json({ message: 'User updated successfully', user });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
