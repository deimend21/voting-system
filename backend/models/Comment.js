const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  content: {
    type: String,
    required: true,
    maxlength: 500
  },
  nickname: {
    type: String,
    default: '匿名用户',
    maxlength: 20
  },
  ip: {
    type: String,
    required: true
  },
  ipInfo: {
    country: String,
    city: String
  },
  votes: {
    q1: String,
    q2: String,
    q3: String
  },
  likes: {
    type: Number,
    default: 0
  },
  likedBy: [{
    type: String // IP地址
  }],
  timestamp: {
    type: Date,
    default: Date.now
  }
});

commentSchema.index({ timestamp: -1 });

module.exports = mongoose.model('Comment', commentSchema);