import { useState } from 'react'
import { ApiError, verifyApiKey } from '../../services/api/client.js'
import { classifyApiError } from '../../services/api/errors.js'
import { setApiKey, useSettings } from '../../services/settings.js'
import { showToast } from '../base/toastState.js'
import { useTranslate } from '../../i18n/index.js'

/** 端点换过之后重新校验已保存的 Key 的结果 */
export type SavedApiKeyCheck = 'verified' | 'invalid' | 'unverified'

/**
 * 校验已保存的 Key：自定义端点通常不实现 GET /models，404 和网络错误只算「未校验」，
 * 只有服务端明确表示鉴权失败才算 Key 无效。
 */
export const checkSavedApiKey = async (): Promise<SavedApiKeyCheck> => {
  const apiKey = useSettings.getState().apiKey
  if (!apiKey) {
    return 'unverified'
  }
  try {
    await verifyApiKey(apiKey)
    return 'verified'
  } catch (error) {
    if (!(error instanceof ApiError) || error.status === 404) {
      return 'unverified'
    }
    const condition = classifyApiError(error)
    return condition === 'unauthorized' ? 'invalid' : 'unverified'
  }
}

/** 输入 API Key 后先用 GET /models 校验，通过才保存 */
export const useApiKeyForm = (onSaved?: () => void) => {
  const t = useTranslate()
  const [value, setValue] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [failure, setFailure] = useState<{ cause: unknown } | null>(null)
  const cause = failure?.cause
  const error =
    failure === null
      ? null
      : classifyApiError(cause) === 'unauthorized'
        ? t('apiKeyInvalid')
        : classifyApiError(cause) === 'network'
          ? t('commonNetworkErrorToast')
          : t('apiKeyVerificationFailed', {
              message:
                cause instanceof ApiError && cause.localMessage
                  ? t(cause.localMessage.key, cause.localMessage.params)
                  : cause instanceof Error
                    ? cause.message
                    : String(cause),
            })

  const submit = async () => {
    const apiKey = value.trim()
    if (!apiKey || verifying) {
      return
    }
    setVerifying(true)
    setFailure(null)
    try {
      await verifyApiKey(apiKey)
      setApiKey(apiKey)
      setValue('')
      onSaved?.()
    } catch (e) {
      // 自定义端点通常不实现 GET /models，404 时仍允许保存，但提示未校验
      if (e instanceof ApiError && e.status === 404) {
        setApiKey(apiKey)
        setValue('')
        onSaved?.()
        showToast({ key: 'apiKeyUnverifiedToast' })
        return
      }
      setFailure({ cause: e })
    } finally {
      setVerifying(false)
    }
  }

  return { value, setValue, verifying, error, submit }
}
