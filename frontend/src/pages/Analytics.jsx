import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useAuth } from "../hooks/useAuth";
import { XMarkIcon } from "@heroicons/react/24/solid";
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
import * as XLSX from 'xlsx';
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
        setDetails({ loading: false, data: null, error: e.response?.data?.error || "Failed to load details." });
      }
    };
    fetchDetails();
  }, [volunteer, authAxios]);

  // +++ NEW: Calculate total revenue collected +++
  const totalRevenue = useMemo(() => {
    if (!details.data) return 0;
    return details.data.reduce((sum, pass) => sum + Number(pass.amount), 0);
  }, [details.data]);

  // +++ NEW: Export handler for volunteer details +++
  const handleExport = () => {
    if (!details.data) return;
    const dataToExport = details.data.map(p => ({
      'Pass ID': p.pass_id,
      'Participant Email': p.user_email,
      'Participant Name': p.user_name,
      'Amount': p.amount,
      'Registered On': new Date(p.paid_on).toLocaleString(),
      'Assigned Events': p.event_names,
    }));
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Pass Details");
    XLSX.writeFile(workbook, `invente-volunteer-passes-${volunteer.name.replace(/ /g, '_')}-${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-start p-4 border-b">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Registration Details for {volunteer.name}</h2>
            <p className="text-sm text-gray-500">{volunteer.personal_email}</p>
            {/* +++ NEW: Display Total Revenue +++ */}
            <div className="mt-2 text-lg font-semibold text-green-600 bg-green-50 px-3 py-1 rounded-md inline-block">
              Total Collected: {formatCurrency(totalRevenue)}
            </div>
          </div>
          {/* +++ NEW: Export Button +++ */}
          <div className="flex items-center space-x-2">
            <button
                onClick={handleExport}
                className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
            >
              Export Excel
            </button>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200">
              <XMarkIcon className="h-6 w-6 text-gray-600" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto">
          {details.loading && (
            <div className="p-12 text-center text-gray-500">
              Loading details...
            </div>
          )}
          {details.error && (
            <div className="p-12 text-center text-red-600">{details.error}</div>
          )}
          {details.data && (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">
                    Pass ID
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">
                    Participant
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">
                    Registered Events
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {details.data.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="p-8 text-center text-gray-500">
                      No passes have been assigned by this volunteer yet.
                    </td>
                  </tr>
                ) : (
                  details.data.map((pass) => (
                    <tr key={pass.pass_id} className="hover:bg-gray-50">
                      <td className="px-4 py-4 font-mono text-xs text-gray-700">
                        {pass.pass_id.split("-")[0]}...
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-medium text-gray-900">
                          {pass.user_name || "N/A"}
                        </div>
                        <div className="text-gray-500">{pass.user_email}</div>
                      </td>
                      <td className="px-4 py-4 text-gray-700 max-w-xs">
                        {pass.event_names || (
                          <span className="text-gray-400 italic">
                            No events assigned
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 font-medium text-gray-900">
                        {formatCurrency(pass.amount)}
                      </td>
                      <td className="px-4 py-4 text-gray-600">
                        {new Date(pass.paid_on).toLocaleString()}
                      </td>
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

// +++ START: NEW EVENT DETAIL MODAL COMPONENT +++
function EventDetailModal({ event, onClose }) {
  const { authAxios } = useAuth();
  const [details, setDetails] = useState({
    loading: true,
    data: null,
    error: null,
  });

  useEffect(() => {
    const fetchEventDetails = async () => {
      if (!event) return;
      try {
        setDetails({ loading: true, data: null, error: null });
        const response = await authAxios.get(
          `/analytics/event?event_id=${event.event_id}`
        );
        setDetails({ loading: false, data: response.data, error: null });
      } catch (e) {
        setDetails({
          loading: false,
          data: null,
          error: e.response?.data?.error || "Failed to load event details.",
        });
      }
    };
    fetchEventDetails();
  }, [event, authAxios]);

  const handleExport = () => {
    if (!details.data?.registrations) return;
    const dataToExport = details.data.registrations.map(r => ({
      'Pass ID': r.pass_id,
      'Slot No': r.slot_no,
      'Attended': r.attended ? 'Yes' : 'No',
      'Registration Time': new Date(r.created_at).toLocaleString(),
      'Participant Name': r.user_name,
      'Email': r.user_email,
      'Phone': r.user_phone,
      'Institution': r.user_institution,
    }));
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Registrations");
    XLSX.writeFile(workbook, `invente-event-registrants-${event.event_name.replace(/ /g, '_')}-${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const d = details.data;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-bold text-gray-800">
            Detailed Analytics for {event.event_name}
          </h2>

          <div className="flex items-center space-x-2">
            {d && <button
              onClick={handleExport}
              className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
            >
              Export Registrants
            </button>}
            <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200">
              <XMarkIcon className="h-6 w-6 text-gray-600" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto p-6 space-y-6">
          {details.loading && (
            <div className="text-center text-gray-500 py-10">
              Loading details...
            </div>
          )}
          {details.error && (
            <div className="text-center text-red-600 py-10">
              {details.error}
            </div>
          )}
          {d && (
            <>
              {/* Key Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gray-50 p-4 rounded-lg border">
                  <div className="text-sm text-gray-500 mb-1">
                    Registrations
                  </div>
                  <div className="text-3xl font-bold text-blue-600">
                    {fmt(d.totals.registrations)}
                  </div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg border">
                  <div className="text-sm text-gray-500 mb-1">Attendance</div>
                  <div className="text-3xl font-bold text-green-600">
                    {fmt(d.totals.attendance)}
                  </div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg border">
                  <div className="text-sm text-gray-500 mb-1">
                    Attendance Rate
                  </div>
                  <div className="text-3xl font-bold text-orange-600">
                    {d.totals.registrations > 0
                      ? `${Math.round(
                          (d.totals.attendance / d.totals.registrations) * 100
                        )}%`
                      : "0%"}
                  </div>
                </div>
              </div>

              {/* Event Admins */}
              <div className="bg-white rounded-lg border">
                <div className="p-4 border-b">
                  <h3 className="text-lg font-semibold">
                    Assigned Event Admins
                  </h3>
                </div>
                {d.event_admins?.length > 0 ? (
                  <ul className="divide-y divide-gray-200">
                    {d.event_admins.map((admin) => (
                      <li
                        key={admin.personal_email}
                        className="p-4 flex justify-between items-center"
                      >
                        <div>
                          <div className="font-medium text-gray-900">
                            {admin.name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {admin.personal_email}
                          </div>
                        </div>
                        <div className="text-sm text-gray-600">
                          {admin.phone || "No phone"}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="p-4 text-sm text-gray-500">
                    No event admins are assigned to this event.
                  </p>
                )}
              </div>

              {/* Recent Registrations Table */}
              <div className="bg-white rounded-lg border">
                <div className="p-4 border-b">
                  <h3 className="text-lg font-semibold">All Registrations</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        {/* +++ NEW: Table Headers +++ */}
                        <th className="px-4 py-2 text-left font-medium text-gray-500">Participant</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-500">Contact</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-500">Institution</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-500">Pass / Slot</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-500">Attended</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-500">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {/* +++ MODIFIED: Table body using `registrations` key +++ */}
                      {d.registrations.map((r) => (
                        <tr key={`${r.pass_id}-${r.slot_no}`}>
                          <td className="px-4 py-3">
                            <div>{r.user_name || '--'}</div>
                            <div className="text-xs text-gray-500">{r.user_email}</div>
                          </td>
                          <td className="px-4 py-3">{r.user_phone || '--'}</td>
                          <td className="px-4 py-3">{r.user_institution || '--'}</td>
                          <td className="px-4 py-3 font-mono text-xs">
                            <div>{r.pass_id}</div>
                            <div>Slot: {r.slot_no}</div>
                          </td>
                          <td className="px-4 py-3">{r.attended ? "Yes" : "No"}</td>
                          <td className="px-4 py-3">{new Date(r.created_at).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}



function DepartmentViewContent({
  data: d,
  refreshTime,
  onEventClick,
  onShowParticipants,
}) {
  const [activeTab, setActiveTab] = useState("department");
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [trackFilter, setTrackFilter] = useState("");
  const [selectedStaff, setSelectedStaff] = useState(null);
  
  // Check if hackathon data is available (ECE department)
  const hasHackathonData = d.hackathons && d.hackathons.track_breakdown;
  
  const tabs = [
    { id: "department", label: "Department Analytics", icon: "🏢" },
    { id: "staff", label: "Staff & Revenue", icon: "👥" },
  ];
  
  if (hasHackathonData) {
    tabs.push({ id: "hackathons", label: "Hackathons", icon: "💻" });
  }

  // Export handler for hackathon teams with detailed member information
  const handleExportHackathon = () => {
    if (!d?.hackathons?.recent_teams) return;
    
    // Filter teams based on current track filter
    const teamsToExport = d.hackathons.recent_teams
      .filter(team => !trackFilter || team.track.toLowerCase() === trackFilter);

    // Find maximum number of team members
    const maxMembers = Math.max(...teamsToExport.map(team => team.members?.length || 0));

    const dataToExport = teamsToExport.map(team => {
      // Base team information
      const baseData = {
        'Team Name': team.team_name,
        'Team ID': team.team_id,
        'Track': team.track,
        'Domain': team.domain_name || '-',
        'Team Size': team.team_size,
        'Status': team.attended ? 'Attended' : 'Registered',
        'Registration Date': new Date(team.created_at).toLocaleDateString(),
        'Problem Statement': team.problem_statement || '-',
      };

      // Add member details in separate columns
      for (let i = 0; i < maxMembers; i++) {
        const member = team.members?.[i] || {};
        baseData[`Member ${i + 1} Name`] = member.name || '';
        baseData[`Member ${i + 1} Email`] = member.email || '';
        baseData[`Member ${i + 1} Phone`] = member.phone || '';
        baseData[`Member ${i + 1} Institution`] = member.institution || '';
        baseData[`Member ${i + 1} Department`] = member.department || '';
        baseData[`Member ${i + 1} Year`] = member.year || '';
      }

      return baseData;
    });

    // Create worksheet with the data
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);

    // Set column widths for better readability
    const columnWidths = {
      'A': 20, // Team Name
      'B': 15, // Team ID
      'C': 15, // Track
      'D': 20, // Domain
      'E': 10, // Team Size
      'F': 12, // Status
      'G': 15, // Registration Date
      'H': 40, // Problem Statement
    };

    // Start from I column for member details (assuming 8 columns for base data)
    const memberColumns = maxMembers * 6; // 6 columns per member
    for (let i = 0; i < memberColumns; i++) {
      const col = String.fromCharCode(73 + i); // Start from I
      columnWidths[col] = 20;
    }

    worksheet['!cols'] = Object.keys(columnWidths).map(key => ({
      wch: columnWidths[key]
    }));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Hackathon Teams");
    
    // Generate filename with current date and track filter
    const trackSuffix = trackFilter ? `-${trackFilter}` : '';
    const filename = `invente-hackathon-teams${trackSuffix}-${new Date().toISOString().split("T")[0]}.xlsx`;
    
    try {
      XLSX.writeFile(workbook, filename);
    } catch (error) {
      console.error("Failed to export Excel file:", error);
    }
  };

  // Export handler for department staff
  const handleExportDepartmentStaff = () => {
    if (!d?.department_staff) return;
    const dataToExport = d.department_staff.map(staff => ({
      'Staff Name': staff.name,
      'Email': staff.personal_email,
      'Phone': staff.phone,
      'Role': staff.role === 'dept_admin' ? 'Department Admin' :
              staff.role === 'workshop_admin' ? 'Workshop Admin' :
              staff.role === 'workshop_volunteer' ? 'Workshop Volunteer' : 'Department Volunteer',
      'Department': staff.department_name || 'Central',
      'Passes Assigned': staff.passes_assigned,
      'Revenue via UPI': staff.upi_collected,
      'Revenue via Cash': staff.cash_collected,
      'Total Revenue': staff.total_collected,
    }));
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Department Staff Revenue");
    XLSX.writeFile(workbook, `invente25-department-staff-revenue-${d.department?.name}-${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  return (
    <>
      {selectedStaff && (
        <VolunteerDetailModal
          volunteer={selectedStaff}
          onClose={() => setSelectedStaff(null)}
        />
      )}
      
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">
          Department Analytics — {d.department?.name}
        </h2>
        <div className="text-sm text-gray-500">
          Last updated: {refreshTime.toLocaleTimeString()}
        </div>
      </div>

      {/* Tabs - show if there are multiple tabs or staff data */}
      {(hasHackathonData || (d.department_staff && d.department_staff.length > 0)) && (
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? "border-indigo-500 text-indigo-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  <span className="mr-2">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* Department Analytics Tab */}
      {activeTab === "department" && (
        <>
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="text-sm text-gray-500 mb-1">Total Events</div>
          <div className="text-3xl font-bold text-blue-600">
            {fmt(d.totals.total_events)}
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="text-sm text-gray-500 mb-1">Total Registrations</div>
          <div className="text-3xl font-bold text-green-600">
            {fmt(d.totals.total_registrations)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Tech Online: {fmt(d.totals.tech_online_registered || 0)} ({d.totals.tech_online_percentage || '0.0'}%)
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="text-sm text-gray-500 mb-1">Attendance</div>
          <div className="text-3xl font-bold text-indigo-600">
            {fmt(d.totals.attended_count || d.totals.total_attendance)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Rate: {d.totals.total_registrations > 0
              ? Math.round(
                  ((d.totals.attended_count || d.totals.total_attendance) / d.totals.total_registrations) * 100
                )
              : 0}%
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
          <div className="text-sm text-gray-500 mb-1">Actions</div>
          <button
            onClick={() => onShowParticipants && onShowParticipants({
              scope: 'department',
              title: d.department?.name,
              departmentId: d.department?.id
            })}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm mb-2"
          >
            View Participants
          </button>
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
                  Teams: {fmt(d.breakdown.non_technical.teams || d.breakdown.non_technical.registrations)}
                  {d.breakdown.non_technical.participants && (
                    <span> • Participants: {fmt(d.breakdown.non_technical.participants)}</span>
                  )}
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
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold">Event Performance</h3>
              <div className="text-sm text-gray-600 mt-1">
                Detailed breakdown of all events
              </div>
            </div>
            <button
              onClick={() => {
                const dataToExport = d.per_event.map(ev => ({
                  'Event ID': ev.event_id,
                  'Event Name': ev.event_name,
                  'Type': ev.event_type,
                  'Registrations': ev.registrations,
                  'Attendance': ev.attendance,
                  'Revenue': ev.revenue,
                  'Attendance Rate (%)': ev.registrations > 0 ? Math.round((ev.attendance / ev.registrations) * 100) : 0,
                }));
                const worksheet = XLSX.utils.json_to_sheet(dataToExport);
                const workbook = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(workbook, worksheet, "Event Performance");
                XLSX.writeFile(workbook, `invente-dept-events-${new Date().toISOString().split("T")[0]}.xlsx`);
              }}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
            >
              Export Events
            </button>
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
                // +++ MAKE THE TABLE ROW CLICKABLE +++
                <tr
                  key={ev.event_id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => onEventClick ? onEventClick(ev) : {}}
                >
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
        </>
      )}

      {/* Staff & Revenue Tab */}
      {activeTab === "staff" && (
        <>
          {/* Staff & Revenue Section */}
          {d.department_staff && d.department_staff.length > 0 ? (
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="p-6 border-b flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold">Staff & Revenue Performance</h3>
                  <div className="text-sm text-gray-600 mt-1">Pass assignments and revenue collected by department staff.</div>
                </div>
                <button
                  onClick={handleExportDepartmentStaff}
                  className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                >
                  Export Table
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Staff Member
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Role
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Passes Assigned
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Revenue via UPI
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Revenue via Cash
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total Revenue
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {d.department_staff.map((staff) => (
                      <tr 
                        key={staff.personal_email} 
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => setSelectedStaff(staff)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {staff.name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {staff.personal_email}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            staff.role === 'dept_admin' 
                              ? 'bg-purple-100 text-purple-800' 
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {staff.role === 'dept_admin' ? 'Department Admin' :
                             staff.role === 'workshop_admin' ? 'Workshop Admin' :
                             staff.role === 'workshop_volunteer' ? 'Workshop Volunteer' : 'Volunteer'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-left">
                          {fmt(staff.passes_assigned)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-left">
                          {formatCurrency(staff.upi_collected)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-left">
                          {formatCurrency(staff.cash_collected)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-left">
                          {formatCurrency(staff.total_revenue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
              <div className="text-gray-500">
                <div className="text-lg font-medium mb-2">No Staff Data Available</div>
                <div className="text-sm">Staff and revenue information will appear here once data is available.</div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Hackathons Tab */}
      {activeTab === "hackathons" && hasHackathonData && (
        <>
          {/* Hackathon Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="text-sm text-gray-500 mb-1">Total Teams</div>
              <div className="text-3xl font-bold text-blue-600">
                {fmt(d.hackathons.summary.total_teams)}
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="text-sm text-gray-500 mb-1">Teams Attended</div>
              <div className="text-3xl font-bold text-green-600">
                {fmt(d.hackathons.summary.total_attended)}
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="text-sm text-gray-500 mb-1">Total Participants</div>
              <div className="text-3xl font-bold text-purple-600">
                {fmt(d.hackathons.summary.total_participants)}
              </div>
            </div>
          </div>

          {/* Track Breakdown Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h3 className="text-lg font-semibold mb-4">Track Breakdown</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={d.hackathons.track_breakdown}>
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
                {d.hackathons.track_breakdown.map((track) => (
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

          {/* Hackathon Teams Table */}
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-6 border-b">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold">Hackathon Teams</h3>
                  <div className="text-sm text-gray-600 mt-1">
                    All registered hackathon teams
                  </div>
                </div>
                <div className="flex space-x-4 items-center">
                  <select 
                    className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    onChange={e => setTrackFilter(e.target.value)}
                    value={trackFilter}
                  >
                    <option value="">All Tracks</option>
                    <option value="hardware">Hardware</option>
                    <option value="software">Software</option>
                  </select>
                  <button
                    onClick={handleExportHackathon}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Export Excel
                  </button>
                </div>
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
                      Domain
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
                  {d.hackathons.recent_teams
                    .filter(team => !trackFilter || team.track.toLowerCase() === trackFilter)
                    .map((team) => (
                    <tr 
                      key={team.team_id} 
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => setSelectedTeam(team)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {team.team_name}
                        </div>
                        <div className="text-sm text-gray-500">
                          ID: {team.team_id}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                          {team.track}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {team.domain_name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {team.team_size} members
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          team.attended
                            ? "bg-green-100 text-green-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}>
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
        </>
      )}

      {/* Team Details Modal */}
      {selectedTeam && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">{selectedTeam.team_name}</h2>
                <p className="text-sm text-gray-500">Team ID: {selectedTeam.team_id}</p>
              </div>
              <button onClick={() => setSelectedTeam(null)} className="p-2 hover:bg-gray-100 rounded-full">
                <XMarkIcon className="h-6 w-6 text-gray-500" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <dl className="space-y-4">
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Track</dt>
                      <dd className="mt-1 text-sm text-gray-900">{selectedTeam.track}</dd>
                    </div>
                    {selectedTeam.domain_name && (
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Domain</dt>
                        <dd className="mt-1 text-sm text-gray-900">{selectedTeam.domain_name}</dd>
                      </div>
                    )}
                    {selectedTeam.problem_statement && (
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Problem Statement</dt>
                        <dd className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{selectedTeam.problem_statement}</dd>
                      </div>
                    )}
                  </dl>
                </div>
                <div>
                  <dl className="space-y-4">
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Status</dt>
                      <dd className="mt-1">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          selectedTeam.attended
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {selectedTeam.attended ? "Attended" : "Registered"}
                        </span>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Team Size</dt>
                      <dd className="mt-1 text-sm text-gray-900">{selectedTeam.team_size} members</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Registration Date</dt>
                      <dd className="mt-1 text-sm text-gray-900">{new Date(selectedTeam.created_at).toLocaleDateString()}</dd>
                    </div>
                  </dl>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Team Members</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedTeam.members?.map((member, idx) => (
                    <div key={idx} className="bg-gray-50 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900">{member.name}</h4>
                      <p className="text-sm text-gray-600">{member.email}</p>
                      {member.phone && <p className="text-sm text-gray-600">{member.phone}</p>}
                      {member.institution && <p className="text-sm text-gray-600">{member.institution}</p>}
                      <div className="mt-2 flex gap-2 text-xs">
                        {member.department && (
                          <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">
                            {member.department}
                          </span>
                        )}
                        {member.year && (
                          <span className="bg-green-100 text-green-800 px-2 py-1 rounded">
                            Year {member.year}
                          </span>
                        )}
                        {member.gender && (
                          <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded">
                            {member.gender}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// +++ START: NEW DEPARTMENT DETAIL MODAL COMPONENT +++
function DepartmentDetailModal({ department, onEventClick, onClose, onShowParticipants }) {
  const { authAxios } = useAuth();
  const [details, setDetails] = useState({
    loading: true,
    data: null,
    error: null,
  });

  useEffect(() => {
    const fetchDeptDetails = async () => {
      if (!department) return;
      try {
        setDetails({ loading: true, data: null, error: null });
        const response = await authAxios.get(
          `/analytics/department/${department.department_id}`
        );
        setDetails({ loading: false, data: response.data, error: null });
      } catch (e) {
        setDetails({
          loading: false,
          data: null,
          error: e.response?.data?.error || "Failed to load details.",
        });
      }
    };
    fetchDeptDetails();
  }, [department, authAxios]);

  const handleExport = () => {
    if (!details.data?.per_event) return;
    const dataToExport = details.data.per_event.map(ev => ({
      'Event ID': ev.event_id,
      'Event Name': ev.event_name,
      'Type': ev.event_type,
      'Registrations': ev.registrations,
      'Attendance': ev.attendance,
      'Revenue': ev.revenue,
      'Attendance Rate (%)': ev.registrations > 0 ? Math.round((ev.attendance / ev.registrations) * 100) : 0,
    }));
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Event Performance");
    XLSX.writeFile(workbook, `invente-dept-events-${department.department_name.replace(/ /g, '_')}-${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-bold text-gray-800">
            Detailed Analytics for {department.department_name}
          </h2>
          <div className="flex items-center space-x-2">
            {details.data && <button
              onClick={handleExport}
              className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
            >
              Export Events Table
            </button>}
            <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200">
              <XMarkIcon className="h-6 w-6 text-gray-600" />
            </button>
          </div>
        </div>
        <div className="overflow-y-auto p-6 bg-gray-50">
          {details.loading && (
            <div className="text-center py-10">
              Loading department details...
            </div>
          )}
          {details.error && (
            <div className="text-center text-red-500 py-10">
              {details.error}
            </div>
          )}
          {details.data && (
            <DepartmentViewContent
              data={details.data}
              refreshTime={new Date()}
              onEventClick={onEventClick}
              onShowParticipants={onShowParticipants}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// +++ START: NEW ALL EVENTS TABLE COMPONENT +++
function AllEventsTable({ onEventClick }) {
  const { authAxios } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  useEffect(() => {
    authAxios
      .get("/analytics/all-events")
      .then((res) => setEvents(res.data))
      .catch(() => setError("Could not load events."))
      .finally(() => setLoading(false));
  }, [authAxios]);

  const departments = useMemo(
    () => [...new Set(events.map((e) => e.department_name))],
    [events]
  );

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      const nameMatch = event.event_name
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      const deptMatch = departmentFilter
        ? event.department_name === departmentFilter
        : true;
      const typeMatch = typeFilter ? event.event_type === typeFilter : true;
      return nameMatch && deptMatch && typeMatch;
    });
  }, [events, searchTerm, departmentFilter, typeFilter]);

  const handleExport = () => {
    const dataToExport = filteredEvents.map((e) => ({
      "Event Name": e.event_name,
      Department: e.department_name,
      Type: e.event_type,
      Registrations: e.registrations,
      Attendance: e.attendance,
      Revenue: e.revenue,
    }));
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Events");
    XLSX.writeFile(
      workbook,
      `invente-events-${new Date().toISOString().split("T")[0]}.xlsx`
    );
  };

  if (loading)
    return <div className="text-center py-10">Loading all events...</div>;
  if (error)
    return <div className="text-center text-red-500 py-10">{error}</div>;

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="p-4 border-b space-y-4 md:space-y-0 md:flex md:items-center md:justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold">All Events</h3>
          <p className="text-sm text-gray-500">
            Search, filter, and view details for any event.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <input
            type="text"
            placeholder="Search events..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border rounded px-2 py-1.5 w-40 text-sm"
          />
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="border rounded px-2 py-1.5 text-sm"
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="border rounded px-2 py-1.5 text-sm"
          >
            <option value="">All Types</option>
            <option value="technical">Technical</option>
            <option value="non-technical">Non-Technical</option>
            <option value="workshop">Workshop</option>
          </select>
          <button
            onClick={handleExport}
            className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
          >
            Export
          </button>
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
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredEvents.length === 0 ? (
              <tr>
                <td colSpan="5" className="text-center py-10 text-gray-500">
                  No events match your criteria.
                </td>
              </tr>
            ) : (
              filteredEvents.map((ev) => (
                <tr
                  key={ev.event_id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => onEventClick(ev)}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {ev.event_name}
                    </div>
                    <div className="text-sm text-gray-500">
                      {ev.department_name}
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
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Workshop view component for workshop_admin
function WorkshopViewContent({ data, refreshTime, authAxios, onEventClick, selectedEvent, setSelectedEvent }) {
  const [activeTab, setActiveTab] = useState("workshops");
  const [workshopEvents, setWorkshopEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedStaff, setSelectedStaff] = useState(null);

  // Debug: Log the data structure
  console.log('WorkshopViewContent received data:', data);

  const tabs = [
    { id: "workshops", label: "Workshop Analytics", icon: "🔧" },
    { id: "staff", label: "Staff & Revenue", icon: "👥" },
  ];

  // Export handler for workshop staff
  const handleWorkshopStaffExport = () => {
    if (!data?.workshop_staff) return;
    const dataToExport = data.workshop_staff.map(staff => ({
      'Staff Name': staff.name,
      'Email': staff.personal_email,
      'Phone': staff.phone,
      'Role': staff.role === 'workshop_admin' ? 'Workshop Admin' : 'Workshop Volunteer',
      'Department': staff.department_name || 'Workshop',
      'Passes Assigned': staff.passes_assigned,
      'Revenue via UPI': staff.upi_collected,
      'Revenue via Cash': staff.cash_collected,
      'Total Revenue': staff.total_collected,
    }));
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Workshop Staff Revenue");
    XLSX.writeFile(workbook, `invente-workshop-staff-revenue-${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  // Fetch workshop events for event-level analytics
  useEffect(() => {
    const fetchWorkshopEvents = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await authAxios.get('/events/public');
        const workshops = response.data.rows.filter(event => event.event_type === 'workshop');
        setWorkshopEvents(workshops);
      } catch (e) {
        setError('Failed to load workshop events');
      } finally {
        setLoading(false);
      }
    };
    fetchWorkshopEvents();
  }, [authAxios]);

  const handleEventClick = async (eventId) => {
    try {
      const response = await authAxios.get(`/analytics/event?event_id=${eventId}`);
      onEventClick({ ...response.data, event_id: eventId });
    } catch (e) {
      console.error('Failed to fetch event analytics:', e);
    }
  };

  // Show loading or error states
  if (!data) {
    return (
      <div className="p-6">
        <div className="text-center">
          <div className="text-gray-500">Loading workshop analytics...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {selectedEvent && (
        <EventDetailModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      )}
      {selectedStaff && (
        <VolunteerDetailModal
          volunteer={selectedStaff}
          onClose={() => setSelectedStaff(null)}
        />
      )}
      
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Workshop Analytics</h1>
        <p className="text-gray-600">Last updated: {refreshTime.toLocaleTimeString()}</p>
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
      {activeTab === "workshops" && (
        <div className="space-y-6">
          {/* Workshop Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-500 mb-1">Total Workshops</div>
          <div className="text-2xl font-bold text-blue-600">
            {fmt(data?.summary?.total_workshops || 0)}
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-500 mb-1">Total Registrations</div>
          <div className="text-2xl font-bold text-green-600">
            {fmt(data?.summary?.total_registrations || 0)}
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-500 mb-1">Total Attendance</div>
          <div className="text-2xl font-bold text-purple-600">
            {fmt(data?.summary?.total_attendance || 0)}
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-500 mb-1">Total Revenue</div>
          <div className="text-2xl font-bold text-orange-600">
            {formatCurrency(data?.summary?.total_revenue || 0)}
          </div>
        </div>
      </div>

      {/* Workshop Analytics Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Workshop Performance</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Workshop
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Registrations
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Attendance
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Attendance Rate
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Revenue
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data?.workshops && Array.isArray(data.workshops) && data.workshops.map((workshop) => {
                const attendanceRate = workshop.registrations > 0 
                  ? ((workshop.attendance / workshop.registrations) * 100).toFixed(1)
                  : '0.0';
                
                return (
                  <tr key={workshop.event_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {workshop.event_name}
                      </div>
                      <div className="text-sm text-gray-500">
                        ID: {workshop.event_id}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {fmt(workshop.registrations)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {fmt(workshop.attendance)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="text-sm text-gray-900">{attendanceRate}%</div>
                        <div className="ml-2 w-16 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full" 
                            style={{ width: `${attendanceRate}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {formatCurrency(workshop.revenue)}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <button
                        onClick={() => handleEventClick(workshop.event_id)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                );
              })}
              {(!data?.workshops || !Array.isArray(data.workshops) || data.workshops.length === 0) && (
                <tr>
                  <td colSpan="6" className="px-6 py-4 text-center text-gray-500">
                    No workshop data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

          {/* Chart Section */}
          <div className="mt-8 bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Workshop Revenue Distribution</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data?.workshops && Array.isArray(data.workshops) ? data.workshops : []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="event_name" 
                  angle={-45}
                  textAnchor="end"
                  height={100}
                />
                <YAxis />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Bar dataKey="revenue" fill="#3B82F6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {activeTab === "staff" && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-6 border-b flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold">Workshop Staff & Revenue Performance</h3>
                <div className="text-sm text-gray-600 mt-1">Pass assignments and revenue collected by workshop staff.</div>
              </div>
              <button
                onClick={handleWorkshopStaffExport}
                className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
              >
                Export Table
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Staff Member
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role & Department
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Passes Assigned
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Revenue via UPI
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Revenue via Cash
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data?.workshop_staff &&
                    data.workshop_staff.map((staff) => (
                      <tr
                        key={staff.personal_email}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => setSelectedStaff(staff)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {staff.name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {staff.personal_email} | {staff.phone || "No Phone"}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {staff.role === 'workshop_admin' ? 'Workshop Admin' : 'Workshop Volunteer'}
                          </div>
                          {staff.department_name && (
                            <div className="text-sm text-gray-500">
                              {staff.department_name}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-left">
                          {fmt(staff.passes_assigned)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-left">
                          {formatCurrency(staff.upi_collected)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-left">
                          {formatCurrency(staff.cash_collected)}
                        </td>
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

// +++ FIXED: Moved ParticipantListModal outside the parent component +++
function ParticipantListModal({
  modalConfig,
  onClose,
  listData,
  filters,
  onFilterChange,
  onExport,
  authAxios,
  setParticipantLists // We'll need the setter for the useEffect
}) {
  const { scope, title, eventId, departmentId } = modalConfig;

  // Fetch data when modal opens or filters change
  useEffect(() => {
    console.log('ParticipantListModal useEffect:', { scope, eventId, departmentId, condition: scope && (scope === 'college' || eventId || departmentId) });
    if (scope && (scope === 'college' || eventId || departmentId)) {
      const fetchData = async () => {
        setParticipantLists(prev => ({
          ...prev,
          [scope]: { ...prev[scope], loading: true, error: null }
        }));

        try {
          const params = new URLSearchParams();
          if (filters.payment_method) params.append('payment_method', filters.payment_method);
          if (filters.attended) params.append('attended', filters.attended);
          if (filters.event_type) params.append('event_type', filters.event_type);
          if (filters.department_id) params.append('department_id', filters.department_id);

          let url = '';
          if (scope === 'event' && eventId) {
            url = `/analytics/event/${eventId}/participants?${params.toString()}`;
          } else if (scope === 'department' && departmentId) {
            url = `/analytics/department/${departmentId}/participants?${params.toString()}`;
          } else if (scope === 'college') {
            url = `/analytics/college/participants?${params.toString()}`;
          }

          console.log('Fetching participants:', { scope, eventId, departmentId, url });

          if (url) {
            const response = await authAxios.get(url);
            setParticipantLists(prev => ({
              ...prev,
              [scope]: { data: response.data, loading: false, error: null }
            }));
          }
        } catch (error) {
          setParticipantLists(prev => ({
            ...prev,
            [scope]: { ...prev[scope], loading: false, error: error.response?.data?.error || String(error) }
          }));
        }
      };
      fetchData();
    }
  }, [scope, eventId, departmentId, filters, authAxios, setParticipantLists]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-6xl w-full mx-4 max-h-[90vh] flex flex-col">
        <div className="p-6 border-b">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">{title} - Participant List</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>
          
          {/* Filters */}
          <div className={`mt-4 grid grid-cols-2 gap-4 ${scope === 'event' ? 'md:grid-cols-3' : 'md:grid-cols-4'}`}>
            <select
              value={filters.payment_method}
              onChange={(e) => onFilterChange('payment_method', e.target.value)}
              className="border rounded px-3 py-2 text-sm"
            >
              <option value="">All Payment Methods</option>
              <option value="online">Online</option>
              <option value="offline">Offline</option>
            </select>
            <select
              value={filters.attended}
              onChange={(e) => onFilterChange('attended', e.target.value)}
              className="border rounded px-3 py-2 text-sm"
            >
              <option value="">All Attendance</option>
              <option value="true">Attended</option>
              <option value="false">Not Attended</option>
            </select>
            {scope !== 'event' && (
              <select
                value={filters.event_type}
                onChange={(e) => onFilterChange('event_type', e.target.value)}
                className="border rounded px-3 py-2 text-sm"
              >
                <option value="">All Event Types</option>
                <option value="technical">Technical</option>
                <option value="non-technical">Non-Technical</option>
                <option value="hackathon">Hackathon</option>
                <option value="workshop">Workshop</option>
              </select>
            )}
            {scope === 'college' && (
              <select
                value={filters.department_id}
                onChange={(e) => onFilterChange('department_id', e.target.value)}
                className="border rounded px-3 py-2 text-sm"
              >
                <option value="">All Departments</option>
                <option value="1">CSE</option>
                <option value="2">IT</option>
                <option value="3">AI&DS</option>
                <option value="4">ECE</option>
                <option value="5">EEE</option>
                <option value="6">MECH</option>
                <option value="7">CIVIL</option>
                <option value="8">CHEM</option>
              </select>
            )}
          </div>
          
          {/* Export button */}
          <div className="mt-4">
            <button
              onClick={() => onExport(scope, listData.data)}
              disabled={!listData.data || listData.loading}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 text-sm"
            >
              Export to Excel
            </button>
          </div>
        </div>
        
        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 180px)' }}>
          {listData.loading && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
              <div>Loading participants...</div>
            </div>
          )}
          
          {listData.error && (
            <div className="text-red-600 text-center py-8">
              Error loading participants: {listData.error}
            </div>
          )}
          
          {listData.data && !listData.loading && (
            <div>
              {/* Main participants table */}
              {listData.data.participants?.length > 0 && (
                <div className="mb-6">
                  <h4 className="font-semibold mb-3">Regular Events ({listData.data.participants.length} participants)</h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      {/* ... table content remains the same ... */}
                    </table>
                  </div>
                </div>
              )}
              
              {/* Hackathon participants table */}
              {listData.data.hackathon_participants?.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-3">Hackathon Participants ({listData.data.hackathon_participants.length} participants from {[...new Set(listData.data.hackathon_participants.map(h => h.team_name))].length} teams)</h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                       {/* ... table content remains the same ... */}
                    </table>
                  </div>
                </div>
              )}
              
              {/* Workshop participants table */}
              {listData.data.workshop_participants?.length > 0 && (
                <div className="mt-6">
                  <h4 className="font-semibold mb-3">Workshop Participants ({listData.data.workshop_participants.length} participants)</h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                       {/* ... table content remains the same ... */}
                    </table>
                  </div>
                </div>
              )}

              {(!listData.data.participants || listData.data.participants.length === 0) &&
               (!listData.data.hackathon_participants || listData.data.hackathon_participants.length === 0) &&
               (!listData.data.workshop_participants || listData.data.workshop_participants.length === 0) && (
                <div className="text-center py-8 text-gray-500">
                  No participants found with current filters
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
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
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [trackFilter, setTrackFilter] = useState("");
  const [selectedTeam, setSelectedTeam] = useState(null);
  
  // Participant list states
  const [participantLists, setParticipantLists] = useState({
    event: { data: null, loading: false, error: null },
    department: { data: null, loading: false, error: null },
    college: { data: null, loading: false, error: null }
  });
  const [participantFilters, setParticipantFilters] = useState({
    payment_method: "",
    attended: "",
    event_type: "",
    department_id: ""
  });
  const [showParticipantModal, setShowParticipantModal] = useState(null);

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
      } else if (user?.role === "workshop_admin") {
        const resp = await authAxios.get("/analytics/workshops");
        console.log('Workshop admin received data:', resp.data);
        setStats({ scope: "workshop", data: resp.data });
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

  // Filter change handler
  const handleFilterChange = (filterName, value) => {
    setParticipantFilters(prev => ({
      ...prev,
      [filterName]: value
    }));
  };

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

  // Export functions for individual event types
  const handleExportTech = () => {
    if (!stats?.data) return;
    const techEvents = stats.data.event_type_breakdown.filter(e => e.event_type === 'technical');
    const dataToExport = [{
      'Event Type': 'Technical',
      'Total Registrations': stats.data.totals.tech_registrations,
      'Total Revenue': stats.data.totals.tech_revenue,
      'Online Payment %': (() => {
        const techData = stats.data.payment_by_event_type?.filter(p => p.event_type === 'technical') || [];
        const onlineCount = techData.find(p => p.method === 'online')?.passes || 0;
        const totalCount = techData.reduce((sum, p) => sum + p.passes, 0);
        return totalCount > 0 ? Math.round((onlineCount / totalCount) * 100) : 0;
      })() + '%'
    }];
    
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Technical Events");
    XLSX.writeFile(workbook, `invente25-technical-events-${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const handleExportNonTech = () => {
    if (!stats?.data) return;
    const dataToExport = [{
      'Event Type': 'Non-Technical',
      'Total Registrations': stats.data.totals.nontech_registrations,
      'Total Revenue': stats.data.totals.nontech_revenue,
      'Online Payment %': (() => {
        const nontechData = stats.data.payment_by_event_type?.filter(p => p.event_type === 'non-technical') || [];
        const onlineCount = nontechData.find(p => p.method === 'online')?.passes || 0;
        const totalCount = nontechData.reduce((sum, p) => sum + p.passes, 0);
        return totalCount > 0 ? Math.round((onlineCount / totalCount) * 100) : 0;
      })() + '%'
    }];
    
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Non-Technical Events");
    XLSX.writeFile(workbook, `invente25-nontech-events-${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const handleExportWorkshop = () => {
    if (!stats?.data?.workshops?.analytics) return;
    
    const workbook = XLSX.utils.book_new();
    
    // Individual workshop details
    const workshopDetails = stats.data.workshops.analytics.map(ws => ({
      'Workshop Name': ws.event_name,
      'Workshop ID': ws.event_id,
      'Cost': ws.cost,
      'Registrations': ws.registrations,
      'Attendance': ws.attendance,
      'Revenue': ws.revenue,
      'Attendance Rate': ws.registrations > 0 ? `${Math.round((ws.attendance / ws.registrations) * 100)}%` : '0%'
    }));
    
    const detailsWorksheet = XLSX.utils.json_to_sheet(workshopDetails);
    XLSX.utils.book_append_sheet(workbook, detailsWorksheet, "Workshop Details");
    
    // Summary sheet
    const summaryData = [{
      'Metric': 'Total Workshops',
      'Value': stats.data.workshops.summary.total_workshops
    }, {
      'Metric': 'Total Registrations',
      'Value': stats.data.workshops.summary.total_registrations
    }, {
      'Metric': 'Total Revenue',
      'Value': stats.data.workshops.summary.total_revenue
    }, {
      'Metric': 'Average Revenue per Workshop',
      'Value': stats.data.workshops.summary.total_workshops > 0 ? 
        (stats.data.workshops.summary.total_revenue / stats.data.workshops.summary.total_workshops).toFixed(2) : 0
    }];
    
    const summaryWorksheet = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summaryWorksheet, "Workshop Summary");
    
    XLSX.writeFile(workbook, `invente25-workshops-detailed-${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const handleExportHackathonMain = () => {
    if (!stats?.data) return;
    const dataToExport = [{
      'Event Type': 'Hackathon',
      'Total Teams': stats.data.totals.hackathon_teams,
      'Total Revenue': stats.data.totals.hackathon_revenue,
      'Online Payment %': (() => {
        const hackData = stats.data.payment_by_event_type?.filter(p => p.event_type === 'hackathon') || [];
        const onlineCount = hackData.find(p => p.method === 'online')?.passes || 0;
        const totalCount = hackData.reduce((sum, p) => sum + p.passes, 0);
        return totalCount > 0 ? Math.round((onlineCount / totalCount) * 100) : 0;
      })() + '%'
    }];
    
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Hackathon Events");
    XLSX.writeFile(workbook, `invente25-hackathon-events-${new Date().toISOString().split("T")[0]}.xlsx`);
  };

    // +++ NEW: Export handler for the main volunteer summary table +++
    const handleVolunteersExport = () => {
      if (!stats?.data?.central_volunteers) return;
      const dataToExport = stats.data.central_volunteers.map(vol => ({
        'Staff Name': vol.name,
        'Email': vol.personal_email,
        'Phone': vol.phone,
        'Role': vol.role === 'dept_admin' ? 'Department Admin' :
               vol.role === 'master_admin' ? 'Master Admin' :
               vol.role === 'workshop_admin' ? 'Workshop Admin' :
               vol.role === 'workshop_volunteer' ? 'Workshop Volunteer' :
               vol.department_name ? 'Department Volunteer' : 'Central Volunteer',
        'Department': vol.department_name || 'Central',
        'Passes Assigned': vol.passes_assigned,
        'Revenue via UPI': vol.upi_collected,
        'Revenue via Cash': vol.cash_collected,
        'Total Revenue': vol.total_collected,
      }));
      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Staff Revenue");
      XLSX.writeFile(workbook, `invente-staff-revenue-${new Date().toISOString().split("T")[0]}.xlsx`);
    };

    // Export handler for hackathon teams with detailed member information
    const handleExportHackathon = () => {
      if (!stats?.data?.hackathons?.recent_teams) return;
      
      // Filter teams based on current track filter
      const teamsToExport = stats.data.hackathons.recent_teams
        .filter(team => !trackFilter || team.track.toLowerCase() === trackFilter);

      // Find maximum number of team members
      const maxMembers = Math.max(...teamsToExport.map(team => team.members?.length || 0));

      const dataToExport = teamsToExport.map(team => {
        // Base team information
        const baseData = {
          'Team Name': team.team_name,
          'Team ID': team.team_id,
          'Track': team.track,
          'Domain': team.domain_name || '-',
          'Team Size': team.team_size,
          'Status': team.attended ? 'Attended' : 'Registered',
          'Registration Date': new Date(team.created_at).toLocaleDateString(),
          'Problem Statement': team.problem_statement || '-',
        };

        // Add member details in separate columns
        for (let i = 0; i < maxMembers; i++) {
          const member = team.members?.[i] || {};
          baseData[`Member ${i + 1} Name`] = member.name || '';
          baseData[`Member ${i + 1} Email`] = member.email || '';
          baseData[`Member ${i + 1} Phone`] = member.phone || '';
          baseData[`Member ${i + 1} Institution`] = member.institution || '';
          baseData[`Member ${i + 1} Department`] = member.department || '';
          baseData[`Member ${i + 1} Year`] = member.year || '';
        }

        return baseData;
      });

      // Create worksheet with the data
      const worksheet = XLSX.utils.json_to_sheet(dataToExport);

      // Set column widths for better readability
      const columnWidths = {
        'A': 20, // Team Name
        'B': 15, // Team ID
        'C': 15, // Track
        'D': 20, // Domain
        'E': 10, // Team Size
        'F': 12, // Status
        'G': 15, // Registration Date
        'H': 40, // Problem Statement
      };

      // Start from I column for member details (assuming 8 columns for base data)
      const memberColumns = maxMembers * 6; // 6 columns per member
      for (let i = 0; i < memberColumns; i++) {
        const col = String.fromCharCode(73 + i); // Start from I
        columnWidths[col] = 20;
      }

      worksheet['!cols'] = Object.keys(columnWidths).map(key => ({
        wch: columnWidths[key]
      }));

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Hackathon Teams");
      
      // Generate filename with current date
      const filename = `invente-hackathon-teams-${new Date().toISOString().split("T")[0]}.xlsx`;
      
      try {
        XLSX.writeFile(workbook, filename);
      } catch (error) {
        console.error("Failed to export Excel file:", error);
      }
    };

  // Export participant lists
  const handleExportParticipants = (scope, data) => {
    if (!data) return;

    const { participants = [], workshop_participants = [], hackathon_participants = [] } = data;
    
    // Only proceed if we have participants
    if (participants.length === 0 && workshop_participants.length === 0 && hackathon_participants.length === 0) {
      alert('No participants to export');
      return;
    }

    const workbook = XLSX.utils.book_new();
    
    // Add regular participants sheet if available
    if (participants.length > 0) {
      let mainData;
      
      if (scope === 'event') {
        // Event admin export - simplified columns relevant to single event
        mainData = participants.map(p => ({
          'Name': p.name,
          'Email': p.user_email,
          'Phone': p.phone,
          'Institution': p.institution,
          'Pass ID': p.pass_id || 'N/A',
          'Slot Number': p.slot_number || 'N/A',
          'Attended': p.attended_this_event ? 'Yes' : 'No',
          'Registration Date': new Date(p.registration_date).toLocaleDateString()
        }));
      } else {
        // Department/College admin export - full aggregated data
        mainData = participants.map(p => ({
          'Name': p.name,
          'Email': p.user_email,
          'Phone': p.phone,
          'Institution': p.institution,
          'Total Passes': p.total_passes,
          'Registered Events': p.registered_events || 'N/A',
          'Total Registrations': p.total_registrations,
          'Attended Events': p.attended_count,
          'Attendance Status': `${p.attended_count}/${p.total_registrations} events`,
          'Overall Attended': p.attended_any_event ? 'Yes' : 'No',
          'First Registration Date': new Date(p.first_registration_date).toLocaleDateString()
        }));
      }

      const worksheet = XLSX.utils.json_to_sheet(mainData);
      XLSX.utils.book_append_sheet(workbook, worksheet, "Participants");
    }

    // Add workshop participants sheet if available
    if (workshop_participants.length > 0) {
      const workshopData = workshop_participants.map(w => ({
        'Name': w.name,
        'Email': w.user_email,
        'Phone': w.phone,
        'Institution': w.institution,
        'Payment Method': w.payment_method,
        'Workshop Name': w.event_name || 'N/A',
        'Event Type': 'Workshop',
        'Department': w.department_name || 'WORKSHOP',
        'Attended': w.attended ? 'Yes' : 'No',
        'Registration Date': new Date(w.registration_date).toLocaleDateString()
      }));

      const workshopWorksheet = XLSX.utils.json_to_sheet(workshopData);
      XLSX.utils.book_append_sheet(workbook, workshopWorksheet, "Workshop Participants");
    }

    // Add hackathon participants sheet if available
    if (hackathon_participants.length > 0) {
      const hackData = hackathon_participants.map(h => ({
        'Name': h.name,
        'Email': h.user_email,
        'Phone': h.phone,
        'Institution': h.institution,
        'Event Type': 'Hackathon',
        'Team Name': h.team_name,
        'Track': h.track,
        'Department': h.department_name || 'ECE',
        'Attended': h.attended ? 'Yes' : 'No',
        'Registration Date': new Date(h.registration_date).toLocaleDateString()
      }));

      const hackWorksheet = XLSX.utils.json_to_sheet(hackData);
      XLSX.utils.book_append_sheet(workbook, hackWorksheet, "Hackathon Participants");
    }

    const filename = `invente25-participants-${scope}-${new Date().toISOString().split("T")[0]}.xlsx`;
    
    try {
      XLSX.writeFile(workbook, filename);
      console.log('Export successful:', filename);
    } catch (error) {
      console.error("Failed to export participant list:", error);
      alert('Export failed: ' + error.message);
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
        {selectedEvent && (
          <EventDetailModal
            event={selectedEvent}
            onClose={() => setSelectedEvent(null)}
          />
        )}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">
            Event Analytics — {d.event?.name} (ID: {d.event?.external_id})
          </h2>
          <div className="text-sm text-gray-500">
            Last updated: {refreshTime.toLocaleTimeString()}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="text-sm text-gray-500 mb-1">Registrations</div>
            <div className="text-3xl font-bold text-blue-600">
              {fmt(d.totals.registrations)}
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="text-sm text-gray-500 mb-1">Online Registered</div>
            <div className="text-3xl font-bold text-purple-600">
              {fmt(d.totals.online_registered || 0)}
            </div>
            <div className="text-sm text-gray-500 mt-1">
              {d.totals.online_percentage || '0.0'}% online
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
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="text-sm text-gray-500 mb-1">Actions</div>
            <button
              onClick={() => setShowParticipantModal({
                scope: 'event',
                title: d.event?.name,
                eventId: d.event?.external_id
              })}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
            >
              View Participants
            </button>
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
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Phone
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Institution
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
                {(d.registrations && d.registrations.length > 0) ? 
                  d.registrations.map((r) => (
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
                        {r.user_name || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {r.user_email || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {r.user_phone || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {r.user_institution || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {r.attended ? "Yes" : "No"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(r.created_at).toLocaleString()}
                      </td>
                    </tr>
                  )) :
                  <tr>
                    <td colSpan="8" className="px-6 py-4 text-center text-sm text-gray-500">
                      No registrations found for this event
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
        
        {showParticipantModal && (
          <ParticipantListModal
            modalConfig={showParticipantModal}
            onClose={() => setShowParticipantModal(null)}
            listData={participantLists[showParticipantModal.scope]}
            filters={participantFilters}
            onFilterChange={handleFilterChange}
            onExport={handleExportParticipants}
            authAxios={authAxios}
            setParticipantLists={setParticipantLists}
          />
        )}
      </div>
    );
  }

  // Department view
  if (stats.scope === "department") {
    return (
      <div className="p-6">
        {selectedEvent && (
          <EventDetailModal
            event={selectedEvent}
            onClose={() => setSelectedEvent(null)}
          />
        )}
        <DepartmentViewContent 
          data={stats.data} 
          refreshTime={refreshTime} 
          onEventClick={(event) => setSelectedEvent(event)}
          onShowParticipants={(modalData) => setShowParticipantModal(modalData)}
        />
        
        {showParticipantModal && (
          <ParticipantListModal
            modalConfig={showParticipantModal}
            onClose={() => setShowParticipantModal(null)}
            listData={participantLists[showParticipantModal.scope]}
            filters={participantFilters}
            onFilterChange={handleFilterChange}
            onExport={handleExportParticipants}
            authAxios={authAxios}
            setParticipantLists={setParticipantLists}
          />
        )}
      </div>
    );
  }

  // Workshop view (workshop_admin)
  if (stats.scope === "workshop") {
    return <WorkshopViewContent 
      data={stats.data} 
      refreshTime={refreshTime} 
      authAxios={authAxios}
      onEventClick={(event) => setSelectedEvent(event)}
      selectedEvent={selectedEvent}
      setSelectedEvent={setSelectedEvent}
    />;
  }

  // College view (super_admin and master_admin)
  const c = stats.data;
  const tabs = [
    // Reorganized Tabs
    { id: "overview", label: "Overview", icon: "📊" },
    { id: "departments", label: "Departments", icon: "🏢" },
    { id: "events", label: "Events", icon: "🎟️" },
    { id: "workshops", label: "Workshops", icon: "🔧" },
    { id: "hackathons", label: "Hackathons", icon: "💻" },
    { id: "volunteers", label: "Staff & Revenue", icon: "👥" },
  ];

  return (
    <div className="p-6">
      {selectedVolunteer && (
        <VolunteerDetailModal
          volunteer={selectedVolunteer}
          onClose={() => setSelectedVolunteer(null)}
        />
      )}
      {selectedEvent && (
        <EventDetailModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      )}
      {selectedDepartment && (
        <DepartmentDetailModal
          department={selectedDepartment}
          onEventClick={(event) => setSelectedEvent(event)}
          onClose={() => setSelectedDepartment(null)}
          onShowParticipants={(modalData) => setShowParticipantModal(modalData)}
        />
      )}
      {/* Header */}
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
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleExport}
              className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-xs"
            >
              Export All
            </button>
            <button
              onClick={handleExportTech}
              className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs"
            >
              Export Tech
            </button>
            <button
              onClick={handleExportNonTech}
              className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-xs"
            >
              Export Non-Tech
            </button>

            <button
              onClick={handleExportHackathonMain}
              className="px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-xs"
            >
              Export Hackathon
            </button>
          </div>
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
          {/* Event Type Registrations & Revenue */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Technical Events */}
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="text-sm text-gray-500 mb-1">Technical Events</div>
              <div className="text-2xl font-bold text-blue-600">
                {fmt(c.totals.tech_registrations)} reg
              </div>
              <div className="text-lg font-semibold text-blue-500 mt-1">
                {formatCurrency(c.totals.tech_revenue)}
              </div>
              <div className="text-sm text-blue-600 mt-1">
                {fmt(c.totals.tech_passes_count || 0)} passes
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Online: {(() => {
                  const techData = c.payment_by_event_type?.filter(p => p.event_type === 'technical') || [];
                  const onlineCount = techData.find(p => p.method === 'online')?.passes || 0;
                  const totalCount = techData.reduce((sum, p) => sum + p.passes, 0);
                  return totalCount > 0 ? `${Math.round((onlineCount / totalCount) * 100)}%` : '0%';
                })()}
              </div>
            </div>
            
            {/* Non-Technical Events */}
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="text-sm text-gray-500 mb-1">Non-Technical Events</div>
              <div className="text-2xl font-bold text-green-600">
                {fmt(c.totals.nontech_teams || c.totals.nontech_registrations)} teams
                {c.totals.nontech_participants && (
                  <span className="text-sm font-normal"> • {fmt(c.totals.nontech_participants)} participants</span>
                )}
              </div>
              <div className="text-lg font-semibold text-green-500 mt-1">
                {formatCurrency(c.totals.nontech_revenue)}
              </div>
            </div>
            
            {/* Workshop Events */}
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="text-sm text-gray-500 mb-1">Workshop Events</div>
              <div className="text-2xl font-bold text-purple-600">
                {fmt(c.totals.workshop_registrations)} reg
              </div>
              <div className="text-lg font-semibold text-purple-500 mt-1">
                {formatCurrency(c.totals.workshop_revenue)}
              </div>
            </div>
            
            {/* Hackathon Events */}
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="text-sm text-gray-500 mb-1">Hackathon Teams</div>
              <div className="text-2xl font-bold text-orange-600">
                {fmt(c.totals.hackathon_teams)} teams
              </div>
              <div className="text-lg font-semibold text-orange-500 mt-1">
                {formatCurrency(c.totals.hackathon_revenue)}
              </div>
            </div>
          </div>

          {/* Online Registrant Attendance % by Event Type */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Technical Online Attendance % */}
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <div className="text-sm text-gray-500 mb-1">Tech - Online Attendance %</div>
              <div className="text-xl font-bold text-blue-600">
                {(() => {
                  const techOnlineData = c.attendance_by_payment_type?.find(p => p.event_type === 'technical' && p.method === 'online');
                  if (!techOnlineData || techOnlineData.total_registrations === 0) return '0%';
                  return `${Math.round((techOnlineData.attended_count / techOnlineData.total_registrations) * 100)}%`;
                })()}
              </div>
            </div>
            
            {/* Workshop Online Attendance % */}
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <div className="text-sm text-gray-500 mb-1">Workshop - Online Attendance %</div>
              <div className="text-xl font-bold text-purple-600">
                {(() => {
                  const workshopOnlineData = c.attendance_by_payment_type?.find(p => p.event_type === 'workshop' && p.method === 'online');
                  if (!workshopOnlineData || workshopOnlineData.total_registrations === 0) return '0%';
                  return `${Math.round((workshopOnlineData.attended_count / workshopOnlineData.total_registrations) * 100)}%`;
                })()}
              </div>
            </div>
            
            {/* Hackathon Online Attendance % */}
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <div className="text-sm text-gray-500 mb-1">Hackathon - Online Attendance %</div>
              <div className="text-xl font-bold text-orange-600">
                {(() => {
                  const hackOnlineData = c.attendance_by_payment_type?.find(p => p.event_type === 'hackathon' && p.method === 'online');
                  if (!hackOnlineData || hackOnlineData.total_registrations === 0) return '0%';
                  return `${Math.round((hackOnlineData.attended_count / hackOnlineData.total_registrations) * 100)}%`;
                })()}
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

          {/* Participant Management Section */}
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h3 className="text-lg font-semibold mb-4">Participant Management</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={() => setShowParticipantModal({
                  scope: 'college',
                  title: 'All College Participants'
                })}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                View All Participants
              </button>
              <button
                onClick={() => {
                  // Export college-level summary
                  const summaryData = [{
                    'Total Registrations': c.totals.tech_registrations + (c.totals.nontech_teams || c.totals.nontech_registrations) + c.totals.workshop_registrations,
                    'Technical Events': c.totals.tech_registrations,
                    'Non-Technical Teams': c.totals.nontech_teams || c.totals.nontech_registrations,
                    ...(c.totals.nontech_participants ? { 'Non-Technical Participants': c.totals.nontech_participants } : {}),
                    'Workshop Events': c.totals.workshop_registrations,
                    'Hackathon Teams': c.totals.hackathon_teams,
                    'Total Revenue': formatCurrency(c.totals.tech_revenue + c.totals.nontech_revenue + c.totals.workshop_revenue + c.totals.hackathon_revenue)
                  }];
                  const worksheet = XLSX.utils.json_to_sheet(summaryData);
                  const workbook = XLSX.utils.book_new();
                  XLSX.utils.book_append_sheet(workbook, worksheet, "College Summary");
                  XLSX.writeFile(workbook, `invente25-college-summary-${new Date().toISOString().split("T")[0]}.xlsx`);
                }}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Export Summary
              </button>
              <button
                onClick={handleExport}
                className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
              >
                Export Detailed Analytics
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === "departments" && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold">Department Performance</h3>
              <p className="text-sm text-gray-600 mt-1">
                Click a department row for a detailed breakdown. Revenue shown is from non-technical events only.
              </p>
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
                      Non-Technical Revenue
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Rate
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                {c.per_department.map((dpt) => (
                  <tr key={dpt.department_id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedDepartment(dpt)}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{dpt.department_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{fmt(dpt.event_count)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{fmt(dpt.registrations)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{fmt(dpt.attendance)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatCurrency(dpt.revenue)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{dpt.registrations > 0 ? `${Math.round((dpt.attendance / dpt.registrations) * 100)}%` : '0%'}</td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* +++ NEW TAB for All Events +++ */}
      {activeTab === "events" && (
        <AllEventsTable onEventClick={(event) => setSelectedEvent(event)} />
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
            <div className="p-6 border-b flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold">Workshop Performance</h3>
                <div className="text-sm text-gray-600 mt-1">
                  Detailed workshop analytics
                </div>
              </div>
              <button
                onClick={handleExportWorkshop}
                className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm"
              >
                Export Workshops
              </button>
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={async () => {
                            try {
                              const response = await authAxios.get(`/analytics/event?event_id=${ws.event_id}`);
                              setSelectedEvent({ ...response.data, event_id: ws.event_id });
                            } catch (e) {
                              console.error('Failed to fetch workshop analytics:', e);
                            }
                          }}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          View Details
                        </button>
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
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold">Hackathon Teams</h3>
                  <div className="text-sm text-gray-600 mt-1">
                    All registered hackathon teams
                  </div>
                </div>
                <div className="flex space-x-4 items-center">
                  <select 
                    className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    onChange={e => setTrackFilter(e.target.value)}
                    value={trackFilter}
                  >
                    <option value="">All Tracks</option>
                    <option value="hardware">Hardware</option>
                    <option value="software">Software</option>
                  </select>
                  <button
                    onClick={handleExportHackathon}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Export Excel
                  </button>
                </div>
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
                      Domain
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
                  {c.hackathons.recent_teams
                    .filter(team => !trackFilter || team.track.toLowerCase() === trackFilter)
                    .map((team) => (
                    <tr 
                      key={team.team_id} 
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => setSelectedTeam(team)}
                    >
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
                        {team.domain_name || '-'}
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
          
          {/* Team Details Modal */}
          {selectedTeam && (
            <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
              <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center p-6 border-b">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-800">{selectedTeam.team_name}</h2>
                    <p className="text-sm text-gray-500">Team ID: {selectedTeam.team_id}</p>
                  </div>
                  <button onClick={() => setSelectedTeam(null)} className="p-2 hover:bg-gray-100 rounded-full">
                    <XMarkIcon className="h-6 w-6 text-gray-600" />
                  </button>
                </div>
                <div className="p-6 overflow-y-auto">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="text-lg font-semibold mb-4">Team Information</h3>
                      <dl className="space-y-2">
                        <div>
                          <dt className="text-sm font-medium text-gray-500">Track</dt>
                          <dd className="mt-1 text-sm text-gray-900">{selectedTeam.track}</dd>
                        </div>
                        {selectedTeam.domain_name && (
                          <div>
                            <dt className="text-sm font-medium text-gray-500">Domain</dt>
                            <dd className="mt-1 text-sm text-gray-900">{selectedTeam.domain_name}</dd>
                          </div>
                        )}
                        {selectedTeam.problem_statement && (
                          <div>
                            <dt className="text-sm font-medium text-gray-500">Problem Statement</dt>
                            <dd className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{selectedTeam.problem_statement}</dd>
                          </div>
                        )}
                        <div>
                          <dt className="text-sm font-medium text-gray-500">Registration Status</dt>
                          <dd className="mt-1">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              selectedTeam.attended
                                ? "bg-green-100 text-green-800"
                                : "bg-yellow-100 text-yellow-800"
                            }`}>
                              {selectedTeam.attended ? "Attended" : "Registered"}
                            </span>
                          </dd>
                        </div>
                      </dl>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold mb-4">Team Members</h3>
                      <div className="space-y-4">
                        {selectedTeam.members?.map((member, idx) => (
                          <div key={member.email} className="bg-gray-50 p-4 rounded-lg">
                            <div className="font-medium">{member.name}</div>
                            <div className="text-sm text-gray-600 mt-1 space-y-1">
                              <div>Email: {member.email}</div>
                              <div>Phone: {member.phone || 'N/A'}</div>
                              <div>Institution: {member.institution || 'N/A'}</div>
                              <div>Department: {member.department || 'N/A'}</div>
                              <div>Year: {member.year || 'N/A'}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
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
          <div className="p-6 border-b flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold">Staff & Revenue Performance</h3>
                <div className="text-sm text-gray-600 mt-1">Pass assignments and revenue collected by volunteers and department admins.</div>
              </div>
              <button
                onClick={handleVolunteersExport}
                className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
              >
                Export Table
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Staff Member
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role & Department
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Passes Assigned
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Revenue via UPI
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Revenue via Cash
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {c.central_volunteers &&
                    c.central_volunteers.map((vol) => (
                      // +++ ADD onClick HANDLER AND STYLING TO THE ROW +++
                      <tr
                        key={vol.personal_email}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => setSelectedVolunteer(vol)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {vol.name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {vol.personal_email} | {vol.phone || "No Phone"}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {vol.role === 'dept_admin' ? 'Department Admin' :
                             vol.role === 'master_admin' ? 'Master Admin' :
                             vol.role === 'workshop_admin' ? 'Workshop Admin' :
                             vol.role === 'workshop_volunteer' ? 'Workshop Volunteer' :
                             vol.department_name ? 'Department Volunteer' : 'Central Volunteer'}
                          </div>
                          {vol.department_name && (
                            <div className="text-sm text-gray-500">
                              {vol.department_name}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-left">
                          {fmt(vol.passes_assigned)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-left">
                          {formatCurrency(vol.upi_collected)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-left">
                          {formatCurrency(vol.cash_collected)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      
      {showParticipantModal && (
        <ParticipantListModal
          modalConfig={showParticipantModal}
          onClose={() => setShowParticipantModal(null)}
          listData={participantLists[showParticipantModal.scope]}
          filters={participantFilters}
          onFilterChange={handleFilterChange}
          onExport={handleExportParticipants}
          authAxios={authAxios}
          setParticipantLists={setParticipantLists}
        />
      )}
    </div>
  );
}
