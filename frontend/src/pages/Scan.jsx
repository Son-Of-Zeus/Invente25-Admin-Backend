// src/pages/Scan.jsx
import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import AssignSlotForm from '../components/AssignSlotForm';
import QRScanner from '../components/QRScanner';
import { 
  QrCodeIcon, UserIcon, CalendarIcon, ExclamationTriangleIcon,
  CheckCircleIcon, XCircleIcon, TrashIcon, ClipboardDocumentListIcon,
  MagnifyingGlassIcon, ArrowUturnLeftIcon
} from '@heroicons/react/24/outline';

/* normalizeDecoded and detectPassType helpers remain the same */
function normalizeDecoded(raw) {
    if (!raw || typeof raw !== 'string') return raw;
    let s = raw.trim();
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
      s = s.slice(1, -1).trim();
    }
    try {
      const u = new URL(s);
      const parts = u.pathname.split('/').filter(Boolean);
      if (parts.length > 0) return parts[parts.length - 1];
      return s;
    } catch (e) {}
    if (s.includes('/')) {
      const parts = s.split('/').filter(Boolean);
      if (parts.length > 0) s = parts[parts.length - 1];
    }
    return s;
  }
  
function detectPassType(passId) {
    if (passId.endsWith('$t') || passId.endsWith('$T')) return 'technical';
    if (passId.endsWith('$n') || passId.endsWith('$N')) return 'non-technical';
    if (passId.endsWith('$w') || passId.endsWith('$W')) return 'workshop';
    if (passId.endsWith('$h') || passId.endsWith('$H')) return 'hackathon';
    return 'technical'; // Default for backward compatibility
}

export default function ScanPage() {
  const { authAxios, user } = useAuth();
  const navigate = useNavigate();
  
  // OLD STATE
  // const [pass, setPass] = useState(null);
  // const [slots, setSlots] = useState([]);

  // NEW STATE MANAGEMENT
  const [passId, setPassId] = useState('');
  const [searchedEmail, setSearchedEmail] = useState('');
  const [userPasses, setUserPasses] = useState([]); // For email search results
  const [selectedPass, setSelectedPass] = useState(null); // For managing a single pass
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  const resetState = () => {
    setPassId('');
    setUserPasses([]);
    setSelectedPass(null);
    setMsg(null);
  };
  
  // Scan by Pass ID
  const doScan = useCallback(async (id) => {
    if (!id) return;
    resetState();
    setLoading(true);
    try {
      const resp = await authAxios.get(`/scan/${id}`);
      if (!resp || !resp.data) throw new Error('No data returned');

      if (resp.data.passType !== 'technical') {
        navigate(`/attendance?passId=${encodeURIComponent(id)}`);
        return;
      }
      
      setSelectedPass({
        passType: 'technical',
        pass: resp.data.pass,
        slots: resp.data.slots || []
      });
    } catch (err) {
      setMsg(err?.response?.data?.error || String(err));
      console.error('doScan error', err);
    } finally {
      setLoading(false);
    }
  }, [authAxios, navigate]);

  // NEW: Search by Email
  const doEmailSearch = async () => {
    if (!searchedEmail.trim()) return;
    resetState();
    setLoading(true);
    try {
      const resp = await authAxios.get(`/scan/by-email/${encodeURIComponent(searchedEmail)}`);
      setUserPasses(resp.data.passes || []);
      if (resp.data.passes.length === 0) {
        setMsg('No passes found for this email address.');
      }
    } catch (err) {
      setMsg(err?.response?.data?.error || String(err));
      console.error('doEmailSearch error', err);
    } finally {
      setLoading(false);
    }
  };

  const onQrResult = useCallback((decodedText) => {
    if (!decodedText) return;
    const normalized = normalizeDecoded(decodedText);
    setPassId(normalized);
    doScan(normalized);
  }, [doScan]);

  const assignSlot = async (slot_no, event_id) => {
    setMsg(null);
    if (!selectedPass || !selectedPass.pass) return setMsg('No pass selected');
    if (selectedPass.passType !== 'technical') return setMsg('Slot assignment only for technical passes');
    
    try {
      await authAxios.post(`/scan/${selectedPass.pass.pass_id}/assign`, { slot_no, event_id });
      // Refresh the selected pass details
      const resp = await authAxios.get(`/scan/${selectedPass.pass.pass_id}`);
      setSelectedPass({
        passType: 'technical',
        pass: resp.data.pass,
        slots: resp.data.slots || []
      });
    } catch (err) {
      setMsg(err?.response?.data?.error || String(err));
    }
  };

  const deleteSlot = async (slot_no) => {
    if (!selectedPass || !selectedPass.pass) return setMsg('No pass selected');
    if (!window.confirm(`Delete slot ${slot_no}?`)) return;
    setMsg(null);

    try {
      await authAxios.delete(`/scan/${selectedPass.pass.pass_id}/slot/${slot_no}`);
      // Refresh the selected pass details
      const resp = await authAxios.get(`/scan/${selectedPass.pass.pass_id}`);
      setSelectedPass({
        passType: 'technical',
        pass: resp.data.pass,
        slots: resp.data.slots || []
      });
    } catch (err) {
      setMsg(err?.response?.data?.error || String(err));
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
  const currentSlots = selectedPass?.slots || [];
  const currentPassType = selectedPass?.passType;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <QrCodeIcon className="h-8 w-8 text-blue-600" />
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Pass Scanner</h1>
          </div>
          <p className="text-gray-600">Scan QR codes, enter pass IDs, or search by email to manage technical event slots.</p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Left Column - Scanner & Search */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Find Participant</h2>
              
              {/* Email Search */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Search by Email</label>
                <div className="flex gap-3">
                  <input value={searchedEmail} onChange={e => setSearchedEmail(e.target.value)} placeholder="participant@email.com" type="email"
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                  <button onClick={doEmailSearch} disabled={loading || !searchedEmail.trim()}
                    className="px-6 py-3 bg-gray-700 hover:bg-gray-800 disabled:bg-gray-400 text-white rounded-lg font-medium">
                    {loading ? '...' : <MagnifyingGlassIcon className="h-5 w-5" />}
                  </button>
                </div>
              </div>
              
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t"></span></div>
                <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-gray-500">Or</span></div>
              </div>

              {/* Manual Pass ID Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Enter Pass ID</label>
                <div className="flex gap-3">
                  <input value={passId} onChange={e => setPassId(e.target.value)} placeholder="Enter pass ID here..."
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                  <button onClick={() => doScan(normalizeDecoded(passId))} disabled={loading || !passId.trim()}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium">
                    Check ID
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
            {msg && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">{msg}</div>
            )}
            {loading && <p>Loading...</p>}

            {/* View 1: List of passes from email search */}
            {!loading && userPasses.length > 0 && !selectedPass && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="font-semibold mb-4">Found {userPasses.length} pass(es) for <span className="text-blue-600">{searchedEmail}</span></h3>
                <div className="space-y-3">
                  {userPasses.map((p, index) => (
                    <div key={index} className="bg-gray-50 border rounded-lg p-4 flex justify-between items-center">
                      <div>
                        <p className="font-semibold break-all">{p.pass.pass_id || p.pass.team_name}</p>
                        <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${getPassTypeColor(p.passType)}`}>
                          {p.passType}
                        </span>
                      </div>
                      <button onClick={() => {
                          if (p.passType !== 'technical') {
                            navigate(`/attendance?passId=${encodeURIComponent(p.pass.pass_id || p.pass.team_id)}`);
                          } else {
                            setSelectedPass(p);
                            setUserPasses([]);
                          }
                        }}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium">
                        Manage
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* View 2: Detailed view for a selected pass */}
            {!loading && selectedPass && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                <div className="p-6 border-b flex justify-between items-center">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 break-all">{currentPass.pass_id}</h3>
                        <p className="text-gray-600">Owner: {currentPass.user_email || '—'}</p>
                        <div className={`mt-2 inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getPassTypeColor(currentPassType)}`}>
                            {currentPassType} Pass
                        </div>
                    </div>
                    {(userPasses.length > 0 || searchedEmail) && (
                        <button onClick={resetState} className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
                            <ArrowUturnLeftIcon className="h-4 w-4" />
                            New Search
                        </button>
                    )}
                </div>

                <div className="p-6">
                    {/* Slots Section */}
                    <div className="mb-6">
                        <h4 className="text-lg font-semibold text-gray-900 mb-4">Assigned Slots</h4>
                        {currentSlots.length === 0 ? (
                            <p className="text-gray-500">No slots assigned yet.</p>
                        ) : (
                            <div className="space-y-3">
                                {currentSlots.map(s => (
                                    <div key={s.slot_no} className="bg-gray-50 rounded-lg p-4 border flex justify-between items-start">
                                        <div>
                                            <p><span className="font-bold">Slot {s.slot_no}:</span> {s.event_name || `Event ID ${s.event_id}`}</p>
                                            <p className={`text-sm ${s.attended ? 'text-green-600' : 'text-gray-500'}`}>
                                                Attended: {s.attended ? 'Yes' : 'No'}
                                            </p>
                                        </div>
                                        {!s.attended && (
                                            <button onClick={() => deleteSlot(s.slot_no)} className="p-2 text-red-500 hover:text-red-700">
                                                <TrashIcon className="h-5 w-5" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Assign Slot Form */}
                    <div className="border-t pt-6">
                        <AssignSlotForm onAssign={assignSlot} existingSlots={currentSlots} />
                    </div>
                </div>
              </div>
            )}
            
            {/* View 3: Initial/Empty State */}
            {!loading && userPasses.length === 0 && !selectedPass && !msg && (
                <div className="text-center p-8 bg-white rounded-xl border">
                    <p className="text-gray-500">Scan a QR code or search by email to get started.</p>
                </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}