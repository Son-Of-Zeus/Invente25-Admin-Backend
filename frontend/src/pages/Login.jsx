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
    if (!name || !personalEmail) {
      setErr("Enter name and personal email");
      return;
    }
    if (!isValidInstitutionEmail(personalEmail)) {
      setErr("Email must end with @ssn.edu.in or @snuchennai.edu.in");
      return;
    }
    setSendingOtp(true);
    try {
      const base = import.meta.env.VITE_API_BASE || "http://localhost:4000";
      await axios.post(`${base}/auth/send-otp`, { personalEmail, name });
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
      const profile = {};
      if (name && personalEmail) {
        if (String(personalEmail).toLowerCase() === String(email).toLowerCase()) {
          setErr("Personal email must differ from admin email");
          return;
        }
        if (!otpSent) {
          setErr("Please request and enter OTP first");
          return;
        }
        if (!otp || String(otp).length !== 5) {
          setErr("Enter the 5-digit OTP");
          return;
        }
        profile.name = name;
        profile.personalEmail = personalEmail;
        profile.otp = otp;
        if (phone) profile.phone = phone;
        if (role) profile.role = role;
        if (role === 'event_admin') profile.eventId = eventId ? Number(eventId) : undefined;
      }
      await login(email, password, profile);
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
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border p-2 rounded"
          />
        </div>
        <div>
          <label className="block text-sm">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
              <option value="super_admin">Super Admin</option>
            </select>
          </div>

          <div>
            <label className="block text-sm">Name</label>
            <input value={name} onChange={e => setName(e.target.value)} className="w-full border p-2 rounded" />
          </div>
          <div>
            <label className="block text-sm">Personal Email</label>
            <input value={personalEmail} onChange={e => setPersonalEmail(e.target.value)} className="w-full border p-2 rounded" />
          </div>
          <div>
            <label className="block text-sm">Phone</label>
            <input value={phone} onChange={e => setPhone(e.target.value)} className="w-full border p-2 rounded" />
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
            <button type="button" onClick={requestOtp} className="px-3 py-1 bg-gray-700 text-white rounded" disabled={sendingOtp}>
              {otpSent ? 'Resend OTP' : 'Send OTP'}
            </button>
            <input placeholder="Enter 5-digit OTP" value={otp} onChange={e => setOtp(e.target.value)} className="border p-2 rounded flex-1" />
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
