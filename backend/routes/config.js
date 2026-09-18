const express = require('express');
const router = express.Router();

// @route   GET api/config
// @desc    Get app configuration like minimum version for force update
// @access  Public
router.get('/', (req, res) => {
  res.json({
    min_version: "1.0.2",
    latest_version: "1.0.2",
    play_store_url: "https://play.google.com/store/apps/details?id=com.aman_mirza.app"
  });
});

module.exports = router;
