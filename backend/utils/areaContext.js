// Per-request "current area" (tenant) context.
//
// Every HTTP request runs inside an AsyncLocalStorage store that holds the
// area the request belongs to. The areaScope mongoose plugin reads it to
// automatically filter queries and stamp new documents, so route handlers
// never have to pass the area around by hand.
//
//   area === null  -> no scoping (unauthenticated public routes, scripts,
//                     cron jobs, or a SuperAdmin who has not picked an area)
//   area === <id>  -> every scoped query is limited to that area
const { AsyncLocalStorage } = require('async_hooks');
const mongoose = require('mongoose');

const als = new AsyncLocalStorage();

// The first (original) area. Set on startup by utils/areaMigration.js and used
// as a fallback for documents created outside any area context (old app
// versions, scripts) so nothing ends up without an area.
let defaultAreaId = null;
const setDefaultArea = (id) => { defaultAreaId = toObjectId(id); };
const getDefaultArea = () => defaultAreaId;

const toObjectId = (value) => {
  if (!value) return null;
  if (value instanceof mongoose.Types.ObjectId) return value;
  const str = String(value).trim();
  return mongoose.Types.ObjectId.isValid(str) ? new mongoose.Types.ObjectId(str) : null;
};

const getStore = () => als.getStore();

const currentArea = () => {
  const store = als.getStore();
  return store && store.area ? store.area : null;
};

const setCurrentArea = (area) => {
  const store = als.getStore();
  if (store) store.area = toObjectId(area);
};

// Run fn with the given area as context. fn must start (await / exec) its
// queries inside the callback so they inherit the context.
const runWithArea = (area, fn) => als.run({ area: toObjectId(area) }, fn);

// Run fn without any area scoping (e.g. auth lookups, cross-area admin tasks).
const runUnscoped = (fn) => als.run({ area: null }, fn);

module.exports = { als, setDefaultArea, getDefaultArea, getStore, currentArea, setCurrentArea, runWithArea, runUnscoped, toObjectId };
