// Guards banner create/edit/delete routes: only a logged-in Admin (SuperAdmin
// counts as Admin, see middleware/auth.js) or a SubAdmin holding one of the
// given permissions may change banners. Reading banners stays public.
const auth = require('./auth');

module.exports = function bannerAdmin(allowedPerms = []) {
  const checkRole = (req, res, next) => {
    const user = req.user;
    if (user.role === 'Admin') return next();
    if (user.role === 'SubAdmin' && (user.permissions || []).some((p) => allowedPerms.includes(p))) return next();
    return res.status(403).json({ msg: 'Not allowed to manage banners' });
  };
  return [auth, checkRole];
};
