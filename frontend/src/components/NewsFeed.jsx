import React, { useState } from 'react'

const NewsFeed = ({ articles, userPreferredTags = [] }) => {
  const [expandedId, setExpandedId] = useState(null)

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id)
  }

  const getRiskBadgeColor = (level) => {
    switch (level) {
      case 'High Risk': return 'bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/20'
      case 'Medium Risk': return 'bg-amber-100 dark:bg-yellow-500/10 text-amber-700 dark:text-yellow-400 border-amber-200 dark:border-yellow-500/20'
      case 'Low Risk': return 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'
      default: return 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-200 border-gray-200 dark:border-slate-600'
    }
  }

  const parseTags = (tagsStr) => {
    if (!tagsStr) return []
    return tagsStr.split(',').map(t => t.trim()).filter(t => t)
  }

  return (
    <div className="h-full flex flex-col">
      <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-slate-100 flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary-500"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" /><path d="M18 14h-8" /><path d="M15 18h-5" /><path d="M10 6h8" /></svg>
        Recent News
      </h2>

      {articles.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 text-gray-400 dark:text-slate-500 border border-dashed border-gray-300 dark:border-slate-700 rounded-lg">
          <p>No news articles found.</p>
        </div>
      ) : (
        <div className="space-y-3 overflow-y-auto pr-2 custom-scrollbar flex-1">
          {articles.map((article, index) => {
            const tags = parseTags(article.tags)
            const hasPreferredTag = tags.some(t => userPreferredTags.includes(t))

            return (
              <div
                key={article.id || index}
                className={`group bg-gray-50 dark:bg-slate-900 border rounded-2xl p-5 shadow-sm dark:shadow-lg transition-all duration-300 relative overflow-hidden
                  ${hasPreferredTag
                    ? 'border-primary-300 dark:border-primary-500/30 hover:border-primary-400 dark:hover:border-primary-500/60 hover:shadow-md dark:hover:shadow-[0_0_25px_rgba(16,185,129,0.15)] transform hover:-translate-y-1'
                    : 'border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700 transform hover:-translate-y-1 hover:shadow-md dark:hover:shadow-xl'
                  }`}
              >
                {/* Subtle highlight gradient */}
                <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${hasPreferredTag ? 'from-primary-600 to-teal-400' : 'from-gray-300 dark:from-slate-700 to-gray-200 dark:to-slate-600'} opacity-0 group-hover:opacity-100 transition-opacity`}></div>

                <div className="flex justify-between items-start mb-3">
                  <span className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${getRiskBadgeColor(article.risk_level)} shadow-sm`}>
                    {article.risk_level} <span className="opacity-50 mx-1.5">|</span> {article.risk_score.toFixed(2)}
                  </span>
                  <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-slate-500 font-mono">
                    {article.keyword_count > 0 && (
                      <span className="bg-gray-100 dark:bg-slate-800 px-2 py-1 rounded text-gray-600 dark:text-slate-300 ring-1 ring-gray-200 dark:ring-slate-700" title="Keywords found">
                        #{article.keyword_count}
                      </span>
                    )}
                    <span>{new Date(article.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-sm text-gray-600 dark:text-slate-300 leading-relaxed group-hover:text-gray-800 dark:group-hover:text-slate-100 transition-colors">
                    {expandedId === article.id ? article.news_full : article.news_preview}
                  </p>
                  {article.news_full && article.news_full !== article.news_preview && (
                    <button
                      onClick={() => toggleExpand(article.id)}
                      className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-500 dark:hover:text-primary-300 mt-2 font-medium tracking-wide focus:outline-none flex items-center gap-1 group/btn"
                    >
                      {expandedId === article.id ? "Show Less" : "Read More"}
                      <svg className={`w-3.5 h-3.5 transition-transform ${expandedId ? 'rotate-180' : 'group-hover/btn:translate-x-0.5'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={expandedId ? "M5 15l7-7 7 7" : "M9 5l7 7-7 7"} /></svg>
                    </button>
                  )}
                </div>

                {/* Tags */}
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {tags.map(tag => {
                      const isPreferred = userPreferredTags.includes(tag)
                      return (
                        <span
                          key={tag}
                          className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors
                            ${isPreferred
                              ? 'bg-primary-100 dark:bg-primary-500/10 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-500/20'
                              : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 border border-gray-200 dark:border-slate-700'
                            }`}
                        >
                          {tag}
                        </span>
                      )
                    })}
                  </div>
                )}

                {/* Sentiment Analysis Bar */}
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-slate-800">
                  <div className="flex justify-between text-[10px] text-gray-400 dark:text-slate-400 mb-1.5 uppercase tracking-wider font-semibold">
                    <span>Sentiment Analysis</span>
                    <span className={
                      article.sentiment_label === 'Negative' ? 'text-red-500 dark:text-red-400' :
                        article.sentiment_label === 'Positive' ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400 dark:text-slate-400'
                    }>
                      {article.sentiment_label}
                    </span>
                  </div>
                  <div className="h-2 w-full bg-gray-200 dark:bg-slate-800 rounded-full overflow-hidden flex ring-1 ring-gray-200 dark:ring-slate-700">
                    <div
                      style={{ width: `${article.prob_neg * 100}%` }}
                      className="h-full bg-red-500"
                      title={`Negative: ${(article.prob_neg * 100).toFixed(1)}%`}
                    />
                    <div
                      style={{ width: `${article.prob_neu * 100}%` }}
                      className="h-full bg-gray-400 dark:bg-slate-600"
                      title={`Neutral: ${(article.prob_neu * 100).toFixed(1)}%`}
                    />
                    <div
                      style={{ width: `${article.prob_pos * 100}%` }}
                      className="h-full bg-primary-500"
                      title={`Positive: ${(article.prob_pos * 100).toFixed(1)}%`}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-400 dark:text-slate-500 mt-2 font-mono">
                    <span>Neg: {(article.prob_neg * 100).toFixed(0)}%</span>
                    <span>Neu: {(article.prob_neu * 100).toFixed(0)}%</span>
                    <span>Pos: {(article.prob_pos * 100).toFixed(0)}%</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default NewsFeed
