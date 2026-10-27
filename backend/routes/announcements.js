const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Announcement = require('../models/Announcement');
const User = require('../models/User');
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
});

// @route   GET api/announcements
// @desc    Get all active announcements
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    let query = { active: true };
    const helperGetAllowedPhases = (user, role) => {
      let userBlock = (user?.block || '').trim().toUpperCase();
      if (!userBlock && user?.address) {
        const bMatch = user.address.match(/\bBlock[\s:-]*([A-H](?:1)?)\b/i) || 
                       user.address.match(/\b([A-H](?:1)?)[\s-]+Block\b/i) || 
                       user.address.match(/\b([A-H](?:1)?)[- ]?\d+/i);
        if (bMatch) userBlock = bMatch[1].toUpperCase();
      }

      const uPhase = (user?.phase || '').trim();
      let allowed = ['All', 'Universal', 'All Groups'];

      if (role === 'Resident') {
        allowed.push('Resident', 'Resident + Member');
      } else if (role === 'Member') {
        allowed.push('Members', 'Resident + Member', 'Resident');
      }

      if (uPhase) {
        allowed.push(uPhase);
        const parentGroup = uPhase.split(' - ')[0];
        const basePhase = uPhase.split(' - ').slice(0, 2).join(' - ');
        allowed.push(parentGroup, basePhase);
      }

      const isSL2 = !uPhase || uPhase.toLowerCase().includes('sushant lok 2') || (user?.address && user.address.toLowerCase().includes('sushant lok 2'));
      const isSL3 = (uPhase && uPhase.toLowerCase().includes('sushant lok 3')) || (user?.address && user.address.toLowerCase().includes('sushant lok 3'));

      if (isSL2) {
        allowed.push('Sushant Lok 2');
        if (['C', 'D', 'E'].includes(userBlock)) {
          allowed.push('Sushant Lok 2 - C,D,E', 'Sushant Lok 2 Option 1', `Block ${userBlock}`, userBlock);
        } else if (['F', 'G'].includes(userBlock)) {
          allowed.push('Sushant Lok 2 - F,G', 'Sushant Lok 2 Option 2', `Block ${userBlock}`, userBlock);
        } else if (uPhase.includes('C,D,E') || uPhase.includes('Option 1')) {
          allowed.push('Sushant Lok 2 - C,D,E', 'Sushant Lok 2 Option 1');
        } else if (uPhase.includes('F,G') || uPhase.includes('Option 2')) {
          allowed.push('Sushant Lok 2 - F,G', 'Sushant Lok 2 Option 2');
        } else {
          // If block is unknown, include both sub-clusters so resident doesn't miss announcements
          allowed.push('Sushant Lok 2 - C,D,E', 'Sushant Lok 2 - F,G', 'Sushant Lok 2 Option 1', 'Sushant Lok 2 Option 2');
        }
      }

      if (isSL3) {
        allowed.push('Sushant Lok 3', 'Sushant Lok 3 - A, B, B1, C, D, E, F, G, H');
        if (userBlock) {
          allowed.push(`Block ${userBlock}`, userBlock);
        }
      }

      return [...new Set(allowed.filter(Boolean))];
    };

    const helperGetLocationOrConditions = (user) => {
      let userBlock = (user?.block || '').trim().toUpperCase();
      if (!userBlock && user?.address) {
        const bMatch = user.address.match(/\bBlock[\s:-]*([A-H](?:1)?)\b/i) || 
                       user.address.match(/\b([A-H](?:1)?)[\s-]+Block\b/i) || 
                       user.address.match(/\b([A-H](?:1)?)[- ]?\d+/i);
        if (bMatch) userBlock = bMatch[1].toUpperCase();
      }

      const uPhase = (user?.phase || '').trim();
      const isSL2 = !uPhase || uPhase.toLowerCase().includes('sushant lok 2') || (user?.address && user.address.toLowerCase().includes('sushant lok 2'));
      const isSL3 = (uPhase && uPhase.toLowerCase().includes('sushant lok 3')) || (user?.address && user.address.toLowerCase().includes('sushant lok 3'));

      const orConds = [
        // Universal announcements target all groups
        { 'targetLocations.phase': { $in: ['Universal', 'All', 'All Groups', /universal/i] } }
      ];

      const phaseRegexes = [];
      if (isSL2) phaseRegexes.push(/Sushant Lok 2/i);
      if (isSL3) phaseRegexes.push(/Sushant Lok 3/i);
      if (uPhase && !uPhase.toLowerCase().includes('sushant lok 2') && !uPhase.toLowerCase().includes('sushant lok 3')) {
        phaseRegexes.push(new RegExp(uPhase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
      }

      for (const pReg of phaseRegexes) {
        if (userBlock) {
          orConds.push({
            targetLocations: {
              $elemMatch: {
                phase: pReg,
                $or: [
                  { blocks: { $in: ['ALL', 'All Blocks', userBlock, `Block ${userBlock}`, `block ${userBlock.toLowerCase()}`] } },
                  { blocks: { $size: 0 } },
                  { blocks: { $exists: false } }
                ]
              }
            }
          });
        } else {
          orConds.push({
            targetLocations: {
              $elemMatch: {
                phase: pReg
              }
            }
          });
        }
      }

      return orConds;
    };

    if (req.user.role === 'Resident') {
      const user = await User.findById(req.user.id);
      const allowedPhases = helperGetAllowedPhases(user, 'Resident');
      const targetLocConds = helperGetLocationOrConditions(user);
      const uPhase = (user?.phase || '').trim();
      const isSL2 = !uPhase || uPhase.toLowerCase().includes('sushant lok 2') || (user?.address && user.address.toLowerCase().includes('sushant lok 2'));
      const isSL3 = (uPhase && uPhase.toLowerCase().includes('sushant lok 3')) || (user?.address && user.address.toLowerCase().includes('sushant lok 3'));

      query.$or = [
        ...targetLocConds,
        {
          $and: [
            {
              $or: [
                { targetLocations: { $exists: false } },
                { targetLocations: null },
                { targetLocations: { $size: 0 } }
              ]
            },
            {
              $or: [
                { phases: { $in: allowedPhases } },
                { phases: { $size: 0 } },
                { phases: { $exists: false } },
                { phases: null },
                { phases: 'All' },
                ...(isSL2 ? [{ phases: { $regex: /Sushant Lok 2/i } }] : []),
                ...(isSL3 ? [{ phases: { $regex: /Sushant Lok 3/i } }] : [])
              ]
            }
          ]
        }
      ];
      query.targetAudience = { $ne: 'Members' }; // Residents cannot see 'Members' only announcements
    } else if (req.user.role === 'Staff') {
      const user = await User.findById(req.user.id);
      let phasesToMatch = ['All', 'Staff'];
      if (user && user.phase) {
        const parentGroup = user.phase.split(' - ')[0];
        const basePhase = user.phase.split(' - ').slice(0, 2).join(' - ');
        phasesToMatch.push(user.phase, parentGroup, basePhase);
      }
      query.$or = [
        { phases: { $in: phasesToMatch } },
        { createdBy: req.user.id },
        { 'targetLocations.phase': { $in: ['Universal', 'All', 'All Groups'] } }
      ];
    } else if (req.user.role === 'Member') {
      const user = await User.findById(req.user.id);
      const allowedPhases = helperGetAllowedPhases(user, 'Member');
      const targetLocConds = helperGetLocationOrConditions(user);
      const uPhase = (user?.phase || '').trim();
      const isSL2 = !uPhase || uPhase.toLowerCase().includes('sushant lok 2') || (user?.address && user.address.toLowerCase().includes('sushant lok 2'));
      const isSL3 = (uPhase && uPhase.toLowerCase().includes('sushant lok 3')) || (user?.address && user.address.toLowerCase().includes('sushant lok 3'));

      query.$or = [
        ...targetLocConds,
        {
          $and: [
            {
              $or: [
                { targetLocations: { $exists: false } },
                { targetLocations: null },
                { targetLocations: { $size: 0 } }
              ]
            },
            {
              $or: [
                { phases: { $in: allowedPhases } },
                { phases: { $size: 0 } },
                { phases: { $exists: false } },
                { phases: null },
                { phases: 'All' },
                { targetAudience: 'Members' },
                ...(isSL2 ? [{ phases: { $regex: /Sushant Lok 2/i } }] : []),
                ...(isSL3 ? [{ phases: { $regex: /Sushant Lok 3/i } }] : [])
              ]
            }
          ]
        },
        { createdBy: req.user.id }
      ];
    } else if (req.user.role === 'Admin') {
      const { phase } = req.query;
      if (phase && phase !== 'All Groups (Show Everything)') {
        if (phase === 'Universal (Sent to Everyone)') {
          query.$or = [
            { phases: 'All' }, 
            { phases: { $size: 0 } }, 
            { phases: { $exists: false } },
            { 'targetLocations.phase': { $in: ['Universal', 'All', 'All Groups'] } }
          ];
        } else if (phase === 'Sushant Lok 2 - C,D,E') {
          query.$or = [
            { phases: { $in: ['Sushant Lok 2 - C,D,E', 'Sushant Lok 2 Option 1'] } },
            { 'targetLocations.phase': /Sushant Lok 2/i }
          ];
        } else if (phase === 'Sushant Lok 2 - F,G') {
          query.$or = [
            { phases: { $in: ['Sushant Lok 2 - F,G', 'Sushant Lok 2 Option 2'] } },
            { 'targetLocations.phase': /Sushant Lok 2/i }
          ];
        } else {
          query.$or = [
            { phases: phase },
            { 'targetLocations.phase': new RegExp(phase, 'i') }
          ];
        }
      }
    }

    const { page, limit, search, dateFrom, dateTo } = req.query;

    if (search && search.trim()) {
      const s = search.trim();
      if (!query.$and) query.$and = [];
      query.$and.push({
        $or: [
          { title: { $regex: s, $options: 'i' } },
          { message: { $regex: s, $options: 'i' } },
          { creatorName: { $regex: s, $options: 'i' } }
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
      if (!query.$and) query.$and = [];
      query.$and.push({ date: dateFilter });
    }

    const pageNum = parseInt(page || '1', 10);
    const limitNum = Math.min(parseInt(limit || '20', 10), 20);
    const skip = (pageNum - 1) * limitNum;
    let announcementsQuery = Announcement.find(query)
      .select('-__v')
      .sort({ date: -1 })
      .populate('createdBy', 'name');
      
    if (req.query.all !== 'true') {
      announcementsQuery = announcementsQuery.skip(skip).limit(limitNum);
    }
    const announcements = await announcementsQuery.lean();
    const total = await Announcement.countDocuments(query);
    
    const processedAnnouncements = announcements.map(a => {
      let img = a.image;
      if (img && img.includes('cloudinary.com') && !img.includes('upload/f_auto,q_auto')) {
        img = img.replace('/upload/', '/upload/f_auto,q_auto,w_800,c_limit/');
      }
      
      let modifiedCreatorName = a.creatorName;
      let modifiedCreatedBy = a.createdBy;

      // Clean up creator name for Residents (removes address/designation in parenthesis)
      if (req.user.role === 'Resident') {
        const formatName = (rawName) => {
          if (!rawName) return '';
          if (rawName.includes('(')) return rawName.split('(')[0].trim();
          if (rawName.includes(',')) return rawName.split(',')[0].trim();
          if (rawName.includes('-')) return rawName.split('-')[0].trim();
          return rawName;
        };
        
        if (modifiedCreatedBy && modifiedCreatedBy.name) {
          modifiedCreatedBy = { ...modifiedCreatedBy, name: formatName(modifiedCreatedBy.name) };
        }
        if (modifiedCreatorName) {
          modifiedCreatorName = formatName(modifiedCreatorName);
        }
      }

      return { ...a, image: img, creatorName: modifiedCreatorName, createdBy: modifiedCreatedBy };
    });

    if (!page && !limit) {
      return res.json(processedAnnouncements);
    }
    
    return res.json({ announcements: processedAnnouncements, total, page: pageNum, totalPages: Math.ceil(total / limitNum) || 1 });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST api/announcements
// @desc    Create an announcement (Admin, Staff, Member)
// @access  Private
router.post('/', auth, async (req, res) => {
  const hasAccess = req.user.role === 'Admin' || req.user.role === 'Staff' || req.user.role === 'Member' || 
    (req.user.role === 'SubAdmin' && req.user.permissions && req.user.permissions.some(p => p.startsWith('Announcements')));
  if (!hasAccess) {
    return res.status(403).json({ msg: 'Authorization denied' });
  }

  const { title, message, phases, targetAudience, image, targetLocations } = req.body;

  try {
    let creatorName = req.user.name;
    let creatorId = req.user.member_id;
    let creatorPhase = null;

    // Fetch from db to guarantee accuracy
    const userObj = await User.findById(req.user.id);
    if (userObj) {
      if (!creatorName) {
        creatorName = userObj.name || req.user.role;
        creatorId = userObj.member_id || '';
      }
      creatorPhase = userObj.phase;
    }

    let finalTargetLocations = targetLocations || [];
    let finalPhases = phases || [];

    // Helper to parse complex phase strings like "Sushant Lok 2: Block C, D | Sushant Lok 3: Block A, B"
    const helperParseLocationsFromPhaseString = (phaseStr) => {
      if (!phaseStr) return [];
      const pLower = phaseStr.trim().toLowerCase();
      if (['universal', 'all', 'all groups', 'all phases'].includes(pLower)) {
        return [{ phase: 'Universal', blocks: ['ALL'] }];
      }
      const parts = phaseStr.split('|').map(s => s.trim()).filter(Boolean);
      const locs = [];
      for (const part of parts) {
        if (part.includes(':')) {
          const [ph, blkPart] = part.split(':').map(s => s.trim());
          const blocks = blkPart
            .replace(/^block\s*/i, '')
            .split(',')
            .map(b => b.trim().replace(/^block\s*/i, ''))
            .filter(Boolean);
          locs.push({
            phase: ph,
            blocks: (blocks.length === 0 || blocks.some(b => b.toUpperCase() === 'ALL' || b.toLowerCase().includes('all'))) ? ['ALL'] : blocks
          });
        } else if (part.includes(' - ')) {
          const ph = part.split(' - ')[0].trim();
          let blocks = [];
          if (part.includes('C,D,E') || part.includes('Option 1')) blocks = ['C', 'D', 'E'];
          else if (part.includes('F,G') || part.includes('Option 2')) blocks = ['F', 'G'];
          locs.push({ phase: ph, blocks: blocks.length > 0 ? blocks : ['ALL'] });
        } else {
          locs.push({ phase: part, blocks: ['ALL'] });
        }
      }
      return locs;
    };

    if (req.user.role === 'Staff') {
      if (Array.isArray(userObj?.assigned_locations) && userObj.assigned_locations.length > 0) {
        finalTargetLocations = userObj.assigned_locations.map(loc => ({
          phase: loc.phase || 'Universal',
          blocks: (Array.isArray(loc.blocks) && loc.blocks.length > 0) ? loc.blocks : ['ALL']
        }));
      } else if (creatorPhase) {
        finalTargetLocations = helperParseLocationsFromPhaseString(creatorPhase);
      }
    } else if (req.user.role === 'SubAdmin') {
      if (Array.isArray(userObj?.assigned_locations) && userObj.assigned_locations.length > 0) {
        finalTargetLocations = userObj.assigned_locations;
      } else if (creatorPhase && (!finalPhases || finalPhases.length === 0)) {
        finalTargetLocations = helperParseLocationsFromPhaseString(creatorPhase);
      }
    }

    // Auto-generate finalPhases if not explicitly set
    if (!finalPhases || finalPhases.length === 0) {
      if (finalTargetLocations.length > 0) {
        const isUniv = finalTargetLocations.some(l => !l.phase || ['universal', 'all', 'all groups'].includes(l.phase.toLowerCase()));
        if (isUniv) {
          finalPhases = ['All'];
        } else {
          const phSet = new Set();
          for (const loc of finalTargetLocations) {
            if (loc.phase) {
              phSet.add(loc.phase);
              if (Array.isArray(loc.blocks)) {
                loc.blocks.forEach(b => {
                  if (b && b !== 'ALL' && b !== 'All Blocks') {
                    phSet.add(b);
                    phSet.add(`Block ${b}`);
                  }
                });
              }
            }
          }
          finalPhases = Array.from(phSet);
        }
      } else {
        finalPhases = ['All'];
      }
    }

    let imageUrl = null;
    if (image && image.startsWith('data:image')) {
      try {
        const result = await cloudinary.uploader.upload(image, {
          folder: 'anytime_help/announcements',
          transformation: [{ quality: 'auto', fetch_format: 'auto', width: 800, crop: 'limit' }]
        });
        imageUrl = result.secure_url;
      } catch (err) {
        console.error('Cloudinary upload error:', err);
        imageUrl = image; // fallback
      }
    } else if (image) {
      imageUrl = image;
    }

    const newAnnouncement = new Announcement({
      title: title || (imageUrl ? 'Notice' : ''),
      message: message || '',
      createdBy: req.user.id,
      creatorName: creatorName || req.user.role,
      creatorId: creatorId || '',
      phases: finalPhases,
      targetLocations: finalTargetLocations,
      targetAudience: targetAudience || 'All',
      image: imageUrl
    });

    const announcement = await newAnnouncement.save();
    
    const io = req.app.get('io');
    if (io) {
      io.emit('announcement_changed', { action: 'create', data: announcement });
    }

    try {
      // Find users to notify
      let userQuery = {};
      const targetPhases = finalPhases || [];
      
      let rolesToNotify = [];
      let isAll = false;
      
      if (targetPhases.includes('All')) {
        isAll = true;
      }

      // Strict routing based on frontend options (Resident(All) vs RWA(Members))
      if (targetAudience === 'Members' || targetPhases.includes('Members')) {
        rolesToNotify = ['Member', 'Staff', 'Admin', 'SubAdmin'];
      } else {
        // 'All' (Resident)
        rolesToNotify = ['Resident', 'Member'];
      }
      
      if (rolesToNotify.length > 0) {
        userQuery.role = { $in: rolesToNotify };
      } else if (isAll) {
        userQuery.role = { $in: ['Resident', 'Member', 'Staff', 'Admin', 'SubAdmin', 'PaidStaff'] };
      } else {
        userQuery.role = { $in: ['Resident', 'Member', 'Staff', 'Admin', 'SubAdmin'] };
      }

      // Location targeting: If targetLocations specified, route directly to those phases and blocks
      if (finalTargetLocations && finalTargetLocations.length > 0) {
        const isUniversalLoc = finalTargetLocations.some(l => !l.phase || ['universal', 'all', 'all groups'].includes(l.phase.toLowerCase()));
        
        if (!isUniversalLoc) {
          const locConditions = [];
          
          for (const loc of finalTargetLocations) {
            const locPhase = (loc.phase || '').trim();
            if (!locPhase) continue;
            
            let phaseCond;
            if (locPhase.toLowerCase().includes('sushant lok 2')) {
              phaseCond = {
                $or: [
                  { phase: { $regex: /Sushant Lok 2/i } },
                  { address: { $regex: /Sushant Lok 2/i } }
                ]
              };
            } else if (locPhase.toLowerCase().includes('sushant lok 3')) {
              phaseCond = {
                $or: [
                  { phase: { $regex: /Sushant Lok 3/i } },
                  { address: { $regex: /Sushant Lok 3/i } }
                ]
              };
            } else {
              const esc = locPhase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              phaseCond = {
                $or: [
                  { phase: new RegExp('^' + esc, 'i') },
                  { address: new RegExp(esc, 'i') }
                ]
              };
            }

            const isAllBlocks = !loc.blocks || loc.blocks.length === 0 || loc.blocks.includes('ALL') || loc.blocks.includes('All Blocks');
            
            if (isAllBlocks) {
              locConditions.push(phaseCond);
            } else {
              const blkRegexPatterns = loc.blocks.map(b => {
                const cleanB = b.replace(/^block\s*/i, '').trim();
                return `(\\bBlock\\s*${cleanB}\\b|\\b${cleanB}-?\\d+)`;
              }).join('|');

              const blockCond = {
                $or: [
                  { block: { $in: loc.blocks.map(b => b.replace(/^block\s*/i, '').trim()) } },
                  { address: { $regex: new RegExp(blkRegexPatterns, 'i') } }
                ]
              };

              locConditions.push({
                $and: [phaseCond, blockCond]
              });
            }
          }

          if (locConditions.length > 0) {
            userQuery.$and = userQuery.$and || [];
            userQuery.$and.push({ $or: locConditions });
          }
        }
      } else {
        const locationPhases = targetPhases.filter(p => p !== 'All' && p !== 'Resident' && p !== 'Members' && p !== 'Staff' && p !== 'Resident + Member');
        
        if (locationPhases.length > 0) {
          const phaseOrConditions = [];
          
          for (const lp of locationPhases) {
            const lpLower = lp.toLowerCase();
            
            if (lpLower.includes('c,d,e') || lpLower.includes('option 1')) {
              phaseOrConditions.push({ phase: { $regex: /Sushant Lok 2 - C,D,E|Sushant Lok 2 Option 1/i } });
              phaseOrConditions.push({
                $or: [
                  { block: { $in: ['C', 'D', 'E', 'c', 'd', 'e'] } },
                  { address: { $regex: /\bBlock\s*[CDE]\b|\b[CDE]-?\d+/i } }
                ]
              });
            } else if (lpLower.includes('f,g') || lpLower.includes('option 2')) {
              phaseOrConditions.push({ phase: { $regex: /Sushant Lok 2 - F,G|Sushant Lok 2 Option 2/i } });
              phaseOrConditions.push({
                $or: [
                  { block: { $in: ['F', 'G', 'f', 'g'] } },
                  { address: { $regex: /\bBlock\s*[FG]\b|\b[FG]-?\d+/i } }
                ]
              });
            } else if (lpLower === 'sushant lok 2') {
              phaseOrConditions.push({ phase: { $regex: /Sushant Lok 2/i } });
              phaseOrConditions.push({ address: { $regex: /Sushant Lok 2/i } });
            } else if (lpLower.includes('sushant lok 3')) {
              phaseOrConditions.push({ phase: { $regex: /Sushant Lok 3/i } });
              phaseOrConditions.push({ address: { $regex: /Sushant Lok 3/i } });
            } else {
              const singleBlockMatch = lp.match(/^(?:Block\s*)?([A-H](?:1)?)$/i);
              if (singleBlockMatch) {
                const blk = singleBlockMatch[1].toUpperCase();
                phaseOrConditions.push({ block: new RegExp(`^${blk}$`, 'i') });
                phaseOrConditions.push({ address: new RegExp(`\\bBlock\\s*${blk}\\b|\\b${blk}-?\\d+`, 'i') });
              } else {
                const escaped = lp.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                phaseOrConditions.push({ phase: new RegExp('^' + escaped, 'i') });
              }
            }
          }
          
          phaseOrConditions.push({ phase: { $in: [null, '', undefined] } });
          phaseOrConditions.push({ phase: { $exists: false } });

          userQuery.$and = userQuery.$and || [];
          userQuery.$and.push({ $or: phaseOrConditions });
        }
      }
      
      userQuery.expoPushToken = { $exists: true, $ne: '' };

      const User = require('../models/User');
      
      // Increment the unread_notifications for all matching users
      await User.updateMany(userQuery, { $inc: { unread_notifications: 1 } });

      // Retrieve to get push tokens and new unread counts
      const usersToNotify = await User.find(userQuery).select('expoPushToken unread_notifications');
      const tokenObjects = usersToNotify.map(u => ({
        to: u.expoPushToken,
        badge: u.unread_notifications
      }));
      
      if (tokenObjects.length > 0) {
        const { sendPushNotifications } = require('../utils/push');
        sendPushNotifications(tokenObjects, '📢 ' + title, message, { type: 'announcement', id: announcement._id });
      }
    } catch (pushErr) {
      console.error('Push notification error:', pushErr.message);
    }

    res.json(announcement);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   DELETE api/announcements/:id
// @desc    Delete (or deactivate) an announcement
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  const hasAccess = req.user.role === 'Admin' || req.user.role === 'Staff' || 
    ((req.user.role === 'SubAdmin' || req.user.role === 'Member') && req.user.permissions && req.user.permissions.some(p => p.startsWith('Announcements')));
  if (!hasAccess) {
    return res.status(403).json({ msg: 'Authorization denied' });
  }

  try {
    const announcement = await Announcement.findById(req.params.id);

    if (!announcement) {
      return res.status(404).json({ msg: 'Announcement not found' });
    }

    // In a real app we might just set active to false
    await announcement.deleteOne();
      
    const io = req.app.get('io');
    if (io) {
      io.emit('announcement_changed', { action: 'delete', id: req.params.id });
    }

    res.json({ msg: 'Announcement removed' });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Announcement not found' });
    }
    res.status(500).send('Server Error');
  }
});

// @route   PUT api/announcements/:id
// @desc    Update an announcement
// @access  Private
router.put('/:id', auth, async (req, res) => {
  const hasAccess = req.user.role === 'Admin' || req.user.role === 'Staff' || 
    ((req.user.role === 'SubAdmin' || req.user.role === 'Member') && req.user.permissions && req.user.permissions.some(p => p.startsWith('Announcements')));
  if (!hasAccess) {
    return res.status(403).json({ msg: 'Authorization denied' });
  }

  const { title, message, phases, targetAudience, image, targetLocations } = req.body;

  try {
    let announcement = await Announcement.findById(req.params.id);
    if (!announcement) {
      return res.status(404).json({ msg: 'Announcement not found' });
    }

    if (title) announcement.title = title;
    if (message !== undefined) announcement.message = message;
    if (phases !== undefined) announcement.phases = phases;
    if (targetLocations !== undefined) announcement.targetLocations = targetLocations;
    if (targetAudience !== undefined) announcement.targetAudience = targetAudience;
    if (image !== undefined) {
      if (image && image.startsWith('data:image')) {
        try {
          const result = await cloudinary.uploader.upload(image, {
            folder: 'anytime_help/announcements',
            transformation: [{ quality: 'auto', fetch_format: 'auto', width: 800, crop: 'limit' }]
          });
          announcement.image = result.secure_url;
        } catch (uploadErr) {
          console.error('Cloudinary update upload error:', uploadErr);
          announcement.image = image;
        }
      } else {
        announcement.image = image;
      }
    }

    await announcement.save();

    const io = req.app.get('io');
    if (io) {
      io.emit('announcement_changed', { action: 'update', data: announcement });
    }

    res.json({ msg: 'Announcement updated successfully', announcement });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Announcement not found' });
    }
    res.status(500).send('Server Error');
  }
});

module.exports = router;
