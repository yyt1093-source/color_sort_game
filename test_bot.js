const token = process.env.BOT_TOKEN || '8837816458:AAHcVqwLGUdz3TXq2Z1SN7Q4a2DVBkaagfE';

async function testToken() {
  const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
  const data = await res.json();
  console.log('BotInfo:', data);
}

testToken();
