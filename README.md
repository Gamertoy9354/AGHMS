# AGHMS – Academic Governance & HOD Monitoring System
### R.N.G. Patel Institute of Technology, Bardoli, Gujarat

[![Status](https://img.shields.io/badge/Status-Phase%201%20Active-blue)](.)
[![Stack](https://img.shields.io/badge/Stack-React%20+%20Supabase-green)](.)
[![License](https://img.shields.io/badge/License-Private-red)](.)

---

## 🎯 About

AGHMS is a comprehensive web application built for **RNGPIT** (R.N.G. Patel Institute of Technology) to streamline academic governance, meeting management, performance monitoring, and compliance tracking. Built for **Principal Latesh Sir** and the HOD community.

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm 9+
- Supabase account (free tier)

### Installation

```bash
# 1. Clone / open the project
cd d:/INNOCREW/AGHMS

# 2. Install dependencies (already done)
npm install

# 3. Configure environment
cp .env .env.local
# Edit .env with your Supabase credentials

# 4. Setup database (run in Supabase SQL Editor)
# Paste contents of supabase/schema.sql

# 5. Start development server
npm run dev
# → App running at http://localhost:5173
```

---

## 🔧 Supabase Setup

### Step 1: Create Project
1. Go to [supabase.com](https://supabase.com) → New Project
2. Choose `ap-south-1` region (Mumbai - closest to Bardoli)
3. Note your **Project URL** and **Anon Key**

### Step 2: Run Schema
1. Open Supabase → **SQL Editor**
2. Paste the entire contents of `supabase/schema.sql`
3. Click **Run** — this creates all tables, enums, indexes, and RLS policies

### Step 3: Create First Admin User
1. Go to Supabase → **Authentication** → **Users** → **Invite User**
2. Enter Principal's email
3. After they sign up, run this SQL to assign admin role:
```sql
UPDATE users SET role = 'principal' WHERE email = 'principal@rngpit.ac.in';
```

### Step 4: Configure .env
```env
VITE_SUPABASE_URL=https://yourproject.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

---

## 📁 Project Structure

```
AGHMS/
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   └── AppShell.jsx        # Sidebar + Header layout
│   │   ├── ui/
│   │   │   └── LoadingScreen.jsx   # Full-screen loader
│   │   └── ProtectedRoute.jsx      # Auth guard
│   ├── contexts/
│   │   ├── AuthContext.jsx          # Supabase Auth + profile
│   │   └── NotificationContext.jsx  # In-app notifications
│   ├── lib/
│   │   ├── supabase.js              # Supabase client
│   │   └── constants.js             # App-wide constants
│   ├── pages/
│   │   ├── auth/
│   │   │   └── LoginPage.jsx        # ✅ Glassmorphism login
│   │   ├── dashboard/
│   │   │   └── DashboardPage.jsx    # ✅ Full KPI dashboard
│   │   ├── meetings/
│   │   │   └── AgendasPage.jsx      # ✅ Meeting agendas list
│   │   ├── documents/
│   │   │   └── DocumentsPage.jsx    # ✅ Document hub + matrix
│   │   ├── academics/
│   │   │   └── PerformancePage.jsx  # ✅ Performance analytics
│   │   └── placement/
│   │       └── PlacementPage.jsx    # ✅ Placement tracking
│   ├── App.jsx                      # Router + providers
│   ├── main.jsx                     # Entry point
│   └── index.css                    # Global styles + design tokens
├── supabase/
│   └── schema.sql                   # Complete DB schema + RLS
├── tailwind.config.js
├── .env                             # Environment variables
└── package.json
```

---

## 👥 User Roles

| Role | Access Level | Key Features |
|------|-------------|-------------|
| **Director** | All data | Full system oversight |
| **Principal** | All data | Meeting approval, reports |
| **HOD** | Own department | Upload docs, view dept data |
| **Faculty** | Assigned data | Attendance, LMS, results |
| **TPO** | Placement data | Drive management |
| **Accounts** | Fees data | Collection tracking |
| **Exam Cell** | Results data | Result management |
| **Admin** | System admin | User management, settings |

---

## ✅ Phase 1 – Completed Features

- [x] **Glassmorphism Login Page** with form validation
- [x] **Role-based Auth** with Supabase Auth + RLS
- [x] **Dashboard** with 8 KPI cards, charts, activity feed
- [x] **Department Performance Charts** (bar, line, donut)
- [x] **Meeting Agendas Page** with status filters + doc progress
- [x] **Document Hub** with list view + compliance matrix
- [x] **Academic Performance Page** with rankings + trends
- [x] **Placement Monitoring** with sector/package analysis
- [x] **Collapsible Sidebar** with role-based navigation
- [x] **Notification System** (in-app context)
- [x] **Complete DB Schema** with RLS policies

---

## 🔄 Phase 2 – In Progress

- [ ] Meeting Calendar (monthly/annual view)
- [ ] Agenda Creation Form with rich text + templates
- [ ] Circular PDF generation + distribution
- [ ] MOM (Minutes of Meeting) module
- [ ] ATR Tracking
- [ ] Attendance monitoring with defaulter alerts
- [ ] Fees monitoring with collection analytics
- [ ] LMS compliance dashboard

---

## 🚀 Deployment

### Vercel (Frontend)
```bash
npm run build
# Deploy dist/ folder to Vercel
# Set environment variables in Vercel dashboard
```

### Supabase (Backend + Auth + Storage)
- Database: Managed on Supabase Cloud
- Auth: Built-in Supabase Auth
- Storage: Supabase Storage (for document files)

---

## 📊 Database Overview

**Core tables:** `users`, `departments`, `academic_years`, `semesters`

**Meetings:** `meetings`, `meeting_calendar`, `agenda_items`, `meeting_mom`, `action_items`

**Documents:** `documents`, `document_versions`

**Academics:** `students`, `subjects`, `results`, `co_attainment`, `weak_students`, `attendance_summary`

**Placement:** `companies`, `placement_drives`, `placement_offers`

**Fees:** `student_fee_records`

**Compliance:** `compliance_documents`, `program_outcomes`, `course_outcomes`

**System:** `notifications`, `audit_logs`

---

## 🔐 Security Features

- Supabase Row Level Security (RLS) on all tables
- Role-based access control (8 distinct roles)
- JWT-based session management (Supabase Auth)
- HODs can only access their department data
- Audit trail for all critical actions
- Signed URLs for document storage

---

## 📞 Support

For issues, contact the development team or raise a GitHub issue.

**Built with ❤️ for RNGPIT Bardoli · 2025–26**
