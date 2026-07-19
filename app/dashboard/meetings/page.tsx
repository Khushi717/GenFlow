'use client';

import React, { useState, useEffect } from 'react';
import useAuth from '@/hooks/useAuth';
import useToast from '@/hooks/useToast';
import { dbService } from '@/services/db';
import { summarizeMeeting, generateEmail } from '@/services/gemini';
import { Meeting } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  BookOpen,
  CheckSquare,
  Download,
  Clock,
  Calendar,
  Mic,
  Users,
  Scale,
  Sparkles,
  RefreshCcw,
  Trash2,
  FolderOpen,
  Brain,
  Shield,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  Loader2,
  Share2,
  CheckCircle2,
  MessageSquare,
  Target,
  Video,
} from 'lucide-react';

/* ─────────────── Reusable Sub-Components ─────────────── */

function SectionBadge({ label, color = 'purple' }: { label: string; color?: string }) {
  const colors: Record<string, string> = {
    purple: 'bg-[#A78BFA]/10 text-[#A78BFA] border-[#A78BFA]/20',
    blue: 'bg-[#60A5FA]/10 text-[#60A5FA] border-[#60A5FA]/20',
    amber: 'bg-[#FBBF24]/10 text-[#FBBF24] border-[#FBBF24]/20',
    emerald: 'bg-[#34D399]/10 text-[#34D399] border-[#34D399]/20',
    red: 'bg-[#F87171]/10 text-[#F87171] border-[#F87171]/20',
  };
  return (
    <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${colors[color] || colors.purple}`}>
      {label}
    </span>
  );
}

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={`bg-white/5 rounded-2xl animate-pulse ${className || ''}`} />;
}

/* Tab icon mapping */
const tabIcons: Record<string, React.ElementType> = {
  summary: BookOpen,
  actionItems: CheckSquare,
  decisions: Scale,
  participants: Users,
  insights: Brain,
};

/* ─────────────── Main Page ─────────────── */

export default function MeetingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);

  // Form Inputs
  const [transcriptInput, setTranscriptInput] = useState('');
  const [meetingTitle, setMeetingTitle] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Tab State for Active Viewer
  const [activeTab, setActiveTab] = useState<'summary' | 'actionItems' | 'decisions' | 'participants' | 'insights'>('summary');
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!user) return;
    loadMeetings();
  }, [user]);

  async function loadMeetings() {
    try {
      const data = await dbService.getMeetings(user!.uid);
      setMeetings(data);
      if (data.length > 0 && !selectedMeeting) {
        setSelectedMeeting(data[0]);
      }
    } catch (err) {
      console.error(err);
      toast('Failed to load meetings list.', 'error');
    } finally {
      setLoading(false);
    }
  }

  // Handle meeting notes generation & workflow automation
  const handleProcessMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transcriptInput.trim()) {
      toast('Please paste a meeting transcript first.', 'error');
      return;
    }

    const titleStr = meetingTitle.trim() || `Project Alignment Session - ${new Date().toLocaleDateString()}`;
    setIsProcessing(true);
    toast('Analyzing transcript with Gemini...', 'info');

    try {
      const result = await summarizeMeeting(transcriptInput);

      // Save initial meeting to DB
      const savedMeeting = await dbService.saveMeeting(user!.uid, {
        title: titleStr,
        date: new Date().toISOString().split('T')[0],
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        duration: '45 mins',
        summary: result.summary,
        actionItems: result.actionItems,
        decisions: result.decisions,
        participants: result.participants,
        transcript: transcriptInput,
        workflowTriggered: false,
      });

      setSelectedMeeting(savedMeeting);
      setTranscriptInput('');
      setMeetingTitle('');
      toast('Meeting summary generated successfully!', 'success');

      // Trigger automatic workflow automation!
      await triggerWorkflowAutomation(savedMeeting);
      
      loadMeetings();
    } catch (err) {
      console.error(err);
      toast('Failed to process meeting notes.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Workflow Automation logic
  const triggerWorkflowAutomation = async (meeting: Meeting) => {
    toast('Executing Automated Workflow...', 'info');
    try {
      let tasksCreated = 0;
      let eventsScheduled = 0;
      let emailDrafted = false;

      // 1. Create Tasks based on Action Items
      if (meeting.actionItems && meeting.actionItems.length > 0) {
        for (const item of meeting.actionItems) {
          const lower = item.toLowerCase();
          const priority = lower.includes('urgent') || lower.includes('asap') || lower.includes('credentials') ? 'high' : lower.includes('design') || lower.includes('kanban') ? 'medium' : 'low';
          
          await dbService.saveTask(user!.uid, {
            title: item,
            description: `Generated automatically from meeting action items of: "${meeting.title}".`,
            priority,
            dueDate: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
            category: 'Action Item',
            status: 'todo',
          });
          tasksCreated++;
        }
      }

      // 2. Create Follow-up Review Calendar Event
      const reviewDate = new Date();
      reviewDate.setDate(reviewDate.getDate() + 7);
      const reviewDateStr = reviewDate.toISOString().split('T')[0];

      await dbService.saveEvent(user!.uid, {
        title: `Follow-up: ${meeting.title}`,
        date: reviewDateStr,
        startTime: '11:00',
        endTime: '11:30',
        description: `Automated follow-up review for: "${meeting.title}". Action items verification.`,
      });
      eventsScheduled++;

      // 3. Generate Follow-up Email Draft
      const emailContent = await generateEmail(
        `Summarize action items and decisions for meeting: ${meeting.title}. Action items: ${meeting.actionItems.join(', ')}. Decisions: ${meeting.decisions.join(', ')}`,
        'professional'
      );

      await dbService.saveEmail(user!.uid, {
        subject: emailContent.subject,
        body: emailContent.body,
        prompt: `Meeting follow-up: ${meeting.title}`,
        tone: 'professional',
      });
      emailDrafted = true;

      // Update meeting in DB to note automation completed
      await dbService.saveMeeting(user!.uid, {
        ...meeting,
        workflowTriggered: true,
      });

      toast(
        `Automation Sync Completed: ${tasksCreated} Tasks created, ${eventsScheduled} Calendar Event scheduled, 1 Follow-up Email draft generated!`,
        'success'
      );
    } catch (err) {
      console.error(err);
      toast('Workflow automation encountered an error.', 'error');
    }
  };

  const handleDeleteMeeting = async (id: string) => {
    if (!confirm('Are you sure you want to delete this meeting summary?')) return;
    try {
      await dbService.deleteMeeting(user!.uid, id);
      toast('Meeting notes deleted.', 'success');
      
      const list = meetings.filter((m) => m.id !== id);
      setMeetings(list);
      if (selectedMeeting?.id === id) {
        setSelectedMeeting(list[0] || null);
      }
    } catch (err) {
      toast('Failed to delete meeting summary.', 'error');
    }
  };

  const handleDownloadPDF = (meeting: Meeting) => {
    const text = `FLOWMIND AI MEETING NOTES
Title: ${meeting.title}
Date: ${meeting.date} at ${meeting.time}
Duration: ${meeting.duration}

PARTICIPANTS:
${meeting.participants.join(', ')}

SUMMARY:
${meeting.summary}

DECISIONS MADE:
${meeting.decisions.map((d) => `- ${d}`).join('\n')}

ACTION ITEMS ASSIGNED:
${meeting.actionItems.map((a) => `- ${a}`).join('\n')}

Workflow Automated Sync Status: ${meeting.workflowTriggered ? 'Completed' : 'Pending'}
Generated by FlowMind AI.
`;

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${meeting.title.replace(/\s+/g, '_')}_summary.txt`;
    link.click();
    URL.revokeObjectURL(url);
    toast('Download started.', 'success');
  };

  const toggleCheck = (key: string) => {
    setCheckedItems(prev => ({ ...prev, [key]: !prev[key] }));
  };

  /* ─────────────── Loading State ─────────────── */
  if (loading) {
    return (
      <div className="p-8 space-y-6 animate-fade-in">
        <SkeletonBlock className="h-12 w-80" />
        <SkeletonBlock className="h-5 w-96" />
        <div className="grid grid-cols-1 lg:grid-cols-[40%_1fr] gap-6 mt-6">
          <div className="space-y-6">
            <SkeletonBlock className="h-80" />
            <SkeletonBlock className="h-48" />
          </div>
          <div className="space-y-6">
            <SkeletonBlock className="h-20" />
            <SkeletonBlock className="h-12" />
            <SkeletonBlock className="h-64" />
          </div>
        </div>
      </div>
    );
  }

  /* ─────────────── Tab definitions ─────────────── */
  const tabs = [
    { key: 'summary', name: 'Summary' },
    { key: 'actionItems', name: 'Action Items' },
    { key: 'decisions', name: 'Decisions' },
    { key: 'participants', name: 'Participants' },
    { key: 'insights', name: 'AI Insights' },
  ] as const;

  /* ─────────────── Main Render ─────────────── */
  return (
    <div className="p-8 space-y-8 animate-fade-in">
      {/* ═══════ Page Header ═══════ */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
            Meeting Notes & Automation
          </h1>
          <p className="text-sm text-zinc-400 mt-1.5 max-w-xl">
            Upload or paste meeting transcripts to generate summaries, action items and follow-up workflows.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setSelectedMeeting(null);
              setMeetingTitle('');
              setTranscriptInput('');
            }}
            className="btn-primary h-11 px-5 rounded-xl text-sm font-semibold flex items-center gap-2"
          >
            <Mic className="w-4 h-4" />
            New Meeting
          </button>
          {selectedMeeting && (
            <button
              onClick={() => handleDownloadPDF(selectedMeeting)}
              className="btn-secondary h-11 px-5 rounded-xl text-sm font-semibold flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download
            </button>
          )}
        </div>
      </div>

      {/* ═══════ Two-Column Layout ═══════ */}
      <div className="grid grid-cols-1 lg:grid-cols-[40%_1fr] gap-6">

        {/* ─── LEFT PANEL ─── */}
        <div className="space-y-6">

          {/* Meeting Input Card */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="rounded-2xl border border-white/[0.08] bg-[#16161D] p-6 space-y-5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#A78BFA]/10 flex items-center justify-center">
                  <Video className="w-4 h-4 text-[#A78BFA]" />
                </div>
                <h3 className="text-sm font-semibold text-white">New Meeting Summary</h3>
              </div>

              <form onSubmit={handleProcessMeeting} className="space-y-4">
                {/* Meeting Title */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-400 ml-0.5" htmlFor="m-title">
                    Meeting Title
                  </label>
                  <input
                    type="text"
                    id="m-title"
                    className="w-full h-11 bg-[#0B0B0F] border border-white/10 rounded-xl px-4 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#A78BFA] focus:shadow-[0_0_0_1px_#A78BFA] transition-all"
                    placeholder="e.g. Design Sync & Auth Alignment"
                    value={meetingTitle}
                    onChange={(e) => setMeetingTitle(e.target.value)}
                  />
                </div>

                {/* Date & Duration Row */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-zinc-400 ml-0.5">Date</label>
                    <div className="h-11 bg-[#0B0B0F] border border-white/10 rounded-xl px-4 flex items-center gap-2 text-sm text-zinc-500">
                      <Calendar className="w-4 h-4 text-zinc-500" />
                      {new Date().toLocaleDateString()}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-zinc-400 ml-0.5">Duration</label>
                    <div className="h-11 bg-[#0B0B0F] border border-white/10 rounded-xl px-4 flex items-center gap-2 text-sm text-zinc-500">
                      <Clock className="w-4 h-4 text-zinc-500" />
                      45 mins
                    </div>
                  </div>
                </div>

                {/* Transcript Textarea */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-zinc-400 ml-0.5" htmlFor="m-trans">
                      Meeting Transcript
                    </label>
                    <span className="text-[10px] text-zinc-600">
                      {transcriptInput.length.toLocaleString()} chars
                    </span>
                  </div>
                  <textarea
                    id="m-trans"
                    rows={10}
                    className="w-full bg-[#0B0B0F] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#A78BFA] focus:shadow-[0_0_0_1px_#A78BFA] resize-none transition-all leading-relaxed"
                    placeholder="Paste meeting transcript here..."
                    value={transcriptInput}
                    onChange={(e) => setTranscriptInput(e.target.value)}
                    required
                  />
                </div>

                {/* Generate Button */}
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="w-full h-12 bg-gradient-to-r from-[#A78BFA] to-[#C084FC] text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 hover:-translate-y-0.5 hover:shadow-[0_0_24px_rgba(167,139,250,0.4)] active:scale-[0.98] transition-all disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Parsing Transcript...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Generate & Automate
                    </>
                  )}
                </button>
              </form>
            </div>
          </motion.div>

          {/* Meeting History */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <div className="rounded-2xl border border-white/[0.08] bg-[#16161D] p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#A78BFA]" />
                  Summary History
                </h3>
                <span className="text-[11px] text-zinc-500">{meetings.length} meetings</span>
              </div>
              <div className="space-y-2 max-h-[280px] overflow-y-auto custom-scrollbar pr-1">
                {meetings.length === 0 ? (
                  <div className="text-center py-8 text-zinc-500">
                    <FolderOpen className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-xs">No meetings yet</p>
                  </div>
                ) : (
                  meetings.map((m) => (
                    <div
                      key={m.id}
                      onClick={() => setSelectedMeeting(m)}
                      className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all duration-200 group ${
                        selectedMeeting?.id === m.id
                          ? 'bg-[#A78BFA]/10 border-[#A78BFA]/30'
                          : 'bg-white/[0.02] border-transparent hover:bg-white/[0.05] hover:border-white/10'
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                        selectedMeeting?.id === m.id ? 'bg-[#A78BFA]/20' : 'bg-white/5'
                      }`}>
                        <Video className={`w-4 h-4 ${selectedMeeting?.id === m.id ? 'text-[#A78BFA]' : 'text-zinc-400'}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm truncate ${selectedMeeting?.id === m.id ? 'text-[#A78BFA] font-semibold' : 'text-white'}`}>
                          {m.title}
                        </p>
                        <p className="text-[11px] text-zinc-500 mt-0.5 flex items-center gap-1.5">
                          <span>{m.date}</span>
                          <span className="w-1 h-1 rounded-full bg-zinc-600" />
                          <span>{m.duration}</span>
                          {m.workflowTriggered && (
                            <>
                              <span className="w-1 h-1 rounded-full bg-zinc-600" />
                              <span className="text-[#34D399]">Synced</span>
                            </>
                          )}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteMeeting(m.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 transition-all p-1 rounded-lg hover:bg-red-400/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        </div>

        {/* ─── RIGHT PANEL ─── */}
        <div>
          <AnimatePresence mode="wait">
            {selectedMeeting ? (
              <motion.div
                key={selectedMeeting.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
                className="rounded-2xl border border-white/[0.08] bg-[#16161D] overflow-hidden flex flex-col"
              >
                {/* Meeting Info Header */}
                <div className="p-6 border-b border-white/[0.06] bg-white/[0.02] flex flex-wrap justify-between items-center gap-4">
                  <div className="flex gap-3 items-center">
                    <div className="w-11 h-11 rounded-xl bg-[#60A5FA]/10 flex items-center justify-center">
                      <Video className="w-5 h-5 text-[#60A5FA]" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-base text-white">{selectedMeeting.title}</h3>
                      <p className="text-xs text-zinc-400 mt-0.5 flex items-center gap-2">
                        <span>{selectedMeeting.date}</span>
                        <span className="w-1 h-1 rounded-full bg-zinc-600" />
                        <span>{selectedMeeting.time}</span>
                        <span className="w-1 h-1 rounded-full bg-zinc-600" />
                        <span>{selectedMeeting.duration}</span>
                        <span className="w-1 h-1 rounded-full bg-zinc-600" />
                        <span>{selectedMeeting.participants?.length || 0} participants</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDownloadPDF(selectedMeeting)}
                      className="btn-secondary h-10 px-4 rounded-xl text-xs font-semibold flex items-center gap-1.5"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </button>
                    <button
                      onClick={() => triggerWorkflowAutomation(selectedMeeting)}
                      className="btn-primary h-10 px-4 rounded-xl text-xs font-semibold flex items-center gap-1.5"
                    >
                      <RefreshCcw className="w-4 h-4" />
                      Re-Run AI
                    </button>
                    <button className="btn-secondary h-10 px-4 rounded-xl text-xs font-semibold flex items-center gap-1.5">
                      <Share2 className="w-4 h-4" />
                      Share
                    </button>
                  </div>
                </div>

                {/* Premium Tabs */}
                <div className="flex border-b border-white/[0.06] bg-white/[0.01] px-2">
                  {tabs.map((tab) => {
                    const Icon = tabIcons[tab.key];
                    return (
                      <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key as typeof activeTab)}
                        className={`relative flex-1 py-3.5 text-xs font-medium flex items-center justify-center gap-1.5 transition-all focus:outline-none cursor-pointer ${
                          activeTab === tab.key
                            ? 'text-[#A78BFA]'
                            : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="hidden sm:inline">{tab.name}</span>
                        {activeTab === tab.key && (
                          <motion.div
                            layoutId="activeTab"
                            className="absolute bottom-0 left-2 right-2 h-0.5 bg-[#A78BFA] rounded-full"
                            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Tab Contents */}
                <div className="p-6 flex-1 overflow-y-auto custom-scrollbar min-h-[350px]">
                  <AnimatePresence mode="wait">

                    {/* ──── Summary Tab ──── */}
                    {activeTab === 'summary' && (
                      <motion.div
                        key="summary"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-4"
                      >
                        <div className="rounded-2xl border border-[#A78BFA]/20 bg-gradient-to-br from-[#A78BFA]/5 to-transparent p-5 space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                              <BookOpen className="w-4 h-4 text-[#A78BFA]" />
                              Executive Summary
                            </h4>
                            <div className="flex items-center gap-2">
                              <SectionBadge label="AI Generated" color="purple" />
                              <SectionBadge label={`~${Math.max(1, Math.ceil((selectedMeeting.summary?.length || 0) / 1000))} min read`} color="blue" />
                            </div>
                          </div>
                          <p className="text-sm text-zinc-300 leading-relaxed">
                            {selectedMeeting.summary}
                          </p>
                        </div>

                        {selectedMeeting.workflowTriggered && (
                          <div className="p-4 bg-[#34D399]/5 border border-[#34D399]/20 rounded-xl flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-[#34D399]/10 flex items-center justify-center shrink-0">
                              <CheckCircle2 className="w-4 h-4 text-[#34D399]" />
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-[#34D399]">Workflow Automation Completed</p>
                              <p className="text-[11px] text-zinc-500 mt-0.5">Tasks, calendar events, and follow-up emails synced to workspace.</p>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    )}

                    {/* ──── Action Items Tab ──── */}
                    {activeTab === 'actionItems' && (
                      <motion.div
                        key="actionItems"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                            <CheckSquare className="w-4 h-4 text-[#34D399]" />
                            Action Items
                          </h4>
                          <span className="text-[11px] text-zinc-500">{selectedMeeting.actionItems.length} tasks</span>
                        </div>
                        <div className="space-y-2">
                          {selectedMeeting.actionItems.map((item, idx) => {
                            const key = `${selectedMeeting.id}-action-${idx}`;
                            const done = checkedItems[key] || false;
                            return (
                              <div
                                key={idx}
                                onClick={() => toggleCheck(key)}
                                className={`flex gap-3 items-start p-4 rounded-xl border cursor-pointer transition-all duration-200 card-hover ${
                                  done
                                    ? 'bg-[#34D399]/5 border-[#34D399]/20'
                                    : 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06]'
                                }`}
                              >
                                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                                  done
                                    ? 'bg-[#34D399] border-[#34D399]'
                                    : 'border-zinc-600 hover:border-[#34D399]'
                                }`}>
                                  {done && (
                                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm leading-relaxed transition-all ${done ? 'text-zinc-500 line-through' : 'text-zinc-300'}`}>
                                    {item}
                                  </p>
                                </div>
                                {!done && (
                                  <SectionBadge
                                    label={idx === 0 ? 'High' : idx === 1 ? 'Medium' : 'Normal'}
                                    color={idx === 0 ? 'amber' : idx === 1 ? 'blue' : 'emerald'}
                                  />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}

                    {/* ──── Decisions Tab ──── */}
                    {activeTab === 'decisions' && (
                      <motion.div
                        key="decisions"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-3"
                      >
                        <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                          <Scale className="w-4 h-4 text-[#FBBF24]" />
                          Decisions Made
                          <span className="text-[11px] text-zinc-500 font-normal ml-1">{selectedMeeting.decisions.length} decisions</span>
                        </h4>
                        <div className="space-y-2">
                          {selectedMeeting.decisions.map((item, idx) => (
                            <div
                              key={idx}
                              className="flex gap-3 items-start bg-white/[0.03] hover:bg-white/[0.06] p-4 rounded-xl border border-white/[0.06] hover:border-[#FBBF24]/20 transition-all duration-200 card-hover"
                            >
                              <div className="w-8 h-8 rounded-lg bg-[#FBBF24]/10 flex items-center justify-center shrink-0">
                                <Target className="w-4 h-4 text-[#FBBF24]" />
                              </div>
                              <div className="flex-1">
                                <p className="text-sm text-zinc-300 leading-relaxed">{item}</p>
                                <p className="text-[11px] text-zinc-600 mt-1.5">Decision #{idx + 1} · {selectedMeeting.date}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}

                    {/* ──── Participants Tab ──── */}
                    {activeTab === 'participants' && (
                      <motion.div
                        key="participants"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-3"
                      >
                        <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                          <Users className="w-4 h-4 text-[#60A5FA]" />
                          Participants
                          <span className="text-[11px] text-zinc-500 font-normal ml-1">{selectedMeeting.participants.length} people</span>
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {selectedMeeting.participants.map((person, idx) => {
                            const colors = ['#A78BFA', '#60A5FA', '#34D399', '#FBBF24', '#F87171', '#C084FC'];
                            const color = colors[idx % colors.length];
                            return (
                              <div
                                key={idx}
                                className="flex gap-3 items-center bg-white/[0.03] hover:bg-white/[0.06] p-4 rounded-xl border border-white/[0.06] transition-all duration-200 card-hover"
                              >
                                <div
                                  className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                                  style={{ backgroundColor: `${color}20`, color }}
                                >
                                  {person.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <p className="text-sm text-white font-medium">{person}</p>
                                  <p className="text-[11px] text-zinc-500 mt-0.5">Contributor</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}

                    {/* ──── AI Insights Tab ──── */}
                    {activeTab === 'insights' && (
                      <motion.div
                        key="insights"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-4"
                      >
                        <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                          <Brain className="w-4 h-4 text-[#A78BFA]" />
                          AI Insights
                        </h4>

                        {/* Metric Cards */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {[
                            { icon: MessageSquare, label: 'Sentiment', value: 'Positive', color: 'text-[#34D399]', bg: 'bg-[#34D399]/10' },
                            { icon: AlertTriangle, label: 'Risk Level', value: 'Low', color: 'text-[#FBBF24]', bg: 'bg-[#FBBF24]/10' },
                            { icon: CheckSquare, label: 'Action Items', value: `${selectedMeeting.actionItems?.length || 0}`, color: 'text-[#60A5FA]', bg: 'bg-[#60A5FA]/10' },
                            { icon: Shield, label: 'Confidence', value: '94%', color: 'text-[#A78BFA]', bg: 'bg-[#A78BFA]/10' },
                          ].map((insight, idx) => (
                            <div key={idx} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-2 hover:bg-white/[0.05] transition-all card-hover">
                              <div className={`w-8 h-8 rounded-lg ${insight.bg} flex items-center justify-center`}>
                                <insight.icon className={`w-4 h-4 ${insight.color}`} />
                              </div>
                              <p className="text-[11px] text-zinc-500">{insight.label}</p>
                              <p className="text-lg font-bold text-white">{insight.value}</p>
                            </div>
                          ))}
                        </div>

                        {/* Recommendations */}
                        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
                          <div className="flex items-center gap-2">
                            <Lightbulb className="w-4 h-4 text-[#FBBF24]" />
                            <p className="text-xs font-semibold text-white">Follow-up Recommendations</p>
                          </div>
                          <ul className="space-y-2">
                            <li className="flex items-start gap-2 text-xs text-zinc-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#A78BFA] mt-1.5 shrink-0" />
                              Schedule a follow-up meeting to review action item progress
                            </li>
                            <li className="flex items-start gap-2 text-xs text-zinc-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#A78BFA] mt-1.5 shrink-0" />
                              Share meeting summary with all {selectedMeeting.participants?.length || 0} participants
                            </li>
                            <li className="flex items-start gap-2 text-xs text-zinc-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#A78BFA] mt-1.5 shrink-0" />
                              Review {selectedMeeting.decisions?.length || 0} decisions for alignment before next sprint
                            </li>
                          </ul>
                        </div>

                        {/* Next Meeting Suggestion */}
                        <div className="rounded-xl border border-[#A78BFA]/20 bg-gradient-to-br from-[#A78BFA]/5 to-transparent p-4 flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-[#A78BFA]/10 flex items-center justify-center shrink-0">
                            <Calendar className="w-5 h-5 text-[#A78BFA]" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-white">Suggested Next Meeting</p>
                            <p className="text-[11px] text-zinc-400 mt-0.5">
                              Follow-up in 7 days · {new Date(Date.now() + 604800000).toLocaleDateString()} at 11:00 AM
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    )}

                  </AnimatePresence>
                </div>
              </motion.div>
            ) : (
              /* Empty State */
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="rounded-2xl border border-white/[0.08] bg-[#16161D] p-16 text-center flex flex-col items-center justify-center min-h-[500px]"
              >
                <div className="w-20 h-20 rounded-2xl bg-white/5 flex items-center justify-center mb-6">
                  <Video className="w-10 h-10 text-zinc-600" />
                </div>
                <p className="font-semibold text-lg text-white">No Meeting Selected</p>
                <p className="text-sm text-zinc-400 mt-2 max-w-sm">
                  Paste a meeting transcript on the left panel to extract summaries, action items and trigger automation workflows.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
