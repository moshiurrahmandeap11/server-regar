const User = require('../models/User');
const { hashPassword, comparePassword } = require('./bcrypt');

const ensureAdminUser = async () => {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.warn('ADMIN_EMAIL or ADMIN_PASSWORD is missing; skipping admin bootstrap.');
    return;
  }

  const existingUser = await User.findOne({ email });

  if (!existingUser) {
    const hashedPassword = await hashPassword(password);
    await User.create({
      email,
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'Regar',
      isAdmin: true,
      isActive: true,
      ageVerified: true,
      preferences: { language: 'fr', newsletter: false },
    });
    console.log(`Created admin user: ${email}`);
    return;
  }

  let shouldSave = false;

  if (!existingUser.isAdmin) {
    existingUser.isAdmin = true;
    shouldSave = true;
  }

  const passwordMatches = await comparePassword(password, existingUser.password);
  if (!passwordMatches) {
    existingUser.password = await hashPassword(password);
    shouldSave = true;
  }

  if (shouldSave) {
    await existingUser.save();
    console.log(`Updated admin account from env: ${email}`);
  } else {
    console.log(`Admin account ready: ${email}`);
  }
};

module.exports = ensureAdminUser;
