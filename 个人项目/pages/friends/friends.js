const { getWeather, formatDateText } = require('../../utils/mood')
const { social } = require('../../utils/cloud')

function sanitizeAvatarUrl(url) {
  if (!url || typeof url !== 'string') return ''
  const trimmed = url.trim()
  if (trimmed.includes('thirdwx.qlogo.cn') || trimmed.startsWith('http://tmp') || trimmed.startsWith('wxfile://')) {
    return ''
  }
  return trimmed
}

Page({
  data: {
    activeTab: 'feed',
    cloudReady: false,
    moodId: '',
    searchValue: '',
    searchUser: null,
    requests: [],
    pendingRequestCount: 0,
    friends: [],
    feed: [],
    loading: false,
    userCard: null,
    showUserCard: false,
    cardLoading: false
  },

  onLoad() {
    this.loadSocialData()
  },

  onShow() {
    this.loadSocialData()
  },

  switchTab(event) {
    const tab = event.currentTarget.dataset.tab
    if (tab && tab !== this.data.activeTab) {
      this.setData({ activeTab: tab })
    }
  },

  loadSocialData() {
    const app = getApp()
    if (!app.globalData.cloudReady) {
      this.setData({ cloudReady: false })
      return setTimeout(() => {
        if (getApp().globalData.cloudReady) this.loadSocialData()
      }, 800)
    }
    const cachedProfile = wx.getStorageSync('user_profile_cache_v2') || {}
    const globalUser = (app && app.globalData && app.globalData.user) || {}
    const myNickname = cachedProfile.nickname || globalUser.nickname || ''
    const myAvatarUrl = sanitizeAvatarUrl(cachedProfile.avatarUrl || globalUser.avatarUrl || '')
    const myMoodId = globalUser.moodId || this.data.moodId || ''
    const myOpenId = globalUser.openid || globalUser._openid || ''

    this.setData({ cloudReady: true, moodId: myMoodId })
    Promise.all([
      social('listRequests').catch((err) => {
        console.warn('listRequests failed:', err)
        return { requests: [] }
      }),
      social('listFriends').catch((err) => {
        console.warn('listFriends failed:', err)
        return { friends: [] }
      }),
      social('feed', { myNickname, myAvatarUrl, myMoodId }).catch((err) => {
        console.warn('feed failed:', err)
        return { records: [] }
      })
    ]).then(([requests, friends, feed]) => {
      const records = (feed.records || []).map((item) => {
        const isMine = Boolean(item.isMine || (item.author && myMoodId && item.author.moodId === myMoodId))
        const author = item.author || {}
        const authorNick = isMine ? (myNickname || author.nickname || '我') : (author.nickname || '友邻')
        const authorAvatar = sanitizeAvatarUrl(isMine ? (myAvatarUrl || author.avatarUrl) : author.avatarUrl)
        const authorOpenId = isMine ? myOpenId : (author.openid || item.openid || item._openid || '')
        const authorMoodId = isMine ? myMoodId : (author.moodId || '')
        const comments = (Array.isArray(item.comments) ? item.comments : []).map((c) => {
          const cAuthor = c.author || {}
          const cAuthorOpenId = cAuthor.openid || c.openid || c._openid || ''
          const cAuthorMoodId = cAuthor.moodId || c.moodId || ''
          // 优先由云端已鉴权的 c.isMine 判定，同时兼顾本地 openid / moodId 判定
          const cIsMine = Boolean(
            c.isMine ||
            (cAuthorOpenId && myOpenId && cAuthorOpenId === myOpenId) ||
            (cAuthorMoodId && myMoodId && cAuthorMoodId === myMoodId)
          )

          let cAuthorNick = cAuthor.nickname
          let cAuthorAvatar = sanitizeAvatarUrl(cAuthor.avatarUrl)
          if (cIsMine) {
            if (myNickname) cAuthorNick = myNickname
            if (myAvatarUrl) cAuthorAvatar = myAvatarUrl
          }
          if (!cAuthorNick) cAuthorNick = '友邻'

          return {
            ...c,
            isMine: cIsMine,
            author: {
              ...cAuthor,
              openid: cIsMine ? myOpenId : cAuthorOpenId,
              moodId: cIsMine ? myMoodId : cAuthorMoodId,
              nickname: cAuthorNick,
              avatarUrl: cAuthorAvatar,
              avatarText: (cAuthorNick.slice(0, 1) || '心')
            }
          }
        })

        return {
          ...item,
          isMine,
          author: {
            ...author,
            openid: authorOpenId,
            moodId: authorMoodId,
            nickname: authorNick,
            avatarUrl: authorAvatar
          },
          weatherInfo: getWeather(item.weather),
          dateText: formatDateText(item.date),
          tagText: Array.isArray(item.tags) ? item.tags.join(' · ') : '',
          avatarText: (authorNick.slice(0, 1) || '心'),
          likeUserNames: Array.isArray(item.likeUserNames) ? item.likeUserNames : [],
          likeUserNamesText: item.likeUserNamesText || (Array.isArray(item.likeUserNames) ? item.likeUserNames.join('、') : ''),
          comments,
          commentCount: comments.length,
          commentInput: ''
        }
      })
      const requestList = (requests.requests || []).map((item) => {
        const u = item.user || {}
        const rawNick = u.nickname || '心情用户'
        const avatarUrl = sanitizeAvatarUrl(u.avatarUrl)
        return {
          ...item,
          user: {
            ...u,
            avatarUrl
          },
          avatarText: (rawNick.slice(0, 1) || '心')
        }
      })
      const pendingRequestCount = requestList.filter((r) => r.direction === 'received' && r.status === 'pending').length
      const friendList = (friends.friends || []).map((item) => {
        const rawNick = item.nickname || '心情用户'
        const avatarUrl = sanitizeAvatarUrl(item.avatarUrl)
        return {
          ...item,
          avatarUrl,
          avatarText: (rawNick.slice(0, 1) || '心')
        }
      })
      this.setData({
        requests: requestList,
        pendingRequestCount,
        friends: friendList,
        feed: records
      })
    }).catch((error) => {
      console.error('loadSocialData catch:', error)
    })
  },

  inputSearch(event) { this.setData({ searchValue: event.detail.value }) },

  copyMoodId() {
    if (!this.data.moodId) return
    wx.setClipboardData({
      data: this.data.moodId,
      success: () => {
        wx.showToast({ title: '我的印章号已复制', icon: 'success' })
      }
    })
  },

  copyMoodIdByVal(event) {
    const val = event.currentTarget.dataset.id
    if (!val) return
    wx.setClipboardData({
      data: val,
      success: () => {
        wx.showToast({ title: '好友印章号已复制', icon: 'success' })
      }
    })
  },

  searchFriend() {
    const value = this.data.searchValue.trim()
    if (!value) return wx.showToast({ title: '请输入好友号', icon: 'none' })
    this.setData({ loading: true, searchUser: null })
    social('searchUser', { moodId: value })
      .then((result) => {
        const u = result.user || null
        if (u) {
          u.avatarUrl = sanitizeAvatarUrl(u.avatarUrl)
          u.avatarText = (u.nickname || '心').slice(0, 1) || '心'
        }
        this.setData({ searchUser: u })
      })
      .catch((error) => wx.showToast({ title: error.message || '搜索失败', icon: 'none' }))
      .finally(() => this.setData({ loading: false }))
  },

  addFriend() {
    if (this.data.adding) return
    const user = this.data.searchUser
    if (!user) return
    this.setData({ adding: true })
    wx.showLoading({ title: '正在处理...', mask: true })
    social('sendRequest', { moodId: user.moodId })
      .then((res) => {
        const msg = (res && res.message) || (res && res.autoAccepted ? '互加成功，已成为好友！' : '好友申请已发送')
        wx.showToast({ title: msg, icon: 'success' })
        this.setData({ searchUser: null, searchValue: '' })
        this.loadSocialData()
      })
      .catch((error) => wx.showToast({ title: error.message || '发送失败', icon: 'none' }))
      .finally(() => {
        this.setData({ adding: false })
        wx.hideLoading()
      })
  },

  respondRequest(event) {
    if (this.data.responding) return
    const requestId = event.currentTarget.dataset.id
    const accept = event.currentTarget.dataset.accept === 'true'
    this.setData({ responding: true })
    wx.showLoading({ title: accept ? '正在同意...' : '正在拒绝...', mask: true })
    social('respondRequest', { requestId, accept })
      .then((res) => {
        const msg = (res && res.message) || (accept ? '已添加为好友！' : '已拒绝申请')
        wx.showToast({ title: msg, icon: 'success' })
        this.loadSocialData()
      })
      .catch((error) => wx.showToast({ title: error.message || '处理失败', icon: 'none' }))
      .finally(() => {
        this.setData({ responding: false })
        wx.hideLoading()
      })
  },

  previewImages(event) {
    const item = this.data.feed.find((record) => record._id === event.currentTarget.dataset.id)
    if (item && item.images && item.images.length) wx.previewImage({ current: event.currentTarget.dataset.current, urls: item.images })
  },

  toggleLike(event) {
    const id = event.currentTarget.dataset.id
    const target = this.data.feed.find((item) => item._id === id)
    if (!target) return
    const app = getApp()
    const cachedProfile = wx.getStorageSync('user_profile_cache_v2') || {}
    const globalUser = (app && app.globalData && app.globalData.user) || {}
    const myName = cachedProfile.nickname || globalUser.nickname || '我'

    social('toggleLike', { recordId: id }).then((result) => {
      this.setData({
        feed: this.data.feed.map((item) => {
          if (item._id !== id) return item
          const liked = Boolean(result.liked)
          const diff = liked ? 1 : -1
          const newCount = Math.max(0, (item.likeCount || 0) + diff)
          let currentNames = Array.isArray(item.likeUserNames) ? [...item.likeUserNames] : []
          if (liked) {
            if (!currentNames.includes(myName)) currentNames.push(myName)
          } else {
            currentNames = currentNames.filter((n) => n !== myName && n !== '我' && n !== '心情用户0')
          }
          return {
            ...item,
            liked,
            likeCount: newCount,
            likeUserNames: currentNames,
            likeUserNamesText: currentNames.join('、')
          }
        })
      })
    }).catch((error) => wx.showToast({ title: error.message || '操作失败', icon: 'none' }))
  },

  inputComment(event) {
    const id = event.currentTarget.dataset.id
    this.setData({ feed: this.data.feed.map((item) => item._id === id ? { ...item, commentInput: event.detail.value } : item) })
  },

  addComment(event) {
    const id = event.currentTarget.dataset.id
    const item = this.data.feed.find((record) => record._id === id)
    if (!item || !item.commentInput || !item.commentInput.trim()) {
      return wx.showToast({ title: '写点评论再提交吧', icon: 'none' })
    }
    const text = item.commentInput.trim()

    const app = getApp()
    const cachedProfile = wx.getStorageSync('user_profile_cache_v2') || {}
    const globalUser = (app && app.globalData && app.globalData.user) || {}
    const myNickname = cachedProfile.nickname || globalUser.nickname || '心情用户0'
    const myAvatarUrl = cachedProfile.avatarUrl || globalUser.avatarUrl || ''
    const myMoodId = globalUser.moodId || this.data.moodId || ''
    const myOpenId = globalUser.openid || globalUser._openid || ''

    const tempComment = {
      _id: 'temp_' + Date.now(),
      author: {
        openid: myOpenId,
        nickname: myNickname,
        avatarUrl: myAvatarUrl,
        moodId: myMoodId,
        avatarText: (myNickname ? myNickname.slice(0, 1) : '心')
      },
      text,
      createdAt: new Date().toISOString()
    }

    // Optimistic UI: 本地即时追加展示
    this.setData({
      feed: this.data.feed.map((record) => {
        if (record._id === id) {
          const comments = Array.isArray(record.comments) ? [...record.comments, tempComment] : [tempComment]
          return {
            ...record,
            commentInput: '',
            comments,
            commentCount: comments.length
          }
        }
        return record
      })
    })

    social('addComment', { recordId: id, text, myNickname, myAvatarUrl, myMoodId })
      .then((res) => {
        wx.showToast({ title: '评论已发送', icon: 'success' })
      })
      .catch((error) => {
        wx.showToast({ title: error.message || '评论失败', icon: 'none' })
        this.loadSocialData()
      })
  },

  onFriendAvatarError(event) {
    const idx = event.currentTarget.dataset.index
    if (typeof idx === 'number' && this.data.friends[idx]) {
      this.setData({ [`friends[${idx}].avatarUrl`]: '' })
    }
  },

  onRequestAvatarError(event) {
    const idx = event.currentTarget.dataset.index
    if (typeof idx === 'number' && this.data.requests[idx]) {
      this.setData({ [`requests[${idx}].user.avatarUrl`]: '' })
    }
  },

  onFeedAvatarError(event) {
    const idx = event.currentTarget.dataset.index
    if (typeof idx === 'number' && this.data.feed[idx]) {
      this.setData({ [`feed[${idx}].author.avatarUrl`]: '' })
    }
  },

  onCommentAvatarError(event) {
    const { feedIndex, commentIndex } = event.currentTarget.dataset
    if (typeof feedIndex === 'number' && typeof commentIndex === 'number' &&
        this.data.feed[feedIndex] && this.data.feed[feedIndex].comments &&
        this.data.feed[feedIndex].comments[commentIndex]) {
      this.setData({
        [`feed[${feedIndex}].comments[${commentIndex}].author.avatarUrl`]: ''
      })
    }
  },

  onFeedImageError(event) {
    const idx = event.currentTarget.dataset.index
    console.warn('手帖图片加载失败，索引:', idx)
  },

  openUserCard(event) {
    const user = event.currentTarget.dataset.user
    if (!user) return
    const app = getApp()
    const globalUser = (app && app.globalData && app.globalData.user) || {}
    const myOpenId = globalUser.openid || globalUser._openid || ''
    const myMoodId = globalUser.moodId || this.data.moodId || ''

    const uOpenId = user.openid || user._openid || ''
    const uMoodId = user.moodId || ''
    const nickname = (user.nickname || '友邻').trim()
    const avatarUrl = sanitizeAvatarUrl(user.avatarUrl)
    const avatarText = user.avatarText || (nickname ? nickname.slice(0, 1) : '心')

    // 1. 判断是否是自己
    const isMe = Boolean(
      (uOpenId && myOpenId && uOpenId === myOpenId) ||
      (uMoodId && myMoodId && uMoodId === myMoodId)
    )

    // 2. 判断是否已经是好友
    const isFriend = !isMe && this.data.friends.some((f) => {
      return (uMoodId && f.moodId && f.moodId === uMoodId) ||
             (uOpenId && f.openid && f.openid === uOpenId)
    })

    // 3. 判断申请状态
    let relation = isMe ? 'self' : (isFriend ? 'friend' : 'none')
    if (relation === 'none') {
      const matchedReq = this.data.requests.find((r) => {
        const ru = r.user || {}
        const match = (uMoodId && ru.moodId && ru.moodId === uMoodId) ||
                      (uOpenId && ru.openid && ru.openid === uOpenId)
        return match && r.status === 'pending'
      })
      if (matchedReq) {
        relation = matchedReq.direction === 'received' ? 'pending_received' : 'pending_sent'
      }
    }

    this.setData({
      userCard: {
        openid: uOpenId,
        moodId: uMoodId,
        nickname,
        avatarUrl,
        avatarText,
        relation
      },
      showUserCard: true
    })
  },

  closeUserCard() {
    this.setData({ showUserCard: false })
  },

  preventTouchMove() {
    // 阻止遮罩层滚动穿透
    return
  },

  stopBubble() {
    // 阻止弹窗内部点击冒泡
    return
  },

  onCardAvatarError() {
    if (this.data.userCard) {
      this.setData({ 'userCard.avatarUrl': '' })
    }
  },

  copyCardMoodId() {
    const userCard = this.data.userCard
    if (!userCard || !userCard.moodId) return
    wx.setClipboardData({
      data: userCard.moodId,
      success: () => {
        wx.showToast({ title: '印章号已复制', icon: 'success' })
      }
    })
  },

  addFriendFromCard() {
    if (this.data.cardLoading || !this.data.userCard) return
    const { moodId, openid } = this.data.userCard
    if (!moodId && !openid) {
      return wx.showToast({ title: '找不到用户信息', icon: 'none' })
    }

    this.setData({ cardLoading: true })
    wx.showLoading({ title: '正在发送申请...', mask: true })
    social('sendRequest', { moodId, openid })
      .then((res) => {
        const isAutoAccepted = Boolean(res && (res.autoAccepted || res.isFriend))
        const msg = (res && res.message) || (isAutoAccepted ? '互加成功，已成为好友！' : '好友申请已发送')
        wx.showToast({ title: msg, icon: 'success' })
        this.setData({
          'userCard.relation': isAutoAccepted ? 'friend' : 'pending_sent'
        })
        this.loadSocialData()
      })
      .catch((err) => {
        wx.showToast({ title: err.message || '申请发送失败', icon: 'none' })
      })
      .finally(() => {
        this.setData({ cardLoading: false })
        wx.hideLoading()
      })
  },

  // ===== 1. 评论管理：长按/点击删除评论 =====
  onLongPressComment(event) {
    const ds = event.currentTarget.dataset
    const commentId = ds.commentId
    const feedIndex = ds.feedIndex
    const commentIndex = ds.commentIndex
    const isMine = ds.isMine
    const recordIsMine = ds.recordIsMine

    if (!isMine && !recordIsMine) {
      return wx.showToast({ title: '只能删除自己的评论或自己手帖下的评论', icon: 'none' })
    }

    wx.vibrateShort && wx.vibrateShort({ type: 'medium' })
    wx.showActionSheet({
      itemList: ['删除此评论'],
      itemColor: '#E05A47',
      success: (res) => {
        if (res.tapIndex === 0) {
          this.doDeleteComment(commentId, feedIndex, commentIndex)
        }
      }
    })
  },

  onTapDeleteCommentBtn(event) {
    const ds = event.currentTarget.dataset
    const commentId = ds.commentId
    const feedIndex = ds.feedIndex
    const commentIndex = ds.commentIndex
    wx.showModal({
      title: '删除评论',
      content: '确定要删除这条留言吗？',
      confirmText: '删除',
      confirmColor: '#E05A47',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          this.doDeleteComment(commentId, feedIndex, commentIndex)
        }
      }
    })
  },

  doDeleteComment(commentId, feedIndex, commentIndex) {
    if (!commentId) return
    wx.showLoading({ title: '正在删除...', mask: true })

    // 乐观更新：前端先即时从列表中移除
    const feed = this.data.feed
    if (feed && feed[feedIndex] && feed[feedIndex].comments) {
      const comments = feed[feedIndex].comments.filter((c, idx) => {
        if (c._id && c._id === commentId) return false
        if (idx === commentIndex) return false
        return true
      })
      this.setData({
        [`feed[${feedIndex}].comments`]: comments,
        [`feed[${feedIndex}].commentCount`]: comments.length
      })
    }

    social('deleteComment', { commentId })
      .then(() => {
        wx.showToast({ title: '评论已删除', icon: 'success' })
      })
      .catch((err) => {
        wx.showToast({ title: err.message || '删除失败', icon: 'none' })
        this.loadSocialData()
      })
      .finally(() => {
        wx.hideLoading()
      })
  },

  // ===== 2. 好友解除管理：自选弹窗与解除执行 =====
  onTapDeleteFriendFromCard() {
    const userCard = this.data.userCard
    if (!userCard) return
    this.showDeleteFriendSheet(userCard)
  },

  onTapDeleteFriendFromList(event) {
    const user = event.currentTarget.dataset.user
    if (!user) return
    this.showDeleteFriendSheet(user)
  },

  onLongPressFriendCard(event) {
    const user = event.currentTarget.dataset.user
    if (!user) return
    wx.vibrateShort && wx.vibrateShort({ type: 'medium' })
    this.showDeleteFriendSheet(user)
  },

  showDeleteFriendSheet(targetUser) {
    const nickname = targetUser.nickname || '该好友'
    wx.showActionSheet({
      itemList: [
        '仅解除友邻关系 (保留历史手帖留言)',
        '解除好友并清空双方互动记录'
      ],
      itemColor: '#2D3748',
      success: (res) => {
        const cleanInteractions = res.tapIndex === 1
        const actionTitle = cleanInteractions ? '解除好友并清空互动' : '解除友邻关系'
        const content = cleanInteractions
          ? `确定要解除与「${nickname}」的好友关系，并清空双方在彼此手帖下的全部评论与点赞吗？此操作不可逆。`
          : `确定要解除与「${nickname}」的好友关系吗？解除后双方晴雨手帖将互不可见。`

        wx.showModal({
          title: actionTitle,
          content,
          confirmText: '确认解除',
          confirmColor: '#E05A47',
          cancelText: '取消',
          success: (modalRes) => {
            if (modalRes.confirm) {
              this.doDeleteFriend(targetUser, cleanInteractions)
            }
          }
        })
      }
    })
  },

  doDeleteFriend(targetUser, cleanInteractions = false) {
    const targetOpenId = targetUser.openid || targetUser._openid
    const targetMoodId = targetUser.moodId
    if (!targetOpenId && !targetMoodId) {
      return wx.showToast({ title: '好友信息无效', icon: 'none' })
    }

    wx.showLoading({ title: '正在处理...', mask: true })

    social('deleteFriend', {
      targetOpenId,
      targetMoodId,
      cleanInteractions
    })
      .then((res) => {
        const toastMsg = (res && res.message) || (cleanInteractions ? '已解除并清空互动' : '已解除好友关系')
        wx.showToast({ title: toastMsg, icon: 'success', duration: 2000 })

        // 1. 关闭名片弹窗
        this.setData({ showUserCard: false })

        // 2. 本地立即移除好友列表项
        const newFriends = this.data.friends.filter((f) => {
          if (targetMoodId && f.moodId === targetMoodId) return false
          if (targetOpenId && (f.openid === targetOpenId || f._openid === targetOpenId)) return false
          return true
        })
        this.setData({ friends: newFriends })

        // 3. 刷新全量社交数据（动态流与申请状态同步隔离）
        this.loadSocialData()
      })
      .catch((err) => {
        wx.showToast({ title: err.message || '解除失败', icon: 'none' })
      })
      .finally(() => {
        wx.hideLoading()
      })
  }
})
