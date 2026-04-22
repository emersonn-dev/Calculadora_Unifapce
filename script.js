(() => {
  const systemThemeQuery = window.matchMedia("(prefers-color-scheme: dark)");

  const scoreIds = ["tde1", "tde2", "tde3", "tde4", "avp1", "avp2"];
  const navigationIds = ["disciplina", ...scoreIds];
  const elems = Object.fromEntries(scoreIds.map((id) => [id, document.getElementById(id)]));

  const disciplinaInput = document.getElementById("disciplina");
  const calcBtn = document.getElementById("calcBtn");
  const clearBtn = document.getElementById("clearBtn");

  const mediaTDESpan = document.getElementById("mediaTDE");
  const mediaSemSpan = document.getElementById("mediaSem");
  const resultHeadline = document.getElementById("resultHeadline");
  const resultLead = document.getElementById("resultLead");
  const message = document.getElementById("message");
  const errorBox = document.getElementById("error");
  const resultCard = document.getElementById("resultCard");

  const historyEmpty = document.getElementById("historyEmpty");
  const historyList = document.getElementById("historyList");
  const clearHistoryBtn = document.getElementById("clearHistoryBtn");
  const faqDisclosure = document.getElementById("faqDisclosure");

  const openHistoryBtn = document.getElementById("openHistoryBtn");
  const closeHistoryBtn = document.getElementById("closeHistoryBtn");
  const overlay = document.getElementById("overlay");
  const historyDrawer = document.getElementById("historyDrawer");
  const historyEmptyMobile = document.getElementById("historyEmptyMobile");
  const historyListMobile = document.getElementById("historyListMobile");
  const clearHistoryBtnMobile = document.getElementById("clearHistoryBtnMobile");

  const HISTORY_KEY = "calc_media_history_unifapce_v3";
  const MAX_HISTORY = 12;
  const HISTORY_DRAWER_QUERY = "(max-width: 980px)";
  const RESULT_STATUS_CLASSES = ["status--green", "status--yellow", "status--red"];

  const clamp10 = (n) => Math.min(10, Math.max(0, n));
  const round2 = (n) => Math.round(n * 100) / 100;

  function initTheme() {
    document.documentElement.classList.toggle("dark", systemThemeQuery.matches);
  }

  function isMobile() {
    return window.matchMedia(HISTORY_DRAWER_QUERY).matches;
  }

  function syncFaqDisclosure() {
    if (!faqDisclosure) return;

    if (window.matchMedia("(max-width: 768px)").matches) {
      faqDisclosure.removeAttribute("open");
      return;
    }

    faqDisclosure.setAttribute("open", "");
  }

  function toNum(v) {
    const value = String(v ?? "").replace(",", ".").trim();
    if (!value) return 0;
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function readVal(id) {
    return clamp10(toNum(elems[id]?.value));
  }

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function formatDateTime(date) {
    const dd = pad2(date.getDate());
    const mm = pad2(date.getMonth() + 1);
    const yyyy = date.getFullYear();
    const hh = pad2(date.getHours());
    const mi = pad2(date.getMinutes());
    return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
  }

  function getDisciplina() {
    const text = (disciplinaInput?.value || "").trim();
    return text || "Sem disciplina";
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function getStatus(md) {
    if (md < 4) {
      return {
        key: "reprovado",
        label: "Reprovado",
        headline: "Reprovado nesta etapa",
        cls: "status--red",
        color: "red",
        lead: "Média abaixo de 4,0.",
        message: "Falta média para chegar à AVF.",
      };
    }

    if (md < 7) {
      return {
        key: "avf",
        label: "Vai para AVF",
        headline: "Você vai para AVF",
        cls: "status--yellow",
        color: "yellow",
        lead: "Média entre 4,0 e 6,9.",
        message: "Você ainda pode buscar aprovação pela AVF.",
      };
    }

    return {
      key: "aprovado",
      label: "Aprovado",
      headline: "Aprovado",
      cls: "status--green",
      color: "green",
      lead: "Média igual ou maior que 7,0.",
      message: "Aprovação direta.",
    };
  }

  function neededAVF(md) {
    return clamp10(10 - md);
  }

  function neededAVP2ForApproval(avp1, mediaTDE) {
    return round2((7 - avp1 * 0.4 - mediaTDE * 0.2) / 0.4);
  }

  function showError(text) {
    errorBox.textContent = text;
    clearTimeout(showError._timer);
    showError._timer = setTimeout(() => {
      errorBox.textContent = "";
    }, 3600);
  }

  function isBlankFieldValue(value) {
    return String(value ?? "").trim() === "";
  }

  function updateFieldVisualState(el) {
    if (!el) return;

    const hasValue = el.value.trim() !== "";
    const raw = parseFloat(String(el.value).replace(",", "."));
    const isInvalid = hasValue && (!Number.isFinite(raw) || raw < 0 || raw > 10);

    el.classList.toggle("is-filled", hasValue);
    el.classList.toggle("is-invalid", isInvalid);
    el.setAttribute("aria-invalid", isInvalid ? "true" : "false");
  }

  function updateTextFieldState(el) {
    if (!el) return;
    const hasValue = el.value.trim() !== "";
    el.classList.toggle("is-filled", hasValue);
    el.classList.remove("is-invalid");
    el.setAttribute("aria-invalid", "false");
  }

  function updateCalcButtonState() {
    const hasAnyScore = scoreIds.some((id) => {
      const value = toNum(elems[id]?.value);
      return Number.isFinite(value) && value > 0;
    });
    calcBtn.disabled = !hasAnyScore;
  }

  function resetResult() {
    resultCard.hidden = true;
    resultCard.classList.remove("highlight", ...RESULT_STATUS_CLASSES);
    clearTimeout(revealResultCard._highlightTimer);
    mediaTDESpan.textContent = "--";
    mediaSemSpan.textContent = "--";
    resultHeadline.textContent = "Resumo da média";
    resultLead.textContent = "";
    message.textContent = "";
  }

  function setButtonLoading(isLoading) {
    calcBtn.classList.toggle("is-loading", isLoading);
    calcBtn.setAttribute("aria-busy", isLoading ? "true" : "false");
  }

  function revealResultCard() {
    resultCard.hidden = false;
    resultCard.classList.remove("highlight");
    void resultCard.offsetWidth;
    resultCard.classList.add("highlight");
    clearTimeout(revealResultCard._highlightTimer);
    revealResultCard._highlightTimer = window.setTimeout(() => {
      resultCard.classList.remove("highlight");
    }, 2000);

    window.setTimeout(() => {
      resultCard.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 120);
  }

  function loadHistory() {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveHistory(entries) {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
    } catch {
    }
  }

  function buildHistoryItem(item, index) {
    const li = document.createElement("li");
    li.className = "history-item";
    li.dataset.index = String(index);

    const top = document.createElement("div");
    top.className = "history-top";

    const left = document.createElement("div");
    left.className = "history-left";
    left.innerHTML = `
      <div class="history-title" title="${escapeHtml(item.disciplina)}">${escapeHtml(item.disciplina)}</div>
      <div class="history-date">${escapeHtml(item.when)}</div>
    `;

    const actions = document.createElement("div");
    actions.className = "history-actions";

    const badge = document.createElement("div");
    badge.className = `history-badge ${item.color}`;
    badge.textContent = item.statusLabel;

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "history-remove";
    removeBtn.setAttribute("aria-label", `Remover cálculo de ${item.disciplina}`);
    removeBtn.dataset.removeIndex = String(index);
    removeBtn.textContent = "x";

    const line1 = document.createElement("div");
    line1.className = "history-line";
    line1.innerHTML = `MD: <b>${Number(item.md).toFixed(2)}</b> · TDEs: ${Number(item.tde).toFixed(2)}`;

    actions.appendChild(badge);
    actions.appendChild(removeBtn);
    top.appendChild(left);
    top.appendChild(actions);

    li.appendChild(top);
    li.appendChild(line1);

    if (item.statusKey === "avf") {
      const line2 = document.createElement("div");
      line2.className = "history-line";
      line2.innerHTML = `Precisa na AVF: <b>${Number(item.needAvf).toFixed(2)}</b>`;
      li.appendChild(line2);
    }

    return li;
  }

  function renderHistory() {
    const history = loadHistory();

    historyList.innerHTML = "";
    historyListMobile.innerHTML = "";

    historyEmpty.style.display = history.length ? "none" : "block";
    historyEmptyMobile.style.display = history.length ? "none" : "block";

    history.forEach((item, index) => {
      historyList.appendChild(buildHistoryItem(item, index));
      historyListMobile.appendChild(buildHistoryItem(item, index));
    });
  }

  function pushHistory(entry) {
    const current = loadHistory();
    current.unshift(entry);
    saveHistory(current.slice(0, MAX_HISTORY));
    renderHistory();
  }

  function removeHistoryItem(index) {
    const current = loadHistory();
    if (!Number.isInteger(index) || index < 0 || index >= current.length) return;

    const item = current[index];
    const confirmed = window.confirm(
      `Tem certeza que deseja remover "${item?.disciplina || "este cálculo"}" do histórico?`
    );
    if (!confirmed) return;

    current.splice(index, 1);
    saveHistory(current);
    renderHistory();
    showError("Item removido do histórico.");
  }

  function clearHistory() {
    const confirmed = window.confirm("Tem certeza que deseja apagar todo o histórico?");
    if (!confirmed) return;

    saveHistory([]);
    renderHistory();
    showError("Histórico apagado.");
  }

  function openDrawer() {
    if (!isMobile()) return;
    overlay.hidden = false;
    historyDrawer.classList.add("is-open");
    historyDrawer.setAttribute("aria-hidden", "false");
    openHistoryBtn?.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
  }

  function closeDrawer() {
    overlay.hidden = true;
    historyDrawer.classList.remove("is-open");
    historyDrawer.setAttribute("aria-hidden", "true");
    openHistoryBtn?.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
  }

  function validateInputValue(el) {
    if (!el) return;

    const rawText = String(el.value).replace(",", ".").trim();

    if (!rawText) {
      el.value = "";
      updateFieldVisualState(el);
      updateCalcButtonState();
      return;
    }

    const parsed = parseFloat(rawText);

    if (!Number.isFinite(parsed)) {
      el.classList.add("is-invalid");
      showError("Digite apenas números entre 0 e 10.");
      updateCalcButtonState();
      return;
    }

    if (parsed < 0) {
      el.value = "0";
      showError("A menor nota permitida é 0.");
    } else if (parsed > 10) {
      el.value = "10";
      showError("A maior nota permitida é 10.");
    } else {
      el.value = round2(parsed).toString();
    }

    updateFieldVisualState(el);
    updateCalcButtonState();
  }

  function focusById(id) {
    const field = document.getElementById(id);
    if (!field) return;
    field.focus();
    if (typeof field.select === "function") {
      field.select();
    }
  }

  initTheme();

  if (typeof systemThemeQuery.addEventListener === "function") {
    systemThemeQuery.addEventListener("change", () => {
      initTheme();
    });
  }

  navigationIds.forEach((id, index) => {
    const field = document.getElementById(id);
    if (!field) return;

    field.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        const nextId = navigationIds[index + 1];
        if (nextId) {
          focusById(nextId);
        } else {
          calcBtn.focus();
        }
      }

      if (event.key === "Backspace" && field.value.trim() === "") {
        const previousId = navigationIds[index - 1];
        if (previousId) {
          focusById(previousId);
        }
      }
    });
  });

  scoreIds.forEach((id) => {
    const el = elems[id];
    if (!el) return;

    el.addEventListener("input", () => {
      errorBox.textContent = "";
      updateFieldVisualState(el);
      updateCalcButtonState();
    });

    el.addEventListener("blur", () => validateInputValue(el));

    el.addEventListener("focus", () => {
      try {
        el.select();
      } catch {
      }
    });

    el.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault();
        el.blur();
      },
      { passive: false }
    );
  });

  disciplinaInput?.addEventListener("input", () => {
    updateTextFieldState(disciplinaInput);
  });

  calcBtn.addEventListener("click", async () => {
    const values = scoreIds.map(readVal);
    const avp2WasBlank = isBlankFieldValue(elems.avp2?.value);

    if (values.every((value) => value === 0)) {
      resetResult();
      showError("Preencha pelo menos uma nota diferente de 0 para calcular.");
      return;
    }

    setButtonLoading(true);
    calcBtn.disabled = true;

    await new Promise((resolve) => window.setTimeout(resolve, 420));

    const [t1, t2, t3, t4, avp1, avp2] = values;
    const mediaTDE = (t1 + t2 + t3 + t4) / 4;
    const md = avp1 * 0.4 + avp2 * 0.4 + mediaTDE * 0.2;

    const tdeRounded = round2(mediaTDE);
    const mdRounded = round2(md);
    const status = getStatus(mdRounded);
    const need = round2(neededAVF(mdRounded));
    const needAvp2ForApproval = neededAVP2ForApproval(avp1, tdeRounded);

    revealResultCard();
    mediaTDESpan.textContent = tdeRounded.toFixed(2).replace(".", ",");
    mediaSemSpan.textContent = mdRounded.toFixed(2).replace(".", ",");

    resultCard.classList.remove(...RESULT_STATUS_CLASSES);
    resultCard.classList.add(status.cls);
    resultHeadline.textContent = status.headline;
    resultLead.textContent = status.lead;

    if (status.key === "aprovado") {
      message.textContent = status.message;
    } else if (status.key === "avf") {
      message.textContent = `Você precisa tirar ${need.toFixed(2).replace(".", ",")} na AVF para chegar à média final 5,0.`;
    } else {
      message.textContent = "Média abaixo de 4,0.";
    }

    if (avp2WasBlank) {
      if (needAvp2ForApproval <= 0) {
        message.textContent = "Mesmo sem AVP2, você já alcançou média 7,0.";
      } else if (needAvp2ForApproval <= 10) {
        message.textContent = `Você precisa tirar ${needAvp2ForApproval.toFixed(2).replace(".", ",")} na AVP2 para alcançar média 7,0.`;
      } else {
        message.textContent = "Mesmo com 10,0 na AVP2, não é possível atingir média 7,0.";
      }
    }

    pushHistory({
      when: formatDateTime(new Date()),
      disciplina: getDisciplina(),
      tde: tdeRounded,
      md: mdRounded,
      statusKey: status.key,
      statusLabel: status.label,
      needAvf: status.key === "avf" ? need : null,
      color: status.color,
    });

    setButtonLoading(false);
    updateCalcButtonState();
  });

  clearBtn.addEventListener("click", () => {
    scoreIds.forEach((id) => {
      elems[id].value = "";
      elems[id].classList.remove("is-filled", "is-invalid");
      elems[id].setAttribute("aria-invalid", "false");
    });

    disciplinaInput.value = "";
    updateTextFieldState(disciplinaInput);
    clearTimeout(showError._timer);
    errorBox.textContent = "";
    resetResult();
    setButtonLoading(false);
    updateCalcButtonState();
    disciplinaInput.focus();
  });

  clearHistoryBtn?.addEventListener("click", clearHistory);
  clearHistoryBtnMobile?.addEventListener("click", clearHistory);

  historyList.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const index = Number(target.dataset.removeIndex);
    if (target.closest(".history-remove")) {
      removeHistoryItem(index);
    }
  });

  historyListMobile.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const index = Number(target.dataset.removeIndex);
    if (target.closest(".history-remove")) {
      removeHistoryItem(index);
    }
  });

  openHistoryBtn?.addEventListener("click", openDrawer);
  closeHistoryBtn?.addEventListener("click", closeDrawer);
  overlay?.addEventListener("click", closeDrawer);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && historyDrawer.classList.contains("is-open")) {
      closeDrawer();
    }
  });

  window.addEventListener("resize", () => {
    if (!isMobile()) {
      closeDrawer();
    }
    syncFaqDisclosure();
  });

  renderHistory();
  closeDrawer();
  resetResult();
  syncFaqDisclosure();
  updateCalcButtonState();
  updateTextFieldState(disciplinaInput);
  scoreIds.forEach((id) => updateFieldVisualState(elems[id]));
})();
