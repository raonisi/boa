# BOA CRM UX Copy Guide

## Core Vocabulary

- Today Work: `오늘 업무`
- Schedule: `일정`
- Follow-up / Followup: `후속관리`
- Notification: `알림`
- Unread: `읽지 않은 알림`
- Mark as read: `읽음`
- Processed / Handled: `처리완료`
- Customer Detail: `고객 상세`
- Customer List: `고객 목록`
- Assignment: `DB 배정`
- Customer Assignment: `고객 DB 배정`
- Priority: `우선순위`
- Status: `상태`

## CTA Principles

- Prefer action-first labels: `고객 보기`, `일정 보기`, `후속관리 보기`, `알림 보기`
- Use explicit completion labels:
  - `읽음`: read acknowledgment
  - `완료`: follow-up task completion
  - `처리완료`: workflow/process completion
- Keep safety-sensitive actions explicit:
  - `삭제 요청`, `최종 확인`, `다운로드 사유 입력`

## State Copy Standards

- Loading: `불러오고 있습니다.`
- Empty: `표시할 항목이 없습니다.`
- Error: `정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.`
- Forbidden: `접근 권한이 없습니다. 필요한 권한을 확인해 주세요.`
- NotFound: `찾을 수 없는 화면입니다. 주소를 다시 확인해 주세요.`

## Consistency Rules

- Do not expose raw enums to users.
- Avoid mixed English/Korean labels for the same concept in one screen.
- Prefer shared state components and status helpers before ad-hoc copy.
