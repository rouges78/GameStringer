'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, RotateCcw, Zap, Hand } from 'lucide-react'

interface RestartModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  message?: string
  onAutoRestart?: () => void
  onManualClose?: () => void
}

export default function RestartModal({
  isOpen,
  onClose,
  title = "🔄 Restart Required",
  message = "To apply authentication system changes, GameStringer must be restarted.",
  onAutoRestart,
  onManualClose
}: RestartModalProps) {
  const [isRestarting, setIsRestarting] = useState(false)

  const handleAutoRestart = async () => {
    setIsRestarting(true)
    try {
      if (onAutoRestart) {
        await onAutoRestart()
      }
      // Simula il processo di riavvio
      setTimeout(() => {
        setIsRestarting(false)
        onClose()
      }, 3000)
    } catch (error) {
      console.error('Error during automatic restart:', error)
      setIsRestarting(false)
    }
  }

  const handleManualClose = () => {
    if (onManualClose) {
      onManualClose()
    }
    onClose()
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={onClose}
          />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed inset-0 flex items-center justify-center z-50 p-4"
          >
            <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl max-w-md w-full p-6 relative">
              {/* Close Button */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>

              {/* Content */}
              <div className="text-center space-y-4">
                {/* Icon */}
                <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full flex items-center justify-center mb-4">
                  <RotateCcw className="w-8 h-8 text-blue-400" />
                </div>

                {/* Title */}
                <h3 className="text-xl font-semibold text-white mb-2">
                  {title}
                </h3>

                {/* Message */}
                <p className="text-white/80 text-sm leading-relaxed mb-6">
                  {message}
                </p>

                {/* Buttons */}
                <div className="space-y-3">
                  {/* Auto Restart Button */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleAutoRestart}
                    disabled={isRestarting}
                    className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium py-3 px-4 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isRestarting ? (
                      <>
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        >
                          <RotateCcw size={18} />
                        </motion.div>
                        Restarting...
                      </>
                    ) : (
                      <>
                        <Zap size={18} />
                        ✨ Close and Restart Automatically
                      </>
                    )}
                  </motion.button>

                  {/* Manual Close Button */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleManualClose}
                    disabled={isRestarting}
                    className="w-full bg-white/10 hover:bg-white/20 text-white font-medium py-3 px-4 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 border border-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Hand size={18} />
                    🤚 Lo Faccio Manualmente
                  </motion.button>
                </div>

                {/* Loading Animation */}
                {isRestarting && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 p-3 bg-white/5 rounded-lg border border-white/10"
                  >
                    <div className="flex items-center justify-center gap-2 text-sm text-white/70">
                      <div className="flex gap-1">
                        {[0, 1, 2].map((i) => (
                          <motion.div
                            key={i}
                            animate={{
                              scale: [1, 1.2, 1],
                              opacity: [0.5, 1, 0.5]
                            }}
                            transition={{
                              duration: 1,
                              repeat: Infinity,
                              delay: i * 0.2
                            }}
                            className="w-2 h-2 bg-blue-400 rounded-full"
                          />
                        ))}
                      </div>
                      Chiusura di GameStringer...
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}



