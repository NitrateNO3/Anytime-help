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
      const userBlockMatch = (complaint.address || '').match(/Block\s+([A-H0-9]+)/i) || 
                             (complaint.location || '').match(/Block\s+([A-H0-9]+)/i) ||
                             (complaint.address || '').match(/\b([A-H0-9]+)-?\d+/i);
      const userBlock = userBlockMatch ? userBlockMatch[1].toUpperCase() : (req.user && req.user.block ? String(req.user.block).toUpperCase() : '');

      let phaseConditions = [
        { phase: 'Universal' }, 
        { phase: 'All' }, 
        { phase: { $exists: false } },
        { 'assigned_locations.0': { $exists: true } }
      ];
      if (userPhase) {
        phaseConditions.push({ phase: userPhase });
        // Handle case where resident phase is Sushant Lok 2 - C,D,E but staff phase is Sushant Lok 2
        const parentGroupMatch = userPhase.split(' - ')[0];
        phaseConditions.push({ phase: parentGroupMatch });
        
        if (userPhase === 'Sushant Lok 2 - C,D,E') phaseConditions.push({ phase: 'Sushant Lok 2 Option 1' });
        if (userPhase === 'Sushant Lok 2 - F,G') phaseConditions.push({ phase: 'Sushant Lok 2 Option 2' });
        if (userPhase === 'Sushant Lok 2 Option 1') phaseConditions.push({ phase: 'Sushant Lok 2 - C,D,E' });
        if (userPhase === 'Sushant Lok 2 Option 2') phaseConditions.push({ phase: 'Sushant Lok 2 - F,G' });

        if (userPhase === 'Sushant Lok 2') {
          if (['C', 'D', 'E'].includes(userBlock)) {
            phaseConditions.push({ phase: 'Sushant Lok 2 - C,D,E' }, { phase: 'Sushant Lok 2 Option 1' });
          } else if (['F', 'G'].includes(userBlock)) {
            phaseConditions.push({ phase: 'Sushant Lok 2 - F,G' }, { phase: 'Sushant Lok 2 Option 2' });
          } else {
            phaseConditions.push({ phase: 'Sushant Lok 2 - C,D,E' }, { phase: 'Sushant Lok 2 - F,G' });
          }
        }
      }

      const adminsAndStaff = await User.find({
        $or: [
          { role: 'Admin' },
          { role: 'SubAdmin', permissions: 'Complaints' },
          { role: 'Staff', $or: phaseConditions },
          { role: 'Member', permissions: 'All Complaints' }
        ],
        expoPushToken: { $exists: true, $ne: '' }
      }).select('expoPushToken assigned_category assigned_categories role phase assigned_locations').lean();

      const filteredUsers = adminsAndStaff.filter(u => {
        if (u.role === 'Staff') {
          const cats = u.assigned_categories && u.assigned_categories.length > 0 ? u.assigned_categories : (u.assigned_category ? [u.assigned_category] : []);
          if (cats.length > 0 && !cats.includes('All') && !cats.includes(category) && !cats.includes(finalTitle)) {
            return false;
          }

          if (Array.isArray(u.assigned_locations) && u.assigned_locations.length > 0) {
            const matchesLocation = u.assigned_locations.some(loc => {
              if (!loc.phase) return false;
              if (loc.phase === 'Universal' || loc.phase === 'All Groups (Universal)' || loc.phase === 'All') return true;
              
              const locPhaseNorm = loc.phase.toLowerCase().trim();
              const uPhaseNorm = (userPhase || '').toLowerCase().trim();
              
              const phaseMatches = locPhaseNorm === uPhaseNorm ||
                (uPhaseNorm.includes('sushant lok 2') && locPhaseNorm.includes('sushant lok 2')) ||
                (uPhaseNorm.includes('sushant lok 3') && locPhaseNorm.includes('sushant lok 3')) ||
                uPhaseNorm.includes(locPhaseNorm) || locPhaseNorm.includes(uPhaseNorm);
                
              if (!phaseMatches) return false;

              if (!userBlock) return true;
              if (!loc.blocks || loc.blocks.length === 0 || loc.blocks.includes('ALL') || loc.blocks.includes('All Blocks')) {
                return true;
              }
              return loc.blocks.some(b => b.toUpperCase().trim() === userBlock);
            });
            return matchesLocation;
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

const categoryAliases = {
  'electricity': ['electricity', 'electrical', 'electrician', 'street light', 'light'],
  'electrical': ['electricity', 'electrical', 'electrician', 'street light', 'light'],
  'electrician': ['electricity', 'electrical', 'electrician', 'street light', 'light'],
  'street light': ['street light', 'light', 'electricity', 'electrical'],
  'rainwater drainage': ['rainwater drainage', 'drainage', 'sewage cleaning', 'drain', 'water logging'],
  'drainage': ['rainwater drainage', 'drainage', 'sewage cleaning', 'drain', 'water logging'],
  'sewage cleaning': ['sewage cleaning', 'rainwater drainage', 'drainage', 'drain'],
  'water supply': ['water supply', 'water', 'plumbing', 'plumber'],
  'plumbing': ['water supply', 'water', 'plumbing', 'plumber'],
  'sweeping': ['sweeping', 'sanitation', 'cleaning'],
  'door to door': ['door to door', 'garbage', 'waste'],
  'tree trimming': ['tree trimming', 'horticulture', 'gardening'],
  'park complaints': ['park complaints', 'park', 'gardening']
};

function matchStaffForComplaint(complaint, allStaff) {
  if (!complaint || !allStaff || allStaff.length === 0) return null;

  const rawCat = (complaint.category || complaint.title || '').trim().toLowerCase();
  let searchTerms = [rawCat];
  for (const [key, aliases] of Object.entries(categoryAliases)) {
    if (rawCat.includes(key) || aliases.some(a => rawCat.includes(a))) {
      searchTerms.push(key, ...aliases);
    }
  }
  searchTerms = [...new Set(searchTerms.filter(Boolean))];

  // Smart phase detection
  let detectedPhase = complaint.phase;
  if (!detectedPhase || ['all', 'universal', 'all phases', 'all groups'].includes(detectedPhase.toLowerCase())) {
    const text = [
      complaint.address || '',
      complaint.location || '',
      complaint.user?.phase || '',
      complaint.user?.address || ''
    ].join(' ').toLowerCase();

    if (text.includes('sushant lok 3') || text.includes('sl 3') || text.includes('sl-3') || text.includes('sl3')) {
      detectedPhase = 'Sushant Lok 3';
    } else if (text.includes('sushant lok 2') || text.includes('sl 2') || text.includes('sl-2') || text.includes('sl2')) {
      if (text.includes('g-') || text.includes('f-') || text.includes('block g') || text.includes('block f')) {
        detectedPhase = 'Sushant Lok 2 - F,G';
      } else if (text.includes('c-') || text.includes('d-') || text.includes('e-') || text.includes('block c') || text.includes('block d') || text.includes('block e')) {
        detectedPhase = 'Sushant Lok 2 - C,D,E';
      } else {
        detectedPhase = 'Sushant Lok 2';
      }
    }
  }

  // Filter staff matching category
  const categoryStaff = allStaff.filter(staff => {
    let cats = [];
    if (Array.isArray(staff.assigned_categories) && staff.assigned_categories.length > 0) {
      cats.push(...staff.assigned_categories);
    }
    if (staff.assigned_category) {
      if (staff.assigned_category.includes(',')) {
        cats.push(...staff.assigned_category.split(',').map(s => s.trim()));
      } else {
        cats.push(staff.assigned_category.trim());
      }
    }
    cats = cats.map(c => c.toLowerCase());
    if (cats.includes('all')) return true;
    return cats.some(c => searchTerms.some(st => c.includes(st) || st.includes(c)));
  });

  // Extract complaint block if any
  const complaintText = [
    complaint.address || '',
    complaint.location || '',
    complaint.user?.address || ''
  ].join(' ').toUpperCase();
  const cBlockMatch = complaintText.match(/\bBLOCK\s*([A-H0-9]+)\b/i) || complaintText.match(/\b([A-H0-9]+)-?\d+/i);
  const complaintBlock = cBlockMatch ? cBlockMatch[1].toUpperCase() : '';

  // Filter staff by phase & blocks
  const filteredStaff = categoryStaff.filter(staff => {
    if (Array.isArray(staff.assigned_locations) && staff.assigned_locations.length > 0) {
      return staff.assigned_locations.some(loc => {
        if (!loc.phase || ['universal', 'all', 'all groups'].includes(loc.phase.toLowerCase())) return true;
        
        const lPhase = loc.phase.toLowerCase();
        const dPhase = (detectedPhase || '').toLowerCase();
        const phaseMatches = dPhase.includes(lPhase) || lPhase.includes(dPhase) ||
          (dPhase.includes('sushant lok 2') && lPhase.includes('sushant lok 2')) ||
          (dPhase.includes('sushant lok 3') && lPhase.includes('sushant lok 3'));
        
        if (!phaseMatches) return false;

        if (!complaintBlock || !loc.blocks || loc.blocks.length === 0 || loc.blocks.includes('ALL') || loc.blocks.includes('All Blocks')) {
          return true;
        }

        return loc.blocks.some(b => b.toUpperCase().trim() === complaintBlock);
      });
    }

    const sPhase = (staff.phase || '').toLowerCase();
    if (!sPhase || sPhase === 'universal' || sPhase === 'all' || sPhase === 'all groups' || sPhase === 'all phases') {
      return true;
    }
    if (!detectedPhase) return true;
    const dPhase = detectedPhase.toLowerCase();
    return sPhase.includes(dPhase) || dPhase.includes(sPhase);
  });

  return filteredStaff.length > 0 ? filteredStaff[0] : (categoryStaff.length > 0 ? categoryStaff[0] : null);
}

// One-time auto-backfill helper to ensure legacy complaints have status_priority and assigned staff
let isStatusPriorityBackfilled = false;
const ensureStatusPriority = async () => {
  if (isStatusPriorityBackfilled) return;
  try {
    await Promise.all([
      // 1. Any complaint that is DONE or RESOLVED must have status_priority = 3, whether escalated or not!
      Complaint.updateMany(
        { status: { $in: ['DONE', 'RESOLVED'] }, status_priority: { $ne: 3 } },
        { $set: { status_priority: 3 } }
      ),
      // 2. Active complaints (PENDING or IN_PROGRESS) that are escalated get status_priority = 0 (top of stack)
      Complaint.updateMany(
        { status: { $nin: ['DONE', 'RESOLVED'] }, is_escalated: true, status_priority: { $ne: 0 } },
        { $set: { status_priority: 0 } }
      ),
      // 3. Normal PENDING complaints (not escalated) -> status_priority = 1
      Complaint.updateMany(
        { status: 'PENDING', is_escalated: { $ne: true }, status_priority: { $ne: 1 } },
        { $set: { status_priority: 1 } }
      ),
      // 4. Normal IN_PROGRESS complaints (not escalated) -> status_priority = 2
      Complaint.updateMany(
        { status: 'IN_PROGRESS', is_escalated: { $ne: true }, status_priority: { $ne: 2 } },
        { $set: { status_priority: 2 } }
      )
    ]);
    isStatusPriorityBackfilled = true;
  } catch (err) {
    console.error('Error in ensureStatusPriority:', err.message);
  }
};

// GET /api/complaints
router.get('/', auth, async (req, res) => {
  try {
    await ensureStatusPriority();
    const { departmentId, page, limit, search, category, status, phase, priority, sortOrder, complaint_id } = req.query;
    let query = {};
    if (departmentId) {
      query.department = departmentId;
    }

    if (complaint_id && complaint_id.trim()) {
      const cleanId = complaint_id.trim().replace(/^#/, '');
      query.complaint_id = { $regex: cleanId, $options: 'i' };
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
      const cleanId = s.replace(/^#/, '');
      const orConditions = [
        { title: { $regex: s, $options: 'i' } },
        { description: { $regex: s, $options: 'i' } },
        { location: { $regex: s, $options: 'i' } },
        { address: { $regex: s, $options: 'i' } },
        { complaint_id: { $regex: cleanId, $options: 'i' } }
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
          
          if (Array.isArray(account.assigned_locations) && account.assigned_locations.length > 0) {
            for (const loc of account.assigned_locations) {
              if (!loc.phase || ['universal', 'all', 'all groups'].includes(loc.phase.toLowerCase())) {
                if (accountCatCondition) staffOrConditions.push(accountCatCondition);
                else staffOrConditions.push({});
                continue;
              }

              let locPhaseCond;
              if (loc.phase.includes('Sushant Lok 2')) {
                locPhaseCond = { $in: [
                  new RegExp('Sushant Lok 2', 'i'),
                  null, '', undefined
                ]};
              } else if (loc.phase.includes('Sushant Lok 3')) {
                locPhaseCond = { $in: [
                  new RegExp('Sushant Lok 3', 'i'),
                  null, '', undefined
                ]};
              } else {
                let cleanPhase = loc.phase.replace(/[-:,].*$/, '').trim();
                locPhaseCond = { $in: [
                  new RegExp(cleanPhase.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&'), 'i'),
                  null, '', undefined
                ]};
              }

              const hasSpecificBlocks = Array.isArray(loc.blocks) && loc.blocks.length > 0 && 
                                        !loc.blocks.includes('ALL') && !loc.blocks.includes('All Blocks');

              if (hasSpecificBlocks) {
                const blockRegexes = loc.blocks.map(b => new RegExp(`(\\bBlock\\s*${b}\\b|\\b${b}-?\\d+)`, 'i'));
                const blockCond = {
                  $or: [
                    { address: { $in: blockRegexes } },
                    { location: { $in: blockRegexes } }
                  ]
                };
                
                staffOrConditions.push({
                  phase: locPhaseCond,
                  ...blockCond,
                  ...(accountCatCondition || {})
                });
              } else {
                if (accountCatCondition) {
                  staffOrConditions.push({ ...accountCatCondition, phase: locPhaseCond });
                } else {
                  staffOrConditions.push({ phase: locPhaseCond });
                }
              }
            }
          } else if (account.phase && account.phase !== 'All' && account.phase !== 'Universal' && account.phase !== 'All Groups' && account.phase !== 'All Phases') {
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
      .populate('resolved_by', 'name phone_number role phase')
      .populate('escalated_by', 'name phone_number phone role')
      .populate('replies.user', 'name role')
      .sort({ status_priority: 1, created_at: sortDirection })
      .lean();
    
    const pageNum = parseInt(page || '1', 10);
    const limitNum = Math.min(parseInt(limit || '15', 10), 100); // Enforce max limit of 100
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

    // Fetch all active staff to fill any unassigned complaints dynamically
    const allActiveStaff = await User.find({ role: { $in: ['Staff', 'PaidStaff'] } })
      .select('name phone_number role assigned_category assigned_categories phase assigned_locations')
      .lean();

    let processedComplaints = complaints.map(c => {
      let bImage = c.before_image;
      let aImage = c.after_image;
      if (bImage && bImage.includes('cloudinary.com') && !bImage.includes('upload/f_auto,q_auto')) {
        bImage = bImage.replace('/upload/', '/upload/f_auto,q_auto,w_800,c_limit/');
      }
      if (aImage && aImage.includes('cloudinary.com') && !aImage.includes('upload/f_auto,q_auto')) {
        aImage = aImage.replace('/upload/', '/upload/f_auto,q_auto,w_800,c_limit/');
      }

      let assigned_staff = c.assigned_staff;
      let resolved_by = c.resolved_by;
      let resolved_by_name = c.resolved_by_name;

      if (!assigned_staff && !resolved_by) {
        const matched = matchStaffForComplaint(c, allActiveStaff);
        if (matched) {
          assigned_staff = matched;
          if (c.status === 'DONE' || c.status === 'RESOLVED') {
            resolved_by = matched;
            resolved_by_name = matched.name;
          }
        }
      } else if (!resolved_by && (c.status === 'DONE' || c.status === 'RESOLVED') && assigned_staff) {
        resolved_by = assigned_staff;
        resolved_by_name = assigned_staff.name;
      }

      return { 
        ...c, 
        before_image: bImage, 
        after_image: aImage,
        assigned_staff,
        resolved_by,
        resolved_by_name
      };
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
      .populate('resolved_by', 'name phone_number role phase')
      .populate('escalated_by', 'name phone_number phone role')
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

    // Fetch all staff members responsible for this complaint's category & phase
    let assignedStaffList = [];
    try {
      const rawCat = (complaint.category || complaint.title || '').trim().toLowerCase();
      const categoryAliases = {
        'electricity': ['electricity', 'electrical', 'electrician', 'street light', 'light'],
        'electrical': ['electricity', 'electrical', 'electrician', 'street light', 'light'],
        'electrician': ['electricity', 'electrical', 'electrician', 'street light', 'light'],
        'street light': ['street light', 'light', 'electricity', 'electrical'],
        'rainwater drainage': ['rainwater drainage', 'drainage', 'sewage cleaning', 'drain', 'water logging'],
        'drainage': ['rainwater drainage', 'drainage', 'sewage cleaning', 'drain', 'water logging'],
        'sewage cleaning': ['sewage cleaning', 'rainwater drainage', 'drainage', 'drain'],
        'water supply': ['water supply', 'water', 'plumbing', 'plumber'],
        'plumbing': ['water supply', 'water', 'plumbing', 'plumber'],
        'sweeping': ['sweeping', 'sanitation', 'cleaning'],
        'door to door': ['door to door', 'garbage', 'waste'],
        'tree trimming': ['tree trimming', 'horticulture', 'gardening'],
        'park complaints': ['park complaints', 'park', 'gardening']
      };

      let searchTerms = [rawCat];
      for (const [key, aliases] of Object.entries(categoryAliases)) {
        if (rawCat.includes(key) || aliases.some(a => rawCat.includes(a))) {
          searchTerms.push(key, ...aliases);
        }
      }
      searchTerms = [...new Set(searchTerms.filter(Boolean))];

      // Smart phase detection if complaint.phase is missing or generic
      let detectedPhase = complaint.phase;
      if (!detectedPhase || ['all', 'universal', 'all phases', 'all groups'].includes(detectedPhase.toLowerCase())) {
        const text = [
          complaint.address || '',
          complaint.location || '',
          complaint.user?.phase || '',
          complaint.user?.address || ''
        ].join(' ').toLowerCase();

        if (text.includes('sushant lok 3') || text.includes('sl 3') || text.includes('sl-3') || text.includes('sl3')) {
          detectedPhase = 'Sushant Lok 3';
        } else if (text.includes('sushant lok 2') || text.includes('sl 2') || text.includes('sl-2') || text.includes('sl2')) {
          if (text.includes('g-') || text.includes('f-') || text.includes('block g') || text.includes('block f')) {
            detectedPhase = 'Sushant Lok 2 - F,G';
          } else if (text.includes('c-') || text.includes('d-') || text.includes('e-') || text.includes('block c') || text.includes('block d') || text.includes('block e')) {
            detectedPhase = 'Sushant Lok 2 - C,D,E';
          } else {
            detectedPhase = 'Sushant Lok 2';
          }
        }
      }

      // Fetch all active staff
      const allStaff = await User.find({ role: { $in: ['Staff', 'PaidStaff'] } })
        .select('name phone_number role assigned_category assigned_categories phase assigned_locations')
        .lean();

      // Filter staff matching category
      const categoryStaff = allStaff.filter(staff => {
        let cats = [];
        if (Array.isArray(staff.assigned_categories) && staff.assigned_categories.length > 0) {
          cats.push(...staff.assigned_categories);
        }
        if (staff.assigned_category) {
          if (staff.assigned_category.includes(',')) {
            cats.push(...staff.assigned_category.split(',').map(s => s.trim()));
          } else {
            cats.push(staff.assigned_category.trim());
          }
        }
        cats = cats.map(c => c.toLowerCase());
        if (cats.includes('all')) return true;
        return cats.some(c => searchTerms.some(st => c.includes(st) || st.includes(c)));
      });

      // Extract complaint block if any
      const complaintText = [
        complaint.address || '',
        complaint.location || '',
        complaint.user?.address || ''
      ].join(' ').toUpperCase();
      const cBlockMatch = complaintText.match(/\bBLOCK\s*([A-H0-9]+)\b/i) || complaintText.match(/\b([A-H0-9]+)-?\d+/i);
      const complaintBlock = cBlockMatch ? cBlockMatch[1].toUpperCase() : '';

      // Filter staff by phase & blocks
      const filteredStaff = categoryStaff.filter(staff => {
        if (Array.isArray(staff.assigned_locations) && staff.assigned_locations.length > 0) {
          return staff.assigned_locations.some(loc => {
            if (!loc.phase || ['universal', 'all', 'all groups'].includes(loc.phase.toLowerCase())) return true;
            
            const lPhase = loc.phase.toLowerCase();
            const dPhase = (detectedPhase || '').toLowerCase();
            const phaseMatches = dPhase.includes(lPhase) || lPhase.includes(dPhase) ||
              (dPhase.includes('sushant lok 2') && lPhase.includes('sushant lok 2')) ||
              (dPhase.includes('sushant lok 3') && lPhase.includes('sushant lok 3'));
            
            if (!phaseMatches) return false;

            if (!complaintBlock || !loc.blocks || loc.blocks.length === 0 || loc.blocks.includes('ALL') || loc.blocks.includes('All Blocks')) {
              return true;
            }

            return loc.blocks.some(b => b.toUpperCase().trim() === complaintBlock);
          });
        }

        const sPhase = (staff.phase || '').toLowerCase();
        if (!sPhase || sPhase === 'universal' || sPhase === 'all' || sPhase === 'all groups' || sPhase === 'all phases') {
          return true;
        }
        if (!detectedPhase) return true;
        const dPhase = detectedPhase.toLowerCase();
        if (dPhase.includes('sushant lok 2 - f,g')) {
          return sPhase.includes('f,g') || sPhase.includes('f, g') || sPhase.includes('sl 2 g,f') || sPhase.includes('sushant lok 2');
        }
        if (dPhase.includes('sushant lok 2 - c,d,e')) {
          return sPhase.includes('c,d,e') || sPhase.includes('c, d, e') || sPhase.includes('sushant lok 2');
        }
        if (dPhase.includes('sushant lok 3')) {
          return sPhase.includes('sushant lok 3') || sPhase.includes('sl 3') || sPhase.includes('sl3');
        }
        return sPhase.includes(dPhase) || dPhase.includes(sPhase);
      });

      assignedStaffList = filteredStaff;
    } catch (e) {
      console.error('Error fetching staff list for complaint:', e);
    }

    // If specific assigned_staff is set, prioritize them
    if (complaint.assigned_staff) {
      const staffIdStr = (complaint.assigned_staff._id || complaint.assigned_staff).toString();
      const existingIdx = assignedStaffList.findIndex(s => s._id.toString() === staffIdStr);
      if (existingIdx !== -1) {
        assignedStaffList[existingIdx].is_primary = true;
        const [primary] = assignedStaffList.splice(existingIdx, 1);
        assignedStaffList.unshift(primary);
      } else {
        complaint.assigned_staff.is_primary = true;
        assignedStaffList.unshift(complaint.assigned_staff);
      }
    } else if (assignedStaffList.length === 1) {
      assignedStaffList[0].is_primary = true;
    }

    complaint.assigned_staff_list = assignedStaffList;

    res.json(complaint);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/complaints/:id/escalate
router.post('/:id/escalate', auth, async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) return res.status(404).json({ message: 'Complaint not found' });

    // Allow Member, Admin, SubAdmin
    if (req.user.role !== 'Member' && req.user.role !== 'Admin' && req.user.role !== 'SubAdmin') {
      return res.status(403).json({ message: 'Only Members or Admins can escalate complaints' });
    }

    const { deescalate, reason, memberName, memberPhone } = req.body || {};

    if (deescalate) {
      complaint.is_escalated = false;
      complaint.escalated_by = null;
      complaint.escalated_by_name = null;
      complaint.escalated_by_phone = null;
      complaint.escalated_at = null;
      complaint.status_priority = (complaint.status === 'DONE' || complaint.status === 'RESOLVED') ? 3 : (complaint.status === 'IN_PROGRESS' ? 2 : 1);
    } else {
      complaint.is_escalated = true;
      complaint.escalated_by = req.user._id || req.user.id;
      complaint.escalated_by_name = (req.user && req.user.name) ? req.user.name : (memberName || 'Member');
      complaint.escalated_by_phone = (req.user && (req.user.phone_number || req.user.phone)) ? (req.user.phone_number || req.user.phone) : (memberPhone || null);
      complaint.escalated_at = new Date();
      complaint.priority = 'High';
      if (reason) complaint.escalation_reason = reason;
      complaint.status_priority = (complaint.status === 'DONE' || complaint.status === 'RESOLVED') ? 3 : 0;
    }

    await complaint.save();

    const populatedComplaint = await Complaint.findById(complaint._id)
      .select('-__v')
      .populate('user', 'name phone_number address room_number phase relation')
      .populate('assigned_staff', 'name phone_number address room_number phase')
      .populate('escalated_by', 'name phone_number phone role')
      .populate('replies.user', 'name role')
      .lean();

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.emit('complaint_changed', { action: 'update', data: populatedComplaint });
    }

    // If escalated, send push notification to Staff and Admins
    if (!deescalate) {
      try {
        const memberDisplayName = complaint.escalated_by_name || (req.user && req.user.name) || 'Member';
        const targetUsers = await User.find({
          $or: [
            { role: 'Admin' },
            { role: 'SubAdmin' },
            { role: 'Staff' }
          ],
          expoPushToken: { $exists: true, $ne: '' }
        }).select('expoPushToken role phase assigned_category assigned_categories unread_notifications').lean();

        const eligibleUsers = targetUsers.filter(u => {
          if (u.role === 'Staff') {
            const cats = u.assigned_categories && u.assigned_categories.length > 0 ? u.assigned_categories : (u.assigned_category ? [u.assigned_category] : []);
            if (cats.length > 0 && !cats.includes('All') && !cats.includes(complaint.category)) {
              return false;
            }
          }
          return true;
        });

        if (eligibleUsers.length > 0) {
          const userIds = eligibleUsers.map(u => u._id);
          await User.updateMany({ _id: { $in: userIds } }, { $inc: { unread_notifications: 1 } });
          const tokens = eligibleUsers.map(u => ({
            to: u.expoPushToken,
            badge: (u.unread_notifications || 0) + 1
          }));
          const { sendPushNotifications } = require('../utils/push');
          sendPushNotifications(
            tokens,
            `🔥 ESCALATED: #${complaint.complaint_id || 'AH'} ${complaint.title}`,
            `Escalated by Member: ${memberDisplayName}. Urgent attention requested!`,
            { type: 'complaint', id: complaint._id }
          );
        }
      } catch (pushErr) {
        console.error('Push notification error on escalate:', pushErr.message);
      }
    }

    res.json(populatedComplaint);
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
    
    if ((!req.body.text || !req.body.text.trim()) && !req.body.image) {
      return res.status(400).json({ message: 'Reply must include text or an image' });
    }
    
    complaint.replies.push({
      user: req.user.id,
      text: req.body.text ? req.body.text.trim() : '',
      image: req.body.image || null,
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
      let notificationBody = (req.body.text && req.body.text.trim()) ? req.body.text.trim() : '📷 Sent an image attachment';
      
      // Fetch all relevant admins and staff for this category/phase
      const userPhase = complaint.phase;
      const category = complaint.category;
      
      const adminsAndStaff = await User.find({
        $or: [
          { role: 'Admin' },
          { role: 'SubAdmin', permissions: 'Complaints' },
          { role: 'Staff', $or: [{ phase: userPhase }, { phase: 'Universal' }, { phase: 'All' }, { phase: { $exists: false } }] },
          { role: 'Member', permissions: 'All Complaints' }
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
      if (status === 'DONE' || status === 'RESOLVED') {
        complaint.status_priority = 3;
        complaint.resolved_at = new Date();
        complaint.resolved_by = req.user.id || req.user._id;
        complaint.resolved_by_name = (req.user && req.user.name) ? req.user.name : ((req.user.role === 'Staff' || req.user.role === 'PaidStaff') ? 'Staff' : 'Admin');
        if (req.user.role === 'Staff' || req.user.role === 'PaidStaff') {
          complaint.assigned_staff = req.user.id;
        }
      } else if (complaint.is_escalated) {
        complaint.status_priority = 0;
        complaint.resolved_by = null;
        complaint.resolved_by_name = null;
        complaint.resolved_at = null;
      } else if (status === 'PENDING') {
        complaint.status_priority = 1;
        complaint.resolved_by = null;
        complaint.resolved_by_name = null;
        complaint.resolved_at = null;
      } else if (status === 'IN_PROGRESS') {
        complaint.status_priority = 2;
        complaint.resolved_by = null;
        complaint.resolved_by_name = null;
        complaint.resolved_at = null;
        if (req.user.role === 'Staff' || req.user.role === 'PaidStaff') {
          complaint.assigned_staff = req.user.id;
        }
      } else {
        complaint.status_priority = 4;
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

    await complaint.save();

    const populatedComplaint = await Complaint.findById(complaint._id)
      .select('-__v')
      .populate('user', 'name phone_number address room_number phase relation')
      .populate('assigned_staff', 'name phone_number address room_number phase')
      .populate('resolved_by', 'name phone_number role phase')
      .populate('escalated_by', 'name phone_number phone role')
      .populate('replies.user', 'name role')
      .lean();

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.emit('complaint_changed', { action: 'update', data: populatedComplaint });
    }

    res.json(populatedComplaint);
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
