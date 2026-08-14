const express = require('express');
const router = express.Router();
const Department = require('../models/Department');

// GET /api/departments
router.get('/', async (req, res) => {
  try {
    const departments = await Department.find();
    res.json(departments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
