const Product = require('../models/Product');
const mongoose = require('mongoose');

const findProductBySlugOrName = async (identifier) => {
  const product = await Product.findOne({ slug: identifier });
  if (product) return product;

  const candidates = await Product.find({}, 'name nameEn slug').lean();
  const match = candidates.find((item) => Product.slugify(item.nameEn || item.name) === identifier);
  return match ? Product.findById(match._id) : null;
};

const getFilesByField = (files = []) => {
  return files.reduce((acc, file) => {
    if (!acc[file.fieldname]) acc[file.fieldname] = [];
    acc[file.fieldname].push(file.path);
    return acc;
  }, {});
};

const mergeColorImages = (colors = [], filesByField = {}) => {
  return colors.map((color, index) => {
    const key = `colorImage_${index}`;
    const uploaded = filesByField[key]?.[0];
    return uploaded ? { ...color, image: uploaded } : color;
  });
};

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
    await Promise.all(products.map((product) => product.ensureSlug()));
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getProductById = async (req, res) => {
  try {
    const identifier = req.params.id;
    let product = null;
    if (mongoose.Types.ObjectId.isValid(identifier)) {
      product = await Product.findById(identifier);
    }
    if (!product) {
      product = await findProductBySlugOrName(identifier);
    }
    if (!product) return res.status(404).json({ message: 'Product not found' });
    await product.ensureSlug();
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createProduct = async (req, res) => {
  try {
    const filesByField = getFilesByField(req.files || []);
    const images = filesByField.images || [];
    const { colors, sizes, slug, ...rest } = req.body;
    const parsedColors = colors ? JSON.parse(colors) : [];
    const mergedColors = mergeColorImages(parsedColors, filesByField);
    const derivedImages = mergedColors.map((color) => color.image).filter(Boolean);
    
    // If admin provided a custom slug, use it; otherwise auto-generate
    let finalSlug = slug ? slug.trim().toLowerCase() : null;
    if (finalSlug) {
      // Ensure uniqueness
      const existing = await Product.findOne({ slug: finalSlug });
      if (existing) {
        return res.status(400).json({ message: 'Slug already exists. Please use a different slug.' });
      }
    }
    
    const product = new Product({
      ...rest,
      slug: finalSlug,
      images: images.length ? images : derivedImages,
      colors: mergedColors,
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
    const { colors, sizes, slug, ...rest } = req.body;
    const updateData = { ...rest };
    const filesByField = getFilesByField(req.files || []);

    if (filesByField.images?.length) {
      updateData.images = filesByField.images;
    }

    if (colors) {
      const parsedColors = JSON.parse(colors);
      const mergedColors = mergeColorImages(parsedColors, filesByField);
      updateData.colors = mergedColors;

      if (!updateData.images || updateData.images.length === 0) {
        const derivedImages = mergedColors.map((color) => color.image).filter(Boolean);
        if (derivedImages.length) updateData.images = derivedImages;
      }
    }

    if (sizes) updateData.sizes = JSON.parse(sizes);
    
    // Handle custom slug
    if (slug !== undefined) {
      const trimmedSlug = slug.trim().toLowerCase();
      if (trimmedSlug) {
        const existing = await Product.findOne({ slug: trimmedSlug, _id: { $ne: req.params.id } });
        if (existing) {
          return res.status(400).json({ message: 'Slug already exists. Please use a different slug.' });
        }
        updateData.slug = trimmedSlug;
      }
    }
    
    // Only auto-generate slug if name changed AND no custom slug was provided
    if (!updateData.slug && (updateData.name || updateData.nameEn)) {
      updateData.slug = await Product.createUniqueSlug(updateData.nameEn || updateData.name, req.params.id);
    }

    const product = await Product.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true });
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
