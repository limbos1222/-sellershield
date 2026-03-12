import React, { useEffect, useState } from 'react';
import Analytics from '../components/Analytics';
import { api } from '../api';

export default function Dashboard() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl text-text">Dashboard</h1>
          <p className="text-xs text-text-dim mt-0.5">Overview of your lead generation activity</p>
        </div>
      </div>

      <Analytics />
    </div>
  );
}
