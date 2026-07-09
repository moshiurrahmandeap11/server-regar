const mongoose = require('mongoose');

const slugify = (value = '') => {
  const normalized = value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || 'product';
};

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  nameEn: { type: String },
  slug: { type: String, unique: true, sparse: true, trim: true, lowercase: true },
  description: { type: String, required: true },
  descriptionEn: { type: String },
  price: { type: Number, required: true },
  originalPrice: { type: Number },
  images: [{ type: String }],
  colors: [{ name: String, hex: String, image: String }],
  sizes: [{ type: String }],
  stock: { type: Number, default: 0 },
  maxTickets: { type: Number, default: 100 },
  soldTickets: { type: Number, default: 0 },
  category: { type: String, default: 'caps' },
  isActive: { type: Boolean, default: true },
  featured: { type: Boolean, default: false },
  raffleEndDate: { type: Date },
}, { timestamps: true });

productSchema.statics.createUniqueSlug = async function createUniqueSlug(source, excludeId) {
  const base = slugify(source);
  let candidate = base;
  let suffix = 2;

  const query = () => {
    const filter = { slug: candidate };
    if (excludeId) filter._id = { $ne: excludeId };
    return filter;
  };

  while (await this.exists(query())) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  return candidate;
};

productSchema.statics.slugify = slugify;

productSchema.methods.ensureSlug = async function ensureSlug() {
  if (this.slug) return this;
  this.slug = await this.constructor.createUniqueSlug(this.nameEn || this.name, this._id);
  return this.save();
};

productSchema.pre('validate', async function setSlug(next) {
  try {
    // Only auto-generate slug if no custom slug was provided
    if (!this.slug) {
      this.slug = await this.constructor.createUniqueSlug(this.nameEn || this.name, this._id);
    }
    next();
  } catch (error) {
    next(error);
  }
});

module.exports = mongoose.model('Product', productSchema);
