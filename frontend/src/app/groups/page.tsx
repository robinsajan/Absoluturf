'use client';
import Select from '../../components/Select';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useStore, PenaltyRule } from '../../store/useStore';
import Link from 'next/link';
import { Shield, Plus, ArrowLeft, Check, X, ShieldAlert, LogOut, Search, AlertTriangle, Trash2, Pencil, Link as LinkIcon } from 'lucide-react';

function GroupsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const groupIdParam = searchParams.get('id');

  const {
    user,
    groups,
    currentGroup,
    loading,
    fetchGroups,
    fetchGroup,
    createGroup,
    joinGroup,
    approveJoinRequest,
    removeMember,
    promoteAdmin,
    getInviteLink,
    updatePenaltyRules,
    fetchPenaltyRules,
    createPenaltyRule,
    updatePenaltyRule,
    deletePenaltyRule
  } = useStore();

  const [showCreateForm, setShowCreateForm] = useState(searchParams.get('create') === 'true');
  const [penaltyEnabled, setPenaltyEnabled] = useState(false);
  const [penaltyType, setPenaltyType] = useState('Match Ban');
  const [penaltyMatches, setPenaltyMatches] = useState('3');
  const [penaltyThreshold, setPenaltyThreshold] = useState('12');

  // PenaltyRule management
  const [penaltyRulesList, setPenaltyRulesList] = useState<PenaltyRule[]>([]);
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<number | null>(null);
  const [ruleTrigger, setRuleTrigger] = useState('no_show');
  const [rulePenaltyType, setRulePenaltyType] = useState('Match Ban');
  const [rulePenaltyValue, setRulePenaltyValue] = useState('1');
  const [ruleFeeMultiplier, setRuleFeeMultiplier] = useState('1.0');
  const [ruleDescription, setRuleDescription] = useState('');
  
  // Group creation form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sportType, setSportType] = useState('Football');
  const [visibility, setVisibility] = useState('Public');

  // Search filter
  const [searchTerm, setSearchTerm] = useState('');

  // Popup state for member actions
  const [popupMemberId, setPopupMemberId] = useState<number | null>(null);

  // Invite link state
  const [copiedLink, setCopiedLink] = useState(false);

  // Initial fetch
  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  // Fetch single group details if parameter changed
  useEffect(() => {
    if (groupIdParam) {
      fetchGroup(Number(groupIdParam)).then(group => {
        if (!group) return;
        setPopupMemberId(null);
        setPenaltyEnabled(group.backout_penalty_enabled || false);
        setPenaltyType(group.backout_penalty_type || 'Match Ban');
        setPenaltyMatches(String(group.backout_penalty_matches || 3));
        setPenaltyThreshold(String(group.backout_hours_threshold || 12));
      });
    }
  }, [groupIdParam, fetchGroup]);

  // Sync penalty rule states when currentGroup loads
  useEffect(() => {
    if (currentGroup) {
      // Load PenaltyRules
      fetchPenaltyRules(currentGroup.id).then(setPenaltyRulesList);
    }
  }, [currentGroup, fetchPenaltyRules]);

  if (!user) return null;

  // Handle Group Creation
  const handleCreateGroupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await createGroup(name, description, sportType, visibility);
    if (success) {
      setShowCreateForm(false);
      setName('');
      setDescription('');
      fetchGroups();
    }
  };

  // Handle Leave Group
  const handleLeaveGroup = async () => {
    if (!groupIdParam) return;
    if (confirm('Are you sure you want to leave this group?')) {
      await removeMember(Number(groupIdParam), user.id);
      router.push('/groups');
    }
  };

  // Handle Share Link
  const handleShareLink = async () => {
    if (!currentGroup) return;
    const code = await getInviteLink(currentGroup.id);
    if (code) {
      const link = `${window.location.origin}/invite/${code}`;
      await navigator.clipboard.writeText(link);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  // Filter groups based on search term
  const filteredGroups = groups.filter(g =>
    g.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    g.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Detail View Screen
  if (groupIdParam && currentGroup) {
    const isAdmin = currentGroup.current_user_role === 'Admin';
    const isApprovedMember = currentGroup.current_user_status === 'Approved';
    const isPending = currentGroup.current_user_status === 'Pending';
    
    // Sort members: Admins first
    const sortedMembers = currentGroup.members 
      ? [...currentGroup.members].sort((a, b) => (b.role === 'Admin' ? 1 : 0) - (a.role === 'Admin' ? 1 : 0)) 
      : [];

    const approvedMembers = sortedMembers.filter(m => m.status === 'Approved');
    const pendingMembers = sortedMembers.filter(m => m.status === 'Pending');

    return (
      <div className="space-y-6 pb-12">
        {/* Detail Header */}
        <button
          onClick={() => router.push('/groups')}
          className="flex items-center gap-1.5 text-xs font-bold text-[var(--accent)] bg-[var(--accent)]/5 px-4 py-2 rounded-xl border border-[var(--accent)]/10 hover:bg-[var(--accent)]/15 hover:border-[var(--accent)]/20 transition-all w-fit cursor-pointer"
        >
          <ArrowLeft size={14} /> Back to Groups
        </button>

        {/* Group Info Card */}
        <div className="card p-6 md:p-8 space-y-5 shadow-xl">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 bg-[var(--accent)] rounded-2xl flex items-center justify-center font-display text-xl font-black text-black shadow-md">
                {currentGroup.name[0]}
              </div>
              <div className="space-y-1">
                <h1 className="text-xl font-display font-extrabold text-[var(--text-primary)] tracking-tight">{currentGroup.name}</h1>
                <p className="text-[12px] text-[var(--text-muted)] font-label-sm uppercase tracking-wider font-semibold">
                  {currentGroup.sport_type} Club • {currentGroup.visibility}
                </p>
              </div>
            </div>
            {isApprovedMember && (
              <button
                onClick={handleLeaveGroup}
                className="text-red-400 hover:text-red-300 p-2.5 bg-red-500/5 border border-red-500/10 rounded-xl hover:bg-red-500/10 transition-all cursor-pointer"
                title="Leave Group"
              >
                <LogOut size={15} />
              </button>
            )}
          </div>

          <p className="text-xs text-[var(--text-secondary)] leading-relaxed bg-[var(--bg-input)] p-4 rounded-xl border border-[var(--border)]/80">
            {currentGroup.description || 'No description provided for this group.'}
          </p>

          {/* Join / Status Buttons */}
          {currentGroup.current_user_status === 'None' && (
            <button
              onClick={() => joinGroup(currentGroup.id)}
              className="w-full btn btn-primary py-3 rounded-xl text-xs font-bold shadow-md cursor-pointer"
            >
              Request to Join Group
            </button>
          )}

          {isPending && (
            <div className="w-full bg-amber-500/5 border border-amber-500/10 text-amber-500 text-center text-xs font-semibold py-3 rounded-xl font-label-sm uppercase tracking-wider">
              🕒 Requested • Pending Approval
            </div>
          )}
        </div>

        {/* Members Roster */}
        {isApprovedMember && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="font-display text-[12px] font-bold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-2">
                <span className="w-1.5 h-4 bg-[var(--accent)] rounded-full"></span>
                Approved Members ({approvedMembers.length})
              </h2>
              {isAdmin && (
                <button
                  onClick={handleShareLink}
                  className="text-[12px] bg-[var(--accent)]/5 hover:bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/15 px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1 cursor-pointer font-label-sm uppercase tracking-wider"
                >
                  {copiedLink ? <Check size={12} /> : <LinkIcon size={12} />}
                  {copiedLink ? 'Copied!' : 'Share Link'}
                </button>
              )}
            </div>

            {/* Members List */}
            <div className="space-y-3">
              {approvedMembers.map((member) => (
                <div key={member.id} className="flex justify-between items-center bg-[var(--bg-card)] border border-[var(--border)] p-3.5 rounded-xl text-xs">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-black border border-[var(--border)] flex items-center justify-center font-display font-black text-xs text-[var(--accent)] uppercase">
                      {member.name[0]}
                    </div>
                    <div>
                      <p className="font-bold text-[var(--text-primary)] text-[12.5px]">{member.name}</p>
                      <p className="text-[12px] text-[var(--text-muted)] font-label-sm font-semibold">{member.email}</p>
                    </div>
                    {member.role === 'Admin' && (
                      <span className="text-[12px] font-bold bg-[var(--accent)]/5 border border-[var(--accent)]/20 text-[var(--accent)] px-2 py-0.5 rounded-md font-label-sm uppercase tracking-wider ml-1 flex items-center gap-0.5 shadow-sm">
                        <Shield size={9} /> Admin
                      </span>
                    )}
                  </div>

                  {/* Admin actions on members */}
                  {isAdmin && member.id !== user.id && (
                    <div className="relative">
                      <button
                        onClick={() => setPopupMemberId(popupMemberId === member.id ? null : member.id)}
                        className="h-8 w-8 rounded-full border border-[var(--border)] bg-[var(--bg-input)] flex items-center justify-center hover:border-[var(--accent)]/40 hover:bg-[var(--accent)]/5 transition-all cursor-pointer"
                      >
                        <span className="text-[var(--accent)] font-display font-bold text-sm">&gt;</span>
                      </button>
                      
                      {popupMemberId === member.id && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setPopupMemberId(null)} />
                          <div className="absolute right-0 top-10 z-20 picker-panel action-menu p-2 min-w-[180px] space-y-1">
                            <button
                              onClick={() => {
                                promoteAdmin(currentGroup.id, member.id, member.role === 'Admin');
                                setPopupMemberId(null);
                              }}
                              className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-[var(--text-primary)] hover:bg-[var(--accent)]/5 hover:text-[var(--accent)] transition-all cursor-pointer"
                            >
                              {member.role === 'Admin' ? 'Demote to Member' : 'Promote to Admin'}
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`Are you sure you want to remove ${member.name}?`)) {
                                  removeMember(currentGroup.id, member.id);
                                }
                                setPopupMemberId(null);
                              }}
                              className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-red-400 hover:bg-red-500/5 transition-all cursor-pointer"
                            >
                              Remove from Group
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pending Requests for Admin */}
        {isAdmin && isApprovedMember && pendingMembers.length > 0 && (
          <div className="space-y-4 pt-2">
            <h2 className="font-display text-[12px] font-bold text-amber-500 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldAlert size={14} className="text-amber-500" /> Pending Join Requests ({pendingMembers.length})
            </h2>

            <div className="space-y-3">
              {pendingMembers.map((member) => (
                <div key={member.id} className="flex justify-between items-center bg-[var(--bg-card)] border border-[var(--border)] p-3.5 rounded-xl text-xs">
                  <div>
                    <p className="font-bold text-[var(--text-primary)] text-[12.5px]">{member.name}</p>
                    <p className="text-[12px] text-[var(--text-muted)] font-label-sm font-semibold">{member.email}</p>
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={() => approveJoinRequest(currentGroup.id, member.id, true)}
                      className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-black p-2 rounded-lg transition-all cursor-pointer hover:shadow-md"
                      title="Approve"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={() => approveJoinRequest(currentGroup.id, member.id, false)}
                      className="bg-red-500 hover:bg-red-400 text-[var(--text-primary)] p-2 rounded-lg transition-all cursor-pointer"
                      title="Reject"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Penalty Rules Settings (Admin only - auto-applied based on thresholds) */}
        {isAdmin && isApprovedMember && (
          <div className="card p-5 md:p-6 space-y-4 shadow-xl">
            <h2 className="font-display text-[12px] font-bold text-amber-500 uppercase tracking-wider flex items-center gap-1.5 mb-2">
              <AlertTriangle size={14} className="text-amber-500" /> Penalty Rules
            </h2>
            <form onSubmit={async (e) => {
              e.preventDefault();
              const success = await updatePenaltyRules(currentGroup.id, {
                backout_penalty_enabled: penaltyEnabled,
                backout_penalty_type: penaltyType,
                backout_penalty_matches: Number(penaltyMatches),
                backout_hours_threshold: Number(penaltyThreshold),
              });
              if (success) alert('Penalty rules saved!');
            }} className="space-y-4 text-xs">
              <div className="flex items-center justify-between bg-[var(--bg-input)] border border-[var(--border)] p-3.5 rounded-xl">
                <div className="space-y-0.5">
                  <p className="font-bold text-[var(--text-primary)] font-label-sm text-[12px]">Auto-Apply Penalty</p>
                  <p className="text-[12px] text-[var(--text-muted)]">Penalties automatically applied on backout within threshold</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={penaltyEnabled} onChange={(e) => setPenaltyEnabled(e.target.checked)} className="sr-only peer" />
                  <div className="w-10 h-5 bg-[#2a2c2c] rounded-full peer peer-checked:bg-amber-500 peer-checked:after:translate-x-[18px] after:content-[''] after:absolute after:top-0.5 after:start-[3px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
                </label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="font-bold text-[var(--text-secondary)] text-[12px] uppercase tracking-wider font-label-sm">Penalty Type</label>
                  <Select value={penaltyType} onValueChange={(value) => setPenaltyType(value)} className="input">
                    <option value="Match Ban">Match Ban</option>
                    <option value="Mandatory Payment Fine">Fine Spot</option>
                    <option value="Voting Restriction">Voting Restriction</option>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="font-bold text-[var(--text-secondary)] text-[12px] uppercase tracking-wider font-label-sm">Duration (Matches)</label>
                  <input type="number" value={penaltyMatches} onChange={(e) => setPenaltyMatches(e.target.value)} className="input" required min={1} />
                </div>
                <div className="space-y-1.5">
                  <label className="font-bold text-[var(--text-secondary)] text-[12px] uppercase tracking-wider font-label-sm">Backout Threshold (hrs)</label>
                  <input type="number" value={penaltyThreshold} onChange={(e) => setPenaltyThreshold(e.target.value)} className="input" required min={1} />
                </div>
              </div>
              <button type="submit" className="w-full btn btn-primary py-2.5 rounded-xl text-xs font-bold cursor-pointer">Save Penalty Rules</button>
            </form>
            <p className="text-[12px] text-[var(--text-muted)] text-center leading-relaxed pt-1">
              Penalties are automatically applied when a player backs out within the set threshold. Manual penalty creation is no longer available.
            </p>
          </div>
        )}

        {/* Custom Penalty Rules (Admin only) */}
        {isAdmin && isApprovedMember && (
          <div className="card p-5 md:p-6 space-y-4 shadow-xl">
            <div className="flex justify-between items-center">
              <h2 className="font-display text-[12px] font-bold text-amber-500 uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle size={14} className="text-amber-500" /> Custom Rules
              </h2>
              <button
                onClick={() => {
                  setShowRuleForm(!showRuleForm);
                  setEditingRuleId(null);
                  setRuleTrigger('no_show');
                  setRulePenaltyType('Match Ban');
                  setRulePenaltyValue('1');
                  setRuleFeeMultiplier('1.0');
                  setRuleDescription('');
                }}
                className="text-[12px] bg-amber-500/5 hover:bg-amber-500/10 text-amber-500 border border-amber-500/15 px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1 cursor-pointer font-label-sm uppercase tracking-wider"
              >
                <Plus size={12} /> New Rule
              </button>
            </div>

            {/* Create/Edit Rule Form */}
            {showRuleForm && (
              <form onSubmit={async (e) => {
                e.preventDefault();
                const ruleData = {
                  trigger_event: ruleTrigger,
                  penalty_type: rulePenaltyType,
                  penalty_value: Number(rulePenaltyValue),
                  fee_multiplier: Number(ruleFeeMultiplier),
                  description: ruleDescription,
                };
                let success;
                if (editingRuleId) {
                  success = await updatePenaltyRule(currentGroup.id, editingRuleId, ruleData);
                } else {
                  success = await createPenaltyRule(currentGroup.id, ruleData);
                }
                if (success) {
                  setShowRuleForm(false);
                  setEditingRuleId(null);
                  const rules = await fetchPenaltyRules(currentGroup.id);
                  setPenaltyRulesList(rules);
                }
              }} className="bg-[var(--bg-input)] border border-[var(--border)] p-5 rounded-xl space-y-4 text-xs shadow-inner">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="font-bold text-[var(--text-secondary)] text-[12px] uppercase tracking-wider font-label-sm">Trigger Event</label>
                    <Select value={ruleTrigger} onValueChange={(value) => setRuleTrigger(value)} className="input">
                      <option value="no_show">No-Show (confirmed but did not attend)</option>
                      <option value="backout_no_sub">Backout without substitute</option>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-bold text-[var(--text-secondary)] text-[12px] uppercase tracking-wider font-label-sm">Penalty Type</label>
                    <Select value={rulePenaltyType} onValueChange={(value) => setRulePenaltyType(value)} className="input">
                      <option value="Match Ban">Match Ban</option>
                      <option value="Mandatory Payment Fine">Fine Spot</option>
                      <option value="Voting Restriction">Voting Restriction</option>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-bold text-[var(--text-secondary)] text-[12px] uppercase tracking-wider font-label-sm">Duration (Matches) / Amount</label>
                    <input type="number" value={rulePenaltyValue} onChange={(e) => setRulePenaltyValue(e.target.value)} className="input" min={1} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-bold text-[var(--text-secondary)] text-[12px] uppercase tracking-wider font-label-sm">Fee Multiplier (x)</label>
                    <input type="number" step="0.1" value={ruleFeeMultiplier} onChange={(e) => setRuleFeeMultiplier(e.target.value)} className="input" min={0} />
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="font-bold text-[var(--text-secondary)] text-[12px] uppercase tracking-wider font-label-sm">Description</label>
                    <input type="text" value={ruleDescription} onChange={(e) => setRuleDescription(e.target.value)} placeholder="e.g. Double fee for no-shows" className="input" />
                  </div>
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={() => { setShowRuleForm(false); setEditingRuleId(null); }} className="flex-1 btn btn-ghost py-2 rounded-lg text-xs cursor-pointer">Cancel</button>
                  <button type="submit" className="flex-1 btn btn-primary py-2 rounded-lg text-xs font-bold cursor-pointer">{editingRuleId ? 'Update' : 'Create'}</button>
                </div>
              </form>
            )}

            {/* Rules List */}
            <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
              {penaltyRulesList.length === 0 ? (
                <p className="text-[12px] text-[var(--text-muted)] text-center py-4 font-medium">No custom rules yet. Add rules for no-shows, backouts, etc.</p>
              ) : (
                penaltyRulesList.map((rule) => (
                  <div key={rule.id} className="flex justify-between items-center bg-[var(--bg-input)] border border-[var(--border)] p-3 rounded-xl text-xs hover:border-amber-500/20 transition-all">
                    <div className="space-y-0.5 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-[var(--text-primary)] capitalize">{rule.trigger_event.replace('_', ' ')}</p>
                        <span className={`text-[12px] px-1.5 py-0.5 rounded font-label-sm font-bold ${rule.is_active ? 'bg-[var(--accent)]/10 text-[var(--accent)]' : 'bg-[var(--text-muted)]/10 text-[var(--text-muted)]'}`}>
                          {rule.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <p className="text-[12px] text-amber-500 font-bold font-label-sm uppercase">{rule.penalty_type} × {rule.penalty_value}</p>
                      {rule.fee_multiplier !== 1.0 && <p className="text-[12px] text-[var(--text-muted)] font-label-sm">Fee Multiplier: {rule.fee_multiplier}x</p>}
                      {rule.description && <p className="text-[12px] text-[var(--text-secondary)] italic">{rule.description}</p>}
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => {
                        setEditingRuleId(rule.id);
                        setRuleTrigger(rule.trigger_event);
                        setRulePenaltyType(rule.penalty_type);
                        setRulePenaltyValue(String(rule.penalty_value));
                        setRuleFeeMultiplier(String(rule.fee_multiplier));
                        setRuleDescription(rule.description || '');
                        setShowRuleForm(true);
                      }} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-2 hover:bg-black/50 border border-transparent hover:border-[var(--border)] rounded-xl transition-all cursor-pointer" title="Edit">
                        <Pencil size={13} />
                      </button>
                      <button onClick={async () => {
                        if (confirm('Delete this rule?')) {
                          await deletePenaltyRule(currentGroup.id, rule.id);
                          const rules = await fetchPenaltyRules(currentGroup.id);
                          setPenaltyRulesList(rules);
                        }
                      }} className="text-red-400 hover:text-red-300 p-2 hover:bg-black/50 border border-transparent hover:border-[var(--border)] rounded-xl transition-all cursor-pointer" title="Delete">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // List View Screen
  return (
    <div className="space-y-6 pb-12">
      {/* Groups Header */}
      <div className="flex justify-between items-center">
        <div>
          <span className="text-[12px] font-bold uppercase tracking-wider text-[var(--accent)] bg-[var(--accent)]/5 px-2.5 py-1 rounded-md border border-[var(--accent)]/10 font-label-sm">Community</span>
          <h1 className="text-2xl font-display font-extrabold mt-2 text-[var(--text-primary)]">Groups</h1>
        </div>

        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="btn btn-primary p-3 rounded-xl shadow-lg cursor-pointer hover:scale-102 transition-all"
          title="Create Group"
        >
          <Plus size={18} />
        </button>
      </div>

      {/* Group Creation Form Collapsible */}
      {showCreateForm && (
        <form onSubmit={handleCreateGroupSubmit} className="card p-6 md:p-8 space-y-5 shadow-2xl">
          <h3 className="font-display text-sm text-[var(--accent)] font-extrabold uppercase tracking-wider flex items-center gap-2">
            <span className="w-1.5 h-4.5 bg-[var(--accent)] rounded-full"></span>
            Create New Group
          </h3>
          
          <div className="space-y-4 text-xs">
            <div className="space-y-1.5">
              <label className="font-bold text-[var(--text-secondary)] text-[12px] uppercase tracking-wider font-label-sm">Group Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Champions FC"
                className="input text-xs py-3 rounded-xl bg-[var(--bg-input)] border-[var(--border)] focus:border-[var(--accent)] placeholder-[var(--text-muted)]"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-[var(--text-secondary)] text-[12px] uppercase tracking-wider font-label-sm">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Weekly match rules, venue details..."
                className="input"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="font-bold text-[var(--text-secondary)] text-[12px] uppercase tracking-wider font-label-sm">Sport</label>
                <Select
                  value={sportType}
                  onValueChange={(value) => setSportType(value)}
                  className="input"
                >
                  <option value="Football">Football</option>
                  <option value="Cricket">Cricket</option>
                  <option value="Badminton">Badminton</option>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-[var(--text-secondary)] text-[12px] uppercase tracking-wider font-label-sm">Visibility</label>
                <Select
                  value={visibility}
                  onValueChange={(value) => setVisibility(value)}
                  className="input"
                >
                  <option value="Public">Public (Searchable)</option>
                  <option value="Private">Private (Invite only)</option>
                </Select>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-3">
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="flex-1 btn btn-ghost py-2.5 rounded-xl text-xs cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 btn btn-primary py-2.5 rounded-xl text-xs font-bold cursor-pointer"
            >
              Create
            </button>
          </div>
        </form>
      )}

      {/* Search Bar */}
      <div className="relative">
        <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-[var(--text-muted)]">
          <Search size={16} />
        </span>
        <input
          type="text"
          placeholder="Search groups..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="input"
        />
      </div>

      {/* Groups List Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {loading && (
          <div className="col-span-full flex justify-center items-center py-16">
            <span className="h-7 w-7 border-2 border-[var(--accent)]/20 border-t-[var(--accent)] rounded-full animate-spin"></span>
          </div>
        )}

        {!loading && filteredGroups.length === 0 && (
          <p className="col-span-full text-xs text-[var(--text-muted)] py-12 text-center font-medium">No turf groups found.</p>
        )}

        {!loading && filteredGroups.map((g) => (
          <div key={g.id} className="card p-5 flex justify-between items-center hover:border-[var(--accent)]/30 hover:shadow-lg transition-all group">
            <div className="space-y-0.5">
              <h3 className="font-display font-extrabold text-sm text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors line-clamp-1">{g.name}</h3>
              <p className="text-[12px] text-[var(--text-muted)] font-label-sm font-semibold uppercase tracking-wider">{g.sport_type} • {g.visibility}</p>
            </div>
            
            <div className="flex items-center gap-3">
              {!g.is_member && g.membership_status === 'Pending' && (
                <span className="text-[12px] font-bold bg-amber-500/5 border border-amber-500/10 text-amber-500 px-2.5 py-1 rounded font-label-sm uppercase tracking-wider">
                  Pending
                </span>
              )}

              <Link href={`/groups?id=${g.id}`} className="block">
                <div className="h-9 w-9 rounded-full border border-[var(--border)] bg-[var(--bg-input)] flex items-center justify-center hover:border-[var(--accent)]/40 hover:bg-[var(--accent)]/5 transition-all cursor-pointer">
                  <span className="text-[var(--accent)] font-display font-bold text-sm">&gt;</span>
                </div>
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function GroupsPage() {
  return (
    <Suspense fallback={<div className="text-center py-12 text-[var(--text-muted)] font-medium">Loading Groups...</div>}>
      <GroupsContent />
    </Suspense>
  );
}


