(() => {document.documentElement.classList.add('js');try {const mode=localStorage.getItem('elpa-theme');if(mode==='light'||mode==='dark')document.documentElement.dataset.theme=mode;} catch {}})();
