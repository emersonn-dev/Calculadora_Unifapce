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
  const openFullHistoryBtn = document.getElementById("openFullHistoryBtn");
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
  const MAX_HISTORY = 50;
  const RECENT_HISTORY_LIMIT = 5;
  const RESULT_STATUS_CLASSES = ["status--green", "status--yellow", "status--red"];

  const clamp10 = (n) => Math.min(10, Math.max(0, n));
  const round2 = (n) => Math.round(n * 100) / 100;

  function initTheme() {
    document.documentElement.classList.toggle("dark", systemThemeQuery.matches);
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

  function getPartialStatusForMissingAVP2(maxPossibleMd) {
    if (maxPossibleMd >= 7) {
      return {
        key: "parcial-avp2",
        label: "AVP2 pendente",
        headline: "AVP2 pendente",
        cls: "status--yellow",
        color: "yellow",
        lead: "Ainda falta a AVP2 para definir se dá para passar direto.",
      };
    }

    if (maxPossibleMd >= 4) {
      return {
        key: "parcial-avf",
        label: "Pode ir para AVF",
        headline: "Ainda dá para ir para AVF",
        cls: "status--yellow",
        color: "yellow",
        lead: "A aprovação direta não é mais possível só com a AVP2, mas a AVF ainda está ao alcance.",
      };
    }

    return {
      key: "parcial-sem-avf",
      label: "Sem faixa de AVF",
      headline: "AVF não é mais possível",
      cls: "status--red",
      color: "red",
      lead: "Mesmo com a nota máxima na AVP2, a faixa da AVF não será alcançada.",
    };
  }

  function neededAVF(md) {
    return clamp10(10 - md);
  }

  function neededAVP2ForApproval(avp1, mediaTDE) {
    return round2((7 - avp1 * 0.4 - mediaTDE * 0.2) / 0.4);
  }

  function neededAVP2ForAVF(avp1, mediaTDE) {
    return round2((4 - avp1 * 0.4 - mediaTDE * 0.2) / 0.4);
  }

  function formatGrade(value) {
    return Number(value).toFixed(2).replace(".", ",");
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

    const useBtn = document.createElement("button");
    useBtn.type = "button";
    useBtn.className = "history-use";
    useBtn.setAttribute("aria-label", `Usar notas de ${item.disciplina}`);
    useBtn.dataset.loadIndex = String(index);
    useBtn.textContent = "Usar";
    useBtn.hidden = !item.scores;

    const line1 = document.createElement("div");
    line1.className = "history-line";
    line1.innerHTML = `MD: <b>${Number(item.md).toFixed(2)}</b> · TDEs: ${Number(item.tde).toFixed(2)}`;

    actions.appendChild(useBtn);
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

    if (item.needAvp2ForAVF != null && Number.isFinite(Number(item.needAvp2ForAVF)) && item.statusKey !== "aprovado") {
      const line3 = document.createElement("div");
      line3.className = "history-line history-line--compact";
      line3.innerHTML = `AVP2 p/ AVF: <b>${Number(item.needAvp2ForAVF).toFixed(2)}</b>`;
      li.appendChild(line3);
    }

    return li;
  }

  function getHistoryGroupLabel(item) {
    const datePart = String(item.when || "").split(" ")[0];
    const [day, month, year] = datePart.split("/");

    if (!day || !month || !year) return "Sem data";

    const today = new Date();
    const todayLabel = `${pad2(today.getDate())}/${pad2(today.getMonth() + 1)}/${today.getFullYear()}`;

    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const yesterdayLabel = `${pad2(yesterday.getDate())}/${pad2(yesterday.getMonth() + 1)}/${yesterday.getFullYear()}`;

    if (datePart === todayLabel) return "Hoje";
    if (datePart === yesterdayLabel) return "Ontem";
    return `${month}/${year}`;
  }

  function appendHistoryItems(target, items, { grouped = false } = {}) {
    let currentGroup = "";

    items.forEach(({ item, index }) => {
      if (grouped) {
        const group = getHistoryGroupLabel(item);
        if (group !== currentGroup) {
          currentGroup = group;
          const divider = document.createElement("li");
          divider.className = "history-date-divider";
          divider.textContent = group;
          target.appendChild(divider);
        }
      }

      target.appendChild(buildHistoryItem(item, index));
    });
  }

  function renderHistory() {
    const history = loadHistory();
    const indexedHistory = history.map((item, index) => ({ item, index }));
    const recentHistory = indexedHistory.slice(0, RECENT_HISTORY_LIMIT);

    historyList.innerHTML = "";
    historyListMobile.innerHTML = "";

    historyEmpty.style.display = history.length ? "none" : "block";
    historyEmptyMobile.style.display = history.length ? "none" : "block";
    if (openFullHistoryBtn) {
      openFullHistoryBtn.hidden = !history.length;
    }

    appendHistoryItems(historyList, recentHistory);
    appendHistoryItems(historyListMobile, indexedHistory, { grouped: true });
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

  function restoreHistoryItem(index) {
    const current = loadHistory();
    const item = current[index];

    if (!item?.scores) {
      showError("Esse item antigo não tem as notas salvas para reutilizar.");
      return;
    }

    disciplinaInput.value = item.disciplina === "Sem disciplina" ? "" : item.disciplina;
    updateTextFieldState(disciplinaInput);

    scoreIds.forEach((id) => {
      elems[id].value = item.scores[id] ?? "";
      validateInputValue(elems[id]);
    });

    resetResult();
    updateCalcButtonState();
    closeDrawer();
    showError("Notas carregadas do histórico.");
    calcBtn.focus();
  }

  function handleHistoryListClick(event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const removeButton = target.closest(".history-remove");
    if (removeButton instanceof HTMLElement) {
      removeHistoryItem(Number(removeButton.dataset.removeIndex));
      return;
    }

    const loadButton = target.closest(".history-use");
    if (loadButton instanceof HTMLElement) {
      restoreHistoryItem(Number(loadButton.dataset.loadIndex));
    }
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
    const maxPossibleMd = avp1 * 0.4 + 10 * 0.4 + mediaTDE * 0.2;

    const tdeRounded = round2(mediaTDE);
    const mdRounded = round2(md);
    const maxPossibleRounded = round2(maxPossibleMd);
    const status = avp2WasBlank
      ? getPartialStatusForMissingAVP2(maxPossibleRounded)
      : getStatus(mdRounded);
    const need = round2(neededAVF(mdRounded));
    const needAvp2ForApproval = neededAVP2ForApproval(avp1, tdeRounded);
    const needAvp2ForAVF = neededAVP2ForAVF(avp1, tdeRounded);

    revealResultCard();
    mediaTDESpan.textContent = tdeRounded.toFixed(2).replace(".", ",");
    mediaSemSpan.textContent = mdRounded.toFixed(2).replace(".", ",");

    resultCard.classList.remove(...RESULT_STATUS_CLASSES);
    resultCard.classList.add(status.cls);
    resultHeadline.textContent = status.headline;
    resultLead.textContent = status.lead;

    if (avp2WasBlank) {
      if (maxPossibleRounded >= 7) {
        if (needAvp2ForApproval <= 0) {
          message.textContent = "Mesmo sem AVP2, você já alcançou média 7,0.";
        } else {
          const avfText = needAvp2ForAVF <= 0
            ? "Você já está na faixa da AVF."
            : `Para pelo menos ir para AVF, precisa tirar ${formatGrade(needAvp2ForAVF)} na AVP2.`;
          message.textContent = `${avfText} Para passar direto, precisa tirar ${formatGrade(needAvp2ForApproval)} na AVP2.`;
        }
      } else if (maxPossibleRounded >= 4) {
        const avfText = needAvp2ForAVF <= 0
          ? "Você já está na faixa da AVF."
          : `Você precisa tirar ${formatGrade(needAvp2ForAVF)} na AVP2 para ir para AVF.`;
        message.textContent = `${avfText} Mesmo com 10,0 na AVP2, não dá para passar direto.`;
      } else {
        message.textContent = "Mesmo com 10,0 na AVP2, não é possível alcançar a faixa da AVF.";
      }
    } else if (status.key === "aprovado") {
      message.textContent = status.message;
    } else if (status.key === "avf") {
      message.textContent = `Você precisa tirar ${formatGrade(need)} na AVF para chegar à média final 5,0.`;
    } else {
      message.textContent = "Média abaixo de 4,0.";
    }

    pushHistory({
      when: formatDateTime(new Date()),
      disciplina: getDisciplina(),
      tde: tdeRounded,
      md: mdRounded,
      statusKey: status.key,
      statusLabel: status.label,
      needAvf: status.key === "avf" ? need : null,
      needAvp2ForAVF: avp2WasBlank && needAvp2ForAVF > 0 && needAvp2ForAVF <= 10 ? needAvp2ForAVF : null,
      color: status.color,
      scores: {
        tde1: t1,
        tde2: t2,
        tde3: t3,
        tde4: t4,
        avp1,
        avp2: avp2WasBlank ? "" : avp2,
      },
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

  historyList.addEventListener("click", handleHistoryListClick);
  historyListMobile.addEventListener("click", handleHistoryListClick);

  openHistoryBtn?.addEventListener("click", openDrawer);
  openFullHistoryBtn?.addEventListener("click", openDrawer);
  closeHistoryBtn?.addEventListener("click", closeDrawer);
  overlay?.addEventListener("click", closeDrawer);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && historyDrawer.classList.contains("is-open")) {
      closeDrawer();
    }
  });

  window.addEventListener("resize", () => {
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
