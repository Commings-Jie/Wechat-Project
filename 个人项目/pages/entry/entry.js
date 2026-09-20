Page({
  data: {
    entering: false
  },

  enterHome() {
    if (this.data.entering) return
    this.setData({ entering: true })
    wx.switchTab({
      url: '/pages/index/index',
      fail: () => this.setData({ entering: false })
    })
  }
})
