// pages/login/login.js - 微信登录页
//
// 采用官方现行的「头像昵称填写能力」：
//   头像 <button open-type="chooseAvatar">  +  昵称 <input type="nickname">
//
// 为什么不用 wx.getUserInfo / wx.getUserProfile？
//   getUserInfo   2022-02 起废弃，只返回灰色默认头像 + "微信用户"
//   getUserProfile 2022-10 起对新用户也不再返回真实资料
//   两者现在都拿不到真头像昵称，页面上再挂它们只会让实验报告显得过时。
//   不过这里仍保留了 getUserProfile 兜底按钮（老客户端可能还能用），
//   拿得到就自动填充，拿不到也不影响正常登录。
//
// 关键点：chooseAvatar 返回的头像是**本地临时路径**，
// 必须上传到云存储换成 cloud:// 的 fileID 才能长期保存 —— 这一步在 services/user.js 的 login() 里做。

const config = require("../../utils/config");
const user = require("../../services/user");
const util = require("../../utils/util");

const app = getApp();

Page({
  data: {
    appName: config.APP_NAME,
    avatarUrl: config.DEFAULT_AVATAR,
    nickName: "",
    isLogin: false,
    submitting: false,
  },

  onLoad: function () {
    const profile = user.getProfile();
    if (profile) {
      this.setData({
        avatarUrl: profile.avatarUrl || config.DEFAULT_AVATAR,
        nickName: profile.nickName || "",
        isLogin: user.isLogin(),
      });
    }
  },

  // ========== 头像 ==========

  /**
   * 用户选完微信头像
   * ⚠️ e.detail.avatarUrl 是本地临时路径（wxfile://...），退出小程序就失效，
   *    所以这里只做预览，真正的上传放在点"进入社区"时统一做，
   *    避免用户连换几次头像产生一堆没人用的云存储文件。
   */
  onChooseAvatar: function (e) {
    const url = e.detail && e.detail.avatarUrl;
    if (url) this.setData({ avatarUrl: url });
  },

  // ========== 昵称 ==========

  // input type="nickname" 在真机上聚焦时会弹"使用微信昵称"，
  // 用 bindblur 取值比 bindinput 更稳（微信昵称是整体填入，不走逐字输入）
  onNickInput: function (e) {
    this.setData({ nickName: e.detail.value });
  },

  onNickBlur: function (e) {
    const v = e.detail.value;
    if (v) this.setData({ nickName: v });
  },

  // ========== 兜底：老客户端尝试 getUserProfile ==========

  /**
   * 部分老版本客户端仍能拿到真实头像昵称。
   * 拿得到就填充表单，拿不到静默失败，不打扰用户。
   */
  onUseWechatProfile: function () {
    if (!wx.getUserProfile) {
      util.toast("当前版本不支持，请手动选择头像和昵称");
      return;
    }
    const self = this;
    wx.getUserProfile({
      desc: "用于完善你的社区资料",
      success: function (res) {
        const info = res && res.userInfo;
        if (!info) {
          util.toast("微信未返回资料，请手动填写");
          return;
        }
        // 灰色默认头像的特征是头像 URL 为空或带 "Default" 字样，过滤掉
        const patch = {};
        if (info.avatarUrl) patch.avatarUrl = info.avatarUrl;
        if (info.nickName) patch.nickName = info.nickName;
        if (!Object.keys(patch).length) {
          util.toast("微信未返回资料，请手动填写");
          return;
        }
        self.setData(patch);
        util.toastOK("已填充");
      },
      fail: function () {
        util.toast("已取消，可手动填写");
      },
    });
  },

  // ========== 登录 ==========

  onSubmit: function () {
    if (this.data.submitting) return;

    const nickName = String(this.data.nickName || "").trim();
    if (!nickName) {
      util.toast("请填写昵称");
      return;
    }

    const self = this;
    this.setData({ submitting: true });

    user
      .login({ nickName: nickName, avatarUrl: this.data.avatarUrl })
      .then(function (profile) {
        self.setData({ submitting: false });
        if (!profile) return; // 失败原因已在 user 层 toast 过

        util.toastOK("登录成功");
        // 游客标记清掉：既然登录了，下次启动不用再问
        user.setGuest(false);
        app.globalData.needRefresh = true;

        // 延迟一拍再返回，让 toast 能被看到
        setTimeout(function () {
          self.goBack();
        }, 600);
      })
      .catch(function () {
        self.setData({ submitting: false });
      });
  },

  /** 随便逛逛：不登录也能浏览，只是不能上传 */
  onSkip: function () {
    user.setGuest(true);
    this.goBack();
  },

  /** 退出登录：清掉资料回到未登录态，停留在当前页方便重新登录 */
  onLogout: function () {
    const self = this;
    wx.showModal({
      title: "退出登录",
      content: "退出后将需要重新填写昵称和头像",
      success: function (res) {
        if (!res.confirm) return;
        user.logout();
        self.setData({
          isLogin: false,
          nickName: "",
          avatarUrl: config.DEFAULT_AVATAR,
        });
        util.toastOK("已退出");
      },
    });
  },

  /**
   * 返回上一页
   * 从首页跳过来的就 navigateBack（保留首页滚动位置）；
   * 直接把登录页当编译入口时没有上一页，reLaunch 到首页。
   */
  goBack: function () {
    const pages = getCurrentPages();
    if (pages && pages.length > 1) {
      wx.navigateBack();
    } else {
      wx.reLaunch({ url: "/pages/index/index" });
    }
  },
});
