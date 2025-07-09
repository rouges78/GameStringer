'use client';

import { InjektUIEnhanced } from '@/components/injekt-ui-enhanced';
import { motion } from 'framer-motion';
import { Zap, Brain, Target, Activity } from 'lucide-react';

export default function InjektTranslatorPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/10 to-slate-900 p-6">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-20 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-40 right-20 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute bottom-20 left-1/2 w-80 h-80 bg-cyan-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Header Hero Section */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-12"
        >
          <div className="relative inline-block">
            <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 via-blue-600 to-cyan-600 rounded-lg blur opacity-25 animate-pulse" />
            <div className="relative bg-slate-900/80 rounded-lg p-8 border border-purple-500/20">
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="flex items-center justify-center space-x-4 mb-4"
              >
                <div className="p-3 rounded-full bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-400/30">
                  <Brain className="h-8 w-8 text-cyan-400" />
                </div>
                <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent">
                  Neural Translator
                </h1>
                <div className="p-3 rounded-full bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-400/30">
                  <Zap className="h-8 w-8 text-purple-400" />
                </div>
              </motion.div>
              
              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4, duration: 0.6 }}
                className="text-xl text-gray-300 mb-6 max-w-3xl mx-auto"
              >
                Sistema di traduzione in tempo reale con intelligenza artificiale avanzata per l'injekt dinamico nei giochi
              </motion.p>

              {/* Feature Highlights */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.6 }}
                className="flex items-center justify-center space-x-8"
              >
                <div className="flex items-center space-x-2 text-gray-400">
                  <Target className="h-5 w-5 text-purple-400" />
                  <span className="text-sm">Precision Injection</span>
                </div>
                <div className="flex items-center space-x-2 text-gray-400">
                  <Activity className="h-5 w-5 text-blue-400" />
                  <span className="text-sm">Real-time Processing</span>
                </div>
                <div className="flex items-center space-x-2 text-gray-400">
                  <Brain className="h-5 w-5 text-cyan-400" />
                  <span className="text-sm">AI-Powered</span>
                </div>
              </motion.div>
            </div>
          </div>
        </motion.div>

        {/* Enhanced Injekt UI */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.8 }}
        >
          <InjektUIEnhanced />
        </motion.div>
      </div>
    </div>
  );
}
