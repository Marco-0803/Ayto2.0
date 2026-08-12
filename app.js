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
