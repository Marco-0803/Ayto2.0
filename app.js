/* === AYTO Solver 2026 === */

const STORAGE_KEY_T = 'aytoTeilnehmer';
const STORAGE_KEY_MB = 'aytoMatchbox';
const STORAGE_KEY_NIGHTS = 'aytoMatchingNights';
const STORAGE_KEY_VERSION = 'aytoAppVersion';

const PREFILL_A = [
  'Alexandra',
  'Christin',
  'Emma',
  'Francesca',
  'Janice',
  'Jenny',
  'Julia',
  'Marta',
  'Michelle',
  'Zoe'
];

const PREFILL_B = [
  'Bennett',
  'Brian',
  'Cansin',
  'Daymian',
  'Fabi',
  'Germain',
  'Johannes',
  'Marwin',
  'Raul',
  'Robin'
];

let virtualMatches = [];
let lastResults = null;


/* === Version / Update === */

(async function initVersioning() {

  try {

    const meta =
      document.querySelector(
        'meta[name="app-version"]'
      );

    const version =
      meta
        ? meta.content
        : null;

    const last =
      localStorage.getItem(
        STORAGE_KEY_VERSION
      );

    if (
      version &&
      version !== last
    ) {

      localStorage.setItem(
        STORAGE_KEY_VERSION,
        version
      );

      if (
        'serviceWorker'
        in navigator
      ) {

        const registration =
          await navigator
            .serviceWorker
            .getRegistration();

        if (registration) {

          try {

            await registration.update();

          } catch (err) {

            console.warn(
              'Service Worker Update konnte nicht geprüft werden:',
              err
            );
          }
        }
      }
    }

  } catch (err) {

    console.warn(
      'Fehler beim Versionscheck:',
      err
    );
  }

})();


/* === Daten-Helfer === */

function readJSON(
  key,
  fallback
) {

  try {

    const raw =
      localStorage.getItem(key);

    return raw
      ? JSON.parse(raw)
      : fallback;

  } catch (err) {

    console.warn(
      `Ungültige lokale Daten bei ${key}:`,
      err
    );

    return fallback;
  }
}


function getT() {

  const data =
    readJSON(
      STORAGE_KEY_T,
      {
        A: [],
        B: []
      }
    );

  return {

    A:
      Array.isArray(data?.A)
        ? data.A
        : [],

    B:
      Array.isArray(data?.B)
        ? data.B
        : []
  };
}


function saveT(data) {

  localStorage.setItem(
    STORAGE_KEY_T,
    JSON.stringify(data)
  );

  document.dispatchEvent(
    new Event(
      'teilnehmerChanged'
    )
  );
}


function getMatchbox() {

  const data =
    readJSON(
      STORAGE_KEY_MB,
      []
    );

  return Array.isArray(data)
    ? data
    : [];
}


function saveMatchbox(data) {

  localStorage.setItem(
    STORAGE_KEY_MB,
    JSON.stringify(data)
  );
}


function getNights() {

  const data =
    readJSON(
      STORAGE_KEY_NIGHTS,
      []
    );

  return Array.isArray(data)
    ? data
    : [];
}


function saveNights(data) {

  localStorage.setItem(
    STORAGE_KEY_NIGHTS,
    JSON.stringify(data)
  );
}


function arraysEqual(
  a,
  b
) {

  return (
    a.length === b.length &&
    a.every(
      (value, index) =>
        value === b[index]
    )
  );
}


/* Automatische Erkennung der Staffelregel */

function getSolverMode(
  A,
  B
) {

  if (
    A.length === B.length &&
    A.length > 0
  ) {

    return 'ONE_TO_ONE';
  }

  if (
    A.length ===
      B.length + 1 &&
    B.length > 0
  ) {

    return 'ONE_DOUBLE_B';
  }

  return 'UNSUPPORTED';
}


function updateBalanceHint() {

  const hint =
    document.getElementById(
      'balanceHint'
    );

  const warn =
    document.getElementById(
      'warnBalance'
    );

  if (
    !hint &&
    !warn
  ) {

    return;
  }

  const {
    A,
    B
  } = getT();

  const mode =
    getSolverMode(
      A,
      B
    );


  if (hint) {

    if (
      !A.length &&
      !B.length
    ) {

      hint.textContent =
        'Regel wird anhand der Gruppengröße automatisch erkannt.';

    } else if (
      mode ===
      'ONE_TO_ONE'
    ) {

      hint.textContent =
        `Bei ${A.length}×${B.length} wird jede A-Person genau einer B-Person zugeordnet.`;

    } else if (
      mode ===
      'ONE_DOUBLE_B'
    ) {

      hint.textContent =
        `Bei ${A.length}×${B.length} bleibt in der Matching Night genau eine A-Person ohne Sitzpartner. Im Solver hat genau eine B-Person zwei Perfect Matches.`;

    } else {

      hint.textContent =
        `Gruppengröße ${A.length}×${B.length}: Diese Konstellation wird vom Solver derzeit nicht unterstützt.`;
    }
  }


  if (warn) {

    if (
      A.length ||
      B.length
    ) {

      warn.style.display =
        mode === 'UNSUPPORTED'
          ? 'block'
          : 'none';

      warn.textContent =
        mode === 'UNSUPPORTED'
          ? 'Unterstützt werden gleich große Gruppen oder Gruppe A mit genau einer Person mehr als Gruppe B.'
          : '';

    } else {

      warn.style.display =
        'none';

      warn.textContent =
        '';
    }
  }
}


/* === Overlay === */

function showOverlay() {

  const overlay =
    document.getElementById(
      'overlay'
    );

  if (!overlay) {
    return;
  }

  overlay.classList.add(
    'show'
  );

  overlay.setAttribute(
    'aria-hidden',
    'false'
  );

  const bar =
    overlay.querySelector(
      '.bar'
    );

  const status =
    overlay.querySelector(
      '.status-text'
    );

  if (bar) {
    bar.style.width =
      '0%';
  }

  if (status) {
    status.textContent =
      'Berechnung läuft... (0%)';
  }
}


function hideOverlay() {

  const overlay =
    document.getElementById(
      'overlay'
    );

  if (!overlay) {
    return;
  }

  overlay.classList.remove(
    'show'
  );

  overlay.setAttribute(
    'aria-hidden',
    'true'
  );
}


/* === Teilnehmer === */

function createPersonUI(
  name,
  listId
) {

  const listEl =
    document.getElementById(
      listId
    );

  if (!listEl) {
    return;
  }


  const row =
    document.createElement(
      'div'
    );

  row.className =
    'row person-row';


  const input =
    document.createElement(
      'input'
    );

  input.type =
    'text';

  input.value =
    name || '';

  input.placeholder =
    'Name';

  input.autocomplete =
    'off';


  const removeButton =
    document.createElement(
      'button'
    );

  removeButton.type =
    'button';

  removeButton.className =
    'danger small';

  removeButton.textContent =
    '✖';

  removeButton.setAttribute(
    'aria-label',
    'Teilnehmer entfernen'
  );


  const persist = () => {

    const A = [
      ...document.querySelectorAll(
        '#listA input'
      )
    ]
      .map(
        el =>
          el.value.trim()
      )
      .filter(Boolean);


    const B = [
      ...document.querySelectorAll(
        '#listB input'
      )
    ]
      .map(
        el =>
          el.value.trim()
      )
      .filter(Boolean);


    saveT({
      A,
      B
    });
  };


  input.addEventListener(
    'input',
    persist
  );


  removeButton.addEventListener(
    'click',
    () => {

      row.remove();

      persist();
    }
  );


  row.append(
    input,
    removeButton
  );

  listEl.appendChild(
    row
  );
}


function renderParticipantsFromStorage() {

  const listA =
    document.getElementById(
      'listA'
    );

  const listB =
    document.getElementById(
      'listB'
    );

  if (
    !listA ||
    !listB
  ) {

    return;
  }


  listA.innerHTML =
    '';

  listB.innerHTML =
    '';


  const {
    A,
    B
  } = getT();


  A.forEach(
    name =>
      createPersonUI(
        name,
        'listA'
      )
  );


  B.forEach(
    name =>
      createPersonUI(
        name,
        'listB'
      )
  );
}


function updatePrefillButtonState() {

  const button =
    document.getElementById(
      'prefill'
    );

  if (!button) {
    return;
  }


  const {
    A,
    B
  } = getT();


  const isPrefill =
    arraysEqual(
      A,
      PREFILL_A
    ) &&
    arraysEqual(
      B,
      PREFILL_B
    );


  button.textContent =
    isPrefill
      ? '✅ Staffel 2026 VIP geladen'
      : '🔁 Staffel 2026 VIP vorbelegen';


  button.disabled =
    isPrefill;
}


/* === Hauptinitialisierung === */

document.addEventListener(
  'DOMContentLoaded',
  () => {

    initNavigation();

    initParticipants();

    initMatchbox();

    initMatchingNights();

    initBackup();

    initSolver();

    updateBalanceHint();

    updatePrefillButtonState();
  }
);


/* === Navigation === */

function initNavigation() {

  const nav =
    document.getElementById(
      'nav'
    );

  const pages =
    document.querySelectorAll(
      '.page'
    );

  if (!nav) {
    return;
  }


  nav.addEventListener(
    'click',
    event => {

      const button =
        event.target.closest(
          'button[data-target]'
        );

      if (!button) {
        return;
      }


      document
        .querySelectorAll(
          '.bottom-nav button'
        )
        .forEach(
          btn => {

            btn.classList.toggle(
              'active',
              btn === button
            );
          }
        );


      const id =
        button.getAttribute(
          'data-target'
        );


      pages.forEach(
        page => {

          page.classList.toggle(
            'active',
            page.id === id
          );
        }
      );


      if (
        id ===
        'page-nights'
      ) {

        renderOrakel();
      }


      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  );
}


/* === Teilnehmer initialisieren === */

function initParticipants() {

  const listA =
    document.getElementById(
      'listA'
    );

  const listB =
    document.getElementById(
      'listB'
    );

  if (
    !listA ||
    !listB
  ) {

    return;
  }


  renderParticipantsFromStorage();


  document
    .getElementById(
      'addA'
    )
    ?.addEventListener(
      'click',
      () => {

        createPersonUI(
          '',
          'listA'
        );

        [
          ...listA
            .querySelectorAll(
              'input'
            )
        ]
          .at(-1)
          ?.focus();
      }
    );


  document
    .getElementById(
      'addB'
    )
    ?.addEventListener(
      'click',
      () => {

        createPersonUI(
          '',
          'listB'
        );

        [
          ...listB
            .querySelectorAll(
              'input'
            )
        ]
          .at(-1)
          ?.focus();
      }
    );


  document
    .getElementById(
      'prefill'
    )
    ?.addEventListener(
      'click',
      () => {

        saveT({
          A: [
            ...PREFILL_A
          ],

          B: [
            ...PREFILL_B
          ]
        });


        renderParticipantsFromStorage();

        updatePrefillButtonState();
      }
    );


  document.addEventListener(
    'teilnehmerChanged',
    () => {

      updateBalanceHint();

      updatePrefillButtonState();
    }
  );
}


/* === Matchbox === */

function initMatchbox() {

  const tbA =
    document.getElementById(
      'tbA'
    );

  const tbB =
    document.getElementById(
      'tbB'
    );

  const tbType =
    document.getElementById(
      'tbType'
    );

  const tbList =
    document.getElementById(
      'tbList'
    );

  const addButton =
    document.getElementById(
      'addTB'
    );


  if (
    !tbA ||
    !tbB ||
    !tbType ||
    !tbList ||
    !addButton
  ) {

    return;
  }


  const refreshOptions =
    () => {

      const {
        A,
        B
      } = getT();


      tbA.replaceChildren();

      tbB.replaceChildren();


      const placeholderA =
        new Option(
          '- A auswählen -',
          ''
        );

      const placeholderB =
        new Option(
          '- B auswählen -',
          ''
        );


      tbA.add(
        placeholderA
      );

      tbB.add(
        placeholderB
      );


      A.forEach(
        name =>
          tbA.add(
            new Option(
              name,
              name
            )
          )
      );


      B.forEach(
        name =>
          tbB.add(
            new Option(
              name,
              name
            )
          )
      );
    };


  const render =
    () => {

      const entries =
        getMatchbox();


      tbList.replaceChildren();


      if (
        !entries.length
      ) {

        const empty =
          document.createElement(
            'div'
          );

        empty.className =
          'small muted';

        empty.textContent =
          'Noch keine Einträge';

        tbList.appendChild(
          empty
        );

        return;
      }


      entries.forEach(
        (
          entry,
          index
        ) => {

          const row =
            document.createElement(
              'div'
            );

          row.className =
            'row';


          const content =
            document.createElement(
              'div'
            );

          content.style.flex =
            '1';

          content.style.display =
            'flex';

          content.style.alignItems =
            'center';

          content.style.gap =
            '8px';

          content.style.flexWrap =
            'wrap';


          const pair =
            document.createElement(
              'span'
            );


          const nameA =
            document.createElement(
              'b'
            );


          const nameB =
            document.createElement(
              'b'
            );


          nameA.textContent =
            entry.A;

          nameB.textContent =
            entry.B;


          pair.append(
            nameA,

            document
              .createTextNode(
                ' × '
              ),

            nameB
          );


          const tag =
            document.createElement(
              'span'
            );


          tag.className =
            'tag';


          if (
            entry.type ===
            'PM'
          ) {

            tag.classList.add(
              'pm'
            );

            tag.textContent =
              'Perfect Match';

          } else if (
            entry.type ===
            'NM'
          ) {

            tag.classList.add(
              'nm'
            );

            tag.textContent =
              'No Match';

          } else if (
            entry.type ===
            'SOLD'
          ) {

            tag.classList.add(
              'sold'
            );

            tag.textContent =
              'Verkauft';

          } else {

            tag.classList.add(
              'neutral'
            );

            tag.textContent =
              String(
                entry.type ||
                'Unbekannt'
              );
          }


          const removeButton =
            document.createElement(
              'button'
            );


          removeButton.className =
            'danger small';


          removeButton.textContent =
            '✖';


          removeButton
            .setAttribute(
              'aria-label',
              'Matchbox-Eintrag entfernen'
            );


          removeButton
            .addEventListener(
              'click',
              () => {

                const next =
                  getMatchbox();


                next.splice(
                  index,
                  1
                );


                saveMatchbox(
                  next
                );


                render();
              }
            );


          content.append(
            pair,
            tag
          );


          row.append(
            content,
            removeButton
          );


          tbList.appendChild(
            row
          );
        }
      );
    };


  addButton.addEventListener(
    'click',
    () => {

      if (
        !tbA.value ||
        !tbB.value
      ) {

        alert(
          'Bitte A und B wählen'
        );

        return;
      }


      const entries =
        getMatchbox();


      entries.push({

        A:
          tbA.value,

        B:
          tbB.value,

        type:
          tbType.value
      });


      saveMatchbox(
        entries
      );


      render();
    }
  );


  document.addEventListener(
    'teilnehmerChanged',
    refreshOptions
  );


  refreshOptions();

  render();
}


/* === Matching Nights === */

function initMatchingNights() {

  const addButton =
    document.getElementById(
      'addNight'
    );

  const nightsList =
    document.getElementById(
      'nights'
    );


  if (
    !addButton ||
    !nightsList
  ) {

    return;
  }


  const render =
    () => {

      const nights =
        getNights();

      const {
        B
      } = getT();


      nightsList.replaceChildren();


      if (
        !nights.length
      ) {

        const empty =
          document.createElement(
            'div'
          );

        empty.className =
          'night-empty-state';


        const emptyIcon =
          document.createElement(
            'div'
          );

        emptyIcon.className =
          'night-empty-icon';

        emptyIcon.textContent =
          '☾';


        const emptyTitle =
          document.createElement(
            'strong'
          );

        emptyTitle.textContent =
          'Noch keine Matching Night';


        const emptyText =
          document.createElement(
            'span'
          );

        emptyText.textContent =
          'Lege die erste Night an und trage anschließend die Lichter ein.';


        empty.append(
          emptyIcon,
          emptyTitle,
          emptyText
        );


        nightsList.appendChild(
          empty
        );

        return;
      }


      nights.forEach(
        (
          night,
          index
        ) => {

          const card =
            document.createElement(
              'article'
            );

          card.className =
            'night-card-v2';


          const head =
            document.createElement(
              'div'
            );

          head.className =
            'night-card-v2-head';


          const titleWrap =
            document.createElement(
              'div'
            );

          titleWrap.className =
            'night-card-title-wrap';


          const ceremony =
            document.createElement(
              'span'
            );

          ceremony.className =
            'night-card-eyebrow';

          ceremony.textContent =
            `CEREMONY ${String(index + 1).padStart(2, '0')}`;


          const title =
            document.createElement(
              'strong'
            );

          title.className =
            'night-card-title';

          title.textContent =
            `Matching Night ${index + 1}`;


          titleWrap.append(
            ceremony,
            title
          );


          const removeButton =
            document.createElement(
              'button'
            );

          removeButton.type =
            'button';

          removeButton.className =
            'night-delete-button';

          removeButton.textContent =
            '×';

          removeButton
            .setAttribute(
              'aria-label',
              `Matching Night ${index + 1} löschen`
            );


          removeButton
            .addEventListener(
              'click',
              () => {

                const next =
                  getNights();


                next.splice(
                  index,
                  1
                );


                saveNights(
                  next
                );


                render();
              }
            );


          head.append(
            titleWrap,
            removeButton
          );


          const lightCount =
            Math.max(
              0,
              Number(
                night.lights
              ) || 0
            );


          const lightPanel =
            document.createElement(
              'div'
            );

          lightPanel.className =
            'night-light-panel';


          const lightInfo =
            document.createElement(
              'div'
            );

          lightInfo.className =
            'night-light-info';


          const lightNumber =
            document.createElement(
              'strong'
            );

          lightNumber.className =
            'night-light-number';

          lightNumber.textContent =
            String(lightCount);


          const lightCopy =
            document.createElement(
              'span'
            );

          lightCopy.textContent =
            lightCount === 1
              ? 'Licht'
              : 'Lichter';


          lightInfo.append(
            lightNumber,
            lightCopy
          );


          const meter =
            document.createElement(
              'div'
            );

          meter.className =
            'night-light-meter';

          meter.setAttribute(
            'aria-label',
            `${lightCount} von ${B.length || lightCount} Lichtern`
          );


          const maxLights =
            Math.max(
              B.length,
              lightCount,
              1
            );


          for (
            let i = 0;
            i < maxLights;
            i++
          ) {

            const dot =
              document.createElement(
                'span'
              );

            dot.className =
              i < lightCount
                ? 'night-light-dot active'
                : 'night-light-dot';

            meter.appendChild(
              dot
            );
          }


          lightPanel.append(
            lightInfo,
            meter
          );


          const details =
            document.createElement(
              'details'
            );

          details.className =
            'night-pairs-details';


          const summary =
            document.createElement(
              'summary'
            );


          const summaryText =
            document.createElement(
              'span'
            );

          summaryText.textContent =
            'Paarungen anzeigen';


          const summaryCount =
            document.createElement(
              'span'
            );

          summaryCount.className =
            'night-pair-count';

          summaryCount.textContent =
            `${Array.isArray(night.pairs) ? night.pairs.length : 0} Paare`;


          summary.append(
            summaryText,
            summaryCount
          );


          const pairList =
            document.createElement(
              'div'
            );

          pairList.className =
            'night-pair-list';


          (
            Array.isArray(
              night.pairs
            )
              ? night.pairs
              : []
          )
            .forEach(
              pair => {

                const row =
                  document.createElement(
                    'div'
                  );

                row.className =
                  'night-pair-row';


                const personA =
                  document.createElement(
                    'span'
                  );

                personA.className =
                  'night-pair-person';

                personA.textContent =
                  pair.A || '';


                const connector =
                  document.createElement(
                    'span'
                  );

                connector.className =
                  'night-pair-connector';

                connector.textContent =
                  '×';


                const personB =
                  document.createElement(
                    'span'
                  );

                personB.className =
                  pair.B === 'keine'
                    ? 'night-pair-person no-partner'
                    : 'night-pair-person';

                personB.textContent =
                  pair.B === 'keine'
                    ? 'Kein Partner'
                    : (
                        pair.B || ''
                      );


                row.append(
                  personA,
                  connector,
                  personB
                );


                pairList.appendChild(
                  row
                );
              }
            );


          details.append(
            summary,
            pairList
          );


          card.append(
            head,
            lightPanel,
            details
          );


          nightsList.appendChild(
            card
          );
        }
      );
    };


  addButton
    .addEventListener(
      'click',
      () =>
        openNightEditor(
          render
        )
    );


  render();
}


/* === Matching Night Editor === */

function openNightEditor(
  onSaved
) {

  const {
    A,
    B
  } = getT();


  const mode =
    getSolverMode(
      A,
      B
    );


  if (
    !A.length ||
    !B.length
  ) {

    alert(
      'Teilnehmer fehlen!'
    );

    return;
  }


  if (
    mode ===
    'UNSUPPORTED'
  ) {

    alert(
      'Diese Gruppengröße wird vom Solver derzeit nicht unterstützt.'
    );

    return;
  }


  const overlay =
    document.createElement(
      'div'
    );

  overlay.className =
    'night-editor-overlay';


  const sheet =
    document.createElement(
      'section'
    );

  sheet.className =
    'night-editor-sheet';

  sheet.setAttribute(
    'role',
    'dialog'
  );

  sheet.setAttribute(
    'aria-modal',
    'true'
  );

  sheet.setAttribute(
    'aria-label',
    'Matching Night anlegen'
  );


  const closeEditor =
    () => {

      document.body.classList.remove(
        'modal-open'
      );

      overlay.remove();
    };


  overlay.addEventListener(
    'click',
    event => {

      if (
        event.target === overlay
      ) {

        closeEditor();
      }
    }
  );


  const header =
    document.createElement(
      'div'
    );

  header.className =
    'night-editor-header';


  const headerCopy =
    document.createElement(
      'div'
    );


  const eyebrow =
    document.createElement(
      'span'
    );

  eyebrow.className =
    'night-editor-eyebrow';

  eyebrow.textContent =
    'CEREMONY SETUP';


  const title =
    document.createElement(
      'h2'
    );

  title.textContent =
    `Matching Night ${getNights().length + 1}`;


  const subline =
    document.createElement(
      'p'
    );

  subline.textContent =
    mode === 'ONE_TO_ONE'
      ? 'Ordne jeder Person aus Gruppe A genau eine Person aus Gruppe B zu.'
      : 'Ordne die Paare zu. Genau eine Person aus Gruppe A bleibt ohne Sitzpartner.';


  headerCopy.append(
    eyebrow,
    title,
    subline
  );


  const closeButton =
    document.createElement(
      'button'
    );

  closeButton.type =
    'button';

  closeButton.className =
    'night-editor-close';

  closeButton.textContent =
    '×';

  closeButton.setAttribute(
    'aria-label',
    'Matching Night schließen'
  );

  closeButton.addEventListener(
    'click',
    closeEditor
  );


  header.append(
    headerCopy,
    closeButton
  );


  const progress =
    document.createElement(
      'div'
    );

  progress.className =
    'night-editor-progress';


  const progressText =
    document.createElement(
      'span'
    );

  progressText.textContent =
    `0 von ${A.length} Paarungen gewählt`;


  const progressBar =
    document.createElement(
      'div'
    );

  progressBar.className =
    'night-editor-progress-track';


  const progressFill =
    document.createElement(
      'div'
    );

  progressFill.className =
    'night-editor-progress-fill';


  progressBar.appendChild(
    progressFill
  );

  progress.append(
    progressText,
    progressBar
  );


  const pairList =
    document.createElement(
      'div'
    );

  pairList.className =
    'night-editor-pair-list';


  const pairRows = [];


  const updateProgress =
    () => {

      const selected =
        pairRows.filter(
          row =>
            row.select.value
        ).length;


      progressText.textContent =
        `${selected} von ${A.length} Paarungen gewählt`;


      progressFill.style.width =
        `${Math.min(100, (selected / A.length) * 100)}%`;
    };


  const updateSelects =
    () => {

      const usedB =
        pairRows
          .map(
            row =>
              row.select.value
          )
          .filter(
            value =>
              value &&
              value !== 'keine'
          );


      pairRows.forEach(
        row => {

          const current =
            row.select.value;


          row.select
            .replaceChildren();


          row.select.add(
            new Option(
              '- auswählen -',
              ''
            )
          );


          if (
            mode ===
            'ONE_DOUBLE_B'
          ) {

            row.select.add(
              new Option(
                'Kein Partner',
                'keine'
              )
            );
          }


          B.forEach(
            nameB => {

              if (
                !usedB.includes(
                  nameB
                ) ||
                nameB === current
              ) {

                row.select.add(
                  new Option(
                    nameB,
                    nameB
                  )
                );
              }
            }
          );


          if (
            [
              ...row.select.options
            ]
              .some(
                option =>
                  option.value ===
                  current
              )
          ) {

            row.select.value =
              current;
          }


          row.element.classList.toggle(
            'selected',
            Boolean(
              row.select.value
            )
          );
        }
      );


      updateProgress();
    };


  A.forEach(
    (
      nameA,
      index
    ) => {

      const row =
        document.createElement(
          'div'
        );

      row.className =
        'night-editor-pair-row';


      const number =
        document.createElement(
          'span'
        );

      number.className =
        'night-editor-pair-number';

      number.textContent =
        String(index + 1);


      const label =
        document.createElement(
          'div'
        );

      label.className =
        'night-editor-person';


      const labelGroup =
        document.createElement(
          'span'
        );

      labelGroup.textContent =
        'GRUPPE A';


      const labelName =
        document.createElement(
          'strong'
        );

      labelName.textContent =
        nameA;


      label.append(
        labelGroup,
        labelName
      );


      const select =
        document.createElement(
          'select'
        );

      select.className =
        'night-editor-select';

      select.setAttribute(
        'aria-label',
        `Partner für ${nameA}`
      );


      select.addEventListener(
        'change',
        updateSelects
      );


      row.append(
        number,
        label,
        select
      );


      pairList.appendChild(
        row
      );


      pairRows.push({

        A:
          nameA,

        select,

        element:
          row
      });
    }
  );


  updateSelects();


  const lightSection =
    document.createElement(
      'div'
    );

  lightSection.className =
    'night-editor-light-section';


  const lightCopy =
    document.createElement(
      'div'
    );


  const lightEyebrow =
    document.createElement(
      'span'
    );

  lightEyebrow.className =
    'night-editor-eyebrow';

  lightEyebrow.textContent =
    'ERGEBNIS';


  const lightTitle =
    document.createElement(
      'strong'
    );

  lightTitle.textContent =
    'Wie viele Lichter gab es?';


  const lightHint =
    document.createElement(
      'span'
    );

  lightHint.className =
    'night-editor-light-hint';

  lightHint.textContent =
    'Wähle die offiziell angezeigte Anzahl.';


  lightCopy.append(
    lightEyebrow,
    lightTitle,
    lightHint
  );


  const lightSelect =
    document.createElement(
      'select'
    );

  lightSelect.className =
    'night-editor-light-select';


  for (
    let i = 0;
    i <= Math.min(
      A.length,
      B.length
    );
    i++
  ) {

    lightSelect.add(
      new Option(
        i === 1
          ? '1 Licht'
          : `${i} Lichter`,
        String(i)
      )
    );
  }


  lightSection.append(
    lightCopy,
    lightSelect
  );


  const footer =
    document.createElement(
      'div'
    );

  footer.className =
    'night-editor-footer';


  const cancelButton =
    document.createElement(
      'button'
    );

  cancelButton.type =
    'button';

  cancelButton.className =
    'night-editor-cancel';

  cancelButton.textContent =
    'Abbrechen';

  cancelButton.addEventListener(
    'click',
    closeEditor
  );


  const saveButton =
    document.createElement(
      'button'
    );

  saveButton.type =
    'button';

  saveButton.className =
    'night-editor-save';

  saveButton.textContent =
    'Night speichern';


  saveButton
    .addEventListener(
      'click',
      () => {

        const pairs =
          pairRows.map(
            row => ({

              A:
                row.A,

              B:
                row.select.value
            })
          );


        const chosenB =
          pairs
            .map(
              pair =>
                pair.B
            )
            .filter(
              value =>
                value &&
                value !== 'keine'
            );


        const uniqueB =
          new Set(
            chosenB
          );


        if (
          mode ===
          'ONE_TO_ONE'
        ) {

          if (
            pairs.some(
              pair =>
                !pair.B
            )
          ) {

            alert(
              'Bitte für jede A-Person einen Partner auswählen.'
            );

            return;
          }


          if (
            uniqueB.size !==
              B.length ||
            chosenB.length !==
              B.length
          ) {

            alert(
              'Jede B-Person darf in der Matching Night nur einmal vorkommen.'
            );

            return;
          }
        }


        if (
          mode ===
          'ONE_DOUBLE_B'
        ) {

          if (
            pairs.some(
              pair =>
                !pair.B
            )
          ) {

            alert(
              'Bitte für jede A-Person einen Partner oder „Kein Partner“ auswählen.'
            );

            return;
          }


          const noPartnerCount =
            pairs.filter(
              pair =>
                pair.B ===
                'keine'
            ).length;


          if (
            noPartnerCount !==
            1
          ) {

            alert(
              'Bei dieser Gruppengröße muss genau eine A-Person ohne Sitzpartner bleiben.'
            );

            return;
          }


          if (
            uniqueB.size !==
              B.length ||
            chosenB.length !==
              B.length
          ) {

            alert(
              'Alle B-Personen müssen genau einmal in der Matching Night vorkommen.'
            );

            return;
          }
        }


        const nights =
          getNights();


        nights.push({

          pairs,

          lights:
            Number(
              lightSelect.value
            )
        });


        saveNights(
          nights
        );


        closeEditor();


        onSaved();
      }
    );


  footer.append(
    cancelButton,
    saveButton
  );


  sheet.append(
    header,
    progress,
    pairList,
    lightSection,
    footer
  );


  overlay.appendChild(
    sheet
  );


  document.body.classList.add(
    'modal-open'
  );


  document.body.appendChild(
    overlay
  );
}


/* === Backup === */

function initBackup() {

  const exportButton =
    document.getElementById(
      'exportBtn'
    );

  const importButton =
    document.getElementById(
      'importBtn'
    );

  const importFile =
    document.getElementById(
      'importFile'
    );

  const resetButton =
    document.getElementById(
      'resetBtn'
    );


  exportButton
    ?.addEventListener(
      'click',
      () => {

        const data = {

          version:
            document
              .querySelector(
                'meta[name="app-version"]'
              )
              ?.content ||
            null,

          teilnehmer:
            getT(),

          matchbox:
            getMatchbox(),

          nights:
            getNights()
        };


        const blob =
          new Blob(
            [
              JSON.stringify(
                data,
                null,
                2
              )
            ],
            {
              type:
                'application/json'
            }
          );


        const url =
          URL.createObjectURL(
            blob
          );


        const link =
          document.createElement(
            'a'
          );


        link.href =
          url;


        link.download =
          'AYTO_Backup.json';


        link.click();


        setTimeout(
          () =>
            URL.revokeObjectURL(
              url
            ),
          1000
        );
      }
    );


  importButton
    ?.addEventListener(
      'click',
      () =>
        importFile?.click()
    );


  importFile
    ?.addEventListener(
      'change',
      event => {

        const file =
          event.target.files?.[0];


        if (!file) {
          return;
        }


        const reader =
          new FileReader();


        reader.onload =
          loadEvent => {

            try {

              const imported =
                JSON.parse(
                  loadEvent
                    .target
                    .result
                );


              if (
                !imported ||
                typeof imported !==
                  'object'
              ) {

                throw new Error(
                  'Ungültiges Backup'
                );
              }


              if (
                !imported.teilnehmer ||
                !Array.isArray(
                  imported
                    .teilnehmer
                    .A
                ) ||
                !Array.isArray(
                  imported
                    .teilnehmer
                    .B
                )
              ) {

                throw new Error(
                  'Teilnehmerdaten fehlen'
                );
              }


              localStorage.setItem(
                STORAGE_KEY_T,
                JSON.stringify(
                  imported
                    .teilnehmer
                )
              );


              localStorage.setItem(
                STORAGE_KEY_MB,
                JSON.stringify(
                  Array.isArray(
                    imported
                      .matchbox
                  )
                    ? imported
                        .matchbox
                    : []
                )
              );


              localStorage.setItem(
                STORAGE_KEY_NIGHTS,
                JSON.stringify(
                  Array.isArray(
                    imported
                      .nights
                  )
                    ? imported
                        .nights
                    : []
                )
              );


              location.reload();

            } catch (err) {

              alert(
                `Import fehlgeschlagen: ${err.message}`
              );
            }
          };


        reader.readAsText(
          file
        );
      }
    );


  resetButton
    ?.addEventListener(
      'click',
      () => {

        if (
          !confirm(
            'Alle AYTO-Daten auf diesem Gerät löschen?'
          )
        ) {

          return;
        }


        localStorage.removeItem(
          STORAGE_KEY_T
        );


        localStorage.removeItem(
          STORAGE_KEY_MB
        );


        localStorage.removeItem(
          STORAGE_KEY_NIGHTS
        );


        virtualMatches =
          [];


        lastResults =
          null;


        location.reload();
      }
    );
}


/* === Orakel === */

function renderOrakel() {

  const orakelBox =
    document.getElementById(
      'orakelBox'
    );


  if (!orakelBox) {
    return;
  }


  orakelBox.replaceChildren();


  if (
    !lastResults ||
    lastResults.total ===
      0n
  ) {

    const card =
      document.createElement(
        'div'
      );

    card.className =
      'card stack oracle-placeholder';


    const icon =
      document.createElement(
        'div'
      );

    icon.className =
      'oracle-icon';

    icon.textContent =
      '🔮';


    const title =
      document.createElement(
        'h3'
      );

    title.textContent =
      'Das Orakel schläft noch...';


    const text =
      document.createElement(
        'p'
      );

    text.className =
      'small muted';

    text.textContent =
      'Berechne zuerst die Ergebnisse, damit die Daten analysiert werden können.';


    card.append(
      icon,
      title,
      text
    );


    orakelBox.appendChild(
      card
    );


    return;
  }


  const {
    total,
    counts,
    A,
    B
  } = lastResults;


  const pairs =
    [];


  A.forEach(
    (
      nameA,
      i
    ) => {

      B.forEach(
        (
          nameB,
          j
        ) => {

          const count =
            counts[i][j];


          const prob =
            total > 0n

              ? Number(
                  (
                    count *
                    10000n
                  ) /
                  total
                ) /
                100

              : 0;


          pairs.push({

            nameA,
            nameB,
            prob,
            count
          });
        }
      );
    }
  );


  const sortedPositive =
    pairs
      .filter(
        pair =>
          pair.count >
          0n
      )
      .sort(
        (
          a,
          b
        ) =>
          b.prob -
          a.prob
      );


  const topPairs =
    sortedPositive.slice(
      0,
      5
    );


  const deadPairs =
    pairs.filter(
      pair =>
        pair.count ===
        0n
    );


  const confirmedPairs =
    pairs.filter(
      pair =>
        pair.prob >=
        100
    );


  const formatTotal =
    value =>
      value
        .toString()
        .replace(
          /\B(?=(\d{3})+(?!\d))/g,
          '.'
        );


  const stats =
    document.createElement(
      'div'
    );

  stats.className =
    'oracle-stats-grid';


  const statsData = [
    {
      label:
        'Mögliche Lösungen',
      value:
        formatTotal(total),
      tone:
        'blue'
    },
    {
      label:
        'Sichere Matches',
      value:
        String(
          confirmedPairs.length
        ),
      tone:
        'gold'
    },
    {
      label:
        'Ausgeschlossen',
      value:
        String(
          deadPairs.length
        ),
      tone:
        'red'
    }
  ];


  statsData.forEach(
    item => {

      const card =
        document.createElement(
          'div'
        );

      card.className =
        `oracle-stat-card ${item.tone}`;


      const value =
        document.createElement(
          'strong'
        );

      value.textContent =
        item.value;


      const label =
        document.createElement(
          'span'
        );

      label.textContent =
        item.label;


      card.append(
        value,
        label
      );


      stats.appendChild(
        card
      );
    }
  );


  orakelBox.appendChild(
    stats
  );


  if (
    topPairs.length
  ) {

    const best =
      topPairs[0];


    const hero =
      document.createElement(
        'div'
      );

    hero.className =
      best.prob >= 100
        ? 'oracle-best-card perfect'
        : 'oracle-best-card';


    const heroCopy =
      document.createElement(
        'div'
      );

    heroCopy.className =
      'oracle-best-copy';


    const heroLabel =
      document.createElement(
        'span'
      );

    heroLabel.className =
      'oracle-best-label';

    heroLabel.textContent =
      best.prob >= 100
        ? 'SICHERES PERFECT MATCH'
        : 'STÄRKSTE VERBINDUNG';


    const heroNames =
      document.createElement(
        'strong'
      );

    heroNames.textContent =
      `${best.nameA} × ${best.nameB}`;


    const heroText =
      document.createElement(
        'span'
      );

    heroText.textContent =
      best.prob >= 100
        ? 'Diese Paarung ist durch die aktuellen Daten eindeutig.'
        : 'Aktuell die wahrscheinlichste Paarung im Solver.';


    heroCopy.append(
      heroLabel,
      heroNames,
      heroText
    );


    const heroRing =
      document.createElement(
        'div'
      );

    heroRing.className =
      'oracle-prob-ring';

    heroRing.style.setProperty(
      '--oracle-prob',
      `${Math.max(0, Math.min(100, best.prob)) * 3.6}deg`
    );


    const heroRingInner =
      document.createElement(
        'div'
      );


    const heroPercent =
      document.createElement(
        'strong'
      );

    heroPercent.textContent =
      best.prob >= 100
        ? '100%'
        : `${best.prob.toFixed(1)}%`;


    const heroPercentLabel =
      document.createElement(
        'span'
      );

    heroPercentLabel.textContent =
      'Chance';


    heroRingInner.append(
      heroPercent,
      heroPercentLabel
    );

    heroRing.appendChild(
      heroRingInner
    );


    hero.append(
      heroCopy,
      heroRing
    );


    orakelBox.appendChild(
      hero
    );
  }


  const hotCard =
    document.createElement(
      'div'
    );

  hotCard.className =
    'oracle-ranking-card';


  const hotHead =
    document.createElement(
      'div'
    );

  hotHead.className =
    'oracle-section-head';


  const hotTitle =
    document.createElement(
      'strong'
    );

  hotTitle.textContent =
    'Top 5 Matches';


  const hotSub =
    document.createElement(
      'span'
    );

  hotSub.textContent =
    'Nach aktueller Wahrscheinlichkeit';


  hotHead.append(
    hotTitle,
    hotSub
  );


  hotCard.appendChild(
    hotHead
  );


  topPairs.forEach(
    (
      pair,
      index
    ) => {

      const row =
        document.createElement(
          'div'
        );

      row.className =
        pair.prob >= 100
          ? 'oracle-rank-row perfect'
          : 'oracle-rank-row';


      const rank =
        document.createElement(
          'span'
        );

      rank.className =
        'oracle-rank-number';

      rank.textContent =
        String(index + 1);


      const content =
        document.createElement(
          'div'
        );

      content.className =
        'oracle-rank-content';


      const names =
        document.createElement(
          'strong'
        );

      names.textContent =
        `${pair.nameA} × ${pair.nameB}`;


      const track =
        document.createElement(
          'div'
        );

      track.className =
        'oracle-prob-track';


      const fill =
        document.createElement(
          'span'
        );

      fill.style.width =
        `${Math.max(2, Math.min(100, pair.prob))}%`;


      track.appendChild(
        fill
      );


      content.append(
        names,
        track
      );


      const percent =
        document.createElement(
          'strong'
        );

      percent.className =
        'oracle-rank-percent';

      percent.textContent =
        pair.prob >= 100
          ? 'MATCH'
          : `${pair.prob.toFixed(1)}%`;


      row.append(
        rank,
        content,
        percent
      );


      hotCard.appendChild(
        row
      );
    }
  );


  orakelBox.appendChild(
    hotCard
  );


  const coldCard =
    document.createElement(
      'div'
    );

  coldCard.className =
    'oracle-cold-card';


  const coldHead =
    document.createElement(
      'div'
    );

  coldHead.className =
    'oracle-section-head';


  const coldTitle =
    document.createElement(
      'strong'
    );

  coldTitle.textContent =
    'Ausgeschlossene Paare';


  const coldSub =
    document.createElement(
      'span'
    );

  coldSub.textContent =
    deadPairs.length
      ? `${deadPairs.length} Paarungen liegen bei 0 %`
      : 'Aktuell ist noch kein Paar vollständig ausgeschlossen.';


  coldHead.append(
    coldTitle,
    coldSub
  );


  const coldGrid =
    document.createElement(
      'div'
    );

  coldGrid.className =
    'cold-grid';


  deadPairs
    .slice(
      0,
      18
    )
    .forEach(
      pair => {

        const item =
          document.createElement(
            'div'
          );

        item.className =
          'cold-pair';

        item.textContent =
          `${pair.nameA} × ${pair.nameB}`;


        coldGrid.appendChild(
          item
        );
      }
    );


  coldCard.append(
    coldHead,
    coldGrid
  );


  orakelBox.appendChild(
    coldCard
  );
}


/* === Solver / Simulation === */

function toggleVirtualMatch(
  nameA,
  nameB
) {

  const index =
    virtualMatches.findIndex(
      match =>
        match.A === nameA &&
        match.B === nameB
    );


  if (
    index >
    -1
  ) {

    virtualMatches.splice(
      index,
      1
    );

  } else {

    virtualMatches =
      virtualMatches.filter(
        match =>
          match.A !==
          nameA
      );


    virtualMatches.push({

      A:
        nameA,

      B:
        nameB,

      type:
        'PM'
    });
  }


  document
    .getElementById(
      'solveBtn'
    )
    ?.click();
}


/* === Solver initialisieren === */

function initSolver() {

  const solveButton =
    document.getElementById(
      'solveBtn'
    );


  const summaryBox =
    document.getElementById(
      'summary'
    );


  const matrixBox =
    document.getElementById(
      'matrix'
    );


  const status =
    document.getElementById(
      'status'
    );


  if (
    !solveButton ||
    !summaryBox ||
    !matrixBox
  ) {

    return;
  }


  const workerCode = `

    self.onmessage = function(e) {

      const {
        A,
        B,
        M,
        Nraw,
        startBIdx,
        mode
      } = e.data;


      const idxA =
        Object.fromEntries(
          A.map(
            (name, i) =>
              [
                name,
                i
              ]
          )
        );


      const idxB =
        Object.fromEntries(
          B.map(
            (name, i) =>
              [
                name,
                i
              ]
          )
        );


      const m =
        A.length;


      const n =
        B.length;


      const forced =
        Array(m)
          .fill(-1);


      const forbidden =
        Array.from(
          {
            length:
              m
          },
          () =>
            new Set()
        );


      M.forEach(
        entry => {

          if (
            !(entry.A in idxA) ||
            !(entry.B in idxB)
          ) {

            return;
          }


          const a =
            idxA[
              entry.A
            ];


          const b =
            idxB[
              entry.B
            ];


          if (
            entry.type ===
            'PM'
          ) {

            forced[a] =
              b;

          } else if (
            entry.type ===
            'NM'
          ) {

            forbidden[a]
              .add(b);
          }
        }
      );


      const nights =
        (Nraw || [])
          .map(
            night => ({

              pairs:
                (night.pairs || [])
                  .map(
                    pair => ({

                      aIdx:
                        pair.A in idxA
                          ? idxA[pair.A]
                          : -1,

                      bIdx:
                        pair.B === 'keine'
                          ? -1
                          : (
                              pair.B in idxB
                                ? idxB[pair.B]
                                : -2
                            )
                    })
                  )
                  .filter(
                    pair =>
                      pair.aIdx !==
                      -1
                  ),

              beams:
                Number(
                  night.lights
                )
            })
          );


      let total =
        0n;


      const counts =
        Array.from(
          {
            length:
              m
          },

          () =>
            Array(n)
              .fill(0n)
        );


      const assign =
        Array(m)
          .fill(-1);


      const useCountB =
        Array(n)
          .fill(0);


      let doubleBUsed =
        false;


      function nightsStillPossible(
        aIdx
      ) {

        for (
          const night
          of nights
        ) {

          let hits =
            0;


          let undecided =
            0;


          for (
            const pair
            of night.pairs
          ) {

            if (
              pair.aIdx <
              aIdx
            ) {

              if (
                assign[
                  pair.aIdx
                ] ===
                pair.bIdx
              ) {

                hits++;
              }

            } else {

              undecided++;
            }
          }


          if (
            hits >
            night.beams
          ) {

            return false;
          }


          if (
            hits +
            undecided <
            night.beams
          ) {

            return false;
          }
        }


        return true;
      }


      function dfs(
        aIdx
      ) {

        if (
          !nightsStillPossible(
            aIdx
          )
        ) {

          return;
        }


        if (
          aIdx ===
          m
        ) {

          if (
            mode ===
              'ONE_DOUBLE_B' &&
            !doubleBUsed
          ) {

            return;
          }


          if (
            mode ===
              'ONE_TO_ONE' &&
            useCountB.some(
              count =>
                count !==
                1
            )
          ) {

            return;
          }


          total++;


          for (
            let i = 0;
            i < m;
            i++
          ) {

            if (
              assign[i] >=
              0
            ) {

              counts[i][
                assign[i]
              ]++;
            }
          }


          return;
        }


        const forceB =
          forced[aIdx];


        const start =
          aIdx === 0
            ? startBIdx
            : 0;


        const end =
          aIdx === 0
            ? startBIdx
            : n - 1;


        for (
          let b = start;
          b <= end;
          b++
        ) {

          if (
            forbidden[aIdx]
              .has(b)
          ) {

            continue;
          }


          if (
            forceB !== -1 &&
            forceB !== b
          ) {

            continue;
          }


          /* 10x10 */

          if (
            mode ===
            'ONE_TO_ONE'
          ) {

            if (
              useCountB[b] >=
              1
            ) {

              continue;
            }


            useCountB[b]++;


            assign[aIdx] =
              b;


            dfs(
              aIdx + 1
            );


            assign[aIdx] =
              -1;


            useCountB[b]--;


            continue;
          }


          /* 11x10 Doppelmann-Modus */

          if (
            mode ===
            'ONE_DOUBLE_B'
          ) {

            const isSecondUse =
              useCountB[b] ===
              1;


            if (
              useCountB[b] >=
              2
            ) {

              continue;
            }


            if (
              isSecondUse &&
              doubleBUsed
            ) {

              continue;
            }


            const previousDoubleState =
              doubleBUsed;


            if (
              isSecondUse
            ) {

              doubleBUsed =
                true;
            }


            useCountB[b]++;


            assign[aIdx] =
              b;


            dfs(
              aIdx + 1
            );


            assign[aIdx] =
              -1;


            useCountB[b]--;


            doubleBUsed =
              previousDoubleState;
          }
        }
      }


      dfs(0);


      self.postMessage({

        total:
          total.toString(),

        counts:
          counts.map(
            row =>
              row.map(
                value =>
                  value.toString()
              )
          )
      });
    };
  `;


  const blob =
    new Blob(
      [
        workerCode
      ],
      {
        type:
          'application/javascript'
      }
    );


  const workerUrl =
    URL.createObjectURL(
      blob
    );


  solveButton
    .addEventListener(
      'click',
      () => {

        const {
          A,
          B
        } = getT();


        const mode =
          getSolverMode(
            A,
            B
          );


        if (
          A.length < 2 ||
          B.length < 2
        ) {

          alert(
            'Daten unvollständig!'
          );

          return;
        }


        if (
          mode ===
          'UNSUPPORTED'
        ) {

          alert(
            'Unterstützt werden gleich große Gruppen oder Gruppe A mit genau einer Person mehr als Gruppe B.'
          );

          return;
        }


        showOverlay();


        if (status) {

          status.textContent =
            'Berechnet...';
        }


        solveButton.disabled =
          true;


        const bar =
          document.querySelector(
            '#overlay .bar'
          );


        const statusText =
          document.querySelector(
            '#overlay .status-text'
          );


        const startTime =
          Date.now();


        const minimumDuration =
          3000;


        const animation =
          setInterval(
            () => {

              const elapsed =
                Date.now() -
                startTime;


              const progress =
                Math.min(
                  Math.round(
                    (
                      elapsed /
                      minimumDuration
                    ) *
                    100
                  ),

                  99
                );


              if (bar) {

                bar.style.width =
                  `${progress}%`;
              }


              if (
                statusText
              ) {

                statusText.textContent =
                  `Berechnung läuft... (${progress}%)`;
              }
            },

            30
          );


        const numWorkers =
          B.length;


        let completed =
          0;


        let failed =
          false;


        let finalTotal =
          0n;


        const finalCounts =
          Array.from(
            {
              length:
                A.length
            },

            () =>
              Array(
                B.length
              )
                .fill(0n)
          );


        const finish =
          () => {

            const wait =
              Math.max(
                0,

                minimumDuration -
                (
                  Date.now() -
                  startTime
                )
              );


            setTimeout(
              () => {

                clearInterval(
                  animation
                );


                if (bar) {

                  bar.style.width =
                    '100%';
                }


                if (
                  statusText
                ) {

                  statusText.textContent =
                    'Berechnung läuft... (100%)';
                }


                setTimeout(
                  () => {

                    if (
                      !failed
                    ) {

                      renderResults(
                        finalTotal,
                        finalCounts,
                        A,
                        B,
                        summaryBox,
                        matrixBox
                      );
                    }


                    hideOverlay();


                    solveButton.disabled =
                      false;


                    if (
                      status
                    ) {

                      status.textContent =
                        failed
                          ? 'Fehler'
                          : 'Bereit';
                    }

                  },

                  250
                );

              },

              wait
            );
          };


        for (
          let i = 0;
          i < numWorkers;
          i++
        ) {

          const worker =
            new Worker(
              workerUrl
            );


          worker.postMessage({

            A,

            B,

            startBIdx:
              i,

            mode,

            M: [
              ...getMatchbox(),
              ...virtualMatches
            ],

            Nraw:
              getNights()
          });


          worker
            .addEventListener(
              'message',
              event => {

                finalTotal +=
                  BigInt(
                    event
                      .data
                      .total
                  );


                event
                  .data
                  .counts
                  .forEach(
                    (
                      row,
                      rowIndex
                    ) => {

                      row.forEach(
                        (
                          value,
                          colIndex
                        ) => {

                          finalCounts[
                            rowIndex
                          ][
                            colIndex
                          ] +=
                            BigInt(
                              value
                            );
                        }
                      );
                    }
                  );


                completed++;


                worker.terminate();


                if (
                  completed ===
                  numWorkers
                ) {

                  finish();
                }
              }
            );


          worker
            .addEventListener(
              'error',
              event => {

                console.error(
                  'Solver Worker Fehler:',
                  event.message
                );


                failed =
                  true;


                completed++;


                worker.terminate();


                if (
                  completed ===
                  numWorkers
                ) {

                  finish();
                }
              }
            );
        }
      }
    );
}


/* === Ergebnis-Matrix === */

function renderResults(
  total,
  counts,
  A,
  B,
  summaryBox,
  matrixBox
) {

  lastResults = {

    total,

    counts,

    A:
      [...A],

    B:
      [...B]
  };


  summaryBox
    .replaceChildren();


  const formatTotal =
    value =>
      value
        .toString()
        .replace(
          /\B(?=(\d{3})+(?!\d))/g,
          '.'
        );


  const overview =
    document.createElement(
      'div'
    );

  overview.className =
    total === 0n
      ? 'result-overview impossible'
      : 'result-overview';


  const overviewCopy =
    document.createElement(
      'div'
    );

  overviewCopy.className =
    'result-overview-copy';


  const overviewLabel =
    document.createElement(
      'span'
    );

  overviewLabel.textContent =
    'MÖGLICHE LÖSUNGEN';


  const overviewNumber =
    document.createElement(
      'strong'
    );

  overviewNumber.textContent =
    total === 0n
      ? '0'
      : formatTotal(total);


  const overviewText =
    document.createElement(
      'span'
    );

  overviewText.textContent =
    total === 0n
      ? 'Aktuelle Eingaben oder Simulation lassen keine Lösung zu.'
      : total === 1n
        ? 'Der Solver hat genau eine mögliche Gesamtlösung gefunden.'
        : 'Diese Gesamtlösungen passen aktuell zu allen eingetragenen Daten.';


  overviewCopy.append(
    overviewLabel,
    overviewNumber,
    overviewText
  );


  const state =
    document.createElement(
      'span'
    );

  state.className =
    total === 0n
      ? 'result-state danger'
      : total === 1n
        ? 'result-state success'
        : 'result-state';

  state.textContent =
    total === 0n
      ? 'Widerspruch'
      : total === 1n
        ? 'Eindeutig'
        : 'Offen';


  overview.append(
    overviewCopy,
    state
  );


  summaryBox.appendChild(
    overview
  );


  if (
    virtualMatches.length
  ) {

    const simulation =
      document.createElement(
        'div'
      );

    simulation.className =
      'simulation-panel';


    const simulationHead =
      document.createElement(
        'div'
      );

    simulationHead.className =
      'simulation-head';


    const simulationTitle =
      document.createElement(
        'div'
      );


    const simulationBadge =
      document.createElement(
        'span'
      );

    simulationBadge.className =
      'simulation-badge';

    simulationBadge.textContent =
      'TESTMODUS';


    const simulationCopy =
      document.createElement(
        'span'
      );

    simulationCopy.textContent =
      'Virtuell angenommene Perfect Matches';


    simulationTitle.append(
      simulationBadge,
      simulationCopy
    );


    const stopButton =
      document.createElement(
        'button'
      );

    stopButton.type =
      'button';

    stopButton.className =
      'simulation-stop';

    stopButton.textContent =
      'Beenden';


    stopButton
      .addEventListener(
        'click',
        () => {

          virtualMatches =
            [];


          document
            .getElementById(
              'solveBtn'
            )
            ?.click();
        }
      );


    simulationHead.append(
      simulationTitle,
      stopButton
    );


    const simulationPairs =
      document.createElement(
        'div'
      );

    simulationPairs.className =
      'simulation-pairs';


    virtualMatches.forEach(
      match => {

        const pair =
          document.createElement(
            'span'
          );

        pair.textContent =
          `${match.A} × ${match.B}`;

        simulationPairs.appendChild(
          pair
        );
      }
    );


    simulation.append(
      simulationHead,
      simulationPairs
    );


    summaryBox.appendChild(
      simulation
    );
  }


  if (
    total > 0n
  ) {

    const matrixHint =
      document.createElement(
        'div'
      );

    matrixHint.className =
      'matrix-hint';


    const hintIcon =
      document.createElement(
        'span'
      );

    hintIcon.textContent =
      '✦';


    const hintText =
      document.createElement(
        'span'
      );

    hintText.textContent =
      'Tippe auf eine Prozentzahl, um dieses Paar virtuell als Perfect Match zu testen.';


    matrixHint.append(
      hintIcon,
      hintText
    );


    summaryBox.appendChild(
      matrixHint
    );
  }


  const container =
    document.createElement(
      'div'
    );

  container.className =
    'ayto-table-container';


  const table =
    document.createElement(
      'table'
    );

  table.className =
    'ayto-table';


  const headRow =
    document.createElement(
      'tr'
    );


  const corner =
    document.createElement(
      'th'
    );

  corner.className =
    'matrix-corner';

  corner.textContent =
    'A / B';


  headRow.appendChild(
    corner
  );


  B.forEach(
    nameB => {

      const th =
        document.createElement(
          'th'
        );

      th.textContent =
        nameB;


      headRow.appendChild(
        th
      );
    }
  );


  table.appendChild(
    headRow
  );


  A.forEach(
    (
      nameA,
      i
    ) => {

      const row =
        document.createElement(
          'tr'
        );


      const nameCell =
        document.createElement(
          'td'
        );

      nameCell.className =
        'a-name';

      nameCell.textContent =
        nameA;


      row.appendChild(
        nameCell
      );


      B.forEach(
        (
          nameB,
          j
        ) => {

          const cell =
            document.createElement(
              'td'
            );


          const count =
            counts[i][j];


          const probability =
            total > 0n

              ? Number(
                  (
                    count *
                    10000n
                  ) /
                  total
                ) /
                100

              : 0;


          const isVirtual =
            virtualMatches.some(
              match =>
                match.A ===
                  nameA &&
                match.B ===
                  nameB
            );


          cell.setAttribute(
            'aria-label',
            `${nameA} mit ${nameB}: ${probability.toFixed(2)} Prozent`
          );


          if (
            isVirtual
          ) {

            cell.className =
              'matrix-cell matrix-fixed matrix-cell-clickable';

            cell.textContent =
              'FIXED';


            cell.addEventListener(
              'click',
              () =>
                toggleVirtualMatch(
                  nameA,
                  nameB
                )
            );

          } else if (
            probability >=
            100
          ) {

            cell.className =
              'matrix-cell matrix-match matrix-cell-clickable';

            cell.textContent =
              'MATCH';


            cell.addEventListener(
              'click',
              () =>
                toggleVirtualMatch(
                  nameA,
                  nameB
                )
            );

          } else if (
            count ===
            0n
          ) {

            cell.className =
              'matrix-cell no-match';

            cell.textContent =
              '0%';

          } else {

            const hue =
              250 -
              (
                probability *
                2.15
              );


            cell.className =
              'matrix-cell matrix-prob matrix-cell-clickable';

            cell.style.setProperty(
              '--cell-hue',
              String(
                Math.max(
                  25,
                  hue
                )
              )
            );

            cell.style.setProperty(
              '--cell-strength',
              String(
                Math.max(
                  .12,
                  Math.min(
                    .72,
                    probability /
                      100
                  )
                )
              )
            );

            cell.textContent =
              `${probability.toFixed(2)}%`;


            cell.addEventListener(
              'click',
              () =>
                toggleVirtualMatch(
                  nameA,
                  nameB
                )
            );
          }


          row.appendChild(
            cell
          );
        }
      );


      table.appendChild(
        row
      );
    }
  );


  container.appendChild(
    table
  );


  matrixBox.replaceChildren(
    container
  );


  matrixBox.style.display =
    'block';
}
/* =========================================================
   UI V2 - STEP 3
   Matchbox-Strategie + PM/NM-Simulation
   ========================================================= */

function formatAYTOBigInt(value) {
  return BigInt(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}


function getPairSnapshot(nameA, nameB) {

  if (
    !lastResults ||
    lastResults.total <= 0n
  ) {
    return null;
  }

  const aIndex =
    lastResults.A.indexOf(nameA);

  const bIndex =
    lastResults.B.indexOf(nameB);

  if (
    aIndex < 0 ||
    bIndex < 0
  ) {
    return null;
  }

  const total =
    lastResults.total;

  const pmCount =
    lastResults.counts[aIndex][bIndex];

  const nmCount =
    total - pmCount;

  const pmProbability =
    Number(
      (pmCount * 10000n) /
      total
    ) / 100;

  return {
    total,
    pmCount,
    nmCount,
    pmProbability,
    nmProbability:
      100 - pmProbability
  };
}


function getBestMatchboxTest() {

  if (
    !lastResults ||
    lastResults.total <= 1n
  ) {
    return null;
  }

  const blocked =
    new Set(
      getMatchbox()
        .filter(
          entry =>
            entry?.A &&
            entry?.B
        )
        .map(
          entry =>
            `${entry.A}\u0000${entry.B}`
        )
    );


  virtualMatches
    .filter(
      entry =>
        entry?.A &&
        entry?.B
    )
    .forEach(
      entry =>
        blocked.add(
          `${entry.A}\u0000${entry.B}`
        )
    );


  const total =
    lastResults.total;

  const totalSquared =
    total * total;

  let best =
    null;


  lastResults.A.forEach(
    (
      nameA,
      i
    ) => {

      lastResults.B.forEach(
        (
          nameB,
          j
        ) => {

          if (
            blocked.has(
              `${nameA}\u0000${nameB}`
            )
          ) {
            return;
          }


          const pmCount =
            lastResults.counts[i][j];


          if (
            pmCount <= 0n ||
            pmCount >= total
          ) {
            return;
          }


          const nmCount =
            total - pmCount;


          const expectedRemainingNumerator =
            (pmCount * pmCount) +
            (nmCount * nmCount);


          const expectedReductionNumerator =
            totalSquared -
            expectedRemainingNumerator;


          const expectedReduction =
            Number(
              (
                expectedReductionNumerator *
                10000n
              ) /
              totalSquared
            ) / 100;


          const pmProbability =
            Number(
              (
                pmCount *
                10000n
              ) /
              total
            ) / 100;


          const candidate = {

            nameA,
            nameB,

            pmCount,
            nmCount,

            pmProbability,

            nmProbability:
              100 - pmProbability,

            expectedReduction,

            expectedReductionNumerator
          };


          if (
            !best ||
            candidate.expectedReductionNumerator >
              best.expectedReductionNumerator
          ) {

            best =
              candidate;
          }
        }
      );
    }
  );


  return best;
}


function applyVirtualMatch(
  nameA,
  nameB,
  type
) {

  const {
    A,
    B
  } = getT();


  const mode =
    getSolverMode(
      A,
      B
    );


  virtualMatches =
    virtualMatches.filter(
      match =>
        !(
          match.A === nameA &&
          match.B === nameB
        )
    );


  if (
    type === 'PM'
  ) {

    virtualMatches =
      virtualMatches.filter(
        match =>
          match.A !== nameA
      );


    if (
      mode ===
      'ONE_TO_ONE'
    ) {

      virtualMatches =
        virtualMatches.filter(
          match =>
            !(
              match.type === 'PM' &&
              match.B === nameB
            )
        );
    }
  }


  virtualMatches.push({

    A:
      nameA,

    B:
      nameB,

    type
  });


  document
    .getElementById(
      'solveBtn'
    )
    ?.click();
}


function removeVirtualMatch(
  nameA,
  nameB
) {

  virtualMatches =
    virtualMatches.filter(
      match =>
        !(
          match.A === nameA &&
          match.B === nameB
        )
    );


  document
    .getElementById(
      'solveBtn'
    )
    ?.click();
}


function openVirtualTestMenu(
  nameA,
  nameB
) {

  const snapshot =
    getPairSnapshot(
      nameA,
      nameB
    );


  if (!snapshot) {
    return;
  }


  const existing =
    virtualMatches.find(
      match =>
        match.A === nameA &&
        match.B === nameB
    );


  const overlay =
    document.createElement(
      'div'
    );

  overlay.className =
    'virtual-test-overlay';


  const sheet =
    document.createElement(
      'section'
    );

  sheet.className =
    'virtual-test-sheet';

  sheet.setAttribute(
    'role',
    'dialog'
  );

  sheet.setAttribute(
    'aria-modal',
    'true'
  );


  const close =
    () => {

      document.body.classList.remove(
        'modal-open'
      );

      overlay.remove();
    };


  overlay.addEventListener(
    'click',
    event => {

      if (
        event.target === overlay
      ) {

        close();
      }
    }
  );


  const handle =
    document.createElement(
      'div'
    );

  handle.className =
    'virtual-test-handle';


  const eyebrow =
    document.createElement(
      'span'
    );

  eyebrow.className =
    'virtual-test-eyebrow';

  eyebrow.textContent =
    'MATCHBOX-SIMULATION';


  const title =
    document.createElement(
      'h2'
    );

  title.textContent =
    `${nameA} × ${nameB}`;


  const probability =
    document.createElement(
      'p'
    );

  probability.textContent =
    existing

      ? `Aktuell simuliert: ${
          existing.type === 'PM'
            ? 'Perfect Match'
            : 'No Match'
        }`

      : `Aktuelle PM-Chance: ${
          snapshot.pmProbability.toFixed(2)
        } %`;


  const actionGrid =
    document.createElement(
      'div'
    );

  actionGrid.className =
    'virtual-test-actions';


  const pmButton =
    document.createElement(
      'button'
    );

  pmButton.type =
    'button';

  pmButton.className =
    existing?.type === 'PM'

      ? 'virtual-test-button pm active'

      : 'virtual-test-button pm';

  pmButton.innerHTML =
    '<span>✓</span><strong>Perfect Match simulieren</strong><small>Paar als sicher annehmen</small>';


  const nmButton =
    document.createElement(
      'button'
    );

  nmButton.type =
    'button';

  nmButton.className =
    existing?.type === 'NM'

      ? 'virtual-test-button nm active'

      : 'virtual-test-button nm';

  nmButton.innerHTML =
    '<span>×</span><strong>No Match simulieren</strong><small>Paar ausschließen</small>';


  pmButton.addEventListener(
    'click',
    () => {

      close();

      applyVirtualMatch(
        nameA,
        nameB,
        'PM'
      );
    }
  );


  nmButton.addEventListener(
    'click',
    () => {

      close();

      applyVirtualMatch(
        nameA,
        nameB,
        'NM'
      );
    }
  );


  actionGrid.append(
    pmButton,
    nmButton
  );


  const footer =
    document.createElement(
      'div'
    );

  footer.className =
    'virtual-test-footer';


  const cancelButton =
    document.createElement(
      'button'
    );

  cancelButton.type =
    'button';

  cancelButton.className =
    'virtual-test-cancel';

  cancelButton.textContent =
    'Abbrechen';

  cancelButton.addEventListener(
    'click',
    close
  );


  if (existing) {

    const existingHint =
      document.createElement(
        'div'
      );

    existingHint.className =
      'virtual-test-existing-hint';

    existingHint.textContent =
      'Wähle eine andere Annahme oder entferne die aktuelle Simulation.';


    sheet.append(
      handle,
      eyebrow,
      title,
      probability,
      existingHint,
      actionGrid
    );


    const removeButton =
      document.createElement(
        'button'
      );

    removeButton.type =
      'button';

    removeButton.className =
      'virtual-test-remove';

    removeButton.textContent =
      'Diese Simulation entfernen';


    removeButton.addEventListener(
      'click',
      () => {

        close();

        removeVirtualMatch(
          nameA,
          nameB
        );
      }
    );


    footer.append(
      removeButton,
      cancelButton
    );

  } else {

    const scenarioGrid =
      document.createElement(
        'div'
      );

    scenarioGrid.className =
      'virtual-test-scenarios';


    const pmScenario =
      document.createElement(
        'div'
      );

    pmScenario.className =
      'virtual-test-scenario pm';

    pmScenario.innerHTML =
      `<span>WENN PM</span>
       <strong>${snapshot.pmProbability.toFixed(1)}%</strong>
       <small>${formatAYTOBigInt(snapshot.pmCount)} Lösungen</small>`;


    const nmScenario =
      document.createElement(
        'div'
      );

    nmScenario.className =
      'virtual-test-scenario nm';

    nmScenario.innerHTML =
      `<span>WENN NM</span>
       <strong>${snapshot.nmProbability.toFixed(1)}%</strong>
       <small>${formatAYTOBigInt(snapshot.nmCount)} Lösungen</small>`;


    scenarioGrid.append(
      pmScenario,
      nmScenario
    );


    sheet.append(
      handle,
      eyebrow,
      title,
      probability,
      scenarioGrid,
      actionGrid
    );


    footer.append(
      cancelButton
    );
  }


  sheet.appendChild(
    footer
  );

  overlay.appendChild(
    sheet
  );


  document.body.classList.add(
    'modal-open'
  );

  document.body.appendChild(
    overlay
  );
}


/* Matrix-Klick öffnet jetzt PM / NM Auswahl */

toggleVirtualMatch =
  function (
    nameA,
    nameB
  ) {

    openVirtualTestMenu(
      nameA,
      nameB
    );
  };


/* Beste Matchbox-Strategie ins Orakel einfügen */

const step3BaseRenderOrakel =
  renderOrakel;


renderOrakel =
  function () {

    step3BaseRenderOrakel();


    const orakelBox =
      document.getElementById(
        'orakelBox'
      );


    if (
      !orakelBox ||
      !lastResults ||
      lastResults.total <= 1n
    ) {

      return;
    }


    const best =
      getBestMatchboxTest();


    if (!best) {
      return;
    }


    const card =
      document.createElement(
        'div'
      );

    card.className =
      'oracle-strategy-card';


    const top =
      document.createElement(
        'div'
      );

    top.className =
      'oracle-strategy-top';


    const copy =
      document.createElement(
        'div'
      );


    const label =
      document.createElement(
        'span'
      );

    label.className =
      'oracle-strategy-label';

    label.textContent =
      'BESTER NÄCHSTER MATCHBOX-TEST';


    const names =
      document.createElement(
        'strong'
      );

    names.textContent =
      `${best.nameA} × ${best.nameB}`;


    const description =
      document.createElement(
        'span'
      );

    description.textContent =
      'Dieser Test reduziert die Zahl der möglichen Gesamtlösungen im Erwartungswert am stärksten.';


    copy.append(
      label,
      names,
      description
    );


    const reduction =
      document.createElement(
        'div'
      );

    reduction.className =
      'oracle-strategy-reduction';

    reduction.innerHTML =
      `<strong>${best.expectedReduction.toFixed(1)}%</strong>
       <span>erwartete Reduktion</span>`;


    top.append(
      copy,
      reduction
    );


    const outcomes =
      document.createElement(
        'div'
      );

    outcomes.className =
      'oracle-strategy-outcomes';


    const pm =
      document.createElement(
        'div'
      );

    pm.className =
      'oracle-strategy-outcome pm';

    pm.innerHTML =
      `<span>PERFECT MATCH · ${best.pmProbability.toFixed(1)}%</span>
       <strong>${formatAYTOBigInt(best.pmCount)}</strong>
       <small>Lösungen bleiben</small>`;


    const nm =
      document.createElement(
        'div'
      );

    nm.className =
      'oracle-strategy-outcome nm';

    nm.innerHTML =
      `<span>NO MATCH · ${best.nmProbability.toFixed(1)}%</span>
       <strong>${formatAYTOBigInt(best.nmCount)}</strong>
       <small>Lösungen bleiben</small>`;


    outcomes.append(
      pm,
      nm
    );


    const simulateButton =
      document.createElement(
        'button'
      );

    simulateButton.type =
      'button';

    simulateButton.className =
      'oracle-strategy-button';

    simulateButton.textContent =
      'Szenarien für dieses Paar testen';


    simulateButton.addEventListener(
      'click',
      () => {

        openVirtualTestMenu(
          best.nameA,
          best.nameB
        );
      }
    );


    card.append(
      top,
      outcomes,
      simulateButton
    );


    const firstChild =
      orakelBox.firstElementChild;


    if (firstChild) {

      firstChild.after(
        card
      );

    } else {

      orakelBox.appendChild(
        card
      );
    }
  };


/* Ergebnisansicht für PM/NM Testmodus erweitern */

const step3BaseRenderResults =
  renderResults;


renderResults =
  function (
    total,
    counts,
    A,
    B,
    summaryBox,
    matrixBox
  ) {

    step3BaseRenderResults(
      total,
      counts,
      A,
      B,
      summaryBox,
      matrixBox
    );


    const simulationCopy =
      summaryBox.querySelector(
        '.simulation-head > div > span:last-child'
      );


    if (simulationCopy) {

      simulationCopy.textContent =
        'Virtuelle Matchbox-Annahmen';
    }


    const simulationTags =
      summaryBox.querySelectorAll(
        '.simulation-pairs span'
      );


    simulationTags.forEach(
      (
        tag,
        index
      ) => {

        const match =
          virtualMatches[index];


        if (!match) {
          return;
        }


        tag.classList.add(
          match.type === 'NM'
            ? 'sim-nm'
            : 'sim-pm'
        );


        tag.textContent =
          `${match.type} · ${match.A} × ${match.B}`;
      }
    );


    const hint =
      summaryBox.querySelector(
        '.matrix-hint span:last-child'
      );


    if (hint) {

      hint.textContent =
        'Tippe auf eine Prozentzahl, um Perfect Match oder No Match zu simulieren.';
    }


    const table =
      matrixBox.querySelector(
        '.ayto-table'
      );


    if (!table) {
      return;
    }


    virtualMatches.forEach(
      match => {

        const aIndex =
          A.indexOf(
            match.A
          );

        const bIndex =
          B.indexOf(
            match.B
          );


        if (
          aIndex < 0 ||
          bIndex < 0
        ) {

          return;
        }


        const cell =
          table.rows[
            aIndex + 1
          ]?.cells[
            bIndex + 1
          ];


        if (!cell) {
          return;
        }


        if (
          match.type === 'NM'
        ) {

          cell.className =
            'matrix-cell matrix-virtual-nm matrix-cell-clickable';

          cell.textContent =
            'NM TEST';

        } else {

          cell.className =
            'matrix-cell matrix-fixed matrix-cell-clickable';

          cell.textContent =
            'PM TEST';
        }
      }
    );
  };
/* =========================================================
   UI V2 - STEP 4
   Echte Matchbox-Übernahme + Worst Case + Varianten-Verlauf
   ========================================================= */

let aytoSimulationHistory = [];
let aytoSimulationHistoryCounter = 1;
let aytoSimulationBaselineTotal = null;
let aytoSimulationContextKey = '';


function getAYTORealContextKey() {

  return JSON.stringify({

    participants:
      getT(),

    matchbox:
      getMatchbox(),

    nights:
      getNights()
  });
}


function getAYTOSimulationKey(
  matches = virtualMatches
) {

  return matches
    .map(
      match =>
        `${match.type}|${match.A}|${match.B}`
    )
    .sort()
    .join('||');
}


function getAYTOReductionPercent(
  start,
  remaining
) {

  if (
    !start ||
    start <= 0n
  ) {

    return null;
  }


  const eliminated =
    start - remaining;


  return Number(
    (
      eliminated *
      10000n
    ) /
    start
  ) / 100;
}


function refreshMatchboxViewStep4() {

  const tbList =
    document.getElementById(
      'tbList'
    );


  if (!tbList) {
    return;
  }


  const entries =
    getMatchbox();


  tbList.replaceChildren();


  if (!entries.length) {

    const empty =
      document.createElement(
        'div'
      );

    empty.className =
      'small muted';

    empty.textContent =
      'Noch keine Einträge';

    tbList.appendChild(
      empty
    );

    return;
  }


  entries.forEach(
    (
      entry,
      index
    ) => {

      const row =
        document.createElement(
          'div'
        );

      row.className =
        'row';


      const content =
        document.createElement(
          'div'
        );

      content.style.flex =
        '1';

      content.style.display =
        'flex';

      content.style.alignItems =
        'center';

      content.style.gap =
        '8px';

      content.style.flexWrap =
        'wrap';


      const pair =
        document.createElement(
          'span'
        );


      const nameA =
        document.createElement(
          'b'
        );

      nameA.textContent =
        entry.A;


      const nameB =
        document.createElement(
          'b'
        );

      nameB.textContent =
        entry.B;


      pair.append(
        nameA,
        document.createTextNode(
          ' × '
        ),
        nameB
      );


      const tag =
        document.createElement(
          'span'
        );

      tag.className =
        'tag';


      if (
        entry.type === 'PM'
      ) {

        tag.classList.add(
          'pm'
        );

        tag.textContent =
          'Perfect Match';

      } else if (
        entry.type === 'NM'
      ) {

        tag.classList.add(
          'nm'
        );

        tag.textContent =
          'No Match';

      } else if (
        entry.type === 'SOLD'
      ) {

        tag.classList.add(
          'sold'
        );

        tag.textContent =
          'Verkauft';

      } else {

        tag.classList.add(
          'neutral'
        );

        tag.textContent =
          String(
            entry.type ||
            'Unbekannt'
          );
      }


      const removeButton =
        document.createElement(
          'button'
        );

      removeButton.type =
        'button';

      removeButton.className =
        'danger small';

      removeButton.textContent =
        '✖';

      removeButton.setAttribute(
        'aria-label',
        'Matchbox-Eintrag entfernen'
      );


      removeButton.addEventListener(
        'click',
        () => {

          const next =
            getMatchbox();

          next.splice(
            index,
            1
          );

          saveMatchbox(
            next
          );

          refreshMatchboxViewStep4();
        }
      );


      content.append(
        pair,
        tag
      );


      row.append(
        content,
        removeButton
      );


      tbList.appendChild(
        row
      );
    }
  );
}


function commitVirtualMatchToMatchbox(
  nameA,
  nameB,
  type
) {

  if (
    type !== 'PM' &&
    type !== 'NM'
  ) {

    return;
  }


  const entries =
    getMatchbox()
      .filter(
        entry =>
          !(
            entry.A === nameA &&
            entry.B === nameB
          )
      );


  entries.push({

    A:
      nameA,

    B:
      nameB,

    type
  });


  saveMatchbox(
    entries
  );


  virtualMatches =
    virtualMatches.filter(
      match =>
        !(
          match.A === nameA &&
          match.B === nameB
        )
    );


  aytoSimulationHistory = [];
  aytoSimulationHistoryCounter = 1;
  aytoSimulationBaselineTotal = null;
  aytoSimulationContextKey = '';


  refreshMatchboxViewStep4();


  document
    .getElementById(
      'solveBtn'
    )
    ?.click();
}


function recordAYTOSimulationSnapshot(
  total
) {

  const contextKey =
    getAYTORealContextKey();


  if (
    contextKey !==
    aytoSimulationContextKey
  ) {

    aytoSimulationContextKey =
      contextKey;

    aytoSimulationHistory = [];

    aytoSimulationHistoryCounter =
      1;

    aytoSimulationBaselineTotal =
      null;
  }


  if (
    !virtualMatches.length
  ) {

    aytoSimulationBaselineTotal =
      total;

    return;
  }


  const key =
    getAYTOSimulationKey();


  const existing =
    aytoSimulationHistory.find(
      item =>
        item.key === key
    );


  if (existing) {

    existing.total =
      total;

    return;
  }


  aytoSimulationHistory.push({

    id:
      aytoSimulationHistoryCounter++,

    key,

    total,

    matches:
      virtualMatches.map(
        match => ({
          ...match
        })
      )
  });


  if (
    aytoSimulationHistory.length >
    8
  ) {

    aytoSimulationHistory.shift();
  }
}


function restoreAYTOSimulationSnapshot(
  snapshot
) {

  virtualMatches =
    snapshot.matches.map(
      match => ({
        ...match
      })
    );


  document
    .getElementById(
      'solveBtn'
    )
    ?.click();
}


function enhanceAYTOSimulationPanel(
  summaryBox
) {

  const panel =
    summaryBox.querySelector(
      '.simulation-panel'
    );


  if (
    !panel ||
    !virtualMatches.length
  ) {

    return;
  }


  const pairBox =
    panel.querySelector(
      '.simulation-pairs'
    );


  if (!pairBox) {
    return;
  }


  pairBox.classList.add(
    'simulation-assumption-list'
  );


  pairBox.replaceChildren();


  virtualMatches.forEach(
    match => {

      const row =
        document.createElement(
          'div'
        );

      row.className =
        'simulation-assumption-row';


      const editButton =
        document.createElement(
          'button'
        );

      editButton.type =
        'button';

      editButton.className =
        match.type === 'NM'
          ? 'simulation-assumption-tag nm'
          : 'simulation-assumption-tag pm';

      editButton.textContent =
        `${match.type} · ${match.A} × ${match.B}`;

      editButton.addEventListener(
        'click',
        () =>
          openVirtualTestMenu(
            match.A,
            match.B
          )
      );


      const commitButton =
        document.createElement(
          'button'
        );

      commitButton.type =
        'button';

      commitButton.className =
        'simulation-commit-button';

      commitButton.textContent =
        'In Matchbox übernehmen';

      commitButton.addEventListener(
        'click',
        () =>
          commitVirtualMatchToMatchbox(
            match.A,
            match.B,
            match.type
          )
      );


      row.append(
        editButton,
        commitButton
      );


      pairBox.appendChild(
        row
      );
    }
  );
}


function renderAYTOSimulationHistory(
  summaryBox
) {

  summaryBox
    .querySelector(
      '.simulation-history-panel'
    )
    ?.remove();


  if (
    !aytoSimulationHistory.length
  ) {

    return;
  }


  const details =
    document.createElement(
      'details'
    );

  details.className =
    'simulation-history-panel';


  const summary =
    document.createElement(
      'summary'
    );


  const summaryTitle =
    document.createElement(
      'span'
    );

  summaryTitle.textContent =
    'Varianten-Verlauf';


  const summaryCount =
    document.createElement(
      'span'
    );

  summaryCount.className =
    'simulation-history-count';

  summaryCount.textContent =
    `${aytoSimulationHistory.length}`;


  summary.append(
    summaryTitle,
    summaryCount
  );


  const list =
    document.createElement(
      'div'
    );

  list.className =
    'simulation-history-list';


  const currentKey =
    getAYTOSimulationKey();


  [...aytoSimulationHistory]
    .reverse()
    .forEach(
      snapshot => {

        const row =
          document.createElement(
            'div'
          );

        row.className =
          snapshot.key === currentKey
            ? 'simulation-history-row active'
            : 'simulation-history-row';


        const copy =
          document.createElement(
            'div'
          );

        copy.className =
          'simulation-history-copy';


        const title =
          document.createElement(
            'strong'
          );

        title.textContent =
          `Variante ${snapshot.id}`;


        const assumptions =
          document.createElement(
            'span'
          );

        assumptions.textContent =
          snapshot.matches
            .map(
              match =>
                `${match.type} ${match.A} × ${match.B}`
            )
            .join(' · ');


        const stats =
          document.createElement(
            'small'
          );


        const reduction =
          aytoSimulationBaselineTotal !== null
            ? getAYTOReductionPercent(
                aytoSimulationBaselineTotal,
                snapshot.total
              )
            : null;


        stats.textContent =
          reduction === null
            ? `${formatAYTOBigInt(snapshot.total)} Lösungen`
            : `${formatAYTOBigInt(snapshot.total)} Lösungen · ${reduction.toFixed(1)}% weniger`;


        copy.append(
          title,
          assumptions,
          stats
        );


        const restore =
          document.createElement(
            'button'
          );

        restore.type =
          'button';

        restore.className =
          snapshot.key === currentKey
            ? 'simulation-history-restore active'
            : 'simulation-history-restore';

        restore.textContent =
          snapshot.key === currentKey
            ? 'Aktiv'
            : 'Laden';

        restore.disabled =
          snapshot.key === currentKey;

        restore.addEventListener(
          'click',
          () =>
            restoreAYTOSimulationSnapshot(
              snapshot
            )
        );


        row.append(
          copy,
          restore
        );


        list.appendChild(
          row
        );
      }
    );


  const clearButton =
    document.createElement(
      'button'
    );

  clearButton.type =
    'button';

  clearButton.className =
    'simulation-history-clear';

  clearButton.textContent =
    'Verlauf leeren';

  clearButton.addEventListener(
    'click',
    event => {

      event.preventDefault();

      aytoSimulationHistory = [];

      details.remove();
    }
  );


  details.append(
    summary,
    list,
    clearButton
  );


  const simulationPanel =
    summaryBox.querySelector(
      '.simulation-panel'
    );


  if (simulationPanel) {

    simulationPanel.after(
      details
    );

  } else {

    summaryBox.appendChild(
      details
    );
  }
}


/* Worst-Case-Wert im strategischen Orakel */

const step4BaseRenderOrakel =
  renderOrakel;


renderOrakel =
  function () {

    step4BaseRenderOrakel();


    const strategyCard =
      document.querySelector(
        '#orakelBox .oracle-strategy-card'
      );


    const best =
      getBestMatchboxTest();


    if (
      !strategyCard ||
      !best ||
      !lastResults ||
      lastResults.total <= 0n
    ) {

      return;
    }


    const total =
      lastResults.total;


    const worstCount =
      best.pmCount > best.nmCount
        ? best.pmCount
        : best.nmCount;


    const guaranteedReduction =
      getAYTOReductionPercent(
        total,
        worstCount
      );


    const worstCase =
      document.createElement(
        'div'
      );

    worstCase.className =
      'oracle-worst-case';


    const copy =
      document.createElement(
        'div'
      );


    const label =
      document.createElement(
        'span'
      );

    label.textContent =
      'SCHLIMMSTER FALL';


    const value =
      document.createElement(
        'strong'
      );

    value.textContent =
      `${formatAYTOBigInt(worstCount)} Lösungen`;


    copy.append(
      label,
      value
    );


    const guarantee =
      document.createElement(
        'span'
      );

    guarantee.className =
      'oracle-worst-guarantee';

    guarantee.textContent =
      guaranteedReduction === null
        ? 'Worst-Case nicht berechenbar'
        : `mindestens ${guaranteedReduction.toFixed(1)}% werden ausgeschlossen`;


    worstCase.append(
      copy,
      guarantee
    );


    const strategyButton =
      strategyCard.querySelector(
        '.oracle-strategy-button'
      );


    if (strategyButton) {

      strategyButton.before(
        worstCase
      );

    } else {

      strategyCard.appendChild(
        worstCase
      );
    }
  };


/* Ergebnisansicht um Übernahme + Verlauf erweitern */

const step4BaseRenderResults =
  renderResults;


renderResults =
  function (
    total,
    counts,
    A,
    B,
    summaryBox,
    matrixBox
  ) {

    step4BaseRenderResults(
      total,
      counts,
      A,
      B,
      summaryBox,
      matrixBox
    );


    recordAYTOSimulationSnapshot(
      total
    );


    enhanceAYTOSimulationPanel(
      summaryBox
    );


    renderAYTOSimulationHistory(
      summaryBox
    );
  };
/* =========================================================
   UI V2 - STEP 5
   START DASHBOARD
   ========================================================= */

const AYTO_DASH_CACHE_KEY =
  'aytoDashboardSolverCacheV1';


function aytoDashboardEscape(
  value
) {

  return String(
    value ?? ''
  )
    .replaceAll(
      '&',
      '&amp;'
    )
    .replaceAll(
      '<',
      '&lt;'
    )
    .replaceAll(
      '>',
      '&gt;'
    )
    .replaceAll(
      '"',
      '&quot;'
    )
    .replaceAll(
      "'",
      '&#039;'
    );
}


function aytoDashboardFormatBigInt(
  value
) {

  return BigInt(
    value
  )
    .toString()
    .replace(
      /\B(?=(\d{3})+(?!\d))/g,
      '.'
    );
}


/* Prüft, ob die gespeicherte Analyse
   noch zu den echten Daten passt */

function aytoDashboardContextKey() {

  return JSON.stringify({

    participants:
      getT(),

    matchbox:
      getMatchbox(),

    nights:
      getNights()
  });
}


/* Nur echte Solver-Ergebnisse speichern.
   Simulationen werden NICHT gecacht. */

function aytoDashboardSaveCache() {

  if (
    !lastResults ||
    virtualMatches.length
  ) {

    return;
  }


  try {

    localStorage.setItem(

      AYTO_DASH_CACHE_KEY,

      JSON.stringify({

        context:
          aytoDashboardContextKey(),

        total:
          lastResults
            .total
            .toString(),

        counts:
          lastResults
            .counts
            .map(
              row =>
                row.map(
                  value =>
                    value.toString()
                )
            ),

        A:
          [
            ...lastResults.A
          ],

        B:
          [
            ...lastResults.B
          ]
      })
    );

  } catch (err) {

    console.warn(
      'Dashboard-Cache konnte nicht gespeichert werden:',
      err
    );
  }
}


/* Letzte gültige Analyse
   beim Start wiederherstellen */

function aytoDashboardRestoreCache() {

  try {

    const raw =
      localStorage.getItem(
        AYTO_DASH_CACHE_KEY
      );


    if (!raw) {

      return false;
    }


    const cached =
      JSON.parse(
        raw
      );


    if (
      !cached ||
      cached.context !==
        aytoDashboardContextKey()
    ) {

      localStorage.removeItem(
        AYTO_DASH_CACHE_KEY
      );

      return false;
    }


    lastResults = {

      total:
        BigInt(
          cached.total
        ),

      counts:
        cached
          .counts
          .map(
            row =>
              row.map(
                value =>
                  BigInt(
                    value
                  )
              )
          ),

      A:
        Array.isArray(
          cached.A
        )
          ? cached.A
          : [],

      B:
        Array.isArray(
          cached.B
        )
          ? cached.B
          : []
    };


    return true;

  } catch (err) {

    console.warn(
      'Dashboard-Cache konnte nicht geladen werden:',
      err
    );


    localStorage.removeItem(
      AYTO_DASH_CACHE_KEY
    );


    return false;
  }
}


/* Sobald echte Eingaben geändert werden,
   ist die alte Analyse nicht mehr gültig */

function aytoDashboardInvalidateAnalysis() {

  lastResults =
    null;


  localStorage.removeItem(
    AYTO_DASH_CACHE_KEY
  );


  renderDashboard();
}


/* Stärkste Verbindung finden */

function aytoDashboardTopPair() {

  if (
    !lastResults ||
    lastResults.total <= 0n
  ) {

    return null;
  }


  let best =
    null;


  lastResults.A.forEach(
    (
      nameA,
      i
    ) => {

      lastResults.B.forEach(
        (
          nameB,
          j
        ) => {

          const count =
            lastResults
              .counts[i][j];


          if (
            count <= 0n
          ) {

            return;
          }


          const probability =
            Number(
              (
                count *
                10000n
              ) /
              lastResults.total
            ) /
            100;


          if (
            !best ||
            probability >
              best.probability
          ) {

            best = {

              nameA,

              nameB,

              probability
            };
          }
        }
      );
    }
  );


  return best;
}


/* Zentrale Seitennavigation.
   Teilnehmer ist Unterseite von Home. */

function goToAYTOPage(
  pageId
) {

  document
    .querySelectorAll(
      '.page'
    )
    .forEach(
      page => {

        page.classList.toggle(
          'active',
          page.id === pageId
        );
      }
    );


  const navTarget =
    pageId ===
      'page-teilnehmer'

      ? 'page-dashboard'

      : pageId;


  document
    .querySelectorAll(
      '.bottom-nav button[data-target]'
    )
    .forEach(
      button => {

        button.classList.toggle(
          'active',
          button.dataset.target ===
            navTarget
        );
      }
    );


  if (
    pageId ===
    'page-nights'
  ) {

    renderOrakel();
  }


  if (
    pageId ===
    'page-dashboard'
  ) {

    renderDashboard();
  }


  window.scrollTo({

    top:
      0,

    behavior:
      'smooth'
  });
}


/* =========================================================
   DASHBOARD RENDERN
   ========================================================= */

function renderDashboard() {

  const box =
    document.getElementById(
      'dashboardMain'
    );


  if (!box) {

    return;
  }


  const {
    A,
    B
  } = getT();


  const matchbox =
    getMatchbox();


  const nights =
    getNights();


  const pmCount =
    matchbox.filter(
      entry =>
        entry.type ===
        'PM'
    ).length;


  const analyzed =
    Boolean(
      lastResults
    );


  const total =
    analyzed
      ? lastResults.total
      : null;


  const bestTest =
    analyzed &&
    total > 1n &&
    typeof getBestMatchboxTest ===
      'function'

      ? getBestMatchboxTest()

      : null;


  const topPair =
    aytoDashboardTopPair();


  const isSimulation =
    virtualMatches.length >
    0;


  const solutionText =
    analyzed

      ? aytoDashboardFormatBigInt(
          total
        )

      : '–';


  const solutionLabel =
    !analyzed

      ? 'Analyse noch nicht berechnet'

      : total === 0n

        ? 'Aktuelle Daten widersprechen sich'

        : total === 1n

          ? 'Eindeutige Gesamtlösung gefunden'

          : 'Gesamtlösungen passen zu allen Daten';


  const stateClass =
    !analyzed

      ? 'needs-analysis'

      : total === 0n

        ? 'danger'

        : total === 1n

          ? 'success'

          : 'ready';


  const stateText =
    !analyzed

      ? 'Analyse nötig'

      : total === 0n

        ? 'Widerspruch'

        : total === 1n

          ? 'Gelöst'

          : 'Aktuell';


  let strategyHtml =
    '';


  if (bestTest) {

    const worstCount =
      bestTest.pmCount >
      bestTest.nmCount

        ? bestTest.pmCount

        : bestTest.nmCount;


    strategyHtml = `

      <section
        class="dash-strategy-card"
      >

        <div
          class="dash-section-label"
        >
          BESTER NÄCHSTER MATCHBOX-TEST
        </div>


        <div
          class="dash-strategy-main"
        >

          <div>

            <strong>
              ${aytoDashboardEscape(
                bestTest.nameA
              )}
              ×
              ${aytoDashboardEscape(
                bestTest.nameB
              )}
            </strong>

            <span>
              ${bestTest.expectedReduction.toFixed(1)}%
              erwartete Reduktion
            </span>

          </div>


          <button
            id="dashTestBest"
            type="button"
          >
            Testen
          </button>

        </div>


        <div
          class="dash-strategy-grid"
        >

          <div class="pm">

            <span>
              PM ·
              ${bestTest.pmProbability.toFixed(1)}%
            </span>

            <strong>
              ${aytoDashboardFormatBigInt(
                bestTest.pmCount
              )}
            </strong>

            <small>
              Lösungen
            </small>

          </div>


          <div class="nm">

            <span>
              NM ·
              ${bestTest.nmProbability.toFixed(1)}%
            </span>

            <strong>
              ${aytoDashboardFormatBigInt(
                bestTest.nmCount
              )}
            </strong>

            <small>
              Lösungen
            </small>

          </div>


          <div class="worst">

            <span>
              Worst Case
            </span>

            <strong>
              ${aytoDashboardFormatBigInt(
                worstCount
              )}
            </strong>

            <small>
              Lösungen
            </small>

          </div>

        </div>

      </section>
    `;

  } else {

    strategyHtml = `

      <section
        class="dash-empty-analysis"
      >

        <span
          class="dash-empty-orb"
        >
          ✦
        </span>

        <div>

          <strong>

            ${
              analyzed

                ? 'Kein sinnvoller Test mehr nötig'

                : 'Strategie wartet auf Analyse'
            }

          </strong>

          <span>

            ${
              analyzed

                ? 'Die aktuellen Daten sind bereits stark eingegrenzt.'

                : 'Berechne die Matches, dann erscheint hier der beste nächste Matchbox-Test.'
            }

          </span>

        </div>

      </section>
    `;
  }


  const topHtml =
    topPair

      ? `

        <section
          class="dash-top-match"
        >

          <div>

            <span
              class="dash-section-label"
            >
              STÄRKSTE VERBINDUNG
            </span>

            <strong>

              ${aytoDashboardEscape(
                topPair.nameA
              )}
              ×
              ${aytoDashboardEscape(
                topPair.nameB
              )}

            </strong>

            <small>
              Aktuell höchste Match-Wahrscheinlichkeit
            </small>

          </div>


          <div
            class="dash-top-percent"
          >
            ${topPair.probability.toFixed(1)}%
          </div>

        </section>
      `

      : '';


  box.innerHTML = `

    <section
      class="dash-solution-card ${stateClass}"
    >

      <div
        class="dash-solution-head"
      >

        <div>

          <span
            class="dash-section-label"
          >
            MÖGLICHE LÖSUNGEN
          </span>

          <strong>
            ${solutionText}
          </strong>

          <small>
            ${solutionLabel}
          </small>

        </div>


        <span
          class="dash-status-pill"
        >
          ${stateText}
        </span>

      </div>


      ${
        isSimulation

          ? `

            <div
              class="dash-sim-warning"
            >
              TESTMODUS AKTIV ·
              Dashboard zeigt aktuell
              die simulierte Variante.
            </div>
          `

          : ''
      }


      <button
        id="dashSolveBtn"
        class="dash-primary-action"
        type="button"
      >
        ✦ Analyse aktualisieren
      </button>

    </section>



    <section
      class="dash-stat-grid"
    >

      <div class="dash-stat">

        <strong>
          ${A.length}×${B.length}
        </strong>

        <span>
          Teilnehmer
        </span>

      </div>


      <div class="dash-stat">

        <strong>
          ${matchbox.length}
        </strong>

        <span>
          Matchbox
        </span>

      </div>


      <div class="dash-stat">

        <strong>
          ${nights.length}
        </strong>

        <span>
          Nights
        </span>

      </div>


      <div class="dash-stat">

        <strong>
          ${pmCount}
        </strong>

        <span>
          Perfect Matches
        </span>

      </div>

    </section>



    <section
      class="dash-quick-grid"
    >

      <button
        id="dashMatchboxBtn"
        type="button"
      >

        <span>
          ♥
        </span>

        <strong>
          Matchbox
        </strong>

        <small>
          Ergebnis eintragen
        </small>

      </button>


      <button
        id="dashNightBtn"
        type="button"
      >

        <span>
          ☾
        </span>

        <strong>
          Matching Night
        </strong>

        <small>
          Night verwalten
        </small>

      </button>


      <button
        id="dashOracleBtn"
        type="button"
      >

        <span>
          ✦
        </span>

        <strong>
          Orakel
        </strong>

        <small>
          Strategie ansehen
        </small>

      </button>


      <button
        id="dashCastBtn"
        type="button"
      >

        <span>
          👥
        </span>

        <strong>
          Cast
        </strong>

        <small>
          Teilnehmer bearbeiten
        </small>

      </button>

    </section>


    ${strategyHtml}

    ${topHtml}
  `;


  document
    .getElementById(
      'dashSolveBtn'
    )
    ?.addEventListener(
      'click',
      () => {

        goToAYTOPage(
          'page-ergebnisse'
        );


        setTimeout(
          () =>
            document
              .getElementById(
                'solveBtn'
              )
              ?.click(),
          80
        );
      }
    );


  document
    .getElementById(
      'dashMatchboxBtn'
    )
    ?.addEventListener(
      'click',
      () =>
        goToAYTOPage(
          'page-matchbox'
        )
    );


  document
    .getElementById(
      'dashNightBtn'
    )
    ?.addEventListener(
      'click',
      () =>
        goToAYTOPage(
          'page-entscheidungen'
        )
    );


  document
    .getElementById(
      'dashOracleBtn'
    )
    ?.addEventListener(
      'click',
      () =>
        goToAYTOPage(
          'page-nights'
        )
    );


  document
    .getElementById(
      'dashCastBtn'
    )
    ?.addEventListener(
      'click',
      () =>
        goToAYTOPage(
          'page-teilnehmer'
        )
    );


  document
    .getElementById(
      'dashTestBest'
    )
    ?.addEventListener(
      'click',
      () => {

        if (
          bestTest &&
          typeof openVirtualTestMenu ===
            'function'
        ) {

          openVirtualTestMenu(
            bestTest.nameA,
            bestTest.nameB
          );
        }
      }
    );
}


/* =========================================================
   ECHTE DATENÄNDERUNGEN
   INVALIDIEREN DIE ANALYSE
   ========================================================= */

const step5SaveT =
  saveT;


saveT =
  function (
    data
  ) {

    step5SaveT(
      data
    );


    aytoDashboardInvalidateAnalysis();
  };


const step5SaveMatchbox =
  saveMatchbox;


saveMatchbox =
  function (
    data
  ) {

    step5SaveMatchbox(
      data
    );


    aytoDashboardInvalidateAnalysis();
  };


const step5SaveNights =
  saveNights;


saveNights =
  function (
    data
  ) {

    step5SaveNights(
      data
    );


    aytoDashboardInvalidateAnalysis();
  };


/* =========================================================
   NACH JEDER BERECHNUNG
   DASHBOARD AKTUALISIEREN
   ========================================================= */

const step5BaseRenderResults =
  renderResults;


renderResults =
  function (
    total,
    counts,
    A,
    B,
    summaryBox,
    matrixBox
  ) {

    step5BaseRenderResults(
      total,
      counts,
      A,
      B,
      summaryBox,
      matrixBox
    );


    aytoDashboardSaveCache();


    renderDashboard();
  };


/* =========================================================
   START
   ========================================================= */

document.addEventListener(
  'DOMContentLoaded',
  () => {

    aytoDashboardRestoreCache();


    renderDashboard();


    document
      .getElementById(
        'castBackHome'
      )
      ?.addEventListener(
        'click',
        () =>
          goToAYTOPage(
            'page-dashboard'
          )
      );


    document
      .getElementById(
        'nav'
      )
      ?.addEventListener(
        'click',
        event => {

          const button =
            event.target.closest(
              'button[data-target]'
            );


          if (
            button?.dataset.target ===
            'page-dashboard'
          ) {

            setTimeout(
              renderDashboard,
              0
            );
          }
        }
      );
  }
);
/* =========================================================
   UI V2 - STEP 6
   TEILNEHMERFOTOS / INDEXEDDB / BACKUP
   ========================================================= */

const AYTO_PHOTO_DB_NAME = 'aytoMediaDB';
const AYTO_PHOTO_DB_VERSION = 1;
const AYTO_PHOTO_STORE = 'participantPhotos';
const AYTO_PHOTO_SIZE = 512;

let aytoPhotoPickerTarget = null;
const aytoPhotoUrlCache = new Map();


function aytoPhotoId(group, name) {

  return `${group}::${String(name || '')
    .trim()
    .toLocaleLowerCase('de-DE')}`;
}


/* =========================================================
   INDEXED DB
   ========================================================= */

function aytoOpenPhotoDB() {

  return new Promise(
    (
      resolve,
      reject
    ) => {

      const request =
        indexedDB.open(
          AYTO_PHOTO_DB_NAME,
          AYTO_PHOTO_DB_VERSION
        );


      request.onupgradeneeded =
        () => {

          const db =
            request.result;


          if (
            !db.objectStoreNames
              .contains(
                AYTO_PHOTO_STORE
              )
          ) {

            db.createObjectStore(
              AYTO_PHOTO_STORE,
              {
                keyPath:
                  'id'
              }
            );
          }
        };


      request.onsuccess =
        () =>
          resolve(
            request.result
          );


      request.onerror =
        () =>
          reject(
            request.error
          );
    }
  );
}


async function aytoPhotoStoreRequest(
  mode,
  action
) {

  const db =
    await aytoOpenPhotoDB();


  return new Promise(
    (
      resolve,
      reject
    ) => {

      const tx =
        db.transaction(
          AYTO_PHOTO_STORE,
          mode
        );


      const store =
        tx.objectStore(
          AYTO_PHOTO_STORE
        );


      let result;


      try {

        result =
          action(
            store
          );

      } catch (err) {

        db.close();

        reject(
          err
        );

        return;
      }


      tx.oncomplete =
        () => {

          db.close();

          resolve(
            result
          );
        };


      tx.onerror =
        () => {

          db.close();

          reject(
            tx.error
          );
        };


      tx.onabort =
        () => {

          db.close();

          reject(
            tx.error ||
            new Error(
              'Foto-Datenbank abgebrochen'
            )
          );
        };
    }
  );
}


async function aytoGetPhotoRecord(
  group,
  name
) {

  const id =
    aytoPhotoId(
      group,
      name
    );


  if (!name) {

    return null;
  }


  const db =
    await aytoOpenPhotoDB();


  return new Promise(
    (
      resolve,
      reject
    ) => {

      const tx =
        db.transaction(
          AYTO_PHOTO_STORE,
          'readonly'
        );


      const request =
        tx
          .objectStore(
            AYTO_PHOTO_STORE
          )
          .get(
            id
          );


      request.onsuccess =
        () => {

          db.close();

          resolve(
            request.result ||
            null
          );
        };


      request.onerror =
        () => {

          db.close();

          reject(
            request.error
          );
        };
    }
  );
}


async function aytoSavePhotoRecord(
  group,
  name,
  blob
) {

  const cleanName =
    String(
      name ||
      ''
    )
      .trim();


  if (
    !cleanName ||
    !(blob instanceof Blob)
  ) {

    throw new Error(
      'Name oder Bild fehlt'
    );
  }


  const record = {

    id:
      aytoPhotoId(
        group,
        cleanName
      ),

    group,

    name:
      cleanName,

    blob,

    updatedAt:
      Date.now()
  };


  await aytoPhotoStoreRequest(

    'readwrite',

    store =>
      store.put(
        record
      )
  );


  aytoRevokePhotoUrl(
    record.id
  );
}


async function aytoDeletePhotoRecord(
  group,
  name
) {

  if (!name) {

    return;
  }


  const id =
    aytoPhotoId(
      group,
      name
    );


  await aytoPhotoStoreRequest(

    'readwrite',

    store =>
      store.delete(
        id
      )
  );


  aytoRevokePhotoUrl(
    id
  );
}


async function aytoMovePhotoRecord(
  group,
  oldName,
  newName
) {

  const oldClean =
    String(
      oldName ||
      ''
    )
      .trim();


  const newClean =
    String(
      newName ||
      ''
    )
      .trim();


  if (
    !oldClean ||
    !newClean ||
    oldClean === newClean
  ) {

    return;
  }


  const record =
    await aytoGetPhotoRecord(
      group,
      oldClean
    );


  if (
    !record?.blob
  ) {

    return;
  }


  await aytoSavePhotoRecord(
    group,
    newClean,
    record.blob
  );


  await aytoDeletePhotoRecord(
    group,
    oldClean
  );
}


async function aytoGetAllPhotoRecords() {

  const db =
    await aytoOpenPhotoDB();


  return new Promise(
    (
      resolve,
      reject
    ) => {

      const tx =
        db.transaction(
          AYTO_PHOTO_STORE,
          'readonly'
        );


      const request =
        tx
          .objectStore(
            AYTO_PHOTO_STORE
          )
          .getAll();


      request.onsuccess =
        () => {

          db.close();


          resolve(

            Array.isArray(
              request.result
            )

              ? request.result

              : []
          );
        };


      request.onerror =
        () => {

          db.close();

          reject(
            request.error
          );
        };
    }
  );
}


async function aytoClearAllPhotos() {

  await aytoPhotoStoreRequest(

    'readwrite',

    store =>
      store.clear()
  );


  for (
    const url
    of aytoPhotoUrlCache.values()
  ) {

    URL.revokeObjectURL(
      url
    );
  }


  aytoPhotoUrlCache
    .clear();
}


/* =========================================================
   FOTO URL / AVATAR
   ========================================================= */

function aytoRevokePhotoUrl(
  id
) {

  const oldUrl =
    aytoPhotoUrlCache.get(
      id
    );


  if (oldUrl) {

    URL.revokeObjectURL(
      oldUrl
    );


    aytoPhotoUrlCache.delete(
      id
    );
  }
}


async function aytoGetPhotoUrl(
  group,
  name
) {

  if (!name) {

    return null;
  }


  const id =
    aytoPhotoId(
      group,
      name
    );


  if (
    aytoPhotoUrlCache.has(
      id
    )
  ) {

    return aytoPhotoUrlCache.get(
      id
    );
  }


  const record =
    await aytoGetPhotoRecord(
      group,
      name
    );


  if (
    !record?.blob
  ) {

    return null;
  }


  const url =
    URL.createObjectURL(
      record.blob
    );


  aytoPhotoUrlCache.set(
    id,
    url
  );


  return url;
}


function aytoInitials(
  name
) {

  const clean =
    String(
      name ||
      ''
    )
      .trim();


  if (!clean) {

    return '👤';
  }


  return clean
    .split(
      /\s+/
    )
    .slice(
      0,
      2
    )
    .map(
      part =>
        part
          .charAt(0)
          .toUpperCase()
    )
    .join('');
}


async function aytoRenderAvatarElement(
  element,
  group,
  name
) {

  if (!element) {

    return;
  }


  const cleanName =
    String(
      name ||
      ''
    )
      .trim();


  const token =
    `${group}|${cleanName}|${Date.now()}|${Math.random()}`;


  element.dataset.photoToken =
    token;


  element.dataset.photoGroup =
    group;


  element.dataset.photoName =
    cleanName;


  element.replaceChildren();

  element.classList.remove(
    'has-photo'
  );


  const fallback =
    document.createElement(
      'span'
    );


  fallback.className =
    'participant-avatar-fallback';


  fallback.textContent =
    aytoInitials(
      cleanName
    );


  element.appendChild(
    fallback
  );


  if (!cleanName) {

    return;
  }


  try {

    const url =
      await aytoGetPhotoUrl(
        group,
        cleanName
      );


    if (
      !url ||
      element.dataset.photoToken !==
        token
    ) {

      return;
    }


    const img =
      document.createElement(
        'img'
      );


    img.src =
      url;


    img.alt =
      cleanName;


    img.loading =
      'lazy';


    element.replaceChildren(
      img
    );


    element.classList.add(
      'has-photo'
    );

  } catch (err) {

    console.warn(
      'Teilnehmerfoto konnte nicht geladen werden:',
      err
    );
  }
}


function aytoCreateAvatarElement(
  group,
  name,
  className = ''
) {

  const avatar =
    document.createElement(
      'div'
    );


  avatar.className =
    `participant-avatar ${className}`
      .trim();


  aytoRenderAvatarElement(
    avatar,
    group,
    name
  );


  return avatar;
}


function aytoCreatePairAvatars(
  nameA,
  nameB
) {

  const wrap =
    document.createElement(
      'div'
    );


  wrap.className =
    'ayto-pair-avatars';


  const avatarA =
    aytoCreateAvatarElement(
      'A',
      nameA,
      'pair-avatar'
    );


  const avatarB =
    aytoCreateAvatarElement(
      'B',
      nameB,
      'pair-avatar'
    );


  wrap.append(
    avatarA,
    avatarB
  );


  return wrap;
}


/* =========================================================
   BILDER AKTUALISIEREN
   ========================================================= */

function aytoRefreshVisibleAvatars() {

  document
    .querySelectorAll(
      '[data-photo-group][data-photo-name]'
    )
    .forEach(
      element => {

        aytoRenderAvatarElement(

          element,

          element.dataset.photoGroup,

          element.dataset.photoName
        );
      }
    );


  aytoUpdateMatchboxPhotoPreview();

  aytoEnhanceDashboardPhotos();

  aytoEnhanceOraclePhotos();
}


/* =========================================================
   BILD KOMPRIMIEREN
   ========================================================= */

function aytoLoadImageElement(
  file
) {

  return new Promise(
    (
      resolve,
      reject
    ) => {

      const url =
        URL.createObjectURL(
          file
        );


      const img =
        new Image();


      img.onload =
        () => {

          resolve({
            img,
            url
          });
        };


      img.onerror =
        () => {

          URL.revokeObjectURL(
            url
          );


          reject(
            new Error(
              'Bild konnte nicht geöffnet werden'
            )
          );
        };


      img.src =
        url;
    }
  );
}


function aytoCanvasToBlob(
  canvas
) {

  return new Promise(
    (
      resolve,
      reject
    ) => {

      canvas.toBlob(

        blob => {

          if (blob) {

            resolve(
              blob
            );

          } else {

            reject(
              new Error(
                'Bild konnte nicht gespeichert werden'
              )
            );
          }
        },

        'image/jpeg',

        0.84
      );
    }
  );
}


async function aytoPrepareParticipantPhoto(
  file
) {

  if (
    !file ||
    !String(
      file.type ||
      ''
    )
      .startsWith(
        'image/'
      )
  ) {

    throw new Error(
      'Bitte eine Bilddatei auswählen'
    );
  }


  const {
    img,
    url
  } =
    await aytoLoadImageElement(
      file
    );


  try {

    const sourceSize =
      Math.min(
        img.naturalWidth,
        img.naturalHeight
      );


    const sourceX =
      (
        img.naturalWidth -
        sourceSize
      ) /
      2;


    const sourceY =
      (
        img.naturalHeight -
        sourceSize
      ) /
      2;


    const canvas =
      document.createElement(
        'canvas'
      );


    canvas.width =
      AYTO_PHOTO_SIZE;


    canvas.height =
      AYTO_PHOTO_SIZE;


    const ctx =
      canvas.getContext(
        '2d'
      );


    if (!ctx) {

      throw new Error(
        'Bildverarbeitung ist auf diesem Gerät nicht verfügbar'
      );
    }


    ctx.drawImage(

      img,

      sourceX,
      sourceY,

      sourceSize,
      sourceSize,

      0,
      0,

      AYTO_PHOTO_SIZE,
      AYTO_PHOTO_SIZE
    );


    return await aytoCanvasToBlob(
      canvas
    );

  } finally {

    URL.revokeObjectURL(
      url
    );
  }
}


/* =========================================================
   FOTO PICKER
   ========================================================= */

function aytoEnsurePhotoPicker() {

  let input =
    document.getElementById(
      'aytoParticipantPhotoPicker'
    );


  if (input) {

    return input;
  }


  input =
    document.createElement(
      'input'
    );


  input.type =
    'file';


  input.accept =
    'image/*';


  input.id =
    'aytoParticipantPhotoPicker';


  input.hidden =
    true;


  input.addEventListener(

    'change',

    async () => {

      const file =
        input.files?.[0];


      const target =
        aytoPhotoPickerTarget;


      input.value =
        '';


      if (
        !file ||
        !target
      ) {

        return;
      }


      const name =
        String(
          target.input?.value ||
          ''
        )
          .trim();


      if (!name) {

        alert(
          'Bitte zuerst einen Namen eintragen.'
        );

        return;
      }


      try {

        target.avatar
          ?.classList.add(
            'is-loading'
          );


        const blob =
          await aytoPrepareParticipantPhoto(
            file
          );


        await aytoSavePhotoRecord(
          target.group,
          name,
          blob
        );


        target.row.dataset.photoName =
          name;


        aytoClosePhotoMenu();


        aytoRefreshVisibleAvatars();

      } catch (err) {

        alert(
          `Foto konnte nicht gespeichert werden: ${err.message}`
        );

      } finally {

        target.avatar
          ?.classList.remove(
            'is-loading'
          );


        aytoPhotoPickerTarget =
          null;
      }
    }
  );


  document.body.appendChild(
    input
  );


  return input;
}


/* =========================================================
   FOTO MENÜ
   ========================================================= */

function aytoClosePhotoMenu() {

  document
    .querySelector(
      '.participant-photo-overlay'
    )
    ?.remove();


  document.body
    .classList.remove(
      'modal-open'
    );
}


async function aytoOpenPhotoMenu(
  group,
  input,
  row,
  avatar
) {

  const name =
    String(
      input?.value ||
      ''
    )
      .trim();


  if (!name) {

    alert(
      'Bitte zuerst einen Namen eintragen.'
    );


    input?.focus();

    return;
  }


  aytoClosePhotoMenu();


  const existing =
    await aytoGetPhotoRecord(
      group,
      name
    );


  const overlay =
    document.createElement(
      'div'
    );


  overlay.className =
    'participant-photo-overlay';


  const sheet =
    document.createElement(
      'section'
    );


  sheet.className =
    'participant-photo-sheet';


  sheet.setAttribute(
    'role',
    'dialog'
  );


  sheet.setAttribute(
    'aria-modal',
    'true'
  );


  const preview =
    aytoCreateAvatarElement(
      group,
      name,
      'participant-photo-preview'
    );


  const eyebrow =
    document.createElement(
      'span'
    );


  eyebrow.className =
    'participant-photo-eyebrow';


  eyebrow.textContent =
    'TEILNEHMERFOTO';


  const title =
    document.createElement(
      'h2'
    );


  title.textContent =
    name;


  const hint =
    document.createElement(
      'p'
    );


  hint.textContent =
    'Das Bild wird automatisch quadratisch zugeschnitten und für die App optimiert.';


  const chooseButton =
    document.createElement(
      'button'
    );


  chooseButton.type =
    'button';


  chooseButton.className =
    'participant-photo-primary';


  chooseButton.textContent =
    existing

      ? 'Foto ändern'

      : 'Foto auswählen';


  chooseButton.addEventListener(

    'click',

    () => {

      aytoPhotoPickerTarget = {

        group,

        input,

        row,

        avatar
      };


      aytoEnsurePhotoPicker()
        .click();
    }
  );


  const actions =
    document.createElement(
      'div'
    );


  actions.className =
    'participant-photo-actions';


  if (existing) {

    const removeButton =
      document.createElement(
        'button'
      );


    removeButton.type =
      'button';


    removeButton.className =
      'participant-photo-remove';


    removeButton.textContent =
      'Foto entfernen';


    removeButton.addEventListener(

      'click',

      async () => {

        await aytoDeletePhotoRecord(
          group,
          name
        );


        aytoClosePhotoMenu();


        aytoRefreshVisibleAvatars();
      }
    );


    actions.appendChild(
      removeButton
    );
  }


  const cancelButton =
    document.createElement(
      'button'
    );


  cancelButton.type =
    'button';


  cancelButton.className =
    'participant-photo-cancel';


  cancelButton.textContent =
    'Abbrechen';


  cancelButton.addEventListener(
    'click',
    aytoClosePhotoMenu
  );


  actions.appendChild(
    cancelButton
  );


  sheet.append(

    preview,

    eyebrow,

    title,

    hint,

    chooseButton,

    actions
  );


  overlay.appendChild(
    sheet
  );


  overlay.addEventListener(

    'click',

    event => {

      if (
        event.target ===
        overlay
      ) {

        aytoClosePhotoMenu();
      }
    }
  );


  document.body
    .classList.add(
      'modal-open'
    );


  document.body.appendChild(
    overlay
  );
}


/* =========================================================
   TEILNEHMERZEILE ERWEITERN
   ========================================================= */

function aytoDecorateParticipantRow(
  row,
  listId
) {

  if (
    !row ||
    row.dataset.photoReady ===
      '1'
  ) {

    return;
  }


  const input =
    row.querySelector(
      'input'
    );


  if (!input) {

    return;
  }


  const group =
    listId ===
      'listA'

      ? 'A'

      : 'B';


  row.dataset.photoReady =
    '1';


  row.dataset.photoName =
    String(
      input.value ||
      ''
    )
      .trim();


  row.classList.add(
    'photo-person-row'
  );


  const avatarButton =
    document.createElement(
      'button'
    );


  avatarButton.type =
    'button';


  avatarButton.className =
    'participant-avatar participant-avatar-button';


  avatarButton.setAttribute(

    'aria-label',

    'Teilnehmerfoto auswählen oder ändern'
  );


  row.insertBefore(
    avatarButton,
    input
  );


  const removeParticipantButton =
    row.querySelector(
      'button.danger'
    );


  removeParticipantButton
    ?.addEventListener(

      'click',

      () => {

        const currentName =
          String(
            input.value ||
            ''
          )
            .trim();


        if (currentName) {

          aytoDeletePhotoRecord(
            group,
            currentName
          )
            .catch(
              err =>
                console.warn(
                  'Teilnehmerfoto konnte beim Löschen nicht entfernt werden:',
                  err
                )
            );
        }
      },

      true
    );


  aytoRenderAvatarElement(
    avatarButton,
    group,
    input.value
  );


  avatarButton.addEventListener(

    'click',

    () =>
      aytoOpenPhotoMenu(

        group,

        input,

        row,

        avatarButton
      )
  );


  input.addEventListener(

    'change',

    async () => {

      const oldName =
        String(
          row.dataset.photoName ||
          ''
        )
          .trim();


      const newName =
        String(
          input.value ||
          ''
        )
          .trim();


      if (
        oldName &&
        newName &&
        oldName !== newName
      ) {

        try {

          await aytoMovePhotoRecord(

            group,

            oldName,

            newName
          );

        } catch (err) {

          console.warn(
            'Foto konnte beim Umbenennen nicht mitgenommen werden:',
            err
          );
        }
      }


      if (newName) {

        row.dataset.photoName =
          newName;
      }


      aytoRenderAvatarElement(

        avatarButton,

        group,

        newName
      );


      setTimeout(
        aytoRefreshVisibleAvatars,
        0
      );
    }
  );
}


/* Bestehende Teilnehmerfunktion erweitern */

const step6BaseCreatePersonUI =
  createPersonUI;


createPersonUI =
  function (
    name,
    listId
  ) {

    const list =
      document.getElementById(
        listId
      );


    const beforeCount =
      list?.children.length ||
      0;


    step6BaseCreatePersonUI(
      name,
      listId
    );


    if (!list) {

      return;
    }


    const row =
      list.children[
        beforeCount
      ] ||
      list.lastElementChild;


    aytoDecorateParticipantRow(
      row,
      listId
    );
  };


/* =========================================================
   MATCHBOX FOTOVORSCHAU
   ========================================================= */

function aytoUpdateMatchboxPhotoPreview() {

  const box =
    document.getElementById(
      'aytoMatchboxPhotoPreview'
    );


  const tbA =
    document.getElementById(
      'tbA'
    );


  const tbB =
    document.getElementById(
      'tbB'
    );


  if (
    !box ||
    !tbA ||
    !tbB
  ) {

    return;
  }


  box.replaceChildren();


  const profileA =
    document.createElement(
      'div'
    );


  profileA.className =
    'matchbox-photo-person';


  const avatarA =
    aytoCreateAvatarElement(

      'A',

      tbA.value,

      'matchbox-photo-avatar'
    );


  const nameA =
    document.createElement(
      'strong'
    );


  nameA.textContent =
    tbA.value ||
    'Person A';


  profileA.append(
    avatarA,
    nameA
  );


  const connector =
    document.createElement(
      'span'
    );


  connector.className =
    'matchbox-photo-connector';


  connector.textContent =
    '×';


  const profileB =
    document.createElement(
      'div'
    );


  profileB.className =
    'matchbox-photo-person';


  const avatarB =
    aytoCreateAvatarElement(

      'B',

      tbB.value,

      'matchbox-photo-avatar'
    );


  const nameB =
    document.createElement(
      'strong'
    );


  nameB.textContent =
    tbB.value ||
    'Person B';


  profileB.append(
    avatarB,
    nameB
  );


  box.append(

    profileA,

    connector,

    profileB
  );
}


function aytoInitMatchboxPhotoPreview() {

  const tbA =
    document.getElementById(
      'tbA'
    );


  const tbB =
    document.getElementById(
      'tbB'
    );


  const addTB =
    document.getElementById(
      'addTB'
    );


  if (
    !tbA ||
    !tbB ||
    !addTB
  ) {

    return;
  }


  let box =
    document.getElementById(
      'aytoMatchboxPhotoPreview'
    );


  if (!box) {

    box =
      document.createElement(
        'div'
      );


    box.id =
      'aytoMatchboxPhotoPreview';


    box.className =
      'matchbox-photo-preview';


    addTB.before(
      box
    );
  }


  tbA.addEventListener(
    'change',
    aytoUpdateMatchboxPhotoPreview
  );


  tbB.addEventListener(
    'change',
    aytoUpdateMatchboxPhotoPreview
  );


  document.addEventListener(

    'teilnehmerChanged',

    () =>
      setTimeout(
        aytoUpdateMatchboxPhotoPreview,
        0
      )
  );


  aytoUpdateMatchboxPhotoPreview();
}


/* =========================================================
   MATCHING NIGHT FOTOS
   ========================================================= */

function aytoEnhanceNightEditorPhotos() {

  document
    .querySelectorAll(
      '.night-editor-pair-row'
    )
    .forEach(
      row => {

        if (
          row.dataset.photoEnhanced ===
          '1'
        ) {

          return;
        }


        const person =
          row.querySelector(
            '.night-editor-person'
          );


        const name =
          person
            ?.querySelector(
              'strong'
            )
            ?.textContent
            ?.trim();


        if (
          !person ||
          !name
        ) {

          return;
        }


        row.dataset.photoEnhanced =
          '1';


        person.classList.add(
          'night-editor-person-with-photo'
        );


        const avatar =
          aytoCreateAvatarElement(

            'A',

            name,

            'night-editor-person-avatar'
          );


        person.prepend(
          avatar
        );
      }
    );
}


const step6BaseOpenNightEditor =
  openNightEditor;


openNightEditor =
  function (
    onSaved
  ) {

    step6BaseOpenNightEditor(
      onSaved
    );


    setTimeout(
      aytoEnhanceNightEditorPhotos,
      0
    );
  };


/* =========================================================
   DASHBOARD / ORAKEL FOTOS
   ========================================================= */

function aytoEnhanceDashboardPhotos() {

  const bestTest =
    (
      typeof getBestMatchboxTest ===
      'function'
    )

      ? getBestMatchboxTest()

      : null;


  const strategyCopy =
    document.querySelector(
      '.dash-strategy-main > div:first-child'
    );


  if (
    bestTest &&
    strategyCopy &&
    !strategyCopy.querySelector(
      '.ayto-pair-avatars'
    )
  ) {

    strategyCopy.prepend(

      aytoCreatePairAvatars(

        bestTest.nameA,

        bestTest.nameB
      )
    );
  }


  const topPair =
    (
      typeof aytoDashboardTopPair ===
      'function'
    )

      ? aytoDashboardTopPair()

      : null;


  const topCopy =
    document.querySelector(
      '.dash-top-match > div:first-child'
    );


  if (
    topPair &&
    topCopy &&
    !topCopy.querySelector(
      '.ayto-pair-avatars'
    )
  ) {

    topCopy.prepend(

      aytoCreatePairAvatars(

        topPair.nameA,

        topPair.nameB
      )
    );
  }
}


function aytoEnhanceOraclePhotos() {

  const topPair =
    (
      typeof aytoDashboardTopPair ===
      'function'
    )

      ? aytoDashboardTopPair()

      : null;


  const bestCardCopy =
    document.querySelector(
      '#orakelBox .oracle-best-copy'
    );


  if (
    topPair &&
    bestCardCopy &&
    !bestCardCopy.querySelector(
      '.ayto-pair-avatars'
    )
  ) {

    bestCardCopy.prepend(

      aytoCreatePairAvatars(

        topPair.nameA,

        topPair.nameB
      )
    );
  }


  const bestTest =
    (
      typeof getBestMatchboxTest ===
      'function'
    )

      ? getBestMatchboxTest()

      : null;


  const strategyCopy =
    document.querySelector(
      '#orakelBox .oracle-strategy-top > div:first-child'
    );


  if (
    bestTest &&
    strategyCopy &&
    !strategyCopy.querySelector(
      '.ayto-pair-avatars'
    )
  ) {

    strategyCopy.prepend(

      aytoCreatePairAvatars(

        bestTest.nameA,

        bestTest.nameB
      )
    );
  }
}


/* Dashboard überschreiben */

if (
  typeof renderDashboard ===
  'function'
) {

  const step6BaseRenderDashboard =
    renderDashboard;


  renderDashboard =
    function () {

      step6BaseRenderDashboard();

      aytoEnhanceDashboardPhotos();
    };
}


/* Orakel überschreiben */

const step6BaseRenderOrakel =
  renderOrakel;


renderOrakel =
  function () {

    step6BaseRenderOrakel();

    aytoEnhanceOraclePhotos();
  };


/* =========================================================
   BACKUP MIT FOTOS
   ========================================================= */

function aytoBlobToDataUrl(
  blob
) {

  return new Promise(
    (
      resolve,
      reject
    ) => {

      const reader =
        new FileReader();


      reader.onload =
        () =>
          resolve(
            reader.result
          );


      reader.onerror =
        () =>
          reject(
            reader.error
          );


      reader.readAsDataURL(
        blob
      );
    }
  );
}


function aytoDataUrlToBlob(
  dataUrl
) {

  const [
    meta,
    base64
  ] =
    String(
      dataUrl
    )
      .split(',');


  if (
    !meta ||
    !base64
  ) {

    throw new Error(
      'Ungültige Bilddaten im Backup'
    );
  }


  const mimeMatch =
    meta.match(
      /^data:(.*?);base64$/
    );


  const mime =
    mimeMatch?.[1] ||
    'image/jpeg';


  const binary =
    atob(
      base64
    );


  const bytes =
    new Uint8Array(
      binary.length
    );


  for (
    let i = 0;
    i < binary.length;
    i++
  ) {

    bytes[i] =
      binary.charCodeAt(
        i
      );
  }


  return new Blob(

    [
      bytes
    ],

    {
      type:
        mime
    }
  );
}


async function aytoExportBackupWithPhotos(
  event
) {

  event.preventDefault();

  event.stopImmediatePropagation();


  try {

    const records =
      await aytoGetAllPhotoRecords();


    const photos =
      [];


    for (
      const record
      of records
    ) {

      photos.push({

        id:
          record.id,

        group:
          record.group,

        name:
          record.name,

        dataUrl:
          await aytoBlobToDataUrl(
            record.blob
          )
      });
    }


    const data = {

      version:
        document
          .querySelector(
            'meta[name="app-version"]'
          )
          ?.content ||
        null,

      teilnehmer:
        getT(),

      matchbox:
        getMatchbox(),

      nights:
        getNights(),

      photos
    };


    const blob =
      new Blob(

        [
          JSON.stringify(
            data,
            null,
            2
          )
        ],

        {
          type:
            'application/json'
        }
      );


    const url =
      URL.createObjectURL(
        blob
      );


    const link =
      document.createElement(
        'a'
      );


    link.href =
      url;


    link.download =
      'AYTO_Backup_mit_Fotos.json';


    link.click();


    setTimeout(

      () =>
        URL.revokeObjectURL(
          url
        ),

      1000
    );

  } catch (err) {

    alert(
      `Export fehlgeschlagen: ${err.message}`
    );
  }
}


async function aytoImportBackupWithPhotos(
  event
) {

  event.stopImmediatePropagation();


  const file =
    event.target.files?.[0];


  if (!file) {

    return;
  }


  try {

    const text =
      await file.text();


    const imported =
      JSON.parse(
        text
      );


    if (
      !imported?.teilnehmer ||
      !Array.isArray(
        imported.teilnehmer.A
      ) ||
      !Array.isArray(
        imported.teilnehmer.B
      )
    ) {

      throw new Error(
        'Ungültiges AYTO-Backup'
      );
    }


    localStorage.setItem(

      STORAGE_KEY_T,

      JSON.stringify(
        imported.teilnehmer
      )
    );


    localStorage.setItem(

      STORAGE_KEY_MB,

      JSON.stringify(

        Array.isArray(
          imported.matchbox
        )

          ? imported.matchbox

          : []
      )
    );


    localStorage.setItem(

      STORAGE_KEY_NIGHTS,

      JSON.stringify(

        Array.isArray(
          imported.nights
        )

          ? imported.nights

          : []
      )
    );


    await aytoClearAllPhotos();


    if (
      Array.isArray(
        imported.photos
      )
    ) {

      for (
        const photo
        of imported.photos
      ) {

        if (
          !photo?.group ||
          !photo?.name ||
          !photo?.dataUrl
        ) {

          continue;
        }


        await aytoSavePhotoRecord(

          photo.group,

          photo.name,

          aytoDataUrlToBlob(
            photo.dataUrl
          )
        );
      }
    }


    location.reload();

  } catch (err) {

    alert(
      `Import fehlgeschlagen: ${err.message}`
    );
  }
}


/* =========================================================
   RESET MIT FOTOS
   ========================================================= */

async function aytoResetEverythingWithPhotos(
  event
) {

  event.preventDefault();

  event.stopImmediatePropagation();


  if (
    !confirm(
      'Alle AYTO-Daten inklusive Teilnehmerfotos auf diesem Gerät löschen?'
    )
  ) {

    return;
  }


  try {

    localStorage.removeItem(
      STORAGE_KEY_T
    );


    localStorage.removeItem(
      STORAGE_KEY_MB
    );


    localStorage.removeItem(
      STORAGE_KEY_NIGHTS
    );


    if (
      typeof AYTO_DASH_CACHE_KEY !==
      'undefined'
    ) {

      localStorage.removeItem(
        AYTO_DASH_CACHE_KEY
      );
    }


    virtualMatches =
      [];


    lastResults =
      null;


    await aytoClearAllPhotos();


    location.reload();

  } catch (err) {

    alert(
      `Zurücksetzen fehlgeschlagen: ${err.message}`
    );
  }
}


/* =========================================================
   EXPORT / IMPORT ÜBERNEHMEN
   ========================================================= */

function aytoInstallPhotoBackupHooks() {

  const exportButton =
    document.getElementById(
      'exportBtn'
    );


  const importFile =
    document.getElementById(
      'importFile'
    );


  const resetButton =
    document.getElementById(
      'resetBtn'
    );


  exportButton
    ?.addEventListener(

      'click',

      aytoExportBackupWithPhotos,

      true
    );


  importFile
    ?.addEventListener(

      'change',

      aytoImportBackupWithPhotos,

      true
    );


  resetButton
    ?.addEventListener(

      'click',

      aytoResetEverythingWithPhotos,

      true
    );
}


/* =========================================================
   START
   ========================================================= */

document.addEventListener(

  'DOMContentLoaded',

  () => {

    aytoEnsurePhotoPicker();


    aytoInitMatchboxPhotoPreview();


    aytoInstallPhotoBackupHooks();


    document
      .querySelectorAll(
        '#listA .person-row'
      )
      .forEach(
        row =>
          aytoDecorateParticipantRow(
            row,
            'listA'
          )
      );


    document
      .querySelectorAll(
        '#listB .person-row'
      )
      .forEach(
        row =>
          aytoDecorateParticipantRow(
            row,
            'listB'
          )
      );


    setTimeout(
      aytoRefreshVisibleAvatars,
      0
    );
  }
);
