import React from "react"
import { Crown, Code2, Sparkles } from "lucide-react"

export function CreditsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-[#0f0a1f] to-[#140c2a] text-white">
      <div className="container mx-auto max-w-5xl px-6 py-16">

        {/* Header */}
        <div className="text-center space-y-4 mb-14">
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
            Credits
          </h1>
          <p className="text-gray-400 text-sm max-w-xl mx-auto">
            This Fork Exists Because Of These People
          </p>
        </div>

        {/* Credits Grid */}
        <div className="grid gap-8 md:grid-cols-3">

          {/* Forked By */}
          <div className="group relative rounded-2xl p-6 bg-gradient-to-br from-[#1a1233] to-black border border-purple-900/40 hover:shadow-[0_0_30px_rgba(168,85,247,0.4)] transition-all duration-300">
            <Crown className="h-6 w-6 text-purple-400 mb-4" />
            <h2 className="text-lg font-semibold text-purple-300">Forked & Developed By</h2>
            <p className="mt-2 text-xl font-bold text-white group-hover:text-purple-400 transition-colors">
              Underscore111_
            </p>
            <p className="mt-2 text-sm text-gray-400">
              Added Better UI, Did Improvements And Added More Features.
            </p>
          </div>

          {/* Original Creator */}
          <div className="group relative rounded-2xl p-6 bg-gradient-to-br from-[#1a1233] to-black border border-purple-900/40 hover:shadow-[0_0_30px_rgba(168,85,247,0.4)] transition-all duration-300">
            <Code2 className="h-6 w-6 text-purple-400 mb-4" />
            <h2 className="text-lg font-semibold text-purple-300">Original Project By</h2>
            <p className="mt-2 text-xl font-bold text-white group-hover:text-purple-400 transition-colors">
              UnionCrax Team
            </p>
            <p className="mt-2 text-sm text-gray-400">
              Creator of the original foundation and core system.
            </p>
          </div>

          {/* Contributor */}
          <div className="group relative rounded-2xl p-6 bg-gradient-to-br from-[#1a1233] to-black border border-purple-900/40 hover:shadow-[0_0_30px_rgba(168,85,247,0.4)] transition-all duration-300">
            <Sparkles className="h-6 w-6 text-purple-400 mb-4" />
            <h2 className="text-lg font-semibold text-purple-300">Contributor</h2>
            <p className="mt-2 text-xl font-bold text-white group-hover:text-purple-400 transition-colors">
              SchlemBoy (From Unioncrax team)
            </p>
            <p className="mt-2 text-sm text-gray-400">
              Helped Me With Build.yml.
            </p>
          </div>

        </div>

        {/* Bottom Section */}
        <div className="mt-16 text-center text-xs text-gray-500">
          <p>© {new Date().getFullYear()} — Forked By Underscore, Made By UnionCrax</p>
        </div>

      </div>
    </div>
  )
}

export default CreditsPage