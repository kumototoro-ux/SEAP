-- =====================================================================
-- ترحيل البيانات الفعلية من شيت Settings الحقيقي (لا بيانات وهمية)
-- =====================================================================

-- 1) تنظيف أي بيانات تجريبية سابقة (مثل 'الفرع الرئيسي' الذي أضفناه للاختبار)
DELETE FROM settings_lists;

-- 2) إدخال كل القوائم الفعلية دفعة واحدة
INSERT INTO settings_lists (list_key, value, sort_order) VALUES
  ('branches', 'دار الهدى - مكة المكرمة - الخالدية', 0),
  ('branches', 'دار الهدى - مكة المكرمة - الزاهر', 1),
  ('branches', 'دار الهدى - مكة المكرمة - بير غنم', 2),
  ('branches', 'دار الهدى - جدة - ابحر', 3),
  ('branches', 'دار الهدى - جدة - طيبة', 4),
  ('branches', 'دار الهدى - الرياض - الخالدية', 5),
  ('branches', 'دار الهدى - الرياض - النسيم', 6),
  ('branches', 'دار الهدى - المدينة المنورة', 7),
  ('branches', 'ALL', 8);

INSERT INTO settings_lists (list_key, value, sort_order) VALUES
  ('stages', 'الروضة', 0),
  ('stages', 'الابتدائية', 1),
  ('stages', 'المتوسطة', 2),
  ('stages', 'الثانوية', 3),
  ('stages', 'ALL', 4);

INSERT INTO settings_lists (list_key, value, sort_order) VALUES
  ('grades', 'KG1', 0),
  ('grades', 'KG2', 1),
  ('grades', 'KG3', 2),
  ('grades', 'الصف الأول', 3),
  ('grades', 'الصف الثاني', 4),
  ('grades', 'الصف الثالث', 5),
  ('grades', 'الصف الرابع', 6),
  ('grades', 'الصف الخامس', 7),
  ('grades', 'الصف السادس', 8),
  ('grades', 'الصف الأول المتوسط', 9),
  ('grades', 'الصف الثاني المتوسط', 10),
  ('grades', 'الصف الثالث المتوسط', 11),
  ('grades', 'الصف الأول الثانوي', 12),
  ('grades', 'الصف الثاني الثانوي', 13),
  ('grades', 'الصف الثالث الثانوي', 14),
  ('grades', 'ALL', 15);

INSERT INTO settings_lists (list_key, value, sort_order) VALUES
  ('sections', 'الشعبة1', 0),
  ('sections', 'الشعبة2', 1),
  ('sections', 'الشعبة3', 2),
  ('sections', 'الشعبة4', 3),
  ('sections', 'الشعبة5', 4),
  ('sections', 'الشعبة6', 5),
  ('sections', 'الشعبة7', 6),
  ('sections', 'ALL', 7);

INSERT INTO settings_lists (list_key, value, sort_order) VALUES
  ('subjects', 'القران الكريم', 0),
  ('subjects', 'الدراسات الأسلامية', 1),
  ('subjects', 'اللغة العربية', 2),
  ('subjects', 'الدراسات الاجتماعية', 3),
  ('subjects', 'الرياضيات', 4),
  ('subjects', 'العلوم', 5),
  ('subjects', 'اللغة الانجليزية', 6),
  ('subjects', 'المهارات الرقمية', 7),
  ('subjects', 'التربية الفنية', 8),
  ('subjects', 'التربية البدنية و الدفاع عن النفس', 9),
  ('subjects', 'المهرات الحياتية والتربية الاسرية', 10),
  ('subjects', 'التفكير الناقد', 11),
  ('subjects', 'ALL', 12);

INSERT INTO settings_lists (list_key, value, sort_order) VALUES
  ('user_types', 'admin', 0),
  ('user_types', 'teacher', 1),
  ('user_types', 'teacher_sup', 2),
  ('user_types', 'student_sup', 3),
  ('user_types', 'student', 4),
  ('user_types', 'ALL', 5),
  ('user_types', 'Registration Admin', 6),
  ('user_types', 'branch_monitor', 7);

INSERT INTO settings_lists (list_key, value, sort_order) VALUES
  ('roles', 'role_admin', 0),
  ('roles', 'role_teacher', 1),
  ('roles', 'role_teacher_sup', 2),
  ('roles', 'role_student_sup', 3),
  ('roles', 'role_studen', 4),
  ('roles', 'ALL', 5),
  ('roles', 'Admission', 6),
  ('roles', 'role_branch_monitor', 7);

INSERT INTO settings_lists (list_key, value, sort_order) VALUES
  ('account_statuses', 'active', 0),
  ('account_statuses', 'inactive', 1),
  ('account_statuses', 'suspended', 2);

INSERT INTO settings_lists (list_key, value, sort_order) VALUES
  ('attendance_statuses', 'حاضر', 0),
  ('attendance_statuses', 'غائب', 1),
  ('attendance_statuses', 'متأخر', 2),
  ('attendance_statuses', 'مستأذن', 3);

INSERT INTO settings_lists (list_key, value, sort_order) VALUES
  ('terms', 'الترم الأول', 0),
  ('terms', 'الترم الثاني', 1);

INSERT INTO settings_lists (list_key, value, sort_order) VALUES
  ('behavior_statuses', 'ايجابي', 0),
  ('behavior_statuses', 'سلبي', 1);

INSERT INTO settings_lists (list_key, value, sort_order) VALUES
  ('continuous_eval_types', 'واجبات', 0),
  ('continuous_eval_types', 'اوراق عمل', 1),
  ('continuous_eval_types', 'مشاركة', 2),
  ('continuous_eval_types', 'مطويات', 3),
  ('continuous_eval_types', 'بحوث', 4),
  ('continuous_eval_types', 'تقارير', 5);

INSERT INTO settings_lists (list_key, value, sort_order) VALUES
  ('exams', 'اختبارات قصيرة', 0),
  ('exams', 'اختبار شهري', 1),
  ('exams', 'اختبار نهائي', 2);

-- 3) اسم المدرسة وشعارها
UPDATE site_settings SET school_name = 'مدرسة دار الهدى', logo_url = 'https://drive.google.com/file/d/1FbX2U3DOnVEAYflMcB3woj5U342tODH2/view?usp=sharing' WHERE id = 1;
