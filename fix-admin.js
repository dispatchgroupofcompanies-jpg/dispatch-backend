const mongoose = require('mongoose');
const User = require('./src/models/user.model');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/dispatch_website';

async function fixAdmin() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find the admin user
    const admin = await User.findOne({ email: 'xcdgoc@gmail.com' });
    
    if (!admin) {
      console.log('❌ Admin user not found');
      await mongoose.disconnect();
      process.exit(1);
    }

  

    // Update using MongoDB driver directly to bypass Mongoose validation
    const collection = User.collection;
    
    await collection.updateOne(
      { _id: admin._id },
      { 
        $set: {
          role: "admin",
          isActive: true,
          name: "System Admin",
          address: "Admin Office Address"
        }
      }
    );

    console.log('✅ Admin user updated successfully');

    // Verify the update
    const updatedAdmin = await User.findById(admin._id);
    console.log('\n📊 Updated Admin Details:');
    console.log('ID:', updatedAdmin._id);
    console.log('Name:', updatedAdmin.name);
    console.log('Email:', updatedAdmin.email);
    console.log('Role:', updatedAdmin.role);
    console.log('isActive:', updatedAdmin.isActive);
    console.log('Address:', updatedAdmin.address);

    console.log('\n🎉 Admin fix complete! You can now login with:');
    console.log('📧 Email: xcdgoc@gmail.com');
    console.log('🔑 Password: 111111');

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

fixAdmin();