"use client";

import React, { useState } from 'react';
import { ShieldCheck, Search, Filter, MoreHorizontal, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { motion } from 'framer-motion';

const models = [
  { id: '1', name: 'Credit Risk XGBoost', version: '2.4.0', status: 'Healthy', accuracy: '94.2%', drift: 'Low', updated: '2h ago' },
  { id: '2', name: 'Customer Churn RF', version: '1.2.1', status: 'Warning', accuracy: '89.5%', drift: 'Moderate', updated: '5h ago' },
  { id: '3', name: 'Fraud Detection DNN', version: '3.0.0', status: 'Healthy', accuracy: '98.1%', drift: 'Negligible', updated: '1d ago' },
  { id: '4', name: 'Sentiment Analysis BERT', version: '0.9.4', status: 'Critical', accuracy: '78.2%', drift: 'High', updated: '15m ago' },
];

export default function ModelsPage() {
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Model Registry</h2>
          <p className="text-muted-foreground mt-1">Manage and monitor all deployed AI models across production environments.</p>
        </div>
        <button className="bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity flex items-center gap-2">
          + Register Model
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-card p-4 rounded-xl border">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <input 
            type="text" 
            placeholder="Search models..." 
            className="w-full pl-10 pr-4 py-2 bg-background border rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <button className="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm hover:bg-accent transition-colors">
            <Filter className="w-4 h-4" /> Filter
          </button>
          <button className="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm hover:bg-accent transition-colors">
            Sort by: Newest
          </button>
        </div>
      </div>

      <div className="bg-card border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="p-4 text-xs font-bold uppercase text-muted-foreground">Model Name</th>
                <th className="p-4 text-xs font-bold uppercase text-muted-foreground">Status</th>
                <th className="p-4 text-xs font-bold uppercase text-muted-foreground">Performance</th>
                <th className="p-4 text-xs font-bold uppercase text-muted-foreground">Drift</th>
                <th className="p-4 text-xs font-bold uppercase text-muted-foreground">Last Update</th>
                <th className="p-4 text-xs font-bold uppercase text-muted-foreground"></th>
              </tr>
            </thead>
            <tbody>
              {models.map((model) => (
                <tr key={model.id} className="border-b hover:bg-accent/30 transition-colors group cursor-pointer">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <ShieldCheck className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <div className="font-bold text-sm">{model.name}</div>
                        <div className="text-xs text-muted-foreground">v{model.version}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className={cn(
                      "text-xs font-medium px-2.5 py-1 rounded-full flex items-center gap-1.5 w-fit",
                      model.status === 'Healthy' ? "bg-emerald-500/10 text-emerald-600" :
                      model.status === 'Warning' ? "bg-amber-500/10 text-amber-600" :
                      "bg-red-500/10 text-red-600"
                    )}>
                      {model.status === 'Healthy' ? <CheckCircle className="w-3 h-3" /> : 
                       model.status === 'Warning' ? <AlertCircle className="w-3 h-3" /> : 
                       <AlertCircle className="w-3 h-3" />}
                      {model.status}
                    </span>
                  </td>
                  <td className="p-4 text-sm font-medium">{model.accuracy}</td>
                  <td className="p-4 text-sm font-medium">{model.drift}</td>
                  <td className="p-4 text-sm text-muted-foreground flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" /> {model.updated}
                  </td>
                  <td className="p-4 text-right">
                    <button className="p-1 rounded hover:bg-accent transition-colors opacity-0 group-hover:opacity-100">
                      <MoreHorizontal className="w-5 h-5 text-muted-foreground" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const cn = (...classes: any) => classes.filter(Boolean).join(' ');
