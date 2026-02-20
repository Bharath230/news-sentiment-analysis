import React, { useEffect, useState, useMemo } from 'react'
import { useAuth, UserButton, useUser } from '@clerk/clerk-react'
import axios from 'axios'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import NewsFeed from '../components/NewsFeed'
import TagPreferences from '../components/TagPreferences'
import AnalysisProgress from '../components/AnalysisProgress'
import RiskForecastCharts from '../components/RiskForecastCharts'

const Dashboard = () => {
  const { getToken, isLoaded, isSignedIn } = useAuth()
  const { user } = useUser()
  const [riskData, setRiskData] = useState([])
  const [forecast, setForecast] = useState([])
  const [loading, setLoading] = useState(true)
  const [userPreferredTags, setUserPreferredTags] = useState([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisStatus, setAnalysisStatus] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const fetchData = async () => {
    try {
      const token = await getToken()
      if (!token) {
        console.log("No token available yet, skipping fetch")
        return
      }
      const headers = { Authorization: `Bearer ${token}` }

      const [riskRes, forecastRes] = await Promise.all([
        axios.get('/api/risk-history', { headers }),
        axios.get('/api/forecast', { headers })
      ])

      // Format data for chart
      const history = riskRes.data.map(d => ({
        ...d,
        timestamp: new Date(d.timestamp).toLocaleString(),
        Risk: d.risk_score
      })).reverse() // Show oldest to newest

      setRiskData(history)
      setForecast(forecastRes.data)
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
    const interval = setInterval(() => {
      if (isLoaded && isSignedIn) fetchData()
    }, 60000) // Refresh every minute
    return () => clearInterval(interval)
  }, [isLoaded, isSignedIn])

  const triggerIngest = async () => {
    try {
      const token = await getToken()
      setIsAnalyzing(true)
      setAnalysisStatus({ state: 'running', message: 'Starting pipeline...', progress: 0 })

      // Fire-and-forget POST to start pipeline in background
      await axios.post('/api/trigger-ingest', {}, { headers: { Authorization: `Bearer ${token}` } })

      // Open SSE stream for progress updates
      const eventSource = new EventSource('/api/pipeline-progress')

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          setAnalysisStatus(data)

          if (data.state === 'done' || data.state === 'error') {
            eventSource.close()
            // Keep overlay visible briefly to show final message
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

  // Sort articles: preferred-tag articles first, then the rest (preserving recency within each group)
  const sortedArticles = useMemo(() => {
    const reversed = [...riskData].reverse() // newest first
    if (userPreferredTags.length === 0) return reversed

    const preferred = []
    const rest = []
    for (const article of reversed) {
      const tags = article.tags ? article.tags.split(',').map(t => t.trim()) : []
      if (tags.some(t => userPreferredTags.includes(t))) {
        preferred.push(article)
      } else {
        rest.push(article)
      }
    }
    return [...preferred, ...rest]
  }, [riskData, userPreferredTags])

  return (
    <>
      <div className="min-h-screen bg-slate-900 p-6 font-sans text-slate-100">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header */}
          <header className="flex flex-col md:flex-row justify-between items-center bg-slate-800 p-6 rounded-2xl shadow-lg border border-slate-700">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                Supply Chain Risk Monitor
              </h1>
              <p className="text-slate-400 mt-1">Welcome back, {user?.firstName}!</p>
            </div>
            <div className="flex gap-4 items-center mt-4 md:mt-0">
              <button
                onClick={triggerIngest}
                disabled={isAnalyzing}
                className={`px-5 py-2.5 font-medium rounded-lg shadow-md transition-all active:scale-95 ${isAnalyzing
                  ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-500 text-white hover:shadow-blue-500/20'
                  }`}
              >
                {isAnalyzing ? 'Analyzing...' : 'Run Analysis Now'}
              </button>
              <div className="bg-slate-700 p-1 rounded-full">
                <UserButton />
              </div>
            </div>
          </header>

          {loading ? (
            <div className="flex justify-center items-center h-96">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

              {/* Main Content Column */}
              <div className="lg:col-span-2 space-y-8">

                {/* Chart Section */}
                <div className="bg-slate-800 p-6 rounded-2xl shadow-lg border border-slate-700">
                  <h2 className="text-xl font-semibold mb-6 flex items-center gap-2 text-slate-100">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-400"><path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" /></svg>
                    Risk Trend (Last 100 Articles)
                  </h2>
                  <div className="h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={riskData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                        <XAxis
                          dataKey="timestamp"
                          stroke="#94a3b8"
                          tick={{ fill: '#94a3b8', fontSize: 12 }}
                          tickFormatter={(val) => new Date(val).toLocaleDateString()}
                        />
                        <YAxis
                          domain={[0, 1]}
                          stroke="#94a3b8"
                          tick={{ fill: '#94a3b8', fontSize: 12 }}
                        />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f1f5f9' }}
                          itemStyle={{ color: '#f1f5f9' }}
                        />
                        <Legend wrapperStyle={{ paddingTop: '20px' }} />
                        <Line
                          type="monotone"
                          dataKey="Risk"
                          stroke="#ef4444"
                          strokeWidth={3}
                          dot={false}
                          activeDot={{ r: 8, fill: '#ef4444' }}
                        />
                        <Line
                          type="monotone"
                          dataKey="prob_neg"
                          name="Negative Sentiment"
                          stroke="#f59e0b"
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Forecast Section */}
                <div className="bg-slate-800 p-6 rounded-2xl shadow-lg border border-slate-700">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-emerald-400">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12h10" /><path d="M9 4v16" /><path d="m3 9 3 3-3 3" /><path d="M12 6 A8 8 0 0 1 20 12 A8 8 0 0 1 12 18" /></svg>
                    Future Risk Forecast
                  </h3>
                  {forecast.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {forecast.map((f, i) => (
                        <div key={i} className="bg-slate-700/50 p-4 rounded-xl border border-slate-600 flex flex-col items-center justify-center text-center transition-transform hover:scale-105">
                          <span className="text-xs text-slate-400 mb-1">{new Date(f.Timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          <span className="text-2xl font-bold text-slate-100">{f.Forecasted_Risk_Score.toFixed(2)}</span>
                          <span className="text-xs text-slate-500 mt-1">Predicted Risk</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center border border-dashed border-slate-700 rounded-xl">
                      <p className="text-slate-400">No forecast data available yet.</p>
                    </div>
                  )}
                </div>

                {/* Risk Forecast Charts */}
                <RiskForecastCharts getToken={getToken} refreshKey={refreshKey} />
              </div>

              {/* News Feed Column */}
              <div className="space-y-4 h-[calc(100vh-140px)] sticky top-6 flex flex-col">
                {/* Tag Preferences */}
                <TagPreferences onPreferencesChange={setUserPreferredTags} />

                {/* News Feed */}
                <div className="bg-slate-800 p-6 rounded-2xl shadow-lg border border-slate-700 flex-1 overflow-hidden flex flex-col">
                  <NewsFeed articles={sortedArticles} userPreferredTags={userPreferredTags} />
                </div>
              </div>

            </div>
          )}
        </div>
      </div>

      {/* Analysis Progress Overlay */}
      {isAnalyzing && <AnalysisProgress status={analysisStatus} />}
    </>
  )
}

export default Dashboard

