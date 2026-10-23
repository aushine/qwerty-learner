import { track } from '@vercel/analytics'

export const trackPromotionEvent = (event: string, properties: Record<string, string>) => {
  track(event, properties)

  // window.gtag 由 index.html 的 gtag.js 注入（类型声明见 vite-env.d.ts）
  if (typeof window !== 'undefined' && window?.gtag) {
    try {
      window.gtag('event', event, { ...properties })
      if (properties.action_detail) {
        window.gtag('event', properties.action_detail)
      }
    } catch (error) {
      console.error(error)
    }
  }
}
