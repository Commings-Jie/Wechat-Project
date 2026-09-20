const STORAGE_KEY = 'moodRecords'
const INITIALIZED_KEY = 'moodRecordsInitialized'
const DATE_MOVE_DEDUPED_KEY = 'moodRecordsDateMoveDedupedV1'
function getToday(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getMinRecordDate(today = getToday()) {
  const parts = today.split('-').map(Number)
  if (parts.length !== 3 || isNaN(parts[0]) || isNaN(parts[1])) {
    return '2026-07-01'
  }
  const d = new Date(parts[0], parts[1] - 1 - 2, 1)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}-01`
}

const MIN_RECORD_DATE = getMinRecordDate()

const WEATHER_TYPES = [
  { key: 'sunny', label: '晴天', symbol: '☀️', description: '开心、充满活力', score: 5 },
  { key: 'cloudy', label: '多云', symbol: '⛅', description: '平静、轻松', score: 4 },
  { key: 'overcast', label: '阴天', symbol: '☁️', description: '普通、有点无聊', score: 3 },
  { key: 'rainy', label: '小雨', symbol: '🌧️', description: '难过、有些疲惫', score: 2 },
  { key: 'stormy', label: '雷雨', symbol: '⛈️', description: '烦躁、不太顺利', score: 1 },
  { key: 'rainbow', label: '彩虹', symbol: '🌈', description: '惊喜、非常幸运', score: 5 }
]

const TAGS = ['宅家', '朋友', '学习', '美食', '游戏', '旅行', '运动', '家人']

const DEMO_RECORDS = []

const DEMO_TEXTS = new Set([
  '今天正式开始暑假，感觉非常轻松',
  '和朋友一起去看了电影',
  '在家看了一下午的书',
  '下雨没能出去玩，有一点无聊',
  '第一次自己做冰饮，味道很不错',
  '游戏一直输，心情有点烦躁',
  '和家人出去旅行，看到了大海',
  '晚上散步时看到了漂亮的晚霞'
])

function isDemoRecord(record) {
  if (!record) return false
  return DEMO_TEXTS.has(String(record.moodText || '').trim())
}


function cleanDemoRecords() {
  const records = wx.getStorageSync(STORAGE_KEY)
  if (Array.isArray(records)) {
    const cleaned = records.filter((item) => !isDemoRecord(item))
    if (cleaned.length !== records.length) {
      wx.setStorageSync(STORAGE_KEY, cleaned)
    }
  }
}

function ensureDemoRecords() {
  // 不再为任何用户自动预置演示假数据；同时清理已存在的演示数据
  cleanDemoRecords()
  wx.setStorageSync(INITIALIZED_KEY, true)
  repairDateMoveDuplicates()
}

function repairDateMoveDuplicates() {
  if (wx.getStorageSync(DATE_MOVE_DEDUPED_KEY)) return
  const storedRecords = wx.getStorageSync(STORAGE_KEY)
  if (!Array.isArray(storedRecords)) {
    wx.setStorageSync(DATE_MOVE_DEDUPED_KEY, true)
    return
  }

  const seen = {}
  const repairedRecords = storedRecords
    .map(normalizeRecord)
    .sort((a, b) => b.date.localeCompare(a.date))
    .filter((record) => {
      const signature = JSON.stringify({
        weather: record.weather,
        moodText: record.moodText,
        moodScore: record.moodScore,
        tags: record.tags.slice().sort(),
        images: record.images.slice().sort()
      })
      if (seen[signature]) return false
      seen[signature] = true
      return true
    })

  wx.setStorageSync(STORAGE_KEY, repairedRecords)
  wx.setStorageSync(DATE_MOVE_DEDUPED_KEY, true)
}

function getRecords() {
  const records = wx.getStorageSync(STORAGE_KEY)
  if (!Array.isArray(records)) return []
  const today = getToday()
  return records
    .filter((item) => item.date <= today && !isDemoRecord(item))
    .map(normalizeRecord)
    .sort((a, b) => b.date.localeCompare(a.date))
}

function normalizeRecord(record) {
  const tags = Array.isArray(record.tags) && record.tags.length
    ? record.tags.filter(Boolean)
    : record.tag ? [record.tag] : []
  return {
    ...record,
    tags,
    tag: tags[0] || '',
    tagText: tags.join(' · '),
    images: Array.isArray(record.images) ? record.images.filter(Boolean) : [],
    moodScore: Number(record.moodScore) >= 1 && Number(record.moodScore) <= 5
      ? Number(record.moodScore)
      : getWeather(record.weather).score
  }
}

function saveRecords(records) {
  wx.setStorageSync(STORAGE_KEY, (records || []).filter((r) => !isDemoRecord(r)).slice().sort((a, b) => b.date.localeCompare(a.date)))
  wx.setStorageSync(INITIALIZED_KEY, true)
}

function upsertRecord(record) {
  const records = getRecords()
  const normalizedRecord = normalizeRecord(record)
  const index = records.findIndex((item) => item.date === record.date)
  if (index >= 0) records[index] = normalizedRecord
  else records.push(normalizedRecord)
  saveRecords(records)
}

function deleteRecord(date) {
  saveRecords(getRecords().filter((item) => item.date !== date))
}


function getWeather(key) {
  return WEATHER_TYPES.find((item) => item.key === key) || WEATHER_TYPES[2]
}

function getDominantWeather(records) {
  if (!records.length) return { label: '暂无', symbol: '—' }
  const counts = {}
  records.forEach((item) => {
    counts[item.weather] = (counts[item.weather] || 0) + 1
  })
  const key = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0]
  return getWeather(key)
}

function isDateInRange(date, today = getToday()) {
  const minDate = getMinRecordDate(today)
  return date >= minDate && date <= today
}

function getMonthLabel(monthValue, includeYear = false) {
  const parts = monthValue.split('-').map(Number)
  if (parts.length !== 2) return monthValue
  return includeYear ? `${parts[0]}年${parts[1]}月` : `${parts[1]}月`
}

function getAvailableMonths(today = getToday(), records = getRecords()) {
  const todayMonth = today.slice(0, 7)
  const monthSet = new Set([todayMonth])

  records.forEach((item) => {
    if (item.date && item.date <= today) {
      monthSet.add(item.date.slice(0, 7))
    }
  })

  const sortedMonths = Array.from(monthSet).sort()
  const currentYear = today.split('-')[0]

  return sortedMonths.map((value) => {
    const parts = value.split('-')
    const isDiffYear = parts[0] !== currentYear
    const count = records.filter((item) => item.date.startsWith(value)).length
    return {
      value,
      label: getMonthLabel(value, isDiffYear),
      fullLabel: getMonthLabel(value, true),
      count
    }
  })
}


function getTopTag(records) {
  const counts = {}
  records.forEach((item) => {
    normalizeRecord(item).tags.forEach((tag) => {
      counts[tag] = (counts[tag] || 0) + 1
    })
  })
  return Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0] || '暂无'
}

function getAverageMood(records) {
  if (!records.length) return '0.0'
  const total = records.reduce((sum, item) => sum + normalizeRecord(item).moodScore, 0)
  return (total / records.length).toFixed(1)
}

function getCurrentStreak(records, today = getToday()) {
  const dates = new Set(records.map((item) => item.date))
  let cursor = new Date(`${today}T00:00:00`)
  let streak = 0
  while (dates.has(getToday(cursor))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

function getLongestStreak(records) {
  const dates = Array.from(new Set(records.map((item) => item.date))).sort()
  let longest = 0
  let current = 0
  let previous = ''
  dates.forEach((date) => {
    const previousDate = previous ? new Date(`${previous}T00:00:00`) : null
    const currentDate = new Date(`${date}T00:00:00`)
    const continuous = previousDate && Math.round((currentDate - previousDate) / 86400000) === 1
    current = continuous ? current + 1 : 1
    longest = Math.max(longest, current)
    previous = date
  })
  return longest
}

function formatDateText(date, includeYear = false) {
  const parts = date.split('-')
  if (parts.length !== 3) return date
  return includeYear ? `${parts[0]}年${Number(parts[1])}月${Number(parts[2])}日` : `${Number(parts[1])}月${Number(parts[2])}日`
}

const WEATHER_PIXEL_COLORS = {
  sunny: '#FFA630',
  cloudy: '#00A896',
  overcast: '#83979D',
  rainy: '#3B82C4',
  stormy: '#5E4E9E',
  rainbow: '#E66779'
}

function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate()
}

function getYearInPixels(records, yearInput) {
  const currentYear = new Date().getFullYear()
  const year = Number(yearInput) || currentYear
  const recordMap = {}

  records.forEach((r) => {
    if (r.date && r.date.startsWith(`${year}-`)) {
      recordMap[r.date] = normalizeRecord(r)
    }
  })

  const monthsData = []
  let totalLogged = 0
  let totalScore = 0
  let sunnyCount = 0

  for (let m = 1; m <= 12; m += 1) {
    const monthStr = String(m).padStart(2, '0')
    const maxDays = getDaysInMonth(year, m)
    const days = []

    for (let d = 1; d <= 31; d += 1) {
      if (d > maxDays) {
        days.push({
          day: d,
          isInvalid: true,
          color: 'transparent'
        })
      } else {
        const dateStr = `${year}-${monthStr}-${String(d).padStart(2, '0')}`
        const rec = recordMap[dateStr]
        if (rec) {
          const weatherMeta = getWeather(rec.weather)
          totalLogged += 1
          totalScore += Number(rec.moodScore) || 3
          if (rec.weather === 'sunny' || rec.weather === 'rainbow' || Number(rec.moodScore) >= 4) {
            sunnyCount += 1
          }
          days.push({
            date: dateStr,
            day: d,
            month: m,
            isInvalid: false,
            hasRecord: true,
            weather: rec.weather,
            weatherLabel: weatherMeta.label,
            symbol: weatherMeta.symbol,
            moodScore: rec.moodScore,
            moodText: rec.moodText || '',
            tagText: rec.tagText,
            color: WEATHER_PIXEL_COLORS[rec.weather] || '#00A896'
          })
        } else {
          days.push({
            date: dateStr,
            day: d,
            month: m,
            isInvalid: false,
            hasRecord: false,
            color: '#EDE8DF'
          })
        }
      }
    }

    monthsData.push({
      month: m,
      label: `${m}月`,
      days
    })
  }

  const sunnyRate = totalLogged > 0 ? Math.round((sunnyCount / totalLogged) * 100) : 0
  const yearAverage = totalLogged > 0 ? (totalScore / totalLogged).toFixed(1) : '0.0'

  return {
    year,
    monthsData,
    totalLogged,
    sunnyRate,
    yearAverage
  }
}

function getTagCorrelationStats(records) {
  if (!records || !records.length) {
    return {
      hasData: false,
      rankings: [],
      drainWarning: null,
      insightSummary: '记录更多生活日签与标签后，这里将生成你的专属治愈因果分析。'
    }
  }

  const tagMap = {}
  records.forEach((r) => {
    const norm = normalizeRecord(r)
    const score = Number(norm.moodScore) || 3
    norm.tags.forEach((tag) => {
      if (!tagMap[tag]) {
        tagMap[tag] = { tag, count: 0, totalScore: 0, sunnyCount: 0, lowCount: 0 }
      }
      tagMap[tag].count += 1
      tagMap[tag].totalScore += score
      if (norm.weather === 'sunny' || norm.weather === 'rainbow' || score >= 4) {
        tagMap[tag].sunnyCount += 1
      }
      if (score <= 2) {
        tagMap[tag].lowCount += 1
      }
    })
  })

  const tagList = Object.keys(tagMap).map((tag) => {
    const item = tagMap[tag]
    const avg = Number((item.totalScore / item.count).toFixed(1))
    const sunnyRate = Math.round((item.sunnyCount / item.count) * 100)
    const lowRate = Math.round((item.lowCount / item.count) * 100)
    return {
      tag: item.tag,
      count: item.count,
      average: avg,
      sunnyRate,
      lowRate
    }
  })

  if (!tagList.length) {
    return {
      hasData: false,
      rankings: [],
      drainWarning: null,
      insightSummary: '记录生活日签并打上标签，即可开启治愈因果洞察。'
    }
  }

  const sortedHealing = tagList.slice().sort((a, b) => {
    if (b.average !== a.average) return b.average - a.average
    return b.count - a.count
  })

  const badges = ['🥇 TOP 1', '🥈 TOP 2', '🥉 TOP 3']
  const rankings = sortedHealing.slice(0, 3).map((item, idx) => ({
    ...item,
    badge: badges[idx] || `TOP ${idx + 1}`
  }))

  const sortedDrain = tagList.slice().filter((item) => item.average < 3.8 || item.lowRate >= 25).sort((a, b) => b.lowRate - a.lowRate)
  let drainWarning = null
  if (sortedDrain.length > 0) {
    const topDrain = sortedDrain[0]
    drainWarning = {
      tag: topDrain.tag,
      average: topDrain.average,
      lowRate: topDrain.lowRate,
      tip: `记录【#${topDrain.tag}】时能量消耗较明显（平均 ${topDrain.average}分），适度放慢步调，给自己一个舒缓呼吸的间隙吧。`
    }
  }

  let insightSummary = ''
  if (rankings.length > 0) {
    const top = rankings[0]
    if (rankings.length >= 2) {
      const second = rankings[1]
      insightSummary = `当你在手帖里标记【#${top.tag}】或【#${second.tag}】时，能量最充沛（平均高达 ${top.average}分），它们是你生活里最强大的自愈充电宝！`
    } else {
      insightSummary = `记录【#${top.tag}】的生活瞬间最能治愈你（平均高达 ${top.average}分，放晴率 ${top.sunnyRate}%），记得多把时间留给热爱！`
    }
  } else {
    insightSummary = '多记录带有生活标签的日签，探索属于你的专属自愈密码。'
  }

  return {
    hasData: true,
    rankings,
    drainWarning,
    insightSummary
  }
}

function getWeekdayRhythmStats(records) {
  const weekdayNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
  const mapDays = [1, 2, 3, 4, 5, 6, 0]

  const dayBuckets = mapDays.map((targetDay, index) => {
    return {
      index,
      dayNumber: targetDay,
      name: weekdayNames[index],
      records: []
    }
  })

  records.forEach((r) => {
    if (!r.date) return
    const parts = r.date.split('-').map(Number)
    if (parts.length !== 3) return
    const dateObj = new Date(parts[0], parts[1] - 1, parts[2])
    const dayOfWeek = dateObj.getDay()
    const bucket = dayBuckets.find((b) => b.dayNumber === dayOfWeek)
    if (bucket) {
      bucket.records.push(normalizeRecord(r))
    }
  })

  let peak = null
  let valley = null

  const items = dayBuckets.map((b) => {
    const count = b.records.length
    let avg = 0
    let dominantWeather = { symbol: '', label: '无记录' }
    let heightPercent = 0
    if (count > 0) {
      const total = b.records.reduce((sum, r) => sum + (Number(r.moodScore) || 3), 0)
      avg = Number((total / count).toFixed(1))
      dominantWeather = getDominantWeather(b.records)
      heightPercent = Math.max(Math.round((avg / 5) * 100), 16)
    }

    const item = {
      name: b.name,
      count,
      average: count > 0 ? avg.toFixed(1) : '',
      avgScore: avg,
      heightPercent,
      symbol: dominantWeather.symbol,
      isPeak: false,
      isValley: false
    }

    if (count > 0) {
      if (!peak || avg > peak.avgScore) peak = item
      if (!valley || avg < valley.avgScore) valley = item
    }

    return item
  })

  if (peak && valley && peak.name !== valley.name && peak.avgScore !== valley.avgScore) {
    peak.isPeak = true
    valley.isValley = true
  } else if (peak) {
    peak.isPeak = true
  }

  let rhythmNote = ''
  if (peak && valley && peak.name !== valley.name && peak.avgScore !== valley.avgScore) {
    rhythmNote = `你的能量在【${peak.name}】最饱满（平均 ${peak.average}分），而在【${valley.name}】相对平缓（平均 ${valley.average}分）。顺应你的生活节律，疲惫时温和安歇～`
  } else if (peak) {
    rhythmNote = `【${peak.name}】是目前记录中最具活力的一天（平均 ${peak.average}分），继续保持对生活的热爱与敏锐！`
  } else {
    rhythmNote = '持续记录一周的晴雨，即可揭晓专属于你的生活波峰与波谷节律。'
  }

  return {
    items,
    peakDay: peak ? `${peak.name} (${peak.average}分)` : '—',
    valleyDay: valley && valley !== peak ? `${valley.name} (${valley.average}分)` : '—',
    rhythmNote
  }
}

module.exports = {
  MIN_RECORD_DATE,
  getMinRecordDate,
  WEATHER_TYPES,
  TAGS,
  ensureDemoRecords,
  getRecords,
  saveRecords,
  upsertRecord,
  deleteRecord,
  getWeather,
  getDominantWeather,
  getToday,
  isDateInRange,
  getMonthLabel,
  getAvailableMonths,
  getTopTag,
  getAverageMood,
  getCurrentStreak,
  getLongestStreak,
  formatDateText,
  getYearInPixels,
  getTagCorrelationStats,
  getWeekdayRhythmStats
}
