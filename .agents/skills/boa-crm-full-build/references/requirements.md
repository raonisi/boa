# BOA CRM Full Requirements Reference

This reference expands the skill requirements into a checklist.

## Must-have modules

- Customer management
- Customer assignment
- Deputy manager DB distribution
- Contract management
- Automatic performance aggregation
- Schedule/calendar
- Notification center
- User management
- Team/organization management
- Settings/master data
- Data download
- Customer DB bulk upload
- Audit logs
- Security and privacy controls

## Original customer DB distribution fields

- 이름
- 연락처
- 생년월일
- 성별
- 지역
- 예상보험료
- 통화가능시간

## Customer status values

- 미상담
- 부재
- 통화완료
- 상담예정
- 설계중
- 계약
- 보류
- 거절
- 해지관리

## Contract fields

- 고객
- 담당 설계사
- 보험사
- 상품명
- 상품군
- 계약일
- 월보험료
- 납입상태
- 계약상태
- 메모

Never add policy number / 증권번호.

## Notification requirements

- Birthday notification
- 90-day diagnosis benefit effective notification
- 1-year 100% benefit availability notification
- 90-day long unmanaged customer notification
- Incomplete schedule notification

## Bulk import required CSV header

이름,연락처,생년월일,성별,지역,예상보험료,통화가능시간,유입경로,상담상태,메모,부지점장,팀,담당자
