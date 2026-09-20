const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

let initedCollections = false
async function initCollections() {
  if (initedCollections) return
  const collections = ['users', 'records', 'friendRequests', 'friendships', 'likes', 'comments']
  await Promise.allSettled(collections.map((col) => db.createCollection(col).catch(() => {})))
  initedCollections = true
}

async function safeQuery(fn, fallback = { data: [] }) {
  try {
    return await fn()
  } catch (err) {
    const msg = String((err && (err.message || err.errMsg)) || '')
    if (err && (err.errCode === -502005 || msg.includes('collection not exists') || msg.includes('Db or Table not exist'))) {
      return fallback
    }
    throw err
  }
}

async function safeAdd(colName, data) {
  try {
    return await db.collection(colName).add({ data })
  } catch (err) {
    const msg = String((err && (err.message || err.errMsg)) || '')
    if (err && (err.errCode === -502005 || msg.includes('collection not exists') || msg.includes('Db or Table not exist'))) {
      await db.createCollection(colName).catch(() => {})
      return await db.collection(colName).add({ data })
    }
    throw err
  }
}

function context() {
  const openid = cloud.getWXContext().OPENID
  if (!openid) throw new Error('无法识别当前用户')
  return openid
}

function pairKey(a, b) {
  return [a, b].sort().join(':')
}

const CORE_USER_NUMBERS = {
  'MWMTTTYAOA': 0,
  'MWMU1B0WWO': 1,
  'MWMU29SH7W': 2
}

function resolveUserNumber(user, fallbackIndex = null) {
  if (!user) return fallbackIndex
  if (user.moodId && typeof CORE_USER_NUMBERS[user.moodId] === 'number') {
    return CORE_USER_NUMBERS[user.moodId]
  }
  if (typeof user.userNumber === 'number' && user.userNumber < 1000) {
    return user.userNumber
  }
  if (typeof fallbackIndex === 'number') {
    return fallbackIndex
  }
  return ''
}

function publicUser(user, fallbackIndex = null) {
  if (!user) return null
  const num = resolveUserNumber(user, fallbackIndex)
  let nickname = (user.nickname || '').trim()
  const isDefaultName = !nickname || nickname === '心情用户' || nickname === '微信用户' || /^心情用户\d+$/.test(nickname)
  if (isDefaultName) {
    nickname = (typeof num === 'number' && num !== '') ? `心情用户${num}` : (nickname || '心情用户')
  }
  let avatarUrl = (user.avatarUrl || '').trim()
  if (avatarUrl.includes('thirdwx.qlogo.cn') || avatarUrl.startsWith('http://tmp') || avatarUrl.startsWith('wxfile://')) {
    avatarUrl = ''
  }
  return {
    openid: user.openid || user._openid || '',
    moodId: user.moodId || '',
    nickname,
    avatarUrl,
    userNumber: typeof num === 'number' ? num : user.userNumber
  }
}

async function getUsersMap(openids = []) {
  const uniqueIds = Array.from(new Set(openids.filter(Boolean)))
  const usersMap = {}

  // 1. 获取全量用户（已包含了千夏、主账号、第二好友等所有用户），同时兼容 openid 与 _openid
  const [allUsersRes, targetUsersRes] = await Promise.all([
    safeQuery(() => db.collection('users').limit(100).get()),
    uniqueIds.length ? safeQuery(() => db.collection('users').where(_.or([{ openid: _.in(uniqueIds) }, { _openid: _.in(uniqueIds) }])).limit(100).get()) : { data: [] }
  ])

  // 合并全量与目标用户，确保无任何遗漏
  const mergedMap = new Map()
  ;(allUsersRes.data || []).forEach((u) => mergedMap.set(u._id || u.openid || u._openid, u))
  ;(targetUsersRes.data || []).forEach((u) => mergedMap.set(u._id || u.openid || u._openid, u))
  const allList = Array.from(mergedMap.values())
  allList.sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0
    return ta - tb
  })

  let nextSequential = 3
  const orderMap = {}
  allList.forEach((u) => {
    const key = u.openid || u._openid
    if (u.moodId === 'MWMTTTYAOA') {
      if (key) orderMap[key] = 0
    } else if (u.moodId === 'MWMU1B0WWO') {
      if (key) orderMap[key] = 1
    } else if (u.moodId === 'MWMU29SH7W') {
      if (key) orderMap[key] = 2
    } else {
      if (key) orderMap[key] = (typeof u.userNumber === 'number' && u.userNumber < 1000) ? u.userNumber : nextSequential++
    }
  })

  // 2. 批量将用户头像 cloud:// 换为安全 CDN 临时直链
  const avatarCloudIds = allList
    .map((u) => u.avatarUrl)
    .filter((url) => typeof url === 'string' && url.startsWith('cloud://'))

  const avatarTempMap = {}
  if (avatarCloudIds.length) {
    try {
      const aRes = await cloud.getTempFileURL({ fileList: Array.from(new Set(avatarCloudIds)) })
      ;(aRes.fileList || []).forEach((f) => {
        if (f.fileID && f.tempFileURL) avatarTempMap[f.fileID] = f.tempFileURL
      })
    } catch (aErr) {
      console.warn('获取头像临时链接失败:', aErr)
    }
  }

  // 3. 构建多维精准映射表：支持 openid / _openid / moodId / _id 任意方式瞬间查到该用户！
  allList.forEach((u) => {
    const key = u.openid || u._openid
    const idx = (u.moodId && typeof CORE_USER_NUMBERS[u.moodId] === 'number')
      ? CORE_USER_NUMBERS[u.moodId]
      : ((typeof u.userNumber === 'number' && u.userNumber < 1000) ? u.userNumber : (key ? orderMap[key] : null))
    const pUser = publicUser(u, idx)
    if (pUser && pUser.avatarUrl && avatarTempMap[pUser.avatarUrl]) {
      pUser.avatarUrl = avatarTempMap[pUser.avatarUrl]
    }
    if (u.openid) usersMap[u.openid] = pUser
    if (u._openid) usersMap[u._openid] = pUser
    if (u.moodId) usersMap[u.moodId] = pUser
    if (u._id) usersMap[u._id] = pUser
  })

  return usersMap
}

async function getUserByMoodId(moodId) {
  const result = await safeQuery(() => db.collection('users').where({ moodId: String(moodId || '').trim() }).limit(1).get())
  return (result.data && result.data[0]) || null
}

async function friendOpenIds(openid) {
  const result = await safeQuery(() => db.collection('friendships').where({ members: openid }).limit(100).get())
  const ids = (result.data || []).map((item) => (item.members || []).find((id) => id !== openid)).filter(Boolean)
  return Array.from(new Set(ids))
}

async function searchUser(event) {
  const me = context()
  const user = await getUserByMoodId(event.moodId)
  if (!user || user.openid === me) return { user: null }
  const usersMap = await getUsersMap([user.openid])
  return { user: usersMap[user.openid] || publicUser(user) }
}

async function sendRequest(event) {
  const fromOpenId = context()
  let target = null
  if (event.moodId) {
    target = await getUserByMoodId(event.moodId)
  }
  if (!target && event.openid) {
    const res = await safeQuery(() => db.collection('users').where(_.or([{ openid: event.openid }, { _openid: event.openid }])).limit(1).get())
    target = (res.data && res.data[0]) || null
  }
  if (!target && event.openid) {
    target = { openid: event.openid, nickname: event.nickname || '心情用户', moodId: event.moodId || '' }
  }
  if (!target) throw new Error('找不到可添加的用户')

  const targetOpenId = target.openid || target._openid || event.openid
  if (!targetOpenId || targetOpenId === fromOpenId) throw new Error('不能向自己发送好友申请')
  const key = pairKey(fromOpenId, targetOpenId)

  // 1. 检查是否已经是好友
  const existingFriend = await safeQuery(() => db.collection('friendships').where({ pairKey: key }).limit(1).get())
  if (existingFriend.data && existingFriend.data.length) {
    const usersMap = await getUsersMap([targetOpenId])
    return { user: usersMap[targetOpenId] || publicUser(target), message: '你们已经是好友了', isFriend: true }
  }

  // 2. 检查是否有待处理的申请
  const existingRequest = await safeQuery(() => db.collection('friendRequests').where({ pairKey: key, status: 'pending' }).limit(1).get())
  if (existingRequest.data && existingRequest.data.length) {
    const req = existingRequest.data[0]
    // 双方互加：对方之前申请过我，我现在也点击加好友，直接双向成为好友！
    if (req.fromOpenId === targetOpenId) {
      await db.collection('friendRequests').doc(req._id).update({
        data: { status: 'accepted', updatedAt: db.serverDate() }
      })
      await safeAdd('friendships', {
        pairKey: key,
        members: [fromOpenId, targetOpenId],
        createdAt: db.serverDate()
      })
      const usersMap = await getUsersMap([targetOpenId])
      return { user: usersMap[targetOpenId] || publicUser(target), autoAccepted: true, message: '互加成功，已成为好友！' }
    }
    // 我已经申请过对方，刷新更新时间，返回友好提示而不抛出错误
    await db.collection('friendRequests').doc(req._id).update({
      data: { updatedAt: db.serverDate() }
    }).catch(() => {})
    const usersMap = await getUsersMap([targetOpenId])
    return { user: usersMap[targetOpenId] || publicUser(target), pending: true, message: '好友申请已发送，等待对方同意' }
  }

  // 3. 正常发送申请
  await safeAdd('friendRequests', {
    pairKey: key,
    fromOpenId,
    toOpenId: targetOpenId,
    status: 'pending',
    createdAt: db.serverDate(),
    updatedAt: db.serverDate()
  })
  const usersMap = await getUsersMap([targetOpenId])
  return { user: usersMap[targetOpenId] || publicUser(target), message: '好友申请已发送' }
}

async function listRequests() {
  const openid = context()
  const [sent, received] = await Promise.all([
    safeQuery(() => db.collection('friendRequests').where({ fromOpenId: openid }).limit(100).get()),
    safeQuery(() => db.collection('friendRequests').where({ toOpenId: openid }).limit(100).get())
  ])
  const resultData = (sent.data || []).concat(received.data || [])
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, 100)

  const ids = []
  resultData.forEach((item) => ids.push(item.fromOpenId, item.toOpenId))
  const usersMap = await getUsersMap(ids)

  return {
    requests: resultData.map((item) => {
      const otherId = item.fromOpenId === openid ? item.toOpenId : item.fromOpenId
      return {
        id: item._id,
        status: item.status,
        direction: item.fromOpenId === openid ? 'sent' : 'received',
        user: usersMap[otherId] || { nickname: '心情用户', moodId: '', avatarUrl: '' }
      }
    })
  }
}

async function respondRequest(event) {
  const openid = context()
  if (!event || !event.requestId) throw new Error('申请ID不能为空')

  const requestResult = await safeQuery(() => db.collection('friendRequests').doc(event.requestId).get(), null)
  const request = requestResult ? requestResult.data : null
  if (!request) throw new Error('好友申请不存在')

  // 必须是接收者才能操作
  if (request.toOpenId !== openid) throw new Error('无权处理该申请')

  const targetStatus = event.accept ? 'accepted' : 'rejected'

  // 幂等防护：如果已经同意过，确保 friendship 建立并直接返回成功
  if (request.status === 'accepted') {
    const key = pairKey(request.fromOpenId, request.toOpenId)
    const existingFriend = await safeQuery(() => db.collection('friendships').where({ pairKey: key }).limit(1).get())
    if (!existingFriend.data || !existingFriend.data.length) {
      await safeAdd('friendships', {
        pairKey: key,
        members: [request.fromOpenId, request.toOpenId],
        createdAt: db.serverDate()
      })
    }
    return { status: 'accepted', message: '已是好友' }
  }

  if (request.status === 'rejected') {
    return { status: 'rejected', message: '已拒绝申请' }
  }

  await db.collection('friendRequests').doc(request._id).update({
    data: { status: targetStatus, updatedAt: db.serverDate() }
  })

  if (targetStatus === 'accepted') {
    const key = pairKey(request.fromOpenId, request.toOpenId)
    const existingFriend = await safeQuery(() => db.collection('friendships').where({ pairKey: key }).limit(1).get())
    if (!existingFriend.data || !existingFriend.data.length) {
      await safeAdd('friendships', {
        pairKey: key,
        members: [request.fromOpenId, request.toOpenId],
        createdAt: db.serverDate()
      })
    }
  }

  return { status: targetStatus, message: targetStatus === 'accepted' ? '已成为好友！' : '已拒绝' }
}

async function listFriends() {
  const openid = context()
  const ids = await friendOpenIds(openid)
  if (!ids.length) return { friends: [] }
  const usersMap = await getUsersMap(ids)
  return { friends: ids.map((id) => usersMap[id]).filter(Boolean) }
}

async function deleteFriend(event = {}) {
  const me = context()
  let targetOpenId = event.targetOpenId || event.openid
  const targetMoodId = event.targetMoodId || event.moodId

  if (!targetOpenId && targetMoodId) {
    const targetUser = await getUserByMoodId(targetMoodId)
    if (targetUser) {
      targetOpenId = targetUser.openid || targetUser._openid
    }
  }

  if (!targetOpenId) {
    throw new Error('未指定要解除的好友')
  }

  if (targetOpenId === me) {
    throw new Error('不能解除自己的好友关系')
  }

  const key = pairKey(me, targetOpenId)

  // 1. 删除 friendships 集合中的好友关系记录
  const friendShipRes = await safeQuery(() => db.collection('friendships').where({ pairKey: key }).limit(10).get())
  if (friendShipRes.data && friendShipRes.data.length) {
    for (const item of friendShipRes.data) {
      await db.collection('friendships').doc(item._id).remove().catch(() => {})
    }
  }

  // 2. 清理/重置两人的好友申请记录，便于日后重新加回
  const reqRes = await safeQuery(() => db.collection('friendRequests').where({ pairKey: key }).limit(20).get())
  if (reqRes.data && reqRes.data.length) {
    for (const req of reqRes.data) {
      await db.collection('friendRequests').doc(req._id).remove().catch(() => {})
    }
  }

  // 3. 若用户选择 cleanInteractions === true，双向彻底清除评论与点赞
  let cleanedCommentsCount = 0
  let cleanedLikesCount = 0

  if (event.cleanInteractions === true || event.cleanInteractions === 'true') {
    // 3.1 查出我的全部手帖
    const myRecordsRes = await safeQuery(() => db.collection('records').where(_.or([{ openid: me }, { _openid: me }])).limit(500).get())
    const myRecordIds = (myRecordsRes.data || []).map((r) => r._id).filter(Boolean)

    // 3.2 查出对方的全部手帖
    const targetRecordsRes = await safeQuery(() => db.collection('records').where(_.or([{ openid: targetOpenId }, { _openid: targetOpenId }])).limit(500).get())
    const targetRecordIds = (targetRecordsRes.data || []).map((r) => r._id).filter(Boolean)

    // 清除：对方在我的手帖下的评论
    if (myRecordIds.length) {
      const targetCommentsOnMyRecords = await safeQuery(() => db.collection('comments').where(_.and([
        { recordId: _.in(myRecordIds) },
        _.or([
          { openid: targetOpenId },
          { _openid: targetOpenId },
          { 'author.openid': targetOpenId },
          { 'author._openid': targetOpenId },
          ...(targetMoodId ? [{ moodId: targetMoodId }, { 'author.moodId': targetMoodId }] : [])
        ])
      ])).limit(1000).get())

      for (const c of (targetCommentsOnMyRecords.data || [])) {
        await db.collection('comments').doc(c._id).remove().catch(() => {})
        cleanedCommentsCount++
      }

      // 清除：对方在我的手帖下的赞
      const targetLikesOnMyRecords = await safeQuery(() => db.collection('likes').where(_.and([
        { recordId: _.in(myRecordIds) },
        _.or([
          { openid: targetOpenId },
          { _openid: targetOpenId }
        ])
      ])).limit(1000).get())

      for (const l of (targetLikesOnMyRecords.data || [])) {
        await db.collection('likes').doc(l._id).remove().catch(() => {})
        cleanedLikesCount++
      }
    }

    // 清除：我在对方手帖下的评论
    if (targetRecordIds.length) {
      const myCommentsOnTargetRecords = await safeQuery(() => db.collection('comments').where(_.and([
        { recordId: _.in(targetRecordIds) },
        _.or([
          { openid: me },
          { _openid: me },
          { 'author.openid': me },
          { 'author._openid': me }
        ])
      ])).limit(1000).get())

      for (const c of (myCommentsOnTargetRecords.data || [])) {
        await db.collection('comments').doc(c._id).remove().catch(() => {})
        cleanedCommentsCount++
      }

      // 清除：我在对方手帖下的赞
      const myLikesOnTargetRecords = await safeQuery(() => db.collection('likes').where(_.and([
        { recordId: _.in(targetRecordIds) },
        _.or([
          { openid: me },
          { _openid: me }
        ])
      ])).limit(1000).get())

      for (const l of (myLikesOnTargetRecords.data || [])) {
        await db.collection('likes').doc(l._id).remove().catch(() => {})
        cleanedLikesCount++
      }
    }
  }

  return {
    deleted: true,
    cleanedInteractions: Boolean(event.cleanInteractions),
    cleanedCommentsCount,
    cleanedLikesCount,
    message: event.cleanInteractions ? '已解除友邻并清空双方互动记录' : '已解除友邻关系'
  }
}

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

async function feed(event = {}) {
  const openid = context()
  if (event && (event.myNickname || event.myAvatarUrl)) {
    const updateProfile = { updatedAt: db.serverDate() }
    if (event.myNickname && event.myNickname !== '微信用户' && event.myNickname !== '心情用户') {
      updateProfile.nickname = event.myNickname
    }
    if (event.myAvatarUrl) {
      updateProfile.avatarUrl = event.myAvatarUrl
    }
    if (Object.keys(updateProfile).length > 1) {
      db.collection('users').where({ openid }).update({ data: updateProfile }).catch(() => {})
    }
  }

  const ids = await friendOpenIds(openid)
  const allFeedOpenIds = Array.from(new Set([openid, ...ids]))
  if (!allFeedOpenIds.length) return { records: [] }

  const recordsResult = await safeQuery(() => db.collection('records').where({ openid: _.in(allFeedOpenIds) }).orderBy('date', 'desc').limit(100).get())
  const recordsData = (recordsResult.data || []).filter((r) => !isDemoRecord(r))
  if (!recordsData.length) return { records: [] }

  const recordIds = recordsData.map((r) => r._id)
  const [likesResult, commentsResult] = await Promise.all([
    safeQuery(() => db.collection('likes').where({ recordId: _.in(recordIds) }).limit(1000).get()),
    safeQuery(() => db.collection('comments').where({ recordId: _.in(recordIds) }).limit(1000).get())
  ])

  // 1. 点赞去重、记录点赞者列表、清理无 openid 的脏记录
  const seenLikers = new Map() // recordId -> Set(likerKey)
  const recordLikersList = new Map() // recordId -> Array(likerKey)
  const duplicateLikeDocIds = []
  const myLikedSet = new Set()

  ;(likesResult.data || []).forEach((like) => {
    const rId = like.recordId
    const likerKey = like.openid || like._openid
    // 关键修复：若历史记录无 openid，直接清理，绝不退回当成当前访问者！
    if (!likerKey) {
      duplicateLikeDocIds.push(like._id)
      return
    }

    if (!seenLikers.has(rId)) {
      seenLikers.set(rId, new Set())
      recordLikersList.set(rId, [])
    }
    const likerSet = seenLikers.get(rId)

    if (likerSet.has(likerKey)) {
      duplicateLikeDocIds.push(like._id)
    } else {
      likerSet.add(likerKey)
      recordLikersList.get(rId).push(likerKey)
    }

    if (likerKey === openid) {
      myLikedSet.add(rId)
    }
  })

  // 异步删除历史脏点赞与多余重复 likes 文档
  if (duplicateLikeDocIds.length) {
    Promise.allSettled(duplicateLikeDocIds.map((id) => db.collection('likes').doc(id).remove().catch(() => {}))).catch(() => {})
  }

  // 2. 批量将 cloud:// 图片与头像转换为 CDN 临时直链，彻底解决跨用户空白与头像不显示问题
  const cloudFileIds = []
  recordsData.forEach((r) => {
    (r.images || []).forEach((img) => {
      if (typeof img === 'string' && img.startsWith('cloud://')) {
        cloudFileIds.push(img)
      }
    })
    if (r.avatarUrl && typeof r.avatarUrl === 'string' && r.avatarUrl.startsWith('cloud://')) {
      cloudFileIds.push(r.avatarUrl)
    }
    if (r.author && r.author.avatarUrl && typeof r.author.avatarUrl === 'string' && r.author.avatarUrl.startsWith('cloud://')) {
      cloudFileIds.push(r.author.avatarUrl)
    }
  })
  ;(commentsResult.data || []).forEach((c) => {
    if (c.author && c.author.avatarUrl && typeof c.author.avatarUrl === 'string' && c.author.avatarUrl.startsWith('cloud://')) {
      cloudFileIds.push(c.author.avatarUrl)
    }
  })

  const tempUrlMap = {}
  if (cloudFileIds.length) {
    try {
      const tempRes = await cloud.getTempFileURL({
        fileList: Array.from(new Set(cloudFileIds))
      })
      ;(tempRes.fileList || []).forEach((file) => {
        if (file.fileID && file.tempFileURL) {
          tempUrlMap[file.fileID] = file.tempFileURL
        }
      })
    } catch (tempErr) {
      console.warn('获取图片临时链接失败，降级使用原始链接', tempErr)
    }
  }

  // 3. 聚合所有需要的用户（动态作者 + 评论作者 + 点赞者 + 当前查看者）
  const commentList = commentsResult.data || []
  const commentUserIds = []
  commentList.forEach((c) => {
    if (c.openid) commentUserIds.push(c.openid)
    if (c._openid) commentUserIds.push(c._openid)
    if (c.moodId) commentUserIds.push(c.moodId)
    if (c.author) {
      if (c.author.openid) commentUserIds.push(c.author.openid)
      if (c.author._openid) commentUserIds.push(c.author._openid)
      if (c.author.moodId) commentUserIds.push(c.author.moodId)
    }
  })
  const likerUserIds = []
  recordLikersList.forEach((list) => list.forEach((uid) => likerUserIds.push(uid)))

  const allNeededOpenIds = Array.from(new Set([...allFeedOpenIds, openid, ...commentUserIds, ...likerUserIds]))
  const usersMap = await getUsersMap(allNeededOpenIds)
  const myUser = usersMap[openid] || {}
  const effectiveMyNickname = (event && event.myNickname && event.myNickname !== '微信用户') ? event.myNickname : (myUser.nickname || '心情用户0')
  const effectiveMyAvatar = (event && event.myAvatarUrl) ? event.myAvatarUrl : (myUser.avatarUrl || '')
  const effectiveMyMoodId = (event && event.myMoodId) ? event.myMoodId : (myUser.moodId || 'MWMTTTYAOA')

  // 4. 组织评论流并关联真实用户昵称与头像
  const recordMap = new Map()
  recordsData.forEach((r) => recordMap.set(r._id, r))

  const commentsMap = {}
  commentList
    .sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0
      return ta - tb
    })
    .forEach((comment) => {
      if (!commentsMap[comment.recordId]) {
        commentsMap[comment.recordId] = []
      }
      let cOpenId = comment.openid || comment._openid || (comment.author && (comment.author.openid || comment.author._openid))
      let cMoodId = (comment.author && comment.author.moodId) || comment.moodId || ''

      // 自愈解析：早期历史遗留评论（若无 openid），根据手帖归属与双向好友关系自动判定归属
      if (!cOpenId) {
        const parentRecord = recordMap.get(comment.recordId)
        if (parentRecord) {
          if (parentRecord.openid === openid) {
            // 我的手帖下的评论来自好友
            const friendId = ids.find((id) => id !== openid)
            if (friendId) cOpenId = friendId
          } else {
            // 好友手帖下的遗留评论是我自己留下的
            cOpenId = openid
          }
        }
      }

      const isMyComment = Boolean(cOpenId && cOpenId === openid)

      let authorNickname = ''
      let authorAvatarUrl = ''
      let authorMoodId = ''

      if (isMyComment) {
        authorNickname = effectiveMyNickname
        authorAvatarUrl = effectiveMyAvatar
        authorMoodId = effectiveMyMoodId
      } else {
        // 通用用户定位：按 openid / _openid / moodId 在 usersMap 中寻找该评论者的真实档案
        const commenterKey = cOpenId || cMoodId
        let u = commenterKey ? usersMap[commenterKey] : null

        // 容错补充：若评论记录中包含 moodId，尝试通过 moodId 命中
        if (!u && comment.author && comment.author.moodId) {
          u = usersMap[comment.author.moodId] || null
        }

        if (u) {
          // 成功关联用户主档案：直接采用该用户在数据库中保存的最新公开昵称与头像
          authorNickname = u.nickname
          authorAvatarUrl = u.avatarUrl || ''
          authorMoodId = u.moodId || ''
        } else {
          // 兜底处理（如老旧匿名测试数据）：采用评论中自带的信息，或通用友邻称谓
          authorNickname = (comment.author && comment.author.nickname && !['友邻', '好友'].includes(comment.author.nickname))
            ? comment.author.nickname
            : '友邻'
          authorAvatarUrl = (comment.author && comment.author.avatarUrl) || ''
          authorMoodId = (comment.author && comment.author.moodId) || ''
        }

        // 统一 CDN 临时直链安全转换（若头像为 cloud:// 格式）
        if (authorAvatarUrl && tempUrlMap[authorAvatarUrl]) {
          authorAvatarUrl = tempUrlMap[authorAvatarUrl]
        }
      }

      const resolvedOpenId = isMyComment ? openid : (cOpenId || '')

      // 数据库自愈更新：如果该条老评论在数据库中缺少 openid，自动在数据库中写入标准 openid 与 author
      if (!comment.openid && !comment._openid) {
        db.collection('comments').doc(comment._id).update({
          data: {
            openid: resolvedOpenId,
            _openid: resolvedOpenId,
            author: {
              openid: resolvedOpenId,
              nickname: authorNickname,
              avatarUrl: authorAvatarUrl,
              moodId: authorMoodId
            },
            updatedAt: db.serverDate()
          }
        }).catch(() => {})
      }

      commentsMap[comment.recordId].push({
        _id: comment._id,
        recordId: comment.recordId,
        isMine: isMyComment,
        author: {
          openid: resolvedOpenId,
          nickname: authorNickname,
          avatarUrl: authorAvatarUrl,
          moodId: authorMoodId
        },
        text: comment.text || '',
        createdAt: comment.createdAt
      })
    })

  const records = recordsData.map((item) => {
    const isMine = item.openid === openid
    const resolvedImages = (Array.isArray(item.images) ? item.images : []).map((img) => {
      return tempUrlMap[img] || img
    })
    const likers = recordLikersList.get(item._id) || []
    const likerNames = likers.map((uid) => {
      if (uid === openid) return effectiveMyNickname
      return (usersMap[uid] && usersMap[uid].nickname) || '友邻'
    })

    return {
      ...item,
      isMine,
      images: resolvedImages,
      author: (() => {
        const targetUser = (!isMine) ? (usersMap[item.openid] || usersMap[item._openid] || (item.author && usersMap[item.author.moodId]) || null) : null
        return {
          openid: isMine ? openid : (item.openid || item._openid || (targetUser && targetUser.openid) || (item.author && item.author.openid) || ''),
          moodId: isMine ? effectiveMyMoodId : ((targetUser && targetUser.moodId) || (item.author && item.author.moodId) || ''),
          nickname: isMine ? effectiveMyNickname : ((targetUser && targetUser.nickname) || (item.author && item.author.nickname) || '好友'),
          avatarUrl: isMine ? effectiveMyAvatar : ((targetUser && targetUser.avatarUrl) || (item.author && item.author.avatarUrl) || '')
        }
      })(),
      likeCount: seenLikers.get(item._id) ? seenLikers.get(item._id).size : 0,
      likeUserNames: likerNames,
      likeUserNamesText: likerNames.join('、'),
      commentCount: commentsMap[item._id] ? commentsMap[item._id].length : 0,
      comments: commentsMap[item._id] || [],
      liked: myLikedSet.has(item._id)
    }
  })

  return { records }
}

async function canViewRecord(recordId, openid) {
  const result = await safeQuery(() => db.collection('records').doc(recordId).get(), null)
  if (!result || !result.data) throw new Error('记录不存在')
  if (result.data.openid === openid) return result.data
  const ids = await friendOpenIds(openid)
  if (!ids.includes(result.data.openid)) throw new Error('只能操作好友的公开记录')
  return result.data
}

async function toggleLike(event) {
  const openid = context()
  await canViewRecord(event.recordId, openid)

  // 1. 先清理该动态下可能存在的无 openid 脏数据
  const allCurrentLikes = await safeQuery(() => db.collection('likes').where({ recordId: event.recordId }).get())
  const dirtyLikes = (allCurrentLikes.data || []).filter((item) => !item.openid && !item._openid)
  if (dirtyLikes.length) {
    Promise.allSettled(dirtyLikes.map((item) => db.collection('likes').doc(item._id).remove().catch(() => {}))).catch(() => {})
  }

  const found = await safeQuery(() => db.collection('likes').where(_.and([
    { recordId: event.recordId },
    _.or([
      { openid: openid },
      { _openid: openid }
    ])
  ])).get())

  if (found.data && found.data.length) {
    for (const item of found.data) {
      await db.collection('likes').doc(item._id).remove().catch(() => {})
    }
    return { liked: false }
  } else {
    await safeAdd('likes', {
      recordId: event.recordId,
      openid: openid,
      _openid: openid,
      createdAt: db.serverDate()
    })
    return { liked: true }
  }
}

async function addComment(event) {
  const openid = context()
  await canViewRecord(event.recordId, openid)
  const text = String(event.text || '').trim().slice(0, 200)
  if (!text) throw new Error('评论内容不能为空')

  const usersMap = await getUsersMap([openid])
  const currentUser = usersMap[openid] || {}

  const finalNickname = (event.myNickname && event.myNickname !== '微信用户') ? event.myNickname : (currentUser.nickname || '心情用户0')
  const finalAvatar = event.myAvatarUrl || currentUser.avatarUrl || ''
  const finalMoodId = event.myMoodId || currentUser.moodId || ''

  if (event.myNickname || event.myAvatarUrl) {
    const updateProfile = { updatedAt: db.serverDate() }
    if (event.myNickname && event.myNickname !== '微信用户' && event.myNickname !== '心情用户') {
      updateProfile.nickname = event.myNickname
    }
    if (event.myAvatarUrl) {
      updateProfile.avatarUrl = event.myAvatarUrl
    }
    if (Object.keys(updateProfile).length > 1) {
      db.collection('users').where({ openid }).update({ data: updateProfile }).catch(() => {})
    }
  }

  const author = {
    openid,
    nickname: finalNickname,
    avatarUrl: finalAvatar,
    moodId: finalMoodId
  }

  const addRes = await safeAdd('comments', {
    recordId: event.recordId,
    openid: openid,
    _openid: openid,
    author,
    text,
    createdAt: db.serverDate()
  })

  return {
    comment: {
      _id: addRes._id,
      recordId: event.recordId,
      author,
      text,
      dateText: '刚刚'
    }
  }
}

async function deleteComment(event = {}) {
  const openid = context()
  const commentId = event.commentId
  if (!commentId) throw new Error('未指定要删除的评论')

  const commentRes = await safeQuery(() => db.collection('comments').doc(commentId).get(), null)
  const comment = commentRes && commentRes.data
  if (!comment) throw new Error('评论不存在或已被删除')

  const cAuthorOpenId = comment.openid || comment._openid || (comment.author && (comment.author.openid || comment.author._openid))
  const isCommentAuthor = Boolean(cAuthorOpenId && cAuthorOpenId === openid)

  let isRecordOwner = false
  if (!isCommentAuthor && comment.recordId) {
    const recordRes = await safeQuery(() => db.collection('records').doc(comment.recordId).get(), null)
    if (recordRes && recordRes.data) {
      const rOpenId = recordRes.data.openid || recordRes.data._openid
      if (rOpenId && rOpenId === openid) {
        isRecordOwner = true
      }
    }
  }

  if (!isCommentAuthor && !isRecordOwner) {
    throw new Error('只有评论作者或手帖主人可以删除此评论')
  }

  await db.collection('comments').doc(commentId).remove()

  return {
    deleted: true,
    commentId,
    message: '评论已删除'
  }
}

exports.main = async (event) => {
  await initCollections()
  if (event.action === 'searchUser') return { ok: true, ...(await searchUser(event)) }
  if (event.action === 'sendRequest') return { ok: true, ...(await sendRequest(event)) }
  if (event.action === 'listRequests') return { ok: true, ...(await listRequests()) }
  if (event.action === 'respondRequest') return { ok: true, ...(await respondRequest(event)) }
  if (event.action === 'listFriends') return { ok: true, ...(await listFriends()) }
  if (event.action === 'deleteFriend') return { ok: true, ...(await deleteFriend(event)) }
  if (event.action === 'feed') return { ok: true, ...(await feed(event)) }
  if (event.action === 'toggleLike') return { ok: true, ...(await toggleLike(event)) }
  if (event.action === 'addComment') return { ok: true, ...(await addComment(event)) }
  if (event.action === 'deleteComment') return { ok: true, ...(await deleteComment(event)) }
  return { ok: false, message: '未知的社交操作' }
}
