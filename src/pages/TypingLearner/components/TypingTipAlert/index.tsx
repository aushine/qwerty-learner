/**
 * TypingTipAlert —— 打字模式错误提示卡（spec-20261017-v1 / 02 §6）
 *
 * 文案替换理由（spec 原文）：打字训练的核心是纠错，而非记忆。
 * 🔴 不修改现有 TipAlert（REG-15 白名单），故在此平行实现，样式同源。
 */

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import type { FC } from 'react'
import { useCallback } from 'react'
import PhWarning from '~icons/ph/warning'

export type ITypingTipAlert = {
  className?: string
  show: boolean
  setShow: (show: boolean) => void
}

export const TypingTipAlert: FC<ITypingTipAlert> = ({ className, show, setShow }) => {
  const onClose = useCallback(() => {
    setShow(false)
  }, [setShow])

  return (
    <>
      {show && (
        <div className={`alert z-10 w-fit cursor-pointer pr-5 ${className}`} onClick={onClose}>
          <Alert variant="destructive" className="relative">
            <PhWarning className="h-4 w-4" />
            <AlertTitle>打错了。</AlertTitle>
            <AlertDescription>整题重新输入，别养成错的指法。</AlertDescription>
          </Alert>
        </div>
      )}
    </>
  )
}
