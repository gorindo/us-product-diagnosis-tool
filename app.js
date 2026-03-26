var mockResult = {
  totalScore: 72,
  scores: {
    Clarity: 15,
    Trust: 13,
    Benefit: 14,
    "US Fit": 16,
    "Purchase Motivation": 14
  },
  verdict: "Promising but needs stronger trust and benefit communication.",
  ngPoints: [
    "Lacks specific proof points or social validation (reviews, certifications, data).",
    "Benefit language is vague — readers can't quickly grasp what makes this product unique.",
    "The copy doesn't address common US buyer objections (returns, safety, quality guarantees)."
  ],
  improvements: [
    "Add concrete evidence: customer reviews, third-party certifications, or usage statistics.",
    "Lead with the clearest, most tangible benefit in the first sentence.",
    "Include a trust signal such as a satisfaction guarantee or a well-known endorsement."
  ],
  rewrittenCopy: "Trusted by over 10,000 customers — our product delivers [key benefit] in just [timeframe]. Backed by a 30-day satisfaction guarantee and certified by [authority]. See why US shoppers rate it 4.8 out of 5 stars."
};

function buildResultHTML(result) {
  var scoresHTML = "";
  for (var category in result.scores) {
    scoresHTML +=
      "<li><strong>" + category + ":</strong> " + result.scores[category] + "</li>";
  }

  var ngHTML = "";
  for (var i = 0; i < result.ngPoints.length; i++) {
    ngHTML += "<li>" + result.ngPoints[i] + "</li>";
  }

  var improvementsHTML = "";
  for (var j = 0; j < result.improvements.length; j++) {
    improvementsHTML += "<li>" + result.improvements[j] + "</li>";
  }

  return (
    '<div class="result-block">' +
      '<p class="total-score">Total Score: <strong>' + result.totalScore + ' / 100</strong></p>' +
      '<ul class="score-list">' + scoresHTML + "</ul>" +
    "</div>" +

    '<div class="result-block">' +
      "<h3>Verdict</h3>" +
      "<p>" + result.verdict + "</p>" +
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
      '<p class="rewritten-copy">' + result.rewrittenCopy + "</p>" +
    "</div>"
  );
}

document.getElementById("diagnoseButton").addEventListener("click", function () {
  var input = document.getElementById("productInput").value.trim();

  if (!input) {
    alert("Please enter a product description before running the diagnosis.");
    return;
  }

  var resultArea = document.getElementById("resultArea");
  resultArea.innerHTML = buildResultHTML(mockResult);
});
