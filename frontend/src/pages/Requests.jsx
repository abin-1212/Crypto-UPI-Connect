import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { pageVariants, listContainer } from '../lib/animations';
import api from '../api/client';
import { showToast } from '../utils/toast';
import { Button } from '../components/ui/Button';
import { RequestSkeleton } from '../components/skeletons/LoadingSkeletons';
import { ArrowLeftRight, Plus, User, Calendar, Tag, Clock, DollarSign, AlertCircle, CheckCircle2, XCircle, Coffee, Film, Home, ShoppingBag, Heart, Plane } from 'lucide-react';

const REQUEST_CATEGORIES = {
  DINNER: { icon: Coffee, label: 'Dinner/Food', color: 'bg-orange-500/20', textColor: 'text-orange-400' },
  MOVIE: { icon: Film, label: 'Movie/Entertainment', color: 'bg-purple-500/20', textColor: 'text-purple-400' },
  RENT: { icon: Home, label: 'Rent/Housing', color: 'bg-blue-500/20', textColor: 'text-blue-400' },
  SHOPPING: { icon: ShoppingBag, label: 'Shopping', color: 'bg-pink-500/20', textColor: 'text-pink-400' },
  MEDICAL: { icon: Heart, label: 'Medical', color: 'bg-red-500/20', textColor: 'text-red-400' },
  TRAVEL: { icon: Plane, label: 'Travel/Transport', color: 'bg-green-500/20', textColor: 'text-green-400' },
  OTHER: { icon: Tag, label: 'Other', color: 'bg-gray-500/20', textColor: 'text-gray-400' }
};

const Requests = () => {
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);
  const [activeTab, setActiveTab] = useState('incoming');
  const [newRequest, setNewRequest] = useState({ 
    toUpiId: '', 
    amount: '',
    description: '',
    category: 'OTHER',
    dueDate: ''
  });
  const [loading, setLoading] = useState(false);
  const [creatingRequest, setCreatingRequest] = useState(false);
  const [processingId, setProcessingId] = useState(null);

  // Fetch all requests
  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      console.log('📡 Fetching requests...');

      // Fetch incoming requests
      const incomingRes = await api.get('/api/request/incoming');
      console.log('📥 Incoming:', incomingRes.data);
      setIncomingRequests(incomingRes.data.requests || []);

      // Fetch outgoing requests
      const outgoingRes = await api.get('/api/request/outgoing');
      console.log('📤 Outgoing:', outgoingRes.data);
      setOutgoingRequests(outgoingRes.data.requests || []);

    } catch (error) {
      console.error('❌ Failed to fetch requests:', error);
      showToast.error('Failed to load requests');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRequest = async (e) => {
    e.preventDefault();

    if (!newRequest.toUpiId.trim() || !newRequest.amount || Number(newRequest.amount) <= 0) {
      showToast.error('Please enter valid UPI ID and amount');
      return;
    }

    if (!newRequest.description.trim()) {
      showToast.error('Please provide a description for the request');
      return;
    }

    try {
      setCreatingRequest(true);
      console.log('🎯 Creating request with:', newRequest);

      const response = await api.post('/api/request', {
        toUpiId: newRequest.toUpiId.trim(),
        amount: Number(newRequest.amount),
        description: newRequest.description.trim(),
        category: newRequest.category,
        dueDate: newRequest.dueDate || undefined
      });

      console.log('✅ Request created:', response.data);
      showToast.success('Money request sent successfully!');

      // Clear form
      setNewRequest({ toUpiId: '', amount: '', description: '', category: 'OTHER', dueDate: '' });

      // Refresh requests
      await fetchRequests();

      // Switch to outgoing tab to see the new request
      setActiveTab('outgoing');

    } catch (error) {
      console.error('❌ Create request error:', error);
      const errorMsg = error.response?.data?.message || 'Failed to send request';
      showToast.error(errorMsg);
    } finally {
      setCreatingRequest(false);
    }
  };

  const handleAccept = async (requestId) => {
    try {
      setProcessingId(requestId);
      console.log('✅ Accepting request:', requestId);

      const response = await api.post(`/api/request/${requestId}/accept`);
      console.log('✅ Response:', response.data);

      showToast.success('Request accepted and payment sent!');
      await fetchRequests(); // Refresh list

    } catch (error) {
      console.error('❌ Accept error:', error);
      const errorMsg = error.response?.data?.message || 'Failed to accept request';
      showToast.error(errorMsg);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (requestId) => {
    try {
      setProcessingId(requestId);
      console.log('❌ Rejecting request:', requestId);

      const response = await api.post(`/api/request/${requestId}/reject`);
      console.log('✅ Response:', response.data);

      showToast.success('Request rejected');
      await fetchRequests(); // Refresh list

    } catch (error) {
      console.error('❌ Reject error:', error);
      const errorMsg = error.response?.data?.message || 'Failed to reject request';
      showToast.error(errorMsg);
    } finally {
      setProcessingId(null);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="max-w-6xl mx-auto"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-500/20 rounded-xl text-purple-400">
            <ArrowLeftRight size={24} />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Money Requests</h1>
            <p className="text-gray-400">Manage incoming and outgoing requests</p>
          </div>
        </div>
      </div>

      {/* Create New Request Form */}
      <div className="glass-card p-6 mb-6">
        <div className="flex items-center gap-2 mb-6">
          <Plus size={20} className="text-accent" />
          <h2 className="text-xl font-semibold text-white">Create Payment Request</h2>
        </div>
        <form onSubmit={handleCreateRequest} className="space-y-6">
          {/* Row 1: Recipient & Amount */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Recipient UPI ID *
              </label>
              <input
                type="text"
                placeholder="username@cxpay"
                value={newRequest.toUpiId}
                onChange={(e) => setNewRequest({ ...newRequest, toUpiId: e.target.value })}
                className="input-field"
                required
                disabled={creatingRequest}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Amount (₹) *
              </label>
              <input
                type="number"
                placeholder="1000"
                min="1"
                value={newRequest.amount}
                onChange={(e) => setNewRequest({ ...newRequest, amount: e.target.value })}
                className="input-field"
                required
                disabled={creatingRequest}
              />
            </div>
          </div>

          {/* Row 2: Category & Due Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                <Tag size={16} /> Category
              </label>
              <select
                value={newRequest.category}
                onChange={(e) => setNewRequest({ ...newRequest, category: e.target.value })}
                className="input-field"
                disabled={creatingRequest}
              >
                {Object.entries(REQUEST_CATEGORIES).map(([key, val]) => (
                  <option key={key} value={key}>{val.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                <Calendar size={16} /> Due Date (Optional)
              </label>
              <input
                type="date"
                value={newRequest.dueDate}
                onChange={(e) => setNewRequest({ ...newRequest, dueDate: e.target.value })}
                className="input-field"
                disabled={creatingRequest}
              />
            </div>
          </div>

          {/* Row 3: Description */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              What's this for? *
            </label>
            <textarea
              placeholder="e.g., Dinner bill from last night at the restaurant, Movie tickets for 2, Shared groceries..."
              value={newRequest.description}
              onChange={(e) => setNewRequest({ ...newRequest, description: e.target.value })}
              className="input-field min-h-[80px] resize-none"
              required
              disabled={creatingRequest}
            />
            <p className="text-xs text-gray-400 mt-1">
              {newRequest.description.length}/200 characters
            </p>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            loading={creatingRequest}
            className="w-full"
          >
            {creatingRequest ? 'Sending Request...' : 'Send Money Request'}
          </Button>
        </form>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-800 mb-6">
        <button
          onClick={() => setActiveTab('incoming')}
          className={`px-6 py-3 font-medium transition-all relative ${activeTab === 'incoming'
              ? 'text-white border-b-2 border-accent'
              : 'text-gray-400 hover:text-white'
            }`}
        >
          Incoming
          {incomingRequests.length > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-accent/20 text-accent text-xs rounded-full">
              {incomingRequests.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('outgoing')}
          className={`px-6 py-3 font-medium transition-all relative ${activeTab === 'outgoing'
              ? 'text-white border-b-2 border-accent'
              : 'text-gray-400 hover:text-white'
            }`}
        >
          Sent Requests
          {outgoingRequests.length > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded-full">
              {outgoingRequests.length}
            </span>
          )}
        </button>
      </div>

      {/* Requests List */}
      <div className="min-h-[300px]">
        {loading ? (
          <RequestSkeleton />
        ) : activeTab === 'incoming' ? (
          <motion.div
            variants={listContainer}
            initial="hidden"
            animate="show"
          >
            {incomingRequests.length === 0 ? (
              <div className="glass-card p-12 text-center">
                <ArrowLeftRight className="w-16 h-16 mx-auto mb-4 opacity-20 text-gray-400" />
                <h3 className="text-xl font-medium text-white mb-2">No incoming requests</h3>
                <p className="text-gray-400">Requests sent to you will appear here</p>
              </div>
            ) : (
              <div className="space-y-4">
                {incomingRequests.map((request) => {
                  const categoryInfo = REQUEST_CATEGORIES[request.category] || REQUEST_CATEGORIES.OTHER;
                  const CategoryIcon = categoryInfo.icon;
                  const isExpired = new Date(request.expiresAt) < new Date();
                  
                  return (
                    <div
                      key={request._id}
                      className="glass-card p-6 hover:bg-white/5 transition-all border-l-4 border-accent"
                    >
                      {/* Header: User & Amount */}
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400">
                              <User size={24} />
                            </div>
                            <div>
                              <h4 className="font-semibold text-white text-lg">
                                {request.fromUser?.name || request.fromUser?.email || 'Unknown'}
                              </h4>
                              <p className="text-sm text-gray-400">
                                {request.fromUpi} • Requested {formatDate(request.createdAt)}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-4xl font-bold text-accent mb-1">
                            ₹{request.amount.toLocaleString('en-IN')}
                          </div>
                          <p className="text-sm text-gray-400">{request.currency}</p>
                        </div>
                      </div>

                      {/* Category & Details */}
                      <div className="mb-4 pb-4 border-b border-gray-700">
                        <div className="flex flex-wrap gap-3 items-center">
                          <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${categoryInfo.color}`}>
                            <CategoryIcon size={16} className={categoryInfo.textColor} />
                            <span className={`text-sm font-medium ${categoryInfo.textColor}`}>
                              {categoryInfo.label}
                            </span>
                          </div>
                          
                          {request.dueDate && (
                            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-400">
                              <Calendar size={16} />
                              <span className="text-sm font-medium">
                                Due: {formatDate(request.dueDate)}
                              </span>
                            </div>
                          )}
                          
                          {isExpired && (
                            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/20 text-red-400">
                              <AlertCircle size={16} />
                              <span className="text-sm font-medium">Expired</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Description */}
                      <div className="mb-4">
                        <p className="text-gray-300 text-sm leading-relaxed">
                          <span className="font-semibold text-white">"</span>{request.description}<span className="font-semibold text-white">"</span>
                        </p>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-3">
                        {request.status === 'PENDING' && !isExpired && (
                          <>
                            <Button
                              variant="success"
                              onClick={() => handleAccept(request._id)}
                              disabled={processingId === request._id}
                              loading={processingId === request._id}
                              className="flex-1 flex items-center justify-center gap-2"
                            >
                              <CheckCircle2 size={18} />
                              Accept & Pay
                            </Button>
                            <Button
                              variant="danger"
                              onClick={() => handleReject(request._id)}
                              disabled={processingId === request._id}
                              className="flex-1 flex items-center justify-center gap-2"
                            >
                              <XCircle size={18} />
                              Reject
                            </Button>
                          </>
                        )}

                        {request.status !== 'PENDING' && (
                          <div className="w-full flex items-center justify-center">
                            <span className={`px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-2 ${
                              request.status === 'PAID' ? 'bg-green-500/20 text-green-400' :
                              request.status === 'DECLINED' ? 'bg-red-500/20 text-red-400' :
                              'bg-gray-500/20 text-gray-400'
                            }`}>
                              {request.status === 'PAID' && <CheckCircle2 size={18} />}
                              {request.status === 'DECLINED' && <XCircle size={18} />}
                              {request.status === 'EXPIRED' && <Clock size={18} />}
                              {request.status}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            variants={listContainer}
            initial="hidden"
            animate="show"
          >
            {outgoingRequests.length === 0 ? (
              <div className="glass-card p-12 text-center">
                <ArrowLeftRight className="w-16 h-16 mx-auto mb-4 opacity-20 text-gray-400" />
                <h3 className="text-xl font-medium text-white mb-2">No sent requests</h3>
                <p className="text-gray-400">Create a request using the form above</p>
              </div>
            ) : (
              <div className="space-y-4">
                {outgoingRequests.map((request) => {
                  const categoryInfo = REQUEST_CATEGORIES[request.category] || REQUEST_CATEGORIES.OTHER;
                  const CategoryIcon = categoryInfo.icon;
                  const isExpired = new Date(request.expiresAt) < new Date();
                  
                  return (
                    <div
                      key={request._id}
                      className="glass-card p-6 hover:bg-white/5 transition-all border-l-4 border-blue-500"
                    >
                      {/* Header: User & Amount */}
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">
                              <User size={24} />
                            </div>
                            <div>
                              <h4 className="font-semibold text-white text-lg">
                                To: {request.toUser?.name || request.toUser?.email || 'Unknown'}
                              </h4>
                              <p className="text-sm text-gray-400">
                                {request.toUpi} • Sent {formatDate(request.createdAt)}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-4xl font-bold text-blue-400 mb-1">
                            ₹{request.amount.toLocaleString('en-IN')}
                          </div>
                          <p className="text-sm text-gray-400">{request.currency}</p>
                        </div>
                      </div>

                      {/* Category & Details */}
                      <div className="mb-4 pb-4 border-b border-gray-700">
                        <div className="flex flex-wrap gap-3 items-center">
                          <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${categoryInfo.color}`}>
                            <CategoryIcon size={16} className={categoryInfo.textColor} />
                            <span className={`text-sm font-medium ${categoryInfo.textColor}`}>
                              {categoryInfo.label}
                            </span>
                          </div>
                          
                          {request.dueDate && (
                            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-400">
                              <Calendar size={16} />
                              <span className="text-sm font-medium">
                                Due: {formatDate(request.dueDate)}
                              </span>
                            </div>
                          )}
                          
                          {isExpired && (
                            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/20 text-red-400">
                              <AlertCircle size={16} />
                              <span className="text-sm font-medium">Expired</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Description */}
                      <div className="mb-4">
                        <p className="text-gray-300 text-sm leading-relaxed">
                          <span className="font-semibold text-white">"</span>{request.description}<span className="font-semibold text-white">"</span>
                        </p>
                      </div>

                      {/* Status Indicator */}
                      <div className="flex items-center justify-end">
                        <span className={`px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-2 ${
                          request.status === 'PENDING' ? 'bg-yellow-500/20 text-yellow-400' :
                          request.status === 'PAID' ? 'bg-green-500/20 text-green-400' :
                          request.status === 'DECLINED' ? 'bg-red-500/20 text-red-400' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>
                          {request.status === 'PENDING' && <Clock size={18} />}
                          {request.status === 'PAID' && <CheckCircle2 size={18} />}
                          {request.status === 'DECLINED' && <XCircle size={18} />}
                          {request.status === 'EXPIRED' && <AlertCircle size={18} />}
                          {request.status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

export default Requests;
