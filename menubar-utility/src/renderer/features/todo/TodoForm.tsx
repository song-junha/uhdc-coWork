import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useI18n } from '../../hooks/useI18n';
import { useTodoStore } from './useTodoStore';
import AssigneeSelector, { type SelectedAssignee } from '../../components/AssigneeSelector';
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
  const [selectedAssignees, setSelectedAssignees] = useState<SelectedAssignee[]>(() => {
    if (existingTodo?.assigneeName) {
      return [{ jiraAccountId: existingTodo.assigneeId ?? '', displayName: existingTodo.assigneeName }];
    }
    return [];
  });

  const isEdit = !!existingTodo;

  useEffect(() => {
    if (existingTodo) {
      setTitle(existingTodo.title);
      setDescription(existingTodo.description);
      setPriority(existingTodo.priority);
      setDueDate(existingTodo.dueDate ?? '');
      if (existingTodo.assigneeName) {
        setSelectedAssignees([{
          jiraAccountId: existingTodo.assigneeId ?? '',
          displayName: existingTodo.assigneeName,
        }]);
      } else {
        setSelectedAssignees([]);
      }
    }
  }, [existingTodo]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    if (isEdit) {
      const assignee = selectedAssignees[0];
      await updateTodo(existingTodo.id, {
        title: title.trim(),
        description,
        priority,
        dueDate: dueDate || null,
        assigneeName: assignee?.displayName ?? '',
        assigneeId: assignee?.jiraAccountId || null,
      });
    } else {
      // Bulk creation: one todo per selected assignee (or one with no assignee)
      const assignees = selectedAssignees.length > 0 ? selectedAssignees : [null];
      for (const assignee of assignees) {
        await createTodo({
          title: title.trim(),
          description,
          priority,
          dueDate: dueDate || undefined,
          assigneeName: assignee?.displayName || undefined,
          assigneeId: assignee?.jiraAccountId || undefined,
        });
      }
    }

    onClose();
  };

  const bulkCount = selectedAssignees.length;
  const showBulkLabel = !isEdit && bulkCount >= 2;

  return (
    <div className="absolute inset-x-0 bottom-0 bg-[var(--bg)] border-t border-[var(--border)] p-3 shadow-lg z-10">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold">
          {isEdit ? t('todo.edit') : t('todo.new')}
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
        <AssigneeSelector
          mode={isEdit ? 'single' : 'multi'}
          selected={selectedAssignees}
          onChange={setSelectedAssignees}
        />

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
          {isEdit
            ? t('todo.update')
            : showBulkLabel
              ? t('todo.addBulk', { count: bulkCount })
              : t('todo.add')
          }
        </button>
      </form>
    </div>
  );
}
