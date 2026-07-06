import React from 'react';

export default function LoadingScreen() {
  return (
    <div className="fixed inset-0 bg-surface-50 flex items-center justify-center z-50">
      <div className="text-center">
        {/* Animated logo mark */}
        <div className="relative mx-auto mb-6 w-16 h-16">
          <div className="absolute inset-0 rounded-2xl gradient-primary opacity-20 animate-ping" />
          <div className="relative w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center shadow-lg">
            <span className="text-white font-black text-xl tracking-tight">AG</span>
          </div>
        </div>

        {/* Spinner dots */}
        <div className="flex items-center justify-center gap-1.5 mb-4">
          {[0, 1, 2].map(i => (
            <span
              key={i}
              className="w-2 h-2 rounded-full bg-primary-500"
              style={{ animation: `pulseSoft 1.2s ease-in-out ${i * 0.2}s infinite` }}
            />
          ))}
        </div>

        <p className="text-sm font-medium text-surface-500">Loading AGHMS…</p>
        <p className="text-xs text-surface-400 mt-1">RNGPIT Academic Governance System</p>
      </div>
    </div>
  );
}
