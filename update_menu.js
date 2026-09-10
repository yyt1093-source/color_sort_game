const token = process.env.BOT_TOKEN || '8837816458:AAHcVqwLGUdz3TXq2Z1SN7Q4a2DVBkaagfE';
const url = 'https://pink-games-decide.loca.lt';

async function updateMenu() {
  const res = await fetch(`https://api.telegram.org/bot${token}/setChatMenuButton`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      menu_button: {
        type: 'web_app',
        text: '🎮 Играть',
        web_app: { url }
      }
    })
  });
  const data = await res.json();
  console.log('SetMenuButton Result:', data);
}

updateMenu();
