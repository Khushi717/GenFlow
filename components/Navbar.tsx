'use client';

import React, { useState } from 'react';
import { useToast } from '@/contexts/ToastContext';
import { Bell, Search, Menu } from 'lucide-react';

interface NavbarProps {
  onToggleSidebar: () => void;
}

export default function Navbar({ onToggleSidebar }: NavbarProps) {
  const { toast } = useToast();
  const [showNotifications, setShowNotifications] = useState(false);

  const notifications = [
    { id: '1', text: 'Sarah completed task: Firebase Setup', time: '10m ago', unread: true },
    { id: '2', text: 'Weekly analytics report is ready', time: '1h ago', unread: true },
    { id: '3', text: 'Meeting summary parsed successfully', time: '2h ago', unread: false },
  ];

  const unreadCount = notifications.filter((n) => n.unread).length;

  return (
    <header className="h-[72px] flex items-center justify-between px-6 shrink-0 sticky top-0 z-40 border-b border-white/[0.06] bg-[#0B0B0F]/80 backdrop-blur-xl">
      {/* Left — Mobile menu toggle */}
      <div className="flex items-center gap-3 md:hidden">
        <button
          onClick={onToggleSidebar}
          className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 transition-all focus:outline-none"
          aria-label="Toggle sidebar"
        >
          <Menu size={20} />
        </button>
      </div>

      {/* Center — Search bar */}
      <div className="hidden md:flex flex-1 justify-center">
        <div className="relative w-[500px]">
          <Search
            size={16}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"
          />
          <input
            type="text"
            placeholder="Search files, tasks, or ask AI..."
            className="w-full h-12 bg-white/[0.04] border border-white/[0.08] rounded-xl pl-10 pr-4 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-violet-500/60 focus:bg-white/[0.06] focus:ring-1 focus:ring-violet-500/30 transition-all"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                toast('Search queries are under development.', 'info');
              }
            }}
          />
        </div>
      </div>

      {/* Right — Notifications only */}
      <div className="flex items-center">
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 transition-all focus:outline-none"
            aria-label="Notifications"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-violet-400 rounded-full border border-[#0B0B0F] shadow-[0_0_6px_rgba(167,139,250,0.8)]" />
            )}
          </button>

          {/* Dropdown */}
          {showNotifications && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowNotifications(false)}
              />
              <div className="absolute right-0 top-[calc(100%+8px)] w-80 z-50 animate-fade-in">
                <div className="bg-[#16161D] border border-white/[0.08] rounded-2xl shadow-2xl shadow-black/60 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold text-white">Notifications</h4>
                      {unreadCount > 0 && (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold bg-violet-500/20 text-violet-400 rounded-full">
                          {unreadCount}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        toast('Notifications cleared.', 'success');
                        setShowNotifications(false);
                      }}
                      className="text-[11px] text-violet-400 hover:text-violet-300 transition-colors font-medium"
                    >
                      Clear all
                    </button>
                  </div>
                  <div className="divide-y divide-white/[0.04] max-h-64 overflow-y-auto">
                    {notifications.map((n) => (
                      <div
                        key={n.id}
                        className="flex items-start gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors cursor-pointer"
                      >
                        <div
                          className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${
                            n.unread ? 'bg-violet-400' : 'bg-transparent'
                          }`}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] text-zinc-300 leading-snug">{n.text}</p>
                          <p className="text-[11px] text-zinc-600 mt-0.5">{n.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
