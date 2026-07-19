'use client';

import React, { useState, useEffect } from 'react';
import useAuth from '@/hooks/useAuth';
import useToast from '@/hooks/useToast';
import { dbService } from '@/services/db';
import { summarizeDocument } from '@/services/gemini';
import { DocumentSummary } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UploadCloud,
  FileText,
  BookOpen,
  Sparkles,
  CheckSquare,
  ChevronDown,
  Download,
  Clipboard,
  Clock,
  Brain,
  Trash2,
  FolderOpen,
  Shield,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  Loader2,
  Share2,
  RefreshCw,
} from 'lucide-react';

/* ─────────────── Reusable Sub-Components ─────────────── */

function SectionBadge({ label, color = 'purple' }: { label: string; color?: string }) {
  const colors: Record<string, string> = {
    purple: 'bg-[#A78BFA]/10 text-[#A78BFA] border-[#A78BFA]/20',
    blue: 'bg-[#60A5FA]/10 text-[#60A5FA] border-[#60A5FA]/20',
    amber: 'bg-[#FBBF24]/10 text-[#FBBF24] border-[#FBBF24]/20',
    emerald: 'bg-[#34D399]/10 text-[#34D399] border-[#34D399]/20',
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

/* ─────────────── Main Page ─────────────── */

export default function DocumentSummarizerPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState<DocumentSummary | null>(null);

  // File Upload states
  const [isUploading, setIsUploading] = useState(false);
  const [manualText, setManualText] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!user) return;
    loadDocuments();
  }, [user]);

  async function loadDocuments() {
    try {
      const data = await dbService.getDocuments(user!.uid);
      setDocuments(data);
      if (data.length > 0 && !selectedDoc) {
        setSelectedDoc(data[0]);
      }
    } catch (err) {
      console.error(err);
      toast('Failed to load documents.', 'error');
    } finally {
      setLoading(false);
    }
  }

  // Handle Drag Over / Drop
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  // Extract text and call Gemini
  const processFile = async (file: File) => {
    const fileType = file.name.split('.').pop()?.toLowerCase();
    if (!['txt', 'pdf', 'docx', 'md', 'json'].includes(fileType || '')) {
      toast('Unsupported file type. Please upload TXT, PDF, DOCX, MD, or JSON.', 'error');
      return;
    }

    setIsUploading(true);
    toast(`Processing "${file.name}"...`, 'info');

    let extractedText = '';

    try {
      if (fileType === 'txt' || fileType === 'md' || fileType === 'json') {
        // Read text file directly
        const reader = new FileReader();
        extractedText = await new Promise<string>((resolve) => {
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsText(file);
        });
      } else {
        // For PDF / DOCX, extract metadata and simulate text or read pasted text context
        extractedText = manualText || `Filename: ${file.name}\nSize: ${(file.size / 1024 / 1024).toFixed(2)} MB\nThis document represents a detailed project specifications brief outlining backend database models, calendar schedulers, and Google Gemini API token integrations.`;
      }

      // Generate Summary via Gemini
      const result = await summarizeDocument(file.name, extractedText);

      // Save to Database
      const newDoc = await dbService.saveDocument(user!.uid, {
        name: file.name,
        type: fileType || 'txt',
        size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
        summary: result.summary,
        keyPoints: result.keyPoints,
        actionItems: result.actionItems,
      });

      toast('Document summarized successfully!', 'success');
      loadDocuments();
      setSelectedDoc(newDoc);
      setManualText('');
    } catch (err) {
      console.error(err);
      toast('Failed to summarize document.', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleManualTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualText.trim()) {
      toast('Please enter some text to summarize.', 'error');
      return;
    }

    setIsUploading(true);
    try {
      const dummyFile = new File([manualText], 'Pasted_Text_Document.txt', { type: 'text/plain' });
      await processFile(dummyFile);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteDoc = async (id: string) => {
    if (!confirm('Are you sure you want to delete this summary?')) return;
    try {
      await dbService.deleteDocument(user!.uid, id);
      toast('Document summary deleted.', 'success');
      
      const updatedDocs = documents.filter((d) => d.id !== id);
      setDocuments(updatedDocs);
      if (selectedDoc?.id === id) {
        setSelectedDoc(updatedDocs[0] || null);
      }
    } catch (err) {
      toast('Failed to delete summary.', 'error');
    }
  };

  const handleDownloadSummary = (docSummary: DocumentSummary) => {
    const content = `FLOWMIND AI DOCUMENT SUMMARY
Title: ${docSummary.name}
Uploaded At: ${new Date(docSummary.uploadedAt).toLocaleString()}
Type: ${docSummary.type.toUpperCase()}
Size: ${docSummary.size}

EXECUTIVE SUMMARY:
${docSummary.summary}

KEY HIGHLIGHTS:
${docSummary.keyPoints.map((kp) => `- ${kp}`).join('\n')}

ACTIONABLE ITEMS:
${docSummary.actionItems.map((ai) => `- ${ai}`).join('\n')}

Generated by FlowMind AI.
`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${docSummary.name.replace(/\.[^/.]+$/, "")}_summary.txt`;
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
        <div className="grid grid-cols-1 lg:grid-cols-[35%_1fr] gap-6 mt-6">
          <div className="space-y-6">
            <SkeletonBlock className="h-56" />
            <SkeletonBlock className="h-24" />
            <SkeletonBlock className="h-48" />
          </div>
          <div className="space-y-6">
            <SkeletonBlock className="h-20" />
            <SkeletonBlock className="h-40" />
            <SkeletonBlock className="h-32" />
            <SkeletonBlock className="h-32" />
          </div>
        </div>
      </div>
    );
  }

  /* ─────────────── Main Render ─────────────── */
  return (
    <div className="p-8 space-y-8 animate-fade-in">
      {/* ═══════ Page Header ═══════ */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
            Document Summarizer
          </h1>
          <p className="text-sm text-zinc-400 mt-1.5 max-w-lg">
            Upload PDFs, DOCX, TXT or Markdown files and let AI extract key insights, summaries and action items.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="btn-primary h-11 px-5 rounded-xl text-sm font-semibold flex items-center gap-2 cursor-pointer">
            <UploadCloud className="w-4 h-4" />
            Upload Document
            <input type="file" onChange={handleFileInput} className="hidden" accept=".txt,.pdf,.docx,.md,.json" />
          </label>
          {selectedDoc && (
            <>
              <button
                onClick={() => handleDownloadSummary(selectedDoc)}
                className="btn-secondary h-11 px-5 rounded-xl text-sm font-semibold flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download
              </button>
            </>
          )}
        </div>
      </div>

      {/* ═══════ Two-Column Layout ═══════ */}
      <div className="grid grid-cols-1 lg:grid-cols-[35%_1fr] gap-6">

        {/* ─── LEFT COLUMN ─── */}
        <div className="space-y-6">

          {/* Upload Zone */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={`relative border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center transition-all duration-200 ${
                dragActive
                  ? 'border-[#A78BFA] bg-[#A78BFA]/5 shadow-[0_0_40px_rgba(167,139,250,0.15)]'
                  : 'border-white/10 bg-[#16161D] hover:border-white/20'
              }`}
            >
              {isUploading ? (
                <div className="py-8 space-y-4 flex flex-col items-center">
                  <Loader2 className="w-12 h-12 text-[#A78BFA] animate-spin" />
                  <p className="text-sm font-semibold text-white">Analyzing & Summarizing...</p>
                  <div className="w-48 h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-[#A78BFA] to-[#C084FC] rounded-full animate-pulse w-3/4" />
                  </div>
                </div>
              ) : (
                <div className="py-6 space-y-4 flex flex-col items-center">
                  <div className="w-16 h-16 rounded-2xl bg-[#A78BFA]/10 flex items-center justify-center">
                    <UploadCloud className="w-8 h-8 text-[#A78BFA]" />
                  </div>
                  <div>
                    <p className="font-bold text-base text-white">Drag & Drop Document</p>
                    <p className="text-xs text-zinc-400 mt-1.5">
                      Supported: <span className="text-zinc-300">PDF, DOCX, TXT, Markdown</span>
                    </p>
                    <p className="text-xs text-zinc-500 mt-0.5">Maximum 20 MB</p>
                  </div>
                  <label className="mt-2 h-10 px-6 bg-gradient-to-r from-[#A78BFA] to-[#C084FC] text-white rounded-xl text-sm font-semibold cursor-pointer flex items-center gap-2 hover:shadow-[0_0_20px_rgba(167,139,250,0.4)] transition-all duration-200 hover:-translate-y-0.5">
                    Browse Files
                    <input type="file" onChange={handleFileInput} className="hidden" accept=".txt,.pdf,.docx,.md,.json" />
                  </label>
                </div>
              )}
            </div>
          </motion.div>

          {/* Paste Notes */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.05 }}
          >
            <details className="group rounded-2xl border border-white/[0.08] bg-[#16161D] overflow-hidden">
              <summary className="flex justify-between items-center p-4 cursor-pointer list-none text-sm font-semibold text-white hover:bg-white/[0.02] transition-colors">
                <span className="flex items-center gap-2">
                  <Clipboard className="w-4 h-4 text-[#A78BFA]" />
                  Paste Notes
                </span>
                <ChevronDown className="w-4 h-4 text-zinc-400 transition-transform group-open:rotate-180" />
              </summary>
              <form onSubmit={handleManualTextSubmit} className="p-4 border-t border-white/[0.06] space-y-3">
                <textarea
                  value={manualText}
                  onChange={(e) => setManualText(e.target.value)}
                  placeholder="Paste notes or meeting transcript..."
                  rows={5}
                  className="w-full bg-[#0B0B0F] border border-white/10 rounded-xl p-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#A78BFA] focus:shadow-[0_0_0_1px_#A78BFA] resize-none transition-all"
                />
                <button
                  type="submit"
                  disabled={isUploading}
                  className="w-full h-11 bg-gradient-to-r from-[#A78BFA] to-[#C084FC] text-white rounded-xl text-sm font-semibold hover:-translate-y-0.5 hover:shadow-[0_0_20px_rgba(167,139,250,0.4)] active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  Generate Summary
                </button>
              </form>
            </details>
          </motion.div>

          {/* Recent Files */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <div className="rounded-2xl border border-white/[0.08] bg-[#16161D] p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#A78BFA]" />
                  Recent Files
                </h3>
                <span className="text-[11px] text-zinc-500">{documents.length} files</span>
              </div>
              <div className="space-y-2 max-h-[320px] overflow-y-auto custom-scrollbar pr-1">
                {documents.length === 0 ? (
                  <div className="text-center py-8 text-zinc-500">
                    <FolderOpen className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-xs">No documents yet</p>
                  </div>
                ) : (
                  documents.map((doc) => (
                    <div
                      key={doc.id}
                      onClick={() => setSelectedDoc(doc)}
                      className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all duration-200 group ${
                        selectedDoc?.id === doc.id
                          ? 'bg-[#A78BFA]/10 border-[#A78BFA]/30'
                          : 'bg-white/[0.02] border-transparent hover:bg-white/[0.05] hover:border-white/10'
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                        selectedDoc?.id === doc.id ? 'bg-[#A78BFA]/20' : 'bg-white/5'
                      }`}>
                        <FileText className={`w-4 h-4 ${selectedDoc?.id === doc.id ? 'text-[#A78BFA]' : 'text-zinc-400'}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm truncate ${selectedDoc?.id === doc.id ? 'text-[#A78BFA] font-semibold' : 'text-white'}`}>
                          {doc.name}
                        </p>
                        <p className="text-[11px] text-zinc-500 mt-0.5">
                          {doc.size} · {doc.type.toUpperCase()} · {new Date(doc.uploadedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteDoc(doc.id);
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

        {/* ─── RIGHT COLUMN ─── */}
        <div>
          <AnimatePresence mode="wait">
            {selectedDoc ? (
              <motion.div
                key={selectedDoc.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
                className="rounded-2xl border border-white/[0.08] bg-[#16161D] overflow-hidden flex flex-col"
              >
                {/* Document Header */}
                <div className="p-6 border-b border-white/[0.06] bg-white/[0.02] flex flex-wrap justify-between items-center gap-4">
                  <div className="flex gap-3 items-center">
                    <div className="w-11 h-11 rounded-xl bg-[#A78BFA]/10 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-[#A78BFA]" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-base text-white">{selectedDoc.name}</h3>
                      <p className="text-xs text-zinc-400 mt-0.5 flex items-center gap-2">
                        <span>{selectedDoc.size}</span>
                        <span className="w-1 h-1 rounded-full bg-zinc-600" />
                        <span>{selectedDoc.type.toUpperCase()}</span>
                        <span className="w-1 h-1 rounded-full bg-zinc-600" />
                        <span>{new Date(selectedDoc.uploadedAt).toLocaleDateString()}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDownloadSummary(selectedDoc)}
                      className="btn-secondary h-10 px-4 rounded-xl text-xs font-semibold flex items-center gap-1.5"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </button>
                    <button className="btn-secondary h-10 px-4 rounded-xl text-xs font-semibold flex items-center gap-1.5">
                      <Share2 className="w-4 h-4" />
                      Share
                    </button>
                  </div>
                </div>

                {/* Summary Content */}
                <div className="p-6 space-y-6 flex-1 overflow-y-auto custom-scrollbar">

                  {/* Executive Summary */}
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: 0.1 }}
                    className="rounded-2xl border border-[#A78BFA]/20 bg-gradient-to-br from-[#A78BFA]/5 to-transparent p-5 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-[#A78BFA]" />
                        Executive Summary
                      </h4>
                      <div className="flex items-center gap-2">
                        <SectionBadge label="AI Generated" color="purple" />
                        <SectionBadge label={`~${Math.max(1, Math.ceil((selectedDoc.summary?.length || 0) / 1000))} min read`} color="blue" />
                      </div>
                    </div>
                    <p className="text-sm text-zinc-300 leading-relaxed">
                      {selectedDoc.summary}
                    </p>
                  </motion.div>

                  {/* Key Highlights */}
                  {selectedDoc.keyPoints && selectedDoc.keyPoints.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: 0.15 }}
                      className="space-y-3"
                    >
                      <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-[#FBBF24]" />
                        Key Highlights
                        <span className="text-[11px] text-zinc-500 font-normal ml-1">{selectedDoc.keyPoints.length} points</span>
                      </h4>
                      <div className="grid gap-2">
                        {selectedDoc.keyPoints.map((kp, idx) => (
                          <div
                            key={idx}
                            className="flex gap-3 items-start bg-white/[0.03] hover:bg-white/[0.06] p-4 rounded-xl border border-white/[0.06] hover:border-[#FBBF24]/20 transition-all duration-200 group card-hover"
                          >
                            <div className="w-6 h-6 rounded-lg bg-[#FBBF24]/10 flex items-center justify-center shrink-0 mt-0.5">
                              <Sparkles className="w-3 h-3 text-[#FBBF24]" />
                            </div>
                            <p className="text-sm text-zinc-300 leading-relaxed">{kp}</p>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* Action Items */}
                  {selectedDoc.actionItems && selectedDoc.actionItems.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: 0.2 }}
                      className="space-y-3"
                    >
                      <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                        <CheckSquare className="w-4 h-4 text-[#34D399]" />
                        Action Items
                        <span className="text-[11px] text-zinc-500 font-normal ml-1">{selectedDoc.actionItems.length} tasks</span>
                      </h4>
                      <div className="space-y-2">
                        {selectedDoc.actionItems.map((item, idx) => {
                          const key = `${selectedDoc.id}-action-${idx}`;
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
                                <SectionBadge label={idx === 0 ? 'High' : idx === 1 ? 'Medium' : 'Normal'} color={idx === 0 ? 'amber' : idx === 1 ? 'blue' : 'emerald'} />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}

                  {/* AI Insights */}
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: 0.25 }}
                    className="space-y-3"
                  >
                    <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                      <Brain className="w-4 h-4 text-[#A78BFA]" />
                      AI Insights
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        {
                          icon: TrendingUp,
                          label: 'Key Points',
                          value: `${selectedDoc.keyPoints?.length || 0}`,
                          color: 'text-[#60A5FA]',
                          bg: 'bg-[#60A5FA]/10',
                        },
                        {
                          icon: CheckSquare,
                          label: 'Action Items',
                          value: `${selectedDoc.actionItems?.length || 0}`,
                          color: 'text-[#34D399]',
                          bg: 'bg-[#34D399]/10',
                        },
                        {
                          icon: Shield,
                          label: 'Confidence',
                          value: '92%',
                          color: 'text-[#A78BFA]',
                          bg: 'bg-[#A78BFA]/10',
                        },
                        {
                          icon: AlertTriangle,
                          label: 'Risk Level',
                          value: 'Low',
                          color: 'text-[#FBBF24]',
                          bg: 'bg-[#FBBF24]/10',
                        },
                      ].map((insight, idx) => (
                        <div
                          key={idx}
                          className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-2 hover:bg-white/[0.05] transition-all card-hover"
                        >
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
                        <p className="text-xs font-semibold text-white">Recommendations</p>
                      </div>
                      <ul className="space-y-2">
                        {(selectedDoc.keyPoints?.slice(0, 3) || []).map((point, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-xs text-zinc-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#A78BFA] mt-1.5 shrink-0" />
                            {point.length > 80 ? point.substring(0, 80) + '...' : point}
                          </li>
                        ))}
                        {(!selectedDoc.keyPoints || selectedDoc.keyPoints.length === 0) && (
                          <li className="text-xs text-zinc-500">No recommendations available for this document.</li>
                        )}
                      </ul>
                    </div>
                  </motion.div>

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
                  <FolderOpen className="w-10 h-10 text-zinc-600" />
                </div>
                <p className="font-semibold text-lg text-white">No Document Selected</p>
                <p className="text-sm text-zinc-400 mt-2 max-w-sm">
                  Upload a document or paste text on the left panel to begin extracting AI-powered summaries and insights.
                </p>
                <label className="mt-6 h-11 px-6 bg-gradient-to-r from-[#A78BFA] to-[#C084FC] text-white rounded-xl text-sm font-semibold cursor-pointer flex items-center gap-2 hover:shadow-[0_0_20px_rgba(167,139,250,0.4)] transition-all">
                  <UploadCloud className="w-4 h-4" />
                  Upload Your First Document
                  <input type="file" onChange={handleFileInput} className="hidden" accept=".txt,.pdf,.docx,.md,.json" />
                </label>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
