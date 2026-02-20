import React, { useState } from 'react'

const NewsFeed = ({ articles, userPreferredTags = [] }) => {
  const [expandedId, setExpandedId] = useState(null)

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id)
  }

  const getRiskBadgeColor = (level) => {
    switch (level) {
      case 'High Risk': return 'bg-red-500/10 text-red-400 border-red-500/20'
      case 'Medium Risk': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
      case 'Low Risk': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
      default: return 'bg-slate-700 text-slate-200 border-slate-600'
    }
  }

  const parseTags = (tagsStr) => {
    if (!tagsStr) return []
    return tagsStr.split(',').map(t => t.trim()).filter(t => t)
  }

  return (
    <div className="h-full flex flex-col">
      <h2 className="text-xl font-semibold mb-4 text-slate-100 flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" /><path d="M18 14h-8" /><path d="M15 18h-5" /><path d="M10 6h8" /></svg>
        Recent News
      </h2>

      {articles.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 text-slate-500 border border-dashed border-slate-700 rounded-lg">
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
                className={`group bg-slate-800/50 hover:bg-slate-800 rounded-lg p-4 border transition-all duration-200
                  ${hasPreferredTag
                    ? 'border-violet-500/30 ring-1 ring-violet-500/10'
                    : 'border-slate-700 hover:border-slate-600'
                  }`}
              >
                <div className="flex justify-between items-start mb-2.5">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${getRiskBadgeColor(article.risk_level)}`}>
                    {article.risk_level} <span className="opacity-75 mx-1">|</span> {article.risk_score.toFixed(2)}
                  </span>
                  <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
                    {article.keyword_count > 0 && (
                      <span className="bg-slate-700 px-1.5 py-0.5 rounded text-slate-300" title="Keywords found">
                        #{article.keyword_count}
                      </span>
                    )}
                    <span>{new Date(article.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>

                <div className="mb-3">
                  <p className="text-sm text-slate-300 leading-relaxed group-hover:text-slate-200 transition-colors">
                    {expandedId === article.id ? article.news_full : article.news_preview}
                  </p>
                  {article.news_full && article.news_full !== article.news_preview && (
                    <button
                      onClick={() => toggleExpand(article.id)}
                      className="text-xs text-blue-400 hover:text-blue-300 mt-1 focus:outline-none underline decoration-blue-400/30 hover:decoration-blue-400"
                    >
                      {expandedId === article.id ? "Show Less" : "Read More"}
                    </button>
                  )}
                </div>

                {/* Tags */}
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {tags.map(tag => {
                      const isPreferred = userPreferredTags.includes(tag)
                      return (
                        <span
                          key={tag}
                          className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors
                            ${isPreferred
                              ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                              : 'bg-slate-700/60 text-slate-400 border border-slate-600/40'
                            }`}
                        >
                          {tag}
                        </span>
                      )
                    })}
                  </div>
                )}

                {/* Sentiment Analysis Bar */}
                <div className="mt-3 pt-3 border-t border-slate-700/50">
                  <div className="flex justify-between text-[10px] text-slate-400 mb-1 uppercase tracking-wider">
                    <span>Sentiment Analysis</span>
                    <span className={
                      article.sentiment_label === 'Negative' ? 'text-red-400' :
                        article.sentiment_label === 'Positive' ? 'text-emerald-400' : 'text-slate-400'
                    }>
                      {article.sentiment_label}
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-700 rounded-full overflow-hidden flex">
                    <div
                      style={{ width: `${article.prob_neg * 100}%` }}
                      className="h-full bg-red-500/80"
                      title={`Negative: ${(article.prob_neg * 100).toFixed(1)}%`}
                    />
                    <div
                      style={{ width: `${article.prob_neu * 100}%` }}
                      className="h-full bg-slate-500/50"
                      title={`Neutral: ${(article.prob_neu * 100).toFixed(1)}%`}
                    />
                    <div
                      style={{ width: `${article.prob_pos * 100}%` }}
                      className="h-full bg-emerald-500/80"
                      title={`Positive: ${(article.prob_pos * 100).toFixed(1)}%`}
                    />
                  </div>
                  <div className="flex justify-between text-[9px] text-slate-500 mt-1 font-mono">
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

