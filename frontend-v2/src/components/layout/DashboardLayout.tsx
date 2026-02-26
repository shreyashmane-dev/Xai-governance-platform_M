"use client";

import React from 'react';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';

export const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6 md:p-10 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
};
