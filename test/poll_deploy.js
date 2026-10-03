async function poll() {
  for (let i = 1; i <= 10; i++) {
    await new Promise(r => setTimeout(r, 6000));
    try {
      const res = await fetch('https://yyt1093-source.github.io/color_sort_game/index.html?cb=' + Date.now());
      const html = await res.text();
      const hasTouch = html.includes('touchstart');
      const hasBox = html.includes('splashLoadingBox');
      console.log('Poll ' + i + ': hasTouch=' + hasTouch + ', hasSplashLoadingBox=' + hasBox);
      if (hasTouch && !hasBox) {
        console.log('🎉 GitHub Pages deployment is LIVE!');
        return;
      }
    } catch(e) {
      console.error(e);
    }
  }
}
poll();
