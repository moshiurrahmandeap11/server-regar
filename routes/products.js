const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { auth, adminOnly } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.get('/', productController.getProducts);
router.get('/:id', productController.getProductById);
router.post('/', auth, adminOnly, upload.array('images', 5), productController.createProduct);
router.put('/:id', auth, adminOnly, upload.array('images', 5), productController.updateProduct);
router.delete('/:id', auth, adminOnly, productController.deleteProduct);

module.exports = router;
