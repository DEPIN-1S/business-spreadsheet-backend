const fs = require('fs');
let content = fs.readFileSync('c:\\Users\\jithin pm\\work\\Freelancing\\business-spreadsheet-backend\\temp_BusinessDetails.jsx', 'utf8');

const regex = /\{recentInvoices\.length > 0 && \([\s\S]*?\}\)[\r]?\n/;
const replace = `                    {/* Recent Invoices Section */}
                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm mt-6">
                        <h2 className="text-lg font-bold text-gray-900 mb-6">Recent Saved Invoices</h2>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse min-w-[600px]">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase tracking-wider text-gray-500 font-semibold">
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
                                            <td colSpan="4" className="px-6 py-8 text-center text-gray-500">
                                                No recent invoices saved in this session.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>\n`;

content = content.replace(regex, replace);
fs.writeFileSync('c:\\Users\\jithin pm\\work\\Freelancing\\business-spreadsheet-backend\\temp_BusinessDetails.jsx', content);
