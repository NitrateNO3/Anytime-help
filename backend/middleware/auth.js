const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async function (req, res, next) {
  const token = req.header('x-auth-token');
  if (!token) {
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Validate if the user still exists in the database
    const user = await User.findById(decoded.user.id);
    if (!user) {
      return res.status(401).json({ msg: 'User no longer exists, authorization denied' });
    }

    // Sub-Admin Read-Only Check
    if (user.role === 'SubAdmin' && req.method !== 'GET') {
      return res.status(403).json({ msg: 'Access Denied: Sub-Admins have read-only permissions.' });
    }

    req.user = decoded.user;
    next();
  } catch (err) {
    res.status(401).json({ msg: 'Token is not valid' });
  }
};
