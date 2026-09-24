const THEME_STORAGE_KEY = 'abs-ui-theme'
const THEME_CLASS_PREFIX = 'theme-'
const THEMES = ['classic', 'nebula', 'obsidian', 'aurora', 'ember', 'porcelain']
const DEFAULT_THEME = 'nebula'
const THEME_LABELS = {
  classic: '原初 Classic',
  nebula: '星潮 Nebula',
  obsidian: '极夜 Obsidian',
  aurora: '晨雾 Aurora',
  ember: '余烬 Ember',
  porcelain: '雪境 Porcelain'
}

function normalizeTheme(theme) {
  return THEMES.includes(theme) ? theme : DEFAULT_THEME
}

function applyTheme(theme) {
  const normalizedTheme = normalizeTheme(theme)
  const target = document.body || document.documentElement

  THEMES.forEach((themeName) => target.classList.remove(`${THEME_CLASS_PREFIX}${themeName}`))
  target.classList.add(`${THEME_CLASS_PREFIX}${normalizedTheme}`)
  target.dataset.uiTheme = normalizedTheme

  return normalizedTheme
}

export default (_context, inject) => {
  const storedTheme = localStorage.getItem(THEME_STORAGE_KEY)
  const initialTheme = applyTheme(storedTheme)

  inject('uiTheme', {
    themes: THEMES,
    labels: THEME_LABELS,
    get() {
      return normalizeTheme(localStorage.getItem(THEME_STORAGE_KEY) || initialTheme)
    },
    getLabel(theme) {
      return THEME_LABELS[normalizeTheme(theme)]
    },
    set(theme) {
      const normalizedTheme = applyTheme(theme)
      localStorage.setItem(THEME_STORAGE_KEY, normalizedTheme)
      window.dispatchEvent(new CustomEvent('abs-ui-theme-change', { detail: { theme: normalizedTheme } }))
      return normalizedTheme
    }
  })
}
