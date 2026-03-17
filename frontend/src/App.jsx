import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { SignedIn, SignedOut } from '@clerk/clerk-react'
import Login from './pages/Login.jsx'
import Layout from './components/Layout.jsx'
import Onboarding from './pages/Onboarding.jsx'
import RiskTrend from './pages/RiskTrend.jsx'
import NewsFeedPage from './pages/NewsFeedPage.jsx'
import FutureForecast from './pages/FutureForecast.jsx'
import ImpactSummary from './pages/ImpactSummary.jsx'
import NewsDigest from './pages/NewsDigest.jsx'
import GlobalRiskMap from './pages/GlobalRiskMap.jsx'

function App() {
  return (
    <>
      <Routes>
        <Route path="/login" element={
          <SignedOut>
            <Login />
          </SignedOut>
        } />

        <Route path="/" element={
          <>
            <SignedIn>
              <Layout />
            </SignedIn>
            <SignedOut>
              <Navigate to="/login" replace />
            </SignedOut>
          </>
        }>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="onboarding" element={<Onboarding />} />
          <Route path="dashboard" element={<RiskTrend />} />
          <Route path="digest" element={<NewsDigest />} />
          <Route path="news" element={<NewsFeedPage />} />
          <Route path="impact" element={<ImpactSummary />} />
          <Route path="globe" element={<GlobalRiskMap />} />
          <Route path="forecast" element={<FutureForecast />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}

export default App
