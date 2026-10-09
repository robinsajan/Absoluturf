# AbsoluTurf – Technical Product Specification (MVP)

Version: 1.0  
Frontend: Next.js  
Backend: Flask REST API  
Database: SQLite  
Target Platform: Mobile First Web Application

---

# 1. Product Overview

## Product Name
AbsoluTurf

## Product Description
AbsoluTurf is a group-based turf booking and match coordination platform focused on simplifying recurring sports match management.

The application helps groups:
- Coordinate matches
- Manage attendance voting
- Track player confirmations
- Handle substitutes
- Manage payment confirmations
- Enforce backout penalties
- Maintain match history

The MVP is optimized for football turf groups but architecture should support future multi-sport expansion.

---

# 2. Core Product Objectives

## Primary Goals
- Reduce manual coordination in WhatsApp groups
- Automate match confirmation flow
- Track payments efficiently
- Prevent last-minute player dropouts
- Simplify substitute handling
- Create a modern mobile-first sports management experience

---

# 3. Technical Stack

# Frontend
## Framework
- Next.js (App Router)

## Styling
- Tailwind CSS

## UI Components
- ShadCN/UI (recommended)

## State Management
- Zustand

## Forms
- React Hook Form
- Zod validation

## API Communication
- Axios

## Authentication Storage
- JWT stored in HTTP-only cookies

---

# Backend
## Framework
- Flask

## API Architecture
- REST API

## Authentication
- JWT Authentication

## ORM
- SQLAlchemy

## Validation
- Marshmallow / Pydantic

---

# Database
## Current Database
- SQLite

## Future Migration Path
- PostgreSQL

Database design should remain migration-safe.

---

# 4. Mobile First UI/UX Requirements

## Design Language
UI should follow:
- Dark modern sports aesthetic
- Neon green accent theme
- Rounded UI cards
- Minimal sporty layouts
- High contrast readability
- Dashboard-first navigation
- Smooth transitions
- Premium fitness/sports feel

---

## Primary Color Palette
| Color | Usage |
|---|---|
| Neon Green | Primary Actions |
| Black | Background |
| Dark Gray | Cards / Surfaces |
| White | Text |
| Soft Gray | Secondary Text |

---

## UI Guidelines

### Mobile First
- Entire app optimized for mobile screens first
- One-hand usability preferred
- Bottom navigation required
- Large tap targets
- Sticky CTA buttons on mobile

---

### Navigation Structure
## Bottom Navigation Tabs
1. Home
2. Matches
3. Groups
4. Payments
5. Profile

---

### UI Components Required
- Match cards
- Voting progress bars
- Payment status chips
- Floating action buttons
- Expandable match sections
- Confirmation modals
- Bottom sheets
- Toast notifications
- Loading skeletons

---

### Responsive Rules
| Screen | Behavior |
|---|---|
| Mobile | Primary Layout |
| Tablet | Responsive Grid |
| Desktop | Optional Admin Layout |

---

# 5. User Roles

## 5.1 Normal User
### Capabilities
- Join groups
- Request to join groups
- Vote for matches
- View confirmed matches
- Mark payment as paid
- Join substitute queue
- View penalties
- View payment status
- Leave groups

---

## 5.2 Group Admin
### Capabilities
- Create matches
- Edit matches
- Confirm turf booking
- Add/remove members
- Promote users to admin
- Remove admins
- Confirm payments
- Manage penalties
- Configure match rules
- Manage substitute replacements

---

# 6. Authentication Module

## Features
- Signup
- Login
- Logout
- Session persistence
- JWT validation

---

## Signup Fields
| Field | Type |
|---|---|
| Full Name | String |
| Email | String |
| Phone Number | String |
| Password | String |
| Profile Image | Optional |

---

## Validation Rules
- Unique email
- Strong password validation
- Phone format validation

---

# 7. Group Management Module

# 7.1 Create Group

## Group Fields
| Field | Type |
|---|---|
| Group Name | String |
| Description | Text |
| Sport Type | Enum |
| Group Image | Optional |
| Visibility | Public / Private |
| City | String |

---

# 7.2 Group Permissions

## Rules
- Multiple admins allowed
- Maximum 5 admins
- Users can join multiple groups
- Users can admin multiple groups
- No member limit

---

# 7.3 Join Request Flow

## Public Group
- User can request to join
- Admin approval required

## Private Group
- Invite-only or approval-based

---

# 8. Match Management System

# 8.1 Match Creation

Admins can create proposed matches.

---

## Match Fields
| Field | Type |
|---|---|
| Match Title | String |
| Turf Name | String |
| Turf Location | String |
| Match Date | Date |
| Match Time | Time |
| Max Players | Integer |
| Min Players Required | Integer |
| Cost Per Player | Decimal |
| Payment Type | Enum |
| Notes | Text |

---

## Match Status Flow
1. Proposed
2. Voting Open
3. Minimum Players Reached
4. Turf Confirmed
5. Completed
6. Cancelled

---

# 8.2 Voting System

## Vote Types
- Yes
- No

---

## Voting Rules
- Users can change votes before booking confirmation
- Votes lock after turf confirmation
- Match edits reset votes
- Users can vote for multiple matches

---

## Voting UI Requirements
- Real-time visible vote count
- Progress bar for minimum player target
- Highlight remaining slots
- Show confirmed players separately

---

# 8.3 Match Confirmation

## Confirmation Conditions
- Minimum player threshold reached
- Admin confirms booking manually

---

## Confirmation Actions
- Votes locked
- Match moved to confirmed section
- Payment tracking enabled
- Substitute system enabled

---

# 9. Backout & Substitute System

# 9.1 Backout Rules

## Conditions
- Players can revoke participation only before 12 hours of match start
- Revocation requires:
  - Admin notification
  - Reason submission
  - Substitute replacement

---

# 9.2 Substitute Queue

## Rules
- Maximum 5 substitutes per match
- Queue ordered by join time
- Admin manages replacements

---

## Substitute Flow
1. User joins substitute queue
2. Confirmed player backs out
3. Admin approves replacement
4. Substitute promoted
5. Payment responsibility transferred

---

# 10. Payment Management System

# 10.1 Payment Types

## Prepaid
- User must pay before match
- Spot considered confirmed only after admin approval

---

## Postpaid
- User pays after match
- Admin verifies manually

---

# 10.2 Payment Flow

## User Side
1. User clicks “Mark as Paid”
2. Payment status becomes “Pending Verification”

---

## Admin Side
1. Admin checks bank/UPI manually
2. Admin confirms payment
3. Status updated to “Paid”

---

# 10.3 Payment Statuses
| Status | Description |
|---|---|
| Pending | Payment not initiated |
| Verification Pending | User marked paid |
| Paid | Admin confirmed |
| Failed | Rejected payment |
| Refunded | Payment reversed |

---

# 10.4 Payment UI Requirements

## Required Features
- Highlight unpaid users
- Payment status chips
- Match-wise payment summary
- Pending verification section
- Admin payment dashboard

---

# 11. Penalty System

# 11.1 Penalty Types
Admins can apply:
1. Match Ban
2. Mandatory Payment Fine
3. Voting Restriction

---

# 11.2 Ban Logic

## Rules
- Bans are match-count based
- Not time-based
- Example:
  - 3-match ban expires after 3 future matches occur

---

## Banned User Restrictions
- Cannot vote
- Cannot confirm participation
- Cannot join substitutes

---

# 12. Match History Module

## Features
- View completed matches
- View attendance
- View payment history
- View penalties
- View substitutes used

---

## Match History Card Fields
| Field | Description |
|---|---|
| Match Name | Title |
| Date | Match Date |
| Turf | Turf Name |
| Final Players | Player List |
| Payment Completion | Payment Status |

---

# 13. Dashboard System

# 13.1 User Dashboard

## Sections
- Upcoming Matches
- Pending Payments
- Active Groups
- Match History
- Notifications

---

# 13.2 Admin Dashboard

## Sections
- Vote Progress
- Pending Confirmations
- Pending Payments
- Defaulters
- Substitute Queue
- Group Activity

---

# 14. Notification System

## MVP Notification Scope
Only in-app notifications.

---

## Notification Types
- Match proposed
- Match confirmed
- Payment reminder
- Payment confirmed
- Substitute promoted
- Match cancelled
- Penalty applied

---

# 15. API Architecture

# Authentication APIs
```http
POST /api/auth/signup
POST /api/auth/login
POST /api/auth/logout
GET /api/auth/me
```

---

# Group APIs
```http
POST /api/groups
GET /api/groups
GET /api/groups/:id
POST /api/groups/:id/join-request
POST /api/groups/:id/add-member
POST /api/groups/:id/remove-member
POST /api/groups/:id/promote-admin
```

---

# Match APIs
```http
POST /api/matches
GET /api/matches
GET /api/matches/:id
PUT /api/matches/:id
POST /api/matches/:id/vote
POST /api/matches/:id/confirm
POST /api/matches/:id/backout
```

---

# Payment APIs
```http
POST /api/payments/mark-paid
POST /api/payments/confirm
GET /api/payments/pending
```

---

# Penalty APIs
```http
POST /api/penalties
GET /api/penalties
DELETE /api/penalties/:id
```

---

# 16. Database Schema

# Users Table
```sql
id
name
email
phone
password_hash
profile_image
created_at
```

---

# Groups Table
```sql
id
name
description
sport_type
visibility
image
created_by
created_at
```

---

# GroupMembers Table
```sql
id
group_id
user_id
role
joined_at
```

---

# Matches Table
```sql
id
group_id
created_by
title
turf_name
location
match_date
match_time
max_players
min_players
cost_per_player
payment_type
status
created_at
```

---

# MatchVotes Table
```sql
id
match_id
user_id
vote
created_at
```

---

# Payments Table
```sql
id
match_id
user_id
amount
status
verified_by
paid_at
```

---

# Substitutes Table
```sql
id
match_id
user_id
queue_position
promoted
```

---

# Penalties Table
```sql
id
user_id
group_id
penalty_type
remaining_matches
reason
created_by
created_at
```

---

# 17. Security Requirements

## Authentication Security
- JWT validation
- Password hashing
- Token expiration

---

## API Security
- Input validation
- SQL injection prevention
- Authorization middleware
- Admin permission checks

---

# 18. Performance Requirements

## MVP Targets
- API response under 500ms
- Mobile optimized rendering
- Fast dashboard loading
- Optimistic UI updates

---

# 19. Future Scope

## Future Features
- Push notifications
- Online payments
- Turf marketplace
- Chat system
- Team balancing
- Match stats
- Leaderboards
- Tournament mode

---

# 20. Development Roadmap

# Phase 1 – Core MVP
- Authentication
- Group management
- Match voting
- Match confirmation

---

# Phase 2 – Payments
- Manual payment confirmation
- Payment dashboards
- Pending tracking

---

# Phase 3 – Penalties & Substitutes
- Ban system
- Backout flow
- Substitute handling

---

# Phase 4 – UI Polish
- Animations
- Responsive improvements
- Better dashboards
- UX enhancements

---

# 21. Final Product Vision

AbsoluTurf should become a premium sports coordination platform focused on recurring turf communities.

The experience should feel:
- Fast
- Mobile-native
- Social
- Competitive
- Modern
- Highly optimized for sports groups

The product should eliminate manual