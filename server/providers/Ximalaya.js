const axios = require('axios')
const Logger = require('../Logger')

/**
 * 喜马拉雅 (Ximalaya) metadata provider
 *
 * 搜索使用喜马拉雅 Web 搜索接口, 无需登录/签名, 匿名即可调用:
 *   GET https://www.ximalaya.com/revision/search?core=album&kw=<关键词>&page=1&rows=50&condition=relation&device=iPhone
 * 返回的 docs[] 已包含标题/作者(nickname)/封面(cover_path)/简介(intro)/分类/标签/年份/曲目数。
 *
 * 两条匹配通道:
 *   1. 通用书名搜索: 输入书名, 返回喜马拉雅专辑候选列表。
 *   2. albumId 精确匹配: 输入专辑 URL / albumId / 纯数字 ID,
 *      通过公开的 revision/album/v1/simple 拉取更完整详情(封面/作者/富文本简介/年份/分类)。
 *
 * 使用方式: 在"匹配"弹窗选择 provider = 喜马拉雅,
 * 直接输入书名搜索, 或粘贴喜马拉雅专辑页 URL(如 https://www.ximalaya.com/album/39018046)。
 */
class Ximalaya {
  #responseTimeout = 10000

  #userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

  constructor() {}

  /**
   * 从输入中提取喜马拉雅专辑 ID
   * 支持: 专辑页 URL、albumId:123 / albumId=123 前缀、纯数字
   * @param {string} input
   * @returns {string|null}
   */
  extractAlbumId(input) {
    if (!input) return null
    const str = String(input).trim()

    // 专辑页 URL
    const urlMatch = str.match(/ximalaya\.com\/album\/(\d+)/)
    if (urlMatch) return urlMatch[1]

    // albumId:123 或 albumId=123
    const prefixMatch = str.match(/albumId\s*[:=]\s*(\d+)/i)
    if (prefixMatch) return prefixMatch[1]

    // 纯数字(喜马拉雅专辑 ID 一般 6 位以上)
    if (/^\d{6,}$/.test(str)) return str

    return null
  }

  /**
   * 统一封面处理: 补全 https: 协议, 去掉尺寸修饰后缀(如 "!op_type")
   * @param {string} cover
   * @returns {string|null}
   */
  normalizeCover(cover) {
    if (!cover) return null
    let c = String(cover).split('!')[0].trim()
    if (c.startsWith('//')) c = 'https:' + c
    return c || null
  }

  /**
   * 通过专辑 ID 拉取完整信息(公开接口, 无需登录)
   * @param {string} albumId
   * @param {number} [timeout]
   * @returns {Promise<Object|null>}
   */
  async getAlbumData(albumId, timeout = this.#responseTimeout) {
    if (!timeout || isNaN(timeout)) timeout = this.#responseTimeout

    const url = `https://www.ximalaya.com/revision/album/v1/simple?albumId=${encodeURIComponent(albumId)}`
    const res = await axios
      .get(url, {
        timeout,
        headers: {
          'User-Agent': this.#userAgent,
          Referer: `https://www.ximalaya.com/album/${albumId}`
        }
      })
      .catch((error) => {
        Logger.error(`[Ximalaya] Album simple request error: ${error.message}`)
        return null
      })

    const info = res?.data?.data?.albumPageMainInfo
    if (!info || !info.albumId) {
      Logger.warn(`[Ximalaya] No album data found for albumId ${albumId}`)
      return null
    }
    return this.cleanResult(info)
  }

  /**
   * 将喜马拉雅专辑详情(albumPageMainInfo)映射为 ABS 元数据 provider 返回格式
   * @param {Object} info albumPageMainInfo
   * @returns {Object}
   */
  cleanResult(info) {
    // richIntro 为富文本(HTML), 转纯文本
    let description = info.richIntro || info.shortIntro || info.outline || ''
    description = description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

    const genres = []
    if (info.categoryTitle) genres.push(info.categoryTitle)
    if (Array.isArray(info.tags) && info.tags.length) {
      genres.push(...info.tags.map((t) => (typeof t === 'string' ? t : t?.title || String(t))))
    }

    return {
      id: String(info.albumId),
      title: info.albumTitle || '',
      author: info.anchorName || null,
      narrator: info.anchorName || null,
      description: description || null,
      cover: this.normalizeCover(info.cover),
      publishedYear: info.createDate ? info.createDate.split('-')[0] : null,
      genres: genres.length ? [...new Set(genres)] : null,
      albumId: String(info.albumId),
      asin: String(info.albumId),
      isbn: null,
      playCount: info.playCount || null,
      duration: null
    }
  }

  /**
   * 将搜索返回的单条专辑(docs 元素)映射为候选
   * @param {Object} doc
   * @returns {Object|null}
   */
  cleanSearchResult(doc) {
    if (!doc || !doc.id) return null
    let description = doc.intro || ''
    description = description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

    const genres = []
    if (doc.category_title) genres.push(doc.category_title)
    if (doc.tags) {
      genres.push(...String(doc.tags).split(/[,，、]/).map((t) => t.trim()).filter(Boolean))
    }

    let publishedYear = null
    if (doc.created_at) {
      publishedYear = String(new Date(doc.created_at).getFullYear())
    }

    return {
      id: String(doc.id),
      title: doc.title || '',
      author: doc.nickname || null,
      narrator: doc.nickname || null,
      description: description || null,
      cover: this.normalizeCover(doc.cover_path || doc.cover),
      publishedYear,
      genres: genres.length ? [...new Set(genres)] : null,
      albumId: String(doc.id),
      asin: String(doc.id),
      isbn: null,
      playCount: doc.play || null,
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
    const url = `https://www.ximalaya.com/revision/search?core=album&kw=${encodeURIComponent(keyword)}&page=${page}&rows=50&condition=relation&device=iPhone`
    const res = await axios
      .get(url, {
        timeout,
        headers: {
          'User-Agent': this.#userAgent,
          Referer: 'https://www.ximalaya.com/'
        }
      })
      .catch((error) => {
        Logger.error(`[Ximalaya] Search request error: ${error.message}`)
        return {}
      })

    if (res?.data?.ret !== 200) {
      Logger.warn(`[Ximalaya] Search failed: ret=${res?.data?.ret} msg=${res?.data?.msg}`)
      return { books: [], totalPages: 1 }
    }

    const response = res?.data?.data?.result?.response
    const docs = response?.docs
    if (!Array.isArray(docs)) return { books: [], totalPages: 1 }

    const totalPages = Math.max(1, Number(response?.totalPage) || 1)
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

    // 通道 1: albumId / 专辑 URL 精确匹配(详情更完整, 无分页)
    const albumId = this.extractAlbumId(title)
    if (albumId) {
      const data = await this.getAlbumData(albumId, timeout)
      return { books: data ? [data] : [], totalPages: 1 }
    }

    // 通道 2: 通用书名搜索
    if (!title) return { books: [], totalPages: 1 }
    return this.searchByKeyword(title, page, timeout)
  }

  /**
   * 按专辑 ID 拉取书籍数据(供未来/外部调用)
   * @param {string} albumId
   * @param {number} [timeout]
   * @returns {Promise<Object|null>}
   */
  async getBookDataByIdentifier(albumId, timeout = this.#responseTimeout) {
    return this.getAlbumData(albumId, timeout)
  }
}

module.exports = Ximalaya
