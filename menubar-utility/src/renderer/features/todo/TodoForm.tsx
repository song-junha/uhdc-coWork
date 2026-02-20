import { useState, useEffect, useRef } from 'react';
import { X, User } from 'lucide-react';
import { useI18n } from '../../hooks/useI18n';
import { useTodoStore } from './useTodoStore';
import type { Todo } from '../../../shared/types/todo.types';

interface TodoFormProps {
  onClose: () => void;
  existingTodo?: Todo;
}

export default function TodoForm({ onClose, existingTodo }: TodoFormProps) {
  const { t } = useI18n();
  const { createTodo, updateTodo } = useTodoStore();
  const [title, setTitle] = useState(existingTodo?.title ?? '');
  const [description, setDescription] = useState(existingTodo?.description ?? '');
  const [priority, setPriority] = useState(existingTodo?.priority ?? 'medium');
  const [dueDate, setDueDate] = useState(existingTodo?.dueDate ?? '');
  const [assigneeName, setAssigneeName] = useState(existingTodo?.assigneeName ?? '');
  const [recentAssignees, setRecentAssignees] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (existingTodo) {
      setTitle(existingTodo.title);
      setDescription(existingTodo.description);
      setPriority(existingTodo.priority);
      setDueDate(existingTodo.dueDate ?? '');
      setAssigneeName(existingTodo.assigneeName ?? '');
    }
  }, [existingTodo]);

  useEffect(() => {
    window.electronAPI.todo.getRecentAssignees().then(setRecentAssignees);
  }, []);

  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        formRef.current?.requestSubmit();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Close suggestions on outside click
  useEffect(() => {
    if (!showSuggestions) return;
    const handleClick = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showSuggestions]);

  const filteredSuggestions = recentAssignees.filter(
    name => name.toLowerCase().includes(assigneeName.toLowerCase()) && name !== assigneeName
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    if (existingTodo) {
      await updateTodo(existingTodo.id, {
        title: title.trim(),
        description,
        priority,
        dueDate: dueDate || null,
        assigneeName: assigneeName.trim(),
      });
    } else {
      await createTodo({
        title: title.trim(),
        description,
        priority,
        dueDate: dueDate || undefined,
        assigneeName: assigneeName.trim() || undefined,
      });
    }

    onClose();
  };

  return (
    <div className="absolute inset-x-0 bottom-0 bg-[var(--bg)] border-t border-[var(--border)] p-3 shadow-lg z-10">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold">
          {existingTodo ? t('todo.edit') : t('todo.new')}
        </h3>
        <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text)]">
          <X size={16} />
        </button>
      </div>

      <form ref={formRef} onSubmit={handleSubmit} className="space-y-2">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('todo.placeholder')}
          autoFocus
          className="w-full px-2.5 py-1.5 text-sm bg-[var(--surface)] border border-[var(--border)] rounded-md"
        />

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('todo.description')}
          rows={2}
          className="w-full px-2.5 py-1.5 text-sm bg-[var(--surface)] border border-[var(--border)] rounded-md resize-none"
        />

        {/* Assignee field */}
        <div className="relative" ref={suggestionsRef}>
          <label className="text-[10px] text-[var(--text-secondary)]">{t('todo.assignee')}</label>
          <div className="relative mt-0.5">
            <User size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
            <input
              type="text"
              value={assigneeName}
              onChange={(e) => { setAssigneeName(e.target.value); setShowSuggestions(true); }}
              onFocus={() => setShowSuggestions(true)}
              placeholder={t('todo.assigneePlaceholder')}
              className="w-full pl-7 pr-2.5 py-1.5 text-sm bg-[var(--surface)] border border-[var(--border)] rounded-md"
            />
          </div>
          {showSuggestions && filteredSuggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-0.5 z-30 bg-[var(--bg)] border border-[var(--border)] rounded-md shadow-lg max-h-28 overflow-y-auto">
              {filteredSuggestions.map(name => (
                <button
                  key={name}
                  type="button"
                  onClick={() => { setAssigneeName(name); setShowSuggestions(false); }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] hover:bg-[var(--surface)] text-left"
                >
                  <User size={12} className="text-[var(--text-secondary)]" />
                  {name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as Todo['priority'])}
            className="flex-1 px-2.5 py-1.5 text-sm bg-[var(--surface)] border border-[var(--border)] rounded-md"
          >
            <option value="low">{t('todo.priority.low')}</option>
            <option value="medium">{t('todo.priority.medium')}</option>
            <option value="high">{t('todo.priority.high')}</option>
            <option value="urgent">{t('todo.priority.urgent')}</option>
          </select>

          <div className="flex-1">
            <label className="text-[10px] text-[var(--text-secondary)]">{t('todo.dueDate')}</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-2.5 py-1.5 text-sm bg-[var(--surface)] border border-[var(--border)] rounded-md"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={!title.trim()}
          className="w-full py-1.5 text-sm font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] rounded-md disabled:opacity-40 transition-colors"
        >
          {existingTodo ? t('todo.update') : t('todo.add')}
        </button>
      </form>
    </div>
  );
}
