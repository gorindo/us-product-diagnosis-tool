import os
import json
from pathlib import Path
from flask import Flask, request, jsonify, send_from_directory
from dotenv import load_dotenv
import anthropic

# Always load .env from the same folder as app.py, regardless of where the terminal started
BASE_DIR = Path(__file__).parent
dotenv_path = BASE_DIR / ".env"

print(f"[debug] .env path: {dotenv_path}")
print(f"[debug] .env found: {dotenv_path.exists()}")

load_dotenv(dotenv_path=dotenv_path)

print(f"[debug] ANTHROPIC_API_KEY present: {bool(os.environ.get('ANTHROPIC_API_KEY'))}")

app = Flask(__name__)
BASE_DIR = str(BASE_DIR)  # keep as string for send_from_directory

SYSTEM_PROMPT = """You are a professional US-market product listing evaluator for Japanese sellers.

Your job is to evaluate whether a product description written by a Japanese seller is likely to sell in the US market.

You are NOT a generic writer.
You are NOT a translator.
You are NOT a brainstorming assistant.

You must act like a strict conversion-focused evaluator.

Your role is to:
1. Diagnose the sales potential of the product description for the US market
2. Score it consistently
3. Identify concrete weaknesses
4. Suggest sharp, practical improvements
5. Rewrite it into a stronger version for US buyers

Important rules:
- Be specific, not abstract
- Avoid generic advice
- Be concise and sharp
- Output must feel like a professional diagnosis, not a casual opinion
- Focus on persuasion, trust, clarity, and conversion
- Assume the target market is the United States only
- Judge from the perspective of US online shoppers
- If the text is vague, weak, unconvincing, unnatural, or missing buyer-critical information, score it lower
- Do not be overly kind
- Do not inflate scores

You must score the following 5 fixed categories from 0 to 20:
1. Clarity
2. Trust
3. Benefit
4. US Fit
5. Purchase Motivation

Then calculate:
- total_score = sum of all five category scores
- total_score must be between 0 and 100

Scoring guidelines:

Clarity:
- Is the product easy to understand immediately?
- Is the wording clear and concrete?
- Is there confusion, vagueness, or missing context?

Trust:
- Does the description feel credible?
- Are there specific facts, details, proof, materials, use cases, or reassurance?
- Does it sound suspicious, empty, exaggerated, or unsupported?

Benefit:
- Does it clearly explain why the buyer should care?
- Are the real user benefits obvious?
- Does it focus too much on features without outcomes?

US Fit:
- Does the description match US buyer expectations and style?
- Does it sound suitable for US ecommerce?
- Are there awkward cultural assumptions, weak hooks, or Japan-only logic?

Purchase Motivation:
- Does the description create desire to buy?
- Is it compelling, emotionally or practically?
- Would a US shopper feel a reason to act?

You must return output in valid JSON only.
No markdown.
No explanation outside JSON.
No extra text.

Use this exact JSON schema:

{
  "total_score": 0,
  "scores": {
    "clarity": 0,
    "trust": 0,
    "benefit": 0,
    "us_fit": 0,
    "purchase_motivation": 0
  },
  "summary": {
    "verdict": "",
    "one_line_diagnosis": ""
  },
  "ng_points": [""],
  "improvements": [""],
  "rewritten_copy": ""
}

Rules for each field:
- "verdict": short label in natural Japanese, e.g. "改善が必要", "可能性あり・要改善", "普通", "強い"
- "one_line_diagnosis": one sharp sentence in natural Japanese
- "ng_points": 3 to 6 concrete problems, each written in natural Japanese
- "improvements": 3 to 6 concrete fixes, each written in natural Japanese
- "rewritten_copy": a revised product description in natural English only (do NOT translate this field)

If the input is in Japanese, first understand it correctly, then evaluate its US sales potential.
Always write rewritten_copy in natural English regardless of the input language.
Always write verdict, one_line_diagnosis, ng_points, and improvements in natural Japanese.

Do not use placeholders such as [X], [Brand], [Product Name], or any bracketed values in rewritten_copy.
If specific data is missing, generate realistic and reasonable values instead.

Be consistent in scoring."""


def parse_claude_json(raw_text):
    """
    Safely extract and parse a JSON object from Claude's response text.
    Handles: empty text, markdown code fences, extra surrounding text.
    Returns a dict on success, or None on failure.
    """
    if not raw_text or not raw_text.strip():
        print("[debug] Claude response was empty")
        return None

    text = raw_text.strip()
    print(f"[debug] Claude raw response preview: {text[:300]}")

    # Strip markdown code fences if present (```json ... ``` or ``` ... ```)
    if text.startswith("```"):
        text = text.split("```")[1]          # grab content inside fences
        if text.lower().startswith("json"):  # remove optional language tag
            text = text[4:]
        text = text.strip()

    # Find the first { ... } block in case there is leading/trailing prose
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        print("[debug] No JSON object found in Claude response")
        return None

    json_str = text[start:end + 1]

    try:
        return json.loads(json_str)
    except json.JSONDecodeError as e:
        print(f"[debug] JSON parse error: {e}")
        return None


# --- Static file routes ---

@app.route("/")
def index():
    return send_from_directory(BASE_DIR, "index.html")

@app.route("/style.css")
def styles():
    return send_from_directory(BASE_DIR, "style.css")

@app.route("/app.js")
def scripts():
    return send_from_directory(BASE_DIR, "app.js")


# --- API route ---

@app.route("/diagnose", methods=["POST"])
def diagnose():
    try:
        print("[debug] /diagnose request received")

        # Check for API key first
        api_key = os.environ.get("ANTHROPIC_API_KEY", "")

        # Normalize: strip whitespace and surrounding quotes
        api_key = api_key.strip().strip("'\"")

        print(f"[debug] API key exists: {bool(api_key)}")
        print(f"[debug] API key length: {len(api_key)}")
        print(f"[debug] API key prefix: {api_key[:8]}")

        if not api_key:
            return jsonify({"error": "ANTHROPIC_API_KEY is not set. Add it to your .env file."}), 500

        # Validate request body
        data = request.get_json()
        if not data or not data.get("product_description", "").strip():
            return jsonify({"error": "product_description is required."}), 400

        product_description = data["product_description"].strip()
        print(f"[debug] Input length: {len(product_description)} characters")

        # Call the Claude API
        print("[debug] Calling Anthropic API...")
        client = anthropic.Anthropic(api_key=api_key)
        message = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            messages=[
                {"role": "user", "content": product_description}
            ]
        )
        print("[debug] Anthropic API call complete")

        # Parse Claude's JSON response safely
        print("[debug] Parsing Claude response...")
        result = parse_claude_json(message.content[0].text)
        if result is None:
            return jsonify({"error": "Claude returned a response that could not be parsed as JSON."}), 500

        print("[debug] Parsing successful")
        return jsonify(result), 200

    except Exception as e:
        print(f"[debug] Exception in /diagnose: {e}")
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True)
