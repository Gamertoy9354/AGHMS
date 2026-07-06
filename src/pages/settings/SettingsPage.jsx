import React, { useState } from 'react';
import {
  Settings, Bell, Shield, Database, Palette,
  Save, AlertTriangle, CheckCircle, Globe, Mail, Phone
} from 'lucide-react';
import toast from 'react-hot-toast';
import { PageHeader, TabBar, FormField, Spinner } from '../../components/ui/index';
import { useAcademicYears, useDepartments } from '../../hooks/useData';
import { academicYearsService } from '../../lib/services';
import { supabase } from '../../lib/supabase';

export default function SettingsPage() {
  const [tab, setTab]   = useState('general');
  const [saving, setSaving] = useState(false);
  const { data: years = [] } = useAcademicYears();
  const { data: depts = [] } = useDepartments();

  const [general, setGeneral] = useState({
    institute_name: 'R.N.G. Patel Institute of Technology',
    short_name:     'RNGPIT',
    location:       'Bardoli, Surat District, Gujarat – 394601',
    affiliation:    'Gujarat Technological University (GTU)',
    phone:          '+91-2622-220110',
    email:          'info@rngpit.ac.in',
    website:        'https://rngpit.ac.in',
    circular_prefix:'RNGPIT',
  });

  const [notifs, setNotifs] = useState({
    meeting_approval:    true,
    document_overdue:    true,
    attendance_alert:    true,
    fee_reminder:        false,
    placement_update:    true,
    action_item_overdue: true,
    weekly_digest:       true,
  });

  const [thresholds, setThresholds] = useState({
    attendance_warning:  75,
    attendance_critical: 65,
    pass_percentage:     40,
    sgpa_weak:           5.0,
    fee_due_days:        30,
    document_reminder:   3,
  });

  const handleSave = async () => {
    setSaving(true);
    await new Promise(r => setTimeout(r, 800));
    toast.success('Settings saved successfully!');
    setSaving(false);
  };

  const SaveBtn = () => (
    <button onClick={handleSave} disabled={saving} className="btn-primary text-sm">
      {saving ? <Spinner size={14} className="border-t-white border-white/30"/> : <Save size={14}/>}
      Save Changes
    </button>
  );

  return (
    <div className="page-wrapper max-w-3xl mx-auto">
      <PageHeader title="System Settings" subtitle="Configure institute details, notifications, and thresholds" />

      <TabBar
        tabs={[
          { id:'general',     label:'General',       icon: Settings },
          { id:'notifications',label:'Notifications', icon: Bell },
          { id:'thresholds',  label:'Thresholds',    icon: AlertTriangle },
          { id:'academic',    label:'Academic Year',  icon: Database },
        ]}
        active={tab}
        onChange={setTab}
      />

      {/* General */}
      {tab === 'general' && (
        <div className="card p-6 space-y-4">
          <h3 className="text-sm font-semibold text-surface-700 mb-2">Institute Information</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <FormField label="Institute Full Name">
                <input value={general.institute_name} onChange={e=>setGeneral(p=>({...p,institute_name:e.target.value}))}/>
              </FormField>
            </div>
            <FormField label="Short Name / Abbreviation">
              <input value={general.short_name} onChange={e=>setGeneral(p=>({...p,short_name:e.target.value}))}/>
            </FormField>
            <FormField label="Circular Number Prefix">
              <input value={general.circular_prefix} onChange={e=>setGeneral(p=>({...p,circular_prefix:e.target.value}))} placeholder="e.g. RNGPIT"/>
            </FormField>
            <div className="sm:col-span-2">
              <FormField label="Location / Address">
                <input value={general.location} onChange={e=>setGeneral(p=>({...p,location:e.target.value}))}/>
              </FormField>
            </div>
            <FormField label="Affiliation">
              <input value={general.affiliation} onChange={e=>setGeneral(p=>({...p,affiliation:e.target.value}))}/>
            </FormField>
            <FormField label="Phone">
              <div className="relative">
                <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400"/>
                <input value={general.phone} onChange={e=>setGeneral(p=>({...p,phone:e.target.value}))} className="pl-9"/>
              </div>
            </FormField>
            <FormField label="Official Email">
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400"/>
                <input type="email" value={general.email} onChange={e=>setGeneral(p=>({...p,email:e.target.value}))} className="pl-9"/>
              </div>
            </FormField>
            <FormField label="Website">
              <div className="relative">
                <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400"/>
                <input value={general.website} onChange={e=>setGeneral(p=>({...p,website:e.target.value}))} className="pl-9"/>
              </div>
            </FormField>
          </div>
          <div className="flex justify-end pt-2 border-t border-surface-100"><SaveBtn/></div>
          
          <div className="mt-8 border-t border-danger-200 pt-6">
            <h3 className="text-sm font-semibold text-danger-700 mb-2 flex items-center gap-2">
              <AlertTriangle size={16} /> Danger Zone
            </h3>
            <p className="text-sm text-surface-600 mb-4">
              Clear all demo dummy data from the database. This action is irreversible and will delete all meetings, documents, attendance, results, action items, and student records. Users and settings will be preserved.
            </p>
            <button
              onClick={async () => {
                if (window.confirm('Are you absolutely sure you want to clear all dummy data? This cannot be undone.')) {
                  setSaving(true);
                  try {
                    const { error } = await supabase.rpc('clear_dummy_data');
                    if (error) throw error;
                    toast.success('All dummy data cleared successfully!');
                  } catch (err) {
                    toast.error(err.message || 'Failed to clear data');
                  } finally {
                    setSaving(false);
                  }
                }
              }}
              disabled={saving}
              className="btn-ghost text-danger-600 bg-danger-50 hover:bg-danger-100 border border-danger-200 text-sm font-semibold px-4 py-2"
            >
              Clear Dummy Data
            </button>
          </div>
        </div>
      )}

      {/* Notifications */}
      {tab === 'notifications' && (
        <div className="card p-6">
          <h3 className="text-sm font-semibold text-surface-700 mb-4">Email & In-App Notification Triggers</h3>
          <div className="space-y-3">
            {[
              { key:'meeting_approval',     label:'Meeting Approval Required',     desc:'Notify principal when HOD submits agenda for approval' },
              { key:'document_overdue',     label:'Document Submission Overdue',   desc:'Alert HODs when documents pass deadline without submission' },
              { key:'attendance_alert',     label:'Attendance Defaulter Alert',    desc:'Alert HODs when student attendance drops below threshold' },
              { key:'fee_reminder',         label:'Fee Payment Reminder',          desc:'Remind students/parents about pending fee due dates' },
              { key:'placement_update',     label:'Placement Drive Update',        desc:'Notify relevant departments about new placement drives' },
              { key:'action_item_overdue',  label:'ATR Action Item Overdue',       desc:'Remind responsible party when action items cross deadline' },
              { key:'weekly_digest',        label:'Weekly Summary Digest',         desc:'Send weekly email digest to principal every Monday morning' },
            ].map(item => (
              <div key={item.key} className="flex items-start justify-between gap-4 p-3 rounded-xl hover:bg-surface-50 transition-colors">
                <div>
                  <p className="text-sm font-semibold text-surface-800">{item.label}</p>
                  <p className="text-xs text-surface-400 mt-0.5">{item.desc}</p>
                </div>
                <button
                  onClick={() => setNotifs(p => ({...p, [item.key]: !p[item.key]}))}
                  className={`relative w-12 h-6 rounded-full flex-shrink-0 transition-colors ${notifs[item.key] ? 'bg-primary-600' : 'bg-surface-200'}`}
                >
                  <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${notifs[item.key] ? 'left-7' : 'left-1'}`}/>
                </button>
              </div>
            ))}
          </div>
          <div className="flex justify-end pt-4 border-t border-surface-100 mt-4"><SaveBtn/></div>
        </div>
      )}

      {/* Thresholds */}
      {tab === 'thresholds' && (
        <div className="card p-6 space-y-5">
          <h3 className="text-sm font-semibold text-surface-700 mb-2">Performance & Alert Thresholds</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Attendance Warning Threshold (%)" hint="Students below this get a warning flag">
              <input type="number" min={50} max={100} value={thresholds.attendance_warning}
                     onChange={e=>setThresholds(p=>({...p,attendance_warning:+e.target.value}))}/>
            </FormField>
            <FormField label="Attendance Critical Threshold (%)" hint="Students below this are marked critical">
              <input type="number" min={40} max={80} value={thresholds.attendance_critical}
                     onChange={e=>setThresholds(p=>({...p,attendance_critical:+e.target.value}))}/>
            </FormField>
            <FormField label="Exam Pass Percentage (%)" hint="Minimum marks to pass a subject">
              <input type="number" min={30} max={60} value={thresholds.pass_percentage}
                     onChange={e=>setThresholds(p=>({...p,pass_percentage:+e.target.value}))}/>
            </FormField>
            <FormField label="Weak Student SGPA Threshold" hint="Students below this SGPA are flagged as weak">
              <input type="number" step="0.1" min={3} max={7} value={thresholds.sgpa_weak}
                     onChange={e=>setThresholds(p=>({...p,sgpa_weak:+e.target.value}))}/>
            </FormField>
            <FormField label="Fee Due Reminder (days before)" hint="Send reminder this many days before fee deadline">
              <input type="number" min={1} max={60} value={thresholds.fee_due_days}
                     onChange={e=>setThresholds(p=>({...p,fee_due_days:+e.target.value}))}/>
            </FormField>
            <FormField label="Document Submission Reminder (days before)" hint="Remind HODs this many days before document deadline">
              <input type="number" min={1} max={14} value={thresholds.document_reminder}
                     onChange={e=>setThresholds(p=>({...p,document_reminder:+e.target.value}))}/>
            </FormField>
          </div>

          <div className="alert-info">
            <AlertTriangle size={15}/>
            Threshold changes take effect from the next scheduled check. Current alerts are not retroactively updated.
          </div>
          <div className="flex justify-end"><SaveBtn/></div>
        </div>
      )}

      {/* Academic Year */}
      {tab === 'academic' && (
        <div className="space-y-4">
          <div className="card p-6">
            <h3 className="text-sm font-semibold text-surface-700 mb-4">Academic Years</h3>
            <div className="space-y-2 mb-5">
              {(years.length > 0 ? years : [
                { id:'1', year_name:'2024-25', is_current:true, start_date:'2024-06-01', end_date:'2025-05-31' },
                { id:'2', year_name:'2023-24', is_current:false, start_date:'2023-06-01', end_date:'2024-05-31' },
              ]).map(y => (
                <div key={y.id} className={`flex items-center justify-between p-3 rounded-xl border ${y.is_current?'border-primary-200 bg-primary-50':'border-surface-100'}`}>
                  <div>
                    <p className="text-sm font-semibold text-surface-800">{y.year_name}</p>
                    <p className="text-xs text-surface-400">{y.start_date} → {y.end_date}</p>
                  </div>
                  {y.is_current
                    ? <span className="badge-success text-xs"><CheckCircle size={10}/> Current</span>
                    : <button className="btn-ghost text-xs text-primary-600">Set Current</button>
                  }
                </div>
              ))}
            </div>
            <div className="border-t border-surface-100 pt-4">
              <h4 className="text-xs font-semibold text-surface-500 uppercase tracking-wide mb-3">Add New Academic Year</h4>
              <div className="grid grid-cols-3 gap-3">
                <FormField label="Year Name"><input placeholder="e.g. 2025-26"/></FormField>
                <FormField label="Start Date"><input type="date"/></FormField>
                <FormField label="End Date"><input type="date"/></FormField>
              </div>
              <button className="btn-primary text-sm mt-3">Add Academic Year</button>
            </div>
          </div>

          <div className="card p-6">
            <h3 className="text-sm font-semibold text-surface-700 mb-4">Departments ({depts.length || 8})</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(depts.length > 0 ? depts : [
                {code:'CSE'},{code:'MECH'},{code:'ELE'},{code:'EC'},{code:'IT'},{code:'CIV'},{code:'CHEM'},{code:'IC'}
              ]).map(d => (
                <div key={d.code||d.id} className="p-2.5 border border-surface-100 rounded-xl flex items-center gap-2">
                  <span className="w-8 h-8 rounded-lg bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center">{d.code}</span>
                  <span className="text-xs text-surface-600 truncate">{d.name || d.code}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
