# Plan: MenuBar Utility App

> **Feature**: menubar-utility-app
> **Level**: Dynamic (Electron + Backend)
> **Created**: 2026-02-20
> **Status**: Draft

---

## 1. Overview

macOS 메뉴바에 상주하는 올인원 업무 유틸리티 앱.
팀원과 공유 가능한 Todo 관리, 트리형 메모, 간편 Jira 티켓 생성, 캘린더 알림 기능을 하나의 메뉴바 앱으로 통합.

### 1.1 Problem Statement

- 업무 중 Todo, 메모, Jira 티켓 생성을 위해 여러 앱/브라우저를 전환해야 하는 번거로움
- 간단한 작업인데도 무거운 앱을 열어야 하는 비효율
- 팀원 간 Todo 공유가 메신저를 통해 비체계적으로 이루어짐
- 중요한 일정 알림을 놓치는 경우 발생

### 1.2 Target Users

- 개발팀 구성원 (macOS 사용자)
- Jira를 사용하는 프로젝트 팀
- 빠른 메모와 Todo 관리가 필요한 개인/팀

---

## 2. Core Features

### F1: Todo Management (팀 공유)

| 항목 | 내용 |
|------|------|
| **설명** | Todo 생성/수정/삭제/완료, 팀원 지정 및 공유 |
| **우선순위** | P0 (핵심) |
| **복잡도** | High |

**상세 요구사항:**
- Todo CRUD (제목, 설명, 마감일, 우선순위)
- 공유 범위 선택: `개인` / `기본 팀` / `특정 스팟 그룹`
- 선택한 팀/그룹 내 구성원에게 할당
- 팀/그룹 간 실시간 동기화
- 상태 관리: `할 일` → `진행 중` → `완료`
- 필터링: 나의 할 일 / 기본 팀 / 그룹별 / 완료됨
- 드래그 앤 드롭으로 순서 변경

### F2: Tree Memo (종류별 트리형 메모)

| 항목 | 내용 |
|------|------|
| **설명** | 폴더/카테고리 기반 트리 구조 메모 관리 |
| **우선순위** | P0 (핵심) |
| **복잡도** | Medium |

**상세 요구사항:**
- 트리 구조 폴더/카테고리 생성
- 폴더 하위에 메모 생성/수정/삭제
- 드래그 앤 드롭으로 메모 이동/정리
- Markdown 지원 (간단한 편집기)
- 검색 기능 (제목/내용)
- 폴더 접기/펼치기
- 로컬 저장 (개인 메모)

### F3: Quick Jira Ticket (간편 티켓 생성)

| 항목 | 내용 |
|------|------|
| **설명** | 클릭 한 번으로 작은 팝업을 열고 Jira 티켓 간편 생성 |
| **우선순위** | P1 (중요) |
| **복잡도** | Medium |

**상세 요구사항:**
- 메뉴바에서 "티켓 생성" 클릭 시 작은 팝업 오픈
- 필수 입력 항목: 프로젝트, 이슈 타입, 제목, 설명
- 선택 입력 항목: 담당자, 우선순위, 레이블
- Jira REST API 연동 (API 토큰 인증)
- 프로젝트/이슈 타입 목록 캐싱
- 생성 완료 시 알림 + Jira 링크 제공
- 최근 생성한 티켓 히스토리 (최대 10개)

### F4: Calendar Alert (캘린더 알림)

| 항목 | 내용 |
|------|------|
| **설명** | 날짜/시간 지정 알림, 팝업 노티피케이션 |
| **우선순위** | P1 (중요) |
| **복잡도** | Medium |

**상세 요구사항:**
- 간단한 캘린더 UI (월간 뷰)
- 알림 이벤트 생성 (날짜, 시간, 제목, 메모)
- 지정 시간에 macOS 네이티브 알림 팝업
- 반복 알림 옵션 (매일/매주/매월)
- 오늘의 알림 목록 표시
- 알림 스누즈 기능 (5분/15분/30분/1시간)

### F5: Team & Group Management (구성원/그룹 관리)

| 항목 | 내용 |
|------|------|
| **설명** | 기본 팀 구성원 관리 + 스팟 그룹 생성으로 타팀 코웍 지원 |
| **우선순위** | P0 (핵심) |
| **복잡도** | High |

**상세 요구사항:**

**기본 팀 (Default Team):**
- 앱 최초 설정 시 기본 팀 생성
- 구성원 초대 (이메일/링크)
- 구성원 역할: `관리자(admin)` / `멤버(member)`
- 구성원 목록 조회, 추가/제거
- 기본 팀은 삭제 불가, Todo 공유의 기본 대상

**스팟 그룹 (Spot Group):**
- 프로젝트/TF 단위로 임시 그룹 생성
- 기본 팀 구성원 + 외부 인원(타팀) 혼합 가능
- 그룹명, 설명, 목적 설정
- 그룹별 Todo 공유 범위 분리
- 그룹 아카이브/해체 기능 (코웍 종료 시)
- 그룹 목록에서 활성/아카이브 필터

**Todo 연동:**
- Todo 생성 시 공유 대상 선택: `개인` / `기본 팀` / `특정 그룹`
- 그룹 내 구성원에게만 할당 가능
- 그룹별 Todo 필터링 뷰

```
┌─ 워크스페이스
│
├─ 기본 팀 (Default) ─── 고정 구성원 (우리 팀)
│   └─ Todo 기본 공유 대상
│
├─ 스팟 그룹: "프로젝트 X" ─── 우리 팀 일부 + 타팀 A
│   └─ 해당 프로젝트 관련 Todo만
│
└─ 스팟 그룹: "긴급 TF" ─── 여러 팀 차출 인원
    └─ TF 관련 Todo만
```

---

## 3. Tech Stack

| 영역 | 기술 | 선택 이유 |
|------|------|-----------|
| **Framework** | Electron | 메뉴바 앱 생태계 풍부 (`menubar` 패키지) |
| **Frontend** | React + TypeScript | 컴포넌트 기반 UI, 타입 안정성 |
| **상태관리** | Zustand | 경량, 간단한 API |
| **UI Library** | Tailwind CSS + shadcn/ui | 빠른 UI 개발, 다크모드 지원 |
| **로컬 DB** | SQLite (better-sqlite3) | 오프라인 지원, 로컬 데이터 영속성 |
| **팀 동기화** | Supabase (Realtime) | 실시간 동기화, 인증, PostgreSQL |
| **Jira 연동** | Jira REST API v3 | 공식 API, 토큰 인증 |
| **알림** | Electron Notification API | macOS 네이티브 알림 |
| **빌드** | electron-builder | DMG/ZIP 패키징 |
| **패키지 매니저** | pnpm | 빠른 설치, 디스크 효율적 |

---

## 4. Architecture

```
┌─────────────────────────────────────────────┐
│              macOS Menu Bar                  │
│  ┌─────────────────────────────────────┐    │
│  │         Electron (Main Process)      │    │
│  │  ┌──────────┐  ┌────────────────┐   │    │
│  │  │ Tray Icon │  │ BrowserWindow  │   │    │
│  │  │ (menubar) │  │ (Popup Panel)  │   │    │
│  │  └──────────┘  └────────────────┘   │    │
│  │         │              │             │    │
│  │  ┌──────┴──────────────┴──────┐     │    │
│  │  │      IPC Bridge            │     │    │
│  │  └──────┬──────────────┬──────┘     │    │
│  └─────────┼──────────────┼────────────┘    │
│            │              │                  │
│  ┌─────────▼──────┐  ┌───▼──────────────┐  │
│  │ Renderer Process│  │  Main Services   │  │
│  │ (React App)     │  │  ┌────────────┐  │  │
│  │  ┌───────────┐  │  │  │ SQLite DB  │  │  │
│  │  │ Tab: Todo  │  │  │  │ (Local)    │  │  │
│  │  │ Tab: Memo  │  │  │  └────────────┘  │  │
│  │  │ Tab: Jira  │  │  │  ┌────────────┐  │  │
│  │  │ Tab: Cal   │  │  │  │ Scheduler  │  │  │
│  │  └───────────┘  │  │  │ (Alerts)   │  │  │
│  └─────────────────┘  │  └────────────┘  │  │
│                        └─────────────────┘  │
└─────────────────────────────────────────────┘
           │                    │
           ▼                    ▼
   ┌───────────────┐   ┌───────────────┐
   │   Supabase    │   │   Jira API    │
   │ (Team Sync)   │   │  (Tickets)    │
   └───────────────┘   └───────────────┘
```

---

## 5. Screen Layout

```
┌──────────────────────────────────────┐
│ Todo  Memo  Jira  Calendar  Team     │ <- Tab Navigation
├──────────────────────────────────────┤
│                                      │
│   [각 탭별 콘텐츠 영역]               │
│   약 420px x 520px                   │
│                                      │
├──────────────────────────────────────┤
│ Settings                    Profile  │ <- Footer
└──────────────────────────────────────┘
```

**팝업 크기**: 420px (W) x 520px (H) - 메뉴바 드롭다운 형태

**Team 탭 레이아웃:**
```
┌──────────────────────────────────────┐
│ [기본 팀]  [스팟 그룹 +]              │
├──────────────────────────────────────┤
│ -- 우리팀 (기본) ---------- 5명 ---- │
│   홍길동 (admin)                     │
│   김철수 (member)                    │
│   ...                                │
│                                      │
│ -- 프로젝트X 코웍 (스팟) -- 3명 ---- │
│   홍길동, 외부: 이영희, 박수진        │
│                                      │
│ -- 아카이브됨 (1) --                 │
│   [지난 TF] (접힘)                   │
├──────────────────────────────────────┤
│ [+ 구성원 초대]  [+ 그룹 만들기]      │
└──────────────────────────────────────┘
```

---

## 6. Implementation Phases

### Phase 1: Foundation (기반 구축)
- [ ] Electron + menubar 셋업
- [ ] React + TypeScript + Tailwind 통합
- [ ] 프로젝트 구조 설정
- [ ] SQLite 로컬 DB 초기화
- [ ] 탭 네비게이션 UI

### Phase 2: Core Features - Local (로컬 기능)
- [ ] F2: 트리형 메모 (로컬 저장)
- [ ] F1: Todo 관리 (로컬, 개인용)
- [ ] F4: 캘린더 알림 (로컬)

### Phase 3: External Integration (외부 연동)
- [ ] F3: Jira API 연동 + 티켓 생성 팝업
- [ ] Jira 설정 화면 (API 토큰, 프로젝트 설정)

### Phase 4: Team & Group Management (구성원/그룹)
- [ ] Supabase 연동 (인증 + DB)
- [ ] F5: 기본 팀 생성 + 구성원 초대/관리
- [ ] F5: 스팟 그룹 생성/아카이브/해체
- [ ] F1: Todo 공유 대상 선택 (개인/팀/그룹)
- [ ] 실시간 동기화

### Phase 5: Polish & Deploy (마무리)
- [ ] 다크모드 / 라이트모드
- [ ] 키보드 단축키 (글로벌 핫키)
- [ ] electron-builder 패키징 (DMG)
- [ ] 자동 업데이트 설정

---

## 7. Data Model (Overview)

### Local (SQLite)

```
todos        : id, title, description, status, priority, dueDate, assignee, teamId, createdAt, updatedAt
memo_folders : id, parentId, name, order, createdAt
memos        : id, folderId, title, content, createdAt, updatedAt
calendar_events : id, title, memo, date, time, repeat, alertBefore, createdAt
jira_history : id, ticketKey, summary, project, createdAt
settings     : key, value
```

### Remote (Supabase - 팀 동기화용)

```
users        : id, email, displayName, avatarUrl, createdAt

# 기본 팀
teams        : id, name, type('default'|'spot'), description, createdBy, isArchived, createdAt, archivedAt
team_members : id, teamId, userId, role('admin'|'member'), joinedAt

# Todo 공유
shared_todos : id, teamId, title, description, status, priority, dueDate, assigneeId, createdBy, createdAt, updatedAt

# 초대
invitations  : id, teamId, invitedEmail, invitedBy, status('pending'|'accepted'|'declined'), createdAt, expiresAt
```

---

## 8. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Electron 메모리 사용량 | Medium | 불필요한 프로세스 최소화, 윈도우 lazy loading |
| Jira API Rate Limit | Low | 캐싱 + 요청 debounce |
| 오프라인 시 팀 동기화 | Medium | 로컬 우선 저장 + 온라인 복귀 시 sync |
| SQLite 동시 접근 | Low | WAL 모드 활성화 |
| Supabase 무료 tier 제한 | Low | 로컬 기능 우선, 필수 데이터만 동기화 |

---

## 9. Success Criteria

- [ ] 메뉴바 아이콘 클릭으로 400x500 팝업 즉시 오픈 (< 200ms)
- [ ] Todo 생성/완료 3초 이내 완료
- [ ] 메모 트리 3단계 이상 depth 지원
- [ ] Jira 티켓 생성 5초 이내 완료
- [ ] 캘린더 알림 정확도 100% (지정 시간 ±1분)
- [ ] 팀원 2명 이상 실시간 Todo 동기화
- [ ] DMG로 패키징 및 설치 가능

---

## 10. Out of Scope (v1.0)

- Windows/Linux 지원 (추후 확장)
- Jira 외 이슈 트래커 연동 (GitHub Issues 등)
- 메모 팀 공유 (v2에서 고려)
- 캘린더 외부 연동 (Google Calendar 등)
- 파일 첨부 기능
- 모바일 앱
