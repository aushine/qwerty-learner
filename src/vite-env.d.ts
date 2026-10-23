/// <reference types="vite/client" />
declare const REACT_APP_DEPLOY_ENV: string
declare const LATEST_COMMIT_HASH: string

/** Google Analytics gtag.js（index.html 注入；Vercel Analytics 之外的第二通道） */
interface Window {
  gtag?: (...args: unknown[]) => void
}
