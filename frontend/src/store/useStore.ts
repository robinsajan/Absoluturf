import { apiError } from '../lib/apiError';
import { create } from 'zustand';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL;
if (!API_URL) {
  throw new Error(
    '[AbsoluTurf] NEXT_PUBLIC_API_URL is not set.\n' +
    'Create frontend/.env.local with NEXT_PUBLIC_API_URL=http://127.0.0.1:5000/api'
  );
}

// Set up Axios instance
export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true, // Send cookies
});

// Add token from localStorage to headers if present
if (typeof window !== 'undefined') {
  const token = localStorage.getItem('token');
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }
}

export interface User {
  id: number;
  name: string;
  email: string;
  phone: string;
  profile_image: string | null;
  upi_id?: string | null;
  created_at: string;
}

export interface Group {
  id: number;
  name: string;
  description: string;
  sport_type: string;
  visibility: string;
  image: string | null;
  created_by: number;
  created_at: string;
  is_member?: boolean;
  member_count?: number;
  role?: 'Admin' | 'Member' | null;
  membership_status?: 'Pending' | 'Approved' | 'Rejected' | 'None';
  members?: Member[];
  current_user_role?: 'Admin' | 'Member' | null;
  current_user_status?: string;
  backout_penalty_enabled?: boolean;
  backout_penalty_type?: string;
  backout_penalty_matches?: number;
  backout_hours_threshold?: number;
}

export interface Member extends User {
  role: 'Admin' | 'Member';
  status: string;
  user_id?: number;
}

export interface MatchVote {
  id: number;
  user_id: number;
  name: string;
  vote: string;
  has_paid: boolean;
  paid_amount: number;
  payment_verified: boolean;
  created_at: string;
  _isGuest?: boolean;
  _guestId?: number;
  spoc_name?: string;
}

export interface Substitute {
  id?: number;
  user_id: number;
  name: string;
  queue_position: number;
  promoted: boolean;
  status: string;
  invited_at?: string | null;
}

export interface BackoutResult {
  message: string;
  warning?: string;
  penalty_applied?: boolean;
  substitute_promoted?: boolean;
  has_substitute?: boolean;
  refund_eligible?: boolean;
  must_pay?: boolean;
}

export interface Match {
  id: number;
  group_id: number;
  created_by: number;
  creator_name?: string;
  creator_upi?: string | null;
  turf_name: string;
  location: string;
  match_date: string;
  match_time: string;
  end_time?: string;
  max_players: number;
  cost?: number;
  per_player_cost?: number;
  user_total_cost?: number;
  paid_amount?: number;
  pending_amount?: number;
  confirmed_guests?: { id: number; name: string; created_at: string; added_by_user_id: number; added_by_name: string }[];
  confirmed_guests_count?: number;
  splits?: number;

  auto_booked?: boolean;
  is_active?: boolean;
  is_past?: boolean;
  status: 'Proposed' | 'Voting Open' | 'Minimum Players Reached' | 'Turf Confirmed' | 'Completed' | 'Cancelled';
  created_at: string;
  yes_votes?: number;
  no_votes?: number;
  user_vote?: 'Yes' | 'No' | 'None';
  votes?: MatchVote[];
  substitutes?: Substitute[];
  is_admin?: boolean;
  in_substitute_queue?: boolean;
  substitute_position?: number;
  substitute_status?: string;
  penalties?: Penalty[];
  backed_out_players?: BackedOutPlayer[];
  waiting_list?: {
    type: 'substitute' | 'guest';
    id: number;
    name: string;
    queue_position: number;
    status: string;
    invited_at: string | null;
    added_by_user_id?: number;
    added_by_name?: string;
  }[];
  has_pending_guest_invite?: boolean;
  pending_guest_invite_id?: number | null;
  pending_guest_invite_name?: string | null;
  pending_guest_invited_at?: string | null;

}

export interface Penalty {
  id: number;
  user_id: number;
  group_id: number;
  penalty_type: 'Match Ban' | 'Mandatory Payment Fine' | 'Voting Restriction';
  remaining_matches: number;
  reason: string;
  created_by: number;
  created_at: string;
  user_name?: string;
  group_name?: string;
  creator_name?: string;
}

export interface PenaltyRule {
  id: number;
  group_id: number;
  trigger_event: string;
  penalty_type: string;
  penalty_value: number;
  fee_multiplier: number;
  description: string;
  is_active: boolean;
  created_at: string;
}

interface GuestPlayer {
  id: number;
  match_id: number;
  added_by_user_id: number;
  added_by_name: string;
  name: string;
  status: 'confirmed' | 'waiting';
  spoc_name?: string;
  created_at: string;
}

interface BackedOutPlayer {
  user_id: number;
  name: string;
  reason: string | null;
  backout_at: string | null;
}

interface Notification {
  id: number;
  user_id: number;
  message: string;
  read: boolean;
  created_at: string;
  match_id?: number | null;
  type?: string | null;
}

interface StoreState {
  user: User | null;
  token: string | null;
  groups: Group[];
  currentGroup: Group | null;
  matches: Match[];
  currentMatch: Match | null;
  penalties: Penalty[];
  notifications: Notification[];
  loading: boolean;
  error: string | null;
  sidebarOpen: boolean;
  theme: 'dark' | 'light';
  
  // Auth actions
  login: (email: string, password: string) => Promise<boolean>;
  signup: (name: string, email: string, phone: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  fetchMe: () => Promise<User | null>;
  updateProfile: (profile: string | { name: string; phone: string; upi_id: string }) => Promise<boolean>;
  clearError: () => void;
  
  // Group actions
  fetchGroups: () => Promise<void>;
  fetchGroup: (id: number) => Promise<Group | null>;
  createGroup: (name: string, description: string, sportType: string, visibility: string) => Promise<boolean>;
  joinGroup: (id: number) => Promise<void>;
  approveJoinRequest: (groupId: number, targetUserId: number, approve: boolean) => Promise<void>;
  removeMember: (groupId: number, userId: number) => Promise<void>;
  promoteAdmin: (groupId: number, userId: number, demote?: boolean) => Promise<void>;
  getInviteLink: (groupId: number) => Promise<string | null>;
  joinByInvite: (inviteCode: string) => Promise<{ success: boolean; message: string; groupId?: number }>;
  
  // Match actions
  fetchMatches: (groupId?: number) => Promise<void>;
  fetchMatch: (id: number) => Promise<Match | null>;
  createMatch: (matchData: Partial<Match>) => Promise<boolean>;
  editMatch: (matchId: number, matchData: Partial<Match>) => Promise<boolean>;
  voteMatch: (matchId: number, vote: 'Yes' | 'No') => Promise<void>;
  confirmMatch: (matchId: number) => Promise<void>;
  backoutMatch: (matchId: number, reason: string) => Promise<BackoutResult | null>;
  joinSubstituteQueue: (matchId: number) => Promise<void>;
  leaveSubstituteQueue: (matchId: number) => Promise<void>;
  acceptPromotion: (matchId: number) => Promise<void>;
  declinePromotion: (matchId: number) => Promise<void>;
  acceptGuestPromotion: (matchId: number, guestId: number) => Promise<void>;
  declineGuestPromotion: (matchId: number, guestId: number) => Promise<void>;
  completeMatch: (matchId: number) => Promise<void>;
  cancelMatch: (matchId: number) => Promise<void>;
  verifyPayment: (matchId: number, playerId: number) => Promise<boolean>;
  payMatch: (matchId: number) => Promise<boolean>;
  fetchPenalties: (groupId?: number, userId?: number) => Promise<void>;
  createPenalty: (penaltyData: Partial<Penalty>) => Promise<boolean>;
  editPenalty: (id: number, data: Partial<Penalty>) => Promise<boolean>;
  deletePenalty: (id: number) => Promise<void>;
  updatePenaltyRules: (groupId: number, rules: Partial<Group>) => Promise<boolean>;
  fetchPenaltyRules: (groupId: number) => Promise<PenaltyRule[]>;
  createPenaltyRule: (groupId: number, rule: Partial<PenaltyRule>) => Promise<boolean>;
  updatePenaltyRule: (groupId: number, ruleId: number, rule: Partial<PenaltyRule>) => Promise<boolean>;
  deletePenaltyRule: (groupId: number, ruleId: number) => Promise<boolean>;
  markAttendance: (matchId: number, voteId: number) => Promise<boolean>;

  // Guest actions
  addGuest: (matchId: number, name: string, status: string) => Promise<boolean>;
  fetchGuests: (matchId: number) => Promise<GuestPlayer[]>;
  removeGuest: (matchId: number, guestId: number) => Promise<boolean>;
  updateGuestStatus: (matchId: number, guestId: number, status: string) => Promise<boolean>;
  
  // Notification actions
  fetchNotifications: () => Promise<void>;
  markNotificationsRead: (notificationId?: number) => Promise<void>;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setTheme: (theme: 'dark' | 'light') => void;
}

export const useStore = create<StoreState>((set, get) => ({
  user: null,
  token: null,
  groups: [],
  currentGroup: null,
  matches: [],
  currentMatch: null,
  penalties: [],
  notifications: [],
  loading: false,
  error: null,
  sidebarOpen: false,
  theme: 'dark',

  clearError: () => set({ error: null }),

  // Auth actions
  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const res = await api.post('/auth/login', { email, password });
      const { user, access_token } = res.data;
      localStorage.setItem('token', access_token);
      api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      set({ user, token: access_token, loading: false });
      return true;
    } catch (err: unknown) {
      set({ error: apiError(err, 'Login failed'), loading: false });
      return false;
    }
  },

  signup: async (name, email, phone, password) => {
    set({ loading: true, error: null });
    try {
      const res = await api.post('/auth/signup', { name, email, phone, password });
      const { user, access_token } = res.data;
      localStorage.setItem('token', access_token);
      api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      set({ user, token: access_token, loading: false });
      return true;
    } catch (err: unknown) {
      set({ error: apiError(err, 'Signup failed'), loading: false });
      return false;
    }
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore logout errors
    } finally {
      localStorage.removeItem('token');
      delete api.defaults.headers.common['Authorization'];
      set({ user: null, token: null, groups: [], matches: [], notifications: [], penalties: [] });
    }
  },

  deleteAccount: async () => {
    try {
      await api.delete('/auth/account');
    } catch (err: unknown) {
      set({ error: apiError(err, 'Could not deactivate the account. Please retry.') });
      return;
    }
    localStorage.removeItem('token');
    delete api.defaults.headers.common['Authorization'];
    set({ user: null, token: null, groups: [], currentGroup: null, matches: [], currentMatch: null, notifications: [], penalties: [] });
  },

  fetchMe: async () => {
    if (!localStorage.getItem('token')) return null;
    try {
      const res = await api.get('/auth/me');
      set({ user: res.data });
      return res.data;
    } catch {
      localStorage.removeItem('token');
      delete api.defaults.headers.common['Authorization'];
      set({ user: null, token: null });
      return null;
    }
  },

  updateProfile: async (profile) => {
    try {
      const res = await api.put('/auth/profile', typeof profile === 'string' ? { upi_id: profile } : profile);
      set({ user: res.data.user });
      return true;
    } catch (err: unknown) {
      set({ error: apiError(err, 'Failed to update profile') });
      return false;
    }
  },

  // Group actions
  fetchGroups: async () => {
    set({ loading: true, error: null });
    try {
      const res = await api.get('/groups');
      set({ groups: res.data, loading: false });
    } catch (err: unknown) {
      set({ error: apiError(err, 'Failed to fetch groups'), loading: false });
    }
  },

  fetchGroup: async (id) => {
    set({ loading: true, error: null });
    try {
      const res = await api.get(`/groups/${id}`);
      set({ currentGroup: res.data, loading: false });
      return res.data;
    } catch (err: unknown) {
      set({ error: apiError(err, 'Failed to fetch group'), loading: false });
      return null;
    }
  },

  createGroup: async (name, description, sportType, visibility) => {
    set({ loading: true, error: null });
    try {
      await api.post('/groups', { name, description, sport_type: sportType, visibility });
      set({ loading: false });
      get().fetchGroups();
      return true;
    } catch (err: unknown) {
      set({ error: apiError(err, 'Failed to create group'), loading: false });
      return false;
    }
  },

  joinGroup: async (id) => {
    try {
      await api.post(`/groups/${id}/join-request`);
      get().fetchGroups();
      get().fetchGroup(id);
    } catch (err: unknown) {
      set({ error: apiError(err, 'Failed to request join') });
    }
  },

  approveJoinRequest: async (groupId, targetUserId, approve) => {
    try {
      await api.post(`/groups/${groupId}/approve-member`, { user_id: targetUserId, approve });
      get().fetchGroup(groupId);
    } catch (err: unknown) {
      set({ error: apiError(err, 'Failed to respond to request') });
    }
  },

  removeMember: async (groupId, userId) => {
    try {
      await api.post(`/groups/${groupId}/remove-member`, { user_id: userId });
      get().fetchGroup(groupId);
    } catch (err: unknown) {
      set({ error: apiError(err, 'Failed to remove member') });
    }
  },

  promoteAdmin: async (groupId, userId, demote = false) => {
    try {
      await api.post(`/groups/${groupId}/promote-admin`, { user_id: userId, demote });
      get().fetchGroup(groupId);
    } catch (err: unknown) {
      set({ error: apiError(err, 'Failed to change role') });
    }
  },

  getInviteLink: async (groupId) => {
    try {
      const res = await api.get(`/groups/${groupId}/invite-link`);
      return res.data.invite_code;
    } catch (err: unknown) {
      set({ error: apiError(err, 'Failed to get invite link') });
      return null;
    }
  },

  joinByInvite: async (inviteCode) => {
    try {
      const res = await api.post(`/groups/join-by-invite`, { invite_code: inviteCode });
      return { success: true, message: res.data.message, groupId: res.data.group_id };
    } catch (err: unknown) {
      return { success: false, message: apiError(err, 'Failed to join group via invite') };
    }
  },

  updatePenaltyRules: async (groupId, rules) => {
    set({ loading: true, error: null });
    try {
      await api.put(`/groups/${groupId}/penalty-rules`, rules);
      set({ loading: false });
      get().fetchGroup(groupId);
      return true;
    } catch (err: unknown) {
      set({ error: apiError(err, 'Failed to update penalty rules'), loading: false });
      return false;
    }
  },

  fetchPenaltyRules: async (groupId) => {
    try {
      const res = await api.get(`/groups/${groupId}/penalty-rules/list`);
      set({ loading: false });
      return res.data;
    } catch {
      set({ loading: false });
      return [];
    }
  },

  createPenaltyRule: async (groupId, rule) => {
    set({ loading: true, error: null });
    try {
      await api.post(`/groups/${groupId}/penalty-rules/list`, rule);
      set({ loading: false });
      return true;
    } catch (err: unknown) {
      set({ error: apiError(err, 'Failed to create penalty rule'), loading: false });
      return false;
    }
  },

  updatePenaltyRule: async (groupId, ruleId, rule) => {
    set({ loading: true, error: null });
    try {
      await api.put(`/groups/${groupId}/penalty-rules/${ruleId}`, rule);
      set({ loading: false });
      return true;
    } catch (err: unknown) {
      set({ error: apiError(err, 'Failed to update penalty rule'), loading: false });
      return false;
    }
  },

  deletePenaltyRule: async (groupId, ruleId) => {
    set({ loading: true, error: null });
    try {
      await api.delete(`/groups/${groupId}/penalty-rules/${ruleId}`);
      set({ loading: false });
      return true;
    } catch (err: unknown) {
      set({ error: apiError(err, 'Failed to delete penalty rule'), loading: false });
      return false;
    }
  },

  markAttendance: async (matchId, voteId) => {
    try {
      await api.post(`/matches/${matchId}/attendance`, { vote_id: voteId });
      get().fetchMatch(matchId);
      return true;
    } catch (err: unknown) {
      set({ error: apiError(err, 'Failed to mark attendance') });
      return false;
    }
  },

  // Guest actions
  addGuest: async (matchId, name, status) => {
    try {
      await api.post(`/matches/${matchId}/guests`, { name, status });
      get().fetchMatch(matchId);
      return true;
    } catch (err: unknown) {
      set({ error: apiError(err, 'Failed to add guest') });
      return false;
    }
  },

  fetchGuests: async (matchId) => {
    try {
      const res = await api.get(`/matches/${matchId}/guests`);
      return res.data;
    } catch (err: unknown) {
      set({ error: apiError(err, 'Failed to fetch guests') });
      return [];
    }
  },

  removeGuest: async (matchId, guestId) => {
    try {
      await api.delete(`/matches/${matchId}/guests/${guestId}`);
      get().fetchMatch(matchId);
      return true;
    } catch (err: unknown) {
      set({ error: apiError(err, 'Failed to remove guest') });
      return false;
    }
  },

  updateGuestStatus: async (matchId, guestId, status) => {
    try {
      await api.patch(`/matches/${matchId}/guests/${guestId}`, { status });
      get().fetchMatch(matchId);
      return true;
    } catch (err: unknown) {
      set({ error: apiError(err, 'Failed to update guest status') });
      return false;
    }
  },

  // Match actions
  fetchMatches: async (groupId) => {
    set({ loading: true, error: null });
    try {
      const url = groupId ? `/matches?group_id=${groupId}` : '/matches';
      const res = await api.get(url);
      set({ matches: res.data, loading: false });
    } catch (err: unknown) {
      set({ error: apiError(err, 'Failed to fetch matches'), loading: false });
    }
  },

  fetchMatch: async (id) => {
    set({ loading: true, error: null });
    try {
      const res = await api.get(`/matches/${id}`);
      set({ currentMatch: res.data, loading: false });
      return res.data;
    } catch (err: unknown) {
      set({ error: apiError(err, 'Failed to fetch match'), loading: false });
      return null;
    }
  },

  createMatch: async (matchData) => {
    set({ loading: true, error: null });
    try {
      await api.post('/matches', matchData);
      set({ loading: false });
      get().fetchMatches(matchData.group_id);
      return true;
    } catch (err: unknown) {
      set({ error: apiError(err, 'Failed to create match'), loading: false });
      return false;
    }
  },

  editMatch: async (matchId, matchData) => {
    set({ loading: true, error: null });
    try {
      await api.put(`/matches/${matchId}`, matchData);
      set({ loading: false });
      get().fetchMatch(matchId);
      const match = get().currentMatch;
      if (match) {
        get().fetchMatches(match.group_id);
      } else {
        get().fetchMatches();
      }
      return true;
    } catch (err: unknown) {
      set({ error: apiError(err, 'Failed to update match'), loading: false });
      return false;
    }
  },

  voteMatch: async (matchId, vote) => {
    try {
      await api.post(`/matches/${matchId}/vote`, { vote });
      const updated = await get().fetchMatch(matchId);
      if (updated) {
        // Update the match in the matches list immediately
        set((state) => ({
          matches: state.matches.map((m) =>
            m.id === matchId ? { ...m, user_vote: vote } : m
          ),
        }));
        get().fetchMatches(updated.group_id);
      } else {
        get().fetchMatches();
      }
    } catch (err: unknown) {
      set({ error: apiError(err, 'Failed to vote') });
    }
  },

  confirmMatch: async (matchId) => {
    try {
      await api.post(`/matches/${matchId}/confirm`);
      get().fetchMatch(matchId);
    } catch (err: unknown) {
      set({ error: apiError(err, 'Failed to confirm match') });
    }
  },

  backoutMatch: async (matchId, reason) => {
    try {
      const res = await api.post(`/matches/${matchId}/backout`, { reason });
      get().fetchMatch(matchId);
      return res.data;
    } catch (err: unknown) {
      set({ error: apiError(err, 'Failed to back out') });
    }
  },

  joinSubstituteQueue: async (matchId) => {
    try {
      await api.post(`/matches/${matchId}/substitute`);
      const updated = await get().fetchMatch(matchId);
      if (updated) {
        set((state) => ({
          matches: state.matches.map((m) =>
            m.id === matchId ? updated : m
          ),
        }));
      }
    } catch (err: unknown) {
      set({ error: apiError(err, 'Failed to join substitute queue') });
    }
  },

  leaveSubstituteQueue: async (matchId) => {
    try {
      await api.delete(`/matches/${matchId}/substitute/leave`);
      const updated = await get().fetchMatch(matchId);
      if (updated) {
        set((state) => ({
          matches: state.matches.map((m) =>
            m.id === matchId ? updated : m
          ),
        }));
      }
    } catch (err: unknown) {
      set({ error: apiError(err, 'Failed to leave waiting list') });
    }
  },

  acceptPromotion: async (matchId) => {
    try {
      await api.post(`/matches/${matchId}/substitute/accept`);
      const updated = await get().fetchMatch(matchId);
      if (updated) {
        set((state) => ({
          matches: state.matches.map((m) =>
            m.id === matchId ? updated : m
          ),
        }));
      }
    } catch (err: unknown) {
      set({ error: apiError(err, 'Failed to accept promotion') });
    }
  },

  declinePromotion: async (matchId) => {
    try {
      await api.post(`/matches/${matchId}/substitute/decline`);
      const updated = await get().fetchMatch(matchId);
      if (updated) {
        set((state) => ({
          matches: state.matches.map((m) =>
            m.id === matchId ? updated : m
          ),
        }));
      }
    } catch (err: unknown) {
      set({ error: apiError(err, 'Failed to decline promotion') });
    }
  },

  acceptGuestPromotion: async (matchId, guestId) => {
    try {
      await api.post(`/matches/${matchId}/guests/${guestId}/accept`);
      const updated = await get().fetchMatch(matchId);
      if (updated) {
        set((state) => ({
          matches: state.matches.map((m) =>
            m.id === matchId ? updated : m
          ),
        }));
      }
    } catch (err: unknown) {
      set({ error: apiError(err, 'Failed to accept guest promotion') });
    }
  },

  declineGuestPromotion: async (matchId, guestId) => {
    try {
      await api.post(`/matches/${matchId}/guests/${guestId}/decline`);
      const updated = await get().fetchMatch(matchId);
      if (updated) {
        set((state) => ({
          matches: state.matches.map((m) =>
            m.id === matchId ? updated : m
          ),
        }));
      }
    } catch (err: unknown) {
      set({ error: apiError(err, 'Failed to decline guest promotion') });
    }
  },

  completeMatch: async (matchId) => {
    try {
      await api.post(`/matches/${matchId}/complete`);
      get().fetchMatch(matchId);
    } catch (err: unknown) {
      set({ error: apiError(err, 'Failed to complete match') });
    }
  },

  cancelMatch: async (matchId) => {
    try {
      await api.post(`/matches/${matchId}/cancel`);
      get().fetchMatch(matchId);
    } catch (err: unknown) {
      set({ error: apiError(err, 'Failed to cancel match') });
    }
  },

  verifyPayment: async (matchId, playerId) => {
    try {
      await api.post(`/matches/${matchId}/verify_payment/${playerId}`);
      get().fetchMatch(matchId);
      return true;
    } catch (err: unknown) {
      set({ error: apiError(err, 'Failed to verify payment') });
      return false;
    }
  },

  payMatch: async (matchId) => {
    try {
      await api.post(`/matches/${matchId}/pay`);
      get().fetchMatch(matchId);
      return true;
    } catch (err: unknown) {
      set({ error: apiError(err, 'Failed to record payment') });
      return false;
    }
  },

  // Penalty actions
  fetchPenalties: async (groupId, userId) => {
    set({ loading: true, error: null });
    try {
      let url = '/penalties';
      const params = [];
      if (groupId) params.push(`group_id=${groupId}`);
      if (userId) params.push(`user_id=${userId}`);
      if (params.length > 0) {
        url += '?' + params.join('&');
      }
      const res = await api.get(url);
      set({ penalties: res.data, loading: false });
    } catch (err: unknown) {
      set({ error: apiError(err, 'Failed to fetch penalties'), loading: false });
    }
  },

  createPenalty: async (penaltyData) => {
    set({ loading: true, error: null });
    try {
      await api.post('/penalties', penaltyData);
      set({ loading: false });
      if (penaltyData.group_id) {
        get().fetchPenalties(penaltyData.group_id);
      }
      return true;
    } catch (err: unknown) {
      set({ error: apiError(err, 'Failed to apply penalty'), loading: false });
      return false;
    }
  },

  editPenalty: async (id, data) => {
    set({ loading: true, error: null });
    try {
      await api.put(`/penalties/${id}`, data);
      set({ loading: false });
      const penalty = get().penalties.find(p => p.id === id);
      if (penalty) {
        get().fetchPenalties(penalty.group_id);
      }
      return true;
    } catch (err: unknown) {
      set({ error: apiError(err, 'Failed to update penalty'), loading: false });
      return false;
    }
  },

  deletePenalty: async (id) => {
    try {
      const penalty = get().penalties.find(p => p.id === id);
      await api.delete(`/penalties/${id}`);
      if (penalty) {
        get().fetchPenalties(penalty.group_id);
      } else {
        get().fetchPenalties();
      }
    } catch (err: unknown) {
      set({ error: apiError(err, 'Failed to remove penalty') });
    }
  },

  // Notification actions
  fetchNotifications: async () => {
    try {
      const res = await api.get('/notifications');
      set({ notifications: res.data });
    } catch (err: unknown) {
      console.error(err);
    }
  },

  markNotificationsRead: async (notificationId) => {
    try {
      await api.post('/notifications/read', { notification_id: notificationId });
      get().fetchNotifications();
    } catch (err: unknown) {
      console.error(err);
    }
  },

  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setTheme: (theme) => {
    localStorage.setItem('theme', theme);
    set({ theme });
  },
}));


