// Applique le thème avant le premier rendu pour éviter un flash clair (voir ThemeStore).
// Fichier séparé et non script en ligne : la Content-Security-Policy n'autorise que
// les scripts servis par le site (script-src 'self').
try {
  var mode = localStorage.getItem('devmirror.theme') || 'system';
  var dark =
    mode === 'dark' ||
    (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  if (dark) document.documentElement.classList.add('dark');
} catch (e) {}
