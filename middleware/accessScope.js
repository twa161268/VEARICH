function normalizeRole(role) {
  return String(role || '').trim().toLowerCase();
}

function isAdmin(req) {
  return normalizeRole(req.session?.role) === 'admin';
}

function isStockist(req) {
  return normalizeRole(req.session?.role) === 'stokist';
}

function sessionStkid(req) {
  return req.session?.stkid || null;
}

// For stockist users the scope is always their own stkid.
// For admin, an optional selectedStkid may be supplied. null means ALL.
function scopedStkid(req, selectedStkid) {
  if (isAdmin(req)) return selectedStkid || null;
  return sessionStkid(req);
}

function requireStockistScope(req, selectedStkid) {
  const stkid = scopedStkid(req, selectedStkid);
  if (!stkid) {
    const err = new Error('Stockist harus dipilih.');
    err.status = 422;
    throw err;
  }
  return stkid;
}

module.exports = {
  normalizeRole,
  isAdmin,
  isStockist,
  sessionStkid,
  scopedStkid,
  requireStockistScope,
};
