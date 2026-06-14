const DATA = window.ANALYSIS_DATA;
const STORAGE_KEY = "yeonam_wifi_measurements_v1";
const REMOTE_CONFIG_KEY = "yeonam_wifi_remote_config_v1";

const $ = (selector) => document.querySelector(selector);

const els = {
  sourceNote: $("#sourceNote"),
  regionSelect: $("#regionSelect"),
  timeSelect: $("#timeSelect"),
  dormSelect: $("#dormSelect"),
  locationInput: $("#locationInput"),
  activeUsersInput: $("#activeUsersInput"),
  rainInput: $("#rainInput"),
  fullRows: $("#fullRows"),
  rainDrop: $("#rainDrop"),
  rainDropDetail: $("#rainDropDetail"),
  rttTarget: $("#rttTarget"),
  latestStatus: $("#latestStatus"),
  latestStatusDetail: $("#latestStatusDetail"),
  measurementStatusCard: $("#measurementStatusCard"),
  selectedRegionLabel: $("#selectedRegionLabel"),
  rainChart: $("#rainChart"),
  timeChart: $("#timeChart"),
  rainInsights: $("#rainInsights"),
  timeInsights: $("#timeInsights"),
  thresholdGrid: $("#thresholdGrid"),
  conclusionList: $("#conclusionList"),
  apPlanLabel: $("#apPlanLabel"),
  apSummary: $("#apSummary"),
  apTableBody: $("#apTableBody"),
  placementList: $("#placementList"),
  testProgress: $("#testProgress"),
  measurementResult: $("#measurementResult"),
  measurementCount: $("#measurementCount"),
  zoneRanking: $("#zoneRanking"),
  measurementTableBody: $("#measurementTableBody"),
  exportButton: $("#exportButton"),
  clearButton: $("#clearButton"),
  runTestButton: $("#runTestButton"),
  runTestButtonBottom: $("#runTestButtonBottom"),
  remoteUrlInput: $("#remoteUrlInput"),
  remoteKeyInput: $("#remoteKeyInput"),
  saveRemoteButton: $("#saveRemoteButton"),
  syncRemoteButton: $("#syncRemoteButton"),
  remoteStatus: $("#remoteStatus"),
};

function fmt(value, digits = 1) {
  if (!Number.isFinite(Number(value))) return "-";
  return Number(value).toLocaleString("ko-KR", {
    maximumFractionDigits: digits,
    minimumFractionDigits: Number.isInteger(Number(value)) ? 0 : Math.min(digits, 1),
  });
}

function pct(value, digits = 1) {
  if (!Number.isFinite(Number(value))) return "-";
  return `${fmt(value, digits)}%`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function average(values) {
  const valid = values.filter((value) => Number.isFinite(value));
  if (!valid.length) return 0;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function stdev(values) {
  const valid = values.filter((value) => Number.isFinite(value));
  if (valid.length < 2) return 0;
  const mean = average(valid);
  const variance = valid.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (valid.length - 1);
  return Math.sqrt(variance);
}

function currentRegion() {
  return els.regionSelect.value || DATA.source.regions[0];
}

function currentTimeBand() {
  return els.timeSelect.value;
}

function currentDorm() {
  return els.dormSelect.value;
}

function rainRows(region) {
  return DATA.rainSummary.filter((row) => row["지역"] === region);
}

function rowByWeather(region, weather) {
  return DATA.rainSummary.find((row) => row["지역"] === region && row["날씨"] === weather);
}

function timeRows(region) {
  return DATA.timeSummary.filter((row) => row["지역"] === region);
}

function statRow(region, compare) {
  return DATA.statTests.find((row) => row["지역"] === region && row["비교"] === compare);
}

function apRow(dorm) {
  return DATA.apPlan.find((row) => row["기숙사"] === dorm);
}

function thresholdData() {
  return DATA.stability.thresholds;
}

function loadMeasurements() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveMeasurements(measurements) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(measurements.slice(-500)));
}

function loadRemoteConfig() {
  try {
    return JSON.parse(localStorage.getItem(REMOTE_CONFIG_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveRemoteConfig() {
  const config = {
    url: els.remoteUrlInput.value.trim().replace(/\/$/, ""),
    anonKey: els.remoteKeyInput.value.trim(),
  };
  localStorage.setItem(REMOTE_CONFIG_KEY, JSON.stringify(config));
  els.remoteStatus.textContent = config.url && config.anonKey ? "원격 DB 설정을 저장했습니다. 다음 측정부터 Supabase에도 저장합니다." : "원격 DB 설정이 비어 있어 로컬 저장만 사용합니다.";
}

function initRemoteConfig() {
  const config = loadRemoteConfig();
  els.remoteUrlInput.value = config.url || "";
  els.remoteKeyInput.value = config.anonKey || "";
  els.remoteStatus.textContent = config.url && config.anonKey ? "원격 DB 설정이 저장되어 있습니다." : "원격 DB 설정이 없으면 이 브라우저에만 저장됩니다.";
}

function statusFromScore(score) {
  if (score < 25) return { key: "stable", label: "안정" };
  if (score < 55) return { key: "caution", label: "주의" };
  return { key: "danger", label: "불안정" };
}

function scoreMeasurement(row) {
  const thresholds = thresholdData();
  const downloadMin = thresholds.downloadMbpsMin.threshold;
  const rttMax = thresholds.rttMsMax.threshold;
  const lossMax = thresholds.packetLossPctMax.threshold;

  const downloadPenalty = clamp(((downloadMin - row.downloadMbps) / downloadMin) * 45, 0, 45);
  const rttPenalty = clamp(((row.latencyMs - rttMax) / rttMax) * 35, 0, 35);
  const lossPenalty = clamp(((row.failurePct - lossMax) / Math.max(lossMax, 1)) * 30, 0, 30);
  const jitterPenalty = clamp((row.jitterMs / 35) * 15, 0, 15);
  const rainPenalty = clamp(Number(row.rainMm || 0) * 0.7, 0, 10);
  return Math.round(clamp(downloadPenalty + rttPenalty + lossPenalty + jitterPenalty + rainPenalty, 0, 100));
}

function initControls() {
  els.regionSelect.innerHTML = DATA.source.regions.map((region) => `<option value="${region}">${region}</option>`).join("");

  const timeBands = [...new Set(DATA.timeSummary.map((row) => row["시간대"]))];
  els.timeSelect.innerHTML = timeBands.map((band) => `<option value="${band}">${band}</option>`).join("");
  els.timeSelect.value = "저녁 18-23";

  els.dormSelect.innerHTML = DATA.apPlan
    .filter((row) => row["기숙사"] !== "합계")
    .map((row) => `<option value="${row["기숙사"]}">${row["기숙사"]}</option>`)
    .join("");
  els.dormSelect.value = "2관";
}

function renderSource() {
  els.sourceNote.textContent = `${DATA.source.file} 기준. 전체 정제 요약 ${fmt(DATA.source.fullCleanRows, 0)}건, 웹에 포함된 표본 ${fmt(DATA.source.sampleRows, 0)}건. 공개 데이터 지역은 ${DATA.source.regions.join(", ")}이며, 기숙사 실제 데이터는 아래 측정 기능으로 별도 누적합니다.`;
  els.fullRows.textContent = fmt(DATA.source.fullCleanRows, 0);
}

function renderMetrics() {
  const region = currentRegion();
  const dry = rowByWeather(region, "건조");
  const rain = rowByWeather(region, "강수");
  const change = ((rain["다운로드 중앙값 (Mbps)"] - dry["다운로드 중앙값 (Mbps)"]) / dry["다운로드 중앙값 (Mbps)"]) * 100;
  els.rainDrop.textContent = pct(change, 1);
  els.rainDropDetail.textContent = `${region}: 건조 ${fmt(dry["다운로드 중앙값 (Mbps)"])}Mbps → 강수 ${fmt(rain["다운로드 중앙값 (Mbps)"])}Mbps`;

  const rttTarget = thresholdData().rttMsMax.threshold;
  els.rttTarget.textContent = `${fmt(rttTarget, 1)} ms 이하`;
}

function renderRainInsights() {
  const region = currentRegion();
  const dry = rowByWeather(region, "건조");
  const rain = rowByWeather(region, "강수");
  const rainTest = statRow(region, "강수 vs 건조");
  const badIncrease = rain["불량 연결 비율 (%)"] - dry["불량 연결 비율 (%)"];
  const downloadChange = rainTest ? rainTest["변화율 (%)"] : ((rain["다운로드 중앙값 (Mbps)"] - dry["다운로드 중앙값 (Mbps)"]) / dry["다운로드 중앙값 (Mbps)"]) * 100;

  els.rainInsights.innerHTML = [
    ["다운로드 감소", `${region}에서 강수 시 다운로드 중앙값은 ${fmt(dry["다운로드 중앙값 (Mbps)"])}Mbps에서 ${fmt(rain["다운로드 중앙값 (Mbps)"])}Mbps로 변했고, 변화율은 ${pct(downloadChange, 1)}입니다.`],
    ["불량 연결 증가", `불량 연결 비율은 건조 ${pct(dry["불량 연결 비율 (%)"])}에서 강수 ${pct(rain["불량 연결 비율 (%)"])}로 ${pct(badIncrease)}p 증가했습니다.`],
    ["통계 검정", rainTest ? `p 값은 ${rainTest["p 값"] === 0 ? "0.001 미만" : rainTest["p 값"]}로 기록되어, 강수와 다운로드 저하의 차이가 통계적으로 확인됩니다.` : "통계 검정 행을 찾지 못했습니다."],
  ]
    .map(([title, body]) => insight(title, body))
    .join("");
}

function renderTimeInsights() {
  const region = currentRegion();
  const band = currentTimeBand();
  const selected = timeRows(region).find((row) => row["시간대"] === band);
  const evening = statRow(region, "저녁 vs 기타 시간");
  els.selectedRegionLabel.textContent = region;

  els.timeInsights.innerHTML = [
    ["선택 시간대", `${band}의 다운로드 중앙값은 ${fmt(selected["다운로드 중앙값 (Mbps)"])}Mbps, RTT 중앙값은 ${fmt(selected["RTT 중앙값 (ms)"])}ms, 불량 연결 비율은 ${pct(selected["불량 연결 비율 (%)"])}입니다.`],
    ["저녁 혼잡 효과", evening ? `저녁 시간 다운로드 중앙값은 기타 시간보다 ${pct(evening["변화율 (%)"], 1)} 낮았습니다. 표본 수는 저녁 ${fmt(evening["A 표본 수"], 0)}건, 기타 ${fmt(evening["B 표본 수"], 0)}건입니다.` : "저녁 비교 행을 찾지 못했습니다."],
  ]
    .map(([title, body]) => insight(title, body))
    .join("");
}

function renderThresholds() {
  const stability = DATA.stability;
  const t = thresholdData();
  const good = stability.goodQuantiles;
  const bad = stability.badQuantiles;

  els.thresholdGrid.innerHTML = [
    ["다운로드", `${fmt(t.downloadMbpsMin.threshold)}Mbps 초과 목표`, `불량 연결을 가장 잘 가르는 기준은 ${fmt(t.downloadMbpsMin.threshold)}Mbps 이하입니다. 정상 연결 중앙값은 ${fmt(good.downloadMbps.p50)}Mbps, 불량 연결 중앙값은 ${fmt(bad.downloadMbps.p50)}Mbps입니다.`],
    ["RTT 지연", `${fmt(t.rttMsMax.threshold)}ms 이하 목표`, `RTT 기준선은 ${fmt(t.rttMsMax.threshold)}ms 이상입니다. 정상 연결 중앙값은 ${fmt(good.rttMs.p50)}ms, 불량 연결 중앙값은 ${fmt(bad.rttMs.p50)}ms입니다.`],
    ["패킷 손실", `${fmt(t.packetLossPctMax.threshold)}% 미만 목표`, `패킷 손실 기준선은 ${fmt(t.packetLossPctMax.threshold)}% 이상입니다. 정상 연결 75분위는 ${fmt(good.packetLossPct.p75)}%, 불량 연결 90분위는 ${fmt(bad.packetLossPct.p90)}%입니다.`],
  ]
    .map(
      ([title, value, body]) => `
        <div class="threshold-card">
          <strong>${title}: ${value}</strong>
          <span>${body}</span>
        </div>
      `,
    )
    .join("");
}

function renderConclusions() {
  const region = currentRegion();
  const rainEffect = DATA.regression.find((row) => row.term === "rain_flag_Rain");
  const selectedAp = apRow(currentDorm());
  const correlations = DATA.stability.rainCorrelations;

  els.conclusionList.innerHTML = [
    ["원인 1: 비와 트래픽 품질", `표본 기준 강수량과 다운로드의 상관계수는 ${fmt(correlations.downloadMbps, 4)}입니다. 회귀분석에서도 강수 효과는 ${pct(rainEffect.effect_pct, 1)}로 기록되어 비가 올 때 다운로드 품질이 낮아지는 경향이 있습니다.`],
    ["원인 2: 시간대 혼잡", `${region}의 저녁 시간 비교 결과는 기타 시간 대비 약 ${pct(statRow(region, "저녁 vs 기타 시간")["변화율 (%)"], 1)} 다운로드 저하입니다. 기숙사에서는 저녁 재실률과 동시 접속 증가를 함께 봐야 합니다.`],
    ["해결: AP 증설과 위치 개선", `${selectedAp["기숙사"]}은 ${fmt(selectedAp["인원"], 0)}명 기준 20% 여유 포함 권장 AP ${fmt(selectedAp["20% 여유 포함 권장 AP"], 0)}대, 추가 설치 ${fmt(selectedAp["추가 설치 권장"], 0)}대입니다.`],
    ["한계와 다음 질문", "현재 공개 데이터는 해외 지역 기반이라 기숙사 직접값으로 단정하면 안 됩니다. 따라서 웹 측정 기능으로 위치별 실측을 쌓아 최종 AP 위치를 좁히는 것이 프로젝트의 다음 단계입니다."],
  ]
    .map(([title, body]) => insight(title, body))
    .join("");
}

function renderApPlan() {
  const dorm = currentDorm();
  const selected = apRow(dorm);
  els.apPlanLabel.textContent = dorm;
  els.apSummary.innerHTML = `
    <div class="ap-card">
      <strong>${dorm}: 권장 AP ${fmt(selected["20% 여유 포함 권장 AP"], 0)}대</strong>
      <span>인원 ${fmt(selected["인원"], 0)}명, 현재 AP ${fmt(selected["현재 AP 가정"], 0)}대 가정, 추가 설치 ${fmt(selected["추가 설치 권장"], 0)}대. ${selected["설치 요약"]}</span>
    </div>
  `;

  els.apTableBody.innerHTML = DATA.apPlan
    .map(
      (row) => `
        <tr>
          <td>${row["기숙사"]}</td>
          <td>${fmt(row["인원"], 0)}</td>
          <td>${fmt(row["20% 여유 포함 권장 AP"], 0)}</td>
          <td>${fmt(row["추가 설치 권장"], 0)}</td>
          <td>${fmt(row["AP당 실제 인원"], 1)}</td>
          <td>${row["설치 요약"] || ""}</td>
        </tr>
      `,
    )
    .join("");

  const selectedPrinciples = DATA.apPrinciples.slice(0, 6);
  els.placementList.innerHTML = [
    [`${dorm} 설치 방향`, `주거 구역 ${fmt(selected["주거 구역 배치"], 0)}대, 공용 공간 ${fmt(selected["공용 공간 배치"], 0)}대로 분리해 배치합니다. 정확한 방/복도 좌표는 실측 위험 위치가 쌓인 뒤 결정합니다.`],
    ...selectedPrinciples.map((item) => [`원칙 ${item.priority}`, item.principle]),
  ]
    .map(([title, body]) => insight(title, body))
    .join("");
}

function renderLatestMeasurement() {
  const measurements = loadMeasurements();
  const latest = measurements.at(-1);
  if (!latest) {
    els.latestStatus.textContent = "미측정";
    els.latestStatusDetail.textContent = "웹에서 측정을 실행하면 저장됩니다.";
    els.measurementStatusCard.dataset.status = "caution";
    return;
  }

  const status = statusFromScore(latest.riskScore);
  els.latestStatus.textContent = status.label;
  els.latestStatusDetail.textContent = `${latest.location} · HTTP 지연 ${fmt(latest.latencyMs)}ms · 다운로드 ${fmt(latest.downloadMbps)}Mbps`;
  els.measurementStatusCard.dataset.status = status.key;
}

function renderMeasurementResult(row) {
  if (!row) {
    els.measurementResult.textContent = "아직 측정값이 없습니다. 배포된 웹에서 실행하면 현재 위치의 접속 품질을 저장합니다.";
    return;
  }
  const status = statusFromScore(row.riskScore);
  els.measurementResult.innerHTML = `
    <div class="measurement-result-card">
      <strong class="status ${status.key}">${status.label} · 위험도 ${row.riskScore}/100</strong>
      <span>HTTP 지연 ${fmt(row.latencyMs)}ms, 지터 ${fmt(row.jitterMs)}ms, 요청 실패율 ${fmt(row.failurePct)}%, 다운로드 ${fmt(row.downloadMbps)}Mbps로 저장했습니다.</span>
    </div>
  `;
}

function renderMeasurements() {
  const measurements = loadMeasurements();
  els.measurementCount.textContent = `${fmt(measurements.length, 0)}건`;

  const recent = measurements.slice(-12).reverse();
  els.measurementTableBody.innerHTML = recent.length
    ? recent
        .map((row) => {
          const status = statusFromScore(row.riskScore);
          return `
            <tr>
              <td>${new Date(row.measuredAt).toLocaleString("ko-KR")}</td>
              <td>${row.dorm}</td>
              <td>${row.location}</td>
              <td>${fmt(row.latencyMs)}ms</td>
              <td>${fmt(row.jitterMs)}ms</td>
              <td>${fmt(row.failurePct)}%</td>
              <td>${fmt(row.downloadMbps)}Mbps</td>
              <td><strong class="status ${status.key}">${status.label}</strong></td>
            </tr>
          `;
        })
        .join("")
    : `<tr><td colspan="8">아직 저장된 측정 기록이 없습니다.</td></tr>`;

  renderZoneRanking(measurements);
  renderLatestMeasurement();
}

function renderZoneRanking(measurements) {
  if (!measurements.length) {
    els.zoneRanking.innerHTML = insight("실측 필요", "아직 위치별 측정값이 없어 엑셀의 관 단위 AP 계획만 사용할 수 있습니다. 같은 위치를 여러 시간대에 반복 측정하면 후보가 자동으로 정렬됩니다.");
    return;
  }

  const grouped = new Map();
  measurements.forEach((row) => {
    const key = `${row.dorm} ${row.location}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  });

  const ranked = [...grouped.entries()]
    .map(([key, rows]) => ({
      key,
      count: rows.length,
      avgScore: average(rows.map((row) => row.riskScore)),
      avgLatency: average(rows.map((row) => row.latencyMs)),
      avgDownload: average(rows.map((row) => row.downloadMbps)),
    }))
    .sort((a, b) => b.avgScore - a.avgScore)
    .slice(0, 5);

  els.zoneRanking.innerHTML = ranked
    .map((zone, index) => {
      const title = index === 0 ? `1순위 후보: ${zone.key}` : `${index + 1}순위: ${zone.key}`;
      return insight(title, `측정 ${fmt(zone.count, 0)}건, 평균 위험도 ${fmt(zone.avgScore, 0)}/100, 평균 HTTP 지연 ${fmt(zone.avgLatency)}ms, 평균 다운로드 ${fmt(zone.avgDownload)}Mbps입니다.`);
    })
    .join("");
}

function insight(title, body) {
  return `<div class="insight"><strong>${title}</strong><span>${body}</span></div>`;
}

function drawCharts() {
  drawRainChart();
  drawTimeChart();
}

function setupCanvas(canvas, height = 300) {
  const ctx = canvas.getContext("2d");
  const rect = canvas.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  canvas.width = Math.max(480, Math.floor(rect.width * scale));
  canvas.height = Math.floor(height * scale);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  const width = canvas.width / scale;
  const actualHeight = canvas.height / scale;
  ctx.clearRect(0, 0, width, actualHeight);
  return { ctx, width, height: actualHeight };
}

function drawRainChart() {
  const { ctx, width, height } = setupCanvas(els.rainChart, 310);
  const region = currentRegion();
  const rows = rainRows(region);
  const padding = { top: 28, right: 20, bottom: 42, left: 52 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;
  const maxDownload = Math.max(...rows.map((row) => row["다운로드 중앙값 (Mbps)"])) * 1.18;

  drawGrid(ctx, padding, plotW, plotH, maxDownload, "Mbps");

  rows.forEach((row, index) => {
    const barW = Math.min(110, plotW / 4);
    const x = padding.left + plotW * (index + 0.5) / rows.length - barW / 2;
    const barH = (row["다운로드 중앙값 (Mbps)"] / maxDownload) * plotH;
    const y = padding.top + plotH - barH;
    ctx.fillStyle = row["날씨"] === "강수" ? "#2457a6" : "#0f766e";
    ctx.fillRect(x, y, barW, barH);
    ctx.fillStyle = "#172126";
    ctx.font = "700 13px Segoe UI, sans-serif";
    ctx.fillText(`${fmt(row["다운로드 중앙값 (Mbps)"])}Mbps`, x - 2, y - 8);
    ctx.fillStyle = "#647076";
    ctx.font = "12px Segoe UI, sans-serif";
    ctx.fillText(row["날씨"], x + barW / 2 - 12, height - 18);
    ctx.fillText(`불량 ${pct(row["불량 연결 비율 (%)"])}`, x - 8, height - 4);
  });
}

function drawTimeChart() {
  const { ctx, width, height } = setupCanvas(els.timeChart, 310);
  const rows = timeRows(currentRegion());
  const padding = { top: 28, right: 20, bottom: 48, left: 52 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;
  const maxDownload = Math.max(...rows.map((row) => row["다운로드 중앙값 (Mbps)"])) * 1.18;

  drawGrid(ctx, padding, plotW, plotH, maxDownload, "Mbps");
  rows.forEach((row, index) => {
    const barW = Math.max(36, Math.min(72, plotW / rows.length - 22));
    const x = padding.left + (plotW / rows.length) * index + (plotW / rows.length - barW) / 2;
    const barH = (row["다운로드 중앙값 (Mbps)"] / maxDownload) * plotH;
    const y = padding.top + plotH - barH;
    const selected = row["시간대"] === currentTimeBand();
    ctx.fillStyle = selected ? "#b93d32" : "#0f766e";
    ctx.fillRect(x, y, barW, barH);
    ctx.fillStyle = "#172126";
    ctx.font = "700 12px Segoe UI, sans-serif";
    ctx.fillText(fmt(row["다운로드 중앙값 (Mbps)"], 0), x + 2, y - 6);
    ctx.fillStyle = "#647076";
    ctx.font = "12px Segoe UI, sans-serif";
    const label = row["시간대"].split(" ")[0];
    ctx.fillText(label, x + 2, height - 22);
    ctx.fillText(`${pct(row["불량 연결 비율 (%)"], 0)}`, x + 2, height - 6);
  });
}

function drawGrid(ctx, padding, plotW, plotH, maxValue, unit) {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.strokeStyle = "#dbe2e7";
  ctx.fillStyle = "#647076";
  ctx.font = "12px Segoe UI, sans-serif";
  [0, 0.25, 0.5, 0.75, 1].forEach((ratio) => {
    const value = maxValue * ratio;
    const y = padding.top + plotH - ratio * plotH;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(padding.left + plotW, y);
    ctx.stroke();
    ctx.fillText(`${fmt(value, 0)}${ratio === 1 ? unit : ""}`, 8, y + 4);
  });
}

async function runMeasurement() {
  setTesting(true);
  els.testProgress.textContent = "측정 중";
  try {
    const pingResults = [];
    let failures = 0;

    for (let i = 0; i < 8; i += 1) {
      const result = await measureFetch(`./ping.txt?ts=${Date.now()}-${i}`, 2500);
      if (result.ok) pingResults.push(result.ms);
      else failures += 1;
      await wait(120);
    }

    const download = await measureDownload();
    const latencyMs = average(pingResults);
    const jitterMs = stdev(pingResults);
    const failurePct = (failures / 8) * 100;

    const row = {
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      measuredAt: new Date().toISOString(),
      dorm: currentDorm(),
      location: els.locationInput.value.trim() || "미지정",
      regionReference: currentRegion(),
      timeBandReference: currentTimeBand(),
      activeUsers: Number(els.activeUsersInput.value || 0),
      rainMm: Number(els.rainInput.value || 0),
      latencyMs: Number(latencyMs.toFixed(1)),
      jitterMs: Number(jitterMs.toFixed(1)),
      failurePct: Number(failurePct.toFixed(1)),
      downloadMbps: Number(download.mbps.toFixed(1)),
      downloadedBytes: download.bytes,
      note: "정적 웹에서 측정한 HTTP 기반 품질 지표",
    };
    row.riskScore = scoreMeasurement(row);

    row.remoteSaved = false;
    const measurements = loadMeasurements();
    measurements.push(row);
    saveMeasurements(measurements);

    const remoteSaved = await saveRemoteMeasurement(row);
    if (remoteSaved) {
      row.remoteSaved = true;
      saveMeasurements(measurements);
    }

    renderMeasurementResult(row);
    renderMeasurements();
    els.testProgress.textContent = remoteSaved ? "완료·원격 저장" : "완료·로컬 저장";
  } catch (error) {
    els.testProgress.textContent = "실패";
    els.measurementResult.innerHTML = `
      <div class="measurement-result-card">
        <strong>측정 실패</strong>
        <span>정적 파일을 직접 열었거나 네트워크 요청이 차단되면 측정할 수 없습니다. Live Server, localhost 서버, 또는 배포된 주소에서 실행해 주세요.</span>
      </div>
    `;
  } finally {
    setTesting(false);
  }
}

async function saveRemoteMeasurement(row) {
  const config = loadRemoteConfig();
  if (!config.url || !config.anonKey) return false;

  try {
    const response = await fetch(`${config.url}/rest/v1/wifi_measurements`, {
      method: "POST",
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(toRemoteRow(row)),
    });
    if (!response.ok) throw new Error(`Supabase insert failed: ${response.status}`);
    els.remoteStatus.textContent = "방금 측정값을 Supabase에도 저장했습니다.";
    return true;
  } catch {
    els.remoteStatus.textContent = "Supabase 저장에 실패했습니다. 로컬에는 정상 저장됐습니다.";
    return false;
  }
}

function toRemoteRow(row) {
  return {
    id: row.id,
    measured_at: row.measuredAt,
    dorm: row.dorm,
    location: row.location,
    region_reference: row.regionReference,
    time_band_reference: row.timeBandReference,
    active_users: row.activeUsers,
    rain_mm: row.rainMm,
    latency_ms: row.latencyMs,
    jitter_ms: row.jitterMs,
    failure_pct: row.failurePct,
    download_mbps: row.downloadMbps,
    downloaded_bytes: row.downloadedBytes,
    risk_score: row.riskScore,
    note: row.note,
  };
}

function fromRemoteRow(row) {
  return {
    id: row.id,
    measuredAt: row.measured_at,
    dorm: row.dorm,
    location: row.location,
    regionReference: row.region_reference,
    timeBandReference: row.time_band_reference,
    activeUsers: Number(row.active_users || 0),
    rainMm: Number(row.rain_mm || 0),
    latencyMs: Number(row.latency_ms || 0),
    jitterMs: Number(row.jitter_ms || 0),
    failurePct: Number(row.failure_pct || 0),
    downloadMbps: Number(row.download_mbps || 0),
    downloadedBytes: Number(row.downloaded_bytes || 0),
    riskScore: Number(row.risk_score || 0),
    note: row.note || "Supabase에서 불러온 측정값",
    remoteSaved: true,
  };
}

async function syncRemoteMeasurements() {
  const config = loadRemoteConfig();
  if (!config.url || !config.anonKey) {
    els.remoteStatus.textContent = "먼저 Supabase URL과 anon key를 저장해 주세요.";
    return;
  }

  els.remoteStatus.textContent = "Supabase 기록을 불러오는 중입니다.";
  try {
    const response = await fetch(`${config.url}/rest/v1/wifi_measurements?select=*&order=measured_at.desc&limit=200`, {
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`,
      },
    });
    if (!response.ok) throw new Error(`Supabase select failed: ${response.status}`);
    const remoteRows = (await response.json()).map(fromRemoteRow);
    const merged = new Map(loadMeasurements().map((row) => [row.id, row]));
    remoteRows.forEach((row) => merged.set(row.id, row));
    saveMeasurements([...merged.values()].sort((a, b) => new Date(a.measuredAt) - new Date(b.measuredAt)));
    renderMeasurements();
    els.remoteStatus.textContent = `Supabase에서 ${remoteRows.length}건을 확인했습니다.`;
  } catch {
    els.remoteStatus.textContent = "Supabase 기록을 불러오지 못했습니다. URL, anon key, 테이블 정책을 확인해 주세요.";
  }
}

async function measureFetch(url, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const start = performance.now();
  try {
    const response = await fetch(url, { cache: "no-store", signal: controller.signal });
    await response.text();
    return { ok: response.ok, ms: performance.now() - start };
  } catch {
    return { ok: false, ms: timeoutMs };
  } finally {
    clearTimeout(timeout);
  }
}

async function measureDownload() {
  const start = performance.now();
  const response = await fetch(`./speed-test-payload.txt?ts=${Date.now()}`, { cache: "no-store" });
  const buffer = await response.arrayBuffer();
  const elapsedSeconds = Math.max((performance.now() - start) / 1000, 0.001);
  const bytes = buffer.byteLength;
  return { bytes, mbps: (bytes * 8) / elapsedSeconds / 1_000_000 };
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function setTesting(isTesting) {
  els.runTestButton.disabled = isTesting;
  els.runTestButtonBottom.disabled = isTesting;
}

function exportMeasurements() {
  const measurements = loadMeasurements();
  const payload = {
    exportedAt: new Date().toISOString(),
    source: DATA.source,
    stabilityThresholds: DATA.stability.thresholds,
    measurements,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `wifi-measurements-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function clearMeasurements() {
  localStorage.removeItem(STORAGE_KEY);
  renderMeasurementResult(null);
  renderMeasurements();
}

function renderAll() {
  renderSource();
  renderMetrics();
  renderRainInsights();
  renderTimeInsights();
  renderThresholds();
  renderConclusions();
  renderApPlan();
  renderMeasurements();
  drawCharts();
}

initControls();
initRemoteConfig();
renderAll();

[els.regionSelect, els.timeSelect, els.dormSelect].forEach((control) => {
  control.addEventListener("change", renderAll);
});

els.runTestButton.addEventListener("click", runMeasurement);
els.runTestButtonBottom.addEventListener("click", runMeasurement);
els.exportButton.addEventListener("click", exportMeasurements);
els.clearButton.addEventListener("click", clearMeasurements);
els.saveRemoteButton.addEventListener("click", saveRemoteConfig);
els.syncRemoteButton.addEventListener("click", syncRemoteMeasurements);
window.addEventListener("resize", drawCharts);
