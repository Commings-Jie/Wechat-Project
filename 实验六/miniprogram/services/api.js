// services/api.js - 统一数据出口
//
// 架构约定：
//   1. 页面只 require 本文件，永远不直接 require cloud.js，也绝不出现 wx.cloud
//   2. 本层负责统一错误处理：失败自动 toast 提示并返回安全的兜底值，
//      页面只需判断返回值是否为空，不用到处写 try/catch
//   3. 想换数据源、加缓存、加埋点，只改这一层，页面零改动

const cloud = require("./cloud");
const util = require("../utils/util");

/**
 * 统一错误兜底
 * @param {Promise} promise
 * @param {*} fallback 失败时返回的兜底值
 */
function guard(promise, fallback) {
  return promise.catch(function (e) {
    console.error("[api]", e);
    const msg = (e && e.message) || "操作失败，请重试";
    util.toast(msg);
    return fallback;
  });
}

module.exports = {
  /** 取 openid，失败返回 null */
  getOpenid: function () {
    return guard(cloud.getOpenid(), null);
  },

  /**
   * 图片列表（分页）
   * @returns {Promise<{list:Array, hasMore:Boolean}>}
   */
  listPhotos: function (opt) {
    return guard(cloud.listPhotos(opt), { list: [], hasMore: false });
  },

  /** 单张详情，失败返回 null */
  getPhoto: function (id) {
    return guard(cloud.getPhoto(id), null);
  },

  /**
   * 社区 / 个人统计，失败返回 null
   * @param {String} [uid] 传则只统计该账号
   */
  getStats: function (uid) {
    return guard(cloud.getStats(uid || ""), null);
  },

  /**
   * 浏览量自增（打开详情时调）。失败静默，不影响主流程，也不 toast
   */
  incView: function (id) {
    return cloud.incView(id).catch(function (e) {
      console.warn("[api] incView 失败", e);
    });
  },

  /** 上传并保存，成功返回记录，失败返回 null */
  addPhoto: function (filePath, desc) {
    return guard(cloud.addPhoto(filePath, desc), null);
  },

  /** 删除，成功 true，失败 false */
  removePhoto: function (id, uid) {
    return guard(cloud.removePhoto(id, uid), false);
  },

  /** 上传头像，成功返回云存储 fileID，失败返回 null */
  uploadAvatar: function (tempPath) {
    return guard(cloud.uploadAvatar(tempPath), null);
  },

  /**
   * 下载图片到系统相册
   * @returns {Promise<Boolean|String>} true=成功；false=失败（已 toast）；'auth'=相册权限被拒，需要页面引导去设置
   */
  downloadToAlbum: function (fileID) {
    return cloud
      .downloadToAlbum(fileID)
      .then(function () {
        return true;
      })
      .catch(function (e) {
        if (e && e.authDeny) return "auth";
        util.toast((e && e.message) || "下载失败");
        return false;
      });
  },
};
