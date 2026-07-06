import { supabase } from './supabase';

// ─── Generic fetch helpers ────────────────────────────────────────────────────

export async function fetchAll(table, options = {}) {
  const { select = '*', filters = [], order, limit } = options;
  let q = supabase.from(table).select(select);
  filters.forEach(([col, op, val]) => { q = q.filter(col, op, val); });
  if (order) q = q.order(order.col, { ascending: order.asc ?? true });
  if (limit) q = q.limit(limit);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function fetchOne(table, id, select = '*') {
  const { data, error } = await supabase.from(table).select(select).eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function insertRow(table, payload) {
  const { data, error } = await supabase.from(table).insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function updateRow(table, id, payload) {
  const { data, error } = await supabase.from(table).update(payload).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteRow(table, id) {
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) throw error;
}

export async function upsertRow(table, payload, conflict) {
  const { data, error } = await supabase.from(table).upsert(payload, { onConflict: conflict }).select().single();
  if (error) throw error;
  return data;
}

// ─── Pagination helper ────────────────────────────────────────────────────────

export async function fetchPaged(table, { select = '*', filters = [], order, page = 1, pageSize = 20 } = {}) {
  const from = (page - 1) * pageSize;
  const to   = from + pageSize - 1;
  let q = supabase.from(table).select(select, { count: 'exact' });
  filters.forEach(([col, op, val]) => { q = q.filter(col, op, val); });
  if (order) q = q.order(order.col, { ascending: order.asc ?? true });
  q = q.range(from, to);
  const { data, count, error } = await q;
  if (error) throw error;
  return { data: data ?? [], total: count ?? 0, page, pageSize, pages: Math.ceil((count ?? 0) / pageSize) };
}

// ─── Storage helpers ──────────────────────────────────────────────────────────

export async function uploadFile(bucket, path, file) {
  const { data, error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
  if (error) throw error;
  const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path);
  return publicUrl;
}

export async function deleteFile(bucket, path) {
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) throw error;
}

export function getPublicUrl(bucket, path) {
  const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path);
  return publicUrl;
}

// ─── Formatted date helpers ───────────────────────────────────────────────────

export function toDbDate(date) {
  if (!date) return null;
  return new Date(date).toISOString().split('T')[0];
}

export function formatDate(dateStr, opts = {}) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    year: 'numeric', month: 'short', day: 'numeric', ...opts
  });
}

export function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('en-IN', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}
