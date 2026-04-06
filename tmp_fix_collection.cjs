const fs = require('fs');
const file = 'Datarithm.postman_collection.json';
const coll = JSON.parse(fs.readFileSync(file));

function getFolder(name) {
    return coll.item.find(i => i.name.toLowerCase().includes(name.toLowerCase()));
}

const authFolder = getFolder('user') || getFolder('auth');

if (authFolder) {
  const sendItem = authFolder.item.find(i => i.name === 'Send Login OTP');
  if (sendItem) {
    sendItem.request.url.raw = '{{baseUrl}}/api/user/send-otp';
    sendItem.request.url.path = ['api', 'user', 'send-otp'];
  }
  
  const verifyItem = authFolder.item.find(i => i.name === 'Verify Login OTP');
  if (verifyItem) {
    verifyItem.request.url.raw = '{{baseUrl}}/api/user/verify-otp';
    verifyItem.request.url.path = ['api', 'user', 'verify-otp'];
  }
}

fs.writeFileSync(file, JSON.stringify(coll, null, 2));
console.log('Postman collection URLs fixed.');
