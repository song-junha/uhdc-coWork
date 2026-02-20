export interface MemoFolder {
  id: string;
  parentId: string | null;
  name: string;
  sortOrder: number;
  isExpanded: boolean;
  createdAt: string;
  children?: MemoFolder[];
}

export interface Memo {
  id: string;
  folderId: string;
  title: string;
  content: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFolderDto {
  parentId?: string;
  name: string;
}

export interface UpdateFolderDto {
  name?: string;
  parentId?: string;
  isExpanded?: boolean;
}

export interface CreateMemoDto {
  folderId: string;
  title: string;
  content?: string;
}

export interface UpdateMemoDto {
  title?: string;
  content?: string;
  folderId?: string;
}
