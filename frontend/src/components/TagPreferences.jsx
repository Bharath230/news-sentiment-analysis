import React, { useEffect, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import axios from 'axios'

const TagPreferences = ({ onPreferencesChange }) => {
  const { getToken } = useAuth()
  const [allTags, setAllTags] = useState([])
  const [selectedTags, setSelectedTags] = useState([])
  const [savedTags, setSavedTags] = useState([])
  const [saving, setSaving] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    fetchTagsAndPreferences()
  }, [])

  const fetchTagsAndPreferences = async () => {
    try {
      const token = await getToken()
      const headers = { Authorization: `Bearer ${token}` }

      const [tagsRes, prefsRes] = await Promise.all([
        axios.get('/api/tags', { headers }),
        axios.get('/api/user-preferences', { headers })
      ])

      setAllTags(tagsRes.data)
      const prefs = prefsRes.data.preferred_tags || []
      setSelectedTags(prefs)
      setSavedTags(prefs)
      onPreferencesChange(prefs)
    } catch (error) {
      console.error('Error fetching tags/preferences:', error)
    }
  }

  const toggleTag = (tag) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )
  }

  const savePreferences = async () => {
    setSaving(true)
    try {
      const token = await getToken()
      await axios.put('/api/user-preferences',
        { preferred_tags: selectedTags },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setSavedTags([...selectedTags])
      onPreferencesChange(selectedTags)
    } catch (error) {
      console.error('Error saving preferences:', error)
    } finally {
      setSaving(false)
    }
  }

  const hasChanges = JSON.stringify(selectedTags.slice().sort()) !== JSON.stringify(savedTags.slice().sort())

  return (
    <div className="bg-slate-800 rounded-2xl shadow-lg border border-slate-700 overflow-hidden">
      {/* Collapsible Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-750 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-violet-400">
            <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"/>
            <path d="M7 7h.01"/>
          </svg>
          <span className="text-sm font-semibold text-slate-200">Tag Preferences</span>
          {savedTags.length > 0 && (
            <span className="text-[10px] bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded-full font-medium">
              {savedTags.length} active
            </span>
          )}
        </div>
        <svg
          xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {/* Collapsible Content */}
      <div className={`transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[400px] opacity-100' : 'max-h-0 opacity-0'} overflow-hidden`}>
        <div className="px-4 pb-4 space-y-3">
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Select tags to prioritize matching news in your feed.
          </p>

          {allTags.length === 0 ? (
            <div className="text-center py-4 text-slate-500 text-xs">
              No tags available yet. Run analysis first.
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5 max-h-[250px] overflow-y-auto pr-1 custom-scrollbar">
              {allTags.map(tag => {
                const isSelected = selectedTags.includes(tag)
                return (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`text-[11px] px-2.5 py-1 rounded-full border transition-all duration-150 font-medium
                      ${isSelected
                        ? 'bg-violet-500/20 text-violet-300 border-violet-500/40 shadow-sm shadow-violet-500/10'
                        : 'bg-slate-700/50 text-slate-400 border-slate-600/50 hover:bg-slate-700 hover:text-slate-300'
                      }`}
                  >
                    {isSelected && <span className="mr-0.5">✓ </span>}
                    {tag}
                  </button>
                )
              })}
            </div>
          )}

          {/* Save Button */}
          {hasChanges && (
            <button
              onClick={savePreferences}
              disabled={saving}
              className="w-full py-2 px-4 bg-violet-600 hover:bg-violet-500 disabled:bg-violet-600/50 text-white text-xs font-semibold rounded-lg transition-all duration-150 shadow-md shadow-violet-500/10 active:scale-[0.98]"
            >
              {saving ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin h-3 w-3 border-2 border-white/30 border-t-white rounded-full" />
                  Saving...
                </span>
              ) : (
                `Save Preferences (${selectedTags.length} tags)`
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default TagPreferences
