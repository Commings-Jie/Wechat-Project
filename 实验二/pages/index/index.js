// index.js
Page({
  data: {
    name: '张三',
    school: '某某大学 · 信息学部',
    major: '计算机科学与技术',
    email: 'developer@example.com',
    blog: 'https://example.com',
    intro: '一名白日梦想家，正在学习移动软件开发，平时喜欢阅读、打球与写代码',
    skills: ['Python', '微信小程序', '前端开发', '数据分析', 'AI应用']
  },

  // 复制邮箱到剪贴板
  onCopyEmail() {
    wx.setClipboardData({
      data: this.data.email,
      success() {
        wx.showToast({
          title: '邮箱已复制',
          icon: 'success',
          duration: 1500
        })
      }
    })
  },

  // 访问个人博客
  onVisitBlog() {
    wx.setClipboardData({
      data: this.data.blog,
      success() {
        wx.showToast({
          title: '链接已复制，请在浏览器打开',
          icon: 'none',
          duration: 2000
        })
      }
    })
  },

  onLoad() {
    wx.setNavigationBarTitle({
      title: '我的名片'
    })
  },

  onShareAppMessage() {
    return {
      title: `${this.data.name}的名片`,
      path: '/pages/index/index',
      imageUrl: '/images/card-header.png'
    }
  }
})
