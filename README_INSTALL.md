# BOA Codex Skill Package 설치 방법

이 패키지는 `raonis/boa` 보험 영업 사내 CRM 프로젝트를 Codex가 이어서 개발·검수할 때 쓰는 저장소용 Skill과 루트 AGENTS.md입니다.

## 포함 파일

```text
AGENTS.md
.agents/skills/boa-crm-full-build/SKILL.md
.agents/skills/boa-crm-full-build/references/requirements.md
.agents/skills/boa-crm-full-build/references/verification-checklist.md
```

## 설치 방법

1. ZIP 압축을 풉니다.
2. `AGENTS.md`를 GitHub 저장소 루트에 넣습니다.
3. `.agents/skills/boa-crm-full-build/` 폴더 전체를 GitHub 저장소 루트에 넣습니다.
4. GitHub에 commit/push 합니다.
5. Codex에서 저장소를 다시 열거나 새 세션을 시작합니다.
6. Codex에 아래처럼 지시합니다.

```text
Use the $boa-crm-full-build skill.
First, do not edit code. Audit the repository against the full CRM requirements and produce a gap report.
```

## 주의

- 실제 `.env`는 업로드하지 마세요.
- 실제 고객정보 CSV는 업로드하지 마세요.
- Skill은 Codex 작업 지침입니다. 직접 실행되는 앱이 아닙니다.
