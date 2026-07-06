import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (authUser) => {
    if (!authUser) { setProfile(null); return; }
    const { data } = await supabase
      .from('users')
      .select('*, department:departments(id, code, name)')
      .eq('id', authUser.id)
      .single();
    setProfile(data || null);
  }, []);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      loadProfile(session?.user ?? null).finally(() => setLoading(false));
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      loadProfile(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [loadProfile]);

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  const refreshProfile = () => loadProfile(user);

  // ── Role helpers ──────────────────────────────────────────────────────────
  const role = profile?.role;

  const hasRole = (...roles) => roles.includes(role);

  const isDirector  = role === 'director';
  const isPrincipal = role === 'principal';
  const isHOD       = role === 'hod';
  const isFaculty   = role === 'faculty';
  const isAdmin     = role === 'admin';
  const isTPO       = role === 'tpo';
  const isAccounts  = role === 'accounts';
  const isExamCell  = role === 'exam_cell';

  // Can approve meetings / action items
  const canApprove = hasRole('director', 'principal', 'admin');
  // Can create/manage meetings
  const canManageMeetings = hasRole('director', 'principal', 'admin', 'tpo');
  // Can upload documents
  const canUploadDocs = hasRole('hod', 'faculty', 'admin', 'director', 'principal');
  // Can see all department data
  const canViewAll = hasRole('director', 'principal', 'admin');
  // User's department filter (if HOD/faculty)
  const userDepartmentId = profile?.department_id ?? null;

  const value = {
    user,
    profile,
    loading,
    signIn,
    signOut,
    refreshProfile,
    // Role booleans
    role,
    hasRole,
    isDirector,
    isPrincipal,
    isHOD,
    isFaculty,
    isAdmin,
    isTPO,
    isAccounts,
    isExamCell,
    // Permission helpers
    canApprove,
    canManageMeetings,
    canUploadDocs,
    canViewAll,
    userDepartmentId,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
