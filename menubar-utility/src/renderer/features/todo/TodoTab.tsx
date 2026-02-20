import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { useI18n } from '../../hooks/useI18n';
import { useTodoStore } from './useTodoStore';
import { useTeamStore } from '../team/useTeamStore';
import TodoItem from './TodoItem';
import TodoForm from './TodoForm';
import type { TranslationKey } from '../../../shared/i18n';
import type { TodoFilter } from '../../../shared/types/todo.types';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';

const statusTabs: { value: string; labelKey: TranslationKey }[] = [
  { value: 'all', labelKey: 'todo.filter.all' },
  { value: 'todo', labelKey: 'todo.filter.todo' },
  { value: 'in_progress', labelKey: 'todo.filter.inProgress' },
  { value: 'done', labelKey: 'todo.filter.done' },
];

const scopeTabs: { value: TodoFilter['scope']; labelKey: TranslationKey }[] = [
  { value: 'personal', labelKey: 'todo.scope.personal' },
  { value: 'team', labelKey: 'todo.scope.team' },
  { value: 'group', labelKey: 'todo.scope.group' },
];

export default function TodoTab() {
  const { t } = useI18n();
  const { todos, filter, isLoading, editingId, fetchTodos, setFilter, setEditingId, reorderTodos } = useTodoStore();
  const { teams, user } = useTeamStore();
  const [showForm, setShowForm] = useState(false);

  const teamOptions = teams.filter(te => te.type === 'default' && !te.isArchived);
  const groupOptions = teams.filter(te => te.type === 'spot' && !te.isArchived);

  useEffect(() => {
    fetchTodos();
  }, []);

  useEffect(() => {
    const handleNewItem = () => setShowForm(true);
    window.addEventListener('app:new-item', handleNewItem);
    return () => window.removeEventListener('app:new-item', handleNewItem);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = todos.findIndex(t => t.id === active.id);
    const newIndex = todos.findIndex(t => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(todos, oldIndex, newIndex);
    reorderTodos(reordered.map(t => t.id));
  };

  const editingTodo = editingId ? todos.find(t => t.id === editingId) : undefined;

  return (
    <div className="flex flex-col h-full relative">
      {/* Scope selector */}
      {user && (
        <div className="flex items-center gap-1 px-3 pt-2 pb-1">
          {scopeTabs.map(tab => (
            <button
              key={tab.value}
              onClick={() => setFilter({ scope: tab.value, teamId: undefined })}
              className={`px-2 py-0.5 text-[10px] font-medium rounded-full transition-colors ${
                filter.scope === tab.value
                  ? 'bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/30'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--surface)]'
              }`}
            >
              {t(tab.labelKey)}
            </button>
          ))}
          {/* Team/Group dropdown */}
          {(filter.scope === 'team' || filter.scope === 'group') && (
            <select
              value={filter.teamId ?? ''}
              onChange={(e) => setFilter({ teamId: e.target.value || undefined })}
              className="ml-auto text-[10px] bg-[var(--surface)] border border-[var(--border)] rounded px-1 py-0.5 text-[var(--text)]"
            >
              <option value="">-</option>
              {(filter.scope === 'team' ? teamOptions : groupOptions).map(te => (
                <option key={te.id} value={te.id}>{te.name}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Status filter tabs */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-[var(--border)]">
        {statusTabs.map(tab => (
          <button
            key={tab.value}
            onClick={() => setFilter({ status: tab.value as any })}
            className={`px-2.5 py-1 text-[11px] font-medium rounded-full transition-colors ${
              filter.status === tab.value
                ? 'bg-[var(--primary)] text-white'
                : 'text-[var(--text-secondary)] hover:bg-[var(--surface)]'
            }`}
          >
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      {/* Todo list */}
      <div className="flex-1 overflow-y-auto px-1 py-1">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-[var(--text-secondary)]">
            {t('common.loading')}
          </div>
        ) : todos.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-[var(--text-secondary)]">
            <p className="text-sm">{t('todo.empty')}</p>
            <p className="text-[11px]">{t('todo.emptyHint')}</p>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={todos.map(t => t.id)} strategy={verticalListSortingStrategy}>
              {todos.map(todo => (
                <TodoItem key={todo.id} todo={todo} />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Add button */}
      {!showForm && !editingId && (
        <button
          onClick={() => setShowForm(true)}
          className="absolute bottom-3 right-3 w-10 h-10 flex items-center justify-center bg-[var(--primary)] text-white rounded-full shadow-lg hover:bg-[var(--primary-hover)] transition-colors"
        >
          <Plus size={20} />
        </button>
      )}

      {/* Form */}
      {(showForm || editingId) && (
        <TodoForm
          existingTodo={editingTodo}
          onClose={() => {
            setShowForm(false);
            setEditingId(null);
          }}
        />
      )}
    </div>
  );
}
