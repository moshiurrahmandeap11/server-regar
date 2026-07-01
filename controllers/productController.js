const Product = require('../models/Product');

exports.getProducts = async (req, res) => {
  try {
    const { category, featured, active, search } = req.query;
    const query = {};
    if (category) query.category = category;
    if (featured) query.featured = featured === 'true';
    if (active) query.isActive = active === 'true';
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }
    const products = await Product.find(query).sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createProduct = async (req, res) => {
  try {
    const images = req.files?.map(f => f.path) || [];
    const { colors, sizes, ...rest } = req.body;
    const product = new Product({
      ...rest,
      images,
      colors: colors ? JSON.parse(colors) : [],
      sizes: sizes ? JSON.parse(sizes) : [],
    });
    await product.save();
    res.status(201).json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const { colors, sizes, ...rest } = req.body;
    const updateData = { ...rest };
    if (req.files?.length) updateData.images = req.files.map(f => f.path);
    if (colors) updateData.colors = JSON.parse(colors);
    if (sizes) updateData.sizes = JSON.parse(sizes);
    const product = await Product.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: 'Product deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
