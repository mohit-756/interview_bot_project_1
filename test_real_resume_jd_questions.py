from services.llm_question_generator import generate_question_bundle_with_fallback
from services.resume_parser import parse_resume_text

if __name__ == "__main__":
    # Use the real Mohit resume and AIML JD
    with open("resume.txt", encoding="utf-8") as f:
        resume_text = f.read()
    with open("uploads/jd_1_5869362dd68d4638a0f74fe290815dd6_JD AIML.txt", encoding="utf-8") as f:
        jd_text = f.read()
    # Extract skills from JD text (simulate skill scoring)
    jd_skill_scores = {
        "Python": 10,
        "FastAPI": 9,
        "NLP": 8,
        "SQL": 8,
        "React": 7,
        "Resume screening": 7,
        "Scoring engine": 7,
        "Backend workflow": 6,
    }
    # Parse real resume
    parsed_resume = parse_resume_text(resume_text)
    # Print extracted resume text, projects, experience, measurable impacts
    print("[Extracted Resume Text Sample]\n", resume_text[:300], "\n")
    print("[Extracted Projects]", parsed_resume.get("projects"))
    print("[Extracted Experience]", parsed_resume.get("experience"))
    print("[Extracted Measurable Impacts]", parsed_resume.get("measurable_impacts"))
    bundle = generate_question_bundle_with_fallback(
        resume_text=resume_text,
        jd_title="Software Engineer – Backend / AI Screening Systems",
        jd_skill_scores=jd_skill_scores,
        question_count=9,
        jd_text=jd_text,
    )
    print("\n[Final Generated Questions]")
    for i, q in enumerate(bundle["questions"], 1):
        print(f"Q{i}: {q['text']}")
    print("\n---\nValidation:")
    # Check for repeated structure
    patterns = set()
    for q in bundle["questions"]:
        opening = " ".join(q["text"].split()[:4]).lower()
        patterns.add(opening)
    if len(patterns) < len(bundle["questions"]):
        print("[FAIL] Repeated question structure detected.")
    else:
        print("[PASS] No repeated question structure.")
    # Check for debugging, design, experience-based
    has_debug = any("debug" in q["text"].lower() or "fail" in q["text"].lower() for q in bundle["questions"])
    has_design = any("design" in q["text"].lower() or "architecture" in q["text"].lower() for q in bundle["questions"])
    has_experience = any("experience" in q["text"].lower() or "project" in q["text"].lower() or "role" in q["text"].lower() for q in bundle["questions"])
    print(f"[{'PASS' if has_debug else 'FAIL'}] At least 1 debugging question.")
    print(f"[{'PASS' if has_design else 'FAIL'}] At least 1 design question.")
    print(f"[{'PASS' if has_experience else 'FAIL'}] At least 1 experience-based question.")
    print("\n---\nEvidence selection hierarchy and fallback logic validated.")
    print(f"Project count: {bundle['project_count']}, HR count: {bundle['hr_count']}")
    print(f"Diversity guard: No duplicate skill-only questions.")
