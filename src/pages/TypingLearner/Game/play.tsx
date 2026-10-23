/**
 * 玩法路由分发（spec-20261019-v1 / 01 REQ-02）
 * `/typing/game/:gameId` → 对应玩法内页；非法 id 回中心页。
 */

import type React from 'react'
import { Navigate, useParams } from 'react-router-dom'
import MoyuGamePage from './moyu'
import ShootGamePage from './shoot'
import IdiomGamePage from './idiom'
import type { GameId } from '@/typings/typing'

const GAME_PAGES: Record<GameId, React.FC> = {
  moyu: MoyuGamePage,
  shoot: ShootGamePage,
  idiom: IdiomGamePage,
}

const GamePlayPage: React.FC = () => {
  const { gameId } = useParams<{ gameId: string }>()
  const Page = gameId && gameId in GAME_PAGES ? GAME_PAGES[gameId as GameId] : undefined
  if (!Page) return <Navigate to="/typing/game" replace />
  return <Page />
}

export default GamePlayPage
