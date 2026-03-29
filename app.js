// Insert improved text into the main textarea, scroll to it, and highlight briefly
function scrollToInput() {
  var textarea = document.getElementById('f-original-text');
  var rewritten = document.querySelector('.rewritten-copy');
  if (textarea && rewritten) {
    textarea.value = rewritten.innerText.trim();
    textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(function () {
      textarea.classList.add('text-inserted');
      textarea.focus();
      setTimeout(function () { textarea.classList.remove('text-inserted'); }, 1500);
    }, 400);
    // State 3: left becomes primary again, right becomes secondary
    var diagBtn = document.getElementById('diagnoseButton');
    var ctaBtn = document.getElementById('ctaBtn');
    if (diagBtn) diagBtn.classList.remove('is-secondary');
    if (ctaBtn) ctaBtn.classList.add('cta-secondary');
  } else {
    document.querySelector('.input-panel').scrollIntoView({ behavior: 'smooth' });
    setTimeout(function () { if (textarea) textarea.focus(); }, 400);
  }
}

// Best-effort rewrite of diagnostic messages into imperative form
function toImperative(text) {
  var rules = [
    [/ターゲットが曖昧です/, 'ターゲットを1つに絞ってください'],
    [/ベネフィットが弱いです/, 'ベネフィットを具体的に書いてください'],
    [/数値が(ない|含まれていません|不足しています)/, '数値を必ず入れてください'],
    [/用途が(広すぎます|不明確です|曖昧です)/, '用途を限定してください'],
    [/(.+?)が曖昧です$/, '$1を明確にしてください'],
    [/(.+?)が弱いです$/, '$1を具体的に書いてください'],
    [/(.+?)が不足しています$/, '$1を追加してください'],
    [/(.+?)が必要です$/, '$1を追加してください'],
    [/(.+?)がありません$/, '$1を書いてください'],
    [/(.+?)が不明確です$/, '$1を明確にしてください'],
  ];
  for (var i = 0; i < rules.length; i++) {
    if (rules[i][0].test(text)) {
      return text.replace(rules[i][0], rules[i][1]);
    }
  }
  return text;
}

// Build a rough, intentionally plain Japanese sentence from structured field input.
// Keeps BEFORE feeling weak so the contrast with AFTER lands harder.
function buildBeforeSentence(rawText) {
  var fields = {};
  var lines = rawText.split('\n');
  for (var i = 0; i < lines.length; i++) {
    var idx = lines[i].indexOf('：');
    if (idx > -1) {
      fields[lines[i].slice(0, idx).trim()] = lines[i].slice(idx + 1).trim();
    }
  }

  var parts = [];
  if (fields['商品名']) parts.push(fields['商品名'] + 'です。');
  if (fields['特徴'])   parts.push(fields['特徴'] + 'です。');
  if (fields['使用シーン']) parts.push(fields['使用シーン'] + 'に使えます。');
  if (fields['ターゲット']) parts.push(fields['ターゲット'] + '向けです。');

  // Show max 2 sentences — keeps it short and weak-feeling
  var sentence = parts.slice(0, 2).join('');
  return sentence ? '「' + sentence + '」' : '「' + (lines[0] || rawText) + '」';
}

// Split English copy into up to 4 sentences and render as scannable bullets (3+ sentences)
// or a single paragraph (1-2 sentences). Keeps .rewritten-copy on the container for the
// copy button to capture innerText correctly.
function renderAfterCopy(text) {
  // Trim to 3-5 sentences maximum
  var sentenceRx = /[^.!?]+[.!?]+["']?/g;
  var matches = text.match(sentenceRx) || [];
  var sentences = [];
  for (var i = 0; i < matches.length && i < 4; i++) {
    var s = matches[i].trim();
    if (s) sentences.push(s);
  }
  // Fallback: nothing matched (no terminal punctuation)
  if (sentences.length === 0) sentences = [text.trim()];

  if (sentences.length <= 2) {
    return (
      '<p class="rewritten-copy" style="margin:0; font-size:0.9rem; font-weight:600; color:#1e3a8a; line-height:1.8;">' +
        sentences.join(' ') +
      '</p>'
    );
  }

  var items = '';
  for (var j = 0; j < sentences.length; j++) {
    items +=
      '<li style="display:flex; align-items:flex-start; gap:8px; margin-bottom:8px;">' +
        '<span style="flex-shrink:0; color:#3b82f6; font-weight:800; margin-top:1px;">›</span>' +
        '<span>' + sentences[j] + '</span>' +
      '</li>';
  }
  return (
    '<ul class="rewritten-copy" style="margin:0; padding:0; list-style:none; font-size:0.88rem; font-weight:600; color:#1e3a8a; line-height:1.75;">' +
      items +
    '</ul>'
  );
}

// Builds the result HTML from the JSON returned by the server
function buildResultHTML(result, beforeText) {
  var score = result.total_score;

  // Score label + diagnosis label (4 bands)
  var scoreColor, scoreLabel, diagnosisLabel, diagnosisLabelColor, diagnosisLabelBg;
  if (score <= 30) {
    scoreColor = '#dc2626'; scoreLabel = '訴求力が低い状態です';
    diagnosisLabel = '訴求不足（改善余地 大）'; diagnosisLabelColor = '#dc2626'; diagnosisLabelBg = '#fef2f2';
  } else if (score <= 60) {
    scoreColor = '#d97706'; scoreLabel = '改善余地が確認されます';
    diagnosisLabel = '要改善'; diagnosisLabelColor = '#d97706'; diagnosisLabelBg = '#fffbeb';
  } else if (score <= 80) {
    scoreColor = '#2563eb'; scoreLabel = '訴求力は十分な水準です';
    diagnosisLabel = '良好'; diagnosisLabelColor = '#2563eb'; diagnosisLabelBg = '#eff6ff';
  } else {
    scoreColor = '#16a34a'; scoreLabel = '高い訴求力が確認されます';
    diagnosisLabel = '優秀'; diagnosisLabelColor = '#16a34a'; diagnosisLabelBg = '#f0fdf4';
  }

  // Score display: show before → after change when a previous score exists
  var scoreDisplayHTML;
  if (window.__prevDiagnosisScore !== undefined) {
    var prev = window.__prevDiagnosisScore;
    var delta = score - prev;
    var deltaStr = (delta > 0 ? '+' : '') + delta;
    var deltaColor = delta > 0 ? '#2563eb' : (delta < 0 ? '#dc2626' : '#9ca3af');
    var deltaBg   = delta > 0 ? '#eff6ff'  : (delta < 0 ? '#fef2f2'  : '#f3f4f6');
    scoreDisplayHTML =
      '<div style="display:flex; align-items:baseline; justify-content:center; gap:10px; margin-bottom:8px;">' +
        '<span style="font-size:1.6rem; font-weight:700; color:#d1d5db; line-height:1;">' + prev + '</span>' +
        '<span style="font-size:1rem; color:#d1d5db;">→</span>' +
        '<span style="font-size:3.2rem; font-weight:900; color:' + scoreColor + '; line-height:1;">' + score + '</span>' +
        '<span style="font-size:0.95rem; font-weight:500; color:#b0b8c4; line-height:1;">/ 100</span>' +
      '</div>' +
      '<p style="margin:0 0 10px;">' +
        '<span style="display:inline-block; padding:3px 12px; background:' + deltaBg + '; border-radius:20px; font-size:0.82rem; font-weight:700; color:' + deltaColor + ';">' +
          deltaStr + ' ポイントの変化' +
        '</span>' +
      '</p>';
  } else {
    scoreDisplayHTML =
      '<p style="margin:0 0 8px; line-height:1;">' +
        '<span style="font-size:3.2rem; font-weight:900; color:' + scoreColor + ';">' + score + '</span>' +
        '<span style="font-size:1.05rem; font-weight:600; color:#b0b8c4; margin-left:4px;">/ 100</span>' +
      '</p>';
  }
  window.__prevDiagnosisScore = score;

  // BEFORE: rough sentence version
  var beforeSentence = buildBeforeSentence(beforeText || '');
  var escapedSentence = beforeSentence
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Improvements list
  var priorityLabels = ["最優先", "次", "最後"];
  var improvementsHTML = "";
  for (var j = 0; j < result.improvements.length; j++) {
    var prefix = priorityLabels[Math.min(j, priorityLabels.length - 1)];
    var msg = toImperative(result.improvements[j]);
    improvementsHTML +=
      '<li style="list-style:none; margin-bottom:8px; padding:10px 14px; background:#fafafa; border-left:3px solid #e5e7eb; border-radius:0 6px 6px 0;">' +
        '<span style="display:block; font-size:0.6rem; font-weight:800; letter-spacing:0.1em; text-transform:uppercase; color:#9ca3af; margin-bottom:4px;">' + prefix + '</span>' +
        '<span style="font-size:0.875rem; color:#374151; line-height:1.6;">' + msg + '</span>' +
      '</li>';
  }

  // Score detail breakdown
  var scoresHTML = "";
  for (var key in result.scores) {
    scoresHTML += "<li><strong>" + key.replace(/_/g, " ") + ":</strong> " + result.scores[key] + "</li>";
  }

  return (
    // ── 1. この文章が売れない主な原因（AI改善ポイント）────────────────
    '<div class="result-block">' +
      '<p style="margin:0 0 4px; font-size:0.62rem; font-weight:800; letter-spacing:0.12em; text-transform:uppercase; color:#9ca3af;">この文章が売れない主な原因</p>' +
      '<ul style="margin:0; padding:0;">' + improvementsHTML + '</ul>' +
    '</div>' +

    // ── 2. Score section ──────────────────────────────────────────────
    '<div style="text-align:center; padding:22px 18px 20px; background:linear-gradient(135deg,#f9fafb 0%,#eff6ff 100%); border:1px solid #e5e7eb; border-radius:14px;">' +
      '<p style="margin:0 0 10px;">' +
        '<span style="display:inline-block; padding:4px 14px; background:' + diagnosisLabelBg + '; border-radius:6px; font-size:0.8rem; font-weight:800; color:' + diagnosisLabelColor + '; letter-spacing:0.02em;">' +
          '診断結果：' + diagnosisLabel +
        '</span>' +
      '</p>' +
      '<p style="margin:0 0 6px; font-size:0.63rem; font-weight:800; letter-spacing:0.14em; text-transform:uppercase; color:#9ca3af;">訴求力スコア</p>' +
      scoreDisplayHTML +
      '<p style="margin:0; font-size:0.9rem; font-weight:700; color:' + scoreColor + ';">' + scoreLabel + '</p>' +
    '</div>' +

    // ── 3. Before → After（改善後の例）───────────────────────────────
    '<div>' +
      '<p style="margin:0 0 12px; font-size:0.7rem; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:#9ca3af; text-align:center;">Before → After</p>' +
      '<div style="display:flex; gap:12px; align-items:stretch;">' +

        // BEFORE box — muted, secondary
        '<div style="flex:1; min-width:0;">' +
          '<p style="margin:0 0 6px; font-size:0.6rem; font-weight:800; letter-spacing:0.12em; text-transform:uppercase; color:#9ca3af;">入力内容</p>' +
          '<div style="height:100%; box-sizing:border-box; background:#f3f4f6; border:1px solid #e5e7eb; border-radius:8px; padding:12px 13px; font-size:0.82rem; color:#9ca3af; line-height:1.75; word-break:break-word;">' +
            escapedSentence +
          '</div>' +
        '</div>' +

        // Arrow divider
        '<div style="display:flex; align-items:center; flex-shrink:0; padding-top:22px; color:#d1d5db; font-size:1.1rem;">→</div>' +

        // AFTER box — dominant
        '<div style="flex:1.3; min-width:0;">' +
          '<p style="margin:0 0 6px; font-size:0.6rem; font-weight:800; letter-spacing:0.12em; text-transform:uppercase; color:#2563eb;">改善後</p>' +
          '<p style="margin:0 0 9px; font-size:0.75rem; color:#6b7280; line-height:1.55;">曖昧だった特徴を具体化し、購買判断に必要な情報を補っています</p>' +
          '<div style="background:#eff6ff; border:2px solid #3b82f6; border-radius:8px; padding:13px 14px; word-break:break-word; box-shadow:0 2px 10px rgba(37,99,235,0.12);">' +
            renderAfterCopy(result.rewritten_copy) +
          '</div>' +
        '</div>' +

      '</div>' +
    '</div>' +

    // ── 4. Loop trigger ───────────────────────────────────────────────
    '<div style="text-align:center;">' +
      '<button id="ctaBtn" onclick="scrollToInput()"' +
        ' style="width:100%; padding:17px 20px; background:#2563eb; color:#fff; font-size:1rem; font-weight:800; border:none; border-radius:10px; cursor:pointer; letter-spacing:0.04em; box-shadow:0 4px 16px rgba(37,99,235,0.28);"' +
        ' onmouseover="this.style.background=\'#1d4ed8\'; this.style.boxShadow=\'0 6px 22px rgba(37,99,235,0.38)\'"' +
        ' onmouseout="this.style.background=\'#2563eb\'; this.style.boxShadow=\'0 4px 16px rgba(37,99,235,0.28)\'">' +
        '改善案を入力欄に反映する' +
      '</button>' +
      '<p style="margin:8px 0 0; font-size:0.8rem; color:#6b7280;">※この内容をもとに、より売れる文章に改善できます</p>' +
    '</div>' +

    // ── Score detail (secondary, de-emphasised) ───────────────────────
    '<div class="result-block" style="order:6; opacity:0.65;">' +
      '<p class="total-score">Total Score: <strong>' + score + ' / 100</strong></p>' +
      '<ul class="score-list">' + scoresHTML + '</ul>' +
    '</div>'
  );
}

var DEV_MODE = window.location.search.includes("dev=true");

document.getElementById("diagnoseButton").addEventListener("click", async function () {
  var input = document.getElementById("productInput").value.trim();
  var resultArea = document.getElementById("resultArea");

  if (!input) {
    alert("商品説明を入力してください。");
    return;
  }

  var usageCount = parseInt(localStorage.getItem("diagnosisUsageCount") || "0", 10);
  if (!DEV_MODE && usageCount >= 2) {
    alert("無料版は2回までです。続きは次のアップデートで解放されます。");
    return;
  }

  document.getElementById("beforeText").textContent = input;

  resultArea.dataset.state = "loading";
  resultArea.innerHTML = "<p>診断中...</p>";

  try {
    console.log("[debug] Fetch started");

    var response = await fetch("http://127.0.0.1:5000/diagnose", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_description: input })
    });

    console.log("[debug] Response status:", response.status);

    var data = await response.json();

    if (response.ok && data.parse_error) {
      // Claude returned something but it wasn't valid JSON — show raw text
      var safeRaw = (data.raw_text || "（内容なし）")
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      resultArea.innerHTML =
        '<div style="padding:16px; background:#fffbeb; border:1px solid #fbbf24; border-radius:8px;">' +
          '<p style="margin:0 0 8px; font-size:0.8rem; font-weight:700; color:#92400e;">⚠ レスポンスの解析に失敗しました（生テキストを表示しています）</p>' +
          '<pre style="margin:0; font-size:0.8rem; color:#374151; white-space:pre-wrap; word-break:break-word;">' + safeRaw + '</pre>' +
        '</div>';
      resultArea.dataset.state = "error";
    } else if (response.ok) {
      resultArea.innerHTML = buildResultHTML(data, input);
      resultArea.dataset.state = "live";
      localStorage.setItem("diagnosisUsageCount", usageCount + 1);
      var diagBtn = document.getElementById("diagnoseButton");
      diagBtn.textContent = "再分析する";
      diagBtn.classList.add("is-secondary");
      // State 2: right CTA is primary — ensure it has no secondary class
      var ctaBtn = document.getElementById("ctaBtn");
      if (ctaBtn) ctaBtn.classList.remove("cta-secondary");
    } else {
      var errorMessage = (data && data.error) ? data.error : "Something went wrong.";
      console.log("[debug] Parsed error body:", errorMessage);
      resultArea.innerHTML = "<p class='result-error'>Error: " + errorMessage + "</p>";
      resultArea.dataset.state = "error";
    }
  } catch (err) {
    console.log("[debug] Fetch error:", err);
    resultArea.innerHTML = "<p class='result-error'>サーバーに接続できません。Flaskが起動しているか確認してください。</p>";
    resultArea.dataset.state = "error";
  }
});
