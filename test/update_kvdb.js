const bucket = '82kzJTUxZwwFNvg7kUSqgM';
const kvdbKey = 'colorsort_code_checkpoints';

const updatedCheckpoints = [
  {
    id: 'colorsort_checkpoint_20261003_033500',
    createdAtTimestamp: 1790987700000,
    kyivFormattedDate: '03.10.2026, 03:35:00 (Киев)',
    title: 'Версия v1.0.6 — Стабильная рабочая версия (мгновенный старт, touchstart, чистые колбочки)',
    note: 'Метка Git: v1.0.6-stable-instant-start-checkpoint. Полностью устранён зависающий экран заставки, убрана проблемная шкала 99%. Экран старта и кнопка START открываются мгновенно, добавлены обработчики touchstart для сверхбыстрого отклика на смартфонах в Telegram WebApp. Колбочки чистые, без полос над красками. Снимки лидерборда в 23:59 по Киеву. Безлимитные подарки администратора. 100% тестов пройдены.',
    tag: 'v1.0.6-stable-instant-start-checkpoint'
  },
  {
    id: 'colorsort_checkpoint_20261003_004200',
    createdAtTimestamp: 1790977320000,
    kyivFormattedDate: '03.10.2026, 00:42:00 (Киев)',
    title: 'Версия v1.0.4 — Мгновенный полноэкранный запуск и чистые колбочки',
    note: 'Метка Git: v1.0.4-fullscreen-clean-checkpoint. Мгновенный запуск на весь экран в Telegram без задержек и дёрганья (ранняя инициализация в <head>, viewport-fit=cover, стабильная фиксация 100% высоты). Полностью убрана белая переливающаяся полоска над краской в колбочках. Снимки лидерборда в 23:59 по Киеву. Безлимитные подарки для администратора.',
    tag: 'v1.0.4-fullscreen-clean-checkpoint'
  },
  {
    id: 'colorsort_checkpoint_20261003_001500',
    createdAtTimestamp: 1790975700000,
    kyivFormattedDate: '03.10.2026, 00:15:00 (Киев)',
    title: 'Версия v1.0.3 — Плавная загрузка, чистый экран старта и стабильная работа',
    note: 'Метка Git: v1.0.3-smooth-loading-checkpoint. Устранено дёрганье экрана старта, убрана дублирующая кнопка и пустое место внизу. Оптимизирована нагрузка на телефон (0% лишней нагрузки на CPU/GPU). Снимки лидерборда в 23:59 по Киеву. Безлимитные подарки для администратора.',
    tag: 'v1.0.3-smooth-loading-checkpoint'
  },
  {
    id: 'colorsort_checkpoint_20261002_210400',
    createdAtTimestamp: 1790964240000,
    kyivFormattedDate: '02.10.2026, 21:04:00 (Киев)',
    title: 'Версия v1.0.2 — Рабочая версия панели администратора',
    note: 'Метка Git: v1.0.2-admin-panel-checkpoint. Полностью рабочая панель администратора: плиточный интерфейс, резервные копии, управление уровнями, исследование лидера, кошельки, новости. Очищен лидерборд.',
    tag: 'v1.0.2-admin-panel-checkpoint'
  },
  {
    id: 'colorsort_checkpoint_20261002_184800',
    createdAtTimestamp: 1790956080000,
    kyivFormattedDate: '02.10.2026, 18:48:00 (Киев)',
    title: 'Версия v1.0.1 — Плиточная панель (шахматный порядок)',
    note: 'Метка Git: v1.0.1-tile-grid-checkpoint. Шахматная панель администратора: Резервные копии, Управление, Исследование лидера, Кошелек, Новости. Все функции работают идеально.',
    tag: 'v1.0.1-tile-grid-checkpoint'
  },
  {
    id: 'colorsort_checkpoint_20261002_174000',
    createdAtTimestamp: 1790952000000,
    kyivFormattedDate: '02.10.2026, 17:40:00 (Киев)',
    title: 'Версия v1.0.0 — Стабильная рабочая версия Color Sort',
    note: 'Метка Git: v1.0.0-working-checkpoint. Все уровни, лидерборд, кошельки, бустеры и новости проверены и работают стабильно.',
    tag: 'v1.0.0-working-checkpoint'
  }
];

async function update() {
  const url = 'https://kvdb.io/' + bucket + '/' + kvdbKey;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updatedCheckpoints)
  });
  console.log('Status:', res.status, res.statusText);
  const text = await res.text();
  console.log('Response:', text);

  // Read back to verify
  const verifyRes = await fetch(url + '?_cb=' + Date.now());
  const json = await verifyRes.json();
  console.log('Verified count:', json.length);
  console.log('Latest checkpoint:', json[0].title, json[0].kyivFormattedDate);
}

update().catch(console.error);
