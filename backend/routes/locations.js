const express = require('express');
const router = express.Router();
const Location = require('../models/Location');
const auth = require('../middleware/auth');

// Helper to check admin/subadmin permissions
const checkLocationAccess = (user) => {
  if (!user) return false;
  if (user.role === 'Admin') return true;
  if (user.role === 'SubAdmin') {
    const perms = user.permissions || [];
    return perms.includes('Locations') || perms.includes('Overview') || perms.includes('Residents');
  }
  return false;
};

// @route   GET api/locations
// @desc    Get all locations (supports search, state, city filtering, public access for active items)
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { search, state, city, area, pincode, all } = req.query;
    let query = {};

    // Only show active locations to public/app users unless specifically requested
    if (all !== 'true') {
      query.is_active = true;
    }

    if (state && state.trim()) {
      query.state = { $regex: new RegExp(`^${state.trim()}$`, 'i') };
    }
    if (city && city.trim()) {
      query.city = { $regex: new RegExp(`^${city.trim()}$`, 'i') };
    }
    if (area && area.trim()) {
      query.area = { $regex: new RegExp(`^${area.trim()}$`, 'i') };
    }
    if (pincode && pincode.trim()) {
      query.pincode = pincode.trim();
    }

    if (search && search.trim()) {
      const searchRegex = { $regex: search.trim(), $options: 'i' };
      query.$or = [
        { state: searchRegex },
        { city: searchRegex },
        { area: searchRegex },
        { pincode: searchRegex }
      ];
    }

    const locations = await Location.find(query)
      .sort({ state: 1, city: 1, area: 1, createdAt: -1 });

    res.json({
      success: true,
      count: locations.length,
      locations
    });
  } catch (error) {
    console.error('Error fetching locations:', error);
    res.status(500).json({ success: false, message: 'Server error while fetching locations' });
  }
});

// @route   GET api/locations/hierarchy
// @desc    Get structured hierarchy of States -> Cities -> Areas -> Pincodes for mobile app dropdowns
// @access  Public
router.get('/hierarchy', async (req, res) => {
  try {
    const locations = await Location.find({ is_active: true })
      .sort({ state: 1, city: 1, area: 1 });

    // Group into state -> city -> areas
    const stateMap = new Map();

    locations.forEach(loc => {
      const stateName = (loc.state || '').trim();
      const cityName = (loc.city || '').trim();
      const areaName = (loc.area || '').trim();
      const pincode = (loc.pincode || '').trim();

      if (!stateName || !cityName || !areaName) return;

      if (!stateMap.has(stateName)) {
        stateMap.set(stateName, new Map());
      }

      const cityMap = stateMap.get(stateName);
      if (!cityMap.has(cityName)) {
        cityMap.set(cityName, []);
      }

      cityMap.get(cityName).push({
        _id: loc._id,
        area: areaName,
        pincode: pincode,
        state: stateName,
        city: cityName
      });
    });

    const hierarchy = [];
    stateMap.forEach((cityMap, state) => {
      const cities = [];
      cityMap.forEach((areas, city) => {
        cities.push({
          city,
          areas
        });
      });
      hierarchy.push({
        state,
        cities
      });
    });

    res.json({
      success: true,
      data: hierarchy
    });
  } catch (error) {
    console.error('Error fetching location hierarchy:', error);
    res.status(500).json({ success: false, message: 'Server error while fetching location hierarchy' });
  }
});

// @route   POST api/locations
// @desc    Admin manually enters a new State, City, Area, Pincode
// @access  Private (Admin / SubAdmin)
router.post('/', auth, async (req, res) => {
  try {
    if (!checkLocationAccess(req.user)) {
      return res.status(403).json({ success: false, message: 'Permission denied' });
    }

    const { state, city, area, pincode } = req.body;

    if (!state || !state.trim()) {
      return res.status(400).json({ success: false, message: 'State is required' });
    }
    if (!city || !city.trim()) {
      return res.status(400).json({ success: false, message: 'City is required' });
    }
    if (!area || !area.trim()) {
      return res.status(400).json({ success: false, message: 'Area is required' });
    }
    if (!pincode || !pincode.trim()) {
      return res.status(400).json({ success: false, message: 'Pincode is required' });
    }

    const cleanState = state.trim();
    const cleanCity = city.trim();
    const cleanArea = area.trim();
    const cleanPincode = pincode.trim();

    // Check if duplicate already exists
    const existing = await Location.findOne({
      state: { $regex: new RegExp(`^${cleanState}$`, 'i') },
      city: { $regex: new RegExp(`^${cleanCity}$`, 'i') },
      area: { $regex: new RegExp(`^${cleanArea}$`, 'i') },
      pincode: cleanPincode
    });

    if (existing) {
      if (!existing.is_active) {
        existing.is_active = true;
        await existing.save();
        return res.json({
          success: true,
          message: 'Location reactivated successfully',
          location: existing
        });
      }
      return res.status(400).json({
        success: false,
        message: 'This exact location (State, City, Area, Pincode) already exists.'
      });
    }

    const newLocation = new Location({
      state: cleanState,
      city: cleanCity,
      area: cleanArea,
      pincode: cleanPincode,
      is_active: true,
      created_by: req.user.id
    });

    await newLocation.save();

    // Emit live socket event
    const io = req.app.get('io');
    if (io) {
      io.emit('location_created', newLocation);
    }

    res.status(201).json({
      success: true,
      message: 'Location added successfully',
      location: newLocation
    });
  } catch (error) {
    console.error('Error creating location:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error creating location' });
  }
});

// @route   PUT api/locations/:id
// @desc    Update a location
// @access  Private (Admin / SubAdmin)
router.put('/:id', auth, async (req, res) => {
  try {
    if (!checkLocationAccess(req.user)) {
      return res.status(403).json({ success: false, message: 'Permission denied' });
    }

    const { state, city, area, pincode, is_active } = req.body;
    let location = await Location.findById(req.params.id);

    if (!location) {
      return res.status(404).json({ success: false, message: 'Location not found' });
    }

    if (state !== undefined) location.state = state.trim();
    if (city !== undefined) location.city = city.trim();
    if (area !== undefined) location.area = area.trim();
    if (pincode !== undefined) location.pincode = pincode.trim();
    if (is_active !== undefined) location.is_active = Boolean(is_active);

    await location.save();

    const io = req.app.get('io');
    if (io) {
      io.emit('location_updated', location);
    }

    res.json({
      success: true,
      message: 'Location updated successfully',
      location
    });
  } catch (error) {
    console.error('Error updating location:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error updating location' });
  }
});

// @route   DELETE api/locations/:id
// @desc    Delete a location
// @access  Private (Admin / SubAdmin)
router.delete('/:id', auth, async (req, res) => {
  try {
    if (!checkLocationAccess(req.user)) {
      return res.status(403).json({ success: false, message: 'Permission denied' });
    }

    const location = await Location.findById(req.params.id);
    if (!location) {
      return res.status(404).json({ success: false, message: 'Location not found' });
    }

    await Location.findByIdAndDelete(req.params.id);

    const io = req.app.get('io');
    if (io) {
      io.emit('location_deleted', { id: req.params.id });
    }

    res.json({
      success: true,
      message: 'Location deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting location:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error deleting location' });
  }
});

module.exports = router;
