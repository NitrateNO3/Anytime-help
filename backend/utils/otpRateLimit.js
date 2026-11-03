// In-memory limits for OTP SMS, so nobody can flood a number with OTP messages
// (or burn SMS credits) by pressing "Send OTP" again and again.
//
//   per number: at most 1 SMS every 60 s, and 5 per hour
//   per IP:     at most 30 SMS per hour
//
// Call takeSmsSlot() right before an SMS is actually sent. It returns null
// when sending is allowed (and counts it), or a message to show the user.

const PHONE_COOLDOWN_MS = 60 * 1000;
const PHONE_MAX_PER_HOUR = 5;
const IP_MAX_PER_HOUR = 30;
const HOUR_MS = 60 * 60 * 1000;

const phoneSends = new Map(); // phone -> [timestamps]
const ipSends = new Map(); // ip -> [timestamps]

const recent = (map, key, now) => (map.get(key) || []).filter((t) => now - t < HOUR_MS);

const clientIp = (req) =>
  String((req.headers && req.headers['x-forwarded-for']) || '').split(',')[0].trim() || req.ip || 'unknown';

function takeSmsSlot(phone10, req) {
  const now = Date.now();
  const phoneTimes = recent(phoneSends, phone10, now);
  const ip = clientIp(req);
  const ipTimes = recent(ipSends, ip, now);

  const last = phoneTimes[phoneTimes.length - 1];
  if (last && now - last < PHONE_COOLDOWN_MS) {
    const wait = Math.ceil((PHONE_COOLDOWN_MS - (now - last)) / 1000);
    return `Please wait ${wait}s before requesting another OTP.`;
  }
  if (phoneTimes.length >= PHONE_MAX_PER_HOUR) {
    const wait = Math.ceil((HOUR_MS - (now - phoneTimes[0])) / 60000);
    return `Too many OTP requests for this number. Try again in ${wait} min.`;
  }
  if (ipTimes.length >= IP_MAX_PER_HOUR) {
    return 'Too many OTP requests. Please try again later.';
  }

  phoneSends.set(phone10, [...phoneTimes, now]);
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
}, 10 * 60 * 1000).unref();

module.exports = { takeSmsSlot };
