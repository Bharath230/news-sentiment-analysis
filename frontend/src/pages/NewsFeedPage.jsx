import React, { useEffect, useState, useMemo } from 'react'
import { useAuth } from '@clerk/clerk-react'
import axios from 'axios'
import { useOutletContext } from 'react-router-dom'
import NewsFeed from '../components/NewsFeed'
import TagPreferences from '../components/TagPreferences'

const NewsFeedPage = () => {
    const { getToken, isLoaded, isSignedIn } = useAuth()
    const { userProfile } = useOutletContext()
    const [articles, setArticles] = useState([])
    const [loading, setLoading] = useState(true)
    const [userPreferredTags, setUserPreferredTags] = useState([])

    const fetchData = async () => {
        try {
            const token = await getToken()
            if (!token) return

            const res = await axios.get('/api/risk-history', {
                headers: { Authorization: `Bearer ${token}` }
            })
            setArticles(res.data)
        } catch (error) {
            console.error("Error fetching news:", error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (isLoaded && isSignedIn) {
            fetchData()
        }
    }, [isLoaded, isSignedIn])

    const sortedArticles = useMemo(() => {
        const reversed = [...articles].reverse()
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
    }, [articles, userPreferredTags])

    return (
        <div className="space-y-6 h-full flex flex-col">
            <header className="mb-2 shrink-0">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Domain News Feed</h2>
                <p className="text-gray-500 dark:text-slate-400">News tailored for {userProfile?.sc_component || 'your domain'}.</p>
            </header>

            {loading ? (
                <div className="flex justify-center items-center h-64 shrink-0">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
                </div>
            ) : (
                <div className="flex-1 flex flex-col space-y-4 overflow-hidden">
                    <div className="shrink-0">
                        <TagPreferences onPreferencesChange={setUserPreferredTags} />
                    </div>

                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm dark:shadow-lg border border-gray-200 dark:border-slate-700 flex-1 overflow-hidden flex flex-col">
                        <NewsFeed articles={sortedArticles} userPreferredTags={userPreferredTags} />
                    </div>
                </div>
            )}
        </div>
    )
}

export default NewsFeedPage
