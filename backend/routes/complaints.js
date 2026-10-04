const express = require('express');
const router = express.Router();
const Complaint = require('../models/Complaint');
const User = require('../models/User');
const auth = require('../middleware/auth');
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
});

// POST /api/complaints
router.post('/', auth, async (req, res) => {
  try {
    const { title, description, location, address, category, department, priority, before_image, subCategory } = req.body;
    
    // If subCategory is provided, use it as the title so it displays on the card
    const finalTitle = subCategory || title;
    if (!before_image) {
      return res.status(400).json({ msg: 'A photo of the issue is mandatory.' });
    }

    // Fetch user to get their phase
    const user = await User.findById(req.user.id);
    const userPhase = user ? user.phase : null;

    // Check for existing identical or similar complaint
    // We consider it a duplicate if it has the same department, category, location, and address (house number), and is not resolved
    let duplicateQuery = {
      department,
      category,
      location: { $regex: new RegExp('^' + location.trim() + '$', 'i') },
      status: { $in: ['PENDING', 'IN_PROGRESS'] }
    };
    
    if (address && address.trim()) {
      duplicateQuery.address = { $regex: new RegExp('^' + address.trim() + '$', 'i') };
    } else {
      duplicateQuery.address = { $in: [null, '', undefined] };
    }

    const existingComplaint = await Complaint.findOne(duplicateQuery);

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
    let imageUrl = '';
    if (before_image && before_image.startsWith('data:image')) {
      try {
        const result = await cloudinary.uploader.upload(before_image, {
          folder: 'anytime_help/complaints',
          transformation: [{ quality: 'auto', fetch_format: 'auto', width: 800, crop: 'limit' }]
        });
        imageUrl = result.secure_url;
      } catch (err) {
        console.error('Cloudinary upload error:', err);
        imageUrl = before_image; // fallback to base64 if it fails
      }
    } else if (before_image) {
      imageUrl = before_image;
    }

    const complaint = new Complaint({
      title: finalTitle,
      description,
      location,
      address,
      category,
      department,
      priority,
      user: req.user.id,
      before_image: imageUrl,
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
      // We need to match staff based on exact phase (group + block) or legacy options
      let phaseConditions = [{ phase: 'Universal' }, { phase: 'All' }, { phase: { $exists: false } }];
      if (userPhase) {
        phaseConditions.push({ phase: userPhase });
        // Handle case where resident phase is Sushant Lok 2 - C,D,E but staff phase is Sushant Lok 2
        // If staff is assigned to the parent group, they should probably get it, or if they are assigned to exact block
        const parentGroupMatch = userPhase.split(' - ')[0];
        phaseConditions.push({ phase: parentGroupMatch });
        
        if (userPhase === 'Sushant Lok 2 - C,D,E') phaseConditions.push({ phase: 'Sushant Lok 2 Option 1' });
        if (userPhase === 'Sushant Lok 2 - F,G') phaseConditions.push({ phase: 'Sushant Lok 2 Option 2' });
        if (userPhase === 'Sushant Lok 2 Option 1') phaseConditions.push({ phase: 'Sushant Lok 2 - C,D,E' });
        if (userPhase === 'Sushant Lok 2 Option 2') phaseConditions.push({ phase: 'Sushant Lok 2 - F,G' });
      }

      const adminsAndStaff = await User.find({
        $or: [
          { role: 'Admin' },
          { role: 'SubAdmin', permissions: 'Complaints' },
          { role: 'Staff', $or: phaseConditions }
        ],
        expoPushToken: { $exists: true, $ne: '' }
      }).select('expoPushToken assigned_category assigned_categories role phase').lean();

      const filteredUsers = adminsAndStaff.filter(u => {
        if (u.role === 'Staff') {
          const cats = u.assigned_categories && u.assigned_categories.length > 0 ? u.assigned_categories : (u.assigned_category ? [u.assigned_category] : []);
          if (cats.length > 0 && !cats.includes('All') && !cats.includes(category) && !cats.includes(finalTitle)) {
            return false;
          }
        }
        return true;
      });

      if (filteredUsers.length > 0) {
        const userIds = filteredUsers.map(u => u._id);
        await User.updateMany({ _id: { $in: userIds } }, { $inc: { unread_notifications: 1 } });
        
        // Refetch to get updated counts
        const updatedUsers = await User.find({ _id: { $in: userIds } }).select('expoPushToken unread_notifications').lean();
        const tokens = updatedUsers.map(u => ({
          to: u.expoPushToken,
          badge: u.unread_notifications
        }));

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
      const catRegex = new RegExp(`^\\s*${category.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\s*$`, 'i');
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { category: catRegex },
          { title: catRegex }
        ]
      });
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
        }).select('_id').lean();
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
      const userCondition = { $or: [{ user: req.user.id }, { upvotes: req.user.id }] };
      if (query.$or) {
        query.$and = [userCondition, { $or: query.$or }];
        delete query.$or;
      } else {
        query.$or = userCondition.$or;
      }
    } else if (req.user.role === 'Staff') {
      // Staff only sees complaints for their assigned category and phase, across ALL their accounts
      const requestedCategory = query.category;
      delete query.category;
      delete query.phase;
      if (query.$and) {
        // Just keep the existing $and
      }

      // req.user is already the full User object from auth middleware
      const user = req.user;
      
      // Find all staff accounts with the same phone number (one person may manage multiple zones)
      let allStaffAccounts = [];
      if (user && user.phone_number) {
        allStaffAccounts = await User.find({ phone_number: user.phone_number, role: 'Staff' });
      } else if (user) {
        // Fallback: no phone number — just use this single account
        allStaffAccounts = [user];
      }
      
      if (allStaffAccounts.length > 0) {
        const staffOrConditions = [];
            for (const account of allStaffAccounts) {
          let rawCats = account.assigned_categories && account.assigned_categories.length > 0 ? account.assigned_categories : (account.assigned_category ? [account.assigned_category] : []);
          let cats = [];
          for (const rc of rawCats) {
            if (!rc) continue;
            if (typeof rc === 'string' && rc.includes(',')) {
              cats.push(...rc.split(',').map(s => s.trim()));
            } else if (typeof rc === 'string') {
              cats.push(rc.trim());
            }
          }
          
          let accountCatCondition = null;
          if (requestedCategory && requestedCategory !== 'ALL') {
            const reqCatStr = String(requestedCategory);
            const hasAccess = cats.length === 0 || cats.includes('All') || cats.some(c => c.toLowerCase() === reqCatStr.toLowerCase());
            if (!hasAccess) continue; // Staff doesn't have access to this requested category for this account
            
            const regex = new RegExp(`^\\s*${reqCatStr.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\s*$`, 'i');
            accountCatCondition = {
              $or: [
                { category: regex },
                { title: regex }
              ]
            };
          } else if (cats.length > 0 && !cats.includes('All')) {
            const regexes = cats.map(c => new RegExp(`^\\s*${c.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\s*$`, 'i'));
            accountCatCondition = {
              $or: [
                { category: { $in: regexes } },
                { title: { $in: regexes } }
              ]
            };
          }
          
          if (account.phase && account.phase !== 'All' && account.phase !== 'Universal' && account.phase !== 'All Groups' && account.phase !== 'All Phases') {
            let phaseCondition;
            if (account.phase.includes('Sushant Lok 2 - C,D,E') || account.phase.includes('Sushant Lok 2 Option 1')) {
              phaseCondition = { $in: [
                new RegExp('Sushant Lok 2 - C,D,E', 'i'), 
                new RegExp('Sushant Lok 2 Option 1', 'i')
              ]};
            } else if (account.phase.includes('Sushant Lok 2 - F,G') || account.phase.includes('Sushant Lok 2 Option 2')) {
              phaseCondition = { $in: [
                new RegExp('Sushant Lok 2 - F,G', 'i'), 
                new RegExp('Sushant Lok 2 Option 2', 'i')
              ]};
            } else if (account.phase.includes('Sushant Lok 3')) {
              phaseCondition = new RegExp('Sushant Lok 3', 'i');
            } else {
              let cleanPhase = account.phase.replace(/[-:,].*$/, '').trim();
              phaseCondition = new RegExp(cleanPhase.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&'), 'i');
            }
            
            if (accountCatCondition) {
              staffOrConditions.push({ ...accountCatCondition, phase: phaseCondition });
              staffOrConditions.push({ ...accountCatCondition, phase: { $in: [null, '', undefined] } });
            } else {
              staffOrConditions.push({ phase: phaseCondition });
              staffOrConditions.push({ phase: { $in: [null, '', undefined] } });
            }
          } else {
            if (accountCatCondition) {
              staffOrConditions.push(accountCatCondition);
            } else {
              // No phase restriction and no category restriction (has 'All' access)
              staffOrConditions.push({});
            }
          }
        }
        
        if (staffOrConditions.length > 0) {
          // Add the staff conditions to the query
          query.$and = query.$and || [];
          query.$and.push({ $or: staffOrConditions });
        } else {
          // If they requested a category they don't have access to across any account, return nothing
          query._id = null;
        }
      }
    }
    
    const sortDirection = sortOrder === 'asc' ? 1 : -1;
    let complaintsQuery = Complaint.find(query)
      .select('-__v')
      .populate('user', 'name phone_number address room_number phase relation')
      .populate('assigned_staff', 'name phone_number address room_number phase')
      .populate('replies.user', 'name role')
      .sort({ created_at: sortDirection })
      .lean();
    
    const pageNum = parseInt(page || '1', 10);
    const limitNum = Math.min(parseInt(limit || '15', 10), 20); // Enforce max limit of 20
    const startIndex = (pageNum - 1) * limitNum;
    
    if (req.query.all !== 'true') {
      complaintsQuery = complaintsQuery.skip(startIndex).limit(limitNum);
    }
    
    let complaints;
    let total = 0, pending = 0, inProgress = 0, resolved = 0;
    
    // Check if we can skip heavy count queries (e.g., for staff app)
    const skipStats = req.query.stats === 'false' || (!page && !limit && !sortOrder);
    
    if (skipStats) {
      complaints = await complaintsQuery;
    } else {
      [complaints, total, pending, inProgress, resolved] = await Promise.all([
        complaintsQuery,
        Complaint.countDocuments(query),
        Complaint.countDocuments({ ...query, status: 'PENDING' }),
        Complaint.countDocuments({ ...query, status: 'IN_PROGRESS' }),
        Complaint.countDocuments({ ...query, status: { $in: ['RESOLVED', 'DONE'] } })
      ]);
    }

    let processedComplaints = complaints.map(c => {
      let bImage = c.before_image;
      let aImage = c.after_image;
      if (bImage && bImage.includes('cloudinary.com') && !bImage.includes('upload/f_auto,q_auto')) {
        bImage = bImage.replace('/upload/', '/upload/f_auto,q_auto,w_800,c_limit/');
      }
      if (aImage && aImage.includes('cloudinary.com') && !aImage.includes('upload/f_auto,q_auto')) {
        aImage = aImage.replace('/upload/', '/upload/f_auto,q_auto,w_800,c_limit/');
      }
      return { ...c, before_image: bImage, after_image: aImage };
    });

    if (req.query.stats === 'false' || (!page && !limit && !sortOrder)) {
      // Fallback for apps not needing stats/pagination info
      return res.json(processedComplaints);
    }

    const hasMore = startIndex + complaints.length < total;
    
    return res.json({ complaints: processedComplaints, total, hasMore, stats: { pending, inProgress, resolved } });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/complaints/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id)
      .select('-__v')
      .populate('user', 'name phone_number address room_number phase relation')
      .populate('assigned_staff', 'name phone_number address room_number phase')
      .populate('replies.user', 'name role')
      .lean();
    if (!complaint) {
      return res.status(404).json({ message: 'Complaint not found' });
    }
    
    let bImage = complaint.before_image;
    let aImage = complaint.after_image;
    if (bImage && bImage.includes('cloudinary.com') && !bImage.includes('upload/f_auto,q_auto')) {
      complaint.before_image = bImage.replace('/upload/', '/upload/f_auto,q_auto,w_800,c_limit/');
    }
    if (aImage && aImage.includes('cloudinary.com') && !aImage.includes('upload/f_auto,q_auto')) {
      complaint.after_image = aImage.replace('/upload/', '/upload/f_auto,q_auto,w_800,c_limit/');
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
    
    const populatedComplaint = await Complaint.findById(complaint._id)
      .populate('user', 'name phone_number phase room_number role')
      .populate('assigned_staff', 'name role')
      .populate('replies.user', 'name role');
    
    const io = req.app.get('io');
    if (io) {
      io.emit('complaint_changed', { action: 'reply', data: populatedComplaint });
    }
    
    // Push Notification Logic
    try {
      const { sendPushNotifications } = require('../utils/push');
      let tokensToNotify = [];
      let notificationTitle = '';
      let notificationBody = req.body.text;
      
      // Fetch all relevant admins and staff for this category/phase
      const userPhase = complaint.phase;
      const category = complaint.category;
      
      const adminsAndStaff = await User.find({
        $or: [
          { role: 'Admin' },
          { role: 'SubAdmin', permissions: 'Complaints' },
          { role: 'Staff', $or: [{ phase: userPhase }, { phase: 'Universal' }, { phase: 'All' }, { phase: { $exists: false } }] }
        ],
        expoPushToken: { $exists: true, $ne: '' }
      }).select('_id expoPushToken assigned_category assigned_categories role').lean();

      const staffAdminIds = adminsAndStaff
        .filter(u => {
          if (u.role === 'Staff') {
            const cats = u.assigned_categories && u.assigned_categories.length > 0 ? u.assigned_categories : (u.assigned_category ? [u.assigned_category] : []);
            if (cats.length > 0 && !cats.includes('All') && !cats.includes(category)) {
              return false;
            }
          }
          return u._id.toString() !== req.user.id; // Exclude sender
        })
        .map(u => u._id);
        
      let userIdsToNotify = [...staffAdminIds];
      
      // Also notify resident if the sender is not the resident
      if (req.user.id !== complaint.user.toString()) {
        userIdsToNotify.push(complaint.user);
      }
      
      notificationTitle = role === 'Resident' ? `New Reply on ${complaint.title}` : `Update on ${complaint.title}`;

      if (userIdsToNotify.length > 0) {
        await User.updateMany({ _id: { $in: userIdsToNotify } }, { $inc: { unread_notifications: 1 } });
        const updatedUsers = await User.find({ _id: { $in: userIdsToNotify } }).select('expoPushToken unread_notifications').lean();
        
        const tokensObjects = [];
        for (const u of updatedUsers) {
          if (u.expoPushToken) {
            tokensObjects.push({ to: u.expoPushToken, badge: u.unread_notifications });
          }
        }
        
        if (tokensObjects.length > 0) {
          sendPushNotifications(tokensObjects, notificationTitle, notificationBody, { type: 'complaint', id: complaint._id });
        }
      }
    } catch (pushErr) {
      console.error('Push notification error on reply:', pushErr.message);
    }
    
    res.json(populatedComplaint);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// DELETE /api/complaints/:id/reply/:replyId
router.delete('/:id/reply/:replyId', auth, async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) return res.status(404).json({ message: 'Complaint not found' });
    
    const reply = complaint.replies.id(req.params.replyId);
    if (!reply) return res.status(404).json({ message: 'Reply not found' });
    
    if (req.user.role !== 'Admin' && req.user.role !== 'SubAdmin' && reply.user.toString() !== req.user.id) {
       return res.status(403).json({ message: 'Unauthorized to delete this reply' });
    }
    
    reply.deleteOne();
    await complaint.save();
    
    const populatedComplaint = await Complaint.findById(complaint._id)
      .populate('user', 'name phone_number phase room_number role')
      .populate('assigned_staff', 'name role')
      .populate('replies.user', 'name role');
    
    const io = req.app.get('io');
    if (io) {
      io.emit('complaint_changed', { action: 'reply_delete', data: populatedComplaint });
    }
    
    res.json(populatedComplaint);
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
    if (after_image) {
      if (after_image.startsWith('data:image')) {
        try {
          const result = await cloudinary.uploader.upload(after_image, {
            folder: 'anytime_help/complaints_resolved',
            transformation: [{ quality: 'auto', fetch_format: 'auto', width: 800, crop: 'limit' }]
          });
          complaint.after_image = result.secure_url;
        } catch (err) {
          console.error('Cloudinary upload error:', err);
          complaint.after_image = after_image;
        }
      } else {
        complaint.after_image = after_image;
      }
    }

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
