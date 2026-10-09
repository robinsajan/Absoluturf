'use client';
import React, { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useStore } from '../../../store/useStore';
import { Users, AlertTriangle } from 'lucide-react';

export default function InvitePage() {
  const params = useParams();
  const inviteCode = params?.inviteCode as string;
  const { joinByInvite } = useStore();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (!inviteCode) return;
    // If no token exists, redirect to login automatically
    if (!localStorage.getItem('token')) {
      router.push(`/login?redirect=/invite/${inviteCode}`);
    }
  }, [inviteCode, router]);

  const handleJoin = async () => {
    if (!inviteCode) return;
    if (!localStorage.getItem('token')) {
      router.push(`/login?redirect=/invite/${inviteCode}`);
      return;
    }
    setLoading(true);
    setError(null);
    const res = await joinByInvite(inviteCode);
    setLoading(false);
    if (res.success) {
      router.push(`/groups?id=${res.groupId}`);
    } else {
      setError(res.message);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6 px-4">
      <div className="h-16 w-16 bg-[var(--accent)] rounded-2xl flex items-center justify-center shadow-lg mb-2">
        <Users size={32} className="text-black" />
      </div>
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-display font-extrabold text-[var(--text-primary)]">Group Invitation</h1>
        <p className="text-xs text-[var(--text-muted)] max-w-xs mx-auto leading-relaxed">
          You have been invited to join a group on AbsoluTurf. 
          Click below to accept the invitation and send a join request to the admins.
        </p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-500 px-4 py-3 rounded-xl flex items-start gap-2 text-xs font-bold w-full max-w-sm">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <div className="w-full max-w-sm space-y-3 pt-4">
        <button
          onClick={handleJoin}
          disabled={loading}
          className="w-full btn btn-primary py-3.5 rounded-xl text-sm font-bold shadow-xl cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Requesting to join...' : 'Accept Invitation'}
        </button>
        
        <button 
          onClick={() => router.push('/groups')}
          className="w-full btn btn-ghost py-3.5 rounded-xl text-xs"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}


