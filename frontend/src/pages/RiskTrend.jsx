import React, { useEffect, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import axios from 'axios'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useOutletContext } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'

const RiskTrend = () => {
    const { getToken, isLoaded, isSignedIn } = useAuth()
    const { userProfile } = useOutletContext()
    const [riskData, setRiskData] = useState([])
    const [loading, setLoading] = useState(true)
    const { theme } = useTheme()
    const isDark = theme === 'dark'

    const [metrics, setMetrics] = useState({
        avgRisk: 0,
        highRiskCount: 0,
        dominantSentiment: 'Neutral',
        totalAnalyzed: 0
    })

    const fetchData = async () => {
        try {
            const token = await getToken()
            if (!token) return

            const riskRes = await axios.get('/api/risk-history', {
                headers: { Authorization: `Bearer ${token}` }
            })

            const history = riskRes.data.map(d => ({
                ...d,
                timestamp: new Date(d.timestamp).toLocaleString(),
                Risk: d.risk_score
            })).reverse()

            setRiskData(history)

            if (history.length > 0) {
                const totalRisk = history.reduce((sum, item) => sum + item.Risk, 0)
                const highRisk = history.filter(item => item.Risk > 0.7).length

                let negCount = 0; let posCount = 0
                history.forEach(item => {
                    if (item.prob_neg > 0.6) negCount++
                    else if (item.prob_pos > 0.6) posCount++
                })
                let sentiment = 'Neutral'
                if (negCount > posCount && negCount > history.length * 0.3) sentiment = 'Negative'
                else if (posCount > negCount && posCount > history.length * 0.3) sentiment = 'Positive'

                setMetrics({
                    avgRisk: (totalRisk / history.length).toFixed(2),
                    highRiskCount: highRisk,
                    dominantSentiment: sentiment,
                    totalAnalyzed: history.length
                })
            }
        } catch (error) {
            console.error("Error fetching data:", error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (isLoaded && isSignedIn) {
            fetchData()
        }
    }, [isLoaded, isSignedIn])

    const metricCards = [
        {
            label: 'Avg Risk Score',
            value: metrics.avgRisk,
            suffix: '/ 1.0',
            gradient: 'from-primary-500/10 to-primary-500/5',
            glow: 'bg-primary-500/10 dark:bg-primary-500/5',
            iconColor: 'text-primary-500',
            icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        },
        {
            label: 'Critical Alerts',
            value: metrics.highRiskCount,
            suffix: 'events > 0.7',
            gradient: 'from-red-500/10 to-red-500/5',
            glow: 'bg-red-500/10 dark:bg-red-500/5',
            iconColor: 'text-red-500',
            isAlert: metrics.highRiskCount > 5,
            icon: <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
        },
        {
            label: 'Recent Sentiment',
            value: metrics.dominantSentiment,
            isBadge: true,
            gradient: 'from-blue-500/10 to-blue-500/5',
            glow: 'bg-blue-500/10 dark:bg-blue-500/5',
            iconColor: 'text-blue-500',
            icon: <path strokeLinecap="round" strokeLinejoin="round" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        },
        {
            label: 'Articles Analyzed',
            value: metrics.totalAnalyzed,
            gradient: 'from-indigo-500/10 to-indigo-500/5',
            glow: 'bg-indigo-500/10 dark:bg-indigo-500/5',
            iconColor: 'text-indigo-500',
            icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        },
    ]

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <header>
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Domain Risk Trend</h2>
                <p className="text-gray-500 dark:text-slate-400 mt-1">
                    Real-time analysis filtered for <span className="text-primary-600 dark:text-primary-400 font-medium">{userProfile?.sc_component || 'your domain'}</span>.
                </p>
            </header>

            {/* Metric Cards */}
            {loading ? (
                <div className="flex justify-center items-center h-48">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500"></div>
                </div>
            ) : (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {metricCards.map((card, i) => (
                        <div key={i} className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md dark:shadow-lg relative overflow-hidden group hover:border-gray-300 dark:hover:border-slate-700 transition-all duration-300">
                            <div className={`absolute top-0 right-0 w-24 h-24 rounded-full blur-3xl -mr-12 -mt-12 transition-transform group-hover:scale-125 ${card.glow}`} />
                            <div className="flex items-center gap-3 mb-2 relative">
                                <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${card.gradient} flex items-center justify-center`}>
                                    <svg className={`w-4 h-4 ${card.iconColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>{card.icon}</svg>
                                </div>
                                <p className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">{card.label}</p>
                            </div>
                            <div className="relative">
                                {card.isBadge ? (
                                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold 
                                        ${metrics.dominantSentiment === 'Negative' ? 'bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-400 ring-1 ring-red-200 dark:ring-red-500/20' :
                                            metrics.dominantSentiment === 'Positive' ? 'bg-primary-100 dark:bg-primary-500/10 text-primary-700 dark:text-primary-400 ring-1 ring-primary-200 dark:ring-primary-500/20' :
                                                'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 ring-1 ring-gray-200 dark:ring-slate-700'}`}>
                                        {metrics.dominantSentiment}
                                    </span>
                                ) : (
                                    <div className="flex items-baseline gap-2">
                                        <h4 className={`text-2xl font-bold ${card.isAlert ? 'text-red-500 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>{card.value}</h4>
                                        {card.suffix && <span className="text-xs text-gray-400 dark:text-slate-500">{card.suffix}</span>}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Chart */}
            {!loading && (
                <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm dark:shadow-lg relative">
                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary-500/20 to-transparent" />

                    <div className="flex items-center justify-between mb-8">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary-500"><path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" /></svg>
                            Risk Over Time
                        </h3>
                        <div className="flex items-center gap-4 text-xs font-medium text-gray-400 dark:text-slate-400">
                            <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-primary-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                Overall Risk
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-gray-400 dark:bg-slate-500" />
                                Negative Tone
                            </div>
                        </div>
                    </div>

                    <div className="h-[400px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={riskData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1e293b' : '#f1f5f9'} vertical={false} />
                                <XAxis
                                    dataKey="timestamp"
                                    stroke={isDark ? '#475569' : '#94a3b8'}
                                    tick={{ fill: isDark ? '#64748b' : '#94a3b8', fontSize: 11 }}
                                    tickFormatter={(val) => new Date(val).toLocaleDateString()}
                                    axisLine={false}
                                    tickLine={false}
                                    dy={10}
                                />
                                <YAxis
                                    domain={[0, 1]}
                                    stroke={isDark ? '#475569' : '#94a3b8'}
                                    tick={{ fill: isDark ? '#64748b' : '#94a3b8', fontSize: 11 }}
                                    axisLine={false}
                                    tickLine={false}
                                    dx={-10}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: isDark ? '#0f172a' : '#ffffff',
                                        borderColor: isDark ? '#1e293b' : '#e2e8f0',
                                        color: isDark ? '#f8fafc' : '#1e293b',
                                        borderRadius: '0.75rem',
                                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                                    }}
                                    itemStyle={{ color: isDark ? '#f8fafc' : '#1e293b', fontSize: '12px' }}
                                    labelStyle={{ color: isDark ? '#94a3b8' : '#64748b', fontSize: '11px', marginBottom: '4px' }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="Risk"
                                    name="Overall Risk"
                                    stroke="#10b981"
                                    strokeWidth={3}
                                    dot={false}
                                    activeDot={{ r: 6, fill: '#10b981', stroke: isDark ? '#0f172a' : '#ffffff', strokeWidth: 2 }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="prob_neg"
                                    name="Negative Tone"
                                    stroke={isDark ? '#64748b' : '#94a3b8'}
                                    strokeWidth={2}
                                    strokeOpacity={0.6}
                                    dot={false}
                                    activeDot={false}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}
        </div>
    )
}

export default RiskTrend
