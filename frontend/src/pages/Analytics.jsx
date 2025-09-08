import React, { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { XMarkIcon } from '@heroicons/react/24/solid';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart,
} from "recharts";

function fmt(n) {
  if (n === null || n === undefined) return "-";
  return n.toLocaleString();
}

function formatCurrency(amount) {
  if (amount === null || amount === undefined) return "₹0";
  return `₹${Number(amount).toLocaleString()}`;
}

// Color palette for charts
const COLORS = [
  "#3B82F6",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#06B6D4",
  "#84CC16",
  "#F97316",
];

// +++ START: NEW MODAL COMPONENT +++
function VolunteerDetailModal({ volunteer, onClose }) {
  const { authAxios } = useAuth();
  const [details, setDetails] = useState({ loading: true, data: null, error: null });

  useEffect(() => {
    const fetchDetails = async () => {
      if (!volunteer) return;
      try {
        setDetails({ loading: true, data: null, error: null });
        const encodedEmail = encodeURIComponent(volunteer.personal_email);
        const response = await authAxios.get(`/analytics/volunteer/${encodedEmail}`);
        setDetails({ loading: false, data: response.data, error: null });
      } catch (e) {
        setDetails({ loading: false, data: null, error: e.response?.data?.error || 'Failed to load details.' });
      }
    };
    fetchDetails();
  }, [volunteer, authAxios]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Registration Details for {volunteer.name}</h2>
            <p className="text-sm text-gray-500">{volunteer.personal_email}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200">
            <XMarkIcon className="h-6 w-6 text-gray-600" />
          </button>
        </div>
        
        <div className="overflow-y-auto">
          {details.loading && (
            <div className="p-12 text-center text-gray-500">Loading details...</div>
          )}
          {details.error && (
            <div className="p-12 text-center text-red-600">{details.error}</div>
          )}
          {details.data && (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Pass ID</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Participant</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Registered Events</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {details.data.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="p-8 text-center text-gray-500">No passes have been assigned by this volunteer yet.</td>
                  </tr>
                ) : (
                  details.data.map(pass => (
                    <tr key={pass.pass_id} className="hover:bg-gray-50">
                      <td className="px-4 py-4 font-mono text-xs text-gray-700">{pass.pass_id.split('-')[0]}...</td>
                      <td className="px-4 py-4">
                        <div className="font-medium text-gray-900">{pass.user_name || 'N/A'}</div>
                        <div className="text-gray-500">{pass.user_email}</div>
                      </td>
                      <td className="px-4 py-4 text-gray-700 max-w-xs">{pass.event_names || <span className="text-gray-400 italic">No events assigned</span>}</td>
                      <td className="px-4 py-4 font-medium text-gray-900">{formatCurrency(pass.amount)}</td>
                      <td className="px-4 py-4 text-gray-600">{new Date(pass.paid_on).toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// Enhanced sparkline component
function Sparkline({ data, width = 200, height = 40, color = "#10B981" }) {
  if (!data || data.length === 0)
    return <div className="text-sm text-gray-500">No data</div>;

  const counts = data.map((d) => d.count);
  const max = Math.max(...counts);
  const min = Math.min(...counts);
  const range = Math.max(1, max - min);

  const points = data
    .map((d, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((d.count - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className="block"
    >
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        points={points}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {data.map((d, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - ((d.count - min) / range) * (height - 4) - 2;
        return <circle key={i} cx={x} cy={y} r="1.4" fill={color} />;
      })}
    </svg>
  );
}

export default function AnalyticsPage() {
  const { authAxios, user } = useAuth();
  const [stats, setStats] = useState(null);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [refreshTime, setRefreshTime] = useState(new Date());
  const [selectedVolunteer, setSelectedVolunteer] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    setErr(null);
    try {
      if (user?.role === "event_admin") {
        const resp = await authAxios.get(`/analytics/event`);
        setStats({ scope: "event", data: resp.data });
      } else if (user?.role === "dept_admin") {
        const id = user.department_id;
        const resp = await authAxios.get(`/analytics/department/${id}`);
        setStats({ scope: "department", data: resp.data });
      } else {
        const resp = await authAxios.get("/analytics/college");
        setStats({ scope: "college", data: resp.data });
      }
      setRefreshTime(new Date());
    } catch (e) {
      setErr(e.response?.data?.error || String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [authAxios, user]);

  const handleExport = async () => {
    try {
      const response = await authAxios.get("/analytics/export/college", {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `invente25-analytics-${new Date().toISOString().split("T")[0]}.xlsx`
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
      console.error("Export failed:", e);
    }
  };

  if (loading)
    return (
      <div className="p-6 flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <div className="text-gray-600">Loading analytics...</div>
        </div>
      </div>
    );

  if (err)
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="text-red-800 font-medium">
            Error loading analytics
          </div>
          <div className="text-red-600 mt-2">{err}</div>
          <button
            onClick={fetchData}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );

  if (!stats) return <div className="p-6">No analytics available</div>;

  // Event view for event_admin
  if (stats.scope === "event") {
    const d = stats.data;
    return (
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">
            Event Analytics — {d.event?.name} (ID: {d.event?.external_id})
          </h2>
          <div className="text-sm text-gray-500">
            Last updated: {refreshTime.toLocaleTimeString()}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="text-sm text-gray-500 mb-1">Registrations</div>
            <div className="text-3xl font-bold text-blue-600">
              {fmt(d.totals.registrations)}
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="text-sm text-gray-500 mb-1">Attendance</div>
            <div className="text-3xl font-bold text-green-600">
              {fmt(d.totals.attendance)}
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="text-sm text-gray-500 mb-1">Attendance Rate</div>
            <div className="text-3xl font-bold text-orange-600">
              {d.totals.registrations > 0
                ? Math.round(
                    (d.totals.attendance / d.totals.registrations) * 100
                  )
                : 0}
              %
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-6 border-b">
            <h3 className="text-lg font-semibold">Recent Registrations</h3>
            <div className="text-sm text-gray-600 mt-1">
              Last 100 slot updates
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Pass
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Slot
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Attended
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Time
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {d.recent_slots.map((r) => (
                  <tr
                    key={`${r.pass_id}-${r.slot_no}`}
                    className="hover:bg-gray-50"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {r.pass_id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {r.slot_no}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {r.attended ? "Yes" : "No"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // Department view
  if (stats.scope === "department") {
    const d = stats.data;
    return (
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">
            Department Analytics — {d.department?.name}
          </h2>
          <div className="text-sm text-gray-500">
            Last updated: {refreshTime.toLocaleTimeString()}
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="text-sm text-gray-500 mb-1">Total Events</div>
            <div className="text-3xl font-bold text-blue-600">
              {fmt(d.totals.total_events)}
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="text-sm text-gray-500 mb-1">
              Total Registrations
            </div>
            <div className="text-3xl font-bold text-green-600">
              {fmt(d.totals.total_registrations)}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Attended: {fmt(d.totals.total_attendance)}
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="text-sm text-gray-500 mb-1">Total Revenue</div>
            <div className="text-3xl font-bold text-purple-600">
              {formatCurrency(d.totals.total_revenue)}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Avg: {formatCurrency(d.totals.avg_transaction)}
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="text-sm text-gray-500 mb-1">Attendance Rate</div>
            <div className="text-3xl font-bold text-orange-600">
              {d.totals.total_registrations > 0
                ? Math.round(
                    (d.totals.total_attendance / d.totals.total_registrations) *
                      100
                  )
                : 0}
              %
            </div>
          </div>
        </div>

        {/* Tech vs Non-Tech Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h3 className="text-lg font-semibold mb-4">Event Type Breakdown</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-blue-50 rounded">
                <div>
                  <div className="font-medium text-blue-800">
                    Technical Events
                  </div>
                  <div className="text-sm text-blue-600">
                    Registrations: {fmt(d.breakdown.technical.registrations)}
                  </div>
                </div>
                <div className="text-2xl font-bold text-blue-600">
                  {fmt(d.breakdown.technical.attendance)}
                </div>
              </div>
              <div className="flex justify-between items-center p-3 bg-green-50 rounded">
                <div>
                  <div className="font-medium text-green-800">
                    Non-Technical Events
                  </div>
                  <div className="text-sm text-green-600">
                    Registrations:{" "}
                    {fmt(d.breakdown.non_technical.registrations)}
                  </div>
                </div>
                <div className="text-2xl font-bold text-green-600">
                  {fmt(d.breakdown.non_technical.attendance)}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h3 className="text-lg font-semibold mb-4">
              Event Type Distribution
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={d.event_type_breakdown}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="total_registrations"
                  label={({ event_type, total_registrations }) =>
                    `${event_type}: ${total_registrations}`
                  }
                >
                  {d.event_type_breakdown.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h3 className="text-lg font-semibold mb-4">
              Registrations Over Time
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={d.registrations_over_time}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#3B82F6"
                  fill="#3B82F6"
                  fillOpacity={0.3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h3 className="text-lg font-semibold mb-4">Payment Methods</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={d.passes_by_payment}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="method" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="total_passes" fill="#10B981" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Events Table */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-6 border-b">
            <h3 className="text-lg font-semibold">Event Performance</h3>
            <div className="text-sm text-gray-600 mt-1">
              Detailed breakdown of all events
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Event
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Registrations
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Attendance
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Revenue
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rate
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {d.per_event.map((ev) => (
                  <tr key={ev.event_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {ev.event_name}
                      </div>
                      <div className="text-sm text-gray-500">
                        ID: {ev.event_id}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          ev.event_type === "technical"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-green-100 text-green-800"
                        }`}
                      >
                        {ev.event_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {fmt(ev.registrations)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {fmt(ev.attendance)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(ev.revenue)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {ev.registrations > 0
                        ? Math.round((ev.attendance / ev.registrations) * 100)
                        : 0}
                      %
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // College view (super_admin)
  const c = stats.data;
  const tabs = [
    { id: "overview", label: "Overview", icon: "📊" },
    { id: "departments", label: "Departments", icon: "🏢" },
    { id: "workshops", label: "Workshops", icon: "🔧" },
    { id: "hackathons", label: "Hackathons", icon: "💻" },
    { id: "revenue", label: "Revenue", icon: "💰" },
    { id: "volunteers", label: "Volunteers", icon: "👥" },
  ];

  return (
    <div className="p-6">

      {selectedVolunteer && (
        <VolunteerDetailModal 
          volunteer={selectedVolunteer} 
          onClose={() => setSelectedVolunteer(null)} 
        />
      )}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">College Analytics Dashboard</h2>
        <div className="flex items-center space-x-4">
          <div className="text-sm text-gray-500">
            Last updated: {refreshTime.toLocaleTimeString()}
          </div>
          <button
            onClick={fetchData}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
          >
            Refresh
          </button>
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
          >
            Export Excel
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="text-sm text-gray-500 mb-1">
                Total Departments
              </div>
              <div className="text-3xl font-bold text-blue-600">
                {fmt(c.totals.total_departments)}
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="text-sm text-gray-500 mb-1">Total Events</div>
              <div className="text-3xl font-bold text-green-600">
                {fmt(c.totals.total_events)}
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="text-sm text-gray-500 mb-1">
                Total Registrations
              </div>
              <div className="text-3xl font-bold text-purple-600">
                {fmt(c.totals.total_registrations)}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Attended: {fmt(c.totals.total_attendance)}
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="text-sm text-gray-500 mb-1">Total Revenue</div>
              <div className="text-3xl font-bold text-orange-600">
                {formatCurrency(c.totals.total_revenue)}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Avg: {formatCurrency(c.totals.avg_transaction)}
              </div>
            </div>
          </div>

          {/* Event Type Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h3 className="text-lg font-semibold mb-4">
                Event Type Distribution
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={c.event_type_breakdown}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="total_registrations"
                    label={({ event_type, total_registrations }) =>
                      `${event_type}: ${total_registrations}`
                    }
                  >
                    {c.event_type_breakdown.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h3 className="text-lg font-semibold mb-4">
                Registrations Over Time
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={c.registrations_over_time}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#3B82F6"
                    fill="#3B82F6"
                    fillOpacity={0.3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top Events */}
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold">Top Performing Events</h3>
              <div className="text-sm text-gray-600 mt-1">
                Most registered events across the college
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Event
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Department
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Registrations
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Attendance
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Revenue
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {c.top_events.slice(0, 10).map((ev) => (
                    <tr key={ev.event_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {ev.event_name}
                        </div>
                        <div className="text-sm text-gray-500">
                          ID: {ev.event_id}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {ev.department_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            ev.event_type === "technical"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-green-100 text-green-800"
                          }`}
                        >
                          {ev.event_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {fmt(ev.registrations)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {fmt(ev.attendance)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(ev.revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "departments" && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold">Department Performance</h3>
              <div className="text-sm text-gray-600 mt-1">
                Comprehensive department analytics
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Department
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Events
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Registrations
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Attendance
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Revenue
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Rate
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {c.per_department.map((dpt) => (
                    <tr key={dpt.department_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {dpt.department_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {fmt(dpt.event_count)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {fmt(dpt.registrations)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {fmt(dpt.attendance)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(dpt.revenue)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {dpt.registrations > 0
                          ? Math.round(
                              (dpt.attendance / dpt.registrations) * 100
                            )
                          : 0}
                        %
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "workshops" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="text-sm text-gray-500 mb-1">Total Workshops</div>
              <div className="text-3xl font-bold text-blue-600">
                {fmt(c.workshops.summary.total_workshops)}
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="text-sm text-gray-500 mb-1">
                Total Registrations
              </div>
              <div className="text-3xl font-bold text-green-600">
                {fmt(c.workshops.summary.total_registrations)}
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="text-sm text-gray-500 mb-1">Total Revenue</div>
              <div className="text-3xl font-bold text-purple-600">
                {formatCurrency(c.workshops.summary.total_revenue)}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold">Workshop Performance</h3>
              <div className="text-sm text-gray-600 mt-1">
                Detailed workshop analytics
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Workshop
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Cost
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Registrations
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Attendance
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Revenue
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {c.workshops.analytics.map((ws) => (
                    <tr key={ws.event_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {ws.event_name}
                        </div>
                        <div className="text-sm text-gray-500">
                          ID: {ws.event_id}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(ws.cost)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {fmt(ws.registrations)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {fmt(ws.attendance)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(ws.revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "hackathons" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="text-sm text-gray-500 mb-1">Total Teams</div>
              <div className="text-3xl font-bold text-blue-600">
                {fmt(c.hackathons.summary.total_teams)}
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="text-sm text-gray-500 mb-1">Teams Attended</div>
              <div className="text-3xl font-bold text-green-600">
                {fmt(c.hackathons.summary.total_attended)}
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="text-sm text-gray-500 mb-1">
                Total Participants
              </div>
              <div className="text-3xl font-bold text-purple-600">
                {fmt(c.hackathons.summary.total_participants)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h3 className="text-lg font-semibold mb-4">Track Breakdown</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={c.hackathons.track_breakdown}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="track" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="team_count" fill="#3B82F6" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h3 className="text-lg font-semibold mb-4">Track Performance</h3>
              <div className="space-y-4">
                {c.hackathons.track_breakdown.map((track) => (
                  <div key={track.track} className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-medium text-gray-900">
                          {track.track}
                        </div>
                        <div className="text-sm text-gray-600">
                          {track.team_count} teams • {track.attended_teams}{" "}
                          attended
                        </div>
                      </div>
                      <div className="text-2xl font-bold text-blue-600">
                        {track.team_count}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold">Recent Teams</h3>
              <div className="text-sm text-gray-600 mt-1">
                Latest hackathon team registrations
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Team
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Track
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Size
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Registered
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {c.hackathons.recent_teams.slice(0, 10).map((team) => (
                    <tr key={team.team_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {team.team_name}
                        </div>
                        <div className="text-sm text-gray-500">
                          ID: {team.team_id}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {team.track}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {team.team_size} members
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            team.attended
                              ? "bg-green-100 text-green-800"
                              : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {team.attended ? "Attended" : "Registered"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(team.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "revenue" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="text-sm text-gray-500 mb-1">Total Revenue</div>
              <div className="text-3xl font-bold text-green-600">
                {formatCurrency(c.totals.total_revenue)}
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="text-sm text-gray-500 mb-1">
                Average Transaction
              </div>
              <div className="text-3xl font-bold text-blue-600">
                {formatCurrency(c.totals.avg_transaction)}
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="text-sm text-gray-500 mb-1">
                Total Transactions
              </div>
              <div className="text-3xl font-bold text-purple-600">
                {fmt(c.totals.total_transactions)}
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h3 className="text-lg font-semibold mb-4">Payment Methods</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={c.passes_by_payment}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="method" />
                <YAxis />
                <Tooltip
                  formatter={(value, name) => [
                    name === "total_revenue"
                      ? formatCurrency(value)
                      : fmt(value),
                    name,
                  ]}
                />
                <Legend />
                <Bar dataKey="total_passes" fill="#3B82F6" name="Passes" />
                <Bar dataKey="total_revenue" fill="#10B981" name="Revenue" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {activeTab === "volunteers" && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold">
                Central Volunteer Performance
              </h3>
              <div className="text-sm text-gray-600 mt-1">
                Activity and revenue collected by each central volunteer.
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Volunteer Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Passes Assigned
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Revenue Collected
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {c.central_volunteers && c.central_volunteers.map(vol => (
                    // +++ ADD onClick HANDLER AND STYLING TO THE ROW +++
                    <tr 
                      key={vol.personal_email} 
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => setSelectedVolunteer(vol)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{vol.name}</div>
                        <div className="text-sm text-gray-500">{vol.personal_email} | {vol.phone || 'No Phone'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-left">{fmt(vol.passes_assigned)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-left">{formatCurrency(vol.total_collected)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
