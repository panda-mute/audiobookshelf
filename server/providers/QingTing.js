const axios = require('axios')
const Logger = require('../Logger')

/**
 * 蜻蜓FM (QingTingFM) metadata provider
 *
 * 通道 1 - 通用书名搜索(公开接口, 无需登录):
 *   GET https://search.qtfm.cn/v3/search?categoryid=0&k=<关键词>&page=1&pagesize=20&include=channel_ondemand
 *   返回 docs[]: id/title/podcaster(主播)/cover/description/playcount/program_count/updatetime
 *
 * 通道 2 - 频道详情(频道页 SSR):
 *   GET https://www.qtfm.cn/channels/<id>/
 *   解析 window.__initStores 的 AlbumStore.album:
 *   name/desc/detail/img_url/podcasters/category_id/attrs/playcount/program_count/update_time
 *
 * 使用方式: 在"匹配"弹窗选择 provider = 蜻蜓FM,
 * 直接输入书名搜索, 或粘贴蜻蜓FM频道页 URL(如 https://www.qtfm.cn/channels/202998/) 精确匹配。
 */
class QingTing {
  #responseTimeout = 10000

  #userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

  constructor() {}

  /**
   * 从输入中提取蜻蜓FM频道 ID
   * 支持: 频道页 URL、纯数字 ID
   * @param {string} input
   * @returns {string|null}
   */
  extractChannelId(input) {
    if (!input) return null
    const str = String(input).trim()

    // 频道页 URL: qtfm.cn/channels/202998
    const urlMatch = str.match(/qtfm\.cn\/channels\/(\d+)/)
    if (urlMatch) return urlMatch[1]

    // 纯数字(蜻蜓FM频道 ID 一般 4 位以上)
    if (/^\d{4,}$/.test(str)) return str

    return null
  }

  /**
   * 统一封面处理: 补全 https:, 去掉尺寸修饰后缀(如 "!200")
   * @param {string} cover
   * @returns {string|null}
   */
  normalizeCover(cover) {
    if (!cover) return null
    let c = String(cover).split('!')[0].trim()
    if (c.startsWith('//')) c = 'https:' + c
    else if (c.startsWith('http://')) c = 'https://' + c.slice(7)
    return c || null
  }

  /**
   * 从时间戳提取年份
   * @param {number|string} ts 秒或毫秒时间戳
   * @returns {string|null}
   */
  yearFromTimestamp(ts) {
    if (!ts) return null
    let n = Number(ts)
    if (isNaN(n) || !n) return null
    // 若为秒级(10 位)转毫秒
    if (n < 1e12) n *= 1000
    const y = new Date(n).getFullYear()
    return isNaN(y) ? null : String(y)
  }

  /**
   * 通过频道 ID 拉取完整详情(解析频道页 SSR)
   * @param {string} channelId
   * @param {number} [timeout]
   * @returns {Promise<Object|null>}
   */
  async getAlbumDataById(channelId, timeout = this.#responseTimeout) {
    const url = `https://www.qtfm.cn/channels/${channelId}/`
    const res = await axios
      .get(url, {
        timeout,
        headers: {
          'User-Agent': this.#userAgent,
          Referer: 'https://www.qtfm.cn/'
        }
      })
      .catch((error) => {
        Logger.error(`[QingTing] Channel page request error: ${error.message}`)
        return null
      })

    const html = res?.data
    if (typeof html !== 'string') return null

    // 提取 window.__initStores 中的 AlbumStore.album
    const m = html.match(/window\.__initStores=\s*(\{.*?\})\s*<\/script>/s)
    if (!m) {
      Logger.warn(`[QingTing] No initStores found for channel ${channelId}`)
      return null
    }
    let data
    try {
      data = JSON.parse(m[1])
    } catch (error) {
      Logger.error(`[QingTing] Failed to parse initStores for channel ${channelId}: ${error.message}`)
      return null
    }
    const album = data?.AlbumStore?.album
    if (!album || !album.id) return null
    return this.cleanAlbumDetail(album)
  }

  /**
   * 将频道详情(AlbumStore.album)映射为 ABS 元数据格式
   * @param {Object} album
   * @returns {Object}
   */
  cleanAlbumDetail(album) {
    let description = album.desc || ''
    description = description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

    const genres = []
    if (Array.isArray(album.attrs)) {
      genres.push(...album.attrs.map((a) => a.name).filter(Boolean))
    }

    // 主播: 取第一个
    let podcaster = null
    if (Array.isArray(album.podcasters) && album.podcasters.length) {
      podcaster = album.podcasters[0].name || null
    }

    let publishedYear = null
    if (album.update_time) {
      const y = album.update_time.split('-')[0]
      if (/^\d{4}$/.test(y)) publishedYear = y
    }

    return {
      id: String(album.id),
      title: album.name || '',
      author: podcaster,
      narrator: podcaster,
      description: description || null,
      cover: this.normalizeCover(album.img_url),
      publishedYear,
      genres: genres.length ? [...new Set(genres)] : null,
      albumId: String(album.id),
      asin: String(album.id),
      isbn: null,
      playCount: album.playcount || null,
      duration: null
    }
  }

  /**
   * 将搜索结果单条(docs 元素)映射为候选
   * @param {Object} doc
   * @returns {Object|null}
   */
  cleanSearchResult(doc) {
    if (!doc || !doc.id) return null
    let description = doc.description || ''
    description = description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

    return {
      id: String(doc.id),
      title: doc.title || '',
      author: doc.podcaster || null,
      narrator: doc.podcaster || null,
      description: description || null,
      cover: this.normalizeCover(doc.cover),
      publishedYear: this.yearFromTimestamp(doc.updatetime),
      genres: null,
      albumId: String(doc.id),
      asin: String(doc.id),
      isbn: null,
      playCount: typeof doc.playcount === 'number' ? doc.playcount : null,
      duration: null
    }
  }

  /**
   * 通用书名搜索(公开接口, 无需登录, 支持分页)
   * @param {string} keyword
   * @param {number} [page]
   * @param {number} [timeout]
   * @returns {Promise<{books: Object[], totalPages: number}>}
   */
  async searchByKeyword(keyword, page = 1, timeout = this.#responseTimeout) {
    const url = `https://search.qtfm.cn/v3/search?categoryid=0&k=${encodeURIComponent(keyword)}&page=${page}&pagesize=20&include=channel_ondemand`
    const res = await axios
      .get(url, {
        timeout,
        headers: {
          'User-Agent': this.#userAgent,
          Referer: 'https://www.qtfm.cn/'
        }
      })
      .catch((error) => {
        Logger.error(`[QingTing] Search request error: ${error.message}`)
        return {}
      })

    if (res?.data?.errcode !== 0) {
      Logger.warn(`[QingTing] Search failed: errcode=${res?.data?.errcode} errmsg=${res?.data?.errmsg}`)
      return { books: [], totalPages: 1 }
    }

    const data = res?.data?.data?.data
    const docs = data?.docs
    if (!Array.isArray(docs)) return { books: [], totalPages: 1 }

    const numFound = Number(data?.numFound) || 0
    const totalPages = Math.max(1, Math.ceil(numFound / 20))
    return {
      books: docs.map((doc) => this.cleanSearchResult(doc)).filter(Boolean),
      totalPages
    }
  }

  /**
   * 搜索匹配候选列表(支持分页)
   * @param {string} title
   * @param {string} [author]
   * @param {number} [timeout]
   * @param {number} [page]
   * @returns {Promise<{books: Object[], totalPages: number}>}
   */
  async search(title, author, timeout = this.#responseTimeout, page = 1) {
    if (!timeout || isNaN(timeout)) timeout = this.#responseTimeout

    // 通道 1: 频道 URL / ID 精确匹配(详情更完整, 无分页)
    const channelId = this.extractChannelId(title)
    if (channelId) {
      const data = await this.getAlbumDataById(channelId, timeout)
      return { books: data ? [data] : [], totalPages: 1 }
    }

    // 通道 2: 通用书名搜索
    if (!title) return { books: [], totalPages: 1 }
    return this.searchByKeyword(title, page, timeout)
  }

  /**
   * 按频道 ID 拉取书籍数据(供未来/外部调用)
   * @param {string} channelId
   * @param {number} [timeout]
   * @returns {Promise<Object|null>}
   */
  async getBookDataByIdentifier(channelId, timeout = this.#responseTimeout) {
    return this.getAlbumDataById(channelId, timeout)
  }
}

module.exports = QingTing
