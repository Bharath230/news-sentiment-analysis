import React from 'react'

const stageIcons = {
    fetching: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-4m0 0V8m0 4h4m-4 0H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
    ),
    processing: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3v2.25M14.25 3v2.25M9.75 18.75v2.25M14.25 18.75v2.25M3 9.75h2.25M3 14.25h2.25M18.75 9.75H21M18.75 14.25H21M7.5 7.5h9v9h-9z" />
        </svg>
    ),
    done: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
    ),
    error: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
    ),
}

const AnalysisProgress = ({ status }) => {
    if (!status) return null

    const { state, message, progress } = status
    const isDone = state === 'done'
    const isError = state === 'error'

    let icon = stageIcons.fetching
    if (progress > 35) icon = stageIcons.processing
    if (isDone) icon = stageIcons.done
    if (isError) icon = stageIcons.error

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center animate-in fade-in duration-300">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md" />

            {/* Card */}
            <div className="relative w-full max-w-md mx-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700/60 rounded-3xl shadow-2xl p-8 space-y-6 overflow-hidden">
                <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary-500/20 rounded-full blur-3xl"></div>
                <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-blue-500/20 rounded-full blur-3xl"></div>

                {/* Pulsing Icon */}
                <div className="flex justify-center relative z-10">
                    <div
                        className={`p-4 rounded-2xl shadow-inner ${isDone
                            ? 'bg-primary-100 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400 border border-primary-200 dark:border-primary-500/20'
                            : isError
                                ? 'bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20'
                                : 'bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20 animate-pulse'
                            }`}
                    >
                        {icon}
                    </div>
                </div>

                <div className="relative z-10">
                    <h2 className="text-center text-xl font-bold text-gray-900 dark:text-white tracking-tight mb-1">
                        {isDone ? 'Analysis Complete' : isError ? 'Analysis Failed' : 'Running Analysis...'}
                    </h2>
                    <p className="text-center text-gray-500 dark:text-slate-400 text-sm min-h-[20px] font-medium">
                        {message || 'Initializing...'}
                    </p>
                </div>

                {/* Progress Bar */}
                <div className="space-y-2 relative z-10 pt-2">
                    <div className="w-full h-3 bg-gray-200 dark:bg-slate-800 rounded-full overflow-hidden ring-1 ring-gray-200 dark:ring-slate-700/50 shadow-inner">
                        <div
                            className={`h-full rounded-full transition-all duration-500 ease-out relative overflow-hidden ${isDone
                                ? 'bg-primary-500'
                                : isError
                                    ? 'bg-red-500'
                                    : 'bg-gradient-to-r from-blue-500 via-indigo-500 to-primary-500'
                                }`}
                            style={{ width: `${progress}%` }}
                        >
                            {!isDone && !isError && (
                                <div className="absolute inset-0 bg-white/20 w-full animate-shimmer"></div>
                            )}
                        </div>
                    </div>
                    <div className="flex justify-between items-center text-xs font-mono font-medium">
                        <span className={isError ? 'text-red-500 dark:text-red-400' : 'text-gray-400 dark:text-slate-500'}>{isError ? 'Error occurred' : 'Processing...'}</span>
                        <span className={isDone ? 'text-primary-600 dark:text-primary-400' : 'text-gray-500 dark:text-slate-400'}>{progress}%</span>
                    </div>
                </div>

                {/* Stage Pills */}
                <div className="flex justify-center gap-2 flex-wrap relative z-10 pt-4 border-t border-gray-200 dark:border-slate-800/60 mt-4">
                    {['Fetch', 'Dedup', 'Sentiment', 'Tagging'].map((stage, i) => {
                        const thresholds = [5, 25, 35, 40]
                        const active = progress >= thresholds[i]
                        const current = i < 3 ? progress >= thresholds[i] && progress < thresholds[i + 1] : progress >= thresholds[i] && !isDone
                        return (
                            <span
                                key={stage}
                                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-300 flex items-center gap-1.5 ${current
                                    ? 'bg-indigo-100 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-200 dark:ring-indigo-500/30'
                                    : active
                                        ? 'bg-primary-100 dark:bg-primary-500/10 text-primary-700 dark:text-primary-400 ring-1 ring-primary-200 dark:ring-primary-500/20'
                                        : 'bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-slate-500 border border-gray-200 dark:border-slate-700'
                                    }`}
                            >
                                {active && !current ? (
                                    <svg className="w-3 h-3 text-primary-600 dark:text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                ) : current ? (
                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 dark:bg-indigo-400 animate-pulse"></div>
                                ) : null}
                                {stage}
                            </span>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

export default AnalysisProgress
