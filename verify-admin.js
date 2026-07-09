require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const mongoose = require('mongoose');
const User = require('./src/models/user.model');
const bcrypt = require('bcryptjs');
const path = require('path');

const MONGODB_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

async function verifyAdmin() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const admin = await User.findOne({ email: 'xcdgoc@gmail.com' });
    
    if (!admin) {
      console.log('❌ Admin user not found!');
      process.exit(1);
    }

    console.log('📋 Admin User Details:');
    console.log('   Name:', admin.name);
    console.log('   Email:', admin.email);
    console.log('   Role:', admin.role);
    console.log('   Active:', admin.isActive);
    console.log('   Password Hash:', admin.password.substring(0, 20) + '...');
    
    // Check if password is hashed
    const isHashed = admin.password.length === 60 && admin.password.startsWith('$2a$');
    console.log('   Password is hashed:', isHashed);
    
    // Test if default password '111111' matches
    const isDefaultPassword = await bcrypt.compare('111111', admin.password);
    console.log('   Default password "111111" matches:', isDefaultPassword);
    
    console.log('\n✅ Admin user verified successfully!');
    console.log('   You can now login with:');
    console.log('   Email: xcdgoc@gmail.com');
    console.log('   Password: 111111');
    console.log('\n⚠️  After changing password, "111111" will no longer work.');
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

verifyAdmin();