import ModeSwitcher from '@/components/ModeSwitcher'
import logo from '@/assets/logo.svg'
import type { PropsWithChildren } from 'react'
import type React from 'react'
import { NavLink } from 'react-router-dom'

const Header: React.FC<PropsWithChildren> = ({ children }) => {
  return (
    <header className="container z-20 mx-auto w-full px-10 py-6">
      <div className="flex w-full flex-col items-center justify-between space-y-3 lg:flex-row lg:space-y-0">
        <NavLink
          className="flex items-center text-2xl font-bold text-indigo-500 no-underline hover:no-underline lg:text-4xl"
          to="https://qwerty.kaiyi.cool/"
        >
          <img src={logo} className="mr-3 h-16 w-16" alt="Qwerty Learner Logo" />
          {/* 模式切换箭头：标题文字正下方居中，绝对定位由 py-6 内边距吸收，不增加页头高度（01 ENTRY-01/03） */}
          <div className="relative flex flex-col items-center">
            <h1>Qwerty Learner</h1>
            <ModeSwitcher />
          </div>
        </NavLink>
        <nav className="my-card on element flex w-auto content-center items-center justify-end space-x-3 rounded-xl bg-white p-4 transition-colors duration-300 dark:bg-gray-800">
          {children}
        </nav>
      </div>
    </header>
  )
}

export default Header
