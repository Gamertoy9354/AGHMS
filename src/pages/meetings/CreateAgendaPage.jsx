import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, Save, Send, ChevronUp, ChevronDown, AlertCircle, FileSpreadsheet } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { useCreateMeeting, useUpdateMeeting, useMeeting, useAgendaTemplates } from '../../hooks/useData';
import { agendaService } from '../../lib/services';
import { emailService } from '../../lib/emailService';
import { useDepartments, useCurrentYear } from '../../hooks/useData';
import { MEETING_CATEGORIES, DOCUMENT_TYPES } from '../../lib/constants';
import { PageHeader, FormField, Spinner } from '../../components/ui/index';

const agendaItemSchema = z.object({
  category:    z.string().min(1, 'Category required'),
  title:       z.string().min(3, 'Title required'),
  description: z.string().optional(),
  responsible_department_id: z.string().optional(),
  priority_level: z.number().min(1).max(4).default(2),
  deadline:    z.string().optional(),
  required_documents: z.array(z.string()).default([]),
});

const schema = z.object({
  agenda_title: z.string().min(5, 'Title must be at least 5 characters'),
  meeting_date: z.string().min(1, 'Meeting date required'),
  meeting_time: z.string().optional(),
  venue:        z.string().min(3, 'Venue required'),
  agenda_items: z.array(agendaItemSchema).min(1, 'Add at least one agenda item'),
  agenda_template_id: z.string().nullable().optional(),
  invited_departments: z.array(z.string()).default([]),
});

const PRIORITY_LABELS = { 1: 'Low', 2: 'Medium', 3: 'High', 4: 'Critical' };

export default function CreateAgendaPage() {
  const { id } = useParams();
  const isEditMode = !!id;
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const createMeeting = useCreateMeeting();
  const updateMeeting = useUpdateMeeting();
  const { data: meetingData, isLoading: loadingMeeting } = useMeeting(id);
  const { data: templates = [] } = useAgendaTemplates();
  const { data: departments = [] } = useDepartments();
  const { data: currentYear } = useCurrentYear();

  const [saving, setSaving] = useState(false);
  const [templateId, setTemplateId] = useState('');

  const { register, control, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      agenda_title: '',
      meeting_date: '',
      meeting_time: '10:00',
      venue: 'Conference Hall, Admin Block',
      agenda_template_id: '',
      invited_departments: [],
      agenda_items: [
        { category: 'Academic Review', title: '', description: '', priority_level: 2, required_documents: [] },
      ],
    },
  });

  const { fields, append, remove, move } = useFieldArray({ control, name: 'agenda_items' });

  // Auto-select all departments in create mode
  useEffect(() => {
    if (departments.length > 0 && !isEditMode && watch('invited_departments')?.length === 0) {
      setValue('invited_departments', departments.map(d => d.id));
    }
  }, [departments, isEditMode, setValue]);

  // Load meeting details if in edit mode
  useEffect(() => {
    if (meetingData && isEditMode) {
      reset({
        agenda_title: meetingData.agenda_title,
        meeting_date: meetingData.meeting_date,
        meeting_time: meetingData.meeting_time || '10:00',
        venue: meetingData.venue || '',
        agenda_template_id: meetingData.agenda_template_id || '',
        invited_departments: meetingData.invited_departments || [],
        agenda_items: meetingData.agenda_items?.map(item => ({
          category: item.category,
          title: item.title,
          description: item.description || '',
          responsible_department_id: item.responsible_department_id || '',
          priority_level: item.priority_level || 2,
          deadline: item.deadline || '',
          required_documents: item.required_documents || [],
        })) || [{ category: 'Academic Review', title: '', description: '', priority_level: 2, required_documents: [] }],
      });
      setTemplateId(meetingData.agenda_template_id || '');
    }
  }, [meetingData, isEditMode, reset]);

  // Handle template selection
  const handleTemplateChange = (e) => {
    const selectedId = e.target.value;
    setTemplateId(selectedId);
    setValue('agenda_template_id', selectedId);

    if (selectedId) {
      const template = templates.find(t => t.id === selectedId);
      if (template) {
        setValue('agenda_title', template.title);
        
        const prefilledItems = template.agenda_items?.map(item => ({
          category: item.category,
          title: item.title,
          description: item.description || '',
          responsible_department_id: '',
          priority_level: item.priority_level || 2,
          deadline: '',
          required_documents: item.required_documents || [],
        })) || [];

        if (prefilledItems.length > 0) {
          setValue('agenda_items', prefilledItems);
        }
        toast.success(`Loaded predefined template: ${template.title}`);
      }
    }
  };

  const onSubmit = async (data, status = 'draft') => {
    setSaving(true);
    try {
      const { agenda_items, ...meetingPayload } = data;
      let meeting;
      
      const payload = {
        ...meetingPayload,
        status,
        agenda_template_id: templateId || null,
      };

      if (isEditMode) {
        meeting = await updateMeeting.mutateAsync({
          id,
          ...payload,
        });
        
        // Recreate agenda items in edit mode
        const { supabase } = await import('../../lib/supabase');
        await supabase.from('agenda_items').delete().eq('meeting_id', id);
      } else {
        meeting = await createMeeting.mutateAsync({
          ...payload,
          created_by: user.id,
        });
      }

      const targetMeetingId = isEditMode ? id : meeting?.id;

      // Create agenda items linked to meeting
      if (targetMeetingId) {
        await agendaService.bulkCreate(
          data.agenda_items.map((item, i) => ({
            ...item,
            meeting_id: targetMeetingId,
            order_number: i + 1,
            responsible_department_id: item.responsible_department_id || null,
            deadline: item.deadline || null,
            required_documents: item.required_documents || [],
          }))
        );

        // Send notifications to all active faculty/HODs if this meeting is being circulated or submitted for approval
        if (status !== 'draft') {
          try {
            const { usersService, notificationsService } = await import('../../lib/services');
            const allUsers = await usersService.list({ isActive: true });
            
            const notifPayloads = allUsers
              .filter(u => ['faculty', 'hod', 'director', 'principal'].includes(u.role))
              .map(u => ({
                user_id: u.id,
                title: isEditMode ? `Meeting Updated: ${data.agenda_title}` : `New Meeting Scheduled: ${data.agenda_title}`,
                message: `A meeting agenda has been ${isEditMode ? 'updated' : 'scheduled'} for ${data.meeting_date} at ${data.meeting_time || '10:00'}. Please review the agenda items and upload any required formatted reports.`,
                read_status: false,
                notification_type: 'meeting',
                priority: 'medium',
                action_url: `/meetings/agendas/${targetMeetingId}`,
                created_at: new Date().toISOString()
              }));

            if (notifPayloads.length > 0) {
              await notificationsService.bulkCreate(notifPayloads);
            }
          } catch (notifErr) {
            console.error('Failed to dispatch notifications:', notifErr);
          }
        }
      }

      toast.success(status === 'pending_approval' ? 'Agenda submitted for approval!' : 'Agenda saved as draft');

      // 📧 Send email notification when submitted for approval
      if (status !== 'draft' && targetMeetingId) {
        emailService.meetingCreated({
          id: targetMeetingId,
          agenda_title: data.agenda_title,
          meeting_date: data.meeting_date,
          meeting_time: data.meeting_time,
          venue: data.venue,
        }); // fire-and-forget
      }

      navigate('/meetings/agendas');
    } catch (err) {
      toast.error(err.message || 'Failed to save agenda');
    } finally {
      setSaving(false);
    }
  };

  const addItem = () => append({
    category: 'Academic Review', title: '', description: '', priority_level: 2, required_documents: []
  });

  const toggleDoc = (index, doc) => {
    const current = watch(`agenda_items.${index}.required_documents`) || [];
    const next = current.includes(doc) ? current.filter(d => d !== doc) : [...current, doc];
    setValue(`agenda_items.${index}.required_documents`, next);
  };

  if (isEditMode && loadingMeeting) {
    return (
      <div className="page-wrapper flex items-center justify-center min-h-[50vh]">
        <Spinner size={32} />
      </div>
    );
  }

  return (
    <div className="page-wrapper max-w-4xl mx-auto">
      <PageHeader
        title={isEditMode ? "Edit Meeting Agenda" : "Create Meeting Agenda"}
        subtitle="Define the agenda items, assign responsibilities, and set document deadlines"
        actions={
          <Link to={isEditMode ? `/meetings/agendas/${id}` : "/meetings/agendas"} className="btn-ghost text-sm">← Back</Link>
        }
      />

      <form onSubmit={handleSubmit(d => onSubmit(d, 'pending_approval'))}>
        {/* Predefined Templates selector - Create Mode Only */}
        {!isEditMode && templates.length > 0 && (
          <div className="card p-5 mb-6 border-l-4 border-emerald-500 bg-emerald-50/10">
            <h3 className="text-sm font-bold text-surface-800 mb-2 flex items-center gap-1.5">
              <FileSpreadsheet size={16} className="text-emerald-600" />
              Use Predefined Agenda Template
            </h3>
            <p className="text-xs text-surface-500 mb-4">
              Select a pre-made agenda template to automatically fill in details, lists of items, and required document upload schemas.
            </p>
            <div className="max-w-md">
              <select 
                value={templateId} 
                onChange={handleTemplateChange}
                className="text-sm bg-white"
              >
                <option value="">-- Choose Predefined Agenda Template --</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Meeting Details */}
        <div className="card p-6 mb-6">
          <h3 className="text-base font-semibold text-surface-800 mb-4">Meeting Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <FormField label="Agenda Title" required error={errors.agenda_title?.message}>
                <input {...register('agenda_title')} placeholder="e.g. Monthly HOD Meeting – June 2025" />
              </FormField>
            </div>
            <FormField label="Meeting Date" required error={errors.meeting_date?.message}>
              <input type="date" {...register('meeting_date')} />
            </FormField>
            <FormField label="Meeting Time" error={errors.meeting_time?.message}>
              <input type="time" {...register('meeting_time')} />
            </FormField>
            <div className="sm:col-span-2">
              <FormField label="Venue" required error={errors.venue?.message}>
                <input {...register('venue')} placeholder="e.g. Conference Hall, Admin Block" />
              </FormField>
            </div>
            <div className="sm:col-span-2 mt-2">
              <label className="form-label font-medium mb-1.5 block">Invited Departments</label>
              {departments.length === 0 ? (
                <p className="text-xs text-surface-400">Loading departments...</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 p-4 border border-surface-200 rounded-xl bg-surface-50/50">
                  {departments.map((dept) => {
                    const selected = watch('invited_departments')?.includes(dept.id);
                    return (
                      <label
                        key={dept.id}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all ${
                          selected
                            ? 'bg-primary-50 border-primary-300 text-primary-800'
                            : 'bg-white border-surface-200 text-surface-600 hover:border-surface-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          value={dept.id}
                          checked={selected}
                          onChange={(e) => {
                            const current = watch('invited_departments') || [];
                            if (e.target.checked) {
                              setValue('invited_departments', [...current, dept.id]);
                            } else {
                              setValue('invited_departments', current.filter((id) => id !== dept.id));
                            }
                          }}
                          className="rounded border-surface-300 text-primary-600 focus:ring-primary-500 w-4 h-4"
                        />
                        <span className="text-xs font-semibold">{dept.code} - {dept.name}</span>
                      </label>
                    );
                  })}
                </div>
              )}
              {errors.invited_departments?.message && (
                <p className="text-xs text-danger-500 mt-1">{errors.invited_departments.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* Agenda Items */}
        <div className="space-y-4 mb-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-surface-800">
              Agenda Items <span className="text-sm font-normal text-surface-400">({fields.length})</span>
            </h3>
            <button type="button" onClick={addItem} className="btn-secondary text-sm">
              <Plus size={14} /> Add Item
            </button>
          </div>

          {errors.agenda_items?.message && (
            <div className="alert-danger"><AlertCircle size={16} />{errors.agenda_items.message}</div>
          )}

          {fields.map((field, index) => {
            const item = watch(`agenda_items.${index}`);
            return (
              <div key={field.id} className="card p-5 border-l-4 border-primary-400">
                {/* Item header */}
                <div className="flex items-center gap-3 mb-3">
                  <span className="w-6 h-6 rounded-lg bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <input
                      {...register(`agenda_items.${index}.title`)}
                      placeholder="Agenda item title…"
                      className="font-medium text-sm border-0 p-0 bg-transparent focus:ring-0 w-full"
                    />
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button type="button" onClick={() => index > 0 && move(index, index - 1)} className="btn-ghost p-1" title="Move up">
                      <ChevronUp size={14} />
                    </button>
                    <button type="button" onClick={() => move(index, index + 1)} className="btn-ghost p-1" title="Move down">
                      <ChevronDown size={14} />
                    </button>
                    {fields.length > 1 && (
                      <button type="button" onClick={() => remove(index)} className="btn-ghost p-1 text-danger-500 hover:text-danger-700 hover:bg-danger-50">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <FormField label="Category">
                    <select {...register(`agenda_items.${index}.category`)} className="text-sm bg-white">
                      {MEETING_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </FormField>
                  <FormField label="Responsible Dept">
                    <select {...register(`agenda_items.${index}.responsible_department_id`)} className="text-sm bg-white">
                      <option value="">All Departments</option>
                      {departments.map(d => <option key={d.id} value={d.id}>{d.code} – {d.name}</option>)}
                    </select>
                  </FormField>
                  <FormField label="Priority">
                    <select {...register(`agenda_items.${index}.priority_level`, { valueAsNumber: true })} className="text-sm bg-white">
                      {[1,2,3,4].map(p => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
                    </select>
                  </FormField>
                  <div className="sm:col-span-2">
                    <FormField label="Description">
                      <textarea {...register(`agenda_items.${index}.description`)} rows={2} placeholder="Optional details…" className="text-sm bg-white" />
                    </FormField>
                  </div>
                  <FormField label="Document Deadline">
                    <input type="date" {...register(`agenda_items.${index}.deadline`)} className="text-sm bg-white" />
                  </FormField>
                  <div className="sm:col-span-3">
                    <label className="form-label">Required Documents</label>
                    <div className="flex flex-wrap gap-2 p-3 border border-surface-200 rounded-xl bg-white">
                      {DOCUMENT_TYPES.slice(0, 12).map(doc => {
                        const selected = (item?.required_documents || []).includes(doc);
                        return (
                          <button
                            key={doc}
                            type="button"
                            onClick={() => toggleDoc(index, doc)}
                            className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
                              selected
                                ? 'bg-primary-600 text-white border-primary-600'
                                : 'bg-white text-surface-600 border-surface-200 hover:border-primary-300'
                            }`}
                          >
                            {doc}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          <button type="button" onClick={addItem}
                  className="w-full border-2 border-dashed border-surface-200 rounded-2xl p-4 text-sm text-surface-400
                             hover:border-primary-300 hover:text-primary-600 transition-colors flex items-center justify-center gap-2 bg-white">
            <Plus size={16} /> Add Another Agenda Item
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between gap-4 sticky bottom-0 bg-surface-50/90 backdrop-blur py-4 -mx-6 px-6 border-t border-surface-200 z-20">
          <Link to={isEditMode ? `/meetings/agendas/${id}` : "/meetings/agendas"} className="btn-ghost">Cancel</Link>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSubmit(d => onSubmit(d, 'draft'))}
              disabled={saving}
              className="btn-secondary"
            >
              {saving ? <Spinner size={16} /> : <Save size={15} />}
              Save Draft
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? <Spinner size={16} className="border-t-white border-white/30" /> : <Send size={15} />}
              Submit for Approval
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
