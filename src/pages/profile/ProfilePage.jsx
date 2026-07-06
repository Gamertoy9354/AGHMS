import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { User, Mail, Phone, Building, Shield, Save, Key, Eye, EyeOff, Camera } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { usersService } from '../../lib/services';
import { supabase } from '../../lib/supabase';
import { PageHeader, FormField, Spinner, Avatar, TabBar } from '../../components/ui/index';

const profileSchema = z.object({
  full_name:   z.string().min(2, 'Name required'),
  phone:       z.string().optional(),
  designation: z.string().optional(),
  employee_id: z.string().optional(),
});

const passwordSchema = z.object({
  current:  z.string().min(6),
  newPwd:   z.string().min(8, 'Minimum 8 characters'),
  confirm:  z.string(),
}).refine(d => d.newPwd === d.confirm, { message: "Passwords don't match", path: ['confirm'] });

const ROLE_LABELS = {
  director:'Director', principal:'Principal', hod:'Head of Department',
  faculty:'Faculty', tpo:'TPO', accounts:'Accounts', exam_cell:'Exam Cell', admin:'Administrator'
};

export default function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth();
  const [tab, setTab]   = useState('profile');
  const [saving, setSaving] = useState(false);
  const [showPwd, setShowPwd] = useState({});

  const profileForm = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name:   profile?.full_name   || '',
      phone:       profile?.phone       || '',
      designation: profile?.designation || '',
      employee_id: profile?.employee_id || '',
    },
  });

  const pwdForm = useForm({ resolver: zodResolver(passwordSchema) });

  const onSaveProfile = async (data) => {
    setSaving(true);
    try {
      await usersService.update(user.id, data);
      if (refreshProfile) await refreshProfile();
      toast.success('Profile updated!');
    } catch (err) { toast.error(err.message || 'Failed to update'); }
    finally { setSaving(false); }
  };

  const onChangePassword = async (data) => {
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: data.newPwd });
      if (error) throw error;
      toast.success('Password changed successfully!');
      pwdForm.reset();
    } catch (err) { toast.error(err.message || 'Failed to change password'); }
    finally { setSaving(false); }
  };

  const togglePwd = (field) => setShowPwd(p => ({ ...p, [field]: !p[field] }));

  return (
    <div className="page-wrapper max-w-2xl mx-auto">
      <PageHeader title="My Profile" subtitle="Manage your personal information and account security" />

      {/* Profile card */}
      <div className="card p-6 mb-6 flex items-center gap-4">
        <div className="relative">
          <Avatar name={profile?.full_name} size="lg" />
          <button className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-primary-600 flex items-center justify-center shadow-md hover:bg-primary-700">
            <Camera size={12} className="text-white" />
          </button>
        </div>
        <div>
          <h2 className="text-lg font-bold text-surface-900">{profile?.full_name || user?.email}</h2>
          <p className="text-sm text-surface-500">{ROLE_LABELS[profile?.role] || profile?.role}</p>
          {profile?.department && <p className="text-xs text-primary-600 mt-0.5">{profile.department.name}</p>}
        </div>
        <div className="ml-auto text-right">
          <span className="badge-success text-xs">Active</span>
          <p className="text-xs text-surface-400 mt-1">{user?.email}</p>
        </div>
      </div>

      <TabBar
        tabs={[
          { id:'profile',  label:'Personal Info', icon: User },
          { id:'security', label:'Security',       icon: Shield },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'profile' && (
        <form onSubmit={profileForm.handleSubmit(onSaveProfile)}>
          <div className="card p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <FormField label="Full Name" required error={profileForm.formState.errors.full_name?.message}>
                  <div className="relative">
                    <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                    <input {...profileForm.register('full_name')} className="pl-9" placeholder="Your full name" />
                  </div>
                </FormField>
              </div>
              <FormField label="Email" hint="Cannot be changed">
                <div className="relative">
                  <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                  <input value={user?.email || ''} disabled className="pl-9 bg-surface-50 cursor-not-allowed text-surface-400" />
                </div>
              </FormField>
              <FormField label="Phone" error={profileForm.formState.errors.phone?.message}>
                <div className="relative">
                  <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                  <input {...profileForm.register('phone')} className="pl-9" placeholder="Mobile number" />
                </div>
              </FormField>
              <FormField label="Designation">
                <input {...profileForm.register('designation')} placeholder="e.g. Assistant Professor" />
              </FormField>
              <FormField label="Employee ID">
                <input {...profileForm.register('employee_id')} placeholder="e.g. RNGPIT/2018/045" />
              </FormField>
              <FormField label="Role" hint="Managed by admin">
                <div className="relative">
                  <Shield size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                  <input value={ROLE_LABELS[profile?.role] || '—'} disabled className="pl-9 bg-surface-50 cursor-not-allowed text-surface-400" />
                </div>
              </FormField>
              <FormField label="Department" hint="Managed by admin">
                <div className="relative">
                  <Building size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                  <input value={profile?.department?.name || '—'} disabled className="pl-9 bg-surface-50 cursor-not-allowed text-surface-400" />
                </div>
              </FormField>
            </div>
            <div className="flex justify-end pt-2 border-t border-surface-100">
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? <Spinner size={15} className="border-t-white border-white/30" /> : <Save size={15} />}
                Save Changes
              </button>
            </div>
          </div>
        </form>
      )}

      {tab === 'security' && (
        <form onSubmit={pwdForm.handleSubmit(onChangePassword)}>
          <div className="card p-6 space-y-4">
            <h3 className="text-sm font-semibold text-surface-700 mb-4">Change Password</h3>
            {['current', 'newPwd', 'confirm'].map((field) => {
              const labels = { current:'Current Password', newPwd:'New Password', confirm:'Confirm New Password' };
              const err = pwdForm.formState.errors[field]?.message;
              return (
                <FormField key={field} label={labels[field]} required error={err}>
                  <div className="relative">
                    <Key size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                    <input
                      {...pwdForm.register(field)}
                      type={showPwd[field] ? 'text' : 'password'}
                      className="pl-9 pr-10"
                      placeholder="••••••••"
                    />
                    <button type="button" onClick={() => togglePwd(field)} className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600">
                      {showPwd[field] ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </FormField>
              );
            })}
            <div className="pt-2 border-t border-surface-100 flex justify-end">
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? <Spinner size={15} className="border-t-white border-white/30" /> : <Shield size={15} />}
                Update Password
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
