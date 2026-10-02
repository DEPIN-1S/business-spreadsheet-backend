const fs = require('fs');

const files = [
    '../spreadsheetfrontend/src/Components/GenerateInvoiceModal.jsx',
    '../spreadsheetfrontend/src/Components/ViewSavedInvoiceModal.jsx'
];

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');

    const target1 = `overflow: visible !important;
                            -webkit-print-color-adjust: exact !important;
                            print-color-adjust: exact !important;
                        }`;
                        
    const repl1 = `overflow: hidden !important;
                            -webkit-print-color-adjust: exact !important;
                            print-color-adjust: exact !important;
                        }`;

    const target2 = `overflow: visible !important;
                            background: transparent !important;`;
                            
    const repl2 = `overflow: hidden !important;
                            background: transparent !important;`;

    // Try to replace
    let updated = false;
    
    // Using string replace to ensure we change the specific body overflow
    const fullTarget = `html, body {
                            width: 100% !important;
                            height: auto !important;
                            margin: 0 !important;
                            padding: 0 !important;
                            background: #fff !important;
                            overflow: visible !important;
                            -webkit-print-color-adjust: exact !important;
                            print-color-adjust: exact !important;
                        }`;
                        
    const fullRepl = `html, body {
                            width: 100% !important;
                            height: 100vh !important;
                            margin: 0 !important;
                            padding: 0 !important;
                            background: #fff !important;
                            overflow: hidden !important;
                            -webkit-print-color-adjust: exact !important;
                            print-color-adjust: exact !important;
                        }`;
                        
    if (content.includes(fullTarget)) {
        content = content.replace(fullTarget, fullRepl);
        updated = true;
    } else {
        console.log("Full target not found in", file);
    }
    
    if (updated) {
        fs.writeFileSync(file, content);
        console.log("Updated", file);
    }
});
