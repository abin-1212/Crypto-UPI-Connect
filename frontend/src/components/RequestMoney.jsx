import React, { useState, useContext, useEffect } from 'react';
import { useAuth } from '../context/AuthContext'; // Updated import
import api from '../api/client'; // Updated import
import './RequestMoney.css';
import { ArrowLeftRight, User, Clock, CheckCircle, XCircle } from 'lucide-react'; // Added icons for better UI

// Using useAuth hook instead of useContext(AuthContext) to match project style
const RequestMoney = () => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('create');
    const [formData, setFormData] = useState({
        amount: '',
        currency: 'INR',
        description: '',
        toUPI: '',
        toCryptoAddress: '',
        paymentMethod: 'UPI'
    });
    const [incomingRequests, setIncomingRequests] = useState([]);
    const [myRequests, setMyRequests] = useState([]);
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const createRequest = async () => {
        if (!formData.amount || parseFloat(formData.amount) <= 0) {
            alert('Please enter a valid amount');
            return;
        }

        setLoading(true);
        try {
            const response = await api.post('/api/requests/create', formData);
            alert('Request created successfully!');
            setFormData({
                amount: '',
                currency: 'INR',
                description: '',
                toUPI: '',
                toCryptoAddress: '',
                paymentMethod: 'UPI'
            });
            fetchMyRequests();
        } catch (error) {
            alert(error.response?.data?.error || error.response?.data?.message || 'Failed to create request');
        } finally {
            setLoading(false);
        }
    };

    const fetchIncomingRequests = async () => {
        try {
            const response = await api.get('/api/requests/incoming');
            setIncomingRequests(response.data);
        } catch (error) {
            console.error('Failed to fetch incoming requests:', error);
        }
    };

    const fetchMyRequests = async () => {
        try {
            const response = await api.get('/api/requests/my-requests');
            setMyRequests(response.data);
        } catch (error) {
            console.error('Failed to fetch my requests:', error);
        }
    };

    const payRequest = async (requestId) => {
        if (!window.confirm('Are you sure you want to pay this request?')) return;

        try {
            await api.post(`/api/requests/${requestId}/pay`);
            alert('Payment successful!');
            fetchIncomingRequests();
        } catch (error) {
            alert(error.response?.data?.error || error.response?.data?.message || 'Payment failed');
        }
    };

    // Load requests when component creates/mounts or tab changes
    useEffect(() => {
        if (activeTab === 'incoming') {
            fetchIncomingRequests();
        } else if (activeTab === 'my-requests') {
            fetchMyRequests();
        }
    }, [activeTab]);

    return (
        <div className="request-money-container pt-8 animate-fade-in">
            <div className="tabs">
                <button
                    className={`tab ${activeTab === 'create' ? 'active' : ''}`}
                    onClick={() => setActiveTab('create')}
                >
                    Create Request
                </button>
                <button
                    className={`tab ${activeTab === 'incoming' ? 'active' : ''}`}
                    onClick={() => setActiveTab('incoming')}
                >
                    Incoming ({incomingRequests.length})
                </button>
                <button
                    className={`tab ${activeTab === 'my-requests' ? 'active' : ''}`}
                    onClick={() => setActiveTab('my-requests')}
                >
                    My Requests ({myRequests.length})
                </button>
            </div>

            <div className="tab-content glass-card"> {/* Added glass-card class if global CSS exists, else it uses local css */}
                {activeTab === 'create' && (
                    <div className="create-request">
                        <h2>Request Payment</h2>
                        <div className="form-group">
                            <label>Amount</label>
                            <input
                                type="number"
                                name="amount"
                                value={formData.amount}
                                onChange={handleChange}
                                placeholder="Enter amount"
                                className="input-field" // Using project class
                            />
                        </div>

                        <div className="form-group">
                            <label>Currency</label>
                            <select name="currency" value={formData.currency} onChange={handleChange} className="input-field">
                                <option value="INR">₹ INR</option>
                                <option value="USDC">USDC</option>
                                <option value="DAI">DAI</option>
                                <option value="ETH">ETH</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Payment Method</label>
                            <select name="paymentMethod" value={formData.paymentMethod} onChange={handleChange} className="input-field">
                                <option value="UPI">UPI</option>
                                <option value="CONVERGEX_WALLET">ConvergeX Wallet</option>
                                <option value="METAMASK">MetaMask</option>
                            </select>
                        </div>

                        {formData.paymentMethod === 'UPI' && (
                            <div className="form-group">
                                <label>Recipient UPI ID</label>
                                <input
                                    type="text"
                                    name="toUPI"
                                    value={formData.toUPI}
                                    onChange={handleChange}
                                    placeholder="example@upi"
                                    className="input-field"
                                />
                            </div>
                        )}

                        {formData.paymentMethod !== 'UPI' && (
                            <div className="form-group">
                                <label>Recipient Crypto Address</label>
                                <input
                                    type="text"
                                    name="toCryptoAddress"
                                    value={formData.toCryptoAddress}
                                    onChange={handleChange}
                                    placeholder="cx_..."
                                    className="input-field"
                                />
                            </div>
                        )}

                        <div className="form-group">
                            <label>Description (Optional)</label>
                            <input
                                type="text"
                                name="description"
                                value={formData.description}
                                onChange={handleChange}
                                placeholder="e.g., Dinner bill, Rent, etc."
                                className="input-field"
                            />
                        </div>

                        <button
                            className="create-button button-primary" // Added button-primary class
                            onClick={createRequest}
                            disabled={loading}
                        >
                            {loading ? 'Creating...' : 'Create Request'}
                        </button>
                    </div>
                )}

                {activeTab === 'incoming' && (
                    <div className="incoming-requests">
                        <h2>Payment Requests</h2>
                        {incomingRequests.length === 0 ? (
                            <p className="no-requests">No pending requests</p>
                        ) : (
                            <div className="requests-list">
                                {incomingRequests.map((request) => (
                                    <div key={request._id} className="request-card">
                                        <div className="request-header">
                                            <span className="requester flex items-center gap-2">
                                                <User size={16} />
                                                From: {request.fromUserId?.name || 'Unknown'}
                                            </span>
                                            <span className={`status ${request.status.toLowerCase()}`}>
                                                {request.status}
                                            </span>
                                        </div>
                                        <div className="request-details">
                                            <div className="amount">
                                                {request.amount} {request.currency}
                                            </div>
                                            <div className="description">{request.description}</div>
                                            <div className="method">Via: {request.paymentMethod}</div>
                                            <div className="date flex items-center gap-1">
                                                <Clock size={14} />
                                                {new Date(request.createdAt).toLocaleDateString()}
                                            </div>
                                        </div>
                                        {request.status === 'PENDING' && (
                                            <div className="request-actions">
                                                <button
                                                    className="pay-button"
                                                    onClick={() => payRequest(request.requestId)}
                                                >
                                                    Pay Now
                                                </button>
                                                <button className="decline-button">
                                                    Decline
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'my-requests' && (
                    <div className="my-requests">
                        <h2>My Payment Requests</h2>
                        {myRequests.length === 0 ? (
                            <p className="no-requests">You haven't created any requests</p>
                        ) : (
                            <div className="requests-list">
                                {myRequests.map((request) => (
                                    <div key={request._id} className="request-card">
                                        <div className="request-header">
                                            <span className="to flex items-center gap-2">
                                                <ArrowLeftRight size={16} />
                                                To: {request.toUPI || request.toCryptoAddress?.substring(0, 12) + '...'}
                                            </span>
                                            <span className={`status ${request.status.toLowerCase()}`}>
                                                {request.status}
                                            </span>
                                        </div>
                                        <div className="request-details">
                                            <div className="amount">
                                                {request.amount} {request.currency}
                                            </div>
                                            <div className="description">{request.description}</div>
                                            <div className="method">Via: {request.paymentMethod}</div>
                                            <div className="expires">
                                                Expires: {new Date(request.expiresAt).toLocaleDateString()}
                                            </div>
                                        </div>
                                        <div className="share-section">
                                            <input
                                                type="text"
                                                readOnly
                                                value={`${window.location.origin}/pay/${request.requestId}`}
                                                className="input-field"
                                            />
                                            <button
                                                className="copy-button"
                                                onClick={() => {
                                                    navigator.clipboard.writeText(`${window.location.origin}/pay/${request.requestId}`);
                                                    alert('Link copied!');
                                                }}
                                            >
                                                Copy Link
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default RequestMoney;
