const fs = require('fs');

const files = [
    '../spreadsheetfrontend/src/Components/GenerateInvoiceModal.jsx',
    '../spreadsheetfrontend/src/Components/ViewSavedInvoiceModal.jsx'
];

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');

    // First revert my previous fix if it's there
    content = content.replace(`height: 100vh !important;
                            margin: 0 !important;
                            padding: 0 !important;
                            background: #fff !important;
                            overflow: hidden !important;`, 
                            `height: auto !important;
                            min-height: 0 !important;
                            margin: 0 !important;
                            padding: 0 !important;
                            background: #fff !important;
                            overflow: visible !important;`);
                            
    // Inject the #root min-height trick to collapse background space
    const target = `#business-invoice-print-area, #business-invoice-print-area * {
                            visibility: visible !important;
                        }`;
                        
    const repl = `#business-invoice-print-area, #business-invoice-print-area * {
                            visibility: visible !important;
                        }
                        /* Collapse all original layout heights to prevent extra blank pages */
                        #root, #root * {
                            min-height: 0 !important;
                            height: auto !important;
                        }`;
                        
    if (content.includes(target) && !content.includes("Collapse all original layout heights")) {
        content = content.replace(target, repl);
        fs.writeFileSync(file, content);
        console.log("Applied flex-height collapse fix to", file);
    }
});
