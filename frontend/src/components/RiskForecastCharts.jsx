import React, { useEffect, useState } from 'react'

const CHARTS = [
    { name: 'risk_score', title: 'Supply Chain Risk Forecast', accent: 'blue' },
    { name: 'sentiment', title: 'Negative Sentiment Intensity', accent: 'amber' },
    { name: 'volume', title: 'News Volume & Keyword Buzz', accent: 'emerald' },
]

const RiskForecastCharts = ({ getToken, refreshKey }) => {
    const [images, setImages] = useState({})
    const [errors, setErrors] = useState({})

    useEffect(() => {
        const fetchImages = async () => {
            try {
                const token = await getToken()
                if (!token) return

                for (const chart of CHARTS) {
                    try {
                        const res = await fetch(`/api/forecast-plot/${chart.name}`, {
                            headers: { Authorization: `Bearer ${token}` },
                        })
                        if (res.ok) {
                            const blob = await res.blob()
                            setImages(prev => ({ ...prev, [chart.name]: URL.createObjectURL(blob) }))
                        } else {
                            setErrors(prev => ({ ...prev, [chart.name]: true }))
                        }
                    } catch {
                        setErrors(prev => ({ ...prev, [chart.name]: true }))
                    }
                }
            } catch (err) {
                console.error('Error fetching forecast charts:', err)
            }
        }

        fetchImages()

        // Cleanup object URLs on unmount or before re-fetch
        return () => {
            Object.values(images).forEach(url => URL.revokeObjectURL(url))
        }
    }, [getToken, refreshKey])

    return (
        <div className="space-y-6">
            {CHARTS.map(chart => (
                <div
                    key={chart.name}
                    className="bg-slate-800 p-6 rounded-2xl shadow-lg border border-slate-700"
                >
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`text-${chart.accent}-400`}>
                            <path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" />
                        </svg>
                        <span className="text-slate-100">{chart.title}</span>
                    </h3>

                    {images[chart.name] ? (
                        <img
                            src={images[chart.name]}
                            alt={chart.title}
                            className="w-full rounded-lg"
                        />
                    ) : errors[chart.name] ? (
                        <div className="p-8 text-center border border-dashed border-slate-700 rounded-xl">
                            <p className="text-slate-400">
                                Chart not available yet. Run the analysis to generate forecast plots.
                            </p>
                        </div>
                    ) : (
                        <div className="h-48 w-full rounded-lg bg-slate-700/50 animate-pulse" />
                    )}
                </div>
            ))}
        </div>
    )
}

export default RiskForecastCharts
