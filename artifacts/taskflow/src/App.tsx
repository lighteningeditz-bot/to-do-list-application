import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ClerkProvider, SignIn, SignUp, Show, useClerk, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  Activity, ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, BriefcaseBusiness,
  CalendarDays, Check, CheckCheck, CheckCircle2, Circle, Clock3, Columns3,
  Download, FileUp, Flame, Folder, GraduationCap, Grid2X2, LayoutDashboard, List,
  LoaderCircle, LogOut, Menu, Moon, MoreHorizontal, Pencil, Plus, Search, Settings, ShieldCheck,
  Sparkles, Sun, Trash2, TrendingUp, UserRound, WandSparkles, X, Zap,
} from 'lucide-react';
import {
  getGetDashboardQueryKey, getGetListsQueryKey, getGetProfileQueryKey, getGetTasksQueryKey,
  getGetWeeklyProgressQueryKey, useCreateList, useCreateTask, useDeleteAccountData,
  useDeleteList, useDeleteTask, useDuplicateTask, useGetDashboard, useGetLists,
  useGetProfile, useGetTasks, useGetWeeklyProgress, useImportTasks, useSubmitFeedback,
  useUpdateList, useUpdateProfile, useUpdateTask,
} from '@workspace/api-client-react';
import type { DailyProgress, DashboardSummary, Profile, Task, TaskInput, TaskList, TaskListInput } from '@workspace/api-client-react';
import { Redirect, Route, Switch, Router as WouterRouter, Link, useLocation } from 'wouter';
import './index.css';
import { roleTemplates, type StarterList, type StarterTask } from './data/roleTemplates';

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
function stripBase(path: string) { return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path; }

type Role = NonNullable<Profile['role']>;
type LocalState = { version: 1; profile: Profile; lists: TaskList[]; tasks: Task[] };
const STORE_KEY = 'taskflow.guest.v1';
const nowISO = () => new Date().toISOString();
const newId = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const initialProfile = (): Profile => ({ id: 'guest', role: null, customRole: null, theme: 'system', accentColor: 'violet', weekStartsOn: 1, dailyStartTime: '09:00', workHours: 8, updatedAt: nowISO() });
const ROLE_NAMES: Record<Role, string> = { school: 'School student', college: 'College student', professional: 'Professional', freelancer: 'Freelancer', developer: 'Developer', teacher: 'Teacher', personal: 'Personal', other: 'Other' };
const roleKeys = Object.keys(ROLE_NAMES) as Role[];
const ICONS: Record<string, typeof BookOpen> = { book: BookOpen, graduation: GraduationCap, briefcase: BriefcaseBusiness, calendar: CalendarDays, folder: Folder, check: CheckCheck, sparkles: Sparkles, zap: Zap, heart: ShieldCheck };

function toStarterTaskInput(task: StarterTask, listId: string | null, position: number): TaskInput {
  return {
    title: task.title,
    description: task.description ?? null,
    dueAt: null,
    priority: task.priority,
    status: 'todo',
    listId,
    tags: task.tags,
    subtasks: [],
    recurrence: 'none',
    reminderAt: null,
    estimatedMinutes: task.estimatedMinutes ?? null,
    archived: false,
    position,
  };
}

function makeGuestStarterTasks(starters: StarterList[], lists: TaskList[]): Task[] {
  return starters.flatMap((starter, listIndex) => (starter.tasks ?? []).map((task, taskIndex) => ({
    ...toStarterTaskInput(task, lists[listIndex]?.id ?? null, taskIndex),
    id: newId(),
    createdAt: nowISO(),
    completedAt: null,
  })));
}

function useGuestStore() {
  const [state, setState] = useState<LocalState>(() => {
    try { const raw = localStorage.getItem(STORE_KEY); if (raw) { const parsed = JSON.parse(raw) as LocalState; if (parsed.version === 1) return parsed; } } catch { /* recover with a clean local workspace */ }
    return { version: 1, profile: initialProfile(), lists: [], tasks: [] };
  });
  const commit = (fn: (s: LocalState) => LocalState) => setState(current => {
    const next = fn(current); localStorage.setItem(STORE_KEY, JSON.stringify(next)); return next;
  });
  return { state, commit };
}

function Router() {
  return clerkPubKey ? <ClerkRoot /> : <GuestRoutes />;
}
function GuestRoutes() {
  return <Switch>
    <Route path="/" component={Landing} />
    <Route path="/sign-in/*?" component={AuthUnavailable} />
    <Route path="/sign-up/*?" component={AuthUnavailable} />
    <Route path="/app/:view?" component={GuestApp} />
    <Route path="/settings" component={GuestSettings} />
    <Route component={() => <Redirect to="/" />} />
  </Switch>;
}
function AuthUnavailable() {
  const [loc] = useLocation();
  return <div className="landing" style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 20 }}><div className="card" style={{ maxWidth: 450, padding: 30, textAlign: 'center' }}><div className="brand-mark" style={{ margin: '0 auto 15px' }}><ShieldCheck size={18} /></div><h1 className="page-title">{loc.startsWith('/sign-up') ? 'Keep your plans close.' : 'Welcome back.'}</h1><p className="subtle" style={{ lineHeight: 1.65 }}>Account sign-in is not configured in this environment yet. You can still use TaskFlow without an account, and your work stays in this browser.</p><Link className="button primary" href="/app" data-testid="link-continue-guest">Continue with guest mode <ArrowRight size={15} /></Link></div></div>;
}
function GuestSettings() {
  const { state, commit } = useGuestStore();
  return <SettingsPage model={state} isGuest saveProfile={patch => commit(s => ({ ...s, profile: { ...s.profile, ...patch, updatedAt: nowISO() } }))} saveModel={commit} />;
}
function SignedInSettings() {
  const profile = useGetProfile(); const lists = useGetLists(); const tasks = useGetTasks({ archived: false, limit: 100 });
  const updateProfile = useUpdateProfile(); const importTasks = useImportTasks(); const deleteAccount = useDeleteAccountData(); const createList = useCreateList();
  const { user } = useUser();
  const client = useQueryClient(); const [, setLocation] = useLocation();
  const model: LocalModel = { version: 1, profile: profile.data ?? initialProfile(), lists: lists.data ?? [], tasks: tasks.data?.items ?? [] };
  const refresh = () => { void client.invalidateQueries({ queryKey: getGetProfileQueryKey() }); void client.invalidateQueries({ queryKey: getGetListsQueryKey() }); void client.invalidateQueries({ queryKey: getGetTasksQueryKey() }); void client.invalidateQueries({ queryKey: getGetDashboardQueryKey() }); void client.invalidateQueries({ queryKey: getGetWeeklyProgressQueryKey() }); };
  return <SettingsPage model={model} isGuest={false} saveProfile={patch => updateProfile.mutate({ data: patch }, { onSuccess: () => { void client.invalidateQueries({ queryKey: getGetProfileQueryKey() }); }, onError: () => window.alert('Your settings could not be saved. Try again.') })} saveTemplate={(role, customRole, selected) => {
    updateProfile.mutate({ data: { role, customRole } }, { onSuccess: () => {
      const taskRows = selected.flatMap(item => (item.tasks ?? []).map(task => ({
        title: task.title,
        description: task.description ?? null,
        priority: task.priority,
        listName: item.name,
        tags: task.tags,
      })));
      void Promise.all(selected.map((item, position) => createList.mutateAsync({
        data: { name: item.name, color: item.color, icon: item.icon, position },
      }))).then(() => {
        if (taskRows.length) importTasks.mutate({ data: { items: taskRows } }, { onSuccess: refresh, onError: () => window.alert('Your lists were saved, but some sample tasks could not be added.') });
        else refresh();
      }).catch(() => window.alert('Your role was saved, but some starter lists could not be created.'));
    } });
  }} onImport={rows => importTasks.mutate({ data: { items: rows } }, { onSuccess: refresh, onError: () => window.alert('Import failed. Please check your file and try again.') })} onDeleteAccount={() => deleteAccount.mutate(undefined, {
    onSuccess: async () => {
      try {
        if (!user) throw new Error('The signed-in account could not be found.');
        await user.delete();
        client.clear();
        setLocation('/');
      } catch {
        window.alert('Your TaskFlow data was deleted, but your sign-in account could not be removed. Please sign in again and retry account deletion.');
      }
    },
    onError: () => window.alert('Account deletion failed. Please try again.'),
  })} loading={profile.isLoading || lists.isLoading || tasks.isLoading} saving={updateProfile.isPending || importTasks.isPending || deleteAccount.isPending} />;
}
type ImportRow = { title: string; description?: string | null; dueAt?: string | null; priority?: 'low' | 'medium' | 'high' | 'urgent'; listName?: string | null; tags?: string[] };
function SettingsPage({ model, isGuest, saveProfile, saveModel, saveTemplate, onImport, onDeleteAccount, loading = false, saving = false }: { model: LocalModel; isGuest: boolean; saveProfile: (patch: Partial<Profile>) => void; saveModel?: SaveModel; saveTemplate?: (role: Role | null, customRole: string | null, selected: StarterList[]) => void; onImport?: (rows: ImportRow[]) => void; onDeleteAccount?: () => void; loading?: boolean; saving?: boolean }) {
  const [tab, setTab] = useState('profile'); const [toast, setToast] = useState(''); const [, setLocation] = useLocation();
  const [roleModal, setRoleModal] = useState(false); const [listDialog, setListDialog] = useState<TaskList | null | false>(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const createListApi = useCreateList(); const updateListApi = useUpdateList(); const deleteListApi = useDeleteList(); const deleteAccount = useDeleteAccountData(); const client = useQueryClient();
  const refresh = () => { void client.invalidateQueries({ queryKey: getGetListsQueryKey() }); void client.invalidateQueries({ queryKey: getGetTasksQueryKey() }); void client.invalidateQueries({ queryKey: getGetDashboardQueryKey() }); void client.invalidateQueries({ queryKey: getGetWeeklyProgressQueryKey() }); };
  const saveList = (list: TaskList | null, input: TaskListInput) => {
    if (saveModel) saveModel(s => list ? { ...s, lists: s.lists.map(l => l.id === list.id ? { ...l, ...input } : l) } : { ...s, lists: [...s.lists, { ...input, id: newId(), taskCount: 0 }] });
    else if (list) updateListApi.mutate({ listId: list.id, data: input }, { onSuccess: refresh, onError: () => setToast('Could not save this list.') });
    else createListApi.mutate({ data: input }, { onSuccess: refresh, onError: () => setToast('Could not create this list.') });
    setListDialog(false); setToast('List saved');
  };
  const removeList = (list: TaskList) => {
    if (!window.confirm(`Permanently delete ${list.name} and its tasks?`)) return;
    if (saveModel) saveModel(s => ({ ...s, lists: s.lists.filter(l => l.id !== list.id), tasks: s.tasks.filter(t => t.listId !== list.id) }));
    else deleteListApi.mutate({ listId: list.id }, { onSuccess: refresh, onError: () => setToast('Could not delete this list.') });
    setListDialog(false);
  };
  const onExport = (format: 'json' | 'csv') => {
    const backup = { schemaVersion: 1, exportedAt: nowISO(), profile: model.profile, lists: model.lists, tasks: model.tasks };
    downloadFile(format === 'json' ? 'taskflow-backup.json' : 'taskflow-tasks.csv', format === 'json' ? JSON.stringify(backup, null, 2) : tasksToCsv(model.tasks, model.lists), format === 'json' ? 'application/json' : 'text/csv');
    setToast(`Your ${format.toUpperCase()} export is ready`);
  };
  const importFile = async (file?: File) => {
    if (!file) return;
    try {
      const content = await file.text(); let rows: ImportRow[] = [];
      if (file.name.toLowerCase().endsWith('.json')) {
        const parsed = JSON.parse(content) as { tasks?: Task[]; items?: ImportRow[] };
        rows = (parsed.tasks ?? parsed.items ?? []).map(t => ({ title: t.title, description: t.description, dueAt: t.dueAt, priority: t.priority, listName: 'listId' in t ? model.lists.find(l => l.id === t.listId)?.name ?? null : t.listName, tags: t.tags }));
      } else rows = parseCsv(content).filter(r => r.title?.trim()).map(r => ({ title: r.title.trim(), description: r.description || null, dueAt: r.dueAt || null, priority: ['low', 'medium', 'high', 'urgent'].includes(r.priority) ? r.priority as ImportRow['priority'] : 'medium', listName: r.listName || null, tags: (r.tags || '').split(/[;,]/).map(x => x.trim()).filter(Boolean) }));
      if (isGuest) saveModel?.(s => ({ ...s, tasks: [...rows.map((r, i) => ({ id: newId(), title: r.title, description: r.description ?? null, dueAt: r.dueAt ?? null, priority: r.priority ?? 'medium', status: 'todo', listId: s.lists.find(l => l.name.toLowerCase() === (r.listName ?? '').toLowerCase())?.id ?? null, tags: r.tags ?? [], subtasks: [], recurrence: 'none', reminderAt: null, estimatedMinutes: null, archived: false, position: s.tasks.length + i, createdAt: nowISO(), completedAt: null } as Task)), ...s.tasks] }));
      else onImport?.(rows);
      setToast(`${rows.length} ${rows.length === 1 ? 'task' : 'tasks'} imported`);
    } catch { setToast('That file could not be read. Use a TaskFlow JSON or task CSV file.'); }
  };
  const deleteEverything = () => {
  if (!window.confirm('Permanently delete all TaskFlow lists, tasks, and profile data? This cannot be undone.')) return;
    if (isGuest) { localStorage.removeItem(STORE_KEY); localStorage.removeItem('taskflow.onboarding.skipped'); setLocation('/'); }
    else onDeleteAccount ? onDeleteAccount() : deleteAccount.mutate(undefined, { onSuccess: () => { client.clear(); setLocation('/'); }, onError: () => setToast('Deletion failed. Please try again.') });
  };
  const menuItems = [{ id: 'profile', label: 'Profile', icon: UserRound }, { id: 'appearance', label: 'Appearance', icon: Sun }, { id: 'lists', label: 'Lists', icon: Folder }, { id: 'data', label: 'Your data', icon: Download }, { id: 'account', label: 'Account', icon: ShieldCheck }];
  useTheme(model.profile.theme, model.profile.accentColor);
  return <div className="app-shell" data-testid="page-settings"><aside className="sidebar"><Link href="/app" className="brand" data-testid="link-settings-home"><span className="brand-mark"><Check size={19} /></span>TaskFlow</Link><div className="nav-label">Workspace</div><Link href="/app" className="nav-link" data-testid="nav-back-dashboard"><LayoutDashboard size={17} /> Overview</Link><div className="sidebar-bottom"><div className="guest-note"><strong>{isGuest ? 'Local-first by design.' : 'Your account, your call.'}</strong>{isGuest ? 'Export a backup whenever you like. Your planner stays on this device.' : 'Your plans are private to your account.'}</div><Link href="/settings" className="nav-link active" data-testid="nav-settings"><Settings size={17} /> Settings</Link></div></aside>
    {mobileOpen && <div className="overlay" style={{ placeItems: 'stretch start', padding: 0 }} onClick={() => setMobileOpen(false)}><aside className="sidebar" style={{ display: 'flex', height: '100%' }} onClick={e => e.stopPropagation()}><button className="icon-button" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X size={16} /></button><Link href="/app" className="brand">TaskFlow</Link><Link href="/app" className="nav-link"><LayoutDashboard size={17} /> Overview</Link></aside></div>}
    <main className="main-area"><header className="topbar"><div style={{ display: 'flex', alignItems: 'center', gap: 11 }}><button className="icon-button mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Open menu" data-testid="button-settings-mobile-menu"><Menu size={18} /></button><span className="subtle" style={{ fontSize: 12 }}>Your preferences</span></div><Link href="/app" className="button" data-testid="button-settings-done">Done <Check size={15} /></Link></header>
      <div className="main-content"><div style={{ marginBottom: 23 }}><h1 className="page-title" data-testid="text-settings-title">Settings</h1><p className="subtle" style={{ fontSize: 13 }}>Make TaskFlow feel right for you.</p></div>{loading ? <LoadingState /> : <div className="settings-layout"><nav className="card settings-nav" aria-label="Settings sections">{menuItems.map(m => <button key={m.id} className={tab === m.id ? 'selected' : ''} onClick={() => setTab(m.id)} data-testid={`button-settings-${m.id}`}><m.icon size={15} style={{ verticalAlign: 'middle', marginRight: 8 }} />{m.label}</button>)}</nav>
        <section className="card settings-panel">
          {tab === 'profile' && <><h2>Your profile</h2><p className="subtle" style={{ fontSize: 12 }}>A few details help us make your workspace feel like yours.</p><div className="setting-line"><div><strong style={{ fontSize: 13 }}>I’m here as</strong><div className="subtle" style={{ fontSize: 11, marginTop: 4 }}>{model.profile.role ? model.profile.role === 'other' ? model.profile.customRole ?? 'Other' : ROLE_NAMES[model.profile.role] : 'Not set yet'}</div></div><button className="button" onClick={() => setRoleModal(true)} data-testid="button-change-role">{model.profile.role ? 'Change role' : 'Choose a role'} <Pencil size={14} /></button></div><div className="setting-line"><div><strong style={{ fontSize: 13 }}>Week starts on</strong><div className="subtle" style={{ fontSize: 11, marginTop: 4 }}>Set your calendar rhythm</div></div><select className="input" style={{ width: 150 }} value={model.profile.weekStartsOn} onChange={e => saveProfile({ weekStartsOn: Number(e.target.value) })} data-testid="select-week-start"><option value="0">Sunday</option><option value="1">Monday</option><option value="6">Saturday</option></select></div><div className="setting-line"><div><strong style={{ fontSize: 13 }}>A gentle start time</strong><div className="subtle" style={{ fontSize: 11, marginTop: 4 }}>Used to shape your daily view</div></div><input type="time" className="input" style={{ width: 150 }} value={model.profile.dailyStartTime ?? ''} onChange={e => saveProfile({ dailyStartTime: e.target.value })} data-testid="input-daily-start-time" /></div><div className="setting-line"><div><strong style={{ fontSize: 13 }}>Work hours in a day</strong><div className="subtle" style={{ fontSize: 11, marginTop: 4 }}>A guide for your day, not a rule</div></div><input type="number" className="input" min="1" max="24" style={{ width: 100 }} value={model.profile.workHours ?? 8} onChange={e => saveProfile({ workHours: Number(e.target.value) })} data-testid="input-work-hours" /></div></>}
          {tab === 'appearance' && <><h2>Appearance</h2><p className="subtle" style={{ fontSize: 12 }}>Choose the feeling that helps you focus.</p><div className="setting-line"><div><strong style={{ fontSize: 13 }}>Theme</strong><div className="subtle" style={{ fontSize: 11, marginTop: 4 }}>Use your system setting, or pick one</div></div><div className="segmented">{(['light', 'dark', 'system'] as const).map(v => <button key={v} className={model.profile.theme === v ? 'selected' : ''} onClick={() => saveProfile({ theme: v })} data-testid={`button-theme-${v}`}>{v === 'dark' ? <Moon size={14} /> : v === 'light' ? <Sun size={14} /> : <Settings size={14} />}{v}</button>)}</div></div><div className="setting-line"><div><strong style={{ fontSize: 13 }}>Accent color</strong><div className="subtle" style={{ fontSize: 11, marginTop: 4 }}>A small bit of color, your choice</div></div><div style={{ display: 'flex', gap: 10 }}>{[{ id: 'violet', color: '#6956bd' }, { id: 'teal', color: '#419b86' }, { id: 'coral', color: '#d97268' }, { id: 'gold', color: '#d59a3e' }, { id: 'mint', color: '#68aa88' }].map(c => <button key={c.id} aria-label={`${c.id} accent`} onClick={() => saveProfile({ accentColor: c.id })} style={{ width: 28, height: 28, borderRadius: 9, border: model.profile.accentColor === c.id ? '3px solid hsl(var(--foreground))' : '2px solid transparent', background: c.color }} data-testid={`button-accent-${c.id}`} />)}</div></div><p className="subtle" style={{ fontSize: 11 }}>Your browser’s reduced-motion preference is respected automatically.</p></>}
          {tab === 'lists' && <><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><div><h2>Your lists</h2><p className="subtle" style={{ fontSize: 12 }}>Keep things grouped in the way you think.</p></div><button className="button primary" onClick={() => setListDialog(null)} data-testid="button-settings-new-list"><Plus size={15} /> New list</button></div>{model.lists.length ? model.lists.map(l => <div className="setting-line" key={l.id}><div style={{ display: 'flex', alignItems: 'center', gap: 11 }}><span style={{ display: 'grid', placeItems: 'center', width: 33, height: 33, color: l.color, background: `${l.color}20`, borderRadius: 10 }}><Icon name={l.icon} /></span><div><strong style={{ fontSize: 13 }}>{l.name}</strong><div className="subtle" style={{ fontSize: 11 }}>{model.tasks.filter(t => t.listId === l.id).length} tasks</div></div></div><button className="icon-button" aria-label={`Edit ${l.name}`} onClick={() => setListDialog(l)} data-testid={`button-edit-list-${l.id}`}><Pencil size={14} /></button></div>) : <EmptyState title="Your lists start here" text="Create a list, or choose a starter setup from your profile." action={<button className="button" onClick={() => setRoleModal(true)} data-testid="button-settings-starter-set">Choose a starter set</button>} />}</>}
          {tab === 'data' && <><h2>Your data</h2><p className="subtle" style={{ fontSize: 12 }}>Your tasks belong to you. Export a copy or bring your own file.</p><div className="setting-line"><div><strong style={{ fontSize: 13 }}>Download a backup</strong><div className="subtle" style={{ fontSize: 11, marginTop: 4 }}>JSON keeps your lists and profile. CSV is for tasks.</div></div><div style={{ display: 'flex', gap: 7 }}><button className="button" onClick={() => onExport('json')} data-testid="button-export-json"><Download size={14} /> JSON</button><button className="button" onClick={() => onExport('csv')} data-testid="button-export-csv"><Download size={14} /> CSV</button></div></div><div className="setting-line"><div><strong style={{ fontSize: 13 }}>Bring tasks in</strong><div className="subtle" style={{ fontSize: 11, marginTop: 4 }}>Import a TaskFlow JSON backup or a task CSV.</div></div><label className="button" style={{ cursor: 'pointer' }} data-testid="label-import-tasks"><FileUp size={14} /> Choose file<input type="file" accept=".json,.csv,application/json,text/csv" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)' }} onChange={e => { void importFile(e.target.files?.[0]); e.target.value = ''; }} data-testid="input-import-file" /></label></div><div className="subtle" role="status" style={{ paddingTop: 12, fontSize: 11 }} data-testid="text-data-privacy">{isGuest ? 'This planner is saved in this browser. Signing in later will not automatically sync or merge it; export your data before linking accounts.' : 'Your account data is held in your TaskFlow workspace. Export a copy whenever you need one.'}</div></>}
          {tab === 'account' && <><h2>Account & privacy</h2><p className="subtle" style={{ fontSize: 12 }}>Simple, clear choices about your information.</p><div className="setting-line"><div><strong style={{ fontSize: 13 }}>Where your data lives</strong><div className="subtle" style={{ fontSize: 11, marginTop: 4 }}>{isGuest ? 'Only in this browser. It does not sync to an account.' : 'Saved in your signed-in TaskFlow account.'}</div></div><ShieldCheck size={19} color="#419b86" /></div>{isGuest && <div className="setting-line"><div><strong style={{ fontSize: 13 }}>Want to sign in later?</strong><div className="subtle" style={{ maxWidth: 350, fontSize: 11, marginTop: 4, lineHeight: 1.6 }}>Creating an account won’t silently sync this guest workspace. Export your backup first; import it after signing in.</div></div><Link className="button" href="/sign-up" data-testid="link-create-account-from-guest">Create account <ArrowUpRight size={14} /></Link></div>}{!isGuest && <div className="setting-line"><div><strong style={{ fontSize: 13 }}>Sign out</strong><div className="subtle" style={{ fontSize: 11, marginTop: 4 }}>Return to the TaskFlow home page.</div></div><Logout /></div>}<div className="setting-line" style={{ alignItems: 'start' }}><div><strong style={{ color: 'hsl(var(--destructive))', fontSize: 13 }}>{isGuest ? 'Delete guest data' : 'Delete your account'}</strong><div className="subtle" style={{ maxWidth: 360, fontSize: 11, marginTop: 5, lineHeight: 1.6 }}>{isGuest ? 'Remove every task, list, and preference saved in this browser.' : 'Permanently remove your TaskFlow data and delete your sign-in account. This cannot be undone.'}</div></div><button className="button danger" onClick={deleteEverything} disabled={saving} data-testid="button-delete-all-data"><Trash2 size={14} /> {isGuest ? 'Delete data' : 'Delete account'}</button></div></>}
        </section></div>}</div>
    </main>{roleModal && <RoleOnboarding initialRole={model.profile.role} onSave={(role, customRole, selected) => { if (saveModel) { const newLists = selected.map((l, i) => ({ name: l.name, icon: l.icon, color: l.color, id: newId(), position: i, taskCount: l.tasks.length })); const newTasks = makeGuestStarterTasks(selected, newLists); saveModel(s => ({ ...s, profile: { ...s.profile, role, customRole, updatedAt: nowISO() }, lists: [...s.lists, ...newLists], tasks: [...newTasks, ...s.tasks] })); } else if (saveTemplate) saveTemplate(role, customRole, selected); else saveProfile({ role, customRole }); setRoleModal(false); }} onSkip={() => setRoleModal(false)} />}{listDialog !== false && <ListDialog list={listDialog} onClose={() => setListDialog(false)} onSave={saveList} onDelete={listDialog ? () => removeList(listDialog) : undefined} />}{toast && <Toast text={toast} close={() => setToast('')} />}</div>;
}
function Logout() {
  const { signOut } = useClerk();
  return <button className="button" onClick={() => signOut({ redirectUrl: basePath || '/' })} data-testid="button-sign-out"><LogOut size={14} /> Sign out</button>;
}

function useTheme(theme: Profile['theme'], accentColor = 'violet') {
  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const lightAccents: Record<string, string> = { violet: '252 62% 48%', teal: '169 43% 36%', coral: '5 61% 47%', gold: '37 75% 37%', mint: '149 34% 39%' };
    const darkAccents: Record<string, string> = { violet: '252 73% 68%', teal: '169 50% 58%', coral: '5 72% 66%', gold: '37 80% 67%', mint: '149 42% 60%' };
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && media.matches);
      root.classList.toggle('dark', dark);
      root.style.setProperty('--primary', (dark ? darkAccents : lightAccents)[accentColor] ?? (dark ? darkAccents.violet : lightAccents.violet));
      root.style.setProperty('--primary-foreground', dark ? '248 30% 13%' : '0 0% 100%');
    };
    apply(); media.addEventListener('change', apply); return () => media.removeEventListener('change', apply);
  }, [theme, accentColor]);
}
function Icon({ name, size = 17 }: { name: string; size?: number }) {
  const I = ICONS[name] ?? Folder;
  return <I size={size} strokeWidth={1.9} aria-hidden="true" />;
}
function getDateStamp(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function taskDueLabel(task: Task) {
  if (!task.dueAt) return 'No due date';
  const due = new Date(task.dueAt);
  if (getDateStamp(due) === getDateStamp()) return `Today · ${due.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  return due.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
function csvEscape(value: unknown) { return `"${String(value ?? '').replaceAll('"', '""')}"`; }
function tasksToCsv(tasks: Task[], lists: TaskList[]) {
  return ['title,description,dueAt,priority,listName,tags', ...tasks.map(t => [t.title, t.description, t.dueAt, t.priority, lists.find(l => l.id === t.listId)?.name ?? '', t.tags.join(';')].map(csvEscape).join(','))].join('\n');
}
function downloadFile(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []; let row: string[] = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"' && quoted && text[i + 1] === '"') { cell += '"'; i++; }
    else if (c === '"') quoted = !quoted;
    else if (c === ',' && !quoted) { row.push(cell); cell = ''; }
    else if ((c === '\n' || c === '\r') && !quoted) { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); if (row.some(Boolean)) rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  row.push(cell); if (row.some(Boolean)) rows.push(row);
  const [headers, ...data] = rows; return data.map(cells => Object.fromEntries((headers ?? []).map((h, i) => [h.trim(), cells[i] ?? ''])));
}
function getLocalSummary(tasks: Task[]): DashboardSummary {
  const today = getDateStamp(), week = new Date(); week.setDate(week.getDate() - 7);
  const dueToday = tasks.filter(t => t.dueAt && getDateStamp(new Date(t.dueAt)) === today);
  return { todayTotal: dueToday.length, todayCompleted: dueToday.filter(t => t.status === 'done').length, overdueCount: tasks.filter(t => t.status !== 'done' && t.dueAt && new Date(t.dueAt) < new Date(new Date().setHours(0, 0, 0, 0))).length, completedThisWeek: tasks.filter(t => t.completedAt && new Date(t.completedAt) >= week).length, streak: 0 };
}
function getLocalProgress(tasks: Task[]): DailyProgress[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    return { date: getDateStamp(d), completed: tasks.filter(t => t.completedAt && getDateStamp(new Date(t.completedAt)) === getDateStamp(d)).length };
  });
}
function EmptyState({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return <div className="empty-state" data-testid="empty-tasks"><CheckCircle2 size={33} /><h3>{title}</h3><p>{text}</p>{action}</div>;
}
function LoadingState() {
  return <div className="card" aria-label="Loading tasks" style={{ padding: 25 }} data-testid="loading-state"><div style={{ height: 14, width: '35%', background: 'hsl(var(--secondary))', borderRadius: 8, marginBottom: 22 }} /><div style={{ display: 'grid', gap: 16 }}>{[1, 2, 3].map(n => <div key={n} style={{ height: 20, background: 'hsl(var(--secondary))', borderRadius: 8, opacity: 1 - n * .17 }} />)}</div></div>;
}
function Toast({ text, close }: { text: string; close: () => void }) {
  useEffect(() => { const id = window.setTimeout(close, 2900); return () => window.clearTimeout(id); }, [text, close]);
  return <div className="toast-note" role="status" data-testid="status-toast">{text}</div>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={basePath}>
          <RoutedBoundary><Router /></RoutedBoundary>
          <SiteFooter />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
function RoutedBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}
type FooterDialog = 'privacy' | 'terms' | 'feedback' | null;
function SiteFooter() {
  const [dialog, setDialog] = useState<FooterDialog>(null);
  const [message, setMessage] = useState('');
  const [notice, setNotice] = useState('');
  const feedback = useSubmitFeedback();
  const close = () => { setDialog(null); setNotice(''); };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    feedback.mutate({ data: { message: message.trim() } }, {
      onSuccess: () => { setNotice('Thanks. Your feedback was sent without your account details.'); setMessage(''); },
      onError: () => setNotice('We could not send that just now. Please try again.'),
    });
  };
  return <>
    <footer className="site-footer">
      <span>TaskFlow is free for everyone. No ads. Your plans stay yours.</span>
      <nav aria-label="Legal and feedback links">
        <button type="button" className="footer-link" onClick={() => setDialog('privacy')}>Privacy Policy</button>
        <button type="button" className="footer-link" onClick={() => setDialog('terms')}>Terms</button>
        <button type="button" className="footer-link" onClick={() => setDialog('feedback')}>Send feedback</button>
      </nav>
    </footer>
    {dialog && <div className="overlay" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}>
      <section className="dialog footer-dialog" role="dialog" aria-modal="true" aria-labelledby="footer-dialog-title">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'start' }}>
          <div>
            <h2 id="footer-dialog-title">{dialog === 'privacy' ? 'Privacy Policy' : dialog === 'terms' ? 'Terms of Use' : 'Send feedback'}</h2>
            <p className="subtle" style={{ fontSize: 12, margin: '5px 0 0' }}>{dialog === 'feedback' ? 'Your note helps improve TaskFlow. No account details are attached.' : 'Plain-language information about using TaskFlow.'}</p>
          </div>
          <button type="button" className="icon-button" onClick={close} aria-label="Close dialog"><X size={16} /></button>
        </div>
        {dialog === 'privacy' && <div className="legal-copy">
          <h3>What is stored</h3>
          <p>Guest tasks and preferences stay in this browser. When you sign in, your profile, lists, and tasks are stored in TaskFlow’s database and associated with your sign-in account.</p>
          <h3>No ads or tracking</h3>
          <p>TaskFlow is free for everyone. We do not show ads, sell personal data, or use advertising trackers.</p>
          <h3>Feedback</h3>
          <p>If you send feedback, the message is stored without your TaskFlow account ID. Basic abuse prevention may briefly process connection information in server memory; it is not added to the feedback record.</p>
          <h3>Your choices</h3>
          <p>Export a copy from Settings. Deleting your account removes its TaskFlow profile, lists, tasks, and sign-in account. Guest data can be cleared from Settings in this browser.</p>
        </div>}
        {dialog === 'terms' && <div className="legal-copy">
          <h3>Free to use</h3>
          <p>TaskFlow is free for everyone. There are no paid tiers, ads, or purchase requirements.</p>
          <h3>Your information</h3>
          <p>Your tasks are yours. Keep an export if you need a separate backup, and do not add information you are not comfortable storing in a task planner.</p>
          <h3>Using TaskFlow</h3>
          <p>Use the app lawfully and do not disrupt the service or other users. TaskFlow is a planning aid, not a guaranteed reminder or archival service; check important deadlines and keep backups of anything you cannot afford to lose.</p>
        </div>}
        {dialog === 'feedback' && <form className="form-stack" onSubmit={submit}>
          <div>
            <label className="label" htmlFor="feedback-message">Your feedback</label>
            <textarea id="feedback-message" className="input" rows={5} minLength={5} maxLength={2000} required value={message} onChange={event => setMessage(event.target.value)} placeholder="What would make TaskFlow more useful?" />
            <p className="subtle" style={{ margin: '6px 0 0', fontSize: 11 }}>Please do not include passwords or other sensitive information. Up to 2,000 characters.</p>
          </div>
          {notice && <p className="subtle" role="status" style={{ margin: 0, fontSize: 12 }}>{notice}</p>}
          <div className="dialog-actions"><button type="button" className="button" onClick={close}>Close</button><button type="submit" className="button primary" disabled={feedback.isPending || message.trim().length < 5}>{feedback.isPending ? 'Sending…' : 'Send feedback'}</button></div>
        </form>}
      </section>
    </div>}
  </>;
}
const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: { logoPlacement: 'inside' as const, logoLinkUrl: basePath || '/', logoImageUrl: `${window.location.origin}${basePath}/logo.svg` },
  variables: { colorPrimary: '#6552bd', colorForeground: '#302d48', colorMutedForeground: '#6d6981', colorDanger: '#c54f4e', colorBackground: '#ffffff', colorInput: '#fbfaff', colorInputForeground: '#302d48', colorNeutral: '#e4e0ef', fontFamily: 'DM Sans', borderRadius: '0.8rem' },
  elements: { rootBox: 'w-full flex justify-center', cardBox: 'bg-[#fff] rounded-2xl w-[440px] max-w-full overflow-hidden', card: '!shadow-none !border-0 !bg-transparent !rounded-none', footer: '!shadow-none !border-0 !bg-transparent !rounded-none', headerTitle: 'text-[#302d48] font-bold', headerSubtitle: 'text-[#6d6981]', socialButtonsBlockButtonText: 'text-[#302d48]', formFieldLabel: 'text-[#302d48]', footerActionLink: 'text-[#5846b4]', footerActionText: 'text-[#6d6981]', dividerText: 'text-[#6d6981]', identityPreviewEditButton: 'text-[#5846b4]', formFieldSuccessText: 'text-[#267460]', alertText: 'text-[#a33c3c]', logoBox: 'mb-2', logoImage: 'rounded-xl', socialButtonsBlockButton: 'border-[#e4e0ef] bg-white', formButtonPrimary: 'bg-[#6552bd] hover:bg-[#5141a5]', formFieldInput: 'border-[#e4e0ef] bg-[#fbfaff] text-[#302d48]', footerAction: 'border-0', dividerLine: 'bg-[#e4e0ef]', alert: 'bg-[#fff4f3]', otpCodeFieldInput: 'border-[#e4e0ef]', formFieldRow: 'gap-2', main: 'text-[#302d48]' },
};
function ClerkRoot() {
  const [, setLocation] = useLocation();
  return <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} appearance={clerkAppearance} signInUrl={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} localization={{ signIn: { start: { title: 'Welcome back', subtitle: 'Pick up where your plans left off.' } }, signUp: { start: { title: 'A little more room to breathe', subtitle: 'Make your free TaskFlow account.' } } }} routerPush={to => setLocation(stripBase(to))} routerReplace={to => setLocation(stripBase(to), { replace: true })}>
    <ClerkCacheClear />
    <RouteSwitch />
  </ClerkProvider>;
}
function ClerkCacheClear() {
  const { addListener } = useClerk(); const client = useQueryClient();
  useEffect(() => { let previous: string | null | undefined; return addListener(({ user }) => { const id = user?.id ?? null; if (previous !== undefined && previous !== id) client.clear(); previous = id; }); }, [addListener, client]);
  return null;
}
function RouteSwitch() {
  return <Switch>
    <Route path="/" component={PublicHome} />
    <Route path="/sign-in/*?" component={SignInPage} />
    <Route path="/sign-up/*?" component={SignUpPage} />
    <Route path="/app/:view?" component={ProtectedApp} />
    <Route path="/settings" component={ProtectedSettings} />
    <Route component={() => <Redirect to="/" />} />
  </Switch>;
}
function PublicHome() {
  return <><Show when="signed-in"><Redirect to="/app" /></Show><Show when="signed-out"><Landing /></Show></>;
}
function SignInPage() { return <div className="landing" style={{ display: 'grid', placeItems: 'center', padding: 20 }}><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /></div>; }
function SignUpPage() { return <div className="landing" style={{ display: 'grid', placeItems: 'center', padding: 20 }}><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /></div>; }
function ProtectedApp() { return <><Show when="signed-in"><SignedInApp /></Show><Show when="signed-out"><GuestApp /></Show></>; }
function ProtectedSettings() { return <><Show when="signed-in"><SignedInSettings /></Show><Show when="signed-out"><GuestSettings /></Show></>; }

function Landing() {
  return <main className="landing" data-testid="page-landing">
    <nav className="landing-nav"><div className="brand" style={{ padding: 0 }}><div className="brand-mark"><Check size={19} /></div>TaskFlow</div><div style={{ display: 'flex', gap: 9, alignItems: 'center' }}><Link href="/app" className="button ghost" data-testid="link-try-guest">Try it first</Link><Link href="/sign-in" className="button" data-testid="link-sign-in">Sign in</Link><Link href="/sign-up" className="button primary" data-testid="link-sign-up">Create account</Link></div></nav>
    <section className="landing-content"><div><span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 11px', color: '#5143a2', background: '#e9e4ff', borderRadius: 99, fontSize: 11, fontWeight: 800 }}><Sparkles size={14} /> Your day, a little lighter</span>
      <h1>Make space for the things <span>that matter.</span></h1><p className="landing-copy">A calm, personal planner for all the little things adding up to your big things. Start with a blank page, or make it yours in a few clicks.</p>
      <div style={{ display: 'flex', gap: 10, marginTop: 26, flexWrap: 'wrap' }}><Link href="/app" className="button primary" style={{ minHeight: 48, padding: '0 21px' }} data-testid="button-start-planning">Start planning free <ArrowRight size={16} /></Link><Link href="/sign-up" className="button" style={{ minHeight: 48 }} data-testid="button-save-your-work">Save your work</Link></div>
      <div className="landing-proof"><span><ShieldCheck size={15} /> Private by default</span><span><Zap size={15} /> Ready in seconds</span><span><CheckCircle2 size={15} /> No setup needed</span></div>
    </div>
    <div className="landing-visual" aria-label="TaskFlow preview"><div className="card preview-card"><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><div><div className="subtle" style={{ fontSize: 11 }}>TUESDAY, OCTOBER 8</div><h2 style={{ fontFamily: 'var(--app-font-serif)', margin: '4px 0 0', fontSize: 23 }}>A good day to begin.</h2></div><span style={{ background: '#e3f5ef', color: '#307e6b', borderRadius: 12, padding: 10 }}><TrendingUp size={20} /></span></div><div style={{ marginTop: 16, padding: 13, background: 'hsl(var(--secondary))', borderRadius: 12 }}><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 9 }}><strong>Daily progress</strong><span>2 of 4</span></div><div className="progress-track"><div className="progress-fill" style={{ width: '50%' }} /></div></div><div style={{ marginTop: 8 }}><PreviewTask text="Review lecture notes" icon="book" color="#e9e4ff" /><PreviewTask text="Send the project update" icon="briefcase" color="#ffede7" /><PreviewTask text="Take a proper lunch break" icon="sparkles" color="#e4f6ee" /></div></div><div style={{ position: 'absolute', right: -10, bottom: -18, padding: '12px 15px', borderRadius: 15, background: '#fff3d9', color: '#705520', boxShadow: '0 8px 25px #553d1820', fontSize: 12, fontWeight: 700 }}>One thing at a time <Sparkles size={14} style={{ verticalAlign: 'middle' }} /></div></div>
    </section><section style={{ maxWidth: 1040, padding: '0 22px 88px', margin: 'auto' }}><div className="card" style={{ padding: '28px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}><div><div className="subtle" style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1 }}>MADE FOR YOUR KIND OF BUSY</div><h2 style={{ fontFamily: 'var(--app-font-serif)', fontSize: 23, margin: '8px 0 6px' }}>School, client work, life admin — it all belongs here.</h2><p className="subtle" style={{ margin: 0, fontSize: 13 }}>Pick a starter setup that fits your world. Change every bit of it whenever you like.</p></div><Link href="/app" className="button primary" data-testid="button-try-taskflow">Try TaskFlow <ArrowUpRight size={16} /></Link></div></section>
  </main>;
}
function PreviewTask({ text, icon, color }: { text: string; icon: string; color: string }) { return <div className="preview-task"><span style={{ display: 'grid', placeItems: 'center', width: 30, height: 30, background: color, color: '#5c50a4', borderRadius: 9 }}><Icon name={icon} size={15} /></span><span>{text}</span><Circle size={15} color="#c8c4d5" style={{ marginLeft: 'auto' }} /></div>; }

function GuestApp() {
  const { state, commit } = useGuestStore(); useTheme(state.profile.theme, state.profile.accentColor);
  return <Workspace data={state} save={commit} accountMode="guest" />;
}
function SignedInApp() {
  const profile = useGetProfile(); const lists = useGetLists(); const tasks = useGetTasks({ archived: false, limit: 100 });
  const dashboard = useGetDashboard(); const progress = useGetWeeklyProgress();
  const ready = !profile.isLoading && !lists.isLoading && !tasks.isLoading;
  const merged: LocalState = { version: 1, profile: profile.data ?? initialProfile(), lists: lists.data ?? [], tasks: tasks.data?.items ?? [] };
  useTheme(merged.profile.theme, merged.profile.accentColor);
  return <Workspace data={merged} api={{ ready, listsLoading: lists.isLoading, tasksLoading: tasks.isLoading, dashboard: dashboard.data, progress: progress.data ?? [], tasksError: tasks.isError, profileError: profile.isError }} />;
}
type ApiOps = { ready: boolean; listsLoading: boolean; tasksLoading: boolean; dashboard?: DashboardSummary; progress: DailyProgress[]; tasksError: boolean; profileError: boolean };
type LocalModel = { version: 1; profile: Profile; lists: TaskList[]; tasks: Task[] };
type SaveModel = (fn: (s: LocalState) => LocalState) => void;

function Workspace({ data, save, accountMode = 'signed', api }: { data: LocalModel; save?: SaveModel; accountMode?: 'guest' | 'signed'; api?: ApiOps }) {
  const [, setLocation] = useLocation(); const [route] = useLocation();
  const [toast, setToast] = useState(''); const [taskDialog, setTaskDialog] = useState<Task | null | false>(false);
  const [listDialog, setListDialog] = useState<TaskList | null | false>(false); const [roleModal, setRoleModal] = useState(false);
  const [search, setSearch] = useState(''); const [view, setView] = useState<'list' | 'board' | 'calendar'>('list');
  const [listFilter, setListFilter] = useState(''); const [statusFilter, setStatusFilter] = useState(''); const [priorityFilter, setPriorityFilter] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);
  const client = useQueryClient();
  const updateTaskApi = useUpdateTask(); const createTaskApi = useCreateTask(); const deleteTaskApi = useDeleteTask(); const duplicateTaskApi = useDuplicateTask();
  const createListApi = useCreateList(); const updateListApi = useUpdateList(); const deleteListApi = useDeleteList(); const updateProfileApi = useUpdateProfile(); const importStarterTasksApi = useImportTasks();
  const invalidateAll = () => { void client.invalidateQueries({ queryKey: getGetTasksQueryKey() }); void client.invalidateQueries({ queryKey: getGetListsQueryKey() }); void client.invalidateQueries({ queryKey: getGetDashboardQueryKey() }); void client.invalidateQueries({ queryKey: getGetWeeklyProgressQueryKey() }); };
  const saveTask = (task: Task | null, input: TaskInput) => {
    if (save) save(s => task ? { ...s, tasks: s.tasks.map(t => t.id === task.id ? { ...t, ...input, completedAt: input.status === 'done' ? (t.completedAt ?? nowISO()) : null } : t) } : { ...s, tasks: [{ ...input, id: newId(), description: input.description ?? null, dueAt: input.dueAt ?? null, reminderAt: input.reminderAt ?? null, estimatedMinutes: input.estimatedMinutes ?? null, createdAt: nowISO(), completedAt: input.status === 'done' ? nowISO() : null }, ...s.tasks] });
    else if (task) updateTaskApi.mutate({ taskId: task.id, data: input }, { onSuccess: invalidateAll, onError: () => setToast('Could not save that task. Try again.') });
    else createTaskApi.mutate({ data: input }, { onSuccess: invalidateAll, onError: () => setToast('Could not create that task. Try again.') });
    setTaskDialog(false); setToast(task ? 'Task updated' : 'Task added');
  };
  const toggleTask = (task: Task) => {
    const status = task.status === 'done' ? 'todo' : 'done';
    if (save) save(s => ({ ...s, tasks: s.tasks.map(t => t.id === task.id ? { ...t, status, completedAt: status === 'done' ? nowISO() : null } : t) }));
    else updateTaskApi.mutate({ taskId: task.id, data: { status } }, { onSuccess: invalidateAll, onError: () => setToast('Could not update this task.') });
    setToast(status === 'done' ? 'Nicely done!' : 'Back on your list');
  };
  const removeTask = (task: Task) => {
    if (!window.confirm(`Delete “${task.title}”? This cannot be undone.`)) return;
    if (save) save(s => ({ ...s, tasks: s.tasks.filter(t => t.id !== task.id) }));
    else deleteTaskApi.mutate({ taskId: task.id }, { onSuccess: invalidateAll, onError: () => setToast('Could not delete this task.') });
    setToast('Task deleted');
  };
  const duplicateTask = (task: Task) => {
    if (save) save(s => ({ ...s, tasks: [{ ...task, id: newId(), title: `${task.title} (copy)`, status: 'todo', completedAt: null, createdAt: nowISO() }, ...s.tasks] }));
    else duplicateTaskApi.mutate({ taskId: task.id }, { onSuccess: invalidateAll, onError: () => setToast('Could not duplicate this task.') });
    setToast('Task duplicated');
  };
  const saveList = (list: TaskList | null, input: TaskListInput) => {
    if (save) save(s => list ? { ...s, lists: s.lists.map(l => l.id === list.id ? { ...l, ...input } : l) } : { ...s, lists: [...s.lists, { ...input, id: newId(), taskCount: 0 }] });
    else if (list) updateListApi.mutate({ listId: list.id, data: input }, { onSuccess: invalidateAll, onError: () => setToast('Could not update list.') });
    else createListApi.mutate({ data: input }, { onSuccess: invalidateAll, onError: () => setToast('Could not create list.') });
    setListDialog(false); setToast(list ? 'List updated' : 'List created');
  };
  const removeList = (list: TaskList) => {
    if (!window.confirm(`Delete "${list.name}" and its tasks?`)) return;
    if (save) save(s => ({ ...s, lists: s.lists.filter(l => l.id !== list.id), tasks: s.tasks.filter(t => t.listId !== list.id) }));
    else deleteListApi.mutate({ listId: list.id }, { onSuccess: invalidateAll, onError: () => setToast('Could not delete list.') });
    setToast('List deleted');
  };
  const setRoleAndLists = (role: Role | null, customRole: string | null, selectedLists: StarterList[]) => {
    if (save) {
      const newLists = selectedLists.map((list, position) => ({ name: list.name, icon: list.icon, color: list.color, id: newId(), position, taskCount: list.tasks?.length ?? 0 }));
      const newTasks = makeGuestStarterTasks(selectedLists, newLists);
      save(s => ({ ...s, profile: { ...s.profile, role, customRole, updatedAt: nowISO() }, lists: [...s.lists, ...newLists], tasks: [...newTasks, ...s.tasks] }));
    } else updateProfileApi.mutate({ data: { role, customRole } }, { onSuccess: () => {
      void client.invalidateQueries({ queryKey: getGetProfileQueryKey() });
      const taskRows = selectedLists.flatMap(list => (list.tasks ?? []).map(task => ({
        title: task.title,
        description: task.description ?? null,
        priority: task.priority,
        listName: list.name,
        tags: task.tags,
      })));
      void (async () => {
        try {
          await Promise.all(selectedLists.map((item, position) => createListApi.mutateAsync({
            data: { name: item.name, color: item.color, icon: item.icon, position },
          })));
          if (taskRows.length) await importStarterTasksApi.mutateAsync({ data: { items: taskRows } });
          invalidateAll();
        } catch {
          setToast('Your role was saved, but some starter content could not be created.');
        }
      })();
    }, onError: () => setToast('Your role could not be saved. Please try again.') });
    setRoleModal(false);
  };
  const today = getDateStamp();
  const viewSegment = route.match(/^\/app\/([^/?]+)/)?.[1] ?? 'dashboard';
  const navigation: { label: string; path: string; icon: typeof LayoutDashboard; count?: number }[] = [
    { label: 'Overview', path: '/app', icon: LayoutDashboard },
    { label: 'Today', path: '/app/today', icon: CheckCircle2, count: data.tasks.filter(t => t.dueAt && getDateStamp(new Date(t.dueAt)) === today && t.status !== 'done').length },
    { label: 'Upcoming', path: '/app/upcoming', icon: CalendarDays },
    { label: 'Overdue', path: '/app/overdue', icon: Clock3, count: api?.dashboard?.overdueCount ?? data.tasks.filter(t => t.status !== 'done' && t.dueAt && new Date(t.dueAt) < new Date(new Date().setHours(0, 0, 0, 0))).length },
  ];
  const visibleTasks = useMemo(() => {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    return data.tasks.filter(t => !t.archived).filter(t => {
      if (viewSegment === 'today') return !!t.dueAt && getDateStamp(new Date(t.dueAt)) === today;
      if (viewSegment === 'upcoming') return !!t.dueAt && new Date(t.dueAt) > new Date(new Date().setHours(23, 59, 59, 999)) && t.status !== 'done';
      if (viewSegment === 'overdue') return !!t.dueAt && new Date(t.dueAt) < todayStart && t.status !== 'done';
      if (viewSegment.startsWith('list-')) return t.listId === viewSegment.slice(5);
      return true;
    }).filter(t => !search || `${t.title} ${t.description ?? ''} ${t.tags.join(' ')}`.toLowerCase().includes(search.toLowerCase()))
      .filter(t => !listFilter || t.listId === listFilter)
      .filter(t => !statusFilter || t.status === statusFilter)
      .filter(t => !priorityFilter || t.priority === priorityFilter)
      .sort((a, b) => (a.dueAt ?? '9999').localeCompare(b.dueAt ?? '9999') || a.position - b.position);
  }, [data.tasks, viewSegment, today, search, listFilter, statusFilter, priorityFilter]);
  const summary = api?.dashboard ?? getLocalSummary(data.tasks);
  const progress = api?.progress.length ? api.progress : getLocalProgress(data.tasks);
  useEffect(() => { if ((!api || api.ready) && data.profile.role === null && !localStorage.getItem('taskflow.onboarding.skipped')) setRoleModal(true); }, [data.profile.role, api?.ready]);
  const routeTitle = viewSegment === 'dashboard' ? 'Your overview' : viewSegment === 'today' ? 'Today' : viewSegment === 'upcoming' ? 'Coming up' : viewSegment === 'overdue' ? 'Overdue' : data.lists.find(l => l.id === viewSegment.slice(5))?.name ?? 'Your tasks';
  const pageKind = viewSegment === 'dashboard' ? 'dashboard' : 'tasks';
  return <div className="app-shell" data-testid="page-app">
    <aside className="sidebar">
      <Link href="/app" className="brand" data-testid="link-app-home"><span className="brand-mark"><Check size={19} /></span>TaskFlow</Link>
      <div className="nav-label">Workspace</div>
      {navigation.map(item => <Link href={item.path} className={`nav-link ${viewSegment === (item.path === '/app' ? 'dashboard' : item.path.slice(5)) ? 'active' : ''}`} key={item.path} data-testid={`nav-${item.label.toLowerCase()}`}><item.icon size={17} />{item.label}{item.count ? <span className="count">{item.count}</span> : null}</Link>)}
      <div className="nav-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>My lists <button className="icon-button" style={{ width: 25, height: 25, border: 0, background: 'transparent' }} onClick={() => setListDialog(null)} aria-label="Add list" data-testid="button-add-list"><Plus size={15} /></button></div>
      {data.lists.map(list => <Link href={`/app/list-${list.id}`} key={list.id} className={`nav-link ${viewSegment === `list-${list.id}` ? 'active' : ''}`} data-testid={`nav-list-${list.id}`}><span style={{ width: 9, height: 9, borderRadius: 3, background: list.color }} /><span style={{ flex: 1 }}>{list.name}</span><span className="count">{data.tasks.filter(t => t.listId === list.id && t.status !== 'done').length}</span></Link>)}
      <div style={{ padding: '9px 10px' }}><button className="button ghost" style={{ width: '100%', justifyContent: 'flex-start', fontSize: 12 }} onClick={() => setListDialog(null)} data-testid="button-create-list"><Plus size={15} /> Create a list</button></div>
      <div className="sidebar-bottom"><div className="guest-note"><strong>{accountMode === 'guest' ? 'Your space, your device.' : 'You’re all set.'}</strong>{accountMode === 'guest' ? 'Your tasks stay in this browser until you choose to export or create an account.' : 'Your tasks are saved to your TaskFlow account.'}</div>
        <Link href="/settings" className={`nav-link ${route === '/settings' ? 'active' : ''}`} data-testid="nav-settings"><Settings size={17} /> Settings</Link>
      </div>
    </aside>
    {mobileOpen && <div className="overlay" style={{ placeItems: 'stretch start', padding: 0 }} onClick={() => setMobileOpen(false)}><aside className="sidebar" style={{ display: 'flex', height: '100%' }} onClick={e => e.stopPropagation()}><button className="icon-button" style={{ alignSelf: 'end' }} onClick={() => setMobileOpen(false)} aria-label="Close menu"><X size={16} /></button><Link href="/app" className="brand"><span className="brand-mark"><Check size={19} /></span>TaskFlow</Link>{navigation.map(i => <Link key={i.path} href={i.path} className="nav-link" onClick={() => setMobileOpen(false)}><i.icon size={17} />{i.label}</Link>)}<Link href="/settings" className="nav-link"><Settings size={17} />Settings</Link></aside></div>}
    <main className="main-area"><header className="topbar"><div style={{ display: 'flex', alignItems: 'center', gap: 11 }}><button className="icon-button mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Open menu" data-testid="button-open-menu"><Menu size={18} /></button><span className="subtle" style={{ fontSize: 12 }} data-testid="text-date">{new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</span></div><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><button className="icon-button" aria-label="Switch theme" onClick={() => accountMode === 'guest' ? save?.(s => ({ ...s, profile: { ...s.profile, theme: s.profile.theme === 'dark' ? 'light' : 'dark' } })) : setLocation('/settings')} data-testid="button-toggle-theme">{data.profile.theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}</button><div className="brand-mark" style={{ width: 34, height: 34, borderRadius: 12, fontSize: 12 }}>{accountMode === 'guest' ? 'G' : 'TF'}</div></div></header>
      <div className="main-content">
        {pageKind === 'dashboard' ? <Dashboard data={data} summary={summary} progress={progress} tasks={data.tasks.filter(t => !t.archived)} loading={api?.tasksLoading ?? false} onAdd={() => setTaskDialog(null)} onToggle={toggleTask} onEdit={t => setTaskDialog(t)} onNavigate={setLocation} /> : <section>
          <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}><div><h1 className="page-title" data-testid="text-page-title">{routeTitle}</h1><p className="subtle" style={{ margin: '8px 0 0', fontSize: 13 }}>{visibleTasks.length ? `${visibleTasks.length} ${visibleTasks.length === 1 ? 'task' : 'tasks'} to keep in view` : 'A little progress still counts.'}</p></div><button className="button primary" onClick={() => setTaskDialog(null)} data-testid="button-add-task"><Plus size={16} /> New task</button></div>
          <div className="toolbar"><div className="searchbox"><Search size={16} /><input className="input" aria-label="Search tasks" placeholder="Search your tasks…" value={search} onChange={e => setSearch(e.target.value)} data-testid="input-search-tasks" /></div><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><select className="input" style={{ width: 'auto', minWidth: 124 }} aria-label="Filter by list" value={listFilter} onChange={e => setListFilter(e.target.value)} data-testid="select-filter-list"><option value="">All lists</option>{data.lists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select><select className="input" style={{ width: 'auto', minWidth: 124 }} aria-label="Filter by status" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} data-testid="select-filter-status"><option value="">Any status</option><option value="todo">To do</option><option value="in_progress">In progress</option><option value="done">Done</option></select><select className="input" style={{ width: 'auto', minWidth: 124 }} aria-label="Filter by priority" value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)} data-testid="select-filter-priority"><option value="">Any priority</option>{['urgent', 'high', 'medium', 'low'].map(p => <option key={p}>{p}</option>)}</select></div><div className="segmented" role="tablist" aria-label="Task view">{(['list', 'board', 'calendar'] as const).map(v => <button key={v} className={view === v ? 'selected' : ''} role="tab" aria-selected={view === v} onClick={() => setView(v)} data-testid={`button-view-${v}`}>{v === 'list' ? <List size={15} /> : v === 'board' ? <Columns3 size={15} /> : <CalendarDays size={15} />}{v}</button>)}</div></div>
          {api?.tasksError ? <div className="card" style={{ padding: 25 }} role="alert">We couldn't load your tasks. <button className="button" onClick={() => void client.invalidateQueries({ queryKey: getGetTasksQueryKey() })} data-testid="button-retry-tasks">Try again</button></div> : api?.tasksLoading ? <LoadingState /> : visibleTasks.length === 0 ? <div className="card"><EmptyState title={search ? 'No matching tasks' : viewSegment === 'overdue' ? 'Nothing overdue' : 'A clear page is a good place to start'} text={search ? 'Try another search or adjust the filters.' : 'Add one small next step and make it yours.'} action={<button className="button primary" onClick={() => setTaskDialog(null)} data-testid="button-empty-add-task"><Plus size={15} /> Add a task</button>} /></div> : view === 'list' ? <div className="card">{visibleTasks.map(t => <TaskRow key={t.id} task={t} list={data.lists.find(l => l.id === t.listId)} onToggle={toggleTask} onEdit={setTaskDialog} onDelete={removeTask} onDuplicate={duplicateTask} />)}</div> : view === 'board' ? <Board tasks={visibleTasks} lists={data.lists} onToggle={toggleTask} onEdit={setTaskDialog} /> : <CalendarView tasks={visibleTasks} />}
        </section>}
      </div>
    </main>
    {taskDialog !== false && <TaskDialog task={taskDialog} lists={data.lists} saving={createTaskApi.isPending || updateTaskApi.isPending} onClose={() => setTaskDialog(false)} onSave={saveTask} />}
    {listDialog !== false && <ListDialog list={listDialog} onClose={() => setListDialog(false)} onSave={saveList} onDelete={listDialog ? () => { removeList(listDialog); setListDialog(false); } : undefined} />}
    {roleModal && <RoleOnboarding initialRole={data.profile.role} onSave={setRoleAndLists} onSkip={() => { setRoleModal(false); localStorage.setItem('taskflow.onboarding.skipped', '1'); }} />}
    {toast && <Toast text={toast} close={() => setToast('')} />}
  </div>;
}

function Dashboard({ data, summary, progress, tasks, loading, onAdd, onToggle, onEdit, onNavigate }: { data: LocalModel; summary: DashboardSummary; progress: DailyProgress[]; tasks: Task[]; loading: boolean; onAdd: () => void; onToggle: (t: Task) => void; onEdit: (t: Task) => void; onNavigate: (path: string) => void }) {
  const today = getDateStamp(); const todays = tasks.filter(t => t.dueAt && getDateStamp(new Date(t.dueAt)) === today).sort((a, b) => a.position - b.position);
  const pct = summary.todayTotal ? Math.round(summary.todayCompleted / summary.todayTotal * 100) : 0;
  return <section>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 14, flexWrap: 'wrap' }}><div><p className="subtle" style={{ fontSize: 12, fontWeight: 700, margin: '0 0 6px' }}>{new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</p><h1 className="page-title" data-testid="text-greeting">{data.profile.role ? `You’ve got this, ${ROLE_NAMES[data.profile.role].split(' ')[0].toLowerCase()}.` : 'Let’s make today count.'}</h1><p className="subtle" style={{ fontSize: 13, margin: '8px 0 0' }}>Keep it simple. One thing at a time.</p></div><button className="button primary" onClick={onAdd} data-testid="button-dashboard-add-task"><Plus size={16} /> Add a task</button></div>
    <div className="stat-grid"><StatCard label="Today’s progress" value={`${summary.todayCompleted}/${summary.todayTotal}`} note={summary.todayTotal ? `${pct}% of today, at your pace` : 'Ready when you are'} icon={<Activity size={17} />} accent="#6654bd" /><StatCard label="Overdue" value={String(summary.overdueCount)} note={summary.overdueCount ? 'Take one thing off your plate' : 'Nothing hanging over you'} icon={<Clock3 size={17} />} accent="#d66b61" onClick={() => onNavigate('/app/overdue')} /><StatCard label="Done this week" value={String(summary.completedThisWeek)} note="Small wins add up" icon={<CheckCheck size={17} />} accent="#41987f" /><StatCard label="Current streak" value={`${summary.streak} days`} note="Showing up is the win" icon={<Flame size={17} />} accent="#d99739" /></div>
    <div className="dashboard-columns"><div>
      <div className="card"><div className="section-head"><div><h2>Today’s focus</h2><div className="subtle" style={{ marginTop: 4, fontSize: 11 }}>{summary.todayCompleted} of {summary.todayTotal} wrapped up</div></div><button className="button ghost" style={{ minHeight: 32 }} onClick={() => onNavigate('/app/today')} data-testid="button-view-today">View all <ArrowRight size={14} /></button></div><div style={{ padding: '0 20px 15px' }}><div className="progress-track"><div className="progress-fill" style={{ width: `${pct}%` }} /></div></div>
        {loading ? <div style={{ padding: 19 }}><LoadingState /></div> : todays.length ? todays.slice(0, 5).map(t => <TaskRow key={t.id} task={t} list={data.lists.find(l => l.id === t.listId)} onToggle={onToggle} onEdit={onEdit} compact />) : <EmptyState title="A little breathing room" text="Nothing planned for today yet. Add a task whenever you’re ready." action={<button className="button" onClick={onAdd} data-testid="button-focus-add"><Plus size={14} /> Add a task</button>} />}
      </div>
      <div className="card" style={{ marginTop: 18 }}><div className="section-head"><div><h2>Your week, so far</h2><div className="subtle" style={{ marginTop: 4, fontSize: 11 }}>Every completed task counts</div></div><span style={{ color: '#4a9b82', background: '#e5f4ed', borderRadius: 10, padding: 8 }}><TrendingUp size={17} /></span></div><WeekChart progress={progress} /></div>
    </div><div style={{ display: 'grid', gap: 18, alignContent: 'start' }}>
      <div className="card"><div className="section-head"><h2>Your lists</h2><button className="button ghost" style={{ minHeight: 31 }} onClick={() => onNavigate('/app/today')} data-testid="button-lists-tasks">Tasks <ArrowRight size={13} /></button></div>{data.lists.length ? data.lists.slice(0, 5).map(l => { const I = ICONS[l.icon] ?? Folder; return <button key={l.id} onClick={() => onNavigate(`/app/list-${l.id}`)} data-testid={`button-dashboard-list-${l.id}`} style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 11, padding: '12px 20px', textAlign: 'left', color: 'hsl(var(--foreground))', border: 0, background: 'transparent' }}><span style={{ width: 31, height: 31, display: 'grid', placeItems: 'center', color: l.color, background: `${l.color}20`, borderRadius: 10 }}><I size={15} /></span><span style={{ flex: 1, fontSize: 12, fontWeight: 700 }}>{l.name}</span><span className="subtle" style={{ fontSize: 11 }}>{tasks.filter(t => t.listId === l.id && t.status !== 'done').length}</span></button>; }) : <div className="empty-state" style={{ padding: '20px 15px' }}><Folder size={24} /><h3>No lists yet</h3><p>Choose a starter set or make your own.</p><button className="button" onClick={() => onNavigate('/settings')} data-testid="button-choose-starter">Choose a starter set</button></div>}</div>
      <div className="card" style={{ padding: 19, background: 'linear-gradient(135deg,#f1efff,#e9f7f2)' }}><div style={{ display: 'flex', gap: 11, alignItems: 'start' }}><span style={{ color: '#6654bd', background: '#fff', padding: 9, borderRadius: 11 }}><WandSparkles size={18} /></span><div><strong style={{ fontSize: 13 }}>Make it feel like yours</strong><p style={{ margin: '5px 0 11px', fontSize: 11, color: '#666179', lineHeight: 1.5 }}>Set up lists that fit your day — and keep changing them as life does.</p><button className="button" style={{ minHeight: 33, background: 'white' }} onClick={() => onNavigate('/settings')} data-testid="button-personalize">Personalize TaskFlow <ArrowRight size={13} /></button></div></div></div>
    </div></div>
  </section>;
}
function StatCard({ label, value, note, icon, accent, onClick }: { label: string; value: string; note: string; icon: ReactNode; accent: string; onClick?: () => void }) {
  return <div className="card stat-card" onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }} data-testid={`card-stat-${label.toLowerCase().replaceAll(/[^a-z]+/g, '-')}`}><div className="stat-heading">{label}<span style={{ display: 'grid', placeItems: 'center', width: 31, height: 31, color: accent, background: `${accent}17`, borderRadius: 10 }}>{icon}</span></div><div className="stat-value" data-testid={`text-stat-${label.toLowerCase().replaceAll(/[^a-z]+/g, '-')}`}>{value}</div><div className="stat-caption">{note}</div></div>;
}
function WeekChart({ progress }: { progress: DailyProgress[] }) {
  const max = Math.max(2, ...progress.map(p => p.completed)); return <div className="week-chart" data-testid="chart-weekly-progress">{progress.slice(-7).map(p => {
    const date = new Date(`${p.date}T12:00:00`); const today = getDateStamp(date) === getDateStamp();
    return <div className={`week-day ${today ? 'today' : ''}`} key={p.date} data-testid={`progress-day-${p.date}`}><span>{p.completed || ''}</span><div className="week-bar" style={{ height: `${Math.max(5, p.completed / max * 72)}px` }} /><span>{date.toLocaleDateString([], { weekday: 'short' }).slice(0, 2)}</span></div>;
  })}</div>;
}

function TaskRow({ task, list, onToggle, onEdit, onDelete, onDuplicate, compact = false }: { task: Task; list?: TaskList; onToggle: (t: Task) => void; onEdit: (t: Task) => void; onDelete?: (t: Task) => void; onDuplicate?: (t: Task) => void; compact?: boolean }) {
  const [menu, setMenu] = useState(false);
  return <div className={`task-row ${task.status === 'done' ? 'is-done' : ''}`} data-testid={`row-task-${task.id}`}><button className={`task-check ${task.status === 'done' ? 'checked' : ''}`} aria-label={`${task.status === 'done' ? 'Reopen' : 'Complete'} ${task.title}`} onClick={() => onToggle(task)} data-testid={`button-complete-${task.id}`}>{task.status === 'done' && <Check size={14} />}</button><button onClick={() => onEdit(task)} style={{ padding: 0, textAlign: 'left', border: 0, background: 'transparent', color: 'inherit', minWidth: 0 }} data-testid={`button-edit-task-${task.id}`}><div className="task-title">{task.title}</div><div className="task-meta"><span className={`priority priority-${task.priority}`}>{task.priority}</span>{!compact && task.dueAt && <span><Clock3 size={11} style={{ verticalAlign: 'middle' }} /> {taskDueLabel(task)}</span>}{list && <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: list.color }} />{list.name}</span>}{task.subtasks.length > 0 && <span>{task.subtasks.filter(s => s.completed).length}/{task.subtasks.length} steps</span>}</div></button><div className="task-actions">{onDuplicate && <button className="icon-button" style={{ width: 30, height: 30, border: 0, background: 'transparent' }} title="Duplicate task" onClick={() => onDuplicate(task)} data-testid={`button-duplicate-${task.id}`}><Grid2X2 size={14} /></button>}{(onDelete || onDuplicate) && <div style={{ position: 'relative' }}><button className="icon-button" style={{ width: 30, height: 30, border: 0, background: 'transparent' }} aria-label="More task actions" onClick={() => setMenu(!menu)} data-testid={`button-more-${task.id}`}><MoreHorizontal size={16} /></button>{menu && <div style={{ position: 'absolute', right: 0, top: 32, zIndex: 10, minWidth: 132, padding: 5, background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 10, boxShadow: '0 8px 20px #201a3520' }}>{onDuplicate && <button className="nav-link" style={{ width: '100%' }} onClick={() => { onDuplicate(task); setMenu(false); }} data-testid={`button-menu-duplicate-${task.id}`}>Duplicate</button>}{onDelete && <button className="nav-link" style={{ width: '100%', color: 'hsl(var(--destructive))' }} onClick={() => { onDelete(task); setMenu(false); }} data-testid={`button-delete-${task.id}`}>Delete task</button>}</div>}</div>}</div></div>;
}
function Board({ tasks, lists, onToggle, onEdit }: { tasks: Task[]; lists: TaskList[]; onToggle: (t: Task) => void; onEdit: (t: Task) => void }) {
  const statuses = [{ id: 'todo', label: 'To do' }, { id: 'in_progress', label: 'In progress' }, { id: 'done', label: 'Done' }];
  return <div className="board" data-testid="task-board">{statuses.map(s => <section className="board-column" key={s.id} data-testid={`board-column-${s.id}`}><div className="board-title"><span>{s.label}</span><span className="subtle">{tasks.filter(t => t.status === s.id).length}</span></div>{tasks.filter(t => t.status === s.id).map(t => <div className="board-card" role="button" tabIndex={0} key={t.id} onClick={() => onEdit(t)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onEdit(t); }} data-testid={`card-task-${t.id}`}><div style={{ display: 'flex', gap: 7 }}><button className={`task-check ${t.status === 'done' ? 'checked' : ''}`} onClick={e => { e.stopPropagation(); onToggle(t); }} aria-label={`Complete ${t.title}`}><Check size={12} /></button><span className="task-title">{t.title}</span></div><div className="task-meta"><span className={`priority priority-${t.priority}`}>{t.priority}</span>{lists.find(l => l.id === t.listId)?.name}</div></div>)}</section>)}</div>;
}
function CalendarView({ tasks }: { tasks: Task[] }) {
  const [month, setMonth] = useState(new Date());
  const year = month.getFullYear(), m = month.getMonth(); const first = new Date(year, m, 1); const start = (first.getDay() + 6) % 7; const days = new Date(year, m + 1, 0).getDate();
  const cells = Array.from({ length: Math.ceil((start + days) / 7) * 7 }, (_, i) => i - start + 1);
  return <div className="card" data-testid="calendar-view"><div className="section-head"><div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><h2>{month.toLocaleDateString([], { month: 'long', year: 'numeric' })}</h2><button className="icon-button" onClick={() => setMonth(new Date(year, m - 1, 1))} aria-label="Previous month"><ArrowLeft size={15} /></button><button className="icon-button" onClick={() => setMonth(new Date(year, m + 1, 1))} aria-label="Next month"><ArrowRight size={15} /></button></div><button className="button" onClick={() => setMonth(new Date())} data-testid="button-calendar-today">Today</button></div><div className="calendar-grid">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => <div key={d} className="subtle" style={{ textAlign: 'center', fontSize: 10, fontWeight: 700 }}>{d}</div>)}{cells.map((d, i) => { const valid = d > 0 && d <= days; const date = valid ? getDateStamp(new Date(year, m, d)) : ''; const due = tasks.filter(t => t.dueAt && getDateStamp(new Date(t.dueAt)) === date); return <div key={i} className={`calendar-day ${date === getDateStamp() ? 'today' : ''}`}><span>{valid ? d : ''}</span>{due.slice(0, 2).map(t => <div className="calendar-event" key={t.id} title={t.title}>{t.title}</div>)}</div>; })}</div></div>;
}

function TaskDialog({ task, lists, saving, onClose, onSave }: { task: Task | null; lists: TaskList[]; saving: boolean; onClose: () => void; onSave: (task: Task | null, input: TaskInput) => void }) {
  const [title, setTitle] = useState(task?.title ?? ''); const [description, setDescription] = useState(task?.description ?? ''); const [due, setDue] = useState(task?.dueAt ? task.dueAt.slice(0, 16) : ''); const [priority, setPriority] = useState<Task['priority']>(task?.priority ?? 'medium'); const [status, setStatus] = useState<Task['status']>(task?.status ?? 'todo'); const [listId, setListId] = useState(task?.listId ?? ''); const [tags, setTags] = useState(task?.tags.join(', ') ?? ''); const [estimatedMinutes, setEstimatedMinutes] = useState(task?.estimatedMinutes?.toString() ?? ''); const [recurrence, setRecurrence] = useState<Task['recurrence']>(task?.recurrence ?? 'none'); const [reminder, setReminder] = useState(task?.reminderAt ? task.reminderAt.slice(0, 16) : ''); const [subtasks, setSubtasks] = useState(task?.subtasks.map(s => s.title).join('\n') ?? '');
  const submit = (e: FormEvent) => { e.preventDefault(); if (!title.trim()) return; onSave(task, { title: title.trim(), description: description.trim() || null, dueAt: due ? new Date(due).toISOString() : null, priority, status, listId: listId || null, tags: tags.split(',').map(t => t.trim()).filter(Boolean), subtasks: subtasks.split('\n').map(title => title.trim()).filter(Boolean).map(title => task?.subtasks.find(s => s.title === title) ?? { id: newId(), title, completed: false }), recurrence, reminderAt: reminder ? new Date(reminder).toISOString() : null, estimatedMinutes: estimatedMinutes ? Number(estimatedMinutes) : null, archived: task?.archived ?? false, position: task?.position ?? 0 }); };
  return <div className="overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><form className="dialog" onSubmit={submit} data-testid="form-task"><div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between' }}><div><h2>{task ? 'A quick edit' : 'Add a task'}</h2><span className="subtle" style={{ fontSize: 12 }}>Keep it clear and doable.</span></div><button type="button" className="icon-button" onClick={onClose} aria-label="Close task form" data-testid="button-close-task"><X size={17} /></button></div><div className="form-stack"><div><label className="label" htmlFor="task-title">Task name</label><input id="task-title" className="input" required maxLength={240} autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="What needs doing?" data-testid="input-task-title" /></div><div><label className="label" htmlFor="task-description">Notes</label><textarea id="task-description" className="input" rows={2} value={description} onChange={e => setDescription(e.target.value)} placeholder="Add a little context (optional)" data-testid="input-task-description" /></div><div className="form-row"><div><label className="label" htmlFor="task-due">Due date</label><input id="task-due" className="input" type="datetime-local" value={due} onChange={e => setDue(e.target.value)} data-testid="input-task-due" /></div><div><label className="label" htmlFor="task-priority">Priority</label><select id="task-priority" className="input" value={priority} onChange={e => setPriority(e.target.value as Task['priority'])} data-testid="select-task-priority">{['low', 'medium', 'high', 'urgent'].map(p => <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>)}</select></div></div><div className="form-row"><div><label className="label" htmlFor="task-list">List</label><select id="task-list" className="input" value={listId} onChange={e => setListId(e.target.value)} data-testid="select-task-list"><option value="">No list</option>{lists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></div><div><label className="label" htmlFor="task-status">Status</label><select id="task-status" className="input" value={status} onChange={e => setStatus(e.target.value as Task['status'])} data-testid="select-task-status"><option value="todo">To do</option><option value="in_progress">In progress</option><option value="done">Done</option></select></div></div><div className="form-row"><div><label className="label" htmlFor="task-recurrence">Repeats</label><select id="task-recurrence" className="input" value={recurrence} onChange={e => setRecurrence(e.target.value as Task['recurrence'])} data-testid="select-task-recurrence">{['none', 'daily', 'weekly', 'monthly'].map(v => <option key={v} value={v}>{v === 'none' ? 'Does not repeat' : v === 'daily' ? 'Every day' : v === 'weekly' ? 'Every week' : 'Every month'}</option>)}</select></div><div><label className="label" htmlFor="task-reminder">Reminder</label><input id="task-reminder" className="input" type="datetime-local" value={reminder} onChange={e => setReminder(e.target.value)} data-testid="input-task-reminder" /></div></div><div className="form-row"><div><label className="label" htmlFor="task-tags">Tags</label><input id="task-tags" className="input" value={tags} onChange={e => setTags(e.target.value)} placeholder="comma, separated" data-testid="input-task-tags" /></div><div><label className="label" htmlFor="task-time">Time estimate (minutes)</label><input id="task-time" className="input" type="number" min="1" value={estimatedMinutes} onChange={e => setEstimatedMinutes(e.target.value)} placeholder="Optional" data-testid="input-task-estimate" /></div></div><div><label className="label" htmlFor="task-subtasks">Subtasks <span className="subtle" style={{ fontWeight: 400 }}>(one per line)</span></label><textarea id="task-subtasks" className="input" rows={2} value={subtasks} onChange={e => setSubtasks(e.target.value)} placeholder="Add the next small steps" data-testid="input-task-subtasks" /></div></div><div className="dialog-actions"><button type="button" className="button" onClick={onClose} data-testid="button-cancel-task">Cancel</button><button type="submit" className="button primary" disabled={saving} data-testid="button-save-task">{saving ? <LoaderCircle size={15} /> : <Check size={15} />}{task ? 'Save changes' : 'Add task'}</button></div></form></div>;
}

function ListDialog({ list, onClose, onSave, onDelete }: { list: TaskList | null; onClose: () => void; onSave: (list: TaskList | null, input: TaskListInput) => void; onDelete?: () => void }) {
  const [name, setName] = useState(list?.name ?? ''); const [color, setColor] = useState(list?.color ?? '#8270d5'); const [icon, setIcon] = useState(list?.icon ?? 'folder');
  const colors = ['#8270d5', '#54a992', '#e8a94d', '#e98278', '#559bc0', '#b56ba1']; const icons = ['book', 'briefcase', 'calendar', 'folder', 'check', 'sparkles', 'zap', 'graduation'];
  return <div className="overlay"><form className="dialog" onSubmit={e => { e.preventDefault(); if (name.trim()) onSave(list, { name: name.trim(), color, icon, position: list?.position ?? 0 }); }}><div style={{ display: 'flex', justifyContent: 'space-between' }}><div><h2>{list ? 'Edit list' : 'A new list'}</h2><span className="subtle" style={{ fontSize: 12 }}>Give this corner of your life a name.</span></div><button className="icon-button" type="button" onClick={onClose} aria-label="Close list form"><X size={16} /></button></div><div className="form-stack"><div><label className="label" htmlFor="list-name">Name</label><input id="list-name" className="input" value={name} required maxLength={80} autoFocus onChange={e => setName(e.target.value)} data-testid="input-list-name" /></div><div><span className="label">Choose a color</span><div style={{ display: 'flex', gap: 10 }}>{colors.map(c => <button type="button" key={c} aria-label={`Color ${c}`} onClick={() => setColor(c)} style={{ width: 29, height: 29, borderRadius: 9, border: color === c ? '3px solid hsl(var(--foreground))' : '2px solid transparent', background: c }} data-testid={`button-list-color-${c.slice(1)}`} />)}</div></div><div><span className="label">Pick an icon</span><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{icons.map(i => <button type="button" key={i} onClick={() => setIcon(i)} className="icon-button" style={{ color: icon === i ? 'hsl(var(--primary))' : 'inherit', borderColor: icon === i ? 'hsl(var(--primary))' : undefined }} aria-label={`Icon ${i}`} data-testid={`button-list-icon-${i}`}><Icon name={i} /></button>)}</div></div></div><div className="dialog-actions">{onDelete && <button type="button" className="button danger" style={{ marginRight: 'auto' }} onClick={onDelete} data-testid="button-delete-list"><Trash2 size={14} /> Delete list</button>}<button type="button" className="button" onClick={onClose}>Cancel</button><button type="submit" className="button primary" data-testid="button-save-list">Save list</button></div></form></div>;
}

function RoleOnboarding({ initialRole, onSave, onSkip }: { initialRole: Role | null; onSave: (role: Role | null, customRole: string | null, lists: StarterList[]) => void; onSkip: () => void }) {
  const [step, setStep] = useState<'role' | 'preview'>('role'); const [role, setRole] = useState<Role | null>(initialRole); const [custom, setCustom] = useState(''); const [templates, setTemplates] = useState<StarterList[]>([]);
  const choose = (r: Role) => { setRole(r); setTemplates(roleTemplates[r].map(x => ({ ...x, tasks: x.tasks?.map(task => ({ ...task, tags: [...task.tags] })) ?? [] }))); };
  const save = () => { onSave(role, role === 'other' ? custom || 'Other' : null, templates); localStorage.setItem('taskflow.onboarding.skipped', '1'); };
  return <div className="overlay"><div className="dialog" style={{ width: 'min(650px,100%)' }} data-testid="dialog-role-onboarding"><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}><div><span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', color: '#6956bd', fontSize: 11, fontWeight: 800 }}><Sparkles size={14} /> YOUR WORKSPACE, YOUR WAY</span><h2 style={{ marginTop: 8 }}>{step === 'role' ? 'What does your day look like?' : 'A first draft, just for you.'}</h2><p className="subtle" style={{ fontSize: 12, marginBottom: 0 }}>{step === 'role' ? 'We’ll suggest a few helpful lists. You can change everything later.' : 'Rename or remove anything before you make these lists yours.'}</p></div><button type="button" className="icon-button" onClick={onSkip} aria-label="Skip setup" data-testid="button-skip-onboarding"><X size={16} /></button></div>
    {step === 'role' ? <><div className="role-grid" style={{ marginTop: 22 }}>{roleKeys.map(r => <button type="button" className={`role-option ${role === r ? 'selected' : ''}`} onClick={() => choose(r)} key={r} data-testid={`button-role-${r}`}><span style={{ display: 'flex', gap: 9, alignItems: 'center' }}>{r === 'school' || r === 'college' ? <GraduationCap size={16} /> : r === 'professional' || r === 'freelancer' ? <BriefcaseBusiness size={16} /> : r === 'developer' ? <Zap size={16} /> : r === 'teacher' ? <BookOpen size={16} /> : r === 'personal' ? <UserRound size={16} /> : <Sparkles size={16} />}{ROLE_NAMES[r]}</span></button>)}</div>{role === 'other' && <div style={{ marginTop: 13 }}><label className="label" htmlFor="custom-role">What would you call it?</label><input id="custom-role" className="input" value={custom} onChange={e => setCustom(e.target.value)} placeholder="Your kind of day" data-testid="input-custom-role" /></div>}<div className="dialog-actions"><button className="button ghost" type="button" onClick={() => { onSkip(); }} data-testid="button-start-blank">Start with a blank page</button><button className="button primary" type="button" disabled={!role} onClick={() => { if (role) setStep('preview'); }} data-testid="button-preview-template">See my starter lists <ArrowRight size={14} /></button></div></> :
    <><div style={{ display: 'grid', gap: 9, marginTop: 20 }}>{templates.map((t, i) => <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: 10, border: '1px solid hsl(var(--border))', borderRadius: 12 }}><span style={{ display: 'grid', placeItems: 'center', width: 31, height: 31, color: t.color, background: `${t.color}20`, borderRadius: 9 }}><Icon name={t.icon} size={15} /></span><input className="input" value={t.name} onChange={e => setTemplates(ts => ts.map((x, j) => i === j ? { ...x, name: e.target.value } : x))} aria-label={`Starter list ${i + 1}`} data-testid={`input-template-${i}`} /><button className="icon-button" type="button" aria-label={`Remove ${t.name}`} onClick={() => setTemplates(ts => ts.filter((_, j) => i !== j))} data-testid={`button-remove-template-${i}`}><X size={14} /></button></div>)}</div><button className="button" style={{ marginTop: 11 }} type="button" onClick={() => setTemplates(ts => [...ts, { name: 'A new list', icon: 'folder', color: '#8270d5' }])} data-testid="button-add-template"><Plus size={14} /> Add a list</button><div className="dialog-actions"><button className="button" type="button" onClick={() => setStep('role')} data-testid="button-back-role"><ArrowLeft size={14} /> Back</button><button className="button primary" type="button" onClick={save} data-testid="button-save-template"><Check size={15} /> Make it mine</button></div></>}</div></div>;
}
export default App;