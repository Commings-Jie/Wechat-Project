// utils/util.js - 通用工具函数
// 只放与业务无关的小工具：时间格式化、交互反馈封装

/**
 * 补零：9 -> "09"
 */
function pad(n) {
  return n < 10 ? "0" + n : "" + n;
}

/**
 * 时间戳 -> "2026-09-08"
 * 注意：一定要补零。用 "2026-9-8" 这种不补零的字符串排序会跨月错乱
 * （字符串比较下 "2026-9-30" > "2026-10-01"，9 月会排到 10 月前）。
 */
function formatDate(ts) {
  const d = new Date(Number(ts) || Date.now());
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}

/**
 * 时间戳 -> "2026-09-08 10:30"
 */
function formatDateTime(ts) {
  const d = new Date(Number(ts) || Date.now());
  return (
    formatDate(ts) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes())
  );
}

/**
 * 时间戳 -> 相对时间："刚刚" / "5分钟前" / "3小时前" / "2天前" / 超过7天则用日期
 */
function formatRelative(ts) {
  const now = Date.now();
  const diff = now - Number(ts || 0);
  if (isNaN(diff) || diff < 0) return formatDate(ts);

  const min = 60 * 1000;
  const hour = 60 * min;
  const day = 24 * hour;

  if (diff < min) return "刚刚";
  if (diff < hour) return Math.floor(diff / min) + "分钟前";
  if (diff < day) return Math.floor(diff / hour) + "小时前";
  if (diff < 7 * day) return Math.floor(diff / day) + "天前";
  return formatDate(ts);
}

/**
 * 生成安全的云存储路径：photos/{openid}/{ts}_{rand}.{ext}
 * 从本地临时路径里取扩展名，取不到就默认 .jpg
 */
function buildCloudPath(openid, filePath) {
  const extMatch = /\.([a-zA-Z0-9]+)$/.exec(filePath || "");
  const ext = extMatch ? extMatch[1].toLowerCase() : "jpg";
  const rand = Math.floor(Math.random() * 1000000);
  return "photos/" + (openid || "anonymous") + "/" + Date.now() + "_" + rand + "." + ext;
}

/**
 * 生成头像的云存储路径：avatars/{openid}/{ts}.{ext}
 * chooseAvatar 拿到的是本地临时文件，小程序一关就失效，必须传云端换成 fileID
 */
function buildAvatarPath(openid, filePath) {
  const extMatch = /\.([a-zA-Z0-9]+)$/.exec(filePath || "");
  const ext = extMatch ? extMatch[1].toLowerCase() : "png";
  return "avatars/" + (openid || "anonymous") + "/" + Date.now() + "." + ext;
}

// ========== 交互反馈封装 ==========
// 页面里直接写 wx.showLoading / wx.hideLoading 太啰嗦，统一封装

function showLoading(title) {
  wx.showLoading({ title: title || "加载中", mask: true });
}

function hideLoading() {
  wx.hideLoading();
}

function toast(title, icon) {
  wx.showToast({ title: String(title), icon: icon || "none", duration: 1800 });
}

function toastOK(title) {
  toast(title, "success");
}

module.exports = {
  pad,
  formatDate,
  formatDateTime,
  formatRelative,
  buildCloudPath,
  buildAvatarPath,
  showLoading,
  hideLoading,
  toast,
  toastOK,
};
