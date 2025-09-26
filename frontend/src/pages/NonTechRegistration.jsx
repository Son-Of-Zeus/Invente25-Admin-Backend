import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import RegistrationSuccess from '../components/RegistrationSuccess';
import { 
  UserIcon, 
  EnvelopeIcon, 
  PhoneIcon, 
  CalendarDaysIcon, 
  MagnifyingGlassIcon,
  ExclamationTriangleIcon,
  CurrencyRupeeIcon,
  BuildingOffice2Icon,
  HashtagIcon,
  CheckCircleIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';

export default function NonTechRegistration() {
  const navigate = useNavigate();
  const { user, authAxios } = useAuth();
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState([]);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [submissionResult, setSubmissionResult] = useState(null);

  const initialFormData = {
    emailID: '',
    name: '',
    phoneNumber: '',
    institution: '',
    paymentMethod: 'cash',
    selectedEventId: null,
    customAmount: '',
    teamMembers: [] // Start with empty array - just the main person
  };

  const [formData, setFormData] = useState(initialFormData);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const response = await authAxios.get('/events');
        const allEvents = response.data.rows;
        let filteredEvents = allEvents.filter(event => event.event_type === 'non-technical');
        
        if (user?.role === 'dept_admin' || (user?.role === 'volunteer' && user?.department_id)) {
          filteredEvents = filteredEvents.filter(event => event.department_id === user.department_id);
        }
        
        setEvents(filteredEvents);
      } catch (err) {
        setError('Failed to load non-technical events');
        console.error('Error fetching events:', err);
      }
    };

    fetchEvents();
  }, [user, authAxios]);

  const filteredEvents = events.filter(ev => {
    const q = (search || '').trim().toLowerCase();
    if (!q) return true;
    const name = (ev.name || '').toLowerCase();
    const dept = (ev.department_name || '').toLowerCase();
    const idStr = String(ev.external_id || '');
    return name.includes(q) || dept.includes(q) || idStr.includes(q);
  });

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleTeamMemberChange = (memberIndex, field, value) => {
    const updatedMembers = [...formData.teamMembers];
    updatedMembers[memberIndex][field] = value;
    setFormData({ ...formData, teamMembers: updatedMembers });
  };

  const addTeamMember = () => {
    if (formData.teamMembers.length < 9) { // Max 9 additional members (10 total including leader)
      setFormData({
        ...formData,
        teamMembers: [...formData.teamMembers, { name: '', email: '', phone: '', institution: '' }]
      });
    }
  };

  const removeTeamMember = (index) => {
    const updatedMembers = formData.teamMembers.filter((_, i) => i !== index);
    setFormData({ ...formData, teamMembers: updatedMembers });
  };

  const handleEventChange = (eventId) => {
    setFormData(prev => ({ ...prev, selectedEventId: eventId }));
  };

  const selectedEvent = formData.selectedEventId ? events.find(e => e.external_id === formData.selectedEventId) : null;
  const fallbackPrice = Number(import.meta.env.VITE_NON_TECH_DEFAULT_PRICE || 300);
  const totalAmount = formData.customAmount ? Number(formData.customAmount) : (selectedEvent ? (Number(selectedEvent.cost) || fallbackPrice) : 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!formData.selectedEventId) {
      setError('Please select an event');
      setLoading(false);
      return;
    }

    if (!formData.customAmount || Number(formData.customAmount) <= 0) {
      setError('Please enter a valid amount');
      setLoading(false);
      return;
    }

    // Validate team members - all fields are required for each added team member
    const teamMembersToSend = [];
    for (let i = 0; i < formData.teamMembers.length; i++) {
      const member = formData.teamMembers[i];
      if (member.name || member.email || member.phone || member.institution) {
        if (!member.name || !member.email || !member.phone || !member.institution) {
          setError(`Team member ${i + 2}: All fields (name, email, phone, and institution) are required when adding a team member`);
          setLoading(false);
          return;
        }
        teamMembersToSend.push(member);
      }
    }

    try {
      const eventData = [{ event_id: formData.selectedEventId }];

      await authAxios.post('/non-tech-registration', {
        emailID: formData.emailID,
        name: formData.name,
        phoneNumber: formData.phoneNumber,
        institution: formData.institution,
        paymentMethod: formData.paymentMethod,
        events: eventData,
        customAmount: Number(formData.customAmount),
        teamMembers: teamMembersToSend
      });

      const registeredItemsDetails = selectedEvent ? [{
        name: selectedEvent.name,
        cost: formData.customAmount,
        external_id: selectedEvent.external_id
      }] : [];

      setSubmissionResult({
        details: { ...formData },
        registeredItems: registeredItemsDetails,
        totalAmount: totalAmount
      });

    } catch (err) {
      setError(err.response?.data?.error || 'Non-tech registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleNewRegistration = () => {
    setFormData(initialFormData);
    setSubmissionResult(null);
    setError(null);
    setSearch('');
  };

  if (submissionResult) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-4xl mx-auto">
          <RegistrationSuccess
            details={submissionResult.details}
            registeredItems={submissionResult.registeredItems}
            totalAmount={submissionResult.totalAmount}
            onNewRegistration={handleNewRegistration}
            type="Event"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <SparklesIcon className="h-8 w-8 text-purple-600" />
            <h1 className="text-3xl font-bold text-gray-900">Non-Technical Event Registration</h1>
          </div>
          <p className="text-gray-600">Register for exciting non-technical events and competitions</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Participant Details */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="border-b border-gray-200 p-6">
              <div className="flex items-center gap-2">
                <UserIcon className="h-6 w-6 text-gray-600" />
                <h2 className="text-xl font-semibold text-gray-900">Participant Details</h2>
              </div>
              <p className="text-gray-600 text-sm mt-1">Please provide your information</p>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                    <EnvelopeIcon className="h-4 w-4" />
                    Email Address
                  </label>
                  <input 
                    type="email" 
                    name="emailID" 
                    value={formData.emailID} 
                    onChange={handleInputChange} 
                    required 
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
                    placeholder="Enter your email address"
                  />
                </div>
                
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                    <UserIcon className="h-4 w-4" />
                    Full Name
                  </label>
                  <input 
                    type="text" 
                    name="name" 
                    value={formData.name} 
                    onChange={handleInputChange} 
                    required 
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
                    placeholder="Enter your full name"
                  />
                </div>
                
                <div className="md:col-span-1">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                    <PhoneIcon className="h-4 w-4" />
                    Phone Number
                  </label>
                  <input 
                    type="tel" 
                    name="phoneNumber" 
                    value={formData.phoneNumber} 
                    onChange={handleInputChange} 
                    required 
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
                    placeholder="Enter your phone number"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="col-span-1">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                    <BuildingOffice2Icon className="h-4 w-4" />
                    Institution
                  </label>
                  <input 
                    type="text" 
                    name="institution" 
                    value={formData.institution} 
                    onChange={handleInputChange} 
                    required 
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
                    placeholder="Enter your institution name"
                  />
                </div>
                <div className="col-span-1">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                    <CurrencyRupeeIcon className="h-4 w-4" />
                    Payment Method
                  </label>
                  <select 
                    name="paymentMethod" 
                    value={formData.paymentMethod} 
                    onChange={handleInputChange} 
                    required 
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
                  >
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                  </select>
                </div>
              </div>

              <div className="mt-6">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <CurrencyRupeeIcon className="h-4 w-4" />
                  Registration Amount
                </label>
                <input 
                  type="number" 
                  name="customAmount" 
                  value={formData.customAmount} 
                  onChange={handleInputChange} 
                  required 
                  min="1"
                  step="0.01"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  placeholder="Enter registration amount (₹)"
                />
                <p className="text-xs text-gray-500 mt-1">Enter the total registration amount for the team</p>
              </div>
            </div>
          </div>

          {/* Team Members */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="border-b border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <UserIcon className="h-6 w-6 text-gray-600" />
                    <h2 className="text-xl font-semibold text-gray-900">Team Members (Optional)</h2>
                  </div>
                  <p className="text-gray-600 text-sm mt-1">Add up to 9 additional team members (10 total including leader)</p>
                </div>
                <button
                  type="button"
                  onClick={addTeamMember}
                  disabled={formData.teamMembers.length >= 9}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
                >
                  <UserIcon className="h-4 w-4" />
                  Add Team Member
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              {formData.teamMembers.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <UserIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="font-medium">No additional team members</p>
                  <p className="text-sm">Click "Add Team Member" to add team members</p>
                </div>
              ) : (
                formData.teamMembers.map((member, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-medium text-gray-900">Team Member {index + 2}</h3>
                      <button
                        type="button"
                        onClick={() => removeTeamMember(index)}
                        className="text-red-600 hover:text-red-800 text-sm font-medium"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                          <UserIcon className="h-4 w-4" />
                          Full Name *
                        </label>
                        <input 
                          type="text" 
                          value={member.name} 
                          onChange={(e) => handleTeamMemberChange(index, 'name', e.target.value)} 
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
                          placeholder="Enter member's full name"
                        />
                      </div>
                      
                      <div>
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                          <EnvelopeIcon className="h-4 w-4" />
                          Email Address *
                        </label>
                        <input 
                          type="email" 
                          value={member.email} 
                          onChange={(e) => handleTeamMemberChange(index, 'email', e.target.value)} 
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
                          placeholder="Enter member's email address"
                        />
                      </div>
                      
                      <div>
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                          <PhoneIcon className="h-4 w-4" />
                          Phone Number *
                        </label>
                        <input 
                          type="tel" 
                          value={member.phone} 
                          onChange={(e) => handleTeamMemberChange(index, 'phone', e.target.value)} 
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
                          placeholder="Enter member's phone number"
                        />
                      </div>
                      
                      <div>
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                          <BuildingOffice2Icon className="h-4 w-4" />
                          Institution *
                        </label>
                        <input 
                          type="text" 
                          value={member.institution} 
                          onChange={(e) => handleTeamMemberChange(index, 'institution', e.target.value)} 
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
                          placeholder="Enter member's institution"
                        />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Event Selection */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="border-b border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-2">
                <CalendarDaysIcon className="h-6 w-6 text-gray-600" />
                <h2 className="text-xl font-semibold text-gray-900">Select Event</h2>
              </div>
              <p className="text-gray-600 text-sm">Choose one non-technical event to participate in</p>
            </div>

            <div className="p-6">
              {/* Search Bar */}
              <div className="relative mb-6">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                <input 
                  type="text" 
                  value={search} 
                  onChange={e => setSearch(e.target.value)} 
                  placeholder="Search events by name, department, or ID..." 
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
                />
              </div>

              {/* Events Grid */}
              {filteredEvents.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                  <CalendarDaysIcon className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600 font-medium mb-1">No events available</p>
                  <p className="text-gray-500 text-sm">No non-technical events match your search criteria</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredEvents.map(event => (
                    <div 
                      key={event.external_id} 
                      className={`relative border rounded-lg p-4 cursor-pointer transition-all duration-200 ${
                        formData.selectedEventId === event.external_id 
                          ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200' 
                          : 'border-gray-200 hover:border-purple-300 hover:bg-purple-25'
                      }`}
                      onClick={() => handleEventChange(event.external_id)}
                    >
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="radio"
                          name="event-selection"
                          checked={formData.selectedEventId === event.external_id}
                          onChange={() => handleEventChange(event.external_id)}
                          className="mt-1 text-purple-600 focus:ring-purple-500"
                        />
                        <div className="flex-1">
                          <div className="font-semibold text-gray-900 mb-2">{event.name}</div>
                          
                          <div className="space-y-1 text-sm text-gray-600">
                            <div className="flex items-center gap-1">
                              <HashtagIcon className="h-3 w-3" />
                              <span>ID: {event.external_id}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <BuildingOffice2Icon className="h-3 w-3" />
                              <span>{event.department_name}</span>
                            </div>
                          </div>
                        </div>
                        
                        {formData.selectedEventId === event.external_id && (
                          <CheckCircleIcon className="h-5 w-5 text-purple-600 flex-shrink-0" />
                        )}
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <ExclamationTriangleIcon className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-800 font-medium">Registration Error</p>
                  <p className="text-red-700 text-sm mt-1">{error}</p>
                  <p className="text-red-600 text-xs mt-2">Try reloading or logging out and back in</p>
                </div>
              </div>
            </div>
          )}

          {/* Summary & Submit */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <div className="flex items-center gap-2 text-2xl font-bold text-gray-900">
                  <CurrencyRupeeIcon className="h-6 w-6" />
                  Total Amount: {totalAmount.toFixed(2)}
                </div>
                {selectedEvent && (
                  <div className="text-sm text-gray-600 mt-1">
                    <p>Registration fee for {selectedEvent.name}</p>
                    {formData.teamMembers.some(m => m.name) && (
                      <p className="text-purple-600 font-medium mt-1">
                        Team size: {1 + formData.teamMembers.filter(m => m.name).length} members
                      </p>
                    )}
                  </div>
                )}
              </div>
              
              <button
                type="submit"
                disabled={loading || !formData.selectedEventId}
                className={`
                  px-8 py-3 rounded-lg font-semibold text-white transition-all duration-200 focus:ring-4 focus:ring-offset-2
                  ${loading || !formData.selectedEventId 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-purple-600 hover:bg-purple-700 focus:ring-purple-500 active:scale-95'
                  }
                `}
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Processing...
                  </div>
                ) : (
                  'Submit Registration'
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}