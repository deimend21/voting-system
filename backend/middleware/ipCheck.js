const axios = require('axios');

// 获取客户端真实IP
function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0] ||
         req.headers['x-real-ip'] ||
         req.connection.remoteAddress ||
         req.socket.remoteAddress ||
         req.ip;
}

// 获取IP地理信息
async function getIPInfo(ip) {
  try {
    // 使用免费的IP API
    // 备选方案：ipapi.co, ip-api.com, ipinfo.io
    const response = await axios.get(`http://ip-api.com/json/${ip}?fields=status,country,city,regionName`, {
      timeout: 3000
    });
    
    if (response.data.status === 'success') {
      return {
        country: response.data.country,
        city: response.data.city,
        region: response.data.regionName
      };
    }
  } catch (error) {
    console.error('IP查询失败:', error.message);
  }
  
  return {
    country: 'Unknown',
    city: 'Unknown',
    region: 'Unknown'
  };
}

// 中间件：添加IP信息到请求
async function addIPInfo(req, res, next) {
  const ip = getClientIP(req);
  const ipInfo = await getIPInfo(ip);
  
  req.clientIP = ip;
  req.ipInfo = ipInfo;
  
  next();
}

module.exports = {
  getClientIP,
  getIPInfo,
  addIPInfo
};