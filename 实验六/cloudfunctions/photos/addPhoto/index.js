// cloudfunctions/photos/addPhoto/index.js - 新增图片记录
//
// 为什么写库要走云函数而不是客户端直接 db.add()？
//   1. 时间戳由服务端生成，避免客户端时钟偏差导致列表排序错乱
//   2. _openid 由云函数的可信上下文写入，客户端伪造不了
//   3. 字段白名单：只接受下面几个字段，客户端传什么都写不进敏感字段
//      （likes / createTime / _openid 等一律由服务端决定）

const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const COLL = "photos";

/** 截断字符串，防止客户端传超长内容撑爆记录 */
function limit(v, max) {
  if (v === undefined || v === null) return "";
  return String(v).slice(0, max || 200);
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  const OPENID = wxContext.OPENID;

  if (!OPENID) {
    return { code: 401, msg: "无法获取用户身份" };
  }

  event = event || {};
  const fileID = String(event.fileID || "").trim();
  if (!fileID) {
    return { code: 400, msg: "缺少 fileID" };
  }

  // 字段白名单：客户端只准影响这几个字段，其余一律由服务端生成
  const data = {
    photoUrl: limit(fileID, 500),
    desc: limit(event.desc, 200),
    uid: limit(event.uid, 64),
    avatarUrl: limit(event.avatarUrl, 500),
    nickName: limit(event.nickName, 50),
    country: limit(event.country, 50),
    province: limit(event.province, 50),
    _openid: OPENID,
    createTime: Date.now(), // 服务端时间戳
    viewCount: 0, // 浏览量，每次打开详情由 incView 自增
  };

  try {
    const res = await db.collection(COLL).add({ data: data });
    return {
      code: 0,
      data: Object.assign({}, data, { _id: res._id }),
    };
  } catch (e) {
    console.error("[addPhoto] 写库失败", e);
    return { code: 500, msg: "保存失败" };
  }
};
