import { useEffect } from 'react';
import { LinkIcon } from 'lucide-react';
import { useI18n } from '../../hooks/useI18n';
import { useTeamStore } from './useTeamStore';
import TeamList from './TeamList';
import MemberList from './MemberList';
import AddMemberDialog from './AddMemberDialog';
import SpotGroupForm from './SpotGroupForm';

interface TeamTabProps {
  onOpenSettings?: () => void;
}

export default function TeamTab({ onOpenSettings }: TeamTabProps) {
  const { t } = useI18n();
  const { user, isJiraConfigured, isLoading, error, view, checkAndAuth } = useTeamStore();

  useEffect(() => {
    checkAndAuth();
  }, []);

  // Jira 미설정: 설정으로 안내
  if (!isJiraConfigured) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-[var(--text-secondary)] px-6">
        <LinkIcon size={40} className="mb-3 opacity-40" />
        <h3 className="text-sm font-semibold text-[var(--text)] mb-1">{t('team.notConfigured')}</h3>
        <p className="text-[12px] text-center mb-4">{t('team.notConfiguredDesc')}</p>
        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors"
          >
            {t('team.goToSettings')}
          </button>
        )}
      </div>
    );
  }

  // 자동 인증 중
  if (isLoading && !user) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--text-secondary)]">
        {t('common.loading')}
      </div>
    );
  }

  // 인증 실패 (Supabase 미설정 등)
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-[var(--text-secondary)] px-6">
        <p className="text-sm text-center">{t('auth.error')}</p>
        {error && (
          <p className="text-[10px] text-red-400 text-center mt-2 px-2 py-1 bg-red-500/10 rounded">{t(error as any)}</p>
        )}
        <p className="text-[11px] text-center mt-2">{t('team.notConfiguredDesc')}</p>
        <button
          onClick={() => checkAndAuth()}
          className="mt-3 px-4 py-1.5 text-xs font-medium bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors"
        >
          {t('common.retry')}
        </button>
      </div>
    );
  }

  // 인증 완료: 뷰 전환
  switch (view) {
    case 'members':
      return <MemberList />;
    case 'invite':
      return <AddMemberDialog />;
    case 'createGroup':
      return <SpotGroupForm />;
    default:
      return <TeamList />;
  }
}
