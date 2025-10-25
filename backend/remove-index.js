require('dotenv').config();
const mongoose = require('mongoose');

async function removeUniqueIndex() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ 已连接到数据库');

    const Vote = mongoose.model('Vote', new mongoose.Schema({}));
    
    // 删除所有索引
    await Vote.collection.dropIndexes();
    console.log('✅ 已删除所有索引');

    // 创建新的普通索引
    await Vote.collection.createIndex({ timestamp: -1 });
    console.log('✅ 已创建新索引');

    console.log('🎉 完成！现在可以无限投票了');
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ 错误:', error);
    process.exit(1);
  }
}

removeUniqueIndex();