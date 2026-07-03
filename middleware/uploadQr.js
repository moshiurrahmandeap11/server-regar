const cloudinary = require('../config/cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

const qrStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'regar/payment-qr',
    allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
    transformation: [{ width: 600, height: 600, crop: 'limit' }],
  },
});

module.exports = multer({ storage: qrStorage });
