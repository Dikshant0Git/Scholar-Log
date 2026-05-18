const mongoose = require('mongoose');
require('dotenv').config();
mongoose.connect(process.env.MONGO_URI).then(async () => {
  const db = mongoose.connection.db;
  await db.collection('students').updateOne({email: 'agent123@test.com'}, {$set: {isVerified: true}});
  console.log('User verified.');
  process.exit(0);
}).catch(console.error);
