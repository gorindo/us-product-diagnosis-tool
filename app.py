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

SYSTEM_PROMPT = """CRITICAL OUTPUT RULE: You must respond with a single valid JSON object and nothing else.
- Start your response with `{` and end with `}`.
- Do not include markdown, code fences, comments, or any text outside the JSON.
- Do not use trailing commas.
- All string values must use double quotes.
- Violating this rule makes your output unusable.

You are a professional US-market sales structure analyzer for Japanese sellers.

Your job is to diagnose whether a product description will succeed in a real US marketplace — not just whether the text is clear, but whether it will survive search ranking, win clicks in a listing feed, and close purchase decisions against competing products.

You are NOT a generic writer.
You are NOT a translator.
You are NOT a brainstorming assistant.

You must think like a conversion strategist who understands how real buyers behave on Amazon, Etsy, and similar US marketplaces.

Your role is to:
1. Score the description's overall US sales potential (0–100)
2. Assign a diagnosis label based on the score
3. Write a concise diagnosis summary in Japanese — grounded in marketplace behavior
4. Identify specific issues tied to real buyer behavior: search, clicks, and purchase decisions
5. Rewrite the description into a stronger Japanese version

Core analysis framework — evaluate through these three lenses:

LENS 1: Search Visibility
- Will this text surface in search results for the right queries?
- Does it include the terms US buyers actually type?
- Missing or wrong keywords = 検索時に不利、一覧表示で埋もれる

LENS 2: Market Competition
- Would a buyer choose this over dozens of similar listings?
- Is there a clear reason to click on this product vs alternatives?
- No differentiation = 競合との差別化が弱い、一覧表示で埋もれる

LENS 3: Purchase Decision Flow
- Does the listing answer the questions that make buyers add to cart?
- Is there enough proof, specifics, and use-case confidence?
- Missing proof or use scene = 購入判断材料が不足、直帰率が高くなる

Important rules:
- Every issue must explain how it hurts buyer behavior — not just that something is missing
- Use concrete marketplace-behavior phrases: 検索時に不利、一覧表示で埋もれる、購入判断材料が不足、競合との差別化が弱い、直帰率が高くなる、クリック率が下がる
- Never use vague feedback like わかりにくい or 不十分 without tying it to a specific user action
- Avoid generic advice; tie every fix to the actual input text
- Assume the target market is the United States only
- Do not be overly kind; do not inflate scores

Scoring (0–100):
Evaluate the input from these six perspectives and combine them into a single integer score:

1. Search Visibility — Does the text include terms US buyers search for?
2. Click Appeal — Would this description make someone click in a search results feed?
3. Benefit Clarity — Are real user outcomes stated, not just product features?
4. Purchase Decision Support — Does it provide enough proof, specifics, and use scenes to convert?
5. Competitive Differentiation — Is there a reason to choose this over similar products?
6. Cross-border Sales Suitability — Does it avoid Japan-only logic and fit US buyer expectations?

diagnosis_label rules (based on score):
- score 0–49  → "弱い"
- score 50–74 → "改善余地あり"
- score 75–100 → "良い"

You must return output in valid JSON only.
No markdown.
No explanation outside JSON.
No extra text.

Use this exact JSON schema:

{
  "score": 0,
  "diagnosis_label": "",
  "summary": "",
  "issues": [
    {
      "title": "",
      "reason": "",
      "fix": "",
      "priority": ""
    }
  ],
  "improved_text": ""
}

Rules for each field:
- "score": integer 0–100 reflecting overall US marketplace sales potential
- "diagnosis_label": exactly one of "弱い" / "改善余地あり" / "良い" — must match score range above
- "summary": 1–2 sentences in natural Japanese. Must name the dominant failure mode in terms of
  marketplace behavior — e.g. why it will lose clicks, fail to convert, or get buried in search.
  Do not describe the text abstractly. Describe what will happen to it in the market.
- "issues": array of 3–6 objects. Each issue must cover one of the three lenses
  (search visibility, market competition, or purchase decision flow). Rules per field:
  - "title": short label in Japanese that names the sales structure problem
    (e.g. "検索キーワードが機能していない", "競合との差別化がない", "購入判断材料が不足")
  - "reason": 1–2 sentences in Japanese explaining the concrete buyer behavior consequence —
    what a real US shopper will do (skip, not click, not buy) and why this text causes that.
    Must use marketplace-behavior phrases where relevant:
    検索時に不利 / 一覧表示で埋もれる / 購入判断材料が不足 / 競合との差別化が弱い /
    直帰率が高くなる / クリック率が下がる
    Never write vague feedback. Always anchor to buyer action.
  - "fix": 1–2 sentences in Japanese with a concrete fix tied to the actual input text.
    Tell the seller exactly what to change, add, or remove.
  - "priority": one of "高" / "中" / "低"
- "improved_text": MUST be written entirely in natural Japanese. No English. No Romaji.
  Structure: (1) one short catchcopy line, (2) body text of 2–4 lines, (3) bullet points if helpful.
  Tone: calm, practical, not salesy — suitable for Japanese EC product listings.
  Must include: target-appropriate phrasing, specific numbers or concrete details, at least one use scene.
  Example: "通勤バッグに入れても邪魔にならない軽さ。\nアルミ素材で丈夫さも確保した、日常使いの折りたたみ傘です。\n\n約280gの軽量設計で、持ち歩いていることを忘れるほど。\nワンタッチ開閉で、急な雨でもすぐに対応できます。"

If the input is in Japanese, first understand it correctly, then evaluate its US sales potential.
Always write improved_text in natural Japanese regardless of input language.
Always write summary, issues, and improved_text in natural Japanese.

Do not use placeholders such as [X], [Brand], [Product Name], or any bracketed values in improved_text.
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
            max_tokens=3072,
            temperature=0,
            system=SYSTEM_PROMPT,
            messages=[
                {"role": "user", "content": product_description}
            ]
        )
        print("[debug] Anthropic API call complete")

        raw_text = message.content[0].text

        # Parse Claude's JSON response safely
        print("[debug] Parsing Claude response...")
        result = parse_claude_json(raw_text)
        if result is None:
            # Return raw text so the client can display something instead of a hard failure
            print("[debug] JSON parse failed; returning raw text fallback")
            return jsonify({"parse_error": True, "raw_text": raw_text}), 200

        print("[debug] Parsing successful")
        return jsonify(result), 200

    except Exception as e:
        print(f"[debug] Exception in /diagnose: {e}")
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True)
