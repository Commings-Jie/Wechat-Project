const {
  getRecords,
  getWeather,
  getToday,
  isDateInRange,
  getAvailableMonths,
  getMonthLabel,
  formatDateText
} = require('../../utils/mood')

function buildCalendarDays(monthValue, records, today, selectedDate) {
  if (!monthValue) return []
  const parts = monthValue.split('-').map(Number)
  const year = parts[0]
  const month = parts[1]
  const daysInMonth = new Date(year, month, 0).getDate()

  // 1号是周几 (0是周日, 1是周一, ..., 6是周六)
  const firstDayIndex = new Date(year, month - 1, 1).getDay()
  // 按周一排在第一列：周一为0，周二为1，...，周日为6
  const leadOffset = (firstDayIndex + 6) % 7

  const recordMap = {}
  records.forEach((item) => {
    recordMap[item.date] = item
  })

  const days = []

  // 前置占位空格
  for (let i = 0; i < leadOffset; i += 1) {
    days.push({
      isEmpty: true,
      key: `lead-${i}`
    })
  }

  // 当月各天
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = `${monthValue}-${String(day).padStart(2, '0')}`
    const record = recordMap[date] || null
    const isToday = date === today
    const isFuture = date > today
    const isSelected = date === selectedDate
    const weather = record ? getWeather(record.weather) : null

    days.push({
      isEmpty: false,
      key: date,
      date,
      day,
      isToday,
      isFuture,
      isSelected,
      hasRecord: !!record,
      weatherSymbol: weather ? weather.symbol : '',
      weatherLabel: weather ? weather.label : '',
      moodScore: record ? record.moodScore : null
    })
  }

  // 后置补齐整行（7的倍数）
  const remainder = days.length % 7
  if (remainder > 0) {
    const tailOffset = 7 - remainder
    for (let i = 0; i < tailOffset; i += 1) {
      days.push({
        isEmpty: true,
        key: `tail-${i}`
      })
    }
  }

  return days
}

function triggerHaptic(type = 'light') {
  if (typeof wx.vibrateShort === 'function') {
    wx.vibrateShort({ type, fail: () => {} })
  }
}

function drawImageCover(ctx, img, x, y, w, h, radius = 4) {
  const imgRatio = img.width / img.height
  const targetRatio = w / h
  let sx = 0
  let sy = 0
  let sw = img.width
  let sh = img.height
  if (imgRatio > targetRatio) {
    sw = img.height * targetRatio
    sx = (img.width - sw) / 2
  } else {
    sh = img.width / targetRatio
    sy = (img.height - sh) / 2
  }
  ctx.save()
  if (radius > 0) {
    ctx.beginPath()
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(x, y, w, h, radius)
    } else {
      ctx.rect(x, y, w, h)
    }
    ctx.clip()
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h)
  ctx.restore()
}

function drawSawtoothEdge(ctx, y, width, isTop) {
  const toothW = 8
  const toothH = 4
  const count = Math.ceil(width / toothW)
  ctx.save()
  ctx.strokeStyle = '#D8D0C5'
  ctx.lineWidth = 1
  ctx.beginPath()
  if (isTop) {
    ctx.moveTo(0, y)
    for (let i = 0; i < count; i += 1) {
      ctx.lineTo(i * toothW + toothW / 2, y + toothH)
      ctx.lineTo((i + 1) * toothW, y)
    }
  } else {
    ctx.moveTo(0, y)
    for (let i = 0; i < count; i += 1) {
      ctx.lineTo(i * toothW + toothW / 2, y - toothH)
      ctx.lineTo((i + 1) * toothW, y)
    }
  }
  ctx.stroke()
  ctx.restore()
}

function wrapCanvasText(ctx, text, maxWidth) {
  if (!text) return []
  const raw = String(text).trim()
  const lines = []
  let currentLine = ''
  for (let i = 0; i < raw.length; i += 1) {
    const char = raw[i]
    if (char === '\n') {
      if (currentLine) lines.push(currentLine)
      currentLine = ''
      continue
    }
    const testLine = currentLine + char
    if (ctx.measureText(testLine).width > maxWidth) {
      if (currentLine) lines.push(currentLine)
      currentLine = char
    } else {
      currentLine = testLine
    }
  }
  if (currentLine) lines.push(currentLine)
  return lines
}

function sanitizeSymbolForCanvas(str) {
  if (!str) return ''
  // 过滤 Unicode 变体选择符（Android 2D Canvas 遇到 \uFE00-\uFE0F 会渲染成 tofu box 方框 []）
  return str.replace(/[\uFE00-\uFE0F]/g, '').trim()
}

function getDayOfWeek(dateStr) {
  if (!dateStr) return ''
  const weekDays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
  const d = new Date(dateStr.replace(/-/g, '/'))
  return isNaN(d.getTime()) ? '' : weekDays[d.getDay()]
}

function generateMoodInsights(record) {
  if (!record) {
    return {
      theme: '微光宁静日 · 平淡生欢',
      badge: '且听风吟 · 静水流深',
      suit: '放空小憩 · 静心阅读 · 享受独处',
      avoid: '自我苛求 · 无谓比较',
      quote: '平凡的日子里，藏着最踏实的幸福，风起风停皆风景。'
    }
  }

  const score = Number(record.moodScore) || 3
  const weatherKey = record.weather || 'cloudy'
  const text = String(record.moodText || '').toLowerCase().trim()
  const tags = Array.isArray(record.tags) ? record.tags : []
  const hasImages = Array.isArray(record.images) && record.images.length > 0
  const imageCount = hasImages ? record.images.length : 0

  // 1. 多维语义与生活情境解析
  const hasStudyTag = tags.includes('学习')
  const hasStudyText = /作业|大作业|考试|论文|复习|实验|上课|学完|交了|提交|课程|答辩|刷题|毕业|项目|报告/.test(text)
  const isStudy = hasStudyTag || hasStudyText

  const hasFoodTag = tags.includes('美食')
  const hasFoodText = /吃|火锅|烧烤|烤肉|大餐|甜品|冰淇淋|奶茶|自助|美味|好吃|蛋糕|零食|咖啡|做饭|烹饪|日料|寿喜烧|铁板烧|饱/.test(text)
  const isFood = hasFoodTag || hasFoodText

  const hasTiredTag = tags.includes('疲惫') || tags.includes('忙碌')
  const hasTiredText = /累|疲惫|熬夜|加班|头疼|失眠|emo|烦|辛苦|满课|崩溃|难受|耗尽|焦虑|心力/.test(text)
  const isTired = hasTiredTag || hasTiredText

  const hasSocialTag = tags.includes('朋友') || tags.includes('家人')
  const hasSocialText = /朋友|家人|爸妈|聚会|逛街|聊天|聚餐|碰面|约会|一起|合影|同窗|室友|闺蜜|兄弟/.test(text)
  const isSocial = hasSocialTag || hasSocialText

  const hasSportsTag = tags.includes('运动')
  const hasSportsText = /跑步|骑行|打球|健身|散步|游泳|爬山|暴汗|跳绳|瑜伽|徒步|球赛/.test(text)
  const isSports = hasSportsTag || hasSportsText

  const hasGameTag = tags.includes('游戏')
  const hasGameText = /游戏|通关|赢了|连胜|打赢|开黑|上分|战绩|原神|崩铁|王者|排位|五杀|胜利/.test(text)
  const isGame = hasGameTag || hasGameText

  const hasHomeTag = tags.includes('宅家')
  const hasHomeText = /宅|窝着|猫|狗|看书|听歌|刷剧|追剧|放空|发呆|睡觉|打盹|被窝|暖和|独处/.test(text)
  const isHome = hasHomeTag || hasHomeText

  const hasTravelTag = tags.includes('旅行')
  const hasTravelText = /旅行|出发|风景|大海|日落|晚霞|海边|景区|游玩|出游|打卡|旅途|看海/.test(text)
  const isTravel = hasTravelTag || hasTravelText

  const isRelief = /搞定|完成|做完|交了|终于|写完|大作业|提交|打完|结束|胜出/.test(text) || tags.includes('放松')
  const isHappy = score >= 4 || /开心|太棒了|好运|顺利|惊喜|爽|快乐|棒极了|超赞|满分|喜欢/.test(text)
  const isDown = score <= 2 || /烦|难过|伤心|emo|不顺|失望|糟糕|倒霉|痛苦/.test(text)

  // 2. 优先级场景决策树（结合 留言 + 标签 + 照片 + 能量）

  // 情境 1：学业/课题/大作业（最高优先级，直击学生的学习成就与卸重时刻）
  if (isStudy) {
    if (isRelief || isHappy) {
      return {
        theme: '学业告捷日 · 功不唐捐',
        badge: '终稿落定 · 尽享松弛',
        suit: '关掉电脑 · 大睡一觉 · 犒劳自己',
        avoid: '操心细节 · 焦虑内耗',
        quote: '所有伏案疾书的苦读，都会化作日后铺就繁花的坦途；今天辛苦了，你做得很好。'
      }
    }
    return {
      theme: '笃行致远日 · 墨香沉潜',
      badge: '潜心深耕 · 步履不停',
      suit: '梳理思路 · 专注当下 · 适度小憩',
      avoid: '焦躁急切 · 攀比进度',
      quote: '流水不争先，争的是滔滔不绝；每一个微小的专注，都是未来惊艳的伏笔。'
    }
  }

  // 情境 2：舌尖美食（有照片时强调光影锁鲜，无照片时强调舌尖治愈）
  if (isFood) {
    if (hasImages) {
      return {
        theme: '珍馐定格日 · 烟火自愈',
        badge: '镜头锁鲜 · 胃里暖暖',
        suit: '大快朵颐 · 拍照留念 · 慢品烟火',
        avoid: '节食内耗 · 匆忙吞咽',
        quote: '人间烟火气，最抚凡人心；镜头锁住了美味，胃里装满了对生活的热爱。'
      }
    }
    return {
      theme: '人间至味日 · 烟火欢愉',
      badge: '慢品人间 · 舌尖幸福',
      suit: '细嚼慢咽 · 尝口热汤 · 胃里暖暖',
      avoid: '应付饱腹 · 进食焦虑',
      quote: '好好吃饭，是对平凡生活最深情的告白；一餐一饭，皆是治愈良药。'
    }
  }

  // 情境 3：社交与陪伴（朋友 / 家人 / 约会）
  if (isSocial) {
    if (hasImages) {
      return {
        theme: '同频欢聚日 · 胶片珍藏',
        badge: '同框欢笑 · 定格心动',
        suit: '畅怀大笑 · 畅聊趣事 · 合影留念',
        avoid: '低头看手机 · 社交内耗',
        quote: '朋友是自己选择的家人；照片里彼此大笑的模样，是岁月里最灿烂的星河。'
      }
    }
    return {
      theme: '温情相伴日 · 彼此照亮',
      badge: '碰杯共叙 · 胜过良药',
      suit: '敞开心扉 · 真诚表达 · 倾听彼此',
      avoid: '强颜欢笑 · 闷在心底',
      quote: '世界的温柔，往往藏在那些与同行者的细语呢喃和并肩前行里。'
    }
  }

  // 情境 4：运动与流汗释压
  if (isSports) {
    return {
      theme: '活力奔涌日 · 向阳生长',
      badge: '汗水排毒 · 步履轻盈',
      suit: '大汗淋漓 · 多喝温水 · 感受微风',
      avoid: '过度透支 · 运动后受凉',
      quote: '奔跑的时候，耳边只有自由的风声；把烦恼留在身后，把轻盈还给身体。'
    }
  }

  // 情境 5：游戏娱乐解压
  if (isGame) {
    if (isHappy || isRelief) {
      return {
        theme: '荣耀通关日 · 满级畅快',
        badge: '绝杀翻盘 · 快乐拉满',
        suit: '痛快上分 · 享受对决 · 队友碰杯',
        avoid: '熬夜透支 · 久坐不起',
        quote: '游戏是生活的小小避难所；通关的快乐纯粹而滚烫，尽情享受这一刻！'
      }
    }
    return {
      theme: '战术复盘日 · 胜败从容',
      badge: '心态放平 · 下把必胜',
      suit: '喝杯温水 · 伸个懒腰 · 听首慢歌',
      avoid: '上头较真 · 连败硬撑',
      quote: '胜败乃兵家常事，放平心态的你比胜利更帅气；歇一歇，下把必然凯旋。'
    }
  }

  // 情境 6：旅行出行与摄影定格
  if (isTravel || (hasImages && imageCount >= 2)) {
    return {
      theme: '光影漫游日 · 岁月留真',
      badge: '山海可蹈 · 快门锁帧',
      suit: '漫步看景 · 捕捉光影 · 翻看相册',
      avoid: '赶路匆忙 · 走马观花',
      quote: '快门是时间的停顿键；那些被镜头封存的光影与温柔，会在未来的岁月中闪闪发亮。'
    }
  }

  // 情境 7：慢调宅家与独处自愈
  if (hasHomeTag || (hasHomeText && !isTired)) {
    return {
      theme: '安隅小憩日 · 浮生偷闲',
      badge: '猫窝书香 · 偏安一隅',
      suit: '点上香薰 · 泡杯热茶 · 松软发呆',
      avoid: '刷短视频 · 虚度自责',
      quote: '独处是给灵魂放风的时刻；慢下来，不争朝夕，顺遂由心，享受属于自己的小小宇宙。'
    }
  }

  // 情境 8：疲惫透支 / 满课辛苦 / EMO休整
  if (isTired || isDown) {
    return {
      theme: '能量蓄水日 · 允许停歇',
      badge: '温茶暖身 · 抱抱自己',
      suit: '热淋浴暖身 · 早点钻被窝 · 听雨白噪音',
      avoid: '强撑坚强 · 深夜焦虑复盘',
      quote: '允许自己偶尔不那么坚强；累了就停下歇脚，喝杯热水好好睡一觉，晚风会吹散所有乌云。'
    }
  }

  // 情境 9：包含上传照片的日常美好（即使没有写特定词汇）
  if (hasImages) {
    return {
      theme: score >= 4 ? '光影寻常日 · 美好定格' : '片刻微光日 · 岁月留印',
      badge: '胶片锁帧 · 诗意栖居',
      suit: '翻看胶卷 · 捕捉微光 · 保持心动',
      avoid: '琐碎磨灭 · 忽视美好',
      quote: '生活常常琐碎，但只要镜头里有光，那些定格的瞬间就足以温暖好几个长夜。'
    }
  }

  // 情境 10：纯天气与能量分值自然回退（用户仅选天气，未填写复杂文本）
  const weatherInsights = {
    rainbow: {
      theme: '幸运降临日 · 奇迹发生',
      badge: '彩虹破云 · 惊喜常在',
      suit: '许个心愿 · 迎接惊喜 · 拥抱确幸',
      avoid: '视而不见 · 错失心动',
      quote: '只要心怀澄澈，乌云之后必有绚烂彩虹为你绽放。'
    },
    5: {
      theme: '多巴胺高光日 · 能量充沛',
      badge: '晴光万丈 · 心花怒放',
      suit: '记录高光 · 分享喜悦 · 向阳奔跑',
      avoid: '犹豫不决 · 内耗焦虑',
      quote: '生活明朗，万物可爱，眼里有光，心向暖阳。'
    },
    4: {
      theme: '松弛蓄能日 · 惬意从容',
      badge: '闲云漫卷 · 怡然自得',
      suit: '漫步吹风 · 听喜欢的歌 · 尝口甜品',
      avoid: '过度紧绷 · 匆忙赶路',
      quote: '慢慢来，谁不是翻山越岭；日落尤其温柔，人间皆是浪漫。'
    },
    3: {
      theme: '微光宁静日 · 平淡生欢',
      badge: '且听风吟 · 静水流深',
      suit: '放空小憩 · 静心阅读 · 享受独处',
      avoid: '自我苛求 · 无谓比较',
      quote: '平凡的日子里，藏着最踏实的幸福，风起风停皆风景。'
    },
    2: {
      theme: '雨落休整日 · 听雨安歇',
      badge: '温茶暖胃 · 抱抱自己',
      suit: '早点休息 · 热饮暖身 · 听淅沥雨声',
      avoid: '深夜熬夜 · 独自生闷气',
      quote: '累了就歇一歇脚，乌云终会散开，明天依然澄澈崭新。'
    },
    1: {
      theme: '情绪排毒日 · 重塑自愈',
      badge: '允许脆弱 · 拥抱释怀',
      suit: '深呼吸 · 放下包袱 · 好好睡一觉',
      avoid: '自我怀疑 · 强撑坚强',
      quote: '无论今天经历了什么，请相信，你远比自己想象的更坚韧。'
    }
  }

  if (weatherKey === 'rainbow') return weatherInsights.rainbow
  return weatherInsights[score] || weatherInsights[3]
}

function drawSparkle(ctx, cx, cy, r, color) {
  ctx.save()
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(cx, cy - r)
  ctx.quadraticCurveTo(cx, cy, cx + r, cy)
  ctx.quadraticCurveTo(cx, cy, cx, cy + r)
  ctx.quadraticCurveTo(cx, cy, cx - r, cy)
  ctx.quadraticCurveTo(cx, cy, cx, cy - r)
  ctx.fill()
  ctx.restore()
}

function drawWeatherStamp(ctx, x, y, enTitle, zhTitle, strokeColor) {
  ctx.save()
  ctx.strokeStyle = strokeColor
  ctx.fillStyle = strokeColor
  ctx.lineWidth = 0.85

  // 外圈细实线
  ctx.beginPath()
  ctx.arc(x, y, 22, 0, Math.PI * 2)
  ctx.stroke()

  // 内圈装饰细实线
  ctx.beginPath()
  ctx.arc(x, y, 17, 0, Math.PI * 2)
  ctx.stroke()

  // 内部英文与中文副标
  ctx.textAlign = 'center'
  ctx.font = 'bold 7px monospace'
  ctx.fillText(enTitle, x, y - 2)

  ctx.font = '7px sans-serif'
  ctx.fillText(zhTitle, x, y + 8)

  ctx.restore()
}

function drawPillBadge(ctx, x, y, w, h, radius, text, bgFill, borderStroke, textFill) {
  ctx.save()
  ctx.beginPath()
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, radius)
  } else {
    ctx.rect(x, y, w, h)
  }
  ctx.fillStyle = bgFill
  ctx.fill()
  if (borderStroke) {
    ctx.strokeStyle = borderStroke
    ctx.lineWidth = 0.8
    ctx.stroke()
  }
  ctx.fillStyle = textFill
  ctx.font = 'bold 9px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x + w / 2, y + h / 2)
  ctx.restore()
}

function drawWeatherAtmosphere(ctx, weatherKey, w, h) {
  const configs = {
    sunny: {
      paperBg: '#FFF7EB',
      tapeColors: ['#FF6B35', '#FFA630'],
      stampColor: 'rgba(217, 106, 39, 0.65)',
      stampEn: 'SUNNY DAY',
      stampZh: '岁月晴光',
      renderAura: () => {
        const g1 = ctx.createRadialGradient(0, 0, 10, 0, 0, 220)
        g1.addColorStop(0, 'rgba(255, 205, 120, 0.50)')
        g1.addColorStop(0.5, 'rgba(255, 225, 160, 0.25)')
        g1.addColorStop(1, 'rgba(255, 247, 235, 0)')
        ctx.fillStyle = g1
        ctx.fillRect(0, 0, 240, 240)

        const g2 = ctx.createRadialGradient(w, h, 10, w, h, 180)
        g2.addColorStop(0, 'rgba(255, 215, 140, 0.35)')
        g2.addColorStop(1, 'rgba(255, 247, 235, 0)')
        ctx.fillStyle = g2
        ctx.fillRect(w - 180, h - 180, 180, 180)
      },
      renderTextures: () => {
        ctx.save()
        ctx.strokeStyle = 'rgba(235, 160, 50, 0.22)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(0, 0)
        ctx.lineTo(80, 140)
        ctx.moveTo(0, 0)
        ctx.lineTo(130, 95)
        ctx.moveTo(0, 0)
        ctx.lineTo(170, 55)
        ctx.stroke()
        ctx.restore()

        drawSparkle(ctx, w - 76, 52, 4.5, 'rgba(225, 140, 35, 0.55)')
        drawSparkle(ctx, 24, 98, 3.5, 'rgba(225, 140, 35, 0.45)')
        drawSparkle(ctx, w - 24, h - 86, 4, 'rgba(225, 140, 35, 0.50)')
      }
    },
    cloudy: {
      paperBg: '#EEF7FB',
      tapeColors: ['#00A896', '#028090'],
      stampColor: 'rgba(0, 168, 150, 0.65)',
      stampEn: 'CLOUDY SKY',
      stampZh: '闲云漫卷',
      renderAura: () => {
        const g1 = ctx.createRadialGradient(w * 0.3, 0, 10, w * 0.3, 0, 220)
        g1.addColorStop(0, 'rgba(168, 220, 242, 0.55)')
        g1.addColorStop(0.7, 'rgba(200, 235, 248, 0.25)')
        g1.addColorStop(1, 'rgba(238, 247, 251, 0)')
        ctx.fillStyle = g1
        ctx.fillRect(0, 0, 260, 220)

        const g2 = ctx.createRadialGradient(w, h * 0.85, 10, w, h * 0.85, 180)
        g2.addColorStop(0, 'rgba(180, 228, 245, 0.40)')
        g2.addColorStop(1, 'rgba(238, 247, 251, 0)')
        ctx.fillStyle = g2
        ctx.fillRect(w - 180, h - 220, 180, 220)
      },
      renderTextures: () => {
        ctx.save()
        ctx.strokeStyle = 'rgba(70, 165, 195, 0.45)'
        ctx.lineWidth = 1.2
        ctx.beginPath()
        ctx.moveTo(w - 110, 54)
        ctx.bezierCurveTo(w - 95, 42, w - 80, 42, w - 70, 52)
        ctx.bezierCurveTo(w - 60, 44, w - 45, 46, w - 35, 54)
        ctx.stroke()

        ctx.beginPath()
        ctx.moveTo(18, h - 90)
        ctx.bezierCurveTo(32, h - 100, 48, h - 98, 58, h - 88)
        ctx.bezierCurveTo(68, h - 94, 84, h - 92, 94, h - 84)
        ctx.stroke()
        ctx.restore()
      }
    },
    overcast: {
      paperBg: '#EAEFF2',
      tapeColors: ['#455A64', '#607D8B'],
      stampColor: 'rgba(69, 90, 100, 0.65)',
      stampEn: 'OVERCAST',
      stampZh: '偏安一隅',
      renderAura: () => {
        const g1 = ctx.createRadialGradient(w, 0, 10, w, 0, 220)
        g1.addColorStop(0, 'rgba(175, 192, 202, 0.50)')
        g1.addColorStop(0.7, 'rgba(205, 218, 224, 0.25)')
        g1.addColorStop(1, 'rgba(234, 239, 242, 0)')
        ctx.fillStyle = g1
        ctx.fillRect(w - 220, 0, 220, 220)
      },
      renderTextures: () => {
        ctx.save()
        ctx.fillStyle = 'rgba(115, 138, 150, 0.22)'
        for (let x = 14; x < w; x += 16) {
          for (let y = 14; y < h; y += 16) {
            ctx.fillRect(x, y, 1.2, 1.2)
          }
        }

        ctx.strokeStyle = 'rgba(130, 150, 160, 0.35)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(20, h - 50)
        ctx.bezierCurveTo(w * 0.4, h - 58, w * 0.7, h - 44, w - 20, h - 52)
        ctx.stroke()
        ctx.restore()
      }
    },
    rainy: {
      paperBg: '#E6F2F7',
      tapeColors: ['#1B4965', '#2B7094'],
      stampColor: 'rgba(27, 73, 101, 0.65)',
      stampEn: 'RAIN POST',
      stampZh: '听雨入梦',
      renderAura: () => {
        const g1 = ctx.createLinearGradient(0, 0, 0, 160)
        g1.addColorStop(0, 'rgba(145, 195, 220, 0.50)')
        g1.addColorStop(1, 'rgba(230, 242, 247, 0)')
        ctx.fillStyle = g1
        ctx.fillRect(0, 0, w, 160)

        const g2 = ctx.createRadialGradient(w, h, 10, w, h, 180)
        g2.addColorStop(0, 'rgba(150, 198, 222, 0.42)')
        g2.addColorStop(1, 'rgba(230, 242, 247, 0)')
        ctx.fillStyle = g2
        ctx.fillRect(w - 180, h - 180, 180, 180)
      },
      renderTextures: () => {
        ctx.save()
        ctx.strokeStyle = 'rgba(65, 135, 168, 0.42)'
        ctx.lineWidth = 1.1
        const rainPoints = [
          [w - 85, 34], [w - 68, 48], [w - 92, 62], [w - 50, 40],
          [20, h - 98], [38, h - 82], [26, h - 66], [48, h - 54]
        ]
        rainPoints.forEach(([rx, ry]) => {
          ctx.beginPath()
          ctx.moveTo(rx, ry)
          ctx.lineTo(rx + 5, ry + 12)
          ctx.stroke()
        })

        ctx.strokeStyle = 'rgba(75, 145, 178, 0.38)'
        ctx.beginPath()
        ctx.arc(w - 36, h - 70, 8, 0, Math.PI * 2)
        ctx.stroke()
        ctx.beginPath()
        ctx.arc(w - 36, h - 70, 16, 0, Math.PI * 2)
        ctx.stroke()
        ctx.restore()
      }
    },
    stormy: {
      paperBg: '#E8E4F2',
      tapeColors: ['#352852', '#5A457E'],
      stampColor: 'rgba(53, 40, 82, 0.65)',
      stampEn: 'STORM PASS',
      stampZh: '风雨自愈',
      renderAura: () => {
        const g1 = ctx.createRadialGradient(0, 0, 10, 0, 0, 230)
        g1.addColorStop(0, 'rgba(155, 142, 195, 0.50)')
        g1.addColorStop(0.7, 'rgba(195, 185, 225, 0.25)')
        g1.addColorStop(1, 'rgba(232, 228, 242, 0)')
        ctx.fillStyle = g1
        ctx.fillRect(0, 0, 240, 240)

        const g2 = ctx.createLinearGradient(0, h - 140, 0, h)
        g2.addColorStop(0, 'rgba(232, 228, 242, 0)')
        g2.addColorStop(1, 'rgba(165, 155, 200, 0.35)')
        ctx.fillStyle = g2
        ctx.fillRect(0, h - 140, w, 140)
      },
      renderTextures: () => {
        ctx.save()
        ctx.strokeStyle = 'rgba(160, 125, 215, 0.65)'
        ctx.lineWidth = 1.6
        ctx.beginPath()
        ctx.moveTo(w - 74, 42)
        ctx.lineTo(w - 82, 52)
        ctx.lineTo(w - 77, 53)
        ctx.lineTo(w - 85, 65)
        ctx.stroke()
        ctx.restore()
      }
    },
    rainbow: {
      paperBg: '#FFF0F5',
      tapeColors: ['#FF9EB5', '#FFD166', '#06D6A0', '#118AB2'],
      stampColor: 'rgba(215, 60, 120, 0.65)',
      stampEn: 'RAINBOW PASS',
      stampZh: '奇迹之桥',
      renderAura: () => {
        const g1 = ctx.createRadialGradient(24, 30, 10, 24, 30, 180)
        g1.addColorStop(0, 'rgba(255, 180, 210, 0.48)')
        g1.addColorStop(1, 'rgba(255, 240, 245, 0)')
        ctx.fillStyle = g1
        ctx.fillRect(0, 0, 200, 200)

        const g2 = ctx.createRadialGradient(w - 30, 40, 10, w - 30, 40, 170)
        g2.addColorStop(0, 'rgba(255, 230, 150, 0.45)')
        g2.addColorStop(1, 'rgba(255, 240, 245, 0)')
        ctx.fillStyle = g2
        ctx.fillRect(w - 180, 0, 180, 180)

        const g3 = ctx.createRadialGradient(w * 0.5, h, 10, w * 0.5, h, 200)
        g3.addColorStop(0, 'rgba(160, 230, 245, 0.40)')
        g3.addColorStop(1, 'rgba(255, 240, 245, 0)')
        ctx.fillStyle = g3
        ctx.fillRect(0, h - 200, w, 200)
      },
      renderTextures: () => {
        drawSparkle(ctx, w - 74, 50, 4.5, 'rgba(240, 130, 170, 0.55)')
        drawSparkle(ctx, 26, 94, 4, 'rgba(80, 190, 210, 0.55)')
        drawSparkle(ctx, w - 26, h - 84, 4.5, 'rgba(255, 185, 45, 0.55)')
      }
    }
  }

  const config = configs[weatherKey] || configs.sunny

  // 1. 底纸特种纸材质填充
  ctx.fillStyle = config.paperBg
  ctx.fillRect(0, 0, w, h)

  // 2. 渲染专属天候水彩光晕
  if (typeof config.renderAura === 'function') {
    config.renderAura()
  }

  // 3. 渲染专属天候微肌理与微水印
  if (typeof config.renderTextures === 'function') {
    config.renderTextures()
  }

  // 4. 盖印复古天气邮票钢印（右上角）
  drawWeatherStamp(ctx, w - 36, 48, config.stampEn, config.stampZh, config.stampColor)

  return config
}

Page({
  data: {
    months: [],
    selectedMonth: '',
    selectedMonthText: '',
    selectedMonthCount: 0,
    monthScrollTarget: '',
    today: '',
    selectedDate: '',
    selectedRecord: null,
    calendarDays: [],
    showReceiptModal: false,
    receiptImagePath: '',
    savingReceipt: false
  },

  onLoad() {
    this.refreshMonths(true)
  },

  onShow() {
    this.refreshMonths(false, () => {
      this.refreshSelectedRecord()
    })
  },

  refreshMonths(selectLatest, callback) {
    const today = getToday()
    const records = getRecords()
    const months = getAvailableMonths(today, records)
    const todayMonth = today.slice(0, 7)
    const isNewMonth = !this.data.months.some((item) => item.value === todayMonth)
    const currentSelectionExists = months.some((item) => item.value === this.data.selectedMonth)
    const selectedMonth = selectLatest || isNewMonth || !currentSelectionExists || !this.data.selectedMonth
      ? todayMonth
      : this.data.selectedMonth
    const selectedMeta = months.find((item) => item.value === selectedMonth)

    const monthRecords = records.filter((item) => item.date.startsWith(selectedMonth))
    let selectedRecord = null
    let selectedDate = this.data.selectedDate
    if (selectedDate && monthRecords.some((item) => item.date === selectedDate)) {
      const rec = monthRecords.find((item) => item.date === selectedDate)
      const weather = getWeather(rec.weather)
      selectedRecord = {
        ...rec,
        dateText: formatDateText(rec.date, true),
        weatherLabel: weather.label,
        symbol: weather.symbol
      }
    } else if (monthRecords.length > 0) {
      const rec = monthRecords[0]
      selectedDate = rec.date
      const weather = getWeather(rec.weather)
      selectedRecord = {
        ...rec,
        dateText: formatDateText(rec.date, true),
        weatherLabel: weather.label,
        symbol: weather.symbol
      }
    } else {
      selectedDate = ''
    }

    const calendarDays = buildCalendarDays(selectedMonth, records, today, selectedDate)

    this.setData({
      today,
      months,
      selectedMonth,
      selectedMonthText: getMonthLabel(selectedMonth, true),
      selectedMonthCount: selectedMeta ? selectedMeta.count : 0,
      monthScrollTarget: `month-${selectedMonth}`,
      selectedDate,
      selectedRecord,
      calendarDays
    }, callback)
  },

  refreshSelectedRecord() {
    const records = getRecords()
    const { selectedMonth, today, selectedDate, selectedRecord } = this.data
    const calendarDays = buildCalendarDays(selectedMonth, records, today, selectedDate)

    if (!selectedRecord) {
      this.setData({ calendarDays })
      return
    }

    const record = records.find((item) => item.date === selectedRecord.date)
    if (!record) {
      this.setData({ selectedRecord: null, calendarDays })
      return
    }

    const weather = getWeather(record.weather)
    this.setData({
      selectedRecord: {
        ...record,
        dateText: formatDateText(record.date, true),
        weatherLabel: weather.label,
        symbol: weather.symbol
      },
      calendarDays
    })
  },

  selectMonth(event) {
    const selectedMonth = event.currentTarget.dataset.month
    if (selectedMonth === this.data.selectedMonth) return
    const selectedMeta = this.data.months.find((item) => item.value === selectedMonth)
    const records = getRecords()
    const monthRecords = records.filter((item) => item.date.startsWith(selectedMonth))
    let selectedRecord = null
    let selectedDate = ''
    if (monthRecords.length > 0) {
      const rec = monthRecords[0]
      selectedDate = rec.date
      const weather = getWeather(rec.weather)
      selectedRecord = {
        ...rec,
        dateText: formatDateText(rec.date, true),
        weatherLabel: weather.label,
        symbol: weather.symbol
      }
    }

    const calendarDays = buildCalendarDays(selectedMonth, records, this.data.today, selectedDate)

    this.setData({
      selectedMonth,
      selectedMonthText: getMonthLabel(selectedMonth, true),
      selectedMonthCount: selectedMeta ? selectedMeta.count : 0,
      monthScrollTarget: `month-${selectedMonth}`,
      selectedDate,
      selectedRecord,
      calendarDays
    })
  },

  onTapDayCell(event) {
    const { date, future } = event.currentTarget.dataset
    if (!date) return
    if (future) {
      wx.showToast({ title: '未来日期还不能记录', icon: 'none' })
      return
    }
    triggerHaptic('light')
    this.selectDate(date)
  },

  selectDate(date) {
    if (!isDateInRange(date, this.data.today)) {
      wx.showToast({ title: '未来日期还不能记录', icon: 'none' })
      return
    }
    const records = getRecords()
    const record = records.find((item) => item.date === date)
    if (!record) {
      const calendarDays = buildCalendarDays(this.data.selectedMonth, records, this.data.today, date)
      this.setData({ selectedRecord: null, selectedDate: date, calendarDays })
      wx.showModal({
        title: '这一天还没有记录',
        content: `要记录${formatDateText(date, true)}的心情吗？`,
        confirmText: '去记录',
        success: (result) => {
          if (result.confirm) {
            wx.navigateTo({ url: `/pages/record/record?date=${date}` })
          }
        }
      })
      return
    }

    const weather = getWeather(record.weather)
    const calendarDays = buildCalendarDays(this.data.selectedMonth, records, this.data.today, date)
    this.setData({
      selectedDate: date,
      selectedRecord: {
        ...record,
        dateText: formatDateText(record.date, true),
        weatherLabel: weather.label,
        symbol: weather.symbol
      },
      calendarDays
    })
  },

  openReceiptModal() {
    const { selectedRecord } = this.data
    if (!selectedRecord) {
      wx.showToast({ title: '请先选择一条心情记录', icon: 'none' })
      return
    }
    triggerHaptic('light')
    wx.showLoading({ title: '正在编排日签...', mask: true })
    this.renderReceipt(selectedRecord)
  },

  closeReceiptModal() {
    this.setData({ showReceiptModal: false })
  },

  stopBubble() {},
  preventTouchMove() {
    return false
  },

  renderReceipt(record) {
    const query = wx.createSelectorQuery().in(this)
    query.select('#receiptCanvas')
      .fields({ node: true, size: true })
      .exec(async (res) => {
        if (!res || !res[0] || !res[0].node) {
          wx.hideLoading()
          wx.showToast({ title: '画布获取失败', icon: 'none' })
          return
        }

        const canvas = res[0].node
        const ctx = canvas.getContext('2d')
        const dpr = wx.getSystemInfoSync().pixelRatio || 2
        const canvasWidth = 320

        // 情绪深度启发式洞察与净化天气符号（移除变体选择符消除 Android tofu box 方框）
        const insight = generateMoodInsights(record)
        const sanitizedSymbol = sanitizeSymbolForCanvas(record.symbol)
        const dayOfWeek = getDayOfWeek(record.date)

        // 1. 文本自适应安全折行与高度计算（日记、宜忌、寄语均自动折行，彻底消除溢出）
        ctx.font = '13px sans-serif'
        const rawText = (record.moodText || '这一天没有留下文字记录~').trim()
        const textLines = wrapCanvasText(ctx, rawText, canvasWidth - 64)
        const textBlockHeight = Math.max(textLines.length * 20 + 26, 46)

        // 宜忌便签安全折行计算与精细布局（专属胶囊徽章 + 悬挂缩进 + 中缝线）
        ctx.font = '11px sans-serif'
        const cleanSuit = String(insight.suit || '').replace(/^【宜】\s*/, '').trim()
        const cleanAvoid = String(insight.avoid || '').replace(/^【忌】\s*/, '').trim()
        const almanacTextWidth = canvasWidth - 88
        const suitLines = wrapCanvasText(ctx, cleanSuit, almanacTextWidth)
        const avoidLines = wrapCanvasText(ctx, cleanAvoid, almanacTextWidth)
        const almanacRow1H = Math.max(suitLines.length * 17, 18)
        const almanacRow2H = Math.max(avoidLines.length * 17, 18)
        const almanacBoxHeight = 12 + almanacRow1H + 12 + almanacRow2H + 12

        // 治愈寄语自适应居中折行计算
        ctx.font = '11px sans-serif'
        const quoteLines = wrapCanvasText(ctx, `“ ${insight.quote} ”`, canvasWidth - 60)
        const quoteBlockHeight = quoteLines.length * 18

        // 2. 批量处理配图（支持 1~3 张，并发下载 cloud:// 资源）
        const rawImages = (record.images && Array.isArray(record.images)) ? record.images.slice(0, 3) : []
        const localImages = []
        for (let i = 0; i < rawImages.length; i += 1) {
          const rawImg = rawImages[i]
          if (rawImg.startsWith('cloud://')) {
            try {
              const dlRes = await wx.cloud.downloadFile({ fileID: rawImg })
              localImages.push(dlRes.tempFilePath)
            } catch (dlErr) {
              console.warn('下载日签配图失败', dlErr)
            }
          } else {
            localImages.push(rawImg)
          }
        }

        // 计算图片块高度
        let imageBlockHeight = 0
        if (localImages.length === 1) {
          imageBlockHeight = 172
        } else if (localImages.length === 2) {
          imageBlockHeight = 146
        } else if (localImages.length >= 3) {
          imageBlockHeight = 226
        }

        // 动态精准计算画布高度，无截断且无冗余留白
        const moodBoardHeight = 86
        let dynamicHeight = 94 + 14 + moodBoardHeight + 14
        dynamicHeight += textBlockHeight + 14
        if (localImages.length > 0) {
          dynamicHeight += imageBlockHeight + 14
        }
        dynamicHeight += 14 + almanacBoxHeight + 14
        dynamicHeight += quoteBlockHeight + 14
        dynamicHeight += 16 + 18 + 26 + 22
        const canvasHeight = Math.ceil(dynamicHeight)

        canvas.width = canvasWidth * dpr
        canvas.height = canvasHeight * dpr
        ctx.scale(dpr, dpr)

        // 方案1+2融合：天候光感水彩晕染 + 复古天候特种纸底色 + 专属天气邮票钢印 + 环境微肌理
        const atmosphere = drawWeatherAtmosphere(ctx, record.weather || 'cloudy', canvasWidth, canvasHeight)

        // 顶部与底部纸张锯齿边缘
        drawSawtoothEdge(ctx, 4, canvasWidth, true)
        drawSawtoothEdge(ctx, canvasHeight - 6, canvasWidth, false)

        // 顶部和纸胶带装饰（基于当前天候专属渐变色）
        const tapeW = 84
        const tapeH = 11
        const tapeX = canvasWidth / 2 - tapeW / 2
        const tapeY = 12
        const tapeGrad = ctx.createLinearGradient(tapeX, tapeY, tapeX + tapeW, tapeY + tapeH)
        const tColors = atmosphere.tapeColors || ['#E87A3D', '#F59E0B']
        if (tColors.length === 2) {
          tapeGrad.addColorStop(0, tColors[0])
          tapeGrad.addColorStop(1, tColors[1])
        } else {
          tColors.forEach((c, idx) => {
            tapeGrad.addColorStop(idx / (tColors.length - 1), c)
          })
        }
        ctx.fillStyle = tapeGrad
        ctx.fillRect(tapeX, tapeY, tapeW, tapeH)

        // 顶部表头
        ctx.textAlign = 'center'
        ctx.fillStyle = '#8EACB0'
        ctx.font = '10px monospace'
        ctx.fillText('✦ 岁月晴雨手帖 · POLAROID JOURNAL ✦', canvasWidth / 2, 38)

        ctx.fillStyle = '#153940'
        ctx.font = 'bold 18px sans-serif'
        ctx.fillText('今日心情日签', canvasWidth / 2, 62)

        // 纯净日期与星期
        ctx.fillStyle = '#5B797E'
        ctx.font = '11px sans-serif'
        const dateLine = dayOfWeek ? `${record.dateText} · ${dayOfWeek}` : record.dateText
        ctx.fillText(dateLine, canvasWidth / 2, 82)

        const drawDashedDivider = (yPos) => {
          ctx.beginPath()
          ctx.setLineDash([4, 4])
          ctx.strokeStyle = '#D5DFDE'
          ctx.lineWidth = 1
          ctx.moveTo(20, yPos)
          ctx.lineTo(canvasWidth - 20, yPos)
          ctx.stroke()
          ctx.setLineDash([])
        }

        let curY = 94
        drawDashedDivider(curY)

        // 3. 一体化心晴状态看板（天气主题 + 暖橙能量胶囊 + 生活便签）
        curY += 14
        const boardY = curY
        const boardW = canvasWidth - 40
        const boardX = 20

        // 看板卡片底色与微细边框
        ctx.fillStyle = 'rgba(235, 244, 245, 0.75)'
        ctx.fillRect(boardX, boardY, boardW, moodBoardHeight)
        ctx.strokeStyle = 'rgba(182, 215, 220, 0.65)'
        ctx.strokeRect(boardX, boardY, boardW, moodBoardHeight)

        // 第一行：天气符号 + 天气名称 + 情绪主题
        ctx.textAlign = 'left'
        ctx.fillStyle = '#153940'
        ctx.font = 'bold 13px sans-serif'
        ctx.fillText(`${sanitizedSymbol} ${record.weatherLabel} · ${insight.theme}`, boardX + 12, boardY + 20)

        // 第二行：状态副标徽章
        ctx.fillStyle = '#178394'
        ctx.font = '11px sans-serif'
        ctx.fillText(`[ ${insight.badge} ]`, boardX + 12, boardY + 38)

        // 看板内部分割线
        ctx.beginPath()
        ctx.strokeStyle = 'rgba(205, 222, 224, 0.6)'
        ctx.lineWidth = 1
        ctx.moveTo(boardX + 10, boardY + 47)
        ctx.lineTo(boardX + boardW - 10, boardY + 47)
        ctx.stroke()

        // 第三行：左侧【能量胶囊】与右侧【生活便签】
        const pillY = boardY + 54
        const pillH = 22

        // 左侧暖橙能量胶囊
        const energyPillW = 146
        const energyPillX = boardX + 10
        ctx.fillStyle = 'rgba(243, 156, 107, 0.16)'
        ctx.fillRect(energyPillX, pillY, energyPillW, pillH)
        ctx.strokeStyle = 'rgba(243, 156, 107, 0.38)'
        ctx.strokeRect(energyPillX, pillY, energyPillW, pillH)

        // 能量文字
        ctx.fillStyle = '#D96A27'
        ctx.font = 'bold 11px sans-serif'
        ctx.textAlign = 'left'
        ctx.fillText(`⚡ 能量 ${record.moodScore}/5`, energyPillX + 8, pillY + 15)

        // 5 颗能量圆点指示器（实心橙色 / 柔白空心）
        const dotStartX = energyPillX + 84
        for (let k = 0; k < 5; k += 1) {
          ctx.beginPath()
          const dotCx = dotStartX + k * 11
          const dotCy = pillY + 11
          ctx.arc(dotCx, dotCy, 3, 0, Math.PI * 2)
          if (k < record.moodScore) {
            ctx.fillStyle = '#E87A3D'
            ctx.fill()
          } else {
            ctx.fillStyle = 'rgba(215, 228, 230, 0.65)'
            ctx.fill()
            ctx.strokeStyle = '#B2C6C8'
            ctx.lineWidth = 1
            ctx.stroke()
          }
        }

        // 右侧生活便签（或晴雨状态）
        if (record.tags && record.tags.length) {
          const tagContent = '# ' + record.tags.join(' · ')
          ctx.font = '10px sans-serif'
          const tagTextW = ctx.measureText(tagContent).width
          const tagPillW = Math.min(tagTextW + 16, 106)
          const tagPillX = boardX + boardW - 10 - tagPillW

          ctx.fillStyle = 'rgba(23, 131, 148, 0.1)'
          ctx.fillRect(tagPillX, pillY, tagPillW, pillH)
          ctx.strokeStyle = 'rgba(23, 131, 148, 0.28)'
          ctx.strokeRect(tagPillX, pillY, tagPillW, pillH)

          ctx.fillStyle = '#178394'
          ctx.textAlign = 'center'
          ctx.fillText(tagContent, tagPillX + tagPillW / 2, pillY + 15)
        } else {
          const defaultTagW = 86
          const defaultTagX = boardX + boardW - 10 - defaultTagW
          ctx.fillStyle = 'rgba(23, 131, 148, 0.08)'
          ctx.fillRect(defaultTagX, pillY, defaultTagW, pillH)
          ctx.strokeStyle = 'rgba(23, 131, 148, 0.22)'
          ctx.strokeRect(defaultTagX, pillY, defaultTagW, pillH)

          ctx.fillStyle = '#178394'
          ctx.font = '10px sans-serif'
          ctx.textAlign = 'center'
          ctx.fillText('✦ 晴雨留痕', defaultTagX + defaultTagW / 2, pillY + 15)
        }

        curY += moodBoardHeight + 14
        drawDashedDivider(curY)

        // 4. 心情日记文本
        curY += 14
        ctx.fillStyle = 'rgba(255, 255, 255, 0.75)'
        ctx.fillRect(20, curY, canvasWidth - 40, textBlockHeight)
        ctx.strokeStyle = 'rgba(200, 190, 180, 0.45)'
        ctx.strokeRect(20, curY, canvasWidth - 40, textBlockHeight)

        ctx.fillStyle = '#C2D5D8'
        ctx.font = 'bold 20px serif'
        ctx.textAlign = 'left'
        ctx.fillText('“', 26, curY + 18)

        ctx.fillStyle = '#2C3E42'
        ctx.font = '13px sans-serif'
        ctx.textAlign = 'left'
        textLines.forEach((line, idx) => {
          ctx.fillText(line, 36, curY + 20 + idx * 20)
        })

        curY += textBlockHeight + 14
        drawDashedDivider(curY)

        // 5. 拍立得照片画廊（等比居中裁剪，决不拉伸变形）
        if (localImages.length > 0) {
          curY += 14
          const loadedImgs = []
          for (let i = 0; i < localImages.length; i += 1) {
            try {
              const img = canvas.createImage()
              await new Promise((resolve) => {
                img.onload = () => resolve(img)
                img.onerror = () => resolve(null)
                img.src = localImages[i]
              })
              if (img) loadedImgs.push(img)
            } catch (err) {
              console.warn('加载相片失败', err)
            }
          }

          if (loadedImgs.length === 1) {
            ctx.fillStyle = '#FFFFFF'
            ctx.fillRect(24, curY, 272, 160)
            ctx.strokeStyle = '#E2DDD6'
            ctx.strokeRect(24, curY, 272, 160)
            drawImageCover(ctx, loadedImgs[0], 28, curY + 4, 264, 134, 4)

            ctx.textAlign = 'center'
            ctx.fillStyle = '#A0B4B8'
            ctx.font = '9px monospace'
            ctx.fillText('✦ POLAROID SNAPSHOT · 岁月定格 ✦', canvasWidth / 2, curY + 152)
            curY += 172
          } else if (loadedImgs.length === 2) {
            // 左图
            ctx.fillStyle = '#FFFFFF'
            ctx.fillRect(22, curY, 134, 134)
            ctx.strokeStyle = '#E2DDD6'
            ctx.strokeRect(22, curY, 134, 134)
            drawImageCover(ctx, loadedImgs[0], 26, curY + 4, 126, 110, 4)
            ctx.textAlign = 'center'
            ctx.fillStyle = '#A0B4B8'
            ctx.font = '8px monospace'
            ctx.fillText('FRAME · 01', 89, curY + 126)

            // 右图
            ctx.fillStyle = '#FFFFFF'
            ctx.fillRect(164, curY, 134, 134)
            ctx.strokeStyle = '#E2DDD6'
            ctx.strokeRect(164, curY, 134, 134)
            drawImageCover(ctx, loadedImgs[1], 168, curY + 4, 126, 110, 4)
            ctx.textAlign = 'center'
            ctx.fillStyle = '#A0B4B8'
            ctx.font = '8px monospace'
            ctx.fillText('FRAME · 02', 231, curY + 126)

            curY += 146
          } else if (loadedImgs.length >= 3) {
            // 上方焦点
            ctx.fillStyle = '#FFFFFF'
            ctx.fillRect(22, curY, 276, 112)
            ctx.strokeStyle = '#E2DDD6'
            ctx.strokeRect(22, curY, 276, 112)
            drawImageCover(ctx, loadedImgs[0], 26, curY + 4, 268, 92, 4)
            ctx.textAlign = 'center'
            ctx.fillStyle = '#A0B4B8'
            ctx.font = '8px monospace'
            ctx.fillText('FEATURED MOMENT · 焦点', canvasWidth / 2, curY + 106)

            // 下方左图
            ctx.fillStyle = '#FFFFFF'
            ctx.fillRect(22, curY + 118, 134, 98)
            ctx.strokeStyle = '#E2DDD6'
            ctx.strokeRect(22, curY + 118, 134, 98)
            drawImageCover(ctx, loadedImgs[1], 26, curY + 122, 126, 80, 4)
            ctx.textAlign = 'center'
            ctx.fillStyle = '#A0B4B8'
            ctx.font = '8px monospace'
            ctx.fillText('FRAME · 02', 89, curY + 210)

            // 下方右图
            ctx.fillStyle = '#FFFFFF'
            ctx.fillRect(164, curY + 118, 134, 98)
            ctx.strokeStyle = '#E2DDD6'
            ctx.strokeRect(164, curY + 118, 134, 98)
            drawImageCover(ctx, loadedImgs[2], 168, curY + 122, 126, 80, 4)
            ctx.textAlign = 'center'
            ctx.fillStyle = '#A0B4B8'
            ctx.font = '8px monospace'
            ctx.fillText('FRAME · 03', 231, curY + 210)

            curY += 226
          }
          drawDashedDivider(curY)
        }

        // 6. 心晴宜忌便签（日系手帐双色独立胶囊徽章 + 悬挂缩进 + 中缝线）
        curY += 14
        const alCardX = 20
        const alCardW = canvasWidth - 40
        ctx.fillStyle = 'rgba(255, 255, 255, 0.88)'
        ctx.fillRect(alCardX, curY, alCardW, almanacBoxHeight)
        ctx.strokeStyle = 'rgba(215, 206, 194, 0.65)'
        ctx.strokeRect(alCardX, curY, alCardW, almanacBoxHeight)

        // 第一行：「 宜 」胶囊徽章 + 悬挂缩进文本
        const row1TopY = curY + 12
        drawPillBadge(ctx, 28, row1TopY, 24, 16, 4, '宜', 'rgba(38, 122, 96, 0.14)', 'rgba(38, 122, 96, 0.35)', '#1E6D54')

        ctx.textAlign = 'left'
        ctx.font = '11px sans-serif'
        ctx.fillStyle = '#267A60'
        suitLines.forEach((line, idx) => {
          ctx.fillText(line, 58, row1TopY + 12 + idx * 17)
        })

        // 中缝细腻分隔线
        const divLineY = row1TopY + almanacRow1H + 6
        ctx.save()
        ctx.strokeStyle = 'rgba(220, 212, 202, 0.55)'
        ctx.lineWidth = 0.8
        ctx.beginPath()
        ctx.moveTo(28, divLineY)
        ctx.lineTo(canvasWidth - 28, divLineY)
        ctx.stroke()
        ctx.restore()

        // 第二行：「 忌 」胶囊徽章 + 悬挂缩进文本
        const row2TopY = divLineY + 7
        drawPillBadge(ctx, 28, row2TopY, 24, 16, 4, '忌', 'rgba(200, 70, 50, 0.12)', 'rgba(200, 70, 50, 0.35)', '#A83E2D')

        ctx.textAlign = 'left'
        ctx.font = '11px sans-serif'
        ctx.fillStyle = '#8B4538'
        avoidLines.forEach((line, idx) => {
          ctx.fillText(line, 58, row2TopY + 12 + idx * 17)
        })

        curY += almanacBoxHeight + 14

        // 岁月寄语（多行自适应居中排版，杜绝超长单行溢出两翼）
        ctx.textAlign = 'center'
        ctx.fillStyle = '#708C91'
        ctx.font = '11px sans-serif'
        quoteLines.forEach((line, idx) => {
          ctx.fillText(line, canvasWidth / 2, curY + 14 + idx * 18)
        })

        curY += quoteBlockHeight + 14
        drawDashedDivider(curY)

        // 7. 真实用户微信名提取与档案签章
        curY += 16
        const cached = wx.getStorageSync('user_profile_cache_v2') || {}
        const app = getApp()
        const cloudUser = (app && app.globalData && app.globalData.user) || {}
        const userName = (cached.nickname && cached.nickname.trim()) || (cloudUser.nickname && cloudUser.nickname.trim()) || '心情旅人'

        ctx.textAlign = 'left'
        ctx.fillStyle = '#5B797E'
        ctx.font = '11px sans-serif'
        ctx.fillText(`记录者：${userName}`, 24, curY)

        ctx.textAlign = 'right'
        ctx.font = 'bold 10px sans-serif'
        ctx.fillStyle = '#178394'
        ctx.fillText('[ 岁月留印 · 认证 ]', canvasWidth - 24, curY)
        curY += 18

        // 拟物复古条形码
        ctx.fillStyle = '#3E565B'
        let bx = 32
        const barWidths = [2, 1, 3, 1, 2, 4, 1, 2, 1, 3, 2, 1, 4, 1, 2, 3, 1, 2, 4, 1, 3, 2, 1, 2, 3, 1, 2, 3]
        for (let i = 0; i < barWidths.length; i += 1) {
          ctx.fillRect(bx, curY, barWidths[i], 18)
          bx += barWidths[i] + (i % 2 === 0 ? 2 : 3)
        }
        curY += 28

        ctx.textAlign = 'center'
        ctx.fillStyle = '#8CABB0'
        ctx.font = '9px monospace'
        ctx.fillText(`ARCHIVE // MOOD-${record.date.replace(/-/g, '')}-PASS`, canvasWidth / 2, curY)

        // 8. 导出高清临时图片
        wx.canvasToTempFilePath({
          canvas,
          destWidth: canvas.width,
          destHeight: canvas.height,
          success: (tempRes) => {
            wx.hideLoading()
            this.setData({
              receiptImagePath: tempRes.tempFilePath,
              showReceiptModal: true
            })
          },
          fail: (expErr) => {
            wx.hideLoading()
            wx.showToast({ title: '日签生成失败', icon: 'none' })
          }
        })
      })
  },

  saveReceiptToPhotos() {
    if (!this.data.receiptImagePath) return
    this.setData({ savingReceipt: true })
    wx.saveImageToPhotosAlbum({
      filePath: this.data.receiptImagePath,
      success: () => {
        this.setData({ savingReceipt: false })
        wx.showToast({ title: '已保存到手机相册', icon: 'success' })
      },
      fail: (err) => {
        this.setData({ savingReceipt: false })
        if (err && err.errMsg && err.errMsg.includes('auth deny')) {
          wx.showModal({
            title: '需要相册保存权限',
            content: '请在设置中允许小程序保存图片到系统相册',
            confirmText: '去设置',
            success: (modalRes) => {
              if (modalRes.confirm) wx.openSetting()
            }
          })
        } else {
          wx.showToast({ title: '保存未成功', icon: 'none' })
        }
      }
    })
  },

  editSelected() {
    const { selectedRecord } = this.data
    if (!selectedRecord) return
    wx.navigateTo({ url: `/pages/record/record?date=${selectedRecord.date}` })
  },

  previewSelectedImage(event) {
    wx.previewImage({ current: event.currentTarget.dataset.current, urls: this.data.selectedRecord.images })
  },

  onTapEmptyTip() {
    const today = getToday()
    const targetDate = (this.data.selectedDate && isDateInRange(this.data.selectedDate, today))
      ? this.data.selectedDate
      : today
    wx.navigateTo({ url: `/pages/record/record?date=${targetDate}` })
  }
})
