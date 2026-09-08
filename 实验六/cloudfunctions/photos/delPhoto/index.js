// cloudfunctions/photos/delPhoto/index.js - 删除图片
//
// 删除必须走云函数，客户端做不到两件事：
//   1. 校验归属：确认这条记录的 _openid 就是调用者本人，防止删别人的图
//   2. 清理云存储：只删数据库记录会留下"孤儿文件"，白占存储容量和费用
//
// 云函数用管理权限操作，可以删任意记录和任意存储文件，所以归属校验必须自己做。

const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const COLL = "photos";

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  const OPENID = wxContext.OPENID;

  if (!OPENID) {
    return { code: 401, msg: "无法获取用户身份" };
  }

  event = event || {};
  const id = String(event.id || "").trim();
  if (!id) {
    return { code: 400, msg: "缺少 id" };
  }

  try {
    // 1) 先查记录，校验归属
    const res = await db.collection(COLL).doc(id).get();
    const photo = res && res.data;
    if (!photo) {
      return { code: 404, msg: "记录不存在" };
    }
    if (photo._openid !== OPENID) {
      console.warn("[delPhoto] 越权删除被拦截:", JSON.stringify({ id: id, from: OPENID }));
      return { code: 403, msg: "只能删除自己的图片" };
    }

    // 同一微信下可有多个「账号」（每次登录一个新 uid），换头像昵称重新登录后不能删旧账号的图
    if (event.uid && photo.uid && photo.uid !== event.uid) {
      console.warn("[delPhoto] 跨账号删除被拦截:", JSON.stringify({ id: id, from: OPENID, uid: event.uid }));
      return { code: 403, msg: "只能删除当前账号上传的图片" };
    }

    // 2) 删数据库记录
    await db.collection(COLL).doc(id).remove();

    // 3) 连带删除云存储文件
    //    失败不回滚（记录已删），只记日志，避免存储里残留孤儿文件
    if (photo.photoUrl) {
      try {
        await cloud.deleteFile({ fileList: [photo.photoUrl] });
      } catch (e) {
        console.error("[delPhoto] 云存储文件删除失败，请手动清理:", photo.photoUrl, e);
      }
    }

    return { code: 0, data: { id: id } };
  } catch (e) {
    console.error("[delPhoto] 删除失败", e);
    return { code: 500, msg: "删除失败" };
  }
};
