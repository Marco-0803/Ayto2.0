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


      nightsList.replaceChildren();


      if (
        !nights.length
      ) {

        const empty =
          document.createElement(
            'div'
          );

        empty.className =
          'small muted';

        empty.textContent =
          'Keine Matching Night angelegt';


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
              'div'
            );


          card.className =
            'card stack night-card';


          const head =
            document.createElement(
              'div'
            );


          head.className =
            'row';


          head.style.justifyContent =
            'space-between';


          const title =
            document.createElement(
              'strong'
            );


          title.textContent =
            `Night ${index + 1}`;


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
              `Night ${index + 1} entfernen`
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
            title,
            removeButton
          );


          const lights =
            document.createElement(
              'div'
            );


          lights.className =
            'small muted';


          lights.textContent =
            `Lichter: ${Number(night.lights) || 0}`;


          const table =
            document.createElement(
              'table'
            );


          (
            Array.isArray(
              night.pairs
            )
              ? night.pairs
              : []
          )
            .forEach(
              pair => {

                const tr =
                  document.createElement(
                    'tr'
                  );


                const tdA =
                  document.createElement(
                    'td'
                  );


                const tdX =
                  document.createElement(
                    'td'
                  );


                const tdB =
                  document.createElement(
                    'td'
                  );


                tdA.textContent =
                  pair.A || '';


                tdX.textContent =
                  '×';


                if (
                  pair.B ===
                  'keine'
                ) {

                  const italic =
                    document.createElement(
                      'i'
                    );


                  italic.textContent =
                    'Kein Partner';


                  tdB.appendChild(
                    italic
                  );

                } else {

                  tdB.textContent =
                    pair.B || '';
                }


                tr.append(
                  tdA,
                  tdX,
                  tdB
                );


                table.appendChild(
                  tr
                );
              }
            );


          card.append(
            head,
            lights,
            table
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


  overlay.style.cssText =
    'position:fixed;inset:0;background:rgba(0,0,0,.95);z-index:10000;display:flex;align-items:center;justify-content:center;padding:15px';


  const box =
    document.createElement(
      'div'
    );


  box.className =
    'card stack';


  box.style.cssText =
    'max-width:480px;width:100%;max-height:95vh;overflow-y:auto;background:#171a2b;padding:20px;border:1px solid #333';


  const title =
    document.createElement(
      'h3'
    );


  title.textContent =
    'Matching Night';


  title.style.marginTop =
    '0';


  box.appendChild(
    title
  );


  const pairRows = [];


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

          } else {

            row.select.add(
              new Option(
                '- auswählen -',
                ''
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
        }
      );
    };


  A.forEach(
    nameA => {

      const row =
        document.createElement(
          'div'
        );


      row.style.cssText =
        'display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;gap:10px';


      const label =
        document.createElement(
          'span'
        );


      label.textContent =
        nameA;


      label.style.cssText =
        'font-size:14px;font-weight:bold;flex:1';


      const select =
        document.createElement(
          'select'
        );


      select.style.cssText =
        'flex:1.5;padding:8px';


      select.addEventListener(
        'change',
        updateSelects
      );


      row.append(
        label,
        select
      );


      box.appendChild(
        row
      );


      pairRows.push({

        A:
          nameA,

        select
      });
    }
  );


  updateSelects();


  const lightRow =
    document.createElement(
      'div'
    );


  lightRow.className =
    'row';


  lightRow.style.cssText =
    'margin-top:15px;padding-top:15px;border-top:1px solid #333';


  const lightLabel =
    document.createElement(
      'span'
    );


  lightLabel.textContent =
    'Lichter:';


  const lightSelect =
    document.createElement(
      'select'
    );


  lightSelect.style.width =
    '100px';


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
        String(i),
        String(i)
      )
    );
  }


  lightRow.append(
    lightLabel,
    lightSelect
  );


  box.appendChild(
    lightRow
  );


  const buttonRow =
    document.createElement(
      'div'
    );


  buttonRow.className =
    'row';


  buttonRow.style.marginTop =
    '20px';


  const saveButton =
    document.createElement(
      'button'
    );


  saveButton.className =
    'primary';


  saveButton.style.flex =
    '1';


  saveButton.textContent =
    'Speichern';


  const cancelButton =
    document.createElement(
      'button'
    );


  cancelButton.className =
    'ghost';


  cancelButton.style.flex =
    '1';


  cancelButton.textContent =
    'Abbrechen';


  cancelButton
    .addEventListener(
      'click',
      () =>
        overlay.remove()
    );


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


        overlay.remove();


        onSaved();
      }
    );


  buttonRow.append(
    saveButton,
    cancelButton
  );


  box.appendChild(
    buttonRow
  );


  overlay.appendChild(
    box
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


  const topPairs =
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
      )
      .slice(
        0,
        5
      );


  const deadPairs =
    pairs
      .filter(
        pair =>
          pair.count ===
          0n
      )
      .slice(
        0,
        12
      );


  const heading =
    document.createElement(
      'h2'
    );


  heading.textContent =
    '🔮 Match-Orakel';


  heading.style.marginBottom =
    '20px';


  orakelBox.appendChild(
    heading
  );


  const hotCard =
    document.createElement(
      'div'
    );


  hotCard.className =
    'card stack oracle-section-gold';


  const hotTitle =
    document.createElement(
      'strong'
    );


  hotTitle.style.cssText =
    'color:#ffd700;text-transform:uppercase;font-size:12px';


  hotTitle.textContent =
    '🔥 Heißeste Tipps (Top 5)';


  hotCard.appendChild(
    hotTitle
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
        `row oracle-card${
          pair.prob >=
          100
            ? ' perfect-match'
            : ''
        }`;


      const left =
        document.createElement(
          'span'
        );


      const rank =
        document.createElement(
          'span'
        );


      rank.style.cssText =
        'opacity:.5;margin-right:8px';


      rank.textContent =
        `#${index + 1}`;


      const names =
        document.createElement(
          'b'
        );


      names.textContent =
        `${pair.nameA} & ${pair.nameB}`;


      left.append(
        rank,
        names
      );


      const right =
        document.createElement(
          'span'
        );


      right.style.cssText =
        `color:${
          pair.prob >=
          100
            ? '#ffd700'
            : '#4a82ff'
        };font-weight:bold`;


      right.textContent =
        pair.prob >=
        100

          ? 'MATCH'

          : `${pair.prob.toFixed(1)}%`;


      row.append(
        left,
        right
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
    'card stack oracle-section-cold';


  const coldTitle =
    document.createElement(
      'strong'
    );


  coldTitle.style.cssText =
    'color:#ff4f4f;text-transform:uppercase;font-size:12px';


  coldTitle.textContent =
    '❄️ Kälter als Eis (0%)';


  const coldGrid =
    document.createElement(
      'div'
    );


  coldGrid.className =
    'cold-grid';


  deadPairs.forEach(
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
    coldTitle,
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


  const headingRow =
    document.createElement(
      'div'
    );


  headingRow.className =
    'row';


  const heading =
    document.createElement(
      'h3'
    );


  heading.textContent =
    'Ergebnis';


  heading.style.marginBottom =
    '0';


  headingRow.appendChild(
    heading
  );


  if (
    virtualMatches.length
  ) {

    const simulationTag =
      document.createElement(
        'span'
      );


    simulationTag.className =
      'tag warning';


    simulationTag.textContent =
      'SIMULATION';


    headingRow.appendChild(
      simulationTag
    );
  }


  const totalText =
    document.createElement(
      'div'
    );


  totalText.textContent =
    total === 0n

      ? 'Keine Kombination gefunden'

      : `${total.toString()} Kombinationen`;


  summaryBox.append(
    headingRow,
    totalText
  );


  if (
    virtualMatches.length
  ) {

    const stopButton =
      document.createElement(
        'button'
      );


    stopButton.className =
      'small ghost';


    stopButton.textContent =
      'Simulation beenden';


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


    summaryBox.appendChild(
      stopButton
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


  headRow.appendChild(
    document.createElement(
      'th'
    )
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


          if (
            isVirtual
          ) {

            cell.style.cssText =
              'background:#00ffaa;color:#000;font-weight:bold;border:2px solid #fff';


            cell.textContent =
              'FIXED';


            cell.classList.add(
              'matrix-cell-clickable'
            );


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

            cell.style.cssText =
              'background:#ffd700;color:#000;font-weight:bold';


            cell.textContent =
              'MATCH';


            cell.classList.add(
              'matrix-cell-clickable'
            );


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
              'no-match';


            cell.textContent =
              'No Match';

          } else {

            const hue =
              260 -
              (
                probability *
                2.5
              );


            cell.style.cssText =
              `background:hsl(${hue},70%,25%);color:white`;


            cell.textContent =
              `${probability.toFixed(2)}%`;


            cell.classList.add(
              'matrix-cell-clickable'
            );


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
