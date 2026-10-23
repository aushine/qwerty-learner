import Loading from './components/Loading'
import './index.css'
import { ErrorBook } from './pages/ErrorBook'
import { FriendLinks } from './pages/FriendLinks'
import MobilePage from './pages/Mobile'
import TypingPage from './pages/Typing'
import { isOpenDarkModeAtom } from '@/store'
import { appModeAtom } from '@/store/typingMode'
import { Analytics } from '@vercel/analytics/react'
import 'animate.css'
import { useAtomValue } from 'jotai'
import mixpanel from 'mixpanel-browser'
import process from 'process'
import React, { Suspense, lazy, useEffect, useState } from 'react'
import 'react-app-polyfill/stable'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'

const AnalysisPage = lazy(() => import('./pages/Analysis'))
const GalleryPage = lazy(() => import('./pages/Gallery-N'))
const TypingLearnerPage = lazy(() => import('./pages/TypingLearner'))
const TypingGalleryPage = lazy(() => import('./pages/TypingLearner/Gallery'))
const GameCenterPage = lazy(() => import('./pages/TypingLearner/Game'))
const GamePlayPage = lazy(() => import('./pages/TypingLearner/Game/play'))

/** 路径去 basename 正则（与 BrowserRouter 的 basename 保持同源，ENTRY2-09-1；navigate 自带 basename，无需手拼） */
const BASENAME_RE = REACT_APP_DEPLOY_ENV === 'pages' ? /^\/qwerty-learner/ : /^$/
/** 模式落地重定向只做一次（ENTRY2-09-1：之后手动访问 '/' 不得被弹回） */
let hasRestoredMode = false

/**
 * ENTRY2-09-1：首次挂载时按上次的模式落地（模式选择存浏览器缓存，重开不用重新切）。
 * 仅在 pathname === '/' 时生效一次；用户之后手动访问 '/' 不再被弹走（hasRestoredMode）。
 *
 * ⚠️ 必须走 router 的 navigate（replace），不能用 window.history.replaceState：
 * 后者绕过 React Router 的 history 监听，URL 虽变为 /typing 但路由不重渲染，
 * 页面仍停留在学习模式（2026-10-21 实测复现，用户报「切换后重开不在打字模式」）。
 */
function ModeRestorer() {
  const navigate = useNavigate()
  const location = useLocation()
  const appMode = useAtomValue(appModeAtom)

  useEffect(() => {
    if (hasRestoredMode) return
    hasRestoredMode = true
    if (appMode === 'typing' && location.pathname.replace(BASENAME_RE, '') === '/') {
      navigate('/typing', { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}

if (process.env.NODE_ENV === 'production') {
  // for prod
  mixpanel.init('bdc492847e9340eeebd53cc35f321691')
} else {
  // for dev
  mixpanel.init('5474177127e4767124c123b2d7846e2a', { debug: true })
}

function Root() {
  const darkMode = useAtomValue(isOpenDarkModeAtom)
  useEffect(() => {
    darkMode ? document.documentElement.classList.add('dark') : document.documentElement.classList.remove('dark')
  }, [darkMode])

  // ENTRY2-09-1：首次挂载时按上次的模式落地（见 ModeRestorer；模式选择存浏览器缓存，重开不用重新切）。
  // 仅在 pathname === '/' 时生效一次；用户之后手动访问 '/' 不再被弹走（hasRestoredMode）。

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 600)

  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth <= 600
      setIsMobile(isMobile)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return (
    <React.StrictMode>
      <BrowserRouter basename={REACT_APP_DEPLOY_ENV === 'pages' ? '/qwerty-learner' : ''}>
        {/* ENTRY2-09-1：按上次的模式落地（必须在 Router 内，才能用 navigate 重渲染路由） */}
        <ModeRestorer />
        <Suspense fallback={<Loading />}>
          <Routes>
            {isMobile ? (
              <>
                <Route path="/*" element={<Navigate to="/mobile" />} />
                <Route path="/mobile" element={<MobilePage />} />
              </>
            ) : (
              <>
                <Route index element={<TypingPage />} />
                <Route path="/gallery" element={<GalleryPage />} />
                <Route path="/analysis" element={<AnalysisPage />} />
                <Route path="/error-book" element={<ErrorBook />} />
                <Route path="/friend-links" element={<FriendLinks />} />
                {/* 打字模式（新增，MODE-02）：相对 path，不硬编码 basename */}
                <Route path="/typing" element={<TypingLearnerPage />} />
                <Route path="/typing/gallery" element={<TypingGalleryPage />} />
                {/* 打字游戏模块（spec-20261019-v1）：游戏中心 + 三玩法 */}
                <Route path="/typing/game" element={<GameCenterPage />} />
                <Route path="/typing/game/:gameId" element={<GamePlayPage />} />
                <Route path="/*" element={<Navigate to="/" />} />
              </>
            )}
          </Routes>
        </Suspense>
      </BrowserRouter>
      {/* Vercel Analytics 只在 GitHub Pages 官方部署加载；自托管/子路径部署下
          写死从站点根拉 /_vercel/insights/script.js 必然 404，且非 Vercel 主机本就无法工作 */}
      {REACT_APP_DEPLOY_ENV === 'pages' && <Analytics />}
    </React.StrictMode>
  )
}

const container = document.getElementById('root')

container && createRoot(container).render(<Root />)
