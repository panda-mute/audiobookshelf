const LOGO_STORAGE_KEY = 'abs-ui-logo'
const LOGOS = ['classic', 'orbit', 'pulse', 'bamboo', 'cinder', 'paper']
const DEFAULT_LOGO = 'classic'
const LOGO_LABELS = {
  classic: '原版徽章',
  orbit: '星轨书声',
  pulse: '声波书架',
  bamboo: '竹简听书',
  cinder: '余烬剧场',
  paper: '纸页清音'
}

function normalizeLogo(logo) {
  return LOGOS.includes(logo) ? logo : DEFAULT_LOGO
}

export default ({ $config }, inject) => {
  inject('uiLogo', {
    logos: LOGOS,
    labels: LOGO_LABELS,
    get() {
      return normalizeLogo(localStorage.getItem(LOGO_STORAGE_KEY) || DEFAULT_LOGO)
    },
    getLabel(logo) {
      return LOGO_LABELS[normalizeLogo(logo)]
    },
    getSrc(logo) {
      const normalizedLogo = normalizeLogo(logo)
      return `${$config.routerBasePath}/brand/logo-${normalizedLogo}.svg`
    },
    set(logo) {
      const normalizedLogo = normalizeLogo(logo)
      localStorage.setItem(LOGO_STORAGE_KEY, normalizedLogo)
      window.dispatchEvent(new CustomEvent('abs-ui-logo-change', { detail: { logo: normalizedLogo } }))
      return normalizedLogo
    }
  })
}
