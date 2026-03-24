from ai_engine.phase1.matching import extract_text_from_file
from services.question_plan import build_question_plan, build_question_context
import json

cases = [
    (
        "frontend",
        "uploads/resume_1_bc2254957f794956ad250ad57c0b9dde_DEVARAPALLI_PALLAVI-frontend.pdf",
        "Frontend Developer",
        {"React": 10, "JavaScript": 9, "TypeScript": 8, "CSS": 7, "Responsive Design": 7, "API Integration": 7},
    ),
    (
        "aiml",
        "resume.txt",
        "Software Engineer – Backend / AI Screening Systems",
        {"Python": 10, "FastAPI": 9, "NLP": 8, "SQL": 8, "React": 7, "Resume screening": 7, "Scoring engine": 7, "Backend workflow": 6},
    ),
    (
        "databricks",
        "uploads/resume_2_10f13d004e8c44c896c2a14f4c28ae4f_Rohith_Reddy_Senior_Databricks_Architect.pdf",
        "Head of Databricks Practice",
        {"Databricks": 10, "Lakehouse Architecture": 9, "Stakeholder Management": 9, "Delivery Governance": 8, "Unity Catalog": 8, "Spark": 8},
    ),
]

for name, resume_path, jd_title, skills in cases:
    resume_text = open(resume_path, encoding="utf-8").read() if resume_path.endswith(".txt") else extract_text_from_file(resume_path)
    bundle = build_question_plan(resume_text=resume_text, jd_title=jd_title, jd_skill_scores=skills, question_count=9)
    ctx = build_question_context(resume_text=resume_text, jd_title=jd_title, jd_skill_scores=skills, question_count=9)
    print(f"=== {name} ===")
    print("role", bundle["meta"]["role_family"], "track", bundle["meta"]["role_track"])
    print("topics", json.dumps(ctx["topic_priorities"][:4], default=str)[:1200])
    for i, q in enumerate(bundle["questions"], 1):
        print(f"{i}. {q['text']}")
    print("---")
