require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/user.model');
const bcrypt = require('bcryptjs');

const MONGODB_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/dispatch_website';

async function createAdmin() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const existingAdmin = await User.findOne({ email: 'xcdgoc@gmail.com' });
    
    if (existingAdmin) {
      
      existingAdmin.role = 'admin';
      existingAdmin.isActive = true;
      existingAdmin.name = 'System Admin';
      
      if (existingAdmin.password === '111111') {
        existingAdmin.password = await bcrypt.hash('111111', 10);
      }
      
      await existingAdmin.save();
    } else {
      console.log('📝 Creating new admin user...');
      
      // Hash password
      const hashedPassword = await bcrypt.hash('111111', 10);
      
      // Create admin user
      const admin = await User.create({
        name: 'System Admin',
        email: 'xcdgoc@gmail.com',
        password: hashedPassword,
        role: 'admin',
        isActive: true,
        address: 'Admin Address'
      });
      
     
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