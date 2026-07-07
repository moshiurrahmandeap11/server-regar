const cloudinary = require('../config/cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

const prizeStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'regar/prizes',
    allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
    transformation: [{ width: 800, height: 800, crop: 'limit' }],
  },
});

const uploadPrize = multer({ storage: prizeStorage });

module.exports = uploadPrize;
