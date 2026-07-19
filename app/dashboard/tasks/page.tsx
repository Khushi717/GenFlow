'use client';

import React, { useEffect, useState, useRef } from 'react';
import useAuth from '@/hooks/useAuth';
import useToast from '@/hooks/useToast';
import { dbService } from '@/services/db';
import { suggestTasksBreakdown, suggestTasksFromDashboard } from '@/services/gemini';
import { Task, Priority, TaskStatus } from '@/types';
import Modal from '@/components/ui/Modal';
import {
  Sparkles,
  Plus,
  LayoutGrid,
  List,
  Search,
  Calendar,
  Clock,
  Tag,
  Flag,
  ClipboardCheck,
  MoreHorizontal,
  Pencil,
  Trash2,
  Copy,
  Archive,
  CheckCircle2,
  ChevronDown,
  GripVertical,
  Zap,
  X,
  Filter,
  ArrowUpDown,
  Loader2,
} from 'lucide-react';

/* ─────────────────────────────── types ───────────────────────────────── */

type ExtendedTaskStatus = 'todo' | 'in_progress' | 'in_review' | 'completed';

/* ─────────────────────────────── constants ──────────────────────────── */

const COLUMNS: {
  title: string;
  status: ExtendedTaskStatus;
  dot: string;
  glow: string;
  border: string;
  badge: string;
}[] = [
  {
    title: 'To Do',
    status: 'todo',
    dot: 'bg-violet-400',
    glow: 'hover:border-violet-500/40',
    border: 'border-violet-500/20',
    badge: 'bg-violet-500/10 text-violet-400',
  },
  {
    title: 'In Progress',
    status: 'in_progress',
    dot: 'bg-sky-400',
    glow: 'hover:border-sky-500/40',
    border: 'border-sky-500/20',
    badge: 'bg-sky-500/10 text-sky-400',
  },
  {
    title: 'In Review',
    status: 'in_review',
    dot: 'bg-amber-400',
    glow: 'hover:border-amber-500/40',
    border: 'border-amber-500/20',
    badge: 'bg-amber-500/10 text-amber-400',
  },
  {
    title: 'Completed',
    status: 'completed',
    dot: 'bg-emerald-400',
    glow: 'hover:border-emerald-500/40',
    border: 'border-emerald-500/20',
    badge: 'bg-emerald-500/10 text-emerald-400',
  },
];

const PRIORITY_MAP: Record<
  string,
  { label: string; color: string; bg: string; dot: string }
> = {
  high: {
    label: 'High',
    color: 'text-rose-400',
    bg: 'bg-rose-500/10 border-rose-500/25',
    dot: 'bg-rose-400',
  },
  medium: {
    label: 'Medium',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/25',
    dot: 'bg-amber-400',
  },
  low: {
    label: 'Low',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/25',
    dot: 'bg-emerald-400',
  },
};

const CONFIDENCE_LABELS = [72, 84, 91, 78, 88, 95, 76, 82];
const DURATION_LABELS = ['~30 min', '~1 hr', '~2 hrs', '~45 min', '~1.5 hrs', '~3 hrs', '~20 min', '~4 hrs'];

/* ─────────────────────── sub-components ─────────────────────────────── */

/** Priority chip */
function PriorityBadge({ priority }: { priority: string }) {
  const p = PRIORITY_MAP[priority] || PRIORITY_MAP.medium;
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${p.bg} ${p.color}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${p.dot}`} />
      {p.label}
    </span>
  );
}

/** Category chip */
function CategoryBadge({ category }: { category: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/[0.08] text-zinc-400">
      <Tag size={9} />
      {category || 'General'}
    </span>
  );
}

/** Three-dot context menu */
function CardMenu({
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.06] transition-all focus:outline-none"
      >
        <MoreHorizontal size={15} />
      </button>
      {open && (
        <div className="absolute right-0 top-[calc(100%+4px)] z-50 w-40 bg-[#1E1E2A] border border-white/[0.10] rounded-xl shadow-2xl shadow-black/60 overflow-hidden animate-fade-in">
          {[
            { icon: Pencil, label: 'Edit', action: () => { onEdit(); setOpen(false); } },
            { icon: Copy, label: 'Duplicate', action: () => setOpen(false) },
            { icon: Archive, label: 'Archive', action: () => setOpen(false) },
            { icon: Trash2, label: 'Delete', action: () => { onDelete(); setOpen(false); }, danger: true },
          ].map(({ icon: Icon, label, action, danger }) => (
            <button
              key={label}
              onClick={action}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-[12px] font-medium transition-colors ${
                danger
                  ? 'text-rose-400 hover:bg-rose-500/10'
                  : 'text-zinc-400 hover:text-white hover:bg-white/[0.05]'
              }`}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Task card */
function TaskCard({
  task,
  onEdit,
  onDelete,
  onBreakdown,
  isBreaking,
  breakdown,
  onDragStart,
}: {
  task: Task;
  onEdit: () => void;
  onDelete: () => void;
  onBreakdown: () => void;
  isBreaking: boolean;
  breakdown: string[] | undefined;
  onDragStart: (e: React.DragEvent) => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="group relative bg-[#1B1B24] border border-white/[0.06] rounded-xl p-5 hover:bg-[#22222E] hover:border-white/[0.12] hover:shadow-xl hover:shadow-black/40 hover:-translate-y-0.5 transition-all duration-200 cursor-grab active:cursor-grabbing active:scale-[0.98] active:shadow-2xl"
    >
      {/* Drag handle */}
      <div className="absolute left-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-40 transition-opacity">
        <GripVertical size={14} className="text-zinc-500" />
      </div>

      {/* Top row */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <CategoryBadge category={task.category} />
          {task.suggestedByAI && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400">
              <Sparkles size={9} />
              AI
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <PriorityBadge priority={task.priority} />
          <CardMenu onEdit={onEdit} onDelete={onDelete} />
        </div>
      </div>

      {/* Title */}
      <h4 className="text-[15px] font-semibold text-white mb-1.5 leading-snug line-clamp-2">
        {task.title}
      </h4>

      {/* Description */}
      <p className="text-[12px] text-zinc-500 mb-4 line-clamp-2 leading-relaxed">
        {task.description || 'No description provided.'}
      </p>

      {/* AI Breakdown sub-tasks */}
      {breakdown && breakdown.length > 0 && (
        <div className="mb-4 pt-3 border-t border-white/[0.06]">
          <p className="text-[11px] font-semibold text-violet-400 flex items-center gap-1 mb-2">
            <Sparkles size={10} />
            AI Sub-tasks
          </p>
          <div className="space-y-1">
            {breakdown.map((sub, i) => (
              <div key={i} className="flex items-start gap-1.5 text-[11px] text-zinc-400">
                <CheckCircle2 size={10} className="text-violet-400 mt-0.5 flex-shrink-0" />
                <span className="leading-snug">{sub}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-white/[0.05]">
        <div className="flex items-center gap-3">
          {task.dueDate && (
            <div className="flex items-center gap-1 text-[11px] text-zinc-600">
              <Calendar size={11} />
              <span>{task.dueDate}</span>
            </div>
          )}
          <div className="flex items-center gap-1 text-[11px] text-zinc-600">
            <Clock size={11} />
            <span>~1 hr</span>
          </div>
        </div>

        {/* AI breakdown button */}
        <button
          onClick={onBreakdown}
          disabled={isBreaking}
          title="Break down with AI"
          className="flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-400 hover:bg-violet-500/20 hover:text-violet-300 transition-all focus:outline-none disabled:opacity-50"
        >
          {isBreaking ? (
            <Loader2 size={11} className="animate-spin" />
          ) : (
            <Zap size={11} />
          )}
          <span>{breakdown ? 'Hide' : 'AI'}</span>
        </button>
      </div>
    </div>
  );
}

/** Kanban column */
function KanbanColumn({
  col,
  tasks,
  onDragOver,
  onDrop,
  onEdit,
  onDelete,
  onBreakdown,
  breakingTaskId,
  taskBreakdowns,
  onDragStart,
  onAddTask,
}: {
  col: typeof COLUMNS[number];
  tasks: Task[];
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, status: ExtendedTaskStatus) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onBreakdown: (task: Task) => void;
  breakingTaskId: string | null;
  taskBreakdowns: Record<string, string[]>;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onAddTask: () => void;
}) {
  const [isDragOver, setIsDragOver] = useState(false);

  return (
    <div
      onDragOver={(e) => { onDragOver(e); setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => { onDrop(e, col.status); setIsDragOver(false); }}
      className={`flex flex-col gap-3 bg-[#111118] rounded-2xl p-4 min-h-[700px] border transition-all duration-200 ${
        isDragOver
          ? `${col.border} shadow-lg`
          : 'border-white/[0.05]'
      }`}
    >
      {/* Column header */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${col.dot} shadow-lg`} style={{ boxShadow: `0 0 8px currentColor` }} />
          <h3 className="text-[13px] font-semibold text-white">{col.title}</h3>
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${col.badge}`}>
            {tasks.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onAddTask}
            className="w-6 h-6 rounded-lg flex items-center justify-center text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.06] transition-all"
            title={`Add task to ${col.title}`}
          >
            <Plus size={14} />
          </button>
          <button className="w-6 h-6 rounded-lg flex items-center justify-center text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.06] transition-all">
            <MoreHorizontal size={14} />
          </button>
        </div>
      </div>

      {/* Drop zone / empty state */}
      {tasks.length === 0 ? (
        <div
          className={`flex-1 flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed transition-all ${
            isDragOver ? `${col.border} bg-white/[0.02]` : 'border-white/[0.06]'
          }`}
        >
          <div className="w-12 h-12 rounded-2xl bg-white/[0.04] flex items-center justify-center">
            <ClipboardCheck size={22} className="text-zinc-700" />
          </div>
          <div className="text-center">
            <p className="text-[13px] font-semibold text-zinc-600">No tasks here</p>
            <p className="text-[11px] text-zinc-700 mt-0.5">Drag cards here or add a task</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onEdit={() => onEdit(task)}
              onDelete={() => onDelete(task.id)}
              onBreakdown={() => onBreakdown(task)}
              isBreaking={breakingTaskId === task.id}
              breakdown={taskBreakdowns[task.id]}
              onDragStart={(e) => onDragStart(e, task.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** AI Suggestion card */
function AISuggestionCard({
  suggestion,
  index,
  onAdd,
}: {
  suggestion: string;
  index: number;
  onAdd: () => void;
}) {
  const conf = CONFIDENCE_LABELS[index % CONFIDENCE_LABELS.length];
  const dur = DURATION_LABELS[index % DURATION_LABELS.length];
  const priorities = ['high', 'medium', 'low'] as const;
  const pri = priorities[index % 3];

  return (
    <div className="flex-shrink-0 w-[300px] bg-[#1B1B24] border border-white/[0.07] rounded-2xl p-4 flex flex-col gap-3 hover:border-violet-500/30 hover:bg-[#1E1E2E] hover:-translate-y-0.5 hover:shadow-xl hover:shadow-violet-500/10 transition-all duration-200 cursor-default">
      {/* Top */}
      <div className="flex items-start justify-between gap-2">
        <div className="w-8 h-8 rounded-xl bg-violet-500/15 flex items-center justify-center flex-shrink-0">
          <Sparkles size={15} className="text-violet-400" />
        </div>
        <PriorityBadge priority={pri} />
      </div>

      {/* Title */}
      <p className="text-[13px] font-semibold text-white leading-snug line-clamp-2">{suggestion}</p>

      {/* Meta */}
      <div className="flex items-center gap-2 text-[11px] text-zinc-500">
        <span className="flex items-center gap-1">
          <Clock size={10} />
          {dur}
        </span>
        <span className="text-zinc-700">·</span>
        <span className="flex items-center gap-1">
          <Zap size={10} className="text-violet-400" />
          <span className="text-violet-400 font-semibold">{conf}%</span>
          <span>confidence</span>
        </span>
      </div>

      {/* Add button */}
      <button
        onClick={onAdd}
        className="w-full h-8 mt-auto rounded-xl text-[12px] font-semibold flex items-center justify-center gap-1.5 bg-violet-500/10 border border-violet-500/20 text-violet-400 hover:bg-violet-500/20 hover:text-violet-300 transition-all"
      >
        <Plus size={13} />
        Add to Board
      </button>
    </div>
  );
}

/* ─────────────────────── main page ──────────────────────────────────── */

export default function TasksPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'kanban' | 'list'>('kanban');

  // Search & Filter
  const [search, setSearch] = useState('');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  // AI Suggestions
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  // Task Breakdown
  const [breakingTaskId, setBreakingTaskId] = useState<string | null>(null);
  const [taskBreakdowns, setTaskBreakdowns] = useState<{ [taskId: string]: string[] }>({});

  // Modals state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // Form fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [category, setCategory] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState<ExtendedTaskStatus>('todo');

  const categories = Array.from(new Set(tasks.map((t) => t.category).filter(Boolean)));

  useEffect(() => {
    if (!user) return;
    loadTasks();
  }, [user]);

  async function loadTasks() {
    try {
      const data = await dbService.getTasks(user!.uid);
      setTasks(data);
      loadAISuggestions(data.map((t) => t.title));
    } catch (err) {
      console.error(err);
      toast('Failed to load tasks.', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function loadAISuggestions(taskTitles: string[]) {
    setLoadingSuggestions(true);
    try {
      const suggestions = await suggestTasksFromDashboard(taskTitles);
      setAiSuggestions(suggestions);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSuggestions(false);
    }
  }

  const handleOpenAddModal = (defaultStatus: ExtendedTaskStatus = 'todo') => {
    setEditingTask(null);
    setTitle('');
    setDescription('');
    setPriority('medium');
    setCategory('General');
    setDueDate(new Date().toISOString().split('T')[0]);
    setStatus(defaultStatus);
    setModalOpen(true);
  };

  const handleOpenEditModal = (task: Task) => {
    setEditingTask(task);
    setTitle(task.title);
    setDescription(task.description);
    setPriority(task.priority);
    setCategory(task.category || 'General');
    setDueDate(task.dueDate || new Date().toISOString().split('T')[0]);
    setStatus(task.status as ExtendedTaskStatus);
    setModalOpen(true);
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast('Task title is required.', 'error');
      return;
    }
    try {
      const taskData = { title, description, priority, category, dueDate, status: status as TaskStatus };
      if (editingTask) {
        await dbService.saveTask(user!.uid, { ...taskData, id: editingTask.id });
        toast('Task updated successfully.', 'success');
      } else {
        await dbService.saveTask(user!.uid, taskData);
        toast('Task created successfully.', 'success');
      }
      setModalOpen(false);
      loadTasks();
    } catch {
      toast('Failed to save task.', 'error');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    try {
      await dbService.deleteTask(user!.uid, taskId);
      toast('Task deleted successfully.', 'success');
      loadTasks();
    } catch {
      toast('Failed to delete task.', 'error');
    }
  };

  const handleAddSuggestedTask = async (suggestedTitle: string) => {
    try {
      await dbService.saveTask(user!.uid, {
        title: suggestedTitle,
        description: 'Suggested by GenFlow AI based on your current workload.',
        priority: 'medium',
        category: 'AI Recommendation',
        dueDate: new Date().toISOString().split('T')[0],
        status: 'todo',
        suggestedByAI: true,
      });
      toast(`Added: "${suggestedTitle}"`, 'success');
      loadTasks();
    } catch {
      toast('Failed to add suggested task.', 'error');
    }
  };

  const handleBreakdownTask = async (task: Task) => {
    if (taskBreakdowns[task.id]) {
      const updated = { ...taskBreakdowns };
      delete updated[task.id];
      setTaskBreakdowns(updated);
      return;
    }
    setBreakingTaskId(task.id);
    try {
      const breakdown = await suggestTasksBreakdown(task.title, task.description);
      setTaskBreakdowns((prev) => ({ ...prev, [task.id]: breakdown }));
      toast('Gemini generated sub-tasks successfully!', 'success');
    } catch {
      toast('Failed to generate sub-tasks.', 'error');
    } finally {
      setBreakingTaskId(null);
    }
  };

  // Drag and Drop (unchanged logic)
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('text/plain', taskId);
  };
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };
  const handleDrop = async (e: React.DragEvent, targetStatus: ExtendedTaskStatus) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    if (!taskId) return;
    const targetTask = tasks.find((t) => t.id === taskId);
    if (!targetTask || targetTask.status === targetStatus) return;
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: targetStatus as TaskStatus } : t))
    );
    try {
      await dbService.saveTask(user!.uid, { ...targetTask, status: targetStatus as TaskStatus });
      toast(`Moved to ${targetStatus.replace('_', ' ')}`, 'success');
    } catch {
      loadTasks();
      toast('Failed to move task.', 'error');
    }
  };

  // Filtering Logic (unchanged)
  const filteredTasks = tasks.filter((t) => {
    const matchesSearch =
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase()) ||
      t.category.toLowerCase().includes(search.toLowerCase());
    const matchesPriority = filterPriority === 'all' || t.priority === filterPriority;
    const matchesCategory = filterCategory === 'all' || t.category === filterCategory;
    return matchesSearch && matchesPriority && matchesCategory;
  });

  /* ─── Loading ─── */
  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <div className="flex justify-between items-center">
          <div className="space-y-2">
            <div className="h-9 w-56 bg-white/[0.04] rounded-xl animate-pulse" />
            <div className="h-4 w-80 bg-white/[0.03] rounded-lg animate-pulse" />
          </div>
          <div className="flex gap-3">
            <div className="h-11 w-28 bg-white/[0.04] rounded-xl animate-pulse" />
            <div className="h-11 w-32 bg-white/[0.04] rounded-xl animate-pulse" />
          </div>
        </div>
        <div className="h-40 bg-white/[0.03] rounded-2xl animate-pulse" />
        <div className="h-14 bg-white/[0.03] rounded-2xl animate-pulse" />
        <div className="grid grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-[700px] bg-white/[0.03] rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  /* ─── Render ─── */
  return (
    <div className="p-8 space-y-6 animate-fade-in">

      {/* ══════════ PAGE HEADER ══════════ */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
        <div>
          <h1 className="text-4xl font-bold text-white tracking-tight mb-2">
            AI Task Manager
          </h1>
          <p className="text-base text-zinc-400 leading-relaxed">
            Organize and execute project milestones with neural recommendations.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {/* View toggle */}
          <div className="flex items-center p-1 rounded-xl bg-white/[0.04] border border-white/[0.08] gap-0.5">
            <button
              onClick={() => setView('kanban')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${
                view === 'kanban'
                  ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <LayoutGrid size={14} />
              Board
            </button>
            <button
              onClick={() => setView('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${
                view === 'list'
                  ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <List size={14} />
              List
            </button>
          </div>

          {/* New Task */}
          <button
            onClick={() => handleOpenAddModal()}
            className="h-11 px-5 rounded-xl text-sm font-semibold text-white flex items-center gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 hover:-translate-y-px transition-all shadow-lg shadow-violet-500/25 cursor-pointer"
          >
            <Plus size={16} />
            New Task
          </button>

          {/* Generate with AI */}
          <button
            onClick={() => loadAISuggestions(tasks.map((t) => t.title))}
            disabled={loadingSuggestions}
            className="h-11 px-5 rounded-xl text-sm font-semibold text-zinc-300 border border-white/[0.10] bg-white/[0.04] hover:bg-white/[0.08] hover:text-white hover:-translate-y-px transition-all flex items-center gap-2 cursor-pointer disabled:opacity-60"
          >
            {loadingSuggestions ? (
              <Loader2 size={15} className="animate-spin text-violet-400" />
            ) : (
              <Sparkles size={15} className="text-violet-400" />
            )}
            Generate AI Tasks
          </button>
        </div>
      </div>

      {/* ══════════ AI SUGGESTED TASKS ══════════ */}
      <div className="relative overflow-hidden rounded-2xl border border-violet-500/15 bg-[#111118] p-6">
        {/* Bg glow */}
        <div className="absolute top-0 right-0 w-72 h-full bg-violet-600/5 blur-3xl pointer-events-none" />

        {/* Section header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-violet-500/15 flex items-center justify-center">
              <Sparkles size={15} className="text-violet-400" />
            </div>
            <div>
              <h3 className="text-[14px] font-semibold text-white">✨ AI Suggested Tasks</h3>
              <p className="text-[11px] text-zinc-500">Generated based on your recent activity</p>
            </div>
          </div>
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 flex items-center gap-1">
            <Zap size={10} />
            Gemini Flow Planner
          </span>
        </div>

        {/* Cards horizontal scroll */}
        {loadingSuggestions ? (
          <div className="flex gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex-shrink-0 w-[300px] h-[150px] bg-white/[0.04] rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : aiSuggestions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <Sparkles size={28} className="text-zinc-700" />
            <p className="text-[13px] text-zinc-500">No suggestions yet — click Generate AI Tasks</p>
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto custom-scrollbar pb-2">
            {aiSuggestions.map((s, idx) => (
              <AISuggestionCard
                key={idx}
                suggestion={s}
                index={idx}
                onAdd={() => handleAddSuggestedTask(s)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ══════════ FILTER TOOLBAR ══════════ */}
      <div className="flex flex-wrap items-center gap-3 p-3 rounded-2xl border border-white/[0.07] bg-[#111118]">
        {/* Search */}
        <div className="relative w-full md:w-[380px]">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none" />
          <input
            type="text"
            className="w-full h-12 bg-white/[0.04] border border-white/[0.08] rounded-xl pl-10 pr-4 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30 transition-all"
            placeholder="Search tasks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-300 transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Priority */}
          <div className="relative">
            <Flag size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none" />
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="h-12 bg-white/[0.04] border border-white/[0.08] text-sm text-zinc-300 pl-8 pr-8 rounded-xl focus:outline-none focus:border-violet-500/60 cursor-pointer appearance-none"
            >
              <option value="all">All Priorities</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none" />
          </div>

          {/* Category */}
          <div className="relative">
            <Tag size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none" />
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="h-12 bg-white/[0.04] border border-white/[0.08] text-sm text-zinc-300 pl-8 pr-8 rounded-xl focus:outline-none focus:border-violet-500/60 cursor-pointer appearance-none"
            >
              <option value="all">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none" />
          </div>

          {/* Sort placeholder */}
          <div className="relative">
            <ArrowUpDown size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none" />
            <select
              className="h-12 bg-white/[0.04] border border-white/[0.08] text-sm text-zinc-300 pl-8 pr-8 rounded-xl focus:outline-none focus:border-violet-500/60 cursor-pointer appearance-none"
            >
              <option>Sort: Newest</option>
              <option>Sort: Priority</option>
              <option>Sort: Due Date</option>
            </select>
            <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none" />
          </div>
        </div>

        {/* Result count */}
        <div className="ml-auto text-[12px] text-zinc-600 font-medium hidden md:block">
          {filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* ══════════ KANBAN BOARD ══════════ */}
      {view === 'kanban' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {COLUMNS.map((col) => {
            const colTasks = filteredTasks.filter((t) => t.status === col.status);
            return (
              <KanbanColumn
                key={col.status}
                col={col}
                tasks={colTasks}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onEdit={handleOpenEditModal}
                onDelete={handleDeleteTask}
                onBreakdown={handleBreakdownTask}
                breakingTaskId={breakingTaskId}
                taskBreakdowns={taskBreakdowns}
                onDragStart={handleDragStart}
                onAddTask={() => handleOpenAddModal(col.status)}
              />
            );
          })}
        </div>
      ) : (
        /* ══════════ LIST VIEW ══════════ */
        <div className="rounded-2xl overflow-hidden border border-white/[0.07] bg-[#111118]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-white/[0.07] text-zinc-500 text-[12px] font-semibold uppercase tracking-wide">
                  <th className="px-5 py-4">Task</th>
                  <th className="px-5 py-4">Category</th>
                  <th className="px-5 py-4">Priority</th>
                  <th className="px-5 py-4">Due Date</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <ClipboardCheck size={32} className="text-zinc-700" />
                        <p className="text-[14px] font-semibold text-zinc-500">No tasks found</p>
                        <p className="text-[12px] text-zinc-700">Try adjusting your filters or create a new task</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredTasks.map((task, i) => (
                    <tr
                      key={task.id}
                      className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors group"
                    >
                      <td className="px-5 py-4">
                        <div>
                          <p className="font-semibold text-[14px] text-white leading-snug">{task.title}</p>
                          <p className="text-[12px] text-zinc-500 mt-0.5 line-clamp-1">{task.description}</p>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <CategoryBadge category={task.category} />
                      </td>
                      <td className="px-5 py-4">
                        <PriorityBadge priority={task.priority} />
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5 text-[12px] text-zinc-500">
                          <Calendar size={12} />
                          {task.dueDate || '—'}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {(() => {
                          const col = COLUMNS.find((c) => c.status === task.status);
                          return (
                            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${col?.badge || 'bg-white/5 text-zinc-400'}`}>
                              {task.status.replace(/_/g, ' ')}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleBreakdownTask(task)}
                            className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-400 flex items-center justify-center hover:bg-violet-500/20 transition-all focus:outline-none"
                            title="AI Breakdown"
                          >
                            {breakingTaskId === task.id ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : (
                              <Zap size={13} />
                            )}
                          </button>
                          <button
                            onClick={() => handleOpenEditModal(task)}
                            className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.08] text-zinc-500 hover:text-white flex items-center justify-center hover:bg-white/[0.08] transition-all focus:outline-none"
                            title="Edit"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => handleDeleteTask(task.id)}
                            className="w-8 h-8 rounded-lg bg-rose-500/5 border border-rose-500/15 text-rose-500 flex items-center justify-center hover:bg-rose-500/15 transition-all focus:outline-none"
                            title="Delete"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════ TASK MODAL ══════════ */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingTask ? 'Edit Task' : 'Create Task'}
      >
        <form onSubmit={handleSaveTask} className="space-y-4">
          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-zinc-400 ml-1" htmlFor="modal-title">
              Task Title
            </label>
            <input
              type="text"
              id="modal-title"
              className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30 transition-all"
              placeholder="e.g. Design Landing Page"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-zinc-400 ml-1" htmlFor="modal-desc">
              Description
            </label>
            <textarea
              id="modal-desc"
              rows={3}
              className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30 transition-all resize-none"
              placeholder="Describe requirements and acceptance criteria..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Priority */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-semibold text-zinc-400 ml-1" htmlFor="modal-priority">
                Priority
              </label>
              <select
                id="modal-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-zinc-300 focus:outline-none focus:border-violet-500/60 cursor-pointer"
              >
                <option value="low">🟢 Low</option>
                <option value="medium">🟡 Medium</option>
                <option value="high">🔴 High</option>
              </select>
            </div>

            {/* Category */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-semibold text-zinc-400 ml-1" htmlFor="modal-category">
                Category
              </label>
              <input
                type="text"
                id="modal-category"
                className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/60 transition-all"
                placeholder="e.g. Design, Backend"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Due Date */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-semibold text-zinc-400 ml-1" htmlFor="modal-due">
                Due Date
              </label>
              <input
                type="date"
                id="modal-due"
                className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-zinc-300 focus:outline-none focus:border-violet-500/60 cursor-pointer"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            {/* Status */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-semibold text-zinc-400 ml-1" htmlFor="modal-status">
                Status
              </label>
              <select
                id="modal-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as ExtendedTaskStatus)}
                className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-zinc-300 focus:outline-none focus:border-violet-500/60 cursor-pointer"
              >
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="in_review">In Review</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2 justify-end">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="h-11 px-5 rounded-xl text-sm font-semibold text-zinc-300 border border-white/[0.10] bg-white/[0.04] hover:bg-white/[0.08] transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="h-11 px-6 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 transition-all shadow-lg shadow-violet-500/20"
            >
              {editingTask ? 'Update Task' : 'Create Task'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
