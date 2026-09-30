// Taalkeuze voor alle wesselsmit.com-sites: Engels is standaard, Nederlands is een optie.
// De HTML is Engels; de Nederlandse versie staat ernaast in data-nl (tekst), data-nl-html (met opmaak),
// data-nl-placeholder, data-nl-title of data-nl-aria-label. In JavaScript: L("English", "Nederlands").
// De keuze staat in een cookie op .wesselsmit.com, zodat hij op alle subdomeinen geldt.
// Een knop met [data-lang-toggle] wisselt de taal. Definieer window.onLangChange om zonder herladen
// opnieuw te renderen; anders wordt de pagina herladen.
(() => {
  const ATTRS = ["placeholder", "title", "aria-label"];
  const params = new URLSearchParams(location.search);

  const save = (value) => {
    const domain = location.hostname.endsWith("wesselsmit.com") ? "; domain=.wesselsmit.com" : "";
    document.cookie = `lang=${value}; path=/; max-age=31536000; SameSite=Lax${domain}`;
  };

  let lang = (document.cookie.match(/(?:^|;\s*)lang=(en|nl)/) || [])[1] || "en";
  if (params.get("lang") === "en" || params.get("lang") === "nl") {
    lang = params.get("lang");
    save(lang);
    params.delete("lang");
    const qs = params.toString();
    history.replaceState(history.state, "", location.pathname + (qs ? "?" + qs : "") + location.hash);
  }

  const apply = (root = document) => {
    const nl = lang === "nl";
    document.documentElement.lang = lang;
    root.querySelectorAll("[data-nl]").forEach((el) => {
      if (el.dataset.en === undefined) el.dataset.en = el.textContent;
      el.textContent = nl ? el.dataset.nl : el.dataset.en;
    });
    root.querySelectorAll("[data-nl-html]").forEach((el) => {
      if (el.dataset.enHtml === undefined) el.dataset.enHtml = el.innerHTML;
      el.innerHTML = nl ? el.dataset.nlHtml : el.dataset.enHtml;
    });
    for (const attr of ATTRS) {
      root.querySelectorAll(`[data-nl-${attr}]`).forEach((el) => {
        if (!el.hasAttribute(`data-en-${attr}`)) el.setAttribute(`data-en-${attr}`, el.getAttribute(attr) || "");
        el.setAttribute(attr, el.getAttribute(nl ? `data-nl-${attr}` : `data-en-${attr}`));
      });
    }
    document.querySelectorAll("[data-lang-toggle]").forEach((btn) => {
      btn.querySelectorAll("[data-lang]").forEach((s) => s.classList.toggle("on", s.dataset.lang === lang));
      btn.setAttribute("aria-label", nl ? "Switch to English" : "Schakel naar Nederlands");
    });
  };

  document.addEventListener("click", (e) => {
    if (!e.target.closest("[data-lang-toggle]")) return;
    lang = lang === "en" ? "nl" : "en";
    save(lang);
    if (typeof window.onLangChange === "function") {
      apply();
      window.onLangChange(lang);
    } else {
      location.reload();
    }
  });

  window.LANG = () => lang;
  window.L = (en, nl) => (lang === "nl" ? nl : en);
  window.LOCALE = () => (lang === "nl" ? "nl-NL" : "en-GB");
  window.applyLang = apply;
  apply();
})();
