// pages/homepage/homepage.js - 「我的」页（tabBar 第二个标签）
//
// 展示当前登录用户的登录状态 + 我的分享（可删除）。
// 作为 tabBar 页，无法接收 openid 参数，因此固定展示「登录用户本人」，
// 「查看他人主页」在 tab 模式下不再支持（详见首页 header 的跳转说明）。

const api = require("../../services/api");
const user = require("../../services/user");
const config = require("../../utils/config");
const util = require("../../utils/util");

const app = getApp();

Page({
  data: {
    isLogin: false,
    profile: null,
    defaultAvatar: config.DEFAULT_AVATAR,
    myUid: "",
    photoList: [],
    page: 0,
    hasMore: true,
    isEmpty: false,
    loading: false,
    // 我的统计
    myPhotoCount: 0,
    myViewCount: 0,
  },

  _lastStatsAt: 0,

  onLoad: function () {
    try {
      this.refresh();
    } catch (e) {
      console.error("[homepage] onLoad refresh 异常", e);
    }
  },

  onShow: function () {
    try {
      // 登录页登录/退出后回来，或上传成功后，刷新一次
      if (app.globalData.needRefresh) {
        app.globalData.needRefresh = false;
        this.refresh();
        return;
      }
      // 登录态可能变化（从登录页返回），刷新一次
      this.refresh();
    } catch (e) {
      console.error("[homepage] onShow refresh 异常", e);
    }
  },

  /** 根据当前登录态刷新整页 */
  refresh: function () {
    let profile = null;
    let isLogin = false;
    try {
      profile = user.getProfile();
      isLogin = user.isLogin();
    } catch (e) {
      console.error("[homepage] 读取登录态失败", e);
    }
    console.log("[homepage] refresh 登录态", isLogin, profile);

    // 第一步永远先落「未登录引导」的安全数据，保证页面一定先渲染出登录按钮，
    // 后续任何 setData / 云调用失败都不会再导致白屏。
    this.setData({
      isLogin: isLogin,
      profile: profile,
      photoList: [],
      isEmpty: !isLogin,
      myUid: isLogin && profile ? profile.uid : "",
      myPhotoCount: 0,
      myViewCount: 0,
    });

    if (!isLogin || !profile) {
      return;
    }

    // 登录态下的数据加载，逐项 try/catch，互不影响，绝不因统计失败导致整页白屏
    try {
      this.loadList(true);
    } catch (e) {
      console.error("[homepage] loadList 异常", e);
    }
    try {
      this.loadStats(profile.uid);
    } catch (e) {
      console.error("[homepage] loadStats 异常", e);
    }
  },

  onPullDownRefresh: function () {
    const self = this;
    this.loadList(true).then(function () {
      if (self.data.myUid) self.loadStats(self.data.myUid);
      wx.stopPullDownRefresh();
    });
  },

  onReachBottom: function () {
    if (this.data.hasMore && !this.data.loading && this.data.isLogin) {
      this.loadList(false);
    }
  },

  loadList: function (reset) {
    if (this.data.loading || !this.data.myUid) return Promise.resolve();

    this.setData({ loading: true });
    const nextPage = reset ? 0 : this.data.page + 1;
    const self = this;

    return api
      .listPhotos({ uid: this.data.myUid, page: nextPage })
      .then(function (res) {
        const list = reset ? res.list : self.data.photoList.concat(res.list);
        self.setData({
          photoList: list,
          page: nextPage,
          hasMore: res.hasMore,
          isEmpty: list.length === 0,
          loading: false,
        });
      })
      .catch(function () {
        self.setData({ loading: false });
      });
  },

  /** 我的统计：节流 10s */
  loadStats: function (uid) {
    const now = Date.now();
    if (this._lastStatsAt && now - this._lastStatsAt < 10000) return;
    this._lastStatsAt = now;
    const self = this;
    api.getStats(uid).then(function (s) {
      if (!s) return;
      self.setData({
        myPhotoCount: s.photoCount || 0,
        myViewCount: s.totalView || 0,
      });
    });
  },

  onImageTap: function (e) {
    const id = e.detail.id;
    if (!id) return;
    wx.navigateTo({ url: "/pages/detail/detail?id=" + id });
  },

  onDelete: function (e) {
    const id = e.detail.id;
    if (!id) return;
    const self = this;

    wx.showModal({
      title: "确认删除",
      content: "删除后不可恢复，云存储中的文件也会一并删除",
      success: function (res) {
        if (!res.confirm) return;
        util.showLoading("删除中");
        api.removePhoto(id, self.data.myUid).then(function (ok) {
          util.hideLoading();
          if (ok) {
            util.toastOK("已删除");
            self.loadList(true);
            self.loadStats(self.data.myUid);
          }
        });
      },
    });
  },

  // ========== 导航 ==========

  /** 去登录 / 编辑资料 */
  onLoginTap: function () {
    wx.navigateTo({ url: "/pages/login/login" });
  },

  /** 去分享图片 */
  onAddTap: function () {
    wx.navigateTo({ url: "/pages/add/add" });
  },

  /** 退出登录（解决旧缓存/换微信号后仍显示旧登录态的问题） */
  onLogoutTap: function () {
    const self = this;
    wx.showModal({
      title: "退出登录",
      content: "退出后将清空本地登录信息，可重新登录",
      success: function (res) {
        if (!res.confirm) return;
        user.logout();
        self.refresh();
      },
    });
  },
});
