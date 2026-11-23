/**
 * AWS S3 Upload Helper for Anytime-Help
 * Replaces Cloudinary with native AWS S3 object storage
 */
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const crypto = require('crypto');

const REGION = process.env.AWS_REGION || 'ap-southeast-2';
const BUCKET = process.env.AWS_S3_BUCKET || 'anytimehelp-media';

// S3 Client automatically uses EC2 IAM Role in production, or AWS_ACCESS_KEY_ID / env vars locally
const s3 = new S3Client({ region: REGION });

/**
 * Determine MIME type and file extension from Data URI, buffer, or mimetype
 */
function resolveMimeAndExt(input, mimeHint) {
  if (mimeHint && mimeHint.includes('/')) {
    const ext = mimeHint.split('/')[1].replace('jpeg', 'jpg');
    return { mime: mimeHint, ext };
  }

  if (typeof input === 'string' && input.startsWith('data:')) {
    const match = input.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,/);
    if (match) {
      const mime = match[1];
      const ext = mime.split('/')[1].replace('jpeg', 'jpg');
      return { mime, ext };
    }
  }

  // Fallback default
  return { mime: 'image/jpeg', ext: 'jpg' };
}

/**
 * Upload a Buffer, DataURI, or Multer file to AWS S3
 * @param {Buffer|string|object} fileInput - Buffer, base64 dataURI, or req/file object
 * @param {string} folder - Target folder inside bucket (e.g., 'complaints', 'banners')
 * @param {object} [options] - Optional custom filename or mimetype
 * @returns {Promise<{ secure_url: string, url: string, public_id: string, key: string }>}
 */
async function uploadToS3(fileInput, folder = 'general', options = {}) {
  if (!fileInput) {
    throw new Error('No file input provided for S3 upload');
  }

  let buffer;
  let mimeHint = options.mimeType;

  // 1. Handle Multer file object (req.file)
  if (fileInput && fileInput.buffer && Buffer.isBuffer(fileInput.buffer)) {
    buffer = fileInput.buffer;
    mimeHint = fileInput.mimetype || mimeHint;
  }
  // 2. Handle Express req object with req.file
  else if (fileInput && fileInput.file && Buffer.isBuffer(fileInput.file.buffer)) {
    buffer = fileInput.file.buffer;
    mimeHint = fileInput.file.mimetype || mimeHint;
  }
  // 3. Handle Raw Buffer
  else if (Buffer.isBuffer(fileInput)) {
    buffer = fileInput;
  }
  // 4. Handle base64 Data URI string (e.g. data:image/jpeg;base64,...)
  else if (typeof fileInput === 'string' && fileInput.startsWith('data:')) {
    const { mime } = resolveMimeAndExt(fileInput);
    mimeHint = mime;
    const base64Data = fileInput.replace(/^data:[a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+;base64,/, '');
    buffer = Buffer.from(base64Data, 'base64');
  }
  // 5. Handle raw base64 string
  else if (typeof fileInput === 'string') {
    buffer = Buffer.from(fileInput, 'base64');
  } else {
    throw new Error('Unsupported file input type for S3 upload');
  }

  const { mime, ext } = resolveMimeAndExt(fileInput, mimeHint);
  const rawFolder = folder.replace(/^\/+|\/+$/g, '').replace(/^anytime_help\/?/, '');
  const FOLDER_MAP = {
    'bottombanners': 'bottom-banners',
    'bottom_banners': 'bottom-banners',
    'staffbanners': 'staff-banners',
    'staff_banners': 'staff-banners',
    'complaints_resolved': 'complaints',
  };
  const cleanFolder = FOLDER_MAP[rawFolder] || rawFolder;
  const uniqueName = `${Date.now()}_${crypto.randomBytes(6).toString('hex')}.${ext}`;
  const key = cleanFolder ? `${cleanFolder}/${uniqueName}` : uniqueName;

  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: mime,
  });

  await s3.send(command);

  const publicUrl = `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;

  return {
    secure_url: publicUrl,
    url: publicUrl,
    public_id: key,
    key: key,
    bucket: BUCKET,
  };
}

/**
 * Delete an object from AWS S3
 * @param {string} keyOrUrl - S3 Key (e.g. 'complaints/xyz.jpg') or full S3 URL
 */
async function deleteFromS3(keyOrUrl) {
  if (!keyOrUrl || typeof keyOrUrl !== 'string') return;

  // If full S3 URL was passed, strip prefix to extract the key
  const baseUrl = `https://${BUCKET}.s3.${REGION}.amazonaws.com/`;
  let key = keyOrUrl.startsWith(baseUrl) ? keyOrUrl.slice(baseUrl.length) : keyOrUrl;

  // If legacy Cloudinary URL or legacy public_id that doesn't exist in S3, ignore safely
  if (key.includes('cloudinary.com') || key.startsWith('res.cloudinary.com')) {
    return;
  }

  try {
    const command = new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: key,
    });
    await s3.send(command);
  } catch (err) {
    console.warn(`S3 delete warning for key "${key}":`, err.message);
  }
}

module.exports = {
  uploadToS3,
  deleteFromS3,
};
