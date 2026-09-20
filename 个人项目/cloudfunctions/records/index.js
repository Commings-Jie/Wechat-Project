const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const DEMO_TEXTS = [
  '今天正式开始暑假，感觉非常轻松',
  '和朋友一起去看了电影',
  '在家看了一下午的书',
  '下雨没能出去玩，有一点无聊',
  '第一次自己做冰饮，味道很不错',
  '游戏一直输，心情有点烦躁',
  '和家人出去旅行，看到了大海',
  '晚上散步时看到了漂亮的晚霞'
]

function isDemoRecord(record) {
  if (!record) return false
  const text = String(record.moodText || '').trim()
  return DEMO_TEXTS.includes(text)
}

function cleanRecord(record) {
  const date = typeof record.date === 'string' ? record.date : ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('记录日期格式无效')
  return {
    date,
    weather: record.weather || 'overcast',
    moodScore: Number(record.moodScore) || 0,
    moodText: typeof record.moodText === 'string' ? record.moodText.slice(0, 500) : '',
    tags: Array.isArray(record.tags) ? record.tags : [],
    images: Array.isArray(record.images) ? record.images : []
  }
}

async function listRecords() {
  const OPENID = cloud.getWXContext().OPENID
  try {
    const result = await db.collection('records').where({ openid: OPENID }).limit(1000).get()
    const records = result.data || []
    // 自动清理遗留在云端历史中的演示假记录
    const demoDocs = records.filter(isDemoRecord)
    if (demoDocs.length) {
      await Promise.allSettled(demoDocs.map((doc) => db.collection('records').doc(doc._id).remove()))
    }
    return records.filter((r) => !isDemoRecord(r)).sort((a, b) => b.date.localeCompare(a.date))
  } catch (err) {
    if (err && (err.errCode === -502005 || String(err.message).includes('collection not exists'))) {
      await db.createCollection('records').catch(() => {})
      return []
    }
    throw err
  }
}

async function upsert(record) {
  if (isDemoRecord(record)) return null
  const OPENID = cloud.getWXContext().OPENID
  const data = cleanRecord(record)
  try {
    const found = await db.collection('records').where({ openid: OPENID, date: data.date }).limit(1).get()
    if (found.data.length) {
      await db.collection('records').doc(found.data[0]._id).update({ data: { ...data, updatedAt: db.serverDate() } })
      return { ...found.data[0], ...data }
    }
    const created = await db.collection('records').add({ data: { ...data, openid: OPENID, createdAt: db.serverDate(), updatedAt: db.serverDate() } })
    return { _id: created._id, ...data }
  } catch (err) {
    if (err && (err.errCode === -502005 || String(err.message).includes('collection not exists'))) {
      await db.createCollection('records').catch(() => {})
      const created = await db.collection('records').add({ data: { ...data, openid: OPENID, createdAt: db.serverDate(), updatedAt: db.serverDate() } })
      return { _id: created._id, ...data }
    }
    throw err
  }
}

async function remove(date) {
  const OPENID = cloud.getWXContext().OPENID
  try {
    const found = await db.collection('records').where({ openid: OPENID, date }).limit(1).get()
    if (found.data.length) await db.collection('records').doc(found.data[0]._id).remove()
  } catch (err) {
    // ignore
  }
  return { date }
}

exports.main = async (event) => {
  if (event.action === 'list') return { ok: true, records: await listRecords() }
  if (event.action === 'upsert') return { ok: true, record: await upsert(event.record || {}) }
  if (event.action === 'remove') return { ok: true, removed: await remove(event.date) }
  if (event.action === 'sync') {
    const cleanEventRecords = (Array.isArray(event.records) ? event.records : []).filter((r) => !isDemoRecord(r))
    for (const record of cleanEventRecords) {
      if (record && record.date) await upsert(record)
    }
    return { ok: true, records: await listRecords() }
  }
  return { ok: false, message: '未知的记录操作' }
}
