'use client';

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="bg-background text-on-surface font-body-md h-screen overflow-hidden flex relative">
      {/* Ambient background glows */}
      <div className="glow-bg"></div>

      {/* Desktop Sidebar (Fixed Left) */}
      <div className="hidden md:flex h-full shrink-0">
        <Sidebar />
      </div>

      {/* Mobile Drawer Sidebar */}
      <AnimatePresence>
        {mobileSidebarOpen && (
          <>
            {/* Backdrop overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileSidebarOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden"
            />
            {/* Drawer */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.3 }}
              className="fixed inset-y-0 left-0 z-40 md:hidden flex"
            >
              <Sidebar onCloseMobile={() => setMobileSidebarOpen(false)} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main content viewport */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative z-0">
        {/* Global Dashboard Top Navbar */}
        <Navbar onToggleSidebar={() => setMobileSidebarOpen(true)} />

        {/* Scrollable Sub-pages Area */}
        <main className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <div className="max-w-container-max mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
