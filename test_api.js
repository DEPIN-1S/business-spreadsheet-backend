import fs from 'fs';
fetch('http://localhost:6041/api/sheets?forInvoiceGenerator=true', {
    headers: {
        'Authorization': 'Bearer ' + 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImR1bW15Iiwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzg5OTg0NTk1LCJleHAiOjE3ODk5ODgxOTV9.4A1B7wkJw5FtBKgsc0lmwnP8jx3sTq-ZVWNGI3bA7_g'
    }
}).then(res => res.json()).then(console.log).catch(console.error);
