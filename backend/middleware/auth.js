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

    // A SuperAdmin acts as a full Admin inside whichever area it selected
    // (x-area-id header, resolved by areaContext middleware). Present it to
    // routes as role 'Admin' so every existing admin check passes; the User
    // model's pre-save hook makes sure this in-memory role is never persisted.
    if (user.role === 'SuperAdmin') {
      user.$locals.isSuperAdmin = true;
      user.role = 'Admin';
      req.isSuperAdmin = true;
    }

    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ msg: 'Token is not valid' });
  }
};
