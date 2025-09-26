import React, { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'

// Helper component for the Insert Form
const InsertForm = ({ tableName, columns, onSave, onCancel }) => {
  const [newRecord, setNewRecord] = useState({})

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    let finalValue = value;
    if (type === 'checkbox') {
        finalValue = e.target.checked;
    } else if (value === 'true') {
        finalValue = true;
    } else if (value === 'false') {
        finalValue = false;
    } else if (value === '') { // Treat empty strings as NULL for the database
        finalValue = null;
    }
    
    setNewRecord(prev => ({ ...prev, [name]: finalValue }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(tableName, newRecord);
  };
  
  return (
    <div className="my-4 p-4 border rounded bg-gray-50">
      <h4 className="font-semibold mb-3">Add New Record to "{tableName}"</h4>
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {columns.map(col => (
              <div key={col}>
                <label className="block text-sm font-medium text-gray-700" htmlFor={col}>{col}</label>
                {/* Simple detection for boolean fields to render a dropdown */}
                {col.includes('boolean') || col.includes('issued') || col.includes('attended') ? (
                   <select name={col} id={col} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm bg-white">
                       <option value="">(select a value)</option>
                       <option value="true">True</option>
                       <option value="false">False</option>
                   </select>
                ) : (
                   <input
                     type="text"
                     name={col}
                     id={col}
                     onChange={handleChange}
                     className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm"
                     placeholder={col === 'password_hash' ? 'Enter crypt() hash value' : ''}
                   />
                )}
              </div>
            ))}
        </div>
        <div className="mt-4 flex gap-4">
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Save Record</button>
          <button type="button" onClick={onCancel} className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400">Cancel</button>
        </div>
      </form>
    </div>
  );
};


export default function SuperAdminDump() {
  const { authAxios, user } = useAuth();
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(true);
  const [inserting, setInserting] = useState(null); // Tracks which table form is open

  // --- Data Definition Helpers ---
  const PRIMARY_KEYS = {
    users: ['email'],
    departments: ['id'],
    events: ['id'],
    receipts: ['payment_id'],
    receipt_uploads: ['payment_id'],
    passes: ['pass_id'],
    slots: ['pass_id', 'slot_no'],
    admins: ['id'],
    admin_profiles: ['personal_email'],
    admin_otps: ['personal_email'],
    hack_passes: ['team_id'],
    hack_reg_details: ['team_id', 'email'],
    track: ['team_id'],
    nt_team_members: ['team_leader_email', 'event_id', 'member_email'],
  };

  const EXCLUDED_INSERT_COLS = {
    __default: ['id', 'created_at', 'paid_on', 'uploaded_at', 'expires_at', 'attempts'],
    events: ['id', 'created_at', 'registrations'],
    admins: ['id', 'created_at'], // Admin must manually provide password_hash
  };

  const getInsertableCols = (tableName, allCols) => {
    const exclusions = EXCLUDED_INSERT_COLS[tableName] || EXCLUDED_INSERT_COLS['__default'];
    return allCols.filter(c => !exclusions.includes(c));
  };
  // --- End Data Definition Helpers ---

  const loadData = async () => {
    setLoading(true);
    setErr(null);
    try {
      const resp = await authAxios.get('/admin/dump');
      setData(resp.data?.tables || {});
    } catch (e) {
      setErr(e?.response?.data?.error || String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'super_admin') {
      loadData();
    }
  }, [authAxios, user]);
  
  const handleDelete = async (tableName, row) => {
    const pkCols = PRIMARY_KEYS[tableName];
    if (!pkCols) {
        alert(`Error: No primary key defined in frontend for table "${tableName}"`);
        return;
    }
    
    const primaryKey = pkCols.reduce((acc, key) => ({ ...acc, [key]: row[key] }), {});
    const pkDisplay = Object.entries(primaryKey).map(([k,v]) => `${k}=${v}`).join(', ');

    if (window.confirm(`Are you sure you want to delete this record from "${tableName}"?\n\n(${pkDisplay})`)) {
        try {
            await authAxios.delete('/admin/record', { data: { tableName, primaryKey } });
            setData(prev => ({
                ...prev,
                [tableName]: prev[tableName].filter(r => !pkCols.every(key => r[key] === row[key]))
            }));
        } catch (e) {
            alert(`Failed to delete record: ${e?.response?.data?.error || String(e)}`);
        }
    }
  };

  const handleSaveInsert = async (tableName, newRecord) => {
      setErr(null);
      try {
          const resp = await authAxios.post('/admin/record', { tableName, data: newRecord });
          setData(prev => ({
              ...prev,
              [tableName]: [resp.data.record, ...(prev[tableName] || [])]
          }));
          setInserting(null);
      } catch (e) {
          const errorMsg = `Failed to create record: ${e?.response?.data?.error || String(e)}`;
          setErr(errorMsg);
          alert(errorMsg);
      }
  };


  if (!user || user.role !== 'super_admin') {
    return <div className="p-6">Forbidden</div>;
  }

  if (loading) return <div className="p-6">Loading...</div>;
  if (err && !inserting) return <div className="p-6 text-red-500">Error: {err}<br />Try reloading.</div>;

  const tableOrder = [
    'admins', 'users', 'departments', 'events', 'receipts', 'receipt_uploads', 'passes', 'slots', 'hack_passes', 'track', 'hack_reg_details', 'admin_profiles', 'admin_otps'
  ];
  const tables = tableOrder.filter(t => data[t]).concat(Object.keys(data).filter(t => !tableOrder.includes(t)));

  return (
    <div className="p-6">
      <div className='flex justify-between items-center mb-4'>
        <h2 className="text-xl font-semibold">Super Admin — Database Viewer</h2>
        <button onClick={loadData} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">Reload Data</button>
      </div>

      {tables.map(name => (
        <div key={name} className="mb-8 bg-white p-4 rounded shadow">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-semibold text-lg capitalize">{name.replace(/_/g, ' ')}</h3>
            <button
                onClick={() => setInserting({ tableName: name })}
                className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 font-semibold"
            >
                + Add Record
            </button>
          </div>

          {inserting?.tableName === name && (
            <InsertForm
                tableName={name}
                columns={getInsertableCols(name, data[name]?.[0] ? Object.keys(data[name][0]) : [])}
                onSave={handleSaveInsert}
                onCancel={() => { setInserting(null); setErr(null); }}
            />
          )}
          {err && inserting?.tableName === name && <div className="my-2 text-red-600 bg-red-100 p-2 rounded">{err}</div>}

          {Array.isArray(data[name]) ? (
            data[name].length === 0 ? (
              <div className="text-sm text-gray-500">(empty)</div>
            ) : (
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500">
                      {Object.keys(data[name][0]).map(col => (
                        <th key={col} className="pb-2 pr-4 font-medium">{col}</th>
                      ))}
                      <th className="pb-2 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data[name].map((row, idx) => (
                      <tr key={idx} className="border-t hover:bg-gray-50">
                        {Object.keys(data[name][0]).map(col => (
                          <td key={col} className="py-2 pr-4 align-top break-words max-w-xs">
                            {row[col] === null || typeof row[col] === 'undefined' ? <span className="text-gray-400">—</span> : String(row[col])}
                          </td>
                        ))}
                        <td className="py-2 pr-4 align-top w-20">
                           <button 
                             onClick={() => handleDelete(name, row)}
                             className="text-red-600 hover:text-red-800 font-semibold"
                           >
                            DELETE
                           </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            <div className="text-sm text-red-500">{data[name]?.error || 'Unknown format'}</div>
          )}
        </div>
      ))}
    </div>
  );
}