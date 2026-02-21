# MenuBar Utility 보안 감사 보고서

**작성일**: 2026-02-21
**대상 앱**: menubar-utility (Electron + React + Supabase + SQLite)
**검토 범위**: 전체 소스코드 (main process, preload, renderer, IPC, DB, 서비스 레이어)
**검토자**: Security Architect Agent
**종합 보안 점수**: **35 / 100**

---

## 1. 요약

| 항목 | 값 |
|------|-----|
| **총 보안 이슈** | 18건 |
| **심각 (Critical)** | 3건 |
| **높음 (High)** | 5건 |
| **중간 (Medium)** | 6건 |
| **낮음 (Low)** | 4건 |
| **종합 보안 점수** | **35 / 100** |

본 앱은 Electron 데스크탑 앱으로, 외부 Supabase PostgreSQL과 Jira API를 연동하는 생산성 도구이다. 가장 심각한 보안 위험은 **예측 가능한 비밀번호 패턴으로 인한 Supabase 인증 우회**, **Jira API 토큰 평문 저장**, **설정 API를 통한 민감 정보 무제한 노출**이다. 아래에 각 이슈의 상세 분석과 개선 방안을 기술한다.

---

## 2. OWASP Top 10 매핑 요약

| OWASP 코드 | 항목 | 해당 이슈 수 | 최고 심각도 |
|-------------|------|-------------|------------|
| A01 | 취약한 접근 제어 | 3건 | 심각 |
| A02 | 암호화 실패 | 3건 | 심각 |
| A03 | 인젝션 | 2건 | 높음 |
| A04 | 불안전한 설계 | 1건 | 중간 |
| A05 | 보안 설정 오류 | 4건 | 높음 |
| A06 | 취약하고 오래된 컴포넌트 | 1건 | 낮음 |
| A07 | 식별 및 인증 실패 | 2건 | 심각 |
| A08 | 소프트웨어 및 데이터 무결성 실패 | 1건 | 중간 |
| A09 | 보안 로깅 및 모니터링 실패 | 2건 | 중간 |
| A10 | SSRF | 해당 없음 | - |

---

## 3. 심각 (Critical) 이슈

### SEC-001: 예측 가능한 결정적 비밀번호 패턴 (Supabase 인증)

| 항목 | 내용 |
|------|------|
| **심각도** | 심각 (Critical) |
| **OWASP** | A07 - 식별 및 인증 실패 |
| **파일** | `src/main/services/supabase.service.ts:90` |
| **영향** | 모든 사용자 계정 탈취 가능 |

**발견 내용**:

```typescript
// src/main/services/supabase.service.ts:90
const password = `menubar_${jiraEmail}_auto`;
```

Supabase 자동 인증에 사용되는 비밀번호가 `menubar_{이메일}_auto` 패턴으로 완전히 예측 가능하다. 공격자가 대상의 Jira 이메일 주소만 알면 Supabase에 직접 로그인하여 해당 사용자의 모든 데이터(Todo, 메모, 팀 정보)에 접근할 수 있다.

**공격 시나리오**:
1. 공격자가 `.env` 파일에서 `VITE_SUPABASE_URL`과 `VITE_SUPABASE_ANON_KEY`를 추출한다 (빌드된 앱에 포함됨).
2. 대상의 이메일 주소(예: `victim@company.com`)를 알아낸다.
3. Supabase 클라이언트로 `menubar_victim@company.com_auto` 비밀번호로 로그인한다.
4. 해당 사용자의 모든 팀 데이터, 개인 Todo, 메모에 접근한다.

**개선 방안**:

```typescript
// 방안 1 (최소 대안): 장치별 고유 비밀번호 생성
import crypto from 'crypto';

const deviceSecret = settingsRepo.getSetting('device_secret')
  || (() => {
    const secret = crypto.randomBytes(32).toString('hex');
    // safeStorage로 암호화하여 저장
    const encrypted = safeStorage.encryptString(secret).toString('base64');
    settingsRepo.setSetting('device_secret', encrypted);
    return secret;
  })();

const password = crypto
  .createHmac('sha256', deviceSecret)
  .update(jiraEmail)
  .digest('hex');

// 방안 2 (권장): Supabase Edge Function에서 Jira 토큰 검증 후 커스텀 JWT 발급
// 방안 3: Supabase의 Atlassian OAuth 연동 사용
```

---

### SEC-002: Jira API 토큰 평문 저장

| 항목 | 내용 |
|------|------|
| **심각도** | 심각 (Critical) |
| **OWASP** | A02 - 암호화 실패 |
| **파일** | `src/renderer/features/jira/JiraTab.tsx:247`, `src/main/ipc/settings.ipc.ts:9-10`, `src/main/services/jira.service.ts:36-41` |
| **영향** | Jira 계정 및 프로젝트 데이터 탈취 |

**발견 내용**:

Renderer(UI)에서 토큰을 설정 저장소에 직접 전달한다:

```typescript
// src/renderer/features/jira/JiraTab.tsx:247
await window.electronAPI.settings.set('jira_api_token', token);
```

`settings.ipc.ts`의 `settings:set` 핸들러는 별도 암호화 없이 SQLite에 평문으로 저장한다:

```typescript
// src/main/ipc/settings.ipc.ts:9-10
ipcMain.handle('settings:set', (_event, key: string, value: string) => {
    settingsRepo.setSetting(key, value);
});
```

`jira.service.ts`에서 `safeStorage.decryptString()`을 호출하지만, 저장 시점에 `safeStorage.encryptString()`을 호출하는 코드가 **어디에도 없다**. 즉 복호화만 시도하고 실패하면 평문 그대로 사용하는 fallback 로직만 존재한다:

```typescript
// src/main/services/jira.service.ts:36-41
try {
    apiToken = safeStorage.isEncryptionAvailable()
        ? safeStorage.decryptString(Buffer.from(encryptedToken, 'base64'))
        : encryptedToken;
} catch {
    apiToken = encryptedToken; // 항상 이 분기로 진입 - 평문 사용
}
```

결과적으로 Jira API 토큰은 `~/Library/Application Support/menubar-utility/menubar-utility.db` SQLite 파일의 `settings` 테이블에 **항상 평문**으로 저장된다.

**개선 방안**:

`settings:set` IPC 핸들러에서 민감 키(`jira_api_token`)에 대해 `safeStorage.encryptString()`으로 암호화 후 저장해야 한다:

```typescript
// src/main/ipc/settings.ipc.ts 수정
import { safeStorage } from 'electron';

const SENSITIVE_KEYS = ['jira_api_token', 'supabase_anon_key'];

ipcMain.handle('settings:set', (_event, key: string, value: string) => {
    if (SENSITIVE_KEYS.includes(key) && safeStorage.isEncryptionAvailable()) {
        const encrypted = safeStorage.encryptString(value).toString('base64');
        settingsRepo.setSetting(key, encrypted);
    } else {
        settingsRepo.setSetting(key, value);
    }
});
```

---

### SEC-003: 설정 API를 통한 민감 정보 무제한 노출

| 항목 | 내용 |
|------|------|
| **심각도** | 심각 (Critical) |
| **OWASP** | A01 - 취약한 접근 제어 |
| **파일** | `src/main/ipc/settings.ipc.ts:5-16`, `src/main/preload.ts:73-76` |
| **영향** | XSS 시 모든 자격증명 즉시 탈취 |

**발견 내용**:

설정 IPC 핸들러가 모든 설정에 대해 제한 없는 읽기/쓰기 접근을 제공한다:

```typescript
// src/main/ipc/settings.ipc.ts:5-15
ipcMain.handle('settings:get', (_event, key: string) => {
    return settingsRepo.getSetting(key);  // jira_api_token 포함 모든 키 읽기 가능
});

ipcMain.handle('settings:getAll', () => {
    return settingsRepo.getAllSettings();  // 모든 비밀 정보 일괄 반환
});

ipcMain.handle('settings:set', (_event, key: string, value: string) => {
    settingsRepo.setSetting(key, value);  // 어떤 키든 덮어쓰기 가능
});
```

Renderer 프로세스에서 `jira_api_token`, `supabase_anon_key`, `supabase_url` 등 모든 민감 정보에 직접 접근할 수 있다. 실제로 `useTeamStore.ts:47`에서 `settings.get('jira_api_token')`을 호출하고 있다.

또한 `settings:set`에서 키 제한이 없으므로, Renderer가 compromised되면 `supabase_url`을 공격자 서버로 변경하여 모든 동기화 데이터를 가로챌 수 있다.

**개선 방안**:

```typescript
const PUBLIC_READ_KEYS = new Set([
    'theme', 'global_hotkey', 'cloud_sync_enabled',
    'jira_base_url', 'jira_email',
]);

const WRITABLE_KEYS = new Set([
    'theme', 'global_hotkey', 'cloud_sync_enabled',
    'jira_base_url', 'jira_email', 'jira_api_token',
    'supabase_url', 'supabase_anon_key',
]);

ipcMain.handle('settings:get', (_event, key: string) => {
    if (!PUBLIC_READ_KEYS.has(key)) return null;
    return settingsRepo.getSetting(key);
});

ipcMain.handle('settings:getAll', () => {
    const all = settingsRepo.getAllSettings();
    const filtered: Record<string, string> = {};
    for (const [key, value] of Object.entries(all)) {
        if (PUBLIC_READ_KEYS.has(key)) filtered[key] = value;
    }
    return filtered;
});

ipcMain.handle('settings:set', (_event, key: string, value: string) => {
    if (!WRITABLE_KEYS.has(key)) throw new Error('Setting not allowed');
    // 민감 키는 암호화 저장 (SEC-002 개선과 연계)
    settingsRepo.setSetting(key, value);
});
```

Renderer에서 `jira_api_token` 존재 여부 확인이 필요하다면, 별도의 `auth:isConfigured` 같은 불리언 반환 핸들러를 만든다.

---

## 4. 높음 (High) 이슈

### SEC-004: Supabase Anon Key 하드코딩 및 빌드 번들 포함

| 항목 | 내용 |
|------|------|
| **심각도** | 높음 (High) |
| **OWASP** | A02 - 암호화 실패 |
| **파일** | `.env:1-2`, `src/main/services/supabase.service.ts:9-41`, `vite.config.ts` |
| **영향** | RLS 미설정 시 전체 데이터베이스 노출 |

**발견 내용**:

`.env` 파일에 Supabase URL과 Anon Key가 `VITE_` 접두어로 정의되어 있다:

```
VITE_SUPABASE_URL=https://bowhdymawodkrtvqmdts.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
```

`VITE_` 접두어는 Vite 빌드 시 `import.meta.env`를 통해 **클라이언트(renderer) 번들에도 인라인**된다. Electron 앱은 배포 후 asar 패키지에서 쉽게 추출 가능하므로, 이 키는 사실상 공개된 것과 같다.

Supabase Anon Key는 설계상 공개 키이지만, 이는 RLS(Row Level Security)가 올바르게 설정된 경우에만 안전하다. SEC-001의 예측 가능한 비밀번호와 결합되면 인증된 사용자로서 모든 데이터에 접근 가능하다.

**개선 방안**:

1. **필수**: `VITE_` 접두어를 제거하고 main process에서만 로드하도록 변경
2. **필수**: Supabase Dashboard에서 모든 테이블에 RLS 활성화 및 정책 설정
3. **권장**: 현재 노출된 anon key를 Supabase Dashboard에서 재발급(rotate)
4. **권장**: Supabase Edge Function을 프록시로 활용하여 anon key 직접 노출 방지

---

### SEC-005: Content Security Policy (CSP) 미설정

| 항목 | 내용 |
|------|------|
| **심각도** | 높음 (High) |
| **OWASP** | A05 - 보안 설정 오류 |
| **파일** | `src/main/index.ts` (전체) |
| **영향** | XSS 공격 시 외부 스크립트 로딩/실행 가능 |

**발견 내용**:

앱 전체에서 Content Security Policy 헤더나 meta 태그가 설정되어 있지 않다. CSP가 없으면 XSS 취약점이 발견될 경우, 공격자가 외부에서 악성 스크립트를 로드하여 실행할 수 있다.

**개선 방안**:

```typescript
// src/main/index.ts - app.on('ready') 내부에 추가
import { session } from 'electron';

app.on('ready', () => {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Content-Security-Policy': [
                    "default-src 'self'; " +
                    "script-src 'self'; " +
                    "style-src 'self' 'unsafe-inline'; " +
                    "connect-src 'self' https://*.supabase.co wss://*.supabase.co; " +
                    "img-src 'self' data: https:; " +
                    "font-src 'self';"
                ],
            },
        });
    });
});
```

---

### SEC-006: sandbox 비활성화 (sandbox: false)

| 항목 | 내용 |
|------|------|
| **심각도** | 높음 (High) |
| **OWASP** | A05 - 보안 설정 오류 |
| **파일** | `src/main/index.ts:36` |
| **영향** | Renderer 프로세스의 OS 리소스 접근 범위 확대 |

**발견 내용**:

```typescript
// src/main/index.ts:32-37
webPreferences: {
    preload: path.join(__dirname, '../preload/preload.js'),
    contextIsolation: true,    // 양호
    nodeIntegration: false,     // 양호
    sandbox: false,             // 비활성화됨
},
```

`contextIsolation: true`와 `nodeIntegration: false`는 올바르게 설정되어 있으나, `sandbox: false`로 인해 preload 스크립트가 Node.js API에 완전히 접근할 수 있으며, renderer 프로세스의 격리 수준이 낮아진다.

현재 preload 코드(`preload.ts`)는 `contextBridge`와 `ipcRenderer`만 사용하므로 `sandbox: true` 전환이 가능할 것으로 판단된다.

**개선 방안**:

```typescript
webPreferences: {
    preload: path.join(__dirname, '../preload/preload.js'),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,  // 활성화
},
```

---

### SEC-007: shell:openExternal URL 검증 없음

| 항목 | 내용 |
|------|------|
| **심각도** | 높음 (High) |
| **OWASP** | A01 - 취약한 접근 제어 |
| **파일** | `src/main/ipc/index.ts:21-22` |
| **영향** | 임의 프로토콜 핸들러 실행, 악성 URL 오픈 |

**발견 내용**:

```typescript
// src/main/ipc/index.ts:21-22
ipcMain.handle('shell:openExternal', (_event, url: string) => {
    return shell.openExternal(url);
});
```

`shell.openExternal()`은 OS의 기본 핸들러로 URL을 여는 함수로, `file://`, `smb://`, `ftp://` 등 위험한 프로토콜도 처리할 수 있다. Renderer가 compromised되면 임의 프로그램 실행이 가능하다.

**개선 방안**:

```typescript
ipcMain.handle('shell:openExternal', (_event, url: string) => {
    try {
        const parsed = new URL(url);
        if (!['https:', 'http:'].includes(parsed.protocol)) {
            throw new Error(`차단된 프로토콜: ${parsed.protocol}`);
        }
        return shell.openExternal(url);
    } catch (err) {
        console.error('shell:openExternal 차단:', url);
        throw new Error('허용되지 않는 URL');
    }
});
```

---

### SEC-008: 팀 관리 작업에 권한 검증 없음

| 항목 | 내용 |
|------|------|
| **심각도** | 높음 (High) |
| **OWASP** | A01 - 취약한 접근 제어 |
| **파일** | `src/main/ipc/team.ipc.ts:49-67`, `src/main/services/supabase.service.ts:221-268` |
| **영향** | 일반 멤버가 팀 삭제/아카이브/멤버 관리 가능 |

**발견 내용**:

팀 아카이브, 삭제, 이름 변경, 멤버 추가/제거 시 요청자의 역할(admin/member)을 검증하지 않는다:

```typescript
// src/main/ipc/team.ipc.ts:49-50 - 권한 체크 없음
ipcMain.handle('team:archiveGroup', async (_event, groupId: string): Promise<void> => {
    return supabaseService.archiveGroup(groupId);
});

// src/main/ipc/team.ipc.ts:53-54 - 권한 체크 없음
ipcMain.handle('team:deleteGroup', async (_event, groupId: string): Promise<void> => {
    return supabaseService.deleteGroup(groupId);
});

// src/main/ipc/team.ipc.ts:61-62 - 권한 체크 없음
ipcMain.handle('team:addMember', async (_event, teamId, jiraAccountId, displayName, email) => {
    return supabaseService.addMember(teamId, jiraAccountId, displayName, email);
});
```

**개선 방안**:

1. **필수**: Supabase RLS 정책에서 팀 관련 테이블에 admin 역할 검증 추가
2. **권장**: 앱 레벨에서도 방어적 권한 검증 수행

```typescript
ipcMain.handle('team:deleteGroup', async (_event, groupId: string) => {
    const jira = new JiraService();
    const myself = await jira.getMyself();
    const members = await supabaseService.getMembers(groupId);
    const me = members.find(m => m.jiraAccountId === myself.accountId);
    if (!me || me.role !== 'admin') {
        throw new Error('권한 없음: admin 역할이 필요합니다');
    }
    return supabaseService.deleteGroup(groupId);
});
```

---

## 5. 중간 (Medium) 이슈

### SEC-009: IPC 입력값 검증 부재

| 항목 | 내용 |
|------|------|
| **심각도** | 중간 (Medium) |
| **OWASP** | A03 - 인젝션 / A04 - 불안전한 설계 |
| **파일** | `src/main/ipc/todo.ipc.ts`, `src/main/ipc/team.ipc.ts`, `src/main/ipc/jira.ipc.ts` 등 전체 IPC 핸들러 |
| **영향** | 비정상 데이터 입력으로 인한 예기치 않은 동작 |

**발견 내용**:

모든 IPC 핸들러에서 입력값에 대한 런타임 타입 검증이나 유효성 검사가 없다. TypeScript 타입 정의는 컴파일 타임에만 적용되며, 런타임에는 어떤 데이터든 전달될 수 있다.

```typescript
// src/main/ipc/todo.ipc.ts:10 - data 내용 검증 없음
ipcMain.handle('todo:create', (_event, data: CreateTodoDto) => {
    return todoRepo.createTodo(data);
});
```

**참고**: better-sqlite3의 prepared statement를 사용하고 있으므로 SQL 인젝션 위험은 낮다.

**개선 방안**: Zod 등의 런타임 스키마 검증 라이브러리 도입

```typescript
import { z } from 'zod';

const CreateTodoSchema = z.object({
    title: z.string().min(1).max(500),
    description: z.string().max(5000).optional(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
    dueDate: z.string().nullable().optional(),
    teamId: z.string().nullable().optional(),
});

ipcMain.handle('todo:create', (_event, data: unknown) => {
    const validated = CreateTodoSchema.parse(data);
    return todoRepo.createTodo(validated);
});
```

---

### SEC-010: Supabase RLS 의존성 미검증

| 항목 | 내용 |
|------|------|
| **심각도** | 중간 (Medium) |
| **OWASP** | A04 - 불안전한 설계 |
| **파일** | `src/main/services/supabase.service.ts:89` |
| **영향** | RLS 미설정 시 전체 사용자 데이터 노출 |

**발견 내용**:

코드 주석에서 "Supabase는 RLS로 보호됨"이라고 명시하고 있으나, RLS 정책의 정의나 문서가 코드베이스에 존재하지 않는다:

```typescript
// src/main/services/supabase.service.ts:89
// 결정적 비밀번호: Jira 이메일 기반 (Supabase는 RLS로 보호됨)
```

다음 테이블에 대한 RLS 설정을 확인해야 한다:
- `shared_todos` - 팀 멤버십 기반 접근 제어
- `user_todos` - `user_id = auth.uid()` 스코프
- `user_memos` / `user_memo_folders` - `user_id = auth.uid()` 스코프
- `teams` - admin만 수정/삭제 가능
- `team_members` - admin만 추가/삭제 가능
- `profiles` - 본인 프로필만 수정 가능

**개선 방안**: Supabase Dashboard에서 모든 테이블의 RLS 활성화 상태를 감사하고, 정책을 코드로 관리한다 (Supabase Migration 파일).

---

### SEC-011: 세션 만료 및 토큰 갱신 처리 없음

| 항목 | 내용 |
|------|------|
| **심각도** | 중간 (Medium) |
| **OWASP** | A07 - 식별 및 인증 실패 |
| **파일** | `src/main/services/supabase.service.ts:130-140` |
| **영향** | 세션 무기한 지속, 탈취된 세션 재사용 가능 |

**발견 내용**:

Supabase 세션에 대한 토큰 만료 확인, 자동 갱신, `onAuthStateChange` 이벤트 구독이 없다:

```typescript
// src/main/services/supabase.service.ts:130-140
async getSession(): Promise<AuthUser | null> {
    const { data } = await client.auth.getSession();
    if (!data.session?.user) return null;
    return this.mapUser(data.session.user);  // 만료 확인 없음
}
```

**개선 방안**:

```typescript
// Supabase 클라이언트 초기화 후 auth state 구독
client.auth.onAuthStateChange((event, session) => {
    if (event === 'TOKEN_REFRESHED') { /* 로컬 상태 업데이트 */ }
    if (event === 'SIGNED_OUT') { /* 로컬 상태 초기화 */ }
});
```

---

### SEC-012: 이메일 확인 비활성화 유도

| 항목 | 내용 |
|------|------|
| **심각도** | 중간 (Medium) |
| **OWASP** | A07 - 식별 및 인증 실패 |
| **파일** | `src/main/services/supabase.service.ts:115` |
| **영향** | 이메일 소유권 미검증 상태에서 계정 생성 |

**발견 내용**:

```typescript
// src/main/services/supabase.service.ts:114-116
if (!signUpData.session) {
    throw new Error('Email confirmation is enabled in Supabase. Please disable it...');
}
```

앱이 Supabase의 이메일 확인 기능을 비활성화하도록 유도하고 있다. SEC-001의 예측 가능한 비밀번호와 결합되면, 공격자가 다른 사용자의 이메일로 먼저 계정을 생성하여 가로채는 공격이 가능하다.

**개선 방안**: 이메일 확인 비활성화 대신, Jira API 토큰으로 이메일 소유권을 검증하는 별도 인증 흐름을 구현한다.

---

### SEC-013: 동기화 충돌 해결(LWW)에 무결성 검증 없음

| 항목 | 내용 |
|------|------|
| **심각도** | 중간 (Medium) |
| **OWASP** | A08 - 소프트웨어 및 데이터 무결성 실패 |
| **파일** | `src/main/services/sync.service.ts:112-131` |
| **영향** | 데이터 무결성 손상, 조용한 데이터 덮어쓰기 |

**발견 내용**:

동기화 서비스가 Last-Write-Wins(LWW) 전략을 사용하지만, 데이터 무결성 검증이 없다:

```typescript
// src/main/services/sync.service.ts:117-118
const localUpdated = new Date(local.updated_at as string).getTime();
const remoteUpdated = new Date(remote.updated_at as string).getTime();

if (remoteUpdated > localUpdated) {
    // 로컬 데이터를 원격 데이터로 덮어쓰기 - 무결성 검증 없음
}
```

문제점:
- 원격 데이터의 변조 여부를 확인하는 체크섬 없음
- 시계 차이(clock skew)로 인한 잘못된 충돌 해결 가능
- 사용자에게 충돌 발생 알림 없음

**개선 방안**: 버전 번호 또는 체크섬 기반 충돌 감지를 도입하고, 충돌 시 사용자 알림을 제공한다.

---

### SEC-014: JQL 검색 쿼리 직접 전달

| 항목 | 내용 |
|------|------|
| **심각도** | 중간 (Medium) |
| **OWASP** | A03 - 인젝션 |
| **파일** | `src/main/ipc/jira.ipc.ts:43`, `src/main/services/jira.service.ts:133-143` |
| **영향** | Jira 데이터 열거, DoS 가능성 |

**발견 내용**:

```typescript
// src/main/ipc/jira.ipc.ts:43
ipcMain.handle('jira:searchTickets', async (_event, jql: string, maxResults?: number) => {
    return getJiraService().searchTickets(jql, maxResults);
});
```

Renderer에서 전달된 JQL이 검증 없이 Jira API로 직접 전달된다. 악의적 JQL로 프로젝트 열거, 사용자 열거, 또는 과도한 결과를 요청하는 DoS가 가능하다.

**개선 방안**:
- JQL 길이 제한 (예: 500자)
- `maxResults` 상한 강제 적용 (예: 최대 50건)
- 가능하다면 구조화된 파라미터로 서버 사이드에서 JQL을 생성

---

## 6. 낮음 (Low) 이슈

### SEC-015: navigation/new-window 핸들러 미설정

| 항목 | 내용 |
|------|------|
| **심각도** | 낮음 (Low) |
| **OWASP** | A05 - 보안 설정 오류 |
| **파일** | `src/main/index.ts` |

Electron 보안 권장사항에 따르면 `will-navigate`와 `setWindowOpenHandler`를 설정하여 예기치 않은 페이지 이동이나 새 창 열기를 차단해야 한다. 현재 이러한 핸들러가 설정되어 있지 않다.

**개선 방안**:

```typescript
mb.on('ready', () => {
    if (mb.window) {
        mb.window.webContents.on('will-navigate', (event, url) => {
            if (!url.startsWith('http://localhost:5173') && !url.startsWith('file://')) {
                event.preventDefault();
            }
        });
        mb.window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    }
});
```

---

### SEC-016: Jira API 에러 응답 전체 노출

| 항목 | 내용 |
|------|------|
| **심각도** | 낮음 (Low) |
| **OWASP** | A09 - 보안 로깅 및 모니터링 실패 |
| **파일** | `src/main/services/jira.service.ts:65-66` |

```typescript
if (!response.ok) {
    const body = await response.text();
    throw new Error(`Jira API error (${response.status}): ${body}`);
}
```

Jira API의 전체 에러 응답 본문이 에러 메시지에 포함되어 Renderer까지 전달될 수 있다. 내부 서버 정보, 스택 트레이스 등이 노출될 가능성이 있다.

**개선 방안**: 상세 에러는 서버 로그에만 기록하고, Renderer에는 간략한 에러 메시지만 전달한다.

---

### SEC-017: 보안 로깅 및 감사 추적 부재

| 항목 | 내용 |
|------|------|
| **심각도** | 낮음 (Low) |
| **OWASP** | A09 - 보안 로깅 및 모니터링 실패 |
| **파일** | 전체 (특히 `auth.ipc.ts`, `team.ipc.ts`) |

인증 시도(성공/실패), 팀 관리 작업, 데이터 동기화 등의 보안 관련 이벤트에 대한 구조적 로깅이 없다. 다수의 catch 블록이 에러를 조용히 무시한다:

```typescript
// auth.ipc.ts:77
} catch {
    return null;  // 인증 실패 로깅 없음
}

// sync.service.ts:228
} catch {}  // 완전히 무시
```

**개선 방안**: 최소한 인증 이벤트와 관리 작업에 대한 구조적 로그를 남긴다.

---

### SEC-018: 의존성 보안 감사 필요

| 항목 | 내용 |
|------|------|
| **심각도** | 낮음 (Low) |
| **OWASP** | A06 - 취약하고 오래된 컴포넌트 |
| **파일** | `package.json` |

주요 의존성 보안 상태:

| 패키지 | 버전 | 비고 |
|--------|------|------|
| electron | ^40.6.0 | CVE 확인 필요 |
| @supabase/supabase-js | ^2.97.0 | 양호 |
| better-sqlite3 | ^12.6.2 | 양호 |
| electron-rebuild | ^3.2.9 | `@electron/rebuild`로 마이그레이션 권장 (deprecated) |
| vite | ^7.3.1 | 양호 |

**개선 방안**: `pnpm audit`를 CI/CD 파이프라인에 통합하여 정기적 취약점 검사를 수행한다.

---

## 7. 긍정적 보안 사항

검토 과정에서 확인된 올바른 보안 구현:

| 항목 | 설명 | 파일 | 상태 |
|------|------|------|------|
| contextIsolation | Renderer와 preload 간 컨텍스트 격리 | `src/main/index.ts:34` | 통과 |
| nodeIntegration | Renderer에서 Node.js API 차단 | `src/main/index.ts:35` | 통과 |
| contextBridge | 안전한 IPC 노출 방식 | `src/main/preload.ts:88` | 통과 |
| Prepared Statements | 모든 SQLite 쿼리 파라미터 바인딩 | 전체 DB repo | 통과 |
| .gitignore | `.env`, `*.db` 등 민감 파일 제외 | `.gitignore` | 통과 |
| 단일 인스턴스 잠금 | 다중 인스턴스 방지 | `src/main/index.ts:78` | 통과 |
| XSS 방어 (React) | React 자동 이스케이핑, dangerouslySetInnerHTML 미사용 | Renderer 전체 | 통과 |
| WAL 모드 | SQLite 동시성 안정성 | `src/main/db/index.ts:22` | 통과 |
| 외래키 활성화 | 데이터 무결성 보장 | `src/main/db/index.ts:23` | 통과 |
| safeStorage 복호화 로직 | Jira 토큰 복호화 시도 존재 (저장 로직은 누락) | `jira.service.ts:37` | 부분 통과 |

---

## 8. Supabase RLS 검증 체크리스트

현재 코드에서 Supabase RLS 정책을 직접 확인할 수 없으므로, 아래 항목을 반드시 Supabase Dashboard에서 확인해야 한다:

| 테이블 | 필수 RLS 정책 | 확인 |
|--------|-------------|------|
| `profiles` | 본인 프로필만 조회/수정 가능 | [ ] |
| `teams` | 팀 멤버만 조회, admin만 수정/삭제 가능 | [ ] |
| `team_members` | 팀 멤버만 조회, admin만 추가/삭제 가능 | [ ] |
| `shared_todos` | 해당 팀 멤버만 CRUD 가능 | [ ] |
| `user_todos` | 본인 데이터만 CRUD (`user_id = auth.uid()`) | [ ] |
| `user_memo_folders` | 본인 데이터만 CRUD | [ ] |
| `user_memos` | 본인 데이터만 CRUD | [ ] |

**확인 방법**: Supabase Dashboard > Table Editor > 각 테이블 > RLS Policies

```sql
-- RLS 정책 예시 (user_todos)
ALTER TABLE user_todos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "사용자 본인 데이터만 접근"
ON user_todos FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
```

---

## 9. 개선 우선순위 로드맵

### 즉시 조치 (배포 차단 - 1-2일)

| 순서 | 이슈 | 작업 | 난이도 |
|------|------|------|--------|
| 1 | SEC-001 | 예측 가능한 비밀번호를 장치별 고유 시크릿 기반으로 변경 | 높음 |
| 2 | SEC-002 | settings:set에 safeStorage 암호화 저장 로직 추가 | 낮음 |
| 3 | SEC-003 | settings API 키 화이트리스트 및 민감정보 마스킹 | 중간 |

### 릴리스 전 조치 (1주 이내)

| 순서 | 이슈 | 작업 | 난이도 |
|------|------|------|--------|
| 4 | SEC-005 | Content Security Policy 설정 | 낮음 |
| 5 | SEC-007 | shell:openExternal 프로토콜 화이트리스트 | 낮음 |
| 6 | SEC-006 | sandbox: true 전환 및 테스트 | 중간 |
| 7 | SEC-008 | Supabase RLS 정책 검증 및 앱 레벨 권한 검증 | 중간 |
| 8 | SEC-004 | VITE_ 접두어 제거, anon key 재발급 | 낮음 |

### 다음 스프린트 (1개월 이내)

| 순서 | 이슈 | 작업 | 난이도 |
|------|------|------|--------|
| 9 | SEC-009 | 전체 IPC 핸들러 Zod 기반 입력 검증 | 중간 |
| 10 | SEC-010 | Supabase RLS 코드 기반 관리 (마이그레이션) | 중간 |
| 11 | SEC-011 | Supabase 세션 갱신 및 만료 처리 | 중간 |
| 12 | SEC-012 | 인증 아키텍처 재설계 (Edge Function 연동) | 높음 |
| 13 | SEC-015 | will-navigate, setWindowOpenHandler 설정 | 낮음 |

### 백로그

| 순서 | 이슈 | 작업 | 난이도 |
|------|------|------|--------|
| 14 | SEC-013 | 동기화 충돌 해결 개선 (버전 번호, 알림) | 높음 |
| 15 | SEC-014 | JQL 입력 검증 및 길이 제한 | 낮음 |
| 16 | SEC-016 | 에러 메시지 정제 (민감정보 제거) | 낮음 |
| 17 | SEC-017 | 구조적 보안 로깅 시스템 도입 | 중간 |
| 18 | SEC-018 | 의존성 보안 감사 자동화 | 낮음 |

---

## 10. 종합 보안 점수 산출

| 카테고리 | 만점 | 득점 | 세부 |
|----------|------|------|------|
| 인증/인가 | 25 | 5 | 예측 가능한 비밀번호, 권한 검증 없음, 세션 관리 부재 |
| 데이터 보호 | 25 | 8 | API 토큰 평문 저장, DB 비암호화, 설정 API 무제한 노출 |
| Electron 보안 | 20 | 12 | contextIsolation 양호, sandbox/CSP/navigation 미설정 |
| IPC 보안 | 15 | 5 | 입력 검증 없음, 설정 키 제한 없음, 채널 필터링 없음 |
| 인프라/의존성 | 15 | 5 | CSP 미설정, RLS 미검증, 의존성 감사 미수행 |
| **합계** | **100** | **35** | |

---

## 11. 아키텍처 권장사항

### 권장사항 1: 보안 중심 IPC 미들웨어 패턴 도입

```typescript
import { z } from 'zod';

function secureHandler<T>(
    channel: string,
    schema: z.ZodSchema<T>,
    handler: (validated: T) => Promise<unknown>,
    options?: { requireAuth?: boolean }
) {
    ipcMain.handle(channel, async (_event, ...args) => {
        const validated = schema.parse(args.length === 1 ? args[0] : args);
        if (options?.requireAuth) {
            const session = await supabaseService.getSession();
            if (!session) throw new Error('인증이 필요합니다');
        }
        return handler(validated);
    });
}
```

### 권장사항 2: 민감 자격증명 전용 저장소 분리

```typescript
class SecureCredentialStore {
    private static SENSITIVE_KEYS = ['jira_api_token', 'supabase_anon_key'];

    static store(key: string, value: string): void {
        if (this.SENSITIVE_KEYS.includes(key) && safeStorage.isEncryptionAvailable()) {
            const encrypted = safeStorage.encryptString(value).toString('base64');
            settingsRepo.setSetting(key, encrypted);
        } else {
            settingsRepo.setSetting(key, value);
        }
    }

    static retrieve(key: string): string | null {
        const raw = settingsRepo.getSetting(key);
        if (!raw || !this.SENSITIVE_KEYS.includes(key)) return raw;
        try {
            return safeStorage.isEncryptionAvailable()
                ? safeStorage.decryptString(Buffer.from(raw, 'base64'))
                : raw;
        } catch {
            return raw;
        }
    }
}
```

### 권장사항 3: 인증 아키텍처 재설계

```
현재 구조 (취약):
  Renderer -> IPC -> Supabase signInWithPassword(email, "menubar_{email}_auto")

권장 구조:
  방안 A - 장치 바인딩:
    1. 최초 설정: 랜덤 비밀번호 생성 -> safeStorage 암호화 저장
    2. Supabase signUp(email, randomPassword) 또는 signIn
    3. 이후 실행: safeStorage에서 복호화 -> signIn

  방안 B - Supabase Edge Function (권장):
    1. Jira API 토큰으로 /myself 호출 -> 이메일 검증
    2. Edge Function이 service_role key로 커스텀 JWT 발급
    3. 클라이언트는 JWT로 Supabase 접근

  방안 C - Atlassian OAuth:
    1. Supabase + Atlassian OAuth Provider 연동
    2. 비밀번호 관리 불필요
```

---

## 부록: OWASP Top 10 대응 현황

| OWASP 항목 | 관련 이슈 | 상태 |
|------------|----------|------|
| A01 취약한 접근 제어 | SEC-003, SEC-007, SEC-008 | 실패 |
| A02 암호화 실패 | SEC-002, SEC-004 | 실패 |
| A03 인젝션 | SEC-009, SEC-014 | 실패 |
| A04 불안전한 설계 | SEC-010 | 경고 |
| A05 보안 설정 오류 | SEC-005, SEC-006, SEC-015 | 실패 |
| A06 취약한 컴포넌트 | SEC-018 | 경고 |
| A07 인증 실패 | SEC-001, SEC-011, SEC-012 | 실패 |
| A08 데이터 무결성 | SEC-013 | 경고 |
| A09 로깅/모니터링 | SEC-016, SEC-017 | 경고 |
| A10 SSRF | 해당 없음 (데스크탑 앱) | - |

---

*본 보고서는 소스코드 정적 분석을 기반으로 작성되었으며, Supabase Dashboard의 실제 RLS 정책, 네트워크 구성, 런타임 동작에 대한 동적 분석은 포함되지 않았습니다.*

*Security Architect Agent | 2026-02-21*
*Critical/High 이슈가 해결될 때까지 프로덕션 배포를 권장하지 않습니다.*
