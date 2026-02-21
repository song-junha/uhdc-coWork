import { useState } from 'react';
import { cn } from '../../lib/utils';
import { Circle, CheckCircle2, Clock, Trash2, GripVertical } from 'lucide-react';
import type { Todo } from '../../../shared/types/todo.types';
import { useTodoStore } from './useTodoStore';
import { useI18n } from '../../hooks/useI18n';
import type { TranslationKey } from '../../../shared/i18n';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import ConfirmDialog from '../../components/ConfirmDialog';

const priorityColors = {
  low: 'text-[var(--text-secondary)] bg-[var(--text-secondary)]/10',
  medium: 'text-[var(--primary)] bg-[var(--primary)]/10',
  high: 'text-[var(--warning)] bg-[var(--warning)]/10',
  urgent: 'text-[var(--danger)] bg-[var(--danger)]/10',
};

const priorityLabelKeys: Record<Todo['priority'], TranslationKey> = {
  low: 'todo.priority.low',
  medium: 'todo.priority.medium',
  high: 'todo.priority.high',
  urgent: 'todo.priority.urgent',
};

interface TodoItemProps {
  todo: Todo;
}

export default function TodoItem({ todo }: TodoItemProps) {
  const { updateTodo, deleteTodo, setEditingId } = useTodoStore();
  const { t } = useI18n();
  const [showConfirm, setShowConfirm] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: todo.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
    zIndex: isDragging ? 10 : undefined,
  };

  const toggleStatus = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next: Record<Todo['status'], Todo['status']> = {
      todo: 'in_progress',
      in_progress: 'done',
      done: 'todo',
    };
    updateTodo(todo.id, { status: next[todo.status] });
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowConfirm(true);
  };

  const isDone = todo.status === 'done';
  const isInProgress = todo.status === 'in_progress';

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={() => setEditingId(todo.id)}
      className={cn(
        'group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors',
        'hover:bg-[var(--surface)]',
        isDone && 'opacity-50'
      )}
    >
      <div {...attributes} {...listeners} className="touch-none">
        <GripVertical size={14} className="text-[var(--border)] opacity-0 group-hover:opacity-100 cursor-grab" />
      </div>

      <button onClick={toggleStatus} className="shrink-0">
        {isDone ? (
          <CheckCircle2 size={18} className="text-[var(--success)]" />
        ) : isInProgress ? (
          <Clock size={18} className="text-[var(--primary)]" />
        ) : (
          <Circle size={18} className="text-[var(--border)] hover:text-[var(--primary)]" />
        )}
      </button>

      <div className="flex-1 min-w-0">
        <p className={cn('text-sm truncate', isDone && 'line-through')}>
          {todo.title}
        </p>
        <div className="flex items-center gap-2">
          {todo.assigneeName && (
            <span className="text-[10px] text-[var(--primary)]">@{todo.assigneeName}</span>
          )}
          {todo.dueDate && (
            <span className={cn(
              'text-[11px]',
              !isDone && todo.dueDate < new Date().toISOString().split('T')[0]
                ? 'text-[var(--danger)] font-semibold'
                : 'text-[var(--text-secondary)]'
            )}>
              {todo.dueDate}
            </span>
          )}
          <span className={cn('text-[10px] font-semibold px-1 py-0.5 rounded', priorityColors[todo.priority])}>
            {t(priorityLabelKeys[todo.priority])}
          </span>
        </div>
      </div>

      <button
        onClick={handleDelete}
        className="opacity-0 group-hover:opacity-100 text-[var(--text-secondary)] hover:text-[var(--danger)] transition-opacity"
      >
        <Trash2 size={14} />
      </button>

      {showConfirm && (
        <ConfirmDialog
          onConfirm={() => { deleteTodo(todo.id); setShowConfirm(false); }}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </div>
  );
}
