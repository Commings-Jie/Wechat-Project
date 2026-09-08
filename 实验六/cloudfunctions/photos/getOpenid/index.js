// cloudfunctions/photos/getOpenid/index.js
// 取当前用户 openid（客户端拿不到，必须经云函数）

const cloud = require("wx-server-sdk");

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  return {
    openid: wxContext.OPENID,
    appid: wxContext.APPID,
    unionid: wxContext.UNIONID,
  };
};
