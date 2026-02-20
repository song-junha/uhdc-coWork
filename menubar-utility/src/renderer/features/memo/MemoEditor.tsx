import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '../../hooks/useI18n';
import { useMemoStore } from './useMemoStore';
import type { Memo } from '../../../shared/types/memo.types';

interface MemoEditorProps {
  memo: Memo;
}

export default function MemoEditor({ memo }: MemoEditorProps) {
  const { t, locale } = useI18n();
  const { updateMemo } = useMemoStore();
  const [title, setTitle] = useState(memo.title);
  const [content, setContent] = useState(memo.content);

  useEffect(() => {
    setTitle(memo.title);
    setContent(memo.content);
  }, [memo.id]);

  const saveDebounced = useCallback(
    debounce((id: string, data: { title?: string; content?: string }) => {
      updateMemo(id, data);
    }, 500),
    []
  );

  const handleTitleChange = (value: string) => {
    setTitle(value);
    saveDebounced(memo.id, { title: value });
  };

  const handleContentChange = (value: string) => {
    setContent(value);
    saveDebounced(memo.id, { content: value });
  };

  return (
    <div className="flex flex-col h-full">
      <input
        value={title}
        onChange={(e) => handleTitleChange(e.target.value)}
        className="px-3 py-2 text-sm font-semibold bg-transparent border-b border-[var(--border)] outline-none"
        placeholder={t('memo.titlePlaceholder')}
      />
      <textarea
        value={content}
        onChange={(e) => handleContentChange(e.target.value)}
        className="flex-1 px-3 py-2 text-sm bg-transparent resize-none outline-none font-mono"
        placeholder={t('memo.contentPlaceholder')}
      />
      <div className="px-3 py-1 text-[10px] text-[var(--text-secondary)] border-t border-[var(--border)]">
        {t('memo.lastUpdated')}: {new Date(memo.updatedAt).toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-US')}
      </div>
    </div>
  );
}

function debounce<T extends (...args: Parameters<T>) => void>(fn: T, ms: number) {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}
