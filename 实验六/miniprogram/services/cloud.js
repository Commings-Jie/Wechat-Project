// services/cloud.js - 云开发数据源实现
//
// 这是唯一直接调用 wx.cloud.* 的文件。
// 页面和其他任何地方都不应该出现 wx.cloud，一律走 services/api.js。
//
// 读（列表/详情）：客户端直连数据库 —— 受"所有用户可读"权限约束，无冷启动，支持实时
// 写（新增/删除）：走云函数 —— 服务端时间戳（避免客户端时钟偏差）、
//                  强制写入 _openid、字段白名单、删除时连带清理云存储

const config = require("../utils/config");
const util = require("../utils/util");

const COLL = config.COLLECTIONS.PHOTOS;

function coll() {
  return wx.cloud.database().collection(COLL);
}

/**
 * 取当前用户 openid
 * openid 属于敏感信息，客户端拿不到，必须走云函数
 */
async function getOpenid() {
  const res = await wx.cloud.callFunction({
    name: "photos",
    data: { type: "getOpenid" },
  });
  return res && res.result && res.result.openid;
}

/**
 * 图片列表（分页）
 * @param {Object} opt
 * @param {String} opt.openid  传则只查该微信用户，不传查全部
 * @param {String} opt.uid     传则只查该账号（每次登录一个 uid），不传查全部
 * @param {Number} opt.page    页码，从 0 开始
 * @param {Number} opt.pageSize
 * @returns {Promise<{list:Array, hasMore:Boolean}>}
 */
async function listPhotos(opt) {
  opt = opt || {};
  const openid = opt.openid;
  const uid = opt.uid;
  const page = opt.page || 0;
  const pageSize = opt.pageSize || config.PAGE_SIZE;

  let query = coll();
  if (uid) {
    query = query.where({ uid: uid });
  } else if (openid) {
    query = query.where({ _openid: openid });
  }

  const res = await query
    .orderBy("createTime", "desc")
    .skip(page * pageSize)
    .limit(pageSize)
    .get();

  const list = res.data || [];
  return { list: list, hasMore: list.length === pageSize };
}

/**
 * 单张图片详情
 */
async function getPhoto(id) {
  const res = await coll().doc(id).get();
  return res.data;
}

/**
 * 社区 / 个人统计
 * @param {String} [uid] 传则只统计该账号，不传统计整个社区
 * @returns {Promise<Object|null>} { photoCount, totalView, userCount }
 */
async function getStats(uid) {
  const res = await wx.cloud.callFunction({
    name: "photos",
    data: { type: "getStats", uid: uid || "" },
  });
  if (!res || !res.result || res.result.code !== 0) {
    console.warn("[cloud] getStats 失败", res && res.result);
    return null;
  }
  return res.result.data;
}

/**
 * 浏览量自增（打开详情页时调用）
 * @param {String} id 图片 _id
 */
async function incView(id) {
  const res = await wx.cloud.callFunction({
    name: "photos",
    data: { type: "incView", id: id },
  });
  if (!res || !res.result || res.result.code !== 0) {
    throw new Error((res && res.result && res.result.msg) || "浏览量更新失败");
  }
  return true;
}

/**
 * 上传图片：压缩 → 传云存储 → 云函数写库
 * @param {String} filePath 本地临时路径
 * @param {String} desc     图片描述（可选）
 */
async function addPhoto(filePath, desc) {
  const app = getApp();
  const userInfo = app.globalData.userInfo || {};

  // 1) 压缩：手机原图动辄 3-5MB，压到 100-400KB 能显著省存储容量和 CDN 流量
  let src = filePath;
  try {
    const compressed = await wx.compressImage({
      src: filePath,
      quality: config.COMPRESS_QUALITY,
    });
    if (compressed && compressed.tempFilePath) {
      src = compressed.tempFilePath;
    }
  } catch (e) {
    // 压缩失败就传原图，不阻断流程
    console.warn("[cloud] 压缩失败，改用原图", e);
  }

  // 2) 上传到云存储（路径规范：photos/{openid}/{ts}_{rand}.{ext}）
  let openid = app.globalData.openid;
  if (!openid) {
    openid = await getOpenid();
    app.globalData.openid = openid;
  }
  const cloudPath = util.buildCloudPath(openid, filePath);
  const upload = await wx.cloud.uploadFile({ cloudPath: cloudPath, filePath: src });
  if (!upload || !upload.fileID) {
    throw new Error("上传到云存储失败");
  }

  // 3) 写数据库（走云函数：服务端时间戳 + openid/uid 归属 + 字段白名单）
  const res = await wx.cloud.callFunction({
    name: "photos",
    data: {
      type: "addPhoto",
      fileID: upload.fileID,
      desc: String(desc || ""),
      uid: userInfo.uid || "",
      avatarUrl: userInfo.avatarUrl || config.DEFAULT_AVATAR,
      nickName: userInfo.nickName || config.DEFAULT_NICKNAME,
      country: userInfo.country || "",
      province: userInfo.province || config.DEFAULT_LOCATION,
    },
  });

  if (!res || !res.result || res.result.code !== 0) {
    throw new Error((res && res.result && res.result.msg) || "保存失败");
  }
  return res.result.data;
}

/**
 * 下载图片到本地相册
 * 两步：云存储下载到临时文件 -> 保存到系统相册
 * 相册权限被拒时会抛出带 authDeny 标记的错误，由页面引导去设置页开启
 */
async function downloadToAlbum(fileID) {
  const res = await wx.cloud.downloadFile({ fileID: fileID });
  if (!res || !res.tempFilePath) {
    throw new Error("下载失败");
  }
  try {
    await wx.saveImageToPhotosAlbum({ filePath: res.tempFilePath });
  } catch (e) {
    const msg = (e && e.errMsg) || "";
    if (msg.indexOf("auth deny") >= 0 || msg.indexOf("authorize") >= 0) {
      const err = new Error("没有相册权限");
      err.authDeny = true;
      throw err;
    }
    throw new Error("保存失败");
  }
  return true;
}

/**
 * 上传头像到云存储，返回永久 fileID
 *
 * ⚠️ 关键：open-type="chooseAvatar" 拿到的 avatarUrl 是**本地临时路径**
 * （形如 wxfile://tmp_xxx.png），小程序一退出就失效，直接存库下次就白图了。
 * 必须传到云存储换成 cloud:// 开头的 fileID 再持久化。
 * 反过来，如果已经是 cloud:// 或 http 开头，说明是永久地址了，别重复传。
 */
async function uploadAvatar(tempPath) {
  const app = getApp();
  let openid = app.globalData.openid;
  if (!openid) {
    openid = await getOpenid();
    app.globalData.openid = openid;
  }
  const cloudPath = util.buildAvatarPath(openid, tempPath);
  const res = await wx.cloud.uploadFile({ cloudPath: cloudPath, filePath: tempPath });
  if (!res || !res.fileID) {
    throw new Error("头像上传失败");
  }
  return res.fileID;
}

/**
 * 删除图片（走云函数）
 * 云函数里会校验：1) 是本人微信（_openid） 2) 是当前账号（uid），
 * 并同时删除数据库记录和云存储文件，避免只删记录留下"孤儿文件"白占存储容量。
 */
async function removePhoto(id, uid) {
  const res = await wx.cloud.callFunction({
    name: "photos",
    data: { type: "delPhoto", id: id, uid: uid || "" },
  });
  if (!res || !res.result || res.result.code !== 0) {
    throw new Error((res && res.result && res.result.msg) || "删除失败");
  }
  return true;
}

module.exports = {
  getOpenid,
  listPhotos,
  getPhoto,
  getStats,
  incView,
  addPhoto,
  removePhoto,
  downloadToAlbum,
  uploadAvatar,
};
