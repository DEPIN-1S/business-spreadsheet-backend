import fs from 'fs';

// -------------------------------------------------------------
// 1. UPDATE AddPersonalTemplateModal.jsx
// -------------------------------------------------------------
const aptmPath = 'd:/work/Freelancing/Datasheet/spreadsheetfrontend/src/Components/AddPersonalTemplateModal.jsx';
let aptm = fs.readFileSync(aptmPath, 'utf8').replace(/\r\n/g, '\n');

// Add paymentProof state if not present
if (!aptm.includes('const [paymentProof, setPaymentProof]')) {
    aptm = aptm.replace(
        "const [paymentModes, setPaymentModes] = useState({ cash: false, upi: false, bank: false });",
        "const [paymentModes, setPaymentModes] = useState({ cash: false, upi: false, bank: false });\n    const [paymentProof, setPaymentProof] = useState(null);"
    );
}

// Add handlePaymentProofUpload handler if not present
if (!aptm.includes('handlePaymentProofUpload')) {
    const uploadHandler = `    const handlePaymentProofUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setPaymentProof(reader.result);
            };
            reader.readAsDataURL(file);
        }
        e.target.value = '';
    };

    const handleGstToggle`;
    aptm = aptm.replace("    const handleGstToggle", uploadHandler);
}

// Pass paymentProof in handleSubmit
if (!aptm.includes('paymentProof,')) {
    aptm = aptm.replace(
        "logo: logoPreview,\n            fromDetails,",
        "logo: logoPreview,\n            paymentProof,\n            fromDetails,"
    );
}

// Add Payment Proof Upload card after Payment Modes card
const oldPaymentModesBlock = `{/* Payment Modes */}
                        <div className="bg-gray-50 p-5 rounded-xl border border-gray-200">
                            <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Payment Modes</h3>
                            <div className="flex gap-6">
                                {['Cash', 'UPI', 'Bank Transfer'].map((mode) => (
                                    <label key={mode} className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={paymentModes[mode.toLowerCase().split(' ')[0]]}
                                            onChange={(e) => setPaymentModes(prev => ({...prev, [mode.toLowerCase().split(' ')[0]]: e.target.checked}))}
                                            className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                                        />
                                        {mode}
                                    </label>
                                ))}
                            </div>
                        </div>`;

const newPaymentModesWithProof = `{/* Payment Modes */}
                        <div className="bg-gray-50 p-5 rounded-xl border border-gray-200">
                            <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Payment Modes</h3>
                            <div className="flex gap-6">
                                {['Cash', 'UPI', 'Bank Transfer'].map((mode) => (
                                    <label key={mode} className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={paymentModes[mode.toLowerCase().split(' ')[0]]}
                                            onChange={(e) => setPaymentModes(prev => ({...prev, [mode.toLowerCase().split(' ')[0]]: e.target.checked}))}
                                            className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                                        />
                                        {mode}
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Payment Proof Upload */}
                        <div className="bg-gray-50 p-5 rounded-xl border border-gray-200">
                            <div className="flex items-center justify-between mb-4 border-b pb-2">
                                <div>
                                    <h3 className="text-lg font-bold text-gray-800">Payment Proof (Optional)</h3>
                                    <p className="text-xs text-gray-500 mt-0.5">Upload transaction screenshot or receipt to display in a new page in the invoice PDF.</p>
                                </div>
                                {paymentProof && (
                                    <button 
                                        type="button" 
                                        onClick={() => setPaymentProof(null)} 
                                        className="text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 px-2.5 py-1 rounded-lg transition-colors border border-red-200 cursor-pointer"
                                    >
                                        Remove Proof
                                    </button>
                                )}
                            </div>

                            {paymentProof ? (
                                <div className="flex items-center gap-4 bg-white p-3.5 rounded-xl border border-gray-200 shadow-2xs">
                                    <img src={paymentProof} alt="Payment Proof" className="w-20 h-20 object-contain rounded-lg border border-gray-200 bg-gray-50 shrink-0" />
                                    <div>
                                        <p className="text-xs font-bold text-gray-800">Payment Proof Attached</p>
                                        <p className="text-[11px] text-gray-500 mt-0.5">Will be printed on a dedicated second page in the invoice PDF.</p>
                                        <label className="mt-2 inline-flex items-center gap-1 cursor-pointer text-xs font-semibold text-indigo-600 hover:text-indigo-800">
                                            <FiUpload size={12} /> Change Image
                                            <input type="file" accept="image/*" className="hidden" onChange={handlePaymentProofUpload} />
                                        </label>
                                    </div>
                                </div>
                            ) : (
                                <label className="flex flex-col items-center justify-center p-6 bg-white border-2 border-dashed border-gray-300 hover:border-indigo-400 rounded-xl cursor-pointer hover:bg-indigo-50/20 transition-all text-center group">
                                    <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                                        <FiUpload size={18} />
                                    </div>
                                    <span className="text-xs font-bold text-gray-700">Click to upload Payment Proof</span>
                                    <span className="text-[11px] text-gray-400 mt-0.5">Supports PNG, JPG, JPEG, WEBP</span>
                                    <input type="file" accept="image/*" className="hidden" onChange={handlePaymentProofUpload} />
                                </label>
                            )}
                        </div>`;

if (aptm.includes(oldPaymentModesBlock)) {
    aptm = aptm.replace(oldPaymentModesBlock, newPaymentModesWithProof);
    console.log('Updated Payment Modes and Proof in AddPersonalTemplateModal.jsx');
} else {
    console.log('Could not find oldPaymentModesBlock in AddPersonalTemplateModal.jsx');
}

fs.writeFileSync(aptmPath, aptm.replace(/\n/g, '\r\n'), 'utf8');
console.log('Saved AddPersonalTemplateModal.jsx successfully!');

// -------------------------------------------------------------
// 2. UPDATE GeneratePersonalInvoiceModal.jsx
// -------------------------------------------------------------
const gpimPath = 'd:/work/Freelancing/Datasheet/spreadsheetfrontend/src/Components/GeneratePersonalInvoiceModal.jsx';
let gpim = fs.readFileSync(gpimPath, 'utf8').replace(/\r\n/g, '\n');

// 2a. Update imports
if (!gpim.includes('FiUpload')) {
    gpim = gpim.replace(
        "import { FiX, FiPlus, FiTrash2, FiPrinter, FiSave, FiEdit2 } from 'react-icons/fi';",
        "import { FiX, FiPlus, FiTrash2, FiPrinter, FiSave, FiEdit2, FiUpload, FiImage, FiFileText } from 'react-icons/fi';"
    );
}

// 2b. Add paymentProofImage state
if (!gpim.includes('paymentProofImage')) {
    gpim = gpim.replace(
        "const [signatureImage, setSignatureImage] = useState('');",
        "const [signatureImage, setSignatureImage] = useState('');\n    const [paymentProofImage, setPaymentProofImage] = useState('');"
    );
}

// 2c. Add handlePaymentProofUpload handler
if (!gpim.includes('handlePaymentProofUpload')) {
    const proofUploadFn = `    const handlePaymentProofUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (uploadEvent) => {
                setPaymentProofImage(uploadEvent.target.result);
            };
            reader.readAsDataURL(file);
        }
        e.target.value = '';
    };

    if (typeof template === 'string') {`;
    gpim = gpim.replace("    if (typeof template === 'string') {", proofUploadFn);
}

// 2d. Update useEffect to restore paymentProofImage
const targetEffectSaved = `            setPaymentMethod(parsedTemplate?.paymentMethod || '');
            setSealImage(parsedTemplate?.sealImage || '');
            setSignatureImage(parsedTemplate?.signatureImage || '');`;

const replacementEffectSaved = `            setPaymentMethod(parsedTemplate?.paymentMethod || '');
            setSealImage(parsedTemplate?.sealImage || '');
            setSignatureImage(parsedTemplate?.signatureImage || '');
            setPaymentProofImage(parsedTemplate?.paymentProofImage || parsedTemplate?.paymentProof || savedInvoice?.paymentProofImage || savedInvoice?.paymentProof || '');`;

if (gpim.includes(targetEffectSaved)) {
    gpim = gpim.replace(targetEffectSaved, replacementEffectSaved);
}

const targetEffectNew = `        } else if (template) {`;
const replacementEffectNew = `            setPaymentProofImage(template?.paymentProofImage || template?.paymentProof || '');
        } else if (template) {`;

if (gpim.includes(targetEffectNew)) {
    gpim = gpim.replace(targetEffectNew, replacementEffectNew);
}

// 2e. Update handleSave to preserve paymentProofImage
const targetSaveCleanup = `            delete templateClone.signatureImage;
            delete templateClone.seal;
            delete templateClone.sealImage;`;

const replacementSaveCleanup = `            delete templateClone.signatureImage;
            delete templateClone.seal;
            delete templateClone.sealImage;
            delete templateClone.paymentProof;
            delete templateClone.paymentProofImage;`;

if (gpim.includes(targetSaveCleanup)) {
    gpim = gpim.replace(targetSaveCleanup, replacementSaveCleanup);
}

const targetSaveAssign = `            if (sealImage) invoiceData.template.sealImage = sealImage;
            if (signatureImage) invoiceData.template.signatureImage = signatureImage;`;

const replacementSaveAssign = `            if (sealImage) invoiceData.template.sealImage = sealImage;
            if (signatureImage) invoiceData.template.signatureImage = signatureImage;
            if (paymentProofImage) {
                invoiceData.template.paymentProofImage = paymentProofImage;
                invoiceData.paymentProofImage = paymentProofImage;
            }`;

if (gpim.includes(targetSaveAssign)) {
    gpim = gpim.replace(targetSaveAssign, replacementSaveAssign);
}

// 2f. Update print CSS for clean multi-page support
const oldPrintAreaCss = `                    #personal-invoice-print-area {
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 100% !important;
                        max-width: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        box-shadow: none !important;
                        border: 2px solid #000 !important;
                        box-sizing: border-box !important;
                        background: #fff !important;
                    }`;

const newPrintAreaCss = `                    #personal-invoice-print-area {
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 100% !important;
                        max-width: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        box-shadow: none !important;
                        border: none !important;
                        box-sizing: border-box !important;
                        background: #fff !important;
                    }
                    
                    .invoice-page-break {
                        page-break-before: always !important;
                        break-before: page !important;
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                    }`;

if (gpim.includes(oldPrintAreaCss)) {
    gpim = gpim.replace(oldPrintAreaCss, newPrintAreaCss);
    console.log('Updated print CSS in GeneratePersonalInvoiceModal.jsx');
}

// 2g. Update print area container to hold Page 1 and Page 2
const oldPrintContainerStart = `<div className="overflow-y-auto p-6 flex-1 bg-gray-100">
                    <div id="personal-invoice-print-area" className="bg-white mx-auto border-2 border-black text-black font-sans text-xs shadow-lg max-w-[900px] w-full">`;

const newPrintContainerStart = `<div className="overflow-y-auto p-6 flex-1 bg-gray-100">
                    <div id="personal-invoice-print-area" className="max-w-[900px] w-full mx-auto space-y-8 print:space-y-0">
                        
                        {/* PAGE 1: INVOICE */}
                        <div className="bg-white border-2 border-black text-black font-sans text-xs shadow-lg w-full print:shadow-none print:border-2 print:border-black">`;

if (gpim.includes(oldPrintContainerStart)) {
    gpim = gpim.replace(oldPrintContainerStart, newPrintContainerStart);
    console.log('Updated print container start in GeneratePersonalInvoiceModal.jsx');
}

// 2h. Close Page 1 and append Page 2 (Payment Proof) and upload banner before the overflow container closes
const oldPrintContainerEnd = `                                            <div className="font-bold text-gray-800">Authorized Signatory</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>`;

const newPrintContainerEnd = `                                            <div className="font-bold text-gray-800">Authorized Signatory</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* PAGE 2: PAYMENT PROOF (If attached) */}
                    {paymentProofImage && (
                        <div className="invoice-page-break bg-white border-2 border-black text-black font-sans text-xs shadow-lg w-full p-8 print:p-8 print:shadow-none print:border-2 print:border-black flex flex-col justify-between min-h-[920px] print:min-h-[1050px]">
                            
                            {/* Page 2 Header */}
                            <div>
                                <div className="border-b-2 border-black pb-4 flex items-start justify-between">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            {template.logo && <img src={template.logo} alt="Logo" className="h-10 object-contain" />}
                                            <span className="font-extrabold text-base tracking-tight">
                                                {template.fromDetails?.[0]?.value || template.fromDetails?.[0]?.key || 'INVOICE'}
                                            </span>
                                        </div>
                                        <h2 className="text-xl font-black uppercase tracking-wider text-gray-900 mt-2">
                                            Payment Proof / Transaction Receipt
                                        </h2>
                                        <p className="text-xs text-gray-500 mt-0.5">
                                            Official document attachment for Invoice Ref #{invoiceNo || 'INV-PI-001'}
                                        </p>
                                    </div>
                                    <div className="text-right space-y-1 text-xs">
                                        <div className="bg-black text-white px-3 py-1 font-bold text-xs uppercase tracking-wider rounded-xs inline-block">
                                            Page 2 of 2
                                        </div>
                                        <div className="text-gray-600 mt-2"><b>Date:</b> {invoiceDate || '—'}</div>
                                        <div className="text-gray-600"><b>Payment Mode:</b> {paymentMethod || 'Paid'}</div>
                                        <div className="text-gray-900 font-bold text-sm mt-1">
                                            <b>Total Amount:</b> ₹{finalGrandTotal.toFixed(2)}
                                        </div>
                                    </div>
                                </div>

                                {/* Summary Bar */}
                                <div className="grid grid-cols-2 bg-gray-50 border-b border-black p-3 text-xs">
                                    <div>
                                        <span className="text-gray-500 uppercase font-bold text-[10px] block">Billed To (Client):</span>
                                        <span className="font-bold text-gray-900 text-sm">
                                            {template?.toDetails?.[0]?.key ? toDetailsData[template.toDetails[0].key] || template.toDetails[0].value : (template?.toDetails?.[0]?.value || 'Client')}
                                        </span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-gray-500 uppercase font-bold text-[10px] block">Invoice No:</span>
                                        <span className="font-mono font-bold text-gray-900 text-sm">{invoiceNo || '—'}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Payment Proof Image Container */}
                            <div className="my-6 flex-1 flex flex-col items-center justify-center p-4 bg-gray-50/50 border border-dashed border-gray-300 rounded-lg print:border-none print:bg-transparent">
                                <div className="relative group max-w-full">
                                    <img 
                                        src={paymentProofImage} 
                                        alt="Payment Proof" 
                                        className="max-h-[650px] max-w-full object-contain mx-auto rounded shadow-sm border border-gray-200 print:border print:border-black print:shadow-none"
                                    />
                                    {!isViewMode && (
                                        <div className="no-print absolute top-2 right-2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 backdrop-blur-xs p-1.5 rounded-lg shadow-md border border-gray-200">
                                            <label className="cursor-pointer text-xs font-semibold text-indigo-600 hover:text-indigo-800 px-2 py-1 hover:bg-indigo-50 rounded transition-colors flex items-center gap-1">
                                                <FiUpload size={12} /> Change
                                                <input type="file" accept="image/*" className="hidden" onChange={handlePaymentProofUpload} />
                                            </label>
                                            <button 
                                                type="button" 
                                                onClick={() => setPaymentProofImage('')} 
                                                className="text-xs font-semibold text-red-600 hover:text-red-800 px-2 py-1 hover:bg-red-50 rounded transition-colors flex items-center gap-1"
                                            >
                                                <FiTrash2 size={12} /> Remove
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Page 2 Footer */}
                            <div className="border-t-2 border-black pt-3 flex justify-between items-center text-[11px] text-gray-600">
                                <div>
                                    Attached to Invoice <span className="font-mono font-bold text-black">{invoiceNo}</span> • Verified payment documentation
                                </div>
                                <div className="font-bold text-black">
                                    Page 2 of 2
                                </div>
                            </div>

                        </div>
                    )}

                    {/* Upload Banner in preview if no proof attached yet */}
                    {!paymentProofImage && !isViewMode && (
                        <div className="no-print bg-white border-2 border-dashed border-gray-300 hover:border-indigo-400 rounded-xl p-6 transition-all text-center max-w-[900px] w-full mx-auto shadow-xs group">
                            <label className="cursor-pointer flex flex-col items-center justify-center gap-2">
                                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-105 transition-transform shadow-2xs border border-indigo-100">
                                    <FiUpload size={22} />
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-gray-800">Add Payment Proof</h4>
                                    <p className="text-xs text-gray-500 mt-0.5">Upload payment receipt or transaction screenshot to print as a new page in the PDF</p>
                                </div>
                                <span className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-lg transition-colors border border-indigo-200">
                                    <FiPlus size={14} /> Select Payment Proof Image
                                </span>
                                <input type="file" accept="image/*" className="hidden" onChange={handlePaymentProofUpload} />
                            </label>
                        </div>
                    )}

                    </div>
                </div>`;

if (gpim.includes(oldPrintContainerEnd)) {
    gpim = gpim.replace(oldPrintContainerEnd, newPrintContainerEnd);
    console.log('Updated print container end with Page 2 in GeneratePersonalInvoiceModal.jsx');
} else {
    console.log('Could not find oldPrintContainerEnd in GeneratePersonalInvoiceModal.jsx');
}

fs.writeFileSync(gpimPath, gpim.replace(/\n/g, '\r\n'), 'utf8');
console.log('Saved GeneratePersonalInvoiceModal.jsx successfully!');
