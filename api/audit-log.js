// api/audit-log.js
// =====================================================================
// يخدم غرضين: 1) سجل تتبّع العمليات الحساسة (list، أدمن فقط، للقراءة).
// 2) نظام المراسلات الكامل — رسالة أصلية من أعلى تبقى دائماً، الردود
// تُحذَف تلقائياً 24 ساعة بعد قراءتها (تنظيف كسول عند كل فتح للموضوع)،
// فلتر كلمات ممنوعة يديره الأدمن، حظر تلقائي فوري + بلاغ عند مخالفة.
// دُمِجا بنفس الملف لتفادي تجاوز حد الـ12 دالة بخطة Vercel المجانية.
// =====================================================================

import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { createRouter } from '../lib/router.js';
import { z } from 'zod';
import { validateBody } from '../lib/validation.js';

/* ===================== سجل التتبّع ===================== */
async function handleList(req, res) {
  const user = requireAuth(req);
  requireRole(user, ['role_admin']);
  const { data, error } = await supabaseAdmin.from('audit_log').select('*').order('created_at', { ascending: false }).limit(300);
  if (error) throw error;
  return res.status(200).json({ success: true, data });
}

/* ===================== أدوات مساعدة للمراسلات ===================== */
async function findBlockedTerm(text) {
  const { data: terms } = await supabaseAdmin.from('blocked_terms').select('term');
  if (!terms || !terms.length) return null;
  const lower = text.toLowerCase();
  const found = terms.find((t) => t.term && lower.includes(t.term.toLowerCase()));
  return found ? found.term : null;
}

async function isSenderBlocked(personId, personType) {
  const { data } = await supabaseAdmin.from('blocked_senders').select('id').eq('person_id', personId).eq('person_type', personType).is('unblocked_at', null).maybeSingle();
  return !!data;
}

/** 🆕 حظر فوري + بلاغ للأدمن عند مخالفة كلام محظور — لا يُنفَّذ الإرسال إطلاقاً */
async function blockSenderForViolation(person, term, message) {
  await supabaseAdmin.from('blocked_senders').insert({
    person_id: person.id, person_type: person.type, flagged_message: message,
  });
  await supabaseAdmin.from('audit_log').insert({
    emp_id: person.id, emp_name: person.name || person.id, role: person.type,
    action: '🚫 حظر تلقائي — استخدام كلام محظور بالمراسلات', details: { term, message }, branch: person.branch || null,
  });
}

/** 🆕 تنظيف كسول — يحذف أي رد (لا الرسالة الأصلية) قُرئ منذ أكثر من 24 ساعة، يُستدعى عند كل فتح لموضوع */
async function cleanupExpiredReplies(threadId) {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  await supabaseAdmin.from('chat_messages').delete().eq('thread_id', threadId).eq('is_original', false).not('read_at', 'is', null).lt('read_at', cutoff);
}

/* ===================== إرسال رسالة جديدة (تبدأ موضوعاً جديداً) ===================== */
async function handleSendMessage(req, res) {
  const user = requireAuth(req);
  const d = validateBody(z.object({
    subject: z.string().min(2).max(200),
    body: z.string().min(1).max(2000),
    contextType: z.string().optional(),
    contextId: z.string().optional(),
    recipients: z.array(z.object({ id: z.string(), type: z.enum(['employee', 'student', 'parent']) })).min(1, 'حدّد مستلماً واحداً على الأقل'),
  }), req.body);

  if (await isSenderBlocked(user.id, 'employee')) {
    const e = new Error('حسابك محظور من إرسال الرسائل حالياً — تواصل مع الأدمن');
    e.statusCode = 403;
    throw e;
  }
  const blockedTerm = await findBlockedTerm(d.body) || await findBlockedTerm(d.subject);
  if (blockedTerm) {
    await blockSenderForViolation({ id: user.id, type: 'employee', name: user.fullName, branch: user.branch }, blockedTerm, d.body);
    const e = new Error('تم حظرك تلقائياً لاستخدام كلام غير لائق — تواصل مع الأدمن لرفع الحظر');
    e.statusCode = 403;
    throw e;
  }

  const { data: thread, error: threadError } = await supabaseAdmin.from('chat_threads').insert({
    subject: d.subject, context_type: d.contextType || 'general', context_id: d.contextId || null,
    sender_id: user.id, sender_type: 'employee', branch: user.branch,
  }).select('id').single();
  if (threadError) throw threadError;

  const { error: msgError } = await supabaseAdmin.from('chat_messages').insert({
    thread_id: thread.id, sender_id: user.id, sender_type: 'employee', body: d.body, is_original: true,
  });
  if (msgError) throw msgError;

  const recipientRows = d.recipients.map((r) => ({ thread_id: thread.id, recipient_id: r.id, recipient_type: r.type }));
  const { error: recError } = await supabaseAdmin.from('chat_recipients').insert(recipientRows);
  if (recError) throw recError;

  return res.status(200).json({ success: true, data: { threadId: thread.id } });
}

/* ===================== قائمة مواضيعي (مرسِل أو مستلم) ===================== */
async function handleListMyThreads(req, res) {
  const user = requireAuth(req);
  const { data: asRecipient } = await supabaseAdmin.from('chat_recipients').select('thread_id').eq('recipient_id', user.id).eq('recipient_type', 'employee');
  const recipientThreadIds = (asRecipient || []).map((r) => r.thread_id);

  const { data: threads, error } = await supabaseAdmin
    .from('chat_threads').select('*')
    .or(`sender_id.eq.${user.id},id.in.(${recipientThreadIds.length ? recipientThreadIds.join(',') : '0'})`)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return res.status(200).json({ success: true, data: threads });
}

/* ===================== فتح موضوع (يعلِّم رسائلي كمقروءة، وينظِّف الردود المنتهية) ===================== */
async function handleGetThread(req, res) {
  const user = requireAuth(req);
  const { threadId } = req.body;

  await cleanupExpiredReplies(threadId);

  const { data: messages, error } = await supabaseAdmin.from('chat_messages').select('*').eq('thread_id', threadId).order('created_at', { ascending: true });
  if (error) throw error;

  const unreadIds = messages.filter((m) => !m.read_at && m.sender_id !== user.id).map((m) => m.id);
  if (unreadIds.length) {
    await supabaseAdmin.from('chat_messages').update({ read_at: new Date().toISOString() }).in('id', unreadIds);
  }
  await supabaseAdmin.from('chat_recipients').update({ read_at: new Date().toISOString() }).eq('thread_id', threadId).eq('recipient_id', user.id).is('read_at', null);

  return res.status(200).json({ success: true, data: messages });
}

/* ===================== الرد على موضوع (يُحذَف تلقائياً 24 ساعة بعد قراءته) ===================== */
async function handleReply(req, res) {
  const user = requireAuth(req);
  const d = validateBody(z.object({ threadId: z.union([z.string(), z.number()]), body: z.string().min(1).max(2000) }), req.body);

  if (await isSenderBlocked(user.id, 'employee')) {
    const e = new Error('حسابك محظور من إرسال الرسائل حالياً — تواصل مع الأدمن');
    e.statusCode = 403;
    throw e;
  }
  const blockedTerm = await findBlockedTerm(d.body);
  if (blockedTerm) {
    await blockSenderForViolation({ id: user.id, type: 'employee', name: user.fullName, branch: user.branch }, blockedTerm, d.body);
    const e = new Error('تم حظرك تلقائياً لاستخدام كلام غير لائق — تواصل مع الأدمن لرفع الحظر');
    e.statusCode = 403;
    throw e;
  }

  const { error } = await supabaseAdmin.from('chat_messages').insert({ thread_id: d.threadId, sender_id: user.id, sender_type: 'employee', body: d.body, is_original: false });
  if (error) throw error;
  return res.status(200).json({ success: true, data: true });
}

/* ===================== إدارة الكلمات الممنوعة (أدمن) ===================== */
async function handleListBlockedTerms(req, res) {
  const user = requireAuth(req);
  requireRole(user, ['role_admin']);
  const { data, error } = await supabaseAdmin.from('blocked_terms').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return res.status(200).json({ success: true, data });
}

async function handleAddBlockedTerm(req, res) {
  const user = requireAuth(req);
  requireRole(user, ['role_admin']);
  const { term } = validateBody(z.object({ term: z.string().min(1).max(100) }), req.body);
  const { error } = await supabaseAdmin.from('blocked_terms').insert({ term, added_by: user.id });
  if (error) throw error;
  return res.status(200).json({ success: true, data: true });
}

async function handleDeleteBlockedTerm(req, res) {
  const user = requireAuth(req);
  requireRole(user, ['role_admin']);
  const { id } = validateBody(z.object({ id: z.union([z.string(), z.number()]) }), req.body);
  const { error } = await supabaseAdmin.from('blocked_terms').delete().eq('id', id);
  if (error) throw error;
  return res.status(200).json({ success: true, data: true });
}

/* ===================== إدارة الحسابات المحظورة (أدمن) ===================== */
async function handleListBlockedSenders(req, res) {
  const user = requireAuth(req);
  requireRole(user, ['role_admin']);
  const { data, error } = await supabaseAdmin.from('blocked_senders').select('*').is('unblocked_at', null).order('blocked_at', { ascending: false });
  if (error) throw error;
  return res.status(200).json({ success: true, data });
}

async function handleUnblockSender(req, res) {
  const user = requireAuth(req);
  requireRole(user, ['role_admin']);
  const { id } = validateBody(z.object({ id: z.union([z.string(), z.number()]) }), req.body);
  const { error } = await supabaseAdmin.from('blocked_senders').update({ unblocked_at: new Date().toISOString(), unblocked_by: user.id }).eq('id', id);
  if (error) throw error;
  await supabaseAdmin.from('audit_log').insert({ emp_id: user.id, emp_name: user.fullName, role: user.role, action: 'رفع حظر مراسلات', details: { blockedSenderId: id }, branch: user.branch });
  return res.status(200).json({ success: true, data: true });
}

/* ===================== عدد الرسائل غير المقروءة (للجرس) ===================== */
async function handleUnreadCount(req, res) {
  const user = requireAuth(req);
  const { count, error } = await supabaseAdmin.from('chat_recipients').select('id', { count: 'exact', head: true }).eq('recipient_id', user.id).eq('recipient_type', 'employee').is('read_at', null);
  if (error) throw error;
  return res.status(200).json({ success: true, data: { count: count || 0 } });
}

export default createRouter({
  list: handleList,
  sendMessage: handleSendMessage,
  listMyThreads: handleListMyThreads,
  getThread: handleGetThread,
  reply: handleReply,
  unreadCount: handleUnreadCount,
  listBlockedTerms: handleListBlockedTerms,
  addBlockedTerm: handleAddBlockedTerm,
  deleteBlockedTerm: handleDeleteBlockedTerm,
  listBlockedSenders: handleListBlockedSenders,
  unblockSender: handleUnblockSender,
});
