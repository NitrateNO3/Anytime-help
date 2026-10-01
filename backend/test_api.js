require('dotenv').config();
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const express = require('express');
const app = express();
app.use(express.json());

// We will mount a mock version of the route
app.set('io', { emit: () => {} });

// Mock auth middleware
const auth = async (req, res, next) => {
  try {
    // Generate a valid token for +918076993834
    const User = require('./models/User');
    const user = await User.findOne({ phone_number: '+918076993834', role: 'Staff' });
    req.user = { id: user._id, role: user.role };
    next();
  } catch(e) { next(e); }
};

app.use('/api/complaints', auth, require('./routes/complaints'));

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');
    
    // Make a mock request to the express app using supertest or just fetch if it's listening
    const server = app.listen(0, async () => {
      const port = server.address().port;
      const res = await fetch(`http://localhost:${port}/api/complaints`);
      const data = await res.json();
      console.log(`\nAPI returned ${data.length} complaints for Staff.`);
      if (data.length > 0) {
        data.forEach(c => {
          console.log(`- Title: ${c.title}, Phase: ${c.phase}, Category: ${c.category}`);
        });
      } else {
        console.log('NO COMPLAINTS RETURNED FROM API!');
      }
      process.exit(0);
    });
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
};

run();
