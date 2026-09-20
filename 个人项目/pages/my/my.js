const { getRecords, saveRecords } = require('../../utils/mood')
const { initCloud, syncRecords, updateUserProfile, uploadUserAvatar, social } = require('../../utils/cloud')

const USER_CACHE_KEY = 'user_profile_cache_v2'

Page({
  data: {
    nickname: '微信用户',
    avatarUrl: '',
    moodId: '',
    avatarText: '微',
    cloudStatus: '本地模式',
    recordCount: 0,
    friendCount: 0,
    connecting: false,

    // 修改资料弹窗相关
    showEditModal: false,
    modalNickname: '',
    modalAvatarUrl: '',
    savingProfile: false
  },

  onShow() {
    const app = getApp()
    const cachedProfile = wx.getStorageSync(USER_CACHE_KEY) || {}
    const cloudUser = app.globalData.user || {}

    // 优先采用自定义昵称与头像，不被默认的空头像或通用占位符覆盖
    let nickname = cachedProfile.nickname || cloudUser.nickname || '微信用户'
    let avatarUrl = cachedProfile.avatarUrl || cloudUser.avatarUrl || ''

    this.setData({
      nickname,
      avatarUrl,
      moodId: cloudUser.moodId || '云端连接后生成',
      avatarText: nickname.slice(0, 1),
      cloudStatus: app.globalData.cloudReady ? '云端已连接' : '本地模式',
      recordCount: getRecords().length
    })

    if (app.globalData.cloudReady) {
      social('listFriends')
        .then((result) => this.setData({ friendCount: (result.friends || []).length }))
        .catch(() => {})
    }
  },

  openFriends() { wx.navigateTo({ url: '/pages/friends/friends' }) },
  openCalendar() { wx.switchTab({ url: '/pages/calendar/calendar' }) },
  openStats() { wx.switchTab({ url: '/pages/stats/stats' }) },

  copyMoodId() {
    const { moodId, cloudStatus } = this.data
    if (cloudStatus !== '云端已连接' || !moodId || moodId.includes('后生成') || moodId.includes('退出')) {
      return
    }
    wx.setClipboardData({
      data: moodId,
      success: () => {
        wx.showToast({ title: '好友号已复制', icon: 'success' })
      }
    })
  },

  // 打开修改资料弹窗
  openEditModal() {
    this.setData({
      showEditModal: true,
      modalNickname: this.data.nickname === '微信用户' || this.data.nickname === '心情用户' ? '' : this.data.nickname,
      modalAvatarUrl: this.data.avatarUrl
    })
  },

  closeEditModal() {
    if (this.data.savingProfile) return
    this.setData({ showEditModal: false })
  },

  preventTouchMove() {},

  // 弹窗中：选择微信头像
  onModalChooseAvatar(event) {
    const tempUrl = event.detail.avatarUrl
    if (!tempUrl) return
    this.setData({ modalAvatarUrl: tempUrl })
  },

  // 弹窗中：从相册选图
  chooseFromAlbum() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempPath = res.tempFiles && res.tempFiles[0] && res.tempFiles[0].tempFilePath
        if (tempPath) {
          this.setData({ modalAvatarUrl: tempPath })
        }
      }
    })
  },

  // 弹窗中：输入昵称
  onModalNicknameInput(event) {
    const value = (event.detail.value || '').trim()
    this.setData({ modalNickname: value })
  },

  // 弹窗中：保存资料
  saveEditProfile() {
    const nickname = this.data.modalNickname.trim() || this.data.nickname || '微信用户'
    const newAvatarUrl = this.data.modalAvatarUrl || this.data.avatarUrl
    const app = getApp()

    // 立即持久化到本地缓存，绝对不丢失
    const cacheData = { nickname, avatarUrl: newAvatarUrl }
    wx.setStorageSync(USER_CACHE_KEY, cacheData)

    this.setData({
      nickname,
      avatarUrl: newAvatarUrl,
      avatarText: nickname.slice(0, 1),
      savingProfile: true
    })

    // 如果未连接云端，本地保存后直接关闭
    if (!app.globalData.cloudReady) {
      this.setData({ savingProfile: false, showEditModal: false })
      wx.showToast({ title: '本地资料已更新', icon: 'success' })
      return
    }

    // 判断头像是否需要上传到云存储（本地临时路径需要上传，cloud:// 开头的已经是云文件）
    const isTempFile = newAvatarUrl && !newAvatarUrl.startsWith('cloud://')
    const uploadTask = isTempFile
      ? uploadUserAvatar(newAvatarUrl)
      : Promise.resolve(newAvatarUrl)

    uploadTask
      .then((finalCloudAvatarUrl) => {
        if (finalCloudAvatarUrl && finalCloudAvatarUrl !== newAvatarUrl) {
          cacheData.avatarUrl = finalCloudAvatarUrl
          wx.setStorageSync(USER_CACHE_KEY, cacheData)
          this.setData({ avatarUrl: finalCloudAvatarUrl })
        }
        return updateUserProfile({
          nickname,
          avatarUrl: finalCloudAvatarUrl || newAvatarUrl
        })
      })
      .then((updatedUser) => {
        wx.showToast({ title: '个人资料已更新', icon: 'success' })
        if (app.globalData.user) {
          app.globalData.user.nickname = nickname
          if (updatedUser && updatedUser.avatarUrl) {
            app.globalData.user.avatarUrl = updatedUser.avatarUrl
          }
        }
        this.setData({ showEditModal: false })
      })
      .catch((err) => {
        console.warn('云端同步稍后重试，本地已生效', err)
        // 即使云端异常，本地资料依然生效
        wx.showToast({ title: '本地已更新', icon: 'success' })
        this.setData({ showEditModal: false })
      })
      .finally(() => {
        this.setData({ savingProfile: false })
      })
  },

  connectCloud() {
    if (this.data.connecting) return
    const app = getApp()
    this.setData({ connecting: true })
    initCloud(app)
      .then((user) => {
        app.globalData.user = user
        app.globalData.cloudReady = true
        return syncRecords(getRecords())
      })
      .then((records) => {
        if (Array.isArray(records)) saveRecords(records)
        wx.showToast({ title: '云端已连接', icon: 'success' })
        this.onShow()
      })
      .catch((err) => {
        console.error('云端连接失败', err)
        wx.showToast({ title: '连接失败，请检查云环境', icon: 'none' })
      })
      .finally(() => this.setData({ connecting: false }))
  },

  signOut() {
    wx.showModal({
      title: '退出云端账号',
      content: '退出后本地记录仍会保留，但本次使用将切换为本地模式。再次登录会回到当前微信账号。',
      confirmText: '退出',
      confirmColor: '#C64545',
      success: (result) => {
        if (!result.confirm) return
        const app = getApp()
        app.globalData.cloudReady = false
        app.globalData.user = null
        this.setData({ cloudStatus: '本地模式', moodId: '已退出云端账号', friendCount: 0 })
        wx.showToast({ title: '已退出云端连接', icon: 'success' })
      }
    })
  }
})
