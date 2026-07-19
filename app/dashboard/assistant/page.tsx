'use client';

import React, { useState, useEffect, useRef } from 'react';
import useAuth from '@/hooks/useAuth';
import useToast from '@/hooks/useToast';
import { dbService } from '@/services/db';
import { chatWithAI } from '@/services/gemini';
import { ChatSession, ChatMessage } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Paperclip,
  Mic,
  SendHorizontal,
  MessageSquare,
  History,
  Search,
  Sparkles,
  Brain,
  Settings,
  Plus,
  Trash2,
  X,
  Copy,
  ThumbsUp,
  ThumbsDown,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Zap,
  FileText,
  Calendar,
  Mail,
  Code,
  PenSquare,
  ListTodo,
} from 'lucide-react';

/* ─────────────── Reusable helpers ─────────────── */

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={`bg-white/5 rounded-2xl animate-pulse ${className || ''}`} />;
}

/** Render plain text with very basic markdown-like formatting */
function MessageText({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <div className="space-y-1.5">
      {lines.map((line, i) => {
        // Code block (backtick fence)
        if (line.startsWith('```') || line.startsWith('`')) {
          return (
            <code
              key={i}
              className="block bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-[11px] font-mono text-[#A78BFA] my-1"
            >
              {line.replace(/`/g, '')}
            </code>
          );
        }
        // Bullet / numbered list
        if (/^[-*•]\s/.test(line)) {
          return (
            <p key={i} className="flex gap-2 text-sm leading-relaxed">
              <span className="text-[#A78BFA] mt-0.5 shrink-0">•</span>
              <span>{line.replace(/^[-*•]\s/, '')}</span>
            </p>
          );
        }
        if (/^\d+\.\s/.test(line)) {
          return (
            <p key={i} className="flex gap-2 text-sm leading-relaxed">
              <span className="text-[#A78BFA] shrink-0 font-semibold">{line.match(/^\d+/)?.[0]}.</span>
              <span>{line.replace(/^\d+\.\s/, '')}</span>
            </p>
          );
        }
        // Bold (**text**)
        const boldLine = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        if (line === '') return <div key={i} className="h-2" />;
        return (
          <p
            key={i}
            className="text-sm leading-relaxed"
            dangerouslySetInnerHTML={{ __html: boldLine }}
          />
        );
      })}
    </div>
  );
}

/** Typing animation dots */
function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-1 py-1">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-2 h-2 rounded-full bg-[#A78BFA]"
          animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.1, 0.8] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
        />
      ))}
    </div>
  );
}

/* ─────────────── Quick-action chips ─────────────── */
const QUICK_ACTIONS = [
  { icon: FileText,  label: 'Summarize',     prompt: 'Please summarize the following for me: ' },
  { icon: PenSquare, label: 'Rewrite',        prompt: 'Please rewrite this more clearly: ' },
  { icon: Brain,     label: 'Explain',        prompt: 'Please explain this in simple terms: ' },
  { icon: Sparkles,  label: 'Brainstorm',     prompt: 'Help me brainstorm ideas about: ' },
  { icon: Code,      label: 'Generate Code',  prompt: 'Write clean code for: ' },
  { icon: Mail,      label: 'Draft Email',    prompt: 'Write a professional email about: ' },
  { icon: Calendar,  label: 'Plan Schedule',  prompt: 'Help me plan a schedule for: ' },
  { icon: ListTodo,  label: 'Create Tasks',   prompt: 'Break this into actionable tasks: ' },
];

/* ─────────────── Suggested prompts (welcome screen) ─────────────── */
const SUGGESTED_PROMPTS = [
  { icon: FileText,  label: 'Summarize meeting notes', prompt: 'Help me summarize my meeting notes' },
  { icon: Mail,      label: 'Generate email draft',    prompt: 'Write a professional follow-up email' },
  { icon: ListTodo,  label: 'Create weekly report',    prompt: 'Help me create a weekly productivity report' },
  { icon: Brain,     label: 'Explain a concept',       prompt: 'Explain machine learning in simple terms' },
  { icon: Code,      label: 'Generate code snippet',   prompt: 'Write a React custom hook for data fetching' },
  { icon: Calendar,  label: 'Plan my day',             prompt: 'Help me plan a productive daily schedule' },
];

/* ─────────────── Main Page ─────────────── */

export default function AIAssistantPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [loading, setLoading] = useState(true);

  // Message field & attachments
  const [inputMessage, setInputMessage] = useState('');
  const [attachedFileText, setAttachedFileText] = useState('');
  const [attachedFileName, setAttachedFileName] = useState('');
  const [sending, setSending] = useState(false);

  // UI State
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!user) return;
    loadChatSessions();
  }, [user]);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeSession?.messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  }, [inputMessage]);

  async function loadChatSessions() {
    try {
      const data = await dbService.getChatSessions(user!.uid);
      setSessions(data);
      if (data.length > 0 && !activeSession) {
        setActiveSession(data[0]);
      }
    } catch (err) {
      console.error(err);
      toast('Failed to load chat history.', 'error');
    } finally {
      setLoading(false);
    }
  }

  const handleCreateNewSession = async () => {
    try {
      const newSession: ChatSession = {
        id: `session-${Math.random().toString(36).substr(2, 9)}`,
        userId: user!.uid,
        title: `Chat Session - ${new Date().toLocaleDateString()}`,
        messages: [
          {
            id: 'init-msg',
            sender: 'assistant',
            text: 'Hello! I am your GenFlow Assistant. How can I help you with your productivity today?',
            timestamp: new Date().toISOString(),
          },
        ],
        updatedAt: new Date().toISOString(),
      };

      await dbService.saveChatSession(user!.uid, newSession);
      setSessions((prev) => [newSession, ...prev]);
      setActiveSession(newSession);
      toast('Started new conversation thread.', 'success');
    } catch (err) {
      toast('Failed to start new thread.', 'error');
    }
  };

  const handleSendMessage = async (textToSend: string) => {
    const msg = textToSend.trim();
    if (!msg && !attachedFileText) return;

    if (!activeSession) {
      // Auto-create a session if none
      await handleCreateNewSession();
      return;
    }

    setSending(true);
    setInputMessage('');

    // Form user message
    const userMsg: ChatMessage = {
      id: `msg-${Math.random().toString(36).substr(2, 9)}`,
      sender: 'user',
      text: attachedFileName ? `[Attached File: ${attachedFileName}]\n\n${msg}` : msg,
      timestamp: new Date().toISOString(),
    };

    // Update active session locally
    const updatedMessages = [...activeSession.messages, userMsg];
    const updatedSession = {
      ...activeSession,
      messages: updatedMessages,
      updatedAt: new Date().toISOString(),
    };

    setActiveSession(updatedSession);
    setSessions((prev) => prev.map((s) => (s.id === activeSession.id ? updatedSession : s)));

    // Clear attachment inputs
    const currentAttachmentText = attachedFileText;
    const currentAttachmentName = attachedFileName;
    setAttachedFileText('');
    setAttachedFileName('');

    try {
      // Call Gemini API
      const response = await chatWithAI(
        activeSession.messages.map((m) => ({ sender: m.sender, text: m.text })),
        msg,
        currentAttachmentText
      );

      // Form assistant message
      const aiMsg: ChatMessage = {
        id: `msg-${Math.random().toString(36).substr(2, 9)}`,
        sender: 'assistant',
        text: response,
        timestamp: new Date().toISOString(),
      };

      const finalSession = {
        ...updatedSession,
        messages: [...updatedMessages, aiMsg],
      };

      setActiveSession(finalSession);
      setSessions((prev) => prev.map((s) => (s.id === activeSession.id ? finalSession : s)));

      // Save to Database
      await dbService.saveChatSession(user!.uid, finalSession);
    } catch (err) {
      toast('Failed to receive AI response.', 'error');
    } finally {
      setSending(false);
    }
  };

  const handleAttachedFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const fileType = file.name.split('.').pop()?.toLowerCase();

      if (!['txt', 'md', 'json', 'csv'].includes(fileType || '')) {
        toast('AI Assistant supports text file attachments (TXT, MD, JSON, CSV) in client context.', 'error');
        return;
      }

      const reader = new FileReader();
      reader.onload = (el) => {
        setAttachedFileText(el.target?.result as string);
        setAttachedFileName(file.name);
        toast(`Attached: "${file.name}"`, 'success');
      };
      reader.readAsText(file);
    }
  };

  const handleRemoveAttachment = () => {
    setAttachedFileText('');
    setAttachedFileName('');
  };

  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast('Copied!', 'success');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleQuickAction = (prompt: string) => {
    setInputMessage(prompt);
    textareaRef.current?.focus();
  };

  /* Filtered sessions for search */
  const filteredSessions = sessions.filter((s) =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  /* ─────────────── Loading State ─────────────── */
  if (loading) {
    return (
      <div className="p-8 space-y-6 animate-fade-in h-[calc(100vh-80px)]">
        <div className="grid grid-cols-1 lg:grid-cols-[28%_1fr] gap-6 h-full">
          <SkeletonBlock className="h-full" />
          <SkeletonBlock className="h-full" />
        </div>
      </div>
    );
  }

  /* ─────────────── Main Render ─────────────── */
  return (
    <div className="flex h-[calc(100vh-80px)] overflow-hidden">

      {/* ═══════ LEFT SIDEBAR ═══════ */}
      <AnimatePresence initial={false}>
        {sidebarOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 300, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="shrink-0 flex flex-col border-r border-white/[0.08] bg-[#16161D] overflow-hidden"
          >
            {/* Sidebar Header */}
            <div className="p-4 border-b border-white/[0.06] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#A78BFA]/20 flex items-center justify-center">
                    <Brain className="w-4 h-4 text-[#A78BFA]" />
                  </div>
                  <span className="text-sm font-bold text-white">FlowMind AI</span>
                </div>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>

              {/* New Chat Button */}
              <button
                onClick={handleCreateNewSession}
                className="w-full h-10 bg-gradient-to-r from-[#A78BFA] to-[#C084FC] text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 hover:-translate-y-0.5 hover:shadow-[0_0_20px_rgba(167,139,250,0.3)] transition-all"
              >
                <Plus className="w-4 h-4" />
                New Chat
              </button>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Search conversations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-9 bg-[#0B0B0F] border border-white/10 rounded-xl pl-8 pr-3 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-[#A78BFA] transition-all"
                />
              </div>
            </div>

            {/* Conversation List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1">
              <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider px-2 mb-2">
                Recent
              </p>
              {filteredSessions.length === 0 ? (
                <div className="text-center py-10 text-zinc-600">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-xs">No conversations yet</p>
                </div>
              ) : (
                filteredSessions.map((s) => {
                  const lastMsg = s.messages[s.messages.length - 1];
                  const isActive = activeSession?.id === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setActiveSession(s)}
                      className={`w-full text-left p-3 rounded-xl transition-all duration-200 group ${
                        isActive
                          ? 'bg-[#A78BFA]/10 border border-[#A78BFA]/20'
                          : 'hover:bg-white/[0.04] border border-transparent'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                          <MessageSquare className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${isActive ? 'text-[#A78BFA]' : 'text-zinc-500'}`} />
                          <div className="min-w-0">
                            <p className={`text-xs font-medium truncate ${isActive ? 'text-[#A78BFA]' : 'text-zinc-300'}`}>
                              {s.title}
                            </p>
                            {lastMsg && (
                              <p className="text-[11px] text-zinc-600 truncate mt-0.5">
                                {lastMsg.text.substring(0, 45)}{lastMsg.text.length > 45 ? '…' : ''}
                              </p>
                            )}
                          </div>
                        </div>
                        <span className="text-[10px] text-zinc-600 shrink-0">
                          {new Date(s.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Sidebar Footer */}
            <div className="p-3 border-t border-white/[0.06]">
              <button
                onClick={() => toast('Settings panel coming soon.', 'info')}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs text-zinc-400 hover:text-white hover:bg-white/5 transition-all"
              >
                <Settings className="w-4 h-4" />
                Settings
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* ═══════ MAIN CHAT AREA ═══════ */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#0B0B0F]">

        {/* Chat Topbar */}
        <div className="shrink-0 h-14 border-b border-white/[0.06] bg-[#16161D] flex items-center justify-between px-4 gap-3">
          <div className="flex items-center gap-3">
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#A78BFA] to-[#C084FC] flex items-center justify-center">
                <Brain className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white leading-none">FlowMind AI Copilot</p>
                <p className="text-[10px] text-zinc-500 mt-0.5">
                  {activeSession ? `${activeSession.messages.length} messages` : 'Ready to assist'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeSession && (
              <button
                onClick={handleCreateNewSession}
                className="btn-secondary h-9 px-3.5 rounded-xl text-xs font-medium flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                New Chat
              </button>
            )}
          </div>
        </div>

        {/* Message Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {!activeSession ? (
            /* ── Welcome Screen ── */
            <div className="flex flex-col items-center justify-center h-full px-8 py-12 text-center">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
                className="max-w-xl"
              >
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#A78BFA] to-[#C084FC] flex items-center justify-center mx-auto mb-6 shadow-[0_0_40px_rgba(167,139,250,0.3)]">
                  <Brain className="w-10 h-10 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">FlowMind AI Copilot</h2>
                <p className="text-sm text-zinc-400 mb-8 max-w-sm mx-auto">
                  Ask questions, brainstorm ideas, summarize documents, automate workflows and get intelligent assistance.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left mb-8">
                  {SUGGESTED_PROMPTS.map((sp, idx) => (
                    <motion.button
                      key={idx}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: idx * 0.06 }}
                      onClick={async () => {
                        await handleCreateNewSession();
                        setTimeout(() => handleSendMessage(sp.prompt), 300);
                      }}
                      className="flex items-start gap-3 p-4 rounded-xl border border-white/[0.08] bg-[#16161D] hover:bg-white/[0.06] hover:border-[#A78BFA]/30 transition-all duration-200 text-left group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-[#A78BFA]/10 flex items-center justify-center shrink-0 group-hover:bg-[#A78BFA]/20 transition-colors">
                        <sp.icon className="w-4 h-4 text-[#A78BFA]" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-zinc-200 group-hover:text-white transition-colors">{sp.label}</p>
                        <p className="text-[11px] text-zinc-500 mt-0.5">{sp.prompt}</p>
                      </div>
                    </motion.button>
                  ))}
                </div>
                <button
                  onClick={handleCreateNewSession}
                  className="h-12 px-8 bg-gradient-to-r from-[#A78BFA] to-[#C084FC] text-white rounded-xl font-semibold text-sm flex items-center gap-2 mx-auto hover:-translate-y-0.5 hover:shadow-[0_0_24px_rgba(167,139,250,0.4)] transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Start New Chat
                </button>
              </motion.div>
            </div>
          ) : (
            /* ── Messages ── */
            <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">

              {/* Suggested quick prompts if only 1 message (greeting) */}
              {activeSession.messages.length === 1 && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4"
                >
                  {SUGGESTED_PROMPTS.slice(0, 4).map((sp, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(sp.prompt)}
                      className="flex items-center gap-2 p-3 rounded-xl border border-white/[0.06] bg-[#16161D] hover:bg-white/[0.06] hover:border-[#A78BFA]/30 text-left transition-all text-xs text-zinc-400 hover:text-white"
                    >
                      <sp.icon className="w-3.5 h-3.5 text-[#A78BFA] shrink-0" />
                      {sp.label}
                    </button>
                  ))}
                </motion.div>
              )}

              {/* Message bubbles */}
              {activeSession.messages.map((m, idx) => {
                const isAI = m.sender === 'assistant';
                return (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: idx === activeSession.messages.length - 1 ? 0 : 0 }}
                    className={`flex gap-3 ${isAI ? 'justify-start' : 'justify-end'}`}
                  >
                    {/* AI Avatar */}
                    {isAI && (
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#A78BFA] to-[#C084FC] flex items-center justify-center shrink-0 mt-0.5 shadow-[0_0_12px_rgba(167,139,250,0.25)]">
                        <Brain className="w-4 h-4 text-white" />
                      </div>
                    )}

                    <div className={`flex flex-col gap-1 max-w-[80%] ${isAI ? 'items-start' : 'items-end'}`}>
                      <div
                        className={`px-4 py-3 rounded-2xl ${
                          isAI
                            ? 'bg-[#16161D] border border-white/[0.08] rounded-tl-none text-zinc-200'
                            : 'bg-gradient-to-br from-[#A78BFA] to-[#8B5CF6] rounded-tr-none text-white shadow-[0_0_20px_rgba(167,139,250,0.2)]'
                        }`}
                      >
                        {isAI ? (
                          <MessageText text={m.text} />
                        ) : (
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.text}</p>
                        )}
                        <span className="text-[10px] opacity-40 mt-1.5 block">
                          {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      {/* Message actions (AI only) */}
                      {isAI && (
                        <div className="flex items-center gap-1 px-1">
                          <button
                            onClick={() => handleCopyMessage(m.id, m.text)}
                            className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-white/5 transition-all"
                            title="Copy"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => toast('Helpful — thanks!', 'success')}
                            className="p-1.5 rounded-lg text-zinc-600 hover:text-[#34D399] hover:bg-white/5 transition-all"
                            title="Good response"
                          >
                            <ThumbsUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => toast('Thanks for your feedback.', 'info')}
                            className="p-1.5 rounded-lg text-zinc-600 hover:text-[#F87171] hover:bg-white/5 transition-all"
                            title="Bad response"
                          >
                            <ThumbsDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              const lastUserMsg = [...activeSession.messages].reverse().find(m => m.sender === 'user');
                              if (lastUserMsg) handleSendMessage(lastUserMsg.text);
                            }}
                            className="p-1.5 rounded-lg text-zinc-600 hover:text-[#A78BFA] hover:bg-white/5 transition-all"
                            title="Regenerate"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* User Avatar */}
                    {!isAI && (
                      <div className="w-8 h-8 rounded-xl bg-[#A78BFA]/20 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold text-[#A78BFA]">
                        ME
                      </div>
                    )}
                  </motion.div>
                );
              })}

              {/* AI Thinking indicator */}
              {sending && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-3 justify-start"
                >
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#A78BFA] to-[#C084FC] flex items-center justify-center shrink-0">
                    <Brain className="w-4 h-4 text-white" />
                  </div>
                  <div className="bg-[#16161D] border border-white/[0.08] rounded-2xl rounded-tl-none px-4 py-3">
                    <div className="flex items-center gap-2">
                      <TypingDots />
                      <span className="text-xs text-zinc-500">FlowMind is thinking...</span>
                    </div>
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* ═══════ BOTTOM INPUT AREA ═══════ */}
        {(activeSession || !loading) && (
          <div className="shrink-0 border-t border-white/[0.06] bg-[#0B0B0F] px-4 py-3 space-y-2">
            {/* Quick Action Chips */}
            {activeSession && (
              <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
                {QUICK_ACTIONS.map((qa, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleQuickAction(qa.prompt)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/[0.08] bg-[#16161D] text-[11px] text-zinc-400 hover:text-[#A78BFA] hover:border-[#A78BFA]/30 hover:bg-[#A78BFA]/5 transition-all duration-200 whitespace-nowrap shrink-0"
                  >
                    <qa.icon className="w-3 h-3" />
                    {qa.label}
                  </button>
                ))}
              </div>
            )}

            {/* File attachment badge */}
            {attachedFileName && (
              <div className="inline-flex items-center gap-1.5 bg-[#A78BFA]/10 border border-[#A78BFA]/20 text-[#A78BFA] px-3 py-1 rounded-full text-xs font-medium">
                <Paperclip className="w-3 h-3" />
                <span className="truncate max-w-[180px]">{attachedFileName}</span>
                <button onClick={handleRemoveAttachment} className="hover:text-white transition-colors ml-1">
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* Main Input Bar */}
            <div className="max-w-3xl mx-auto">
              <div className="flex items-end gap-2 bg-[#16161D] border border-white/[0.08] rounded-2xl px-3 py-2.5 focus-within:border-[#A78BFA]/40 focus-within:shadow-[0_0_0_1px_rgba(167,139,250,0.2)] transition-all">
                {/* Attach file */}
                <label className="p-2 rounded-xl text-zinc-500 hover:text-[#A78BFA] hover:bg-white/5 cursor-pointer transition-all shrink-0">
                  <Paperclip className="w-4 h-4" />
                  <input
                    type="file"
                    onChange={handleAttachedFileInput}
                    className="hidden"
                    accept=".txt,.md,.json,.csv"
                  />
                </label>

                {/* Textarea */}
                <textarea
                  ref={textareaRef}
                  rows={1}
                  className="flex-1 bg-transparent text-sm text-white placeholder-zinc-500 focus:outline-none resize-none leading-relaxed py-1.5 max-h-[200px] min-h-[24px]"
                  placeholder="Ask FlowMind anything..."
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage(inputMessage);
                    }
                  }}
                  disabled={sending}
                />

                {/* Mic */}
                <button
                  onClick={() => toast('Voice typing features are under development.', 'info')}
                  className="p-2 rounded-xl text-zinc-500 hover:text-[#A78BFA] hover:bg-white/5 transition-all shrink-0"
                >
                  <Mic className="w-4 h-4" />
                </button>

                {/* Send Button */}
                <button
                  onClick={() => handleSendMessage(inputMessage)}
                  disabled={sending || (!inputMessage.trim() && !attachedFileText)}
                  className="w-9 h-9 rounded-xl bg-gradient-to-r from-[#A78BFA] to-[#C084FC] flex items-center justify-center text-white hover:shadow-[0_0_16px_rgba(167,139,250,0.4)] hover:-translate-y-0.5 active:scale-95 transition-all disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:shadow-none shrink-0"
                >
                  <SendHorizontal className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[10px] text-zinc-600 text-center mt-2">
                Press Enter to send · Shift+Enter for new line · FlowMind can make mistakes — verify important info
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
