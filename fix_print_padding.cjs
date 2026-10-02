const fs = require('fs');

const files = [
    '../spreadsheetfrontend/src/Components/GenerateInvoiceModal.jsx',
    '../spreadsheetfrontend/src/Components/ViewSavedInvoiceModal.jsx'
];

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');

    const target = `/* Collapse all original layout heights to prevent extra blank pages */
                        #root, #root * {
                            min-height: 0 !important;
                            height: auto !important;
                        }`;
                        
    const repl = `/* Collapse all original layout heights to prevent extra blank pages */
                        #root, #root * {
                            min-height: 0 !important;
                            height: auto !important;
                        }
                        body > :not(#root) {
                            display: none !important;
                        }
                        /* Remove all margins and padding from invisible structural elements */
                        body *, #root * {
                            margin: 0 !important;
                            padding: 0 !important;
                        }
                        /* Restore margins and padding for the invoice itself */
                        #business-invoice-print-area, #business-invoice-print-area * {
                            margin: initial !important;
                            padding: initial !important;
                        }
                        /* Ensure specific tailwind margins/paddings on the invoice are preserved (hacky but works) */
                        #business-invoice-print-area [class*="p-"] { padding: inherit; }
                        #business-invoice-print-area [class*="m-"] { margin: inherit; }`;
                        
    if (content.includes(target)) {
        content = content.replace(target, repl);
        fs.writeFileSync(file, content);
        console.log("Applied padding collapse fix to", file);
    }
});
