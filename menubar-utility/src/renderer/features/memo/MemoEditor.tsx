import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Eye, Pencil } from 'lucide-react';
import { useI18n } from '../../hooks/useI18n';
import { useMemoStore } from './useMemoStore';
import type { Memo } from '../../../shared/types/memo.types';

function renderMarkdown(text: string): string {
  let html = text
    // Escape HTML
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Code blocks (``` ... ```)
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="md-code-block"><code>$2</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>')
    // Headers
    .replace(/^### (.+)$/gm, '<h3 class="md-h3">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="md-h2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="md-h1">$1</h1>')
    // Bold & Italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Strikethrough
    .replace(/~~(.+?)~~/g, '<del>$1</del>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a class="md-link" href="$2">$1</a>')
    // Unordered list
    .replace(/^[-*] (.+)$/gm, '<li class="md-li">$1</li>')
    // Ordered list
    .replace(/^\d+\. (.+)$/gm, '<li class="md-li-ol">$1</li>')
    // Blockquote
    .replace(/^> (.+)$/gm, '<blockquote class="md-quote">$1</blockquote>')
    // Horizontal rule
    .replace(/^---$/gm, '<hr class="md-hr" />')
    // Line breaks
    .replace(/\n/g, '<br />');

  // Wrap consecutive <li> elements
  html = html.replace(/((?:<li class="md-li">.*?<\/li><br \/>)+)/g, (match) =>
    '<ul class="md-ul">' + match.replace(/<br \/>/g, '') + '</ul>'
  );
  html = html.replace(/((?:<li class="md-li-ol">.*?<\/li><br \/>)+)/g, (match) =>
    '<ol class="md-ol">' + match.replace(/<br \/>/g, '') + '</ol>'
  );

  return html;
}

interface MemoEditorProps {
  memo: Memo;
}

export default function MemoEditor({ memo }: MemoEditorProps) {
  const { t, locale } = useI18n();
  const { updateMemo } = useMemoStore();
  const [title, setTitle] = useState(memo.title);
  const [content, setContent] = useState(memo.content);
  const [preview, setPreview] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setTitle(memo.title);
    setContent(memo.content);
    setPreview(false);
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

  const renderedHtml = useMemo(() => preview ? renderMarkdown(content) : '', [preview, content]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center border-b border-[var(--border)]">
        <input
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          className="flex-1 px-3 py-2 text-sm font-semibold bg-transparent outline-none"
          placeholder={t('memo.titlePlaceholder')}
        />
        <button
          onClick={() => setPreview(!preview)}
          className={`px-2 py-2 transition-colors ${
            preview
              ? 'text-[var(--primary)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text)]'
          }`}
          title={preview ? t('memo.edit') : t('memo.preview')}
        >
          {preview ? <Pencil size={14} /> : <Eye size={14} />}
        </button>
      </div>

      {preview ? (
        <div
          className="flex-1 px-3 py-2 text-sm overflow-y-auto memo-preview"
          dangerouslySetInnerHTML={{ __html: renderedHtml }}
        />
      ) : (
        <textarea
          value={content}
          onChange={(e) => handleContentChange(e.target.value)}
          className="flex-1 px-3 py-2 text-sm bg-transparent resize-none outline-none font-mono"
          placeholder={t('memo.contentPlaceholder')}
        />
      )}

      <div className="px-3 py-1 text-[10px] text-[var(--text-secondary)] border-t border-[var(--border)]">
        {t('memo.lastUpdated')}: {new Date(memo.updatedAt).toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-US')}
      </div>
    </div>
  );
}
