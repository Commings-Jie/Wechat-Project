// services/user.js - 登录态与用户资料
//
// 为什么单独抽一层？
//   登录态要被 app.js（启动恢复）、index（用户条）、add（上传前校验）三处用到。
//   如果每个页面各写一套 wx.getStorageSync，判定口径迟早不一致。
//   这里统一管：内存缓存 + 本地持久化 + 同步到 globalData。
//
// 关于「微信登录」的现状（2022 年后官方改过三次，别再用老接口）：
//   ✗ wx.getUserInfo      —— 2022-02 起废弃，只返回灰色默认头像 + "微信用户"
//   △ wx.getUserProfile   —— 也已在 2022-10 起对新用户不再返回真实资料，只当兜底
//   ✓ 头像昵称填写能力     —— 现行官方方案，见下
//
// 现行方案（本页采用）：
//   头像：<button open-type="chooseAvatar">  用户主动选，返回本地临时路径
//   昵称：<input type="nickname">            聚焦时微信提示"使用微信昵称"
//   然后由开发者自己把临时头像上传持久化 —— 这正是下面 login() 干的活。

const config = require("../utils/config");
const api = require("./api");
const util = require("../utils/util");

// 内存缓存：storage 是同步 IO，列表滚动时别反复读
let _profile = null;

function readStore() {
  try {
    return wx.getStorageSync(config.STORAGE.PROFILE) || null;
  } catch (e) {
    return null;
  }
}

function writeStore(p) {
  try {
    if (p) wx.setStorageSync(config.STORAGE.PROFILE, p);
    else wx.removeStorageSync(config.STORAGE.PROFILE);
  } catch (e) {
    console.warn("[user] 本地缓存写入失败", e);
  }
}

/** 把资料同步到 globalData —— cloud.js 写库时要从这里取昵称和头像 */
function syncGlobal() {
  try {
    const a = getApp();
    if (!a) return;
    a.globalData.userInfo = _profile;
    a.globalData.openid = _profile ? _profile.openid : null;
  } catch (e) {
    // app 还没初始化完，忽略；下次 setProfile 会再同步
  }
}

/** 启动时调用一次，把上次登录的资料读回内存 */
function init() {
  _profile = readStore();
  syncGlobal();
  return _profile;
}

/**
 * 生成账号唯一标识 uid。
 * 每次登录生成一个新 uid —— 即「换头像昵称重新登录 = 新账号」，
 * 图片归属（上传/删除权限）按 uid 判定，而不是只按微信 openid。
 */
function genUid() {
  return "u" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function getProfile() {
  return _profile;
}

/** 是否已登录：以"有 openid 且有 uid"为准，缺 uid 的旧缓存按未登录处理，重新登录会生成新 uid */
function isLogin() {
  return !!(_profile && _profile.openid && _profile.uid);
}

/** 游客模式：用户主动点了"随便逛逛"，之后不再自动弹登录页 */
function isGuest() {
  try {
    return !!wx.getStorageSync(config.STORAGE.GUEST);
  } catch (e) {
    return false;
  }
}

function setGuest(on) {
  try {
    wx.setStorageSync(config.STORAGE.GUEST, on ? 1 : 0);
  } catch (e) {
    console.warn("[user] 游客标记写入失败", e);
  }
}

/**
 * 登录：取 openid → 头像临时路径转永久 fileID → 落盘 + 同步 globalData
 *
 * @param {Object} form
 * @param {String} form.nickName  昵称（必填）
 * @param {String} form.avatarUrl 头像地址，可以是本地临时路径，也可以是已有的 cloud:// 地址
 * @returns {Promise<Object|null>} 成功返回资料对象，失败返回 null（内部已 toast）
 */
function login(form) {
  form = form || {};
  const nick = String(form.nickName || "").trim();
  if (!nick) {
    util.toast("请先填写昵称");
    return Promise.resolve(null);
  }
  if (nick.length > 20) {
    util.toast("昵称不能超过 20 个字");
    return Promise.resolve(null);
  }

  const old = _profile || {};
  let avatarUrl = form.avatarUrl || old.avatarUrl || config.DEFAULT_AVATAR;

  util.showLoading("登录中");

  return api.getOpenid().then(function (openid) {
    if (!openid) {
      util.hideLoading();
      // api 层已经 toast 过了，这里补一句可操作的提示
      util.toast("拿不到用户身份，请检查 photos 云函数是否已部署");
      return null;
    }

    // 只有本地临时路径才需要上传；cloud:// / http 开头说明已经是永久地址
    const needUpload =
      avatarUrl &&
      avatarUrl.indexOf("cloud://") !== 0 &&
      avatarUrl.indexOf("http") !== 0;

    if (!needUpload) {
      return finish(avatarUrl, openid);
    }

    return api.uploadAvatar(avatarUrl).then(function (fileID) {
      // 上传失败不阻断登录，退回默认头像，至少让用户能进得去
      return finish(fileID || config.DEFAULT_AVATAR, openid);
    });
  });

  function finish(finalAvatar, openid) {
    const profile = {
      uid: genUid(), // 本次登录 = 新账号（演示「只能删自己的图」用）
      openid: openid,
      nickName: nick,
      avatarUrl: finalAvatar,
      country: form.country || old.country || "",
      province: form.province || old.province || config.DEFAULT_LOCATION,
      loginTime: Date.now(),
    };
    _profile = profile;
    writeStore(profile);
    syncGlobal();
    util.hideLoading();
    return profile;
  }
}

/** 退出登录：清内存 + 清缓存 + 清 globalData。云存储里的头像文件保留（可能已被图片记录引用） */
function logout() {
  _profile = null;
  writeStore(null);
  syncGlobal();
}

module.exports = {
  init,
  getProfile,
  isLogin,
  isGuest,
  setGuest,
  login,
  logout,
};
