// For public read routes (banners): a request that names no area (no login
// token and no x-area-id header, e.g. an old app build) would otherwise be
// unscoped and get every area's data. Lock it to the original area instead,
// the same way utils/areaSocket.js treats unidentified sockets.
//
// A logged-in SuperAdmin with no area picked keeps the all-areas view. An
// invalid or stale token counts as not logged in.
const { currentArea, setCurrentArea, getDefaultArea } = require('../utils/areaContext');

module.exports = function requireAreaForPublic(req, res, next) {
  if (!currentArea() && req.areaUserRole !== 'SuperAdmin') {
    const def = getDefaultArea();
    if (def) setCurrentArea(def);
  }
  next();
};
