const fs = require('fs');
let content = fs.readFileSync('c:\\Users\\jithin pm\\work\\Freelancing\\business-spreadsheet-backend\\temp_BusinessDetails.jsx', 'utf8');

// 1. Update imports
const importTarget = "import { FiArrowLeft, FiFileText, FiPlus, FiEdit2, FiTrash2, FiEye, FiSearch, FiEdit3, FiFilePlus, FiLink } from 'react-icons/fi';";
const importAdd = "import { FiArrowLeft, FiFileText, FiPlus, FiEdit2, FiTrash2, FiEye, FiSearch, FiEdit3, FiFilePlus, FiLink, FiDownload } from 'react-icons/fi';";
content = content.replace(importTarget, importAdd);

// 2. Update Recent Invoices section
const tableTarget = `                                    <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase tracking-wider text-gray-500 font-semibold">
                                        <th className="px-6 py-3">Invoice No</th>
                                        <th className="px-6 py-3">Date</th>
                                        <th className="px-6 py-3">Party Name</th>
                                        <th className="px-6 py-3 text-right">Total Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 text-sm">
                                    {recentInvoices.length > 0 ? recentInvoices.map((inv) => (
                                        <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 font-medium text-indigo-600">{inv.invoiceNo}</td>
                                            <td className="px-6 py-4 text-gray-600">{inv.date}</td>
                                            <td className="px-6 py-4 text-gray-900 font-semibold">{inv.partyName}</td>
                                            <td className="px-6 py-4 text-right font-black text-gray-900">₹{inv.total}</td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan="4" className="px-6 py-8 text-center text-gray-500">`;

const tableAdd = `                                    <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase tracking-wider text-gray-500 font-semibold">
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
                                                <button className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors inline-flex" title="View">
                                                    <FiEye size={16} />
                                                </button>
                                                <button className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors inline-flex" title="Download">
                                                    <FiDownload size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan="5" className="px-6 py-8 text-center text-gray-500">`;
content = content.replace(tableTarget, tableAdd);

fs.writeFileSync('c:\\Users\\jithin pm\\work\\Freelancing\\business-spreadsheet-backend\\temp_BusinessDetails.jsx', content);
console.log(content.includes('FiDownload') ? 'Success' : 'Failed');
