'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ClipboardCheck,
  Calendar,
  FileText,
  Video,
  Mail,
  MessageSquare,
  Sparkles,
} from 'lucide-react';

interface SidebarProps {
  onCloseMobile?: () => void;
}

const navItems = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Tasks', href: '/dashboard/tasks', icon: ClipboardCheck },
  { name: 'Calendar', href: '/dashboard/calendar', icon: Calendar },
  { name: 'Documents', href: '/dashboard/documents', icon: FileText },
  { name: 'Meetings', href: '/dashboard/meetings', icon: Video },
  { name: 'Email Gen', href: '/dashboard/emails', icon: Mail },
  { name: 'AI Assistant', href: '/dashboard/assistant', icon: MessageSquare },
];

export default function Sidebar({ onCloseMobile }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="w-64 h-full flex flex-col py-5 px-3 flex-shrink-0 border-r border-white/[0.06] bg-[#0B0B0F] z-20">
      {/* Logo */}
      <Link
        href="/dashboard"
        onClick={onCloseMobile}
        className="flex items-center gap-3 px-3 py-1 mb-6 hover:opacity-80 transition-opacity"
      >
        <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-purple-700 rounded-xl flex items-center justify-center shadow-lg shadow-violet-500/30 flex-shrink-0">
          <Sparkles size={18} className="text-white" />
        </div>
        <span className="text-lg font-bold text-white tracking-tight">GenFlow</span>
      </Link>

      {/* Navigation */}
      <nav className="space-y-0.5">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onCloseMobile}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                isActive
                  ? 'bg-violet-500/10 text-violet-300 border border-violet-500/20'
                  : 'text-zinc-500 border border-transparent hover:text-zinc-200 hover:bg-white/[0.04]'
              }`}
            >
              <Icon
                size={18}
                className={`flex-shrink-0 transition-colors ${
                  isActive ? 'text-violet-400' : 'text-zinc-600 group-hover:text-zinc-300'
                }`}
              />
              <span>{item.name}</span>
              {isActive && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-violet-400" />
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
