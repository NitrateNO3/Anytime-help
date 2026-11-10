// Shared access rules for Officials (used by the officials and stories routes).

// Only the platform Super Admin may manage officials (area admins / sub-admins may not)
const isSuperAdmin = (req) => !!req.isSuperAdmin;

// Compare phone numbers on their last 10 digits (ignores +91, spaces, dashes)
const normalizePhone = (v) => String(v || '').replace(/\D/g, '').slice(-10);

// The logged-in user IS this official: their login number matches the phone the
// Super Admin saved on the official. Such a user may post updates and stories as them.
const isOwnOfficial = (req, o) => {
  const target = normalizePhone(o && o.phone);
  if (target.length < 10 || !req.user) return false;
  const mine = [req.user.phone_number, ...(req.user.login_phones || [])].map(normalizePhone);
  return mine.includes(target);
};

const canPostAs = (req, o) => isSuperAdmin(req) || isOwnOfficial(req, o);

// Officials visible in the caller's area: marked for all areas, or this area is listed.
// The Super Admin sees every official; the official themself always sees their own page.
const visibilityFilter = (req) => {
  if (isSuperAdmin(req)) return {};
  const or = [{ all_areas: { $ne: false } }];
  if (req.areaId) or.push({ areas: req.areaId });
  return { $or: or };
};

const isVisibleTo = (req, o) => {
  if (!o) return false;
  if (isSuperAdmin(req) || isOwnOfficial(req, o)) return true;
  if (!o.is_active) return false;
  if (o.all_areas !== false) return true;
  return !!req.areaId && (o.areas || []).some(a => String(a._id || a) === String(req.areaId));
};

module.exports = { isSuperAdmin, normalizePhone, isOwnOfficial, canPostAs, visibilityFilter, isVisibleTo };
