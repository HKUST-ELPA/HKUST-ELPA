(() => {
  const english = window.ELPA_TRANSLATIONS || {};
  const originals = new WeakMap();
  const attributes = new WeakMap();
  const root = document.documentElement;
  const button = document.getElementById('language-toggle');
  const translateNode = node => {
    if (node.parentElement?.closest('script,style,.q-title,.subq-list')) return;
    const current = node.nodeValue;
    let saved = originals.get(node);
    if (!saved || current !== saved.rendered) saved = {source: current, rendered: current};
    const source = saved.source;
    const key = source.trim();
    const desired = root.dataset.lang === 'en' && english[key]
      ? source.replace(key, english[key]) : source;
    saved.rendered = desired;
    originals.set(node, saved);
    if (current !== desired) node.nodeValue = desired;
  };
  const translateElement = element => {
    if (element.matches('script,style')) return;
    for (const name of ['placeholder', 'title', 'aria-label']) {
      if (!element.hasAttribute(name)) continue;
      let saved = attributes.get(element) || {};
      const current = element.getAttribute(name);
      if (!saved[name] || current !== saved[name].rendered)
        saved[name] = {source: current, rendered: current};
      const desired = root.dataset.lang === 'en'
        ? english[saved[name].source] || saved[name].source : saved[name].source;
      saved[name].rendered = desired;
      attributes.set(element, saved);
      if (current !== desired) element.setAttribute(name, desired);
    }
  };
  const render = () => {
    const isEnglish = root.dataset.lang === 'en';
    root.lang = isEnglish ? 'en' : 'zh-CN';
    const label = isEnglish ? '中文' : 'EN';
    if (button.textContent !== label) button.textContent = label;
    button.setAttribute('aria-label', isEnglish ? '切换为中文' : 'Switch to English');
    document.querySelectorAll('body *').forEach(translateElement);
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) translateNode(walker.currentNode);
    const title = document.title;
    if (isEnglish && english[title]) document.title = english[title];
    else if (!isEnglish && document.title !== document.body.dataset.originalTitle)
      document.title = document.body.dataset.originalTitle || title;
  };
  document.body.dataset.originalTitle = document.title;
  button.addEventListener('click', () => {
    if (root.dataset.lang === 'en') delete root.dataset.lang;
    else root.dataset.lang = 'en';
    try { localStorage.setItem('elpa-lang', root.dataset.lang || 'zh'); } catch {}
    render();
    window.dispatchEvent(new Event('elpa:language'));
  });
  let pending = false;
  new MutationObserver(() => {
    if (pending) return;
    pending = true;
    queueMicrotask(() => { pending = false; render(); });
  }).observe(document.body, {subtree:true, childList:true, characterData:true});
  window.addEventListener('elpa:route', () => {
    document.body.dataset.originalTitle = document.title;
    render();
  });
  render();
})();
