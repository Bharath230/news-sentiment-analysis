import React, { useEffect, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import axios from 'axios'

const TONE_STYLES = {
    concerning: {
        icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
        ),
        accent: 'text-red-500 dark:text-red-400',
        bg: 'bg-red-50 dark:bg-red-500/5',
        border: 'border-red-200 dark:border-red-500/20',
        pill: 'bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-300',
        dot: 'bg-red-500 dark:bg-red-400',
        tagBg: 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/20',
    },
    positive: {
        icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
        ),
        accent: 'text-emerald-500 dark:text-emerald-400',
        bg: 'bg-emerald-50 dark:bg-emerald-500/5',
        border: 'border-emerald-200 dark:border-emerald-500/20',
        pill: 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
        dot: 'bg-emerald-500 dark:bg-emerald-400',
        tagBg: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/20',
    },
    mixed: {
        icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
        ),
        accent: 'text-amber-500 dark:text-amber-400',
        bg: 'bg-amber-50 dark:bg-amber-500/5',
        border: 'border-amber-200 dark:border-amber-500/20',
        pill: 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300',
        dot: 'bg-amber-500 dark:bg-amber-400',
        tagBg: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/20',
    },
}

const DigestCard = ({ digest }) => {
    const [expanded, setExpanded] = useState(false)
    const style = TONE_STYLES[digest.tone] || TONE_STYLES.mixed

    return (
        <div className={`rounded-2xl border ${style.border} ${style.bg} transition-all duration-300 hover:shadow-md`}>
            <div className="p-5">
                <div className="flex items-start gap-3">
                    <div className={`mt-0.5 ${style.accent} shrink-0`}>
                        {style.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">{digest.theme}</h3>
                            <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${style.pill}`}>
                                {digest.tone}
                            </span>
                        </div>

                        <p className="text-sm text-gray-600 dark:text-slate-300 mt-2 leading-relaxed">
                            {digest.summary}
                        </p>

                        <p className="text-xs text-gray-400 dark:text-slate-500 mt-2">
                            Based on <span className="text-gray-700 dark:text-slate-300 font-medium">{digest.article_count}</span> sources
                        </p>
                    </div>
                </div>

                {digest.related_areas.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-1.5">
                        {digest.related_areas.map((area, i) => (
                            <span key={i} className={`text-[11px] px-2.5 py-1 rounded-full border ${style.tagBg}`}>
                                {area}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {digest.key_developments.length > 0 && (
                <div className="border-t border-gray-200/60 dark:border-slate-700/30">
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="w-full px-5 py-3 flex items-center justify-between text-xs text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 transition-colors"
                    >
                        <span className="font-medium">Key Insights ({digest.key_developments.length})</span>
                        <svg className={`w-4 h-4 transform transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>

                    {expanded && (
                        <ul className="px-5 pb-4 space-y-2">
                            {digest.key_developments.map((dev, i) => (
                                <li key={i} className="flex gap-2.5 items-start">
                                    <span className={`w-1.5 h-1.5 rounded-full ${style.dot} mt-1.5 shrink-0`} />
                                    <span className="text-sm text-gray-600 dark:text-slate-300 leading-relaxed">{dev}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    )
}

const NewsDigest = () => {
    const { getToken, isLoaded, isSignedIn } = useAuth()
    const [digests, setDigests] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        const fetchData = async () => {
            if (!isLoaded || !isSignedIn) return
            try {
                const token = await getToken()
                if (!token) return
                const res = await axios.get('/api/news-digest', {
                    headers: { Authorization: `Bearer ${token}` }
                })
                setDigests(res.data)
            } catch (err) {
                console.error("Error fetching news digest:", err)
                setError("Failed to load news digest.")
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [isLoaded, isSignedIn])

    const concerning = digests.filter(d => d.tone === 'concerning').length
    const positive = digests.filter(d => d.tone === 'positive').length
    const mixed = digests.filter(d => d.tone === 'mixed').length

    return (
        <div className="space-y-6 h-full flex flex-col">
            <header className="shrink-0">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100">News Digest</h2>
                <p className="text-gray-500 dark:text-slate-400 mt-1">AI-powered analytical insights — synthesized from all collected news.</p>
            </header>

            {loading ? (
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
                </div>
            ) : error ? (
                <div className="text-red-500 dark:text-red-400 text-center py-12">{error}</div>
            ) : (
                <>
                    <div className="flex gap-4 items-center text-xs text-gray-500 dark:text-slate-400 shrink-0 flex-wrap">
                        <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-red-500 dark:bg-red-400" />
                            {concerning} concerning
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-amber-500 dark:bg-amber-400" />
                            {mixed} mixed
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                            {positive} positive
                        </span>
                        <span className="text-gray-300 dark:text-slate-600">•</span>
                        <span>{digests.length} themes identified</span>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-1 -mr-1">
                        <div className="space-y-4 pb-4">
                            {digests.map((digest, i) => (
                                <DigestCard key={digest.theme} digest={digest} />
                            ))}
                        </div>
                        {digests.length === 0 && (
                            <div className="text-center py-16 text-gray-400 dark:text-slate-500">
                                <p className="text-lg font-medium">No digest available</p>
                                <p className="text-sm mt-1">Run the news pipeline to collect data first.</p>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    )
}

export default NewsDigest
