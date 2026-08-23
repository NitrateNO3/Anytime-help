const express = require('express');
const router = express.Router();
const Complaint = require('../models/Complaint');
const auth = require('../middleware/auth');

// POST /api/complaints
router.post('/', auth, async (req, res) => {
  try {
    const { title, description, location, category, department, priority, before_image } = req.body;
    
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
      }
      // Return the existing complaint so the frontend sees it as 1 complaint
      return res.status(200).json(existingComplaint);
    }

    // Otherwise, create a new complaint
    const complaint = new Complaint({
      title,
      description,
      location,
      category,
      department,
      priority,
      user: req.user.id,
      before_image: before_image || '',
    });
    const createdComplaint = await complaint.save();
    
    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.emit('complaint_changed', { action: 'create', data: createdComplaint });
    }

    res.status(201).json(createdComplaint);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// GET /api/complaints
router.get('/', auth, async (req, res) => {
  try {
    const { departmentId, page, limit, search, category, status } = req.query;
    let query = {};
    if (departmentId) {
      query.department = departmentId;
    }

    if (category) {
      query.category = category;
    }

    if (status) {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } }
      ];
    }

    // If Resident, only show their own complaints (or all if we want community +1)
    if (req.user.role === 'Resident') {
      query.user = req.user.id; 
    } else if (req.user.role === 'Staff') {
      // Staff only sees complaints for their assigned category
      if (req.user.assigned_category) {
        query.category = req.user.assigned_category;
      }
    }
    
    let complaintsQuery = Complaint.find(query).populate('user', 'name').sort({ created_at: -1 });
    
    if (page && limit) {
      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);
      const startIndex = (pageNum - 1) * limitNum;
      
      complaintsQuery = complaintsQuery.skip(startIndex).limit(limitNum);
      const complaints = await complaintsQuery;
      const total = await Complaint.countDocuments(query);
      const pending = await Complaint.countDocuments({ ...query, status: 'PENDING' });
      const inProgress = await Complaint.countDocuments({ ...query, status: 'IN_PROGRESS' });
      const resolved = await Complaint.countDocuments({ ...query, status: { $in: ['RESOLVED', 'DONE'] } });
      const hasMore = startIndex + complaints.length < total;
      
      return res.json({ complaints, total, hasMore, stats: { pending, inProgress, resolved } });
    }
    
    const complaints = await complaintsQuery;
    res.json(complaints);
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

    if (status) complaint.status = status;
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
