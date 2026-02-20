import React from 'react'
import { SignIn } from '@clerk/clerk-react'

const Login = () => {
  return (
    <div className="flex flex-col justify-center items-center h-screen bg-slate-900 text-slate-100">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent mb-2">
          Supply Chain Risk Monitor
        </h1>
        <p className="text-slate-400">Sign in to access real-time analytics</p>
      </div>
      <SignIn />
    </div>
  )
}

export default Login
