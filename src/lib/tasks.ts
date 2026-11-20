// Sorts tasks into the Today / Overdue / Upcoming / Done tabs. Shared by the Tasks page and its CSV export.
export const TASK_TABS = ["today", "overdue", "upcoming", "done"] as const;
export type TaskTab = (typeof TASK_TABS)[number];

export function bucketTasks<T extends { due_at: string; done: boolean }>(all: T[], dayStart: number): Record<TaskTab, T[]> {
  const dayEnd = dayStart + 86_400_000;
  const due = (t: T) => new Date(t.due_at).getTime();
  const open = all.filter((t) => !t.done);
  return {
    today: open.filter((t) => due(t) >= dayStart && due(t) < dayEnd),
    overdue: open.filter((t) => due(t) < dayStart),
    upcoming: open.filter((t) => due(t) >= dayEnd),
    done: all.filter((t) => t.done).reverse(),
  };
}
