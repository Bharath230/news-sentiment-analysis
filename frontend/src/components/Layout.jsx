import React, { useEffect, useState } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth, UserButton, useUser, SignOutButton } from '@clerk/clerk-react'
import axios from 'axios'
import { useTheme } from '../context/ThemeContext'

const Layout = () => {
    const { getToken, isLoaded, isSignedIn } = useAuth()
    const { user } = useUser()
    const navigate = useNavigate()
    const location = useLocation()
    const [profileLoading, setProfileLoading] = useState(true)
    const [userProfile, setUserProfile] = useState(null)
    const { theme, toggleTheme } = useTheme()

    useEffect(() => {
        const checkProfile = async () => {
            if (!isLoaded || !isSignedIn) return
            try {
                const token = await getToken()
                const res = await axios.get('/api/user-profile', {
                    headers: { Authorization: `Bearer ${token}` }
                })
                setUserProfile(res.data)
            } catch (err) {
                if (err.response && err.response.status === 404) {
                    if (location.pathname !== '/onboarding') {
                        navigate('/onboarding')
                    }
                } else {
                    console.error("Error fetching profile", err)
                }
            } finally {
                setProfileLoading(false)
            }
        }
        checkProfile()
    }, [isLoaded, isSignedIn, getToken, navigate, location.pathname])

    if (!isLoaded || profileLoading) {
        return (
            <div className="flex h-screen bg-gray-50 dark:bg-slate-950 items-center justify-center transition-colors">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
            </div>
        )
    }

    if (location.pathname === '/onboarding') {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-slate-100 font-sans selection:bg-primary-500/30 transition-colors">
                <Outlet />
            </div>
        )
    }

    const navItems = [
        {
            to: '/dashboard',
            label: 'Risk Trend',
            icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        },
        {
            to: '/digest',
            label: 'News Digest',
            icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        },
        {
            to: '/news',
            label: 'Domain News',
            icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
        },
        {
            to: '/impact',
            label: 'Impact Analytics',
            icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        },
        {
            to: '/globe',
            label: 'Global Risk Map',
            icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        },
        {
            to: '/forecast',
            label: 'Future Forecast',
            icon: <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></>
        },
        {
            to: '/onboarding',
            label: 'Update Profile',
            icon: <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></>
        },
    ]

    return (
        <div className="flex min-h-screen bg-gray-50 dark:bg-slate-950 font-sans text-gray-900 dark:text-slate-100 selection:bg-primary-500/30 transition-colors duration-300">
            {/* Sidebar Navigation */}
            <aside className="w-72 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-r border-gray-200/80 dark:border-slate-800/60 flex flex-col hidden md:flex relative">
                {/* Subtle gradient overlay on sidebar */}
                <div className="absolute inset-0 bg-gradient-to-b from-primary-500/[0.02] via-transparent to-blue-500/[0.02] pointer-events-none" />

                {/* Logo */}
                <div className="p-6 border-b border-gray-200/80 dark:border-slate-800/60 flex items-center gap-3 relative">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/25 animate-pulse-glow">
                        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    </div>
                    <div>
                        <h1 className="text-lg font-bold tracking-tight text-gray-900 dark:text-white leading-tight">
                            RiskMonitor
                        </h1>
                        <p className="text-[10px] text-gray-400 dark:text-slate-500 font-medium tracking-wider uppercase">Supply Chain AI</p>
                    </div>
                </div>

                {/* Company Info */}
                {userProfile && (
                    <div className="px-6 py-4 border-b border-gray-200/80 dark:border-slate-800/60 bg-gray-50/50 dark:bg-slate-900/30">
                        <p className="text-sm font-semibold text-gray-800 dark:text-slate-200 truncate">{userProfile.company_name}</p>
                        <p className="text-xs text-primary-600 dark:text-primary-400 mt-1 font-medium truncate">{userProfile.sc_component}</p>
                    </div>
                )}

                {/* Navigation */}
                <nav className="flex-1 p-4 space-y-1 relative">
                    {navItems.map(item => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            className={({ isActive }) =>
                                `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative ${isActive
                                    ? 'bg-primary-500/10 text-primary-700 dark:text-primary-400 font-semibold shadow-sm ring-1 ring-primary-500/20'
                                    : 'text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-900 hover:text-gray-800 dark:hover:text-slate-200'
                                }`
                            }>
                            {({ isActive }) => (
                                <>
                                    {isActive && (
                                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-primary-400 to-primary-600 rounded-r-full" />
                                    )}
                                    <svg className={`w-5 h-5 transition-colors ${isActive ? 'text-primary-500' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        {item.icon}
                                    </svg>
                                    <span className="text-sm">{item.label}</span>
                                </>
                            )}
                        </NavLink>
                    ))}
                </nav>

                {/* Footer: Theme Toggle + User */}
                <div className="p-4 border-t border-gray-200/80 dark:border-slate-800/60 space-y-3 relative">
                    {/* Theme Toggle */}
                    <button
                        id="theme-toggle"
                        onClick={toggleTheme}
                        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-900 hover:text-gray-800 dark:hover:text-slate-200 transition-all duration-200"
                        aria-label="Toggle theme"
                    >
                        {theme === 'dark' ? (
                            <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                            </svg>
                        ) : (
                            <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                            </svg>
                        )}
                        {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                    </button>

                    {/* User */}
                    <div className="flex items-center gap-3 px-4 py-2">
                        <UserButton
                            appearance={{
                                elements: {
                                    userButtonAvatarBox: "w-9 h-9 border-2 border-gray-200 dark:border-slate-700/50 shadow-sm"
                                }
                            }}
                        />
                        <span className="text-sm font-medium text-gray-700 dark:text-slate-300 truncate">
                            {user?.firstName || 'User'}
                        </span>
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col h-screen overflow-hidden">
                {/* Mobile Header */}
                <header className="md:hidden bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-gray-200/80 dark:border-slate-800/60 p-4 flex justify-between items-center z-10">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shadow-sm">
                            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        </div>
                        <h1 className="text-sm font-bold tracking-tight text-gray-900 dark:text-white">RiskMonitor</h1>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={toggleTheme} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors" aria-label="Toggle theme">
                            {theme === 'dark' ? (
                                <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                            ) : (
                                <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
                            )}
                        </button>
                        <UserButton />
                    </div>
                </header>

                {/* Content Wrapper */}
                <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-gray-50 dark:bg-slate-950 transition-colors">
                    <Outlet context={{ userProfile }} />
                </div>
            </main>
        </div>
    )
}

export default Layout
