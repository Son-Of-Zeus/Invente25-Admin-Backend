// src/pages/Attendance.jsx
import React, { useCallback, useRef, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import QRScanner from '../components/QRScanner';
import { 
  UserGroupIcon, 
  CheckCircleIcon, 
  XCircleIcon,
  ExclamationTriangleIcon,
  CalendarIcon,
  UserIcon,
  PhoneIcon,
  AcademicCapIcon,
  ClipboardDocumentListIcon,
  QrCodeIcon,
  MagnifyingGlassIcon,
  ArrowUturnLeftIcon
} from '@heroicons/react/24/outline';

/**
 * normalizeDecoded: extracts last path segment from URLs, trims quotes/whitespace.
 */
function normalizeDecoded(raw) {
  if (!raw || typeof raw !== 'string') return raw;
  let s = raw.trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  try {
    const u = new URL(s);
    const parts = (u.pathname || '').split('/').filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1];
    return s;
  } catch (e) {
    // not a URL
  }
  if (s.includes('/')) {
    const parts = s.split('/').filter(Boolean);
    if (parts.length > 0) s = parts[parts.length - 1];
  }
  return s;
}

// Helper function to detect pass type from passId
function detectPassType(passId) {
  if (passId.endsWith('$t') || passId.endsWith('$T')) return 'technical';
  if (passId.endsWith('$n') || passId.endsWith('$N')) return 'non-technical';
  if (passId.endsWith('$w') || passId.endsWith('$W')) return 'workshop';
  if (passId.endsWith('$h') || passId.endsWith('$H')) return 'hackathon';
  return 'technical'; // Default for backward compatibility
}

export default function AttendancePage() {
  const { authAxios, user } = useAuth();
  const [searchParams] = useSearchParams();
  
  // State Management
  const [passId, setPassId] = useState('');
  const [searchedEmail, setSearchedEmail] = useState('');
  const [userPasses, setUserPasses] = useState([]); // For email search results
  const [selectedPass, setSelectedPass] = useState(null); // For managing a single pass
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(false);
  const [marking, setMarking] = useState(false);

  // to ignore duplicate quick scans
  const lastScannedRef = useRef({ id: null, ts: 0 });

  const resetState = (keepEmail = false) => {
    setPassId('');
    setUserPasses([]);
    setSelectedPass(null);
    setMsg(null);
    if (!keepEmail) {
      setSearchedEmail('');
    }
  };

  const loadPassById = useCallback(async (id) => {
    if (!id) return;
    
    // Debounce to prevent rapid re-scans
    const now = Date.now();
    if (lastScannedRef.current.id === id && (now - lastScannedRef.current.ts) < 1000) {
      return;
    }
    lastScannedRef.current = { id, ts: now };

    resetState();
    setLoading(true);
    try {
      const resp = await authAxios.get(`/scan/${id}`);
      
      let visibleSlots = resp.data.slots;
      // *** THIS IS THE CORRECTED LOGIC ***
      // Apply original client-side filtering for technical passes
      if (resp.data.passType === 'technical') {
        const allSlots = resp.data.slots || [];
        visibleSlots = allSlots.filter(s => {
          if (!user) return false;
          // Super Admins and Dept Admins can see all slots for a technical pass
          if (user.role === 'super_admin' || user.role === 'dept_admin') return true;
          // Event Admins can only see slots belonging to their department
          if (user.role === 'event_admin') {
            return s.department_id === user.department_id;
          }
          return false;
        });
      }

      const passData = {
        passType: resp.data.passType,
        pass: resp.data.pass,
        slots: visibleSlots, // Use the potentially filtered slots
        event: resp.data.event,
        teamMembers: resp.data.teamMembers || []
      };
      setSelectedPass(passData);

    } catch (err) {
      setMsg(err?.response?.data?.error || String(err));
    } finally {
      setLoading(false);
    }
  }, [authAxios, user]); // Added `user` to dependency array

  const doEmailSearch = async () => {
    if (!searchedEmail.trim()) return;
    resetState(true); // Keep the email in the input
    setLoading(true);
    try {
      const resp = await authAxios.get(`/scan/by-email/${encodeURIComponent(searchedEmail)}`);
      setUserPasses(resp.data.passes || []);
      if (resp.data.passes.length === 0) {
        setMsg('No passes found for this email address.');
      }
    } catch (err) {
      setMsg(err?.response?.data?.error || String(err));
    } finally {
      setLoading(false);
    }
  };
  
  // Handle passId from URL parameter (e.g., redirected from Scan page)
  useEffect(() => {
    const urlPassId = searchParams.get('passId');
    if (urlPassId) {
      setPassId(urlPassId);
      loadPassById(urlPassId);
    }
  }, [searchParams, loadPassById]);

  const onQrResult = useCallback((decodedText) => {
    if (!decodedText) return;
    const normalized = normalizeDecoded(decodedText);
    setPassId(normalized);
    loadPassById(normalized);
  }, [loadPassById]);

  const markAtt = async (slot_no = null) => {
    if (!selectedPass || !selectedPass.pass) {
      setMsg('No pass selected');
      return;
    }
    setMsg(null);
    setMarking(true);
    const identifier = selectedPass.pass.pass_id || selectedPass.pass.team_id;
    try {
      const payload = slot_no ? { slot_no } : {};
      await authAxios.post(`/scan/${identifier}/attend`, payload);
      // Reload the pass to show updated status
      await loadPassById(identifier);
    } catch (err) {
      setMsg(err?.response?.data?.error || String(err));
    } finally {
      setMarking(false);
    }
  };

  const getPassTypeColor = (type) => {
    switch (type) {
      case 'technical': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'non-technical': return 'bg-green-100 text-green-800 border-green-200';
      case 'workshop': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'hackathon': return 'bg-orange-100 text-orange-800 border-orange-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const currentPass = selectedPass?.pass;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircleIcon className="h-8 w-8 text-green-600" />
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Mark Attendance</h1>
          </div>
          <p className="text-gray-600">Scan passes, enter IDs, or search by email to mark attendance.</p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Left Column - Scanner & Search */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Find Participant</h2>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Search by Email</label>
                <div className="flex gap-3">
                  <input value={searchedEmail} onChange={e => setSearchedEmail(e.target.value)} placeholder="participant@email.com" type="email"
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500" />
                  <button onClick={doEmailSearch} disabled={loading || !searchedEmail.trim()}
                    className="px-6 py-3 bg-gray-700 hover:bg-gray-800 disabled:bg-gray-400 text-white rounded-lg font-medium">
                    {loading ? '...' : <MagnifyingGlassIcon className="h-5 w-5" />}
                  </button>
                </div>
              </div>
              <div className="relative my-4"><div className="absolute inset-0 flex items-center"><span className="w-full border-t"></span></div><div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-gray-500">Or</span></div></div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Enter Pass ID</label>
                <div className="flex gap-3">
                  <input value={passId} onChange={e => setPassId(e.target.value)} placeholder="Enter pass ID here..."
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500" />
                  <button onClick={() => loadPassById(normalizeDecoded(passId))} disabled={loading || !passId.trim()}
                    className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg font-medium">
                    {loading ? 'Loading...' : 'Load'}
                  </button>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Scan QR Code</h2>
              <QRScanner onResult={onQrResult} stopOnResult={true} />
            </div>
          </div>

          {/* Right Column - Results */}
          <div className="space-y-6">
            {msg && <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-start gap-3"><ExclamationTriangleIcon className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" /><p className="text-red-800">{msg}</p></div>}
            {loading && <div className="text-center p-8 bg-white rounded-xl border"><p>Loading...</p></div>}

            {/* View 1: List of passes from email search */}
            {!loading && userPasses.length > 0 && !selectedPass && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="font-semibold mb-4">Found {userPasses.length} pass(es) for <span className="text-green-600">{searchedEmail}</span></h3>
                <div className="space-y-3">
                  {userPasses.map((p, index) => (
                    <div key={index} className="bg-gray-50 border rounded-lg p-4 flex justify-between items-center">
                      <div>
                        <p className="font-semibold break-all">{p.pass.pass_id || p.pass.team_name}</p>
                        <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${getPassTypeColor(p.passType)}`}>
                          {p.passType}
                        </span>
                      </div>
                      <button onClick={() => { setSelectedPass(p); setUserPasses([]) }} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium">
                        Select
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* View 2: Detailed view for a selected pass */}
            {!loading && selectedPass && currentPass && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 break-all">{currentPass.pass_id || currentPass.team_name}</h3>
                      <p className="text-gray-600 mb-2">Owner: {currentPass.user_email || currentPass.leader_email || '—'}</p>
                      <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getPassTypeColor(selectedPass.passType)}`}>
                        {selectedPass.passType?.charAt(0).toUpperCase() + selectedPass.passType?.slice(1)} Pass
                      </div>
                    </div>
                    <button onClick={() => resetState()} className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
                      <ArrowUturnLeftIcon className="h-4 w-4" /> New Search
                    </button>
                  </div>
                </div>

                {/* Technical Pass Content */}
                {selectedPass.passType === 'technical' && (
                    <div className="p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <CalendarIcon className="h-5 w-5 text-gray-600" />
                            <h4 className="text-lg font-semibold text-gray-900">Event Slots</h4>
                            <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs font-medium">
                                {selectedPass.slots.length}
                            </span>
                        </div>

                        {selectedPass.slots.length === 0 ? (
                            <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                                <CalendarIcon className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                                <p className="text-gray-600 font-medium">No slots visible</p>
                                <p className="text-gray-500 text-sm">No slots for this pass or none belong to your department</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {selectedPass.slots.map(s => (
                                <div key={s.slot_no} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="bg-white px-2 py-1 rounded text-sm font-semibold text-gray-700 border">
                                                    Slot {s.slot_no}
                                                </span>
                                                <span className="text-sm font-medium text-gray-900">
                                                    {s.event_name || `Event ${s.event_id}`}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-4 text-xs text-gray-600 mb-3">
                                                <div>
                                                    Assigned: {s.created_at ? new Date(s.created_at).toLocaleString() : '—'}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {s.attended ? (
                                                    <div className="flex items-center gap-1 text-green-700 bg-green-100 px-2 py-1 rounded-full text-xs font-medium">
                                                        <CheckCircleIcon className="h-4 w-4" /> Present
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-1 text-gray-600 bg-gray-100 px-2 py-1 rounded-full text-xs font-medium">
                                                        <XCircleIcon className="h-4 w-4" /> Not Marked
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {!s.attended && (
                                            <button
                                            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:bg-gray-400"
                                            onClick={() => markAtt(s.slot_no)}
                                            disabled={marking}
                                            >
                                                <CheckCircleIcon className="h-4 w-4" />
                                                {marking ? 'Marking...' : 'Mark Present'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
                
                {/* Non-technical/Workshop Event Content */}
                {(selectedPass.passType === 'non-technical' || selectedPass.passType === 'workshop') && selectedPass.event && (
                  <div className="p-6">
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <div className="flex justify-between items-start">
                            <div className="flex-1">
                                <h5 className="font-semibold text-gray-900 mb-2">{selectedPass.event.event_name}</h5>
                                <div className="space-y-1 text-sm text-gray-600 mb-3">
                                    <div>Type: {selectedPass.event.event_type}</div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {selectedPass.event.attended ? (
                                    <div className="flex items-center gap-1 text-green-700 bg-green-100 px-2 py-1 rounded-full text-xs font-medium">
                                        <CheckCircleIcon className="h-4 w-4" /> Present
                                    </div>
                                    ) : (
                                    <div className="flex items-center gap-1 text-gray-600 bg-gray-100 px-2 py-1 rounded-full text-xs font-medium">
                                        <XCircleIcon className="h-4 w-4" /> Not Marked
                                    </div>
                                    )}
                                </div>
                            </div>
                            {!selectedPass.event.attended && (
                            <button
                                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:bg-gray-400"
                                onClick={() => markAtt()}
                                disabled={marking}
                            >
                                <CheckCircleIcon className="h-4 w-4" />
                                {marking ? 'Marking...' : 'Mark Present'}
                            </button>
                            )}
                        </div>
                    </div>
                    
                    {/* Team Members section for non-technical events */}
                    {selectedPass.teamMembers && selectedPass.teamMembers.length > 0 && (
                      <div className="mt-6">
                        <div className="flex items-center gap-2 mb-4">
                            <UserIcon className="h-5 w-5 text-gray-600" />
                            <h5 className="font-medium text-gray-900">Team Members</h5>
                            <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs font-medium">
                                {selectedPass.teamMembers.length}
                            </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {selectedPass.teamMembers.map((member, index) => (
                            <div key={index} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                                <div className="font-medium text-gray-900 mb-1">{member.full_name}</div>
                                <div className="space-y-1 text-xs text-gray-600">
                                <div className="flex items-center gap-1">
                                    <UserIcon className="h-3 w-3" />
                                    {member.email}
                                </div>
                                {member.institution && (
                                    <div className="flex items-center gap-1">
                                    <AcademicCapIcon className="h-3 w-3" />
                                    {member.institution}
                                    </div>
                                )}
                                {member.phone_number && (
                                    <div className="flex items-center gap-1">
                                    <PhoneIcon className="h-3 w-3" />
                                    {member.phone_number}
                                    </div>
                                )}
                                </div>
                            </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Hackathon Content */}
                {selectedPass.passType === 'hackathon' && (
                  <div className="p-6">
                    <div className="mb-6">
                        <div className="flex items-center gap-2 mb-4">
                            <UserGroupIcon className="h-5 w-5 text-gray-600" />
                            <h4 className="text-lg font-semibold text-gray-900">Team Information</h4>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 mb-4">
                            <div className="flex justify-between items-start">
                                <div className="flex-1">
                                    <h5 className="font-semibold text-gray-900 mb-2">{currentPass.team_name}</h5>
                                    <div className="space-y-1 text-sm text-gray-600 mb-3">
                                        <div>Track: {currentPass.track}</div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {currentPass.attended ? (
                                        <div className="flex items-center gap-1 text-green-700 bg-green-100 px-2 py-1 rounded-full text-xs font-medium">
                                            <CheckCircleIcon className="h-4 w-4" /> Present
                                        </div>
                                        ) : (
                                        <div className="flex items-center gap-1 text-gray-600 bg-gray-100 px-2 py-1 rounded-full text-xs font-medium">
                                            <XCircleIcon className="h-4 w-4" /> Not Marked
                                        </div>
                                        )}
                                    </div>
                                </div>
                                {!currentPass.attended && (
                                <button
                                    className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:bg-gray-400"
                                    onClick={() => markAtt()}
                                    disabled={marking}
                                >
                                    <CheckCircleIcon className="h-4 w-4" />
                                    {marking ? 'Marking...' : 'Mark Present'}
                                </button>
                                )}
                            </div>
                        </div>
                    </div>

                  </div>
                )}
              </div>
            )}

            {/* View 3: Initial/Empty State */}
            {!loading && userPasses.length === 0 && !selectedPass && !msg && (
              <div className="text-center p-8 bg-white rounded-xl border border-gray-200">
                <CheckCircleIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-600 font-medium">No pass loaded</p>
                <p className="text-gray-500 text-sm">Scan a QR code or enter a pass ID to mark attendance.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}