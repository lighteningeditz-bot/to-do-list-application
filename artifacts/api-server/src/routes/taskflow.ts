import { getAuth } from "@clerk/express";
import {
  and,
  asc,
  count,
  eq,
  gte,
  ilike,
  lt,
  or,
  sql,
} from "drizzle-orm";
import { Router, type IRouter, type Request, type Response } from "express";
import {
  CreateListBody,
  CreateListResponse,
  CreateTaskBody,
  CreateTaskResponse,
  DeleteAccountDataResponse,
  DeleteListParams,
  DeleteListResponse,
  DeleteTaskParams,
  DeleteTaskResponse,
  DuplicateTaskParams,
  DuplicateTaskResponse,
  GetDashboardResponse,
  GetListsResponse,
  GetProfileResponse,
  GetTasksQueryParams,
  GetTasksResponse,
  GetWeeklyProgressResponse,
  ImportTasksBody,
  ImportTasksResponse,
  UpdateListBody,
  UpdateListParams,
  UpdateListResponse,
  UpdateProfileBody,
  UpdateProfileResponse,
  UpdateTaskBody,
  UpdateTaskParams,
  UpdateTaskResponse,
} from "@workspace/api-zod";
import {
  db,
  taskflowListsTable,
  taskflowProfilesTable,
  taskflowTasksTable,
} from "@workspace/db";

const router: IRouter = Router();

type UserRequest = Request & { taskflowUserId?: string };

function getUserId(req: Request): string | undefined {
  return getAuth(req).userId ?? undefined;
}

function requireUser(req: Request, res: Response, next: (error?: unknown) => void): void {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Sign in to access your saved TaskFlow data." });
    return;
  }
  (req as UserRequest).taskflowUserId = userId;
  next();
}

function getRequestUserId(req: Request): string {
  const userId = (req as UserRequest).taskflowUserId;
  if (!userId) {
    throw new Error("Authenticated TaskFlow user id is missing.");
  }
  return userId;
}

function taskResponse(row: typeof taskflowTasksTable.$inferSelect) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    dueAt: row.dueAt?.toISOString() ?? null,
    priority: row.priority,
    status: row.status,
    listId: row.listId,
    tags: row.tags,
    subtasks: row.subtasks,
    recurrence: row.recurrence,
    reminderAt: row.reminderAt?.toISOString() ?? null,
    estimatedMinutes: row.estimatedMinutes,
    archived: row.archived,
    position: row.position,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
  };
}

function parseIso(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
}

async function hasOwnedList(ownerId: string, listId: string): Promise<boolean> {
  const [list] = await db
    .select({ id: taskflowListsTable.id })
    .from(taskflowListsTable)
    .where(and(eq(taskflowListsTable.ownerId, ownerId), eq(taskflowListsTable.id, listId)))
    .limit(1);
  return Boolean(list);
}

router.use(requireUser, async (req, _res, next): Promise<void> => {
  const id = getRequestUserId(req);
  await db
    .insert(taskflowProfilesTable)
    .values({ id })
    .onConflictDoNothing({ target: taskflowProfilesTable.id });
  next();
});

router.get("/profile", async (req, res): Promise<void> => {
  const id = getRequestUserId(req);
  const [profile] = await db
    .select()
    .from(taskflowProfilesTable)
    .where(eq(taskflowProfilesTable.id, id))
    .limit(1);
  if (!profile) {
    res.status(500).json({ error: "Unable to initialize your profile." });
    return;
  }
  res.json(
    GetProfileResponse.parse({
      ...profile,
      updatedAt: profile.updatedAt.toISOString(),
    }),
  );
});

router.patch("/profile", async (req, res): Promise<void> => {
  const body = UpdateProfileBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const id = getRequestUserId(req);
  const [profile] = await db
    .update(taskflowProfilesTable)
    .set(body.data)
    .where(eq(taskflowProfilesTable.id, id))
    .returning();
  if (!profile) {
    res.status(404).json({ error: "Profile not found." });
    return;
  }
  res.json(
    UpdateProfileResponse.parse({
      ...profile,
      updatedAt: profile.updatedAt.toISOString(),
    }),
  );
});

router.get("/lists", async (req, res): Promise<void> => {
  const ownerId = getRequestUserId(req);
  const lists = await db
    .select({
      id: taskflowListsTable.id,
      name: taskflowListsTable.name,
      color: taskflowListsTable.color,
      icon: taskflowListsTable.icon,
      position: taskflowListsTable.position,
      taskCount: count(taskflowTasksTable.id),
    })
    .from(taskflowListsTable)
    .leftJoin(
      taskflowTasksTable,
      and(
        eq(taskflowTasksTable.listId, taskflowListsTable.id),
        eq(taskflowTasksTable.ownerId, ownerId),
      ),
    )
    .where(eq(taskflowListsTable.ownerId, ownerId))
    .groupBy(taskflowListsTable.id)
    .orderBy(asc(taskflowListsTable.position));
  res.json(GetListsResponse.parse(lists));
});

router.post("/lists", async (req, res): Promise<void> => {
  const body = CreateListBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [list] = await db
    .insert(taskflowListsTable)
    .values({ ...body.data, ownerId: getRequestUserId(req) })
    .returning();
  const result = CreateListResponse.parse({ ...list, taskCount: 0 });
  res.status(201).json(result);
});

router.patch("/lists/:listId", async (req, res): Promise<void> => {
  const params = UpdateListParams.safeParse(req.params);
  const body = UpdateListBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const ownerId = getRequestUserId(req);
  const [list] = await db
    .update(taskflowListsTable)
    .set(body.data)
    .where(
      and(
        eq(taskflowListsTable.id, params.data.listId),
        eq(taskflowListsTable.ownerId, ownerId),
      ),
    )
    .returning();
  if (!list) {
    res.status(404).json({ error: "Category not found." });
    return;
  }
  const [taskCount] = await db
    .select({ value: count() })
    .from(taskflowTasksTable)
    .where(eq(taskflowTasksTable.listId, list.id));
  res.json(UpdateListResponse.parse({ ...list, taskCount: taskCount?.value ?? 0 }));
});

router.delete("/lists/:listId", async (req, res): Promise<void> => {
  const params = DeleteListParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const ownerId = getRequestUserId(req);
  const [list] = await db
    .delete(taskflowListsTable)
    .where(
      and(
        eq(taskflowListsTable.id, params.data.listId),
        eq(taskflowListsTable.ownerId, ownerId),
      ),
    )
    .returning({ id: taskflowListsTable.id });
  if (!list) {
    res.status(404).json({ error: "Category not found." });
    return;
  }
  res.status(204).json(DeleteListResponse.parse(undefined));
});

router.get("/tasks", async (req, res): Promise<void> => {
  const params = GetTasksQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const ownerId = getRequestUserId(req);
  const offset = params.data.offset ?? 0;
  const limit = params.data.limit ?? 50;
  const filters = [eq(taskflowTasksTable.ownerId, ownerId)];
  if (params.data.listId) {
    filters.push(eq(taskflowTasksTable.listId, params.data.listId));
  }
  if (params.data.status) {
    filters.push(eq(taskflowTasksTable.status, params.data.status));
  }
  if (params.data.priority) {
    filters.push(eq(taskflowTasksTable.priority, params.data.priority));
  }
  if (params.data.archived !== undefined) {
    filters.push(eq(taskflowTasksTable.archived, params.data.archived));
  } else {
    filters.push(eq(taskflowTasksTable.archived, false));
  }
  if (params.data.search?.trim()) {
    const pattern = `%${params.data.search.trim()}%`;
    filters.push(
      or(
        ilike(taskflowTasksTable.title, pattern),
        ilike(taskflowTasksTable.description, pattern),
      )!,
    );
  }
  if (params.data.date) {
    const start = new Date(`${params.data.date}T00:00:00.000Z`);
    const end = new Date(start.getTime() + 86_400_000);
    filters.push(gte(taskflowTasksTable.dueAt, start), lt(taskflowTasksTable.dueAt, end));
  }
  if (params.data.overdue) {
    filters.push(
      lt(taskflowTasksTable.dueAt, new Date()),
      or(
        eq(taskflowTasksTable.status, "todo"),
        eq(taskflowTasksTable.status, "in_progress"),
      )!,
    );
  }
  const condition = and(...filters);
  const [total] = await db
    .select({ value: count() })
    .from(taskflowTasksTable)
    .where(condition);
  const items = await db
    .select()
    .from(taskflowTasksTable)
    .where(condition)
    .orderBy(asc(taskflowTasksTable.position), asc(taskflowTasksTable.createdAt))
    .limit(limit)
    .offset(offset);
  res.json(
    GetTasksResponse.parse({
      items: items.map(taskResponse),
      total: total?.value ?? 0,
      offset,
      limit,
    }),
  );
});

router.post("/tasks", async (req, res): Promise<void> => {
  const body = CreateTaskBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const ownerId = getRequestUserId(req);
  if (body.data.listId && !(await hasOwnedList(ownerId, body.data.listId))) {
    res.status(400).json({ error: "Choose one of your own categories." });
    return;
  }
  const [task] = await db
    .insert(taskflowTasksTable)
    .values({
      ...body.data,
      ownerId,
      dueAt: parseIso(body.data.dueAt),
      reminderAt: parseIso(body.data.reminderAt),
      completedAt: body.data.status === "done" ? new Date() : null,
    })
    .returning();
  res.status(201).json(CreateTaskResponse.parse(taskResponse(task)));
});

router.patch("/tasks/:taskId", async (req, res): Promise<void> => {
  const params = UpdateTaskParams.safeParse(req.params);
  const body = UpdateTaskBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const ownerId = getRequestUserId(req);
  if (body.data.listId && !(await hasOwnedList(ownerId, body.data.listId))) {
    res.status(400).json({ error: "Choose one of your own categories." });
    return;
  }
  const updates: Partial<typeof taskflowTasksTable.$inferInsert> = {};
  const data = body.data;
  if ("title" in data) updates.title = data.title;
  if ("description" in data) updates.description = data.description;
  if ("dueAt" in data) updates.dueAt = parseIso(data.dueAt);
  if ("priority" in data) updates.priority = data.priority;
  if ("status" in data) {
    updates.status = data.status;
    updates.completedAt = data.status === "done" ? new Date() : null;
  }
  if ("listId" in data) updates.listId = data.listId;
  if ("tags" in data) updates.tags = data.tags;
  if ("subtasks" in data) updates.subtasks = data.subtasks;
  if ("recurrence" in data) updates.recurrence = data.recurrence;
  if ("reminderAt" in data) updates.reminderAt = parseIso(data.reminderAt);
  if ("estimatedMinutes" in data) updates.estimatedMinutes = data.estimatedMinutes;
  if ("archived" in data) updates.archived = data.archived;
  if ("position" in data) updates.position = data.position;
  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "Add at least one field to update." });
    return;
  }
  const [task] = await db
    .update(taskflowTasksTable)
    .set(updates)
    .where(
      and(
        eq(taskflowTasksTable.id, params.data.taskId),
        eq(taskflowTasksTable.ownerId, ownerId),
      ),
    )
    .returning();
  if (!task) {
    res.status(404).json({ error: "Task not found." });
    return;
  }
  res.json(UpdateTaskResponse.parse(taskResponse(task)));
});

router.delete("/tasks/:taskId", async (req, res): Promise<void> => {
  const params = DeleteTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [task] = await db
    .delete(taskflowTasksTable)
    .where(
      and(
        eq(taskflowTasksTable.id, params.data.taskId),
        eq(taskflowTasksTable.ownerId, getRequestUserId(req)),
      ),
    )
    .returning({ id: taskflowTasksTable.id });
  if (!task) {
    res.status(404).json({ error: "Task not found." });
    return;
  }
  res.status(204).json(DeleteTaskResponse.parse(undefined));
});

router.post("/tasks/:taskId/duplicate", async (req, res): Promise<void> => {
  const params = DuplicateTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const ownerId = getRequestUserId(req);
  const [original] = await db
    .select()
    .from(taskflowTasksTable)
    .where(
      and(
        eq(taskflowTasksTable.id, params.data.taskId),
        eq(taskflowTasksTable.ownerId, ownerId),
      ),
    )
    .limit(1);
  if (!original) {
    res.status(404).json({ error: "Task not found." });
    return;
  }
  const [copy] = await db
    .insert(taskflowTasksTable)
    .values({
      ownerId,
      listId: original.listId,
      title: `${original.title} (copy)`,
      description: original.description,
      dueAt: original.dueAt,
      priority: original.priority,
      status: "todo",
      tags: original.tags,
      subtasks: original.subtasks,
      recurrence: original.recurrence,
      reminderAt: original.reminderAt,
      estimatedMinutes: original.estimatedMinutes,
      archived: false,
      position: original.position + 1,
      completedAt: null,
    })
    .returning();
  res.status(201).json(DuplicateTaskResponse.parse(taskResponse(copy)));
});

router.post("/tasks/import", async (req, res): Promise<void> => {
  const body = ImportTasksBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const ownerId = getRequestUserId(req);
  const lists = await db
    .select({ id: taskflowListsTable.id, name: taskflowListsTable.name })
    .from(taskflowListsTable)
    .where(eq(taskflowListsTable.ownerId, ownerId));
  const listIds = new Map(lists.map((list) => [list.name.toLocaleLowerCase(), list.id]));
  const imported = await db
    .insert(taskflowTasksTable)
    .values(
      body.data.items.map((item, position) => ({
        ownerId,
        title: item.title,
        description: item.description ?? null,
        dueAt: parseIso(item.dueAt),
        priority: item.priority ?? "medium",
        status: "todo",
        listId: item.listName
          ? (listIds.get(item.listName.toLocaleLowerCase()) ?? null)
          : null,
        tags: item.tags ?? [],
        subtasks: [],
        recurrence: "none",
        reminderAt: null,
        estimatedMinutes: null,
        archived: false,
        position,
      })),
    )
    .returning();
  res.status(201).json(
    ImportTasksResponse.parse(imported.map(taskResponse)),
  );
});

router.get("/dashboard", async (req, res): Promise<void> => {
  const ownerId = getRequestUserId(req);
  const now = new Date();
  const todayStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const tomorrowStart = new Date(todayStart.getTime() + 86_400_000);
  const weekStart = new Date(todayStart);
  weekStart.setUTCDate(todayStart.getUTCDate() - ((todayStart.getUTCDay() + 6) % 7));
  const [todayTotal] = await db
    .select({ value: count() })
    .from(taskflowTasksTable)
    .where(
      and(
        eq(taskflowTasksTable.ownerId, ownerId),
        gte(taskflowTasksTable.dueAt, todayStart),
        lt(taskflowTasksTable.dueAt, tomorrowStart),
        eq(taskflowTasksTable.archived, false),
      ),
    );
  const [todayCompleted] = await db
    .select({ value: count() })
    .from(taskflowTasksTable)
    .where(
      and(
        eq(taskflowTasksTable.ownerId, ownerId),
        gte(taskflowTasksTable.completedAt, todayStart),
        lt(taskflowTasksTable.completedAt, tomorrowStart),
      ),
    );
  const [overdueCount] = await db
    .select({ value: count() })
    .from(taskflowTasksTable)
    .where(
      and(
        eq(taskflowTasksTable.ownerId, ownerId),
        lt(taskflowTasksTable.dueAt, now),
        or(
          eq(taskflowTasksTable.status, "todo"),
          eq(taskflowTasksTable.status, "in_progress"),
        ),
        eq(taskflowTasksTable.archived, false),
      ),
    );
  const [completedThisWeek] = await db
    .select({ value: count() })
    .from(taskflowTasksTable)
    .where(
      and(
        eq(taskflowTasksTable.ownerId, ownerId),
        gte(taskflowTasksTable.completedAt, weekStart),
      ),
    );
  const completedDays = await db
    .select({
      day: sql<string>`to_char(${taskflowTasksTable.completedAt}, 'YYYY-MM-DD')`,
    })
    .from(taskflowTasksTable)
    .where(
      and(
        eq(taskflowTasksTable.ownerId, ownerId),
        gte(taskflowTasksTable.completedAt, new Date(todayStart.getTime() - 30 * 86_400_000)),
      ),
    )
    .groupBy(sql`to_char(${taskflowTasksTable.completedAt}, 'YYYY-MM-DD')`);
  const completedSet = new Set(completedDays.map(({ day }) => day));
  let streak = 0;
  for (let daysAgo = 0; daysAgo < 30; daysAgo += 1) {
    const date = new Date(todayStart.getTime() - daysAgo * 86_400_000);
    if (!completedSet.has(date.toISOString().slice(0, 10))) break;
    streak += 1;
  }
  res.json(
    GetDashboardResponse.parse({
      todayTotal: todayTotal?.value ?? 0,
      todayCompleted: todayCompleted?.value ?? 0,
      overdueCount: overdueCount?.value ?? 0,
      completedThisWeek: completedThisWeek?.value ?? 0,
      streak,
    }),
  );
});

router.get("/dashboard/weekly", async (req, res): Promise<void> => {
  const ownerId = getRequestUserId(req);
  const today = new Date();
  const end = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 1),
  );
  const start = new Date(end.getTime() - 7 * 86_400_000);
  const rows = await db
    .select({
      date: sql<string>`to_char(${taskflowTasksTable.completedAt}, 'YYYY-MM-DD')`,
      completed: count(),
    })
    .from(taskflowTasksTable)
    .where(
      and(
        eq(taskflowTasksTable.ownerId, ownerId),
        gte(taskflowTasksTable.completedAt, start),
        lt(taskflowTasksTable.completedAt, end),
      ),
    )
    .groupBy(sql`to_char(${taskflowTasksTable.completedAt}, 'YYYY-MM-DD')`);
  const countsByDate = new Map(rows.map((row) => [row.date, row.completed]));
  const result = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start.getTime() + index * 86_400_000);
    const date = day.toISOString().slice(0, 10);
    return { date, completed: countsByDate.get(date) ?? 0 };
  });
  res.json(GetWeeklyProgressResponse.parse(result));
});

router.delete("/account", async (req, res): Promise<void> => {
  const [profile] = await db
    .delete(taskflowProfilesTable)
    .where(eq(taskflowProfilesTable.id, getRequestUserId(req)))
    .returning({ id: taskflowProfilesTable.id });
  if (!profile) {
    res.status(404).json({ error: "TaskFlow account data not found." });
    return;
  }
  res.status(204).json(DeleteAccountDataResponse.parse(undefined));
});

export default router;