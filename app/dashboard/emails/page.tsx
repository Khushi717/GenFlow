'use client';

import React, { useState, useEffect } from 'react';
import useAuth from '@/hooks/useAuth';
import useToast from '@/hooks/useToast';
import { dbService } from '@/services/db';
import { generateEmail } from '@/services/gemini';
import { GeneratedEmail } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PenSquare,
  Copy,
  Download,
  Mail,
  Sparkles,
  History,
  Send,
  Clock,
  FileText,
  Loader2,
  FolderOpen,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Wand2,
  Minimize2,
  Maximize2,
  CheckCircle2,
  User,
  AtSign,
  AlignLeft,
  Zap,
} from 'lucide-react';

/* ─────────────── Types ─────────────── */
type Tone = 'professional' | 'friendly' | 'formal' | 'casual';

/* ─────────────── Reusable Sub-Components ─────────────── */

function ToneBadge({ tone }: { tone: Tone }) {
  const map: Record<Tone, string> = {
    professional: 'bg-[#60A5FA]/10 text-[#60A5FA] border-[#60A5FA]/20',
    friendly:     'bg-[#34D399]/10 text-[#34D399] border-[#34D399]/20',
    formal:       'bg-[#A78BFA]/10 text-[#A78BFA] border-[#A78BFA]/20',
    casual:       'bg-[#FBBF24]/10 text-[#FBBF24] border-[#FBBF24]/20',
  };
  return (
    <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border capitalize ${map[tone] || map.professional}`}>
      {tone}
    </span>
  );
}

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={`bg-white/5 rounded-2xl animate-pulse ${className || ''}`} />;
}

/* ─────────────── Main Page ─────────────── */

export default function EmailGeneratorPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [emails, setEmails] = useState<GeneratedEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState<GeneratedEmail | null>(null);

  // Form Fields
  const [prompt, setPrompt] = useState('');
  const [tone, setTone] = useState<Tone>('professional');
  const [generating, setGenerating] = useState(false);

  // UI State
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadEmails();
  }, [user]);

  async function loadEmails() {
    try {
      const data = await dbService.getEmails(user!.uid);
      setEmails(data);
      if (data.length > 0 && !selectedEmail) {
        setSelectedEmail(data[0]);
      }
    } catch (err) {
      console.error(err);
      toast('Failed to load email history.', 'error');
    } finally {
      setLoading(false);
    }
  }

  const handleGenerateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) {
      toast('Please specify instructions for your email.', 'error');
      return;
    }

    setGenerating(true);
    toast('Drafting email with Gemini...', 'info');

    try {
      const result = await generateEmail(prompt, tone);

      // Save to Database
      const newEmail = await dbService.saveEmail(user!.uid, {
        subject: result.subject,
        body: result.body,
        prompt: prompt,
        tone: tone,
      });

      toast('Email draft created successfully!', 'success');
      loadEmails();
      setSelectedEmail(newEmail);
      setPrompt('');
    } catch (err) {
      console.error(err);
      toast('Failed to generate email.', 'error');
    } finally {
      setGenerating(false);
    }
  };

  /* AI Suggestion: regenerate with modified prompt */
  const handleSuggestion = async (suggestionPrompt: string) => {
    if (!selectedEmail) return;
    setGenerating(true);
    toast('Applying AI suggestion...', 'info');
    try {
      const result = await generateEmail(
        `${suggestionPrompt}. Original email: ${selectedEmail.body}`,
        tone
      );
      const newEmail = await dbService.saveEmail(user!.uid, {
        subject: result.subject,
        body: result.body,
        prompt: suggestionPrompt,
        tone: tone,
      });
      toast('Email improved!', 'success');
      loadEmails();
      setSelectedEmail(newEmail);
    } catch {
      toast('Failed to apply suggestion.', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast('Copied to clipboard!', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadEmail = (email: GeneratedEmail) => {
    const text = `Subject: ${email.subject}\n\n${email.body}`;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${email.subject.replace(/\s+/g, '_') || 'email_draft'}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    toast('Download started.', 'success');
  };

  const wordCount = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;
  const readingTime = (text: string) => Math.max(1, Math.ceil(wordCount(text) / 200));

  /* ─────────────── Loading State ─────────────── */
  if (loading) {
    return (
      <div className="p-8 space-y-6 animate-fade-in">
        <SkeletonBlock className="h-12 w-72" />
        <SkeletonBlock className="h-5 w-96" />
        <div className="grid grid-cols-1 lg:grid-cols-[35%_1fr] gap-6 mt-6">
          <div className="space-y-6">
            <SkeletonBlock className="h-72" />
            <SkeletonBlock className="h-48" />
          </div>
          <div className="space-y-6">
            <SkeletonBlock className="h-20" />
            <SkeletonBlock className="h-64" />
          </div>
        </div>
      </div>
    );
  }

  /* ─────────────── Tone Chips ─────────────── */
  const tones: { value: Tone; label: string; color: string; activeClass: string }[] = [
    { value: 'professional', label: 'Professional', color: 'text-[#60A5FA]', activeClass: 'bg-[#60A5FA]/10 border-[#60A5FA]/40 text-[#60A5FA]' },
    { value: 'friendly',     label: 'Friendly',     color: 'text-[#34D399]', activeClass: 'bg-[#34D399]/10 border-[#34D399]/40 text-[#34D399]' },
    { value: 'formal',       label: 'Formal',       color: 'text-[#A78BFA]', activeClass: 'bg-[#A78BFA]/10 border-[#A78BFA]/40 text-[#A78BFA]' },
    { value: 'casual',       label: 'Casual',       color: 'text-[#FBBF24]', activeClass: 'bg-[#FBBF24]/10 border-[#FBBF24]/40 text-[#FBBF24]' },
  ];

  /* ─────────────── AI Suggestions ─────────────── */
  const suggestions = [
    { icon: Wand2,    label: 'Improve Tone',          prompt: 'Improve the tone to sound more polished and professional' },
    { icon: Minimize2, label: 'Shorten Email',         prompt: 'Shorten this email to be more concise and to the point' },
    { icon: Maximize2, label: 'Expand Details',        prompt: 'Expand this email with more detail and context' },
    { icon: CheckCircle2, label: 'Fix Grammar',        prompt: 'Fix any grammar and spelling issues in this email' },
    { icon: RefreshCw, label: 'Rewrite Professionally', prompt: 'Rewrite this email in a highly professional corporate tone' },
    { icon: Zap,       label: 'Make It Punchy',        prompt: 'Rewrite this email to be more direct, punchy and impactful' },
  ];

  /* ─────────────── Main Render ─────────────── */
  return (
    <div className="p-8 space-y-8 animate-fade-in">
      {/* ═══════ Page Header ═══════ */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
            Email Generator
          </h1>
          <p className="text-sm text-zinc-400 mt-1.5 max-w-xl">
            Generate professional AI-powered emails tailored to your tone, audience and context.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setPrompt('')}
            className="btn-primary h-11 px-5 rounded-xl text-sm font-semibold flex items-center gap-2"
          >
            <PenSquare className="w-4 h-4" />
            New Email
          </button>
          {emails.length > 0 && (
            <button className="btn-secondary h-11 px-5 rounded-xl text-sm font-semibold flex items-center gap-2">
              <History className="w-4 h-4" />
              History
            </button>
          )}
        </div>
      </div>

      {/* ═══════ Two-Column Layout ═══════ */}
      <div className="grid grid-cols-1 lg:grid-cols-[35%_1fr] gap-6">

        {/* ─── LEFT PANEL ─── */}
        <div className="space-y-6">

          {/* Email Settings Card */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="rounded-2xl border border-white/[0.08] bg-[#16161D] p-6 space-y-5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#A78BFA]/10 flex items-center justify-center">
                  <Mail className="w-4 h-4 text-[#A78BFA]" />
                </div>
                <h3 className="text-sm font-semibold text-white">Email Settings</h3>
              </div>

              <form onSubmit={handleGenerateEmail} className="space-y-5">

                {/* Tone Chips */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-zinc-400 ml-0.5">Email Tone</label>
                  <div className="grid grid-cols-2 gap-2">
                    {tones.map((t) => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setTone(t.value)}
                        className={`h-9 rounded-xl border text-xs font-medium transition-all duration-200 ${
                          tone === t.value
                            ? t.activeClass
                            : 'border-white/10 text-zinc-400 hover:border-white/20 hover:text-white bg-transparent'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Prompt Textarea */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-zinc-400 ml-0.5" htmlFor="email-prompt">
                      Prompt / Instructions
                    </label>
                    <span className="text-[10px] text-zinc-600">
                      {prompt.length.toLocaleString()} chars
                    </span>
                  </div>
                  <textarea
                    id="email-prompt"
                    rows={9}
                    className="w-full bg-[#0B0B0F] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#A78BFA] focus:shadow-[0_0_0_1px_#A78BFA] resize-none transition-all leading-relaxed"
                    placeholder="Describe what you want the AI to write..."
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    required
                  />
                </div>

                {/* Generate Button */}
                <button
                  type="submit"
                  disabled={generating}
                  className="w-full h-12 bg-gradient-to-r from-[#A78BFA] to-[#C084FC] text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 hover:-translate-y-0.5 hover:shadow-[0_0_24px_rgba(167,139,250,0.4)] active:scale-[0.98] transition-all disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none"
                >
                  {generating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Drafting Email...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Generate Email Draft
                    </>
                  )}
                </button>
              </form>
            </div>
          </motion.div>

          {/* Email History */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <div className="rounded-2xl border border-white/[0.08] bg-[#16161D] p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <History className="w-4 h-4 text-[#A78BFA]" />
                  Email History
                </h3>
                <span className="text-[11px] text-zinc-500">{emails.length} drafts</span>
              </div>
              <div className="space-y-2 max-h-[280px] overflow-y-auto custom-scrollbar pr-1">
                {emails.length === 0 ? (
                  <div className="text-center py-8 text-zinc-500">
                    <Mail className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-xs">No emails yet</p>
                  </div>
                ) : (
                  emails.map((e) => (
                    <div
                      key={e.id}
                      onClick={() => setSelectedEmail(e)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all duration-200 group ${
                        selectedEmail?.id === e.id
                          ? 'bg-[#A78BFA]/10 border-[#A78BFA]/30'
                          : 'bg-white/[0.02] border-transparent hover:bg-white/[0.05] hover:border-white/10'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          selectedEmail?.id === e.id ? 'bg-[#A78BFA]/20' : 'bg-white/5'
                        }`}>
                          <Mail className={`w-4 h-4 ${selectedEmail?.id === e.id ? 'text-[#A78BFA]' : 'text-zinc-400'}`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm truncate font-medium ${selectedEmail?.id === e.id ? 'text-[#A78BFA]' : 'text-white'}`}>
                            {e.subject}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <ToneBadge tone={e.tone} />
                            <span className="text-[10px] text-zinc-600">
                              {new Date(e.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        </div>

        {/* ─── RIGHT PANEL ─── */}
        <div className="space-y-6">
          <AnimatePresence mode="wait">
            {selectedEmail ? (
              <motion.div
                key={selectedEmail.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
                className="space-y-4"
              >
                {/* Gmail-style Email Preview */}
                <div className="rounded-2xl border border-white/[0.08] bg-[#16161D] overflow-hidden">

                  {/* Email Header */}
                  <div className="p-6 border-b border-white/[0.06] bg-white/[0.02] flex flex-wrap justify-between items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-lg text-white leading-snug">
                        {selectedEmail.subject}
                      </h3>
                      <div className="flex items-center gap-3 mt-2">
                        <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                          <User className="w-3.5 h-3.5" />
                          <span>FlowMind AI</span>
                        </div>
                        <span className="w-1 h-1 rounded-full bg-zinc-600" />
                        <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{new Date(selectedEmail.createdAt).toLocaleString()}</span>
                        </div>
                        <span className="w-1 h-1 rounded-full bg-zinc-600" />
                        <ToneBadge tone={selectedEmail.tone} />
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCopyToClipboard(`${selectedEmail.subject}\n\n${selectedEmail.body}`)}
                        className="btn-secondary h-10 px-4 rounded-xl text-xs font-semibold flex items-center gap-1.5"
                      >
                        {copied ? <CheckCircle2 className="w-4 h-4 text-[#34D399]" /> : <Copy className="w-4 h-4" />}
                        {copied ? 'Copied!' : 'Copy'}
                      </button>
                      <button
                        onClick={() => handleDownloadEmail(selectedEmail)}
                        className="btn-secondary h-10 px-4 rounded-xl text-xs font-semibold flex items-center gap-1.5"
                      >
                        <Download className="w-4 h-4" />
                        Download
                      </button>
                      <button
                        disabled
                        className="h-10 px-4 rounded-xl text-xs font-semibold flex items-center gap-1.5 bg-white/5 text-zinc-600 border border-white/5 cursor-not-allowed"
                        title="Coming soon"
                      >
                        <Send className="w-4 h-4" />
                        Send
                      </button>
                    </div>
                  </div>

                  {/* Email Meta Header (From / To) */}
                  <div className="px-6 py-3 border-b border-white/[0.04] bg-white/[0.01] flex flex-wrap gap-x-6 gap-y-1">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-zinc-500 w-6">From</span>
                      <span className="text-zinc-300">FlowMind AI Assistant &lt;ai@genflow.app&gt;</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-zinc-500 w-6">To</span>
                      <span className="text-zinc-300">recipient@example.com</span>
                    </div>
                  </div>

                  {/* Email Body */}
                  <div className="p-6 overflow-y-auto custom-scrollbar max-h-[420px]">
                    <pre className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap font-sans">
                      {selectedEmail.body}
                    </pre>
                  </div>

                  {/* Email Footer */}
                  <div className="px-6 py-4 border-t border-white/[0.04] bg-white/[0.01] flex items-center justify-between">
                    <span className="text-[11px] text-zinc-600">Generated by FlowMind AI · GenFlow</span>
                    <span className="text-[11px] text-zinc-600">
                      {wordCount(selectedEmail.body)} words · ~{readingTime(selectedEmail.body)} min read
                    </span>
                  </div>
                </div>

                {/* Prompt Info Card */}
                <div className="rounded-2xl border border-white/[0.08] bg-[#16161D] p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <AlignLeft className="w-4 h-4 text-[#A78BFA]" />
                    <h4 className="text-sm font-semibold text-white">Prompt Info</h4>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Tone', value: selectedEmail.tone, icon: Sparkles },
                      { label: 'Words', value: wordCount(selectedEmail.body).toString(), icon: FileText },
                      { label: 'Read Time', value: `~${readingTime(selectedEmail.body)}m`, icon: Clock },
                      { label: 'Generated', value: new Date(selectedEmail.createdAt).toLocaleDateString(), icon: History },
                    ].map((item, idx) => (
                      <div key={idx} className="bg-white/[0.03] rounded-xl p-3 border border-white/[0.05]">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <item.icon className="w-3.5 h-3.5 text-[#A78BFA]" />
                          <span className="text-[11px] text-zinc-500">{item.label}</span>
                        </div>
                        <p className="text-sm font-semibold text-white capitalize">{item.value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="bg-white/[0.02] rounded-xl p-3 border border-white/[0.05]">
                    <p className="text-[11px] text-zinc-500 mb-1">Original Prompt</p>
                    <p className="text-xs text-zinc-300 leading-relaxed">"{selectedEmail.prompt}"</p>
                  </div>
                </div>

                {/* AI Suggestions Panel */}
                <div className="rounded-2xl border border-white/[0.08] bg-[#16161D] overflow-hidden">
                  <button
                    onClick={() => setShowSuggestions(!showSuggestions)}
                    className="w-full px-5 py-4 flex items-center justify-between text-sm font-semibold text-white hover:bg-white/[0.02] transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-[#A78BFA]" />
                      AI Suggestions
                    </span>
                    {showSuggestions ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
                  </button>

                  <AnimatePresence>
                    {showSuggestions && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-5 pb-5 pt-1 grid grid-cols-2 md:grid-cols-3 gap-2.5">
                          {suggestions.map((s, idx) => (
                            <button
                              key={idx}
                              onClick={() => handleSuggestion(s.prompt)}
                              disabled={generating}
                              className="flex items-center gap-2 p-3 rounded-xl border border-white/[0.06] bg-white/[0.02] text-xs text-zinc-300 hover:bg-white/[0.06] hover:border-[#A78BFA]/30 hover:text-[#A78BFA] transition-all duration-200 text-left disabled:opacity-40 group"
                            >
                              <s.icon className="w-3.5 h-3.5 text-zinc-500 group-hover:text-[#A78BFA] shrink-0 transition-colors" />
                              {s.label}
                            </button>
                          ))}
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
                  <Mail className="w-10 h-10 text-zinc-600" />
                </div>
                <p className="font-semibold text-lg text-white">No Draft Selected</p>
                <p className="text-sm text-zinc-400 mt-2 max-w-sm">
                  Configure your email settings on the left and click Generate to create an AI-powered email draft.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
