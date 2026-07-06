import React, { useState } from 'react';
import {
  Plus, Trash2, Edit2, Save, X, ChevronUp, ChevronDown, 
  FileSpreadsheet, FileText, CheckCircle, Info, Calendar, ListTodo,
  Maximize2, Minimize2
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  useAgendaTemplates,
  useCreateAgendaTemplate,
  useUpdateAgendaTemplate,
  useDeleteAgendaTemplate
} from '../../hooks/useData';
import { MEETING_CATEGORIES, DOCUMENT_TYPES, PRIORITY_LABELS, PRIORITY_COLORS } from '../../lib/constants';
import { PageHeader, FormField, Spinner, EmptyState } from '../../components/ui/index';

export default function AgendaTemplatesPage() {
  const { data: templates = [], isLoading, refetch } = useAgendaTemplates();
  const createMutation = useCreateAgendaTemplate();
  const updateMutation = useUpdateAgendaTemplate();
  const deleteMutation = useDeleteAgendaTemplate();

  const [editingTemplate, setEditingTemplate] = useState(null); // template or empty object
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Designer local state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [agendaItems, setAgendaItems] = useState([]);
  const [columns, setColumns] = useState([]); // [{ name: 'Col Name', type: 'text|number|date', parent: 'Parent' }]
  const [rows, setRows] = useState([]); // [{ 'Col Name': 'val' }]
  const [isGridFullScreen, setIsGridFullScreen] = useState(false);

  // Add column form
  const [newColName, setNewColName] = useState('');
  const [newColType, setNewColType] = useState('text');
  const [newColParent, setNewColParent] = useState('');

  // Helper to render dual-row header when columns have parents
  const renderMultiLevelHeader = (cols, includeAction = false, actionHeader = "Action") => {
    const hasParent = cols.some(col => col.parent);
    if (!hasParent) {
      return (
        <tr className="bg-slate-50 border-b border-surface-200 sticky top-0 z-10">
          <th className="p-2.5 w-10 border-r border-surface-200 text-center font-bold text-slate-400">#</th>
          {cols.map((col, idx) => (
            <th key={idx} className="p-2.5 border-r border-surface-200 font-bold text-surface-700 min-w-[150px]">
              <div className="flex items-center justify-between">
                <span>{col.name}</span>
                <span className="text-[9px] font-normal text-slate-400 lowercase italic bg-slate-100/50 px-1 rounded">
                  {col.type}
                </span>
              </div>
            </th>
          ))}
          {includeAction && (
            <th className="p-2.5 w-12 text-center font-bold text-slate-400">{actionHeader}</th>
          )}
        </tr>
      );
    }

    const row1 = [];
    const row2 = [];

    // Index column in Row 1
    row1.push(
      <th key="index-col" rowSpan={2} className="p-2.5 w-10 border-r border-b border-surface-200 text-center font-bold text-slate-400 bg-slate-50 sticky top-0 z-20">
        #
      </th>
    );

    // Group columns by parent to get colSpan
    const parentGroups = {};
    cols.forEach(col => {
      if (col.parent) {
        if (!parentGroups[col.parent]) {
          parentGroups[col.parent] = [];
        }
        parentGroups[col.parent].push(col);
      }
    });

    const processedParents = new Set();

    cols.forEach((col, idx) => {
      if (!col.parent) {
        row1.push(
          <th key={`r1-col-${idx}`} rowSpan={2} className="p-2.5 border-r border-b border-surface-200 font-bold text-surface-700 min-w-[150px] bg-slate-50 text-left sticky top-0 z-20">
            <div className="flex items-center justify-between">
              <span>{col.name}</span>
              <span className="text-[9px] font-normal text-slate-400 lowercase italic bg-slate-100/50 px-1 rounded">
                {col.type}
              </span>
            </div>
          </th>
        );
      } else {
        if (!processedParents.has(col.parent)) {
          processedParents.add(col.parent);
          const children = parentGroups[col.parent];
          row1.push(
            <th
              key={`r1-parent-${col.parent}`}
              colSpan={children.length}
              className="p-2 border-r border-b border-surface-200 text-center font-bold text-primary-700 bg-primary-50/50 sticky top-0 z-20"
            >
              {col.parent}
            </th>
          );
        }
        row2.push(
          <th key={`r2-col-${idx}`} className="p-2 border-r border-b border-surface-200 font-semibold text-surface-600 min-w-[120px] bg-slate-50 text-left sticky top-8 z-20">
            <div className="flex items-center justify-between">
              <span>{col.name}</span>
              <span className="text-[9px] font-normal text-slate-400 lowercase italic bg-slate-100/50 px-1 rounded">
                {col.type}
              </span>
            </div>
          </th>
        );
      }
    });

    if (includeAction) {
      row1.push(
        <th key="action-col" rowSpan={2} className="p-2.5 w-12 border-b border-surface-200 text-center font-bold text-slate-400 bg-slate-50 sticky top-0 z-20">
          {actionHeader}
        </th>
      );
    }

    return (
      <>
        <tr className="bg-slate-50 sticky top-0 z-10">{row1}</tr>
        <tr className="bg-slate-50 sticky top-[38px] z-10">{row2}</tr>
      </>
    );
  };

  const startCreate = () => {
    setTitle('');
    setDescription('');
    setAgendaItems([
      { category: 'Academic Review', title: '', description: '', priority_level: 2, required_documents: [] }
    ]);
    setColumns([
      { name: 'Department', type: 'text', parent: null },
      { name: 'Target Value', type: 'number', parent: null },
      { name: 'Completion Date', type: 'date', parent: null }
    ]);
    setRows([
      { 'Department': 'Computer Engineering', 'Target Value': '85', 'Completion Date': '' }
    ]);
    setEditingTemplate(null);
    setIsEditing(true);
  };

  const startEdit = (template) => {
    setTitle(template.title);
    setDescription(template.description || '');
    setAgendaItems(template.agenda_items || []);
    
    const schema = template.format_schema || {};
    setColumns(schema.columns || []);
    setRows(schema.rows || []);
    
    setEditingTemplate(template);
    setIsEditing(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this agenda template?')) return;
    try {
      await deleteMutation.mutateAsync(id);
      toast.success('Agenda template deleted successfully');
      refetch();
    } catch (err) {
      toast.error(err.message || 'Failed to delete template');
    }
  };

  // Predefined Items Helpers
  const addAgendaItem = () => {
    setAgendaItems([
      ...agendaItems,
      { category: 'Academic Review', title: '', description: '', priority_level: 2, required_documents: [] }
    ]);
  };

  const removeAgendaItem = (index) => {
    setAgendaItems(agendaItems.filter((_, i) => i !== index));
  };

  const updateAgendaItem = (index, field, value) => {
    const updated = [...agendaItems];
    updated[index] = { ...updated[index], [field]: value };
    setAgendaItems(updated);
  };

  const toggleItemDoc = (index, doc) => {
    const current = agendaItems[index].required_documents || [];
    const next = current.includes(doc) ? current.filter(d => d !== doc) : [...current, doc];
    updateAgendaItem(index, 'required_documents', next);
  };

  const moveAgendaItem = (index, direction) => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === agendaItems.length - 1) return;
    
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    const updated = [...agendaItems];
    const temp = updated[index];
    updated[index] = updated[targetIdx];
    updated[targetIdx] = temp;
    setAgendaItems(updated);
  };

  // Format Designer Column Helpers
  const addColumn = (e) => {
    e.preventDefault();
    const name = newColName.trim();
    const parent = newColParent.trim() || null;
    if (!name) return toast.error('Column name cannot be empty');
    if (columns.some(col => col.name.toLowerCase() === name.toLowerCase())) {
      return toast.error('A column with this name already exists');
    }

    const newCol = { name, type: newColType, parent };
    setColumns([...columns, newCol]);

    // Update all existing rows with empty values for new column
    const updatedRows = rows.map(row => ({ ...row, [name]: '' }));
    setRows(updatedRows);

    setNewColName('');
    setNewColParent('');
    toast.success(`Column "${name}" added`);
  };

  const removeColumn = (colIndex) => {
    const colName = columns[colIndex].name;
    setColumns(columns.filter((_, i) => i !== colIndex));
    // Remove the key from all rows
    const updatedRows = rows.map(row => {
      const copy = { ...row };
      delete copy[colName];
      return copy;
    });
    setRows(updatedRows);
  };

  // Format Designer Rows Helpers
  const addRow = () => {
    const newRow = {};
    columns.forEach(col => {
      newRow[col.name] = '';
    });
    setRows([...rows, newRow]);
  };

  const removeRow = (rowIndex) => {
    setRows(rows.filter((_, i) => i !== rowIndex));
  };

  const updateCell = (rowIndex, colName, value) => {
    const updated = [...rows];
    updated[rowIndex] = { ...updated[rowIndex], [colName]: value };
    setRows(updated);
  };

  const renderTable = () => {
    return (
      <table className="w-full border-collapse text-left text-xs bg-white">
        <thead>
          {renderMultiLevelHeader(columns, true)}
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length + 2} className="p-6 text-center text-surface-400 italic">
                Grid is empty. Click "Add Row" to enter prefilled data rows.
              </td>
            </tr>
          ) : (
            rows.map((row, rIdx) => (
              <tr key={rIdx} className="border-b border-surface-100 hover:bg-slate-50/40">
                <td className="p-2 border-r border-surface-200 text-center font-semibold text-slate-400 bg-slate-50/50">
                  {rIdx + 1}
                </td>
                {columns.map((col, cIdx) => (
                  <td key={cIdx} className="p-1.5 border-r border-surface-100">
                    {col.type === 'date' ? (
                      <input
                        type="date"
                        value={row[col.name] || ''}
                        onChange={e => updateCell(rIdx, col.name, e.target.value)}
                        className="w-full border-0 p-1 focus:ring-1 focus:ring-primary-500 rounded bg-transparent focus:bg-white text-xs h-7"
                      />
                    ) : col.type === 'number' ? (
                      <input
                        type="number"
                        value={row[col.name] || ''}
                        onChange={e => updateCell(rIdx, col.name, e.target.value)}
                        className="w-full border-0 p-1 focus:ring-1 focus:ring-primary-500 rounded bg-transparent focus:bg-white text-xs h-7"
                      />
                    ) : (
                      <input
                        type="text"
                        value={row[col.name] || ''}
                        onChange={e => updateCell(rIdx, col.name, e.target.value)}
                        className="w-full border-0 p-1 focus:ring-1 focus:ring-primary-500 rounded bg-transparent focus:bg-white text-xs h-7"
                      />
                    )}
                  </td>
                ))}
                <td className="p-2 text-center">
                  <button
                     type="button"
                     onClick={() => removeRow(rIdx)}
                     className="p-1 text-surface-400 hover:text-danger-600 rounded transition-colors"
                     title="Delete Row"
                  >
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    );
  };

  // Save flow
  const handleSave = async (e) => {
    e.preventDefault();
    if (!title.trim()) return toast.error('Agenda template title is required');
    if (agendaItems.length === 0) return toast.error('Add at least one predefined agenda item');
    if (columns.length === 0) return toast.error('You must define at least one spreadsheet column');

    setSaving(true);
    const payload = {
      title,
      description,
      agenda_items: agendaItems,
      format_schema: {
        columns,
        rows
      }
    };

    try {
      if (editingTemplate) {
        await updateMutation.mutateAsync({ id: editingTemplate.id, ...payload });
        toast.success('Agenda template updated successfully');
      } else {
        await createMutation.mutateAsync(payload);
        toast.success('Predefined agenda template created');
      }
      setIsEditing(false);
      refetch();
    } catch (err) {
      toast.error(err.message || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="page-wrapper flex items-center justify-center min-h-[50vh]">
        <Spinner size={32} />
      </div>
    );
  }

  return (
    <div className="page-wrapper max-w-6xl mx-auto">
      {!isEditing ? (
        <>
          <PageHeader
            title="Predefined Agendas"
            subtitle="Create pre-configured agenda items and visual spreadsheet formats that can be linked to meetings instantly."
            actions={
              <button onClick={startCreate} className="btn-primary">
                <Plus size={16} /> Create Agenda Template
              </button>
            }
          />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.length === 0 ? (
              <div className="col-span-full">
                <EmptyState
                  icon={FileSpreadsheet}
                  title="No predefined agendas"
                  description="Predefined agendas let you prefill meetings and design custom uploader spreadsheet formats."
                  action={
                    <button onClick={startCreate} className="btn-primary">
                      Create First Template
                    </button>
                  }
                />
              </div>
            ) : (
              templates.map(tmpl => {
                const schema = tmpl.format_schema || {};
                const cols = schema.columns || [];
                const dRows = schema.rows || [];

                return (
                  <div key={tmpl.id} className="card p-5 hover:shadow-lg transition-all border border-surface-100 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="p-2 bg-primary-50 rounded-xl">
                          <FileSpreadsheet size={20} className="text-primary-600" />
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => startEdit(tmpl)} className="btn-ghost p-1.5 text-surface-500 hover:text-primary-600" title="Edit Template">
                            <Edit2 size={14} />
                          </button>
                          <button onClick={() => handleDelete(tmpl.id)} className="btn-ghost p-1.5 text-surface-500 hover:text-danger-600" title="Delete Template">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      <h3 className="font-bold text-surface-800 text-base mb-1 line-clamp-1">{tmpl.title}</h3>
                      <p className="text-xs text-surface-500 line-clamp-2 mb-4 h-8">{tmpl.description || 'No description provided.'}</p>
                      
                      <div className="space-y-2 border-t border-surface-50 pt-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-surface-400 flex items-center gap-1"><ListTodo size={13} /> Agenda Items</span>
                          <span className="font-semibold text-surface-700 bg-surface-50 px-2 py-0.5 rounded-md">
                            {tmpl.agenda_items?.length ?? 0} items
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-surface-400 flex items-center gap-1"><FileSpreadsheet size={13} /> Spreadsheet Columns</span>
                          <span className="font-semibold text-surface-700 bg-surface-50 px-2 py-0.5 rounded-md">
                            {cols.length} cols
                          </span>
                        </div>
                        {cols.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {cols.slice(0, 4).map((c, i) => (
                              <span key={i} className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                                {c.name}
                              </span>
                            ))}
                            {cols.length > 4 && (
                              <span className="text-[10px] text-slate-400 px-1 py-0.5">+{cols.length - 4} more</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-surface-100 flex items-center justify-end">
                      <button onClick={() => startEdit(tmpl)} className="text-xs font-semibold text-primary-600 hover:text-primary-700 flex items-center gap-1">
                        View & Edit template →
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          <PageHeader
            title={editingTemplate ? "Edit Agenda Template" : "Create Predefined Agenda"}
            subtitle="Design default meeting agenda titles, configure predefined items, and define structural Excel uploader grids."
            actions={
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setIsEditing(false)} className="btn-ghost">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? <Spinner size={14} className="border-t-white border-white/30" /> : <Save size={14} />}
                  Save Template
                </button>
              </div>
            }
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Side: General Info & Predefined Agenda Items */}
            <div className="lg:col-span-1 space-y-6">
              {/* Core Details */}
              <div className="card p-5">
                <h3 className="text-sm font-bold text-surface-800 mb-4 flex items-center gap-2">
                  <span className="w-1.5 h-4 bg-primary-600 rounded-full" />
                  Template Information
                </h3>
                <div className="space-y-4">
                  <FormField label="Agenda Title" required>
                    <input
                      type="text"
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      placeholder="e.g. Monthly Academic Audit & Course Files review"
                      className="text-sm"
                    />
                  </FormField>
                  <FormField label="Description">
                    <textarea
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      placeholder="Explain the purpose of this pre-made agenda format..."
                      rows={3}
                      className="text-sm"
                    />
                  </FormField>
                </div>
              </div>

              {/* Items checklist */}
              <div className="card p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-surface-800 flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-primary-600 rounded-full" />
                    Agenda Items ({agendaItems.length})
                  </h3>
                  <button type="button" onClick={addAgendaItem} className="text-xs font-semibold text-primary-600 hover:text-primary-700 flex items-center gap-0.5">
                    <Plus size={14} /> Add Item
                  </button>
                </div>

                <div className="space-y-4 max-h-[450px] overflow-y-auto pr-1 no-scrollbar">
                  {agendaItems.map((item, index) => (
                    <div key={index} className="p-3 bg-surface-50 border border-surface-200 rounded-xl space-y-3 relative group">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-primary-700 bg-primary-50 px-2 py-0.5 rounded-md">
                          Item #{index + 1}
                        </span>
                        <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                          <button type="button" onClick={() => moveAgendaItem(index, 'up')} className="btn-ghost p-1" title="Move Up">
                            <ChevronUp size={12} />
                          </button>
                          <button type="button" onClick={() => moveAgendaItem(index, 'down')} className="btn-ghost p-1" title="Move Down">
                            <ChevronDown size={12} />
                          </button>
                          {agendaItems.length > 1 && (
                            <button type="button" onClick={() => removeAgendaItem(index)} className="btn-ghost p-1 text-danger-500 hover:text-danger-700" title="Delete Item">
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </div>

                      <FormField label="Category">
                        <select
                          value={item.category}
                          onChange={e => updateAgendaItem(index, 'category', e.target.value)}
                          className="text-xs py-1"
                        >
                          {MEETING_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </FormField>

                      <FormField label="Agenda Item Title">
                        <input
                          type="text"
                          value={item.title}
                          onChange={e => updateAgendaItem(index, 'title', e.target.value)}
                          placeholder="e.g. Audit of Weak student identifiers"
                          className="text-xs py-1"
                        />
                      </FormField>

                      <FormField label="Priority">
                        <select
                          value={item.priority_level}
                          onChange={e => updateAgendaItem(index, 'priority_level', parseInt(e.target.value))}
                          className="text-xs py-1"
                        >
                          {[1, 2, 3, 4].map(p => (
                            <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
                          ))}
                        </select>
                      </FormField>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-surface-400 uppercase tracking-wider block">Required Documents</label>
                        <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto p-1.5 bg-white border border-surface-200 rounded-lg no-scrollbar">
                          {DOCUMENT_TYPES.slice(0, 12).map(doc => {
                            const selected = (item.required_documents || []).includes(doc);
                            return (
                              <button
                                key={doc}
                                type="button"
                                onClick={() => toggleItemDoc(index, doc)}
                                className={`text-[10px] px-1.5 py-0.5 rounded border transition-all ${
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
                  ))}
                </div>
              </div>
            </div>

            {/* Right Side: Visual Excel Layout Designer Workspace */}
            <div className="lg:col-span-2 space-y-6">
              <div className="card p-6">
                <h3 className="text-base font-bold text-surface-800 mb-2 flex items-center gap-2">
                  <span className="p-1.5 bg-success-50 rounded-lg text-success-600">
                    <FileSpreadsheet size={16} />
                  </span>
                  Visual Excel Format Designer
                </h3>
                <p className="text-xs text-surface-400 mb-6 leading-relaxed">
                  Design the exact spreadsheet layout faculty members must upload. Define the columns (with data-types) and edit prefilled default rows (e.g. standard subjects or departments).
                </p>

                {/* Column Layout Builder */}
                <div className="bg-surface-50 p-4 border border-surface-200 rounded-2xl mb-6">
                  <h4 className="text-xs font-bold text-surface-700 mb-3 block">1. Define Columns Schema</h4>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {columns.length === 0 ? (
                      <span className="text-xs text-surface-400 italic">No columns defined yet. Add columns below.</span>
                    ) : (
                      columns.map((col, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 bg-white border border-surface-200 text-xs px-2.5 py-1.5 rounded-xl shadow-sm">
                          {col.parent && (
                            <span className="text-[10px] text-primary-600 bg-primary-50 px-1 py-0.5 rounded font-bold">
                              {col.parent} &gt;
                            </span>
                          )}
                          <span className="font-semibold text-surface-800">{col.name}</span>
                          <span className="text-[10px] bg-slate-100 text-slate-500 px-1 rounded uppercase">{col.type}</span>
                          <button
                            type="button"
                            onClick={() => removeColumn(idx)}
                            className="text-surface-400 hover:text-danger-500 transition-colors ml-1"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Add Column Mini-Form */}
                  <div className="flex flex-wrap items-end gap-3 pt-3 border-t border-dashed border-surface-200">
                    <div className="w-48">
                      <FormField label="Column Header Name">
                        <input
                          type="text"
                          value={newColName}
                          onChange={e => setNewColName(e.target.value)}
                          placeholder="e.g. Student Enrollment"
                          className="text-xs bg-white"
                        />
                      </FormField>
                    </div>
                    <div className="w-32">
                      <FormField label="Validation Type">
                        <select
                          value={newColType}
                          onChange={e => setNewColType(e.target.value)}
                          className="text-xs bg-white"
                        >
                          <option value="text">Text</option>
                          <option value="number">Number</option>
                          <option value="date">Date</option>
                        </select>
                      </FormField>
                    </div>
                    <div className="w-48">
                      <FormField label="Parent Group Header (optional)">
                        <input
                          type="text"
                          value={newColParent}
                          onChange={e => setNewColParent(e.target.value)}
                          placeholder="e.g. Subject, Marks"
                          className="text-xs bg-white"
                        />
                      </FormField>
                    </div>
                    <button
                      type="button"
                      onClick={addColumn}
                      className="btn-secondary text-xs h-9 py-1 px-3"
                    >
                      <Plus size={14} /> Add Column
                    </button>
                  </div>
                </div>

                {/* Spreadsheet Visual Grid */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-surface-700">2. Interactive Sheet Preview & Default Values</h4>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setIsGridFullScreen(true)}
                        disabled={columns.length === 0}
                        className={`text-xs font-semibold flex items-center gap-1 ${
                          columns.length === 0 ? 'text-surface-300 cursor-not-allowed' : 'text-primary-600 hover:text-primary-700 transition-colors'
                        }`}
                        title="Open in Full Screen Editor"
                      >
                        <Maximize2 size={13} /> Full Screen
                      </button>
                      <button
                        type="button"
                        onClick={addRow}
                        disabled={columns.length === 0}
                        className={`text-xs font-semibold flex items-center gap-0.5 ${
                          columns.length === 0 ? 'text-surface-300 cursor-not-allowed' : 'text-success-600 hover:text-success-700'
                        }`}
                      >
                        <Plus size={14} /> Add Row
                      </button>
                    </div>
                  </div>

                  {columns.length === 0 ? (
                    <div className="border border-dashed border-surface-200 rounded-2xl p-12 text-center text-surface-400 text-xs">
                      Please define at least one column above to render the interactive grid designer.
                    </div>
                  ) : (
                    <div className="border border-surface-200 rounded-2xl overflow-hidden shadow-inner max-h-[400px] overflow-auto">
                      {renderTable()}
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/60 p-3 rounded-xl text-[11px] text-slate-500 mt-2">
                    <Info size={14} className="text-slate-400 flex-shrink-0" />
                    <span>Double click on cells to edit contents directly. These prefilled rows will show as sample values when HODs upload.</span>
                  </div>
                </div>

                {/* Full Screen Grid overlay */}
                {isGridFullScreen && (
                  <div className="fixed inset-0 z-50 bg-slate-50 flex flex-col p-6 overflow-hidden animate-in fade-in zoom-in duration-150">
                    <div className="flex items-center justify-between bg-white border border-surface-200 px-6 py-4 rounded-2xl shadow-sm mb-4">
                      <div className="flex items-center gap-3">
                        <span className="p-2 bg-success-50 rounded-xl text-success-600">
                          <FileSpreadsheet size={20} />
                        </span>
                        <div>
                          <h3 className="font-bold text-surface-800 text-sm">Visual Excel Format Designer (Full Screen Mode)</h3>
                          <p className="text-[11px] text-surface-500">Previewing template layout for "{title || 'Untitled Agenda'}" with {columns.length} columns and {rows.length} rows.</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={addRow}
                          disabled={columns.length === 0}
                          className={`btn-secondary text-xs flex items-center gap-1 bg-white hover:bg-slate-50 border border-slate-200 text-success-600 font-semibold px-3 py-1.5 rounded-xl h-9 shadow-sm ${
                            columns.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                        >
                          <Plus size={14} /> Add Row
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsGridFullScreen(false)}
                          className="btn-primary text-xs flex items-center gap-1.5 px-4 py-1.5 rounded-xl h-9 shadow-md shadow-primary-200"
                        >
                          <Minimize2 size={14} /> Exit Full Screen
                        </button>
                      </div>
                    </div>

                    <div className="flex-1 flex gap-6 overflow-hidden">
                      {/* Left Sidebar: Column Schema Editor */}
                      <div className="w-80 bg-white border border-surface-200 rounded-2xl p-5 flex flex-col overflow-hidden shadow-sm">
                        <div className="flex items-center justify-between pb-3 border-b border-surface-100 mb-4 flex-shrink-0">
                          <h4 className="text-xs font-bold text-surface-800 flex items-center gap-1.5">
                            <span className="w-1.5 h-3.5 bg-primary-600 rounded-full" />
                            Define Columns Schema
                          </h4>
                          <span className="text-[10px] font-semibold bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full">
                            {columns.length} Columns
                          </span>
                        </div>

                        {/* Columns List - Scrollable */}
                        <div className="flex-1 overflow-y-auto space-y-2 pr-1 mb-4 no-scrollbar">
                          {columns.length === 0 ? (
                            <div className="text-center text-xs text-surface-400 italic py-8">
                              No columns defined. Add columns below.
                            </div>
                          ) : (
                            columns.map((col, idx) => (
                              <div key={idx} className="flex items-center justify-between bg-surface-50 border border-surface-200 text-xs p-2.5 rounded-xl hover:border-primary-300 transition-all">
                                <div className="flex flex-col gap-0.5 min-w-0 pr-2">
                                  {col.parent && (
                                    <span className="text-[9px] text-primary-600 font-bold uppercase truncate max-w-[150px]">
                                      {col.parent} &gt;
                                    </span>
                                  )}
                                  <span className="font-semibold text-surface-800 truncate max-w-[180px]">{col.name}</span>
                                  <span className="text-[9px] text-slate-400 font-medium italic lowercase">{col.type}</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeColumn(idx)}
                                  className="text-surface-400 hover:text-danger-500 transition-colors p-1"
                                  title="Delete Column"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            ))
                          )}
                        </div>

                        {/* Add Column mini form at bottom */}
                        <div className="pt-4 border-t border-surface-200 space-y-3 flex-shrink-0">
                          <h5 className="text-[11px] font-bold text-surface-700 uppercase tracking-wider">Add New Column</h5>
                          <FormField label="Column Header Name">
                            <input
                              type="text"
                              value={newColName}
                              onChange={e => setNewColName(e.target.value)}
                              placeholder="e.g. Student Enrollment"
                              className="text-xs bg-white py-1.5"
                            />
                          </FormField>
                          <FormField label="Validation Type">
                            <select
                              value={newColType}
                              onChange={e => setNewColType(e.target.value)}
                              className="text-xs bg-white py-1.5"
                            >
                              <option value="text">Text</option>
                              <option value="number">Number</option>
                              <option value="date">Date</option>
                            </select>
                          </FormField>
                          <FormField label="Parent Group Header (optional)">
                            <input
                              type="text"
                              value={newColParent}
                              onChange={e => setNewColParent(e.target.value)}
                              placeholder="e.g. Subject, Marks"
                              className="text-xs bg-white py-1.5"
                            />
                          </FormField>
                          <button
                            type="button"
                            onClick={addColumn}
                            className="btn-secondary w-full text-xs h-9 py-1.5 flex items-center justify-center gap-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-primary-600 font-semibold rounded-xl"
                          >
                            <Plus size={14} /> Add Column
                          </button>
                        </div>
                      </div>

                      {/* Right Panel: Spreadsheet Visual Grid */}
                      <div className="flex-1 bg-white border border-surface-200 rounded-2xl shadow-inner overflow-auto flex flex-col justify-center">
                        {columns.length === 0 ? (
                          <div className="p-12 text-center text-surface-400 text-xs">
                            <FileSpreadsheet size={40} className="mx-auto text-surface-300 mb-3" />
                            Please define at least one column in the sidebar to render the spreadsheet grid.
                          </div>
                        ) : (
                          <div className="flex-1 overflow-auto">
                            {renderTable()}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200/60 p-3 rounded-xl text-[11px] text-slate-500 mt-4 shadow-sm">
                      <Info size={14} className="text-slate-400 flex-shrink-0" />
                      <span>Double click on cells to edit contents directly. Changes are preserved seamlessly in real-time.</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
