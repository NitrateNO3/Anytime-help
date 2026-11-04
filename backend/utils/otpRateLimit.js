// In-memory limits for OTP SMS, so nobody can flood a number with OTP messages
// (or burn SMS credits) by pressing "Send OTP" again and again.
//
//   per number: 3 SMS back to back, then a 60 s wait, then 3 more, and so on
//               (and never more than 15 per hour)
//   per IP:     at most 30 SMS per hour
//
// Call takeSmsSlot() right before an SMS is actually sent. It returns null
// when sending is allowed (and counts it), or a message to show the user.
// smsCooldown() tells the client how many seconds to wait before the next send.

const BURST_SIZE = 3;
const BURST_COOLDOWN_MS = 60 * 1000;
const BURST_RESET_MS = 10 * 60 * 1000; // a burst left idle this long starts over
const PHONE_MAX_PER_HOUR = 15;
const IP_MAX_PER_HOUR = 30;
const HOUR_MS = 60 * 60 * 1000;

const phoneSends = new Map(); // phone -> [timestamps] (last hour)
const phoneBurst = new Map(); // phone -> { count, last, lockedUntil }
const ipSends = new Map(); // ip -> [timestamps]

const recent = (map, key, now) => (map.get(key) || []).filter((t) => now - t < HOUR_MS);

const clientIp = (req) =>
  String((req.headers && req.headers['x-forwarded-for']) || '').split(',')[0].trim() || req.ip || 'unknown';

// Seconds left before this number may request another OTP (0 = allowed now)
function smsCooldown(phone10) {
  const burst = phoneBurst.get(String(phone10));
  if (!burst) return 0;
  return Math.max(0, Math.ceil((burst.lockedUntil - Date.now()) / 1000));
}

function takeSmsSlot(phone10, req) {
  const key = String(phone10);
  const now = Date.now();
  const phoneTimes = recent(phoneSends, key, now);
  const ip = clientIp(req);
  const ipTimes = recent(ipSends, ip, now);

  let burst = phoneBurst.get(key) || { count: 0, last: 0, lockedUntil: 0 };
  if (now < burst.lockedUntil) {
    return `Please wait ${Math.ceil((burst.lockedUntil - now) / 1000)}s before requesting another OTP.`;
  }
  if (phoneTimes.length >= PHONE_MAX_PER_HOUR) {
    const wait = Math.ceil((HOUR_MS - (now - phoneTimes[0])) / 60000);
    return `Too many OTP requests for this number. Try again in ${wait} min.`;
  }
  if (ipTimes.length >= IP_MAX_PER_HOUR) {
    return 'Too many OTP requests. Please try again later.';
  }

  // Cooldown finished, or the burst went idle: start a fresh set of 3
  if (burst.count >= BURST_SIZE || now - burst.last > BURST_RESET_MS) burst = { count: 0, last: 0, lockedUntil: 0 };
  burst.count += 1;
  burst.last = now;
  if (burst.count >= BURST_SIZE) burst.lockedUntil = now + BURST_COOLDOWN_MS;
  phoneBurst.set(key, burst);

  phoneSends.set(key, [...phoneTimes, now]);
  ipSends.set(ip, [...ipTimes, now]);
  return null;
}

// Drop old entries now and then so the maps don't grow forever
setInterval(() => {
  const now = Date.now();
  for (const map of [phoneSends, ipSends]) {
    for (const [key, times] of map) {
      const keep = times.filter((t) => now - t < HOUR_MS);
      if (keep.length) map.set(key, keep);
      else map.delete(key);
    }
  }
  for (const [key, burst] of phoneBurst) {
    if (now > burst.lockedUntil && now - burst.last > BURST_RESET_MS) phoneBurst.delete(key);
  }
}, 10 * 60 * 1000).unref();

module.exports = { takeSmsSlot, smsCooldown };
