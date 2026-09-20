const {
  getRecords,
  getDominantWeather,
  getToday,
  getTopTag,
  getAverageMood,
  getCurrentStreak,
  getLongestStreak,
  getYearInPixels,
  getTagCorrelationStats,
  getWeekdayRhythmStats
} = require('../../utils/mood')

Page({
  data: {
    totalDays: 0,
    dominantMood: '暂无',
    dominantSymbol: '—',
    topTag: '暂无',
    averageMood: '0.0',
    currentStreak: 0,
    longestStreak: 0,
    review: null,
    hasRecords: false,
    // 像素墙状态与严格年份边界
    pixelYear: new Date().getFullYear(),
    minYear: new Date().getFullYear(),
    maxYear: new Date().getFullYear(),
    canGoPrev: false,
    canGoNext: false,
    pixelData: null,
    activePixel: null,
    tagCorrelation: null,
    weekdayRhythm: null
  },

  onShow() {
    this.loadStatistics()
  },

  loadStatistics() {
    const records = getRecords()
    const totalDays = records.length
    const dominant = getDominantWeather(records)
    const today = getToday()
    const currentYear = Number(today.slice(0, 4))
    const currentMonth = today.slice(0, 7)

    // 计算有记录的年份边界（以今年为基准下限，如果未记录到明年则不可翻到明年）
    const recordYears = records.length
      ? records.map((r) => Number(r.date.slice(0, 4))).filter((y) => !isNaN(y) && y > 2000)
      : [currentYear]
    const minYear = Math.min(...recordYears, currentYear)
    const maxYear = Math.max(...recordYears, currentYear)
    const pixelYear = Math.min(Math.max(this.data.pixelYear || currentYear, minYear), maxYear)

    const pixelData = getYearInPixels(records, pixelYear)
    let activePixel = this.data.activePixel

    if (!activePixel && pixelData.monthsData) {
      for (let i = 0; i < pixelData.monthsData.length; i += 1) {
        const found = pixelData.monthsData[i].days.find((d) => d.date === today && d.hasRecord)
        if (found) {
          activePixel = found
          break
        }
      }
      if (!activePixel) {
        for (let i = pixelData.monthsData.length - 1; i >= 0; i -= 1) {
          const found = pixelData.monthsData[i].days.slice().reverse().find((d) => d.hasRecord)
          if (found) {
            activePixel = found
            break
          }
        }
      }
    }

    const tagCorrelation = getTagCorrelationStats(records)
    const weekdayRhythm = getWeekdayRhythmStats(records)

    // 月度治愈回顾摘要
    const monthRecords = records.filter((item) => item.date.startsWith(currentMonth))
    const topMonthRecord = monthRecords.slice().sort((a, b) => b.moodScore - a.moodScore)[0]

    this.setData({
      totalDays,
      dominantMood: dominant.label,
      dominantSymbol: dominant.symbol,
      topTag: getTopTag(records),
      averageMood: getAverageMood(records),
      currentStreak: getCurrentStreak(records, today),
      longestStreak: getLongestStreak(records),
      review: {
        monthLabel: `${Number(currentMonth.slice(5, 7))}月`,
        count: monthRecords.length,
        average: getAverageMood(monthRecords),
        topWeather: getDominantWeather(monthRecords).label,
        topDay: topMonthRecord ? `${Number(topMonthRecord.date.slice(5, 7))}月${Number(topMonthRecord.date.slice(-2))}日` : '暂无'
      },
      hasRecords: totalDays > 0,
      pixelYear,
      minYear,
      maxYear,
      canGoPrev: pixelYear > minYear,
      canGoNext: pixelYear < maxYear,
      pixelData,
      activePixel,
      tagCorrelation,
      weekdayRhythm
    })
  },

  onTapPixel(e) {
    const item = e.currentTarget.dataset.item
    if (!item || item.isInvalid) return
    try {
      wx.vibrateShort({ type: 'light' })
    } catch (err) {}
    this.setData({ activePixel: item })
  },

  onChangePixelYear(e) {
    const delta = Number(e.currentTarget.dataset.delta) || 0
    const targetYear = this.data.pixelYear + delta
    if (targetYear < this.data.minYear || targetYear > this.data.maxYear) return
    const records = getRecords()
    const pixelData = getYearInPixels(records, targetYear)
    try {
      wx.vibrateShort({ type: 'light' })
    } catch (err) {}
    this.setData({
      pixelYear: targetYear,
      pixelData,
      canGoPrev: targetYear > this.data.minYear,
      canGoNext: targetYear < this.data.maxYear,
      activePixel: null
    })
  }
})
