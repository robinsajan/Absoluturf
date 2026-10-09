'use client';
import Select from '../../components/Select';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useStore, Match, MatchVote, BackoutResult } from '../../store/useStore';
import Link from 'next/link';
import { Calendar, MapPin, Users, Shield, Plus, ArrowLeft, Clock, AlertTriangle, Check, X, Pencil, Zap, CreditCard, CheckCircle, MoreVertical, Trash2, UserPlus } from 'lucide-react';

type PlayingEntry = Partial<MatchVote> & {
  user_id: number; name: string; created_at: string; _isGuest: boolean;
  _guestId?: number; _addedByName?: string; _addedByUserId?: number;
};



function generateDateOptions(): { value: string; label: string; dayName: string; dayNum: number }[] {
  const options: { value: string; label: string; dayName: string; dayNum: number }[] = [];
  const today = new Date();
  const maxDate = new Date(today);
  maxDate.setMonth(maxDate.getMonth() + 2);
  for (let d = new Date(today); d <= maxDate; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
    const monthDay = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    options.push({ value: dateStr, label: monthDay, dayName, dayNum: d.getDate() });
  }
  return options;
}

function generateTimeSlots(): string[] {
  const slots: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return slots;
}

export function format12Hour(t: string): string {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hr = parseInt(h);
  const ampm = hr >= 12 ? 'PM' : 'AM';
  const hr12 = hr === 0 ? 12 : hr > 12 ? hr - 12 : hr;
  return `${hr12}:${m} ${ampm}`;
}

function formatTimeRange(start: string, end: string): string {
  if (!end) return format12Hour(start);
  return `${format12Hour(start)} - ${format12Hour(end)}`;
}

function MatchesContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const matchIdParam = searchParams.get('id');

  const {
    user,
    matches,
    currentMatch,
    groups,
    loading,
    fetchMatches,
    fetchMatch,
    createMatch,
    editMatch,
    voteMatch,
    confirmMatch,
    backoutMatch,
    joinSubstituteQueue,
    leaveSubstituteQueue,
    acceptPromotion,
    declinePromotion,
    acceptGuestPromotion,
    declineGuestPromotion,
    completeMatch,
    cancelMatch,
    fetchGroups,
    markAttendance,
    verifyPayment,
    payMatch,
    addGuest,
    removeGuest,
  } = useStore();

  const [activeTab, setActiveTab] = useState<'upcoming' | 'confirmed' | 'past'>(matches.some(m => m.user_vote === 'Yes' && !m.is_past && !['Completed','Cancelled'].includes(m.status)) ? 'confirmed' : 'upcoming');
  const [showCreateForm, setShowCreateForm] = useState(searchParams.get('create') === 'true');
  const [editingMatchId, setEditingMatchId] = useState<number | null>(null);

  // Match form states (create + edit)
  const [groupId, setGroupId] = useState('');
  const [turfName, setTurfName] = useState('');
  const [location, setLocation] = useState('');
  const [matchDate, setMatchDate] = useState('');
  const [matchTime, setMatchTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [maxPlayers, setMaxPlayers] = useState('10');
  const [matchCost, setMatchCost] = useState('');

  // Backout popup state
  const [showBackoutPopup, setShowBackoutPopup] = useState(false);
  const [backoutReason, setBackoutReason] = useState('');
  const [backoutResult, setBackoutResult] = useState<BackoutResult | null>(null);
  const [showAdminDropdown, setShowAdminDropdown] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  // Guest management state
  const [showAddGuest, setShowAddGuest] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestStatus, setGuestStatus] = useState<'confirmed' | 'waiting'>('confirmed');
  const handleAddGuest = async () => {
    if (!matchIdParam || !guestName.trim()) return;
    const success = await addGuest(Number(matchIdParam), guestName.trim(), guestStatus);
    if (success) {
      setGuestName('');
      setShowAddGuest(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchMatches();
    fetchGroups();
  }, [fetchMatches, fetchGroups]);

  // Fetch single match details if parameter changed
  useEffect(() => {
    if (matchIdParam) {
      fetchMatch(Number(matchIdParam));
    }
  }, [matchIdParam, fetchMatch]);

  if (!user) return null;

  // Filter admin groups for match creation
  const adminGroups = groups.filter(g => g.role === 'Admin');

  const resetMatchForm = () => {
    setGroupId('');
    setTurfName('');
    setLocation('');
    setMatchDate('');
    setMatchTime('');
    setEndTime('');
    setMaxPlayers('10');
    setMatchCost('');
    setEditingMatchId(null);
  };

  const handleMaxPlayersChange = (value: string) => {
    setMaxPlayers(value);
  };

  const openEditForm = (match: typeof currentMatch) => {
    if (!match) return;
    setEditingMatchId(match.id);
    setShowCreateForm(false);
    setGroupId(String(match.group_id));
    setTurfName(match.turf_name);
    setLocation(match.location);
    setMatchDate(match.match_date);
    setMatchTime(match.match_time);
    setEndTime(match.end_time || '');
    setMaxPlayers(String(match.max_players));
    setMatchCost(match.cost ? String(match.cost) : '');
  };

  const handleMatchFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      group_id: Number(groupId),
      turf_name: turfName,
      location,
      match_date: matchDate,
      match_time: matchTime,
      end_time: endTime || undefined,
      max_players: Number(maxPlayers),
      cost: matchCost ? Number(matchCost) : 0,
    };

    if (editingMatchId) {
      const id = editingMatchId;
      const success = await editMatch(id, payload);
      if (success) {
        resetMatchForm();
        fetchMatch(id);
      }
      return;
    }

    if (!groupId) {
      alert('Please select a group first.');
      return;
    }
    const success = await createMatch(payload);
    if (success) {
      setShowCreateForm(false);
      resetMatchForm();
      fetchMatches();
    }
  };

  // Handle Backout Submit
  const handleBackoutSubmit = async () => {
    if (!matchIdParam) return;
    if (!backoutReason) {
      alert('Please enter a reason for backing out.');
      return;
    }
    const result = await backoutMatch(Number(matchIdParam), backoutReason);
    setShowBackoutPopup(false);
    setBackoutReason('');
    if (result?.warning) {
      setBackoutResult(result);
    }
  };



  const isTerminal = (m: Match) => m.status === 'Completed' || m.status === 'Cancelled';

  const upcomingMatchesList = matches.filter(
    m => m.user_vote !== 'Yes' && !isTerminal(m) && !m.is_past
  );
  const confirmedMatchesList = matches.filter(
    m => m.user_vote === 'Yes' && !isTerminal(m) && !m.is_past
  );
  const pastMatchesList = matches.filter(m => isTerminal(m) || m.is_past);

  // Detail View Screen
  if (matchIdParam && currentMatch) {
    const isYesVoter = currentMatch.votes?.some(v => v.user_id === user.id && v.vote === 'Yes');
    const isNoVoter = currentMatch.votes?.some(v => v.user_id === user.id && v.vote === 'No');
    const yesCount = currentMatch.votes?.filter(v => v.vote === 'Yes').length || 0;
                            const confirmedGuestsCount = (currentMatch.confirmed_guests || []).length;
    const totalPlayers = yesCount + confirmedGuestsCount;
    const isFull = totalPlayers >= currentMatch.max_players;
    const canVote = ['Proposed', 'Voting Open', 'Minimum Players Reached', 'Turf Confirmed'].includes(currentMatch.status) && currentMatch.is_active !== false;
    const canBackout = isYesVoter && currentMatch.is_past !== true && !['Completed', 'Cancelled'].includes(currentMatch.status);
    // Count only genuine 'waiting' substitutes (not invited/declined/timed_out)
    const waitingCount = currentMatch.substitutes?.filter(s => s.status === 'waiting').length || 0;
    const mySubEntry = currentMatch.substitutes?.find(s => s.user_id === user.id);
    // Only true when the backend has actively set status='invited' on this user's sub record
    const hasPendingInvite = mySubEntry?.status === 'invited';

    return (
      <div className="space-y-6 pb-12">
        {backoutResult?.warning && <div className="inline-message" role="status">{backoutResult.warning}</div>}
        {/* Detail Header */}
        <div className="flex justify-between items-center relative">
          <button
            onClick={() => router.push('/matches')}
            className="flex items-center gap-1.5 text-xs font-bold text-[var(--accent)] bg-[var(--accent)]/5 px-4 py-2 rounded-xl border border-[var(--accent)]/10 hover:bg-[var(--accent)]/15 hover:border-[var(--accent)]/20 transition-all w-fit cursor-pointer"
          >
            <ArrowLeft size={14} /> Back to Matches
          </button>

          {currentMatch.is_admin && (
            <div className="relative">
              <button
                onClick={() => setShowAdminDropdown(!showAdminDropdown)}
                className="flex items-center justify-center p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-card)] hover:bg-[var(--border)] border border-[var(--border)] rounded-xl transition-all cursor-pointer"
              >
                <MoreVertical size={16} />
              </button>
              {showAdminDropdown && (
                <div className="absolute right-0 mt-2 w-52 picker-panel action-menu z-[110] p-2 text-sm">
                  {currentMatch.is_active !== false && !['Completed', 'Cancelled', 'Turf Confirmed'].includes(currentMatch.status) && (
                    <button
                      onClick={() => {
                        setShowAdminDropdown(false);
                        openEditForm(currentMatch);
                      }}
                      className="w-full text-left px-4 py-2.5 hover:bg-[var(--border)]/80 text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-semibold transition-colors flex items-center gap-2 cursor-pointer"
                    >
                      <Pencil size={13} /> Edit Match
                    </button>
                  )}
                  {currentMatch.status === 'Turf Confirmed' && (
                    <button
                      onClick={() => {
                        if (!currentMatch.is_past) {
                          alert("Match cannot be marked completed until kick-off time has passed!");
                          return;
                        }
                        setShowAdminDropdown(false);
                        completeMatch(currentMatch.id);
                      }}
                      disabled={!currentMatch.is_past}
                      className={`w-full text-left px-4 py-2.5 font-semibold transition-colors flex items-center gap-2 cursor-pointer ${
                        currentMatch.is_past
                          ? 'hover:bg-[var(--accent)]/10 text-[var(--accent)]'
                          : 'opacity-40 cursor-not-allowed text-[#666666]'
                      }`}
                    >
                      <CheckCircle size={13} /> Mark Completed
                    </button>
                  )}
                  {['Proposed', 'Voting Open', 'Minimum Players Reached', 'Turf Confirmed'].includes(currentMatch.status) && (
                    <button
                      onClick={() => {
                        setShowAdminDropdown(false);
                        if (confirm('Cancel this match?')) cancelMatch(currentMatch.id);
                      }}
                      className="w-full text-left px-4 py-2.5 hover:bg-red-500/10 text-red-400 font-semibold transition-colors flex items-center gap-2 cursor-pointer"
                    >
                      <Trash2 size={13} /> Delete Match
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Turf Booked Question Banner for Admins */}
        {currentMatch.is_admin && ['Proposed', 'Voting Open', 'Minimum Players Reached'].includes(currentMatch.status) && (
          <div className="bg-[var(--accent)]/5 border border-[var(--accent)]/20 rounded-2xl p-4 md:p-5 flex flex-wrap items-center justify-between gap-4 shadow-xl">
            <div className="flex items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-[var(--accent)] animate-pulse"></span>
              <p className="text-xs font-semibold text-[var(--text-primary)] tracking-tight">
                Has the turf been booked?
              </p>
            </div>
            <button
              onClick={() => confirmMatch(currentMatch.id)}
              className="flex items-center gap-1.5 text-xs font-bold text-black bg-[var(--accent)] hover:bg-[var(--accent-hover)] px-4 py-2 rounded-xl transition-all cursor-pointer shadow-md"
              title="Confirm Booking"
            >
              <Check size={14} className="stroke-[3px]" /> Yes, Booked
            </button>
          </div>
        )}

        {/* Match Header Info */}
        <div className="card p-6 md:p-8 space-y-4 shadow-xl">
          <div className="flex justify-between items-start">
            <div className="space-y-1.5">
              <span className={`badge ${
                currentMatch.status === 'Turf Confirmed' 
                  ? 'badge-green' 
                  : currentMatch.status === 'Completed'
                  ? 'badge-blue'
                  : currentMatch.status === 'Cancelled'
                  ? 'badge-red'
                  : 'badge-yellow'
              }`}>
                {currentMatch.status}
              </span>
              <h1 className="text-2xl font-display font-extrabold text-[var(--text-primary)] mt-2 tracking-tight">Match at {currentMatch.turf_name}</h1>
              <p className="text-[12px] text-[var(--text-muted)] font-label-sm uppercase tracking-wider font-semibold">Organized by Group Admin</p>
              {currentMatch.auto_booked && (
                <p className="text-[12px] text-[var(--accent)] flex items-center gap-1 mt-1 font-semibold">
                  <Zap size={12} /> Auto-booked when minimum players joined
                </p>
              )}
              {currentMatch.status === 'Turf Confirmed' && !currentMatch.auto_booked && (
                <p className="text-[12px] text-[var(--text-secondary)] mt-1">Manually confirmed by admin</p>
              )}
            </div>
            
            <div className="text-right">
              <span className="badge badge-blue text-xs font-bold px-3.5 py-2 neo-glow">
                {totalPlayers} / {currentMatch.max_players} Players
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-5 border-t border-[var(--border)]/40 text-xs">
            <div className="flex items-center gap-3 text-[var(--text-secondary)]">
              <div className="p-2 bg-[var(--bg-input)] rounded-lg border border-[var(--border)] text-[var(--accent)]">
                <Calendar size={15} />
              </div>
              <div>
                <p className="font-bold text-[var(--text-primary)] text-[12px]">{currentMatch.match_date}</p>
                <p className="text-[12px] text-[var(--text-muted)] uppercase font-label-sm tracking-wider">Date</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-[var(--text-secondary)]">
              <div className="p-2 bg-[var(--bg-input)] rounded-lg border border-[var(--border)] text-[var(--accent)]">
                <Clock size={15} />
              </div>
              <div>
                <p className="font-bold text-[var(--text-primary)] text-[12px]">{currentMatch.end_time ? formatTimeRange(currentMatch.match_time, currentMatch.end_time) : currentMatch.match_time}</p>
                <p className="text-[12px] text-[var(--text-muted)] uppercase font-label-sm tracking-wider">Kickoff</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-[var(--text-secondary)]">
              <div className="p-2 bg-[var(--bg-input)] rounded-lg border border-[var(--border)] text-[var(--accent)] shrink-0">
                <MapPin size={15} />
              </div>
              <div>
                <p className="font-bold text-[var(--text-primary)] text-[12px]">{currentMatch.turf_name}</p>
                <p className="text-[12px] text-[var(--text-muted)]">{currentMatch.location}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Status awareness banner */}
        {canVote && (
          <div className="card p-4 md:p-5 shadow-xl">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
              <span className="font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                <Users size={14} className="text-[var(--accent)]" /> Players: <span className="text-[var(--accent)]">{totalPlayers}/{currentMatch.max_players}</span>
              </span>
              {isFull ? (
                <span className="font-bold text-amber-400 flex items-center gap-1.5">
                  ⚠ Team is full 
                </span>
              ) : (
                <span className="font-bold text-[var(--accent)]">
                  {currentMatch.max_players - totalPlayers} slot{currentMatch.max_players - yesCount !== 1 ? 's' : ''} left
                </span>
              )}
              {currentMatch.in_substitute_queue && (
                <span className="font-bold text-amber-400">You are on the waiting list (#{currentMatch.substitute_position})</span>
              )}
              {waitingCount > 0 && (
                <span className="text-[var(--text-secondary)]">{waitingCount} in waiting list</span>
              )}
              <span className="text-[var(--text-secondary)]">Vote Yes to play, No to sit out</span>
            </div>
          </div>
        )}

        {/* Main Content Grid: Left (team) + Right (voting) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* RIGHT COLUMN — Voting & Actions */}
          <div className="lg:col-span-1 lg:order-last card p-6 md:p-8 space-y-5 shadow-xl">
            {/* Voting Action buttons */}
            {canVote ? (
              isYesVoter ? (
                <div className="space-y-2">
                  <div className="bg-[var(--bg-input)] border border-[var(--border)] rounded-xl p-4 text-center text-xs text-[var(--text-muted)] font-medium">
                    <Check size={16} className="inline mr-2 accent" />You are confirmed to play
                  </div>
                  {currentMatch.status !== 'Completed' && currentMatch.status !== 'Cancelled' && (
                    <div>
                      {showAddGuest ? (
                        <div className="bg-[var(--bg-input)] border border-[var(--border)] rounded-xl p-3 space-y-2">
                          <input
                            value={guestName}
                            onChange={(e) => setGuestName(e.target.value)}
                            placeholder="Guest name"
                            className="w-full cardg p-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
                            autoFocus
                          />
                          {(() => {
    const confirmedGuestsCount = (currentMatch.confirmed_guests || []).length;
                            const totalConfirmed = yesCount + confirmedGuestsCount;
                            const playingFull = totalConfirmed >= currentMatch.max_players;
                            if (playingFull) {
                              if (guestStatus !== 'waiting') setGuestStatus('waiting');
                              return (
                                <div className="text-[12px] text-amber-400 font-medium text-center">Playing list is full — guest will be added to Waiting List</div>
                              );
                            }
                            return (
                              <div className="flex gap-1.5">
                                <button
                                  onClick={() => setGuestStatus('confirmed')}
                                  className={`flex-1 py-1.5 rounded-lg text-[12px] font-bold border cursor-pointer ${
                                    guestStatus === 'confirmed'
                                      ? 'bg-[var(--accent)] text-black border-[var(--accent)]'
                                      : 'bg-transparent border-[var(--border)] text-[var(--text-muted)]'
                                  }`}
                                >
                                  Playing
                                </button>
                                <button
                                  onClick={() => setGuestStatus('waiting')}
                                  className={`flex-1 py-1.5 rounded-lg text-[12px] font-bold border cursor-pointer ${
                                    guestStatus === 'waiting'
                                      ? 'bg-amber-500 text-black border-amber-500'
                                      : 'bg-transparent border-[var(--border)] text-[var(--text-muted)]'
                                  }`}
                                >
                                  Waiting
                                </button>
                              </div>
                            );
                          })()}
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => { setShowAddGuest(false); setGuestName(''); }}
                              className="flex-1 py-1.5 rounded-lg text-[12px] font-bold bg-transparent border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={handleAddGuest}
                              disabled={!guestName.trim()}
                              className="flex-1 py-1.5 rounded-lg text-[12px] font-bold bg-[var(--accent)] text-black border border-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                            >
                              Add Guest
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowAddGuest(true)}
                          className="w-full py-2 rounded-xl text-[12px] font-bold bg-[var(--accent)]/5 text-[var(--accent)] border border-[var(--accent)]/20 hover:bg-[var(--accent)]/15 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <UserPlus size={12} /> Add Guest
                        </button>
                      )}
                    </div>
                  )}

                  {/* ── Payment window — visible as soon as turf is confirmed ── */}
                  {currentMatch.status === 'Turf Confirmed' && !currentMatch.is_admin && (
                    <div className="bg-[var(--bg-input)] border border-[var(--accent)]/25 rounded-xl p-4 text-center space-y-3">
                      <p className="text-xs text-[var(--text-primary)] font-bold flex items-center justify-center gap-1.5">
                        <CreditCard size={14} className="text-[var(--accent)]" /> Payment Window Open
                      </p>
                      {/* Split breakdown — includes confirmed guests */}
                      {currentMatch.splits && currentMatch.splits > 1 ? (
                        <div className="card p-2.5 text-[12px] space-y-1 text-left">
                          <p className="text-[var(--text-secondary)] font-label-sm uppercase tracking-wider">Your split breakdown</p>
                          <p className="text-[var(--text-primary)] font-bold">
                            1 (you) + {currentMatch.splits - 1} guest{currentMatch.splits - 1 !== 1 ? 's' : ''}
                            {' '}= {currentMatch.splits} slot{currentMatch.splits > 1 ? 's' : ''}
                          </p>
                          <p className="text-[var(--accent)] font-extrabold text-[12px]">
                            {'\u20B9'}{currentMatch.per_player_cost} &times; {currentMatch.splits} = {'\u20B9'}{currentMatch.user_total_cost}
                          </p>
                        </div>
                      ) : (
                        <p className="text-[12px] text-[var(--text-secondary)]">
                          Your share: <span className="text-[var(--accent)] font-bold">{'\u20B9'}{currentMatch.per_player_cost}</span>
                        </p>
                      )}
                      {(() => {
                        const myVote = currentMatch.votes?.find(v => v.user_id === user.id);
                        if (myVote?.payment_verified) {
                          return (
                            <div className="bg-[var(--accent)]/10 border border-[var(--accent)]/30 rounded-xl py-2 px-3 text-[12px] text-[var(--accent)] font-bold flex items-center justify-center gap-1.5">
                              <CheckCircle size={14} /> Payment Verified
                            </div>
                          );
                        }
                        const pending = currentMatch.pending_amount ?? 0;
                        if (myVote?.has_paid && pending <= 0) {
                          return (
                            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl py-2 px-3 text-[12px] text-amber-400 font-bold flex items-center justify-center gap-1.5">
                              <Clock size={14} /> Paid — Awaiting Admin Verification
                            </div>
                          );
                        }
                        const showAmount = pending > 0 ? pending : (currentMatch.user_total_cost || currentMatch.per_player_cost || currentMatch.cost);
                        return (
                          <button
                            onClick={() => {
                              setPaymentSuccess(false);
                              setPaymentProcessing(false);
                              setShowPaymentModal(true);
                            }}
                            className="w-full btn btn-primary py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                          >
                            {pending > 0 ? 'Pay Remaining ' : 'Pay '}{'\u20B9'}{showAmount}
                          </button>
                        );
                      })()}
                    </div>
                  )}
                </div>
              ) : currentMatch.in_substitute_queue ? (
                null
              ) : isFull ? (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 text-xs text-center">
                  <p className="text-amber-400 font-bold flex items-center justify-center gap-1.5">
                    <Users size={14} /> Team is full
                  </p>
                  <p className="text-[12px] text-[var(--text-secondary)] mt-1 font-label-sm font-semibold">
                    Join the waiting list below for a chance to play if someone backs out
                  </p>
                </div>
              ) : (
                <div className="flex gap-4">
                  <button
                    onClick={() => voteMatch(currentMatch.id, 'Yes')}
                    disabled={isFull}
                    className={`flex-1 py-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                      isYesVoter
                        ? 'bg-[var(--accent)] text-black border-[var(--accent)] neo-glow font-extrabold'
                        : 'bg-transparent border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)]/50 hover:bg-[var(--accent)]/5'
                    }`}
                  >
                    <Check size={14} /> Playing
                  </button>
                  <button
                    onClick={() => voteMatch(currentMatch.id, 'No')}
                    className={`flex-1 py-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      isNoVoter
                        ? 'bg-red-500/20 text-red-400 border-red-500/35 font-extrabold'
                        : 'bg-transparent border-[var(--border)] text-[var(--text-secondary)] hover:border-red-500/30 hover:bg-red-500/5 hover:text-red-400'
                    }`}
                  >
                    <X size={14} /> Out
                  </button>
                </div>
              )
            ) : currentMatch.status === 'Turf Confirmed' && isYesVoter && !currentMatch.is_admin ? (
              <div className="bg-[var(--bg-input)] border border-[var(--accent)]/25 rounded-xl p-4 text-center space-y-3">
                <p className="text-xs text-[var(--text-primary)] font-bold flex items-center justify-center gap-1.5">
                  <CreditCard size={14} className="text-[var(--accent)]" /> Payment Window Open
                </p>
                <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed">
                  The turf booking is confirmed! Please settle your share with the organizer.
                </p>
                {currentMatch.splits && currentMatch.splits > 1 && (
                  <div className="bg-[var(--bg-input)] border border-[var(--border)] rounded-xl p-2.5 text-[12px] space-y-0.5">
                    <p className="text-[var(--text-secondary)]">Splits breakdown:</p>
                    <p className="text-[var(--text-primary)] font-bold">1 (you) + {currentMatch.splits - 1} guest{currentMatch.splits - 1 !== 1 ? 's' : ''} = {currentMatch.splits} split{currentMatch.splits > 1 ? 's' : ''}</p>
                    <p className="text-[var(--accent)] font-bold">{'\u20B9'}{currentMatch.per_player_cost} × {currentMatch.splits} = {'\u20B9'}{currentMatch.user_total_cost}</p>
                  </div>
                )}
                {(() => {
                  const myVote = currentMatch.votes?.find(v => v.user_id === user.id);
                  if (myVote?.payment_verified) {
                    return (
                      <div className="bg-[var(--accent)]/10 border border-[var(--accent)]/30 rounded-xl py-2 px-3 text-[12px] text-[var(--accent)] font-bold flex items-center justify-center gap-1.5">
                        <CheckCircle size={14} /> Payment Verified
                      </div>
                    );
                  }
                  const pending = currentMatch.pending_amount ?? 0;
                  if (myVote?.has_paid && pending <= 0) {
                    return (
                      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl py-2 px-3 text-[12px] text-amber-400 font-bold flex items-center justify-center gap-1.5">
                        <Clock size={14} /> Paid (Awaiting Verification)
                      </div>
                    );
                  }
                  const showAmount = pending > 0 ? pending : (currentMatch.user_total_cost || currentMatch.per_player_cost || currentMatch.cost);
                  return (
                    <button
                      onClick={() => {
                        setPaymentSuccess(false);
                        setPaymentProcessing(false);
                        setShowPaymentModal(true);
                      }}
                      className="w-full btn btn-primary py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                    >
                      {pending > 0 ? `Pay Pending ` : `Pay `}{'\u20B9'}{showAmount}
                    </button>
                  );
                })()}
              </div>
            ) : (
              <div className="bg-[var(--bg-input)] text-[var(--text-muted)] border border-[var(--border)] rounded-xl p-4 text-center text-xs font-medium">
                🔒 Attendance voting is locked — match confirmed, completed, or past kickoff.
              </div>
            )}

            {/* Backout anytime before kickoff */}
            {canBackout && (
              <div className="pt-2">
                <button
                  onClick={() => setShowBackoutPopup(true)}
                  className="w-full btn btn-danger py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <AlertTriangle size={14} /> Back Out
                </button>
              </div>
            )}

            {/* Waiting List — only when full and non-Yes voter */}
            {!isYesVoter && isFull && !currentMatch.in_substitute_queue && waitingCount < 3 && ['Turf Confirmed', 'Proposed', 'Minimum Players Reached', 'Voting Open'].includes(currentMatch.status) && (
              <div className="pt-2">
                <button
                  onClick={() => joinSubstituteQueue(currentMatch.id)}
                  className="w-full btn btn-secondary py-3 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Join Waiting List ({waitingCount}/3)
                </button>
              </div>
            )}

            {/* Pending invite — substitute must accept/decline */}
            {hasPendingInvite && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-center text-xs space-y-3">
                <span className="text-amber-400 font-bold flex items-center justify-center gap-1.5">
                  <Clock size={13} /> Spot Available!
                </span>
                <p className="text-[12px] text-[var(--text-secondary)] font-label-sm">A player backed out and you are next in line. Do you want to join the Playing Team?</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => declinePromotion(currentMatch.id)}
                    className="flex-1 py-2 rounded-xl text-[12px] font-bold bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all cursor-pointer"
                  >
                    Decline
                  </button>
                  <button
                    onClick={() => acceptPromotion(currentMatch.id)}
                    className="flex-1 py-2 rounded-xl text-[12px] font-bold bg-[var(--accent)] text-black border border-[var(--accent)] hover:bg-[var(--accent-hover)] transition-all cursor-pointer"
                  >
                    Accept Spot
                  </button>
                </div>
              </div>
            )}

            {/* Guest promotion invite — SPOC accept/decline for invited guest */}
            {(() => {
              const guestInviteId = currentMatch.pending_guest_invite_id;
              if (!currentMatch.has_pending_guest_invite || !guestInviteId) return null;
              return (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-center text-xs space-y-3">
                  <span className="text-amber-400 font-bold flex items-center justify-center gap-1.5">
                    <Clock size={13} /> Spot Available for Guest
                  </span>
                  <p className="text-[12px] text-[var(--text-secondary)] font-label-sm">
                    A slot opened up for <strong>{currentMatch.pending_guest_invite_name}</strong>. 
                    Accept to move them to the Playing Team.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => declineGuestPromotion(currentMatch.id, guestInviteId!)}
                      className="flex-1 py-2 rounded-xl text-[12px] font-bold bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all cursor-pointer"
                    >
                      Decline
                    </button>
                    <button
                      onClick={() => acceptGuestPromotion(currentMatch.id, guestInviteId!)}
                      className="flex-1 py-2 rounded-xl text-[12px] font-bold bg-[var(--accent)] text-black border border-[var(--accent)] hover:bg-[var(--accent-hover)] transition-all cursor-pointer"
                    >
                      Accept Spot
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Queue status + leave — only for queued users without pending invite or promotion */}
            {currentMatch.in_substitute_queue && !hasPendingInvite && mySubEntry?.status !== 'accepted' && !mySubEntry?.promoted && (
              <div className="bg-[var(--accent)]/5 border border-[var(--accent)]/25 rounded-xl p-4 text-center text-xs space-y-2">
                <span className="text-[var(--accent)] font-bold flex items-center justify-center gap-1.5">
                  <Clock size={13} /> Joined Waiting List
                </span>
                <p className="text-[12px] text-[var(--text-secondary)] font-label-sm font-semibold">Position: #{currentMatch.substitute_position}</p>
                <p className="text-[12px] text-[var(--text-secondary)] font-label-sm">If a confirmed player backs out, you will be offered their spot</p>
                <button
                  onClick={() => leaveSubstituteQueue(currentMatch.id)}
                  className="w-full mt-1 py-2 rounded-xl text-[12px] font-bold bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all cursor-pointer"
                >
                  Leave Waiting List
                </button>
              </div>
            )}

            {/* Admin Operations Card */}
            {currentMatch.is_admin && currentMatch.status === 'Completed' && (
              <div className="bg-[var(--bg-card)] border border-amber-500/20 rounded-2xl p-5 shadow-xl space-y-4">
                <h2 className="font-display text-[12px] font-bold text-amber-500 uppercase tracking-wider flex items-center gap-2">
                  <Shield size={14} className="text-amber-500" /> Admin
                </h2>
                <div className="pt-3 space-y-2">
                  <h3 className="font-display text-[12px] font-bold text-amber-500/70 uppercase tracking-wider">Post-Match Attendance</h3>
                  {currentMatch.votes?.filter(v => v.vote === 'Yes').map((player) => (
                    <div key={player.user_id} className="flex justify-between items-center bg-[var(--bg-input)] border border-[var(--border)] p-2.5 rounded-xl text-[12px]">
                      <span className="font-bold text-[var(--text-primary)]">{player.name}</span>
                      <button onClick={() => { if (confirm(`Mark ${player.name} as no-show?`)) markAttendance(currentMatch.id, player.id); }} className="text-[12px] bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-2 py-1 rounded-lg font-bold cursor-pointer">
                        No-Show
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}


          </div>

          {/* LEFT COLUMN — Playing Team + Admin */}
          <div className="lg:col-span-2 space-y-6 lg:order-first">
            {/* Playing Team Card */}
            <div className="card p-5 md:p-6 shadow-xl">
              <h2 className="font-display text-[12px] font-bold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-2 mb-3">
                <span className="w-1.5 h-4 bg-[var(--accent)] rounded-full"></span>
                Playing Team ({totalPlayers}/{currentMatch.max_players})
              </h2>
              <div className="space-y-2">
                {(() => {
                  const confirmedPlayers: PlayingEntry[] = (currentMatch.votes?.filter(v => v.vote === 'Yes') || []).map(p => ({ ...p, _isGuest: false }));
                  const confirmedGuests: PlayingEntry[] = (currentMatch.confirmed_guests || []).map(g => ({
                    user_id: -(g.id + 10000),
                    name: g.name,
                    created_at: g.created_at,
                    _isGuest: true,
                    _guestId: g.id,
                    _addedByName: g.added_by_name,
                    _addedByUserId: g.added_by_user_id,
                  }));
                  return [...confirmedPlayers, ...confirmedGuests].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()).map((player) => {
                    const isCurrentUser = !player._isGuest && player.user_id === user.id;

                    return (
                      <div key={player.user_id} className="flex justify-between items-center bg-[var(--bg-input)] border border-[var(--border)] p-3 rounded-xl text-xs">
                        <div className="flex items-center gap-3">
                          <div className="h-7 w-7 rounded-lg bg-black border border-[var(--border)] flex items-center justify-center font-display font-extrabold text-[12px] text-[var(--accent)] uppercase">
                            {player.name?.[0] || '?'}
                          </div>
                          <span className="font-bold text-[var(--text-primary)] text-[12.5px]">{player.name}</span>
                          {player._isGuest && player._addedByName && (
                            <span className="text-[12px] text-[var(--text-muted)] font-label-sm">by {player._addedByName}</span>
                          )}
                          {player.user_id === currentMatch.created_by && (
                            <span className="text-[12px] bg-[var(--accent)]/5 text-[var(--accent)] px-1.5 py-0.5 rounded border border-[var(--accent)]/20 font-label-sm uppercase font-bold tracking-wider">Admin</span>
                          )}
                          {isCurrentUser && <span className="text-[12px] text-[var(--text-muted)] font-label-sm">(You)</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          {player._isGuest && player._addedByUserId === user.id && (
                            <button
                              onClick={() => { if (player._guestId && confirm(`Remove ${player.name} from this match?`)) removeGuest(currentMatch.id, player._guestId); }}
                              className="text-[12px] bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-2 py-1 rounded-lg font-bold cursor-pointer"
                            >
                              Remove
                            </button>
                          )}
                          {currentMatch.status === 'Turf Confirmed' && player.user_id !== currentMatch.created_by ? (
                            // Guest payment is rolled into the SPOC's split — show attribution, not a broken verify button
                            player._isGuest ? (
                              <span className="text-[12px] font-bold text-[var(--text-muted)] bg-[var(--bg-input)] border border-[var(--border)] px-2.5 py-0.5 rounded-full font-label-sm">
                                Via {player._addedByName}
                              </span>
                            ) : currentMatch.is_admin ? (
                              <div className="flex items-center gap-1.5">
                                {/* Show +N badge on SPOC rows so admin knows their payment covers guests too */}
                                {(() => {
                                  const guestCount = (currentMatch.confirmed_guests || []).filter(g => g.added_by_user_id === player.user_id).length;
                                  return guestCount > 0 ? (
                                    <span className="text-[12px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded font-label-sm">
                                      +{guestCount} guest{guestCount > 1 ? 's' : ''}
                                    </span>
                                  ) : null;
                                })()}
                                {/* Admin can always click Verify — not gated by has_paid (supports cash/UPI manual verification) */}
                                <button
                                  onClick={() => verifyPayment(currentMatch.id, player.user_id)}
                                  disabled={player.payment_verified}
                                  className={`text-[12px] px-2.5 py-1 rounded-lg font-bold border transition-all ${
                                    player.payment_verified
                                      ? 'bg-[var(--accent)] text-black border-[var(--accent)] cursor-default'
                                      : player.has_paid
                                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/30 cursor-pointer'
                                      : 'bg-[var(--accent)]/5 text-[var(--accent)] border-[var(--accent)]/25 hover:bg-[var(--accent)]/15 cursor-pointer'
                                  }`}
                                >
                                  {player.payment_verified ? '\u2713 Verified' : player.has_paid ? 'Verify Pay' : 'Mark Paid'}
                                </button>
                              </div>
                            ) : (
                              <span className={`text-[12px] font-bold px-2.5 py-0.5 rounded-full ${
                                player.payment_verified
                                  ? 'bg-[var(--accent)]/10 border border-[var(--accent)]/25 text-[var(--accent)]'
                                  : player.has_paid
                                  ? 'bg-amber-500/10 border border-amber-500/25 text-amber-400'
                                  : 'bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text-muted)]'
                              }`}>
                                {player.payment_verified ? 'Paid (Verified)' : player.has_paid ? 'Awaiting Verify' : 'Not Paid'}
                              </span>
                            )
                          ) : (
                            <span className="text-[12px] font-bold text-[var(--accent)] bg-[var(--accent)]/10 border border-[var(--accent)]/25 px-2.5 py-0.5 rounded-full font-label-sm">Confirmed</span>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}
                {totalPlayers === 0 && (
                  <p className="text-[12px] text-[var(--text-muted)] py-4 text-center font-medium">No players registered yet.</p>
                )}

              </div>

              {/* Waiting List inside Playing Team card — unified from backend */}
              {(() => {
                const wl = currentMatch.waiting_list || [];

                // All substitute records with 'invited' status (awaiting the invited user's response)
                const invitedSubs = (currentMatch.substitutes || []).filter(s => s.status === 'invited');

                // Detect if THIS user's substitute entry is currently 'invited'
                const myInvitedSub = mySubEntry?.status === 'invited' ? mySubEntry : null;

                // Detect if any of THIS user's guests are currently 'invited' (SPOC)
                const myInvitedGuest = (() => {
                  if (currentMatch.has_pending_guest_invite && currentMatch.pending_guest_invite_id) {
                    return {
                      id: currentMatch.pending_guest_invite_id,
                      name: currentMatch.pending_guest_invite_name,
                    };
                  }
                  return null;
                })();

                // Keep the section visible as long as ANYTHING is in waiting or invited state.
                // This prevents the list from collapsing when a player is removed and the
                // next person gets auto-invited (changing status from 'waiting' → 'invited').
                const hasAnything = wl.length > 0 || invitedSubs.length > 0 || myInvitedSub || myInvitedGuest;
                if (!hasAnything) return null;

                // Sort by queue_position (FIFO — earliest joiner first)
                const wlSorted = [...wl].sort((a, b) => (a.queue_position ?? 999) - (b.queue_position ?? 999));

                // Total active entries (waiting + invited) for the header count
                const activeCount = wl.length + invitedSubs.length;

                return (
                  <div className="mt-4 pt-4 border-t border-[var(--border)]/40">
                    <h3 className="font-display text-[12px] font-bold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-2 mb-2">
                      <Clock size={12} /> Waiting List ({activeCount}) — first joined, first offered
                    </h3>
                    <div className="space-y-2">

                      {/* ── Inline invite banner for this user (substitute) ── */}
                      {myInvitedSub && (
                        <div className="bg-amber-500/10 border border-amber-500/40 rounded-xl p-3 space-y-2">
                          <p className="text-[12px] font-bold text-amber-400 flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                            A spot opened up — confirm your presence!
                          </p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => declinePromotion(currentMatch.id)}
                              className="flex-1 py-1.5 rounded-lg text-[12px] font-bold bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all cursor-pointer"
                            >
                              No, Thanks
                            </button>
                            <button
                              onClick={() => acceptPromotion(currentMatch.id)}
                              className="flex-1 py-1.5 rounded-lg text-[12px] font-bold bg-[var(--accent)] text-black border border-[var(--accent)] hover:bg-[var(--accent-hover)] transition-all cursor-pointer"
                            >
                              Yes, count me in!
                            </button>
                          </div>
                        </div>
                      )}

                      {/* ── Inline invite banner for SPOC's invited guest ── */}
                      {myInvitedGuest && (
                        <div className="bg-amber-500/10 border border-amber-500/40 rounded-xl p-3 space-y-2">
                          <p className="text-[12px] font-bold text-amber-400 flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                            Spot open for <strong>{myInvitedGuest.name}</strong> — confirm their presence!
                          </p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => declineGuestPromotion(currentMatch.id, myInvitedGuest.id!)}
                              className="flex-1 py-1.5 rounded-lg text-[12px] font-bold bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all cursor-pointer"
                            >
                              No, Remove Guest
                            </button>
                            <button
                              onClick={() => acceptGuestPromotion(currentMatch.id, myInvitedGuest.id!)}
                              className="flex-1 py-1.5 rounded-lg text-[12px] font-bold bg-[var(--accent)] text-black border border-[var(--accent)] hover:bg-[var(--accent-hover)] transition-all cursor-pointer"
                            >
                              Yes, Add to Team!
                            </button>
                          </div>
                        </div>
                      )}

                      {/* ── Invited substitutes awaiting their decision (shown for all observers) ── */}
                      {invitedSubs
                        .filter(s => s.user_id !== user.id)
                        .map(s => (
                          <div key={`invited-sub-${s.user_id}`} className="flex items-center gap-3 bg-amber-500/5 border border-amber-500/20 p-3 rounded-xl text-xs">
                            <span className="w-5 h-5 rounded bg-amber-500/15 text-amber-400 flex items-center justify-center text-[12px]">â³</span>
                            <span className="font-bold text-[var(--text-primary)]">{s.name}</span>
                            <span className="ml-auto text-[12px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded uppercase tracking-wider">Awaiting Response</span>
                          </div>
                        ))
                      }

                      {/* ── Regular waiting entries (FIFO order) ── */}
                      {wlSorted.map((entry, idx: number) => {
                        const isGuest = entry.type === 'guest';
                        const isNext = idx === 0; // first in queue
                        return (
                          <div key={`${entry.type}-${entry.id}`} className={`flex items-center gap-3 p-3 rounded-xl text-xs border ${
                            isNext ? 'bg-amber-500/5 border-amber-500/25' : 'bg-[var(--bg-input)] border-[var(--border)]'
                          }`}>
                            <span className={`w-5 h-5 rounded flex items-center justify-center font-bold text-[12px] ${
                              isNext ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-500/10 text-amber-500'
                            }`}>#{entry.queue_position}</span>
                            <span className="font-bold text-[var(--text-primary)]">{entry.name}</span>
                            {isNext && (
                              <span className="text-[12px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded uppercase tracking-wider">Next Up</span>
                            )}
                            {isGuest && (
                              <span className="text-[12px] text-[var(--text-muted)] font-label-sm">by {entry.added_by_name}</span>
                            )}
                            {isGuest && entry.added_by_user_id === user.id && (
                              <button
                                onClick={() => { if (confirm(`Remove ${entry.name} from the waiting list?`)) removeGuest(currentMatch.id, entry.id); }}
                                className="text-[12px] bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-lg font-bold cursor-pointer"
                              >
                                Remove
                              </button>
                            )}
                            <span className="ml-auto text-[12px] text-[var(--text-muted)] font-label-sm">Waiting</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

            </div>
          </div>
        </div>

        {/* Payment Simulation Modal */}
        {showPaymentModal && (
          <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex items-center justify-center p-4">
            <div className="card p-6 w-full max-w-sm space-y-5 shadow-2xl relative">
              <button 
                onClick={() => setShowPaymentModal(false)} 
                className="absolute top-4 right-4 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer transition-colors"
                disabled={paymentProcessing}
              >
                <X size={18} />
              </button>

              {!paymentSuccess ? (
                <>
                  <div className="text-center space-y-1">
                    <h3 className="text-sm font-display font-extrabold text-[var(--text-primary)]">Settle Booking Cost</h3>
                    <p className="text-[12px] text-[var(--text-secondary)]">Pay directly via UPI to the organizer</p>
                    {currentMatch.splits && currentMatch.splits > 1 && (
                      <div className="bg-[var(--bg-input)] border border-[var(--border)] rounded-xl p-2 text-[12px] space-y-0.5 mt-2">
                        <p className="text-[var(--text-secondary)]">Your total includes guest splits:</p>
                        <p className="text-[var(--text-primary)] font-bold">{currentMatch.splits} split{currentMatch.splits > 1 ? 's' : ''} × {'\u20B9'}{currentMatch.per_player_cost}</p>
                      </div>
                    )}
                    {(() => {
                      const pending = currentMatch.pending_amount ?? 0;
                      if (pending > 0 && (currentMatch.paid_amount ?? 0) > 0) {
                        return (
                          <div className="text-[12px] mt-2 space-y-0.5">
                            <p className="text-[var(--text-secondary)]">Already paid: {'\u20B9'}{currentMatch.paid_amount}</p>
                            <p className="text-amber-400 font-bold">Pending: {'\u20B9'}{pending}</p>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>

                  {!currentMatch.creator_upi ? (
                    <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl text-center text-xs space-y-2">
                      <p className="text-amber-400 font-bold flex items-center justify-center gap-1.5">
                        ⚠ VPA Not Configured
                      </p>
                      <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed">
                        Organizer <strong>{currentMatch.creator_name || 'Admin'}</strong> has not configured their UPI ID yet. 
                        Please prompt them to add it to their Profile.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4 text-center">
                      <div className="p-4 bg-[var(--bg-input)] border border-[var(--border)] rounded-xl space-y-3">
                        <p className="text-[12px] text-[var(--text-secondary)] uppercase tracking-wider font-semibold">UPI Payment Info</p>
                        <div className="space-y-1">
                          <p className="text-xs text-[var(--text-primary)] font-bold">{currentMatch.creator_name || 'Organizer'}</p>
                          <p className="text-[12px] text-[var(--accent)] font-mono">{currentMatch.creator_upi}</p>
                        </div>
                      </div>

                      {/* Deep UPI Link */}
                      <a
                        href={`upi://pay?pa=${currentMatch.creator_upi}&pn=${encodeURIComponent(currentMatch.creator_name || 'Organizer')}&cu=INR`}
                        onClick={() => {
                          setPaymentProcessing(true);
                          setTimeout(async () => {
                            await payMatch(currentMatch.id);
                            setPaymentProcessing(false);
                            setPaymentSuccess(true);
                          }, 1500);
                        }}
                        className="block w-full text-center bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-black font-display font-extrabold py-3.5 rounded-xl text-xs tracking-tight shadow-lg neo-glow transition-all active:scale-98"
                      >
                        🚀 Pay {'\u20B9'}{(currentMatch.pending_amount ?? (currentMatch.user_total_cost || currentMatch.per_player_cost || currentMatch.cost))} via UPI
                      </a>

                      <button
                        onClick={async () => {
                          setPaymentProcessing(true);
                          await payMatch(currentMatch.id);
                          setPaymentProcessing(false);
                          setPaymentSuccess(true);
                        }}
                        className="w-full text-[12px] text-[#666666] hover:text-[var(--accent)] transition-colors cursor-pointer"
                      >
                        Simulate Payment Success without Redirect
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-6 space-y-4">
                  <div className="h-12 w-12 bg-[var(--accent)]/10 text-[var(--accent)] rounded-full flex items-center justify-center mx-auto border border-[var(--accent)]/30 animate-bounce">
                    <Check size={24} className="stroke-[3px]" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-display font-extrabold text-[var(--text-primary)]">Payment Confirmed!</h3>
                    <p className="text-[12px] text-[var(--text-secondary)]">Your share has been settled with the organizer.</p>
                  </div>
                  <button
                    onClick={() => setShowPaymentModal(false)}
                    className="w-full btn btn-secondary py-2.5 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Backout Popup Modal */}
        {showBackoutPopup && (
          <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
            <div className="card p-6 w-full max-w-sm space-y-4 shadow-2xl">
              <div className="flex justify-between items-start">
                <h3 className="text-sm font-display font-extrabold text-[var(--text-primary)]">Backout Details</h3>
                <button onClick={() => setShowBackoutPopup(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer transition-colors">
                  <X size={18} />
                </button>
              </div>
              
              <div className="text-[12px] text-[var(--text-secondary)] bg-[var(--bg-input)] border border-[var(--border)] p-3.5 rounded-xl flex gap-2.5">
                <AlertTriangle size={16} className="text-[var(--accent)] shrink-0" />
                <p className="leading-normal font-medium">You can back out anytime before kickoff. If someone is on the substitute queue, they will take your spot.</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[12px] font-bold text-[var(--text-secondary)] uppercase tracking-wider font-label-sm">Reason for Backout</label>
                <textarea
                  value={backoutReason}
                  onChange={(e) => setBackoutReason(e.target.value)}
                  placeholder="e.g. Work emergency / Injury"
                  className="input"
                ></textarea>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowBackoutPopup(false)}
                  className="flex-1 btn btn-ghost py-2.5 rounded-xl text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBackoutSubmit}
                  className="flex-1 btn btn-danger py-2.5 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Match Form (overlay/modal) */}
        {editingMatchId === currentMatch.id && (
          <form onSubmit={handleMatchFormSubmit} className="card border-amber-500/20 p-6 md:p-8 space-y-5 shadow-xl">
            <h3 className="font-display text-sm text-amber-500 font-extrabold uppercase tracking-wider flex items-center gap-2">
              <Pencil size={14} /> Edit Match
            </h3>
            <p className="text-[12px] text-[var(--text-muted)]">Saving will reset all votes and payments.</p>
            <MatchFormFields
              isEdit
              groupId={groupId}
              setGroupId={setGroupId}
              turfName={turfName}
              setTurfName={setTurfName}
              location={location}
              setLocation={setLocation}
              matchDate={matchDate}
              setMatchDate={setMatchDate}
              matchTime={matchTime}
              setMatchTime={setMatchTime}
              endTime={endTime}
              setEndTime={setEndTime}
              maxPlayers={maxPlayers}
              handleMaxPlayersChange={handleMaxPlayersChange}
              matchCost={matchCost}
              setMatchCost={setMatchCost}
              adminGroups={adminGroups}
            />
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={resetMatchForm} className="flex-1 btn btn-ghost py-2.5 rounded-xl text-xs cursor-pointer">
                Cancel
              </button>
              <button type="submit" className="flex-1 btn btn-primary py-2.5 rounded-xl text-xs font-bold cursor-pointer">
                Save Changes
              </button>
            </div>
          </form>
        )}
      </div>
    );
  }

  // List View Screen
  return (
    <div className="space-y-6 pb-12">
      {/* Matches Header */}
      <div className="flex justify-between items-center">
        <div>
          <span className="text-[12px] font-bold uppercase tracking-wider text-[var(--accent)] bg-[var(--accent)]/5 px-2.5 py-1 rounded-md border border-[var(--accent)]/10 font-label-sm">Game Centre</span>
          <h1 className="text-2xl font-display font-extrabold mt-2 text-[var(--text-primary)]">Turf Matches</h1>
        </div>

        {adminGroups.length > 0 && (
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="btn btn-primary p-3 rounded-xl shadow-lg cursor-pointer hover:scale-102 transition-all"
            title="Propose Match"
          >
            <Plus size={18} />
          </button>
        )}
      </div>

      {/* Match Creation Form collapsible */}
      {showCreateForm && !editingMatchId && (
        <form onSubmit={handleMatchFormSubmit} className="card p-6 md:p-8 space-y-5 shadow-2xl">
          <h3 className="font-display text-sm text-[var(--accent)] font-extrabold uppercase tracking-wider flex items-center gap-2">
            <span className="w-1.5 h-4.5 bg-[var(--accent)] rounded-full"></span>
            Propose Match
          </h3>
          <MatchFormFields
            isEdit={false}
            groupId={groupId}
            setGroupId={setGroupId}
            turfName={turfName}
            setTurfName={setTurfName}
            location={location}
            setLocation={setLocation}
            matchDate={matchDate}
            setMatchDate={setMatchDate}
            matchTime={matchTime}
            setMatchTime={setMatchTime}
            endTime={endTime}
            setEndTime={setEndTime}
            maxPlayers={maxPlayers}
            handleMaxPlayersChange={handleMaxPlayersChange}
            matchCost={matchCost}
            setMatchCost={setMatchCost}
            adminGroups={adminGroups}
          />
          <div className="flex gap-3 pt-3">
            <button
              type="button"
              onClick={() => { setShowCreateForm(false); resetMatchForm(); }}
              className="flex-1 btn btn-ghost py-2.5 rounded-xl text-xs cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 btn btn-primary py-2.5 rounded-xl text-xs font-bold cursor-pointer"
            >
              Submit Match
            </button>
          </div>
        </form>
      )}

      {/* Tabs */}
      <div className="flex border-b border-[var(--border)]/60 mb-6">
        <button
          onClick={() => setActiveTab('upcoming')}
          className={`flex-1 pb-3.5 text-center text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'upcoming' 
              ? 'border-[var(--accent)] text-[var(--accent)] font-extrabold' 
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
          }`}
        >
         Discover ({upcomingMatchesList.length})
        </button>
        <button
          onClick={() => setActiveTab('confirmed')}
          className={`flex-1 pb-3.5 text-center text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'confirmed' 
              ? 'border-[var(--accent)] text-[var(--accent)] font-extrabold' 
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
          }`}
        >
          My Matches ({confirmedMatchesList.length})
        </button>
        <button
          onClick={() => setActiveTab('past')}
          className={`flex-1 pb-3.5 text-center text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'past' 
              ? 'border-[var(--accent)] text-[var(--accent)] font-extrabold' 
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
          }`}
        >
          History ({pastMatchesList.length})
        </button>
      </div>

      {/* Match Cards List Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {loading && (
          <div className="col-span-full flex justify-center items-center py-16">
            <span className="h-7 w-7 border-2 border-[var(--accent)]/20 border-t-[var(--accent)] rounded-full animate-spin"></span>
          </div>
        )}

        {!loading && activeTab === 'upcoming' && upcomingMatchesList.length === 0 && (
          <p className="col-span-full text-xs text-[var(--text-muted)] py-12 text-center font-medium">No upcoming matches to vote on.</p>
        )}

        {!loading && activeTab === 'confirmed' && confirmedMatchesList.length === 0 && (
          <p className="col-span-full text-xs text-[var(--text-muted)] py-12 text-center font-medium">You have not confirmed any matches yet.</p>
        )}

        {!loading && activeTab === 'past' && pastMatchesList.length === 0 && (
          <p className="col-span-full text-xs text-[var(--text-muted)] py-12 text-center font-medium">No past matches found.</p>
        )}

        {!loading && (activeTab === 'upcoming' ? upcomingMatchesList : activeTab === 'confirmed' ? confirmedMatchesList : pastMatchesList).map((m) => (
          <div key={m.id} className="card p-5 space-y-4 hover:border-[var(--accent)]/30 hover:shadow-lg transition-all flex flex-col justify-between group min-h-[220px]">
            <div className="flex justify-between items-start">
              <div className="space-y-1.5">
                <span className={`badge ${
                  m.status === 'Turf Confirmed' 
                    ? 'badge-green' 
                    : m.status === 'Completed'
                    ? 'badge-blue'
                    : m.status === 'Cancelled'
                    ? 'badge-red'
                    : 'badge-yellow'
                }`}>
                  {m.status}
                </span>
                <h3 className="font-display font-extrabold text-sm text-[var(--text-primary)] group-hover:text-[var(--accent)] mt-2.5 transition-colors tracking-tight line-clamp-1">Match at {m.turf_name}</h3>
                <p className="text-[12px] text-[var(--text-muted)] font-label-sm font-semibold mt-0.5">{groups.find(g => g.id === m.group_id)?.name}</p>
                <p className="text-[12px] text-[var(--text-secondary)] flex items-center gap-1.5 font-medium mt-0.5">
                  <MapPin size={11} className="text-[var(--accent)]" />
                  {m.turf_name} • {m.location.split(',')[0]}
                </p>
              </div>
              
              <div className="text-right">
                <p className="text-[12px] font-bold text-[var(--text-primary)] font-label-sm">{m.match_date}</p>
                <p className="text-[12px] text-[var(--text-muted)] uppercase font-label-sm mt-0.5">{m.end_time ? formatTimeRange(m.match_time, m.end_time) : m.match_time}</p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[var(--border)]/40 text-[12px] text-[var(--text-secondary)]">
              <span className="flex items-center gap-1.5 font-medium">
                <Users size={12} className="text-[var(--text-muted)]" />
                Players: <strong className="text-[var(--text-primary)] font-label-sm">{m.yes_votes || 0} / {m.max_players}</strong>
              </span>
              {m.auto_booked && (
                <span className="text-[12px] text-[var(--accent)] flex items-center gap-0.5 mt-1 justify-end">
                  <Zap size={9} /> Auto
                </span>
              )}
            </div>

            <Link href={`/matches?id=${m.id}`} className="block pt-2">
              <button className="w-full btn btn-ghost text-xs py-2.5 rounded-xl cursor-pointer">
                Enter Matchroom
              </button>
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

function MatchFormFields({
  isEdit,
  groupId,
  setGroupId,
  turfName,
  setTurfName,
  location,
  setLocation,
  matchDate,
  setMatchDate,
  matchTime,
  setMatchTime,
  endTime,
  setEndTime,
  maxPlayers,
  handleMaxPlayersChange,
  matchCost,
  setMatchCost,
  adminGroups,
}: {
  isEdit: boolean;
  groupId: string;
  setGroupId: (v: string) => void;
  turfName: string;
  setTurfName: (v: string) => void;
  location: string;
  setLocation: (v: string) => void;
  matchDate: string;
  setMatchDate: (v: string) => void;
  matchTime: string;
  setMatchTime: (v: string) => void;
  endTime: string;
  setEndTime: (v: string) => void;
  maxPlayers: string;
  handleMaxPlayersChange: (v: string) => void;
  matchCost: string;
  setMatchCost: (v: string) => void;
  adminGroups: { id: number; name: string }[];
}) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timePickerStep, setTimePickerStep] = useState<'start' | 'end' | 'summary'>('start');
  const [tempStartTime, setTempStartTime] = useState('');
  const [tempEndTime, setTempEndTime] = useState('');

  const dateOptions = generateDateOptions();
  const timeSlots = generateTimeSlots();

  const todayStr = new Date().toISOString().split('T')[0];

  const formatDateDisplay = (d: string) => {
    if (!d) return 'Select date';
    const date = new Date(d + 'T00:00:00');
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const handleDateSelect = (val: string) => {
    setMatchDate(val);
    setShowDatePicker(false);
  };

  const handleTimeSlotSelect = (slot: string) => {
    if (timePickerStep === 'start') {
      setTempStartTime(slot);
      setTempEndTime('');
      setTimePickerStep('end');
    } else if (timePickerStep === 'end') {
      if (slot === tempStartTime) return;
      setTempEndTime(slot);
      setTimePickerStep('summary');
    }
  };

  const confirmTimeRange = () => {
    setMatchTime(tempStartTime);
    setEndTime(tempEndTime);
    setShowTimePicker(false);
    setTimePickerStep('start');
    setTempStartTime('');
    setTempEndTime('');
  };

  const cancelTimePicker = () => {
    setShowTimePicker(false);
    setTimePickerStep('start');
    setTempStartTime('');
    setTempEndTime('');
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
      {!isEdit && (
        <div className="md:col-span-2 space-y-1.5 relative">
          <label className="font-bold text-[var(--text-secondary)] text-[12px] uppercase tracking-wider font-label-sm">Select Group</label>
          <Select aria-label="Select group" value={String(groupId)} onValueChange={setGroupId} required>
            <option value="">Select a group</option>
            {adminGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </Select>
        </div>
      )}


      <div className="space-y-1.5">
        <label className="font-bold text-[var(--text-secondary)] text-[12px] uppercase tracking-wider font-label-sm">Turf Name</label>
        <input
          type="text"
          value={turfName}
          onChange={(e) => setTurfName(e.target.value)}
          placeholder="e.g. Arena B"
          className="input text-xs py-3 rounded-xl bg-[var(--bg-input)] border-[var(--border)] focus:border-[var(--accent)] placeholder-[var(--text-muted)]"
          required
        />
      </div>

      <div className="space-y-1.5">
        <label className="font-bold text-[var(--text-secondary)] text-[12px] uppercase tracking-wider font-label-sm">Location</label>
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="e.g. 123 Main St"
          className="input text-xs py-3 rounded-xl bg-[var(--bg-input)] border-[var(--border)] focus:border-[var(--accent)] placeholder-[var(--text-muted)]"
          required
        />
      </div>

      {/* Custom Date Picker */}
      <div className="space-y-1.5 relative">
        <label className="font-bold text-[var(--text-secondary)] text-[12px] uppercase tracking-wider font-label-sm">Date</label>
        <button
          type="button"
          onClick={() => setShowDatePicker(!showDatePicker)}
          className="w-full bg-[var(--bg-input)] border border-[var(--border)] hover:border-[var(--accent)]/50 text-[var(--text-primary)] rounded-xl py-3 px-4 text-xs text-left flex items-center justify-between transition-all cursor-pointer"
        >
          <span className={matchDate ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}>{formatDateDisplay(matchDate)}</span>
          <Calendar size={14} className="text-[var(--accent)]" />
        </button>
        {showDatePicker && (
          <div className="absolute z-50 top-full mt-1 left-0 right-0 picker-panel p-3 max-h-64 overflow-y-auto">
            <div className="grid grid-cols-4 gap-1.5">
              {dateOptions.map((opt) => {
                const isSelected = matchDate === opt.value;
                const isToday = opt.value === todayStr;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleDateSelect(opt.value)}
                    className={`flex flex-col items-center py-2 px-1 rounded-xl text-xs transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[var(--accent)] text-black font-extrabold'
                        : 'hover:bg-[var(--border)] text-[var(--text-secondary)]'
                    }`}
                  >
                    <span className="text-[12px] font-bold uppercase">{opt.dayName}</span>
                    <span className="text-sm font-black">{opt.dayNum}</span>
                    {isToday && <span className="text-[12px] uppercase tracking-wider mt-0.5">Today</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Custom Time Picker */}
      <div className="space-y-1.5 relative">
        <label className="font-bold text-[var(--text-secondary)] text-[12px] uppercase tracking-wider font-label-sm">Time Slot</label>
        <button
          type="button"
          onClick={() => { setShowTimePicker(true); setTimePickerStep('start'); setTempStartTime(''); setTempEndTime(''); }}
          className="w-full bg-[var(--bg-input)] border border-[var(--border)] hover:border-[var(--accent)]/50 text-[var(--text-primary)] rounded-xl py-3 px-4 text-xs text-left flex items-center justify-between transition-all cursor-pointer"
        >
          <span className={matchTime && endTime ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}>
            {matchTime && endTime ? formatTimeRange(matchTime, endTime) : 'Select time slot'}
          </span>
          <Clock size={14} className="text-[var(--accent)]" />
        </button>

        {showTimePicker && (
          <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4" onClick={cancelTimePicker}>
            <div className="picker-panel p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
              {timePickerStep === 'start' && (
                <div>
                  <h3 className="text-sm font-display font-extrabold text-[var(--text-primary)] mb-3">Select Start Time</h3>
                  <div className="max-h-52 overflow-y-auto grid grid-cols-3 gap-1.5">
                    {timeSlots.map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => handleTimeSlotSelect(slot)}
                        className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          tempStartTime === slot
                            ? 'bg-[var(--accent)] text-black'
                            : 'bg-[var(--bg-input)] text-[var(--text-secondary)] hover:bg-[var(--border)]'
                        }`}
                      >
                        {format12Hour(slot)}
                      </button>
                    ))}
                  </div>
                  <button type="button" onClick={cancelTimePicker} className="w-full mt-3 btn btn-ghost py-2 rounded-xl text-xs cursor-pointer">Cancel</button>
                </div>
              )}
              {timePickerStep === 'end' && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="text-sm font-display font-extrabold text-[var(--text-primary)]">Select End Time</h3>
                    <span className="text-[12px] text-[var(--accent)] bg-[var(--accent)]/10 px-2 py-0.5 rounded font-bold">from {format12Hour(tempStartTime)}</span>
                  </div>
                  <div className="max-h-52 overflow-y-auto grid grid-cols-3 gap-1.5">
                    {[...timeSlots.filter(s => s > tempStartTime), ...timeSlots.filter(s => s < tempStartTime)].map((slot) => {
                      const isNextDay = slot < tempStartTime;
                      return (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => handleTimeSlotSelect(slot)}
                          className={`py-2 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center cursor-pointer ${
                            tempEndTime === slot
                              ? 'bg-[var(--accent)] text-black'
                              : 'bg-[var(--bg-input)] text-[var(--text-secondary)] hover:bg-[var(--border)]'
                          }`}
                        >
                          <span>{format12Hour(slot)}</span>
                          {isNextDay && <span className="text-[12px] font-semibold opacity-70 mt-0.5 leading-none">(Next Day)</span>}
                        </button>
                      );
                    })}
                  </div>
                  <button type="button" onClick={() => setTimePickerStep('start')} className="w-full mt-3 btn btn-ghost py-2 rounded-xl text-xs cursor-pointer">Back</button>
                </div>
              )}
              {timePickerStep === 'summary' && (
                <div>
                  <h3 className="text-sm font-display font-extrabold text-[var(--text-primary)] mb-3">Confirm Time Slot</h3>
                  <div className="bg-[var(--bg-input)] border border-[var(--accent)]/20 rounded-xl p-4 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-[var(--text-muted)]">Start</span>
                      <span className="text-[var(--text-primary)] font-bold">{format12Hour(tempStartTime)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-[var(--text-muted)]">End</span>
                      <span className="text-[var(--text-primary)] font-bold">{format12Hour(tempEndTime)}</span>
                    </div>
                    <div className="border-t border-[var(--border)] pt-2 mt-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-[var(--text-muted)]">Duration</span>
                        <span className="text-[var(--accent)] font-bold">
                          {(() => {
                            const [sh, sm] = tempStartTime.split(':').map(Number);
                            const [eh, em] = tempEndTime.split(':').map(Number);
                            let mins = (eh * 60 + em) - (sh * 60 + sm);
                            if (mins <= 0) mins += 24 * 60; // next-day wraparound
                            const durationLabel = tempEndTime < tempStartTime ? ' (Next Day)' : '';
                            return `${Math.floor(mins / 60)}h ${mins % 60}m${durationLabel}`;
                          })()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3 mt-4">
                    <button type="button" onClick={() => setTimePickerStep('end')} className="flex-1 btn btn-ghost py-2.5 rounded-xl text-xs cursor-pointer">Back</button>
                    <button type="button" onClick={confirmTimeRange} className="flex-1 btn btn-primary py-2.5 rounded-xl text-xs font-bold cursor-pointer">Confirm</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <label className="font-bold text-[var(--text-secondary)] text-[12px] uppercase tracking-wider font-label-sm">Max Players</label>
        <input
          type="number"
          min={1}
          value={maxPlayers}
          onChange={(e) => handleMaxPlayersChange(e.target.value)}
          className="input text-xs py-3 rounded-xl bg-[var(--bg-input)] border-[var(--border)] focus:border-[var(--accent)]"
          required
        />
      </div>

      <div className="space-y-1.5">
        <label className="font-bold text-[var(--text-secondary)] text-[12px] uppercase tracking-wider font-label-sm">Total Turf Cost (₹)</label>
        <input
          type="number"
          min={0}
          value={matchCost}
          onChange={(e) => setMatchCost(e.target.value)}
          placeholder="e.g. 5000"
          className="input text-xs py-3 rounded-xl bg-[var(--bg-input)] border-[var(--border)] focus:border-[var(--accent)] placeholder-[var(--text-muted)]"
        />
      </div>

    </div>
  );
}

export default function MatchesPage() {
  return (
    <Suspense fallback={<div className="text-center py-12 text-[var(--text-muted)] font-medium">Loading Matches...</div>}>
      <MatchesContent />
    </Suspense>
  );
}




