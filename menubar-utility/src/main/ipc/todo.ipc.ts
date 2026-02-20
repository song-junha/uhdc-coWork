import { ipcMain } from 'electron';
import * as todoRepo from '../db/todo.repo';
import type { CreateTodoDto, UpdateTodoDto, TodoFilter } from '../../shared/types/todo.types';

export function registerTodoHandlers(): void {
  ipcMain.handle('todo:getAll', (_event, filter: TodoFilter) => {
    return todoRepo.getAllTodos(filter);
  });

  ipcMain.handle('todo:create', (_event, data: CreateTodoDto) => {
    return todoRepo.createTodo(data);
  });

  ipcMain.handle('todo:update', (_event, id: string, data: UpdateTodoDto) => {
    return todoRepo.updateTodo(id, data);
  });

  ipcMain.handle('todo:delete', (_event, id: string) => {
    todoRepo.deleteTodo(id);
  });

  ipcMain.handle('todo:reorder', (_event, ids: string[]) => {
    todoRepo.reorderTodos(ids);
  });

  ipcMain.handle('todo:getRecentAssignees', () => {
    return todoRepo.getRecentAssignees();
  });
}
