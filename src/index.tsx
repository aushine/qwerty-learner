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
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

const AnalysisPage = lazy(() => import('./pages/Analysis'))
const GalleryPage = lazy(() => import('./pages/Gallery-N'))
const TypingLearnerPage = lazy(() => import('./pages/TypingLearner'))
const TypingGalleryPage = lazy(() => import('./pages/TypingLearner/Gallery'))

/** 部署 basename（与 BrowserRouter 的 basename 保持同源，ENTRY2-09-1） */
const BASENAME = REACT_APP_DEPLOY_ENV === 'pages' ? '/qwerty-learner' : ''
const BASENAME_RE = REACT_APP_DEPLOY_ENV === 'pages' ? /^\/qwerty-learner/ : /^$/
/** 模式落地重定向只做一次（ENTRY2-09-1：之后手动访问 '/' 不得被弹回） */
let hasRestoredMode = false

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

  // ENTRY2-09-1：首次挂载时按上次的模式落地（模式选择存浏览器缓存，重开不用重新切）。
  // 仅在 pathname === '/' 时生效一次；用户之后手动访问 '/' 不再被弹走（hasRestoredMode）。
  const appMode = useAtomValue(appModeAtom)
  useEffect(() => {
    if (hasRestoredMode) return
    hasRestoredMode = true
    if (appMode === 'typing' && window.location.pathname.replace(BASENAME_RE, '') === '/') {
      window.history.replaceState(null, '', `${BASENAME}typing`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 600)

  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth <= 600
      if (!isMobile) {
        window.location.href = '/'
      }
      setIsMobile(isMobile)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return (
    <React.StrictMode>
      <BrowserRouter basename={REACT_APP_DEPLOY_ENV === 'pages' ? '/qwerty-learner' : ''}>
        <Suspense fallback={<Loading />}>
          <Routes>
            {isMobile ? (
              <Route path="/*" element={<Navigate to="/mobile" />} />
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
                <Route path="/*" element={<Navigate to="/" />} />
              </>
            )}
            <Route path="/mobile" element={<MobilePage />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
      <Analytics />
    </React.StrictMode>
  )
}

const container = document.getElementById('root')

container && createRoot(container).render(<Root />)
