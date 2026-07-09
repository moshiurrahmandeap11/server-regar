const mongoose = require('mongoose');

const slugify = (value = '') => {
  const normalized = value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || 'raffle';
};

const raffleSchema = new mongoose.Schema({
  raffleNumber: { type: Number, unique: true },
  slug: { type: String, unique: true, sparse: true, trim: true, lowercase: true },
  name: { type: String, required: true },
  nameEn: { type: String },
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  soldTickets: { type: Number, default: 0 },
  maxTickets: { type: Number, default: 100 },
  prizes: [{
    name: String,
    nameEn: String,
    image: String,
    value: Number,
  }],
  status: { type: String, enum: ['draft', 'active', 'closed', 'drawn'], default: 'draft' },
  winner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  winningTicket: { type: String },
}, { timestamps: true });

raffleSchema.statics.createUniqueSlug = async function createUniqueSlug(source, excludeId) {
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

raffleSchema.statics.slugify = slugify;

raffleSchema.pre('validate', async function setSlug(next) {
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

module.exports = mongoose.model('Raffle', raffleSchema);
