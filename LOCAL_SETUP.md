# Flashy local setup

## 1. What you need to fill

Create this file:

- [flashy/client/.env.local](flashy/client/.env.local)

Contents:

```dotenv
REACT_APP_SUPABASE_URL=https://dcbthcxgeusaspcjczlj.supabase.co
REACT_APP_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
SKIP_PREFLIGHT_CHECK=true
```

Use the same Supabase project as TutPro.

- `REACT_APP_SUPABASE_URL`: already known and fixed above
- `REACT_APP_SUPABASE_ANON_KEY`: copy the anon/public key from your existing TutPro env file or Supabase project settings

If you want the student app to open Flashy automatically for students, also do these two things:

- enable **Anonymous sign-ins** in Supabase Auth → Providers
- set `VITE_FLASHY_URL` in [student-app/.env.example](student-app/.env.example) or your real student-app env file to your deployed Flashy URL

## 2. Supabase database setup

Run these SQL files in the Supabase SQL editor, in this order:

1. [flashy/supabase/migrations/001_flashy_tables.sql](flashy/supabase/migrations/001_flashy_tables.sql)
2. [flashy/supabase/migrations/002_flashy_rls.sql](flashy/supabase/migrations/002_flashy_rls.sql)
3. [flashy/supabase/migrations/003_flashy_sync_triggers.sql](flashy/supabase/migrations/003_flashy_sync_triggers.sql)
4. [flashy/supabase/migrations/004_flashy_claim_student.sql](flashy/supabase/migrations/004_flashy_claim_student.sql)
5. [flashy/supabase/migrations/005_flashy_teacher_profile_sync.sql](flashy/supabase/migrations/005_flashy_teacher_profile_sync.sql)
6. [flashy/supabase/migrations/006_flashy_student_auth.sql](flashy/supabase/migrations/006_flashy_student_auth.sql)

Without these tables and policies, the app will open but most data screens will not work.

## 3. Node 25 support

This project is now patched to run on `Node 25`.

The client build tooling was updated for Node 25, and the npm scripts now apply the required OpenSSL compatibility flag automatically.

Supported local versions:

- Node 25.x
- npm 11.x

Older LTS versions like Node 20 should still work too.

## 4. Install once

From [flashy/client](flashy/client):

- `npm install`

After that, daily startup is a single command.

## 5. Run locally with one command

From [flashy/client](flashy/client):

- `npm start`

Open:

- `http://localhost:3000`

## 6. Reveal it to your local network

From [flashy/client](flashy/client):

- `npm run start:lan`

Then:

1. run `ipconfig`
2. find the **IPv4 Address** of your active Wi-Fi or Ethernet adapter
3. open `http://YOUR_IPV4_ADDRESS:3000` on another device on the same network

Example:

- if your PC IP is `192.168.0.42`, open `http://192.168.0.42:3000`

Notes:

- allow Node.js through the Windows Firewall when prompted
- both devices must be on the same local network
- some guest Wi-Fi networks block device-to-device access

## 7. How to sign in locally

### Teacher

Use an existing TutPro teacher account from the shared Supabase project.

### Student

Create a student account through Flashy sign-up, or use an existing student account already present in the same Supabase project.

If anonymous auth is enabled, students can also be auto-created the first time they open Flashy from the student app.

## 8. How teacher/student linking works now

The teacher does **not** create the student auth account from the browser.

Instead:

1. the student signs up first
2. the teacher opens the Students screen
3. the teacher enters that student email
4. the student gets linked to that teacher

## 9. Quick local checklist

- [ ] Node 25 installed
- [ ] [flashy/client/.env.local](flashy/client/.env.local) created
- [ ] Supabase anon key filled in
- [ ] SQL migrations 001-005 run in Supabase
- [ ] `npm install` completed in [flashy/client](flashy/client)
- [ ] `npm start` or `npm run start:lan` running
