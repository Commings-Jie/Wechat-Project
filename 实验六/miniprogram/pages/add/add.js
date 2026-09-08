// pages/add/add.js - 上传图片页
//
// 功能：多选图片 / 预览 / 删除已选 / 数量上限（达上限自动隐藏"+"）/
//       上传前压缩 / 上传进度 / 展示我的历史上传

const api = require("../../services/api");
const user = require("../../services/user");
const config = require("../../utils/config");
const util = require("../../utils/util");

const app = getApp();

Page({
  data: {
    desc: "", // 图片描述
    files: [], // 已选待上传的本地临时路径
    maxUpload: config.MAX_UPLOAD,
    history: [], // 我上传过的图片
    uploading: false,
  },

  // 历史只在登录成功后加载一次，从登录页返回时补加载
  _historyLoaded: false,

  onLoad: function () {
    this.ensureLogin();
  },

  onShow: function () {
    // 从登录页返回后，补一次历史加载
    if (user.isLogin() && !this._historyLoaded) {
      this.loadHistory();
    }
  },

  /**
   * 上传必须有身份：没登录就先去登录页。
   * 云函数写库时会强制写入 _openid，游客硬传只会拿到"仅自己可见"的脏数据。
   */
  ensureLogin: function () {
    if (user.isLogin()) {
      this.loadHistory();
      return true;
    }
    util.toast("请先登录再上传");
    wx.navigateTo({ url: "/pages/login/login" });
    return false;
  },

  onDescInput: function (e) {
    this.setData({ desc: e.detail.value });
  },

  // ========== 选择图片 ==========

  chooseImage: function () {
    const remain = this.data.maxUpload - this.data.files.length;
    if (remain <= 0) {
      util.toast("最多只能选 " + this.data.maxUpload + " 张");
      return;
    }
    const self = this;
    wx.chooseImage({
      count: remain, // 只让选剩余名额，选超了也不用自己截断
      sizeType: ["compressed"], // 先让系统压一道
      sourceType: ["album", "camera"],
      success: function (res) {
        if (res.tempFilePaths && res.tempFilePaths.length) {
          self.setData({ files: self.data.files.concat(res.tempFilePaths) });
        }
      },
    });
  },

  /** 预览已选图 */
  previewFile: function (e) {
    const index = e.currentTarget.dataset.index;
    wx.previewImage({ urls: this.data.files, current: this.data.files[index] });
  },

  /** 从待上传列表里移除 */
  removeFile: function (e) {
    const index = e.currentTarget.dataset.index;
    const files = this.data.files.slice();
    files.splice(index, 1);
    this.setData({ files: files });
  },

  // ========== 上传 ==========

  /**
   * 逐张上传（串行，避免并发把免费额度打满）
   * 压缩在 services/cloud.js 的 addPhoto 里统一处理
   */
  upload: function () {
    const files = this.data.files;
    if (!files.length) {
      util.toast("请先选择图片");
      return;
    }
    if (this.data.uploading) return;
    if (!user.isLogin()) {
      util.toast("请先登录再上传");
      wx.navigateTo({ url: "/pages/login/login" });
      return;
    }

    const self = this;
    const desc = this.data.desc;
    let done = 0;
    let fail = 0;

    this.setData({ uploading: true });
    util.showLoading("上传中");

    function next(i) {
      if (i >= files.length) {
        util.hideLoading();
        self.setData({ uploading: false, files: [], desc: "" });
        util.toast(fail ? done + " 张成功，" + fail + " 张失败" : "成功上传 " + done + " 张");
        app.globalData.needRefresh = true; // 让首页回来时刷新
        self.loadHistory();
        return;
      }
      api.addPhoto(files[i], desc).then(function (record) {
        if (record) done++;
        else fail++;
        next(i + 1);
      });
    }

    next(0);
  },

  // ========== 历史记录 ==========

  loadHistory: function () {
    const self = this;
    this._historyLoaded = true;
    const p = user.getProfile();
    const uid = p && p.uid;
    if (!uid) return;
    return api.listPhotos({ uid: uid }).then(function (res) {
      self.setData({ history: res.list });
    });
  },

  previewHistory: function (e) {
    const index = e.currentTarget.dataset.index;
    const urls = this.data.history.map(function (p) {
      return p.photoUrl;
    });
    wx.previewImage({ urls: urls, current: urls[index] });
  },
});
