from services.llm_question_generator import generate_question_bundle_with_fallback

resume = """Backend Engineer, 5 years
- Real-time notification service (Redis + WebSocket)
- Scaled Elasticsearch 10TB → 100TB (30% cost reduction)
- Fixed cache invalidation bug (2-hour outage)
- Skills: Python, Go, Kubernetes, PostgreSQL"""

result = generate_question_bundle_with_fallback(
    resume_text=resume,
    jd_title="Senior Backend Engineer",
    jd_skill_scores={"Python": 9, "Kubernetes": 8, "AWS": 7},
    question_count=8,
)

# Print results
print(f"✓ Generated {result['total_questions']} questions")
print(f"✓ Types: {result['by_type']}")
print(f"✓ Has opener: {result['has_opener']}")
print(f"✓ Has behavioral: {result['has_behavioral']}")

# Show questions
for i, q in enumerate(result['questions'], 1):
    print(f"{i}. [{q['type']}] {q['text'][:70]}...")