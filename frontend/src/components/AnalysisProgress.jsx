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

    // Pick icon based on progress phase
    let icon = stageIcons.fetching
    if (progress > 35) icon = stageIcons.processing
    if (isDone) icon = stageIcons.done
    if (isError) icon = stageIcons.error

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" />

            {/* Card */}
            <div className="relative w-full max-w-md mx-4 bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl p-8 space-y-6">
                {/* Pulsing Icon */}
                <div className="flex justify-center">
                    <div
                        className={`p-4 rounded-full ${isDone
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : isError
                                    ? 'bg-red-500/20 text-red-400'
                                    : 'bg-blue-500/20 text-blue-400 animate-pulse'
                            }`}
                    >
                        {icon}
                    </div>
                </div>

                {/* Title */}
                <h2 className="text-center text-xl font-semibold text-slate-100">
                    {isDone ? 'Analysis Complete' : isError ? 'Analysis Failed' : 'Running Analysis...'}
                </h2>

                {/* Status Message */}
                <p className="text-center text-slate-400 text-sm min-h-[20px]">
                    {message || 'Initializing...'}
                </p>

                {/* Progress Bar */}
                <div className="space-y-2">
                    <div className="w-full h-2.5 bg-slate-700 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-500 ease-out ${isDone
                                    ? 'bg-emerald-500'
                                    : isError
                                        ? 'bg-red-500'
                                        : 'bg-gradient-to-r from-blue-500 to-indigo-500'
                                }`}
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <p className="text-right text-xs text-slate-500 font-mono">{progress}%</p>
                </div>

                {/* Stage Pills */}
                <div className="flex justify-center gap-2 flex-wrap">
                    {['Fetch', 'Dedup', 'Sentiment', 'Tagging'].map((stage, i) => {
                        const thresholds = [5, 25, 35, 40]
                        const active = progress >= thresholds[i]
                        const current = i < 3 ? progress >= thresholds[i] && progress < thresholds[i + 1] : progress >= thresholds[i] && !isDone
                        return (
                            <span
                                key={stage}
                                className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-300 ${current
                                        ? 'bg-blue-500/30 text-blue-300 ring-1 ring-blue-500/50'
                                        : active
                                            ? 'bg-slate-600/50 text-slate-300'
                                            : 'bg-slate-700/50 text-slate-500'
                                    }`}
                            >
                                {active && !current ? '✓ ' : ''}{stage}
                            </span>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

export default AnalysisProgress
