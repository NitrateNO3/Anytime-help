const express = require('express');
const router = express.Router();
const multer = require('multer');
const { uploadToS3, deleteFromS3 } = require('../utils/s3Uploader');
const PartnerPromo = require('../models/PartnerPromo');
const bannerAdmin = require('../middleware/bannerAdmin');
const requireAreaForPublic = require('../middleware/requireAreaForPublic');
const Area = require('../models/Area');
const { toObjectId } = require('../utils/areaContext');

// Who may change partner promos
const canManage = bannerAdmin(['Banners']);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Tell the promo's own area (it can differ from the request's area when a
// SuperAdmin picks another area in the form)
const notifySocket = (req, promo) => {
  try {
    const io = req.app.get('io');
    if (!io) return;
    io.emit('partner_promos_changed');
    if (promo && promo.area) io.to(`area_${promo.area}`).emit('partner_promos_changed');
  } catch (e) {
    console.error('Socket emit error:', e);
  }
};

// Points arrive as a JSON array, an array field, or newline separated text
const parsePoints = (raw) => {
  if (raw === undefined || raw === null) return undefined;
  let list = raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      list = Array.isArray(parsed) ? parsed : raw.split('\n');
    } catch (_) {
      list = raw.split('\n');
    }
  }
  if (!Array.isArray(list)) return [];
  return list.map((p) => String(p).trim()).filter(Boolean).slice(0, 6);
};

const toBool = (v) => v === true || v === 'true';

// A platform SuperAdmin may pick the area in the form (body.areaId); area
// admins always save into their own area (stamped by the areaScope plugin).
// Returns an error message, or null when fine.
const applyArea = async (req, doc) => {
  if (!req.isSuperAdmin || !req.body.areaId) return null;
  const id = toObjectId(req.body.areaId);
  if (!id || !(await Area.exists({ _id: id }))) return 'Selected area not found';
  doc.area = id;
  return null;
};

const applyFields = (doc, body) => {
  if (body.partnerName !== undefined) doc.partnerName = String(body.partnerName).trim();
  if (body.title !== undefined) doc.title = String(body.title).trim();
  if (body.description !== undefined) doc.description = String(body.description).trim();
  if (body.phone !== undefined) doc.phone = String(body.phone).trim();
  if (body.buttonText !== undefined) doc.buttonText = String(body.buttonText).trim();
  if (body.order !== undefined && body.order !== '') doc.order = Number(body.order) || 0;
  if (body.isActive !== undefined) doc.isActive = toBool(body.isActive);
  const points = parsePoints(body.points);
  if (points !== undefined) doc.points = points;
};

// @route   GET /api/partner-promos
// @desc    Active promos of the caller's area (?all=true for admins: include inactive)
// @access  Public
router.get('/', requireAreaForPublic, async (req, res) => {
  try {
    const query = req.query.all === 'true' ? {} : { isActive: true };
    const promos = await PartnerPromo.find(query).sort({ order: 1, createdAt: -1 });
    res.json(promos);
  } catch (err) {
    console.error('Error fetching partner promos:', err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   POST /api/partner-promos
// @desc    Create a promo (multipart, optional `image` file)
// @access  Admin
router.post('/', canManage, upload.single('image'), async (req, res) => {
  try {
    if (!String(req.body.title || '').trim()) {
      return res.status(400).json({ msg: 'Title is required' });
    }
    const promo = new PartnerPromo({});
    applyFields(promo, req.body);
    if (req.body.isActive === undefined) promo.isActive = true;
    const areaError = await applyArea(req, promo);
    if (areaError) return res.status(400).json({ msg: areaError });
    if (req.file) {
      const result = await uploadToS3(req.file.buffer, 'partner-promos');
      promo.url = result.secure_url;
      promo.public_id = result.public_id;
    }
    const saved = await promo.save();
    notifySocket(req, saved);
    res.status(201).json(saved);
  } catch (err) {
    console.error('Error creating partner promo:', err);
    res.status(500).json({ msg: 'Server error creating promo' });
  }
});

// @route   PUT /api/partner-promos/:id
// @desc    Update a promo; send removeImage=true to drop the image
// @access  Admin
router.put('/:id', canManage, upload.single('image'), async (req, res) => {
  try {
    const promo = await PartnerPromo.findById(req.params.id);
    if (!promo) return res.status(404).json({ msg: 'Promo not found' });

    applyFields(promo, req.body);
    if (!promo.title) return res.status(400).json({ msg: 'Title is required' });
    const areaError = await applyArea(req, promo);
    if (areaError) return res.status(400).json({ msg: areaError });

    if (req.file || toBool(req.body.removeImage)) {
      if (promo.public_id) await deleteFromS3(promo.public_id);
      promo.url = '';
      promo.public_id = '';
    }
    if (req.file) {
      const result = await uploadToS3(req.file.buffer, 'partner-promos');
      promo.url = result.secure_url;
      promo.public_id = result.public_id;
    }

    const updated = await promo.save();
    notifySocket(req, updated);
    res.json(updated);
  } catch (err) {
    console.error('Error updating partner promo:', err);
    res.status(500).json({ msg: 'Server error updating promo' });
  }
});

// @route   PATCH /api/partner-promos/:id/toggle
// @access  Admin
router.patch('/:id/toggle', canManage, async (req, res) => {
  try {
    const promo = await PartnerPromo.findById(req.params.id);
    if (!promo) return res.status(404).json({ msg: 'Promo not found' });
    promo.isActive = !promo.isActive;
    await promo.save();
    notifySocket(req);
    res.json(promo);
  } catch (err) {
    console.error('Error toggling partner promo:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   DELETE /api/partner-promos/:id
// @access  Admin
router.delete('/:id', canManage, async (req, res) => {
  try {
    const promo = await PartnerPromo.findById(req.params.id);
    if (!promo) return res.status(404).json({ msg: 'Promo not found' });
    if (promo.public_id) await deleteFromS3(promo.public_id);
    await PartnerPromo.deleteOne({ _id: promo._id });
    notifySocket(req);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting partner promo:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;
