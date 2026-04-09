import { marked } from "https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js";
loadContent();

async function loadContent() {
  let x = "\n" + await ((await fetch('README.md')).text());
  x = x.replace(/\n## /g, '\n### H2:');
  x = x.slice(x.indexOf('##'));
  x = marked.parse(x);
  x = x.replaceAll('backend/showDocs/images', '/backend/showDocs/images');
  document.body.innerHTML = /*html*/`
    <header>
      <a href="/">Statistics Template JS, v 8.0</a>
      <div class="burger"><div>
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" style="fill: rgba(0,0,0, 1);transform: ;msFilter:;"><path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z"></path></svg>
      </div></div>
      <span>© ironboy/NodeHill 2025</span>
    </header>
    <main><article>${x}</article></main>
  `;
  wrapHeadlinesInSections();
  buildTOC();
  hljs.highlightAll();
  addClipboardButtons();
  addBlankToExternalLinks();
  navigate();
}

function wrapHeadlinesInSections() {
  for (let i = 6; i >= 1; i--) {
    let all = [...document.body.querySelectorAll('*')];
    let section;
    for (let el of all) {
      if (el.tagName[0] === "H") {
        var level = +el.tagName[1];
        if (level <= i) { section = null; }
      }
      if (el.tagName === 'H' + i) {
        section = document.createElement('section');
        section.classList.add('h' + i);
        section.id = kebabCase(el.innerText.replace(/^H2:/g, ''));
        el.before(section);
      }
      if (section && !section.contains(el)) {
        section.append(el);
      }
    }
  }
}

function buildTOC() {
  var level = 0;
  let parents = [document.createElement('div')];
  for (let section of [...document.body.querySelectorAll('section')]) {
    let level = +section.getAttribute('class')[1];
    let a = document.createElement('a');
    let theH = section.querySelector('h' + level);
    a.innerHTML = theH.innerText;
    a.setAttribute('href', '#' + section.id);
    let le = level;
    if (a.innerText.indexOf('H2:') === 0) {
      le = 2;
      a.innerText = a.innerText.slice(3);
      theH.innerText = a.innerText;
      theH.classList.add("bigger");
    }
    a.classList.add('h' + le);
    let parent;
    let l = level;
    do {
      l--;
      parent = parents[l];
    } while (!parent && l >= 0);
    parent.append(a);
    parents[level] = a;
  }
  let aside = document.createElement('aside');
  aside.append(parents[0]);
  document.querySelector('main').prepend(aside);
}

function kebabCase(str) {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replaceAll(' ', '-')
    .replaceAll('.', '-')
    .toLowerCase()
    .replace(/((?![a-z0-9\-]).)*/g, "");
}

function navigate() {
  if (!location.hash) {
    location.hash = document.querySelector('aside a').getAttribute('href');
    return;
  }
  [...document.querySelectorAll('aside a')].forEach(x => x.classList.remove('active'));
  let activeA = document.querySelector(`aside a[href="${location.hash}"]`);
  activeA.classList.add('active');
  activeA[activeA.scrollIntoViewIfNeeded ? "scrollIntoViewIfNeeded" : "scrollIntoView"]();
  [...document.querySelectorAll('section:not(section.h2)')].map(x => x.style.display = "none");
  [...document.querySelectorAll(`section${location.hash}, section${location.hash} section`)]
    .forEach(x => x.style.display = "block");
  document.title = 'Docs STJS: ' + activeA.innerText;
  setTimeout(() => scrollTo(0, 0));
}

window.onhashchange = navigate;

document.body.addEventListener('click', e => {
  if (!e.target.closest('.burger')) { return; }
  document.querySelector('aside').classList.toggle('shown');
  //navigator.clipboard.writeText("hejsan hoppsan");
});

document.body.addEventListener('click', e => {
  if (!e.target.closest('aside.shown')) { return; }
  document.querySelector('aside').classList.toggle('shown');
});

document.body.addEventListener('click', e => {
  if (!e.target.closest('.toClipboard')) { return; }
  let code = e.target.closest('code').innerText;
  navigator.clipboard.writeText(code);
});

function addBlankToExternalLinks() {
  [...document.querySelectorAll("a[href^='http']")].forEach(x =>
    x.setAttribute('target', '_blank'));
}

function addClipboardButtons() {
  let a = '<div title="Copy to clipboard" class="toClipboard"><div><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" style="fill: rgba(255, 255, 255, 1);transform: ;msFilter:;"><path d="M19 3h-2.25a1 1 0 0 0-1-1h-7.5a1 1 0 0 0-1 1H5c-1.103 0-2 .897-2 2v15c0 1.103.897 2 2 2h14c1.103 0 2-.897 2-2V5c0-1.103-.897-2-2-2zm0 17H5V5h2v2h10V5h2v15z"></path></svg></div></div>';
  [...document.querySelectorAll('code')].forEach(el => {
    let d = document.createElement('div');
    d.innerHTML = a;
    el.append(d.querySelector('.toClipboard'));
  });
}