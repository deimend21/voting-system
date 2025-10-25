const express = require('express');
const router = express.Router();
const Vote = require('../models/Vote');
const { addIPInfo } = require('../middleware/ipCheck');

// 获取所有投票统计
router.get('/stats', async (req, res) => {
  try {
    const stats = {
      q1: { arrival: 0, save: 0 },
      q2: { death: 0, live: 0 },
      q3: { exist: 0, extinct: 0 }
    };

    const votes = await Vote.find({});
    
    votes.forEach(vote => {
      if (stats[vote.question] && stats[vote.question][vote.option] !== undefined) {
        stats[vote.question][vote.option]++;
      }
    });

    // 计算总投票人数（去重IP）
    const uniqueIPs = new Set(votes.map(v => v.ip));
    const totalVoters = uniqueIPs.size;

    res.json({
      success: true,
      stats,
      totalVoters
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 检查用户是否已投票
router.get('/check', addIPInfo, async (req, res) => {
  try {
    const votes = await Vote.find({ ip: req.clientIP });
    
    const userVotes = {
      q1: votes.find(v => v.question === 'q1')?.option || null,
      q2: votes.find(v => v.question === 'q2')?.option || null,
      q3: votes.find(v => v.question === 'q3')?.option || null
    };

    const hasVoted = false; // 始终允许投票

    res.json({
      success: true,
      hasVoted,
      votes: userVotes
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 提交投票
router.post('/submit', addIPInfo, async (req, res) => {
  try {
    const { votes } = req.body; // { q1: 'arrival', q2: 'live', q3: 'exist' }
    
    if (!votes || typeof votes !== 'object') {
      return res.status(400).json({ success: false, message: '无效的投票数据' });
    }

    // 删除该IP之前的投票记录，以允许重新投票
    await Vote.deleteMany({ ip: req.clientIP });

    // 验证投票数据
    const validVotes = {
      q1: ['arrival', 'save'],
      q2: ['death', 'live'],
      q3: ['exist', 'extinct']
    };

    for (let [question, option] of Object.entries(votes)) {
      if (!validVotes[question] || !validVotes[question].includes(option)) {
        return res.status(400).json({ success: false, message: '无效的选项' });
      }
    }

    // 保存投票
    const votePromises = Object.entries(votes).map(([question, option]) => {
      return new Vote({
        question,
        option,
        ip: req.clientIP,
        ipInfo: req.ipInfo,
        userAgent: req.headers['user-agent']
      }).save();
    });

    await Promise.all(votePromises);

    // 获取更新后的统计数据
    const stats = await getVoteStats();

    // 通过Socket.IO广播更新
    req.app.get('io').emit('vote-update', stats);

    res.json({
      success: true,
      message: '投票成功',
      stats
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: '您已经投过票了' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// 辅助函数：获取投票统计
async function getVoteStats() {
  const stats = {
    q1: { arrival: 0, save: 0 },
    q2: { death: 0, live: 0 },
    q3: { exist: 0, extinct: 0 }
  };

  const votes = await Vote.find({});
  votes.forEach(vote => {
    if (stats[vote.question] && stats[vote.question][vote.option] !== undefined) {
      stats[vote.question][vote.option]++;
    }
  });

  const uniqueIPs = new Set(votes.map(v => v.ip));
  return {
    stats,
    totalVoters: uniqueIPs.size
  };
}

module.exports = router;