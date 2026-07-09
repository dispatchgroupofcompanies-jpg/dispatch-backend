require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const mongoose = require('mongoose');
const User = require('./src/models/user.model');
const bcrypt = require('bcryptjs');
const path = require('path');

const MONGODB_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/dispatch_website';

async function createAdmin() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const existingAdmin = await User.findOne({ email: 'xcdgoc@gmail.com' });
    
    if (existingAdmin) {
      console.log('🔄 Updating existing admin user...');
      
      existingAdmin.role = 'admin';
      existingAdmin.isActive = true;
      existingAdmin.name = 'System Admin';
      existingAdmin.password = '111111';  // Will be hashed by schema pre-save hook
      
      await existingAdmin.save();
    } else {
      console.log('📝 Creating new admin user...');
      
      // Create admin user - password will be hashed by schema pre-save hook
      const admin = await User.create({
        name: 'System Admin',
        email: 'xcdgoc@gmail.com',
        password: '111111',  // Will be hashed by schema pre-save hook
        role: 'admin',
        isActive: true,
        address: 'Admin Address'
      });
      
      console.log('✅ Admin user created successfully');
    }

   
    
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

createAdmin();