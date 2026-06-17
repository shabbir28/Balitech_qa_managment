const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const { query, getClient } = require('../config/database');

const csv = require('csv-parser');

/**
 * Parse uploaded Excel/CSV/TXT file and return rows array
 */

const parseFile = (filePath) => {
  return new Promise(async (resolve, reject) => {
    try {
      const ext = path.extname(filePath).toLowerCase();
      fs.appendFileSync('debug.log', `[parseFile] ext: ${ext}, filePath: ${filePath}\n`);
      if (ext === '.csv' || ext === '.txt') {
        const results = [];
        
        // Auto-detect delimiter
        const firstLine = await new Promise((res, rej) => {
          const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
          let data = '';
          stream.on('data', chunk => {
            data += chunk;
            const newlineIdx = data.indexOf('\n');
            if (newlineIdx !== -1) {
              stream.destroy();
              res(data.substring(0, newlineIdx));
            }
          });
          stream.on('end', () => res(data));
          stream.on('error', rej);
        });
        
        let separator = ',';
        if (firstLine.includes('\t') && (!firstLine.includes(',') || firstLine.split('\t').length > firstLine.split(',').length)) {
          separator = '\t';
        } else if (firstLine.includes(';') && (!firstLine.includes(',') || firstLine.split(';').length > firstLine.split(',').length)) {
          separator = ';';
        }
        fs.appendFileSync('debug.log', `[parseFile] delimiter detected as: ${separator === '\t' ? 'TAB' : separator}\n`);

        fs.createReadStream(filePath)
          .pipe(csv({ separator }))
          .on('data', (data) => results.push(data))
          .on('end', () => resolve(results))
          .on('error', (err) => {
            fs.appendFileSync('debug.log', `[parseFile] stream error: ${err.message}\n`);
            reject(err);
          });
      } else {
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        resolve(XLSX.utils.sheet_to_json(sheet, { defval: '' }));
      }
    } catch (err) {
      fs.appendFileSync('debug.log', `[parseFile] fatal error: ${err.message}\n`);
      reject(err);
    }
  });
};

/**
 * Normalize column names from uploaded file
 */
const normalizeRow = (row) => {
  const normalize = (key) => String(key || '').toLowerCase().replace(/[\s_-]+/g, '_').trim();
  const normalized = {};
  for (const [k, v] of Object.entries(row)) {
    // Strip weird characters from keys, e.g., BOM or quotes
    let cleanK = String(k).replace(/[^\w\s-]/g, '');
    normalized[normalize(cleanK)] = v;
  }
  
  const customerNameFallback = [normalized.first_name, normalized.last_name].filter(Boolean).join(' ');

  return {
    agent_name: normalized.agent_name || normalized.agentname || normalized.agent || normalized.full_name || '',
    agent_id: String(normalized.agent_id || normalized.agentid || normalized.agent_code || normalized.user || '').trim(),
    campaign_name: normalized.campaign_name || normalized.campaignname || normalized.campaign || normalized.campaign_id || normalized.list_name || '',
    customer_name: normalized.customer_name || normalized.customername || normalized.customer || customerNameFallback || '',
    customer_phone: String(normalized.customer_phone || normalized.customerphone || normalized.phone || normalized.phone_number || normalized.phone_number_dialed || '').trim(),
    call_date: normalized.call_date || normalized.calldate || normalized.date || null,
    call_duration: String(normalized.call_duration || normalized.callduration || normalized.duration || normalized.length_in_sec || '').trim(),
    recording_url: normalized.recording_url || normalized.recordingurl || normalized.recording
      || normalized.recording_location || normalized.recordinglocation
      || normalized.recording_file || normalized.audio_url || normalized.audio_link
      || normalized.url || normalized.audio || '',
    disposition: normalized.disposition || normalized.status_name || normalized.status || '',
    notes: normalized.notes || normalized.note || normalized.comments || '',
  };
};

/**
 * POST /api/calls/upload
 */
const uploadCalls = async (req, res, next) => {
  const client = await getClient();
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    const filePath = req.file.path;
    const rows = await parseFile(filePath);

    if (rows.length === 0) {
      return res.status(400).json({ success: false, message: 'File is empty or has no valid data.' });
    }

    // Create upload batch

    const batchResult = await client.query(
      `INSERT INTO upload_batches (batch_name, file_name, file_path, total_records, uploaded_by, status)
       VALUES ($1, $2, $3, $4, $5, 'processing') RETURNING id`,
      [
        req.body.batch_name || `Batch-${Date.now()}`,
        req.file.originalname,
        req.file.filename,
        rows.length,
        req.user.id,
      ]
    );
    const batchId = batchResult.rows[0].id;

    let successful = 0, duplicates = 0, failed = 0;
    const errors = [];

    // Pre-fetch campaigns for fast mapping
    const campaignsRes = await client.query('SELECT id, LOWER(name) as name FROM campaigns');
    const campaignMap = new Map();
    campaignsRes.rows.forEach(c => campaignMap.set(c.name, c.id));

    const batchSize = 500;
    for (let i = 0; i < rows.length; i += batchSize) {
      const chunk = rows.slice(i, i + batchSize);
      
      const validRows = [];
      const phonesInChunk = [];
      for(let j=0; j<chunk.length; j++) {
         const row = normalizeRow(chunk[j]);
         if (!row.customer_phone || !row.agent_name) {
           failed++;
           if(errors.length < 50) errors.push({ row: i + j + 2, error: 'Missing required fields (agent_name or customer_phone)' });
           continue;
         }
         phonesInChunk.push(row.customer_phone);
         validRows.push({ row, originalIndex: i + j + 2 });
      }
      
      if (validRows.length === 0) continue;

      // Bulk check duplicates
      const dupRes = await client.query(
        'SELECT customer_phone FROM call_leads WHERE customer_phone = ANY($1) AND is_deleted = FALSE',
        [phonesInChunk]
      );
      const dupPhones = new Set(dupRes.rows.map(r => r.customer_phone));

      const insertPromises = [];
      for (const item of validRows) {
        if (dupPhones.has(item.row.customer_phone)) {
           duplicates++;
           if (errors.length < 50) errors.push({ row: item.originalIndex, error: `Duplicate phone: ${item.row.customer_phone}` });
           continue;
        }
        
        let campId = null;
        if (item.row.campaign_name) {
          campId = campaignMap.get(item.row.campaign_name.toLowerCase()) || null;
        }

        insertPromises.push(
          client.query(
            `INSERT INTO call_leads (batch_id, agent_name, agent_id, campaign_name, campaign_id, customer_name, customer_phone, call_date, call_duration, recording_url, disposition, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [batchId, item.row.agent_name, item.row.agent_id, item.row.campaign_name, campId, item.row.customer_name, item.row.customer_phone, item.row.call_date || null, item.row.call_duration, item.row.recording_url, item.row.disposition, item.row.notes]
          ).then(() => successful++).catch(err => {
            failed++;
            if (errors.length < 50) errors.push({ row: item.originalIndex, error: err.message });
          })
        );
      }

      await Promise.all(insertPromises);
    }

    await client.query(
      `UPDATE upload_batches SET successful_records = $1, duplicate_records = $2, failed_records = $3, status = 'completed', updated_at = NOW() WHERE id = $4`,
      [successful, duplicates, failed, batchId]
    );

    res.status(201).json({
      success: true,
      message: 'File processed successfully.',
      summary: {
        batch_id: batchId,
        total: rows.length,
        successful,
        duplicates,
        failed,
      },
      errors: errors.slice(0, 20),
    });
  } catch (error) {
    fs.appendFileSync('debug.log', `[DEBUG] OUTER CATCH FATAL ERROR: ${error.stack}\n`);
    next(error);
  } finally {
    client.release();
    // Clean up uploaded file
    if (req.file && fs.existsSync(req.file.path)) {
      // Keep file for audit, or delete: fs.unlinkSync(req.file.path);
    }
  }
};

/**
 * GET /api/calls
 */
const getCalls = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      agent_id,
      campaign_name,
      phone,
      from_date,
      to_date,
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const conditions = ['cl.is_deleted = FALSE'];
    const params = [];
    let paramCount = 1;

    if (search) {
      conditions.push(`(cl.agent_name ILIKE $${paramCount} OR cl.customer_name ILIKE $${paramCount} OR cl.customer_phone ILIKE $${paramCount})`);
      params.push(`%${search}%`);
      paramCount++;
    }
    if (agent_id) {
      conditions.push(`cl.agent_id = $${paramCount}`);
      params.push(agent_id);
      paramCount++;
    }
    if (campaign_name) {
      conditions.push(`cl.campaign_name ILIKE $${paramCount}`);
      params.push(`%${campaign_name}%`);
      paramCount++;
    }
    if (phone) {
      conditions.push(`cl.customer_phone ILIKE $${paramCount}`);
      params.push(`%${phone}%`);
      paramCount++;
    }
    if (from_date) {
      conditions.push(`cl.call_date >= $${paramCount}`);
      params.push(from_date);
      paramCount++;
    }
    if (to_date) {
      conditions.push(`cl.call_date <= $${paramCount}`);
      params.push(to_date);
      paramCount++;
    }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const countResult = await query(`SELECT COUNT(*) FROM call_leads cl ${where}`, params);
    const total = parseInt(countResult.rows[0].count);

    params.push(parseInt(limit));
    params.push(offset);

    const result = await query(
      `SELECT cl.*, ub.batch_name, ub.file_name 
       FROM call_leads cl 
       LEFT JOIN upload_batches ub ON cl.batch_id = ub.id
       ${where}
       ORDER BY cl.created_at DESC
       LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
      params
    );

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/calls/:id
 */
const getCallById = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT cl.*, ub.batch_name, ub.file_name
       FROM call_leads cl
       LEFT JOIN upload_batches ub ON cl.batch_id = ub.id
       WHERE cl.id = $1 AND cl.is_deleted = FALSE`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Call/lead not found.' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/calls/:id
 */
const deleteCall = async (req, res, next) => {
  try {
    const result = await query(
      'UPDATE call_leads SET is_deleted = TRUE, deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND is_deleted = FALSE RETURNING id',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Call/lead not found.' });
    }

    res.json({ success: true, message: 'Call/lead deleted successfully.' });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/calls/batches
 */
const getUploadBatches = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const countResult = await query('SELECT COUNT(*) FROM upload_batches');
    const total = parseInt(countResult.rows[0].count);

    const result = await query(
      `SELECT ub.*, u.name as uploaded_by_name
       FROM upload_batches ub
       JOIN users u ON ub.uploaded_by = u.id
       ORDER BY ub.created_at DESC
       LIMIT $1 OFFSET $2`,
      [parseInt(limit), offset]
    );

    res.json({
      success: true,
      data: result.rows,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { uploadCalls, getCalls, getCallById, deleteCall, getUploadBatches, parseFile, normalizeRow };
