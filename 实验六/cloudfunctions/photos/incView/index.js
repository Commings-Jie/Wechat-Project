// cloudfunctions/photos/incView/index.js - 浏览量自增
//
// 每次打开图片详情页调一次，把该图片的 viewCount +1。
// 用服务端 _.inc(1) 而非客户端读改写，避免并发覆盖丢计数。
// 字段不存在时云数据库会自动从 0 开始自增（=1）。

const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;
const COLL = "photos";

exports.main = async (event) => {
  event = event || {};
  const id = String(event.id || "").trim();
  if (!id) {
    return { code: 400, msg: "缺少 id" };
  }

  try {
    await db
      .collection(COLL)
      .doc(id)
      .update({ data: { viewCount: _.inc(1) } });
    return { code: 0 };
  } catch (e) {
    console.error("[incView] 失败", e);
    return { code: 500, msg: "更新失败" };
  }
};
