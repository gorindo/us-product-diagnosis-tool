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

  var priorityLabels = ["最優先：", "次：", "最後："];
  var improvementsHTML = "";
  for (var j = 0; j < result.improvements.length; j++) {
    var prefix = priorityLabels[Math.min(j, priorityLabels.length - 1)];
    improvementsHTML += "<li><strong>" + prefix + "</strong>" + result.improvements[j] + "</li>";
  }

  return (
    // Warning — default flex order 0, appears first
    '<p style="margin:0; font-size:0.9rem; font-weight:700; color:#dc2626;">このままでは売れません</p>' +

    // BEFORE block
    '<div class="result-block" style="order:0; background:#f3f4f6; border:1px solid #e5e7eb; border-radius:8px; padding:12px 14px;">' +
      '<p style="margin:0 0 6px; font-size:0.68rem; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:#9ca3af;">あなたの文章（Before）</p>' +
      '<p style="margin:0; font-size:0.875rem; color:#6b7280; line-height:1.6; white-space:pre-wrap; word-break:break-word;">' + escaped + '</p>' +
    '</div>' +

    // AFTER block — dominant, styled by :has(.rewritten-copy) in CSS
    '<div class="result-block" style="order:1;">' +
      '<h3>Rewritten English Copy Sample</h3>' +
      '<p class="rewritten-copy">' + result.rewritten_copy + '</p>' +
    '</div>' +

    // Improvements block — priority-labelled
    '<div class="result-block" style="order:2;">' +
      '<h3>Suggested Improvements</h3>' +
      '<ul>' + improvementsHTML + '</ul>' +
    '</div>' +

    // Score block — last
    '<div class="result-block" style="order:3;">' +
      '<p class="total-score">Total Score: <strong>' + result.total_score + ' / 100</strong></p>' +
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
