"use client";

import React from 'react';
import { BarChart3, TrendingUp, PieChart, Activity, Download, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';

const MetricCard = ({ title, value, change, description }: any) => (
  <div className="bg-card border rounded-2xl p-6 shadow-sm">
    <div className="flex justify-between items-start mb-2">
      <span className="text-sm font-medium text-muted-foreground">{title}</span>
      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${change.startsWith('+') ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'}`}>
        {change}
      </span>
    </div>
    <div className="text-2xl font-bold mb-1">{value}</div>
    <p className="text-xs text-muted-foreground">{description}</p>
  </div>
);

export default function AnalyticsPage() {
  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Performance Analytics</h2>
          <p className="text-muted-foreground mt-1">Detailed breakdown of model accuracy, compliance, and resource usage.</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm hover:bg-accent transition-colors">
            <Calendar className="w-4 h-4" /> Last 30 Days
          </button>
          <button className="bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity flex items-center gap-2">
            <Download className="w-4 h-4" /> Export Data
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard 
          title="Avg. Accuracy" 
          value="91.4%" 
          change="+1.2%" 
          description="Across all registered models"
        />
        <MetricCard 
          title="F1 Score" 
          value="88.7" 
          change="+0.8" 
          description="Industry average: 85.0"
        />
        <MetricCard 
          title="Latency (P99)" 
          value="42ms" 
          change="-5ms" 
          description="Optimization successful"
        />
        <MetricCard 
          title="Data Drift" 
          value="Low" 
          change="~0%" 
          description="3 models require attention"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-card border rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-500" />
                Accuracy Trend (30d)
              </h3>
            </div>
            <div className="h-80 flex items-center justify-center border-2 border-dashed rounded-xl bg-accent/30">
              <p className="text-muted-foreground text-sm italic">High-Fidelity Recharts Visualization Placeholder</p>
            </div>
          </section>

          <section className="bg-card border rounded-2xl p-6 shadow-sm">
             <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
                Compliance Progress
              </h3>
              <div className="space-y-6">
                {[
                  { name: 'GDPR Compliance', progress: 92 },
                  { name: 'Bias Detection', progress: 78 },
                  { name: 'Explainability Coverage', progress: 45 },
                  { name: 'Audit Logs Integrity', progress: 100 },
                ].map((item) => (
                  <div key={item.name} className="space-y-2">
                    <div className="flex justify-between text-sm font-medium">
                      <span>{item.name}</span>
                      <span>{item.progress}%</span>
                    </div>
                    <div className="h-2 w-full bg-accent rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary transition-all duration-1000" 
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
          </section>
        </div>

        <section className="bg-card border rounded-2xl p-6 shadow-sm h-fit">
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
            <PieChart className="w-5 h-5 text-purple-500" />
            Resource Distribution
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg border bg-accent/20">
              <span className="text-sm">Inference Clusters</span>
              <span className="font-bold">64%</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border bg-accent/20">
              <span className="text-sm">Training Nodes</span>
              <span className="font-bold">22%</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border bg-accent/20">
              <span className="text-sm">Storage Ops</span>
              <span className="font-bold">14%</span>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t text-center">
            <p className="text-xs text-muted-foreground">Estimated cloud spend: $3,420 / mo</p>
          </div>
        </section>
      </div>
    </div>
  );
}
