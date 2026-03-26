// Builds the result HTML from the JSON returned by the server
function buildResultHTML(result) {
  // Scores: clarity, trust, benefit, us_fit, purchase_motivation
  var scoresHTML = "";
  for (var key in result.scores) {
    var label = key.replace(/_/g, " ");
    scoresHTML +=
      "<li><strong>" + label + ":</strong> " + result.scores[key] + "</li>";
  }

  var ngHTML = "";
  for (var i = 0; i < result.ng_points.length; i++) {
    ngHTML += "<li>" + result.ng_points[i] + "</li>";
  }

  var improvementsHTML = "";
  for (var j = 0; j < result.improvements.length; j++) {
    improvementsHTML += "<li>" + result.improvements[j] + "</li>";
  }

  return (
    '<div class="result-block">' +
      '<p class="total-score">Total Score: <strong>' + result.total_score + ' / 100</strong></p>' +
      '<ul class="score-list">' + scoresHTML + "</ul>" +
    "</div>" +

    '<div class="result-block">' +
      "<h3>Verdict</h3>" +
      "<p><strong>" + result.summary.verdict + "</strong> — " + result.summary.one_line_diagnosis + "</p>" +
    "</div>" +

    '<div class="result-block">' +
      "<h3>NG Points</h3>" +
      "<ul>" + ngHTML + "</ul>" +
    "</div>" +

    '<div class="result-block">' +
      "<h3>Suggested Improvements</h3>" +
      "<ul>" + improvementsHTML + "</ul>" +
    "</div>" +

    '<div class="result-block">' +
      "<h3>Rewritten English Copy Sample</h3>" +
      '<p class="rewritten-copy">' + result.rewritten_copy + "</p>" +
    "</div>"
  );
}

document.getElementById("diagnoseButton").addEventListener("click", async function () {
  var input = document.getElementById("productInput").value.trim();
  var resultArea = document.getElementById("resultArea");

  // Guard: require input before sending
  if (!input) {
    alert("Please enter a product description before running the diagnosis.");
    return;
  }

  // Show a loading message while waiting for the server
  resultArea.innerHTML = "<p>Analyzing...</p>";

  try {
    console.log("[debug] Fetch started");

    // Use the full URL to avoid any path resolution issues
    var response = await fetch("http://127.0.0.1:5000/diagnose", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_description: input })
    });

    console.log("[debug] Response status:", response.status);

    var data = await response.json();

    if (response.ok) {
      // Success — render the diagnosis result
      resultArea.innerHTML = buildResultHTML(data);
    } else {
      // Backend returned an error — show the real message from the server
      var errorMessage = (data && data.error) ? data.error : "Something went wrong.";
      console.log("[debug] Parsed error body:", errorMessage);
      resultArea.innerHTML =
        "<p style='color:#c0392b;'>Error: " + errorMessage + "</p>";
    }
  } catch (err) {
    // Only shown if fetch itself fails (server not running, network issue)
    console.log("[debug] Fetch error:", err);
    resultArea.innerHTML =
      "<p style='color:#c0392b;'>Could not reach the server. Make sure Flask is running.</p>";
  }
});
