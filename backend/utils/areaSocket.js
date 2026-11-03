// Area-aware socket.io.
//
// Each socket joins one room describing which area's live events it gets:
//   area_<id>    logged-in user of that area / SuperAdmin viewing that area
//   area_all     SuperAdmin with no area selected (gets every area's events)
//   area_legacy  client that did not identify itself (old app builds, login
//                screens). Gets only the original/default area's events, since
//                every pre-multi-area user belongs to it.
//
// Routes keep calling `req.app.get('io').emit(...)`; the wrapper sends that
// only to the current request's area. `io.to(room)` (chat rooms) is untouched.
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { currentArea, getDefaultArea, runUnscoped, toObjectId } = require('./areaContext');

function attachAreaRooms(io) {
  io.use(async (socket, next) => {
    let room = 'area_legacy';
    try {
      const { auth = {}, query = {} } = socket.handshake;
      const token = auth.token || query.token;
      if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await runUnscoped(() => User.findById(decoded.user.id).select('role area').lean().exec());
        if (user && user.role === 'SuperAdmin') {
          const areaId = toObjectId(auth.areaId || query.areaId);
          room = areaId ? `area_${areaId}` : 'area_all';
        } else if (user) {
          room = user.area ? `area_${user.area}` : 'area_none';
        }
      }
    } catch (_) { /* bad token: treat as legacy */ }
    socket.join(room);
    next();
  });
}

function areaScopedIo(io) {
  return new Proxy(io, {
    get(target, prop) {
      if (prop === 'emit') {
        return (event, ...args) => {
          const area = currentArea() || getDefaultArea();
          if (!area) return target.emit(event, ...args);
          const rooms = [`area_${area}`, 'area_all'];
          const def = getDefaultArea();
          if (def && String(def) === String(area)) rooms.push('area_legacy');
          return target.to(rooms).emit(event, ...args);
        };
      }
      const value = target[prop];
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

module.exports = { attachAreaRooms, areaScopedIo };
