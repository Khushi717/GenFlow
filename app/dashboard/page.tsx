'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import useAuth from '@/hooks/useAuth';
import { dbService } from '@/services/db';
import { getWorkflowRecommendations } from '@/services/gemini';
import { Task, Meeting, DocumentSummary, GeneratedEmail, CalendarEvent } from '@/types';
import {
  ClipboardCheck,
  Calendar,
  FileText,
  Mail,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Plus,
  Zap,
  CheckCircle2,
  Clock,
  FileUp,
  MessageSquareDiff,
  ArrowRight,
  ChevronRight,
  Activity,
  Target,
  BrainCircuit,
  Timer,
} from 'lucide-react';

/* ─────────────────────────── helpers ─────────────────────────── */

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 18) return 'Good Afternoon';
  return 'Good Evening';
}

function getScoreLabel(score: number) {
  if (score >= 75) return { label: 'Excellent', color: 'text-emerald-400' };
  if (score >= 50) return { label: 'On Track', color: 'text-violet-400' };
  if (score >= 25) return { label: 'Improving', color: 'text-amber-400' };
  return { label: 'Needs Improvement', color: 'text-rose-400' };
}

function getScoreStroke(score: number) {
  if (score >= 75) return 'url(#gradGreen)';
  if (score >= 50) return 'url(#gradPurple)';
  if (score >= 25) return 'url(#gradAmber)';
  return 'url(#gradRed)';
}

/* ─────────────────── Inline SVG Bar Chart ─────────────────────── */

const WEEKLY_DATA = [
  { day: 'Mon', value: 65 },
  { day: 'Tue', value: 78 },
  { day: 'Wed', value: 54 },
  { day: 'Thu', value: 88 },
  { day: 'Fri', value: 72 },
  { day: 'Sat', value: 40 },
  { day: 'Sun', value: 61 },
];

function WeeklyBarChart() {
  const max = Math.max(...WEEKLY_DATA.map((d) => d.value));
  const chartH = 80;

  return (
    <div className="flex items-end gap-2 h-[80px] w-full">
      {WEEKLY_DATA.map((d) => {
        const barH = Math.round((d.value / max) * chartH);
        const isToday = d.day === ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date().getDay()];
        return (
          <div key={d.day} className="flex-1 flex flex-col items-center gap-1.5 group">
            <div className="relative w-full flex justify-center">
              {/* Tooltip */}
              <div className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-[#1E1E2A] border border-white/10 rounded-lg px-2 py-0.5 text-[10px] font-bold text-white whitespace-nowrap z-10 pointer-events-none">
                {d.value}%
              </div>
              <div
                className={`w-full rounded-t-md transition-all duration-300 ${
                  isToday
                    ? 'bg-gradient-to-t from-violet-600 to-violet-400'
                    : 'bg-white/[0.06] group-hover:bg-white/[0.12]'
                }`}
                style={{ height: `${barH}px` }}
              />
            </div>
            <span className={`text-[10px] font-medium ${isToday ? 'text-violet-400' : 'text-zinc-600'}`}>
              {d.day}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────── Radial Progress Ring ─────────────────────── */

function RadialProgress({ score }: { score: number }) {
  const r = 64;
  const circ = 2 * Math.PI * r;
  const offset = circ - (circ * score) / 100;
  const { label, color } = getScoreLabel(score);

  return (
    <div className="relative w-40 h-40 flex items-center justify-center">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 160 160">
        <defs>
          <linearGradient id="gradPurple" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#A78BFA" />
            <stop offset="100%" stopColor="#7C3AED" />
          </linearGradient>
          <linearGradient id="gradGreen" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#34D399" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
          <linearGradient id="gradAmber" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FCD34D" />
            <stop offset="100%" stopColor="#D97706" />
          </linearGradient>
          <linearGradient id="gradRed" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FB7185" />
            <stop offset="100%" stopColor="#E11D48" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {/* Track */}
        <circle cx="80" cy="80" r={r} stroke="rgba(255,255,255,0.05)" strokeWidth="10" fill="none" />
        {/* Progress */}
        <circle
          cx="80"
          cy="80"
          r={r}
          stroke={getScoreStroke(score)}
          strokeWidth="10"
          fill="none"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000"
          filter="url(#glow)"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-black text-white">{score}</span>
        <span className="text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5">Score</span>
      </div>
    </div>
  );
}

/* ─────────────────── Stat Card ─────────────────────────────────── */

interface StatCardProps {
  href: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  label: string;
  value: number | string;
  description: string;
  progress?: number;
  trend?: string;
  trendUp?: boolean;
}

function StatCard({
  href,
  icon: Icon,
  iconColor,
  iconBg,
  label,
  value,
  description,
  progress,
  trend,
  trendUp,
}: StatCardProps) {
  return (
    <Link
      href={href}
      className="group flex flex-col justify-between p-5 rounded-2xl border border-white/[0.07] bg-[#16161D] hover:border-violet-500/30 hover:bg-[#1A1A24] hover:shadow-xl hover:shadow-violet-500/10 hover:-translate-y-0.5 transition-all duration-300 min-h-[170px]"
    >
      {/* Top row */}
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0`}>
          <Icon size={20} className={iconColor} />
        </div>
        {trend && (
          <div
            className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full ${
              trendUp ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
            }`}
          >
            {trendUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {trend}
          </div>
        )}
      </div>

      {/* Value + Label */}
      <div>
        <div className="text-3xl font-bold text-white mb-0.5">{value}</div>
        <div className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">{label}</div>
        <div className="text-[12px] text-zinc-500 truncate">{description}</div>
      </div>

      {/* Progress bar */}
      {progress !== undefined && (
        <div className="w-full h-1 bg-white/[0.05] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${iconBg.replace('/10', '/80')}`}
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      )}
    </Link>
  );
}

/* ─────────────────── Activity Item ─────────────────────────────── */

interface ActivityItemProps {
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  title: string;
  time: string;
  status: string;
  statusColor: string;
}

function ActivityItem({ icon: Icon, iconColor, iconBg, title, time, status, statusColor }: ActivityItemProps) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-white/[0.04] last:border-0 group">
      <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center flex-shrink-0`}>
        <Icon size={15} className={iconColor} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-zinc-200 truncate group-hover:text-white transition-colors">{title}</p>
        <p className="text-[11px] text-zinc-600">{time}</p>
      </div>
      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusColor} flex-shrink-0`}>
        {status}
      </span>
    </div>
  );
}

/* ─────────────────── Main Component ─────────────────────────────── */

export default function DashboardOverview() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [emails, setEmails] = useState<GeneratedEmail[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiRecommendation, setAiRecommendation] = useState({ recommendation: '', action: '' });

  useEffect(() => {
    if (!user) return;

    async function loadDashboardData() {
      try {
        const [loadedTasks, loadedMeetings, loadedDocs, loadedEmails, loadedEvents] =
          await Promise.all([
            dbService.getTasks(user!.uid),
            dbService.getMeetings(user!.uid),
            dbService.getDocuments(user!.uid),
            dbService.getEmails(user!.uid),
            dbService.getEvents(user!.uid),
          ]);

        setTasks(loadedTasks);
        setMeetings(loadedMeetings);
        setDocuments(loadedDocs);
        setEmails(loadedEmails);
        setEvents(loadedEvents);

        const rec = await getWorkflowRecommendations(loadedTasks, loadedMeetings);
        setAiRecommendation(rec);
      } catch (err) {
        console.error('Error loading dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, [user]);

  /* ── Calculations (same logic, no changes) ── */
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === 'completed').length;
  const pendingTasks = totalTasks - completedTasks;
  const productivityScore = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 20;

  const upcomingEvents = events.filter(
    (e) => new Date(e.date) >= new Date(new Date().setHours(0, 0, 0, 0))
  );

  const firstName = user?.displayName?.split(' ')[0] || 'there';
  const greeting = getGreeting();

  /* ── AI action link ── */
  const aiActionHref =
    aiRecommendation.action === 'Break down tasks'
      ? '/dashboard/tasks'
      : aiRecommendation.action === 'Summarize syncs'
      ? '/dashboard/meetings'
      : '/dashboard';

  /* ── Recent activity (derived from real data) ── */
  const recentActivity: ActivityItemProps[] = [
    ...(completedTasks > 0
      ? [
          {
            icon: CheckCircle2,
            iconColor: 'text-emerald-400',
            iconBg: 'bg-emerald-500/10',
            title: `${completedTasks} task${completedTasks > 1 ? 's' : ''} completed today`,
            time: 'Today',
            status: 'Done',
            statusColor: 'bg-emerald-500/10 text-emerald-400',
          },
        ]
      : []),
    ...(meetings.length > 0
      ? [
          {
            icon: MessageSquareDiff,
            iconColor: 'text-violet-400',
            iconBg: 'bg-violet-500/10',
            title: meetings[0]?.title || 'Meeting summarized',
            time: meetings[0]?.date || 'Recently',
            status: 'Summarized',
            statusColor: 'bg-violet-500/10 text-violet-400',
          },
        ]
      : []),
    ...(documents.length > 0
      ? [
          {
            icon: FileUp,
            iconColor: 'text-amber-400',
            iconBg: 'bg-amber-500/10',
            title: documents[0]?.name || 'Document uploaded',
            time: documents[0]?.uploadedAt || 'Recently',
            status: 'Processed',
            statusColor: 'bg-amber-500/10 text-amber-400',
          },
        ]
      : []),
    ...(emails.length > 0
      ? [
          {
            icon: Mail,
            iconColor: 'text-sky-400',
            iconBg: 'bg-sky-500/10',
            title: emails[0]?.subject || 'Email generated',
            time: emails[0]?.createdAt || 'Recently',
            status: 'Generated',
            statusColor: 'bg-sky-500/10 text-sky-400',
          },
        ]
      : []),
  ];

  /* ── Fallback activity items if empty ── */
  if (recentActivity.length === 0) {
    recentActivity.push(
      {
        icon: Sparkles,
        iconColor: 'text-violet-400',
        iconBg: 'bg-violet-500/10',
        title: 'AI workspace initialized',
        time: 'Just now',
        status: 'Active',
        statusColor: 'bg-violet-500/10 text-violet-400',
      },
      {
        icon: ClipboardCheck,
        iconColor: 'text-zinc-500',
        iconBg: 'bg-white/5',
        title: 'No tasks completed yet',
        time: 'Get started →',
        status: 'Pending',
        statusColor: 'bg-zinc-800 text-zinc-400',
      }
    );
  }

  /* ── Loading state ── */
  if (loading) {
    return (
      <div className="space-y-6 p-8">
        <div className="h-10 w-64 bg-white/[0.04] rounded-xl animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-[170px] bg-white/[0.04] rounded-2xl animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-80 bg-white/[0.04] rounded-2xl animate-pulse" />
          <div className="h-80 bg-white/[0.04] rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-8 animate-fade-in">

      {/* ══════════════ GREETING SECTION ══════════════ */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <p className="text-sm font-medium text-zinc-500 mb-1">{greeting} 👋</p>
          <h1 className="text-4xl font-bold text-white tracking-tight mb-2">
            {user?.displayName || 'Welcome back'}
          </h1>
          <p className="text-sm text-zinc-500">
            Your AI workspace is ready.{' '}
            <span className="text-zinc-300">
              You have {pendingTasks} active task{pendingTasks !== 1 ? 's' : ''} and{' '}
              {upcomingEvents.length} event{upcomingEvents.length !== 1 ? 's' : ''} today.
            </span>
          </p>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <Link
            href="/dashboard/assistant"
            className="h-11 px-4 rounded-xl border border-white/[0.1] bg-white/[0.04] text-sm font-semibold text-zinc-300 hover:text-white hover:bg-white/[0.08] hover:border-white/20 transition-all flex items-center gap-2"
          >
            <Sparkles size={15} className="text-violet-400" />
            Generate with AI
          </Link>
          <Link
            href="/dashboard/tasks"
            className="h-11 px-5 rounded-xl text-sm font-semibold text-white flex items-center gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 hover:-translate-y-px transition-all shadow-lg shadow-violet-500/25"
          >
            <Plus size={16} />
            New Task
          </Link>
        </div>
      </div>

      {/* ══════════════ KPI STAT CARDS ══════════════ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          href="/dashboard/tasks"
          icon={ClipboardCheck}
          iconColor="text-violet-400"
          iconBg="bg-violet-500/10"
          label="Active Tasks"
          value={pendingTasks}
          description={`${totalTasks} total · ${completedTasks} completed`}
          progress={totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0}
          trend="+2 today"
          trendUp={true}
        />
        <StatCard
          href="/dashboard/calendar"
          icon={Calendar}
          iconColor="text-sky-400"
          iconBg="bg-sky-500/10"
          label="Upcoming Events"
          value={upcomingEvents.length}
          description={upcomingEvents[0]?.title || 'No events scheduled'}
          trend={upcomingEvents.length > 0 ? 'Scheduled' : undefined}
          trendUp={true}
        />
        <StatCard
          href="/dashboard/documents"
          icon={FileText}
          iconColor="text-amber-400"
          iconBg="bg-amber-500/10"
          label="Documents"
          value={documents.length}
          description={documents[0]?.name || 'No documents yet'}
          progress={documents.length > 0 ? Math.min(documents.length * 10, 100) : 0}
          trend={documents.length > 0 ? `${documents.length} processed` : undefined}
          trendUp={true}
        />
        <StatCard
          href="/dashboard/emails"
          icon={Mail}
          iconColor="text-emerald-400"
          iconBg="bg-emerald-500/10"
          label="Drafted Emails"
          value={emails.length}
          description={emails[0]?.subject || 'No emails generated'}
          progress={emails.length > 0 ? Math.min(emails.length * 15, 100) : 0}
          trend={emails.length > 0 ? 'Generated' : undefined}
          trendUp={true}
        />
      </div>

      {/* ══════════════ MAIN GRID ══════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Left Column (span-2) ── */}
        <div className="lg:col-span-2 space-y-6">

          {/* AI Copilot Card */}
          <div className="relative overflow-hidden rounded-2xl border border-violet-500/20 bg-[#16161D] p-6">
            {/* Gradient blobs */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 right-12 w-40 h-40 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />

            <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              {/* Left content */}
              <div className="flex-1">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-9 h-9 rounded-xl bg-violet-500/15 flex items-center justify-center">
                    <Sparkles size={18} className="text-violet-400" />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-semibold text-white">AI Recommendation</h3>
                    <p className="text-[11px] text-zinc-500">
  {"Based on today's workload"}
</p>
                  </div>
                </div>

                <p className="text-sm text-zinc-400 leading-relaxed max-w-lg mb-5">
                  {aiRecommendation.recommendation ||
                    'Analyzing your workflow, task queue, and active meetings to suggest optimization strategies tailored to your productivity patterns.'}
                </p>

                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href="/dashboard"
                    className="h-10 px-5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 hover:-translate-y-px transition-all shadow-lg shadow-violet-500/20 flex items-center gap-2"
                  >
                    <Timer size={14} />
                    Start Deep Work
                  </Link>
                  <Link
                    href={aiActionHref}
                    className="h-10 px-5 rounded-xl text-sm font-semibold text-zinc-300 border border-white/[0.1] bg-white/[0.03] hover:bg-white/[0.07] hover:text-white transition-all flex items-center gap-2"
                  >
                    <BrainCircuit size={14} className="text-violet-400" />
                    {aiRecommendation.action || 'Generate Plan'}
                  </Link>
                </div>
              </div>

              {/* Right — decorative grid/orb */}
              <div className="hidden md:flex w-32 h-32 items-center justify-center relative flex-shrink-0">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-600/10 border border-violet-500/20" />
                <div className="absolute inset-2 rounded-xl bg-gradient-to-br from-violet-500/10 to-transparent" />
                <Sparkles size={40} className="text-violet-400/60 relative z-10" />
              </div>
            </div>
          </div>

          {/* Weekly Performance */}
          <div className="rounded-2xl border border-white/[0.07] bg-[#16161D] p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-[15px] font-semibold text-white">Weekly Productivity</h3>
                <p className="text-[12px] text-zinc-500 mt-0.5">Your output over the past 7 days</p>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-400 text-[12px] font-semibold bg-emerald-500/10 px-2.5 py-1 rounded-full">
                <TrendingUp size={13} />
                +18.2% vs last week
              </div>
            </div>

            {/* Bar chart */}
            <WeeklyBarChart />

            {/* Metric sub-cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
              {[
                {
                  icon: Target,
                  color: 'text-violet-400',
                  bg: 'bg-violet-500/10',
                  label: 'Tasks Done',
                  value: `${completedTasks}`,
                },
                {
                  icon: Sparkles,
                  color: 'text-amber-400',
                  bg: 'bg-amber-500/10',
                  label: 'AI Suggestions',
                  value: '12',
                },
                {
                  icon: Activity,
                  color: 'text-sky-400',
                  bg: 'bg-sky-500/10',
                  label: 'Flow Score',
                  value: '82%',
                },
                {
                  icon: Timer,
                  color: 'text-emerald-400',
                  bg: 'bg-emerald-500/10',
                  label: 'Deep Focus',
                  value: '3.2h',
                },
              ].map((m) => (
                <div
                  key={m.label}
                  className="flex flex-col gap-2 p-3 rounded-xl bg-white/[0.03] border border-white/[0.05] hover:border-white/10 transition-colors"
                >
                  <div className={`w-7 h-7 rounded-lg ${m.bg} flex items-center justify-center`}>
                    <m.icon size={14} className={m.color} />
                  </div>
                  <div>
                    <div className="text-[15px] font-bold text-white">{m.value}</div>
                    <div className="text-[10px] text-zinc-600 font-medium">{m.label}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right Column ── */}
        <div className="space-y-6">

          {/* Productivity Score */}
          <div className="rounded-2xl border border-white/[0.07] bg-[#16161D] p-6 flex flex-col items-center text-center">
            <div className="flex items-center justify-between w-full mb-5">
              <h3 className="text-[15px] font-semibold text-white">Productivity Score</h3>
              <div className="flex items-center gap-1 text-emerald-400 text-[11px] font-semibold">
                <TrendingUp size={12} />
                12% this week
              </div>
            </div>

            <RadialProgress score={productivityScore} />

            <div className="mt-4 space-y-1.5 w-full">
              <div className={`text-[13px] font-semibold ${getScoreLabel(productivityScore).color}`}>
                {getScoreLabel(productivityScore).label}
              </div>
              <p className="text-[12px] text-zinc-500 leading-relaxed">
                Based on {completedTasks} / {totalTasks} completed tasks and active calendar sync.
              </p>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="rounded-2xl border border-white/[0.07] bg-[#16161D] p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[15px] font-semibold text-white">Recent Activity</h3>
              <Clock size={15} className="text-zinc-600" />
            </div>

            <div className="space-y-0">
              {recentActivity.slice(0, 4).map((item, i) => (
                <ActivityItem key={i} {...item} />
              ))}
            </div>
          </div>

          {/* Upcoming Events */}
          <div className="rounded-2xl border border-white/[0.07] bg-[#16161D] p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[15px] font-semibold text-white">Upcoming Events</h3>
              <Link
                href="/dashboard/calendar"
                className="text-[12px] text-violet-400 hover:text-violet-300 font-medium flex items-center gap-1 transition-colors"
              >
                View all <ChevronRight size={13} />
              </Link>
            </div>

            {upcomingEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 gap-2">
                <Calendar size={28} className="text-zinc-700" />
                <p className="text-[13px] text-zinc-600">No upcoming events</p>
                <Link
                  href="/dashboard/calendar"
                  className="text-[12px] text-violet-400 hover:text-violet-300 font-medium flex items-center gap-1 mt-1"
                >
                  Add an event <ArrowRight size={12} />
                </Link>
              </div>
            ) : (
              <div className="space-y-2.5">
                {upcomingEvents.slice(0, 3).map((e) => {
                  const eventDate = new Date(e.date);
                  const isToday =
                    eventDate.toDateString() === new Date().toDateString();
                  return (
                    <div
                      key={e.id}
                      className="flex items-start gap-3 p-3 rounded-xl border border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.04] hover:border-violet-500/20 transition-all group"
                    >
                      {/* Date badge */}
                      <div className="w-11 h-11 rounded-xl bg-violet-500/10 border border-violet-500/15 flex flex-col items-center justify-center flex-shrink-0">
                        <span className="text-[9px] font-bold text-violet-400 uppercase leading-none">
                          {eventDate.toLocaleDateString('en', { month: 'short' })}
                        </span>
                        <span className="text-[16px] font-black text-white leading-tight">
                          {eventDate.getDate()}
                        </span>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0 pt-0.5">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          {isToday && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-400 uppercase tracking-wider">
                              Today
                            </span>
                          )}
                        </div>
                        <h4 className="text-[13px] font-semibold text-zinc-200 truncate group-hover:text-white transition-colors">
                          {e.title}
                        </h4>
                        <p className="text-[11px] text-zinc-600 mt-0.5">
                          {e.startTime} – {e.endTime}
                        </p>
                      </div>

                      {/* Join button */}
                      <Link
                        href="/dashboard/meetings"
                        className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 hover:text-violet-300 transition-all flex-shrink-0 flex items-center gap-1"
                        onClick={(ev) => ev.stopPropagation()}
                      >
                        Join
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
