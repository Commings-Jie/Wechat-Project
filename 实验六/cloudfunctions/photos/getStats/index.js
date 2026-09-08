// cloudfunctions/photos/getStats/index.js - 社区/个人统计
//
// 返回：
//   社区（uid 为空）：photoCount 说说总数、totalView 总浏览量、userCount 社区人数
//   个人（传 uid）：photoCount 该账号说说数、totalView 该账号总浏览量
//
// 为什么用聚合而不是客户端 count？
//   客户端直连数据库时 count 最多只能统计前 20 条（受权限 + 单次限制），
//   用聚合在云函数（admin 权限）里算更准。

const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;
const COLL = "photos";

exports.main = async (event) => {
  event = event || {};
  const uid = String(event.uid || "").trim();

  try {
    const coll = db.collection(COLL);

    // 说说总数
    const countQuery = uid ? coll.where({ uid: uid }) : coll.where({});
    const countRes = await countQuery.count();
    const photoCount = countRes.total || 0;

    // 总浏览量：聚合 sum($viewCount)，字段不存在按 0 计
    let agg = coll.aggregate();
    if (uid) agg = agg.match({ uid: uid });
    const viewAgg = await agg
      .group({ _id: null, totalView: _.aggregate.sum("$viewCount") })
      .end();
    let totalView = 0;
    if (viewAgg.list && viewAgg.list.length) {
      totalView = viewAgg.list[0].totalView || 0;
    }

    // 社区人数：按 _openid 去重分组（仅社区维度统计）
    let userCount = 0;
    if (!uid) {
      const userAgg = await coll
        .aggregate()
        .group({ _id: "$_openid" })
        .end();
      userCount = userAgg.list ? userAgg.list.length : 0;
    } else {
      userCount = photoCount > 0 ? 1 : 0;
    }

    return { code: 0, data: { photoCount, totalView, userCount } };
  } catch (e) {
    console.error("[getStats] 失败", e);
    return { code: 500, msg: "统计失败" };
  }
};
