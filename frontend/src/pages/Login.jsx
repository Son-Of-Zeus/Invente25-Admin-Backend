import React, { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useNavigate } from "react-router-dom";
import axios from "axios";

export default function LoginPage() {
  const [email, setEmail] = useState("admin@invente.local");
  const [password, setPassword] = useState("password");
  const [role, setRole] = useState("");
  const [name, setName] = useState("");
  const [personalEmail, setPersonalEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [eventId, setEventId] = useState("");
  const [events, setEvents] = useState([]);
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [err, setErr] = useState(null);
  const { login } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const base = import.meta.env.VITE_API_BASE || "http://localhost:4000";
        const resp = await axios.get(`${base}/events/public`);
        setEvents(resp.data.rows || []);
      } catch (_) {}
    };
    fetchEvents();
  }, []);

  const isValidInstitutionEmail = (e) => {
    const lower = String(e || "").toLowerCase();
    return lower.endsWith("@ssn.edu.in") || lower.endsWith("@snuchennai.edu.in");
  };

  const requestOtp = async () => {
    setErr(null);
    const trimmedName = name?.trim();
    const trimmedPersonalEmail = personalEmail?.trim();
    
    if (!trimmedName || !trimmedPersonalEmail) {
      setErr("Enter name and personal email");
      return;
    }
    if (!isValidInstitutionEmail(trimmedPersonalEmail)) {
      setErr("Email must end with @ssn.edu.in or @snuchennai.edu.in");
      return;
    }
    setSendingOtp(true);
    try {
      const base = import.meta.env.VITE_API_BASE || "http://localhost:4000";
      await axios.post(`${base}/auth/send-otp`, { personalEmail: trimmedPersonalEmail, name: trimmedName });
      setOtpSent(true);
    } catch (e) {
      setErr(e?.response?.data?.error || String(e));
    } finally {
      setSendingOtp(false);
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr(null);
    try {
      // Trim all input values as safety net
      const trimmedEmail = email?.trim();
      const trimmedPassword = password?.trim();
      const trimmedName = name?.trim();
      const trimmedPersonalEmail = personalEmail?.trim();
      const trimmedPhone = phone?.trim();
      const trimmedOtp = otp?.trim();
      
      const profile = {};
      if (trimmedName && trimmedPersonalEmail) {
        if (String(trimmedPersonalEmail).toLowerCase() === String(trimmedEmail).toLowerCase()) {
          setErr("Personal email must differ from admin email");
          return;
        }
        if (!otpSent) {
          setErr("Please request and enter OTP first");
          return;
        }
        if (!trimmedOtp || String(trimmedOtp).length !== 5) {
          setErr("Enter the 5-digit OTP");
          return;
        }
        profile.name = trimmedName;
        profile.personalEmail = trimmedPersonalEmail;
        profile.otp = trimmedOtp;
        if (trimmedPhone) profile.phone = trimmedPhone;
        if (role) profile.role = role;
        if (role === 'event_admin') profile.eventId = eventId ? Number(eventId) : undefined;
      }
      // Always include role for validation even if no profile data
      if (role && !profile.role) {
        profile.role = role;
      }
      await login(trimmedEmail, trimmedPassword, profile);
      nav("/");
    } catch (err) {
      setErr(err.response?.data?.error || String(err));
    }
  };

  return (
    <div className="max-w-md mx-auto mt-8 md:mt-16 m-4 p-6 bg-white shadow rounded">
      <h2 className="text-xl md:text-2xl font-semibold mb-6">Login to Invente25 Admin</h2>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm">Email</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value.trim())}
            className="w-full border p-2 rounded"
          />
        </div>
        <div>
          <label className="block text-sm">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value.trim())}
            className="w-full border p-2 rounded"
          />
        </div>

        <div className="border-t pt-4 space-y-3">
          <div>
            <label className="block text-sm">Your Role</label>
            <select value={role} onChange={e => setRole(e.target.value)} className="w-full border p-2 rounded">
              <option value="">Select your role</option>
              <option value="volunteer">Volunteer</option>
              <option value="dept_admin">Department Admin</option>
              <option value="event_admin">Event Admin</option>
              <option value="master_admin">Master Admin</option>
              <option value="workshop_admin">Workshop Admin</option>
            </select>
          </div>

          <div>
            <label className="block text-sm">Name</label>
            <input value={name} onChange={e => setName(e.target.value.trim())} className="w-full border p-2 rounded" />
          </div>
          <div>
            <label className="block text-sm">College Email</label>
            <input value={personalEmail} onChange={e => setPersonalEmail(e.target.value.trim())} className="w-full border p-2 rounded" />
          </div>
          <div>
            <label className="block text-sm">Phone</label>
            <input value={phone} onChange={e => setPhone(e.target.value.trim())} className="w-full border p-2 rounded" />
          </div>

          {role === 'event_admin' && (
            <div>
              <label className="block text-sm">Event in charge</label>
              <select value={eventId} onChange={e => setEventId(e.target.value)} className="w-full border p-2 rounded">
                <option value="">Select event</option>
                {events.map(ev => (
                  <option key={ev.external_id} value={ev.external_id}>{ev.name} {ev.department_name ? `— ${ev.department_name}` : ''}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button type="button" onClick={requestOtp} className="px-3 py-1 bg-gray-700 text-white rounded flex items-center gap-2" disabled={sendingOtp}>
              {sendingOtp && (
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              {sendingOtp ? 'Sending...' : (otpSent ? 'Resend OTP' : 'Send OTP')}
            </button>
            <input placeholder="Enter 5-digit OTP" value={otp} onChange={e => setOtp(e.target.value.trim())} className="border p-2 rounded flex-1" />
          </div>
          <div className="text-xs text-gray-500">Only institution emails allowed: @ssn.edu.in or @snuchennai.edu.in</div>
        </div>
        {err && <div className="text-red-500">{err}<br />Try reloading/logging out and back in</div>}
        <div className="flex justify-end">
          <button className="px-4 py-2 bg-blue-600 text-white rounded">
            Login
          </button>
        </div>
      </form>
    </div>
  );
}
