// Global middleware: decides which area (tenant) the request belongs to and
// runs the rest of the request inside that area context.
//
//   - Logged-in user            -> their own area (header is ignored)
//   - Logged-in SuperAdmin      -> area from `x-area-id` header (none = all areas)
//   - Not logged in             -> area from `x-area-id` header, if any
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const { als, toObjectId } = require('../utils/areaContext');

// Users that somehow have no area are locked to an area that cannot exist, so
// they see nothing instead of everything.
const NO_AREA = new mongoose.Types.ObjectId('000000000000000000000000');

module.exports = function areaContext(req, res, next) {
  const store = { area: null };

  als.run(store, async () => {
    const token = req.header('x-auth-token');
    const headerArea = toObjectId(req.header('x-area-id'));

    if (!token) {
      store.area = headerArea;
      return next();
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      // store.area is still null here, so this lookup is unscoped.
      const user = await User.findById(decoded.user.id).select('role area').lean();
      if (user) {
        store.area = user.role === 'SuperAdmin' ? headerArea : (user.area || NO_AREA);
        req.areaId = store.area;
      }
    } catch (_) {
      // Invalid token: leave unscoped; the auth middleware will reject it on
      // protected routes.
    }
    next();
  });
};
