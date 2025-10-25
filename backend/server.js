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

// CORS 配置 - 支持所有 Vercel 部署
app.use(cors({
  origin: function(origin, callback) {
    // 允许没有 origin 的请求（如 Postman、移动应用）
    if (!origin) return callback(null, true);
    
    // 允许本地开发环境
    if (origin.startsWith('http://localhost') || 
        origin.startsWith('http://127.0.0.1')) {
      return callback(null, true);
    }
    
    // 允许所有 Vercel 部署（生产、预览、分支部署）
    if (origin.includes('.vercel.app')) {
      return callback(null, true);
    }
    
    // 拒绝其他来源
    return callback(new Error('Not allowed by CORS'), false);
  },
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 速率限制
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use(limiter);

// 将io实例附加到app
app.set('io', io);

// 路由
app.use('/api/votes', votesRouter);
app.use('/api/comments', commentsRouter);

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// 静态文件服务
app.use(express.static('public'));

// 数据库连接
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/voting-system')
.then(() => console.log('✅ MongoDB连接成功'))
.catch(err => console.error('❌ MongoDB连接失败:', err));

// Socket.IO 连接处理
io.on('connection', (socket) => {
  console.log('🔌 新用户连接:', socket.id);

  socket.on('disconnect', () => {
    console.log('🔌 用户断开:', socket.id);
  });

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