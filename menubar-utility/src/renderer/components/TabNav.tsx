import { cn } from '../lib/utils';
import { useI18n } from '../hooks/useI18n';
import {
  CheckSquare,
  FileText,
  Ticket,
  CalendarDays,
  Users,
  Settings,
} from 'lucide-react';
import type { TranslationKey } from '../../shared/i18n';

export type TabId = 'todo' | 'memo' | 'jira' | 'calendar' | 'team';

interface TabNavProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  onSettingsClick?: () => void;
}

const tabs: { id: TabId; labelKey: TranslationKey; icon: React.ComponentType<{ size?: number }> }[] = [
  { id: 'todo', labelKey: 'tab.todo', icon: CheckSquare },
  { id: 'memo', labelKey: 'tab.memo', icon: FileText },
  { id: 'jira', labelKey: 'tab.jira', icon: Ticket },
  { id: 'calendar', labelKey: 'tab.calendar', icon: CalendarDays },
  { id: 'team', labelKey: 'tab.team', icon: Users },
];

export default function TabNav({ activeTab, onTabChange, onSettingsClick }: TabNavProps) {
  const { t } = useI18n();

  return (
    <nav className="flex items-center border-b border-[var(--border)] bg-[var(--surface)]">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'flex-1 flex flex-col items-center gap-0.5 py-2 px-1 text-[11px] font-medium transition-colors',
              'hover:text-[var(--primary)]',
              isActive
                ? 'text-[var(--primary)] border-b-2 border-[var(--primary)]'
                : 'text-[var(--text-secondary)]'
            )}
          >
            <Icon size={16} />
            {t(tab.labelKey)}
          </button>
        );
      })}
      {onSettingsClick && (
        <button
          onClick={onSettingsClick}
          className="px-2 py-2 text-[var(--text-secondary)] hover:text-[var(--primary)] transition-colors"
        >
          <Settings size={14} />
        </button>
      )}
    </nav>
  );
}
