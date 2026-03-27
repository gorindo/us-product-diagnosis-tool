// Scroll back to the input panel and focus the first field
function scrollToInput() {
  document.querySelector('.input-panel').scrollIntoView({ behavior: 'smooth' });
  setTimeout(function () { document.getElementById('f-name').focus(); }, 400);
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

  // Emotional score label (4 bands)
  var scoreColor, scoreLabel;
  if (score <= 30) {
    scoreColor = '#dc2626'; scoreLabel = 'ほぼ売れません';
  } else if (score <= 60) {
    scoreColor = '#d97706'; scoreLabel = '改善すれば売れる可能性あり';
  } else if (score <= 80) {
    scoreColor = '#2563eb'; scoreLabel = '売れる可能性があります';
  } else {
    scoreColor = '#16a34a'; scoreLabel = 'かなり売れる状態です';
  }

  // Improvement impact sentence (shown from the 2nd run onward)
  var impactHTML = '';
  if (window.__prevDiagnosisScore !== undefined) {
    var delta = score - window.__prevDiagnosisScore;
    if (delta > 0) {
      impactHTML =
        '<p style="margin:10px 0 0; font-size:0.85rem; font-weight:800; color:#16a34a; background:#dcfce7; display:inline-block; padding:4px 14px; border-radius:20px; letter-spacing:0.02em;">' +
          '今回の改善で ＋' + delta + ' 向上しました' +
        '</p>';
    } else if (delta < 0) {
      impactHTML =
        '<p style="margin:10px 0 0; font-size:0.85rem; font-weight:800; color:#dc2626; background:#fee2e2; display:inline-block; padding:4px 14px; border-radius:20px; letter-spacing:0.02em;">' +
          '今回は ' + delta + ' 下がりました' +
        '</p>';
    }
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
    // ── 1. Score section ──────────────────────────────────────────────
    '<div style="text-align:center; padding:22px 18px 20px; background:linear-gradient(135deg,#f9fafb 0%,#eff6ff 100%); border:1px solid #e5e7eb; border-radius:14px;">' +
      '<p style="margin:0 0 8px; font-size:0.63rem; font-weight:800; letter-spacing:0.14em; text-transform:uppercase; color:#9ca3af;">売れる可能性スコア</p>' +
      '<p style="margin:0 0 6px; line-height:1;">' +
        '<span style="font-size:3.2rem; font-weight:900; color:' + scoreColor + ';">' + score + '</span>' +
        '<span style="font-size:1.05rem; font-weight:600; color:#b0b8c4; margin-left:4px;">/ 100</span>' +
      '</p>' +
      '<p style="margin:0; font-size:0.95rem; font-weight:800; color:' + scoreColor + ';">' + scoreLabel + '</p>' +
      impactHTML +
    '</div>' +

    // ── 2. Before → After comparison ─────────────────────────────────
    '<div>' +
      '<p style="margin:0 0 10px; font-size:0.72rem; font-weight:700; letter-spacing:0.05em; color:#9ca3af; text-align:center;">改善前 → 改善後</p>' +
      '<div style="display:flex; gap:10px; align-items:stretch;">' +

        // BEFORE box — rough sentence, intentionally muted
        '<div style="flex:1; min-width:0;">' +
          '<p style="margin:0 0 5px; font-size:0.58rem; font-weight:800; letter-spacing:0.12em; text-transform:uppercase; color:#9ca3af;">BEFORE</p>' +
          '<div style="height:100%; box-sizing:border-box; background:#f3f4f6; border:1px solid #e5e7eb; border-radius:8px; padding:12px 13px; font-size:0.82rem; color:#9ca3af; line-height:1.7; word-break:break-word;">' +
            escapedSentence +
          '</div>' +
        '</div>' +

        // Arrow divider
        '<div style="display:flex; align-items:center; flex-shrink:0; padding-top:20px; color:#d1d5db; font-size:1.1rem;">→</div>' +

        // AFTER box — punchy bullets, visually dominant
        '<div style="flex:1.3; min-width:0;">' +
          '<p style="margin:0 0 5px; font-size:0.58rem; font-weight:800; letter-spacing:0.12em; text-transform:uppercase; color:#2563eb;">AFTER</p>' +
          '<div style="background:#eff6ff; border:2px solid #3b82f6; border-radius:8px; padding:13px 14px; word-break:break-word; box-shadow:0 2px 10px rgba(37,99,235,0.12);">' +
            renderAfterCopy(result.rewritten_copy) +
          '</div>' +
        '</div>' +

      '</div>' +
    '</div>' +

    // ── 3. Improvements ───────────────────────────────────────────────
    '<div class="result-block" style="order:5;">' +
      '<h3>改善ポイント</h3>' +
      '<ul style="margin:0; padding:0;">' + improvementsHTML + '</ul>' +
    '</div>' +

    // ── 4. 次にやると、もっと売れる ────────────────────────────────────
    '<div style="padding:22px 22px 20px; background:linear-gradient(135deg,#eff6ff 0%,#f0fdf4 100%); border:1px solid #bfdbfe; border-radius:14px;">' +
      '<p style="margin:0 0 16px; font-size:1rem; font-weight:900; color:#1e3a8a; line-height:1.35;">次にやると、もっと売れる</p>' +
      '<ul style="margin:0; padding:0; list-style:none; display:flex; flex-direction:column; gap:13px;">' +
        '<li style="display:flex; align-items:flex-start; gap:11px;">' +
          '<span style="flex-shrink:0; width:22px; height:22px; background:#2563eb; color:#fff; border-radius:50%; font-size:0.62rem; font-weight:800; display:flex; align-items:center; justify-content:center; margin-top:1px;">1</span>' +
          '<span style="font-size:0.875rem; color:#1e40af; line-height:1.65;">ターゲットを<strong>1人</strong>に絞ると、<strong>刺さります</strong></span>' +
        '</li>' +
        '<li style="display:flex; align-items:flex-start; gap:11px;">' +
          '<span style="flex-shrink:0; width:22px; height:22px; background:#2563eb; color:#fff; border-radius:50%; font-size:0.62rem; font-weight:800; display:flex; align-items:center; justify-content:center; margin-top:1px;">2</span>' +
          '<span style="font-size:0.875rem; color:#1e40af; line-height:1.65;">数字を入れると、<strong>信頼されます</strong></span>' +
        '</li>' +
        '<li style="display:flex; align-items:flex-start; gap:11px;">' +
          '<span style="flex-shrink:0; width:22px; height:22px; background:#2563eb; color:#fff; border-radius:50%; font-size:0.62rem; font-weight:800; display:flex; align-items:center; justify-content:center; margin-top:1px;">3</span>' +
          '<span style="font-size:0.875rem; color:#1e40af; line-height:1.65;">用途を限定すると、<strong>購入されやすくなります</strong></span>' +
        '</li>' +
      '</ul>' +
    '</div>' +

    // ── 5. Loop trigger ───────────────────────────────────────────────
    '<div style="text-align:center;">' +
      '<button onclick="scrollToInput()"' +
        ' style="width:100%; padding:17px 20px; background:#2563eb; color:#fff; font-size:1rem; font-weight:800; border:none; border-radius:10px; cursor:pointer; letter-spacing:0.04em; box-shadow:0 4px 16px rgba(37,99,235,0.28);"' +
        ' onmouseover="this.style.background=\'#1d4ed8\'; this.style.boxShadow=\'0 6px 22px rgba(37,99,235,0.38)\'"' +
        ' onmouseout="this.style.background=\'#2563eb\'; this.style.boxShadow=\'0 4px 16px rgba(37,99,235,0.28)\'">' +
        'もう一度改善する' +
      '</button>' +
      '<p style="margin:10px 0 0; font-size:0.82rem; color:#6b7280; font-weight:500;">あと1回で、売れる文章に近づきます</p>' +
    '</div>' +

    // ── Score detail (secondary, de-emphasised) ───────────────────────
    '<div class="result-block" style="order:6; opacity:0.65;">' +
      '<p class="total-score">Total Score: <strong>' + score + ' / 100</strong></p>' +
      '<ul class="score-list">' + scoresHTML + '</ul>' +
    '</div>'
  );
}

document.getElementById("diagnoseButton").addEventListener("click", async function () {
  var input = document.getElementById("productInput").value.trim();
  var resultArea = document.getElementById("resultArea");

  if (!input) {
    alert("商品説明を入力してください。");
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
