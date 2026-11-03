// Mongoose plugin that makes a model area-aware (multi-tenant).
//
// - Adds an indexed `area` field that defaults to the current request's area,
//   so documents created through save/create/insertMany land in the right area.
// - Adds `{ area: <current> }` to every query when the request is scoped.
//
// See utils/areaContext.js for how the current area is decided.
const mongoose = require('mongoose');
const { currentArea, getDefaultArea } = require('../../utils/areaContext');

const QUERY_OPS = [
  'find', 'findOne', 'countDocuments', 'distinct',
  'findOneAndUpdate', 'findOneAndDelete', 'findOneAndReplace',
  'updateOne', 'updateMany', 'replaceOne', 'deleteOne', 'deleteMany',
];

module.exports = function areaScope(schema, options = {}) {
  schema.add({
    area: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Area',
      index: true,
      default: () => currentArea() || getDefaultArea() || undefined,
    },
  });

  // `extraFilter(area)` lets a model widen the scope, e.g. User keeps
  // SuperAdmin accounts visible so populated `created_by` refs still resolve.
  const buildFilter = options.extraFilter
    ? (area) => ({ $or: [{ area }, options.extraFilter(area)] })
    : (area) => ({ area });

  schema.pre(QUERY_OPS, { document: false, query: true }, function () {
    const area = currentArea();
    if (area) this.and([buildFilter(area)]);
  });

  schema.pre('aggregate', function () {
    const area = currentArea();
    if (area) this.pipeline().unshift({ $match: buildFilter(area) });
  });

  schema.pre('bulkWrite', function (ops) {
    const area = currentArea();
    if (!area || !Array.isArray(ops)) return;
    for (const op of ops) {
      const key = Object.keys(op)[0];
      const body = op[key];
      if (!body) continue;
      if (body.filter) body.filter = { $and: [body.filter, buildFilter(area)] };
      if (key === 'insertOne' && body.document && !body.document.area) body.document.area = area;
    }
  });
};
