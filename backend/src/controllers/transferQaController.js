const axios = require('axios');

// Helper function to build the Google Sheet Webhook URL
const getWebhookUrl = () => process.env.GOOGLE_SHEET_WEBHOOK_URL;
const getWebhookSecret = () => process.env.GOOGLE_SHEET_SECRET;

/**
 * @desc    Get pending transfer QA records from Google Sheet
 * @route   GET /api/transfer-qa/pending
 * @access  Private
 */
const getPendingTransfers = async (req, res, next) => {
  try {
    const url = getWebhookUrl();
    const secret = getWebhookSecret();

    if (!url || !secret) {
      return res.status(500).json({ success: false, message: 'Google Sheet webhook configuration is missing.' });
    }

    const response = await axios.get(url, {
      params: {
        action: 'pending',
        secret: secret
      },
      timeout: 15000 // 15 seconds timeout
    });

    if (response.data && response.data.success) {
      return res.status(200).json({
        success: true,
        data: response.data.data || [],
        message: 'Pending transfers fetched successfully'
      });
    } else {
      return res.status(400).json({
        success: false,
        message: response.data?.message || 'Failed to fetch pending transfers from Google Sheet.'
      });
    }
  } catch (error) {
    console.error('Error fetching pending transfers:', error.message);
    // Determine if it was a timeout
    if (error.code === 'ECONNABORTED') {
      return res.status(504).json({ success: false, message: 'Request to Google Sheet timed out.' });
    }
    next(error);
  }
};

/**
 * @desc    Get reviewed transfer QA records from Google Sheet
 * @route   GET /api/transfer-qa/reviewed
 * @access  Private
 */
const getReviewedTransfers = async (req, res, next) => {
  try {
    const url = getWebhookUrl();
    const secret = getWebhookSecret();

    if (!url || !secret) {
      return res.status(500).json({ success: false, message: 'Google Sheet webhook configuration is missing.' });
    }

    const response = await axios.get(url, {
      params: {
        action: 'reviewed',
        secret: secret
      },
      timeout: 15000 // 15 seconds timeout
    });

    if (response.data && response.data.success) {
      return res.status(200).json({
        success: true,
        data: response.data.data || [],
        message: 'Reviewed transfers fetched successfully'
      });
    } else {
      return res.status(400).json({
        success: false,
        message: response.data?.message || 'Failed to fetch reviewed transfers from Google Sheet.'
      });
    }
  } catch (error) {
    console.error('Error fetching reviewed transfers:', error.message);
    if (error.code === 'ECONNABORTED') {
      return res.status(504).json({ success: false, message: 'Request to Google Sheet timed out.' });
    }
    next(error);
  }
};

/**
 * @desc    Get rejected/coaching transfer QA records from Google Sheet
 * @route   GET /api/transfer-qa/rejected
 * @access  Private
 */
const getRejectedTransfers = async (req, res, next) => {
  try {
    const url = getWebhookUrl();
    const secret = getWebhookSecret();

    if (!url || !secret) {
      return res.status(500).json({ success: false, message: 'Google Sheet webhook configuration is missing.' });
    }

    const response = await axios.get(url, {
      params: {
        action: 'rejected',
        secret: secret
      },
      timeout: 15000 // 15 seconds timeout
    });

    if (response.data && response.data.success) {
      return res.status(200).json({
        success: true,
        data: response.data.data || [],
        message: 'Rejected transfers fetched successfully'
      });
    } else {
      return res.status(400).json({
        success: false,
        message: response.data?.message || 'Failed to fetch rejected transfers from Google Sheet.'
      });
    }
  } catch (error) {
    console.error('Error fetching rejected transfers:', error.message);
    if (error.code === 'ECONNABORTED') {
      return res.status(504).json({ success: false, message: 'Request to Google Sheet timed out.' });
    }
    next(error);
  }
};

/**
 * @desc    Get a single transfer QA record by ID
 * @route   GET /api/transfer-qa/:transfer_id
 * @access  Private
 */
const getTransferStatus = async (req, res, next) => {
  try {
    const { transfer_id } = req.params;
    const url = getWebhookUrl();
    const secret = getWebhookSecret();

    if (!url || !secret) {
      return res.status(500).json({ success: false, message: 'Google Sheet webhook configuration is missing.' });
    }

    const response = await axios.get(url, {
      params: {
        action: 'status',
        secret: secret,
        transfer_id: transfer_id
      },
      timeout: 10000
    });

    if (response.data && response.data.success) {
      return res.status(200).json({
        success: true,
        data: response.data.data,
        message: 'Transfer fetched successfully'
      });
    } else {
      return res.status(404).json({
        success: false,
        message: response.data?.message || 'Transfer not found.'
      });
    }
  } catch (error) {
    console.error('Error fetching transfer status:', error.message);
    if (error.code === 'ECONNABORTED') {
      return res.status(504).json({ success: false, message: 'Request to Google Sheet timed out.' });
    }
    next(error);
  }
};

/**
 * @desc    Update a transfer QA record (Evaluation)
 * @route   POST /api/transfer-qa/update-status
 * @access  Private
 */
const updateTransferStatus = async (req, res, next) => {
  try {
    const { transfer_id, qa_status, qa_score, qa_notes } = req.body;
    
    if (!transfer_id || !qa_status) {
      return res.status(400).json({ success: false, message: 'Transfer ID and QA Status are required.' });
    }

    const url = getWebhookUrl();
    const secret = getWebhookSecret();

    if (!url || !secret) {
      return res.status(500).json({ success: false, message: 'Google Sheet webhook configuration is missing.' });
    }

    // Prepare payload
    const payload = {
      action: 'update_status',
      secret: secret,
      transfer_id: transfer_id,
      qa_status: qa_status,
      qa_score: qa_score || '',
      qa_notes: qa_notes || '',
      evaluated_by: req.user.name // Add user who evaluated
    };

    // Google Apps script generally accepts POST requests best as JSON or Form URL Encoded.
    // Axios sends JSON by default if payload is an object.
    const response = await axios.post(url, payload, {
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.data && response.data.success) {
      return res.status(200).json({
        success: true,
        message: 'Transfer QA updated successfully',
        data: response.data.data || null
      });
    } else {
      return res.status(400).json({
        success: false,
        message: response.data?.message || 'Failed to update transfer status in Google Sheet.'
      });
    }

  } catch (error) {
    console.error('Error updating transfer status:', error.message);
    if (error.code === 'ECONNABORTED') {
      return res.status(504).json({ success: false, message: 'Request to Google Sheet timed out.' });
    }
    next(error);
  }
};

module.exports = {
  getPendingTransfers,
  getReviewedTransfers,
  getRejectedTransfers,
  getTransferStatus,
  updateTransferStatus
};
