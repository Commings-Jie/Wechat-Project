const { ensureDemoRecords, saveRecords, getRecords } = require('./utils/mood')
const { initCloud, syncRecords } = require('./utils/cloud')

App({
  globalData: {
    cloudReady: false,
    user: null,
    syncReady: false
  },

  onLaunch() {
    ensureDemoRecords()
    const cachedProfile = wx.getStorageSync('user_profile_cache_v2') || null
    initCloud(this, cachedProfile)
      .then((user) => {
        this.globalData.user = { ...(user || {}), ...(cachedProfile || {}) }
        this.globalData.cloudReady = true
        return syncRecords(getRecords())
      })
      .then((records) => {
        if (Array.isArray(records)) saveRecords(records)
        this.globalData.syncReady = true
      })
      .catch((error) => {
        console.warn('云端初始化或同步失败，继续使用本地缓存', error)
        this.globalData.syncReady = true
      })
  }
})
