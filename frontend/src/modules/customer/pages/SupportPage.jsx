import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MessageCircle, Phone, Mail, ChevronDown, ChevronUp, FileText, ChevronLeft, PlusCircle, X, Send, Search, Clock, ShieldCheck, HelpCircle } from 'lucide-react';
import { useToast } from '@shared/components/ui/Toast';
import { handlePhoneClick, handleEmailClick } from '@shared/utils/contactUtils';
import { useSettings } from '@core/context/SettingsContext';
import { customerApi } from '../services/customerApi';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import axiosInstance from '@core/api/axios';

const FAQ_CACHE_KEY = 'customer_faqs_cache_v1';
const FAQ_CACHE_TTL_MS = 5 * 60 * 1000;

const SupportPage = () => {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const { settings } = useSettings();
    const supportEmail = settings?.supportEmail || 'support@packandpure.com';
    const supportPhone = settings?.supportPhone || '+91 9595429710';
    
    const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
    const [ticketLoading, setTicketLoading] = useState(false);
    const [ticketData, setTicketData] = useState({
        subject: '',
        description: '',
        priority: 'medium'
    });
    const [faqs, setFaqs] = useState([]);
    const [faqSearchQuery, setFaqSearchQuery] = useState('');
    
    // Tab and ticket states
    const [activeTab, setActiveTab] = useState('help');
    const [myTickets, setMyTickets] = useState([]);
    const [ticketsLoading, setTicketsLoading] = useState(false);

    const fetchMyTickets = async () => {
        try {
            setTicketsLoading(true);
            const res = await customerApi.getMyTickets();
            if (res.data.success) {
                setMyTickets(res.data.result || []);
            }
        } catch (error) {
            console.error('Error fetching tickets:', error);
        } finally {
            setTicketsLoading(false);
        }
    };

    useEffect(() => {
        const fetchFaqs = async () => {
            try {
                const cached = sessionStorage.getItem(FAQ_CACHE_KEY);
                if (cached) {
                    const parsed = JSON.parse(cached);
                    const isFresh = parsed?.ts && Date.now() - parsed.ts < FAQ_CACHE_TTL_MS;
                    if (isFresh && Array.isArray(parsed?.items)) {
                        setFaqs(parsed.items);
                        return;
                    }
                }
            } catch {
                // Ignore malformed cache and fall through to API.
            }

            try {
                const response = await axiosInstance.get('/public/faqs', {
                    params: { category: 'Customer', status: 'published' }
                });
                const data = response.data?.result ?? response.data;
                const list = Array.isArray(data?.items) ? data.items : Array.isArray(data?.results) ? data.results : [];
                setFaqs(list);
                sessionStorage.setItem(
                    FAQ_CACHE_KEY,
                    JSON.stringify({ ts: Date.now(), items: list })
                );
            } catch (error) {
                console.error('Error fetching FAQs:', error);
            }
        };

        fetchFaqs();
    }, []);

    useEffect(() => {
        if (activeTab === 'tickets') {
            fetchMyTickets();
        }
    }, [activeTab]);

    const handleTicketSubmit = async (e) => {
        e.preventDefault();
        try {
            setTicketLoading(true);
            const res = await customerApi.createTicket({
                ...ticketData,
                userType: 'Customer'
            });
            if (res.data.success) {
                showToast("Ticket raised successfully", "success");
                setIsTicketModalOpen(false);
                setTicketData({ subject: '', description: '', priority: 'medium' });
                setActiveTab('tickets');
                fetchMyTickets();
            }
        } catch (error) {
            showToast(error.response?.data?.message || "Failed to create ticket", "error");
        } finally {
            setTicketLoading(false);
        }
    };

    const filteredFaqs = faqs.filter(faq => 
        faq.question?.toLowerCase().includes(faqSearchQuery.toLowerCase()) ||
        faq.answer?.toLowerCase().includes(faqSearchQuery.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-slate-50 pb-24 md:pb-12 font-sans">
            <main className="px-4 sm:px-6 lg:px-8 pt-4 md:pt-8 max-w-2xl md:max-w-5xl lg:max-w-6xl mx-auto space-y-6 relative z-20">
                <div className="mb-2 md:mb-4">
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => navigate(-1)}
                            className="shrink-0 rounded-full p-2 hover:bg-slate-200/70 transition-colors -ml-2"
                            aria-label="Back"
                        >
                            <ChevronLeft size={22} className="text-slate-900" />
                        </button>
                        <div className="min-w-0 flex-1">
                            <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight">Help & Support</h1>
                            <p className="hidden sm:block text-xs md:text-sm text-slate-500 mt-0.5">
                                Have questions or need assistance? Contact us or explore our FAQs below.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-200 max-w-md">
                    <button
                        onClick={() => setActiveTab('help')}
                        className={cn(
                            "flex-1 py-3 text-center text-sm font-bold border-b-2 transition-all",
                            activeTab === 'help'
                                ? "border-[#E23744] text-[#E23744]"
                                : "border-transparent text-slate-500 hover:text-slate-700"
                        )}
                    >
                        Help Center
                    </button>
                    <button
                        onClick={() => setActiveTab('tickets')}
                        className={cn(
                            "flex-1 py-3 text-center text-sm font-bold border-b-2 transition-all flex items-center justify-center gap-1.5",
                            activeTab === 'tickets'
                                ? "border-[#E23744] text-[#E23744]"
                                : "border-transparent text-slate-500 hover:text-slate-700"
                        )}
                    >
                        <span>My Tickets</span>
                        {myTickets.length > 0 && (
                            <span className={cn(
                                "px-2 py-0.5 text-[10px] rounded-full font-black",
                                activeTab === 'tickets' ? "bg-rose-100 text-[#E23744]" : "bg-slate-100 text-slate-600"
                            )}>
                                {myTickets.length}
                            </span>
                        )}
                    </button>
                </div>

                {activeTab === 'help' ? (
                    <div className="space-y-6">
                        {/* Contact Channels Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 md:gap-5">
                            <ContactCard icon={MessageCircle} label="Chat Us" sub="Instant Support" to="/chat" />
                            <ContactCard
                                icon={PlusCircle}
                                label="Raise Ticket"
                                sub="Formal Request"
                                onClick={() => setIsTicketModalOpen(true)}
                            />
                            <ContactCard
                                icon={Phone}
                                label="Call Us"
                                sub={supportPhone}
                                to={supportPhone ? `tel:${supportPhone}` : 'tel:+919595429710'}
                            />
                            <ContactCard
                                icon={Mail}
                                label="Email Us"
                                sub={supportEmail}
                                to={supportEmail ? `mailto:${supportEmail}` : 'mailto:support@packandpure.com'}
                            />
                        </div>

                        {/* Layout Split on Desktop: FAQs on left (8 col), Info & Legal on right (4 col) */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
                            {/* Left Column: FAQ Accordion */}
                            <div className="lg:col-span-8 space-y-4">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
                                    <h2 className="text-lg font-bold text-slate-800">Frequently Asked Questions</h2>
                                    {faqs.length > 3 && (
                                        <div className="relative w-full sm:w-64">
                                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input
                                                type="text"
                                                placeholder="Search questions..."
                                                value={faqSearchQuery}
                                                onChange={(e) => setFaqSearchQuery(e.target.value)}
                                                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:border-[#E23744] transition-colors"
                                            />
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-3">
                                    {filteredFaqs.length > 0 ? (
                                        filteredFaqs.map((faq) => (
                                            <FAQItem
                                                key={faq._id}
                                                question={faq.question}
                                                answer={faq.answer}
                                            />
                                        ))
                                    ) : (
                                        <div className="bg-white rounded-2xl shadow-[0_4px_10px_rgb(0,0,0,0.02)] border border-slate-200 px-5 py-8 text-sm text-slate-400 text-center">
                                            No FAQs matching your search.
                                        </div>
                                    )}
                                </div>

                                {/* Legal Links for Mobile / Tablet */}
                                <div className="lg:hidden bg-white rounded-xl p-4 border border-slate-200 mt-6">
                                    <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-3">Legal & Policies</h3>
                                    <div className="space-y-3">
                                        <Link to="/terms" className="flex items-center gap-2.5 text-slate-700 hover:text-[#E23744] text-sm font-medium transition-colors">
                                            <FileText size={18} /> Terms & Conditions
                                        </Link>
                                        <Link to="/privacy" className="flex items-center gap-2.5 text-slate-700 hover:text-[#E23744] text-sm font-medium transition-colors">
                                            <ShieldCheck size={18} /> Privacy Policy
                                        </Link>
                                    </div>
                                </div>
                            </div>

                            {/* Right Column: Desktop Info & Legal Sidebar */}
                            <div className="hidden lg:block lg:col-span-4 space-y-5">
                                {/* Support Hours & Info Card */}
                                <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm space-y-4">
                                    <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                                        <div className="h-10 w-10 rounded-xl bg-rose-50 flex items-center justify-center text-[#E23744]">
                                            <Clock size={20} />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-900 text-sm">Customer Care Hours</h3>
                                            <p className="text-xs text-slate-500">Mon - Sat: 9:00 AM - 8:00 PM</p>
                                        </div>
                                    </div>

                                    <div className="space-y-2 text-xs text-slate-600">
                                        <div className="flex items-center justify-between">
                                            <span className="text-slate-500">Avg. Response Time</span>
                                            <span className="font-bold text-emerald-600">Under 15 mins</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-slate-500">Support Availability</span>
                                            <span className="font-bold text-slate-800">24/7 Ticket System</span>
                                        </div>
                                    </div>

                                    <Button
                                        onClick={() => setIsTicketModalOpen(true)}
                                        className="w-full bg-[#E23744] hover:bg-[#C41E35] text-white font-bold text-xs py-3 rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
                                    >
                                        <PlusCircle size={16} /> Raise Support Ticket
                                    </Button>
                                </div>

                                {/* Desktop Legal Card */}
                                <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm space-y-3">
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Legal & Policies</h3>
                                    <div className="space-y-2.5 pt-1">
                                        <Link to="/terms" className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 text-slate-700 hover:text-slate-900 text-sm font-semibold transition-colors group">
                                            <div className="flex items-center gap-2.5">
                                                <FileText size={18} className="text-slate-400 group-hover:text-[#E23744]" />
                                                <span>Terms & Conditions</span>
                                            </div>
                                            <ChevronLeft size={16} className="rotate-180 text-slate-300 group-hover:text-slate-600" />
                                        </Link>
                                        <Link to="/privacy" className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 text-slate-700 hover:text-slate-900 text-sm font-semibold transition-colors group">
                                            <div className="flex items-center gap-2.5">
                                                <ShieldCheck size={18} className="text-slate-400 group-hover:text-[#E23744]" />
                                                <span>Privacy Policy</span>
                                            </div>
                                            <ChevronLeft size={16} className="rotate-180 text-slate-300 group-hover:text-slate-600" />
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {ticketsLoading ? (
                            <div className="flex justify-center items-center py-12">
                                <div className="animate-spin rounded-full h-8 w-8 border-2 border-t-[#E23744] border-slate-200" />
                            </div>
                        ) : myTickets.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {myTickets.map((ticket) => (
                                    <div key={ticket._id} className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-[0_4px_10px_rgb(0,0,0,0.02)] space-y-3 flex flex-col justify-between">
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className={cn(
                                                        "text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full",
                                                        ticket.priority === 'high' ? "bg-rose-50 text-rose-600 border border-rose-100" : ticket.priority === 'medium' ? "bg-amber-50 text-amber-600 border border-amber-100" : "bg-slate-50 text-slate-600 border border-slate-100"
                                                    )}>
                                                        {ticket.priority}
                                                    </span>
                                                    <span className={cn(
                                                        "text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full",
                                                        ticket.status === 'open' ? "bg-blue-50 text-blue-600 border border-blue-100" : ticket.status === 'processing' ? "bg-purple-50 text-purple-600 border border-purple-100" : "bg-emerald-50 text-emerald-600 border border-emerald-100"
                                                    )}>
                                                        {ticket.status}
                                                    </span>
                                                </div>
                                                <span className="text-[10px] text-slate-400 font-bold">
                                                    {new Date(ticket.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                                                </span>
                                            </div>
                                            <div>
                                                <h3 className="font-extrabold text-slate-800 text-sm sm:text-base leading-snug">{ticket.subject}</h3>
                                                <p className="text-xs text-slate-500 mt-1 line-clamp-3 leading-relaxed">{ticket.description}</p>
                                            </div>
                                        </div>
                                        <div className="pt-3 flex items-center justify-between border-t border-slate-100 mt-2">
                                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                                {ticket.messages?.length || 1} Message(s)
                                            </span>
                                            <Link 
                                                to={`/chat?ticketId=${ticket._id}`}
                                                className="text-xs text-[#E23744] hover:text-[#C41E35] font-black uppercase tracking-wider flex items-center gap-1"
                                            >
                                                View Discussion &rarr;
                                            </Link>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="bg-white rounded-2xl shadow-[0_4px_10px_rgb(0,0,0,0.02)] border border-slate-200 px-5 py-12 text-sm text-slate-400 text-center flex flex-col items-center gap-3">
                                <FileText size={44} className="text-slate-200" />
                                <div>
                                    <p className="font-bold text-slate-700 text-base">No tickets raised yet</p>
                                    <p className="text-xs text-slate-400 mt-1">If you have any issues with your orders or account, raise a ticket to get instant support.</p>
                                </div>
                                <Button 
                                    onClick={() => setIsTicketModalOpen(true)}
                                    className="bg-[#E23744] hover:bg-[#C41E35] text-white font-bold text-xs py-2.5 px-5 rounded-xl mt-2 shadow-md transition-all"
                                >
                                    Raise Ticket Now
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* Ticket Creation Modal */}
            <AnimatePresence>
                {isTicketModalOpen && (
                    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsTicketModalOpen(false)}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ y: "100%" }}
                            animate={{ y: 0 }}
                            exit={{ y: "100%" }}
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            className="relative bg-white w-full max-w-lg rounded-t-[2.5rem] sm:rounded-3xl shadow-2xl overflow-hidden z-10"
                        >
                            <div className="p-6 sm:p-8">
                                <div className="flex items-center justify-between mb-6">
                                    <div>
                                        <h2 className="text-xl sm:text-2xl font-black text-slate-800">Raise a Ticket</h2>
                                        <p className="text-xs sm:text-sm text-slate-500 font-medium">Describe your issue in detail</p>
                                    </div>
                                    <button
                                        onClick={() => setIsTicketModalOpen(false)}
                                        className="w-9 h-9 flex items-center justify-center bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>

                                <form onSubmit={handleTicketSubmit} className="space-y-5">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Subject</label>
                                        <input
                                            type="text"
                                            required
                                            value={ticketData.subject}
                                            onChange={(e) => setTicketData({ ...ticketData, subject: e.target.value })}
                                            placeholder="What's the issue about?"
                                            className="w-full bg-slate-50 border border-slate-200/60 rounded-2xl px-5 py-3.5 text-sm font-bold outline-none focus:border-[#E23744] focus:bg-white transition-all"
                                        />
                                    </div>

                                    <div className="grid grid-cols-3 gap-3">
                                        {['low', 'medium', 'high'].map((p) => (
                                            <button
                                                key={p}
                                                type="button"
                                                onClick={() => setTicketData({ ...ticketData, priority: p })}
                                                className={cn(
                                                    "py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border",
                                                    ticketData.priority === p
                                                        ? "bg-[#E23744] text-white border-[#E23744] shadow-md shadow-rose-100"
                                                        : "bg-white text-slate-400 border-slate-200 hover:bg-slate-50"
                                                )}
                                            >
                                                {p}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Description</label>
                                        <textarea
                                            required
                                            value={ticketData.description}
                                            onChange={(e) => setTicketData({ ...ticketData, description: e.target.value })}
                                            placeholder="Please explain the issue clearly..."
                                            className="w-full bg-slate-50 border border-slate-200/60 rounded-2xl px-5 py-3.5 text-sm font-bold min-h-[140px] outline-none focus:border-[#E23744] focus:bg-white transition-all"
                                        />
                                    </div>

                                    <Button
                                        type="submit"
                                        disabled={ticketLoading}
                                        className="w-full h-13 bg-[#E23744] hover:bg-[#C41E35] text-white text-base font-black rounded-2xl shadow-xl shadow-rose-100 transition-all active:scale-95"
                                    >
                                        {ticketLoading ? (
                                            <div className="flex items-center gap-2 text-center w-full justify-center">
                                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                SUBMITTING...
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 text-center w-full justify-center">
                                                <Send size={18} /> SUBMIT TICKET
                                            </div>
                                        )}
                                    </Button>
                                </form>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

const ContactCard = ({ icon: Icon, label, sub, to, onClick }) => {
    const cardClassName = "bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 flex flex-col items-center justify-center text-center gap-2.5 hover:bg-slate-50 hover:border-slate-300 hover:shadow-md transition-all cursor-pointer group h-full";
    const content = (
        <>
            <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-2xl bg-slate-100 group-hover:bg-[#E23744] group-hover:text-white flex items-center justify-center text-slate-700 transition-all duration-200 shrink-0">
                <Icon size={22} />
            </div>
            <div className="w-full min-w-0">
                <h3 className="font-bold text-slate-800 text-sm sm:text-base whitespace-nowrap">{label}</h3>
                <p className="text-[11px] sm:text-xs text-slate-500 font-medium truncate max-w-full px-1" title={sub}>{sub}</p>
            </div>
        </>
    );

    // Real <a href="tel:/mailto:"> — dispatching a synthetic click on a
    // detached anchor is unreliable inside some mobile WebViews.
    if (to && (to.startsWith('tel:') || to.startsWith('mailto:'))) {
        const handleCardClick = (e) => {
            if (to.startsWith('tel:')) {
                handlePhoneClick(e, to.substring(4));
            } else if (to.startsWith('mailto:')) {
                handleEmailClick(e, to.substring(7));
            }
        };
        return (
            <a href={to} onClick={handleCardClick} className={cardClassName}>
                {content}
            </a>
        );
    }

    if (to) {
        return (
            <Link to={to} className={cardClassName}>
                {content}
            </Link>
        );
    }

    return (
        <button type="button" onClick={onClick} className={cardClassName}>
            {content}
        </button>
    );
};

const FAQItem = ({ question, answer }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-sm hover:border-slate-300 transition-colors">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-slate-50/70 transition-colors gap-3"
            >
                <span className="font-bold text-slate-800 text-sm md:text-base leading-snug">{question}</span>
                <div className="shrink-0 h-7 w-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                    {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
            </button>
            {isOpen && (
                <div className="px-5 pb-4 pt-1 text-sm text-slate-600 font-normal leading-relaxed border-t border-slate-100 bg-slate-50/40">
                    {answer}
                </div>
            )}
        </div>
    );
};

export default SupportPage;
