import React, { useState, useEffect, useRef } from 'react';
import { FiX, FiPrinter, FiSettings, FiTrash2, FiPlus } from 'react-icons/fi';
import apiClient from '../api/apiClient';

export default function GenerateInvoiceModal({ isOpen, onClose, business, party, template }) {
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const settingsRef = useRef(null);
    const [inventoryData, setInventoryData] = useState([]);
    const [selectedSeals, setSelectedSeals] = useState([]);
    const [isSealDropdownOpen, setIsSealDropdownOpen] = useState(false);
    const [activeDropdownRow, setActiveDropdownRow] = useState(null);
    const [previewProduct, setPreviewProduct] = useState(null);

    const sheetsToFetchCacheRef = useRef([]);
    const searchTimeoutRef = useRef(null);

    const [recentInvoices, setRecentInvoices] = useState([]);
    const [isSaving, setIsSaving] = useState(false);


    useEffect(() => {
        const fetchSheetsList = async () => {
            try {
                let targetSheetIds = [];
                if (Array.isArray(template?.spreadsheetIds) && template.spreadsheetIds.length > 0) {
                    targetSheetIds = template.spreadsheetIds;
                } else if (typeof template?.spreadsheetIds === 'string') {
                    try {
                        const parsed = JSON.parse(template.spreadsheetIds);
                        if (Array.isArray(parsed) && parsed.length > 0) targetSheetIds = parsed;
                    } catch (e) {
                        if (template.spreadsheetIds.includes(',')) {
                            targetSheetIds = template.spreadsheetIds.split(',').map(s => s.trim()).filter(Boolean);
                        } else if (template.spreadsheetIds.trim() && !template.spreadsheetIds.startsWith('[')) {
                            targetSheetIds = [template.spreadsheetIds.trim()];
                        }
                    }
                }
                if (targetSheetIds.length === 0 && template?.spreadsheetId) {
                    targetSheetIds = [template.spreadsheetId];
                }

                let sheetsList = [];
                if (targetSheetIds.length === 0) {
                    const sheetsRes = await apiClient.get('/sheets?forInvoiceGenerator=true');
                    const sheetsData = sheetsRes.data?.data;
                    sheetsList = Array.isArray(sheetsData) ? sheetsData : (sheetsData?.files || []);
                } else {
                    sheetsList = targetSheetIds.map(id => ({ id }));
                }
                sheetsToFetchCacheRef.current = sheetsList;
            } catch (err) {
                console.error("Failed to fetch sheets list:", err);
            }
        };

        if (isOpen) {
            fetchSheetsList();
            setInventoryData([]);
        }
    }, [isOpen, template]);

    let cols = [];
    let colTypes = {};
    let grandTotalColumn = null;
    if (template?.columns) {
        let rawCols = [];
        if (typeof template.columns === "string") {
            try {
                let parsed = JSON.parse(template.columns);
                if (typeof parsed === "string") parsed = JSON.parse(parsed);
                if (Array.isArray(parsed)) rawCols = parsed;
            } catch(e) {
                if (template.columns.includes(",")) rawCols = template.columns.split(",").map(s => s.trim()).filter(Boolean);
                else if (template.columns.trim() && !template.columns.startsWith("[")) rawCols = [template.columns.trim()];
            }
        } else if (Array.isArray(template.columns)) {
            rawCols = template.columns;
        }
        rawCols.forEach(c => {
            if (typeof c === "object" && c !== null) {
                if (c.name) {
                    cols.push(c.name);
                    if (c.type) colTypes[c.name] = c.type;
                    if (c.isGrandTotal) grandTotalColumn = c.name;
                }
            } else if (typeof c === "string") {
                cols.push(c);
            }
        });
    }
    if (!Array.isArray(cols)) cols = [];
    const defaultCols = ["Product Name", "Qty", "Selling Rate", "Discount", "MRP", "GST", "Total"];
    const defaultColsUpper = defaultCols.map(c => c.toUpperCase());
        
    if (template && template.isProductBased === false) {
        cols = cols.filter(c => !defaultColsUpper.includes(c.toUpperCase()));
    } else {
        // Ensure default columns are present for product-based templates
        const extraCols = cols.filter(c => !defaultColsUpper.includes(c.toUpperCase()));
        cols = [...defaultCols, ...extraCols];
    }

    const today = new Date().toLocaleDateString('en-GB', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    const formattedInvTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    const todayIso = new Date().toISOString().split('T')[0];
    const [invoiceDate, setInvoiceDate] = useState(todayIso);
    const formatDateDMY = (iso) => { if (!iso) return ''; const [y, m, d] = iso.split('-'); return d + '/' + m + '/' + y; };
    const isWholesale = template?.isProductBased; 

    // visible columns state for the settings dropdown
    const initialCols = {
        slNo: true,
    };
    cols.forEach(c => initialCols[c] = true);
    
        const getCalculatingColumn = () => {
        if (template && template.isProductBased === false && grandTotalColumn) return grandTotalColumn;
        if (template?.isProductBased !== false && cols.includes("Total")) return "Total";
        return null;
    };
    const calcCol = getCalculatingColumn();

    const [visibleColumns, setVisibleColumns] = useState(initialCols);

    useEffect(() => {
        // Reset columns if business changes
        const newCols = { slNo: true };
        cols.forEach(c => newCols[c] = true);
        setVisibleColumns(newCols);
    }, [template]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (settingsRef.current && !settingsRef.current.contains(event.target)) {
                setIsSettingsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);

    return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleColumn = (key) => {
        setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const [items, setItems] = useState(() => [{ id: Date.now(), description: '', ...cols.reduce((acc, col) => ({ ...acc, [col]: '' }), {}) }]);
    const [totals, setTotals] = useState({ 
        totalNo: '', saleValue: '', schDiscGiven: '', cashDisc: '', 
        totalGst: '', grossAmt: '', disAmt: '', addlChg: '', rOff: '', grandTotal: '' 
    });

    if (!isOpen || !business) return null;

    const handlePrint = () => {
        window.print();
    };

    const handleItemChange = (id, field, value) => {
        let updatedItem = { [field]: value };
        
        if (field === 'Product Name') {
            const trimmed = value ? value.toString().trim() : '';
            const currentItem = items.find(item => item.id === id);
            if (trimmed) {
                if (!currentItem?.['Qty'] || currentItem['Qty'] === '') {
                    updatedItem['Qty'] = '1';
                }
            } else {
                updatedItem['Qty'] = '';
                updatedItem['Total'] = '';
            }
            
            if (inventoryData.length > 0) {
                const searchValue = value ? value.toString().toLowerCase() : '';
                const matchedProduct = inventoryData.find(p => p['Product Name'] && p['Product Name'].toString().toLowerCase() === searchValue);
                if (matchedProduct) {
                    if (matchedProduct['MRP']) updatedItem['MRP'] = matchedProduct['MRP'];
                    if (matchedProduct['Discount']) updatedItem['Discount'] = matchedProduct['Discount'];
                    if (matchedProduct['Selling Rate']) updatedItem['Selling Rate'] = matchedProduct['Selling Rate'];
                    if (matchedProduct['GST']) updatedItem['GST'] = matchedProduct['GST'];
                }
            }
        }
        
        const currentItem = items.find(item => item.id === id);
        const mergedItem = { ...currentItem, ...updatedItem };

        if (field !== 'Total' && cols.includes('Total')) {
            const qty = parseFloat(mergedItem['Qty']) || 0;
            const rate = parseFloat(mergedItem['Selling Rate']) || parseFloat(mergedItem['MRP']) || 0;
            if (qty > 0 && rate > 0) {
                updatedItem['Total'] = (qty * rate).toFixed(2);
            } else {
                updatedItem['Total'] = '';
            }
        }
        setItems(items.map(item => item.id === id ? { ...item, ...updatedItem } : item));

        if (field === 'Product Name' && value.length >= 1) {
            if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
            searchTimeoutRef.current = setTimeout(async () => {
                try {
                    const currentSheets = sheetsToFetchCacheRef.current; if (currentSheets.length === 0) { return; }
                    
                    const fetchPromises = currentSheets.map(sheet => apiClient.get('/sheets/' + sheet.id + '/data?search=' + encodeURIComponent(value)));
                    const responses = await Promise.all(fetchPromises);
                    
                    let allParsedData = [];
                    responses.forEach(res => {
                        const { grid = [] } = res.data.data;
                        const parsedData = grid.map(row => {
                            const rowData = {};
                            (row.cells || []).forEach(cell => {
                                let colName = (cell.columnName || '').trim();
                                const upperColName = colName.toUpperCase();

                                if (upperColName === 'GST%' || upperColName === 'GST') colName = 'GST';
                                else if (upperColName === 'PRODUCT NAME') colName = 'Product Name';
                                else if (upperColName === 'MRP') colName = 'MRP';
                                else if (upperColName === 'DISCOUNT') colName = 'Discount';
                                else if (upperColName === 'SELLING RATE') colName = 'Selling Rate';
                                else if (upperColName === 'IMAGE' || upperColName === 'PRODUCT IMAGE') colName = 'Image';
                                else if (upperColName === 'COMPOSITION') colName = 'Composition';

                                rowData[colName] = cell.computedValue || cell.rawValue || '';
                            });
                            return rowData;
                        });
                        allParsedData = [...allParsedData, ...parsedData];
                    });
                    
                    allParsedData = allParsedData.filter(d => d['Product Name']);
                    setInventoryData(allParsedData);
                } catch (err) {
                    console.error('Failed to fetch inventory search results:', err);
                }
            }, 300);
        }
    };

    const handleQtyBlur = (id, value) => {
        setItems(prev => prev.map(item => {
            if (item.id !== id) return item;
            const hasProduct = item['Product Name'] && item['Product Name'].trim() !== '';
            if (hasProduct && (value === '' || value === null || value === undefined || (typeof value === 'string' && value.trim() === ''))) {
                const rate = parseFloat(item['Selling Rate']) || parseFloat(item['MRP']) || 0;
                const total = rate > 0 && cols.includes('Total') ? (1 * rate).toFixed(2) : (item['Total'] || '');
                return { ...item, Qty: '1', Total: total };
            }
            return item;
        }));
    };

    const addRow = () => {
        setItems([...items, { id: Date.now(), description: '', ...cols.reduce((acc, col) => ({ ...acc, [col]: '' }), {}) }]);
    };

    const removeRow = (id) => {
        if (items.length > 1) {
            setItems(prev => prev.filter(item => item.id !== id));
        } else {
            setItems(prev => [{ ...prev[0], "Product Name": "", Qty: "", MRP: "", Discount: "", "Selling Rate": "", GST: "", Total: "", description: "" }]);
        }
    };

    const handleTotalChange = (field, value) => {
        setTotals(prev => {
            const next = { ...prev, [field]: value };
            if (field !== 'grandTotal') {
                delete next.manualGrandTotal;
            } else {
                next.manualGrandTotal = value;
            }
            return next;
        });
    };

        const totalNoCalc = items.reduce((sum, item) => sum + (parseFloat(item.Qty) || 0), 0);
    const totalItemsCount = items.filter(it => it['Product Name'] && it['Product Name'].trim()).length || items.length;
        const totalGrossCalc = items.reduce((sum, item) => {
        if (template && template.isProductBased === false && grandTotalColumn) {
            const val = parseFloat(item[grandTotalColumn]);
            if (!isNaN(val)) return sum + val;
            return sum;
        }
        const totalVal = parseFloat(item.Total);
        if (!isNaN(totalVal)) return sum + totalVal;
        const qty = parseFloat(item.Qty) || 0;
        const rate = parseFloat(item['Selling Rate']) || parseFloat(item['MRP']) || 0;
        return sum + (qty * rate);
    }, 0);
    const totalGstCalc = items.reduce((sum, item) => {
        const gstPercent = parseFloat(item.GST) || 0;
        const lineTotal = parseFloat(item.Total) || ((parseFloat(item.Qty) || 0) * (parseFloat(item['Selling Rate']) || parseFloat(item['MRP']) || 0));
        return sum + (lineTotal * gstPercent / 100);
    }, 0);
    const gstVal = parseFloat(totals.totalGst !== '' ? totals.totalGst : (totalGstCalc > 0 ? totalGstCalc : 0)) || 0;
    const grossVal = parseFloat(totals.grossAmt !== '' ? totals.grossAmt : (totalGrossCalc - gstVal)) || 0;
    const disVal = parseFloat(totals.disAmt) || 0;
    const addlVal = parseFloat(totals.addlChg) || 0;
    const roffVal = parseFloat(totals.rOff) || 0;
    const computedGrandTotal = (grossVal - disVal + addlVal + gstVal + roffVal).toFixed(2);

    const handleSaveInvoice = async () => {
        setIsSaving(true);
        setTimeout(() => {
            const newInvoice = {
                id: Date.now(),
                invoiceNo: 'INV-2026-001',
                date: invoiceDate,
                partyName: party?.name || 'CASH CUSTOMER',
                total: computedGrandTotal,
            };
            setRecentInvoices(prev => [newInvoice, ...prev]);
            setIsSaving(false);
        }, 500);
    };


    return ( <React.Fragment>
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
            <style>{`
                @media print {
                    body * {
                        visibility: hidden !important;
                    }
                    #business-invoice-print-area, #business-invoice-print-area * {
                        visibility: visible !important;
                    }
                    #business-invoice-print-area {
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        box-shadow: none !important;
                        border: none !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                }
            `}</style>

            <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full overflow-hidden flex flex-col max-h-[95vh]">
                
                {/* Modal Action Bar (Hidden in Print) */}
                <div className="px-6 py-4 bg-gray-900 text-white flex items-center justify-between no-print border-b border-gray-800">
                    <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 bg-indigo-600 text-xs font-bold rounded uppercase tracking-wider">Tax Invoice </span>
                        <h3 className="text-base font-semibold">{template?.name || business.name} Format</h3>
                    </div>
                    <div className="flex items-center gap-3">

                                                <div className="flex items-center gap-3 mr-4">
                        <button
                            onClick={handleSaveInvoice}
                            disabled={isSaving}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white text-xs font-semibold rounded-lg shadow transition-colors"
                        >
                            {isSaving ? 'Saving...' : 'Save Invoice'}
                        </button>
                    </div>
                                                <div className="relative" ref={settingsRef}>
                            <button
                                onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                                className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg transition-colors border ${isSettingsOpen ? 'bg-gray-800 text-white border-gray-700' : 'bg-transparent text-gray-300 border-gray-700 hover:bg-gray-800 hover:text-white'}`}
                                title="Customize Columns"
                            >
                                <FiSettings size={15} />
                                Columns
                            </button>
                            {isSettingsOpen && (
                                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-200 p-3 z-50 animate-fade-in text-gray-900">
                                    <h4 className="text-xs font-bold uppercase text-gray-500 mb-2 border-b pb-1">Visible Columns</h4>
                                    <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                                        <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-1 rounded">
                                            <input type="checkbox" checked={visibleColumns.slNo || false} onChange={() => toggleColumn('slNo')} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                                            <span className="font-medium text-gray-700">Sl No.</span>
                                        </label>
                                        {cols.filter(col => col !== calcCol).map(col => (
                                            <label key={col} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-1 rounded">
                                                <input type="checkbox" checked={visibleColumns[col] || false} onChange={() => toggleColumn(col)} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                                                <span className="font-medium text-gray-700">{col}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-white rounded-lg transition-colors" title="Close"
                        >
                            <FiX size={20} />
                        </button>
                    </div>
                </div>

                {/* Printable Invoice Sheet */}
                <div className="overflow-y-auto p-6 flex-1 bg-gray-100">
                    <div id="business-invoice-print-area" className="bg-white mx-auto border-2 border-black text-black font-sans text-xs shadow-lg max-w-[900px]">
                        
                        {/* 1. Header Grid */}
                        <div className="grid grid-cols-12 border-b-2 border-black">
                            
                            {/* Left Box: Seller */}
                            <div className="col-span-5 border-r-2 border-black p-2.5 space-y-1.5">
                                        <div className="flex items-center gap-2 mb-2">
                                            {business.logo && <img src={business.logo} alt="Logo" className="h-12 object-contain" />}
                                            <span className="font-extrabold text-lg">{business.name}</span>
                                            {template?.isB2B && (
                                                <span className="border border-black px-1.5 py-0.5 text-[15px] font-bold tracking-wide ">B 2 B</span>
                                            )}
                                        </div>
                                <div className="space-y-1 mt-1">
                                    {(() => {
                                        if (!business.additionalData) return null;
                                        let dataArray = business.additionalData;
                                        if (typeof dataArray === 'string') {
                                            try { dataArray = JSON.parse(dataArray); } catch(e) { return null; }
                                        }
                                        if (!Array.isArray(dataArray)) return null;

                                        return dataArray.map((item, idx) => {
                                            const value = typeof item === 'object' && item !== null ? (item.value || item.key || "") : item;
                                            if (!value) return null;
                                            return (
                                                <div key={idx} className="text-[11px] leading-tight">
                                                    {value}
                                                </div>
                                            );
                                        });
                                    })()}
                                    {(!business.additionalData || business.additionalData.length === 0) && (
                                        <React.Fragment>
                                            <div className="text-[11px] leading-tight text-gray-900 pt-0.5">SH1, Kilimanoor, Thiruvananthapuram, Kerala - 695601</div>
                                            <div className="text-[11px] pt-1"><b>Email ID :</b> rxpharma27@gmail.com</div>
                                            <div className="text-[11px]"><b>GST No :</b> 32ACAFM5688A1ZH</div>
                                            <div className="text-[11px] leading-tight pt-0.5">
                                                <b>DL No :</b> RLF20KL2026002461 , RLF21KL2026002472
                                            </div>
                                        </React.Fragment>
                                    )}
                                </div>
                            </div>

                            {/* Middle Box: Invoice Info */}
                            <div className="col-span-3 border-r-2 border-black p-2.5 flex flex-col justify-between">
                                <div>
                                    <div className="text-center font-black text-sm underline uppercase tracking-wide">TAX INVOICE </div>
                                    <div className="space-y-1 text-[11px] mt-2">
                                        <div><b>Tax Inv. No. :</b> INV-2026-001</div>
                                        <div className="flex items-center gap-1"><b>Inv. Date :</b> <span className="relative">{formatDateDMY(invoiceDate)}<input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} onFocus={(e) => e.target.showPicker && e.target.showPicker()} className="absolute left-0 top-0 w-full h-full opacity-0 cursor-pointer" /></span></div>
                                        <div><b>Inv. Time :</b> {formattedInvTime}</div>
                                    </div>
                                </div>
            {previewProduct && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setPreviewProduct(null)}>
                    <div className="relative bg-white p-4 rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col items-center justify-center animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setPreviewProduct(null)} className="absolute -top-4 -right-4 bg-red-500 text-white rounded-full p-2 hover:bg-red-600 shadow-lg transition-transform hover:scale-110">
                            <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" height="24" width="24" xmlns="http://www.w3.org/2000/svg"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                        <img src={previewProduct._resolvedImgSrc} alt="Preview" className="max-w-full max-h-[45vh] object-contain rounded-lg shadow-inner bg-gray-50" />
                        <div className="mt-4 text-center w-full">
                            <h3 className="text-xl font-bold text-gray-800">{previewProduct['Product Name']}</h3>
                            {previewProduct['Composition'] && <p className="text-sm text-gray-500 mt-1">{previewProduct['Composition']}</p>}
                        </div>
                    </div>
                </div>
            )}
            {/* Seals Selection Modal */}
            {isSealDropdownOpen && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setIsSealDropdownOpen(false)}>
                    <div className="relative bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[85vh] flex flex-col animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
                        <div className="bg-gray-50 border-b border-gray-200 p-4 rounded-t-xl flex justify-between items-center">
                            <div>
                                <h3 className="font-bold text-gray-800 text-lg">Select Seals</h3>
                                <p className="text-xs text-gray-500 mt-1">Choose which seals to stamp on this invoice.</p>
                            </div>
                            <button onClick={() => setIsSealDropdownOpen(false)} className="text-gray-400 hover:text-red-600 transition-colors bg-white border rounded-full p-1.5 shadow-sm hover:bg-red-50"><FiX size={18} /></button>
                        </div>
                        <div className="p-4 overflow-y-auto flex flex-col gap-3">
                            {(() => {
                                let sealsArray = business?.seals;
                                if (typeof sealsArray === 'string') {
                                    try { sealsArray = JSON.parse(sealsArray); } catch(e) { sealsArray = []; }
                                }
                                if (!Array.isArray(sealsArray) || sealsArray.length === 0) return <div className="text-center text-gray-500 py-8">No seals available.</div>;
                                
                                return sealsArray.map((seal, idx) => {
                                    const isSelected = selectedSeals.includes(seal);
                                    return (
                                        <div 
                                            key={idx} 
                                            onClick={() => {
                                                if (isSelected) {
                                                    setSelectedSeals(prev => prev.filter(s => s !== seal));
                                                } else {
                                                    setSelectedSeals(prev => [...prev, seal]);
                                                }
                                            }}
                                            className={`flex items-center gap-4 p-3 rounded-lg cursor-pointer border-2 transition-all ${isSelected ? 'border-indigo-500 bg-indigo-50/50 shadow-sm' : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'}`}
                                        >
                                            <input 
                                                type="checkbox" 
                                                checked={isSelected}
                                                readOnly
                                                className="w-5 h-5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 cursor-pointer pointer-events-none"
                                            />
                                            <div className="flex-shrink-0 w-20 h-20 bg-white rounded-md shadow-sm border border-gray-100 flex items-center justify-center p-1">
                                                <img src={seal} alt={`Seal ${idx + 1}`} className="max-w-full max-h-full object-contain mix-blend-multiply" />
                                            </div>
                                            <div className="flex-1">
                                                <span className={`text-base font-semibold ${isSelected ? 'text-indigo-900' : 'text-gray-700'}`}>Seal {idx + 1}</span>
                                            </div>
                                        </div>
                                    );
                                });
                            })()}
                        </div>
                        <div className="border-t border-gray-200 p-4 bg-gray-50 rounded-b-xl flex justify-end">
                            <button onClick={() => setIsSealDropdownOpen(false)} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow transition-colors">Done</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    </React.Fragment>
    );
}








