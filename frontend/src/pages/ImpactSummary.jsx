import React, { useEffect, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import axios from 'axios'

const RISK_COLORS = {
    'High Risk': { bg: 'bg-red-50 dark:bg-red-500/10', border: 'border-red-200 dark:border-red-500/30', text: 'text-red-600 dark:text-red-400', bar: 'bg-red-500', badge: 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300 ring-red-200 dark:ring-red-500/30' },
    'Medium Risk': { bg: 'bg-amber-50 dark:bg-amber-500/10', border: 'border-amber-200 dark:border-amber-500/30', text: 'text-amber-600 dark:text-amber-400', bar: 'bg-amber-500', badge: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 ring-amber-200 dark:ring-amber-500/30' },
    'Low Risk': { bg: 'bg-emerald-50 dark:bg-emerald-500/10', border: 'border-emerald-200 dark:border-emerald-500/30', text: 'text-emerald-600 dark:text-emerald-400', bar: 'bg-emerald-500', badge: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-500/30' },
}

const SentimentBar = ({ neg, neu, pos }) => {
    const total = neg + neu + pos
    if (total === 0) return null
    const negPct = (neg / total) * 100
    const neuPct = (neu / total) * 100
    const posPct = (pos / total) * 100

    return (
        <div className="flex items-center gap-2 mt-2">
            <div className="flex-1 h-2 rounded-full overflow-hidden bg-gray-200 dark:bg-slate-800 flex">
                {negPct > 0 && <div className="bg-red-500 h-full transition-all" style={{ width: `${negPct}%` }} />}
                {neuPct > 0 && <div className="bg-gray-400 dark:bg-slate-500 h-full transition-all" style={{ width: `${neuPct}%` }} />}
                {posPct > 0 && <div className="bg-emerald-500 h-full transition-all" style={{ width: `${posPct}%` }} />}
            </div>
            <div className="flex gap-3 text-[10px] text-gray-500 dark:text-slate-400 shrink-0 font-mono">
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />{neg}</span>
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-slate-500 inline-block" />{neu}</span>
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />{pos}</span>
            </div>
        </div>
    )
}

const ImpactCard = ({ area, index }) => {
    const [expanded, setExpanded] = useState(false)
    const colors = RISK_COLORS[area.risk_level] || RISK_COLORS['Medium Risk']
    const riskPct = Math.min(area.avg_risk_score * 100, 100)

    return (
        <div className={`group rounded-2xl border ${colors.border} ${colors.bg} backdrop-blur-sm transition-all duration-300 hover:shadow-lg dark:hover:shadow-slate-900/50`}>
            <div className="p-5 pb-3">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-8 h-8 rounded-lg ${colors.bar} bg-opacity-20 flex items-center justify-center shrink-0 font-bold text-sm ${colors.text}`}>
                            {index + 1}
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100 truncate">{area.area}</h3>
                            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                                {area.article_count} article{area.article_count !== 1 ? 's' : ''} reporting
                            </p>
                        </div>
                    </div>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ring-1 ${colors.badge}`}>
                        {area.risk_level}
                    </span>
                </div>

                <div className="mt-4">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="text-gray-500 dark:text-slate-400 font-medium">Avg Risk Score</span>
                        <span className={`font-mono font-semibold ${colors.text}`}>{(area.avg_risk_score * 100).toFixed(1)}%</span>
                    </div>
                    <div className="h-2 bg-gray-200 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${colors.bar} transition-all duration-700 ease-out`} style={{ width: `${riskPct}%` }} />
                    </div>
                </div>

                <div className="mt-3">
                    <p className="text-[11px] text-gray-400 dark:text-slate-500 font-medium uppercase tracking-wider mb-1">Sentiment Breakdown</p>
                    <SentimentBar neg={area.neg_count} neu={area.neu_count} pos={area.pos_count} />
                </div>

                <div className="mt-3 flex items-center justify-between">
                    <span className="text-[11px] text-gray-400 dark:text-slate-500 font-medium uppercase tracking-wider">Impact Score</span>
                    <span className={`text-sm font-bold ${colors.text} font-mono`}>{area.impact_score.toFixed(1)}</span>
                </div>
            </div>

            <div className="border-t border-gray-200/60 dark:border-slate-700/40">
                <button
                    onClick={() => setExpanded(!expanded)}
                    className="w-full px-5 py-3 flex items-center justify-between text-xs text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 transition-colors"
                >
                    <span className="font-medium">Key Headlines ({area.top_headlines.length})</span>
                    <svg className={`w-4 h-4 transform transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>

                {expanded && (
                    <div className="px-5 pb-4 space-y-2.5 animate-in">
                        {area.top_headlines.map((h, i) => {
                            const hColors = RISK_COLORS[h.risk_level] || RISK_COLORS['Medium Risk']
                            return (
                                <div key={i} className="flex gap-3 items-start p-2.5 rounded-lg bg-gray-50 dark:bg-slate-800/50 border border-gray-200/50 dark:border-slate-700/30">
                                    <div className={`w-1.5 h-1.5 rounded-full ${hColors.bar} mt-1.5 shrink-0`} />
                                    <div className="min-w-0 flex-1">
                                        <p className="text-xs text-gray-700 dark:text-slate-200 leading-relaxed">{h.preview}</p>
                                        <div className="flex items-center gap-2 mt-1.5">
                                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${h.sentiment === 'Negative' ? 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-300' : h.sentiment === 'Positive' ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-300' : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300'}`}>
                                                {h.sentiment}
                                            </span>
                                            <span className="text-[10px] text-gray-400 dark:text-slate-500 font-mono">
                                                Risk: {(h.risk_score * 100).toFixed(1)}%
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}

const ImpactSummary = () => {
    const { getToken, isLoaded, isSignedIn } = useAuth()
    const [impactAreas, setImpactAreas] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        const fetchData = async () => {
            if (!isLoaded || !isSignedIn) return
            try {
                const token = await getToken()
                if (!token) return
                const res = await axios.get('/api/impact-summary', {
                    headers: { Authorization: `Bearer ${token}` }
                })
                setImpactAreas(res.data)
            } catch (err) {
                console.error("Error fetching impact summary:", err)
                setError("Failed to load impact summary.")
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [isLoaded, isSignedIn])

    const highRiskCount = impactAreas.filter(a => a.risk_level === 'High Risk').length
    const totalArticles = impactAreas.reduce((sum, a) => sum + a.article_count, 0)
    const mostImpacted = impactAreas.length > 0 ? impactAreas[0].area : '—'

    return (
        <div className="space-y-6 h-full flex flex-col">
            <header className="mb-2 shrink-0">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Impact Analytics</h2>
                <p className="text-gray-500 dark:text-slate-400 mt-1">Aggregated risk analysis of the most affected areas from all collected news.</p>
            </header>

            {loading ? (
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
                </div>
            ) : error ? (
                <div className="text-red-500 dark:text-red-400 text-center py-12">{error}</div>
            ) : (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 shrink-0">
                        <div className="bg-white dark:bg-slate-900/60 border border-gray-200 dark:border-slate-800/60 rounded-xl px-5 py-4 shadow-sm">
                            <p className="text-[11px] text-gray-400 dark:text-slate-500 uppercase tracking-wider font-medium">Most Impacted</p>
                            <p className="text-lg font-bold text-gray-900 dark:text-slate-100 mt-1 truncate">{mostImpacted}</p>
                        </div>
                        <div className="bg-white dark:bg-slate-900/60 border border-gray-200 dark:border-slate-800/60 rounded-xl px-5 py-4 shadow-sm">
                            <p className="text-[11px] text-gray-400 dark:text-slate-500 uppercase tracking-wider font-medium">High Risk Areas</p>
                            <p className="text-lg font-bold text-red-600 dark:text-red-400 mt-1">{highRiskCount}</p>
                        </div>
                        <div className="bg-white dark:bg-slate-900/60 border border-gray-200 dark:border-slate-800/60 rounded-xl px-5 py-4 shadow-sm">
                            <p className="text-[11px] text-gray-400 dark:text-slate-500 uppercase tracking-wider font-medium">Articles Analyzed</p>
                            <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-1">{totalArticles}</p>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-1 -mr-1">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pb-4">
                            {impactAreas.map((area, i) => (
                                <ImpactCard key={area.area} area={area} index={i} />
                            ))}
                        </div>
                        {impactAreas.length === 0 && (
                            <div className="text-center py-16 text-gray-400 dark:text-slate-500">
                                <p className="text-lg font-medium">No impact areas detected</p>
                                <p className="text-sm mt-1">Run the news pipeline to collect data first.</p>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    )
}

export default ImpactSummary
