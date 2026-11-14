# ToGo — proposed project organization

Status: draft for your edits. No app scaffolding or database has been created yet.

## Product goal

Help people connect through sports, organize pickup games, and unwind and recharge through athletics. Start with the Cal Poly community, with a structure that can expand later.

First complete journey: sign in → choose sports → find a game → join → coordinate with the group → play.

## Design reference

[ToGo Figma design](https://www.figma.com/design/CI79bTiTosdKDrQuhUIxRW/ToGo-%E2%80%94-Startup-App-UI-UX?node-id=0-1)

Treat Figma as the reference for visual design and navigation. The design could not be inspected from this environment, so the screens below are proposed product organization, not a verified inventory of Figma frames. Review the frames before implementing layouts.

## Proposed stack

- React with JavaScript and JSX for a responsive web app.
- Vite for local development and production builds.
- React Router for page navigation.
- CSS with shared design tokens for colors, typography, spacing, and reusable components drawn from Figma.
- Supabase for PostgreSQL, authentication, and group-message updates. This keeps the first version to one frontend and a managed backend.
- SQL migrations checked into Git for all database changes.
- Vitest and React Testing Library for important UI behavior; a small browser test suite for the core game journey.

Browser → feature API functions → Supabase Auth / PostgreSQL.

Database permissions and transactional operations enforce rules. Client-side checks provide feedback but do not authorize actions. Add server functions only when privileged operations or integrations require them.

References: [Vite guide](https://vite.dev/guide/), [Supabase React guide](https://supabase.com/docs/guides/getting-started/quickstarts/reactjs), [database access policies](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Folder outline

```text
CPVC_hackathon/
├── README.md
├── PROJECT_PLAN.md
├── AGENTS.md                 # Project workflow instructions
├── package.json
├── index.html
├── vite.config.js
├── .env.example              # Variable names and placeholders only
├── .gitignore
├── .github/
│   ├── pull_request_template.md
│   └── workflows/ci.yml      # Lint, tests, and production build
├── public/                   # Static assets served directly
├── src/
│   ├── main.jsx
│   ├── app/
│   │   ├── App.jsx
│   │   ├── router.jsx
│   │   └── providers.jsx     # Authentication and shared providers
│   ├── components/
│   │   ├── ui/               # Buttons, fields, dialogs, badges
│   │   └── layout/           # Navigation and page shell
│   ├── features/
│   │   ├── auth/
│   │   ├── profiles/
│   │   ├── games/            # Discovery, details, create/edit, join/leave
│   │   └── messages/         # Game group conversation
│   ├── lib/
│   │   ├── supabase.js       # Single shared client
│   │   └── dates.js          # Date formatting and timezone helpers
│   ├── styles/
│   │   ├── tokens.css
│   │   └── globals.css
│   ├── assets/               # Imported images and icons
│   └── test/setup.js
├── supabase/
│   ├── migrations/           # Schema, constraints, policies, functions
│   ├── seed.sql              # Sample sports, venues, and demo data
│   └── tests/                # Permission and capacity tests
└── e2e/                      # Core browser journeys
```

Each feature owns its `pages/`, `components/`, `hooks/`, and `api.js` as needed. Keep tests next to the code they verify. Create folders when they contain real code. Move components into shared `components/` only when multiple features use them. Keep database calls inside feature API files rather than scattering them through UI components.

## Proposed screens

| Screen | Route | Purpose |
| --- | --- | --- |
| Welcome / sign in | `/`, `/login` | Explain ToGo and access an account |
| Onboarding | `/onboarding` | Set display name and sports interests |
| Discover | `/games` | Browse upcoming games; filter by sport, date, and venue |
| Game details | `/games/:gameId` | See time, location, skill level, open spots, and participants; join or leave |
| Host a game | `/games/new` | Choose sport, venue, time, capacity, and description |
| Edit game | `/games/:gameId/edit` | Host changes or cancels a game |
| My games | `/my-games` | See games you host or have joined |
| Group conversation | `/games/:gameId/chat` | Coordinate with game participants |
| My profile | `/profile` | Edit name, bio, and sports preferences |

Start with chronological discovery and manual filters. AI matching, direct messages, friend requests, payments, rankings, recurring games, push notifications, and waitlists are later candidates.

## Database outline

Use UUID primary keys except for join tables, timestamp columns with timezone, and foreign keys for relationships. Store times as instants and display them in the appropriate local timezone.

| Table | Main fields | Purpose |
| --- | --- | --- |
| `auth.users` | Managed user ID, email, authentication data | Supabase owns authentication; do not duplicate passwords |
| `profiles` | `id` → auth user, `display_name`, `bio`, `created_at`, `updated_at` | Public-facing account information; keep email in Auth |
| `sports` | `id`, unique `name`, unique `slug` | Shared sports catalog |
| `user_sports` | `user_id`, `sport_id`, `skill_level` | Interests and optional self-reported skill; composite primary key |
| `venues` | `id`, `name`, `address`, `latitude`, `longitude` | Initial curated list of courts, fields, and recreation areas |
| `games` | `id`, `host_id`, `sport_id`, `venue_id`, `title`, `description`, `starts_at`, `ends_at`, `capacity`, `skill_level`, `status`, timestamps | One scheduled sports gathering |
| `game_participants` | `game_id`, `user_id`, `joined_at` | Current roster; composite primary key prevents duplicate joins |
| `game_messages` | `id`, `game_id`, `sender_id`, `body`, `created_at` | Text coordination for a game's members |

Relationships:

```text
auth.users 1 ── 1 profiles
profiles   * ── * sports       through user_sports
profiles   1 ── * games        as host
sports     1 ── * games
venues     1 ── * games
profiles   * ── * games        through game_participants
games      1 ── * game_messages
profiles   1 ── * game_messages as sender
```

### Rules to implement with the schema

- Initial games are visible to signed-in users. Users can edit only their own profile and interests.
- Only the host can change or cancel a game. Host identity cannot be reassigned through normal updates.
- Creating a game also adds its host to the roster in one transaction. Capacity includes the host.
- Joining must use an atomic database operation that locks the game row, checks that it is upcoming and not canceled, checks capacity, and adds the authenticated user. All roster writes follow this operation so simultaneous requests cannot overfill a game.
- Leaving removes membership. A host must cancel instead of leaving in the first version.
- Host edits to time, capacity, and cancellation use the same locking discipline; capacity cannot fall below the current roster count.
- Require `ends_at > starts_at`, positive capacity, valid status (`scheduled` or `canceled`), and a defined skill-level value including `all_levels`. Derive past-game display from time.
- Only current participants can read or send group messages. Derive sender identity from the signed-in user; validate nonempty text and length. Former participants lose chat access.
- Use row-level security on every application table. Protect privileged keys; only the publishable client key belongs in frontend configuration.
- Add indexes for upcoming games by sport/time, games by host, participants by user, and messages by game/time.
- Write permission tests and a concurrent last-spot join test before shipping participation.

## Feature branches and review workflow

Every feature gets its own branch and corresponding pull request. No direct commits or merges into `main`. PRs require approval from an eligible repository collaborator other than the author or Codex before merging.

1. Branch from current `main`: `feature/<short-name>`, `fix/<short-name>`, or `docs/<short-name>`.
2. Keep each PR focused on one feature, including its schema changes, UI, and relevant checks.
3. Open the PR with behavior changes, verification results, and screenshots for visible UI changes. Use a draft PR if work is incomplete.
4. Address review feedback on the same branch and rerun affected checks.
5. Merge only after approval and passing checks; start the next feature from updated `main`.

Proposed repository enforcement: protect `main`, require a pull request and at least one approving review, dismiss stale approvals after changes, require CI, and block force pushes. These GitHub settings have not been configured. Required-review rules need an eligible reviewer other than the PR author; confirm reviewer arrangements during setup.

| Order | Branch / PR | Deliverable |
| --- | --- | --- |
| 0 | `docs/project-plan` | Review this organization and scope |
| 1 | `feature/project-foundation` | React/Vite setup, routes, design tokens, shared shell, CI, PR template |
| 2 | `feature/auth-profiles` | Auth, profiles, sports preferences, initial schema and policies |
| 3 | `feature/game-discovery` | Sports/venues seed data, game schema, browse/filter/details |
| 4 | `feature/game-hosting` | Create, edit, cancel, host roster membership |
| 5 | `feature/game-participation` | Atomic join/leave, capacity checks, My Games |
| 6 | `feature/game-chat` | Member-only conversation and message updates |

For discovery before hosting exists, use explicitly labeled development seed games. Each feature should handle loading, empty, error, and mobile states. Validate the completed journey across features before release.

## Initial Cal Poly venues and sports

This starting catalog covers ASI recreation spaces at Cal Poly San Luis Obispo; confirm additional eligible campus venues before claiming a complete inventory. A listing does not reserve a facility or guarantee access. Check membership and guest eligibility, open recreation schedules, reservations, and closures directly with ASI; open app sign-up does not grant facility access.

| Venue | Activities |
| --- | --- |
| Recreation Center Main Gym and Rec Gym | Basketball, indoor volleyball |
| Recreation Center North Gym | Basketball, volleyball, badminton, dodgeball, pickleball, futsal |
| Recreation Center South Gym | Basketball, volleyball, dodgeball, futsal |
| Recreation Center Multi-Activity Center | Badminton, dodgeball |
| Recreation Center racquetball courts | Racquetball; squash on the convertible court; wallyball on courts 1–5 |
| Recreation Center sand courts | Beach volleyball |
| Recreation Center indoor track | Running, walking |
| Recreation Center lap pool | Swimming |
| Poly Escapes Climbing Park | Climbing, bouldering |
| Sports Complex Upper Fields | Soccer and other field activities subject to permitted use |
| Sports Complex pickleball courts | Pickleball |
| Sports Complex futsal courts | Futsal |
| Sports Complex Lower Fields | Soccer, softball and field activities subject to permitted use |
| Doerr Family Field | Soccer, flag football, Frisbee, fitness conditioning |

Sources: [indoor facilities](https://www.asi.calpoly.edu/facilities/recreation-center/indoor-facilities/), [outdoor facilities](https://www.asi.calpoly.edu/get-active/open-recreation/outdoor-facilities/), [Upper Fields](https://www.asi.calpoly.edu/facilities/upper-fields/), and [Cal Poly campus catalog](https://catalog.calpoly.edu/welcome/campus-life/associated-students-inc/). The Upper Fields currently have partial capacity; check [facility hours](https://www.asi.calpoly.edu/facilities/facility-hours/) and ASI for current conditions.

## Decisions to edit before building

- [x] Name: ToGo; initial focus: Cal Poly.
- [x] Open sign-up; no campus account verification required.
- [x] React + Vite + Supabase.
- [x] Immediate joining, subject to game capacity.
- [x] Group chat in the first release.
- [x] An eligible repository collaborator other than Codex may approve PRs. Check branch protection availability during setup.
- [ ] Review the proposed venue and sports catalog and expand it as additional eligible campus spaces are verified.
- [ ] Review Figma screen names, navigation, and assets against the proposed screens.
- [ ] Confirm GitHub branch protection availability.
