import { useState, useEffect, useRef, useCallback } from 'react';
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
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setTitle(memo.title);
    setContent(memo.content);
  }, [memo.id]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const saveDebounced = useCallback((id: string, data: { title?: string; content?: string }) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      updateMemo(id, data);
    }, 500);
  }, [updateMemo]);

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
