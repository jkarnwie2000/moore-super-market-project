const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const multer = require('multer');
const AppError = require('../utils/AppError');

const UPLOAD_DIR = path.resolve(__dirname, '../uploads');
const ALLOWED = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

/** When a Vercel Blob store is connected (BLOB_READ_WRITE_TOKEN), images go to Blob; otherwise to local disk. */
const useBlob = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);

// Serverless filesystems are read-only, so only create the folder when we can.
try {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
} catch {
  /* read-only filesystem (e.g. Vercel) — Blob storage is used instead */
}

const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED[file.mimetype]) return cb(null, true);
    cb(new AppError('Only JPG, PNG or WEBP images are allowed.', 415));
  },
}).single('image');

/** Persists an uploaded image and returns its public URL. */
async function storeImage(file) {
  const filename = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ALLOWED[file.mimetype]}`;
  if (useBlob()) {
    const { put } = require('@vercel/blob');
    const blob = await put(`products/${filename}`, file.buffer, { access: 'public', contentType: file.mimetype });
    return blob.url;
  }
  if (process.env.VERCEL) {
    throw new AppError('Image uploads need a Vercel Blob store. Connect one to this project (Storage → Blob) and redeploy.', 503);
  }
  await fs.promises.writeFile(path.join(UPLOAD_DIR, filename), file.buffer);
  return `/uploads/${filename}`;
}

/** Deletes an image previously stored by storeImage (best effort). */
async function removeImage(image) {
  try {
    if (!image) return;
    if (image.startsWith('/uploads/')) {
      await fs.promises.unlink(path.join(UPLOAD_DIR, path.basename(image)));
    } else if (useBlob() && /\.blob\.vercel-storage\.com\//.test(image)) {
      const { del } = require('@vercel/blob');
      await del(image);
    }
  } catch {
    /* already gone */
  }
}

module.exports = { uploadImage, storeImage, removeImage, UPLOAD_DIR };
