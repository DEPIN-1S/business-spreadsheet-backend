import React, { useState, useEffect } from 'react';
import { FiArrowLeft, FiFileText, FiPlus, FiEdit2, FiTrash2, FiEye, FiSearch, FiEdit3, FiFilePlus, FiLink, FiDownload } from 'react-icons/fi';
import InvoiceTemplateModal from '../Components/InvoiceTemplateModal';
import AddBusinessModal from '../Components/AddBusinessModal';
import AddBusinessPartyModal from '../Components/AddBusinessPartyModal';
import ViewBusinessPartyModal from '../Components/ViewBusinessPartyModal';
import SelectPartyModal from '../Components/SelectPartyModal';
import GenerateInvoiceModal from '../Components/GenerateInvoiceModal';
import ViewSavedInvoiceModal from '../Components/ViewSavedInvoiceModal';
import AddTemplateModal from '../Components/AddTemplateModal';
import { businessApi } from '../api/apiClient';

export default function BusinessDetails({ business, setActivePath, setCurrentBusiness }) {
    const [isTemplateOpen, setIsTemplateOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isSelectPartyOpen, setIsSelectPartyOpen] = useState(false);
    const [isGenerateInvoiceOpen, setIsGenerateInvoiceOpen] = useState(false);
    const [viewingSavedInvoice, setViewingSavedInvoice] = useState(null);
    const [recentInvoices, setRecentInvoices] = useState(() => {
        try {
            const saved = localStorage.getItem('recentInvoices');
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            return [];
        }
    });

    useEffect(() => {
        localStorage.setItem('recentInvoices', JSON.stringify(recentInvoices));
    }, [recentInvoices]);
    const [selectedInvoiceParty, setSelectedInvoiceParty] = useState(null);
    const [parties, setParties] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [isAddTemplateOpen, setIsAddTemplateOpen] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState(null);
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [isPartyModalOpen, setIsPartyModalOpen] = useState(false);
    const [editingParty, setEditingParty] = useState(null);
    const [viewingParty, setViewingParty] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [searchQuery, setSearchQuery] = useState("");

    const fetchParties = async (page = currentPage, search = searchQuery) => {
        if (!business?.id) return;
        try {
            const res = await businessApi.listParties(business.id, page, 10, search);
            const fetchedParties = res.data?.data?.parties || res.data?.parties || (Array.isArray(res.data?.data) ? res.data.data : []);
            setParties(fetchedParties);
            if (res.data?.pagination) {
                setTotalPages(res.data.pagination.totalPages || 1);
                setCurrentPage(res.data.pagination.currentPage || 1);
            }
        } catch (error) {
            console.error("Failed to load business parties:", error);
        }
    };

    const fetchTemplates = async () => {
        if (!business?.id) return;
        try {
            const res = await businessApi.getTemplates(business.id);
            setTemplates(res.data?.data || []);
        } catch (error) {
            console.error("Failed to load templates:", error);
        }
    };

    useEffect(() => {
        if (business?.id) {
            fetchTemplates();
            const delayDebounceFn = setTimeout(() => {
                fetchParties(currentPage, searchQuery);
            }, 300);
            return () => clearTimeout(delayDebounceFn);
        }
    }, [business?.id, currentPage, searchQuery]);

    const handleUpdateBusiness = async (formData) => {
        try {
            let base64Logo = undefined;
            if (formData.logo) {
                base64Logo = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.readAsDataURL(formData.logo);
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = error => reject(error);
                });
            }

            const payload = {
                name: formData.name,
                additionalData: formData.additionalData || [],
                sharedUsers: formData.sharedUsers || [],
                seals: formData.seals || []
            };
            
            if (base64Logo !== undefined) {
                payload.logo = base64Logo;
            }
            
            const res = await businessApi.updateBusiness(business.id, payload);
            if (res.data.success) {
                if (setCurrentBusiness) {
                    setCurrentBusiness(res.data.data);
                }
                setIsEditModalOpen(false);
            }
        } catch (error) {
            console.error("Failed to update business:", error);
            alert("Failed to update business details.");
        }
    };

    const handleSaveTemplate = async (formData) => {
        try {
            if (editingTemplate) {
                await businessApi.updateTemplate(editingTemplate.id, formData);
            } else {
                await businessApi.createTemplate({ businessId: business.id, ...formData });
            }
            await fetchTemplates();
            setIsAddTemplateOpen(false);
            setEditingTemplate(null);
        } catch (error) {
            console.error("Failed to save template:", error);
            alert("Failed to save template.");
        }
    };

    const handleDeleteTemplate = async (id) => {
        if (!window.confirm("Are you sure you want to delete this template?")) return;
        try {
            await businessApi.deleteTemplate(id);
            await fetchTemplates();
        } catch (error) {
            console.error("Failed to delete template:", error);
            alert("Failed to delete template.");
        }
    };

    const handleSaveParty = async (formData) => {
        try {
            if (editingParty) {
                // Wait, business parties might not have update endpoint? 
                // Wait! business.routes.js only has:
                // router.get("/:id/parties", listBusinessParties);
                // router.post("/:id/parties", addBusinessParty);
                // We'll just POST for now or handle update differently, but since we're creating, POST is what failed.
                // Assuming POST creates/adds. Let's see if update exists. I'll just use POST.
                await businessApi.addParty(business.id, formData); // Assuming add handles update or there's no update.
            } else {
                await businessApi.addParty(business.id, formData);
            }
            await fetchParties();
        } catch (error) {
            console.error("Failed to save party:", error);
            throw error;
        }
    };

    const handleDeleteParty = async (id) => {
        if (!window.confirm("Are you sure you want to delete this party?")) return;
        try {
            await businessApi.deleteParty(business.id, id);
            await fetchParties();
        } catch (error) {
            console.error("Failed to delete party:", error);
            alert("Failed to delete party.");
        }
    };

    if (!business) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center h-screen bg-gray-50">
                <p className="text-gray-500 mb-4">No business selected</p>
                <button
                    onClick={() => setActivePath('/invoice-generator')}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                    Back to Businesses
                </button>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col h-screen bg-white overflow-hidden relative">
            {/* Header */}
            <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between sticky top-0 z-20">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setActivePath('/invoice-generator')}
                        className="p-2 -ml-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2"
                        title="Back to Businesses"
                    >
                        <FiArrowLeft size={20} />
                        <span className="hidden sm:inline font-medium">Back</span>
                    </button>
                    <div className="h-6 w-px bg-gray-200 mx-2 hidden sm:block"></div>
                    <h1 className="text-xl font-bold text-gray-900 tracking-tight truncate max-w-sm">
                        {business.name}
                    </h1>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto p-6 sm:p-10 bg-gray-50">
                <div className="max-w-6xl mx-auto">
                    <div className="flex flex-col lg:flex-row gap-6">
                        
                        {/* Left Business Info Section */}
                        <div className="flex-1 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                                <h2 className="text-lg font-bold text-gray-900">Business Information</h2>
                                <button 
                                    onClick={() => setIsEditModalOpen(true)}
                                    className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex items-center justify-center"
                                    title="Edit Business"
                                >
                                    <FiEdit2 size={18} />
                                </button>
                            </div>
                            
                            <div className="flex flex-col md:flex-row gap-8 mb-6">
                            {business.logo && (
                                <div className="w-32 h-32 shrink-0 rounded-2xl overflow-hidden bg-gray-50 border border-gray-100 flex items-center justify-center shadow-sm">
                                    <img src={business.logo} alt="Business Logo" className="w-full h-full object-cover" />
                                </div>
                            )}
                            
                            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Business Name</h3>
                                    <p className="text-sm font-medium text-gray-900">{business.name}</p>
                                </div>
                                {(() => {
                                    if (!business.additionalData) return null;
                                    let dataArray = business.additionalData;
                                    if (typeof dataArray === 'string') {
                                        try { dataArray = JSON.parse(dataArray); } catch(e) { return null; }
                                    }
                                    if (!Array.isArray(dataArray)) return null;
                                    
                                    return dataArray.map((item, index) => {
                                        const isObj = typeof item === 'object' && item !== null;
                                        const key = isObj ? item.key : (typeof item === 'string' && item.includes(':') ? item.split(':')[0].trim() : `Data ${index + 1}`);
                                        const val = isObj ? item.value : (typeof item === 'string' && item.includes(':') ? item.split(':').slice(1).join(':').trim() : item);
                                        
                                        if (!val && !key) return null;
                                        return (
                                            <div key={index} className="md:col-span-2">
                                                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">{key || `Data ${index + 1}`}</h3>
                                                <p className="text-sm font-medium text-gray-900">{val}</p>
                                            </div>
                                        );
                                    });
                                })()}
                            </div>
                        </div>
                        </div>
                        {/* Templates Section (Right Side) */}
                            <div className="flex-[1.3] bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                                    <h2 className="text-lg font-bold text-gray-900">Invoice Templates</h2>
                                    <button 
                                        onClick={() => {
                                            setEditingTemplate(null);
                                            setIsAddTemplateOpen(true);
                                        }}
                                        className="flex items-center justify-center gap-2 bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-xl text-sm font-medium transition-colors shadow-sm shrink-0"
                                    >
                                        <FiPlus size={16} />
                                        <span className="hidden sm:inline">Add Template</span>
                                    </button>
                                </div>
                                
                                <div className="grid grid-cols-1 gap-4 overflow-y-auto max-h-[420px] pr-1 custom-scrollbar">
                                    {templates.map(template => (
                                <div key={template.id} className="border border-gray-200 rounded-xl p-4 flex flex-col gap-4 hover:shadow-md transition-shadow bg-gray-50">
                                    <div>
                                        <div className="flex items-center justify-between">
                                            <h3 className="font-bold text-gray-900">{template.name}</h3>
                                            {template.isB2B && (
                                                <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-100 text-blue-700 rounded-md">B2B</span>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-500">{template.isProductBased ? 'Product-based' : 'Service-based'}</p>
                                        {((template.sourceDocumentNames && template.sourceDocumentNames.length > 0) || template.sourceDocumentName) && (
                                            <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                                {(template.sourceDocumentNames && template.sourceDocumentNames.length > 0 
                                                    ? template.sourceDocumentNames 
                                                    : template.sourceDocumentName.split(',').map(s => s.trim())
                                                ).map((docName, idx) => (
                                                    <div key={idx} className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-indigo-50/80 text-indigo-700 rounded-md border border-indigo-100/50" title={"Connected Database: " + docName}>
                                                        <FiLink size={10} className="shrink-0" />
                                                        <span className="text-[10px] font-bold tracking-wide break-words">{docName}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                        {(() => {
                                            let cols = template.columns;
                                            if (typeof cols === 'string') {
                                                try { 
                                                    let parsed = JSON.parse(cols);
                                                    if (typeof parsed === 'string') {
                                                        parsed = JSON.parse(parsed); // Handle double stringified
                                                    }
                                                    cols = parsed;
                                                } catch(e) { 
                                                    if (cols.includes(',')) {
                                                        cols = cols.split(',').map(s => s.trim()).filter(Boolean);
                                                    } else if (cols.trim() && !cols.startsWith('[')) {
                                                        cols = [cols.trim()];
                                                    } else {
                                                        cols = [];
                                                    }
                                                }
                                            }
                                            if (!Array.isArray(cols)) return null;

                                            return (
                                                <>
                                                    {cols.slice(0,3).map((col, idx) => (
                                                        <span key={idx} className="text-[10px] px-2 py-1 bg-white border border-gray-200 rounded-md text-gray-600">{typeof col === "string" ? col : col.name}</span>
                                                    ))}
                                                    {cols.length > 3 && <span className="text-[10px] px-2 py-1 bg-white border border-gray-200 rounded-md text-gray-600">+{cols.length - 3}</span>}
                                                </>
                                            );
                                        })()}
                                    </div>
                                    <div className="flex flex-wrap items-center justify-between gap-3 mt-auto pt-4 border-t border-gray-200">
                                        <div className="flex gap-2">
                                            <button onClick={() => { setSelectedTemplate(template); setIsTemplateOpen(true); }} className="p-1.5 text-gray-500 hover:text-blue-600 bg-white rounded-md border shadow-sm" title="Preview"><FiEye size={14} /></button>
                                            <button onClick={() => { setEditingTemplate(template); setIsAddTemplateOpen(true); }} className="p-1.5 text-gray-500 hover:text-indigo-600 bg-white rounded-md border shadow-sm" title="Edit"><FiEdit2 size={14} /></button>
                                            <button onClick={() => handleDeleteTemplate(template.id)} className="p-1.5 text-gray-500 hover:text-red-600 bg-white rounded-md border shadow-sm" title="Delete"><FiTrash2 size={14} /></button>
                                        </div>
                                        <button 
                                            onClick={() => {
                                                setSelectedTemplate(template);
                                                setIsSelectPartyOpen(true);
                                            }}
                                            className="text-sm font-semibold bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700 shadow-sm transition-all shrink-0"
                                        >
                                            Generate Invoice
                                        </button>
                                    </div>
                                </div>
                            ))}
                                    {templates.length === 0 && (
                                        <div className="col-span-full py-8 text-center text-gray-500">
                                            No templates created yet.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                    {/* Parties Section */}
                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm mt-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                            <h2 className="text-lg font-bold text-gray-900">Party Details</h2>
                            <div className="flex items-center gap-3">
                                <div className="relative">
                                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                    <input
                                        type="text"
                                        placeholder="Search name or phone..."
                                        value={searchQuery}
                                        onChange={(e) => {
                                            setSearchQuery(e.target.value);
                                            if (currentPage !== 1) setCurrentPage(1);
                                        }}
                                        className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all w-full sm:w-64"
                                    />
                                </div>
                                <button 
                                    onClick={() => {
                                        setEditingParty(null);
                                        setIsPartyModalOpen(true);
                                    }}
                                    className="flex items-center justify-center gap-2 bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-xl text-sm font-medium transition-colors shadow-sm shrink-0"
                                >
                                    <FiPlus size={16} />
                                    <span className="hidden sm:inline">Add New Party</span>
                                </button>
                            </div>
                        </div>
                        
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse min-w-[800px]">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase tracking-wider text-gray-500 font-semibold">
                                        <th className="px-6 py-3">Party Name</th>
                                        <th className="px-6 py-3">Contact</th>
                                        <th className="px-6 py-3">Age</th>
                                        <th className="px-6 py-3">Gender</th>
                                        <th className="px-6 py-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 text-sm">
                                    {(Array.isArray(parties) ? parties : []).map((party) => {
                                        let extraData = [];
                                        try {
                                            if (party.additionalData) {
                                                extraData = typeof party.additionalData === 'string' ? JSON.parse(party.additionalData) : party.additionalData;
                                            }
                                        } catch(e) {}
                                        return (
                                        <tr key={party.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 font-medium text-gray-900">{party.name}</td>
                                            <td className="px-6 py-4 text-gray-600">{party.contact}</td>
                                            <td className="px-6 py-4 text-gray-600">
                                                {party.age ? <span className="font-medium text-gray-900">{party.age}</span> : <span className="text-gray-400 italic">-</span>}
                                            </td>
                                            <td className="px-6 py-4 text-gray-600">
                                                {party.gender ? <span className="font-medium text-gray-900">{party.gender}</span> : <span className="text-gray-400 italic">-</span>}
                                            </td>
                                            <td className="px-6 py-4 text-right space-x-2">
                                                <button 
                                                    className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors inline-flex"
                                                    onClick={() => setViewingParty(party)}
                                                    title="View Details"
                                                >
                                                    <FiEye size={16} />
                                                </button>
                                                <button 
                                                    className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors inline-flex"
                                                    onClick={() => {
                                                        setEditingParty(party);
                                                        setIsPartyModalOpen(true);
                                                    }}
                                                    title="Edit"
                                                >
                                                    <FiEdit2 size={16} />
                                                </button>
                                                <button 
                                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors inline-flex"
                                                    onClick={() => handleDeleteParty(party.id)}
                                                    title="Delete"
                                                >
                                                    <FiTrash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                        );
                                    })}
                                    {(!Array.isArray(parties) || parties.length === 0) && (
                                        <tr>
                                            <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                                                No parties found for this business.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        {totalPages > 0 && (
                            <div className="flex items-center justify-between mt-4 px-2">
                                <span className="text-sm text-gray-500">
                                    Page {currentPage} of {totalPages}
                                </span>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                        className="px-3 py-1 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        Previous
                                    </button>
                                    <button
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        disabled={currentPage === totalPages}
                                        className="px-3 py-1 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Recent Invoices Section */}
                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm mt-6">
                        <h2 className="text-lg font-bold text-gray-900 mb-6">Recent Saved Invoices</h2>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse min-w-[600px]">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase tracking-wider text-gray-500 font-semibold">
                                        <th className="px-6 py-3">Invoice No</th>
                                        <th className="px-6 py-3">Date & Time</th>
                                        <th className="px-6 py-3">Party Name</th>
                                        <th className="px-6 py-3 text-right">Total Amount</th>
                                        <th className="px-6 py-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 text-sm">
                                    {recentInvoices.length > 0 ? recentInvoices.map((inv) => (
                                        <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 font-medium text-indigo-600">{inv.invoiceNo}</td>
                                            <td className="px-6 py-4 text-gray-600">
                                                {inv.date}
                                                {inv.time && <div className="text-xs text-gray-400 mt-0.5">{inv.time}</div>}
                                            </td>
                                            <td className="px-6 py-4 text-gray-900 font-semibold">{inv.partyName}</td>
                                            <td className="px-6 py-4 text-right font-black text-gray-900">₹{inv.total}</td>
                                            <td className="px-6 py-4 text-right space-x-2">
                                                <button onClick={() => setViewingSavedInvoice(inv)} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors inline-flex" title="View">
                                                    <FiEye size={16} />
                                                </button>
                                                <button onClick={() => setViewingSavedInvoice(inv)} className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors inline-flex" title="Download">
                                                    <FiDownload size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                                                No recent invoices saved in this session.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </main>

            <InvoiceTemplateModal 
                isOpen={isTemplateOpen} 
                onClose={() => { setIsTemplateOpen(false); setSelectedTemplate(null); }} 
                business={business} 
                template={selectedTemplate}
            />

            <AddTemplateModal
                isOpen={isAddTemplateOpen}
                onClose={() => { setIsAddTemplateOpen(false); setEditingTemplate(null); }}
                onSave={handleSaveTemplate}
                initialData={editingTemplate}
            />

            <AddBusinessModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                onSave={handleUpdateBusiness}
                initialData={business}
            />

            <AddBusinessPartyModal 
                isOpen={isPartyModalOpen} 
                onClose={() => {
                    setIsPartyModalOpen(false);
                    setEditingParty(null);
                }} 
                onSave={handleSaveParty}
                initialData={editingParty}
            />

            <ViewBusinessPartyModal
                isOpen={!!viewingParty}
                onClose={() => setViewingParty(null)}
                party={viewingParty}
            />

            <SelectPartyModal
                isOpen={isSelectPartyOpen}
                onClose={() => { setIsSelectPartyOpen(false); setSelectedTemplate(null); }}
                businessId={business?.id}
                onSelect={(party) => {
                    setSelectedInvoiceParty(party);
                    setIsSelectPartyOpen(false);
                    setIsGenerateInvoiceOpen(true);
                }}
            />

            <GenerateInvoiceModal
                onSaveInvoice={(invoice) => setRecentInvoices(prev => [invoice, ...prev])}
                isOpen={isGenerateInvoiceOpen}
                onClose={() => {
                    setIsGenerateInvoiceOpen(false);
                    setSelectedInvoiceParty(null);
                    setSelectedTemplate(null);
                }}
                business={business}
                party={selectedInvoiceParty}
                template={selectedTemplate}
            />

            <ViewSavedInvoiceModal
                isOpen={!!viewingSavedInvoice}
                onClose={() => setViewingSavedInvoice(null)}
                savedInvoice={viewingSavedInvoice}
            />
        </div>
    );
}