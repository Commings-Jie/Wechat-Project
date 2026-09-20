const CLOUD_ENV = 'cloud1-d4g1avw2tea6fe5fd'

function getCloud() {
  if (typeof wx === 'undefined' || !wx.cloud) throw new Error('当前基础库不支持云开发')
  return wx.cloud
}

function callFunction(name, data = {}) {
  return new Promise((resolve, reject) => {
    getCloud().callFunction({ name, data, success: (result) => {
      if (result && result.result && result.result.ok === false) return reject(new Error(result.result.message || '云函数执行失败'))
      resolve(result && result.result)
    }, fail: reject })
  })
}

function initCloud(app, userProfile = null) {
  const cloud = getCloud()
  cloud.init({ env: CLOUD_ENV, traceUser: true })
  const payload = userProfile ? {
    userProfile,
    nickname: userProfile.nickname || userProfile.nickName || '',
    avatarUrl: userProfile.avatarUrl || ''
  } : {}
  return callFunction('login', payload)
    .then((result) => result.user)
    .then((user) => {
      const mergedUser = { ...(user || {}), ...(userProfile || {}) }
      if (app) app.globalData.user = mergedUser
      return mergedUser
    })
}

function syncRecords(localRecords) {
  return callFunction('records', { action: 'sync', records: localRecords })
    .then((result) => result.records || [])
}

function upsertCloudRecord(record) {
  return callFunction('records', { action: 'upsert', record }).then((result) => result.record)
}

function removeCloudRecord(date) {
  return callFunction('records', { action: 'remove', date })
}

function uploadCloudImage(filePath, date) {
  return new Promise((resolve, reject) => {
    getCloud().uploadFile({
      cloudPath: `mood-images/${date}-${Date.now()}-${Math.random().toString(16).slice(2)}.jpg`,
      filePath,
      success: resolve,
      fail: reject
    })
  })
}

function updateUserProfile(profile = {}) {
  const nickname = typeof profile.nickname === 'string' ? profile.nickname : ''
  const avatarUrl = typeof profile.avatarUrl === 'string' ? profile.avatarUrl : ''
  const payload = {
    ...profile,
    nickname,
    avatarUrl,
    userProfile: {
      nickName: nickname,
      avatarUrl: avatarUrl
    }
  }
  return callFunction('login', payload)
    .then((result) => result.user || {})
    .then((user) => {
      const app = getApp()
      if (app) {
        app.globalData.user = {
          ...(app.globalData.user || {}),
          ...user
        }
      }
      return user
    })
}

function uploadUserAvatar(filePath) {
  return new Promise((resolve, reject) => {
    getCloud().uploadFile({
      cloudPath: `user-avatars/${Date.now()}-${Math.random().toString(16).slice(2)}.jpg`,
      filePath,
      success: (res) => resolve(res.fileID),
      fail: reject
    })
  })
}

function social(action, data = {}) {
  return callFunction('social', { action, ...data })
}

function getCloudWeather(coords = {}) {
  const data = {}
  if (coords && !isNaN(Number(coords.latitude)) && !isNaN(Number(coords.longitude))) {
    data.latitude = Number(coords.latitude)
    data.longitude = Number(coords.longitude)
  }
  return callFunction('weather', data).then((result) => result.weather)
}

module.exports = {
  CLOUD_ENV,
  initCloud,
  updateUserProfile,
  uploadUserAvatar,
  syncRecords,
  upsertCloudRecord,
  removeCloudRecord,
  uploadCloudImage,
  social,
  getCloudWeather
}

