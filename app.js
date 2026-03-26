// Builds the result HTML from the JSON returned by the server
function buildResultHTML(result, beforeText) {
  // Escape user input for safe HTML insertion
  var escaped = (beforeText || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  var scoresHTML = "";
  for (var key in result.scores) {
    var label = key.replace(/_/g, " ");
    scoresHTML +=
      "<li><strong>" + label + ":</strong> " + result.scores[key] + "</li>";
  }

  var priorityLabels = ["最優先", "次", "最後"];
  var improvementsHTML = "";
  for (var j = 0; j < result.improvements.length; j++) {
    var prefix = priorityLabels[Math.min(j, priorityLabels.length - 1)];
    improvementsHTML +=
      '<li style="list-style:none; margin-bottom:8px; padding:10px 14px; background:#fafafa; border-left:3px solid #e5e7eb; border-radius:0 6px 6px 0;">' +
        '<span style="display:block; font-size:0.62rem; font-weight:700; letter-spacing:0.09em; text-transform:uppercase; color:#9ca3af; margin-bottom:4px;">' + prefix + '</span>' +
        '<span style="font-size:0.875rem; color:#374151; line-height:1.6;">' + result.improvements[j] + '</span>' +
      '</li>';
  }

  var score = result.total_score;
  var scoreColor = score >= 70 ? "#16a34a" : score >= 50 ? "#d97706" : "#dc2626";
  var scoreVerdict = score >= 70 ? "このレベルなら販売可能です" : score >= 50 ? "改善すれば売れる可能性があります" : "このままでは売れません";

  // CSS nth-child rules target .result-block children at positions 4 & 5 in this new DOM.
  // Override with explicit inline order values so CSS ordering is neutralised.
  return (
    // ── Score banner (child 1, not .result-block, order:0 default) ──
    '<div style="display:flex; align-items:center; gap:16px; padding:14px 18px; background:#f9fafb; border:1px solid #e5e7eb; border-radius:8px;">' +
      '<div style="flex-shrink:0;">' +
        '<p style="margin:0 0 2px; font-size:0.62rem; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; color:#9ca3af;">販売スコア</p>' +
        '<p style="margin:0; line-height:1;"><span style="font-size:2rem; font-weight:800; color:' + scoreColor + ';">' + score + '</span><span style="font-size:0.85rem; font-weight:600; color:#b0b8c4;"> / 100</span></p>' +
      '</div>' +
      '<div style="width:1px; height:36px; background:#e5e7eb; flex-shrink:0;"></div>' +
      '<p style="margin:0; font-size:0.875rem; font-weight:700; color:' + scoreColor + '; line-height:1.4;">' + scoreVerdict + '</p>' +
    '</div>' +

    // ── BEFORE (child 2, not .result-block, order:0 default) ──
    '<div>' +
      '<p style="margin:0 0 6px; font-size:0.68rem; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:#9ca3af;">あなたの文章（Before）</p>' +
      '<div style="background:#f3f4f6; border:1px solid #e5e7eb; border-radius:8px; padding:14px 16px; font-size:0.875rem; color:#6b7280; line-height:1.7; white-space:pre-wrap; word-break:break-word;">' + escaped + '</div>' +
    '</div>' +

    // ── Arrow (child 3, not .result-block, order:0 default) ──
    '<p style="margin:0; text-align:center; font-size:1.1rem; color:#d1d5db; line-height:1;">↓</p>' +

    // ── AFTER (child 4, .result-block — CSS applies order:2, overridden to 4) ──
    // h3 hidden so CSS ::before label is suppressed; custom label shown instead
    '<div class="result-block" style="order:4;">' +
      '<h3 style="display:none;">Rewritten English Copy Sample</h3>' +
      '<p style="margin:0 0 10px; font-size:0.72rem; font-weight:800; letter-spacing:0.08em; text-transform:uppercase; color:#2563eb;">このレベルなら販売可能</p>' +
      '<p class="rewritten-copy">' + result.rewritten_copy + '</p>' +
    '</div>' +

    // ── Improvements (child 5, .result-block — CSS applies order:1, overridden to 5) ──
    '<div class="result-block" style="order:5;">' +
      '<h3>Suggested Improvements</h3>' +
      '<ul style="margin:0; padding:0;">' + improvementsHTML + '</ul>' +
    '</div>' +

    // ── Score detail (child 6, .result-block — no CSS rule, explicit order:6) ──
    '<div class="result-block" style="order:6;">' +
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

  // Update BEFORE zone with the user's actual input
  document.getElementById("beforeText").textContent = input;

  // Switch to loading state — clears sample content and shows progress
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

    if (response.ok) {
      // Render result and switch to live state
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
