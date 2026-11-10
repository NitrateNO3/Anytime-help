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

// Officials are listed in EVERY area (anyone can find, follow and read them once
// following). Hidden (inactive) officials are visible only to the Super Admin and
// the official themself.
const isVisibleTo = (req, o) => {
  if (!o) return false;
  if (isSuperAdmin(req) || isOwnOfficial(req, o)) return true;
  return !!o.is_active;
};

// An official's STATUS is shown only in the areas the official was created for
// (all_areas, or the caller's area is in `areas`).
const isInStatusArea = (req, o) => {
  if (!o) return false;
  if (o.all_areas !== false) return true;
  return !!req.areaId && (o.areas || []).some(a => String(a._id || a) === String(req.areaId));
};

module.exports = { isSuperAdmin, normalizePhone, isOwnOfficial, canPostAs, isVisibleTo, isInStatusArea };
