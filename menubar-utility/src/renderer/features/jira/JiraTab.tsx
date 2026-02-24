import { useEffect, useRef, useState } from 'react';
import { Plus, ExternalLink, Settings, KeyRound, ChevronDown, ChevronUp, RefreshCw, Circle } from 'lucide-react';
import { useI18n } from '../../hooks/useI18n';
import { useJiraStore } from './useJiraStore';
import AssigneeSelector, { type SelectedAssignee } from '../../components/AssigneeSelector';
import type { JiraSearchIssue, JiraTransition } from '../../../shared/types/jira.types';

const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

export default function JiraTab() {
  const { t } = useI18n();
  const {
    isConfigured, history, openTickets, doneTickets, activeTab,
    projects, issueTypes, showCreateForm, ticketsLoading,
    checkConfig, fetchProjects, fetchHistory, fetchMyTickets,
    setActiveTab, setShowCreateForm,
  } = useJiraStore();
  const [showSetup, setShowSetup] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { checkConfig(); }, []);

  // Periodic refresh for open/done tickets
  useEffect(() => {
    if (!isConfigured) return;
    intervalRef.current = setInterval(() => {
      fetchMyTickets();
    }, REFRESH_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isConfigured]);

  if (!isConfigured || showSetup) {
    return <JiraSetup onDone={() => { setShowSetup(false); checkConfig(); }} />;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)]">
        <span className="text-sm font-semibold">{t('jira.title')}</span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => { fetchMyTickets(); fetchHistory(); }}
            className="text-[var(--text-secondary)] hover:text-[var(--text)]"
            title="Refresh"
          >
            <RefreshCw size={13} className={ticketsLoading ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => setShowSetup(true)} className="text-[var(--text-secondary)] hover:text-[var(--text)]">
            <Settings size={14} />
          </button>
        </div>
      </div>

      <div className="p-3">
        <button
          onClick={async () => { await fetchProjects(); setShowCreateForm(true); }}
          className="w-full flex items-center justify-center gap-2 py-3 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors"
        >
          <Plus size={16} />
          <span className="font-medium">{t('jira.createNew')}</span>
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-[var(--border)] px-3">
        {(['created', 'open', 'done'] as const).map((tab) => {
          const labels = {
            created: t('jira.recentTickets'),
            open: t('jira.openTickets'),
            done: t('jira.doneTickets'),
          };
          const counts = {
            created: history.length,
            open: openTickets.length,
            done: doneTickets.length,
          };
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-1.5 text-[11px] font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-[var(--primary)] text-[var(--primary)]'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text)]'
              }`}
            >
              {labels[tab]}
              {counts[tab] > 0 && (
                <span className="ml-1 text-[10px] opacity-60">{counts[tab]}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto px-3 pt-2">
        {activeTab === 'created' && <CreatedTab />}
        {activeTab === 'open' && <OpenTab />}
        {activeTab === 'done' && <DoneTab />}
      </div>

      {showCreateForm && (
        <JiraCreateForm
          projects={projects}
          onClose={() => { setShowCreateForm(false); fetchHistory(); }}
        />
      )}
    </div>
  );
}

function CreatedTab() {
  const { t } = useI18n();
  const { history, fetchHistory } = useJiraStore();

  if (history.length === 0) {
    return <p className="text-sm text-[var(--text-secondary)] text-center py-4">{t('jira.noTickets')}</p>;
  }

  return (
    <>
      {history.map(issue => (
        <TicketItem key={issue.key} issue={issue} onTransitioned={fetchHistory} />
      ))}
    </>
  );
}

function TicketItem({ issue, onTransitioned }: { issue: JiraSearchIssue; onTransitioned?: () => void }) {
  const statusName = issue.fields.status.name;
  const categoryKey = issue.fields.status.statusCategory.key;
  const statusColor = categoryKey === 'done' ? 'text-green-500'
    : categoryKey === 'indeterminate' ? 'text-blue-500'
    : 'text-[var(--text-secondary)]';

  const [transitions, setTransitions] = useState<JiraTransition[]>([]);
  const [showMenu, setShowMenu] = useState(false);
  const [loading, setLoading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  const handleOpen = () => {
    const baseUrl = window.electronAPI.settings.get('jira_base_url');
    baseUrl.then(url => {
      if (url) window.electronAPI.shell.openExternal(`${url.replace(/\/$/, '')}/browse/${issue.key}`);
    });
  };

  const handleStatusClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (showMenu) { setShowMenu(false); return; }
    setLoading(true);
    try {
      const t = await window.electronAPI.jira.getTransitions(issue.key);
      setTransitions(t);
      setShowMenu(true);
    } catch { /* ignore */ }
    setLoading(false);
  };

  const handleTransition = async (transitionId: string) => {
    setShowMenu(false);
    setLoading(true);
    try {
      await window.electronAPI.jira.doTransition(issue.key, transitionId);
      onTransitioned?.();
    } catch { /* ignore */ }
    setLoading(false);
  };

  return (
    <div className="group flex items-center gap-2 py-2 border-b border-[var(--border)] relative">
      <button onClick={handleStatusClick} className="shrink-0" title="Change status">
        <Circle size={12} className={`${statusColor} fill-current ${loading ? 'animate-pulse' : ''}`} />
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[12px] font-mono font-medium text-[var(--primary)]">{issue.key}</span>
          <button
            onClick={handleStatusClick}
            className={`text-[10px] ${statusColor} hover:underline cursor-pointer`}
          >
            {statusName}
          </button>
        </div>
        <p className="text-[12px] truncate">{issue.fields.summary}</p>
      </div>
      <button
        onClick={handleOpen}
        className="text-[var(--text-secondary)] hover:text-[var(--primary)]"
      >
        <ExternalLink size={12} />
      </button>

      {showMenu && transitions.length > 0 && (
        <div ref={menuRef} className="absolute left-4 top-full z-30 bg-[var(--bg)] border border-[var(--border)] rounded-md shadow-lg py-1 min-w-[160px]">
          {transitions.map(tr => {
            const trColor = tr.to.statusCategory.key === 'done' ? 'text-green-500'
              : tr.to.statusCategory.key === 'indeterminate' ? 'text-blue-500'
              : 'text-[var(--text-secondary)]';
            return (
              <button
                key={tr.id}
                onClick={() => handleTransition(tr.id)}
                className="w-full flex items-center gap-2 px-3 py-2 text-[13px] hover:bg-[var(--surface)] transition-colors"
              >
                <Circle size={10} className={`${trColor} fill-current`} />
                <span>{tr.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function OpenTab() {
  const { t } = useI18n();
  const { openTickets, ticketsLoading, fetchMyTickets } = useJiraStore();

  if (ticketsLoading && openTickets.length === 0) {
    return <p className="text-sm text-[var(--text-secondary)] text-center py-4">{t('jira.loadingTickets')}</p>;
  }
  if (openTickets.length === 0) {
    return <p className="text-sm text-[var(--text-secondary)] text-center py-4">{t('jira.noOpenTickets')}</p>;
  }

  return (
    <>
      {openTickets.map(issue => (
        <TicketItem key={issue.key} issue={issue} onTransitioned={fetchMyTickets} />
      ))}
    </>
  );
}

function DoneTab() {
  const { t } = useI18n();
  const { doneTickets, ticketsLoading, fetchMyTickets } = useJiraStore();

  if (ticketsLoading && doneTickets.length === 0) {
    return <p className="text-sm text-[var(--text-secondary)] text-center py-4">{t('jira.loadingTickets')}</p>;
  }
  if (doneTickets.length === 0) {
    return <p className="text-sm text-[var(--text-secondary)] text-center py-4">{t('jira.noDoneTickets')}</p>;
  }

  return (
    <>
      {doneTickets.map(issue => (
        <TicketItem key={issue.key} issue={issue} onTransitioned={fetchMyTickets} />
      ))}
    </>
  );
}

function JiraSetup({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const [baseUrl, setBaseUrl] = useState('');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'failed' | null>(null);
  const [testError, setTestError] = useState('');
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    (async () => {
      const url = await window.electronAPI.settings.get('jira_base_url');
      const em = await window.electronAPI.settings.get('jira_email');
      if (url) setBaseUrl(url);
      if (em) setEmail(em);
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    await window.electronAPI.settings.set('jira_base_url', baseUrl.replace(/\/$/, ''));
    await window.electronAPI.settings.set('jira_email', email);
    await window.electronAPI.settings.set('jira_api_token', token);
    // Jira 정보 변경 시 Supabase 계정 자동 생성/전환
    try {
      await window.electronAPI.auth.autoAuth();
    } catch { /* non-fatal */ }
    setSaving(false);
    onDone();
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    setTestError('');
    await window.electronAPI.settings.set('jira_base_url', baseUrl.replace(/\/$/, ''));
    await window.electronAPI.settings.set('jira_email', email);
    await window.electronAPI.settings.set('jira_api_token', token);
    const result = await window.electronAPI.jira.testConnection();
    const ok = typeof result === 'boolean' ? result : result.ok;
    setTestResult(ok ? 'success' : 'failed');
    if (!ok && typeof result === 'object' && result.error) setTestError(result.error);
    // 연결 테스트 성공 시 Supabase 계정도 자동 생성/전환
    if (ok) {
      try {
        await window.electronAPI.auth.autoAuth();
      } catch { /* non-fatal */ }
    }
    setTesting(false);
  };

  const openTokenPage = () => {
    window.electronAPI.shell.openExternal('https://id.atlassian.com/manage-profile/security/api-tokens');
  };

  return (
    <div className="flex flex-col h-full p-4 overflow-y-auto">
      <h3 className="text-sm font-semibold mb-3">{t('jira.setup')}</h3>

      {/* API Token Guide */}
      <div className="mb-3 border border-[var(--border)] rounded-lg overflow-hidden">
        <button
          onClick={() => setShowGuide(!showGuide)}
          className="w-full flex items-center gap-2 px-3 py-2 text-[12px] font-medium text-[var(--primary)] hover:bg-[var(--surface)] transition-colors"
        >
          <KeyRound size={14} />
          <span className="flex-1 text-left">{t('jira.guideTitle')}</span>
          {showGuide ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        {showGuide && (
          <div className="px-3 pb-3 space-y-1.5">
            <p className="text-[11px] text-[var(--text-secondary)]">{t('jira.guideStep1')}</p>
            <p className="text-[11px] text-[var(--text-secondary)]">{t('jira.guideStep2')}</p>
            <p className="text-[11px] text-[var(--text-secondary)]">{t('jira.guideStep3')}</p>
            <p className="text-[11px] text-[var(--text-secondary)]">{t('jira.guideStep4')}</p>
            <button
              onClick={openTokenPage}
              className="flex items-center gap-1.5 mt-2 px-3 py-1.5 text-[11px] font-medium text-white bg-[var(--primary)] rounded-md hover:opacity-90 transition-opacity"
            >
              <ExternalLink size={12} />
              {t('jira.guideLink')}
            </button>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-[11px] text-[var(--text-secondary)]">{t('jira.url')}</label>
          <input value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder="https://lgdigitalcommerce.atlassian.net" className="w-full mt-1 px-2.5 py-1.5 text-sm bg-[var(--surface)] border border-[var(--border)] rounded-md" />
          <p className="mt-0.5 text-[10px] text-[var(--text-secondary)]">{t('jira.urlHint')}</p>
        </div>
        <div>
          <label className="text-[11px] text-[var(--text-secondary)]">{t('jira.email')}</label>
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="your@lguplus.co.kr" className="w-full mt-1 px-2.5 py-1.5 text-sm bg-[var(--surface)] border border-[var(--border)] rounded-md" />
          <p className="mt-0.5 text-[10px] text-[var(--text-secondary)]">{t('jira.emailHint')}</p>
        </div>
        <div>
          <label className="text-[11px] text-[var(--text-secondary)]">{t('jira.apiToken')}</label>
          <input type="password" value={token} onChange={e => setToken(e.target.value)} placeholder="API Token" className="w-full mt-1 px-2.5 py-1.5 text-sm bg-[var(--surface)] border border-[var(--border)] rounded-md" />
        </div>
        <div className="flex gap-2">
          <button onClick={handleTest} disabled={!baseUrl || !email || !token || testing} className="flex-1 py-1.5 text-sm border border-[var(--border)] rounded-md hover:bg-[var(--surface)] disabled:opacity-40 transition-colors">
            {testing ? t('jira.testing') : t('jira.testConnection')}
          </button>
          <button onClick={handleSave} disabled={!baseUrl || !email || !token || saving} className="flex-1 py-1.5 text-sm font-medium text-white bg-[var(--primary)] rounded-md disabled:opacity-40">
            {saving ? t('jira.testing') : t('jira.saveConnect')}
          </button>
        </div>
        {testResult && (
          <p className={`text-[12px] ${testResult === 'success' ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
            {testResult === 'success' ? t('jira.testSuccess') : t('jira.testFailed')}
            {testError && <span className="block text-[10px] mt-0.5 opacity-70 select-text cursor-text">{testError}</span>}
          </p>
        )}
      </div>
    </div>
  );
}

const DEFAULT_PROJECT = 'DCBGIT';
const DEFAULT_ISSUE_TYPE_NAME = '개발문의';

const INQUIRY_TYPE_OPTIONS = [
  { id: '11636', label: '문의 응대(DM, 전화, 이메일 등)' },
  { id: '11637', label: '회의 참석' },
  { id: '11638', label: '동료 지원' },
];

function JiraCreateForm({ projects, onClose }: { projects: { key: string; name: string }[]; onClose: () => void }) {
  const { t } = useI18n();
  const { issueTypes, fetchIssueTypes } = useJiraStore();
  const today = new Date().toISOString().slice(0, 10);
  const [projectKey, setProjectKey] = useState(DEFAULT_PROJECT);
  const [issueTypeId, setIssueTypeId] = useState('');
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [inquiryTypeId, setInquiryTypeId] = useState('');
  const [selectedAssignees, setSelectedAssignees] = useState<SelectedAssignee[]>([]);
  const [dueDate, setDueDate] = useState(today);
  const [workDays, setWorkDays] = useState('0.1');
  const [submitting, setSubmitting] = useState(false);

  // Auto-fetch issue types + get current user as default assignee
  useEffect(() => {
    fetchIssueTypes(DEFAULT_PROJECT);
    (async () => {
      try {
        const myself = await window.electronAPI.jira.getMyself();
        setSelectedAssignees([{ jiraAccountId: myself.accountId, displayName: myself.displayName }]);
      } catch { /* ignore */ }
    })();
  }, []);

  // Auto-select default issue type when issue types are loaded
  useEffect(() => {
    if (issueTypes.length > 0 && !issueTypeId) {
      const defaultType = issueTypes.find(tp => tp.name === DEFAULT_ISSUE_TYPE_NAME);
      if (defaultType) setIssueTypeId(defaultType.id);
    }
  }, [issueTypes]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, projectKey, issueTypeId, summary, selectedAssignees]);

  const handleProjectChange = async (key: string) => {
    setProjectKey(key);
    setIssueTypeId('');
    if (key) await fetchIssueTypes(key);
  };

  const handleSubmit = async () => {
    if (!projectKey || !issueTypeId || !summary || selectedAssignees.length === 0) return;
    setSubmitting(true);
    try {
      const customFields: Record<string, unknown> = {};
      if (inquiryTypeId) customFields.customfield_10890 = { id: inquiryTypeId };
      if (dueDate) customFields.customfield_10267 = dueDate;
      if (workDays) customFields.customfield_10126 = parseFloat(workDays) || 0.1;

      for (const assignee of selectedAssignees) {
        await window.electronAPI.jira.createTicket({
          projectKey, issueTypeId, summary, description,
          assigneeId: assignee.jiraAccountId,
          customFields,
        });
      }
      onClose();
    } catch (err) {
      alert('Failed: ' + (err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const bulkCount = selectedAssignees.length;
  const showBulkLabel = bulkCount >= 2;

  return (
    <div className="absolute inset-0 bg-[var(--bg)] z-20 flex flex-col p-3 overflow-y-auto">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">{t('jira.newTicket')}</h3>
        <button onClick={onClose} className="text-[var(--text-secondary)] text-sm">{t('common.cancel')}</button>
      </div>
      <div className="space-y-2 flex-1">
        <select value={projectKey} onChange={e => handleProjectChange(e.target.value)} className="w-full px-2.5 py-1.5 text-sm bg-[var(--surface)] border border-[var(--border)] rounded-md">
          <option value="">{t('jira.project')}</option>
          {projects.map(p => <option key={p.key} value={p.key}>{p.key} - {p.name}</option>)}
        </select>
        <select value={issueTypeId} onChange={e => setIssueTypeId(e.target.value)} disabled={!projectKey} className="w-full px-2.5 py-1.5 text-sm bg-[var(--surface)] border border-[var(--border)] rounded-md disabled:opacity-40">
          <option value="">{t('jira.issueType')}</option>
          {issueTypes.map(tp => <option key={tp.id} value={tp.id}>{tp.name}</option>)}
        </select>
        {issueTypeId === '10149' && (
          <select value={inquiryTypeId} onChange={e => setInquiryTypeId(e.target.value)} className="w-full px-2.5 py-1.5 text-sm bg-[var(--surface)] border border-[var(--border)] rounded-md">
            <option value="">개발문의 타입 선택</option>
            {INQUIRY_TYPE_OPTIONS.map(opt => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
          </select>
        )}
        <input value={summary} onChange={e => setSummary(e.target.value)} placeholder={t('jira.summary')} autoFocus className="w-full px-2.5 py-1.5 text-sm bg-[var(--surface)] border border-[var(--border)] rounded-md" />
        <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder={t('jira.description')} rows={3} className="w-full px-2.5 py-1.5 text-sm bg-[var(--surface)] border border-[var(--border)] rounded-md resize-none" />
        <div className="flex gap-2">
          <div className="flex-1">
            <AssigneeSelector
              mode="multi"
              selected={selectedAssignees}
              onChange={setSelectedAssignees}
            />
          </div>
          <div className="flex-1">
            <label className="text-[10px] text-[var(--text-secondary)]">실공수(Day)</label>
            <input type="number" step="0.1" min="0" value={workDays} onChange={e => setWorkDays(e.target.value)} className="w-full mt-0.5 px-2.5 py-1.5 text-sm bg-[var(--surface)] border border-[var(--border)] rounded-md" />
          </div>
        </div>
        <div>
          <label className="text-[10px] text-[var(--text-secondary)]">배포/작업 완료일자</label>
          <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full mt-0.5 px-2.5 py-1.5 text-sm bg-[var(--surface)] border border-[var(--border)] rounded-md" />
        </div>
      </div>
      <button onClick={handleSubmit} disabled={!projectKey || !issueTypeId || !summary || selectedAssignees.length === 0 || submitting} className="w-full py-2 mt-3 text-sm font-medium text-white bg-[var(--primary)] rounded-md disabled:opacity-40">
        {submitting ? t('jira.creating') : showBulkLabel ? t('jira.createBulk', { count: bulkCount }) : t('jira.create')}
      </button>
    </div>
  );
}
