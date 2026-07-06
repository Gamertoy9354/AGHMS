import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, LogIn, AlertCircle, Shield } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';

const schema = z.object({
  email:    z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export default function LoginPage() {
  const { signIn } = useAuth();
  const navigate    = useNavigate();
  const [showPwd, setShowPwd]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  });

  const onSubmit = async ({ email, password }) => {
    setLoading(true);
    setError('');
    try {
      await signIn(email, password);
      toast.success('Welcome back!');
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-50 flex">
      {/* Left brand panel */}
      <div className="hidden lg:flex lg:w-[55%] gradient-primary flex-col items-center justify-center p-12 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/5" />
          <div className="absolute -bottom-32 -left-32 w-[28rem] h-[28rem] rounded-full bg-white/5" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[36rem] h-[36rem] rounded-full border border-white/10" />
        </div>

        {/* Content */}
        <div className="relative z-10 text-center max-w-md">
          <div className="w-20 h-20 rounded-3xl bg-white/20 backdrop-blur flex items-center justify-center mx-auto mb-8 shadow-xl">
            <span className="text-white font-black text-3xl">AG</span>
          </div>
          <h1 className="text-3xl font-black text-white mb-3 leading-tight">
            Academic Governance &<br/>HOD Monitoring System
          </h1>
          <p className="text-white/70 text-base leading-relaxed mb-10">
            Streamlining meeting management, document compliance, and performance tracking for RNGPIT.
          </p>
          <div className="grid grid-cols-2 gap-3 text-left">
            {[
              { emoji:'📋', title:'Meeting Agendas', desc:'Streamlined approval & circular workflow' },
              { emoji:'📊', title:'Performance Analytics', desc:'Real-time department dashboards' },
              { emoji:'📁', title:'Document Hub', desc:'Centralized compliance tracking' },
              { emoji:'🎓', title:'Placement Monitoring', desc:'End-to-end placement drive management' },
            ].map(f => (
              <div key={f.title} className="bg-white/10 rounded-2xl p-3.5">
                <div className="text-xl mb-1.5">{f.emoji}</div>
                <p className="text-white font-semibold text-sm">{f.title}</p>
                <p className="text-white/60 text-xs mt-0.5">{f.desc}</p>
              </div>
            ))}
          </div>
          <p className="text-white/40 text-xs mt-8">
            R.N.G. Patel Institute of Technology · Bardoli, Gujarat · GTU Affiliated
          </p>
        </div>
      </div>

      {/* Right: Login form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          {/* Mobile brand */}
          <div className="lg:hidden text-center mb-8">
            <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-4 shadow-lg">
              <span className="text-white font-black text-2xl">AG</span>
            </div>
            <h1 className="text-xl font-bold text-surface-900">AGHMS · RNGPIT</h1>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-surface-900">Sign in</h2>
            <p className="text-surface-500 text-sm mt-1">Enter your institutional credentials</p>
          </div>

          {/* Error */}
          {error && (
            <div className="alert-danger mb-5">
              <AlertCircle size={16} className="flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="form-label">Email Address</label>
              <input
                {...register('email')}
                type="email"
                placeholder="you@rngpit.ac.in"
                autoComplete="email"
                className={errors.email ? 'border-danger-400 focus:border-danger-500 focus:ring-danger-100' : ''}
              />
              {errors.email && <p className="form-error">{errors.email.message}</p>}
            </div>

            <div>
              <label className="form-label">Password</label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPwd ? 'text' : 'password'}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className={`pr-10 ${errors.password ? 'border-danger-400 focus:border-danger-500 focus:ring-danger-100' : ''}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600 transition-colors"
                >
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p className="form-error">{errors.password.message}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center py-3 text-base"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <LogIn size={16} /> Sign In
                </span>
              )}
            </button>
          </form>

          <div className="mt-6 p-4 bg-surface-50 border border-surface-200 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <Shield size={14} className="text-surface-400" />
              <span className="text-xs font-semibold text-surface-500">Secure Access</span>
            </div>
            <p className="text-xs text-surface-400">
              This system is restricted to authorized RNGPIT personnel only.
              Contact your administrator if you need access.
            </p>
          </div>

          <p className="text-center text-xs text-surface-300 mt-6">
            RNGPIT AGHMS v2.0 · Powered by Supabase
          </p>
        </div>
      </div>
    </div>
  );
}
