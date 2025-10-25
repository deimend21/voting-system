const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const http = require('http');
const socketIO = require('socket.io');
require('dotenv').config();

const votesRouter = require('./routes/votes');
const commentsRouter = require('./routes/comments');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// 中间件
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 速率限制
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100 // 限制100个请求
});
app.use(limiter);

// 投票专用限制
const voteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1小时
  max: 10,
  message: '投票请求过于频繁，请稍后再试'
});

// 将io实例附加到app，以便在路由中使用
app.set('io', io);

// 路由
app.use('/api/votes', votesRouter);
app.use('/api/comments', commentsRouter);

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// 静态文件服务（如果前端在同一服务器）
app.use(express.static('public'));

// 数据库连接
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/voting-system', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ MongoDB连接成功'))
.catch(err => console.error('❌ MongoDB连接失败:', err));

// Socket.IO 连接处理
io.on('connection', (socket) => {
  console.log('🔌 新用户连接:', socket.id);

  socket.on('disconnect', () => {
    console.log('🔌 用户断开:', socket.id);
  });

  // 可以添加更多实时功能
  socket.on('typing', (data) => {
    socket.broadcast.emit('user-typing', data);
  });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: '服务器错误',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 启动服务器
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 服务器运行在端口 ${PORT}`);
  console.log(`📡 WebSocket服务已启动`);
});