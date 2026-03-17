import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, useUser } from '@clerk/clerk-react'
import axios from 'axios'

const COMPONENTS = [
    "Suppliers",
    "Manufacturers/Producers",
    "Warehouse/Storage",
    "Transportation/Logistics",
    "Distribution/Intermediaries"
]

const Onboarding = () => {
    const { getToken } = useAuth()
    const { user } = useUser()
    const navigate = useNavigate()

    const [formData, setFormData] = useState({
        name: '',
        company_name: '',
        sc_component: [COMPONENTS[0]],
        business_details: ''
    })

    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    useEffect(() => {
        if (user && user.fullName && !formData.name) {
            setFormData(prev => ({ ...prev, name: user.fullName }))
        }
    }, [user])

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value })
    }

    const handleComponentToggle = (comp) => {
        setFormData(prev => {
            const current = prev.sc_component;
            if (current.includes(comp)) {
                return { ...prev, sc_component: current.filter(c => c !== comp) };
            } else {
                return { ...prev, sc_component: [...current, comp] };
            }
        });
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            const token = await getToken()
            const payload = {
                ...formData,
                sc_component: formData.sc_component.join(', ')
            }
            await axios.post('/api/user-profile', payload, {
                headers: { Authorization: `Bearer ${token}` }
            })
            navigate('/dashboard')
        } catch (err) {
            console.error(err)
            setError("Failed to save profile. Please try again.")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex items-center justify-center min-h-screen p-4 bg-gray-50 dark:bg-slate-950 transition-colors">
            <div className="w-full max-w-lg bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-xl dark:shadow-2xl border border-gray-200 dark:border-slate-800">

                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400 mb-6 ring-1 ring-primary-200 dark:ring-primary-500/20">
                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                    </div>
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-slate-100">Welcome to SC Risk Monitor</h2>
                    <p className="text-gray-500 dark:text-slate-400 mt-2">Let's set up your profile to receive domain-specific news and risk forecasts.</p>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/50 rounded-lg text-red-600 dark:text-red-400 text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Your Name</label>
                        <input
                            type="text"
                            name="name"
                            required
                            value={formData.name}
                            onChange={handleChange}
                            className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-lg py-2.5 px-4 text-gray-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
                            placeholder="John Doe"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Company Name</label>
                        <input
                            type="text"
                            name="company_name"
                            required
                            value={formData.company_name}
                            onChange={handleChange}
                            className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-lg py-2.5 px-4 text-gray-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
                            placeholder="e.g. Acme Logistics Returns"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Supply Chain Components</label>
                        <p className="text-xs text-gray-400 dark:text-slate-500 mb-3">Select one or more areas. We'll tailor your news feed based on your selections.</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {COMPONENTS.map(comp => (
                                <label key={comp} className={`flex items-start p-3.5 rounded-xl border cursor-pointer transition-all duration-200 ${formData.sc_component.includes(comp) ? 'bg-primary-50 dark:bg-primary-500/10 border-primary-300 dark:border-primary-500/50 shadow-sm' : 'bg-gray-50 dark:bg-slate-950 border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-900/50'}`}>
                                    <input
                                        type="checkbox"
                                        checked={formData.sc_component.includes(comp)}
                                        onChange={() => handleComponentToggle(comp)}
                                        className="mt-0.5 h-4 w-4 bg-gray-50 dark:bg-slate-950 border-gray-300 dark:border-slate-800 text-primary-500 rounded focus:ring-primary-500/50"
                                    />
                                    <span className={`ml-3 text-sm leading-tight transition-colors ${formData.sc_component.includes(comp) ? 'text-primary-800 dark:text-primary-100 font-medium' : 'text-gray-500 dark:text-slate-400'}`}>
                                        {comp}
                                    </span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Business Details (Optional)</label>
                        <textarea
                            name="business_details"
                            value={formData.business_details}
                            onChange={handleChange}
                            rows="3"
                            className="w-full bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl py-3 px-4 text-gray-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 transition-all resize-none placeholder:text-gray-400 dark:placeholder:text-slate-600"
                            placeholder="Briefly describe your key operations..."
                        ></textarea>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className={`w-full py-3.5 px-4 bg-primary-600 hover:bg-primary-500 text-white font-medium rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:shadow-[0_0_25px_rgba(16,185,129,0.3)] transition-all duration-300 flex justify-center items-center ${loading ? 'opacity-75 cursor-not-allowed' : 'active:scale-[0.98]'}`}
                    >
                        {loading ? (
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        ) : null}
                        {loading ? 'Saving Profile...' : 'Complete Setup'}
                    </button>
                </form>
            </div>
        </div>
    )
}

export default Onboarding
