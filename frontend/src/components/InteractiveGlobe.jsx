import React, { useRef, useEffect, useMemo } from 'react'
import Globe from 'react-globe.gl'
import * as THREE from 'three'
import { useTheme } from '../context/ThemeContext'

// Comprehensive country → [lat, lng] coordinate map
const COUNTRY_COORDS = {
    'usa': [38, -97], 'united states': [38, -97],
    'china': [35, 105], 'india': [22, 78], 'japan': [36, 138],
    'russia': [60, 100], 'germany': [51, 10], 'france': [46, 2],
    'united kingdom': [55, -3], 'uk': [55, -3],
    'brazil': [-14, -51], 'mexico': [23, -102], 'canada': [56, -106],
    'australia': [-25, 135], 'south korea': [37, 127],
    'italy': [42, 12], 'spain': [40, -4], 'turkey': [39, 35],
    'iran': [32, 53], 'saudi arabia': [24, 45], 'egypt': [26, 30],
    'nigeria': [10, 8], 'south africa': [-29, 24],
    'indonesia': [-5, 120], 'thailand': [15, 100],
    'vietnam': [16, 108], 'malaysia': [4, 102],
    'philippines': [13, 122], 'bangladesh': [24, 90],
    'pakistan': [30, 69], 'ukraine': [49, 32],
    'poland': [52, 20], 'netherlands': [52, 5],
    'taiwan': [24, 121], 'singapore': [1, 104],
    'israel': [31, 35], 'uae': [24, 54], 'united arab emirates': [24, 54],
    'argentina': [-34, -64], 'colombia': [4, -72], 'chile': [-35, -71],
    'peru': [-10, -76], 'kenya': [0, 38], 'ethiopia': [9, 38],
    'ghana': [8, -1], 'morocco': [32, -5], 'algeria': [28, 1],
    'iraq': [33, 44], 'syria': [35, 38], 'afghanistan': [33, 65],
    'myanmar': [21, 96], 'sri lanka': [8, 81], 'nepal': [28, 84],
    'sweden': [62, 15], 'norway': [60, 8], 'finland': [61, 26],
    'denmark': [56, 10], 'switzerland': [47, 8], 'austria': [48, 14],
    'belgium': [51, 4], 'portugal': [40, -8], 'greece': [39, 22],
    'czech republic': [50, 15], 'romania': [46, 25], 'hungary': [47, 20],
    'new zealand': [-42, 174], 'ireland': [53, -8],
    'global': [20, 0],
}

function getCountryCoordinates(countryName) {
    const lower = countryName.toLowerCase().trim()
    if (COUNTRY_COORDS[lower]) return COUNTRY_COORDS[lower]
    // Fuzzy match
    for (const [key, coords] of Object.entries(COUNTRY_COORDS)) {
        if (lower.includes(key) || key.includes(lower)) return coords
    }
    // Hash-based fallback for unknown locations
    const hash = lower.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
    return [(hash % 120) - 60, (hash * 7 % 360) - 180]
}

// Public domain earth textures
const EARTH_DARK = '//unpkg.com/three-globe/example/img/earth-night.jpg'
const EARTH_LIGHT = '//unpkg.com/three-globe/example/img/earth-blue-marble.jpg'
const EARTH_TOPOLOGY = '//unpkg.com/three-globe/example/img/earth-topology.png'

const InteractiveGlobe = ({ countryData = [], fullSize = false, onCountryClick }) => {
    const globeRef = useRef()
    const containerRef = useRef()
    const { theme } = useTheme()
    const isDark = theme === 'dark'

    const points = useMemo(() => {
        return countryData.map(item => {
            const [lat, lng] = getCountryCoordinates(item.country)
            return {
                lat,
                lng,
                size: Math.max(0.3, Math.min(item.avg_risk_score * 2, 1.5)),
                color: item.risk_level === 'High Risk' ? '#ef4444'
                    : item.risk_level === 'Medium Risk' ? '#f59e0b'
                        : '#10b981',
                label: item.country,
                risk: item.avg_risk_score,
                riskLevel: item.risk_level,
                articleCount: item.article_count,
                altitude: 0.02 + item.avg_risk_score * 0.08,
                radius: fullSize ? (0.6 + item.avg_risk_score * 1.2) : (0.4 + item.avg_risk_score * 0.8)
            }
        })
    }, [countryData, fullSize])

    useEffect(() => {
        if (globeRef.current) {
            const controls = globeRef.current.controls()
            controls.autoRotate = true
            controls.autoRotateSpeed = fullSize ? 0.5 : 0.8
            controls.enableZoom = true
            controls.minDistance = fullSize ? 150 : 200
            controls.maxDistance = fullSize ? 600 : 500

            globeRef.current.pointOfView({ lat: 20, lng: 30, altitude: fullSize ? 2.0 : 2.5 }, 1000)
        }
    }, [fullSize])

    // Responsive sizing
    const [dimensions, setDimensions] = React.useState({ width: fullSize ? 800 : 420, height: fullSize ? 600 : 380 })

    useEffect(() => {
        if (!fullSize || !containerRef.current) return

        const updateSize = () => {
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect()
                setDimensions({
                    width: Math.floor(rect.width),
                    height: Math.floor(Math.max(rect.height, 500))
                })
            }
        }

        updateSize()
        window.addEventListener('resize', updateSize)
        return () => window.removeEventListener('resize', updateSize)
    }, [fullSize])

    const handlePointClick = (point) => {
        if (onCountryClick && point) {
            onCountryClick(point.label)
        }
    }

    return (
        <div
            ref={containerRef}
            className={`relative flex items-center justify-center ${fullSize ? 'w-full h-full' : ''}`}
            style={fullSize ? { minHeight: '500px' } : { minHeight: '380px' }}
        >
            {/* Glow backdrop */}
            <div className={`absolute inset-0 rounded-3xl ${isDark ? 'bg-gradient-to-br from-primary-500/5 via-transparent to-blue-500/5' : 'bg-gradient-to-br from-primary-100/20 via-transparent to-blue-100/20'}`} />

            <Globe
                ref={globeRef}
                width={dimensions.width}
                height={dimensions.height}
                backgroundColor="rgba(0,0,0,0)"

                globeImageUrl={isDark ? EARTH_DARK : EARTH_LIGHT}
                bumpImageUrl={EARTH_TOPOLOGY}

                showAtmosphere={true}
                atmosphereColor={isDark ? '#10b981' : '#059669'}
                atmosphereAltitude={0.18}

                pointsData={points}
                pointLat="lat"
                pointLng="lng"
                pointAltitude="altitude"
                pointRadius="radius"
                pointColor="color"
                onPointClick={handlePointClick}
                pointLabel={d => `
                    <div style="background:${isDark ? '#0f172aee' : '#ffffffee'};border:1px solid ${isDark ? '#1e293b' : '#e2e8f0'};padding:10px 14px;border-radius:12px;color:${isDark ? '#f8fafc' : '#1e293b'};font-family:Inter,sans-serif;font-size:13px;box-shadow:0 8px 24px rgba(0,0,0,0.3);backdrop-filter:blur(8px);cursor:pointer;">
                        <div style="font-weight:700;margin-bottom:4px;font-size:14px;">🌍 ${d.label}</div>
                        <div style="color:${d.color};font-weight:600;font-size:15px;">Risk: ${(d.risk * 100).toFixed(1)}%</div>
                        <div style="color:${isDark ? '#94a3b8' : '#64748b'};font-size:11px;margin-top:3px;">${d.riskLevel} • ${d.articleCount} articles</div>
                        <div style="color:${isDark ? '#6ee7b7' : '#059669'};font-size:10px;margin-top:4px;">Click to view articles →</div>
                    </div>
                `}
                pointsMerge={false}
                pointResolution={8}

                ringsData={points.filter(p => p.riskLevel === 'High Risk')}
                ringLat="lat"
                ringLng="lng"
                ringColor={() => t => `rgba(239, 68, 68, ${1 - t})`}
                ringMaxRadius={fullSize ? 4 : 3}
                ringPropagationSpeed={2}
                ringRepeatPeriod={1500}

                arcsData={fullSize ? points.filter(p => p.riskLevel === 'High Risk').flatMap((p, i, arr) =>
                    arr.slice(i + 1).map(q => ({
                        startLat: p.lat, startLng: p.lng,
                        endLat: q.lat, endLng: q.lng,
                        color: ['rgba(239,68,68,0.3)', 'rgba(239,68,68,0.05)']
                    }))
                ) : []}
                arcColor="color"
                arcDashLength={0.4}
                arcDashGap={0.2}
                arcDashAnimateTime={3000}
                arcStroke={0.5}
            />

            {points.length === 0 && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-sm text-gray-500 dark:text-slate-400 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm px-5 py-2.5 rounded-full border border-gray-200 dark:border-slate-700/50 shadow-lg">
                    No country data — run analysis to see risk markers
                </div>
            )}
        </div>
    )
}

export default InteractiveGlobe
