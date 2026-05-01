# 🔬 FailSafe Lab | Virtual Physics Lab Simulator

![Build Status](https://img.shields.io/badge/build-passing-brightgreen)
![React Version](https://img.shields.io/badge/React-19.2.0-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7.2-blue)
![Vite](https://img.shields.io/badge/Vite-7.3.1-646CFF)
![Supabase](https://img.shields.io/badge/Supabase-Integrated-3ECF8E)

---

## 1. نظرة عامة على المشروع (Project Overview) 🌍

يمثل مشروع **FailSafe Lab** منصة تعليمية متطورة مصممة خصيصاً لطلاب كليات الهندسة، والأساتذة الجامعيين، والهيئة المعاونة. يقدم المشروع بيئة محاكاة افتراضية (Virtual Simulator) عالية الدقة للتجارب الفيزيائية الهندسية المعقدة. 
الهدف الأساسي من المنصة هو توفير بيئة تعليمية آمنة وتفاعلية تتيح للطلاب فهم القوانين الفيزيائية من خلال الممارسة العملية الدقيقة، مع الحفاظ على أعلى معايير النزاهة الأكاديمية باستخدام أنظمة المراقبة الذكية. يدمج النظام بين الأداء العالي، والمظهر الاحترافي، والسهولة المطلقة في الاستخدام.

## 2. المميزات الأساسية (Key Features) ✨

- **التجارب التفاعلية المتقدمة (Interactive Experiments):**
  - تجربة **Ohm's Law** (قانون أوم) لمحاكاة الدوائر الكهربائية وقياس المقاومات.
  - تجربة **Wheatstone Bridge** (قنطرة ويتستون) لإيجاد قيم المقاومات المجهولة بدقة.
  - تجربة **Hooke's Law** (قانون هوك) لاختبار المرونة وتذبذب النوابض (Springs).
  - تجربة **Viscosity** (اللزوجة) لقياس اللزوجة باستخدام قانون ستوكس ومحاكاة السقوط الحر للكرات في الموائع.
- **نظام المراقبة الذكي (AI Proctoring System):**
  - تتبع حركة العين والوجه بالاعتماد على نماذج الذكاء الاصطناعي (`face-api.js`).
  - رصد وتوثيق محاولات التلاعب (مثل مغادرة نافذة الامتحان أو إغلاق الكاميرا).
  - التكامل التام مع **Safe Exam Browser (SEB)**.
- **إمكانية الوصول (Accessibility & WCAG 2.1):**
  - دعم كامل للقارئات الصوتية (Screen Readers) عبر الاستخدام الدقيق للسمات الدلالية `ARIA` وعلامات `HTML5` الحديثة.

## 3. التقنيات المستخدمة (Tech Stack) 🛠️

تم بناء المنصة بالاعتماد على أحدث تقنيات تطوير واجهات المستخدم وقواعد البيانات لضمان الأداء الفائق والاعتمادية المطلقة:

- **Frontend Core:** `React` (v19), `TypeScript` (Strict Mode), `Vite`.
- **Backend as a Service:** `Supabase` (Authentication, Database, Edge Functions, Storage).
- **Styling:** `Vanilla CSS` with Cyberpunk-themed modules, HTML5 Semantic Elements.
- **Routing & SEO:** `react-router-dom`, `react-helmet-async` for dynamic Open Graph and Meta Tags.
- **AI & Computer Vision:** `face-api.js`.
- **Forms & Email:** `bcryptjs` for encryption, `@emailjs/browser` for automated credential dispatch.

## 4. البنية الهندسية والأداء (Architecture & Performance) 🏗️

تمت إعادة هيكلة المشروع مؤخراً وفقاً لأعلى معايير الهندسة البرمجية وتطوير واجهات المستخدم:
- **Strict TypeScript Architecture:** تعريف `Interfaces` و `Types` صارمة لكافة المتغيرات، الدوال، وخصائص المكونات، مما أدى إلى القضاء التام على أخطاء الـ `Runtime`.
- **Performance Optimizations:** 
  - استخدام واسع النطاق لـ `useMemo` لتخزين العمليات الحسابية المعقدة (مثل حسابات القوى الفيزيائية وحل معادلات الحركة).
  - تطبيق `useCallback` لضمان استقرار الدوال المرتبطة بحركة الرسوم المتحركة (Animation Frames).
  - تقليص دورات إعادة التصيير (Re-renders) غير الضرورية مما رفع من مؤشرات الأداء الحيوية كـ (Interaction to Next Paint - INP).
- **SEO & Web Vitals:** إعداد هيكل السيو التقني من خلال `robots.txt` و `sitemap.xml` والعلامات الميتاديناميكية.

## 5. هيكل الملفات (Folder Structure) 📂

يعتمد المشروع على بنية المكونات المعتمدة على الميزات (Feature-Based Architecture):

```text
src/
├── components/       # مكونات الواجهة المشتركة والقابلة لإعادة الاستخدام (UI Components)
├── features/         # الميزات الأساسية مفصولة حسب النطاق (Domain logic)
│   ├── experiments/  # مكونات محاكاة التجارب الفيزيائية (OhmsLaw, HookesLaw, Viscosity...)
│   └── proctoring/   # أنظمة المراقبة والكاميرا الذكية (CameraProctor)
├── layouts/          # هياكل التخطيط الأساسية (StudentLabLayout, DashboardLayout)
├── lib/              # إعدادات المكتبات الخارجية (مثل إعداد عميل Supabase)
├── pages/            # واجهات التطبيق الرئيسية مقسمة حسب أدوار المستخدمين
│   ├── admin/        # لوحة تحكم مدير النظام
│   ├── instructor/   # لوحة تحكم الأستاذ والمشرف
│   └── student/      # منصة الطالب للامتحانات والدخول
├── routes/           # منطق توجيه الصفحات (React Router Configuration)
└── styles/           # ملفات التنسيق الأساسية والمقسّمة حسب المكونات (CSS Modules)
```

## 6. دليل التشغيل (Getting Started) 🚀

لتشغيل المشروع على بيئتك المحلية، يرجى اتباع الخطوات التالية بدقة في الـ Terminal:

**الخطوة الأولى: نسخ المستودع (Clone the repository)**
```bash
git clone https://github.com/your-username/failsafe-lab.git
cd failsafe-lab
```

**الخطوة الثانية: تثبيت الحزم البرمجية (Install dependencies)**
نظراً لاستخدام أحدث إصدارات `React 19` مع مكتبات داعمة قد لا تتوافق كلياً مع نظام الحزم الجديد، يُلزم إضافة العلامة التأكيدية:
```bash
npm install --legacy-peer-deps
```

**الخطوة الثالثة: تشغيل الخادم المحلي (Run the development server)**
```bash
npm run dev
```
بعد تشغيل الخادم، قم بزيارة `http://localhost:5173` في متصفحك.

## 7. المحرك الفيزيائي (Physics Engine) ⚛️

تم عزل المعادلات والقوانين الفيزيائية المعقدة عن واجهة المستخدم لضمان كفاءة الأداء والموثوقية العلمية. يعتمد النظام على:
- حلقة تحديث لحظية (`requestAnimationFrame`) لمحاكاة القوى المتغيرة باستمرار مثل قوة الارتداد في النوابض وقوة لزوجة الموائع.
- دمج متغيرات مثل قراءات المقاومة، الجهد، والكتلة في مصفوفات حالة (State) داخل محركات حسابية معزولة تعتمد على `useMemo` لتقليل التأخير (Lag) أثناء السحب والإفلات.
- حقن ضوضاء طفيفة ومدروسة إحصائياً (Simulated Measurement Noise) لمحاكاة الخطأ البشري وعشوائية أجهزة القياس الحقيقية في المعامل، مما يعزز من واقعية التجربة للطلاب.

---
**تم التطوير بعناية واهتمام بالتفاصيل لبناء مستقبل التعليم الهندسي.**
