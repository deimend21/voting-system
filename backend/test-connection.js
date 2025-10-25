require('dotenv').config();
const mongoose = require('mongoose');

async function testConnection() {
  console.log('🔍 测试 MongoDB Atlas 连接...\n');
  
  try {
    console.log('⏳ 正在连接到 cluster0.sxqut0p.mongodb.net ...');
    
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('✅ MongoDB Atlas 连接成功！\n');
    console.log('📊 数据库信息：');
    console.log('  ├─ 数据库名:', mongoose.connection.name);
    console.log('  ├─ 集群地址:', mongoose.connection.host);
    console.log('  ├─ 端口:', mongoose.connection.port);
    console.log('  └─ 连接状态:', mongoose.connection.readyState === 1 ? '✅ 已连接' : '❌ 未连接');
    
    // 测试写入
    console.log('\n📝 测试数据库操作...');
    const TestSchema = new mongoose.Schema({
      message: String,
      timestamp: { type: Date, default: Date.now }
    });
    
    const TestModel = mongoose.model('Test', TestSchema);
    
    const doc = await TestModel.create({
      message: '投票系统连接测试成功！🎉'
    });
    
    console.log('✅ 数据写入成功！');
    console.log('  └─ 文档 ID:', doc._id);
    
    // 读取测试
    const foundDoc = await TestModel.findById(doc._id);
    console.log('✅ 数据读取成功！');
    console.log('  └─ 内容:', foundDoc.message);
    
    // 清理测试数据
    await TestModel.deleteOne({ _id: doc._id });
    console.log('✅ 测试数据已清理');
    
    console.log('\n🎉 所有测试通过！数据库配置正确！');
    
  } catch (error) {
    console.log('\n❌ 连接失败！');
    console.error('错误信息:', error.message);
    
    if (error.message.includes('authentication')) {
      console.log('\n💡 可能的原因：');
      console.log('  • 用户名或密码错误');
      console.log('  • 数据库用户权限不足');
    } else if (error.message.includes('ENOTFOUND') || error.message.includes('timeout')) {
      console.log('\n💡 可能的原因：');
      console.log('  • 网络连接问题');
      console.log('  • 集群地址错误');
      console.log('  • IP 未添加到白名单');
    }
    
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 连接已关闭');
  }
}

testConnection();