const mongoose = require('mongoose');

const voteSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true,
    enum: ['q1', 'q2', 'q3']
  },
  option: {
    type: String,
    required: true
  },
  ip: {
    type: String,
    required: true
  },
  ipInfo: {
    country: String,
    city: String,
    region: String
  },
  userAgent: String,
  timestamp: {
    type: Date,
    default: Date.now
  }
});

// 复合索引：防止同一IP对同一问题重复投票
voteSchema.index({ question: 1, ip: 1 }, { unique: true });

module.exports = mongoose.model('Vote', voteSchema);