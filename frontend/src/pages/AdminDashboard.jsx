import React, { useState, useEffect } from 'react';
import { useAdmin } from '../context/AdminContext';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
    Users, DollarSign, CreditCard, TrendingUp,
    Activity, Shield, BarChart3, Calendar,
    Search, Filter, Download, MoreVertical,
    ArrowUpRight, ArrowDownLeft, AlertCircle,
    ChevronDown, CheckCircle, XCircle, Eye, X
} from 'lucide-react';
import api from '../api/client';
import { showToast } from '../utils/toast';
import './AdminDashboard.css';

const AdminDashboard = () => {
    const { adminData, fetchDashboardData } = useAdmin();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('overview');

    useEffect(() => {
        if (user && user.role !== 'admin') {
            navigate('/');
        }
    }, [user, navigate]);

    useEffect(() => {
        if (user?.role === 'admin') {
            fetchDashboardData();
        }
    }, [user]);

    if (user?.role !== 'admin') return null;

    const { overview, loading } = adminData;

    return (
        <div className="admin-premium-container animate-fade-in">
            <header className="admin-page-header">
                <div className="header-content">
                    <div className="title-section">
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                            Admin Command Center
                        </h1>
                        <p className="text-gray-400 mt-1">Platform-wide overview and management</p>
                    </div>
                    <div className="admin-status-badge">
                        <Shield size={16} className="text-accent" />
                        <span>Authorized Administrator</span>
                    </div>
                </div>
            </header>

            <div className="admin-nav-tabs glass mt-8">
                <button
                    className={`admin-nav-item ${activeTab === 'overview' ? 'active' : ''}`}
                    onClick={() => setActiveTab('overview')}
                >
                    <BarChart3 size={18} />
                    <span>Overview</span>
                </button>
                <button
                    className={`admin-nav-item ${activeTab === 'users' ? 'active' : ''}`}
                    onClick={() => setActiveTab('users')}
                >
                    <Users size={18} />
                    <span>User Base</span>
                </button>
                <button
                    className={`admin-nav-item ${activeTab === 'transactions' ? 'active' : ''}`}
                    onClick={() => setActiveTab('transactions')}
                >
                    <CreditCard size={18} />
                    <span>Global Ledger</span>
                </button>
                <button
                    className={`admin-nav-item ${activeTab === 'kyc' ? 'active' : ''}`}
                    onClick={() => setActiveTab('kyc')}
                >
                    <Shield size={18} />
                    <span>Security & KYC</span>
                </button>
            </div>

            <div className="admin-content-area mt-8">
                {loading ? (
                    <div className="loading-state glass p-12 text-center text-gray-400">
                        <Activity className="animate-spin mx-auto mb-4" size={32} />
                        Initializing platform metrics...
                    </div>
                ) : (
                    <>
                        {activeTab === 'overview' && (
                            <div className="overview-grid animate-fade-in">
                                <div className="metrics-row">
                                    <div className="metric-card glass">
                                        <div className="metric-header">
                                            <div className="icon-box users"><Users size={20} /></div>
                                            <span className="label">Total Users</span>
                                        </div>
                                        <div className="metric-value">{overview?.overview?.totalUsers || 0}</div>
                                        <div className="metric-footer positive">
                                            <TrendingUp size={14} />
                                            <span>+{overview?.overview?.recentUsers || 0} recent</span>
                                        </div>
                                    </div>

                                    <div className="metric-card glass">
                                        <div className="metric-header">
                                            <div className="icon-box transactions"><CreditCard size={20} /></div>
                                            <span className="label">Total Transactions</span>
                                        </div>
                                        <div className="metric-value">{overview?.overview?.totalTransactions || 0}</div>
                                        <div className="metric-footer positive">
                                            <TrendingUp size={14} />
                                            <span>Active platform</span>
                                        </div>
                                    </div>

                                    <div className="metric-card glass">
                                        <div className="metric-header">
                                            <div className="icon-box volume"><DollarSign size={20} /></div>
                                            <span className="label">Global Volume</span>
                                        </div>
                                        <div className="metric-value">₹{(overview?.overview?.totalVolume || 0).toLocaleString()}</div>
                                        <div className="metric-footer positive">
                                            <TrendingUp size={14} />
                                            <span>Settled</span>
                                        </div>
                                    </div>

                                    <div className="metric-card glass">
                                        <div className="metric-header">
                                            <div className="icon-box requests"><AlertCircle size={20} /></div>
                                            <span className="label">Pending Requests</span>
                                        </div>
                                        <div className="metric-value">{overview?.overview?.totalRequests || 0}</div>
                                        <div className="metric-footer neutral">
                                            <span>Network activity</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="charts-section mt-8">
                                    <div className="chart-wrapper glass p-6">
                                        <h3 className="font-semibold mb-6 flex items-center gap-2">
                                            <BarChart3 size={18} className="text-accent" />
                                            Transaction Activity (Last 30 Days)
                                        </h3>
                                        <div className="mock-visual-chart">
                                            {overview?.trends?.dailyTransactions?.map((day, i) => (
                                                <div key={i} className="chart-bar-container">
                                                    <div
                                                        className="chart-bar-fill"
                                                        style={{ height: `${Math.min(100, (day.count / 20) * 100)}%` }}
                                                        title={`${day._id}: ${day.count} txns`}
                                                    ></div>
                                                </div>
                                            ))}
                                            {(!overview?.trends?.dailyTransactions || overview.trends.dailyTransactions.length === 0) && (
                                                <div className="no-data text-gray-500 italic">No activity data for this period</div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'users' && <UsersManagement />}
                        {activeTab === 'transactions' && <GlobalTransactions />}
                        {activeTab === 'kyc' && <KYCManagement />}
                    </>
                )}
            </div>
        </div>
    );
};

const UsersManagement = () => {
    const { fetchUsers, updateUserStatus, updateUserKYC } = useAdmin();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [filters, setFilters] = useState({ search: '', status: 'all', kycStatus: 'all' });

    const loadUsers = async () => {
        setLoading(true);
        try {
            const data = await fetchUsers(filters);
            setUsers(data.users);
        } catch (error) {
            console.error('Failed to load users:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadUsers(); }, [filters]);

    return (
        <div className="data-management-view glass p-6 animate-fade-in">
            <div className="view-header mb-6 flex flex-col sm:flex-row gap-4 items-center justify-between">
                <h2 className="text-xl font-semibold">User Directory</h2>
                <div className="filters-row flex gap-2">
                    <div className="search-pill glass px-3 py-1 flex items-center gap-2">
                        <Search size={16} className="text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search users..."
                            value={filters.search}
                            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                            className="bg-transparent border-none text-sm focus:outline-none"
                        />
                    </div>
                </div>
            </div>

            <div className="table-responsive">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>Entity</th>
                            <th>Identity</th>
                            <th>Status</th>
                            <th>Financials</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map(user => (
                            <tr key={user._id}>
                                <td>
                                    <div className="flex items-center gap-3">
                                        <div className="avatar-small">{user.name.charAt(0)}</div>
                                        <div>
                                            <div className="font-medium">{user.name}</div>
                                            <div className="text-xs text-gray-500">{user.role.toUpperCase()}</div>
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    <div className="text-sm">{user.email}</div>
                                    <div className="text-xs text-gray-500">{user.bankAccount?.upiId || 'No UPI'}</div>
                                </td>
                                <td>
                                    <div className={`status-pill ${user.isActive ? 'active' : 'inactive'}`}>
                                        {user.isActive ? 'Active' : 'Restricted'}
                                    </div>
                                </td>
                                <td>
                                    <div className="text-sm font-medium">₹{user.bankBalance?.toLocaleString()}</div>
                                    <div className="text-xs text-accent">{user.convergeXWallet?.balance?.usdc || 0} USDC</div>
                                </td>
                                <td>
                                    <button className="action-icon-btn"><MoreVertical size={16} /></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const GlobalTransactions = () => {
    const { fetchTransactions } = useAdmin();
    const [txns, setTxns] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const loadTxns = async () => {
            setLoading(true);
            try {
                const data = await fetchTransactions();
                setTxns(data.transactions);
            } catch (err) { console.error(err); }
            finally { setLoading(false); }
        };
        loadTxns();
    }, []);

    return (
        <div className="data-management-view glass p-6 animate-fade-in">
            <h2 className="text-xl font-semibold mb-6">Global Platform Transactions</h2>
            <div className="table-responsive">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Type</th>
                            <th>Participants</th>
                            <th>Amount</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {txns.map(txn => (
                            <tr key={txn._id}>
                                <td className="text-sm text-gray-400">
                                    {new Date(txn.createdAt).toLocaleDateString()}
                                </td>
                                <td>
                                    <div className="text-xs font-semibold px-2 py-1 rounded bg-white/5 border border-white/10 w-fit">
                                        {txn.type}
                                    </div>
                                </td>
                                <td>
                                    <div className="flex items-center gap-2 text-xs">
                                        <span className="text-gray-400">From:</span>
                                        <span className="font-medium text-white">{txn.fromUser?.name || txn.fromUpi}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs">
                                        <span className="text-gray-400">To:</span>
                                        <span className="font-medium text-white">{txn.toUser?.name || txn.toUpi}</span>
                                    </div>
                                </td>
                                <td className="font-bold text-accent">₹{txn.amount.toLocaleString()}</td>
                                <td>
                                    <span className={`status-pill ${txn.status === 'COMPLETED' ? 'active' : 'inactive'}`}>
                                        {txn.status}
                                    </span>
                                </td>
                            </tr>
                        ))}
                        {txns.length === 0 && !loading && (
                            <tr><td colSpan="5" className="text-center p-12 text-gray-500">No transactions recorded on this platform yet.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// Image Modal Component
const ImageModal = ({ imageUrl, altText, onClose }) => {
    // Construct full URL if it's a relative path
    const fullImageUrl = imageUrl?.startsWith('http') ? imageUrl : `http://localhost:5000${imageUrl}`;
    
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={onClose}>
            <div className="max-w-4xl max-h-[90vh] relative" onClick={(e) => e.stopPropagation()}>
                <button
                    onClick={onClose}
                    className="absolute -top-12 right-0 text-white hover:text-gray-300 transition"
                >
                    <X size={28} />
                </button>
                <img
                    src={fullImageUrl}
                    alt={altText}
                    className="w-full h-full object-contain rounded-lg border border-white/20"
                    onError={(e) => {
                        console.error('Image failed to load:', fullImageUrl);
                        e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%23333" width="400" height="300"/%3E%3Ctext x="50%25" y="50%25" fill="%23999" text-anchor="middle" dy=".3em"%3EImage not found%3C/text%3E%3C/svg%3E';
                    }}
                />
                <p className="text-center text-gray-300 mt-4 text-sm">{altText}</p>
            </div>
        </div>
    );
};

const KYCManagement = () => {
    const [kycSubmissions, setKycSubmissions] = useState([]);
    const [filteredSubmissions, setFilteredSubmissions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [statusFilter, setStatusFilter] = useState('all');
    const [expandedId, setExpandedId] = useState(null);
    const [selectedForReview, setSelectedForReview] = useState(null);
    const [rejectRemarks, setRejectRemarks] = useState('');
    const [actionLoading, setActionLoading] = useState(false);
    const [imageModal, setImageModal] = useState({ isOpen: false, url: '', alt: '' });

    // Fetch KYC submissions
    const fetchKycData = async () => {
        setLoading(true);
        try {
            const response = await api.get('/api/admin/kyc', {
                params: { status: statusFilter === 'all' ? undefined : statusFilter }
            });
            console.log('KYC Data loaded:', response.data);
            setKycSubmissions(response.data.submissions);
            filterSubmissions(response.data.submissions);
        } catch (error) {
            console.error('Error fetching KYC data:', error);
            showToast('error', 'Failed to load KYC submissions');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchKycData();
    }, [statusFilter]);

    const filterSubmissions = (data) => {
        if (statusFilter === 'all') {
            setFilteredSubmissions(data);
        } else {
            setFilteredSubmissions(data.filter(s => s.status === statusFilter));
        }
    };

    const handleApproveKYC = async (userId) => {
        console.log('Approving KYC for user:', userId);
        setActionLoading(true);
        try {
            const response = await api.put(`/api/admin/kyc/${userId}/approve`);
            console.log('Approve response:', response.data);
            if (response.data.success) {
                showToast('success', '✅ KYC approved successfully');
                setSelectedForReview(null);
                setRejectRemarks('');
                await fetchKycData();
            }
        } catch (error) {
            console.error('Error approving KYC:', error.response?.data || error.message);
            showToast('error', error.response?.data?.message || 'Failed to approve KYC');
        } finally {
            setActionLoading(false);
        }
    };

    const handleRejectKYC = async (userId) => {
        if (!rejectRemarks.trim()) {
            showToast('error', '⚠️ Please enter rejection remarks');
            return;
        }

        console.log('Rejecting KYC for user:', userId, 'Remarks:', rejectRemarks);
        setActionLoading(true);
        try {
            const response = await api.put(`/api/admin/kyc/${userId}/reject`, {
                adminRemarks: rejectRemarks
            });
            console.log('Reject response:', response.data);
            if (response.data.success) {
                showToast('success', '❌ KYC rejected successfully');
                setSelectedForReview(null);
                setRejectRemarks('');
                await fetchKycData();
            }
        } catch (error) {
            console.error('Error rejecting KYC:', error.response?.data || error.message);
            showToast('error', error.response?.data?.message || 'Failed to reject KYC');
        } finally {
            setActionLoading(false);
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'approved': return 'text-green-400';
            case 'rejected': return 'text-red-400';
            case 'pending':
            case 'under_review': return 'text-yellow-400';
            default: return 'text-gray-400';
        }
    };

    const getStatusBgColor = (status) => {
        switch (status) {
            case 'approved': return 'bg-green-500/20 border-green-500/50';
            case 'rejected': return 'bg-red-500/20 border-red-500/50';
            case 'pending':
            case 'under_review': return 'bg-yellow-500/20 border-yellow-500/50';
            default: return 'bg-gray-500/20 border-gray-500/50';
        }
    };

    return (
        <div className="kyc-management-view glass p-6 animate-fade-in">
            {imageModal.isOpen && (
                <ImageModal
                    imageUrl={imageModal.url}
                    altText={imageModal.alt}
                    onClose={() => setImageModal({ isOpen: false, url: '', alt: '' })}
                />
            )}

            <div className="view-header mb-6 flex flex-col sm:flex-row gap-4 items-center justify-between">
                <h2 className="text-xl font-semibold">KYC Submissions</h2>
                <div className="filters-row flex gap-2">
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="glass px-3 py-2 text-sm text-white border border-white/20 rounded bg-white/5 cursor-pointer hover:bg-white/10 focus:outline-none focus:border-accent"
                    >
                        <option value="all" className="bg-slate-900">All Status</option>
                        <option value="pending" className="bg-slate-900">Pending</option>
                        <option value="under_review" className="bg-slate-900">Under Review</option>
                        <option value="approved" className="bg-slate-900">Approved</option>
                        <option value="rejected" className="bg-slate-900">Rejected</option>
                    </select>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-12 text-gray-400">
                    <Activity className="animate-spin mx-auto mb-4" size={32} />
                    Loading KYC submissions...
                </div>
            ) : filteredSubmissions.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                    <Shield size={48} className="mx-auto mb-4 opacity-50" />
                    <p>No KYC submissions found</p>
                </div>
            ) : (
                <div className="kyc-submissions-list space-y-4">
                    {filteredSubmissions.map((submission) => (
                        <div key={submission._id} className="kyc-submission-card glass p-4 border border-white/10 rounded-lg">
                            <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpandedId(expandedId === submission._id ? null : submission._id)}>
                                <div className="flex-1">
                                    <div className="flex items-center gap-3">
                                        <div className="avatar-small">{submission.userId.name?.charAt(0) || 'U'}</div>
                                        <div>
                                            <div className="font-medium">{submission.userId.name}</div>
                                            <div className="text-xs text-gray-500">{submission.userId.email}</div>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="text-right">
                                        <div className="text-xs text-gray-400">Submitted</div>
                                        <div className="text-sm font-medium">{new Date(submission.submittedAt).toLocaleDateString()}</div>
                                    </div>
                                    <div className={`status-pill ${getStatusBgColor(submission.status)}`}>
                                        <span className={getStatusColor(submission.status)}>
                                            {submission.status.toUpperCase()}
                                        </span>
                                    </div>
                                    <ChevronDown
                                        size={20}
                                        className={`transition-transform ${expandedId === submission._id ? 'rotate-180' : ''}`}
                                    />
                                </div>
                            </div>

                            {expandedId === submission._id && (
                                <div className="mt-4 pt-4 border-t border-white/10">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                        <div>
                                            <h4 className="text-sm font-semibold mb-2 text-accent">
                                                Document Type: {submission.documentType?.toUpperCase()}
                                            </h4>
                                            <div className="document-preview space-y-3">
                                                <div>
                                                    <p className="text-xs text-gray-400 mb-2 flex items-center gap-1">
                                                        <Eye size={14} />
                                                        Front Side (Click to view)
                                                    </p>
                                                    <img
                                                        src={submission.documentFrontUrl?.startsWith('http') ? submission.documentFrontUrl : `http://localhost:5000${submission.documentFrontUrl}`}
                                                        alt="Document Front"
                                                        onClick={() => setImageModal({ isOpen: true, url: submission.documentFrontUrl, alt: 'Document Front Side' })}
                                                        className="w-full max-h-64 object-cover rounded border border-white/20 cursor-pointer hover:border-accent/50 hover:shadow-lg hover:shadow-accent/20 transition-all"
                                                        onError={(e) => {
                                                            console.error('Front document image failed to load');
                                                            e.target.style.display = 'none';
                                                        }}
                                                    />
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-400 mb-2 flex items-center gap-1">
                                                        <Eye size={14} />
                                                        Back Side (Click to view)
                                                    </p>
                                                    <img
                                                        src={submission.documentBackUrl?.startsWith('http') ? submission.documentBackUrl : `http://localhost:5000${submission.documentBackUrl}`}
                                                        alt="Document Back"
                                                        onClick={() => setImageModal({ isOpen: true, url: submission.documentBackUrl, alt: 'Document Back Side' })}
                                                        className="w-full max-h-64 object-cover rounded border border-white/20 cursor-pointer hover:border-accent/50 hover:shadow-lg hover:shadow-accent/20 transition-all"
                                                        onError={(e) => {
                                                            console.error('Back document image failed to load');
                                                            e.target.style.display = 'none';
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div>
                                            <div className="mb-4">
                                                <p className="text-xs text-gray-400 mb-2 flex items-center gap-1">
                                                    <Eye size={14} />
                                                    Selfie (Click to view)
                                                </p>
                                                <img
                                                    src={submission.selfieUrl?.startsWith('http') ? submission.selfieUrl : `http://localhost:5000${submission.selfieUrl}`}
                                                    alt="Selfie"
                                                    onClick={() => setImageModal({ isOpen: true, url: submission.selfieUrl, alt: 'User Selfie' })}
                                                    className="w-full max-h-64 object-cover rounded border border-white/20 cursor-pointer hover:border-accent/50 hover:shadow-lg hover:shadow-accent/20 transition-all"
                                                    onError={(e) => {
                                                        console.error('Selfie image failed to load');
                                                        e.target.style.display = 'none';
                                                    }}
                                                />
                                            </div>
                                            <div className="bg-white/5 rounded p-3 space-y-2 text-sm border border-white/10">
                                                <div>
                                                    <span className="text-gray-400">Full Name:</span>
                                                    <p className="font-medium">{submission.fullName}</p>
                                                </div>
                                                <div>
                                                    <span className="text-gray-400">Document Number:</span>
                                                    <p className="font-medium">{submission.documentNumber}</p>
                                                </div>
                                                <div>
                                                    <span className="text-gray-400">Date of Birth:</span>
                                                    <p className="font-medium">{new Date(submission.dateOfBirth).toLocaleDateString()}</p>
                                                </div>
                                                <div>
                                                    <span className="text-gray-400">Address:</span>
                                                    <p className="font-medium text-xs">{submission.address}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {submission.adminRemarks && (
                                        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded">
                                            <p className="text-xs font-semibold text-red-400 mb-1">Admin Remarks:</p>
                                            <p className="text-sm text-red-200">{submission.adminRemarks}</p>
                                        </div>
                                    )}

                                    {submission.status !== 'approved' && submission.status !== 'rejected' && (
                                        <div className="mt-4 pt-4 border-t border-white/10">
                                            <button
                                                onClick={() => setSelectedForReview(submission._id)}
                                                className="w-full px-4 py-2 bg-accent/20 hover:bg-accent/30 border border-accent/50 text-accent rounded font-medium text-sm transition"
                                            >
                                                {selectedForReview === submission._id ? '✖ Hide Review' : '📋 Review & Take Action'}
                                            </button>

                                            {selectedForReview === submission._id && (
                                                <div className="mt-4 space-y-3 p-4 bg-white/5 border border-white/10 rounded-lg">
                                                    <div>
                                                        <label className="text-xs text-gray-400 block mb-2 font-semibold">Remarks (required for rejection):</label>
                                                        <textarea
                                                            value={rejectRemarks}
                                                            onChange={(e) => setRejectRemarks(e.target.value)}
                                                            placeholder="Enter rejection reason or comments..."
                                                            className="w-full bg-white/5 border border-white/20 rounded p-3 text-sm text-white placeholder-gray-500 focus:border-accent focus:outline-none focus:bg-white/10"
                                                            rows={4}
                                                        />
                                                    </div>
                                                    <div className="flex gap-3">
                                                        <button
                                                            onClick={() => handleApproveKYC(submission.userId._id)}
                                                            disabled={actionLoading}
                                                            className="flex-1 px-4 py-3 bg-green-500/20 border border-green-500/60 text-green-300 rounded font-semibold text-sm hover:bg-green-500/30 hover:border-green-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                                                        >
                                                            <CheckCircle size={18} />
                                                            {actionLoading ? 'Processing...' : 'Approve KYC'}
                                                        </button>
                                                        <button
                                                            onClick={() => handleRejectKYC(submission.userId._id)}
                                                            disabled={actionLoading || !rejectRemarks.trim()}
                                                            className="flex-1 px-4 py-3 bg-red-500/20 border border-red-500/60 text-red-300 rounded font-semibold text-sm hover:bg-red-500/30 hover:border-red-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                                                        >
                                                            <XCircle size={18} />
                                                            {actionLoading ? 'Processing...' : 'Reject KYC'}
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {submission.status === 'approved' && (
                                        <div className="mt-4 p-3 bg-green-500/10 border border-green-500/30 rounded flex items-center gap-2">
                                            <CheckCircle size={18} className="text-green-400" />
                                            <span className="text-sm text-green-300">KYC Verified on {new Date(submission.reviewedAt).toLocaleDateString()}</span>
                                        </div>
                                    )}

                                    {submission.status === 'rejected' && (
                                        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded flex items-center gap-2">
                                            <XCircle size={18} className="text-red-400" />
                                            <span className="text-sm text-red-300">Rejected on {new Date(submission.reviewedAt).toLocaleDateString()}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;
