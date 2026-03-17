import React, { useEffect, useState } from 'react'
import axios from 'axios'
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, ComposedChart, Bar, Legend
} from 'recharts'
import { useTheme } from '../context/ThemeContext'

const ChartCard = ({ title, icon, children }) => (
    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm dark:shadow-lg relative">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary-500/20 to-transparent"></div>
        <h3 className="text-lg font-semibold mb-6 flex items-center gap-2 text-gray-900 dark:text-white">
            {icon}
            {title}
        </h3>
        <div className="h-[320px] w-full">
            {children}
        </div>
    </div>
)

const chartIcon = (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary-500">
        <path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" />
    </svg>
)

const formatTime = (val) => {
    try {
        const d = new Date(val)
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } catch { return val }
}

const formatDate = (val) => {
    try {
        const d = new Date(val)
        return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + '\n' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } catch { return val }
}

const RiskForecastCharts = ({ getToken, refreshKey }) => {
    const [chartData, setChartData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(false)
    const { theme } = useTheme()
    const isDark = theme === 'dark'

    const tooltipStyle = {
        backgroundColor: isDark ? '#0f172a' : '#ffffff',
        borderColor: isDark ? '#1e293b' : '#e2e8f0',
        color: isDark ? '#f8fafc' : '#1e293b',
        borderRadius: '0.75rem',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
    }

    useEffect(() => {
        const fetchChartData = async () => {
            try {
                const token = await getToken()
                if (!token) return

                const res = await axios.get('/api/forecast-chart-data', {
                    headers: { Authorization: `Bearer ${token}` }
                })
                setChartData(res.data)
                setError(false)
            } catch (err) {
                console.error('Error fetching chart data:', err)
                setError(true)
            } finally {
                setLoading(false)
            }
        }

        fetchChartData()
    }, [getToken, refreshKey])

    if (loading) {
        return (
            <div className="space-y-6">
                {[1, 2, 3].map(i => (
                    <div key={i} className="h-[400px] w-full rounded-2xl bg-gray-100 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 animate-pulse" />
                ))}
            </div>
        )
    }

    if (error || !chartData || !chartData.historical?.length) {
        return (
            <div className="space-y-6">
                <div className="p-12 text-center border border-dashed border-gray-300 dark:border-slate-700 rounded-2xl bg-gray-50 dark:bg-slate-900">
                    <p className="text-gray-400 dark:text-slate-400">
                        Chart data not available yet. Run the analysis to generate forecast data.
                    </p>
                </div>
            </div>
        )
    }

    const { historical, forecast } = chartData

    const riskChartData = [
        ...historical.map(d => ({
            timestamp: d.Timestamp,
            risk_score: d.Risk_Score,
            forecasted: null
        })),
        ...(forecast.length > 0 && historical.length > 0 ? [{
            timestamp: historical[historical.length - 1].Timestamp,
            risk_score: historical[historical.length - 1].Risk_Score,
            forecasted: historical[historical.length - 1].Risk_Score
        }] : []),
        ...forecast.map(d => ({
            timestamp: d.Timestamp,
            risk_score: null,
            forecasted: d.Forecasted_Risk_Score
        }))
    ]

    const gridStroke = isDark ? '#1e293b' : '#f1f5f9'
    const axisStroke = isDark ? '#475569' : '#94a3b8'
    const tickFill = isDark ? '#64748b' : '#94a3b8'

    return (
        <div className="space-y-6">
            <ChartCard title="Supply Chain Risk Forecast" icon={chartIcon}>
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={riskChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                        <XAxis dataKey="timestamp" stroke={axisStroke} tick={{ fill: tickFill, fontSize: 11 }} tickFormatter={formatTime} axisLine={false} tickLine={false} dy={10} />
                        <YAxis domain={[0, 1]} stroke={axisStroke} tick={{ fill: tickFill, fontSize: 11 }} axisLine={false} tickLine={false} dx={-10} />
                        <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: isDark ? '#f8fafc' : '#1e293b', fontSize: '12px' }} labelStyle={{ color: isDark ? '#94a3b8' : '#64748b', fontSize: '11px', marginBottom: '4px' }} labelFormatter={formatDate} />
                        <Line type="monotone" dataKey="risk_score" name="Historical Risk" stroke="#60a5fa" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: '#60a5fa', stroke: isDark ? '#0f172a' : '#ffffff', strokeWidth: 2 }} connectNulls={false} />
                        <Line type="monotone" dataKey="forecasted" name="Forecast" stroke="#ef4444" strokeWidth={3} strokeDasharray="8 4" dot={false} activeDot={{ r: 6, fill: '#ef4444', stroke: isDark ? '#0f172a' : '#ffffff', strokeWidth: 2 }} connectNulls={false} />
                    </LineChart>
                </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Negative Sentiment Intensity" icon={chartIcon}>
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={historical} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                        <XAxis dataKey="Timestamp" stroke={axisStroke} tick={{ fill: tickFill, fontSize: 11 }} tickFormatter={formatTime} axisLine={false} tickLine={false} dy={10} />
                        <YAxis stroke={axisStroke} tick={{ fill: tickFill, fontSize: 11 }} axisLine={false} tickLine={false} dx={-10} />
                        <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: isDark ? '#f8fafc' : '#1e293b', fontSize: '12px' }} labelStyle={{ color: isDark ? '#94a3b8' : '#64748b', fontSize: '11px', marginBottom: '4px' }} labelFormatter={formatDate} />
                        <Line type="monotone" dataKey="Prob_Neg" name="Avg Negative Probability" stroke="#f59e0b" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: '#f59e0b', stroke: isDark ? '#0f172a' : '#ffffff', strokeWidth: 2 }} />
                    </LineChart>
                </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="News Volume & Keyword Buzz" icon={chartIcon}>
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={historical} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                        <XAxis dataKey="Timestamp" stroke={axisStroke} tick={{ fill: tickFill, fontSize: 11 }} tickFormatter={formatTime} axisLine={false} tickLine={false} dy={10} />
                        <YAxis yAxisId="left" stroke={axisStroke} tick={{ fill: '#818cf8', fontSize: 11 }} axisLine={false} tickLine={false} dx={-10} label={{ value: 'Articles', angle: -90, position: 'insideLeft', fill: '#818cf8', fontSize: 12 }} />
                        <YAxis yAxisId="right" orientation="right" stroke={axisStroke} tick={{ fill: '#34d399', fontSize: 11 }} axisLine={false} tickLine={false} dx={10} label={{ value: 'Keywords', angle: 90, position: 'insideRight', fill: '#34d399', fontSize: 12 }} />
                        <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: isDark ? '#f8fafc' : '#1e293b', fontSize: '12px' }} labelStyle={{ color: isDark ? '#94a3b8' : '#64748b', fontSize: '11px', marginBottom: '4px' }} labelFormatter={formatDate} />
                        <Legend wrapperStyle={{ paddingTop: '10px' }} formatter={(value) => <span style={{ color: isDark ? '#94a3b8' : '#64748b', fontSize: '12px' }}>{value}</span>} />
                        <Bar yAxisId="left" dataKey="Article_Count" name="Total Articles" fill="#818cf8" opacity={0.4} radius={[4, 4, 0, 0]} />
                        <Line yAxisId="right" type="monotone" dataKey="Keyword_Count" name="Supply Chain Keywords" stroke="#34d399" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: '#34d399', stroke: isDark ? '#0f172a' : '#ffffff', strokeWidth: 2 }} />
                    </ComposedChart>
                </ResponsiveContainer>
            </ChartCard>
        </div>
    )
}

export default RiskForecastCharts
