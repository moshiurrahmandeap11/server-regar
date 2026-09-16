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
    const uploadedImages = filesByField.images || [];
    const { colors, sizes, slug, imageOrder, seoKeywords, ...rest } = req.body;
    let parsedKeywords = [];
    if (seoKeywords) {
      try {
        parsedKeywords = typeof seoKeywords === 'string'
          ? (seoKeywords.trim().startsWith('[') ? JSON.parse(seoKeywords) : seoKeywords.split(',').map((k) => k.trim()).filter(Boolean))
          : (Array.isArray(seoKeywords) ? seoKeywords : []);
      } catch {
        parsedKeywords = String(seoKeywords).split(',').map((k) => k.trim()).filter(Boolean);
      }
    }
    const parsedColors = colors ? JSON.parse(colors) : [];
    const mergedColors = mergeColorImages(parsedColors, filesByField);
    const cleanColors = mergedColors.filter((c) => c && (c.name?.trim() || c.image));
    const derivedImages = cleanColors.map((color) => color.image).filter(Boolean);
    
    let orderedImages = uploadedImages;
    if (imageOrder) {
      try {
        const order = typeof imageOrder === 'string' ? JSON.parse(imageOrder) : imageOrder;
        if (Array.isArray(order) && order.length) {
          const reordered = [];
          order.forEach((token) => {
            if (typeof token === 'string' && token.startsWith('new:')) {
              const idx = parseInt(token.replace('new:', ''), 10);
              if (uploadedImages[idx]) reordered.push(uploadedImages[idx]);
            }
          });
          if (reordered.length) orderedImages = reordered;
        }
      } catch (e) {}
    }

    const parsedSizes = sizes ? JSON.parse(sizes) : [];
    const cleanSizes = parsedSizes.filter((s) => s && String(s).trim());
    
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
      images: orderedImages.length ? orderedImages : derivedImages,
      colors: cleanColors,
      sizes: cleanSizes,
      seoKeywords: parsedKeywords,
    });
    await product.save();
    res.status(201).json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const { colors, sizes, slug, images: bodyImages, imageOrder, seoKeywords, ...rest } = req.body;
    const updateData = { ...rest };
    if (seoKeywords !== undefined) {
      let parsedKeywords = [];
      if (seoKeywords) {
        try {
          parsedKeywords = typeof seoKeywords === 'string'
            ? (seoKeywords.trim().startsWith('[') ? JSON.parse(seoKeywords) : seoKeywords.split(',').map((k) => k.trim()).filter(Boolean))
            : (Array.isArray(seoKeywords) ? seoKeywords : []);
        } catch {
          parsedKeywords = String(seoKeywords).split(',').map((k) => k.trim()).filter(Boolean);
        }
      }
      updateData.seoKeywords = parsedKeywords;
    }
    const filesByField = getFilesByField(req.files || []);
    const uploadedImages = filesByField.images || [];

    let existingList = [];
    if (bodyImages) {
      try {
        const parsed = typeof bodyImages === 'string' ? JSON.parse(bodyImages) : bodyImages;
        if (Array.isArray(parsed)) existingList = parsed;
      } catch (e) {}
    }

    if (imageOrder) {
      try {
        const order = typeof imageOrder === 'string' ? JSON.parse(imageOrder) : imageOrder;
        if (Array.isArray(order) && order.length) {
          const finalImages = [];
          order.forEach((token) => {
            if (typeof token === 'string') {
              if (token.startsWith('existing:')) {
                const idx = parseInt(token.replace('existing:', ''), 10);
                if (existingList[idx]) finalImages.push(existingList[idx]);
              } else if (token.startsWith('new:')) {
                const idx = parseInt(token.replace('new:', ''), 10);
                if (uploadedImages[idx]) finalImages.push(uploadedImages[idx]);
              } else if (token.startsWith('http')) {
                finalImages.push(token);
              }
            }
          });
          if (finalImages.length) updateData.images = finalImages;
        }
      } catch (e) {}
    } else if (existingList.length || uploadedImages.length) {
      updateData.images = [...existingList, ...uploadedImages];
    }

    if (colors !== undefined) {
      const parsedColors = colors ? JSON.parse(colors) : [];
      const mergedColors = mergeColorImages(parsedColors, filesByField);
      const cleanColors = mergedColors.filter((c) => c && (c.name?.trim() || c.image));
      updateData.colors = cleanColors;

      if (!updateData.images || updateData.images.length === 0) {
        const derivedImages = cleanColors.map((color) => color.image).filter(Boolean);
        if (derivedImages.length) updateData.images = derivedImages;
      }
    }

    if (sizes !== undefined) {
      const parsedSizes = sizes ? JSON.parse(sizes) : [];
      updateData.sizes = parsedSizes.filter((s) => s && String(s).trim());
    }
    
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
