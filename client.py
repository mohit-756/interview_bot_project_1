"""
services/llm/client.py

Two functions only:
  extract_skills(jd_text)  -> dict[str, int]   used when HR uploads JD
  score_answer(question, answer) -> dict        used after interview ends
"""
from __future__ import annotations

import json
import logging
import os
import re

from groq import Groq

logger = logging.getLogger(__name__)

_client: Groq | None = None


def _get_client() -> Groq:
    global _client
    if _client is None:
        api_key = os.getenv("GROQ_API_KEY", "")
        if not api_key:
            raise RuntimeError("GROQ_API_KEY is not set in .env")
        _client = Groq(api_key=api_key)
    return _client


def _llm_model() -> str:
    return os.getenv("GROQ_LLM_MODEL", "llama-3.1-8b-instant")


def _clean_json(raw: str) -> str:
    """Strip markdown fences and whitespace."""
    return re.sub(r"```(?:json)?", "", raw).strip().strip("`")


# ── 1. Skill extraction ──────────────────────────────────────────────────────

def extract_skills(jd_text: str) -> dict[str, int]:
    """
    Read JD text and return skills with importance weights 1-10.

    Returns {} on any failure so the caller can fall back gracefully.
    """
    if not jd_text or not jd_text.strip():
        return {}

    prompt = (
        "You are a technical recruiter. Read the job description below and extract "
        "all required technical skills.\n\n"
        "Return ONLY a valid JSON object where:\n"
        "- keys are skill names in lowercase (e.g. python, react, sql)\n"
        "- values are importance weights as integers from 1 to 10\n\n"
        "Example output:\n"
        '{"python": 9, "react": 7, "sql": 6, "docker": 4, "git": 3}\n\n'
        "Job Description:\n"
        f"{jd_text[:4000]}\n\n"
        "Return ONLY the JSON object. No explanation, no markdown."
    )

    try:
        response = _get_client().chat.completions.create(
            model=_llm_model(),
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
            max_tokens=600,
        )
        raw = _clean_json(response.choices[0].message.content or "")
        data = json.loads(raw)
        return {
            str(k).strip().lower(): max(1, min(10, int(v)))
            for k, v in data.items()
            if str(k).strip()
        }
    except Exception as exc:
        logger.error("extract_skills failed: %s", exc)
        return {}


# ── 2. Answer scoring ────────────────────────────────────────────────────────

def score_answer(question: str, answer: str) -> dict[str, object]:
    """
    Score a candidate's transcribed answer against the interview question.

    Returns:
        {
            "score": int (0-100),
            "feedback": str (one sentence)
        }
    """
    if not answer or not answer.strip():
        return {"score": 0, "feedback": "No answer was provided."}

    prompt = (
        "You are an interview evaluator. Score the candidate's answer to the question below.\n\n"
        f"Question: {question}\n\n"
        f"Candidate Answer: {answer}\n\n"
        "Return ONLY a valid JSON object with exactly two fields:\n"
        '- "score": integer 0-100 (how well the answer addresses the question)\n'
        '- "feedback": one short sentence explaining the score\n\n'
        "Example:\n"
        '{"score": 72, "feedback": "Good understanding of core concepts but missing error handling details."}\n\n'
        "Return ONLY the JSON. No markdown, no explanation."
    )

    try:
        response = _get_client().chat.completions.create(
            model=_llm_model(),
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
            max_tokens=200,
        )
        raw = _clean_json(response.choices[0].message.content or "")
        data = json.loads(raw)
        return {
            "score": max(0, min(100, int(data.get("score", 50)))),
            "feedback": str(data.get("feedback", ""))[:500],
        }
    except Exception as exc:
        logger.error("score_answer failed: %s", exc)
        return {"score": 50, "feedback": "Evaluation unavailable."}
