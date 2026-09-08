// pages/detail/detail.js - 图片展示页
//
// 功能：大图预览 / 下载到相册 / 分享给好友 / 删除（仅自己的图）

const api = require("../../services/api");
const user = require("../../services/user");
const config = require("../../utils/config");
const util = require("../../utils/util");

const app = getApp();

Page({
  data: {
    id: "",
    photo: null,
    timeText: "",
    canDelete: false,
    defaultAvatar: config.DEFAULT_AVATAR,
    defaultNickname: config.DEFAULT_NICKNAME,
  },

  onLoad: function (options) {
    const id = (options && options.id) || "";
    if (!id) {
      util.toast("缺少图片标识");
      return;
    }
    this.setData({ id: id });
    this.loadPhoto();
    api.incView(id); // 浏览量 +1（静默，失败不影响主流程）
  },

  loadPhoto: function () {
    const self = this;
    api.getPhoto(this.data.id).then(function (photo) {
      if (!photo) {
        self.setData({ photo: null });
        return;
      }
      self.setData({
        photo: photo,
        timeText: util.formatDateTime(photo.createTime),
      });

      // 只有当前账号能看到删除按钮
      const p = user.getProfile();
      const uid = p && p.uid;
      self.setData({ canDelete: !!uid && photo.uid === uid });
    });
  },

  /** 全屏预览 */
  previewPhoto: function () {
    const p = this.data.photo;
    if (!p) return;
    wx.previewImage({ urls: [p.photoUrl], current: p.photoUrl });
  },

  /** 下载并保存到系统相册 */
  downloadPhoto: function () {
    const p = this.data.photo;
    if (!p) return;
    const self = this;

    util.showLoading("下载中");
    api.downloadToAlbum(p.photoUrl).then(function (result) {
      util.hideLoading();

      if (result === "auth") {
        // 权限被拒，引导去设置页开启
        wx.showModal({
          title: "需要相册权限",
          content: "请在设置中允许「保存到相册」后再试",
          confirmText: "去设置",
          success: function (res) {
            if (res.confirm) wx.openSetting();
          },
        });
      } else if (result) {
        util.toastOK("已保存到相册");
      }
    });
  },

  /** 删除：确认后返回上一页 */
  onDelete: function () {
    const p = this.data.photo;
    if (!p) return;
    const self = this;
    const profile = user.getProfile();
    const uid = profile && profile.uid;

    wx.showModal({
      title: "确认删除",
      content: "删除后不可恢复，云存储中的文件也会一并删除",
      success: function (res) {
        if (!res.confirm) return;
        util.showLoading("删除中");
        api.removePhoto(p._id, uid).then(function (ok) {
          util.hideLoading();
          if (ok) {
            util.toastOK("已删除");
            app.globalData.needRefresh = true; // 让首页/个人主页回来时刷新
            setTimeout(function () {
              wx.navigateBack();
            }, 800);
          }
        });
      },
    });
  },

  /**
   * 分享给好友
   * 带 imageUrl 后，分享卡片上会直接显示这张图，比默认截图好看很多
   */
  onShareAppMessage: function () {
    const p = this.data.photo;
    return {
      title: p && p.desc ? p.desc : "给你分享一张好看的图片",
      path: "/pages/detail/detail?id=" + this.data.id,
      imageUrl: p ? p.photoUrl : "",
    };
  },
});
