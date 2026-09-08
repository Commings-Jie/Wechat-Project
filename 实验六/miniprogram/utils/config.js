// utils/config.js - 全局配置（只放静态常量，不放业务逻辑）
//
// ⭐ 部署时你需要改的地方只有两个：
//   1. CLOUD_ENV  -> 填你自己的云开发环境 ID（形如 cloud1-8gxxxxxx）
//   2. APP_NAME   -> 小程序显示名
//
// 其余参数（集合名 / 分页大小 / 上传上限 / 默认头像）都在这里集中管理，
// 页面和 services 层一律从这里读，不写死。

// ========== 云开发 ==========
const CLOUD_ENV = "cloud1-d4g1avw2tea6fe5fd"; // ← 已填：cloud1-d4g1avw2tea6fe5fd

// ========== 集合名 ==========
const COLLECTIONS = {
  PHOTOS: "photos",
};

// ========== 应用信息 ==========
const APP_NAME = "图片分享社区";

// ========== 列表分页 ==========
const PAGE_SIZE = 20; // 每页条数（云数据库单次 get 上限 20）

// ========== 上传限制 ==========
const MAX_UPLOAD = 9; // 单次最多选几张
const COMPRESS_QUALITY = 80; // 上传前压缩质量 1-100

// ========== 兜底资源 ==========
// getUserInfo 自 2022 年起已废弃，真机/模拟器都可能拿不到真实头像，
// 统一用包内这张图兜底，避免页面出现空白方块。
const DEFAULT_AVATAR = "/images/avatar.png";
const DEFAULT_NICKNAME = "匿名用户";
const DEFAULT_LOCATION = "未知星球";

// ========== 云存储路径前缀 ==========
// 规范：photos/{openid}/{timestamp}_{random}.{ext}
// 好处：归属一目了然，便于按用户清理，也避免根目录重名覆盖
const UPLOAD_ROOT = "photos";
// 用户头像单独放一个目录，和图片内容分开，便于管理和设置生命周期
const AVATAR_ROOT = "avatars";

// ========== 本地缓存 key ==========
// 集中定义，避免各处写魔法字符串写错一个字母导致读不到
const STORAGE = {
  PROFILE: "userProfile", // 登录后的用户资料
  GUEST: "guestMode", // 用户主动选了"随便逛逛"，之后不再自动弹登录
};

module.exports = {
  CLOUD_ENV,
  COLLECTIONS,
  APP_NAME,
  PAGE_SIZE,
  MAX_UPLOAD,
  COMPRESS_QUALITY,
  DEFAULT_AVATAR,
  DEFAULT_NICKNAME,
  DEFAULT_LOCATION,
  UPLOAD_ROOT,
  AVATAR_ROOT,
  STORAGE,
};
