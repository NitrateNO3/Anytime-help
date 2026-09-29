const cacheMap = new Map();

const cache = (durationSeconds) => {
  return (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }
    
    // Construct cache key based on URL and query params
    const key = '__express__' + (req.originalUrl || req.url);
    const cachedItem = cacheMap.get(key);
    
    if (cachedItem && cachedItem.expiry > Date.now()) {
      return res.send(cachedItem.body);
    }
    
    // If expired, clean up
    if (cachedItem) {
      cacheMap.delete(key);
    }
    
    // Intercept res.send
    res.sendResponse = res.send;
    res.send = (body) => {
      // Cache the response
      cacheMap.set(key, {
        body: body,
        expiry: Date.now() + (durationSeconds * 1000)
      });
      res.sendResponse(body);
    };
    
    // Intercept res.json (Express typically calls res.send internally from res.json, but just in case)
    res.jsonResponse = res.json;
    res.json = (body) => {
      cacheMap.set(key, {
        body: body,
        expiry: Date.now() + (durationSeconds * 1000)
      });
      res.jsonResponse(body);
    };
    
    next();
  };
};

// Also export a method to clear cache manually if needed (e.g. after POST/PUT)
const clearCachePrefix = (prefix) => {
  for (const key of cacheMap.keys()) {
    if (key.includes(prefix)) {
      cacheMap.delete(key);
    }
  }
};

module.exports = { cache, clearCachePrefix };
