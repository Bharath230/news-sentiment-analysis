import React, { useEffect, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import axios from 'axios'
import InteractiveGlobe from '../components/InteractiveGlobe'

const RISK_COLORS = {
    'High Risk': 'bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/25',
    'Medium Risk': 'bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/25',
    'Low Risk': 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/25',
}

const SENTIMENT_BADGE = {
    'Negative': 'bg-red-500/10 text-red-400 border-red-500/20',
    'Positive': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    'Neutral': 'bg-gray-500/10 text-gray-400 border-gray-500/20',
}

const GlobalRiskMap = () => {
    const { getToken, isLoaded, isSignedIn } = useAuth()
    const [countryData, setCountryData] = useState([])
    const [loading, setLoading] = useState(true)
    const [selectedCountry, setSelectedCountry] = useState(null)
    const [countryArticles, setCountryArticles] = useState([])
    const [articlesLoading, setArticlesLoading] = useState(false)

    useEffect(() => {
        const fetchData = async () => {
            if (!isLoaded || !isSignedIn) return
            try {
                const token = await getToken()
                if (!token) return
                const res = await axios.get('/api/country-risk-map', {
                    headers: { Authorization: `Bearer ${token}` }
                })
                setCountryData(res.data || [])
            } catch (err) {
                console.error("Error fetching country data:", err)
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [isLoaded, isSignedIn])

    const handleCountryClick = async (countryName) => {
        setSelectedCountry(countryName)
        setArticlesLoading(true)
        try {
            const token = await getToken()
            if (!token) return
            const res = await axios.get(`/api/country-articles/${encodeURIComponent(countryName)}`, {
                headers: { Authorization: `Bearer ${token}` }
            })
            setCountryArticles(res.data || [])
        } catch (err) {
            console.error("Error fetching country articles:", err)
            setCountryArticles([])
        } finally {
            setArticlesLoading(false)
        }
    }

    const highRisk = countryData.filter(d => d.risk_level === 'High Risk')
    const mediumRisk = countryData.filter(d => d.risk_level === 'Medium Risk')
    const lowRisk = countryData.filter(d => d.risk_level === 'Low Risk')

    return (
        <div className="h-full flex flex-col space-y-4 -m-4 md:-m-8">
            {/* Header bar */}
            <div className="px-4 md:px-8 pt-4 md:pt-8 pb-0 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        Global Risk Map
                    </h2>
                    <p className="text-gray-500 dark:text-slate-400 mt-1 ml-12">Click on a country to explore its news articles</p>
                </div>

                {/* Risk legend */}
                <div className="flex items-center gap-3 flex-wrap ml-12 md:ml-0">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-slate-400">
                        <div className="w-3 h-3 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                        High Risk ({highRisk.length})
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-slate-400">
                        <div className="w-3 h-3 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                        Medium ({mediumRisk.length})
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-slate-400">
                        <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                        Low ({lowRisk.length})
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex-1 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
                </div>
            ) : (
                <div className="flex-1 flex flex-col lg:flex-row gap-0 min-h-0">
                    {/* Globe */}
                    <div className="flex-1 relative bg-gray-950/5 dark:bg-slate-900/50 overflow-hidden min-h-[400px]">
                        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.05)_0%,transparent_70%)]" />
                        <InteractiveGlobe countryData={countryData} fullSize={true} onCountryClick={handleCountryClick} />
                    </div>

                    {/* Side panel */}
                    <div className="w-full lg:w-96 border-t lg:border-t-0 lg:border-l border-gray-200 dark:border-slate-800/60 bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm overflow-hidden flex flex-col">
                        {/* Panel header */}
                        <div className="px-5 py-4 border-b border-gray-200 dark:border-slate-800/60">
                            {selectedCountry ? (
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                            <span className="text-base">🌍</span> {selectedCountry}
                                        </h3>
                                        <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                                            {countryArticles.length} article{countryArticles.length !== 1 ? 's' : ''} found
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => { setSelectedCountry(null); setCountryArticles([]) }}
                                        className="text-xs text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300 px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                                    >
                                        ← All Countries
                                    </button>
                                </div>
                            ) : (
                                <div>
                                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Countries</h3>
                                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{countryData.length} countries detected</p>
                                </div>
                            )}
                        </div>

                        {/* Panel content */}
                        <div className="flex-1 overflow-y-auto">
                            {selectedCountry ? (
                                // Country articles view
                                articlesLoading ? (
                                    <div className="p-6 flex items-center justify-center">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
                                    </div>
                                ) : countryArticles.length === 0 ? (
                                    <div className="p-6 text-center text-gray-400 dark:text-slate-500 text-sm">
                                        <p>No articles found for {selectedCountry}.</p>
                                    </div>
                                ) : (
                                    <div className="p-3 space-y-2">
                                        {countryArticles.map((article, i) => {
                                            const sentStyle = SENTIMENT_BADGE[article.sentiment_label] || SENTIMENT_BADGE['Neutral']
                                            return (
                                                <div key={article.id || i} className="p-3 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-800/40 hover:bg-gray-100 dark:hover:bg-slate-800/60 transition-colors">
                                                    <p className="text-sm text-gray-800 dark:text-slate-200 leading-relaxed line-clamp-3">
                                                        {article.news_preview || article.news_full?.substring(0, 150)}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                                                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${sentStyle}`}>
                                                            {article.sentiment_label}
                                                        </span>
                                                        <span className="text-[10px] text-gray-400 dark:text-slate-500 font-mono">
                                                            Risk: {(article.risk_score * 100).toFixed(1)}%
                                                        </span>
                                                        {article.tags && (
                                                            <span className="text-[10px] text-gray-400 dark:text-slate-500 truncate max-w-[140px]">
                                                                {article.tags}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )
                            ) : (
                                // Countries list view
                                countryData.length === 0 ? (
                                    <div className="p-6 text-center text-gray-400 dark:text-slate-500 text-sm">
                                        <p>No country data yet.</p>
                                        <p className="text-xs mt-1">Run the analysis pipeline and backfill countries.</p>
                                    </div>
                                ) : (
                                    <div className="p-3 space-y-2">
                                        {countryData.map((item, i) => {
                                            const riskStyle = RISK_COLORS[item.risk_level] || RISK_COLORS['Medium Risk']
                                            return (
                                                <div
                                                    key={item.country}
                                                    onClick={() => handleCountryClick(item.country)}
                                                    className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-800/40 hover:bg-gray-100 dark:hover:bg-slate-800/60 transition-colors group cursor-pointer"
                                                >
                                                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 border ${riskStyle}`}>
                                                        {i + 1}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium text-gray-800 dark:text-slate-200 truncate group-hover:text-primary-500 transition-colors">
                                                            {item.country}
                                                        </p>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${riskStyle}`}>
                                                                {item.risk_level}
                                                            </span>
                                                            <span className="text-[10px] text-gray-400 dark:text-slate-500 font-mono">
                                                                {(item.avg_risk_score * 100).toFixed(1)}%
                                                            </span>
                                                        </div>
                                                        <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-1">
                                                            {item.article_count} article{item.article_count !== 1 ? 's' : ''} • Click to view →
                                                        </p>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default GlobalRiskMap
