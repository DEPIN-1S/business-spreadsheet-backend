import "dotenv/config";

async function testMsg91() {
  const phone = "9074054046";
  const TEMPLATE_ID = process.env.MSG91_TEMPLATE_ID;
  const AUTH_KEY = process.env.MSG91_AUTH_KEY;
  const SENDER_ID = process.env.MSG91_SENDER_ID;
  const url = `https://control.msg91.com/api/v5/otp?template_id=${TEMPLATE_ID}&mobile=91${phone}&authkey=${AUTH_KEY}${SENDER_ID ? `&sender=${SENDER_ID}` : ''}`;
  
  console.log("URL:", url);

  try {
      const response = await fetch(url, { method: "POST" });
      const data = await response.json();
      console.log("MSG91 DATA:", data);
  } catch (err) {
      console.error(err);
  }
}

testMsg91();
