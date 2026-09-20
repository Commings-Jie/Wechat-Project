const {
  WEATHER_TYPES,
  TAGS,
  MIN_RECORD_DATE,
  getMinRecordDate,
  getRecords,
  upsertRecord,
  deleteRecord,
  getToday,
  isDateInRange,
  formatDateText
} = require('../../utils/mood')
const { upsertCloudRecord, removeCloudRecord, uploadCloudImage } = require('../../utils/cloud')

const TAG_META = {
  宅家: ['生活', '🏠'], 朋友: ['生活', '👥'], 家人: ['生活', '💛'], 旅行: ['生活', '🧳'],
  学习: ['活动', '📚'], 美食: ['活动', '🍜'], 游戏: ['活动', '🎮'], 运动: ['活动', '🏃'],
  开心: ['状态', '😊'], 放松: ['状态', '🌿'], 疲惫: ['状态', '😴'], 忙碌: ['状态', '⏰']
}
const TAG_GROUPS = ['生活', '活动', '状态', '自定义']
const STATUS_TAGS = ['开心', '放松', '疲惫', '忙碌']

function buildTagGroups(labels, selectedTags) {
  const groups = TAG_GROUPS.map((name) => ({ name, options: [] }))
  labels.forEach((label) => {
    const meta = TAG_META[label]
    const group = meta ? meta[0] : '自定义'
    const target = groups.find((item) => item.name === group)
    target.options.push({ label, icon: meta ? meta[1] : '✨', selected: selectedTags.includes(label) })
  })
  return groups.filter((group) => group.options.length || group.name === '状态')
}

function triggerHaptic(type = 'light') {
  if (typeof wx.vibrateShort === 'function') {
    wx.vibrateShort({ type, fail: () => {} })
  }
}

Page({
  data: {
    pageTitle: '记录心情',
    minDate: MIN_RECORD_DATE,
    maxDate: '',
    date: '',
    dateText: '',
    weatherTypes: WEATHER_TYPES,
    tagOptions: TAGS.concat(STATUS_TAGS).map((label) => ({ label, selected: false })),
    tagGroups: buildTagGroups(TAGS.concat(STATUS_TAGS), []),
    scoreOptions: [1, 2, 3, 4, 5].map((value) => ({ value, label: `${value}分` })),
    selectedWeather: '',
    moodScore: 0,
    moodText: '',
    selectedTags: [],
    showCustomTagInput: false,
    customTagInput: '',
    images: [],
    isEdit: false
  },

  onLoad(options) {
    const today = getToday()
    const minDate = getMinRecordDate(today)
    const requestedDate = options.date || today
    this.setData({
      minDate,
      maxDate: today
    })
    this.loadRecord(isDateInRange(requestedDate, today) ? requestedDate : today)
  },

  loadRecord(date) {
    const existing = getRecords().find((item) => item.date === date)
    this.originalDate = existing ? date : ''
    const selectedTags = existing ? existing.tags : []
    const presetTags = TAGS.concat(STATUS_TAGS)
    const allTags = presetTags.concat(selectedTags.filter((tag) => !presetTags.includes(tag)))
    this.removedImagePaths = []
    this.setData({
      date,
      dateText: formatDateText(date, true),
      selectedWeather: existing ? existing.weather : '',
      moodScore: existing ? existing.moodScore : 0,
      moodText: existing ? existing.moodText : '',
      selectedTags,
      tagOptions: allTags.map((label) => ({ label, selected: selectedTags.includes(label) })),
      tagGroups: buildTagGroups(allTags, selectedTags),
      showCustomTagInput: false,
      customTagInput: '',
      images: existing ? existing.images.map((path) => ({ path, isNew: false })) : [],
      isEdit: Boolean(existing),
      pageTitle: existing ? '修改心情' : '记录心情'
    })
  },

  onDateChange(event) {
    const date = event.detail.value
    const today = this.data.maxDate || getToday()
    if (date > today) {
      wx.showToast({ title: '不能记录未来日期', icon: 'none' })
      return
    }
    if (date < this.data.minDate) {
      wx.showToast({ title: '仅支持补记近两个月内', icon: 'none' })
      return
    }
    if (date === this.data.date) return

    const existing = getRecords().find((item) => item.date === date)
    if (existing) {
      this.loadRecord(date)
      return
    }

    // 修改已有记录时保留原始日期，保存后将记录从旧日期移动到新日期。
    this.setData({
      date,
      dateText: formatDateText(date, true),
      isEdit: Boolean(this.originalDate),
      pageTitle: this.originalDate ? '修改心情' : '记录心情'
    })
  },

  selectWeather(event) {
    const key = event.currentTarget.dataset.key
    const weather = WEATHER_TYPES.find((item) => item.key === key)
    triggerHaptic('light')
    this.setData({ selectedWeather: key, moodScore: weather ? weather.score : 0 })
  },

  selectMoodScore(event) {
    triggerHaptic('light')
    this.setData({ moodScore: Number(event.currentTarget.dataset.score) })
  },

  inputMood(event) {
    this.setData({ moodText: event.detail.value })
  },

  selectTag(event) {
    const tag = event.currentTarget.dataset.tag
    const alreadySelected = this.data.selectedTags.includes(tag)
    if (!alreadySelected && this.data.selectedTags.length >= 4) {
      wx.showToast({ title: '最多选择 4 个标签', icon: 'none' })
      return
    }
    triggerHaptic('light')
    const selectedTags = alreadySelected
      ? this.data.selectedTags.filter((item) => item !== tag)
      : this.data.selectedTags.concat(tag)
    this.setData({
      selectedTags,
      tagOptions: this.data.tagOptions.map((item) => ({ ...item, selected: selectedTags.includes(item.label) })),
      tagGroups: buildTagGroups(this.data.tagOptions.map((item) => item.label), selectedTags)
    })
  },

  toggleCustomTag() {
    this.setData({ showCustomTagInput: !this.data.showCustomTagInput, customTagInput: '' })
  },

  inputCustomTag(event) {
    this.setData({ customTagInput: event.detail.value })
  },

  addCustomTag() {
    const tag = this.data.customTagInput.trim()
    if (!tag) return wx.showToast({ title: '请输入自定义标签', icon: 'none' })
    if (!this.data.selectedTags.includes(tag) && this.data.selectedTags.length >= 4) return wx.showToast({ title: '最多选择 4 个标签', icon: 'none' })
    const selectedTags = this.data.selectedTags.includes(tag) ? this.data.selectedTags : this.data.selectedTags.concat(tag)
    const labels = this.data.tagOptions.map((item) => item.label)
    const tagOptions = labels.includes(tag)
      ? this.data.tagOptions.map((item) => ({ ...item, selected: selectedTags.includes(item.label) }))
      : this.data.tagOptions.concat({ label: tag, selected: true })
    this.setData({ selectedTags, tagOptions, tagGroups: buildTagGroups(labels.includes(tag) ? labels : labels.concat(tag), selectedTags), customTagInput: '', showCustomTagInput: false })
  },

  chooseImages() {
    const count = 3 - this.data.images.length
    wx.chooseMedia({
      count,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (result) => {
        const additions = result.tempFiles.map((item) => ({ path: item.tempFilePath, isNew: true }))
        this.setData({ images: this.data.images.concat(additions).slice(0, 3) })
      }
    })
  },

  previewImage(event) {
    const current = this.data.images[event.currentTarget.dataset.index].path
    wx.previewImage({ current, urls: this.data.images.map((item) => item.path) })
  },

  removeImage(event) {
    const index = event.currentTarget.dataset.index
    const target = this.data.images[index]
    if (target && !target.isNew) this.removedImagePaths.push(target.path)
    this.setData({ images: this.data.images.filter((item, itemIndex) => itemIndex !== index) })
  },

  saveLocalImage(tempFilePath) {
    return new Promise((resolve, reject) => {
      wx.saveFile({ tempFilePath, success: (result) => resolve(result.savedFilePath), fail: reject })
    })
  },

  async saveImageForRecord(item, date) {
    const app = getApp()
    if (!item.isNew) return item.path
    if (app.globalData.cloudReady) {
      const uploaded = await uploadCloudImage(item.path, date)
      return uploaded.fileID
    }
    return this.saveLocalImage(item.path)
  },

  removeSavedImages(paths) {
    paths.forEach((filePath) => wx.removeSavedFile({ filePath, fail: () => {} }))
  },

  async saveRecord() {
    const { date, selectedWeather, moodText, selectedTags, moodScore } = this.data
    if (!isDateInRange(date, this.data.maxDate)) {
      wx.showToast({ title: '只能记录今天及以前的日期', icon: 'none' })
      return
    }
    if (!selectedWeather) {
      wx.showToast({ title: '请选择心情天气', icon: 'none' })
      return
    }
    if (!moodScore) {
      wx.showToast({ title: '请选择心情强度', icon: 'none' })
      return
    }
    if (!moodText.trim()) {
      wx.showToast({ title: '写一句今天的心情吧', icon: 'none' })
      return
    }
    if (!selectedTags.length) {
      wx.showToast({ title: '请至少选择一个生活标签', icon: 'none' })
      return
    }

    wx.showLoading({ title: '正在保存' })
    let imagePaths
    try {
      imagePaths = await Promise.all(this.data.images.map((item) => this.saveImageForRecord(item, date)))
    } catch (error) {
      wx.hideLoading()
      wx.showToast({ title: '图片保存失败，请重试', icon: 'none' })
      return
    }

    upsertRecord({
      date,
      weather: selectedWeather,
      moodScore,
      moodText: moodText.trim(),
      tags: selectedTags,
      images: imagePaths
    })
    if (this.originalDate && this.originalDate !== date) {
      deleteRecord(this.originalDate)
    }
    const app = getApp()
    let cloudSaved = false
    if (app.globalData.cloudReady) {
      try {
        await upsertCloudRecord({
          date,
          weather: selectedWeather,
          moodScore,
          moodText: moodText.trim(),
          tags: selectedTags,
          images: imagePaths
        })
        if (this.originalDate && this.originalDate !== date) await removeCloudRecord(this.originalDate)
        cloudSaved = true
      } catch (error) {
        console.warn('云端保存失败，已保留本地记录', error)
      }
    }
    this.originalDate = date
    this.removeSavedImages(this.removedImagePaths || [])
    this.removedImagePaths = []

    wx.hideLoading()
    wx.showToast({ title: cloudSaved ? '已保存并同步' : '已保存到本地', icon: 'success' })
    setTimeout(() => wx.navigateBack(), 650)
  },

  removeRecord() {
    if (!this.data.isEdit) return
    wx.showModal({
      title: '删除这条记录',
      content: `${this.data.dateText}的心情记录删除后无法恢复。`,
      confirmText: '删除',
      confirmColor: '#C64545',
      success: (result) => {
        if (!result.confirm) return
        const deleteDate = this.originalDate || this.data.date
        const existing = getRecords().find((item) => item.date === deleteDate)
        if (existing) this.removeSavedImages(existing.images)
        deleteRecord(deleteDate)
        const app = getApp()
        if (app.globalData.cloudReady) removeCloudRecord(deleteDate).catch((error) => console.warn('云端删除失败', error))
        wx.showToast({ title: '已删除', icon: 'success' })
        setTimeout(() => wx.navigateBack(), 650)
      }
    })
  }
})
