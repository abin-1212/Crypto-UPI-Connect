import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCrypto } from '../../context/CryptoContext';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, Send, ArrowLeftRight, History, LogOut, Menu, X, Wallet, BarChart2, User, Coins, Settings } from 'lucide-react';
import api from '../../api/client';

const Navbar = () => {
    const { user, logout } = useAuth();
    const { connectWallet, userWallet, network } = useCrypto();
    const location = useLocation();
    const navigate = useNavigate();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [pendingCount, setPendingCount] = useState(0);

    // Fetch pending requests count
    useEffect(() => {
        if (!user) return;
        const fetchPending = async () => {
            try {
                const res = await api.get('/notification/count');
                setPendingCount(res.data.count || 0);
            } catch (error) {
                // Silent fail - notification count is not critical
            }
        };
        fetchPending();

        // Poll every 30 seconds for new notifications
        const interval = setInterval(fetchPending, 30000);
        return () => clearInterval(interval);
    }, [user, location.pathname]); // Re-fetch on navigation

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const navItems = [
        { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
        { name: 'Analytics', path: '/analytics', icon: BarChart2 },
        { name: 'Send Money', path: '/send', icon: Send },
        { name: 'Crypto Pay', path: '/crypto-pay', icon: Coins },
        { name: 'Requests', path: '/requests', icon: ArrowLeftRight, badge: pendingCount },
        { name: 'Transactions', path: '/transactions', icon: History },
    ];

    if (user?.role === 'admin') {
        navItems.push({ name: 'Admin', path: '/admin', icon: Settings });
    }

    const isActive = (path) => location.pathname === path;

    if (!user) return null;

    return (
        <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-white/10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    <div className="flex items-center">
                        <Link to="/dashboard" className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center">
                                <Wallet className="w-5 h-5 text-white" />
                            </div>
                            <span className="font-bold text-xl tracking-tight text-white hidden sm:block">ConvergeX</span>
                        </Link>
                    </div>

                    <div className="hidden md:block">
                        <div className="ml-10 flex items-baseline space-x-2">
                            {navItems.map((item) => {
                                const Icon = item.icon;
                                return (
                                    <Link
                                        key={item.name}
                                        to={item.path}
                                        className={`relative flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive(item.path)
                                            ? 'bg-accent/10 text-accent'
                                            : 'text-gray-300 hover:text-white hover:bg-white/5'
                                            }`}
                                    >
                                        <Icon size={18} />
                                        {item.name}
                                        {item.badge > 0 && (
                                            <span className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full">
                                                {item.badge}
                                            </span>
                                        )}
                                    </Link>
                                );
                            })}
                        </div>
                    </div>

                    <div className="hidden md:flex items-center gap-4">
                        {/* Phase 1: MetaMask Wallet */}
                        {userWallet ? (
                            <div className="flex flex-col items-end">
                                <span className="text-xs text-gray-400 font-mono">
                                    {userWallet.substring(0, 6)}...{userWallet.substring(38)}
                                </span>
                                <span className="text-[10px] text-accent font-bold uppercase">
                                    {network?.name || 'Unknown'}
                                </span>
                            </div>
                        ) : (
                            <button
                                onClick={connectWallet}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20 text-xs font-bold hover:bg-orange-500/20 transition-colors"
                            >
                                <Wallet size={14} />
                                Connect MetaMask
                            </button>
                        )}

                        <Link
                            to="/profile"
                            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${isActive('/profile')
                                ? 'bg-white/10 text-white border border-white/20'
                                : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'}`}
                        >
                            <User size={18} />
                            <span>{user.name?.split(' ')[0]}</span>
                        </Link>
                    </div>

                    <div className="-mr-2 flex md:hidden">
                        <button
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-white hover:bg-white/5 focus:outline-none"
                        >
                            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                        </button>
                    </div>
                </div>
            </div>

            <AnimatePresence>
                {mobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="md:hidden glass border-b border-white/10"
                    >
                        <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
                            {navItems.map((item) => (
                                <Link
                                    key={item.name}
                                    to={item.path}
                                    onClick={() => setMobileMenuOpen(false)}
                                    className={`relative block px-3 py-2 rounded-md text-base font-medium ${isActive(item.path)
                                        ? 'bg-accent/10 text-accent'
                                        : 'text-gray-300 hover:text-white hover:bg-white/5'
                                        }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <item.icon size={20} />
                                        {item.name}
                                        {item.badge > 0 && (
                                            <span className="ml-auto bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                                                {item.badge}
                                            </span>
                                        )}
                                    </div>
                                </Link>
                            ))}
                            <Link
                                to="/profile"
                                onClick={() => setMobileMenuOpen(false)}
                                className={`relative block px-3 py-2 rounded-md text-base font-medium ${isActive('/profile')
                                    ? 'bg-accent/10 text-accent'
                                    : 'text-gray-300 hover:text-white hover:bg-white/5'
                                    }`}
                            >
                                <div className="flex items-center gap-2">
                                    <User size={20} />
                                    Profile
                                </div>
                            </Link>
                            <button
                                onClick={() => {
                                    handleLogout();
                                    setMobileMenuOpen(false);
                                }}
                                className="w-full text-left block px-3 py-2 rounded-md text-base font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            >
                                <div className="flex items-center gap-2">
                                    <LogOut size={20} />
                                    Logout
                                </div>
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </nav>
    );
};

export default Navbar;
