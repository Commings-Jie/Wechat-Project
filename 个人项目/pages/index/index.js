const {
  getRecords,
  getWeather,
  formatDateText,
  getDominantWeather,
  getToday,
  getCurrentStreak,
  getAverageMood,
  getMinRecordDate
} = require('../../utils/mood')
const { getCloudWeather } = require('../../utils/cloud')

const WEATHER_CACHE_KEY = 'realWeatherSnapshot'

const WEATHER_CODES = {
  0: { key: 'sunny', label: '晴朗', symbol: '☀️' }, 1: { key: 'sunny', label: '大部晴朗', symbol: '🌤️' },
  2: { key: 'cloudy', label: '局部多云', symbol: '⛅' }, 3: { key: 'overcast', label: '阴天', symbol: '☁️' },
  45: { key: 'foggy', label: '雾', symbol: '🌫️' }, 48: { key: 'foggy', label: '雾凇', symbol: '🌫️' },
  51: { key: 'rainy', label: '毛毛雨', symbol: '🌦️' }, 53: { key: 'rainy', label: '小雨', symbol: '🌦️' },
  55: { key: 'rainy', label: '细雨', symbol: '🌧️' }, 61: { key: 'rainy', label: '小雨', symbol: '🌧️' },
  63: { key: 'rainy', label: '中雨', symbol: '🌧️' }, 65: { key: 'rainy', label: '大雨', symbol: '🌧️' },
  71: { key: 'snowy', label: '小雪', symbol: '🌨️' }, 73: { key: 'snowy', label: '中雪', symbol: '🌨️' },
  75: { key: 'snowy', label: '大雪', symbol: '❄️' }, 80: { key: 'rainy', label: '阵雨', symbol: '🌦️' },
  81: { key: 'rainy', label: '强阵雨', symbol: '🌧️' }, 82: { key: 'stormy', label: '暴雨', symbol: '⛈️' },
  95: { key: 'stormy', label: '雷雨', symbol: '⛈️' }, 96: { key: 'stormy', label: '雷雨伴冰雹', symbol: '⛈️' },
  99: { key: 'stormy', label: '强雷雨', symbol: '⛈️' }
}

function buildWeatherView(snapshot) {
  const codeInfo = WEATHER_CODES[snapshot.weatherCode]
  const key = snapshot.weatherKey || (codeInfo && codeInfo.key) || 'cloudy'
  const symbol = (codeInfo && codeInfo.symbol) || '🌤️'
  let label = snapshot.weatherText || (codeInfo && codeInfo.label) || '多云'
  
  const currentHour = new Date().getHours()
  const isNight = typeof snapshot.isNight === 'boolean'
    ? snapshot.isNight
    : (currentHour >= 19 || currentHour < 6)

  let background = `/images/weather/${key}.jpg`

  if (isNight) {
    if (key === 'sunny') {
      label = '晴朗星夜'
      background = '/images/weather/sunny-night.jpg'
    } else if (key === 'cloudy') {
      label = '夜间多云'
      background = '/images/weather/cloudy-night.jpg'
    } else if (key === 'overcast') {
      label = '沉静夜空'
      background = '/images/weather/overcast-night.jpg'
    } else if (key === 'rainy') {
      label = '微凉雨夜'
      background = '/images/weather/rainy-night.jpg'
    }
  }

  // 格式化风向风力与湿度
  let windText = '微风'
  if (snapshot.windDirection && snapshot.windPower) {
    const dir = snapshot.windDirection.includes('风') ? snapshot.windDirection : `${snapshot.windDirection}风`
    const pwr = snapshot.windPower.includes('级') ? snapshot.windPower : `${snapshot.windPower}级`
    windText = `${dir} ${pwr}`
  } else if (snapshot.windSpeed) {
    windText = `微风 ${Math.round(snapshot.windSpeed)} km/h`
  }

  const humidityText = snapshot.humidity ? `${Math.round(snapshot.humidity)}%` : ''

  return {
    ...snapshot,
    key,
    label,
    symbol: isNight ? (key === 'sunny' ? '🌙' : '☁️') : symbol,
    isNight,
    background,
    temperatureText: `${Math.round(snapshot.temperature)}°`,
    rangeText: `${Math.round(snapshot.minTemperature)}° / ${Math.round(snapshot.maxTemperature)}°`,
    windText,
    humidityText
  }
}

Page({
  data: {
    today: '',
    todayText: '',
    greeting: '',
    totalDays: 0,
    dominantMood: '暂无',
    currentStreak: 0,
    monthAverage: '0.0',
    recentRecords: [],
    minDate: getMinRecordDate(),
    maxDate: '',
    cloudStatus: '本地模式',
    weatherState: 'loading',
    weather: {
      key: 'sunny',
      label: '天气加载中',
      symbol: '✨',
      background: '/images/weather/sunny.jpg',
      temperatureText: '--°',
      rangeText: '--° / --°',
      windText: '--',
      locationText: '正在获取天气...',
      sourceText: '实时天气'
    },
    weatherLoading: true,
    weatherError: false,
    isRefreshing: false
  },

  onShow() {
    this.loadPageData()
    this.loadRealWeather()
  },

  loadPageData() {
    const records = getRecords()
    const today = getToday()
    const hour = new Date().getHours()
    const greeting = hour < 11 ? '早上好，记录今天的心情吧' : hour < 18 ? '下午好，今天过得怎么样' : '晚上好，给今天留下一句话'
    const recentRecords = records.slice(0, 5).map((item) => ({
      ...item,
      images: Array.isArray(item.images) ? item.images : [],
      coverImage: (item.images && item.images[0]) || '',
      weatherLabel: getWeather(item.weather).label,
      symbol: getWeather(item.weather).symbol,
      dateText: formatDateText(item.date)
    }))
    const monthRecords = records.filter((item) => item.date.startsWith(today.slice(0, 7)))
    const app = getApp()
    this.setData({
      today,
      todayText: formatDateText(today, true),
      greeting,
      totalDays: records.length,
      dominantMood: getDominantWeather(records).label,
      currentStreak: getCurrentStreak(records, today),
      monthAverage: getAverageMood(monthRecords),
      recentRecords,
      minDate: getMinRecordDate(today),
      maxDate: today,
      cloudStatus: app.globalData.cloudReady ? '云端已连接' : '本地模式'
    })
  },

  loadRealWeather() {
    wx.getSetting({
      success: (res) => {
        const auth = res.authSetting['scope.userLocation']
        if (auth === false) {
          this.setData({
            weatherState: 'denied',
            weatherLoading: false,
            weatherError: false
          })
          return
        }
        this.fetchCurrentLocationAndWeather()
      },
      fail: () => {
        this.fetchCurrentLocationAndWeather()
      }
    })
  },

  fetchCurrentLocationAndWeather(forceRefresh = false) {
    return new Promise((resolve, reject) => {
      wx.getLocation({
        type: 'gcj02',
        success: (loc) => {
          const { latitude, longitude } = loc
          const cached = wx.getStorageSync(WEATHER_CACHE_KEY)
          const nowMs = Date.now()
          const CACHE_TTL_MS = 30 * 60 * 1000 // 30分钟有效时限，保障整点气温及时刷新
          const isFresh = !forceRefresh && cached &&
            cached.date === getToday() &&
            cached.timestamp &&
            (nowMs - cached.timestamp < CACHE_TTL_MS) &&
            cached.latitude &&
            Math.abs(cached.latitude - latitude) < 0.05 &&
            Math.abs(cached.longitude - longitude) < 0.05

          if (isFresh) {
            this.setData({
              weather: buildWeatherView(cached),
              weatherState: 'ready',
              weatherLoading: false,
              weatherError: false
            })
            return resolve(cached)
          } else if (cached && cached.date === getToday()) {
            // 渐进式渲染：先以旧缓存占位，后台立即更新最新气温，防止界面空白
            this.setData({
              weather: buildWeatherView(cached),
              weatherState: 'ready'
            })
          }

          getCloudWeather({ latitude, longitude })
            .then((weather) => {
              const snapshot = {
                ...weather,
                date: getToday(),
                timestamp: Date.now(),
                latitude,
                longitude
              }
              wx.setStorageSync(WEATHER_CACHE_KEY, snapshot)
              this.setData({
                weather: buildWeatherView(snapshot),
                weatherState: 'ready',
                weatherLoading: false,
                weatherError: false
              })
              resolve(snapshot)
            })
            .catch((error) => {
              console.warn('云函数天气请求失败，尝试直连 Open-Meteo', error)
              this.requestWeather(latitude, longitude)
              resolve(cached)
            })
        },
        fail: (error) => {
          console.warn('定位获取失败或用户拒绝授权', error)
          this.setData({
            weatherState: 'denied',
            weatherLoading: false,
            weatherError: false
          })
          reject(error)
        }
      })
    })
  },

  onTapLocation() {
    wx.vibrateShort && wx.vibrateShort({ type: 'light' })
    wx.showLoading({ title: '更新实况中...', mask: true })
    this.fetchCurrentLocationAndWeather(true)
      .then(() => {
        wx.hideLoading()
        wx.showToast({ title: '已对齐最新天气', icon: 'success', duration: 1500 })
      })
      .catch(() => {
        wx.hideLoading()
        wx.showToast({ title: '请检查定位权限', icon: 'none' })
      })
  },

  onPullRefresh() {
    this.setData({ isRefreshing: true })
    wx.vibrateShort && wx.vibrateShort({ type: 'light' })
    this.fetchCurrentLocationAndWeather(true)
      .finally(() => {
        setTimeout(() => {
          this.setData({ isRefreshing: false })
        }, 500)
      })
  },

  requestWeather(latitude, longitude) {
    const currentHour = new Date().getHours()
    const cached = wx.getStorageSync(WEATHER_CACHE_KEY)
    let locationText = (cached && cached.locationText && cached.locationText !== '当前位置')
      ? cached.locationText
      : '当地实时天气'

    // 尝试直连 BigDataCloud 逆地理编码（如后台已配域名或调试模式）
    wx.request({
      url: `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=zh`,
      timeout: 3500,
      success: (geoRes) => {
        const d = geoRes.data
        if (d && (d.city || d.locality)) {
          const city = (d.city || d.principalSubdivision || '').replace(/市$/g, '')
          const locality = (d.locality || '').trim()
          const loc = city && locality && city !== locality ? `${city} · ${locality}` : (city ? `${city}市` : locality)
          if (loc) {
            this.setData({ 'weather.locationText': loc })
            const curCache = wx.getStorageSync(WEATHER_CACHE_KEY) || {}
            wx.setStorageSync(WEATHER_CACHE_KEY, { ...curCache, locationText: loc })
          }
        }
      }
    })

    const url = 'https://api.open-meteo.com/v1/forecast' +
      `?latitude=${latitude}&longitude=${longitude}` +
      '&current=temperature_2m,weather_code,wind_speed_10m,is_day' +
      '&daily=temperature_2m_max,temperature_2m_min' +
      '&forecast_days=1&timezone=auto' +
      '&models=cma_grapes_global,best_match'

    wx.request({
      url,
      timeout: 8000,
      success: (response) => {
        const result = response.data || {}
        const current = result.current
        const daily = result.daily
        if (response.statusCode !== 200 || !current || !daily) {
          console.warn('天气接口返回异常', response.statusCode, result)
          return this.useWeatherFallback('天气接口返回异常')
        }

        const minTemp = (daily.temperature_2m_min_cma_grapes_global && daily.temperature_2m_min_cma_grapes_global[0]) ??
          (daily.temperature_2m_min_best_match && daily.temperature_2m_min_best_match[0]) ??
          (daily.temperature_2m_min && daily.temperature_2m_min[0]) ??
          current.temperature_2m

        const maxTemp = (daily.temperature_2m_max_cma_grapes_global && daily.temperature_2m_max_cma_grapes_global[0]) ??
          (daily.temperature_2m_max_best_match && daily.temperature_2m_max_best_match[0]) ??
          (daily.temperature_2m_max && daily.temperature_2m_max[0]) ??
          current.temperature_2m

        const isNight = typeof current.is_day === 'number'
          ? current.is_day === 0
          : (currentHour >= 19 || currentHour < 6)

        const latestCache = wx.getStorageSync(WEATHER_CACHE_KEY)
        const effectiveLoc = (latestCache && latestCache.locationText && latestCache.locationText !== '当前位置')
          ? latestCache.locationText
          : locationText

        const snapshot = {
          date: getToday(),
          timestamp: Date.now(),
          weatherCode: current.weather_code,
          temperature: current.temperature_2m,
          windSpeed: current.wind_speed_10m,
          minTemperature: minTemp,
          maxTemperature: maxTemp,
          locationText: effectiveLoc,
          sourceText: '实时天气 (CMA模式)',
          latitude,
          longitude,
          isNight
        }
        wx.setStorageSync(WEATHER_CACHE_KEY, snapshot)
        this.setData({
          weather: buildWeatherView(snapshot),
          weatherState: 'ready',
          weatherLoading: false,
          weatherError: false
        })
      },
      fail: (error) => {
        console.warn('天气请求失败', error)
        const message = error && error.errMsg && error.errMsg.indexOf('url not in domain list') >= 0
          ? '请在微信后台配置天气域名'
          : '网络不可用，已使用缓存'
        this.useWeatherFallback(message)
      }
    })
  },

  useWeatherFallback(reason = '网络不可用') {
    const cached = wx.getStorageSync(WEATHER_CACHE_KEY)
    if (cached && cached.date === getToday() && cached.locationText && cached.locationText !== '当前位置' && cached.locationText !== '青岛黄岛区') {
      return this.setData({
        weather: buildWeatherView(cached),
        weatherState: 'ready',
        weatherLoading: false,
        weatherError: true,
        'weather.sourceText': reason
      })
    }
    const hour = new Date().getHours()
    const isNight = hour >= 19 || hour < 6
    this.setData({
      weatherLoading: false,
      weatherError: true,
      'weather.label': isNight ? '沉静星夜' : '天气暂不可用',
      'weather.locationText': '当地天气',
      'weather.sourceText': reason,
      'weather.background': isNight ? '/images/weather/sunny-night.jpg' : '/images/weather/sunny.jpg'
    })
  },

  openLocationSetting() {
    wx.openSetting({
      success: (res) => {
        if (res.authSetting['scope.userLocation']) {
          this.setData({ weatherState: 'loading', weatherLoading: true })
          this.fetchCurrentLocationAndWeather()
        }
      }
    })
  },

  openRecord() { wx.navigateTo({ url: `/pages/record/record?date=${this.data.today}` }) },
  openFriends() { wx.navigateTo({ url: '/pages/friends/friends' }) },
  openPastRecord(event) {
    const date = event.detail.value
    if (date) wx.navigateTo({ url: `/pages/record/record?date=${date}` })
  },
  editRecord(event) { wx.navigateTo({ url: `/pages/record/record?date=${event.currentTarget.dataset.date}` }) },
  previewRecordImages(event) {
    const { date, current } = event.currentTarget.dataset
    const record = this.data.recentRecords.find((item) => item.date === date)
    if (record && record.images && record.images.length) {
      wx.previewImage({
        current: current || record.images[0],
        urls: record.images
      })
    }
  }
})
