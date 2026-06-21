export type Member = { id: string; name: string; email?: string; color: string; role?: string };
export type TagT = { id: string; name: string; color: string };
export type StatusT = { id: string; name: string; color: string; order: number; type: string };

export type TaskT = {
  id: string;
  name: string;
  description?: string | null;
  priority?: string | null;
  dueDate?: string | null;
  dateClosed?: string | null;
  order: number;
  statusId?: string | null;
  status?: StatusT | null;
  listId: string;
  assignees: Member[];
  tags: TagT[];
  _count?: { subtasks: number; comments: number; subtasksDone?: number };
};

export type ListDetail = {
  id: string;
  name: string;
  space?: { id: string; name: string; color: string } | null;
  folder?: { id: string; name: string } | null;
  statuses: StatusT[];
  tasks: TaskT[];
};

export type AttachmentT = {
  id: string;
  filename: string;
  mime: string;
  size: number;
  createdAt: string;
};

export type SubtaskT = {
  id: string;
  name: string;
  statusId?: string | null;
  status?: StatusT | null;
  assignees: Member[];
};

export type ListLite = { id: string; name: string; _count?: { tasks: number }; private?: boolean; members?: { id: string }[] };
export type FolderT = { id: string; name: string; lists: ListLite[] };
export type SpaceT = { id: string; name: string; color: string; folders: FolderT[]; lists: ListLite[]; private?: boolean; members?: { id: string }[] };
export type WorkspaceT = { id: string; name: string; companyId?: string | null; spaces: SpaceT[] };
