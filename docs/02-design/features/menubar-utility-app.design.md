# Design: MenuBar Utility App

> **Feature**: menubar-utility-app
> **Plan Reference**: `docs/01-plan/features/menubar-utility-app.plan.md`
> **Level**: Dynamic (Electron + Supabase)
> **Created**: 2026-02-20
> **Status**: Draft

---

## 1. Project Structure

```
menubar-utility/
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── electron-builder.yml
├── tailwind.config.ts
├── postcss.config.js
├── vite.config.ts                # Vite for Renderer
│
├── src/
│   ├── main/                     # Electron Main Process
│   │   ├── index.ts              # Entry: Tray + menubar setup
│   │   ├── ipc/                  # IPC Handlers
│   │   │   ├── index.ts          # Register all handlers
│   │   │   ├── todo.ipc.ts
│   │   │   ├── memo.ipc.ts
│   │   │   ├── jira.ipc.ts
│   │   │   ├── calendar.ipc.ts
│   │   │   ├── team.ipc.ts
│   │   │   └── settings.ipc.ts
│   │   ├── db/                   # SQLite Layer
│   │   │   ├── index.ts          # DB init + migrations
│   │   │   ├── migrations/       # Schema migration files
│   │   │   │   └── 001_init.sql
│   │   │   ├── todo.repo.ts
│   │   │   ├── memo.repo.ts
│   │   │   ├── calendar.repo.ts
│   │   │   ├── jira.repo.ts
│   │   │   └── settings.repo.ts
│   │   ├── services/             # Business Logic
│   │   │   ├── jira.service.ts   # Jira REST API client
│   │   │   ├── supabase.service.ts  # Supabase client + realtime
│   │   │   ├── sync.service.ts   # Local <-> Remote sync
│   │   │   ├── scheduler.service.ts # Calendar alert scheduler
│   │   │   └── notification.service.ts
│   │   └── preload.ts            # Context bridge
│   │
│   ├── renderer/                 # React App (Renderer Process)
│   │   ├── index.html
│   │   ├── main.tsx              # React entry
│   │   ├── App.tsx               # Root component + Router
│   │   ├── components/           # Shared UI components
│   │   │   ├── ui/               # shadcn/ui components
│   │   │   ├── TabNav.tsx
│   │   │   ├── StatusBadge.tsx
│   │   │   ├── PriorityIcon.tsx
│   │   │   ├── AvatarGroup.tsx
│   │   │   ├── EmptyState.tsx
│   │   │   └── ConfirmDialog.tsx
│   │   ├── features/             # Feature modules
│   │   │   ├── todo/
│   │   │   │   ├── TodoTab.tsx
│   │   │   │   ├── TodoList.tsx
│   │   │   │   ├── TodoItem.tsx
│   │   │   │   ├── TodoForm.tsx
│   │   │   │   ├── TodoFilter.tsx
│   │   │   │   └── useTodoStore.ts
│   │   │   ├── memo/
│   │   │   │   ├── MemoTab.tsx
│   │   │   │   ├── MemoTree.tsx
│   │   │   │   ├── MemoTreeItem.tsx
│   │   │   │   ├── MemoEditor.tsx
│   │   │   │   ├── MemoSearch.tsx
│   │   │   │   └── useMemoStore.ts
│   │   │   ├── jira/
│   │   │   │   ├── JiraTab.tsx
│   │   │   │   ├── JiraTicketForm.tsx
│   │   │   │   ├── JiraHistory.tsx
│   │   │   │   ├── JiraSetup.tsx
│   │   │   │   └── useJiraStore.ts
│   │   │   ├── calendar/
│   │   │   │   ├── CalendarTab.tsx
│   │   │   │   ├── MonthView.tsx
│   │   │   │   ├── EventForm.tsx
│   │   │   │   ├── TodayAlerts.tsx
│   │   │   │   └── useCalendarStore.ts
│   │   │   ├── team/
│   │   │   │   ├── TeamTab.tsx
│   │   │   │   ├── TeamList.tsx
│   │   │   │   ├── MemberList.tsx
│   │   │   │   ├── SpotGroupForm.tsx
│   │   │   │   ├── InviteDialog.tsx
│   │   │   │   └── useTeamStore.ts
│   │   │   └── settings/
│   │   │       ├── SettingsView.tsx
│   │   │       ├── JiraSettings.tsx
│   │   │       ├── ThemeSettings.tsx
│   │   │       ├── AccountSettings.tsx
│   │   │       └── useSettingsStore.ts
│   │   ├── hooks/                # Shared hooks
│   │   │   ├── useIpc.ts         # IPC invoke wrapper
│   │   │   ├── useSupabase.ts    # Supabase realtime hook
│   │   │   └── useTheme.ts
│   │   ├── lib/                  # Utilities
│   │   │   ├── ipc-channels.ts   # Channel name constants
│   │   │   └── utils.ts
│   │   └── styles/
│   │       └── globals.css       # Tailwind base
│   │
│   └── shared/                   # Shared between Main & Renderer
│       └── types/
│           ├── todo.types.ts
│           ├── memo.types.ts
│           ├── jira.types.ts
│           ├── calendar.types.ts
│           ├── team.types.ts
│           └── ipc.types.ts
│
├── resources/                    # App resources
│   ├── icon.png                  # Tray icon (22x22 @2x)
│   ├── icon-active.png           # Active state icon
│   └── icon.icns                 # macOS app icon
│
└── docs/                         # PDCA documents
```

---

## 2. Electron Architecture

### 2.1 Main Process (`src/main/index.ts`)

```typescript
// Electron Main Process 핵심 구조
import { menubar } from 'menubar';
import { initDatabase } from './db';
import { registerIpcHandlers } from './ipc';
import { SchedulerService } from './services/scheduler.service';

const mb = menubar({
  index: `file://${__dirname}/../renderer/index.html`,
  browserWindow: {
    width: 420,
    height: 520,
    resizable: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  },
  preloadWindow: true,   // 미리 로드 -> 빠른 표시
  showDockIcon: false,    // Dock에 표시 안함
});

mb.on('ready', async () => {
  await initDatabase();
  registerIpcHandlers();
  SchedulerService.start();  // 알림 스케줄러 시작
});
```

### 2.2 Preload & Context Bridge (`src/main/preload.ts`)

```typescript
// Renderer에 노출할 API (contextBridge)
const api = {
  // Todo
  todo: {
    getAll: (filter: TodoFilter) => ipcRenderer.invoke('todo:getAll', filter),
    create: (data: CreateTodoDto) => ipcRenderer.invoke('todo:create', data),
    update: (id: string, data: UpdateTodoDto) => ipcRenderer.invoke('todo:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('todo:delete', id),
    reorder: (ids: string[]) => ipcRenderer.invoke('todo:reorder', ids),
  },
  // Memo
  memo: {
    getFolders: () => ipcRenderer.invoke('memo:getFolders'),
    createFolder: (data: CreateFolderDto) => ipcRenderer.invoke('memo:createFolder', data),
    updateFolder: (id: string, data: UpdateFolderDto) => ipcRenderer.invoke('memo:updateFolder', id, data),
    deleteFolder: (id: string) => ipcRenderer.invoke('memo:deleteFolder', id),
    getMemos: (folderId: string) => ipcRenderer.invoke('memo:getMemos', folderId),
    createMemo: (data: CreateMemoDto) => ipcRenderer.invoke('memo:createMemo', data),
    updateMemo: (id: string, data: UpdateMemoDto) => ipcRenderer.invoke('memo:updateMemo', id, data),
    deleteMemo: (id: string) => ipcRenderer.invoke('memo:deleteMemo', id),
    moveMemo: (id: string, targetFolderId: string) => ipcRenderer.invoke('memo:moveMemo', id, targetFolderId),
    search: (query: string) => ipcRenderer.invoke('memo:search', query),
  },
  // Jira
  jira: {
    getProjects: () => ipcRenderer.invoke('jira:getProjects'),
    getIssueTypes: (projectKey: string) => ipcRenderer.invoke('jira:getIssueTypes', projectKey),
    createTicket: (data: CreateTicketDto) => ipcRenderer.invoke('jira:createTicket', data),
    getHistory: () => ipcRenderer.invoke('jira:getHistory'),
  },
  // Calendar
  calendar: {
    getEvents: (year: number, month: number) => ipcRenderer.invoke('calendar:getEvents', year, month),
    createEvent: (data: CreateEventDto) => ipcRenderer.invoke('calendar:createEvent', data),
    updateEvent: (id: string, data: UpdateEventDto) => ipcRenderer.invoke('calendar:updateEvent', id, data),
    deleteEvent: (id: string) => ipcRenderer.invoke('calendar:deleteEvent', id),
    getTodayAlerts: () => ipcRenderer.invoke('calendar:getTodayAlerts'),
    snooze: (id: string, minutes: number) => ipcRenderer.invoke('calendar:snooze', id, minutes),
  },
  // Team
  team: {
    getMyTeams: () => ipcRenderer.invoke('team:getMyTeams'),
    getMembers: (teamId: string) => ipcRenderer.invoke('team:getMembers', teamId),
    createSpotGroup: (data: CreateGroupDto) => ipcRenderer.invoke('team:createSpotGroup', data),
    archiveGroup: (groupId: string) => ipcRenderer.invoke('team:archiveGroup', groupId),
    invite: (teamId: string, email: string) => ipcRenderer.invoke('team:invite', teamId, email),
    removeMember: (teamId: string, userId: string) => ipcRenderer.invoke('team:removeMember', teamId, userId),
  },
  // Settings
  settings: {
    get: (key: string) => ipcRenderer.invoke('settings:get', key),
    set: (key: string, value: string) => ipcRenderer.invoke('settings:set', key, value),
    getAll: () => ipcRenderer.invoke('settings:getAll'),
  },
  // Events (Main -> Renderer)
  on: (channel: string, callback: (...args: any[]) => void) => {
    ipcRenderer.on(channel, (_event, ...args) => callback(...args));
  },
  off: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  },
};

contextBridge.exposeInMainWorld('electronAPI', api);
```

### 2.3 IPC Channel Map

| Channel | Direction | Description |
|---------|-----------|-------------|
| `todo:*` | Renderer -> Main | Todo CRUD + reorder |
| `memo:*` | Renderer -> Main | Memo/Folder CRUD + search |
| `jira:*` | Renderer -> Main | Jira API proxy |
| `calendar:*` | Renderer -> Main | Calendar events + alerts |
| `team:*` | Renderer -> Main | Team/Group management (Supabase) |
| `settings:*` | Renderer -> Main | App settings |
| `sync:status` | Main -> Renderer | Sync status update |
| `alert:fire` | Main -> Renderer | Calendar alert trigger |
| `todo:updated` | Main -> Renderer | Realtime todo sync from other users |
| `team:updated` | Main -> Renderer | Team membership change notification |

---

## 3. Data Model (Detailed)

### 3.1 Local SQLite Schema

```sql
-- 001_init.sql

-- Todo (로컬 + 동기화 대상)
CREATE TABLE todos (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  title         TEXT NOT NULL,
  description   TEXT DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'todo' CHECK(status IN ('todo', 'in_progress', 'done')),
  priority      TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'urgent')),
  due_date      TEXT,                          -- ISO 8601
  assignee_id   TEXT,                          -- Supabase user id (nullable = 개인)
  team_id       TEXT,                          -- null = 개인, team uuid = 공유
  sort_order    INTEGER NOT NULL DEFAULT 0,
  remote_id     TEXT,                          -- Supabase sync id
  synced_at     TEXT,                          -- 마지막 동기화 시간
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_todos_team ON todos(team_id);
CREATE INDEX idx_todos_status ON todos(status);

-- 메모 폴더 (트리 구조)
CREATE TABLE memo_folders (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  parent_id     TEXT REFERENCES memo_folders(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  is_expanded   INTEGER NOT NULL DEFAULT 1,    -- 0=접힘, 1=펼침
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_memo_folders_parent ON memo_folders(parent_id);

-- 메모
CREATE TABLE memos (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  folder_id     TEXT NOT NULL REFERENCES memo_folders(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  content       TEXT DEFAULT '',                -- Markdown content
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_memos_folder ON memos(folder_id);

-- 캘린더 이벤트
CREATE TABLE calendar_events (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  title         TEXT NOT NULL,
  memo          TEXT DEFAULT '',
  event_date    TEXT NOT NULL,                  -- YYYY-MM-DD
  event_time    TEXT NOT NULL,                  -- HH:MM
  repeat_type   TEXT DEFAULT 'none' CHECK(repeat_type IN ('none', 'daily', 'weekly', 'monthly')),
  alert_before  INTEGER NOT NULL DEFAULT 0,     -- 분 단위 (0 = 정시 알림)
  is_snoozed    INTEGER NOT NULL DEFAULT 0,
  snooze_until  TEXT,                           -- 스누즈 시간
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_calendar_date ON calendar_events(event_date);

-- Jira 티켓 생성 히스토리
CREATE TABLE jira_history (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  ticket_key    TEXT NOT NULL,                  -- e.g., PROJ-123
  summary       TEXT NOT NULL,
  project_key   TEXT NOT NULL,
  issue_type    TEXT NOT NULL,
  jira_url      TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 앱 설정 (Key-Value)
CREATE TABLE settings (
  key           TEXT PRIMARY KEY,
  value         TEXT NOT NULL
);

-- 기본 설정 삽입
INSERT INTO settings (key, value) VALUES
  ('theme', 'system'),
  ('jira_base_url', ''),
  ('jira_email', ''),
  ('jira_api_token', ''),
  ('supabase_url', ''),
  ('supabase_anon_key', ''),
  ('global_hotkey', 'CommandOrControl+Shift+M');
```

### 3.2 Remote Supabase Schema

```sql
-- Supabase PostgreSQL

-- 사용자 (Supabase Auth 연동)
CREATE TABLE public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  display_name  TEXT NOT NULL,
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 팀 (기본 팀 + 스팟 그룹)
CREATE TABLE public.teams (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  type          TEXT NOT NULL DEFAULT 'default' CHECK(type IN ('default', 'spot')),
  description   TEXT DEFAULT '',
  created_by    UUID NOT NULL REFERENCES public.profiles(id),
  is_archived   BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at   TIMESTAMPTZ
);

-- 팀 구성원
CREATE TABLE public.team_members (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id       UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role          TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('admin', 'member')),
  joined_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(team_id, user_id)
);

-- 공유 Todo
CREATE TABLE public.shared_todos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id       UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'todo' CHECK(status IN ('todo', 'in_progress', 'done')),
  priority      TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'urgent')),
  due_date      TIMESTAMPTZ,
  assignee_id   UUID REFERENCES public.profiles(id),
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_by    UUID NOT NULL REFERENCES public.profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 초대
CREATE TABLE public.invitations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id       UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  invited_email TEXT NOT NULL,
  invited_by    UUID NOT NULL REFERENCES public.profiles(id),
  status        TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'declined')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days')
);

-- RLS Policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- profiles: 본인 읽기/수정
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- teams: 소속 팀만 조회
CREATE POLICY "Members can view their teams" ON public.teams
  FOR SELECT USING (
    id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
  );
-- teams: admin만 수정
CREATE POLICY "Admins can update teams" ON public.teams
  FOR UPDATE USING (
    id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid() AND role = 'admin')
  );
-- teams: 인증된 사용자 생성 가능
CREATE POLICY "Auth users can create teams" ON public.teams
  FOR INSERT WITH CHECK (auth.uid() = created_by);

-- team_members: 소속 팀 구성원 조회
CREATE POLICY "Members can view team members" ON public.team_members
  FOR SELECT USING (
    team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
  );

-- shared_todos: 소속 팀 Todo만 조회/수정
CREATE POLICY "Members can view team todos" ON public.shared_todos
  FOR SELECT USING (
    team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
  );
CREATE POLICY "Members can insert team todos" ON public.shared_todos
  FOR INSERT WITH CHECK (
    team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
  );
CREATE POLICY "Members can update team todos" ON public.shared_todos
  FOR UPDATE USING (
    team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
  );

-- Realtime 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE public.shared_todos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.team_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.invitations;
```

### 3.3 Entity Relationship

```
[profiles] 1 ──── * [team_members] * ──── 1 [teams]
                                              │
                                         1    │
[profiles] 1 ──── * [shared_todos] * ─────────┘
                                              │
[profiles] 1 ──── * [invitations]  * ─────────┘

--- Local Only ---

[memo_folders] 1 ──── * [memo_folders]  (self-ref: parent_id)
[memo_folders] 1 ──── * [memos]
[calendar_events]  (standalone)
[jira_history]     (standalone)
[settings]         (key-value)

--- Sync Bridge ---

[todos (local)] <--- sync ---> [shared_todos (remote)]
  matched by: todos.remote_id = shared_todos.id
```

---

## 4. State Management (Zustand)

### 4.1 Store Architecture

```
┌─────────────────────────────────────────────┐
│                  Zustand Stores              │
├─────────────────────────────────────────────┤
│                                             │
│  useTodoStore    ←→ IPC: todo:*             │
│  ├─ todos: Todo[]                           │
│  ├─ filter: TodoFilter                      │
│  ├─ activeTeamId: string | null             │
│  └─ actions: fetch, create, update, delete  │
│                                             │
│  useMemoStore    ←→ IPC: memo:*             │
│  ├─ folders: MemoFolder[] (tree)            │
│  ├─ activeMemoId: string | null             │
│  ├─ searchQuery: string                     │
│  └─ actions: CRUD + search + move           │
│                                             │
│  useJiraStore    ←→ IPC: jira:*             │
│  ├─ projects: JiraProject[] (cached)        │
│  ├─ history: JiraTicket[]                   │
│  ├─ isConfigured: boolean                   │
│  └─ actions: createTicket, refresh          │
│                                             │
│  useCalendarStore ←→ IPC: calendar:*        │
│  ├─ events: CalendarEvent[]                 │
│  ├─ selectedDate: Date                      │
│  ├─ todayAlerts: CalendarEvent[]            │
│  └─ actions: CRUD + snooze                  │
│                                             │
│  useTeamStore    ←→ IPC: team:*             │
│  ├─ teams: Team[] (default + spots)         │
│  ├─ activeTeamId: string                    │
│  ├─ members: Record<teamId, Member[]>       │
│  └─ actions: createGroup, invite, archive   │
│                                             │
│  useSettingsStore ←→ IPC: settings:*        │
│  ├─ theme: 'light' | 'dark' | 'system'     │
│  ├─ jiraConfig: JiraConfig                  │
│  └─ actions: get, set                       │
│                                             │
└─────────────────────────────────────────────┘
```

### 4.2 Store Example: `useTodoStore`

```typescript
interface TodoStore {
  // State
  todos: Todo[];
  filter: TodoFilter;
  isLoading: boolean;

  // Actions
  fetchTodos: () => Promise<void>;
  createTodo: (data: CreateTodoDto) => Promise<void>;
  updateTodo: (id: string, data: UpdateTodoDto) => Promise<void>;
  deleteTodo: (id: string) => Promise<void>;
  reorderTodos: (ids: string[]) => Promise<void>;
  setFilter: (filter: Partial<TodoFilter>) => void;
}

interface TodoFilter {
  scope: 'personal' | 'team' | 'group';
  teamId?: string;
  status?: 'todo' | 'in_progress' | 'done' | 'all';
  assigneeId?: string;
}
```

---

## 5. Component Design (Feature Detail)

### 5.1 F1: Todo Tab

```
TodoTab
├── TodoFilter          # 범위(개인/팀/그룹) + 상태 필터
│   ├── ScopeSelector   # 개인 | 기본팀 | 그룹 드롭다운
│   └── StatusTabs      # 전체 | 할일 | 진행중 | 완료
├── TodoList            # DnD 가능 리스트
│   └── TodoItem        # 단일 Todo 행
│       ├── Checkbox     # 완료 토글
│       ├── Title + Priority badge
│       ├── AssigneeAvatar
│       └── DueDate
├── TodoForm (Sheet)    # 하단 슬라이드업 폼
│   ├── TitleInput
│   ├── DescriptionInput
│   ├── PrioritySelect
│   ├── DueDatePicker
│   ├── ScopeSelect     # 개인/팀/그룹
│   └── AssigneeSelect  # 선택한 팀/그룹 멤버 목록
└── FloatingAddButton   # + 버튼
```

**주요 인터랙션:**
- 체크박스 클릭: `todo` -> `done` 즉시 토글
- 아이템 클릭: TodoForm을 편집 모드로 오픈
- 길게 누르기/우클릭: 삭제 확인 다이얼로그
- 필터 `scope` 변경 시: 해당 팀/그룹 Todo만 표시
- 팀/그룹 Todo 수정 시: Supabase realtime으로 다른 멤버에게 즉시 반영

### 5.2 F2: Memo Tab

```
MemoTab
├── MemoSearch          # 검색바 (제목/내용)
├── SplitView
│   ├── MemoTree (Left, 40%)     # 트리 사이드바
│   │   └── MemoTreeItem         # 재귀 컴포넌트
│   │       ├── FolderIcon + Name
│   │       ├── ExpandToggle
│   │       ├── ContextMenu      # 이름변경/삭제/새 하위폴더
│   │       └── Children[]       # 재귀 렌더링
│   └── MemoEditor (Right, 60%)  # 에디터 영역
│       ├── TitleInput
│       └── MarkdownEditor       # textarea + 미리보기 토글
├── TreeActions
│   ├── [+ 폴더] 버튼
│   └── [+ 메모] 버튼 (선택된 폴더 하위)
```

**트리 구조 동작:**
- 폴더는 무한 depth (권장 3단계)
- 드래그 앤 드롭: 메모를 다른 폴더로 이동
- 폴더 접기/펼치기 상태 SQLite에 영속 (`is_expanded`)
- 검색 결과: 트리에서 해당 메모 하이라이트 + 자동 펼침

### 5.3 F3: Jira Tab

```
JiraTab
├── [미설정 시] JiraSetup         # 초기 설정 화면
│   ├── BaseUrlInput              # https://your-domain.atlassian.net
│   ├── EmailInput
│   ├── ApiTokenInput (password)
│   └── TestConnectionButton
│
├── [설정 완료 시]
│   ├── QuickCreateButton         # "새 티켓 만들기" 큰 버튼
│   └── JiraHistory               # 최근 생성 티켓 (최대 10개)
│       └── HistoryItem
│           ├── TicketKey (link)   # PROJ-123 클릭 시 브라우저 오픈
│           ├── Summary
│           └── CreatedAt

── JiraTicketForm (Dialog)         # 모달 팝업
    ├── ProjectSelect              # 캐시된 프로젝트 목록
    ├── IssueTypeSelect            # 선택된 프로젝트의 이슈 타입
    ├── SummaryInput (필수)
    ├── DescriptionTextarea (필수)
    ├── AssigneeSelect (선택)
    ├── PrioritySelect (선택)
    ├── LabelInput (선택)
    └── SubmitButton               # "생성" -> 성공 시 알림 + 링크
```

**Jira API 플로우:**
```
[설정 저장] -> settings DB에 암호화 저장
[프로젝트 목록] -> GET /rest/api/3/project (캐시 1시간)
[이슈 타입] -> GET /rest/api/3/project/{key}/statuses (캐시 1시간)
[티켓 생성] -> POST /rest/api/3/issue
[생성 완료] -> jira_history에 저장 + Notification 표시
```

### 5.4 F4: Calendar Tab

```
CalendarTab
├── MonthView                     # 월간 캘린더 그리드
│   ├── MonthNavigation           # < 2026년 2월 >
│   └── DayGrid (7x6)
│       └── DayCell
│           ├── DayNumber
│           └── EventDots         # 이벤트 있으면 dot 표시
├── SelectedDayEvents             # 선택한 날짜의 이벤트 목록
│   └── EventItem
│       ├── Time + Title
│       ├── RepeatBadge
│       └── EditButton
├── TodayAlerts (상단 배너)        # 오늘 알림 카운트
│   └── "오늘 N개 알림" 클릭 시 목록 표시
└── EventForm (Dialog)
    ├── TitleInput
    ├── MemoTextarea
    ├── DatePicker
    ├── TimePicker
    ├── RepeatSelect              # 없음/매일/매주/매월
    ├── AlertBeforeSelect         # 정시/5분전/15분전/30분전
    └── SaveButton
```

**알림 스케줄러 (Main Process):**
```
SchedulerService
├── 1분마다 체크: 현재 시간과 이벤트 시간 비교
├── 매칭 시: Electron Notification API로 macOS 알림
├── 반복 이벤트: repeat_type에 따라 다음 알림 시간 계산
├── 스누즈: snooze_until 시간으로 재스케줄
└── 앱 시작 시: 놓친 알림 체크 + 표시
```

### 5.5 F5: Team Tab

```
TeamTab
├── TeamList                      # 팀/그룹 목록
│   ├── Section: "기본 팀"
│   │   └── TeamCard
│   │       ├── TeamName + MemberCount
│   │       └── AvatarGroup (최대 5명 표시)
│   ├── Section: "스팟 그룹" (활성)
│   │   └── TeamCard[]
│   │       ├── GroupName + Description
│   │       ├── MemberCount
│   │       └── ArchiveButton
│   └── Section: "아카이브" (접기 가능)
│       └── ArchivedGroupItem[]
│
├── MemberList (선택된 팀 상세)    # 팀 클릭 시 표시
│   ├── BackButton
│   ├── TeamHeader (이름 + 타입 배지)
│   └── MemberItem[]
│       ├── Avatar + DisplayName
│       ├── RoleBadge (admin/member)
│       └── RemoveButton (admin만)
│
├── InviteDialog (Dialog)
│   ├── EmailInput
│   ├── RoleSelect (admin/member)
│   └── SendInviteButton
│
└── SpotGroupForm (Dialog)
    ├── GroupNameInput
    ├── DescriptionInput
    ├── MemberSelect (체크박스 목록)
    │   ├── "기본 팀 구성원" 섹션
    │   └── "외부 초대 (이메일)" 섹션
    └── CreateButton
```

**팀 관리 플로우:**
```
[최초 설정]
1. Supabase 로그인 (이메일+패스워드 또는 Magic Link)
2. 기본 팀 자동 생성 (type='default')
3. 본인이 admin으로 등록

[구성원 초대]
1. 이메일 입력 -> invitations 테이블에 삽입
2. 상대방 앱 실행 시 -> 초대 알림 표시
3. 수락 시 -> team_members에 추가

[스팟 그룹 생성]
1. 그룹 정보 입력 (이름, 설명)
2. 기본 팀 멤버 중 선택 + 외부 이메일 초대
3. teams 테이블에 type='spot'으로 생성
4. 선택된 멤버 team_members에 추가

[그룹 아카이브]
1. admin이 아카이브 버튼 클릭
2. teams.is_archived = true, archived_at = now()
3. 그룹 Todo는 읽기 전용으로 유지
4. 아카이브 목록으로 이동
```

---

## 6. Sync Strategy

### 6.1 Local-First Architecture

```
┌──────────────┐         ┌──────────────┐
│   SQLite     │  sync   │   Supabase   │
│  (Local)     │ <-----> │  (Remote)    │
│              │         │              │
│ todos        │ ------> │ shared_todos │
│ (team_id     │ <------ │              │
│  != null)    │         │              │
└──────────────┘         └──────────────┘

Sync Rules:
- 개인 Todo (team_id = null): 로컬 only, 동기화 안함
- 팀/그룹 Todo (team_id != null): 양방향 동기화
- 오프라인 시: 로컬에 먼저 저장, 온라인 복귀 시 push
- 충돌 해결: updated_at 기준 Last Write Wins
```

### 6.2 Realtime Subscription

```typescript
// supabase.service.ts
supabase
  .channel('team-todos')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'shared_todos',
    filter: `team_id=in.(${myTeamIds.join(',')})`,
  }, (payload) => {
    // IPC로 Renderer에 전달
    mainWindow.webContents.send('todo:updated', payload);
  })
  .subscribe();
```

---

## 7. Jira Integration Design

### 7.1 API Client

```typescript
// jira.service.ts
class JiraService {
  private baseUrl: string;
  private auth: string;  // Base64(email:apiToken)

  async getProjects(): Promise<JiraProject[]> {
    // GET {baseUrl}/rest/api/3/project
    // 캐시: 1시간 (settings에 저장)
  }

  async getIssueTypes(projectKey: string): Promise<IssueType[]> {
    // GET {baseUrl}/rest/api/3/project/{projectKey}
    // 캐시: 1시간
  }

  async createIssue(data: CreateTicketDto): Promise<JiraIssue> {
    // POST {baseUrl}/rest/api/3/issue
    // Body: { fields: { project, issuetype, summary, description, ... } }
  }

  async testConnection(): Promise<boolean> {
    // GET {baseUrl}/rest/api/3/myself
  }
}
```

### 7.2 인증 정보 저장

```
- settings 테이블에 저장
- jira_api_token은 safeStorage.encryptString() 으로 암호화
- 복호화: safeStorage.decryptString()
- Electron의 safeStorage는 macOS Keychain 활용
```

---

## 8. UI/UX Specifications

### 8.1 Theme

```
Light Mode (Default):
- Background: #FFFFFF
- Surface: #F8FAFC
- Text: #0F172A
- Primary: #3B82F6 (Blue)
- Accent: #8B5CF6 (Purple)

Dark Mode:
- Background: #0F172A
- Surface: #1E293B
- Text: #F1F5F9
- Primary: #60A5FA
- Accent: #A78BFA

System: OS 설정 따름 (nativeTheme.shouldUseDarkColors)
```

### 8.2 Typography

```
Font: SF Pro (system-ui, -apple-system)
- Header: 14px / semibold
- Body: 13px / regular
- Caption: 11px / medium
- Mono: SF Mono (코드/티켓 키)
```

### 8.3 Popup Dimensions

```
Width:  420px (고정)
Height: 520px (고정)
Border Radius: 12px
Shadow: 0 20px 60px rgba(0,0,0,0.3)
Position: 메뉴바 아이콘 아래 중앙 정렬
Arrow: 상단 중앙 8px 삼각형
```

### 8.4 Animation

```
Tab 전환: 150ms ease-out (fade + slide)
Form 오픈: 200ms ease-out (slide-up)
Dialog: 150ms ease-out (scale 0.95 -> 1.0 + fade)
DnD: react-beautiful-dnd placeholder animation
Notification: macOS 기본 애니메이션
```

---

## 9. Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+Shift+M` | 글로벌: 메뉴바 팝업 토글 (커스터마이징 가능) |
| `Cmd+1~5` | 탭 전환 (Todo/Memo/Jira/Calendar/Team) |
| `Cmd+N` | 현재 탭에서 새 항목 생성 |
| `Cmd+F` | 검색 (Memo 탭) |
| `Escape` | 팝업 닫기 / 다이얼로그 닫기 |
| `Cmd+Enter` | 폼 제출 (저장/생성) |

---

## 10. Dependencies

```json
{
  "dependencies": {
    "menubar": "^9.4.0",
    "@electron/remote": "^2.1.0",
    "better-sqlite3": "^11.0.0",
    "@supabase/supabase-js": "^2.45.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "zustand": "^4.5.0",
    "@dnd-kit/core": "^6.1.0",
    "@dnd-kit/sortable": "^8.0.0",
    "date-fns": "^3.6.0",
    "tailwindcss": "^3.4.0",
    "clsx": "^2.1.0",
    "node-cron": "^3.0.0"
  },
  "devDependencies": {
    "electron": "^33.0.0",
    "electron-builder": "^25.0.0",
    "vite": "^5.4.0",
    "vite-plugin-electron": "^0.28.0",
    "typescript": "^5.5.0",
    "@types/better-sqlite3": "^7.6.0",
    "@types/react": "^18.3.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0"
  }
}
```

---

## 11. Implementation Order

```
Phase 1: Foundation                          [Week 1]
──────────────────────────────────────────────────────
1.1  pnpm init + Electron + Vite 셋업
1.2  menubar 패키지 통합 + Tray 아이콘
1.3  React + TypeScript + Tailwind 설정
1.4  shadcn/ui 초기화 (Button, Input, Dialog, Select, Tabs)
1.5  preload.ts + contextBridge 기본 구조
1.6  SQLite 초기화 + 마이그레이션 시스템
1.7  TabNav 컴포넌트 (5개 탭 뼈대)
1.8  IPC 핸들러 등록 기본 구조

Phase 2: Core Local Features                 [Week 2-3]
──────────────────────────────────────────────────────
2.1  F2: memo_folders + memos DB 레포지토리
2.2  F2: MemoTree 재귀 컴포넌트 + 폴더 CRUD
2.3  F2: MemoEditor (Markdown textarea)
2.4  F2: 검색 + DnD 이동
2.5  F1: todos DB 레포지토리 (개인 모드)
2.6  F1: TodoList + TodoItem + TodoForm
2.7  F1: 필터링 + DnD 순서변경
2.8  F4: calendar_events DB 레포지토리
2.9  F4: MonthView + EventForm
2.10 F4: SchedulerService + Notification

Phase 3: Jira Integration                    [Week 3-4]
──────────────────────────────────────────────────────
3.1  JiraService (REST API client)
3.2  JiraSetup (설정 + 연결 테스트)
3.3  JiraTicketForm (모달 팝업)
3.4  JiraHistory (최근 생성 목록)
3.5  safeStorage 암호화 + 캐싱

Phase 4: Team & Group Management             [Week 4-5]
──────────────────────────────────────────────────────
4.1  Supabase 프로젝트 설정 + 스키마 배포
4.2  인증 (이메일 로그인 / Magic Link)
4.3  F5: TeamTab + TeamList 기본 UI
4.4  F5: 기본 팀 생성 + MemberList
4.5  F5: InviteDialog + 초대 플로우
4.6  F5: SpotGroupForm + 스팟 그룹 CRUD
4.7  F5: 그룹 아카이브/해체
4.8  F1: Todo 공유 범위 선택 (ScopeSelector)
4.9  SyncService (Local <-> Remote)
4.10 Realtime subscription 연동

Phase 5: Polish & Deploy                     [Week 5-6]
──────────────────────────────────────────────────────
5.1  다크모드/라이트모드 + 시스템 따름
5.2  글로벌 단축키 (Cmd+Shift+M)
5.3  앱 내 단축키 (Cmd+1~5, Cmd+N 등)
5.4  Settings 화면 통합
5.5  electron-builder 설정 + DMG 패키징
5.6  자동 업데이트 (electron-updater)
5.7  성능 최적화 + 메모리 프로파일링
```

---

## 12. Error Handling

| Scenario | Handling |
|----------|----------|
| SQLite 쿼리 실패 | IPC에서 에러 객체 반환 -> Renderer에서 toast 알림 |
| Jira API 실패 (401) | "인증 실패. 설정을 확인하세요" -> Settings로 이동 |
| Jira API 실패 (429) | "요청 제한 초과. 잠시 후 다시 시도하세요" |
| Supabase 연결 실패 | 오프라인 모드 전환 + 상단 배너 표시 |
| 동기화 충돌 | Last Write Wins + 충돌 로그 |
| 팝업 외부 클릭 | 팝업 자동 숨김 (menubar 기본 동작) |
| 잘못된 초대 | 만료/거절 상태 표시 |
