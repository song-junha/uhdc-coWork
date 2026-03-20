import { useState, useEffect } from 'react';
import TabNav, { type TabId } from './components/TabNav';
import TodoTab from './features/todo/TodoTab';
import MemoTab from './features/memo/MemoTab';
import JiraTab from './features/jira/JiraTab';
import CalendarTab from './features/calendar/CalendarTab';
import TeamTab from './features/team/TeamTab';
import SettingsView from './features/settings/SettingsView';
import { useWindowScale } from './hooks/useWindowScale';
import { useTeamStore } from './features/team/useTeamStore';
import './hooks/useTheme'; // hydrate theme on startup

const tabComponents: Record<TabId, React.ComponentType> = {
  todo: TodoTab,
  memo: MemoTab,
  jira: JiraTab,
  calendar: CalendarTab,
  team: TeamTab,
};

export default function App() {
  useWindowScale();
  const [activeTab, setActiveTab] = useState<TabId>('todo');
  const [showSettings, setShowSettings] = useState(false);

  // 앱 시작 시 Jira/Supabase 인증 (user 정보 미리 로드)
  useEffect(() => {
    useTeamStore.getState().checkAndAuth();
  }, []);

  // Keyboard shortcuts: Cmd+1~5, Cmd+,, Cmd+N
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        const tabMap: Record<string, TabId> = {
          '1': 'todo', '2': 'memo', '3': 'jira', '4': 'calendar', '5': 'team',
        };
        if (tabMap[e.key]) {
          e.preventDefault();
          setShowSettings(false);
          setActiveTab(tabMap[e.key]);
        }
        if (e.key === ',') {
          e.preventDefault();
          setShowSettings(prev => !prev);
        }
        if (e.key === 'n') {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('app:new-item'));
        }
        if (e.key === 'f') {
          e.preventDefault();
          setShowSettings(false);
          setActiveTab('memo');
          window.dispatchEvent(new CustomEvent('app:focus-search'));
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const ActiveComponent = tabComponents[activeTab];

  return (
    <div className="flex flex-col h-screen bg-[var(--bg)] overflow-hidden">
      {/* 리사이즈 핸들 (frameless 윈도우용) */}
      <div className="fixed top-0 right-0 w-1.5 h-full cursor-ew-resize z-50" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties} />
      <div className="fixed bottom-0 left-0 w-full h-1.5 cursor-ns-resize z-50" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties} />
      <div className="fixed bottom-0 right-0 w-3 h-3 cursor-nwse-resize z-50" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties} />
      <div className="fixed top-0 left-0 w-1.5 h-full cursor-ew-resize z-50" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties} />

      <TabNav activeTab={activeTab} onTabChange={(tab) => { setShowSettings(false); setActiveTab(tab); }} onSettingsClick={() => setShowSettings(true)} />
      <main className="flex-1 overflow-hidden">
        {showSettings ? (
          <SettingsView onClose={() => setShowSettings(false)} />
        ) : activeTab === 'team' ? (
          <TeamTab onOpenSettings={() => setShowSettings(true)} />
        ) : (
          <ActiveComponent />
        )}
      </main>
    </div>
  );
}
