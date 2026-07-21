import PurchaseRequest from "../models/purchaseRequest.js";

/**
 * Sole PurchaseRequest persistence layer — all PR writes must flow through here.
 */
export const createPurchaseRequest = async (payload, { session = null } = {}) => {
  if (Array.isArray(payload)) {
    if (session) {
      const created = [];
      for (const row of payload) {
        const [doc] = await PurchaseRequest.create([row], { session });
        created.push(doc);
      }
      return created;
    }
    return PurchaseRequest.create(payload);
  }
  if (session) {
    const [doc] = await PurchaseRequest.create([payload], { session });
    return doc;
  }
  return PurchaseRequest.create(payload);
};

export const findPurchaseRequestById = (id, { session = null, select = null } = {}) => {
  let q = PurchaseRequest.findById(id);
  if (select) q = q.select(select);
  if (session) q = q.session(session);
  return q;
};

export const findOnePurchaseRequest = (filter, { session = null, select = null } = {}) => {
  let q = PurchaseRequest.findOne(filter);
  if (select) q = q.select(select);
  if (session) q = q.session(session);
  return q;
};

export const findPurchaseRequests = (filter, { session = null, select = null } = {}) => {
  let q = PurchaseRequest.find(filter);
  if (select) q = q.select(select);
  if (session) q = q.session(session);
  return q;
};

export const savePurchaseRequest = async (pr, { session = null } = {}) => {
  if (session) return pr.save({ session });
  return pr.save();
};

export const updatePurchaseRequestById = async (id, update, { session = null } = {}) => {
  const opts = { new: true };
  if (session) opts.session = session;
  return PurchaseRequest.findByIdAndUpdate(id, update, opts);
};

export const updateOnePurchaseRequest = async (filter, update, { session = null } = {}) => {
  const opts = {};
  if (session) opts.session = session;
  return PurchaseRequest.updateOne(filter, update, opts);
};

export const updateManyPurchaseRequests = async (filter, update, { session = null } = {}) => {
  const opts = {};
  if (session) opts.session = session;
  return PurchaseRequest.updateMany(filter, update, opts);
};
