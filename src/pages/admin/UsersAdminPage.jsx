import React, { useState } from 'react';
import {
  Users, Plus, Search, Edit, Trash2, Shield,
  CheckCircle, XCircle, Mail, Phone, Building,
  UserCheck, AlertTriangle, Upload, Download, Key, Lock, Eye, EyeOff
} from 'lucide-react';
import toast from 'react-hot-toast';
import { 
  useUsers, useUpdateUser, useDepartments,
  useCreateUser, useUpdateUserCredentials, useDeleteUser 
} from '../../hooks/useData';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { PageHeader, Modal, FormField, Avatar, SearchBar, ConfirmDialog, Spinner, TabBar, EmptyState } from '../../components/ui/index';
import { exportToCSV } from '../../lib/exportUtils';

const ROLES = ['director','principal','hod','faculty','tpo','accounts','exam_cell','admin'];
const ROLE_LABELS = {
  director:'Director', principal:'Principal', hod:'HOD', faculty:'Faculty',
  tpo:'TPO', accounts:'Accounts', exam_cell:'Exam Cell', admin:'Admin'
};
const ROLE_COLORS = {
  director:'badge-danger', principal:'badge-primary', hod:'badge-warning',
  faculty:'badge-success', tpo:'badge-surface', accounts:'badge-surface',
  exam_cell:'badge-surface', admin:'bg-violet-100 text-violet-700'
};

export default function UsersAdminPage() {
  const { user: currentUser } = useAuth();
  const [search, setSearch]   = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [editModal, setEditModal]  = useState(false);
  const [addModal, setAddModal]    = useState(false);
  const [selected, setSelected] = useState(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving]    = useState(false);

  const [showAddPwd, setShowAddPwd] = useState(false);
  const [showEditPwd, setShowEditPwd] = useState(false);

  const [newUser, setNewUser] = useState({
    full_name: '',
    email: '',
    password: '',
    role: 'faculty',
    department_id: '',
    designation: '',
    phone: '',
    employee_id: ''
  });

  const { data: realUsers, refetch, isLoading } = useUsers({});
  const { data: depts = [] } = useDepartments();
  const updateUser = useUpdateUser();
  const createUser = useCreateUser();
  const updateUserCredentials = useUpdateUserCredentials();
  const deleteUser = useDeleteUser();

  const users = realUsers || [];

  const filtered = users.filter(u => {
    const matchSearch = (u.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
                        (u.email || '').toLowerCase().includes(search.toLowerCase()) ||
                        (u.department?.code || '').toLowerCase().includes(search.toLowerCase());
    const matchRole   = filterRole === 'all' || u.role === filterRole;
    return matchSearch && matchRole;
  });

  const openEdit = (u) => { 
    setSelected({ 
      ...u,
      newPassword: ''
    }); 
    setEditModal(true); 
  };

  const handleSave = async () => {
    if (!selected.full_name) { toast.error('Full Name is required'); return; }
    if (!selected.email) { toast.error('Email is required'); return; }
    setSaving(true);
    try {
      const originalUser = users.find(u => u.id === selected.id);
      const emailChanged = originalUser?.email !== selected.email;
      const hasNewPassword = !!selected.newPassword;

      if (emailChanged || hasNewPassword) {
        if (hasNewPassword && selected.newPassword.length < 6) {
          throw new Error('Password must be at least 6 characters long');
        }
        await updateUserCredentials.mutateAsync({
          id: selected.id,
          email: selected.email,
          password: selected.newPassword || null
        });
      }

      await updateUser.mutateAsync({
        id: selected.id,
        full_name:   selected.full_name,
        role:        selected.role,
        department_id: selected.department_id || null,
        designation: selected.designation || null,
        phone:       selected.phone || null,
        employee_id: selected.employee_id || null,
      });

      toast.success('User updated!');
      setEditModal(false);
    } catch (err) { toast.error(err.message || 'Failed to update user'); }
    finally { setSaving(false); }
  };

  const handleAddUser = async () => {
    if (!newUser.full_name) { toast.error('Full Name is required'); return; }
    if (!newUser.email) { toast.error('Email is required'); return; }
    if (!newUser.password || newUser.password.length < 6) { 
      toast.error('Password must be at least 6 characters'); 
      return; 
    }
    setSaving(true);
    try {
      await createUser.mutateAsync({
        ...newUser,
        department_id: newUser.department_id || null,
        designation: newUser.designation || null,
        phone: newUser.phone || null,
        employee_id: newUser.employee_id || null,
      });
      toast.success('User account created successfully!');
      setAddModal(false);
      setNewUser({
        full_name: '',
        email: '',
        password: '',
        role: 'faculty',
        department_id: '',
        designation: '',
        phone: '',
        employee_id: ''
      });
    } catch (err) { toast.error(err.message || 'Failed to create user'); }
    finally { setSaving(false); }
  };

  const handleDeactivate = async () => {
    try {
      await updateUser.mutateAsync({ id: selected.id, is_active: false });
      toast.success('User deactivated');
      setConfirmDeactivate(false);
    } catch { toast.error('Failed to deactivate'); }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await deleteUser.mutateAsync(selected.id);
      toast.success('User deleted permanently from the system');
      setConfirmDelete(false);
    } catch (err) { toast.error(err.message || 'Failed to delete user'); }
    finally { setSaving(false); }
  };

  const counts = ROLES.reduce((acc, r) => ({ ...acc, [r]: users.filter(u => u.role === r).length }), {});

  return (
    <div className="page-wrapper">
      <PageHeader
        title="User Management"
        subtitle="Manage user accounts, credentials, and roles"
        actions={
          <div className="flex gap-2">
            <button 
              onClick={() => document.getElementById('import-file').click()} 
              className="btn-secondary text-sm"
            >
              <input 
                id="import-file" 
                type="file" 
                accept=".csv" 
                className="hidden" 
                onChange={(e) => {
                  toast.success('Import started... (Simulation)');
                  e.target.value = '';
                }}
              />
              <Upload size={14} /> Import
            </button>
            <button 
              onClick={() => exportToCSV(filtered, 'users_export.csv')} 
              className="btn-secondary text-sm"
            >
              <Download size={14} /> Export
            </button>
            <button onClick={() => setAddModal(true)} className="btn-primary text-sm"><Plus size={14} /> Add User</button>
          </div>
        }
      />

      {/* Role summary chips */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button onClick={() => setFilterRole('all')} className={`badge cursor-pointer ${filterRole==='all'?'badge-primary':'badge-surface'}`}>
          All ({users.length})
        </button>
        {ROLES.map(r => counts[r] > 0 && (
          <button key={r} onClick={() => setFilterRole(r)} className={`badge cursor-pointer ${filterRole===r ? ROLE_COLORS[r] : 'badge-surface'}`}>
            {ROLE_LABELS[r]} ({counts[r]})
          </button>
        ))}
      </div>

      <SearchBar value={search} onChange={setSearch} placeholder="Search by name, email, department…" />

      <div className="card overflow-hidden">
        <table className="table-base">
          <thead>
            <tr><th>User</th><th>Email</th><th>Role</th><th>Department</th><th>Employee ID</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="text-center py-10">
                <EmptyState icon={Users} title="No users found" description="Try adjusting the search or filter" />
              </td></tr>
            )}
            {filtered.map(u => (
              <tr key={u.id}>
                <td>
                  <div className="flex items-center gap-2.5">
                    <Avatar name={u.full_name} size="sm" />
                    <div>
                      <p className="font-semibold text-surface-900">{u.full_name}</p>
                      <p className="text-xs text-surface-400">{u.designation || '—'}</p>
                    </div>
                  </div>
                </td>
                <td className="text-sm text-surface-600">{u.email}</td>
                <td><span className={`badge ${ROLE_COLORS[u.role]||'badge-surface'}`}>{ROLE_LABELS[u.role]||u.role}</span></td>
                <td className="text-sm">{u.department ? <><span className="font-semibold">{u.department.code}</span> <span className="text-surface-400">– {u.department.name}</span></> : <span className="text-surface-400">—</span>}</td>
                <td className="text-sm text-surface-600">{u.employee_id || '—'}</td>
                <td>
                  {u.is_active
                    ? <span className="badge-success text-xs"><CheckCircle size={10} /> Active</span>
                    : <span className="badge-danger text-xs"><XCircle size={10} /> Inactive</span>
                  }
                </td>
                <td>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => openEdit(u)} className="btn-ghost text-xs text-primary-600 hover:bg-primary-50">
                      <Edit size={12} /> Edit
                    </button>
                    {u.is_active && u.id !== currentUser?.id && (
                      <button onClick={() => { setSelected(u); setConfirmDeactivate(true); }} className="btn-ghost text-xs text-warning-600 hover:bg-warning-50">
                        <XCircle size={12} /> Deactivate
                      </button>
                    )}
                    {u.id !== currentUser?.id && (
                      <button onClick={() => { setSelected(u); setConfirmDelete(true); }} className="btn-ghost text-xs text-danger-500 hover:bg-danger-50">
                        <Trash2 size={12} /> Delete
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      <Modal open={editModal} onClose={() => setEditModal(false)} title="Edit User Account"
        footer={
          <>
            <button onClick={() => setEditModal(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary">
              {saving ? <Spinner size={14} className="border-t-white border-white/30" /> : null} Save Changes
            </button>
          </>
        }
      >
        {selected && (
          <div className="space-y-4">
            <div className="p-3.5 bg-amber-50 border border-amber-100 rounded-xl space-y-2">
              <div className="flex items-center gap-1.5 text-amber-800 text-xs font-semibold">
                <Key size={14} />
                <span>Account Credentials Control</span>
              </div>
              <p className="text-[11px] text-amber-700 leading-normal">
                Modifying the email address will update the user's primary login identifier. Entering a new password will force-reset their password instantly.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <FormField label="Login Email Address" required>
                  <input 
                    type="email" 
                    value={selected.email} 
                    onChange={e => setSelected(p => ({ ...p, email: e.target.value }))} 
                  />
                </FormField>
                <FormField label="Force Reset Password">
                  <div className="relative">
                    <input 
                      type={showEditPwd ? 'text' : 'password'}
                      value={selected.newPassword || ''} 
                      onChange={e => setSelected(p => ({ ...p, newPassword: e.target.value }))} 
                      placeholder="Leave empty to keep unchanged"
                      className="pr-10 placeholder:text-surface-300"
                    />
                    <button
                      type="button"
                      onClick={() => setShowEditPwd(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600 transition-colors"
                    >
                      {showEditPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </FormField>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <FormField label="Full Name" required>
                <input value={selected.full_name} onChange={e=>setSelected(p=>({...p,full_name:e.target.value}))} />
              </FormField>
              <FormField label="Phone Number">
                <input value={selected.phone||''} onChange={e=>setSelected(p=>({...p,phone:e.target.value}))} />
              </FormField>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <FormField label="Role" required>
                <select value={selected.role} onChange={e=>setSelected(p=>({...p,role:e.target.value}))} className="text-sm">
                  {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </select>
              </FormField>
              <FormField label="Department">
                <select value={selected.department_id || ''} onChange={e=>setSelected(p=>({...p,department_id:e.target.value||null}))} className="text-sm">
                  <option value="">None / Administrative</option>
                  {depts.map(d => <option key={d.id} value={d.id}>{d.code} – {d.name}</option>)}
                </select>
              </FormField>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <FormField label="Designation">
                <input value={selected.designation||''} onChange={e=>setSelected(p=>({...p,designation:e.target.value}))} />
              </FormField>
              <FormField label="Employee ID">
                <input value={selected.employee_id||''} onChange={e=>setSelected(p=>({...p,employee_id:e.target.value}))} />
              </FormField>
            </div>
          </div>
        )}
      </Modal>

      {/* Add User Modal */}
      <Modal open={addModal} onClose={() => setAddModal(false)} title="Add New User"
        footer={
          <>
            <button onClick={() => setAddModal(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleAddUser} disabled={saving} className="btn-primary">
              {saving ? <Spinner size={14} className="border-t-white border-white/30" /> : <Plus size={14} />} Add User
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="alert-info text-xs flex items-start gap-2 p-3.5 bg-sky-50 border border-sky-100 rounded-xl text-sky-800">
            <Shield size={16} className="text-sky-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Direct User Provisioning</p>
              <p className="opacity-90">This account will be instantly created in both Supabase Auth and the institutional directory. The user can log in immediately.</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FormField label="Full Name" required>
              <input 
                value={newUser.full_name} 
                onChange={e => setNewUser(p => ({ ...p, full_name: e.target.value }))} 
                placeholder="e.g. Dr. Rajesh Kumar"
              />
            </FormField>
            <FormField label="Email Address" required>
              <input 
                type="email" 
                value={newUser.email} 
                onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))} 
                placeholder="e.g. rajesh.kumar@rngpit.ac.in"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FormField label="Password" required>
              <div className="relative">
                <input 
                  type={showAddPwd ? 'text' : 'password'}
                  value={newUser.password} 
                  onChange={e => setNewUser(p => ({ ...p, password: e.target.value }))} 
                  placeholder="Min. 6 characters"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowAddPwd(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600 transition-colors"
                >
                  {showAddPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </FormField>
            <FormField label="Phone Number">
              <input 
                value={newUser.phone} 
                onChange={e => setNewUser(p => ({ ...p, phone: e.target.value }))} 
                placeholder="e.g. +91 98765 43210"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FormField label="Role" required>
              <select value={newUser.role} onChange={e => setNewUser(p => ({ ...p, role: e.target.value }))} className="text-sm">
                {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </FormField>
            <FormField label="Department">
              <select value={newUser.department_id} onChange={e => setNewUser(p => ({ ...p, department_id: e.target.value }))} className="text-sm">
                <option value="">None / Administrative</option>
                {depts.map(d => <option key={d.id} value={d.id}>{d.code} – {d.name}</option>)}
              </select>
            </FormField>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FormField label="Designation">
              <input 
                value={newUser.designation} 
                onChange={e => setNewUser(p => ({ ...p, designation: e.target.value }))} 
                placeholder="e.g. Associate Professor"
              />
            </FormField>
            <FormField label="Employee ID">
              <input 
                value={newUser.employee_id} 
                onChange={e => setNewUser(p => ({ ...p, employee_id: e.target.value }))} 
                placeholder="e.g. EMP-1045"
              />
            </FormField>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmDeactivate}
        onClose={() => setConfirmDeactivate(false)}
        onConfirm={handleDeactivate}
        title="Deactivate User"
        message={`Are you sure you want to deactivate ${selected?.full_name}? They will lose access immediately.`}
        variant="danger"
        loading={updateUser.isPending}
      />

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="Permanently Delete User"
        message={`Are you sure you want to permanently delete the user account for ${selected?.full_name}? This action is irreversible. All historical entries (meetings, documents, actions) will be safely detached.`}
        variant="danger"
        loading={saving}
      />
    </div>
  );
}
