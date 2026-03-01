import React, { useState, useEffect } from 'react';
import { useAdmin } from '../context/AdminContext';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
    Users, DollarSign, CreditCard, TrendingUp,
    Activity, Shield, BarChart3, Calendar,
    Search, Filter, Download, MoreVertical,
    ArrowUpRight, ArrowDownLeft, AlertCircle
} from 'lucide-react';
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

const KYCManagement = () => (
    <div className="glass p-12 text-center animate-fade-in">
        <Shield size={48} className="mx-auto mb-4 text-accent/50" />
        <h2 className="text-2xl font-bold mb-2">KYC & Compliance</h2>
        <p className="text-gray-400">Global KYC verification portal for ConvergeX users.</p>
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass p-6 text-left">
                <div className="text-3xl font-bold mb-1">0</div>
                <div className="text-sm text-gray-400">Pending Reviews</div>
            </div>
            <div className="glass p-6 text-left border-l-4 border-accent">
                <div className="text-3xl font-bold mb-1">0</div>
                <div className="text-sm text-gray-400">Verified Entities</div>
            </div>
            <div className="glass p-6 text-left border-l-4 border-red-500/50">
                <div className="text-3xl font-bold mb-1">0</div>
                <div className="text-sm text-gray-400">Flagged Profiles</div>
            </div>
        </div>
    </div>
);

export default AdminDashboard;
