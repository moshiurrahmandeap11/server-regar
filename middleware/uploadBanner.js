const cloudinary = require('../config/cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

const bannerStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'regar/banners',
    allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
    transformation: [{ width: 2560, quality: 'auto', crop: 'limit' }],
  },
});

const uploadBanner = multer({ storage: bannerStorage });

module.exports = uploadBanner;

