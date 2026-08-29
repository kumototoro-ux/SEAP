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
import { validateBody, searchMessageRecipientsSchema, sendMessageSchema, replyMessageSchema } from '../lib/validation.js';

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

/** حظر فوري + بلاغ للأدمن عند مخالفة كلام محظور — لا يُنفَّذ الإرسال إطلاقاً */
async function blockSenderForViolation(person, term, message) {
  await supabaseAdmin.from('blocked_senders').insert({
    person_id: person.id, person_type: person.type, flagged_message: message,
  });
  await supabaseAdmin.from('audit_log').insert({
    emp_id: person.id, emp_name: person.name || person.id, role: person.type,
    action: '🚫 حظر تلقائي — استخدام كلام محظور بالمراسلات', details: { term, message }, branch: person.branch || null,
  });
}

/** 🆕 بحث عربي مرن — يبني نمط Regex يوحِّد أشكال الألف (ا/أ/إ/آ)، التاء
 * المربوطة والهاء (ة/ه)، والياء والألف المقصورة (ي/ى)، حتى لو اختلفت
 * كتابة المستخدم عن المخزَّن بقاعدة البيانات بحرف واحد. يُستخدَم مع مشغّل
 * PostgreSQL للمطابقة النصية غير الحساسة لحالة الأحرف (imatch → ~*). */
function buildArabicFuzzyPattern_(term) {
  let escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // يمنع كسر صيغة Regex بمدخلات خاصة
  escaped = escaped
    .replace(/[اأإآ]/g, '[اأإآ]')
    .replace(/[ةه]/g, '[ةه]')
    .replace(/[يى]/g, '[يى]');
  return escaped;
}

/** 🆕 يتحقّق فعلياً (لا اعتماد على واجهة العميل) أن المرسِل مصرَّح له
 * بمراسلة هذا المستلم بالضبط — يُستدعى بكل رسالة جديدة، ولكل مستلم على
 * حدة. كانت هذي أكبر ثغرة بالنظام القديم: أي recipients تُرسَل من
 * العميل كانت تُقبَل بلا أي تحقق خادم إطلاقاً. */
async function assertCanMessageRecipient_(user, recipient) {
  if (user.role === 'role_admin') return;

  if (recipient.type === 'employee') {
    const { data: emp } = await supabaseAdmin.from('employees').select('branch, role').eq('id', recipient.id).is('deleted_at', null).maybeSingle();
    if (!emp) { const e = new Error('المستلم غير موجود'); e.statusCode = 404; throw e; }

    if (user.role === 'role_branch_monitor') {
      const allowedBranches = user.allBranches || [user.branch];
      if (!allowedBranches.includes(emp.branch)) { const e = new Error('لا تملك صلاحية مراسلة هذا الموظف (خارج فرعك)'); e.statusCode = 403; throw e; }
      return;
    }

    // 🆕 كل الأدوار الأخرى: موظف فرعهم، أو أي أدمن، أو مراقب فرع مسؤول فعلياً عن فرعهم
    if (emp.branch === user.branch || emp.role === 'role_admin') return;
    if (emp.role === 'role_branch_monitor') {
      const { data: monitorRow } = await supabaseAdmin.from('employees').select('branch, employee_branches(branch)').eq('id', recipient.id).single();
      const supervisesMyBranch = monitorRow && (monitorRow.branch === user.branch || (monitorRow.employee_branches || []).some((b) => b.branch === user.branch));
      if (supervisesMyBranch) return;
    }
    const e = new Error('لا تملك صلاحية مراسلة هذا الموظف (خارج فرعك)');
    e.statusCode = 403;
    throw e;
  }

  // 🆕 مراسلة طلاب/أولياء أمور — محصورة بالأدوار المعنية بالطلاب فقط
  if (!['role_branch_monitor', 'role_student_sup', 'Admission', 'role_teacher'].includes(user.role)) {
    const e = new Error('دورك لا يملك صلاحية مراسلة الطلاب/أولياء الأمور');
    e.statusCode = 403;
    throw e;
  }

  if (recipient.type === 'student') {
    const { data: stu } = await supabaseAdmin.from('students').select('branch, grade, section').eq('id', recipient.id).is('deleted_at', null).maybeSingle();
    if (!stu) { const e = new Error('الطالب غير موجود'); e.statusCode = 404; throw e; }
    if (user.role === 'role_teacher') {
      const inScope = stu.branch === user.branch && (user.grades || []).includes(stu.grade) && (user.sections || []).includes(stu.section);
      if (!inScope) { const e = new Error('لا تملك صلاحية مراسلة هذا الطالب (خارج صفوفك)'); e.statusCode = 403; throw e; }
      return;
    }
    const allowedBranches = user.role === 'role_branch_monitor' ? (user.allBranches || [user.branch]) : [user.branch];
    if (!allowedBranches.includes(stu.branch)) { const e = new Error('لا تملك صلاحية مراسلة هذا الطالب (خارج فرعك)'); e.statusCode = 403; throw e; }
    return;
  }

  if (recipient.type === 'parent') {
    const { data: links } = await supabaseAdmin.from('parent_student_links').select('student_id').eq('parent_id', recipient.id);
    const studentIds = (links || []).map((l) => l.student_id);
    if (!studentIds.length) { const e = new Error('ولي الأمر غير مرتبط بأي طالب'); e.statusCode = 404; throw e; }

    let studentsQuery = supabaseAdmin.from('students').select('id').in('id', studentIds).is('deleted_at', null);
    if (user.role === 'role_teacher') {
      studentsQuery = studentsQuery.eq('branch', user.branch).in('grade', user.grades || ['__none__']).in('section', user.sections || ['__none__']);
    } else {
      const allowedBranches = user.role === 'role_branch_monitor' ? (user.allBranches || [user.branch]) : [user.branch];
      studentsQuery = studentsQuery.in('branch', allowedBranches);
    }
    const { data: matching } = await studentsQuery;
    if (!matching || !matching.length) { const e = new Error('لا تملك صلاحية مراسلة ولي هذا الأمر (خارج نطاقك)'); e.statusCode = 403; throw e; }
    return;
  }

  const e = new Error('نوع مستلم غير صحيح');
  e.statusCode = 400;
  throw e;
}

/* ===================== 🆕 بحث ذكي عن مستلمي المراسلات (مقيَّد بالصلاحية من الاستعلام نفسه) ===================== */
async function handleSearchMessageRecipients(req, res) {
  const user = requireAuth(req);
  const { personType, branch, query } = validateBody(searchMessageRecipientsSchema, req.body);

  if (personType === 'employee') {
    let q = supabaseAdmin.from('employees').select('id, name_ar, role, branch').is('deleted_at', null).order('name_ar').limit(30);

    if (user.role === 'role_admin') {
      if (branch) q = q.eq('branch', branch);
    } else if (user.role === 'role_branch_monitor') {
      const allowed = (user.allBranches || [user.branch]);
      q = q.in('branch', branch ? [branch].filter((b) => allowed.includes(b)) : allowed);
    } else {
      // 🆕 كل الأدوار الأخرى: موظفو فرعهم + كل الأدمن + مراقب/مراقبو الفرع
      // المسؤولين عن فرعهم تحديداً (حتى لو لم يكونوا "من" هذا الفرع أصلاً)
      const { data: monitors } = await supabaseAdmin.from('employees')
        .select('id, branch, employee_branches(branch)').eq('role', 'role_branch_monitor').is('deleted_at', null);
      const relevantMonitorIds = (monitors || [])
        .filter((m) => m.branch === user.branch || (m.employee_branches || []).some((b) => b.branch === user.branch))
        .map((m) => m.id);

      const orParts = [`branch.eq.${user.branch}`, 'role.eq.role_admin'];
      if (relevantMonitorIds.length) orParts.push(`id.in.(${relevantMonitorIds.join(',')})`);
      q = q.or(orParts.join(','));
    }

    if (query) q = q.filter('name_ar', 'imatch', buildArabicFuzzyPattern_(query));
    const { data, error } = await q;
    if (error) throw error;
    return res.status(200).json({ success: true, data });
  }

  // طلاب/أولياء أمور — محصور بالأدوار المعنية
  if (!['role_branch_monitor', 'role_student_sup', 'Admission', 'role_teacher'].includes(user.role)) {
    return res.status(200).json({ success: true, data: [] }); // 🆕 بلا خطأ — فقط لا نتائج (دور لا يملك هذي الميزة أصلاً)
  }

  if (personType === 'student') {
    let q = supabaseAdmin.from('students').select('id, name_ar, national_id, branch, grade, section').is('deleted_at', null).order('name_ar').limit(20);
    if (user.role === 'role_teacher') {
      q = q.eq('branch', user.branch).in('grade', user.grades || ['__none__']).in('section', user.sections || ['__none__']);
    } else if (user.role === 'role_branch_monitor') {
      const allowed = (user.allBranches || [user.branch]);
      q = q.in('branch', branch ? [branch].filter((b) => allowed.includes(b)) : allowed);
    } else q = q.eq('branch', user.branch);
    if (query) q = q.or(`name_ar.imatch.${buildArabicFuzzyPattern_(query)},national_id.ilike.%${query.replace(/[,()%]/g, '')}%`);
    const { data, error } = await q;
    if (error) throw error;
    return res.status(200).json({ success: true, data });
  }

  if (personType === 'parent') {
    // 🆕 نجيب الطلاب المسموح بالوصول لهم أولاً، ثم أولياء أمورهم فقط
    let studentsQuery = supabaseAdmin.from('students').select('id, branch').is('deleted_at', null);
    if (user.role === 'role_teacher') {
      studentsQuery = studentsQuery.eq('branch', user.branch).in('grade', user.grades || ['__none__']).in('section', user.sections || ['__none__']);
    } else if (user.role === 'role_branch_monitor') {
      const allowed = (user.allBranches || [user.branch]);
      studentsQuery = studentsQuery.in('branch', branch ? [branch].filter((b) => allowed.includes(b)) : allowed);
    } else studentsQuery = studentsQuery.eq('branch', user.branch);
    const { data: allowedStudents } = await studentsQuery;
    const allowedStudentIds = (allowedStudents || []).map((s) => s.id);
    if (!allowedStudentIds.length) return res.status(200).json({ success: true, data: [] });

    const { data: links } = await supabaseAdmin.from('parent_student_links').select('parent_id').in('student_id', allowedStudentIds);
    const allowedParentIds = [...new Set((links || []).map((l) => l.parent_id))];
    if (!allowedParentIds.length) return res.status(200).json({ success: true, data: [] });

    let q = supabaseAdmin.from('parent_info').select('id, name_ar, national_id, phone, branch').in('id', allowedParentIds).is('deleted_at', null).order('name_ar').limit(20);
    if (query) q = q.or(`name_ar.imatch.${buildArabicFuzzyPattern_(query)},national_id.ilike.%${query.replace(/[,()%]/g, '')}%`);
    const { data, error } = await q;
    if (error) throw error;
    return res.status(200).json({ success: true, data });
  }

  return res.status(200).json({ success: true, data: [] });
}

/* ===================== إرسال رسالة جديدة (تبدأ موضوعاً جديداً) ===================== */
async function handleSendMessage(req, res) {
  const user = requireAuth(req);
  const d = validateBody(sendMessageSchema, req.body);

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

  // 🆕 التحقق الحقيقي بالخادم من كل مستلم — لا اعتماد على قائمة العميل وحدها
  for (const r of d.recipients) { await assertCanMessageRecipient_(user, r); }

  // 🆕 الصور: تُقبَل فقط لو الإعداد مفعَّل مركزياً بالخادم (لا الاكتفاء بإخفاء الزر بالواجهة)
  let imageUrl = null;
  if (d.imageUrl) {
    const { data: siteSettings } = await supabaseAdmin.from('site_settings').select('allow_message_images').single();
    if (!siteSettings?.allow_message_images) {
      const e = new Error('إرسال الصور بالمراسلات معطَّل حالياً من الإعدادات');
      e.statusCode = 403;
      throw e;
    }
    imageUrl = d.imageUrl;
  }

  const { data: thread, error: threadError } = await supabaseAdmin.from('chat_threads').insert({
    subject: d.subject, context_type: d.contextType || 'general', context_id: d.contextId || null,
    sender_id: user.id, sender_type: 'employee', branch: user.branch,
  }).select('id').single();
  if (threadError) throw threadError;

  const { error: msgError } = await supabaseAdmin.from('chat_messages').insert({
    thread_id: thread.id, sender_id: user.id, sender_type: 'employee', body: d.body, is_original: true, image_url: imageUrl,
  });
  if (msgError) throw msgError;

  const recipientRows = d.recipients.map((r) => ({ thread_id: thread.id, recipient_id: r.id, recipient_type: r.type }));
  const { error: recError } = await supabaseAdmin.from('chat_recipients').insert(recipientRows);
  if (recError) throw recError;

  return res.status(200).json({ success: true, data: { threadId: thread.id } });
}

/* ===================== قائمة مواضيعي (مرسِل أو مستلم) ===================== */
/** 🆕 يحلّ اسم شخص من (id + type) — يُستخدَم لعرض اسم الطرف الآخر
 * بقائمة المراسلات (مُرسِل حالة الوارد، أو أول مستلم حالة المرسَل) */
async function resolvePersonName_(id, type) {
  if (type === 'employee') {
    const { data } = await supabaseAdmin.from('employees').select('name_ar').eq('id', id).maybeSingle();
    return data?.name_ar || 'موظف';
  }
  if (type === 'student') {
    const { data } = await supabaseAdmin.from('students').select('name_ar').eq('id', id).maybeSingle();
    return data?.name_ar || 'طالب';
  }
  if (type === 'parent') {
    const { data } = await supabaseAdmin.from('parent_info').select('name_ar').eq('id', id).maybeSingle();
    return data?.name_ar || 'ولي أمر';
  }
  return 'غير معروف';
}

/** 🆕 قائمة مواضيعي — بحلّة بريد إلكتروني كاملة: اتجاه (وارد/مرسَل)،
 * حالة قراءة دقيقة، مقتطف آخر رسالة ووقتها، واسم الطرف الآخر محلولاً. */
async function handleListMyThreads(req, res) {
  const user = requireAuth(req);
  const { data: asRecipient } = await supabaseAdmin.from('chat_recipients').select('thread_id, read_at').eq('recipient_id', user.id).eq('recipient_type', 'employee');
  const recipientThreadIds = (asRecipient || []).map((r) => r.thread_id);
  const myUnreadAsRecipient = new Set((asRecipient || []).filter((r) => !r.read_at).map((r) => r.thread_id));

  const { data: threads, error } = await supabaseAdmin
    .from('chat_threads').select('*')
    .or(`sender_id.eq.${user.id},id.in.(${recipientThreadIds.length ? recipientThreadIds.join(',') : '0'})`)
    .order('created_at', { ascending: false });
  if (error) throw error;
  if (!threads.length) return res.status(200).json({ success: true, data: [] });

  const threadIds = threads.map((t) => t.id);
  const [{ data: allMessages }, { data: allRecipients }] = await Promise.all([
    supabaseAdmin.from('chat_messages').select('thread_id, body, sender_id, sender_type, created_at, read_at').in('thread_id', threadIds).order('created_at', { ascending: false }),
    supabaseAdmin.from('chat_recipients').select('thread_id, recipient_id, recipient_type').in('thread_id', threadIds),
  ]);

  const lastMessageByThread = {};
  (allMessages || []).forEach((m) => { if (!lastMessageByThread[m.thread_id]) lastMessageByThread[m.thread_id] = m; }); // أول ظهور = الأحدث (مرتَّبة تنازلياً أصلاً)

  // 🆕 وارد لي غير مقروء: إما (أنا مستلم ولم أقرأ الموضوع بعد) أو (أنا مُرسِل ووصل رد جديد من طرف آخر لم أقرأه)
  const unreadByThread = {};
  (allMessages || []).forEach((m) => {
    if (m.sender_id !== user.id && !m.read_at) unreadByThread[m.thread_id] = true;
  });
  threadIds.forEach((id) => { if (myUnreadAsRecipient.has(id)) unreadByThread[id] = true; });

  const recipientsByThread = {};
  (allRecipients || []).forEach((r) => { (recipientsByThread[r.thread_id] = recipientsByThread[r.thread_id] || []).push(r); });

  const enriched = await Promise.all(threads.map(async (t) => {
    const isSender = t.sender_id === user.id;
    let counterpartName;
    if (isSender) {
      const recipients = recipientsByThread[t.id] || [];
      const firstName = recipients.length ? await resolvePersonName_(recipients[0].recipient_id, recipients[0].recipient_type) : '—';
      counterpartName = recipients.length > 1 ? `${firstName} +${recipients.length - 1}` : firstName;
    } else {
      counterpartName = await resolvePersonName_(t.sender_id, t.sender_type);
    }
    const last = lastMessageByThread[t.id];
    return {
      ...t, isSender, isUnread: !!unreadByThread[t.id], counterpartName,
      lastMessageSnippet: last ? last.body.slice(0, 80) : '', lastMessageAt: last ? last.created_at : t.created_at,
    };
  }));

  return res.status(200).json({ success: true, data: enriched });
}

/** يتحقّق أن المستخدم طرف فعلي بهذا الموضوع (مُرسِل أصلي أو مستلم مُدرَج)
 * قبل السماح بقراءته أو الرد عليه — إصلاح ثغرة IDOR سابقة. */
async function assertThreadParticipant_(user, threadId) {
  const { data: thread, error } = await supabaseAdmin.from('chat_threads').select('sender_id').eq('id', threadId).single();
  if (error || !thread) {
    const e = new Error('الموضوع غير موجود');
    e.statusCode = 404;
    throw e;
  }
  if (thread.sender_id === user.id) return;

  const { data: recipient } = await supabaseAdmin.from('chat_recipients').select('id')
    .eq('thread_id', threadId).eq('recipient_id', user.id).eq('recipient_type', 'employee').maybeSingle();
  if (!recipient) {
    const e = new Error('لا تملك صلاحية الوصول لهذا الموضوع');
    e.statusCode = 403;
    throw e;
  }
}

/* ===================== فتح موضوع (يعلِّم رسائلي كمقروءة) ===================== */
// 🆕 لم يعد يُحذَف أي رد تلقائياً بعد 24 ساعة — أرشيف دائم قابل للبحث،
// يتماشى مع رؤية "بريد إلكتروني داخلي" التي تتطلّب استمرارية المحادثة
async function handleGetThread(req, res) {
  const user = requireAuth(req);
  const { threadId } = req.body;
  await assertThreadParticipant_(user, threadId);

  const { data: messages, error } = await supabaseAdmin.from('chat_messages').select('*').eq('thread_id', threadId).order('created_at', { ascending: true });
  if (error) throw error;

  const unreadIds = messages.filter((m) => !m.read_at && m.sender_id !== user.id).map((m) => m.id);
  if (unreadIds.length) {
    await supabaseAdmin.from('chat_messages').update({ read_at: new Date().toISOString() }).in('id', unreadIds);
  }
  await supabaseAdmin.from('chat_recipients').update({ read_at: new Date().toISOString() }).eq('thread_id', threadId).eq('recipient_id', user.id).is('read_at', null);

  return res.status(200).json({ success: true, data: messages });
}

/* ===================== الرد على موضوع ===================== */
async function handleReply(req, res) {
  const user = requireAuth(req);
  const d = validateBody(replyMessageSchema, req.body);
  await assertThreadParticipant_(user, d.threadId);

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

  let imageUrl = null;
  if (d.imageUrl) {
    const { data: siteSettings } = await supabaseAdmin.from('site_settings').select('allow_message_images').single();
    if (!siteSettings?.allow_message_images) {
      const e = new Error('إرسال الصور بالمراسلات معطَّل حالياً من الإعدادات');
      e.statusCode = 403;
      throw e;
    }
    imageUrl = d.imageUrl;
  }

  const { error } = await supabaseAdmin.from('chat_messages').insert({ thread_id: d.threadId, sender_id: user.id, sender_type: 'employee', body: d.body, is_original: false, image_url: imageUrl });
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
  searchMessageRecipients: handleSearchMessageRecipients,
  listBlockedTerms: handleListBlockedTerms,
  addBlockedTerm: handleAddBlockedTerm,
  deleteBlockedTerm: handleDeleteBlockedTerm,
  listBlockedSenders: handleListBlockedSenders,
  unblockSender: handleUnblockSender,
});
