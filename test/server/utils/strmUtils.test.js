const { expect } = require('chai')
const fs = require('fs')
const os = require('os')
const Path = require('path')

const {
  isStrmPath,
  isUrl,
  readStrmTarget,
  getCloudDirectUrl,
  isCloudMountPath,
  isProbeSkippedPath
} = require('../../../server/utils/strmUtils')

describe('strmUtils', () => {
  let tmpDir

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(Path.join(os.tmpdir(), 'abs-strm-test-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  describe('isStrmPath', () => {
    it('identifies .strm extension case-insensitively', () => {
      expect(isStrmPath('book/track.strm')).to.be.true
      expect(isStrmPath('book/track.STRM')).to.be.true
      expect(isStrmPath('book/track.StRm')).to.be.true
      expect(isStrmPath('book/track.mp3')).to.be.false
      expect(isStrmPath(null)).to.be.false
      expect(isStrmPath('')).to.be.false
    })
  })

  describe('isUrl', () => {
    it('detects http and https URLs', () => {
      expect(isUrl('http://example.com/audio.mp3')).to.be.true
      expect(isUrl('https://example.com/audio.m4b?token=123')).to.be.true
      expect(isUrl('/local/path/audio.mp3')).to.be.false
      expect(isUrl('C:\\audio\\track.mp3')).to.be.false
      expect(isUrl(null)).to.be.false
    })
  })

  describe('readStrmTarget', () => {
    it('reads URL target from STRM file, ignoring comments and whitespace', async () => {
      const filePath = Path.join(tmpDir, 'test.strm')
      fs.writeFileSync(filePath, '# This is a comment\n// Another comment\n\n  https://cdn.example.com/stream/01.mp3  \n', 'utf8')

      const target = await readStrmTarget(filePath)
      expect(target).to.equal('https://cdn.example.com/stream/01.mp3')
    })

    it('resolves relative file path targets against the STRM directory', async () => {
      const filePath = Path.join(tmpDir, 'test.strm')
      fs.writeFileSync(filePath, '# comment\n../media/audio.m4b\n', 'utf8')

      const target = await readStrmTarget(filePath)
      const expected = Path.resolve(tmpDir, '../media/audio.m4b').replace(/\\/g, '/')
      expect(target).to.equal(expected)
    })

    it('throws error when STRM file has no valid target', async () => {
      const filePath = Path.join(tmpDir, 'empty.strm')
      fs.writeFileSync(filePath, '# only comments\n// nothing else\n\n', 'utf8')

      try {
        await readStrmTarget(filePath)
        expect.fail('Should have thrown error')
      } catch (err) {
        expect(err.message).to.include('does not contain a media target')
      }
    })
  })

  describe('getCloudDirectUrl and isCloudMountPath', () => {
    const originalEnv = process.env.STRM_DIRECT_URL_MAP

    afterEach(() => {
      if (originalEnv !== undefined) {
        process.env.STRM_DIRECT_URL_MAP = originalEnv
      } else {
        delete process.env.STRM_DIRECT_URL_MAP
      }
    })

    it('returns direct URL when path matches cloud direct URL map', () => {
      process.env.STRM_DIRECT_URL_MAP = '/CloudNAS=http://192.168.1.100:19798/dav,/mnt/drive=https://dav.cloud.com'

      expect(getCloudDirectUrl('/CloudNAS/Books/Book1/track.mp3')).to.equal('http://192.168.1.100:19798/dav/Books/Book1/track.mp3')
      expect(getCloudDirectUrl('/mnt/drive/audio.m4b')).to.equal('https://dav.cloud.com/audio.m4b')
      expect(getCloudDirectUrl('/local/storage/audio.mp3')).to.be.null

      expect(isCloudMountPath('/CloudNAS/Books/Book1/track.mp3')).to.be.true
      expect(isCloudMountPath('/local/storage/audio.mp3')).to.be.false
    })
  })

  describe('isProbeSkippedPath', () => {
    const originalEnv = process.env.STRM_SCAN_SKIP_PROBE_PATHS

    afterEach(() => {
      if (originalEnv !== undefined) {
        process.env.STRM_SCAN_SKIP_PROBE_PATHS = originalEnv
      } else {
        delete process.env.STRM_SCAN_SKIP_PROBE_PATHS
      }
    })

    it('matches default /CloudNAS prefix', () => {
      delete process.env.STRM_SCAN_SKIP_PROBE_PATHS
      expect(isProbeSkippedPath('/CloudNAS/Books/track.strm')).to.be.true
      expect(isProbeSkippedPath('/other/path/track.strm')).to.be.false
    })

    it('matches configured custom prefixes', () => {
      process.env.STRM_SCAN_SKIP_PROBE_PATHS = '/alist,/webdav'
      expect(isProbeSkippedPath('/alist/track.strm')).to.be.true
      expect(isProbeSkippedPath('/webdav/folder/track.strm')).to.be.true
      expect(isProbeSkippedPath('/CloudNAS/track.strm')).to.be.false
    })
  })
})
