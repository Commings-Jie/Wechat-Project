try {
  const cloud = require('wx-server-sdk')
  cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
} catch (e) {
  // 本地测试或非云端执行环境容错
}
const https = require('https')

function requestJson(url, headers = {}, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      headers: {
        'User-Agent': 'MoodWeatherStation/1.0 (Course Project)',
        'Accept': 'application/json',
        ...headers
      },
      timeout: timeoutMs
    }
    const request = https.get(options, (response) => {
      let body = ''
      response.setEncoding('utf8')
      response.on('data', (chunk) => { body += chunk })
      response.on('end', () => {
        if (response.statusCode !== 200) {
          return reject(new Error(`服务返回 ${response.statusCode}`))
        }
        try {
          resolve(JSON.parse(body))
        } catch (error) {
          reject(new Error('JSON 解析失败'))
        }
      })
    })
    request.on('timeout', () => request.destroy(new Error('请求超时')))
    request.on('error', reject)
  })
}

function parseBigDataCloudLocation(data) {
  if (!data) return ''
  const city = (data.city || data.principalSubdivision || '').replace(/市$/g, '')
  const locality = (data.locality || '').trim()
  if (city && locality && locality !== city) {
    return `${city} · ${locality}`
  }
  if (city) return `${city}市`
  if (locality) return locality
  return ''
}

function parseNominatimLocation(geoData) {
  if (!geoData || !geoData.address) return ''
  const a = geoData.address
  const city = (a.city || a.county || a.district || a.town || '').replace(/市$/g, '')
  const sub = (a.suburb || a.district || '').replace(/街道|地区/g, '')
  if (city && sub && city !== sub) return `${city} · ${sub}`
  if (city) return `${city}市`
  const state = (a.state || a.province || '').replace(/省|自治区/g, '')
  if (state) return `${state}地区`
  return ''
}

// 高德天气现象映射表
function mapAmapWeather(text = '') {
  if (!text) return { key: 'cloudy', code: 2, label: '多云' }
  if (text.includes('雪')) return { key: 'snowy', code: 71, label: text }
  if (text.includes('雷') || text.includes('暴雨')) return { key: 'stormy', code: 95, label: text }
  if (text.includes('雨')) return { key: 'rainy', code: 61, label: text }
  if (text.includes('雾') || text.includes('霾')) return { key: 'foggy', code: 45, label: text }
  if (text.includes('阴')) return { key: 'overcast', code: 3, label: text }
  if (text.includes('多云') || text.includes('少云')) return { key: 'cloudy', code: 2, label: text }
  if (text.includes('晴')) return { key: 'sunny', code: 0, label: text }
  return { key: 'cloudy', code: 2, label: text }
}

function parseWindPowerToSpeed(powerStr = '') {
  if (powerStr.includes('1') || powerStr.includes('2') || powerStr.includes('3') || powerStr.includes('≤3')) return 11
  if (powerStr.includes('4')) return 22
  if (powerStr.includes('5')) return 32
  if (powerStr.includes('6')) return 44
  return 10
}
const WMO_WEATHER_CODES = {
  0: { key: 'sunny', label: '晴朗' }, 1: { key: 'sunny', label: '大部晴朗' },
  2: { key: 'cloudy', label: '局部多云' }, 3: { key: 'overcast', label: '阴天' },
  45: { key: 'foggy', label: '雾' }, 48: { key: 'foggy', label: '雾凇' },
  51: { key: 'rainy', label: '毛毛雨' }, 53: { key: 'rainy', label: '小雨' },
  55: { key: 'rainy', label: '细雨' }, 61: { key: 'rainy', label: '小雨' },
  63: { key: 'rainy', label: '中雨' }, 65: { key: 'rainy', label: '大雨' },
  71: { key: 'snowy', label: '小雪' }, 73: { key: 'snowy', label: '中雪' },
  75: { key: 'snowy', label: '大雪' }, 80: { key: 'rainy', label: '阵雨' },
  81: { key: 'rainy', label: '强阵雨' }, 82: { key: 'stormy', label: '暴雨' },
  95: { key: 'stormy', label: '雷雨' }, 96: { key: 'stormy', label: '雷雨伴冰雹' },
  99: { key: 'stormy', label: '强雷雨' }
}

const AMAP_DEFAULT_KEY = '7d446f47be1e1c4dcd412ffc9ca866b8'

exports.main = async (event = {}) => {
  // 优先取客户端动态传入的经纬度；若无则保底使用默认坐标（青岛黄岛区）
  let lat = Number(event.latitude)
  let lon = Number(event.longitude)
  const hasDynamicCoords = !isNaN(lat) && !isNaN(lon) && lat !== 0 && lon !== 0

  if (!hasDynamicCoords) {
    lat = 35.9590
    lon = 120.1931
  }

  const beijingHour = new Date(Date.now() + 8 * 3600 * 1000).getUTCHours()
  const isNight = beijingHour >= 19 || beijingHour < 6

  // 1. 【高精度首选】高德开放平台 Web 服务（国内地面气象自动站实测与道路级 POI）
  const amapKey = process.env.AMAP_KEY || event.amapKey || AMAP_DEFAULT_KEY
  if (amapKey) {
    try {
      // 1.1 高精度逆地理编码（解析街道道路名与行政区划编码 adcode）
      const regeoUrl = `https://restapi.amap.com/v3/geocode/regeo?location=${lon.toFixed(6)},${lat.toFixed(6)}&key=${amapKey}&extensions=base`
      const regeoResult = await requestJson(regeoUrl, {}, 4500)
      
      let locationText = hasDynamicCoords ? '当地实时天气' : '青岛 · 黄岛区'
      let adcode = '370211' // 默认黄岛区 adcode

      if (regeoResult && regeoResult.status === '1' && regeoResult.regeocode) {
        const comp = regeoResult.regeocode.addressComponent || {}
        const district = comp.district || ''
        const street = (comp.streetNumber && comp.streetNumber.street) || comp.township || ''
        if (comp.adcode && typeof comp.adcode === 'string') {
          adcode = comp.adcode
        }
        if (district && street) {
          locationText = `${district} ${street}`
        } else if (district) {
          locationText = `${comp.city ? comp.city.replace(/市$/g, '') + ' · ' : ''}${district}`
        } else if (comp.city) {
          locationText = comp.city
        }
      }

      // 1.2 高德实时天气（地面气象站实测温）与预报天气（今日最高/最低温）
      const liveUrl = `https://restapi.amap.com/v3/weather/weatherInfo?city=${adcode}&key=${amapKey}&extensions=base`
      const forecastUrl = `https://restapi.amap.com/v3/weather/weatherInfo?city=${adcode}&key=${amapKey}&extensions=all`

      const [liveRes, forecastRes] = await Promise.all([
        requestJson(liveUrl, {}, 4500).catch(e => {
          console.warn('高德实况天气获取失败', e.message)
          return null
        }),
        requestJson(forecastUrl, {}, 4500).catch(e => {
          console.warn('高德预报天气获取失败', e.message)
          return null
        })
      ])

      if (liveRes && liveRes.status === '1' && Array.isArray(liveRes.lives) && liveRes.lives.length > 0) {
        const live = liveRes.lives[0]
        const forecasts = (forecastRes && forecastRes.forecasts && forecastRes.forecasts[0] && forecastRes.forecasts[0].casts) || []
        const todayForecast = forecasts[0] || null

        const currentTemp = Number(live.temperature)
        const minTemp = todayForecast ? Number(todayForecast.nighttemp) : (currentTemp - 3)
        const maxTemp = todayForecast ? Number(todayForecast.daytemp) : (currentTemp + 4)
        const weatherText = live.weather || '晴'
        const mapped = mapAmapWeather(weatherText)

        return {
          ok: true,
          weather: {
            weatherCode: mapped.code,
            weatherKey: mapped.key,
            weatherText,
            temperature: currentTemp,
            minTemperature: minTemp,
            maxTemperature: maxTemp,
            windSpeed: parseWindPowerToSpeed(live.windpower || ''),
            windDirection: live.winddirection || '微风',
            windPower: live.windpower || '≤3',
            humidity: Number(live.humidity) || 60,
            locationText,
            sourceText: '实时天气 (国家气象自动站)',
            latitude: lat,
            longitude: lon,
            isNight
          }
        }
      }
    } catch (amapErr) {
      console.warn('高德服务异常，降级到 Open-Meteo', amapErr.message)
    }
  }

  // 2. 备用容灾逆地理编码（BigDataCloud 与 Nominatim）
  let fallbackLocationText = hasDynamicCoords ? '当地实时天气' : '青岛 · 黄岛区'
  if (hasDynamicCoords) {
    try {
      const bdcUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=zh`
      const bdcResult = await requestJson(bdcUrl, {}, 4000)
      const parsedName = parseBigDataCloudLocation(bdcResult)
      if (parsedName) fallbackLocationText = parsedName
    } catch (err) {
      try {
        const geoUrl = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=zh`
        const geoResult = await requestJson(geoUrl, {}, 4500)
        const parsedName = parseNominatimLocation(geoResult)
        if (parsedName) fallbackLocationText = parsedName
      } catch (nErr) {}
    }
  }

  // 3. 备用容灾天气（Open-Meteo 全球模式）
  const weatherUrl = 'https://api.open-meteo.com/v1/forecast' +
    `?latitude=${lat}&longitude=${lon}` +
    '&current=temperature_2m,weather_code,wind_speed_10m,is_day' +
    '&daily=temperature_2m_max,temperature_2m_min' +
    '&forecast_days=1&timezone=auto' +
    '&models=cma_grapes_global,best_match'

  const weatherResult = await requestJson(weatherUrl, {}, 8000)
  if (!weatherResult.current || !weatherResult.daily) {
    throw new Error('天气服务数据不完整')
  }

  const current = weatherResult.current
  const daily = weatherResult.daily

  const minTemp = (daily.temperature_2m_min_cma_grapes_global && daily.temperature_2m_min_cma_grapes_global[0]) ??
    (daily.temperature_2m_min_best_match && daily.temperature_2m_min_best_match[0]) ??
    (daily.temperature_2m_min && daily.temperature_2m_min[0]) ??
    current.temperature_2m

  const maxTemp = (daily.temperature_2m_max_cma_grapes_global && daily.temperature_2m_max_cma_grapes_global[0]) ??
    (daily.temperature_2m_max_best_match && daily.temperature_2m_max_best_match[0]) ??
    (daily.temperature_2m_max && daily.temperature_2m_max[0]) ??
    current.temperature_2m

  return {
    ok: true,
    weather: {
      weatherCode: current.weather_code,
      weatherKey: (WMO_WEATHER_CODES[current.weather_code] && WMO_WEATHER_CODES[current.weather_code].key) || 'cloudy',
      weatherText: (WMO_WEATHER_CODES[current.weather_code] && WMO_WEATHER_CODES[current.weather_code].label) || '多云',
      temperature: current.temperature_2m,
      windSpeed: current.wind_speed_10m,
      windDirection: '微风',
      windPower: '1-2',
      humidity: 55,
      minTemperature: minTemp,
      maxTemperature: maxTemp,
      locationText: fallbackLocationText,
      sourceText: '实时天气 (CMA模型备用)',
      latitude: lat,
      longitude: lon,
      isNight
    }
  }
}
