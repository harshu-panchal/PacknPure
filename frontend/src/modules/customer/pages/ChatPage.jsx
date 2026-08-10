import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, Send, Phone, Paperclip, Smile } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSettings } from '@core/context/SettingsContext';
import { customerApi } from '../services/customerApi';
import { useToast } from '@shared/components/ui/Toast';
import { handlePhoneClick } from '@shared/utils/phoneUtils';
import { cn } from '@/lib/utils';

const emojis = ['😀', '😂', '😍', '🥺', '😎', '😭', '😡', '👍', '👎', '🎉', '❤️', '🔥', '✅', '❌', '👋', '🙏', '👀', '💯', '💩', '🤡'];

const ChatPage = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { settings } = useSettings();
    const { showToast } = useToast();
    const appName = settings?.appName || 'App';
    const supportPhone = settings?.supportPhone || '';
    
    const ticketIdParam = searchParams.get('ticketId');

    const [messages, setMessages] = useState([]);
    const [ticket, setTicket] = useState(null);
    const [ticketId, setTicketId] = useState(ticketIdParam);
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(true);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);
    
    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);

    // 1. Resolve ticketId from search param or find active live chat
    useEffect(() => {
        if (ticketIdParam) {
            setTicketId(ticketIdParam);
            return;
        }

        const findActiveLiveChat = async () => {
            try {
                setLoading(true);
                const res = await customerApi.getMyTickets();
                if (res.data.success) {
                    const activeChat = (res.data.result || []).find(
                        t => t.subject === "Live Chat Support" && t.status !== "closed"
                    );
                    if (activeChat) {
                        setTicketId(activeChat._id);
                    } else {
                        // Setup default welcome messages when no active chat is found
                        setMessages([
                            { id: 'welcome-1', text: `Hi there! 👋 Welcome to ${appName} Support.`, sender: 'support', time: 'Just now' },
                            { id: 'welcome-2', text: 'How can we help you today? Send a message to start chatting with us.', sender: 'support', time: 'Just now' },
                        ]);
                        setLoading(false);
                    }
                }
            } catch (error) {
                console.error("Error loading active live chat:", error);
                setLoading(false);
            }
        };

        findActiveLiveChat();
    }, [ticketIdParam, appName]);

    // 2. Fetch ticket details helper
    const fetchTicketDetails = async (id, showLoader = false) => {
        try {
            if (showLoader) setLoading(true);
            const res = await customerApi.getTicketById(id);
            if (res.data.success) {
                const fetchedTicket = res.data.result || res.data;
                setTicket(fetchedTicket);
                
                // Map Mongoose ticket messages to component format
                const formattedMessages = (fetchedTicket.messages || []).map((m, i) => ({
                    id: m._id || `msg-${i}`,
                    text: m.text,
                    sender: m.isAdmin ? 'support' : 'user',
                    time: new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                }));
                
                setMessages(formattedMessages);
            }
        } catch (error) {
            console.error("Error fetching ticket details:", error);
        } finally {
            if (showLoader) setLoading(false);
        }
    };

    // 3. Set up polling for updates when ticketId is active
    useEffect(() => {
        if (!ticketId) return;

        fetchTicketDetails(ticketId, true);

        const interval = setInterval(() => {
            fetchTicketDetails(ticketId);
        }, 3000);

        return () => clearInterval(interval);
    }, [ticketId]);

    // 4. Scroll to bottom
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // 5. Send message
    const handleSend = async () => {
        if (!inputText.trim() && !selectedImage) return;

        const textToSend = inputText;
        setInputText('');
        setSelectedImage(null);
        setShowEmojiPicker(false);

        try {
            let activeId = ticketId;
            
            // Create ticket on first live chat message
            if (!activeId) {
                const createRes = await customerApi.createTicket({
                    subject: "Live Chat Support",
                    description: textToSend,
                    priority: "high",
                    userType: "Customer"
                });

                if (createRes.data.success) {
                    const newTicket = createRes.data.result;
                    setTicketId(newTicket._id);
                    return;
                } else {
                    showToast("Failed to start chat session", "error");
                    return;
                }
            }

            // Send reply message
            await customerApi.replyTicket(activeId, textToSend);
            fetchTicketDetails(activeId);
        } catch (error) {
            console.error("Error sending chat message:", error);
            showToast("Failed to send message. Please try again.", "error");
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') handleSend();
    };

    const handleEmojiClick = (emoji) => {
        setInputText(prev => prev + emoji);
    };

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => setSelectedImage(e.target.result);
            reader.readAsDataURL(file);
        }
    };

    const handleStartNewChat = () => {
        setTicketId(null);
        setTicket(null);
        setMessages([
            { id: 'welcome-1', text: `Hi there! 👋 Welcome to ${appName} Support.`, sender: 'support', time: 'Just now' },
            { id: 'welcome-2', text: 'How can we help you today? Send a message to start chatting with us.', sender: 'support', time: 'Just now' },
        ]);
    };

    return (
        <div className="fixed inset-0 bg-white flex flex-col z-[999] overflow-hidden font-sans">
            {/* Chat Header */}
            <div className="bg-white px-4 py-4 flex items-center justify-between border-b border-slate-100 z-30 shrink-0 shadow-sm">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 -ml-2 rounded-full hover:bg-slate-50 transition-colors text-slate-600"
                    >
                        <ChevronLeft size={24} />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <div className="h-10 w-10 bg-[#E23744] rounded-full flex items-center justify-center text-white font-black text-sm shadow-sm ring-2 ring-white">
                                {ticket ? ticket.subject.slice(0, 2).toUpperCase() : 'CS'}
                            </div>
                            <div className={cn(
                                "absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white",
                                ticket?.status === 'closed' ? "bg-slate-400" : "bg-emerald-500 animate-pulse"
                            )}></div>
                        </div>
                        <div>
                            <h1 className="text-sm font-black text-slate-800 leading-none truncate max-w-[180px]">
                                {ticket ? ticket.subject : 'Support Chat'}
                            </h1>
                            <p className={cn(
                                "text-[9px] font-black mt-1 uppercase tracking-wider flex items-center gap-1",
                                ticket?.status === 'closed' ? "text-slate-500" : "text-emerald-600"
                            )}>
                                <span className={cn("h-1 w-1 rounded-full", ticket?.status === 'closed' ? "bg-slate-400" : "bg-emerald-500")}></span>
                                {ticket?.status === 'closed' ? 'Closed' : ticket?.status === 'processing' ? 'Agent Replying' : 'Online'}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <a 
                        href={supportPhone ? `tel:${supportPhone}` : 'tel:+919876543210'} 
                        onClick={(e) => handlePhoneClick(e, supportPhone || '+919876543210')}
                        className="p-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors"
                        title="Call Support"
                    >
                        <Phone size={20} />
                    </a>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto px-4 py-6 pb-24 space-y-6 min-h-0 bg-slate-50/50">
                {loading ? (
                    <div className="flex justify-center items-center h-full">
                        <div className="animate-spin rounded-full h-8 w-8 border-2 border-t-[#E23744] border-slate-200" />
                    </div>
                ) : (
                    <>
                        {messages.map((msg) => (
                            <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] relative group ${msg.sender === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
                                    <div className={`px-4 py-3 rounded-2xl shadow-sm border text-sm leading-relaxed ${msg.sender === 'user'
                                        ? 'bg-[#E23744] text-white border-transparent rounded-tr-none'
                                        : 'bg-white text-slate-700 border-slate-100 rounded-tl-none'
                                        }`}>
                                        {msg.image && (
                                            <img src={msg.image} alt="Sent" className="rounded-lg mb-2 max-w-full h-auto object-cover" />
                                        )}
                                        {msg.text}
                                    </div>
                                    <span className={`text-[9px] font-bold text-slate-400 mt-1.5 px-1 ${msg.sender === 'user' ? 'text-right' : 'text-left'}`}>
                                        {msg.time}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="bg-white p-3 border-t border-slate-100 shrink-0 z-30 safe-area-bottom relative mb-4">
                
                {ticket?.status === 'closed' ? (
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
                        <div>
                            <p className="text-xs font-bold text-slate-700">This support ticket has been closed.</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">Need more help? You can initiate a new support session.</p>
                        </div>
                        <button
                            onClick={handleStartNewChat}
                            className="bg-[#E23744] hover:bg-[#C41E35] text-white text-[10px] font-black uppercase tracking-wider py-2.5 px-4 rounded-xl shadow-md transition-all active:scale-95 flex-shrink-0"
                        >
                            Start New Chat
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Emoji Picker Popover */}
                        <AnimatePresence>
                            {showEmojiPicker && (
                                <motion.div
                                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 20, scale: 0.95 }}
                                    className="absolute bottom-full left-4 mb-2 bg-white rounded-2xl shadow-xl border border-slate-100 p-3 grid grid-cols-5 gap-2 w-64 z-50"
                                >
                                    {emojis.map(emoji => (
                                        <button
                                            key={emoji}
                                            onClick={() => handleEmojiClick(emoji)}
                                            className="text-2xl hover:bg-slate-50 p-2 rounded-lg transition-colors"
                                        >
                                            {emoji}
                                        </button>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Image Preview */}
                        <AnimatePresence>
                            {selectedImage && (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 20 }}
                                    className="absolute bottom-full right-4 mb-2 bg-white rounded-xl shadow-lg border border-slate-100 p-2 z-50"
                                >
                                    <div className="relative">
                                        <img src={selectedImage} alt="Preview" className="h-20 w-20 object-cover rounded-lg" />
                                        <button
                                            onClick={() => setSelectedImage(null)}
                                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition-colors"
                                        >
                                            <div className="h-3 w-3 bg-white rotate-45 transform origin-center absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ clipPath: 'polygon(20% 0%, 0% 20%, 30% 50%, 0% 80%, 20% 100%, 50% 70%, 80% 100%, 100% 80%, 70% 50%, 100% 20%, 80% 0%, 50% 30%)', backgroundColor: 'white', width: '8px', height: '8px' }}></div>
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="flex items-end gap-2 bg-slate-50 p-2 rounded-[1.5rem] border border-slate-200 focus-within:border-brand-300 focus-within:shadow-[0_0_0_4px_rgba(187,0,54,0.12)] transition-all">
                            <button
                                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                className={`p-2.5 rounded-full hover:text-slate-600 hover:bg-slate-200 transition-colors flex-shrink-0 ${showEmojiPicker ? 'text-[#E23744] bg-rose-50' : 'text-slate-400'}`}
                            >
                                <Smile size={22} />
                            </button>

                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept="image/*"
                                onChange={handleFileSelect}
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="p-2.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors flex-shrink-0"
                            >
                                <Paperclip size={22} />
                            </button>

                            <input
                                type="text"
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                onKeyDown={handleKeyPress}
                                placeholder="Type a message..."
                                className="bg-transparent text-sm w-full py-2.5 outline-none text-slate-700 placeholder:text-slate-400 font-medium"
                            />
                            <button
                                onClick={handleSend}
                                disabled={!inputText.trim() && !selectedImage}
                                className="p-2.5 rounded-full bg-[#E23744] text-white hover:bg-[#C41E35] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-brand-200 flex-shrink-0"
                            >
                                <Send size={20} className="ml-0.5" />
                            </button>
                        </div>
                    </>
                )}
            </div>

            <style>
                {`
                    .safe-area-bottom {
                        padding-bottom: env(safe-area-inset-bottom);
                    }
                `}
            </style>
        </div>
    );
};

export default ChatPage;
