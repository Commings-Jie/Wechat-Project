// cloudfunctions/photos/index.js - 云函数统一入口（路由分发）
//
// 为什么不一个功能建一个云函数？
//   每个云函数都要单独 npm i + 单独部署，冷启动实例也各算一份。
//   收敛成一个入口，用 event.type 分发，管理和部署都简单得多。
//
// 客户端调用：
//   wx.cloud.callFunction({ name: 'photos', data: { type: 'getOpenid' } })
//   wx.cloud.callFunction({ name: 'photos', data: { type: 'addPhoto', fileID, desc, ... } })
//   wx.cloud.callFunction({ name: 'photos', data: { type: 'delPhoto', id } })

const getOpenid = require("./getOpenid/index");
const addPhoto = require("./addPhoto/index");
const delPhoto = require("./delPhoto/index");
const getStats = require("./getStats/index");
const incView = require("./incView/index");

exports.main = async (event, context) => {
  event = event || {};
  // 去首尾空白，防止误传 'delPhoto ' 之类导致命中不到分支
  const type = String(event.type || "").trim();

  console.log("[photos] call:", JSON.stringify({ type: type, keys: Object.keys(event) }));

  switch (type) {
    case "getOpenid":
      return await getOpenid.main(event, context);

    case "addPhoto":
      return await addPhoto.main(event, context);

    case "delPhoto":
      return await delPhoto.main(event, context);

    case "getStats":
      return await getStats.main(event, context);

    case "incView":
      return await incView.main(event, context);

    default:
      console.error("[photos] 未找到入口:", type);
      return { code: -1, msg: "未知操作：" + type };
  }
};
