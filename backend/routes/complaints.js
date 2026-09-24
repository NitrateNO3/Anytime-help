const express = require('express');
const router = express.Router();
const Complaint = require('../models/Complaint');
const User = require('../models/User');
const auth = require('../middleware/auth');

// POST /api/complaints
router.post('/', auth, async (req, res) => {
  try {
    const { title, description, location, address, category, department, priority, before_image } = req.body;
    
    // Fetch user to get their phase
    const user = await User.findById(req.user.id);
    const userPhase = user ? user.phase : null;

    // Check for existing identical or similar complaint
    // We consider it a duplicate if it has the same department, category, location, and is not resolved
    const existingComplaint = await Complaint.findOne({
      department,
      category,
      location: { $regex: new RegExp('^' + location.trim() + '$', 'i') },
      status: { $in: ['PENDING', 'IN_PROGRESS'] }
    });

    if (existingComplaint) {
      // If it exists, and the user hasn't already upvoted/submitted it, add them
      if (!existingComplaint.upvotes.includes(req.user.id) && existingComplaint.user.toString() !== req.user.id) {
        existingComplaint.upvotes.push(req.user.id);
        await existingComplaint.save();
        
        const io = req.app.get('io');
        if (io) {
          io.emit('complaint_changed', { action: 'update', data: existingComplaint });
        }
        
        return res.status(409).json({ 
          error_code: 'DUPLICATE_GROUPED',
          msg: 'This issue is already reported by someone else. Our team is working on it.'
        });
      }
      
      // They are the creator or already upvoted
      return res.status(409).json({
        error_code: 'DUPLICATE_EXISTS',
        msg: 'You have already reported this issue.'
      });
    }

    // Otherwise, create a new complaint
    const complaint = new Complaint({
      title,
      description,
      location,
      address,
      category,
      department,
      priority,
      user: req.user.id,
      before_image: before_image || '',
      phase: userPhase
    });
    const createdComplaint = await complaint.save();
    
    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.emit('complaint_changed', { action: 'create', data: createdComplaint });
    }

    try {
      // Find Admin and Staff to notify
      const adminsAndStaff = await User.find({
        $or: [
          { role: 'Admin' },
          { role: 'SubAdmin', permissions: 'Complaints' },
          { role: 'Staff', $or: [{ phase: userPhase }, { phase: 'Universal' }, { phase: 'All' }, { phase: { $exists: false } }] }
        ],
        expoPushToken: { $exists: true, $ne: '' }
      }).select('expoPushToken assigned_category assigned_categories role');

      const tokens = adminsAndStaff
        .filter(u => {
          if (u.role === 'Staff') {
            const cats = u.assigned_categories && u.assigned_categories.length > 0 ? u.assigned_categories : (u.assigned_category ? [u.assigned_category] : []);
            if (cats.length > 0 && !cats.includes('All') && !cats.includes(category)) {
              return false;
            }
          }
          return true;
        })
        .map(u => u.expoPushToken);

      if (tokens.length > 0) {
        const { sendPushNotifications } = require('../utils/push');
        sendPushNotifications(tokens, '🚨 New Complaint: ' + category, title || 'A new issue was reported.', { type: 'complaint', id: createdComplaint._id });
      }
    } catch (pushErr) {
      console.error('Push notification error:', pushErr.message);
    }

    res.status(201).json(createdComplaint);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// GET /api/complaints
router.get('/', auth, async (req, res) => {
  try {
    const { departmentId, page, limit, search, category, status, phase, priority, sortOrder } = req.query;
    let query = {};
    if (departmentId) {
      query.department = departmentId;
    }

    if (category && category !== 'ALL') {
      query.category = category;
    }

    if (status && status !== 'ALL') {
      if (status === 'DONE' || status === 'RESOLVED') {
        query.status = { $in: ['DONE', 'RESOLVED'] };
      } else {
        query.status = status;
      }
    }

    if (phase && phase !== 'ALL') {
      query.phase = { $regex: new RegExp(phase.trim(), 'i') };
    }

    if (priority && priority !== 'ALL') {
      query.priority = priority;
    }

    if (search && search.trim()) {
      const s = search.trim();
      const orConditions = [
        { title: { $regex: s, $options: 'i' } },
        { description: { $regex: s, $options: 'i' } },
        { location: { $regex: s, $options: 'i' } },
        { address: { $regex: s, $options: 'i' } }
      ];

      try {
        const matchingUsers = await User.find({ 
          $or: [
            { name: { $regex: s, $options: 'i' } },
            { phone: { $regex: s, $options: 'i' } }
          ]
        }).select('_id');
        if (matchingUsers.length > 0) {
          orConditions.push({ user: { $in: matchingUsers.map(u => u._id) } });
        }
      } catch (e) {
        // Continue if user query fails
      }

      query.$or = orConditions;
    }

    // If Resident, only show their own complaints (duplicates won't show in their list)
    // If Member passes mine=true, only show their own complaints
    if (req.user.role === 'Resident' || req.query.mine === 'true') {
      query.user = req.user.id; 
    } else if (req.user.role === 'Staff') {
      // Staff only sees complaints for their assigned category and phase
      const user = await User.findById(req.user.id);
      const cats = req.user.assigned_categories && req.user.assigned_categories.length > 0 ? req.user.assigned_categories : (req.user.assigned_category ? [req.user.assigned_category] : []);
      if (cats.length > 0 && !cats.includes('All')) {
        query.category = { $in: cats };
      }
      if (user && user.phase && user.phase !== 'All' && user.phase !== 'Universal' && user.phase !== 'All Groups' && user.phase !== 'All Phases') {
        if (user.phase === 'Sushant Lok 2 - C,D,E' || user.phase === 'Sushant Lok 2 Option 1') {
          query.$or = [{ phase: 'Sushant Lok 2 - C,D,E' }, { phase: 'Sushant Lok 2 Option 1' }];
        } else if (user.phase === 'Sushant Lok 2 - F,G' || user.phase === 'Sushant Lok 2 Option 2') {
          query.$or = [{ phase: 'Sushant Lok 2 - F,G' }, { phase: 'Sushant Lok 2 Option 2' }];
        } else {
          query.phase = user.phase;
        }
      }
    }
    
    const sortDirection = sortOrder === 'asc' ? 1 : -1;
    let complaintsQuery = Complaint.find(query)
      .populate('user', 'name phone_number address')
      .populate('assigned_staff', 'name phone_number address')
      .sort({ created_at: sortDirection });
    
    if (page && limit) {
      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);
      const startIndex = (pageNum - 1) * limitNum;
      
      complaintsQuery = complaintsQuery.skip(startIndex).limit(limitNum);
      const complaints = await complaintsQuery;
      const total = await Complaint.countDocuments(query);

      // KPI stats: compute across non-status filters so status counts remain accurate
      let statsQuery = { ...query };
      delete statsQuery.status;
      const pending = await Complaint.countDocuments({ ...statsQuery, status: 'PENDING' });
      const inProgress = await Complaint.countDocuments({ ...statsQuery, status: 'IN_PROGRESS' });
      const resolved = await Complaint.countDocuments({ ...statsQuery, status: { $in: ['RESOLVED', 'DONE'] } });
      const hasMore = startIndex + complaints.length < total;
      
      return res.json({ complaints, total, hasMore, stats: { pending, inProgress, resolved } });
    }
    
    const complaints = await complaintsQuery;
    res.json(complaints);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/complaints/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id)
      .populate('user', 'name phone_number address')
      .populate('assigned_staff', 'name phone_number address');
    if (!complaint) {
      return res.status(404).json({ message: 'Complaint not found' });
    }
    res.json(complaint);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/complaints/:id/reply
router.post('/:id/reply', auth, async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) return res.status(404).json({ message: 'Complaint not found' });
    
    let role = req.user.role;
    if (role === 'Admin' || role === 'SubAdmin') {
      role = 'Admin';
    } else if (role === 'Resident' || role === 'Member') {
      role = 'Resident';
    }
    
    complaint.replies.push({
      user: req.user.id,
      text: req.body.text,
      role: role
    });
    
    await complaint.save();
    
    const io = req.app.get('io');
    if (io) {
      io.emit('complaint_changed', { action: 'reply', data: complaint });
    }
    
    res.json(complaint);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PATCH /api/complaints/:id
router.patch('/:id', auth, async (req, res) => {
  try {
    const { status, after_image } = req.body;
    const complaint = await Complaint.findById(req.params.id);
    
    if (!complaint) {
      return res.status(404).json({ message: 'Complaint not found' });
    }

    if (status) {
      complaint.status = status;
      // If staff updates the status, mark them as the assigned staff
      if (req.user.role === 'Staff' || req.user.role === 'PaidStaff') {
        complaint.assigned_staff = req.user.id;
      }
    }
    if (after_image) complaint.after_image = after_image;

    const updatedComplaint = await complaint.save();

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.emit('complaint_changed', { action: 'update', data: updatedComplaint });
    }

    res.json(updatedComplaint);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// DELETE /api/complaints/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ message: 'Complaint not found' });
    }
    
    // Check authorization: Admin can delete any, Resident can delete their own
    if (req.user.role !== 'Admin' && complaint.user.toString() !== req.user.id) {
      // If they are not the creator but they are in upvotes, just remove them from upvotes
      if (complaint.upvotes.includes(req.user.id)) {
        complaint.upvotes = complaint.upvotes.filter(id => id.toString() !== req.user.id);
        await complaint.save();
        
        const io = req.app.get('io');
        if (io) {
          io.emit('complaint_changed', { action: 'update', data: complaint });
        }
        return res.json({ message: 'Removed your vote from the complaint' });
      }

      return res.status(403).json({ message: 'Unauthorized: You can only delete your own complaints' });
    }

    await complaint.deleteOne();

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.emit('complaint_changed', { action: 'delete', id: req.params.id });
    }

    res.json({ message: 'Complaint deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
