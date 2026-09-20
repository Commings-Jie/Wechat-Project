const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const CORE_NUMS = {
  'MWMTTTYAOA': 0, // 主测试账号 (你)
  'MWMU1B0WWO': 1, // 好友 1 (千夏)
  'MWMU29SH7W': 2  // 好友 2
}

// 自动安全清理开发调试期间遗留的无用测试账号，保障后续新邀请好友从 3、4、5 依次递增
async function cleanGhostTestAccounts() {
  try {
    const keepMoodIds = Object.keys(CORE_NUMS)
    const allUsersRes = await db.collection('users').limit(100).get().catch(() => ({ data: [] }))
    const allUsers = allUsersRes.data || []
    if (allUsers.length <= keepMoodIds.length) return

    const [allRecords, allFriendships, allRequests] = await Promise.all([
      db.collection('records').limit(200).get().catch(() => ({ data: [] })),
      db.collection('friendships').limit(200).get().catch(() => ({ data: [] })),
      db.collection('friendRequests').limit(200).get().catch(() => ({ data: [] }))
    ])

    const activeOpenIds = new Set()
    ;(allRecords.data || []).forEach((r) => activeOpenIds.add(r.openid || r._openid))
    ;(allFriendships.data || []).forEach((f) => (f.members || []).forEach((m) => activeOpenIds.add(m)))
    ;(allRequests.data || []).forEach((r) => {
      activeOpenIds.add(r.fromOpenId)
      activeOpenIds.add(r.toOpenId)
    })

    for (const u of allUsers) {
      if (!keepMoodIds.includes(u.moodId) && !activeOpenIds.has(u.openid)) {
        await db.collection('users').doc(u._id).remove().catch(() => {})
      }
    }
  } catch (e) {
    console.warn('cleanGhostTestAccounts warn:', e)
  }
}

exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext()
  const profile = event.userProfile || {}
  const rawNickname = typeof event.nickname === 'string'
    ? event.nickname
    : typeof profile.nickName === 'string'
      ? profile.nickName
      : ''
  const newNickname = rawNickname.trim() ? rawNickname.trim().slice(0, 30) : ''
  const rawAvatarUrl = typeof event.avatarUrl === 'string'
    ? event.avatarUrl
    : typeof profile.avatarUrl === 'string'
      ? profile.avatarUrl
      : ''
  const newAvatarUrl = (rawAvatarUrl.includes('thirdwx.qlogo.cn') || rawAvatarUrl.startsWith('http://tmp') || rawAvatarUrl.startsWith('wxfile://'))
    ? ''
    : rawAvatarUrl.trim()

  const users = db.collection('users')
  const result = await users.where({ openid: OPENID }).limit(1).get()

  if (result.data.length) {
    const current = result.data[0]
    const updateData = { updatedAt: db.serverDate() }
    let hasUpdate = false

    let number = typeof CORE_NUMS[current.moodId] === 'number'
      ? CORE_NUMS[current.moodId]
      : (typeof current.userNumber === 'number' && current.userNumber < 20 ? current.userNumber : 2)

    if (typeof number !== 'number') {
      const allUsersRes = await users.orderBy('createdAt', 'asc').limit(100).get().catch(() => ({ data: [] }))
      const allList = allUsersRes.data || []
      const userIndex = allList.findIndex((u) => u._id === current._id || u.openid === OPENID)
      number = userIndex >= 0 && userIndex < 20 ? userIndex : 2
    }

    if (current.userNumber !== number) {
      updateData.userNumber = number
      hasUpdate = true
    }

    if (!current.nickname || current.nickname === '心情用户' || current.nickname === '微信用户' || /^心情用户\d+$/.test(current.nickname)) {
      const targetName = `心情用户${number}`
      if (current.nickname !== targetName && !newNickname) {
        updateData.nickname = targetName
        hasUpdate = true
      }
    }

    if (newNickname && newNickname !== current.nickname && newNickname !== '微信用户') {
      updateData.nickname = newNickname
      hasUpdate = true
    }
    if (newAvatarUrl && newAvatarUrl !== current.avatarUrl) {
      updateData.avatarUrl = newAvatarUrl
      hasUpdate = true
    } else if (current.avatarUrl && (current.avatarUrl.includes('thirdwx.qlogo.cn') || current.avatarUrl.startsWith('http://tmp') || current.avatarUrl.startsWith('wxfile://'))) {
      updateData.avatarUrl = ''
      hasUpdate = true
    }

    if (hasUpdate) {
      await users.doc(current._id).update({ data: updateData })
      return { ok: true, user: { ...current, ...updateData } }
    }
    return { ok: true, user: current }
  }

  // 新用户注册流程：先执行清理保证无脏数据干扰
  await cleanGhostTestAccounts()

  const now = db.serverDate()
  const moodId = `MW${Date.now().toString(36).toUpperCase()}`

  // 严格按现存真实活跃用户的最大编号递增（0 -> 1 -> 2 -> 3 -> 4...）
  const activeUsersRes = await users.limit(100).get().catch(() => ({ data: [] }))
  const activeList = activeUsersRes.data || []
  let maxSeq = 2
  activeList.forEach((u) => {
    const num = typeof CORE_NUMS[u.moodId] === 'number' ? CORE_NUMS[u.moodId] : u.userNumber
    if (typeof num === 'number' && num > maxSeq && num < 1000) {
      maxSeq = num
    }
  })

  const nextNumber = maxSeq + 1
  const userNumber = typeof CORE_NUMS[moodId] === 'number' ? CORE_NUMS[moodId] : nextNumber
  const nickname = (newNickname && newNickname !== '微信用户') ? newNickname : `心情用户${userNumber}`
  const avatarUrl = newAvatarUrl || ''
  const created = await users.add({
    data: {
      openid: OPENID,
      moodId,
      nickname,
      avatarUrl,
      userNumber,
      createdAt: now,
      updatedAt: now
    }
  })
  return {
    ok: true,
    user: { _id: created._id, _openid: OPENID, openid: OPENID, moodId, nickname, avatarUrl, userNumber }
  }
}
