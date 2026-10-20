const { getLaDurationData } = require('../services/laRecordingService');
const { durationBucket } = require('../utils/laRecordings');
const { campaignFamily } = require('../utils/campaignAccess');

const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(`${value}T00:00:00Z`)) &&
  new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

exports.getDurationSales = async (req, res, next) => {
  try {
    const { startDate, endDate, minDuration } = req.query;
    let dialer = req.query.dialer || 'all';
    if (!validDate(startDate) || !validDate(endDate) || startDate > endDate ||
        !['all', 'medicare', 'pharmacy'].includes(dialer) ||
        (req.query.page !== undefined && (!/^[1-9]\d*$/.test(req.query.page) || !Number.isSafeInteger(Number(req.query.page)))) ||
        (minDuration !== undefined && !['800', '1000', '1500'].includes(minDuration))) {
      return res.status(400).json({ success: false, message: 'Invalid date, dialer or duration filter.' });
    }
    if (req.user.role === 'QA Agent') {
      const allowed = campaignFamily(req.user.campaign_name);
      if (!['medicare', 'pharmacy'].includes(allowed) || (dialer !== 'all' && dialer !== allowed)) {
        return res.status(403).json({ success: false, message: 'Access denied for this dialer.' });
      }
      dialer = allowed;
    }
    const { counts, recordings } = await getLaDurationData(startDate, endDate, dialer);
    if (minDuration === undefined) {
      return res.json({ success: true, data: counts });
    }
    const matches = recordings.filter(rec => durationBucket(rec.call_duration_seconds) === minDuration);
    const page = Math.min(Number(req.query.page) || 1, Math.max(1, Math.ceil(matches.length / 50)));
    res.json({ success: true, data: matches.slice((page - 1) * 50, page * 50),
      total: matches.length, page, pending: counts.pending, failed: counts.failed,
      didReady: counts.didReady, didRefreshing: counts.didRefreshing, didSyncFailed: counts.didSyncFailed });
  } catch (error) {
    next(error);
  }
};
