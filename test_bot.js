const token = process.env.BOT_TOKEN || '8837816458:AAGeBFs-ZOF56yro_QhZ7b-Wr6v8RaR6x0c';

async function testToken() {
  const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
  const data = await res.json();
  console.log('BotInfo:', data);
}

testToken();
