from services.question_plan import build_question_plan, build_question_context
import json

frontend_resume = """
Frontend developer with 2+ years of experience building responsive user-facing applications.
Skills: HTML5, CSS3, JavaScript, React.js, Responsive Design, Cross-Browser Compatibility, REST API Integration, SQL.
Projects: Veriton data platform built with React.js and TypeScript for data ingestion, AI-driven data modeling, data quality rules, named entity resolution, drag-and-drop ETL pipeline builder, and auto Power BI dashboard generation.
Experience: Developed frontend flows for the Veriton data platform, handled API integration across S3, Azure Blob Storage, and OneLake, and worked on responsiveness and user-friendly web application delivery.
"""

mohit_resume = open("resume.txt", encoding="utf-8").read()

rohith_resume = """
Senior Data & BI Architect with 17+ years of experience designing and delivering enterprise-scale data, analytics, and business intelligence platforms.
Skills: Databricks Lakehouse Platform, Delta Lake, Unity Catalog, Databricks SQL, Databricks Workflows, Structured Streaming, Auto Loader, Spark, Microsoft Fabric, Data Governance, Performance Optimization.
Projects: Enterprise lakehouse modernization for a global manufacturing client using Databricks Lakehouse Platform and Microsoft Fabric; Azure-based enterprise analytics platform for MGM Resorts using Databricks, Delta Lake, and Bronze-Silver-Gold data models.
Experience: Architected end-to-end lakehouse platforms, designed ingestion and transformation patterns, optimized Spark workloads with Structured Streaming and Photon, enforced governance and cost controls, mentored engineers, aligned business and technology stakeholders, and reduced data processing time by 30% while improving data reliability.
"""

cases = [
    (
        "frontend",
        frontend_resume,
        "Frontend Developer",
        {"React": 10, "JavaScript": 9, "TypeScript": 8, "CSS": 7, "Responsive Design": 7, "REST API Integration": 7},
    ),
    (
        "aiml_backend_mohit",
        mohit_resume,
        "Software Engineer – Backend / AI Screening Systems",
        {"Python": 10, "FastAPI": 9, "NLP": 8, "SQL": 8, "React": 7, "Resume screening": 7, "Scoring engine": 7, "Backend workflow": 6},
    ),
    (
        "databricks_leadership_rohith",
        rohith_resume,
        "Head of Databricks Practice",
        {"Databricks": 10, "Lakehouse Architecture": 9, "Stakeholder Management": 9, "Delivery Governance": 8, "Unity Catalog": 8, "Spark": 8},
    ),
]

for name, resume_text, jd_title, skills in cases:
    bundle = build_question_plan(resume_text=resume_text, jd_title=jd_title, jd_skill_scores=skills, question_count=9)
    ctx = build_question_context(resume_text=resume_text, jd_title=jd_title, jd_skill_scores=skills, question_count=9)
    print(f"=== {name} ===")
    print("role", bundle["meta"]["role_family"], "track", bundle["meta"]["role_track"])
    print("topics", json.dumps(ctx["topic_priorities"][:5], default=str)[:1500])
    for i, q in enumerate(bundle["questions"], 1):
        print(f"{i}. {q['text']}")
    print("---")
