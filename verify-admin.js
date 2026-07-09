require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const mongoose = require('mongoose');
const User = require('./src/models/user.model');
const bcrypt = require('bcryptjs');
const path = require('path');

const MONGODB_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

async function verifyAdmin() {
  try {
    await mongoose.connect(MONGODB_URI);

    const admin = await User.findOne({ email: 'xcdgoc@gmail.com' });
    
    if (!admin) {
      console.log('❌ Admin user not found!');
      process.exit(1);
    }
    const isHashed = admin.password.length === 60 && admin.password.startsWith('$2a$');
    
    // Test if default password '111111' matches
    const isDefaultPassword = await bcrypt.compare('111111', admin.password);
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

verifyAdmin();