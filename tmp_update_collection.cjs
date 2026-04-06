const fs = require('fs');
const file = 'Datarithm.postman_collection.json';
const coll = JSON.parse(fs.readFileSync(file));

function getFolder(name) {
    return coll.item.find(i => i.name.toLowerCase().includes(name.toLowerCase()));
}

const authFolder = getFolder('user') || getFolder('auth');

if (authFolder) {
  if (!authFolder.item.find(i => i.name === 'Send Login OTP')) {
    authFolder.item.splice(1, 0, {
      name: 'Send Login OTP',
      request: {
        method: 'POST',
        header: [],
        body: { mode: 'raw', raw: '{\n  "phone": "9074054046"\n}', options: { raw: { language: 'json' } } },
        url: { raw: '{{baseUrl}}/api/user/send-login-otp', host: ['{{baseUrl}}'], path: ['api', 'user', 'send-login-otp'] }
      },
      response: []
    });
    console.log('Added Send Login OTP');
  }
  
  if (!authFolder.item.find(i => i.name === 'Verify Login OTP')) {
    authFolder.item.splice(2, 0, {
      name: 'Verify Login OTP',
      request: {
        method: 'POST',
        header: [],
        body: { mode: 'raw', raw: '{\n  "phone": "9074054046",\n  "otp": "1234"\n}', options: { raw: { language: 'json' } } },
        url: { raw: '{{baseUrl}}/api/user/verify-login-otp', host: ['{{baseUrl}}'], path: ['api', 'user', 'verify-login-otp'] }
      },
      response: []
    });
    console.log('Added Verify Login OTP');
  }
} else {
    console.log('Auth folder not found');
}

const sheetFolder = getFolder('spreadsheet');
if (sheetFolder) {
  if (!sheetFolder.item.find(i => i.name === 'Export PDF')) {
    sheetFolder.item.push({
      name: 'Export PDF',
      request: {
        method: 'GET',
        header: [{ key: 'Authorization', value: 'Bearer {{accessToken}}', type: 'text' }],
        url: { raw: '{{baseUrl}}/api/sheets/{{sheetId}}/export', host: ['{{baseUrl}}'], path: ['api', 'sheets', '{{sheetId}}', 'export'] }
      },
      response: []
    });
    console.log('Added Export PDF');
  }
}

fs.writeFileSync(file, JSON.stringify(coll, null, 2));
console.log('Postman collection updated successfully.');
