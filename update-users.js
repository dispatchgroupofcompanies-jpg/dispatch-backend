require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/user.model');
const bcrypt = require('bcryptjs');

const MONGODB_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/dispatch_website';

async function updateUsers() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // 1. Update/Fix the main admin user
    const adminEmail = 'dispatchgroupofcompanies@gmail.com';
    const admin = await User.findOne({ email: adminEmail });
    
    if (admin) {
      console.log('📝 Updating admin user:', adminEmail);
      
      // Ensure admin has correct role and active status
      admin.role = 'admin';
      admin.isActive = true;
      admin.name = 'System Admin';
      admin.address = 'Admin Address';
      
      // Hash password if it's plain text
      if (admin.password === '111111') {
        admin.password = await bcrypt.hash('111111', 10);
        console.log('  - Password hashed');
      }
      
      await admin.save();
      console.log('  - Admin user updated successfully');
    } else {
      console.log('❌ Admin user not found, creating new admin...');
      const hashedPassword = await bcrypt.hash('111111', 10);
      await User.create({
        name: 'System Admin',
        email: adminEmail,
        password: hashedPassword,
        role: 'admin',
        isActive: true,
        address: 'Admin Address'
      });
      console.log('  - Admin user created successfully');
    }

    // 2. Change testing121@gmail.com from admin to user
    const testingAdmin = await User.findOne({ email: 'testing121@gmail.com' });
    if (testingAdmin) {
      console.log('\n📝 Changing testing121@gmail.com from admin to user');
      testingAdmin.role = 'user';
      await testingAdmin.save();
      console.log('  - Role updated to user');
    }

    // 3. Ensure all other users have user role
    const otherUsers = await User.find({ 
      email: { $nin: [adminEmail, 'testing121@gmail.com'] } 
    });
    
    console.log('\n📝 Checking other users...');
    for (const user of otherUsers) {
      if (user.role !== 'user') {
        user.role = 'user';
        await user.save();
        console.log(`  - Updated ${user.email} to user role`);
      } else {
        console.log(`  - ${user.email} already has user role`);
      }
    }

    // 4. Display all users
    console.log('\n📊 All Users in Database:');
    const allUsers = await User.find({});
    allUsers.forEach(user => {
      console.log(`\n  Name: ${user.name}`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Role: ${user.role}`);
      console.log(`  Active: ${user.isActive}`);
    });

    console.log('\n✅ All updates completed successfully!');
    console.log('\n🔐 Admin Login Credentials:');
    console.log('📧 Email: dispatchgroupofcompanies@gmail.com');
    console.log('🔑 Password: 111111');

    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

updateUsers();