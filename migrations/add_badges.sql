-- Add badges table for dynamic badge management by teachers
CREATE TABLE IF NOT EXISTS badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    icon VARCHAR(20) NOT NULL DEFAULT '🏅',
    description TEXT,
    criteria_type VARCHAR(50) NOT NULL DEFAULT 'skills_completed',
    criteria_value INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed default badges (only if table is empty)
INSERT INTO badges (name, icon, description, criteria_type, criteria_value)
SELECT v.name, v.icon, v.description, v.criteria_type, v.criteria_value
FROM (VALUES
    ('البداية',           '🌟', 'أكمل أول مهارة',          'skills_completed',  1),
    ('المجتهد',           '⭐', 'أكمل 5 مهارات',            'skills_completed',  5),
    ('المثابر',           '🔥', 'أكمل 10 مهارات',           'skills_completed', 10),
    ('النجم',             '💫', 'أكمل 20 مهارة',            'skills_completed', 20),
    ('في منتصف الطريق',  '🎯', 'وصل إلى 50% من الإنجاز',   'completion_percent', 50),
    ('شبه مكتمل',        '🏅', 'وصل إلى 75% من الإنجاز',   'completion_percent', 75),
    ('التميز المطلق',    '👑', 'وصل إلى 100% من الإنجاز',  'completion_percent', 100)
) AS v(name, icon, description, criteria_type, criteria_value)
WHERE NOT EXISTS (SELECT 1 FROM badges LIMIT 1);

-- Add new default badges (only if each specific badge name doesn't exist yet)
INSERT INTO badges (name, icon, description, criteria_type, criteria_value)
SELECT '🧪 المحاول', '🧪', 'قام بأول محاولة في اختبار', 'tests_attempted', 1
WHERE NOT EXISTS (SELECT 1 FROM badges WHERE name = '🧪 المحاول');

INSERT INTO badges (name, icon, description, criteria_type, criteria_value)
SELECT '✅ الناجح', '✅', 'اجتاز اختباراً بنجاح', 'tests_passed', 1
WHERE NOT EXISTS (SELECT 1 FROM badges WHERE name = '✅ الناجح');

INSERT INTO badges (name, icon, description, criteria_type, criteria_value)
SELECT '🏆 المتمكن', '🏆', 'اجتاز 5 اختبارات', 'tests_passed', 5
WHERE NOT EXISTS (SELECT 1 FROM badges WHERE name = '🏆 المتمكن');

INSERT INTO badges (name, icon, description, criteria_type, criteria_value)
SELECT '💯 المتميز', '💯', 'اجتاز اختباراً بعلامة كاملة (10/10)', 'perfect_tests', 1
WHERE NOT EXISTS (SELECT 1 FROM badges WHERE name = '💯 المتميز');

INSERT INTO badges (name, icon, description, criteria_type, criteria_value)
SELECT '🦁 بطل الاختبارات', '🦁', 'اجتاز 3 اختبارات بعلامة كاملة', 'perfect_tests', 3
WHERE NOT EXISTS (SELECT 1 FROM badges WHERE name = '🦁 بطل الاختبارات');

INSERT INTO badges (name, icon, description, criteria_type, criteria_value)
SELECT '🧪 المحاول الجاد', '🧪', 'حاول في 5 اختبارات', 'tests_attempted', 5
WHERE NOT EXISTS (SELECT 1 FROM badges WHERE name = '🧪 المحاول الجاد');

INSERT INTO badges (name, icon, description, criteria_type, criteria_value)
SELECT '🔬 الباحث', '🔬', 'حاول في 10 اختبارات', 'tests_attempted', 10
WHERE NOT EXISTS (SELECT 1 FROM badges WHERE name = '🔬 الباحث');

INSERT INTO badges (name, icon, description, criteria_type, criteria_value)
SELECT '🙋 الجاهز', '🙋', 'ضغط على زر "جاهز" لأول مرة', 'ready_actions', 1
WHERE NOT EXISTS (SELECT 1 FROM badges WHERE name = '🙋 الجاهز');

INSERT INTO badges (name, icon, description, criteria_type, criteria_value)
SELECT '🌺 الجاهز دائماً', '🌺', 'ضغط على زر "جاهز" 10 مرات', 'ready_actions', 10
WHERE NOT EXISTS (SELECT 1 FROM badges WHERE name = '🌺 الجاهز دائماً');

INSERT INTO badges (name, icon, description, criteria_type, criteria_value)
SELECT '📅 المواظب', '📅', 'سجّل دخول 5 مرات', 'login_count', 5
WHERE NOT EXISTS (SELECT 1 FROM badges WHERE name = '📅 المواظب');

INSERT INTO badges (name, icon, description, criteria_type, criteria_value)
SELECT '🗓️ المداوم', '🗓️', 'سجّل دخول 20 مرة', 'login_count', 20
WHERE NOT EXISTS (SELECT 1 FROM badges WHERE name = '🗓️ المداوم');

INSERT INTO badges (name, icon, description, criteria_type, criteria_value)
SELECT '🏆 أسطورة الاختبارات', '🏆', 'اجتاز 10 اختبارات', 'tests_passed', 10
WHERE NOT EXISTS (SELECT 1 FROM badges WHERE name = '🏆 أسطورة الاختبارات');

INSERT INTO badges (name, icon, description, criteria_type, criteria_value)
SELECT '🌟 صاحب الولاء', '🌟', 'سجّل دخول 50 مرة', 'login_count', 50
WHERE NOT EXISTS (SELECT 1 FROM badges WHERE name = '🌟 صاحب الولاء');
