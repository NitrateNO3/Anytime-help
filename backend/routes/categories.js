const express = require('express');
const router = express.Router();
const Category = require('../models/Category');
const auth = require('../middleware/auth');

// GET /api/categories - Get all categories
router.get('/', async (req, res) => {
  try {
    const categories = await Category.find().sort({ createdAt: -1 });
    res.json(categories);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// POST /api/categories - Create a category (admin only ideally, but we'll secure later or use auth)
router.post('/', auth, async (req, res) => {
  const { title, icon, color, bgColor, subCategories } = req.body;

  try {
    let category = new Category({
      title,
      icon,
      color,
      bgColor,
      subCategories
    });

    await category.save();
    res.json(category);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// PUT /api/categories/:id - Update a category
router.put('/:id', auth, async (req, res) => {
  const { title, icon, color, bgColor, subCategories } = req.body;

  try {
    let category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ msg: 'Category not found' });

    if (title) category.title = title;
    if (icon) category.icon = icon;
    if (color) category.color = color;
    if (bgColor) category.bgColor = bgColor;
    if (subCategories) category.subCategories = subCategories;

    await category.save();
    res.json(category);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// DELETE /api/categories/:id - Delete a category
router.delete('/:id', auth, async (req, res) => {
  try {
    let category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ msg: 'Category not found' });

    await Category.findByIdAndDelete(req.params.id);
    res.json({ msg: 'Category removed' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
