'use strict';

/**
 * seedTestAccounts.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Seeds test accounts for production testing.
 *
 * Usage:
 *   node seedTestAccounts.js
 *
 * This will create:
 *   - Owner:  test@owner.com / Test@123
 *   - Tenant: test@tenant.com / TestPass@123
 *
 * Safe to run multiple times — skips existing emails.
 */

const mongoose = require('mongoose');
const User = require('./models/User');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/rental';

const seed = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log(`Connected to ${MONGODB_URI}`);

    // ── Owner ──
    let owner = await User.findOne({ email: 'test@owner.com' });
    if (!owner) {
      owner = await User.create({
        name: 'Test Owner',
        email: 'test@owner.com',
        password: 'Test@123',
        role: 'owner',
        emailVerified: true,
        phone: '9999999991',
      });
      console.log('✓ Created owner: test@owner.com / Test@123');
    } else {
      console.log('→ Owner already exists: test@owner.com');
    }

    // ── Tenant (linked to owner) ──
    const existingTenant = await User.findOne({ email: 'test@tenant.com' });
    if (!existingTenant) {
      await User.create({
        name: 'Test Tenant',
        email: 'test@tenant.com',
        password: 'TestPass@123',
        role: 'tenant',
        ownerId: owner._id,
        emailVerified: true,
        phone: '9999999992',
      });
      console.log('✓ Created tenant: test@tenant.com / TestPass@123');
    } else {
      console.log('→ Tenant already exists: test@tenant.com');
    }

    console.log('\nDone. You can now log in with these accounts on the production build.');
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
};

seed();
