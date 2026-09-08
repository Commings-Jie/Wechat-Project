// pages/index/index.js - 首页：社区图片流（QQ空间风格）
//
// 顶部 header：当前用户头像 + 社区浏览量 + 说说数；
// 下方滚动展示所有用户分享的图片说说。

const api = require("../../services/api");
const user = require("../../services/user");
const config = require("../../utils/config");
const util = require("../../utils/util");

const app = getApp();

Page({
  data: {
    photoList: [],
    page: 0,
    hasMore: true,
    isEmpty: false,
    loading: false,
    myUid: "", // 当前账号 uid（每次登录一个），决定卡片上"删除"按钮的显隐

    // 顶部社区统计（header 展示）
    totalView: 0,
    photoCount: 0,
    userCount: 0,

    // 顶部用户条
    isLogin: false,
    nickName: "",
    avatarUrl: config.DEFAULT_AVATAR,
  },

  // 首次进入只自动弹一次登录页，避免返回后又立刻弹造成死循环
  _loginPrompted: false,
  // 社区统计节流时间戳
  _lastStatsAt: 0,

  onLoad: function () {
    this.refreshUserBar();
    this.loadList(true);
    try {
      this.loadStats();
    } catch (e) {
      console.error("[index] loadStats 异常", e);
    }
  },

  onShow: function () {
    // 登录页登录/退出后返回，用户条要跟着变
    this.refreshUserBar();

    // 没登录、也没主动选过"随便逛逛" -> 首次进首页自动引导一次。
    // 放到最前面，避免被后续任何异常阻断导致永远不弹登录页。
    if (!user.isLogin() && !user.isGuest() && !this._loginPrompted) {
      this._loginPrompted = true;
      wx.navigateTo({ url: "/pages/login/login" });
    }

    // 顶部社区统计（带 10s 节流，避免切 tab 频繁聚合查询）
    try {
      this.loadStats();
    } catch (e) {
      console.error("[index] onShow loadStats 异常", e);
    }

    // 上传页上传成功后会置这个标记，回到首页时刷新一次
    if (app.globalData.needRefresh) {
      app.globalData.needRefresh = false;
      this.refreshUserBar();
      this.loadList(true);
      this.loadStats();
      return;
    }
  },

  onPullDownRefresh: function () {
    const self = this;
    this.loadList(true).then(function () {
      self.loadStats();
      wx.stopPullDownRefresh();
    });
  },

  onReachBottom: function () {
    if (this.data.hasMore && !this.data.loading) {
      this.loadList(false);
    }
  },

  /** 把登录态同步到顶部用户条（含当前账号 uid） */
  refreshUserBar: function () {
    const p = user.getProfile();
    this.setData({
      isLogin: user.isLogin(),
      nickName: (p && p.nickName) || "",
      avatarUrl: (p && p.avatarUrl) || config.DEFAULT_AVATAR,
      myUid: (p && p.uid) || "",
    });
  },

  /** 社区统计：节流 10s，避免切 tab 反复聚合查询 */
  loadStats: function () {
    const now = Date.now();
    if (this._lastStatsAt && now - this._lastStatsAt < 10000) return;
    this._lastStatsAt = now;
    const self = this;
    api.getStats().then(function (s) {
      if (!s) return;
      self.setData({
        totalView: s.totalView || 0,
        photoCount: s.photoCount || 0,
        userCount: s.userCount || 0,
      });
    });
  },

  /**
   * 加载列表
   * @param {Boolean} reset true=重新加载第 0 页；false=追加下一页
   */
  loadList: function (reset) {
    if (this.data.loading) return Promise.resolve();

    this.setData({ loading: true });
    const nextPage = reset ? 0 : this.data.page + 1;
    const self = this;

    return api
      .listPhotos({ page: nextPage })
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

  // ========== 卡片事件 ==========

  /** 点图片 -> 详情页 */
  onImageTap: function (e) {
    const id = e.detail.id;
    if (!id) return;
    wx.navigateTo({ url: "/pages/detail/detail?id=" + id });
  },

  /** 删除（二次确认；云函数侧还会再校验一次归属） */
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
            self.loadStats();
          }
        });
      },
    });
  },

  // ========== 顶部发说说入口 ==========

  /** 点头像 -> 已登录去「我的」tab；未登录去登录页 */
  onAvatarTap: function () {
    if (user.isLogin()) {
      wx.switchTab({ url: "/pages/homepage/homepage" });
    } else {
      wx.navigateTo({ url: "/pages/login/login" });
    }
  },

  onLogout: function () {
    const self = this;
    wx.showModal({
      title: "退出登录",
      content: "退出后需要重新填写昵称和头像才能上传",
      success: function (res) {
        if (!res.confirm) return;
        user.logout();
        self.refreshUserBar();
        self.loadStats();
        util.toastOK("已退出");
      },
    });
  },

  // ========== 发说说入口 ==========

  /**
   * 点「分享新鲜事」输入框/相机：先确认登录态，再取 openid，最后跳转上传页。
   */
  onPublishTap: function () {
    if (!user.isLogin()) {
      wx.navigateTo({ url: "/pages/login/login" });
      return;
    }

    util.showLoading("请稍候");
    app
      .ensureOpenid()
      .then(function (openid) {
        util.hideLoading();
        if (!openid) {
          util.toast("获取用户身份失败，请检查云函数是否已部署");
          return;
        }
        wx.navigateTo({ url: "/pages/add/add" });
      })
      .catch(function () {
        util.hideLoading();
      });
  },
});
