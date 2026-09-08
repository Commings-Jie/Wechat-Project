// app.js
const config = require("./utils/config");
const api = require("./services/api");
const user = require("./services/user");

App({
  onLaunch: function () {
    if (!wx.cloud) {
      console.error("请使用 2.2.3 或以上的基础库以使用云能力");
      return;
    }

    // env 决定接下来小程序发起的云开发调用（wx.cloud.xxx）会请求到哪个云环境的资源
    // 环境 ID 在开发者工具顶部工具栏点「云开发」获取，填到 utils/config.js 的 CLOUD_ENV
    wx.cloud.init({
      env: config.CLOUD_ENV,
      traceUser: true,
    });

    // 恢复上次登录态：读本地缓存 -> 同步 globalData
    // 放在 cloud.init 之后，因为后续取 openid 需要云环境就绪
    const profile = user.init();
    // 这里再显式写一次：onLaunch 期间 getApp() 不一定拿得到实例，
    // user.js 内部的同步可能落空，保险起见用 this 直接写
    if (profile) {
      this.globalData.userInfo = profile;
      this.globalData.openid = profile.openid;
    }
  },

  globalData: {
    userInfo: null, // 昵称 / 头像 / 地区
    openid: null, // 用户唯一标识，首次需要时由云函数获取
    needRefresh: false, // 上传成功后置 true，首页 onShow 时刷新
  },

  /**
   * 确保已拿到 openid（懒加载，取过一次就直接用）
   * @returns {Promise<String|null>}
   */
  ensureOpenid: function () {
    if (this.globalData.openid) {
      return Promise.resolve(this.globalData.openid);
    }
    const self = this;
    return api.getOpenid().then(function (openid) {
      if (openid) self.globalData.openid = openid;
      return openid;
    });
  },
});
