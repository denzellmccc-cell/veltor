const translations = {
  es: {
    topline:"FÚTBOL INTERNACIONAL · PERIODISMO DEPORTIVO", brandline:"FÚTBOL INTERNACIONAL",
    "nav-latest":"Última hora","nav-results":"Resultados","nav-transfers":"Fichajes","nav-features":"Reportajes",
    "hero-kicker":"UNA NUEVA MIRADA AL FÚTBOL MUNDIAL","hero-title":"El fútbol<br><em>no se detiene.</em>",
    "hero-description":"Noticias, resultados, fichajes e historias que acercan el juego a los aficionados de todo el mundo.","hero-button":"Explorar noticias",
    "art-caption":"EL JUEGO GLOBAL","ticker-one":"NOTICIAS CON CONTEXTO","ticker-two":"FICHAJES VERIFICADOS","ticker-three":"HISTORIAS QUE IMPORTAN",
    "latest-kicker":"LO QUE PASA","latest-title":"Últimas noticias","demo-note":"Contenido de demostración",
    "filter-all":"Todo","filter-news":"Noticias","filter-transfers":"Fichajes","filter-features":"Reportajes",
    "label-feature":"REPORTAJE","meta-feature":"ANÁLISIS · 6 MIN DE LECTURA","article-one-title":"Cómo está cambiando el fútbol para la próxima generación",
    "article-one-desc":"Un ejemplo de reportaje original: contexto, voces expertas y datos para entender el juego más allá del marcador.",
    "label-news":"ANÁLISIS","meta-news":"TÁCTICA · CONTEXTO","article-two-title":"La evolución táctica que merece una segunda mirada",
    "article-two-desc":"Una pieza de muestra para explicar ideas, tendencias y decisiones que definen los partidos.",
    "label-transfer":"MERCADO","meta-transfer":"FICHAJES · GUÍA","article-three-title":"Cómo distinguir un rumor de un fichaje confirmado",
    "article-three-desc":"VÉLTOR diferenciará las negociaciones, los reportes y los anuncios oficiales para informar con claridad.",
    "read-story":"Leer historia","cat-news":"NOTICIAS","cat-transfers":"FICHAJES","cat-features":"REPORTAJES","scores-kicker":"EN EL TERRENO DE JUEGO","scores-title":"Centro de resultados",
    "manual-note":"Ejemplo visual · sin marcadores en vivo","scores-placeholder-title":"Aquí vivirán los partidos",
    "scores-placeholder-desc":"En la primera versión, añade marcadores comprobados manualmente. Más adelante podrás integrar una fuente de datos autorizada.",
    "coming-soon":"PRÓXIMAMENTE","transfer-kicker":"MERCADO DE FICHAJES","transfer-title":"Hechos, no humo.",
    "transfer-desc":"Los rumores se etiquetan como rumores. Los fichajes solo se dan por confirmados cuando existe una fuente fiable.",
    "transfer-button":"Ver cobertura","features-kicker":"MÁS ALLÁ DEL MARCADOR","features-title":"Historias que dejan huella",
    "features-desc":"VÉLTOR aspira a combinar actualidad rápida con periodismo deportivo original: entrevistas, perfiles, reportajes y explicaciones que ayuden a comprender el fútbol mundial.",
    "footer-note":"Un proyecto editorial independiente en construcción.","contact":"Contacto","editorial":"Criterios editoriales","rights":"Todos los derechos reservados."
  },
  en: {
    topline:"INTERNATIONAL FOOTBALL · SPORTS JOURNALISM", brandline:"INTERNATIONAL FOOTBALL",
    "nav-latest":"Latest","nav-results":"Scores","nav-transfers":"Transfers","nav-features":"Features",
    "hero-kicker":"A NEW PERSPECTIVE ON WORLD FOOTBALL","hero-title":"Football<br><em>never stops.</em>",
    "hero-description":"News, scores, transfers and stories bringing the game closer to fans around the world.","hero-button":"Explore the news",
    "art-caption":"THE GLOBAL GAME","ticker-one":"NEWS WITH CONTEXT","ticker-two":"VERIFIED TRANSFERS","ticker-three":"STORIES THAT MATTER",
    "latest-kicker":"WHAT'S HAPPENING","latest-title":"Latest stories","demo-note":"Demo content",
    "filter-all":"All","filter-news":"News","filter-transfers":"Transfers","filter-features":"Features",
    "label-feature":"FEATURE","meta-feature":"ANALYSIS · 6 MIN READ","article-one-title":"How football is changing for the next generation",
    "article-one-desc":"A sample feature combining context, expert voices and data to understand the game beyond the scoreline.",
    "label-news":"ANALYSIS","meta-news":"TACTICS · CONTEXT","article-two-title":"The tactical evolution worth a closer look",
    "article-two-desc":"A sample piece explaining the ideas, trends and decisions that shape matches.",
    "label-transfer":"TRANSFER DESK","meta-transfer":"TRANSFERS · GUIDE","article-three-title":"How to tell a rumour from a confirmed transfer",
    "article-three-desc":"VÉLTOR will distinguish negotiations, reports and official announcements to keep coverage clear.",
    "read-story":"Read story","cat-news":"NEWS","cat-transfers":"TRANSFERS","cat-features":"FEATURES","scores-kicker":"ON THE PITCH","scores-title":"Scores centre",
    "manual-note":"Visual example · no live scores","scores-placeholder-title":"Your match centre will live here",
    "scores-placeholder-desc":"For the first version, add verified scores manually. Later, you can integrate an authorised data source.",
    "coming-soon":"COMING SOON","transfer-kicker":"TRANSFER WINDOW","transfer-title":"Facts, not noise.",
    "transfer-desc":"Rumours are labelled as rumours. A transfer is only confirmed when a reliable source verifies it.",
    "transfer-button":"View coverage","features-kicker":"BEYOND THE SCORELINE","features-title":"Stories that leave a mark",
    "features-desc":"VÉLTOR aims to combine fast-moving news with original sports journalism: interviews, profiles, features and explainers that help readers understand world football.",
    "footer-note":"An independent editorial project in the making.","contact":"Contact","editorial":"Editorial standards","rights":"All rights reserved."
  }
};

let currentLanguage = "es";
const languageButton = document.getElementById("language-toggle");
document.getElementById("year").textContent = new Date().getFullYear();

function setLanguage(language) {
  currentLanguage = language;
  document.documentElement.lang = language;
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const key = element.dataset.i18n;
    if (translations[language][key]) element.innerHTML = translations[language][key];
  });
  languageButton.textContent = language === "es" ? "EN" : "ES";
  languageButton.setAttribute("aria-label", language === "es" ? "Switch to English" : "Cambiar a español");
}
languageButton.addEventListener("click", () => setLanguage(currentLanguage === "es" ? "en" : "es"));

document.querySelectorAll(".filter").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".filter").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    const category = button.dataset.filter;
    document.querySelectorAll(".article-card").forEach((card) => {
      card.classList.toggle("hidden", category !== "all" && card.dataset.category !== category);
    });
  });
});

// Si hay publicaciones reales en Firebase, reemplazan el contenido de demostración.
if (window.VeltorPosts && VeltorPosts.enabled) {
  VeltorPosts.loadPublished().then((posts) => {
    if (!posts.length) return;
    document.getElementById("article-grid").replaceChildren(...posts.map((p, i) => VeltorPosts.card(p, i === 0)));
    document.querySelectorAll('[data-i18n="demo-note"]').forEach((n) => n.remove());
  }).catch(() => {});
}
