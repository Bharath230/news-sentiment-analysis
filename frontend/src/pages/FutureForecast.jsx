import React, { useEffect, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import axios from 'axios'
import RiskForecastCharts from '../components/RiskForecastCharts'
import AnalysisProgress from '../components/AnalysisProgress'
import { useOutletContext } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'

const FutureForecast = () => {
    const { getToken, isLoaded, isSignedIn } = useAuth()
    const { userProfile } = useOutletContext()
    const [forecast, setForecast] = useState([])
    const [loading, setLoading] = useState(true)
    const { theme } = useTheme()
    const isDark = theme === 'dark'

    const [isAnalyzing, setIsAnalyzing] = useState(false)
    const [analysisStatus, setAnalysisStatus] = useState(null)
    const [refreshKey, setRefreshKey] = useState(0)

    const fetchData = async () => {
        try {
            const token = await getToken()
            if (!token) return

            const res = await axios.get('/api/forecast', {
                headers: { Authorization: `Bearer ${token}` }
            })
            setForecast(res.data)
        } catch (error) {
            console.error("Error fetching forecast:", error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (isLoaded && isSignedIn) {
            fetchData()
        }
    }, [isLoaded, isSignedIn])

    const triggerIngest = async () => {
        try {
            const token = await getToken()
            setIsAnalyzing(true)
            setAnalysisStatus({ state: 'running', message: 'Starting pipeline...', progress: 0 })

            await axios.post('/api/trigger-ingest', {}, { headers: { Authorization: `Bearer ${token}` } })

            const eventSource = new EventSource('/api/pipeline-progress')

            eventSource.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data)
                    setAnalysisStatus(data)

                    if (data.state === 'done' || data.state === 'error') {
                        eventSource.close()
                        setTimeout(() => {
                            setIsAnalyzing(false)
                            setAnalysisStatus(null)
                            if (data.state === 'done') {
                                fetchData()
                                setRefreshKey(k => k + 1)
                            }
                        }, 2000)
                    }
                } catch (err) {
                    console.error('SSE parse error:', err)
                }
            }

            eventSource.onerror = () => {
                eventSource.close()
                setAnalysisStatus({ state: 'error', message: 'Connection lost. Check backend logs.', progress: 0 })
                setTimeout(() => {
                    setIsAnalyzing(false)
                    setAnalysisStatus(null)
                }, 3000)
            }
        } catch (error) {
            setAnalysisStatus({ state: 'error', message: 'Failed to start analysis.', progress: 0 })
            setTimeout(() => {
                setIsAnalyzing(false)
                setAnalysisStatus(null)
            }, 3000)
        }
    }

    return (
        <>
            <div className="space-y-8 animate-in fade-in duration-500">
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-2">
                    <div>
                        <h2 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Future Risk Forecast</h2>
                        <p className="text-gray-500 dark:text-slate-400 mt-1">ARIMA predictions utilizing historical <span className="text-primary-600 dark:text-primary-400 font-medium">supply chain data</span>.</p>
                    </div>
                    <button
                        onClick={triggerIngest}
                        disabled={isAnalyzing}
                        className={`relative px-6 py-2.5 font-semibold rounded-xl transition-all duration-300 active:scale-95 overflow-hidden group/btn ${isAnalyzing
                            ? 'bg-gray-200 dark:bg-slate-800 text-gray-400 dark:text-slate-500 cursor-not-allowed border border-gray-300 dark:border-slate-700'
                            : 'bg-primary-600 hover:bg-primary-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)] border border-primary-500/50'
                            }`}
                    >
                        {!isAnalyzing && <div className="absolute inset-0 bg-gradient-to-r from-primary-400/0 via-white/20 to-primary-400/0 group-hover/btn:translate-x-full transition-transform duration-700 ease-out -translate-x-full"></div>}
                        <span className="relative flex items-center gap-2">
                            {isAnalyzing ? (
                                <>
                                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                    Running Pipeline...
                                </>
                            ) : (
                                <>
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    Run New Forecast
                                </>
                            )}
                        </span>
                    </button>
                </header>

                {loading ? (
                    <div className="flex justify-center items-center h-64">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500"></div>
                    </div>
                ) : (
                    <div className="space-y-8">
                        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-8 shadow-sm dark:shadow-lg relative">
                            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary-500/20 to-transparent" />

                            <h3 className="text-xl font-semibold mb-8 flex items-center gap-3 text-gray-900 dark:text-white">
                                <div className="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-500/10 flex items-center justify-center border border-primary-200 dark:border-primary-500/20">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary-600 dark:text-primary-500"><path d="M2 12h10" /><path d="M9 4v16" /><path d="m3 9 3 3-3 3" /><path d="M12 6 A8 8 0 0 1 20 12 A8 8 0 0 1 12 18" /></svg>
                                </div>
                                Next Predicted Intervals
                            </h3>
                            {forecast.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    {forecast.map((f, i) => (
                                        <div key={i} className="group bg-gray-50 dark:bg-slate-800/50 hover:bg-gray-100 dark:hover:bg-slate-800 p-6 rounded-2xl border border-gray-200 dark:border-slate-700/60 hover:border-primary-300 dark:hover:border-primary-500/30 flex flex-col items-center justify-center text-center transition-all duration-300 relative overflow-hidden">
                                            <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                            <span className="text-sm font-semibold text-primary-600 dark:text-primary-400 mb-3 bg-primary-100 dark:bg-primary-500/10 px-3 py-1 rounded-full">{new Date(f.Timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            <div className="flex items-baseline gap-1 relative z-10">
                                                <span className="text-5xl font-bold text-gray-900 dark:text-white tracking-tight">{f.Forecasted_Risk_Score.toFixed(3)}</span>
                                            </div>
                                            <span className="text-xs text-gray-500 dark:text-slate-400 mt-3 font-medium uppercase tracking-wider">Predicted Risk Score</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-16 text-center border border-dashed border-gray-300 dark:border-slate-700/60 rounded-2xl bg-gray-50 dark:bg-slate-800/30 flex flex-col items-center justify-center">
                                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 dark:bg-slate-800 rounded-full mb-6 ring-4 ring-gray-200 dark:ring-slate-800/50">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 dark:text-slate-500"><path d="M21.54 15H17a2 2 0 0 0-2 2v4.54" /><path d="M7 3.34V5a3 3 0 0 0 3 3v0a2 2 0 0 1 2 2v0c0 1.1.9 2 2 2v0a2 2 0 0 0 2-2v0c0-1.1.9-2 2-2h3.17" /><path d="M11 21.95V18a2 2 0 0 0-2-2v0a2 2 0 0 1-2-2v-1a2 2 0 0 0-2-2H2.05" /><circle cx="12" cy="12" r="10" /></svg>
                                    </div>
                                    <h3 className="text-xl font-semibold text-gray-600 dark:text-slate-300 mb-2">No forecast available</h3>
                                    <p className="text-gray-400 dark:text-slate-500 max-w-sm mx-auto">Run the pipeline to generate new risk predictions based on the latest news data.</p>
                                </div>
                            )}
                        </div>

                        <RiskForecastCharts getToken={getToken} refreshKey={refreshKey} />
                    </div>
                )}
            </div>

            {isAnalyzing && <AnalysisProgress status={analysisStatus} />}
        </>
    )
}

export default FutureForecast
