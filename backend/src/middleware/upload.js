const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `upload-${uniqueSuffix}${ext}`);
  },
});

const ALLOWED_EXTENSIONS = ['.xls', '.xlsx', '.csv', '.txt'];
const TRUSTED_MIMES = [
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'application/csv',
  'text/plain',
];

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const isTrustedMime = TRUSTED_MIMES.includes(file.mimetype);
  const isAllowedExt = ALLOWED_EXTENSIONS.includes(ext);

  // 'application/octet-stream' is generic and can be any file type.
  // Only allow it if the extension is explicitly in the allowed list
  // to prevent arbitrary file uploads masquerading as octet-stream.
  if (file.mimetype === 'application/octet-stream') {
    if (isAllowedExt) {
      return cb(null, true);
    }
    return cb(new Error('Invalid file type. Only Excel (.xls, .xlsx), CSV, and TXT files are allowed.'), false);
  }

  if (isTrustedMime && isAllowedExt) {
    return cb(null, true);
  }

  cb(new Error('Invalid file type. Only Excel (.xls, .xlsx), CSV, and TXT files are allowed.'), false);
};

const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE, 10) || 250 * 1024 * 1024; // default 250MB

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
});

module.exports = upload;
