// components/photo-card/photo-card.js
// 图片卡片组件：首页和个人主页共用
//
// 抽成组件的好处：两个页面的卡片 wxml/wxss 完全一样，
// 改样式只改这一处，不用在两页之间复制粘贴。

const config = require("../../utils/config");
const util = require("../../utils/util");

Component({
  properties: {
    photo: { type: Object, value: null },
    showDelete: { type: Boolean, value: false }, // 是否显示删除按钮
  },

  data: {
    locationText: "",
    timeText: "",
    defaultAvatar: config.DEFAULT_AVATAR,
    defaultNickname: config.DEFAULT_NICKNAME,
  },

  observers: {
    // photo 变化（含首次赋值）时预计算展示文案，避免在 wxml 里写复杂表达式
    photo: function (p) {
      if (!p) return;

      const parts = [];
      if (p.country) parts.push(p.country);
      if (p.province) parts.push(p.province);
      const location = parts.join(" ") || config.DEFAULT_LOCATION;

      this.setData({
        locationText: location,
        timeText: util.formatRelative(p.createTime),
      });
    },
  },

  methods: {
    // 点头像 -> 去该用户的个人主页
    onAvatarTap: function () {
      const p = this.data.photo;
      if (!p) return;
      this.triggerEvent("avatartap", { openid: p._openid });
    },

    // 点图片 -> 去详情页
    onImageTap: function () {
      const p = this.data.photo;
      if (!p) return;
      this.triggerEvent("imagetap", { id: p._id });
    },

    // 点删除 -> 交给页面处理（页面负责二次确认 + 调接口 + 刷新）
    onDeleteTap: function () {
      const p = this.data.photo;
      if (!p) return;
      this.triggerEvent("delete", { id: p._id });
    },

    // 赞/评论/转发：当前为演示版占位，只给轻提示
    onActionTap: function () {
      wx.showToast({ title: "演示版暂未开放", icon: "none" });
    },
  },
});
