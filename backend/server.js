require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const connectDB = require('./config/db');

// Connect Database
connectDB();

const app = express();

// Increase JSON payload size limit for Base64 images
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors({
  origin: function (origin, callback) {
    const allowedOrigins = ['https://anytime-help-b71e.vercel.app', 'http://localhost:3000', 'http://localhost:5173', 'https://www.anytimehelp.co.in', 'https://anytimehelp.co.in'];
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
  }
});

// Pass io to routes
app.set('io', io);

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // Group Chat room events
  socket.on('join_chat_group', (groupId) => {
    if (groupId) {
      socket.join(`chat_group_${groupId}`);
      console.log(`Socket ${socket.id} joined chat_group_${groupId}`);
    }
  });

  socket.on('leave_chat_group', (groupId) => {
    if (groupId) {
      socket.leave(`chat_group_${groupId}`);
      console.log(`Socket ${socket.id} left chat_group_${groupId}`);
    }
  });

  // Typing indicator broadcast
  socket.on('typing_start', (data) => {
    const groupId = (data?.groupId?._id || data?.groupId || '').toString().trim();
    const userName = (data?.userName || 'Someone').toString().trim();
    if (groupId) {
      socket.to(`chat_group_${groupId}`).emit('user_typing', { groupId, userName, isTyping: true });
    }
  });

  socket.on('typing_stop', (data) => {
    const groupId = (data?.groupId?._id || data?.groupId || '').toString().trim();
    const userName = (data?.userName || 'Someone').toString().trim();
    if (groupId) {
      socket.to(`chat_group_${groupId}`).emit('user_typing', { groupId, userName, isTyping: false });
    }
  });

  // Community Section room events
  socket.on('join_community_section', (sectionId) => {
    if (sectionId) {
      socket.join(`community_section_${sectionId}`);
      console.log(`Socket ${socket.id} joined community_section_${sectionId}`);
    }
  });

  socket.on('leave_community_section', (sectionId) => {
    if (sectionId) {
      socket.leave(`community_section_${sectionId}`);
      console.log(`Socket ${socket.id} left community_section_${sectionId}`);
    }
  });

  // Community Section typing indicator broadcast
  socket.on('community_typing_start', (data) => {
    const sectionId = (data?.sectionId?._id || data?.sectionId || data?.section_id || '').toString().trim();
    const userName = (data?.userName || data?.sender_name || 'Someone').toString().trim();
    const userId = (data?.userId || '').toString().trim();
    if (sectionId) {
      socket.to(`community_section_${sectionId}`).emit('community_user_typing', { sectionId, userName, userId, isTyping: true });
    }
  });

  socket.on('community_typing_stop', (data) => {
    const sectionId = (data?.sectionId?._id || data?.sectionId || data?.section_id || '').toString().trim();
    const userName = (data?.userName || data?.sender_name || 'Someone').toString().trim();
    const userId = (data?.userId || '').toString().trim();
    if (sectionId) {
      socket.to(`community_section_${sectionId}`).emit('community_user_typing', { sectionId, userName, userId, isTyping: false });
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Define Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/departments', require('./routes/departments'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/subadmins', require('./routes/subadmins'));
app.use('/api/complaints', require('./routes/complaints'));
app.use('/api/users', require('./routes/users'));
app.use('/api/announcements', require('./routes/announcements'));
app.use('/api/banners', require('./routes/banners'));
app.use('/api/staff-banners', require('./routes/staffBanners'));
app.use('/api/paid-services', require('./routes/paidServices'));
app.use('/api/service-bookings', require('./routes/serviceBookings'));
app.use('/api/directory', require('./routes/directory'));
app.use('/api/config', require('./routes/config'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/community', require('./routes/community'));
app.use('/api/bottom-banners', require('./routes/bottomBanners'));

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
  console.log('Backend successfully updated and running with mine=true fixes!');
});
