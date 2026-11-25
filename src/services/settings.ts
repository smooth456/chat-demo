import { create } from 'zustand'
import type { TtsVoice } from './api/speech.js'
import { normalizeLocation, type UserLocation } from './location.js'

export type Locale = 'zh-CN' | 'en-US'

/** 主题偏好；默认跟随系统 */
export type ThemePreference = 'light' | 'dark' | 'system'

/** 本机设置，存 localStorage：API Key、语言、主题、位置、朗读音色、深度思考与智能搜索开关、侧边栏收起状态 */
type Settings = {
  apiKey: string | null
  locale: Locale
  themePreference: ThemePreference
  location: UserLocation | null
  ttsVoice: TtsVoice
  /** 接口地址（不含 /anthropic/v1），留空回落到构建期默认值 */
  apiOrigin: string
  /** 默认模型名 */
  model: string
  thinking: boolean
  search: boolean
  siderCollapsed: boolean
}

const KEYS = {
  apiKey: 'chat-demo:api-key',
  apiOrigin: 'chat-demo:api-origin',
  model: 'chat-demo:model',
  locale: 'chat-demo:locale',
  location: 'chat-demo:location',
  themePreference: 'chat-demo:theme-preference',
  ttsVoice: 'chat-demo:tts-voice',
  thinking: 'chat-demo:thinking',
  search: 'chat-demo:search',
  siderCollapsed: 'chat-demo:sider-collapsed',
} as const

const read = (key: string) => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

const write = (key: string, value: string | null) => {
  try {
    if (value === null) {
      localStorage.removeItem(key)
    } else {
      localStorage.setItem(key, value)
    }
  } catch {
    // 存储不可用时只在内存中生效
  }
}

/** 位置选择模式跟随浏览器语言，与应用内选择的界面语言无关。 */
export const isChineseBrowser = (): boolean =>
  (typeof navigator === 'undefined' ? 'zh' : navigator.language).toLowerCase().startsWith('zh')

const initialLocale = (): Locale => {
  const saved = read(KEYS.locale)
  if (saved === 'zh-CN' || saved === 'en-US') {
    return saved
  }
  return isChineseBrowser() ? 'zh-CN' : 'en-US'
}

const initialLocation = (): UserLocation | null => {
  try {
    const location = normalizeLocation(JSON.parse(read(KEYS.location) ?? 'null'))
    if (!location) {
      return null
    }
    return isChineseBrowser()
      ? location.region === 'CN' && location.province
        ? location
        : null
      : { region: location.region }
  } catch {
    return null
  }
}

/** 未保存过时跟随系统 */
const initialThemePreference = (): ThemePreference => {
  const saved = read(KEYS.themePreference)
  return saved === 'light' || saved === 'dark' ? saved : 'system'
}

/** 未保存过时使用服务端默认音色 stella（海星） */
const initialTtsVoice = (): TtsVoice => (read(KEYS.ttsVoice) === 'tide' ? 'tide' : 'stella')

/** 构建期默认接口地址，运行时可在设置里覆盖 */
export const DEFAULT_API_ORIGIN = __API_ORIGIN__
/** 默认模型 */
export const DEFAULT_MODEL = 'deepseek-flash'

/**
 * 规范化用户填写的接口地址：去掉末尾斜杠、去掉误带的 /anthropic/v1，
 * 没写协议时按 https 补齐；留空回落到构建期默认值。
 */
export const normalizeApiOrigin = (value: string): string => {
  const base = value
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/anthropic\/v1$/i, '')
    .replace(/\/+$/, '')
  if (!base) {
    return DEFAULT_API_ORIGIN
  }
  return /^[a-z][a-z\d+.-]*:\/\//i.test(base) ? base : `https://${base}`
}

/** 规范化后是否为可用的 HTTP(S) 地址，供设置页输入校验；留空算合法（回落到默认值） */
export const isValidApiOrigin = (value: string): boolean => {
  const normalized = normalizeApiOrigin(value)
  // 只填了协议（如 "https://"）时 URL 也能解析出主机，单独挡掉
  if (normalized.endsWith(':')) {
    return false
  }
  try {
    const { protocol } = new URL(normalized)
    return protocol === 'https:' || protocol === 'http:'
  } catch {
    return false
  }
}

const initialApiOrigin = (): string => normalizeApiOrigin(read(KEYS.apiOrigin) ?? '')

const initialModel = (): string => (read(KEYS.model) ?? '').trim() || DEFAULT_MODEL

export const useSettings = create<Settings>(() => ({
  apiKey: read(KEYS.apiKey),
  apiOrigin: initialApiOrigin(),
  model: initialModel(),
  locale: initialLocale(),
  location: initialLocation(),
  themePreference: initialThemePreference(),
  ttsVoice: initialTtsVoice(),
  thinking: read(KEYS.thinking) === 'true',
  search: read(KEYS.search) === 'true',
  siderCollapsed: read(KEYS.siderCollapsed) === 'true',
}))

export const setLocale = (locale: Locale) => {
  write(KEYS.locale, locale)
  useSettings.setState({ locale })
}

export const setLocation = (value: UserLocation | null) => {
  const location = normalizeLocation(value)
  write(KEYS.location, location ? JSON.stringify(location) : null)
  useSettings.setState({ location })
}

export const setThemePreference = (themePreference: ThemePreference) => {
  write(KEYS.themePreference, themePreference)
  useSettings.setState({ themePreference })
}

export const setTtsVoice = (ttsVoice: TtsVoice) => {
  write(KEYS.ttsVoice, ttsVoice)
  useSettings.setState({ ttsVoice })
}

export const setApiKey = (apiKey: string | null) => {
  write(KEYS.apiKey, apiKey)
  useSettings.setState({ apiKey })
}

export const setApiOrigin = (apiOrigin: string) => {
  const next = normalizeApiOrigin(apiOrigin)
  write(KEYS.apiOrigin, next)
  useSettings.setState({ apiOrigin: next })
}

export const setModel = (model: string) => {
  const next = model.trim() || DEFAULT_MODEL
  write(KEYS.model, next)
  useSettings.setState({ model: next })
}

export const setThinking = (thinking: boolean) => {
  write(KEYS.thinking, String(thinking))
  useSettings.setState({ thinking })
}

export const setSearch = (search: boolean) => {
  write(KEYS.search, String(search))
  useSettings.setState({ search })
}

export const setSiderCollapsed = (siderCollapsed: boolean) => {
  write(KEYS.siderCollapsed, String(siderCollapsed))
  useSettings.setState({ siderCollapsed })
}
