const express = require('express');
const router = express.Router();
const Comment = require('../models/Comment');
const Vote = require('../models/Vote');
const { addIPInfo } = require('../middleware/ipCheck');

// 获取所有评论
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const comments = await Comment.find({})
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Comment.countDocuments();

    res.json({
      success: true,
      comments,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 发表评论
router.post('/', addIPInfo, async (req, res) => {
  try {
    const { content, nickname } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ success: false, message: '评论内容不能为空' });
    }

    if (content.length > 500) {
      return res.status(400).json({ success: false, message: '评论内容过长' });
    }

    // 获取用户的投票记录
    const userVotes = await Vote.find({ ip: req.clientIP });
    const votes = {
      q1: userVotes.find(v => v.question === 'q1')?.option || null,
      q2: userVotes.find(v => v.question === 'q2')?.option || null,
      q3: userVotes.find(v => v.question === 'q3')?.option || null
    };

    // 创建评论
    const comment = new Comment({
      content: content.trim(),
      nickname: nickname?.trim() || '匿名用户',
      ip: req.clientIP,
      ipInfo: {
        country: req.ipInfo.country,
        city: req.ipInfo.city
      },
      votes
    });

    await comment.save();

    // 实时广播新评论
    req.app.get('io').emit('new-comment', comment);

    res.json({
      success: true,
      message: '评论发表成功',
      comment
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 点赞评论
router.post('/:id/like', addIPInfo, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    
    if (!comment) {
      return res.status(404).json({ success: false, message: '评论不存在' });
    }

    // 检查是否已点赞
    const hasLiked = comment.likedBy.includes(req.clientIP);
    
    if (hasLiked) {
      // 取消点赞
      comment.likedBy = comment.likedBy.filter(ip => ip !== req.clientIP);
      comment.likes = Math.max(0, comment.likes - 1);
    } else {
      // 点赞
      comment.likedBy.push(req.clientIP);
      comment.likes += 1;
    }

    await comment.save();

    // 实时广播点赞更新
    req.app.get('io').emit('comment-like', {
      commentId: comment._id,
      likes: comment.likes
    });

    res.json({
      success: true,
      likes: comment.likes,
      hasLiked: !hasLiked
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 删除评论（可选，需要管理员权限）
router.delete('/:id', async (req, res) => {
  try {
    // 这里应该添加管理员验证
    await Comment.findByIdAndDelete(req.params.id);
    
    req.app.get('io').emit('comment-deleted', req.params.id);
    
    res.json({ success: true, message: '评论已删除' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;