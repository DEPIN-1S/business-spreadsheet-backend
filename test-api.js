const axios = require('axios');
axios.post('http://localhost:6041/api/auth/login', { email: 'jithinpm.official@gmail.com', password: 'password123' })
    .then(res => {
        const token = res.data.accessToken;
        return axios.get('http://localhost:6041/api/sheets?forInvoiceGenerator=true', { headers: { Authorization: 'Bearer ' + token } });
    })
    .then(res => console.log(JSON.stringify(res.data, null, 2)))
    .catch(console.error);
