'use client';

import React, { useEffect, useState } from 'react';
import useAuth from '@/hooks/useAuth';
import useToast from '@/hooks/useToast';
import { dbService } from '@/services/db';
import { suggestCalendarScheduling } from '@/services/gemini';
import { CalendarEvent } from '@/types';
import Modal from '@/components/ui/Modal';
import {
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Plus,
  Clock,
  CalendarDays,
  Calendar,
  Search,
  Filter,
  Loader2,
  ArrowRight,
  CheckCircle2,
  MoreHorizontal,
  Trash2,
  Pencil,
  Zap,
  LayoutGrid,
  List,
  AlarmClock,
  Layers,
  BookOpen,
  Target,
} from 'lucide-react';

/* ────────────────────── constants ────────────────────────────────── */

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Rotating event colours keyed by event index mod
const EVENT_COLORS = [
  { pill: 'bg-violet-500/15 border-violet-500/30 text-violet-300', dot: 'bg-violet-400' },
  { pill: 'bg-sky-500/15 border-sky-500/30 text-sky-300', dot: 'bg-sky-400' },
  { pill: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300', dot: 'bg-emerald-400' },
  { pill: 'bg-amber-500/15 border-amber-500/30 text-amber-300', dot: 'bg-amber-400' },
  { pill: 'bg-rose-500/15 border-rose-500/30 text-rose-300', dot: 'bg-rose-400' },
  { pill: 'bg-pink-500/15 border-pink-500/30 text-pink-300', dot: 'bg-pink-400' },
];

function getEventColor(idx: number) {
  return EVENT_COLORS[idx % EVENT_COLORS.length];
}

/* ────────────────────── tiny helpers ─────────────────────────────── */

function todayStr() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().split('T')[0];
}

function toLocalDateStr(d: Date) {
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().split('T')[0];
}

function calcDuration(start: string, end: string) {
  if (!start || !end) return '';
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins <= 0) return '';
  return mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h${mins % 60 ? ` ${mins % 60}m` : ''}`;
}

/* ────────────────────── sub-components ──────────────────────────── */

/** A single event pill inside a month cell */
function EventPill({
  event,
  colorIdx,
  onClick,
}: {
  event: CalendarEvent;
  colorIdx: number;
  onClick: (e: React.MouseEvent) => void;
}) {
  const c = getEventColor(colorIdx);
  return (
    <button
      onClick={onClick}
      className={`w-full text-left text-[10px] font-semibold px-1.5 py-0.5 rounded-md border truncate flex items-center gap-1 hover:brightness-125 transition-all ${c.pill}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.dot}`} />
      <span className="truncate">{event.startTime && `${event.startTime} `}{event.title}</span>
    </button>
  );
}

/** Upcoming event agenda card */
function AgendaCard({
  event,
  colorIdx,
  onClick,
}: {
  event: CalendarEvent;
  colorIdx: number;
  onClick: () => void;
}) {
  const c = getEventColor(colorIdx);
  const dur = calcDuration(event.startTime, event.endTime);
  return (
    <button
      onClick={onClick}
      className="w-full text-left group flex items-start gap-3 p-3 rounded-xl border border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.05] hover:border-violet-500/25 hover:-translate-y-px transition-all"
    >
      {/* Date badge */}
      <div className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center flex-shrink-0 border ${c.pill}`}>
        <span className="text-[9px] font-bold uppercase leading-none">
          {new Date(event.date + 'T00:00').toLocaleDateString('en', { month: 'short' })}
        </span>
        <span className="text-[16px] font-black leading-tight">
          {new Date(event.date + 'T00:00').getDate()}
        </span>
      </div>
      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-white truncate group-hover:text-violet-200 transition-colors">
          {event.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-zinc-500">
          <span className="flex items-center gap-0.5">
            <Clock size={9} />
            {event.startTime}
            {event.endTime && ` – ${event.endTime}`}
          </span>
          {dur && (
            <>
              <span className="text-zinc-700">·</span>
              <span>{dur}</span>
            </>
          )}
        </div>
        {event.description && (
          <p className="text-[11px] text-zinc-600 mt-0.5 truncate">{event.description}</p>
        )}
      </div>
      <ArrowRight size={13} className="text-zinc-700 group-hover:text-violet-400 transition-colors flex-shrink-0 mt-1" />
    </button>
  );
}

/* ────────────────────── main page ───────────────────────────────── */

export default function CalendarPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'month' | 'week' | 'day'>('month');

  // Date states
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [searchQuery, setSearchQuery] = useState('');

  // AI Scheduler
  const [aiSuggesting, setAiSuggesting] = useState(false);
  const [aiRecommendation, setAiRecommendation] = useState('');
  const [suggestedTitle, setSuggestedTitle] = useState('');

  // Modals
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  // Form fields
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (!user) return;
    loadEvents();
  }, [user]);

  async function loadEvents() {
    try {
      const data = await dbService.getEvents(user!.uid);
      setEvents(data);
    } catch (err) {
      console.error(err);
      toast('Failed to load calendar events.', 'error');
    } finally {
      setLoading(false);
    }
  }

  // Navigation
  const prevMonth = () =>
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () =>
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const setToday = () => setCurrentDate(new Date());

  // Modals
  const handleOpenAddModal = (initialDate = '') => {
    setEditingEvent(null);
    setTitle('');
    setDate(initialDate || new Date().toISOString().split('T')[0]);
    setStartTime('10:00');
    setEndTime('11:00');
    setDescription('');
    setAiRecommendation('');
    setSuggestedTitle('');
    setModalOpen(true);
  };

  const handleOpenEditModal = (event: CalendarEvent) => {
    setEditingEvent(event);
    setTitle(event.title);
    setDate(event.date);
    setStartTime(event.startTime);
    setEndTime(event.endTime);
    setDescription(event.description || '');
    setAiRecommendation('');
    setSuggestedTitle('');
    setModalOpen(true);
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date || !startTime || !endTime) {
      toast('Please fill out all required fields.', 'error');
      return;
    }
    try {
      const eventData = { title, date, startTime, endTime, description };
      if (editingEvent) {
        await dbService.saveEvent(user!.uid, { ...eventData, id: editingEvent.id });
        toast('Event updated successfully.', 'success');
      } else {
        await dbService.saveEvent(user!.uid, eventData);
        toast('Event scheduled successfully.', 'success');
      }
      setModalOpen(false);
      loadEvents();
    } catch {
      toast('Failed to save event.', 'error');
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm('Are you sure you want to delete this event?')) return;
    try {
      await dbService.deleteEvent(user!.uid, eventId);
      toast('Event removed successfully.', 'success');
      setModalOpen(false);
      loadEvents();
    } catch {
      toast('Failed to delete event.', 'error');
    }
  };

  const handleRequestSchedulingSuggestion = async () => {
    const promptTitle = suggestedTitle || title;
    if (!promptTitle.trim()) {
      toast('Please enter an event title first.', 'error');
      return;
    }
    setAiSuggesting(true);
    try {
      const simplified = events.map((e) => ({ title: e.title, date: e.date, startTime: e.startTime }));
      const rec = await suggestCalendarScheduling(promptTitle, simplified);
      setAiRecommendation(rec);
      toast('Gemini generated a scheduling recommendation!', 'success');
    } catch {
      toast('Could not generate recommendation.', 'error');
    } finally {
      setAiSuggesting(false);
    }
  };

  const handleAutofillRecommendation = () => {
    const targetDate = new Date();
    const currentDay = targetDate.getDay();
    const daysUntilWednesday = (3 - currentDay + 7) % 7 || 7;
    targetDate.setDate(targetDate.getDate() + daysUntilWednesday);
    setDate(targetDate.toISOString().split('T')[0]);
    setStartTime('14:00');
    setEndTime('14:45');
    setTitle(suggestedTitle || title);
    toast('Autofilled recommended slot (Wednesday 2:00 PM – 2:45 PM).', 'success');
  };

  /* ── Calendar grid logic (unchanged) ── */
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthName = currentDate.toLocaleString('default', { month: 'long' });
  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();

  const calendarDays: { dayNum: number; dateString: string; isCurrentMonth: boolean }[] = [];
  const prevMonthTotalDays = new Date(year, month, 0).getDate();
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const d = prevMonthTotalDays - i;
    const prevDate = new Date(month === 0 ? year - 1 : year, month === 0 ? 11 : month - 1, d);
    calendarDays.push({ dayNum: d, dateString: toLocalDateStr(prevDate), isCurrentMonth: false });
  }
  for (let d = 1; d <= totalDays; d++) {
    const curDate = new Date(year, month, d);
    calendarDays.push({ dayNum: d, dateString: toLocalDateStr(curDate), isCurrentMonth: true });
  }
  const totalCells = Math.ceil(calendarDays.length / 7) * 7;
  for (let d = 1; d <= totalCells - calendarDays.length; d++) {
    const nextDate = new Date(month === 11 ? year + 1 : year, month === 11 ? 0 : month + 1, d);
    calendarDays.push({ dayNum: d, dateString: toLocalDateStr(nextDate), isCurrentMonth: false });
  }

  // Week view days (unchanged)
  const startOfWeek = new Date(currentDate);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  const weeklyDays: Date[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek);
    d.setDate(d.getDate() + i);
    return d;
  });

  // Filtered events for sidebar
  const today = todayStr();
  const upcomingEvents = events
    .filter((e) => e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));

  // Search-filtered events for month/week/day view
  const filteredEvents = searchQuery
    ? events.filter(
        (e) =>
          e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (e.description || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : events;

  /* ── Loading skeleton ── */
  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <div className="flex justify-between items-center">
          <div className="space-y-2">
            <div className="h-9 w-56 bg-white/[0.04] rounded-xl animate-pulse" />
            <div className="h-4 w-96 bg-white/[0.03] rounded-lg animate-pulse" />
          </div>
          <div className="flex gap-3">
            <div className="h-11 w-48 bg-white/[0.04] rounded-xl animate-pulse" />
            <div className="h-11 w-32 bg-white/[0.04] rounded-xl animate-pulse" />
          </div>
        </div>
        <div className="h-14 bg-white/[0.03] rounded-2xl animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3 h-[700px] bg-white/[0.03] rounded-2xl animate-pulse" />
          <div className="h-[700px] bg-white/[0.03] rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6 animate-fade-in">

      {/* ══════════ PAGE HEADER ══════════ */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
        <div>
          <h1 className="text-4xl font-bold text-white tracking-tight mb-2">
            Smart Scheduler
          </h1>
          <p className="text-base text-zinc-400 leading-relaxed max-w-xl">
            Manage meetings, tasks and AI scheduling recommendations from one intelligent workspace.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {/* View toggle */}
          <div className="flex items-center p-1 rounded-xl bg-white/[0.04] border border-white/[0.08] gap-0.5">
            {([
              { v: 'month', icon: LayoutGrid, label: 'Month' },
              { v: 'week', icon: Layers, label: 'Week' },
              { v: 'day', icon: List, label: 'Day' },
            ] as const).map(({ v, icon: Icon, label }) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${
                  view === v
                    ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Icon size={13} />
                {label}
              </button>
            ))}
          </div>

          {/* Today button */}
          <button
            onClick={setToday}
            className="h-11 px-4 rounded-xl text-sm font-semibold text-zinc-300 border border-white/[0.10] bg-white/[0.04] hover:bg-white/[0.08] hover:text-white transition-all"
          >
            Today
          </button>

          {/* Add Event */}
          <button
            onClick={() => handleOpenAddModal()}
            className="h-11 px-5 rounded-xl text-sm font-semibold text-white flex items-center gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 hover:-translate-y-px transition-all shadow-lg shadow-violet-500/25"
          >
            <Plus size={16} />
            Add Event
          </button>
        </div>
      </div>

      {/* ══════════ SEARCH TOOLBAR ══════════ */}
      <div className="flex items-center gap-3 p-3 rounded-2xl border border-white/[0.07] bg-[#111118]">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none" />
          <input
            type="text"
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-12 bg-white/[0.04] border border-white/[0.08] rounded-xl pl-10 pr-4 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30 transition-all"
          />
        </div>

        {/* Quick filters */}
        <div className="hidden md:flex items-center gap-2">
          {[
            { icon: CalendarDays, label: "Today's Events" },
            { icon: AlarmClock, label: 'Meetings' },
            { icon: Target, label: 'Deadlines' },
            { icon: BookOpen, label: 'Focus Blocks' },
          ].map(({ icon: Icon, label }) => (
            <button
              key={label}
              className="flex items-center gap-1.5 h-12 px-3 rounded-xl text-[12px] font-medium text-zinc-500 border border-white/[0.06] bg-white/[0.02] hover:text-zinc-200 hover:bg-white/[0.05] hover:border-violet-500/20 transition-all"
            >
              <Icon size={13} />
              <span className="hidden lg:inline">{label}</span>
            </button>
          ))}
        </div>

        {/* Result count */}
        <div className="ml-auto text-[12px] text-zinc-600 font-medium hidden md:block">
          {filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* ══════════ MAIN GRID ══════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">

        {/* ── Calendar Area (col-span-3) ── */}
        <div className="lg:col-span-3 space-y-4">
          {/* Calendar card */}
          <div className="rounded-2xl border border-white/[0.07] bg-[#111118] overflow-hidden">

            {/* Month navigation */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06]">
              <button
                onClick={prevMonth}
                className="w-9 h-9 rounded-xl border border-white/[0.08] bg-white/[0.03] flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/[0.07] transition-all"
              >
                <ChevronLeft size={18} />
              </button>

              <div className="text-center">
                <h2 className="text-2xl font-semibold text-white">
                  {view === 'month'
                    ? `${monthName} ${year}`
                    : view === 'week'
                    ? `Week of ${weeklyDays[0].toLocaleDateString('en', { month: 'short', day: 'numeric' })}`
                    : currentDate.toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' })}
                </h2>
                <p className="text-[12px] text-zinc-600 mt-0.5">
                  {filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''} this period
                </p>
              </div>

              <button
                onClick={nextMonth}
                className="w-9 h-9 rounded-xl border border-white/[0.08] bg-white/[0.03] flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/[0.07] transition-all"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            {/* ── MONTH VIEW ── */}
            {view === 'month' && (
              <div className="p-4">
                {/* Weekday headers */}
                <div className="grid grid-cols-7 mb-2">
                  {WEEKDAYS.map((d) => (
                    <div key={d} className="text-center py-2 text-[11px] font-bold text-zinc-600 uppercase tracking-wider">
                      {d}
                    </div>
                  ))}
                </div>

                {/* Day cells */}
                <div className="grid grid-cols-7 gap-1.5">
                  {calendarDays.map((cell, idx) => {
                    const dayEvents = filteredEvents.filter((e) => e.date === cell.dateString);
                    const isToday = cell.dateString === today;
                    const isCurrentMonth = cell.isCurrentMonth;
                    const visible = dayEvents.slice(0, 3);
                    const overflow = dayEvents.length - 3;

                    return (
                      <div
                        key={idx}
                        onClick={() => handleOpenAddModal(cell.dateString)}
                        className={`group relative min-h-[120px] rounded-xl p-2 flex flex-col gap-1 border cursor-pointer transition-all duration-200 ${
                          isToday
                            ? 'border-violet-500/50 bg-violet-500/5 shadow-lg shadow-violet-500/10'
                            : isCurrentMonth
                            ? 'border-white/[0.05] bg-white/[0.01] hover:bg-white/[0.04] hover:border-white/[0.10]'
                            : 'border-transparent opacity-30'
                        }`}
                      >
                        {/* Day number */}
                        <div className="flex items-center justify-between">
                          {/* Priority dot if has events */}
                          {dayEvents.length > 0 && !isToday && (
                            <span className={`w-1.5 h-1.5 rounded-full ${getEventColor(0).dot}`} />
                          )}
                          {dayEvents.length === 0 && <span />}
                          <span
                            className={`text-[12px] font-bold px-1.5 py-0.5 rounded-lg ${
                              isToday
                                ? 'bg-violet-500 text-white'
                                : isCurrentMonth
                                ? 'text-zinc-300'
                                : 'text-zinc-600'
                            }`}
                          >
                            {cell.dayNum}
                          </span>
                        </div>

                        {/* Event pills */}
                        <div className="flex flex-col gap-0.5 flex-1">
                          {visible.map((ev, eIdx) => (
                            <EventPill
                              key={ev.id}
                              event={ev}
                              colorIdx={eIdx}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenEditModal(ev);
                              }}
                            />
                          ))}
                          {overflow > 0 && (
                            <span className="text-[9px] text-zinc-600 font-semibold text-right pr-1">
                              +{overflow} more
                            </span>
                          )}
                        </div>

                        {/* Add event on hover */}
                        <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="flex items-center gap-0.5 text-[9px] text-violet-400 font-semibold whitespace-nowrap">
                            <Plus size={9} /> Add
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── WEEK VIEW ── */}
            {view === 'week' && (
              <div className="p-4">
                <div className="grid grid-cols-7 gap-2">
                  {weeklyDays.map((day, idx) => {
                    const dateStr = toLocalDateStr(day);
                    const dayEvents = filteredEvents.filter((e) => e.date === dateStr);
                    const isToday = dateStr === today;

                    return (
                      <div
                        key={idx}
                        onClick={() => handleOpenAddModal(dateStr)}
                        className={`rounded-xl border p-3 min-h-[360px] flex flex-col gap-2 cursor-pointer transition-all hover:bg-white/[0.03] ${
                          isToday
                            ? 'border-violet-500/40 bg-violet-500/5'
                            : 'border-white/[0.05] bg-white/[0.01]'
                        }`}
                      >
                        {/* Header */}
                        <div className="text-center pb-2 border-b border-white/[0.06]">
                          <p className="text-[10px] uppercase font-bold text-zinc-600 tracking-wider">
                            {day.toLocaleDateString('en', { weekday: 'short' })}
                          </p>
                          <p
                            className={`text-xl font-black mt-0.5 ${
                              isToday ? 'text-violet-400' : 'text-white'
                            }`}
                          >
                            {day.getDate()}
                          </p>
                        </div>

                        {/* Events */}
                        <div className="flex flex-col gap-1.5 flex-1 overflow-y-auto custom-scrollbar">
                          {dayEvents.length === 0 ? (
                            <div className="flex-1 flex items-center justify-center">
                              <span className="text-[10px] text-zinc-700">No events</span>
                            </div>
                          ) : (
                            dayEvents.map((ev, eIdx) => {
                              const c = getEventColor(eIdx);
                              return (
                                <button
                                  key={ev.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenEditModal(ev);
                                  }}
                                  className={`w-full text-left text-[10px] p-2 rounded-lg border flex flex-col gap-0.5 hover:brightness-125 transition-all ${c.pill}`}
                                >
                                  <span className="font-bold truncate">{ev.title}</span>
                                  <span className="opacity-75 flex items-center gap-0.5">
                                    <Clock size={8} />
                                    {ev.startTime} – {ev.endTime}
                                  </span>
                                </button>
                              );
                            })
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── DAY VIEW ── */}
            {view === 'day' && (() => {
              const dayStr = toLocalDateStr(currentDate);
              const dayEvents = filteredEvents.filter((e) => e.date === dayStr);
              return (
                <div className="p-6 space-y-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[13px] font-semibold text-zinc-400">
                      {currentDate.toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                    </p>
                    <button
                      onClick={() => handleOpenAddModal(dayStr)}
                      className="flex items-center gap-1.5 h-9 px-3 rounded-xl text-[12px] font-semibold text-violet-400 border border-violet-500/25 bg-violet-500/10 hover:bg-violet-500/20 transition-all"
                    >
                      <Plus size={13} /> Add Event
                    </button>
                  </div>

                  {dayEvents.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                      <Calendar size={36} className="text-zinc-700" />
                      <p className="text-[14px] font-semibold text-zinc-500">No events scheduled</p>
                      <p className="text-[12px] text-zinc-700">Click the button above to add an event</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {dayEvents.map((ev, eIdx) => {
                        const c = getEventColor(eIdx);
                        const dur = calcDuration(ev.startTime, ev.endTime);
                        return (
                          <button
                            key={ev.id}
                            onClick={() => handleOpenEditModal(ev)}
                            className="w-full text-left group flex items-center gap-4 p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-violet-500/25 hover:-translate-y-px transition-all"
                          >
                            <div className={`w-2 self-stretch rounded-full flex-shrink-0 ${c.dot}`} />
                            <div className={`px-3 py-1.5 rounded-xl border text-[12px] font-bold flex-shrink-0 ${c.pill}`}>
                              {ev.startTime}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-[14px] font-semibold text-white group-hover:text-violet-200 transition-colors">
                                {ev.title}
                              </h4>
                              <p className="text-[12px] text-zinc-500 mt-0.5 line-clamp-1">
                                {ev.description || 'No description provided'}
                              </p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-[12px] text-zinc-500">Ends {ev.endTime}</p>
                              {dur && <p className="text-[11px] text-zinc-700">{dur}</p>}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>

        {/* ── Right Sidebar ── */}
        <div className="space-y-5">

          {/* AI Smart Scheduler */}
          <div className="relative overflow-hidden rounded-2xl border border-violet-500/15 bg-[#111118] p-5">
            {/* BG glow */}
            <div className="absolute top-0 right-0 w-40 h-40 bg-violet-600/8 blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-purple-600/6 blur-2xl pointer-events-none" />

            {/* Header */}
            <div className="flex items-center gap-2.5 mb-2 relative z-10">
              <div className="w-8 h-8 rounded-xl bg-violet-500/15 flex items-center justify-center flex-shrink-0">
                <Sparkles size={15} className="text-violet-400" />
              </div>
              <div>
                <h3 className="text-[14px] font-semibold text-white">✨ AI Smart Scheduler</h3>
                <p className="text-[10px] text-zinc-500">Powered by Gemini</p>
              </div>
            </div>

            <p className="text-[12px] text-zinc-500 mb-4 leading-relaxed relative z-10">
              Let AI analyze your calendar and suggest the most productive meeting slots.
            </p>

            <div className="space-y-2.5 relative z-10">
              <input
                type="text"
                className="w-full h-11 bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30 transition-all"
                placeholder="What are you planning?"
                value={suggestedTitle}
                onChange={(e) => setSuggestedTitle(e.target.value)}
              />
              <button
                onClick={handleRequestSchedulingSuggestion}
                disabled={aiSuggesting}
                className="w-full h-11 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 transition-all shadow-lg shadow-violet-500/20 disabled:opacity-60"
              >
                {aiSuggesting ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Zap size={15} />
                    Recommend Best Time
                  </>
                )}
              </button>
            </div>

            {/* AI Result */}
            {aiRecommendation && (
              <div className="mt-4 p-3.5 rounded-xl border border-violet-500/20 bg-violet-500/5 space-y-3 relative z-10 animate-fade-in">
                <div className="flex items-start gap-2">
                  <Sparkles size={13} className="text-violet-400 flex-shrink-0 mt-0.5" />
                  <p className="text-[12px] text-zinc-300 leading-relaxed">{aiRecommendation}</p>
                </div>
                <button
                  onClick={handleAutofillRecommendation}
                  className="w-full h-9 rounded-lg text-[12px] font-semibold text-violet-400 border border-violet-500/25 bg-violet-500/10 hover:bg-violet-500/20 transition-all flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 size={13} />
                  Autofill Recommended Slot
                </button>
              </div>
            )}
          </div>

          {/* Upcoming Events */}
          <div className="rounded-2xl border border-white/[0.07] bg-[#111118] p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[15px] font-semibold text-white">Upcoming Events</h3>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400">
                {upcomingEvents.length}
              </span>
            </div>

            {upcomingEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2.5">
                <CalendarDays size={28} className="text-zinc-700" />
                <p className="text-[13px] font-medium text-zinc-600">No upcoming events</p>
                <button
                  onClick={() => handleOpenAddModal()}
                  className="text-[12px] text-violet-400 hover:text-violet-300 font-semibold flex items-center gap-1 transition-colors"
                >
                  <Plus size={12} /> Schedule one
                </button>
              </div>
            ) : (
              <div className="space-y-2 max-h-[380px] overflow-y-auto custom-scrollbar pr-1">
                {upcomingEvents.slice(0, 8).map((ev, idx) => (
                  <AgendaCard
                    key={ev.id}
                    event={ev}
                    colorIdx={idx}
                    onClick={() => handleOpenEditModal(ev)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Mini Stats */}
          <div className="rounded-2xl border border-white/[0.07] bg-[#111118] p-5">
            <h3 className="text-[14px] font-semibold text-white mb-3">This Month</h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Total Events', value: events.filter(e => e.date.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`)).length, color: 'text-violet-400', bg: 'bg-violet-500/10' },
                { label: 'This Week', value: weeklyDays.filter(d => filteredEvents.some(e => e.date === toLocalDateStr(d))).length, color: 'text-sky-400', bg: 'bg-sky-500/10' },
                { label: 'Upcoming', value: upcomingEvents.length, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                { label: 'Today', value: filteredEvents.filter(e => e.date === today).length, color: 'text-amber-400', bg: 'bg-amber-500/10' },
              ].map((s) => (
                <div key={s.label} className={`rounded-xl p-3 ${s.bg} border border-white/[0.04]`}>
                  <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                  <p className="text-[10px] text-zinc-600 font-medium mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ══════════ EVENT MODAL ══════════ */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingEvent ? 'Edit Event' : 'Schedule Event'}
      >
        <form onSubmit={handleSaveEvent} className="space-y-4">
          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-zinc-400 ml-1" htmlFor="ev-title">
              Event Title
            </label>
            <input
              type="text"
              id="ev-title"
              className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30 transition-all"
              placeholder="e.g. Weekly Standup"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          {/* Date */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-zinc-400 ml-1" htmlFor="ev-date">
              Event Date
            </label>
            <input
              type="date"
              id="ev-date"
              className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-zinc-300 focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30 cursor-pointer transition-all"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-semibold text-zinc-400 ml-1" htmlFor="ev-start">
                Start Time
              </label>
              <input
                type="time"
                id="ev-start"
                className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-zinc-300 focus:outline-none focus:border-violet-500/60 cursor-pointer transition-all"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-semibold text-zinc-400 ml-1" htmlFor="ev-end">
                End Time
              </label>
              <input
                type="time"
                id="ev-end"
                className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-zinc-300 focus:outline-none focus:border-violet-500/60 cursor-pointer transition-all"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-zinc-400 ml-1" htmlFor="ev-desc">
              Description
            </label>
            <textarea
              id="ev-desc"
              rows={3}
              className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30 transition-all resize-none"
              placeholder="Agenda, dial-in link, or additional notes..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            {editingEvent ? (
              <button
                type="button"
                onClick={() => handleDeleteEvent(editingEvent.id)}
                className="flex items-center gap-2 h-11 px-4 rounded-xl text-sm font-semibold text-rose-400 border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/15 transition-all"
              >
                <Trash2 size={14} />
                Delete
              </button>
            ) : (
              <div />
            )}
            <div className="flex gap-2">
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
                {editingEvent ? 'Update' : 'Schedule'}
              </button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
