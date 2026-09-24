<template>
  <div ref="wrapper" :class="`rounded-${rounded}`" class="author-image-shell w-full h-full overflow-hidden">
    <div v-if="!imagePath" class="author-image-placeholder">
      <div class="author-image-glow author-image-glow-top" />
      <div class="author-image-glow author-image-glow-bottom" />
      <div class="author-image-bust-wrap">
        <svg class="author-image-bust" viewBox="0 0 240 240" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="120" cy="84" r="46" fill="currentColor" opacity="0.98" />
          <path d="M52 198C52 159.34 83.34 128 122 128H118C156.66 128 188 159.34 188 198V210H52V198Z" fill="currentColor" opacity="0.96" />
          <path
            d="M163.337 55.509C171.271 62.529 176.274 72.782 176.274 84.202C176.274 105.364 159.121 122.516 137.959 122.516C134.098 122.516 130.371 121.945 126.857 120.883C139.871 116.947 149.347 104.867 149.347 90.573C149.347 73.273 135.323 59.248 118.022 59.248C104.153 59.248 92.39 68.271 88.274 80.772C89.999 58.148 108.891 40.312 131.962 40.312C143.915 40.312 154.873 45.111 163.337 55.509Z"
            fill="currentColor"
            opacity="0.28"
          />
        </svg>
      </div>
      <div class="author-image-monogram">{{ placeholderInitial }}</div>
    </div>
    <div v-else class="w-full h-full relative">
      <div v-if="showCoverBg" class="cover-bg absolute" :style="{ backgroundImage: `url(${imgSrc})` }" />
      <img ref="img" :src="imgSrc" @load="imageLoaded" class="absolute top-0 left-0 h-full w-full" :class="coverContain ? 'object-contain' : 'object-cover'" />
    </div>
  </div>
</template>

<script>
export default {
  props: {
    author: {
      type: Object,
      default: () => {}
    },
    rounded: {
      type: String,
      default: 'lg'
    }
  },
  data() {
    return {
      showCoverBg: false,
      coverContain: true
    }
  },
  computed: {
    _author() {
      return this.author || {}
    },
    placeholderInitial() {
      const name = typeof this._author?.name === 'string' ? this._author.name.trim() : ''
      return name ? name.charAt(0).toUpperCase() : '作'
    },
    authorId() {
      return this._author.id
    },
    imagePath() {
      return this._author.imagePath
    },
    updatedAt() {
      return this._author.updatedAt
    },
    imgSrc() {
      if (!this.imagePath) return null
      return `${this.$config.routerBasePath}/api/authors/${this.authorId}/image?ts=${this.updatedAt}`
    }
  },
  methods: {
    imageLoaded() {
      if (this.$refs.img) {
        var { naturalWidth, naturalHeight } = this.$refs.img
        var imgAr = naturalHeight / naturalWidth
        if (imgAr < 0.5 || imgAr > 2) {
          this.showCoverBg = true
        } else {
          this.showCoverBg = false
          this.coverContain = false
        }
      }
    }
  },
  mounted() {}
}
</script>

<style>
.author-image-shell {
  background:
    radial-gradient(circle at top, rgba(255, 255, 255, 0.08), transparent 38%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(0, 0, 0, 0.1)),
    #171d2a;
}

.author-image-placeholder {
  position: relative;
  width: 100%;
  height: 100%;
  color: #d7d8de;
  overflow: hidden;
}

.author-image-glow {
  position: absolute;
  border-radius: 999px;
  pointer-events: none;
  filter: blur(12px);
}

.author-image-glow-top {
  width: 58%;
  height: 22%;
  top: 6%;
  left: 21%;
  background: rgba(255, 255, 255, 0.12);
}

.author-image-glow-bottom {
  width: 86%;
  height: 34%;
  bottom: -4%;
  left: 7%;
  background: rgba(122, 211, 255, 0.11);
}

.author-image-bust-wrap {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12% 10% 18%;
}

.author-image-bust {
  width: 100%;
  height: 100%;
  opacity: 0.96;
}

.author-image-monogram {
  position: absolute;
  right: 10%;
  bottom: 10%;
  width: 22%;
  height: 22%;
  min-width: 2.25rem;
  min-height: 2.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  font-size: 1.15rem;
  font-weight: 700;
  letter-spacing: 0;
  color: #f8fbff;
  background: linear-gradient(135deg, rgba(90, 146, 225, 0.96), rgba(79, 166, 126, 0.96));
  box-shadow: 0 12px 26px rgba(0, 0, 0, 0.22);
}

body[data-ui-theme='porcelain'] .author-image-shell,
body[data-ui-theme='snow'] .author-image-shell {
  background:
    radial-gradient(circle at top, rgba(255, 255, 255, 0.82), transparent 42%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(235, 240, 248, 0.92)),
    #edf2f8;
}

body[data-ui-theme='porcelain'] .author-image-placeholder,
body[data-ui-theme='snow'] .author-image-placeholder {
  color: #8f99ac;
}

body[data-ui-theme='porcelain'] .author-image-glow-top,
body[data-ui-theme='snow'] .author-image-glow-top {
  background: rgba(255, 255, 255, 0.92);
}

body[data-ui-theme='porcelain'] .author-image-glow-bottom,
body[data-ui-theme='snow'] .author-image-glow-bottom {
  background: rgba(115, 153, 206, 0.12);
}

body[data-ui-theme='porcelain'] .author-image-monogram,
body[data-ui-theme='snow'] .author-image-monogram {
  box-shadow: 0 14px 28px rgba(122, 143, 174, 0.22);
}
</style>
