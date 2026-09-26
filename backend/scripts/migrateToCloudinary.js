require('dotenv').config();
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;
const Complaint = require('../models/Complaint');
const Announcement = require('../models/Announcement');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
});

const migrateImages = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB Connected');

    // 1. Migrate Complaints
    console.log('--- Migrating Complaints ---');
    const complaints = await Complaint.find({
      $or: [
        { before_image: { $regex: '^data:image' } },
        { after_image: { $regex: '^data:image' } },
      ],
    });
    
    console.log(`Found ${complaints.length} complaints with base64 images.`);
    
    for (const complaint of complaints) {
      let updated = false;
      
      if (complaint.before_image && complaint.before_image.startsWith('data:image')) {
        try {
          console.log(`Uploading before_image for complaint ${complaint._id}...`);
          const result = await cloudinary.uploader.upload(complaint.before_image, {
            folder: 'anytime_help/complaints'
          });
          complaint.before_image = result.secure_url;
          updated = true;
        } catch (e) {
          console.error(`Failed to upload before_image for ${complaint._id}:`, e.message);
        }
      }
      
      if (complaint.after_image && complaint.after_image.startsWith('data:image')) {
        try {
          console.log(`Uploading after_image for complaint ${complaint._id}...`);
          const result = await cloudinary.uploader.upload(complaint.after_image, {
            folder: 'anytime_help/complaints_resolved'
          });
          complaint.after_image = result.secure_url;
          updated = true;
        } catch (e) {
          console.error(`Failed to upload after_image for ${complaint._id}:`, e.message);
        }
      }
      
      if (updated) {
        await complaint.save();
        console.log(`Complaint ${complaint._id} saved successfully.`);
      }
    }

    // 2. Migrate Announcements
    console.log('--- Migrating Announcements ---');
    const announcements = await Announcement.find({
      image: { $regex: '^data:image' }
    });
    
    console.log(`Found ${announcements.length} announcements with base64 images.`);
    
    for (const ann of announcements) {
      if (ann.image && ann.image.startsWith('data:image')) {
        try {
          console.log(`Uploading image for announcement ${ann._id}...`);
          const result = await cloudinary.uploader.upload(ann.image, {
            folder: 'anytime_help/announcements'
          });
          ann.image = result.secure_url;
          await ann.save();
          console.log(`Announcement ${ann._id} saved successfully.`);
        } catch (e) {
          console.error(`Failed to upload image for ${ann._id}:`, e.message);
        }
      }
    }

    console.log('Migration Complete!');
    process.exit(0);
  } catch (error) {
    console.error('Migration Error:', error);
    process.exit(1);
  }
};

migrateImages();
