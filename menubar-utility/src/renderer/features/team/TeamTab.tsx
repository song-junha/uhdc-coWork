import { useEffect } from 'react';
import { Database, Settings } from 'lucide-react';
import { useI18n } from '../../hooks/useI18n';
import { useTeamStore } from './useTeamStore';
import AuthForm from './AuthForm';
import TeamList from './TeamList';
import MemberList from './MemberList';
import InviteDialog from './InviteDialog';
import SpotGroupForm from './SpotGroupForm';

interface TeamTabProps {
  onOpenSettings?: () => void;
}

export default function TeamTab({ onOpenSettings }: TeamTabProps) {
  const { t } = useI18n();
  const { user, isConfigured, isLoading, view, checkConfigured, checkAuth } = useTeamStore();

  useEffect(() => {
    checkConfigured().then(() => {
      if (useTeamStore.getState().isConfigured) {
        checkAuth();
      }
    });
  }, []);

  // Not configured: show setup instructions
  if (!isConfigured) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-[var(--text-secondary)] px-6">
        <Database size={40} className="mb-3 opacity-40" />
        <h3 className="text-sm font-semibold text-[var(--text)] mb-1">{t('team.notConfigured')}</h3>
        <p className="text-[12px] text-center mb-4">{t('team.notConfiguredDesc')}</p>
        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors"
          >
            <Settings size={14} />
            {t('team.goToSettings')}
          </button>
        )}
      </div>
    );
  }

  // Loading initial auth check
  if (isLoading && !user) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--text-secondary)]">
        {t('common.loading')}
      </div>
    );
  }

  // Not authenticated: show auth form
  if (!user) {
    return <AuthForm />;
  }

  // Authenticated: show appropriate view
  switch (view) {
    case 'members':
      return <MemberList />;
    case 'invite':
      return <InviteDialog />;
    case 'createGroup':
      return <SpotGroupForm />;
    default:
      return <TeamList />;
  }
}
